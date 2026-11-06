// NFT transfers. EVM: ERC-721 / ERC-1155 safeTransferFrom (ownership checked on-chain first). Solana: non-programmable NFTs are SPL tokens
// with 0 decimals (transfer of 1 unit through the SPL path, recipient ATA created when missing); programmable (pNFT) and compressed NFTs are NOT supported.
// Exported for the NFT feature: `quoteNftTransfer`, `buildNftTransfer`, `broadcastNftTransfer`.
import { encodeFunctionData, getAddress } from 'viem';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendQuote } from './types';
import { SendError } from './types';
import { evmRpcs, prepareEvm, evmTierFees, signEvmTx, broadcastEvm, validEvmAddress } from './evm';
import { solanaFamily } from './solana';
import { MSG, firstOf, fundsIssues, issue, rpc, sub0 } from './util';
import { isContractCode } from '../../evmCode';

export type NftStandard = 'erc721' | 'erc1155' | 'spl';
export interface NftTransferParams { chain: ChainInfo; from: string; to: string; standard: NftStandard; contract: string; tokenId: string; /** ERC-1155 quantity (default 1). */ amount?: bigint }
const A721 = [{ type: 'function', name: 'safeTransferFrom', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] }] as const;
const A1155 = [{ type: 'function', name: 'safeTransferFrom', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [] }] as const;
const pad = (h: string) => h.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const evmCall = (env: SendEnv, chain: ChainInfo, to: string, data: string) => firstOf(evmRpcs(chain), (u) => rpc(env.fetch, u, 'eth_call', [{ to, data }, 'latest']));
const solAsset = (p: NftTransferParams) => ({ kind: 'token' as const, contract: p.contract, decimals: 0, symbol: 'NFT' });

function evmData(p: NftTransferParams) {
  const from = getAddress(p.from.toLowerCase()), to = getAddress(p.to.toLowerCase()), id = BigInt(p.tokenId);
  return p.standard === 'erc721' ? encodeFunctionData({ abi: A721, functionName: 'safeTransferFrom', args: [from, to, id] })
    : encodeFunctionData({ abi: A1155, functionName: 'safeTransferFrom', args: [from, to, id, p.amount ?? 1n, '0x'] });
}
export async function quoteNftTransfer(env: SendEnv, p: NftTransferParams): Promise<SendQuote> {
  if (p.standard === 'spl') return solanaFamily.quote(env, { chain: p.chain, from: p.from, to: p.to, amount: 1n, asset: solAsset(p) });
  if (!validEvmAddress(p.to)) throw new SendError('invalid-recipient', 'Invalid recipient address');
  if (!validEvmAddress(p.contract) || !/^\d+$/.test(p.tokenId)) throw new SendError('token-not-registered', 'Invalid NFT');
  const issues = [];
  let owned = 0n;
  try {
    if (p.standard === 'erc721') { const o = await evmCall(env, p.chain, p.contract, '0x6352211e' + pad(BigInt(p.tokenId).toString(16))); owned = ('0x' + String(o).slice(-40)).toLowerCase() === p.from.toLowerCase() ? 1n : 0n; }
    else owned = BigInt(await evmCall(env, p.chain, p.contract, '0x00fdd58e' + pad(p.from) + pad(BigInt(p.tokenId).toString(16))));
  } catch { issues.push(issue('network', MSG.simulationNetwork, true)); }
  if (!issues.length && owned < (p.amount ?? 1n)) issues.push(issue('insufficient-funds', 'You do not own this NFT (the recipient is not owner nor approved).', true));
  const prep = await prepareEvm(env, p.chain, p.from, { to: getAddress(p.contract.toLowerCase()), value: 0n, data: evmData(p) }, 120_000n, getAddress(p.to.toLowerCase()));
  if (prep.estimateError) issues.push(issue('estimate-failed', MSG.simulationReverted, false));
  const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => { const t = evmTierFees(prep.ctx, id); return { id, fee: t.fee, feeMax: t.feeMax, max: sub0(prep.nativeBalance, t.feeMax), detail: t.detail }; });
  issues.push(...fundsIssues({ amount: 0n, isToken: true, assetBalance: owned, nativeBalance: prep.nativeBalance, fee: tiers[1].feeMax! }));
  return { tiers, defaultTier: 'average', feeSymbol: p.chain.symbol, feeDecimals: p.chain.decimals, nativeBalance: prep.nativeBalance.toString(), assetBalance: owned.toString(), issues, recipientIsContract: isContractCode(prep.recipientCode), ctx: prep.ctx };
}
export async function buildNftTransfer(env: SendEnv, p: NftTransferParams, key: Uint8Array, q: SendQuote, tier: FeeTierId): Promise<BuiltTx> {
  if (p.standard === 'spl') return solanaFamily.build(env, { chain: p.chain, from: p.from, to: p.to, amount: 1n, asset: solAsset(p) }, key, q, tier);
  const c = q.ctx; return signEvmTx(p.chain, key, p.from, c, tier, { to: p.contract, value: 0n, data: evmData(p), gas: (c.gas * 12n) / 10n });
}
export const broadcastNftTransfer = (env: SendEnv, p: NftTransferParams, tx: BuiltTx): Promise<string> =>
  p.standard === 'spl' ? solanaFamily.broadcast(env, p.chain, tx) : broadcastEvm(env, p.chain, tx.raw);
