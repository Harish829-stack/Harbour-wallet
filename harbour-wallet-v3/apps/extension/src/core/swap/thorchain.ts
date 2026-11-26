// THORChain native swaps (BTC <-> EVM natives/tokens) - pre-sign checks. Quotes and fresh quotes come from Harbour's swap
// service (backend /v1/swap, which asks public THORNodes). Execution:
//   - BTC source: a normal BTC send to the vault with the memo in an OP_RETURN output (wallet-core Bitcoin signer);
//   - EVM source: router.depositWithExpiry(vault, asset, amount, memo, expiry) (ERC-20 sells approve the router first).
// The vault is cross-checked against independent THORNodes here, directly (not through the backend that served the quote).
import { encodeFunctionData, getAddress } from 'viem';
import type { SwapAsset, SwapStep } from './types';
import { swapError } from './errors';
import { GATEWAY_URL } from '../../kit/endpoints';

type F = typeof fetch;
export const THORNODE_URLS = [
  ...(GATEWAY_URL ? [`${GATEWAY_URL}/thornode`] : []),
  'https://gateway.liquify.com/chain/thorchain_api',
  'https://thornode.ninerealms.com',
];
const THOR_CHAIN: Record<string, { chain: string; native: string }> = {
  bitcoin: { chain: 'BTC', native: 'BTC.BTC' },
  ethereum: { chain: 'ETH', native: 'ETH.ETH' },
  smartchain: { chain: 'BSC', native: 'BSC.BNB' },
  base: { chain: 'BASE', native: 'BASE.ETH' },
};
const THOR_DECIMALS = 8;
export const THOR_ROUTER_ABI = [{
  type: 'function', name: 'depositWithExpiry', stateMutability: 'payable', outputs: [],
  inputs: [{ name: 'vault', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'memo', type: 'string' }, { name: 'expiration', type: 'uint256' }],
}] as const;
const EVM_ZERO = '0x0000000000000000000000000000000000000000';

/** THORChain asset notation (CHAIN.SYMBOL or CHAIN.SYMBOL-0XCONTRACT); null when the domain is not a THORChain chain. */
export function thorAsset(a: SwapAsset): string | null {
  const c = THOR_CHAIN[a.domainId]; if (!c) return null;
  if (a.address === 'native') return c.native;
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.address) || !/^[A-Za-z0-9]{1,16}$/.test(a.symbol)) return null;
  return `${c.chain}.${a.symbol.toUpperCase()}-${a.address.toUpperCase()}`;
}
/** Atomic units <-> THORChain's fixed 1e8 units. */
export function toThorUnits(amount: string, decimals: number): bigint {
  const v = BigInt(amount);
  return decimals >= THOR_DECIMALS ? v / 10n ** BigInt(decimals - THOR_DECIMALS) : v * 10n ** BigInt(THOR_DECIMALS - decimals);
}
export function fromThorUnits(amount: string | bigint, decimals: number): bigint {
  const v = BigInt(amount);
  return decimals >= THOR_DECIMALS ? v * 10n ** BigInt(decimals - THOR_DECIMALS) : v / 10n ** BigInt(THOR_DECIMALS - decimals);
}
/**
 * Pre-sign check for a FRESH quote fetched at submit time (THORChain asks that vault addresses are never cached).
 * The memo must pay out to our own destination address, and the expected output may not have drifted past the
 * user's slippage since the confirmed quote.
 */
export function checkThorQuote(fresh: any, step: SwapStep, toAddress: string, slippagePct: number): void {
  if (!fresh?.inbound_address || typeof fresh.memo !== 'string' || fresh.memo.length > 80) throw swapError('unsafe_transaction');
  const parts = fresh.memo.split(':');
  if (!['=', 's', 'swap', 'SWAP'].includes(parts[0]) || parts[2]?.toLowerCase() !== toAddress.toLowerCase()) throw swapError('unsafe_transaction');
  // full memo: =:ASSET:DEST:LIMIT[/INTERVAL/QUANTITY] and nothing else (no affiliate / fee fields); the asset may not be swapped for a different one
  if (parts.length > 4 || (parts[3] != null && !/^\d*(\/\d+\/\d+)?$/.test(parts[3]))) throw swapError('unsafe_transaction');
  const want = thorAsset(step.to.asset); const got = String(parts[1] ?? '');
  if (want && got.includes('.') && got.toUpperCase().split('-')[0] !== want.toUpperCase().split('-')[0]) throw swapError('unsafe_transaction');
  const outNow = fromThorUnits(String(fresh.expected_amount_out ?? '0'), step.to.asset.decimals);
  const quoted = BigInt(step.to.amount);
  const bps = BigInt(Math.round(slippagePct * 100));
  if (outNow * 10_000n < quoted * (10_000n - bps)) throw swapError('price_moved');
  if (fresh.expiry && Number(fresh.expiry) * 1000 < Date.now()) throw swapError('price_moved');
}

/**
 * Cross-check the vault (and router) against THORNode's /inbound_addresses on independent nodes. A quote served by one
 * compromised endpoint cannot name an attacker vault: at least two different nodes must list the same address, and none may list another.
 */
export async function verifyThorInbound(fresh: any, step: SwapStep, f: F = fetch): Promise<void> {
  const chain = THOR_CHAIN[step.from.asset.domainId]?.chain; if (!chain) throw swapError('unsafe_transaction');
  const vault = String(fresh?.inbound_address ?? '').toLowerCase(); const router = fresh?.router ? String(fresh.router).toLowerCase() : '';
  let agree = 0;
  const sources = [...new Set(THORNODE_URLS)];
  const answers = await Promise.all(sources.map(async (base) => {
    try { const r = await f(`${base}/thorchain/inbound_addresses`, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) }); return r.ok ? await r.json() : null; } catch { return null; }
  }));
  for (const list of answers) {
    const e = Array.isArray(list) ? list.find((x: any) => x?.chain === chain) : null; if (!e) continue;
    if (e.halted || e.global_trading_paused || e.chain_trading_paused) throw swapError('unsafe_transaction');
    const sameVault = String(e.address ?? '').toLowerCase() === vault; const sameRouter = !router || String(e.router ?? '').toLowerCase() === router;
    if (!sameVault || !sameRouter) throw swapError('unsafe_transaction');
    agree++;
  }
  if (agree < 2) throw swapError('unsafe_transaction');
}

/** Router call for an EVM-source swap. `value` is the native amount for native sells, 0 for tokens. */
export function thorRouterCall(fresh: any, step: SwapStep): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(fresh?.router ?? '')) || !/^0x[0-9a-fA-F]{40}$/.test(String(fresh.inbound_address))) throw swapError('unsafe_transaction');
  const native = step.from.asset.address === 'native';
  const amount = BigInt(step.from.amount);
  const expiry = BigInt(Number(fresh.expiry) || Math.floor(Date.now() / 1000) + 900);
  const asset = native ? EVM_ZERO : getAddress(step.from.asset.address);
  const data = encodeFunctionData({ abi: THOR_ROUTER_ABI, functionName: 'depositWithExpiry', args: [getAddress(fresh.inbound_address), asset as `0x${string}`, amount, fresh.memo, expiry] });
  return { to: getAddress(fresh.router), data, value: native ? amount : 0n };
}
