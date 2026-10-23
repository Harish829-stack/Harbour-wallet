// Wallet import rules shared by onboarding and the background. Pure (wallet-core is injected) so every rule is unit-testable.
//
// Evidence (Trust Wallet extension 26.41.0; see evidences/re-evidence/38-onboarding-settings/SPEC.md):
//   [certain] chunks/import-mnemonic-or-private-key  - a single token longer than 8 characters is a private key, anything else a
//                                                      secret phrase (`1 === tokens && length > 8`); network picker (EVM group + chains)
//   [certain] background.js WalletService.validatePrivateKey - strip "0x"; Solana = base58 of 32/64 bytes (first 32 used); other
//                                                      chains = hex, else bech32 payload minus its first byte; then
//                                                      walletCore.isValidPrivateKey(bytes, curveOf(coin))
//   [certain] background.js WalletService.importPrivateKey - duplicate = same account address already in a wallet
//                                                      ("Wallet with such account already exists"); EVM imports derive every EVM chain
//   [certain] chunks/BlockedMaxWallets + WalletService.addHardwareWallet - the wallet limit is 30
//   [certain] chunks/useWalletName - default names "Main wallet", "Main wallet 2", ...
import type { ChainInfo } from './chains/types';

export const MAX_WALLETS = 30;
export const WALLET_LIMIT_ERROR = 'MAX_WALLETS';
export const canCreateWallet = (count: number): boolean => count < MAX_WALLETS;
/** TW rule: a single whitespace-free token longer than this is a private key, otherwise a secret phrase. */
export const PRIVATE_KEY_MIN_LENGTH = 8;
export const MAX_WALLET_NAME = 40;

export type SecretKind = 'empty' | 'mnemonic' | 'privateKey';
export function classifySecret(input: string): SecretKind {
  const t = String(input ?? '').trim();
  if (!t) return 'empty';
  const tokens = t.split(/\s+/);
  return tokens.length === 1 && t.length > PRIVATE_KEY_MIN_LENGTH ? 'privateKey' : 'mnemonic';
}
export const normalizeMnemonic = (s: string): string => String(s ?? '').trim().split(/\s+/).join(' ').toLowerCase();
export const mnemonicWordCount = (s: string): number => (String(s ?? '').trim() ? String(s).trim().split(/\s+/).length : 0);

// ---------- wallet name ----------
export function defaultWalletName(existing: string[]): string {
  const used = existing.map((n) => /^Main wallet(?: (\d+))?$/.exec(n)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1] || 1));
  if (!used.length) return 'Main wallet';
  let n = 1; while (used.includes(n)) n++;
  return n === 1 ? 'Main wallet' : `Main wallet ${n}`;
}
export function validateWalletName(name: string, existing: string[]): { isValid: boolean; error?: string } {
  const t = String(name ?? '').trim();
  if (!t) return { isValid: false, error: 'Enter a wallet name' };
  if (t.length > MAX_WALLET_NAME) return { isValid: false, error: `Use at most ${MAX_WALLET_NAME} characters` };
  if (existing.includes(t)) return { isValid: false, error: 'Wallet name already exists' };
  return { isValid: true };
}

// ---------- private key decoding (TW WalletService.validatePrivateKey) ----------
const isHex = (s: string) => s.length > 0 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s);
export interface KeyCodec { hexToBytes(h: string): Uint8Array; base58Decode(s: string): Uint8Array | null; bech32Decode(s: string): Uint8Array | null }
/** wallet-core backed codec. */
export const coreCodec = (core: any): KeyCodec => ({
  hexToBytes: (h) => core.HexCoding.decode(h),
  base58Decode: (s) => { try { return core.Base58.decodeNoCheck(s); } catch { return null; } },
  bech32Decode: (s) => { try { return core.Bech32.decode(s); } catch { return null; } },
});
export function decodePrivateKeyBytes(input: string, solana: boolean, codec: KeyCodec): Uint8Array | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const s = raw.replace(/^0x/i, '');
  try {
    if (solana) {
      const b = codec.base58Decode(s);
      return b && (b.length === 32 || b.length === 64) ? b.slice(0, 32) : null;
    }
    if (isHex(s)) return codec.hexToBytes(s);
    const b = codec.bech32Decode(s);
    return b && b.length > 1 ? b.slice(1) : null;
  } catch { return null; }
}
export interface PkValidation { isValid: boolean; bytes: Uint8Array }
/** `coinName` is the wallet-core CoinType name (registry `ct`). The curve is chosen per coin, exactly like TW. */
export function validatePrivateKey(core: any, input: string, coinName: string): PkValidation {
  const none = { isValid: false, bytes: new Uint8Array() };
  const coin = core?.CoinType?.[coinName]; if (!coin) return none;
  const bytes = decodePrivateKeyBytes(input, coinName === 'solana', coreCodec(core));
  if (!bytes) return none;
  try { return { isValid: !!core.PrivateKey.isValid(bytes, core.CoinTypeExt.curve(coin)), bytes }; } catch { return none; }
}

// ---------- network picker (TW PrivateKeyNetworkSelect / buildPrivateKeyNetworkOptions) ----------
export type PkNetworkOption =
  | { kind: 'evm-group'; id: string; label: string; chainId: string; iconIds: string[] }
  | { kind: 'chain'; id: string; label: string; chainId: string; iconIds: string[] };
