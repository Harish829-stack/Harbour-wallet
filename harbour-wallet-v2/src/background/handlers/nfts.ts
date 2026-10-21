// Feature message handlers: nfts. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// Messages: nftList, nftCollection, nftItem, nftReport, nftTransferPrepare, nftTransferSubmit.
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import type { Handler, HandlerCtx, HandlerMap } from './types';
import { local } from '../../core/storage';
import { chainById, explorerAddressUrl, explorerTxUrl } from '../../core/chains/index';
import { addressFor, fetchNativeBalance } from '../../core/chains/adapters';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { solanaRpcUrl } from '../../core/rpc';
import { openActiveKeys } from '../keys';
import { activeInfo, earnAvailability } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import { ethCall, type CallPlan } from '../../core/staking/evm';
import { solRpc, sendSolana, solanaBlockhash } from '../../core/staking/solana';
import type { NftCollection, NftItem, NftReportState } from '../../core/nfts/types';
import { emptyReportState } from '../../core/nfts/types';
import { loadCollectionItems, loadCollections, NFT_CHAINS, sanitizeReportState, setReported, splitCollections, type CollectionsResult, type NftEnv } from '../../core/nfts/service';
import { blockscoutInstanceUrl } from '../../core/nfts/blockscout';
import { evmNftTransfer, signSolanaNft } from '../../core/nfts/transfer';

const REPORTS_KEY = 'nfts:reports:v1'; const TTL = 5 * 60_000;
const env = (): NftEnv => ({ f: fetch.bind(globalThis) as typeof fetch, solUrls: () => [solanaRpcUrl(), ...(chainById('solana')?.endpoints ?? [])].filter((u, i, a) => a.indexOf(u) === i) });
const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const errOf = (e: any) => fail(String(e?.shortMessage ?? e?.message ?? 'Request failed').slice(0, 300), e?.code ?? 'error');
const bad = (m: string, code = 'bad_request') => Object.assign(new Error(m), { code });

let mem: { scope: string; chains: string; at: number; res: CollectionsResult } | null = null;
const itemCache = new Map<string, { at: number; items: NftItem[] }>();

async function loadReports(walletId: string): Promise<NftReportState> {
  const all = (await local.get<Record<string, unknown>>(REPORTS_KEY)) ?? {};
  return all[walletId] ? sanitizeReportState(all[walletId]) : emptyReportState();
}
async function saveReports(walletId: string, s: NftReportState) {
  const all = (await local.get<Record<string, unknown>>(REPORTS_KEY)) ?? {}; all[walletId] = s; await local.set(REPORTS_KEY, all);
}
const summary = (c: NftCollection) => ({ id: c.id, chainId: c.chainId, contract: c.contract, name: c.name, symbol: c.symbol, image: c.image, owned: c.owned, standard: c.standard, suspicious: c.suspicious, floorPrice: c.floorPrice, preview: c.items.slice(0, 3).map((i) => i.image).filter(Boolean) });

async function collections(ctx: HandlerCtx, refresh: boolean, chainIds?: string[]) {
  const info = await activeInfo(ctx); if (!info) throw bad('No wallet found', 'no_wallet');
  const scope = `${info.walletId}:${info.derivationIndex}`; const chains = (chainIds?.length ? chainIds : NFT_CHAINS).join(',');
  if (!refresh && mem && mem.scope === scope && mem.chains === chains && Date.now() - mem.at < TTL) return { info, res: mem.res, at: mem.at, cached: true };
  const res = await loadCollections(env(), (id) => { const c = chainById(id); return c ? addressFor(c, info.addresses) : ''; }, chainIds?.length ? chainIds : NFT_CHAINS);
  const all = res.errors.length > 0 && res.collections.length === 0 && mem && mem.scope === scope && mem.chains === chains;
  if (all) return { info, res: mem!.res, at: mem!.at, cached: true, stale: true, error: res.errors[0].error };
  mem = { scope, chains, at: Date.now(), res }; itemCache.clear();
  return { info, res, at: mem.at, cached: false };
}

