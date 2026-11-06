// Harmony (shard 0, eth-compatible JSON-RPC on api.harmony.one). Native ONE transfers: wallet-core signs the Harmony RLP, 21000 gas.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bech32Bytes, bigToBytes, bytesToHex, firstOf, fundsIssues, rpc, scale, sub0, trimUrl } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[]) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
const hex20 = (_env: SendEnv, a: string) => '0x' + bytesToHex(bech32Bytes(a));
const GAS = 21_000n; interface Ctx { nonce: number; gasPrice: bigint }

export const harmonyFamily: SendFamily = {
  kinds: ['harmony'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.harmony)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const from = hex20(env, p.from);
    const [bal, nonce, gp] = await Promise.all([call(env, chain, 'eth_getBalance', [from, 'latest']), call(env, chain, 'eth_getTransactionCount', [from, 'pending']), call(env, chain, 'eth_gasPrice', [])]);
    const balance = BigInt(bal); const base = BigInt(gp) > 1_000_000_000n ? BigInt(gp) : 1_000_000_000n;
    const mult = { slow: 1, average: 1.2, fast: 2 } as const;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: GAS * scale(base, mult[id]), max: sub0(balance, GAS * scale(base, mult[id])), detail: `${Number(scale(base, mult[id])) / 1e9} gwei` }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee: tiers[1].fee });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { nonce: Number(BigInt(nonce)), gasPrice: base } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const mult = { slow: 1, average: 1.2, fast: 2 } as const;
    const input = TW.Harmony.Proto.SigningInput.create({ chainId: new Uint8Array([1]), privateKey: key, transactionMessage: { nonce: bigToBytes(BigInt(c.nonce)), gasPrice: bigToBytes(scale(c.gasPrice, mult[tier])), gasLimit: bigToBytes(GAS), toAddress: p.to, amount: bigToBytes(amount), payload: new Uint8Array(0), fromShardId: new Uint8Array(0), toShardId: new Uint8Array(0) } } as any);
    const out = TW.Harmony.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Harmony.Proto.SigningInput.encode(input).finish(), env.core.CoinType.harmony));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: '0x' + bytesToHex(out.encoded) };
  },
  async broadcast(env, chain, tx) { return String(await call(env, chain, 'eth_sendRawTransaction', [tx.raw])); },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const rc = await call(env, chain, 'eth_getTransactionReceipt', [hash]); if (!rc) return { state: 'pending' }; return { state: rc.status === '0x1' ? 'confirmed' : 'failed', block: String(Number(BigInt(rc.blockNumber))) }; } catch { return { state: 'unknown' }; }
  },
};
