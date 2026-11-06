// XRP Ledger (public JSON-RPC, s1.ripple.com): account sequence, reserve-aware spendable balance, destination tag,
// lsfRequireDestTag enforcement (blocks sending to an exchange that requires a tag), new-account activation reserve.
// TW evidence: send.confirm.reserve-fee ("Added to Reserve"), validate-tag.all-numbers / validate-tag.in-range, address-and-memo-input tag.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, bytesToHex, firstOf, fundsIssues, issue, jpost, sub0, trimUrl, formatUnits } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
async function xrpl(env: SendEnv, c: ChainInfo, method: string, params: Record<string, unknown> = {}): Promise<any> {
  const j = await firstOf(eps(c), (u) => jpost(env.fetch, u, { method, params: [params] }));
  return j?.result ?? j;
}
const LSF_REQUIRE_DEST_TAG = 0x00020000;
export const validateXrpTag = (memo: string): string | null => {
  if (memo === '') return null;
  if (!/^[0-9]+$/.test(memo)) return 'Destination Tag must be a number';
  return Number(memo) <= 4294967295 ? null : 'Destination Tag must be between 0 and 4294967295';
};
interface Ctx { sequence: number; lastLedger: number; fees: Record<FeeTierId, bigint> }

export const rippleFamily: SendFamily = {
  kinds: ['ripple'], memo: 'tag', tokens: false, validateMemo: validateXrpTag,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.xrp)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acc, dest, si, fee] = await Promise.all([
      xrpl(env, chain, 'account_info', { account: p.from, ledger_index: 'current' }),
      xrpl(env, chain, 'account_info', { account: p.to, ledger_index: 'current' }),
      xrpl(env, chain, 'server_info'), xrpl(env, chain, 'fee'),
    ]);
    const issues = [];
    if (acc.error === 'actNotFound') throw new SendError('insufficient-funds', 'This XRP account is not activated yet (it needs the base reserve).');
    if (acc.status === 'error') throw new Error(acc.error_message || acc.error);
    const balance = BigInt(acc.account_data.Balance); const owners = BigInt(acc.account_data.OwnerCount ?? 0);
    const vl = si?.info?.validated_ledger ?? {}; const resBase = BigInt(Math.round(Number(vl.reserve_base_xrp ?? 1) * 1e6)); const resInc = BigInt(Math.round(Number(vl.reserve_inc_xrp ?? 0.2) * 1e6));
    const reserve = resBase + resInc * owners;
    const d = fee?.drops ?? {}; const open = BigInt(d.open_ledger_fee ?? d.base_fee ?? 10); const median = BigInt(d.median_fee ?? 10); const base = BigInt(d.base_fee ?? 10);
    const slow = open > base ? open : base; const avg = median > slow ? median : slow; const fast = avg * 2n;
    const cap = 1_000_000n; const fees = { slow: slow > cap ? cap : slow, average: avg > cap ? cap : avg, fast: fast > cap ? cap : fast };
    const recipientInactive = dest.error === 'actNotFound';
    if (recipientInactive && p.amount > 0n && p.amount < resBase) issues.push(issue('inactive-account', `This address is not activated yet: send at least ${formatUnits(resBase, 6)} XRP to activate it (it becomes its reserve).`, true));
    else if (recipientInactive) issues.push(issue('info', `This address is not activated yet. The first payment must be at least ${formatUnits(resBase, 6)} XRP.`, false));
    if (!recipientInactive && Number(dest?.account_data?.Flags ?? 0) & LSF_REQUIRE_DEST_TAG && !p.memo) issues.push(issue('memo-required', MSG.memoRequired, true));
    issues.push(issue('reserve', `${formatUnits(reserve, 6)} XRP stays in your account as the XRP reserve.`, false));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: fees[id], max: sub0(balance, reserve + fees[id]), detail: `${fees[id]} drops` }));
    issues.push(...fundsIssues({ amount: p.amount, isToken: false, assetBalance: sub0(balance, reserve), nativeBalance: sub0(balance, reserve), fee: tiers[1].fee }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, reserve: reserve.toString(), recipientInactive,
      ctx: { sequence: acc.account_data.Sequence, lastLedger: Number(acc.ledger_current_index ?? 0), fees } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!;
    const amount = p.isMax ? t.max : p.amount;
    const input = TW.Ripple.Proto.SigningInput.create({ fee: c.fees[tier].toString(), sequence: c.sequence, lastLedgerSequence: c.lastLedger + 20, account: p.from, privateKey: key,
      opPayment: { amount: amount.toString(), destination: p.to, ...(p.memo ? { destinationTag: p.memo } : {}) } } as any);
    const out = TW.Ripple.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Ripple.Proto.SigningInput.encode(input).finish(), env.core.CoinType.xrp));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: bytesToHex(out.encoded).toUpperCase() };
  },
  async broadcast(env, chain, tx) {
    const r = await xrpl(env, chain, 'submit', { tx_blob: tx.raw });
    const code = String(r?.engine_result ?? '');
    if (r?.status === 'error') throw new Error(r.error_message || r.error);
    if (code.startsWith('tes') || code === 'terQUEUED') return r.tx_json?.hash ?? '';
    throw new Error(r?.engine_result_message || code || 'Rejected');
  },
  async status(env, chain, hash): Promise<TxStatus> {
    const r = await xrpl(env, chain, 'tx', { transaction: hash });
    if (r?.error === 'txnNotFound') return { state: 'unknown' };
    if (!r?.validated) return { state: 'pending' };
    const ok = r?.meta?.TransactionResult === 'tesSUCCESS';
    return { state: ok ? 'confirmed' : 'failed', block: String(r.ledger_index ?? ''), fee: r.Fee, error: ok ? undefined : r?.meta?.TransactionResult };
  },
};
