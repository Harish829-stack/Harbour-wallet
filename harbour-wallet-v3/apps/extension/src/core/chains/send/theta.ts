// Theta (JSON-RPC). THETA transfers; the 0.3 TFUEL network fee is paid in TFUEL. TFUEL itself is a second asset of this chain (asset.contract === 'tfuel').
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bigToBytes, firstOf, issue, rpc, sub0, trimUrl, MSG } from './util';

const FEE = 300_000_000_000_000_000n; // 0.3 TFUEL
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, [params] as any));
interface Ctx { sequence: number }

export const thetaFamily: SendFamily = {
  kinds: ['theta'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const tfuel = p.asset.kind === 'token' && p.asset.contract === 'tfuel';
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.theta)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const acc = await call(env, chain, 'theta.GetAccount', { address: p.from, preview: false });
    const theta = BigInt(acc?.coins?.thetawei ?? 0), fuel = BigInt(acc?.coins?.tfuelwei ?? 0); const assetBalance = tfuel ? fuel : theta;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: FEE, max: tfuel ? sub0(fuel, FEE) : theta }));
    const issues = [];
    if (p.amount > 0n && p.amount > assetBalance) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
    else if (fuel < FEE + (tfuel ? p.amount : 0n)) issues.push(issue('insufficient-fee', 'You need TFUEL to pay the network fee on Theta.', true));
    return { tiers, defaultTier: 'average', feeSymbol: 'TFUEL', feeDecimals: 18, nativeBalance: fuel.toString(), assetBalance: assetBalance.toString(), issues, ctx: { sequence: Number(acc?.sequence ?? 0) } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount; const tfuel = p.asset.kind === 'token' && p.asset.contract === 'tfuel';
    const input = TW.Theta.Proto.SigningInput.create({ chainId: 'mainnet', toAddress: p.to, thetaAmount: tfuel ? new Uint8Array(0) : bigToBytes(amount), tfuelAmount: tfuel ? bigToBytes(amount) : new Uint8Array(0), sequence: c.sequence + 1, fee: bigToBytes(FEE), privateKey: key } as any);
    const out = TW.Theta.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Theta.Proto.SigningInput.encode(input).finish(), env.core.CoinType.theta));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    let hex = ''; for (const b of out.encoded) hex += b.toString(16).padStart(2, '0');
    return { raw: hex };
  },
  async broadcast(env, chain, tx) { const r = await call(env, chain, 'theta.BroadcastRawTransaction', { tx_bytes: tx.raw }); return String(r?.hash ?? ''); },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const r = await call(env, chain, 'theta.GetTransaction', { hash }); if (!r?.status) return { state: 'unknown' }; return { state: r.status === 'finalized' ? 'confirmed' : 'pending', block: r.block_height }; } catch { return { state: 'unknown' }; }
  },
};
