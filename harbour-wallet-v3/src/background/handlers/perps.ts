// Feature message handlers: perps (Hyperliquid). UI-only (the router enforces isInternalWalletSender). Behind the remote flag `perps`.
// The main EVM key signs only user actions (approve agent / builder fee, withdraw) and the Arbitrum USDC deposit; trading is signed
// by a per-account agent key generated here, stored encrypted with the wallet password, never shown to the UI. Agents cannot withdraw.
import { encodeFunctionData, decodeFunctionResult, erc20Abi } from 'viem';
import { sign, privateKeyToAddress } from 'viem/accounts';
import type { Handler, HandlerCtx, HandlerMap } from './types';
import { local, session, KEYS } from '../../core/storage';
import { encrypt, decrypt } from '../../core/passworder';
import { chainById, explorerTxUrl } from '../../core/chains/index';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { openActiveKeys } from '../keys';
import { activeInfo } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import { ethCall, type CallPlan } from '../../core/staking/evm';
import { isKilled } from '../../kit/failover';
import {
  ARB_USDC, HL_BRIDGE, MIN_DEPOSIT, cancelAction, hlExchange, hlInfo, l1Digest, leverageAction, marketPrice, orderAction, orderStatuses, orderWire,
  perpAccount, perpMarkets, toSig, userAction, userDigest, type Builder, type PerpMarket,
} from '../../core/perps/hyperliquid';

const getStore = () => import('../store'); // same chunk as the background entry (no runtime import())
const AGENT_KEY = 'perps:agents:v1';
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
const BUILDER: Builder | null = /^0x[0-9a-fA-F]{40}$/.test(env.VITE_HB_HL_BUILDER ?? '') ? { b: env.VITE_HB_HL_BUILDER!.toLowerCase(), f: Math.min(100, Math.max(1, Number(env.VITE_HB_HL_BUILDER_FEE ?? 10))) } : null;
const maxFeeRate = (b: Builder) => `${(b.f / 1000).toString()}%`; // tenths of a basis point -> percent ("10" -> "0.01%")
const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });
const errOf = (e: any) => fail(String(e?.shortMessage ?? e?.message ?? 'Request failed').slice(0, 300), e?.code ?? 'error');
const off = fail('Perps are not enabled', 'FEATURE_DISABLED');
let lastNonce = 0;
const nonce = () => (lastNonce = Math.max(Date.now(), lastNonce + 1));

async function enabled(): Promise<boolean> {
  try { return (await getStore()).store.getState().sdkFeatureSlice.flags.perps === true && !isKilled('hyperliquid'); } catch { return false; }
}
interface AgentRec { address: string; enc: string; approvedAt: number; builderApproved?: boolean }
async function account(ctx: HandlerCtx) {
  const info = await activeInfo(ctx); if (!info) throw Object.assign(new Error('No wallet found'), { code: 'no_wallet' });
  if (info.walletType !== 'mnemonic' && info.walletType !== 'privateKey') throw Object.assign(new Error('Perps need a locally held key'), { code: 'unsupported_wallet' });
  const user = info.addresses.ethereum; if (!user) throw Object.assign(new Error('This wallet has no EVM account'), { code: 'no_address' });
  return { info, user, scope: `${info.walletId}:${info.derivationIndex}` };
}
const agents = async () => (await local.get<Record<string, AgentRec>>(AGENT_KEY)) ?? {};
async function agentKey(scope: string): Promise<{ rec: AgentRec; pk: `0x${string}` }> {
  const rec = (await agents())[scope]; if (!rec) throw Object.assign(new Error('Enable perps trading first'), { code: 'no_agent' });
  const pw = await session.get<string>(KEYS.PASSWORD); if (!pw) throw Object.assign(new Error('Wallet is locked'), { code: 'locked' });
  return { rec, pk: (await decrypt<{ pk: `0x${string}` }>(pw, rec.enc)).pk };
}
async function mainSign(ctx: HandlerCtx, digest: `0x${string}`) {
  const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
  try { return toSig(await sign({ hash: digest, privateKey: keys.evmPrivateKey() })); } finally { keys.dispose(); }
}
async function userSigned(ctx: HandlerCtx, type: 'approveAgent' | 'approveBuilderFee' | 'withdraw3', fields: Record<string, string | number>) {
  const action = userAction(type, fields);
  const sig = await mainSign(ctx, userDigest(action));
  return hlExchange({ action, nonce: Number(fields.nonce ?? fields.time), signature: sig });
}
async function agentSigned(scope: string, action: unknown) {
  const { pk } = await agentKey(scope); const n = nonce();
  return hlExchange({ action, nonce: n, signature: toSig(await sign({ hash: l1Digest(action, n), privateKey: pk })) });
}
let marketsCache: { at: number; list: PerpMarket[] } | null = null;
async function markets(): Promise<PerpMarket[]> {
  if (marketsCache && Date.now() - marketsCache.at < 15_000) return marketsCache.list;
  const list = await perpMarkets(); marketsCache = { at: Date.now(), list }; return list;
}
const marketOf = async (coin: unknown) => { const m = (await markets()).find((x) => x.coin === coin); if (!m) throw Object.assign(new Error('Unknown market'), { code: 'bad_request' }); return m; };
async function arbUsdc(user: string): Promise<bigint> {
  const arb = chainById('arbitrum'); if (!arb) return 0n;
  const raw = await ethCall(fetch, getRpcUrls(arb), ARB_USDC, encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [user as `0x${string}`] }));
  return decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: raw }) as bigint;
}

