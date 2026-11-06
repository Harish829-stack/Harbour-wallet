// Zilliqa (JSON-RPC). ZIL transfers: nonce from GetBalance, minimum gas price from GetMinimumGasPrice, gas limit 50 (a simple payment).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bech32Bytes, bigToBytes, bytesToHex, firstOf, fundsIssues, rpc, sub0, trimUrl } from './util';

const GAS_LIMIT = 50n; const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[]) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
const hex = (_env: SendEnv, a: string) => bytesToHex(bech32Bytes(a));
interface Ctx { nonce: number; gasPrice: bigint }

export const zilliqaFamily: SendFamily = {
  kinds: ['zilliqa'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.zilliqa)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acc, gp] = await Promise.all([call(env, chain, 'GetBalance', [hex(env, p.from)]), call(env, chain, 'GetMinimumGasPrice', [])]);
    const balance = BigInt(acc?.balance ?? 0); const gasPrice = BigInt(gp); const fee = gasPrice * GAS_LIMIT;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, fee) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { nonce: Number(acc?.nonce ?? 0), gasPrice } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const input = TW.Zilliqa.Proto.SigningInput.create({ version: (1 << 16) | 1, nonce: c.nonce + 1, to: p.to, gasPrice: bigToBytes(c.gasPrice), gasLimit: GAS_LIMIT.toString(), privateKey: key, transaction: { transfer: { amount: bigToBytes(amount) } } } as any);
    const out = TW.Zilliqa.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Zilliqa.Proto.SigningInput.encode(input).finish(), env.core.CoinType.zilliqa));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.json };
  },
  async broadcast(env, chain, tx) { const r = await call(env, chain, 'CreateTransaction', [JSON.parse(tx.raw)]); return String(r?.TranID ?? ''); },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const r = await call(env, chain, 'GetTransaction', [hash]); return { state: r?.receipt?.success ? 'confirmed' : 'failed', block: r?.receipt?.epoch_num }; } catch (e: any) { return /not found|Txn Hash not Present/i.test(String(e?.message)) ? { state: 'pending' } : { state: 'unknown' }; }
  },
};
