// Algorand (algod REST, AlgoNode). ALGO payments and ASA transfers, optional note, min-balance aware max, opt-in check for ASA recipients.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, b64, firstOf, fromB64, fundsIssues, issue, jget, sub0, trimUrl, utf8 } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
interface Ctx { first: number; last: number; fee: bigint; genesisId: string; genesisHash: string }
const acct = (env: SendEnv, c: ChainInfo, a: string) => firstOf(eps(c), (u) => jget(env.fetch, `${u}/v2/accounts/${a}`)).catch((e) => { if (e?.status === 404) return null; throw e; });

export const algorandFamily: SendFamily = {
  kinds: ['algorand'], memo: 'memo', tokens: true,
  validateMemo: (m) => (utf8(m).length <= 1000 ? null : 'Note is too long (max 1000 bytes)'),
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const isToken = p.asset.kind === 'token';
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.algorand)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [from, to, tp] = await Promise.all([acct(env, chain, p.from), acct(env, chain, p.to), firstOf(eps(chain), (u) => jget(env.fetch, `${u}/v2/transactions/params`))]);
    const balance = BigInt(from?.amount ?? 0); const minBal = BigInt(from?.['min-balance'] ?? 100000); const fee = BigInt(Math.max(Number(tp['min-fee'] ?? 1000), Number(tp.fee ?? 0) * 250));
    const issues = []; let assetBalance = balance;
    if (isToken) {
      const id = Number(p.asset.contract);
      assetBalance = BigInt((from?.assets ?? []).find((a: any) => a['asset-id'] === id)?.amount ?? 0);
      if (!(to?.assets ?? []).some((a: any) => a['asset-id'] === id)) issues.push(issue('token-not-registered', 'The recipient has not opted in to this asset, so they cannot receive it yet.', true));
    } else if (!to || BigInt(to.amount ?? 0) === 0n) {
      issues.push(issue('inactive-account', 'This address is not funded yet: the first payment must be at least 0.1 ALGO.', p.amount > 0n && p.amount < 100000n));
    }
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: isToken ? assetBalance : sub0(balance, minBal + fee) }));
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance: isToken ? assetBalance : sub0(balance, minBal), nativeBalance: sub0(balance, minBal), fee }));
    void MSG;
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: assetBalance.toString(), issues, reserve: minBal.toString(), recipientInactive: !to,
      ctx: { first: tp['last-round'], last: tp['last-round'] + 1000, fee, genesisId: tp['genesis-id'], genesisHash: tp['genesis-hash'] } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const base: any = { genesisId: c.genesisId, genesisHash: fromB64(c.genesisHash), note: p.memo ? utf8(p.memo) : new Uint8Array(0), privateKey: key, firstRound: c.first, lastRound: c.last, fee: c.fee.toString() };
    if (p.asset.kind === 'token') base.assetTransfer = { toAddress: p.to, amount: amount.toString(), assetId: p.asset.contract }; else base.transfer = { toAddress: p.to, amount: amount.toString() };
    const input = TW.Algorand.Proto.SigningInput.create(base);
    const out = TW.Algorand.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Algorand.Proto.SigningInput.encode(input).finish(), env.core.CoinType.algorand));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: b64(out.encoded) };
  },
  async broadcast(env, chain, tx) {
    return firstOf(eps(chain), async (u) => {
      const res = await env.fetch(`${u}/v2/transactions`, { method: 'POST', headers: { 'content-type': 'application/x-binary' }, body: fromB64(tx.raw), signal: AbortSignal.timeout(20000) });
      const j: any = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`); return j.txId;
    });
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/v2/transactions/pending/${hash}`));
      if (r['confirmed-round']) return { state: 'confirmed', block: String(r['confirmed-round']) };
      if (r['pool-error']) return { state: 'failed', error: r['pool-error'] };
      return { state: 'pending' };
    } catch { return { state: 'unknown' }; }
  },
};