const perpsMarkets: Handler = async () => {
  if (!(await enabled())) return off;
  try { return { ok: true, markets: await markets() }; } catch (e) { return errOf(e); }
};
const perpsAccount: Handler = async (_m, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { user, scope } = await account(ctx);
    const rec = (await agents())[scope];
    const [acct, usdc, extra, maxFee] = await Promise.all([
      perpAccount(user), arbUsdc(user).catch(() => null), hlInfo<any[]>({ type: 'extraAgents', user }).catch(() => []),
      BUILDER ? hlInfo<number>({ type: 'maxBuilderFee', user, builder: BUILDER.b }).catch(() => 0) : Promise.resolve(0),
    ]);
    const agentLive = !!rec && (extra ?? []).some((a: any) => String(a?.address ?? '').toLowerCase() === rec.address.toLowerCase());
    return { ok: true, user, account: acct, arbitrumUsdc: usdc?.toString() ?? null, agent: rec ? { address: rec.address, live: agentLive } : null, builder: BUILDER ? { address: BUILDER.b, feeTenthsBp: BUILDER.f, approved: Number(maxFee) >= BUILDER.f } : null, minDeposit: MIN_DEPOSIT.toString() };
  } catch (e) { return errOf(e); }
};
/** One-time setup: create the agent key, have the main wallet approve it (and the builder fee, when Harbour has a builder code). */
const perpsEnable: Handler = async (_m, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { scope } = await account(ctx);
    const pw = await session.get<string>(KEYS.PASSWORD); if (!pw) return fail('Wallet is locked', 'locked');
    const pkBytes = crypto.getRandomValues(new Uint8Array(32));
    const pk = ('0x' + Array.from(pkBytes, (b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`; pkBytes.fill(0);
    const address = privateKeyToAddress(pk);
    await userSigned(ctx, 'approveAgent', { agentAddress: address, agentName: 'Harbour', nonce: nonce() });
    let builderApproved = false;
    if (BUILDER) { try { await userSigned(ctx, 'approveBuilderFee', { maxFeeRate: maxFeeRate(BUILDER), builder: BUILDER.b, nonce: nonce() }); builderApproved = true; } catch { /* trading still works without the builder fee */ } }
    const all = await agents(); all[scope] = { address, enc: await encrypt(pw, { pk }), approvedAt: Date.now(), builderApproved }; await local.set(AGENT_KEY, all);
    return { ok: true, agent: address, builderApproved };
  } catch (e) { return errOf(e); }
};
/** Deposit: Arbitrum USDC transfer to Hyperliquid's bridge (credited to the same address, usually within a minute). */
const perpsDeposit: Handler = async (msg, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { user } = await account(ctx); const arb = chainById('arbitrum')!;
    let amount: bigint; try { amount = BigInt(String(msg.amount ?? '')); } catch { return fail('Enter a valid amount', 'bad_amount'); }
    if (amount < MIN_DEPOSIT) return fail('The minimum deposit is 5 USDC (smaller deposits are lost)', 'bad_amount');
    if ((await arbUsdc(user)) < amount) return fail('Not enough USDC on Arbitrum', 'insufficient_funds');
    const plan: CallPlan[] = [{ to: ARB_USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [HL_BRIDGE, amount] }), value: 0n, label: 'Deposit USDC to Hyperliquid', gasFallback: 80_000n }];
    if (msg.dryRun === true) { const est = await estimatePlan(arb, user as `0x${string}`, plan); return { ok: true, fee: est.fee.toString(), feeExact: est.exact }; }
    const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
    try { const [hash] = await runPlan(arb, keys.evmPrivateKey(), plan); return { ok: true, hash, explorerUrl: explorerTxUrl(arb, hash) }; } finally { keys.dispose(); }
  } catch (e) { return errOf(e); }
};
/** Withdraw to the same address on Arbitrum (Hyperliquid charges a 1 USDC fee). */
const perpsWithdraw: Handler = async (msg, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { user } = await account(ctx);
    const amt = Number(msg.amount); if (!(amt > 1)) return fail('Enter more than the 1 USDC withdrawal fee', 'bad_amount');
    const acct = await perpAccount(user); if (amt > acct.withdrawable) return fail('Amount exceeds your withdrawable balance', 'bad_amount');
    const t = nonce();
    await userSigned(ctx, 'withdraw3', { destination: user, amount: String(Math.floor(amt * 1e6) / 1e6), time: t });
    return { ok: true };
  } catch (e) { return errOf(e); }
};
/** Place an order. size in coin units; type market (IOC at mid ± slippage) or limit (GTC); optional leverage update first. */
const perpsOrder: Handler = async (msg, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { scope } = await account(ctx); const m = await marketOf(msg.coin);
    const isBuy = msg.side === 'buy'; const size = Number(msg.size); const type = msg.orderType === 'limit' ? 'limit' : 'market';
    if (!(size > 0)) return fail('Enter a size', 'bad_amount');
    if (msg.leverage != null) {
      const lev = Math.round(Number(msg.leverage)); if (!(lev >= 1 && lev <= m.maxLeverage)) return fail(`Leverage must be 1-${m.maxLeverage}x`, 'bad_request');
      await agentSigned(scope, leverageAction(m.asset, lev, msg.isCross !== false));
    }
    const price = type === 'limit' ? Number(msg.price) : marketPrice(m.mid, isBuy, Math.min(0.1, Math.max(0.001, Number(msg.slippage ?? 0.05))));
    if (!(price > 0)) return fail('Enter a limit price', 'bad_request');
    const wire = orderWire({ asset: m.asset, isBuy, price, size, reduceOnly: msg.reduceOnly === true, tif: type === 'limit' ? 'Gtc' : 'Ioc', szDecimals: m.szDecimals });
    const rec = (await agents())[scope];
    const resp = await agentSigned(scope, orderAction([wire], BUILDER && rec?.builderApproved ? BUILDER : null));
    const [st] = orderStatuses(resp);
    return st?.ok ? { ok: true, status: st } : fail(st?.error ?? 'Order rejected', 'rejected');
  } catch (e) { return errOf(e); }
};
const perpsCancel: Handler = async (msg, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { scope } = await account(ctx); const m = await marketOf(msg.coin);
    const oid = Number(msg.oid); if (!Number.isSafeInteger(oid)) return fail('Bad order id', 'bad_request');
    const [st] = orderStatuses(await agentSigned(scope, cancelAction([{ asset: m.asset, oid }])));
    return st?.ok ? { ok: true } : fail(st?.error ?? 'Cancel failed', 'rejected');
  } catch (e) { return errOf(e); }
};
/** Close a whole position with a reduce-only market order. */
const perpsClose: Handler = async (msg, ctx) => {
  if (!(await enabled())) return off;
  try {
    const { user } = await account(ctx);
    const p = (await perpAccount(user)).positions.find((x) => x.coin === msg.coin); if (!p) return fail('No open position', 'bad_request');
    return perpsOrder({ type: 'perpsOrder', coin: p.coin, side: p.size > 0 ? 'sell' : 'buy', size: Math.abs(p.size), orderType: 'market', reduceOnly: true }, ctx);
  } catch (e) { return errOf(e); }
};

export const handlers: HandlerMap = { perpsMarkets, perpsAccount, perpsEnable, perpsDeposit, perpsWithdraw, perpsOrder, perpsCancel, perpsClose };
