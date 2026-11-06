// ICON (JSON-RPC v3). ICX transfers with a fixed step limit (100000 steps x 12.5 Gloop step price = 0.00125 ICX) [estimate].
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bigToBytes, firstOf, fundsIssues, rpc, sub0, trimUrl } from './util';

const STEP_LIMIT = 100_000n; const STEP_PRICE = 12_500_000_000n; const FEE = STEP_LIMIT * STEP_PRICE;
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params as any));

export const iconFamily: SendFamily = {
  kinds: ['icon'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.icon)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const balance = BigInt(await call(env, chain, 'icx_getBalance', { address: p.from }));
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: FEE, max: sub0(balance, FEE) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee: FEE });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount; const now = (env.now ?? Date.now)();
    const input = TW.Icon.Proto.SigningInput.create({ fromAddress: p.from, toAddress: p.to, value: bigToBytes(amount), stepLimit: bigToBytes(STEP_LIMIT), timestamp: (now * 1000).toString(), nonce: new Uint8Array([1]), networkId: new Uint8Array([1]), privateKey: key } as any);
    const out = TW.Icon.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Icon.Proto.SigningInput.encode(input).finish(), env.core.CoinType.icon));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.encoded };
  },
  async broadcast(env, chain, tx) { return String(await call(env, chain, 'icx_sendTransaction', JSON.parse(tx.raw))); },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const r = await call(env, chain, 'icx_getTransactionResult', { txHash: hash }); return { state: Number(r.status) === 1 ? 'confirmed' : 'failed', block: String(Number(r.blockHeight)) }; }
    catch (e: any) { return /Pending|not found/i.test(String(e?.message)) ? { state: 'pending' } : { state: 'unknown' }; }
  },
};
