// Human-readable decoding of EVM calldata for the approval screen (ERC-20 / ERC-721 / ERC-1155 / WETH basics). Unknown calls stay "unknown".
import { decodeAbiParameters, type Hex } from 'viem';

export const MAX_UINT256 = (1n << 256n) - 1n;
/** Spending limits at or above 2^159 are treated as "unlimited" (covers uint256 max, uint160 max used by Permit2, and "infinite" conventions). */
export const isUnlimited = (v: bigint): boolean => v >= 1n << 159n;

export type DecodedCall =
  | { kind: 'none' }
  | { kind: 'transfer'; standard: 'erc20'; to: string; amount: bigint }
  | { kind: 'transferFrom'; standard: 'erc20' | 'erc721'; from: string; to: string; amountOrId: bigint }
  | { kind: 'approve'; standard: 'erc20'; spender: string; amount: bigint; increase?: boolean; decrease?: boolean }
  | { kind: 'setApprovalForAll'; operator: string; approved: boolean }
  | { kind: 'nftTransfer'; standard: 'erc721' | 'erc1155'; from: string; to: string; id: bigint; amount?: bigint }
  | { kind: 'permit'; owner: string; spender: string; value: bigint; deadline: bigint }
  | { kind: 'permit2Approve'; token: string; spender: string; amount: bigint; expiration: bigint }
  | { kind: 'multicall'; calls: DecodedCall[]; truncated: boolean }
  | { kind: 'wrap'; fn: 'deposit' | 'withdraw'; amount?: bigint }
  | { kind: 'unknown'; selector: string; bytes: number };

const addr = (v: unknown): string => String(v);
function dec(types: string[], data: string): any[] { return [...decodeAbiParameters(types.map((type) => ({ type })), ('0x' + data) as Hex)]; }

const MULTI_MAX = 20;
function multi(items: readonly string[]): DecodedCall {
  const calls = items.slice(0, MULTI_MAX).map((x) => decodeCalldata(x));
  return { kind: 'multicall', calls, truncated: items.length > MULTI_MAX };
}
export function decodeCalldata(data: string): DecodedCall {
  if (!/^0x([0-9a-fA-F]{2})*$/.test(data) || data.length <= 2) return { kind: 'none' };
  const sel = data.slice(2, 10).toLowerCase(); const body = data.slice(10);
  const unknown: DecodedCall = { kind: 'unknown', selector: '0x' + sel, bytes: (data.length - 2) / 2 };
  if (data.length < 10) return unknown;
  try {
    switch (sel) {
      case 'a9059cbb': { const [to, amount] = dec(['address', 'uint256'], body); return { kind: 'transfer', standard: 'erc20', to: addr(to), amount }; }
      case '095ea7b3': { const [spender, amount] = dec(['address', 'uint256'], body); return { kind: 'approve', standard: 'erc20', spender: addr(spender), amount }; }
      case '39509351': { const [spender, amount] = dec(['address', 'uint256'], body); return { kind: 'approve', standard: 'erc20', spender: addr(spender), amount, increase: true }; }
      case 'a457c2d7': { const [spender, amount] = dec(['address', 'uint256'], body); return { kind: 'approve', standard: 'erc20', spender: addr(spender), amount, decrease: true }; }
      case '23b872dd': { const [from, to, v] = dec(['address', 'address', 'uint256'], body); return { kind: 'transferFrom', standard: 'erc20', from: addr(from), to: addr(to), amountOrId: v }; }
      case '42842e0e': { const [from, to, id] = dec(['address', 'address', 'uint256'], body); return { kind: 'nftTransfer', standard: 'erc721', from: addr(from), to: addr(to), id }; }
      case 'b88d4fde': { const [from, to, id] = dec(['address', 'address', 'uint256', 'bytes'], body); return { kind: 'nftTransfer', standard: 'erc721', from: addr(from), to: addr(to), id }; }
      case 'f242432a': { const [from, to, id, amount] = dec(['address', 'address', 'uint256', 'uint256', 'bytes'], body); return { kind: 'nftTransfer', standard: 'erc1155', from: addr(from), to: addr(to), id, amount }; }
      case 'a22cb465': { const [operator, approved] = dec(['address', 'bool'], body); return { kind: 'setApprovalForAll', operator: addr(operator), approved: !!approved }; }
      case 'd505accf': { const [owner, spender, value, deadline] = dec(['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'], body); return { kind: 'permit', owner: addr(owner), spender: addr(spender), value, deadline }; }
      case '87517c45': { const [token, spender, amount, expiration] = dec(['address', 'address', 'uint160', 'uint48'], body); return { kind: 'permit2Approve', token: addr(token), spender: addr(spender), amount, expiration }; }
      case 'ac9650d8': return multi(dec(['bytes[]'], body)[0]);
      case '5ae401dc': return multi(dec(['uint256', 'bytes[]'], body)[1]);
      case '1f0464d1': return multi(dec(['bytes32', 'bytes[]'], body)[1]);
      case 'd0e30db0': return { kind: 'wrap', fn: 'deposit' };
      case '2e1a7d4d': { const [amount] = dec(['uint256'], body); return { kind: 'wrap', fn: 'withdraw', amount }; }
      default: return unknown;
    }
  } catch { return unknown; }
}

/** Selectors of the ERC-20 read calls the approval screen makes to label a token contract. */
export const SEL = { symbol: '0x95d89b41', decimals: '0x313ce567', name: '0x06fdde03', allowance: '0xdd62ed3e', balanceOf: '0x70a08231' } as const;
export function decodeString(hex: string): string {
  try { if (!hex || hex === '0x') return ''; if (hex.length === 66) { const b = hex.slice(2).match(/../g)!.map((x) => parseInt(x, 16)).filter((x) => x); return new TextDecoder().decode(Uint8Array.from(b)); } return String(decodeAbiParameters([{ type: 'string' }], hex as Hex)[0]).slice(0, 64); } catch { return ''; }
}
export const encodeAllowanceCall = (owner: string, spender: string): string => SEL.allowance + owner.slice(2).toLowerCase().padStart(64, '0') + spender.slice(2).toLowerCase().padStart(64, '0');
export const encodeBalanceCall = (owner: string): string => SEL.balanceOf + owner.slice(2).toLowerCase().padStart(64, '0');
export const encodeApprove = (spender: string, amount: bigint): string => '0x095ea7b3' + spender.slice(2).toLowerCase().padStart(64, '0') + amount.toString(16).padStart(64, '0');

/** Flatten a decoded call (looking inside multicalls, one level of nesting max is enough in practice but recursion is bounded by MULTI_MAX per level and calldata size). */
export function flattenCalls(c: DecodedCall, depth = 0): DecodedCall[] { return c.kind === 'multicall' && depth < 3 ? c.calls.flatMap((x) => flattenCalls(x, depth + 1)) : [c]; }
