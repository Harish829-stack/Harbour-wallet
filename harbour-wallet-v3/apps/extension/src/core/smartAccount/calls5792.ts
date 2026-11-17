// EIP-5792 (wallet_sendCalls and friends) for the smart account. Pure: strict normalizers and answer shapes, no I/O.
// A dApp can only ASK to run calls atomically; it can never turn the smart account on, name a paymaster or pick a fee.
//  - Accounts that are not turned on (or are delegated elsewhere) get error 5760: dApps then send ordinary transactions themselves.
//  - Capabilities a dApp marks as required (non-optional) are refused with 5700, including `paymasterService`.
import { ERR, ProviderError } from '../provider/errors';
import { MAX_CALLS, isSmartAccountChain } from './constants';
import { normalizeCall } from './abi';

export type AtomicStatus = 'supported' | 'unsupported';
export interface NormalizedCalls { version: '2.0.0' | '1.0'; id: string | null; chainId: number; from: string; atomicRequired: boolean; calls: Array<{ to: string; value: string; data: string }> }

const bad = (m: string): never => { throw new ProviderError(ERR.INVALID_PARAMS, m); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const ID = /^0x[0-9a-fA-F]{2,128}$/;
const KEYS = new Set(['version', 'id', 'from', 'chainId', 'atomicRequired', 'calls', 'capabilities']);
const CALL_KEYS = new Set(['to', 'value', 'data', 'chainId', 'capabilities']);
const QTY = /^0x(0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/;

/** wallet_sendCalls params: [{ version, id?, from?, chainId, atomicRequired, calls, capabilities? }] bound to the site's connected account and chain. */
export function normalizeSendCalls(params: unknown, connected: string, siteChainId: number): NormalizedCalls {
  if (!Array.isArray(params) || params.length !== 1 || !isObj(params[0])) bad('Expected a single request object.');
  const o = (params as unknown[])[0] as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) bad(`Unsupported field: ${k}.`);
  if (o.version !== '2.0.0' && o.version !== '1.0') bad('Unsupported version.');
  const from = o.from === undefined ? connected : o.from;
  if (typeof from !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(from)) bad('Invalid `from` address.');
  if (!same(from as string, connected)) throw new ProviderError(ERR.UNAUTHORIZED, 'The `from` address is not the connected account.');
  if (typeof o.chainId !== 'string' || !QTY.test(o.chainId)) bad('Invalid chainId.');
  const chainId = Number(BigInt(o.chainId as string));
  if (chainId !== siteChainId) throw new ProviderError(ERR.CALLS_CHAIN_UNSUPPORTED, 'The request names a different network than this site is connected to.');
  if (!isSmartAccountChain(chainId)) throw new ProviderError(ERR.CALLS_CHAIN_UNSUPPORTED);
  if (typeof o.atomicRequired !== 'boolean') bad('`atomicRequired` must be true or false.');
  let id: string | null = null;
  if (o.id !== undefined) { if (typeof o.id !== 'string' || !ID.test(o.id)) bad('Invalid id.'); id = (o.id as string).toLowerCase(); }
  if (!Array.isArray(o.calls) || o.calls.length < 1) bad('At least one call is required.');
  if ((o.calls as unknown[]).length > MAX_CALLS) throw new ProviderError(ERR.CALLS_TOO_LARGE, `At most ${MAX_CALLS} calls.`);
  refuseRequiredCapabilities(o.capabilities);
  const calls = (o.calls as unknown[]).map((c) => {
    if (!isObj(c)) return bad('Each call must be an object.');
    for (const k of Object.keys(c)) if (!CALL_KEYS.has(k)) bad(`Unsupported call field: ${k}.`);
    if (c.chainId !== undefined && c.chainId !== o.chainId) bad('A call names a different chainId.');
    refuseRequiredCapabilities(c.capabilities);
    if (c.to === undefined || c.to === null) bad('Contract creation is not supported in a batch.');
    try { const n = normalizeCall({ to: c.to, value: c.value, data: c.data }); return { to: n.to as string, value: '0x' + n.value.toString(16), data: n.data as string }; }
    catch (e) { return bad((e as Error).message); }
  });
  return { version: o.version as '2.0.0' | '1.0', id, chainId, from: from as string, atomicRequired: o.atomicRequired as boolean, calls };
}

/** Any capability the site marks as required (not `optional: true`) is refused, so nothing is silently skipped. */
export function refuseRequiredCapabilities(caps: unknown): void {
  if (caps === undefined || caps === null) return;
  if (!isObj(caps)) bad('Invalid capabilities.');
  const names = Object.entries(caps as Record<string, unknown>).filter(([, v]) => !(isObj(v) && v.optional === true)).map(([k]) => k);
  if (names.length) throw new ProviderError(ERR.CAPS_UNSUPPORTED, `Unsupported capability: ${names[0]}.`, { capability: names[0] });
}

/** wallet_getCapabilities answer. `states` maps chainId -> whether the connected account runs the pinned smart account there. */
export function buildCapabilities(requested: unknown, siteChainId: number, states: Readonly<Record<number, AtomicStatus>>): Record<string, { atomic: { status: AtomicStatus } }> {
  let ids: number[] = Object.keys(states).map(Number);
  if (requested !== undefined && requested !== null) {
    if (!Array.isArray(requested) || requested.length > 32 || requested.some((c) => typeof c !== 'string' || !QTY.test(c))) bad('Invalid chain filter.');
    ids = (requested as string[]).map((c) => Number(BigInt(c))).filter((c) => c in states);
  }
  void siteChainId;
  return Object.fromEntries(ids.map((c) => [('0x' + c.toString(16)), { atomic: { status: states[c] } }]));
}

/** EIP-5792 status: 100 pending, 200 confirmed, 500 failed before inclusion, 600 reverted. */
export type BundleReceipt = { transactionHash?: unknown; blockHash?: unknown; blockNumber?: unknown; gasUsed?: unknown; logs?: unknown };
const H32 = /^0x[0-9a-fA-F]{64}$/;
/** Copies only whitelisted, well-formed receipt fields from the bundler's reply (never passes unknown data to the site). Null when unusable. */
function cleanReceipt(r: BundleReceipt | null | undefined, success: boolean) {
  if (!r || typeof r.transactionHash !== 'string' || !H32.test(r.transactionHash) || typeof r.blockHash !== 'string' || !H32.test(r.blockHash)) return null;
  const q = (v: unknown) => (typeof v === 'string' && QTY.test(v) ? v : null);
  const blockNumber = q(r.blockNumber), gasUsed = q(r.gasUsed); if (!blockNumber || !gasUsed) return null;
  const logs = Array.isArray(r.logs) ? r.logs.slice(0, 200).filter((l): l is Record<string, unknown> => isObj(l) && typeof l.address === 'string' && Array.isArray(l.topics) && typeof l.data === 'string')
    .map((l) => ({ address: l.address, topics: (l.topics as unknown[]).filter((t): t is string => typeof t === 'string' && H32.test(t)), data: l.data })) : [];
  return { logs, status: success ? '0x1' : '0x0', blockHash: r.blockHash, blockNumber, gasUsed, transactionHash: r.transactionHash };
}
export function buildCallsStatus(p: { id: string; chainId: number; state: 'pending' } | { id: string; chainId: number; state: 'done'; success: boolean; receipt: BundleReceipt | null }): Record<string, unknown> {
  const base = { version: '2.0.0', id: p.id, chainId: '0x' + p.chainId.toString(16), atomic: true };
  if (p.state === 'pending') return { ...base, status: 100 };
  const r = cleanReceipt(p.receipt, p.success);
  if (!r) return { ...base, status: 100 }; // inclusion not provable yet: keep reporting pending rather than invent a receipt
  return { ...base, status: p.success ? 200 : 600, receipts: [r] };
}
