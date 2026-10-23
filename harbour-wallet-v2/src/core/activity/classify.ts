// Turns a transaction (receipt + tx fields, or just the broadcast calldata while it is still pending) into typed activity rows from the
// point of view of one wallet address. This is the client-side equivalent of Trust Wallet's server-side event typing
// (send / receive / approve / revoke / swap / contract), derived from standard ERC-20/721 events and calldata only.
import { fmtUnits, type HistoryItem } from '../txHistory';
import { type Receipt, type TxLite, TOPIC_TRANSFER, TOPIC_APPROVAL, SEL_APPROVE, SEL_TRANSFER, UNLIMITED_MIN, ZERO_ADDRESS, SELECTOR_LABEL, LEND_SELECTORS, lc, hexToBig, hexToNum, addressOfTopic, wordAddress, wordBig } from './evm';

export interface TokenMeta { symbol: string; decimals: number }
export interface ClassifyCtx { assetId: string; me: string; nativeSymbol: string; meta: (tokenAddress: string) => TokenMeta; url?: (hash: string) => string | undefined; source: 'local' | 'logs' }
export interface ClassifyInput { hash: string; receipt?: Receipt | null; tx?: TxLite | null; timestamp: number; status: 'confirmed' | 'failed' | 'pending' }

interface Flow { token: string; from: string; to: string; value: bigint; nft: boolean; tokenId?: string; logIndex: number }
interface Allowance { token: string; spender: string; amount: bigint; logIndex: number }

/** Token transfers touching `me` in a receipt (ERC-20 has 3 topics, ERC-721 has 4). */
export function tokenFlows(receipt: Receipt, me: string): Flow[] {
  const out: Flow[] = [];
  for (const l of receipt.logs ?? []) {
    const t = l.topics ?? []; if (l.removed || lc(t[0]) !== TOPIC_TRANSFER) continue;
    const from = t[1] ? addressOfTopic(t[1]) : ''; const to = t[2] ? addressOfTopic(t[2]) : ''; if (from !== me && to !== me) continue;
    const logIndex = hexToNum(l.logIndex);
    if (t.length === 3) out.push({ token: lc(l.address), from, to, value: hexToBig(l.data), nft: false, logIndex });
    else if (t.length === 4) out.push({ token: lc(l.address), from, to, value: 1n, nft: true, tokenId: hexToBig(t[3]).toString(), logIndex });
  }
  return out;
}
/** Allowances granted by `me` through a direct approve() call (the token is the transaction's `to`). Spend events emitted by transferFrom are NOT approvals. */
export function allowanceLogs(receipt: Receipt, me: string): Allowance[] {
  if (lc(receipt.from) !== me) return [];
  const out: Allowance[] = [];
  for (const l of receipt.logs ?? []) {
    const t = l.topics ?? []; if (l.removed || lc(t[0]) !== TOPIC_APPROVAL || t.length !== 3 || addressOfTopic(t[1]) !== me || lc(l.address) !== lc(receipt.to)) continue;
    out.push({ token: lc(l.address), spender: addressOfTopic(t[2]), amount: hexToBig(l.data), logIndex: hexToNum(l.logIndex) });
  }
  return out;
}
/** Token contracts whose symbol/decimals the classifier will need for this receipt. */
export function tokensNeeded(receipt: Receipt, me: string): string[] {
  return [...new Set([...tokenFlows(receipt, me).map((f) => f.token), ...allowanceLogs(receipt, me).map((a) => a.token)])];
}

const fee = (r?: Receipt | null): string | undefined => { if (!r?.gasUsed || !r.effectiveGasPrice) return undefined; return fmtUnits(hexToBig(r.gasUsed) * hexToBig(r.effectiveGasPrice), 18); };

