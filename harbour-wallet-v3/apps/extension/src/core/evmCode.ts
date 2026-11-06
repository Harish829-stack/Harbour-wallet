// What an EVM address's code says about it. Since EIP-7702 (Pectra), an ordinary wallet (EOA) can carry a 23-byte
// delegation designator (0xef0100 + 20-byte address) to act as a smart account. It is still the user's wallet: it signs
// with its own key and receives ETH and tokens normally, so it must never be reported as a "smart contract".
export type CodeKind = 'eoa' | 'delegated' | 'contract' | 'unknown';

/** Address of the EIP-7702 delegate, or null when the code isn't a delegation designator. */
export function delegationTarget(code: string | null | undefined): string | null {
  const c = (code ?? '').toLowerCase();
  return /^0xef0100[0-9a-f]{40}$/.test(c) ? `0x${c.slice(8)}` : null;
}

/** Classifies eth_getCode output. `undefined`/`null` (lookup failed) is 'unknown', never 'contract'. */
export function codeKind(code: string | null | undefined): CodeKind {
  if (code == null) return 'unknown';
  const c = code.toLowerCase();
  if (c === '' || c === '0x' || c === '0x0') return 'eoa';
  if (delegationTarget(c)) return 'delegated';
  return /^0x[0-9a-f]+$/.test(c) ? 'contract' : 'unknown';
}

/** True only for real contract code (not wallets, not EIP-7702 smart accounts, not failed lookups). */
export const isContractCode = (code: string | null | undefined): boolean => codeKind(code) === 'contract';
/** True for addresses controlled by a private key: plain wallets and EIP-7702 smart accounts. */
export const isWalletCode = (code: string | null | undefined): boolean => { const k = codeKind(code); return k === 'eoa' || k === 'delegated'; };
