// Feature message handlers: chainSend (Send / Receive / Transaction detail backend). Every message here is UI-only (the router enforces
// isInternalWalletSender before dispatch). Signing keys exist only inside one handler call: derived from the unlocked session, used, zeroed.
import { findHbToken } from '../../core/harbour/data';
import type { HandlerMap, HandlerCtx, Msg } from './types';
import { activeEntry, ensureAccounts } from '../walletState';
import { openActiveKeys } from '../keys';
import { local } from '../../core/storage';
import { readTokens } from '../../core/customTokens';
import { readEntries } from '../../core/addressBook';
import { customNetworks } from '../../core/networkRegistry';
import { ALL_CHAINS, TESTNET_CHAINS } from '../../core/chains/index';
import type { ChainInfo } from '../../core/chains/types';
import { addressFor } from '../../core/chains/adapters';
import { SEND_FAMILIES, sendSupport, familyOf, quoteToWire, signAndBroadcast, txStatus, parseUnits, validateMemo, memoKindOf, SendError, evmRpcs, quoteNftTransfer, buildNftTransfer, broadcastNftTransfer } from '../../core/chains/send';
import type { SendAsset, SendParams, SendQuote, FeeTierId, SendEnv, NftTransferParams } from '../../core/chains/send';
import { SENT_TX_KEY, assessRecipient, planHashOf, btcOutputsOf, nameService, readSent, resolveEns, resolveSendChain, resolveSns, sanitizeTokenSpec, upsertSent, type SentTx } from '../../core/sendService';
import { jpost, firstOf, trimUrl } from '../../core/chains/send/util';
import { addressRisk } from '../../core/provider/phishing';
import { checkAddress } from '../../kit/clients/securityClient';
import { evmSendCall, evmTxRequest } from '../../core/chains/send/evm';
import { utxoSelection } from '../../core/chains/send/utxo';
import { serializeTransaction, recoverTransactionAddress, keccak256 } from 'viem';
import { assertSigningChain } from '../../core/harbour/policy';

const TIERS = new Set(['slow', 'average', 'fast']);
const env = (core: any): SendEnv => ({ core, fetch: (...a: Parameters<typeof fetch>) => fetch(...a) });
const err = (e: any) => ({ ok: false as const, error: String(e?.shortMessage || e?.message || 'Transaction failed').slice(0, 400), code: e instanceof SendError ? e.code : undefined });

