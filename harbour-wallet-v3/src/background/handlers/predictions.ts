// Feature message handlers: predictions (Polymarket). UI-only; behind the remote flag `predictions` AND Polymarket's own region check.
// Read: markets, market detail with order books, portfolio (positions + activity). Trade (EOA, Polygon): wrap USDC.e -> pUSD, approve
// the exchange, sign a V2 order, post it with L2 headers. API creds are derived with a wallet signature and stored encrypted.
import { encodeFunctionData, decodeFunctionResult, erc20Abi, maxUint256, parseAbi } from 'viem';
import { sign, serializeSignature } from 'viem/accounts';
import type { Handler, HandlerCtx, HandlerMap } from './types';
import { local, session, KEYS } from '../../core/storage';
import { encrypt, decrypt } from '../../core/passworder';
import { chainById } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { openActiveKeys } from '../keys';
import { activeInfo } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import { ethCall, type CallPlan } from '../../core/staking/evm';
import { isKilled } from '../../kit/failover';
import * as PM from '../../core/predictions/polymarket';

const getStore = () => import('../store'); // same chunk as the background entry (no runtime import())
const CREDS_KEY = KEYS.PREDICTIONS_CREDS;
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
const BUILDER_CODE = /^0x[0-9a-fA-F]{64}$/.test(env.VITE_HB_PM_BUILDER_CODE ?? '') ? env.VITE_HB_PM_BUILDER_CODE : undefined;
const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const errOf = (e: any) => fail(String(e?.shortMessage ?? e?.message ?? 'Request failed').slice(0, 300), e?.code ?? 'error');
const off = fail('Predictions are not enabled', 'FEATURE_DISABLED');
const ctfAbi = parseAbi(['function isApprovedForAll(address owner, address operator) view returns (bool)', 'function setApprovalForAll(address operator, bool approved)']);
const onrampAbi = parseAbi(['function wrap(address _asset, address _to, uint256 _amount)']);

let geo: { at: number; v: { blocked: boolean; country?: string; region?: string } } | null = null;
async function gate(): Promise<{ on: boolean; blocked: boolean; country?: string }> {
  let on = false; try { on = (await getStore()).store.getState().sdkFeatureSlice.flags.predictions === true && !isKilled('polymarket'); } catch { /* off */ }
  if (!on) return { on, blocked: true };
  if (!geo || Date.now() - geo.at > 10 * 60_000) { try { geo = { at: Date.now(), v: await PM.geoblock() }; } catch { geo = { at: Date.now(), v: { blocked: true } }; } } // unknown region = no trading
  return { on, blocked: geo.v.blocked, country: geo.v.country };
}
async function who(ctx: HandlerCtx) {
  const info = await activeInfo(ctx); if (!info) throw Object.assign(new Error('No wallet found'), { code: 'no_wallet' });
  const user = info.addresses.ethereum; if (!user) throw Object.assign(new Error('This wallet has no EVM account'), { code: 'no_address' });
  return { info, user, scope: `${info.walletId}:${info.derivationIndex}` };
}
const polygon = () => { const c = chainById('polygon'); if (!c) throw new Error('Polygon is not available'); return c; };
async function read(to: string, abi: any, fn: string, args: unknown[]): Promise<any> {
  return decodeFunctionResult({ abi, functionName: fn, data: await ethCall(fetch, getRpcUrls(polygon()), to, encodeFunctionData({ abi, functionName: fn, args } as any)) } as any);
}
async function creds(ctx: HandlerCtx, scope: string, user: string): Promise<PM.Creds> {
  const pw = await session.get<string>(KEYS.PASSWORD); if (!pw) throw Object.assign(new Error('Wallet is locked'), { code: 'locked' });
  const all = (await local.get<Record<string, string>>(CREDS_KEY)) ?? {};
  if (all[scope]) { try { return await decrypt<PM.Creds>(pw, all[scope]); } catch { /* re-derive */ } }
  const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
  try {
    const pk = keys.evmPrivateKey();
    const c = await PM.apiCreds(user, async (d) => serializeSignature(await sign({ hash: d, privateKey: pk })));
    all[scope] = await encrypt(pw, c); await local.set(CREDS_KEY, all);
    return c;
  } finally { keys.dispose(); }
}