const nftList: Handler = async (msg, ctx) => {
  try {
    const r = await collections(ctx, msg.refresh === true, Array.isArray(msg.chainIds) ? msg.chainIds.filter((x: unknown) => typeof x === 'string').slice(0, 40) : undefined);
    const reports = await loadReports(r.info.walletId); const { active, hidden } = splitCollections(r.res.collections, reports);
    return { ok: true, active: active.map(summary), hidden: hidden.map((c) => ({ ...summary(c), reason: c.reason })), errors: r.res.errors, sources: r.res.sources, fetchedAt: r.at, stale: !!(r as any).stale, error: (r as any).error };
  } catch (e: any) { return errOf(e); }
};

async function findCollection(ctx: HandlerCtx, id: string) {
  const r = await collections(ctx, false); const c = r.res.collections.find((x) => x.id === id);
  if (!c) throw bad('Collection not found (refresh the list)', 'not_found'); return { ...r, c };
}
async function itemsOf(ctx: HandlerCtx, c: NftCollection, owner: string): Promise<NftItem[]> {
  const hit = itemCache.get(c.id); if (hit && Date.now() - hit.at < TTL) return hit.items;
  const items = await loadCollectionItems(env(), c, owner); itemCache.set(c.id, { at: Date.now(), items }); return items;
}
const nftCollection: Handler = async (msg, ctx) => {
  try {
    const { info, c } = await findCollection(ctx, String(msg.id ?? ''));
    const chain = chainById(c.chainId); const owner = chain ? addressFor(chain, info.addresses) : '';
    let items = c.items; let itemsError: string | undefined;
    try { items = await itemsOf(ctx, c, owner); } catch (e: any) { itemsError = String(e?.message ?? 'failed').slice(0, 160); }
    const reports = await loadReports(info.walletId); const hidden = splitCollections([c], reports).hidden[0];
    return { ok: true, collection: summary(c), items, itemsError, hidden: !!hidden, reason: hidden?.reason };
  } catch (e: any) { return errOf(e); }
};
const OPENSEA: Record<string, string> = { ethereum: 'ethereum', base: 'base', optimism: 'optimism', arbitrum: 'arbitrum', polygon: 'matic', avalanchec: 'avalanche', smartchain: 'bsc', zksync: 'zksync', blast: 'blast', xdai: 'gnosis' };
const nftItem: Handler = async (msg, ctx) => {
  try {
    const { info, c } = await findCollection(ctx, String(msg.collectionId ?? ''));
    const chain = chainById(c.chainId); const owner = chain ? addressFor(chain, info.addresses) : '';
    let items = c.items; try { items = await itemsOf(ctx, c, owner); } catch { /* fall back to the preview items */ }
    const item = items.find((i) => i.id === String(msg.itemId ?? '')) ?? c.items.find((i) => i.id === String(msg.itemId ?? ''));
    if (!item) return fail('NFT not found (it may have been transferred)', 'not_found');
    const explorerUrl = c.chainId === 'solana' ? `https://solscan.io/token/${item.id}` : (blockscoutInstanceUrl(c.chainId, c.contract, item.id) || explorerAddressUrl(chain, c.contract));
    const openseaUrl = OPENSEA[c.chainId] && c.contract ? `https://opensea.io/assets/${OPENSEA[c.chainId]}/${c.contract}/${item.id}` : '';
    const av = earnAvailability(info); // transfers need a locally held key
    return { ok: true, item, collection: summary(c), network: chain?.name ?? c.chainId, explorerUrl, openseaUrl, canSend: av.available && item.transferable, sendBlocked: !av.available ? av.reason : (!item.transferable ? 'not_transferable' : undefined) };
  } catch (e: any) { return errOf(e); }
};
const nftReport: Handler = async (msg, ctx) => {
  try {
    const info = await activeInfo(ctx); if (!info) return fail('No wallet found', 'no_wallet');
    const id = String(msg.id ?? ''); if (!id || id.length > 200) return fail('Invalid collection', 'bad_request');
    const next = setReported(await loadReports(info.walletId), id, msg.reported === true); await saveReports(info.walletId, next);
    return { ok: true, hidden: next.hidden.length };
  } catch (e: any) { return errOf(e); }
};

