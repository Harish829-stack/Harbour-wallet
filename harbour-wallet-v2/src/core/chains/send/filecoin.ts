// Filecoin (Glif JSON-RPC). Native FIL transfers; gas limit / fee cap / premium from Filecoin.GasEstimateMessageGas; nonce from the mempool.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bigToBytes, firstOf, fundsIssues, rpc, sub0, trimUrl } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[]) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
interface Ctx { nonce: number; gasLimit: number; feeCap: bigint; premium: bigint }

export const filecoinFamily: SendFamily = {
  kinds: ['filecoin'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.filecoin)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [bal, nonce] = await Promise.all([call(env, chain, 'Filecoin.WalletBalance', [p.from]), call(env, chain, 'Filecoin.MpoolGetNonce', [p.from])]);
    const balance = BigInt(bal); const amt = p.amount > 0n ? p.amount : 1n;
    const msg = await call(env, chain, 'Filecoin.GasEstimateMessageGas', [{ Version: 0, To: p.to, From: p.from, Nonce: Number(nonce), Value: amt.toString(), GasLimit: 0, GasFeeCap: '0', GasPremium: '0', Method: 0, Params: '' }, { MaxFee: '0' }, []]);
    const gasLimit = Number(msg.GasLimit); const feeCap = BigInt(msg.GasFeeCap); const premium = BigInt(msg.GasPremium); const fee = BigInt(gasLimit) * feeCap;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, fee) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { nonce: Number(nonce), gasLimit, feeCap, premium } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const input = TW.Filecoin.Proto.SigningInput.create({ privateKey: key, to: p.to, nonce: c.nonce, value: bigToBytes(amount), gasLimit: c.gasLimit, gasFeeCap: bigToBytes(c.feeCap), gasPremium: bigToBytes(c.premium) } as any);
    const out = TW.Filecoin.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Filecoin.Proto.SigningInput.encode(input).finish(), env.core.CoinType.filecoin));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.json };
  },
  async broadcast(env, chain, tx) { const cid = await call(env, chain, 'Filecoin.MpoolPush', [JSON.parse(tx.raw)]); return cid?.['/'] ?? String(cid); },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const r = await call(env, chain, 'Filecoin.StateSearchMsg', [[], { '/': hash }, 20, true]); if (!r) return { state: 'pending' }; return { state: r.Receipt?.ExitCode === 0 ? 'confirmed' : 'failed', block: String(r.Height) }; } catch { return { state: 'unknown' }; }
  },
};
