// Sui (JSON-RPC fullnode). SUI transfers with PaySui / PayAllSui from the owner's SUI coin objects. Gas: reference gas price + a fixed budget
// (a dry-run needs a signed payload; unused budget is not charged). Non-SUI coin types are not implemented: documented Gap.
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
interface Ctx { coins: Coin[]; refGas: string }

export const suiFamily: SendFamily = {
  kinds: ['sui'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.sui)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const coins: Coin[] = []; let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const r: any = await call(env, chain, 'suix_getCoins', [p.from, '0x2::sui::SUI', cursor, 50]);
      coins.push(...(r.data ?? [])); if (!r.hasNextPage) break; cursor = r.nextCursor;
    }
    const refGas = String(await call(env, chain, 'suix_getReferenceGasPrice', []));
    const balance = coins.reduce((s, c) => s + BigInt(c.balance), 0n);
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: GAS_EST, feeMax: GAS_BUDGET, max: sub0(balance, GAS_BUDGET) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee: GAS_BUDGET });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { coins, refGas } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!;
    const inputCoins = c.coins.map((k) => ({ objectId: k.coinObjectId, version: k.version, objectDigest: k.digest }));
    const base: any = { privateKey: key, signer: p.from, gasBudget: GAS_BUDGET.toString(), referenceGasPrice: c.refGas };
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
