// MultiversX (gateway REST). EGLD transfers with optional data field (memo); gas = min gas limit + 1500 per data byte at the network's min gas price.
// ESDT token transfers are not implemented: documented Gap.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { firstOf, fundsIssues, jget, jpost, sub0, trimUrl, utf8 } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const get = (env: SendEnv, c: ChainInfo, path: string) => firstOf(eps(c), (u) => jget(env.fetch, u + path));
interface Ctx { nonce: number; chainId: string; gasPrice: bigint; gasLimit: bigint }

export const multiversxFamily: SendFamily = {
  kinds: ['multiversx'], memo: 'memo', tokens: false,
  validateMemo: (m) => (utf8(m).length <= 255 ? null : 'Data is too long (max 255 bytes)'),
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.multiversX)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acc, cfg] = await Promise.all([get(env, chain, `/address/${p.from}`), get(env, chain, '/network/config')]);
    const a = acc?.data?.account ?? {}; const c = cfg?.data?.config ?? {}; const balance = BigInt(a.balance ?? 0);
    const gasPrice = BigInt(c.erd_min_gas_price ?? 1_000_000_000); const gasLimit = BigInt(c.erd_min_gas_limit ?? 50_000) + (p.memo ? 1500n * BigInt(utf8(p.memo).length) : 0n); const fee = gasPrice * gasLimit;
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, fee) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, ctx: { nonce: Number(a.nonce ?? 0), chainId: String(c.erd_chain_id ?? '1'), gasPrice, gasLimit } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const input = TW.MultiversX.Proto.SigningInput.create({ privateKey: key, chainId: c.chainId, gasPrice: c.gasPrice.toString(), gasLimit: c.gasLimit.toString(),
      egldTransfer: { accounts: { senderNonce: c.nonce, sender: p.from, receiver: p.to }, amount: amount.toString(), ...(p.memo ? { data: p.memo } : {}), version: 1 } } as any);
    const out = TW.MultiversX.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.MultiversX.Proto.SigningInput.encode(input).finish(), env.core.CoinType.multiversX));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.encoded };
  },
  async broadcast(env, chain, tx) { const j = await firstOf(eps(chain), (u) => jpost(env.fetch, u + '/transaction/send', tx.raw)); if (j?.error) throw new Error(j.error); return j?.data?.txHash ?? ''; },
  async status(env, chain, hash): Promise<TxStatus> {
    try { const j = await get(env, chain, `/transaction/${hash}`); const s = j?.data?.transaction?.status; return { state: s === 'success' ? 'confirmed' : s === 'fail' || s === 'invalid' ? 'failed' : 'pending' }; } catch { return { state: 'unknown' }; }
  },
};