async function activeAccount(ctx: HandlerCtx) {
  const st: any = await ctx.vault.getState(); const e = activeEntry(st); if (!e) throw new Error('No wallet found');
  const w = e[1]; const accts = ensureAccounts(w); const a = accts[w.activeAccount];
  return { state: st, walletId: e[0], wallet: w, addresses: (a?.addresses ?? {}) as Record<string, string> };
}
interface Prepared { chain: ChainInfo; asset: SendAsset; assetKey: string; from: string; to: string; placeholder: boolean }
async function prepare(ctx: HandlerCtx, msg: Msg): Promise<Prepared> {
  const acc = await activeAccount(ctx);
  const chain = resolveSendChain(msg.chainId ? String(msg.chainId) : undefined, undefined, customNetworks());
  if (!chain) throw new Error('Unknown network');
  assertSigningChain(chain); // only networks this build serves (core/harbour/policy.ts)
  const sup = sendSupport(chain); if (!sup.supported) throw new Error(sup.reason);
  const from = addressFor(chain, acc.addresses) || (chain.kind === 'evm' ? acc.addresses.ethereum : '') || '';
  if (!from) throw new Error(`No ${chain.name} address in this account`);
  let asset: SendAsset = { kind: 'native', decimals: chain.decimals, symbol: chain.symbol }; let assetKey = chain.id;
  if (msg.tokenId) {
    // Tokens the Harbour indexer found (`hb-<chain>-<contract>`) are not stored in the wallet: look them up in the portfolio.
    const id = String(msg.tokenId);
    const t = readTokens(acc.wallet.customTokens).find((x) => x.id === id)
      ?? (id.startsWith('hb-') ? await findHbToken(id, acc.addresses.ethereum ?? '').catch(() => undefined) : undefined);
    if (!t || t.chainId !== chain.evmChainId) throw new Error('Token not found in your wallet');
    asset = { kind: 'token', contract: t.address, decimals: t.decimals, symbol: t.symbol }; assetKey = `${chain.id}:${t.address.toLowerCase()}`;
  } else if (msg.token) {
    const t = sanitizeTokenSpec(msg.token); if (!t) throw new Error('Invalid token');
    if (!SEND_FAMILIES[chain.kind]?.tokens) throw new Error(`Token transfers are not supported on ${chain.name} yet`);
    asset = { kind: 'token', contract: t.contract, decimals: t.decimals, symbol: t.symbol }; assetKey = `${chain.id}:${t.contract}`;
  }
  const to = String(msg.to ?? '').trim();
  return { chain, asset, assetKey, from, to: to || from, placeholder: !to };
}
async function quoteFor(ctx: HandlerCtx, msg: Msg, pr: Prepared) {
  const fam = familyOf(pr.chain); const memo = msg.memo ? String(msg.memo).trim() : undefined;
  if (memo) { const e = validateMemo(pr.chain, memo); if (e) throw new SendError('invalid-memo', e); }
  const base: SendParams = { chain: pr.chain, from: pr.from, to: pr.to, amount: 0n, asset: pr.asset, memo, isMax: !!msg.isMax };
  let amount = 0n; if (!msg.isMax && msg.amount != null && String(msg.amount) !== '') amount = parseUnits(String(msg.amount), pr.asset.decimals);
  const tier: FeeTierId = TIERS.has(msg.tier) ? msg.tier : 'average';
  let q = await fam.quote(env(ctx.core), { ...base, amount });
  if (msg.isMax) { const t = q.tiers.find((x) => x.id === tier) ?? q.tiers[1]; amount = t.max; q = await fam.quote(env(ctx.core), { ...base, amount }); }
  return { params: { ...base, amount } as SendParams, quote: q, tier };
}
const stripPlaceholder = (q: SendQuote, placeholder: boolean) => (placeholder ? { ...q, issues: q.issues.filter((i) => i.code !== 'self-send' && i.code !== 'smart-contract') } : q);

async function saveRecord(rec: SentTx) { const cur = readSent(await local.get(SENT_TX_KEY)); await local.set(SENT_TX_KEY, upsertSent(cur, rec)); }
const recordOf = (pr: Prepared, p: SendParams, q: SendQuote, tier: FeeTierId, hash: string, meta: any, extra: Partial<SentTx> = {}): SentTx => ({
  id: `${pr.chain.id}:${hash}`, chainId: pr.chain.id, symbol: pr.asset.symbol, decimals: pr.asset.decimals, assetKey: pr.assetKey, from: pr.from, to: pr.to, amount: p.amount.toString(),
  feeEst: (q.tiers.find((t) => t.id === tier)?.fee ?? 0n).toString(), feeSymbol: q.feeSymbol, feeDecimals: q.feeDecimals, hash, ts: Date.now(), state: 'pending', tier, memo: p.memo, kind: 'send', replace: meta, ...extra,
});

