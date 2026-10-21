// Native-balance adapters per chain family. `evm` and `solana` live here; every other family registers itself below.
// A family without an adapter reports ok:false ("unsupported") instead of a fake zero.
import type { ChainInfo, ChainKind } from '../types';
import type { BalanceAdapter, Fetcher, NativeBalanceResult } from './types';
import { fail } from './types';
import { evmBalance } from './evm';
import { solanaBalance } from './solana';
import { utxoBalance } from './utxo';
import { cosmosBalance } from './cosmos';
import { substrateAdapter } from './substrate';
import * as O from './others';
import { cardanoBalance } from './cardano';

export const BALANCE_ADAPTERS: Partial<Record<ChainKind, BalanceAdapter>> = {
  evm: evmBalance,
  solana: solanaBalance,
  utxo: utxoBalance, cosmos: cosmosBalance, substrate: substrateAdapter,
  tron: O.tronBalance, ton: O.tonBalance, aptos: O.aptosBalance, sui: O.suiBalance, near: O.nearBalance, algorand: O.algorandBalance,
  ripple: O.rippleBalance, stellar: O.stellarBalance, tezos: O.tezosBalance, filecoin: O.filecoinBalance, waves: O.wavesBalance,
  vechain: O.vechainBalance, harmony: O.harmonyBalance, icon: O.iconBalance, zilliqa: O.zilliqaBalance, multiversx: O.multiversxBalance,
  theta: O.thetaBalance, iotex: O.iotexBalance, icp: O.icpBalance, fio: O.fioBalance, ontology: O.ontologyBalance,
  nimiq: O.nimiqBalance, aion: O.aionBalance, cardano: cardanoBalance,
  // Registered by core/chains/adapters/<kind>.ts as they are implemented (see evidence/30-chain-registry/ADAPTERS.md):
  // utxo, cosmos, tron, ton, aptos, sui, near, algorand, ripple, stellar, substrate, tezos, filecoin, waves, vechain, harmony, icon, zilliqa, …
};
export function registerBalanceAdapter(kind: ChainKind, a: BalanceAdapter) { BALANCE_ADAPTERS[kind] = a; }

export async function fetchNativeBalance(chain: ChainInfo, address: string, f: Fetcher = fetch): Promise<NativeBalanceResult> {
  const a = BALANCE_ADAPTERS[chain.kind];
  if (!a) return fail('unsupported');
  if (!address) return fail('no address');
  try { return await a(chain, address, f); } catch (e: any) { return fail(e?.message ?? 'failed'); }
}
/** Bounded-concurrency batch so 40+ chains do not open 40 sockets at once. */
export async function fetchNativeBalances(items: Array<{ chain: ChainInfo; address: string }>, f: Fetcher = fetch, limit = 8): Promise<Map<string, NativeBalanceResult>> {
  const out = new Map<string, NativeBalanceResult>();
  let i = 0;
  const worker = async () => { while (i < items.length) { const it = items[i++]; out.set(it.chain.id, await fetchNativeBalance(it.chain, it.address, f)); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
/** The address that represents a chain inside a wallet's address map (keyed by wallet-core CoinType name). EVM chains fall back to the ethereum address. */
export function addressFor(chain: ChainInfo, addresses: Record<string, string>): string {
  return addresses[chain.ct] ?? (chain.kind === 'evm' ? addresses.ethereum ?? '' : '') ?? '';
}
