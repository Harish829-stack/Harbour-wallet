// Send engine registry. One SendFamily per ChainKind; kinds without a family report an explicit, documented reason (no silent failures).
import type { ChainInfo, ChainKind } from '../types';
import type { BuiltTx, FeeTierId, SendAsset, SendEnv, SendFamily, SendParams, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { evmFamily, iotexFamily } from './evm';
import { utxoFamily } from './utxo';
import { solanaFamily } from './solana';
import { tronFamily } from './tron';
import { cosmosFamily, COSMOS_SPECS } from './cosmos';
import { tonFamily } from './ton';
import { aptosFamily } from './aptos';
import { suiFamily } from './sui';
import { nearFamily } from './near';
import { algorandFamily } from './algorand';
import { rippleFamily } from './ripple';
import { stellarFamily } from './stellar';
import { tezosFamily } from './tezos';
import { filecoinFamily } from './filecoin';
import { polkadotFamily } from './polkadot';
import { wavesFamily } from './waves';
import { vechainFamily } from './vechain';
import { harmonyFamily } from './harmony';
import { iconFamily } from './icon';
import { zilliqaFamily } from './zilliqa';
import { multiversxFamily } from './multiversx';
import { thetaFamily } from './theta';
export * from './types';
export { parseUnits, formatUnits } from './util';

export const SEND_FAMILIES: Partial<Record<ChainKind, SendFamily>> = {
  evm: evmFamily, utxo: utxoFamily, solana: solanaFamily, tron: tronFamily, cosmos: cosmosFamily, ton: tonFamily, aptos: aptosFamily, sui: suiFamily, near: nearFamily,
  algorand: algorandFamily, ripple: rippleFamily, stellar: stellarFamily, tezos: tezosFamily, filecoin: filecoinFamily, substrate: polkadotFamily, waves: wavesFamily,
  vechain: vechainFamily, harmony: harmonyFamily, icon: iconFamily, zilliqa: zilliqaFamily, multiversx: multiversxFamily, theta: thetaFamily, iotex: iotexFamily,
};
/** Why a family cannot send yet (shown verbatim in the Send screen). */
export const UNSUPPORTED_REASON: Partial<Record<ChainKind, string>> = {
  icp: 'Internet Computer transfers use Candid-encoded ledger calls over the IC HTTP agent; wallet-core 4.8.2 has a signer but no public JSON broadcast API usable from a browser extension without an agent library.',
  fio: 'FIO transfers need ABI-serialised actions plus fee / chain-info round trips against a FIO API node; not implemented yet.',
  nimiq: 'No public broadcast endpoint is configured for Nimiq in the registry, so sending is not available yet.',
  aion: 'The Aion network is discontinued; there is no public broadcast API.',
  ontology: 'Ontology transfers need its native binary serialisation and a seed-node REST endpoint that the registry does not provide yet.',
};
export function sendSupport(chain: ChainInfo): { supported: boolean; reason?: string } {
  const f = SEND_FAMILIES[chain.kind];
  if (!f) return { supported: false, reason: UNSUPPORTED_REASON[chain.kind] ?? `Sending on ${chain.name} is not supported yet.` };
  if (chain.kind === 'cosmos' && !COSMOS_SPECS[chain.id]) return { supported: false, reason: `Fee settings for ${chain.name} are not configured yet.` };
  return { supported: true };
}
export const familyOf = (chain: ChainInfo): SendFamily => {
  const s = sendSupport(chain); const f = SEND_FAMILIES[chain.kind];
  if (!s.supported || !f) throw new SendError('network', s.reason ?? 'Not supported');
  return f;
};
export const memoKindOf = (chain: ChainInfo) => SEND_FAMILIES[chain.kind]?.memo ?? 'none';

export function validateMemo(chain: ChainInfo, memo: string | undefined): string | null {
  if (!memo) return null; const f = SEND_FAMILIES[chain.kind]; if (!f || f.memo === 'none') return 'This network does not use a memo.';
  return f.validateMemo?.(memo) ?? null;
}
/** Strip the opaque ctx so a quote can cross the message boundary. bigint -> decimal string. */
export function quoteToWire(q: SendQuote) {
  return { ...q, ctx: undefined, tiers: q.tiers.map((t) => ({ ...t, fee: t.fee.toString(), feeMax: t.feeMax?.toString(), max: t.max.toString() })) };
}
export interface SignedSend { hash: string; built: BuiltTx; tier: FeeTierId }
/** quote -> (policy checks by the caller) -> sign -> broadcast. The caller supplies the key and wipes it afterwards. */
export async function signAndBroadcast(env: SendEnv, p: SendParams, key: Uint8Array, quote: SendQuote, tier: FeeTierId): Promise<SignedSend> {
  const f = familyOf(p.chain);
  const blocking = quote.issues.find((i) => i.blocking); if (blocking) throw new SendError(blocking.code, blocking.message);
  const built = await f.build(env, p, key, quote, tier);
  const hash = await f.broadcast(env, p.chain, built);
  return { hash: hash || built.hash || '', built, tier };
}
export async function txStatus(env: SendEnv, chain: ChainInfo, hash: string, from?: string): Promise<TxStatus> {
  const f = SEND_FAMILIES[chain.kind]; if (!f?.status) return { state: 'unknown' };
  try { return await f.status(env, chain, hash, from); } catch { return { state: 'unknown' }; }
}
export type { SendAsset };
export { quoteNftTransfer, buildNftTransfer, broadcastNftTransfer } from './nft';
export type { NftTransferParams, NftStandard } from './nft';
export { evmRpcs } from './evm';