export function classify(ctx: ClassifyCtx, inp: ClassifyInput): HistoryItem[] {
  const { me } = ctx; const r = inp.receipt ?? null; const tx = inp.tx ?? null;
  const from = lc(r?.from ?? tx?.from); const to = lc(r?.to ?? tx?.to);
  const sender = from === me; const input = lc(tx?.input ?? '0x'); const sel = input.length >= 10 ? input.slice(0, 10) : '';
  const value = hexToBig(tx?.value);
  const failed = inp.status === 'failed'; const haveLogs = !!r && !failed;
  const common = { hash: inp.hash, assetId: ctx.assetId, timestamp: inp.timestamp, status: inp.status, url: ctx.url?.(inp.hash), source: ctx.source, fee: fee(r), block: r ? hexToNum(r.blockNumber) : undefined } as const;
  const unit = (token: string, v: bigint) => { const m = ctx.meta(token); return { m, amount: fmtUnits(v, m.decimals) }; };

  // Allowances: from logs when the receipt is known, else decoded from the pending/failed approve() calldata.
  const allowances: Allowance[] = haveLogs ? allowanceLogs(r!, me)
    : sender && sel === SEL_APPROVE && to ? [{ token: to, spender: wordAddress(input, 0), amount: wordBig(input, 1), logIndex: 0 }] : [];
  if (allowances.length) return allowances.map((a) => {
    const { m, amount } = unit(a.token, a.amount); const revoke = a.amount === 0n;
    return { ...common, id: `${inp.hash}:a${a.logIndex}`, kind: revoke ? 'revoke' : 'approve', amount: revoke ? '' : amount, symbol: m.symbol, spender: a.spender, counterparty: a.spender, unlimited: !revoke && a.amount >= UNLIMITED_MIN, token: { symbol: m.symbol, address: a.token, decimals: m.decimals } } as HistoryItem;
  });

  const flows: Flow[] = haveLogs ? tokenFlows(r!, me)
    : sender && sel === SEL_TRANSFER && to ? [{ token: to, from: me, to: wordAddress(input, 0), value: wordBig(input, 1), nft: false, logIndex: 0 }] : [];
  const outs = flows.filter((f) => f.from === me && f.to !== me && !f.nft); const ins = flows.filter((f) => f.to === me && f.from !== me && !f.nft);
  const label = SELECTOR_LABEL[sel];

  // Lending pool call (deposit / withdraw / borrow / repay): one row for the underlying asset, never a "swap" for the aToken receipt.
  if (sender && LEND_SELECTORS.includes(sel) && !failed && input.length >= 10 + 128) {
    const asset = wordAddress(input, 0); const flow = flows.find((f) => f.token === asset && !f.nft); const raw = flow ? flow.value : wordBig(input, 1);
    if (raw < (1n << 255n)) {
      const { m, amount } = unit(asset, raw);
      return [{ ...common, id: `${inp.hash}:l`, kind: 'contract', amount, symbol: m.symbol, counterparty: to || undefined, token: { symbol: m.symbol, address: asset, decimals: m.decimals }, method: label } as HistoryItem];
    }
  }

  // Swap: I started the transaction, value left me (token or native) and a different fungible token came back.
  if (sender && ins.length && (outs.length || value > 0n) && !failed) {
    const sum = (list: Flow[]) => { const by = new Map<string, bigint>(); for (const f of list) by.set(f.token, (by.get(f.token) ?? 0n) + f.value); return [...by.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0]; };
    const recv = sum(ins); const sent = outs.length ? sum(outs) : undefined;
    if (!sent || sent[0] !== recv[0]) {
      const rr = unit(recv[0], recv[1]); const ss = sent ? unit(sent[0], sent[1]) : { m: { symbol: ctx.nativeSymbol, decimals: 18 }, amount: fmtUnits(value, 18) };
      return [{ ...common, id: `${inp.hash}:s`, kind: 'swap', amount: rr.amount, symbol: rr.m.symbol, counterparty: to || undefined, token: { symbol: rr.m.symbol, address: recv[0], decimals: rr.m.decimals },
        swap: { sent: { symbol: ss.m.symbol, amount: ss.amount, address: sent?.[0] }, received: { symbol: rr.m.symbol, amount: rr.amount, address: recv[0] } } } as HistoryItem];
    }
  }

  const items: HistoryItem[] = [];
  for (const f of flows) {
    const { m, amount } = unit(f.token, f.value); const self = f.from === me && f.to === me; const incoming = f.to === me && !self;
    if (incoming && f.value === 0n && !f.nft) continue; // zero-value inbound transfers are address-poisoning noise
    const direct = sender && f.token === to; // I called the token contract itself (a plain transfer)
    const kind = self ? 'self' : incoming ? 'receive' : sender && !direct ? 'contract' : 'send';
    items.push({ ...common, id: `${inp.hash}:${f.logIndex}`, kind, amount, symbol: f.nft ? m.symbol || 'NFT' : m.symbol, counterparty: incoming ? f.from : f.to, token: { symbol: m.symbol, address: f.token, decimals: m.decimals }, tokenId: f.tokenId,
      method: incoming && f.from === ZERO_ADDRESS ? 'Mint' : f.nft ? 'NFT transfer' : kind === 'contract' ? label : 'Token transfer' } as HistoryItem);
  }
  // Native value I sent (plain transfer, or attached to a contract call).
  if (sender && value > 0n && !items.some((x) => x.kind === 'swap')) {
    const plain = input === '0x' || input === '';
    items.push({ ...common, id: inp.hash, kind: plain ? (to === me ? 'self' : 'send') : 'contract', amount: fmtUnits(value, 18), symbol: ctx.nativeSymbol, counterparty: to || undefined, method: plain ? undefined : label } as HistoryItem);
  }
  // I paid gas for something that moved nothing I can see: a bare contract interaction.
  if (sender && !items.length) items.push({ ...common, id: inp.hash, kind: 'contract', amount: '', symbol: ctx.nativeSymbol, counterparty: to || undefined, method: label } as HistoryItem);
  return items;
}