// ---------------------------------------------------------------- hardware (Ledger) sends
// The background prepares the exact transaction (same quote/fee rules as a local send) and keeps it for 5 minutes; the popup has
// the device sign it over WebHID and returns only the signature (EVM) or the signed transaction (BTC). Before broadcasting, the
// background checks that the signature belongs to the account (EVM) or that the outputs are exactly the prepared ones (BTC).
const LEDGER_TTL = 5 * 60_000;
const ledgerPending = new Map<string, { at: number; pr: Prepared; params: SendParams; quote: SendQuote; tier: FeeTierId; evm?: any; btc?: { outputs: Array<{ value: string; script: string }> } }>();
async function hwPath(ctx: HandlerCtx, ct: string): Promise<string> {
  const acc = await activeAccount(ctx); const a = ensureAccounts(acc.wallet)[acc.wallet.activeAccount ?? 0] as any;
  if (acc.wallet.type !== 'ledger') throw new Error('This wallet is not a hardware wallet');
  const path = a?.hw?.[ct] ?? (ct !== 'bitcoin' && ct !== 'solana' ? a?.hw?.ethereum : undefined);
  if (!path) throw new Error('This Ledger account has no address for this network');
  return path;
}
export const handlers: HandlerMap = {
  /** Which chains can send, and with what memo kind / token support (SelectAsset greys out the rest with the documented reason). */
  async sendSupport() {
    return { ok: true, chains: [...ALL_CHAINS, ...TESTNET_CHAINS, ...customNetworks().map((n) => resolveSendChain(`custom-${n.chainId}`, undefined, customNetworks())!).filter(Boolean)].map((c) => ({ id: c.id, ...sendSupport(c), memo: memoKindOf(c), tokens: !!SEND_FAMILIES[c.kind]?.tokens })) };
  },
  async sendValidateAddress(msg, ctx) {
    try {
      const chain = resolveSendChain(String(msg.chainId ?? ''), undefined, customNetworks()); if (!chain) return { ok: false, error: 'Unknown network' };
      const input = String(msg.address ?? '').trim(); if (!input) return { ok: true, valid: false };
      const svc = nameService(input, chain);
      if (svc) {
        try {
          const mainnet = ALL_CHAINS.find((c) => c.id === 'ethereum')!;
          const address = svc === 'ens' ? await resolveEns(input, evmRpcs(mainnet), async (url, method, params) => { const j = await jpost(fetch, url, { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw new Error(j.error.message); return j.result; }) : await resolveSns(input, fetch);
          return { ok: true, valid: true, resolved: { name: input.toLowerCase(), address, service: svc } };
        } catch (e: any) { return { ok: true, valid: false, nameError: String(e?.message || 'Name could not be resolved').slice(0, 200) }; }
      }
      const coin = (ctx.core.CoinType as any)[chain.ct]; let valid = false;
      try { valid = chain.kind === 'evm' ? /^0x[0-9a-fA-F]{40}$/.test(input) : ctx.core.AnyAddress.isValid(input, coin); } catch { valid = false; }
      return { ok: true, valid };
    } catch (e: any) { return err(e); }
  },
  async sendQuote(msg, ctx) {
    try {
      const pr = await prepare(ctx, msg); const { params, quote, tier } = await quoteFor(ctx, msg, pr);
      const acc = await activeAccount(ctx); const sent = readSent(await local.get(SENT_TX_KEY));
      const risk: any = pr.placeholder ? null : assessRecipient(pr.to, pr.from, sent, pr.chain.id, readEntries(acc.state.addressBook) as any, pr.chain.ct);
      // EVM recipients: ScamSniffer scam-address list + GoPlus address reputation (advisory; failures mean "no signal")
      if (risk && pr.chain.kind === 'evm' && /^0x[0-9a-fA-F]{40}$/.test(pr.to)) {
        const [scam, gp] = await Promise.all([addressRisk(pr.to, local as any).catch(() => 'unknown' as const), pr.chain.evmChainId ? checkAddress(pr.chain.evmChainId, pr.to).catch(() => null) : Promise.resolve(null)]);
        risk.flagged = scam === 'scam' || !!gp?.risky; risk.flags = [...(scam === 'scam' ? ['scamsniffer'] : []), ...(gp?.flags ?? [])];
      }
      const planHash = pr.placeholder ? null : await planHashOf({ chainId: pr.chain.id, from: pr.from, to: pr.to, assetKey: pr.assetKey, amount: msg.isMax ? 'max' : params.amount.toString(), memo: msg.memo ? String(msg.memo).trim() : '' });
      return { ok: true, planHash, quote: quoteToWire(stripPlaceholder(quote, pr.placeholder)), tier, amountRaw: params.amount.toString(), from: pr.from, to: pr.placeholder ? '' : pr.to, memoKind: memoKindOf(pr.chain), symbol: pr.asset.symbol, decimals: pr.asset.decimals, assetKey: pr.assetKey, risk };
    } catch (e: any) { return err(e); }
  },
  async sendSubmit(msg, ctx) {
    let keys: Awaited<ReturnType<typeof openActiveKeys>> | undefined; let key: Uint8Array | undefined;
    try {
      const pr = await prepare(ctx, msg); if (pr.placeholder) throw new Error('Enter a recipient address');
      const { params, quote, tier } = await quoteFor(ctx, msg, pr);
      const expected = await planHashOf({ chainId: pr.chain.id, from: pr.from, to: pr.to, assetKey: pr.assetKey, amount: msg.isMax ? 'max' : params.amount.toString(), memo: msg.memo ? String(msg.memo).trim() : '' });
      if (msg.planHash !== expected) throw new Error('The transaction changed after you reviewed it. Go back and review it again.');
      const picked = quote.tiers.find((t) => t.id === tier)!;
      // Fee-jump guard: the fee shown on the Confirm screen may only have grown by a margin before the user must review again.
      if (msg.feeCap != null && /^\d+$/.test(String(msg.feeCap)) && picked.fee > BigInt(String(msg.feeCap))) throw new Error('The network fee changed. Go back and review the transaction again.');
      keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
      key = keys.privateKeyFor(pr.chain, pr.from);
      const res = await signAndBroadcast(env(ctx.core), params, key, quote, tier);
      const rec = recordOf(pr, params, quote, tier, res.hash, res.built.meta);
      await saveRecord(rec);
      return { ok: true, hash: res.hash, id: rec.id };
    } catch (e: any) { return err(e); }
    finally { try { key?.fill(0); } catch { /* */ } try { keys?.dispose(); } catch { /* */ } }
  },
  /** Ledger: build the unsigned transaction for the current quote (EVM: serialized unsigned tx; BTC: inputs with their previous txs + outputs). */
  async ledgerSendPrepare(msg, ctx) {
    try {
      for (const [k, v] of ledgerPending) if (Date.now() - v.at > LEDGER_TTL) ledgerPending.delete(k);
      const pr = await prepare(ctx, msg); if (pr.placeholder) throw new Error('Enter a recipient address');
      const { params, quote, tier } = await quoteFor(ctx, msg, pr);
      const blocking = quote.issues.find((i) => i.blocking); if (blocking) throw new SendError(blocking.code, blocking.message);
      const id = crypto.randomUUID();
      if (pr.chain.kind === 'evm') {
        const path = await hwPath(ctx, 'ethereum');
        const t = evmTxRequest(pr.chain, quote.ctx, tier, evmSendCall(params, quote, tier));
        ledgerPending.set(id, { at: Date.now(), pr, params, quote, tier, evm: t });
        return { ok: true, id, kind: 'evm', path, unsignedTx: serializeTransaction(t), chainId: pr.chain.evmChainId, fee: (quote.tiers.find((x) => x.id === tier)?.fee ?? 0n).toString() };
      }
      if (pr.chain.kind === 'utxo' && pr.chain.ct === 'bitcoin') {
        const path = await hwPath(ctx, 'bitcoin');
        const sel = utxoSelection(env(ctx.core), params, quote, tier);
        const script = (addr: string) => Array.from(ctx.core.BitcoinScript.lockScriptForAddress(addr, ctx.core.CoinType.bitcoin).data() as Uint8Array, (b) => b.toString(16).padStart(2, '0')).join('');
        const outputs = [{ value: sel.amount.toString(), script: script(params.to) }, ...(sel.change > 0n ? [{ value: sel.change.toString(), script: script(pr.from) }] : [])];
        const eps = (pr.chain.endpoints ?? []).map(trimUrl);
        const inputs = await Promise.all(sel.inputs.map(async (u) => ({ ...u, prevHex: await firstOf(eps, async (e) => { const r = await fetch(`${e}/tx/${u.txid}/hex`, { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return (await r.text()).trim(); }) })));
        ledgerPending.set(id, { at: Date.now(), pr, params, quote, tier, btc: { outputs } });
        return { ok: true, id, kind: 'btc', path, inputs, outputs, fee: sel.fee.toString() };
      }
      throw new Error(`Sending from a Ledger is supported on EVM networks and Bitcoin; ${pr.chain.name} is not supported yet`);
    } catch (e: any) { return err(e); }
  },
  /** Ledger: verify and broadcast what the device signed. */
  async ledgerSendSubmit(msg, ctx) {
    try {
      const p = ledgerPending.get(String(msg.id ?? '')); if (!p || Date.now() - p.at > LEDGER_TTL) throw new Error('This transaction expired. Review it again.');
      ledgerPending.delete(String(msg.id));
      let raw: string; let hash: string;
      if (p.evm) {
        const sig = msg.signature ?? {}; const r = String(sig.r ?? ''); const s2 = String(sig.s ?? ''); const v = BigInt('0x' + String(sig.v ?? '0').replace(/^0x/, ''));
        if (!/^(0x)?[0-9a-fA-F]{64}$/.test(r) || !/^(0x)?[0-9a-fA-F]{64}$/.test(s2)) throw new Error('Invalid signature from the device');
        const rr = `0x${r.replace(/^0x/, '')}` as `0x${string}`; const ss = `0x${s2.replace(/^0x/, '')}` as `0x${string}`;
        // legacy: EIP-155 v as returned by the device; typed (EIP-1559): v is the y-parity (0/1, or 27/28 on old firmware)
        const signature: any = p.evm.type === 'legacy' ? { r: rr, s: ss, v } : { r: rr, s: ss, yParity: Number((v >= 27n ? v - 27n : v) % 2n) };
        raw = serializeTransaction(p.evm, signature);
        const signer = await recoverTransactionAddress({ serializedTransaction: raw as any });
        if (signer.toLowerCase() !== p.pr.from.toLowerCase()) throw new Error('The device signed with a different account');
        hash = await familyOf(p.pr.chain).broadcast(env(ctx.core), p.pr.chain, { raw, hash: keccak256(raw as `0x${string}`) });
      } else if (p.btc) {
        raw = String(msg.signedTx ?? '').trim(); if (!/^[0-9a-fA-F]{100,}$/.test(raw)) throw new Error('Invalid transaction from the device');
        // the signed transaction must pay exactly the prepared outputs: same count, order, amounts and scripts
        const got = btcOutputsOf(raw);
        if (got.length !== p.btc.outputs.length || p.btc.outputs.some((o: any, k: number) => got[k].value !== BigInt(o.value) || got[k].script.toLowerCase() !== String(o.script).toLowerCase())) throw new Error('The signed transaction does not match the prepared outputs');
        hash = await familyOf(p.pr.chain).broadcast(env(ctx.core), p.pr.chain, { raw });
      } else throw new Error('Unsupported');
      const rec = recordOf(p.pr, p.params, p.quote, p.tier, hash, {});
      await saveRecord(rec);
      return { ok: true, hash, id: rec.id };
    } catch (e: any) { return err(e); }
  },
  /** NFT transfer for the NFT feature: `nft` = { chainId, standard, contract, tokenId, amount?, to }. */
  async sendNftQuote(msg, ctx) {
    try {
      const acc = await activeAccount(ctx); const chain = resolveSendChain(String(msg.chainId ?? ''), undefined, customNetworks()); if (!chain) throw new Error('Unknown network'); assertSigningChain(chain);
      const from = addressFor(chain, acc.addresses); const p: NftTransferParams = { chain, from, to: String(msg.to ?? from).trim(), standard: msg.standard, contract: String(msg.contract), tokenId: String(msg.tokenId), amount: msg.amount ? BigInt(msg.amount) : undefined };
      return { ok: true, quote: quoteToWire(await quoteNftTransfer(env(ctx.core), p)), from };
    } catch (e: any) { return err(e); }
  },
  async sendNftSubmit(msg, ctx) {
    let keys: Awaited<ReturnType<typeof openActiveKeys>> | undefined; let key: Uint8Array | undefined;
    try {
      const acc = await activeAccount(ctx); const chain = resolveSendChain(String(msg.chainId ?? ''), undefined, customNetworks()); if (!chain) throw new Error('Unknown network'); assertSigningChain(chain);
      const from = addressFor(chain, acc.addresses); const p: NftTransferParams = { chain, from, to: String(msg.to ?? '').trim(), standard: msg.standard, contract: String(msg.contract), tokenId: String(msg.tokenId), amount: msg.amount ? BigInt(msg.amount) : undefined };
      const q = await quoteNftTransfer(env(ctx.core), p); const blocking = q.issues.find((i) => i.blocking); if (blocking) throw new SendError(blocking.code, blocking.message);
      const tier: FeeTierId = TIERS.has(msg.tier) ? msg.tier : 'average';
      keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet); key = keys.privateKeyFor(chain, from);
      const built = await buildNftTransfer(env(ctx.core), p, key, q, tier); const hash = (await broadcastNftTransfer(env(ctx.core), p, built)) || built.hash || '';
      const rec: SentTx = { id: `${chain.id}:${hash}`, chainId: chain.id, symbol: 'NFT', decimals: 0, assetKey: `${chain.id}:${p.contract.toLowerCase()}:${p.tokenId}`, from, to: p.to, amount: String(p.amount ?? 1n), feeEst: (q.tiers.find((t) => t.id === tier)?.fee ?? 0n).toString(), feeSymbol: q.feeSymbol, feeDecimals: q.feeDecimals, hash, ts: Date.now(), state: 'pending', tier, kind: 'nft', nftName: typeof msg.name === 'string' ? msg.name.slice(0, 80) : undefined, replace: built.meta };
      await saveRecord(rec); return { ok: true, hash, id: rec.id };
    } catch (e: any) { return err(e); }
    finally { try { key?.fill(0); } catch { /* */ } try { keys?.dispose(); } catch { /* */ } }
  },
  /** Transaction detail: stored record (if Harbour sent it) + a fresh status from the chain. */
  async sendTxDetail(msg, ctx) {
    try {
      const list = readSent(await local.get(SENT_TX_KEY)); let rec = list.find((x) => x.id === String(msg.id ?? '')) ?? (msg.hash ? list.find((x) => x.hash === String(msg.hash) && (!msg.chainId || x.chainId === msg.chainId)) : undefined);
      const chain = resolveSendChain(rec?.chainId ?? (msg.chainId ? String(msg.chainId) : undefined), undefined, customNetworks());
      const hash = rec?.hash ?? (msg.hash ? String(msg.hash) : ''); if (!chain || !hash) return { ok: false, error: 'Transaction not found' };
      const st = await txStatus(env(ctx.core), chain, hash, rec?.from ?? (msg.from ? String(msg.from) : undefined));
      if (rec && st.state !== 'unknown' && (st.state !== rec.state || st.block !== rec.block)) {
        rec = { ...rec, state: st.state, block: st.block ?? rec.block, feeActual: st.fee ?? rec.feeActual, error: st.error, confirmations: st.confirmations };
        await saveRecord(rec);
      }
      return { ok: true, record: rec ?? null, status: st, chain: { id: chain.id, name: chain.name, symbol: chain.symbol, decimals: chain.decimals } };
    } catch (e: any) { return err(e); }
  },
  async sendTxList(msg) {
    const list = readSent(await local.get(SENT_TX_KEY)); const cid = msg.chainId ? String(msg.chainId) : null;
    return { ok: true, items: (cid ? list.filter((x) => x.chainId === cid) : list).slice(0, Math.min(Number(msg.limit) || 100, 300)) };
  },
};
