// Stellar (Horizon). Native XLM payments, create-account for unfunded recipients, text / numeric memo, reserve-aware max.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, firstOf, fundsIssues, issue, jget, sub0, trimUrl, formatUnits, parseUnits } from './util';

const PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const BASE_RESERVE = 5_000_000n; // 0.5 XLM in stroops
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const memoIsId = (m: string) => /^\d{1,19}$/.test(m) && BigInt(m) < 2n ** 64n;
interface Ctx { sequence: string; fees: Record<FeeTierId, number>; createAccount: boolean }

export const stellarFamily: SendFamily = {
  kinds: ['stellar'], memo: 'memo', tokens: false,
  validateMemo: (m) => (m === '' || memoIsId(m) || new TextEncoder().encode(m).length <= 28 ? null : 'Memo text must be 28 bytes or less'),
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.stellar)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acc, dest, stats] = await Promise.all([
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/accounts/${p.from}`)),
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/accounts/${p.to}`)).then(() => true).catch((e) => { if (e?.status === 404) return false; throw e; }),
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/fee_stats`)).catch(() => ({})),
    ]);
    const native = (acc.balances as any[]).find((b) => b.asset_type === 'native'); const balance = parseUnits(native?.balance ?? '0', 7);
    const reserve = BigInt(2 + (acc.subentry_count ?? 0) + (acc.num_sponsoring ?? 0) - (acc.num_sponsored ?? 0)) * BASE_RESERVE;
    const base = Number(stats?.last_ledger_base_fee ?? 100); const p50 = Number(stats?.fee_charged?.p50 ?? base); const p90 = Number(stats?.fee_charged?.p90 ?? base * 2);
    const fees = { slow: Math.max(100, base), average: Math.max(100, p50), fast: Math.max(100, p90, p50 * 2) };
    const issues = []; const createAccount = !dest;
    if (createAccount) issues.push(issue('inactive-account', `This address is not funded yet: the first payment must be at least ${formatUnits(2n * BASE_RESERVE, 7)} XLM.`, p.amount > 0n && p.amount < 2n * BASE_RESERVE));
    if (p.memo) { const e = stellarFamily.validateMemo?.(p.memo); if (e) issues.push(issue('invalid-memo', e, true)); }
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: BigInt(fees[id]), max: sub0(balance, reserve + BigInt(fees[id])), detail: `${fees[id]} stroops` }));
    issues.push(issue('reserve', `${formatUnits(reserve, 7)} XLM stays in your account as the Stellar reserve.`, false));
    issues.push(...fundsIssues({ amount: p.amount, isToken: false, assetBalance: sub0(balance, reserve), nativeBalance: sub0(balance, reserve), fee: tiers[1].fee }));
    void MSG;
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, reserve: reserve.toString(), recipientInactive: createAccount, ctx: { sequence: acc.sequence, fees, createAccount } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const base: any = { passphrase: PASSPHRASE, account: p.from, fee: c.fees[tier], sequence: (BigInt(c.sequence) + 1n).toString(), privateKey: key };
    if (c.createAccount) base.opCreateAccount = { destination: p.to, amount: amount.toString() }; else base.opPayment = { destination: p.to, amount: amount.toString() };
    if (p.memo) { if (memoIsId(p.memo)) base.memoId = { id: p.memo }; else base.memoText = { text: p.memo }; } else base.memoVoid = {};
    const input = TW.Stellar.Proto.SigningInput.create(base);
    const out = TW.Stellar.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Stellar.Proto.SigningInput.encode(input).finish(), env.core.CoinType.stellar));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.signature };
  },
  async broadcast(env, chain, tx) {
    return firstOf(eps(chain), async (u) => {
      const res = await env.fetch(`${u}/transactions`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(tx.raw), signal: AbortSignal.timeout(20000) });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.extras?.result_codes ? `${j.title}: ${JSON.stringify(j.extras.result_codes)}` : j?.title || `HTTP ${res.status}`);
      return j.hash;
    });
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const r = await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/transactions/${hash}`)); return { state: r.successful ? 'confirmed' : 'failed', block: String(r.ledger), fee: r.fee_charged, timestamp: r.created_at ? Math.floor(Date.parse(r.created_at) / 1000) : undefined }; }
    catch (e: any) { return e?.status === 404 ? { state: 'unknown' } : { state: 'unknown' }; }
  },
};