const predictionMarkets: Handler = async (msg) => {
  const g = await gate(); if (!g.on) return off;
  try { return { ok: true, markets: await PM.markets(fetch, 30, typeof msg.q === 'string' ? msg.q.slice(0, 60) : undefined), tradingBlocked: g.blocked, country: g.country }; } catch (e) { return errOf(e); }
};
const predictionMarket: Handler = async (msg) => {
  const g = await gate(); if (!g.on) return off;
  try {
    const m = await PM.market(String(msg.id ?? ''));
    const books = await Promise.all(m.tokenIds.map((t) => PM.book(t).catch(() => null)));
    return { ok: true, market: m, books, tradingBlocked: g.blocked, builder: !!BUILDER_CODE };
  } catch (e) { return errOf(e); }
};
const predictionPortfolio: Handler = async (_m, ctx) => {
  const g = await gate(); if (!g.on) return off;
  try {
    const { user } = await who(ctx);
    const [pos, act, pusd, usdce] = await Promise.all([PM.positions(user), PM.activity(user).catch(() => []), read(PM.PUSD, erc20Abi, 'balanceOf', [user]).catch(() => null), read(PM.USDCE, erc20Abi, 'balanceOf', [user]).catch(() => null)]);
    return { ok: true, user, positions: pos, activity: act, pusd: pusd?.toString() ?? null, usdce: usdce?.toString() ?? null, tradingBlocked: g.blocked };
  } catch (e) { return errOf(e); }
};
/** Wrap USDC.e into pUSD (approve the onramp, then wrap): Polymarket's V2 collateral. */
const predictionWrap: Handler = async (msg, ctx) => {
  const g = await gate(); if (!g.on) return off; if (g.blocked) return fail('Trading on Polymarket is not available in your region', 'geoblocked');
  try {
    const { user } = await who(ctx); const amount = BigInt(String(msg.amount ?? '0')); if (amount <= 0n) return fail('Enter an amount', 'bad_amount');
    if ((await read(PM.USDCE, erc20Abi, 'balanceOf', [user])) < amount) return fail('Not enough USDC.e on Polygon', 'insufficient_funds');
    const plan: CallPlan[] = [];
    if ((await read(PM.USDCE, erc20Abi, 'allowance', [user, PM.ONRAMP])) < amount) plan.push({ to: PM.USDCE, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PM.ONRAMP, amount] }), value: 0n, label: 'Approve USDC.e for wrapping', gasFallback: 70_000n });
    plan.push({ to: PM.ONRAMP, data: encodeFunctionData({ abi: onrampAbi, functionName: 'wrap', args: [PM.USDCE, user as `0x${string}`, amount] }), value: 0n, label: 'Wrap USDC.e into pUSD', gasFallback: 150_000n });
    if (msg.dryRun === true) { const est = await estimatePlan(polygon(), user as `0x${string}`, plan); return { ok: true, fee: est.fee.toString(), steps: plan.length }; }
    const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
    try { const hashes = await runPlan(polygon(), keys.evmPrivateKey(), plan); return { ok: true, hash: hashes[hashes.length - 1] }; } finally { keys.dispose(); }
  } catch (e) { return errOf(e); }
};
/** Place an order on a CTF book: BUY spends pUSD (exchange allowance), SELL sells outcome shares (CTF operator approval). */
const predictionOrder: Handler = async (msg, ctx) => {
  const g = await gate(); if (!g.on) return off; if (g.blocked) return fail('Trading on Polymarket is not available in your region', 'geoblocked');
  try {
    const { user, scope } = await who(ctx);
    const tokenId = String(msg.tokenId ?? ''); if (!/^\d{1,80}$/.test(tokenId)) return fail('Bad outcome', 'bad_request');
    const side = msg.side === 'SELL' ? 'SELL' : 'BUY'; const orderType = msg.orderType === 'GTC' ? 'GTC' : 'FOK';
    const b = await PM.book(tokenId);
    if (b.version === 'v2') return fail('This market trades on Polymarket\'s V2 book, which Harbour does not support yet. Trade it on polymarket.com.', 'unsupported');
    const size = Number(msg.size); if (!(size >= b.minSize)) return fail(`Minimum order is ${b.minSize} shares`, 'bad_amount');
    const price = orderType === 'FOK' ? (side === 'BUY' ? b.bestAsk : b.bestBid) : Number(msg.price);
    if (!(price && price > 0 && price < 1)) return fail(orderType === 'FOK' ? 'No liquidity on that side of the book' : 'Enter a price between 0 and 1', 'no_liquidity');
    const order = PM.buildOrder({ maker: user, tokenId, side, price, size, tickSize: b.tickSize, builder: BUILDER_CODE });
    const exchange = b.negRisk ? PM.EXCHANGES.negRisk : PM.EXCHANGES.ctf;
    // approvals (one-time): collateral for buys, outcome shares for sells
    const plan: CallPlan[] = [];
    if (side === 'BUY') {
      const need = BigInt(order.makerAmount);
      if ((await read(PM.PUSD, erc20Abi, 'balanceOf', [user])) < need) return fail('Not enough pUSD. Wrap USDC.e first.', 'insufficient_funds');
      if ((await read(PM.PUSD, erc20Abi, 'allowance', [user, exchange])) < need) plan.push({ to: PM.PUSD, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [exchange, maxUint256] }), value: 0n, label: 'Approve pUSD for Polymarket', gasFallback: 70_000n });
    } else if (!(await read(PM.CTF, ctfAbi, 'isApprovedForAll', [user, exchange]))) {
      plan.push({ to: PM.CTF, data: encodeFunctionData({ abi: ctfAbi, functionName: 'setApprovalForAll', args: [exchange, true] }), value: 0n, label: 'Approve outcome shares for Polymarket', gasFallback: 80_000n });
    }
    if (msg.dryRun === true) return { ok: true, price: order.side === 0 ? Number(order.makerAmount) / Number(order.takerAmount) : Number(order.takerAmount) / Number(order.makerAmount), approvals: plan.length, cost: side === 'BUY' ? order.makerAmount : order.takerAmount };
    const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
    try {
      const pk = keys.evmPrivateKey();
      if (plan.length) await runPlan(polygon(), pk, plan);
      const c = await creds(ctx, scope, user);
      const sig = serializeSignature(await sign({ hash: PM.orderDigest(order, b.negRisk), privateKey: pk }));
      const r = await PM.postOrder(c, user, PM.orderBody(order, sig, c.apiKey, orderType));
      return { ok: true, orderId: r?.orderID ?? r?.orderId, status: r?.status };
    } finally { keys.dispose(); }
  } catch (e) { return errOf(e); }
};

export const handlers: HandlerMap = { predictionMarkets, predictionMarket, predictionPortfolio, predictionWrap, predictionOrder };