const EVM_FAMILY = 'Ethereum';
const POPULAR_ORDER = ['smartchain', 'ethereum', 'solana', 'tron', 'arbitrum', 'base', 'bitcoin', 'robinhoodchain', 'arc'];
const GROUP_ICONS = ['ethereum', 'smartchain', 'base', 'arbitrum'];
const EXCLUDED_IDS = new Set(['decred']);
const nameOf = (c: ChainInfo) => c.name;
const matches = (c: ChainInfo, q: string) => nameOf(c).toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
const popularRank = (c: ChainInfo) => { const i = POPULAR_ORDER.indexOf(c.id); return i === -1 ? POPULAR_ORDER.length : i; };
export function privateKeyNetworkOptions(chains: ChainInfo[], query: string): PkNetworkOption[] {
  const q = query.trim().toLowerCase();
  const usable = chains.filter((c) => !c.testnet && !EXCLUDED_IDS.has(c.id));
  const evm = usable.filter((c) => c.blockchain === EVM_FAMILY);
  const others = usable.filter((c) => c.blockchain !== EVM_FAMILY);
  const out: PkNetworkOption[] = [];
  const hit = q ? evm.find((c) => matches(c, q)) : undefined;
  if (evm.length && (!q || q.includes('evm') || hit)) {
    out.push(hit
      ? { kind: 'evm-group', id: 'evm:group', chainId: 'ethereum', label: `${nameOf(hit)} & EVM chains`, iconIds: [hit.id] }
      : { kind: 'evm-group', id: 'evm:group', chainId: 'ethereum', label: 'EVM chains', iconIds: GROUP_ICONS.filter((id) => evm.some((c) => c.id === id)) });
  }
  const list = others.filter((c) => !q || matches(c, q))
    .sort((a, b) => popularRank(a) - popularRank(b) || nameOf(a).localeCompare(nameOf(b)));
  for (const c of list) out.push({ kind: 'chain', id: c.id, chainId: c.id, label: nameOf(c), iconIds: [c.id] });
  return out;
}
/** Chains whose address is derived from the same secp256k1 key when the EVM group is chosen. */
export const evmFamily = (chains: ChainInfo[]): ChainInfo[] => chains.filter((c) => c.blockchain === EVM_FAMILY && c.kind === 'evm');

// ---------- duplicates ----------
export type WalletsState = Record<string, { accounts?: Array<{ addresses?: Record<string, string> }>; addresses?: Record<string, string> } | undefined>;
const sameAddr = (a: string, b: string) => a === b || (a.startsWith('0x') && b.startsWith('0x') && a.toLowerCase() === b.toLowerCase());
/** True when any account of any existing wallet already holds `address` under the same coin (TW checks `accounts[coin].address`). */
export function hasDuplicateAddress(wallets: WalletsState | undefined, coinName: string, address: string): boolean {
  if (!address) return false;
  for (const w of Object.values(wallets ?? {})) {
    const accts = Array.isArray(w?.accounts) && w!.accounts!.length ? w!.accounts! : [{ addresses: w?.addresses }];
    for (const a of accts) { const have = a?.addresses?.[coinName]; if (have && sameAddr(have, address)) return true; }
  }
  return false;
}

// ---------- Solana derivation choice (TW DeriveSolanaAddress) ----------
export type SolanaVariant = 'default' | 'phantom';
/**
 * `history` = [defaultHasHistory, phantomHasHistory], or null when the lookup failed.
 * Both -> let the user choose; one -> that one; none -> the Phantom/solanaSolana path (the path new wallets use);
 * lookup failure -> default (TW logs a warning and falls back to Default).
 */
export function pickSolanaVariants(history: [boolean, boolean] | null): SolanaVariant[] {
  if (!history) return ['default'];
  const [d, p] = history;
  if (d && p) return ['default', 'phantom'];
  if (d) return ['default'];
  return ['phantom'];
}
export async function solanaHasHistory(addresses: string[], rpcUrls: string[], f: typeof fetch = fetch): Promise<boolean[]> {
  const ask = async (address: string): Promise<boolean> => {
    let last: unknown = new Error('no RPC endpoint');
    for (const u of rpcUrls) {
      try {
        const res = await f(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [address, { limit: 1 }] }), signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j: any = await res.json();
        if (!Array.isArray(j?.result)) throw new Error(j?.error?.message ?? 'bad response');
        return j.result.length > 0;
      } catch (e) { last = e; }
    }
    throw last;
  };
  return Promise.all(addresses.map(ask));
}

// ---------- error mapping shown in the import form ----------
export const IMPORT_ERRORS = {
  duplicateMnemonic: 'This secret phrase is already in Harbour',
  duplicateKey: 'Wallet with such account already exists',
  invalidKey: 'Invalid private key',
  invalidMnemonic: 'Invalid Secret Phrase',
  mnemonicLength: 'Secret Phrase must be 12, 18 or 24 words',
  limit: `You can have up to ${MAX_WALLETS} wallets`,
  expired: 'Your import session expired. Enter the secret again.',
} as const;