// ---------------------------------------------------------------- transfers
const erc721Abi = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
const erc1155Abi = parseAbi(['function balanceOf(address account, uint256 id) view returns (uint256)']);
interface TReq { collectionId: string; itemId: string; to: string; quantity?: string }
const tparse = (m: any): TReq => ({ collectionId: String(m.collectionId ?? ''), itemId: String(m.itemId ?? ''), to: String(m.to ?? '').trim(), quantity: typeof m.quantity === 'string' ? m.quantity : undefined });
interface TSummary { chainId: string; network: string; symbol: string; decimals: number; from: string; to: string; itemName: string; image: string; quantity: string; fee: string; feeExact: boolean; balance: string }
async function buildTransfer(ctx: HandlerCtx, req: TReq): Promise<{ summary: TSummary; run: () => Promise<string> }> {
  const info = await activeInfo(ctx); const av = earnAvailability(info);
  if (!info || !av.available) throw bad(av.reason === 'hardware' ? 'Sending NFTs is not available for hardware wallets here' : 'Sending NFTs is not available for this wallet', av.reason ?? 'unavailable');
  const { c } = await findCollection(ctx, req.collectionId);
  const chain = chainById(c.chainId); if (!chain) throw bad('Unknown network');
  const items = await itemsOf(ctx, c, addressFor(chain, info.addresses)).catch(() => c.items);
  const item = items.find((i) => i.id === req.itemId) ?? c.items.find((i) => i.id === req.itemId); if (!item) throw bad('NFT not found', 'not_found');
  if (!item.transferable) throw bad('This NFT type cannot be sent from Harbour (compressed or programmable)', 'not_transferable');
  const from = addressFor(chain, info.addresses); const e = env();
  const base: TSummary = { chainId: chain.id, network: chain.name, symbol: chain.symbol, decimals: chain.decimals, from, to: req.to, itemName: item.name, image: item.image, quantity: '1', fee: '0', feeExact: false, balance: '0' };

  if (c.chainId === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(req.to)) throw bad('Enter a valid Solana address'); if (req.to === from) throw bad('You cannot send an NFT to yourself');
    const urls = e.solUrls();
    const tokens = await solRpc(e.f, urls, 'getTokenAccountsByOwner', [from, { mint: item.id }, { encoding: 'jsonParsed' }]);
    const src = (tokens?.value ?? []).find((t: any) => t?.account?.data?.parsed?.info?.tokenAmount?.amount === '1'); if (!src) throw bad('You no longer hold this NFT', 'not_owner');
    const token2022 = src.account.owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    const sa = ctx.core.SolanaAddress.createWithString(req.to);
    let recipientToken: string; try { recipientToken = token2022 ? sa.token2022Address(item.id) : sa.defaultTokenAddress(item.id); } finally { sa.delete(); }
    const existing = await solRpc(e.f, urls, 'getAccountInfo', [recipientToken, { encoding: 'base64', commitment: 'confirmed' }]);
    const has = !!existing?.value;
    const bal = BigInt((await solRpc(e.f, urls, 'getBalance', [from]))?.value ?? 0); const fee = 5000n + (has ? 0n : 2_039_280n);
    if (bal < fee) throw bad(`Not enough SOL for the network fee${has ? '' : ' and the recipient token account (~0.00204 SOL)'}`, 'insufficient_funds');
    base.fee = fee.toString(); base.balance = bal.toString();
    return { summary: base, run: async () => {
      const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
      try {
        const sk = keys.solanaKey(); const bytes: Uint8Array = sk.key.data();
        try { const encoded = signSolanaNft(ctx.core, { sender: sk.address, recipient: req.to, mint: item.id, senderTokenAddress: src.pubkey, recipientTokenAddress: recipientToken, recipientHasAccount: has, token2022, blockhash: await solanaBlockhash(e.f, urls), privateKey: bytes }); return await sendSolana(e.f, urls, encoded); }
        finally { bytes.fill(0); }
      } finally { keys.dispose(); }
    } };
  }

  // EVM
  if (!/^0x[0-9a-fA-F]{40}$/.test(req.to)) throw bad('Enter a valid address');
  if (req.to.toLowerCase() === from.toLowerCase()) throw bad('You cannot send an NFT to yourself');
  let qty = 1n;
  if (item.standard === 'ERC-1155') { if (!/^[1-9]\d{0,17}$/.test(req.quantity ?? '1')) throw bad('Enter a valid quantity'); qty = BigInt(req.quantity ?? '1'); if (qty > BigInt(item.balance)) throw bad('Quantity exceeds what you own', 'bad_amount'); base.quantity = qty.toString(); }
  const urls = getRpcUrls(chain);
  if (item.standard === 'ERC-721') {
    const raw = await ethCall(e.f, urls, item.contract, encodeFunctionData({ abi: erc721Abi, functionName: 'ownerOf', args: [BigInt(item.id)] })).catch(() => null);
    if (raw && (decodeFunctionResult({ abi: erc721Abi, functionName: 'ownerOf', data: raw }) as string).toLowerCase() !== from.toLowerCase()) throw bad('You no longer own this NFT', 'not_owner');
  } else {
    const raw = await ethCall(e.f, urls, item.contract, encodeFunctionData({ abi: erc1155Abi, functionName: 'balanceOf', args: [from as `0x${string}`, BigInt(item.id)] })).catch(() => null);
    if (raw && (decodeFunctionResult({ abi: erc1155Abi, functionName: 'balanceOf', data: raw }) as bigint) < qty) throw bad('You no longer own this NFT', 'not_owner');
  }
  const tx = evmNftTransfer(item, from, req.to, qty);
  const plan: CallPlan[] = [{ to: tx.to, data: tx.data, value: 0n, label: 'Transfer NFT', gasFallback: 200_000n }];
  const est = await estimatePlan(chain, from as `0x${string}`, plan).catch(() => null); if (!est) throw bad('Could not estimate the network fee; try again', 'fee_failed');
  const bal = await fetchNativeBalance(chain, from, e.f); if (!bal.ok) throw bad(bal.error ?? 'Could not read balance', 'balance_failed');
  if (BigInt(bal.raw) < est.fee) throw bad(`Not enough ${chain.symbol} for the network fee`, 'insufficient_funds');
  base.fee = est.fee.toString(); base.feeExact = est.exact; base.balance = bal.raw;
  return { summary: base, run: async () => { const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet); try { const h = await runPlan(chain, keys.evmPrivateKey(), plan); return h[h.length - 1]; } finally { keys.dispose(); } } };
}
let busy = false;
const nftTransferPrepare: Handler = async (msg, ctx) => { try { return { ok: true, summary: (await buildTransfer(ctx, tparse(msg))).summary }; } catch (e: any) { return errOf(e); } };
const nftTransferSubmit: Handler = async (msg, ctx) => {
  if (busy) return fail('Another transaction is in progress', 'busy'); busy = true;
  try {
    const t = await buildTransfer(ctx, tparse(msg)); const hash = await t.run(); mem = null; itemCache.clear();
    return { ok: true, hash, explorerUrl: explorerTxUrl(chainById(t.summary.chainId), hash), summary: t.summary };
  } catch (e: any) { return errOf(e); } finally { busy = false; }
};

export const handlers: HandlerMap = { nftList, nftCollection, nftItem, nftReport, nftTransferPrepare, nftTransferSubmit };
