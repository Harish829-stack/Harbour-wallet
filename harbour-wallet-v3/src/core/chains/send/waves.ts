// Waves (node REST). WAVES + issued-asset transfers, flat 0.001 WAVES fee, optional attachment (memo).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { firstOf, fundsIssues, jget, jpost, sub0, trimUrl, utf8 } from './util';

const FEE = 100_000n; const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
export const wavesFamily: SendFamily = {
  kinds: ['waves'], memo: 'memo', tokens: true,
  validateMemo: (m) => (utf8(m).length <= 140 ? null : 'Attachment is too long (max 140 bytes)'),
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const isToken = p.asset.kind === 'token';
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.waves)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const native = await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/addresses/balance/${p.from}`)); const nativeBalance = BigInt(native.balance ?? 0);
    const assetBalance = isToken ? BigInt((await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/assets/balance/${p.from}/${p.asset.contract}`))).balance ?? 0) : nativeBalance;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: FEE, max: isToken ? assetBalance : sub0(nativeBalance, FEE) }));
    const issues = fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance, fee: FEE });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: nativeBalance.toString(), assetBalance: assetBalance.toString(), issues };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const input = TW.Waves.Proto.SigningInput.create({ timestamp: (env.now ?? Date.now)(), privateKey: key, transferMessage: { amount: amount.toString(), asset: p.asset.kind === 'token' ? p.asset.contract : '', fee: FEE.toString(), feeAsset: '', to: p.to, attachment: p.memo ? utf8(p.memo) : new Uint8Array(0) } } as any);
    const out = TW.Waves.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Waves.Proto.SigningInput.encode(input).finish(), env.core.CoinType.waves));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.json };
  },
  async broadcast(env, chain, tx) { const j = await firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/transactions/broadcast`, tx.raw)); return j.id; },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const j = await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/transactions/info/${hash}`)); return { state: j.applicationStatus === 'script_execution_failed' ? 'failed' : 'confirmed', block: String(j.height), fee: String(j.fee) }; }
    catch (e: any) { if (e?.status === 404) { try { await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/transactions/unconfirmed/info/${hash}`)); return { state: 'pending' }; } catch { return { state: 'unknown' }; } } return { state: 'unknown' }; }
  },
};
