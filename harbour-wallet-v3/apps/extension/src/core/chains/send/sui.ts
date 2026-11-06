// Sui (JSON-RPC fullnode). SUI transfers with PaySui / PayAllSui from the owner's SUI coin objects. Gas: reference gas price + a fixed budget
// (a dry-run needs a signed payload; unused budget is not charged). Other coin types use `Pay` over that coin's objects with a SUI coin as the gas payment.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { firstOf, fundsIssues, rpc, sub0, trimUrl } from './util';

const GAS_BUDGET = 5_000_000n; // 0.005 SUI ceiling
const GAS_EST = 2_000_000n;    // typical total (computation + storage - rebate) for a single transfer [estimate]
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[]) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
interface Coin { coinObjectId: string; version: string; digest: string; balance: string }
interface Ctx { coins: Coin[]; refGas: string; tokenCoins?: Coin[]; gasCoin?: Coin }
const SUI = '0x2::sui::SUI';
async function allCoins(env: SendEnv, chain: ChainInfo, owner: string, type: string): Promise<Coin[]> {
  const coins: Coin[] = []; let cursor: string | null = null;
  for (let i = 0; i < 10; i++) {
    const r: any = await call(env, chain, 'suix_getCoins', [owner, type, cursor, 50]);
    coins.push(...(r.data ?? [])); if (!r.hasNextPage) break; cursor = r.nextCursor;
  }
  return coins;
}

export const suiFamily: SendFamily = {
  kinds: ['sui'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.sui)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const coins = await allCoins(env, chain, p.from, SUI);
    const refGas = String(await call(env, chain, 'suix_getReferenceGasPrice', []));
    const balance = coins.reduce((s, c) => s + BigInt(c.balance), 0n);
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: GAS_EST, feeMax: GAS_BUDGET, max: sub0(balance, GAS_BUDGET) }));
    if (p.asset.kind === 'token') {
      const tokenCoins = await allCoins(env, chain, p.from, p.asset.contract ?? '');
      const tokenBal = tokenCoins.reduce((x, c) => x + BigInt(c.balance), 0n);
      const gasCoin = coins.filter((c) => BigInt(c.balance) >= GAS_BUDGET).sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)))[0];
      const ttiers = tiers.map((t) => ({ ...t, max: tokenBal }));
      const issues = fundsIssues({ amount: p.amount, isToken: true, assetBalance: tokenBal, nativeBalance: balance, fee: GAS_BUDGET });
      if (!gasCoin && balance >= GAS_BUDGET) issues.push({ code: 'insufficient-fee', message: 'No single SUI coin can cover the gas budget; merge your SUI coins first.', blocking: true });
      return { tiers: ttiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: tokenBal.toString(), issues, ctx: { coins, refGas, tokenCoins, gasCoin } as Ctx };
    }
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee: GAS_BUDGET });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { coins, refGas } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!;
    const inputCoins = c.coins.map((k) => ({ objectId: k.coinObjectId, version: k.version, objectDigest: k.digest }));
    const base: any = { privateKey: key, signer: p.from, gasBudget: GAS_BUDGET.toString(), referenceGasPrice: c.refGas };
    if (p.asset.kind === 'token') {
      if (!c.tokenCoins?.length || !c.gasCoin) throw new SendError('estimate-failed', 'Missing coin objects for this transfer');
      const amount = p.isMax ? c.tokenCoins.reduce((x, k) => x + BigInt(k.balance), 0n) : p.amount;
      const ref = (k: Coin) => ({ objectId: k.coinObjectId, version: k.version, objectDigest: k.digest });
      base.pay = { inputCoins: c.tokenCoins.map(ref), recipients: [p.to], amounts: [amount.toString()], gas: ref(c.gasCoin) };
    } else
    // "Max": PayAllSui sends everything left after gas, so no dust remains.
    if (p.isMax) base.payAllSui = { inputCoins, recipient: p.to }; else base.paySui = { inputCoins, recipients: [p.to], amounts: [p.amount.toString()] };
    void t;
    const input = TW.Sui.Proto.SigningInput.create(base);
    const out = TW.Sui.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Sui.Proto.SigningInput.encode(input).finish(), env.core.CoinType.sui));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: JSON.stringify({ tx: out.unsignedTx, sig: out.signature }) };
  },
  async broadcast(env, chain, tx) {
    const { tx: bytes, sig } = JSON.parse(tx.raw);
    const r = await call(env, chain, 'sui_executeTransactionBlock', [bytes, [sig], { showEffects: true }, 'WaitForEffectsCert']);
    if (r?.effects?.status?.status && r.effects.status.status !== 'success') throw new Error(r.effects.status.error || 'Transaction failed');
    return r.digest;
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await call(env, chain, 'sui_getTransactionBlock', [hash, { showEffects: true }]);
      const ok = r?.effects?.status?.status === 'success'; const g = r?.effects?.gasUsed;
      return { state: ok ? 'confirmed' : 'failed', block: r.checkpoint, timestamp: r.timestampMs ? Math.floor(Number(r.timestampMs) / 1000) : undefined,
        fee: g ? String(BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate)) : undefined, error: ok ? undefined : r?.effects?.status?.error };
    } catch { return { state: 'unknown' }; }
  },
};
