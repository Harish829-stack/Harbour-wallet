// Cosmos SDK family (14 registry chains): bank MsgSend (native denom or any bank denom / IBC voucher), THORChain MsgSend.
// Public LCD/REST endpoints (publicnode, thornode). account_number + sequence from x/auth, chain id from node_info,
// fee = gas * gas price where gas price = max(table default, node's advertised minimum_gas_price). Signing: wallet-core (protobuf mode).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, firstOf, fundsIssues, issue, jget, jpost, sub0, trimUrl } from './util';

interface Spec { denom: string; gasPrice: number; gas: number; thor?: boolean }
// gasPrice = smallest-denom units per gas unit. Values are conservative public-network defaults [likely]; the node's own minimum wins when higher.
export const COSMOS_SPECS: Record<string, Spec> = {
  cosmos: { denom: 'uatom', gasPrice: 0.025, gas: 200000 }, terra: { denom: 'uluna', gasPrice: 28.325, gas: 200000 }, kava: { denom: 'ukava', gasPrice: 0.025, gas: 200000 },
  agoric: { denom: 'ubld', gasPrice: 0.05, gas: 200000 }, thorchain: { denom: 'rune', gasPrice: 0, gas: 2000000, thor: true }, nativeinjective: { denom: 'inj', gasPrice: 500_000_000, gas: 200000 },
  osmosis: { denom: 'uosmo', gasPrice: 0.025, gas: 200000 }, zetachain: { denom: 'azeta', gasPrice: 20_000_000_000, gas: 200000 }, akash: { denom: 'uakt', gasPrice: 0.025, gas: 200000 },
  sei: { denom: 'usei', gasPrice: 0.1, gas: 200000 }, juno: { denom: 'ujuno', gasPrice: 0.075, gas: 200000 }, stride: { denom: 'ustrd', gasPrice: 0.025, gas: 200000 },
  axelar: { denom: 'uaxl', gasPrice: 0.05, gas: 200000 }, neutron: { denom: 'untrn', gasPrice: 0.05, gas: 200000 },
};
const THOR_NATIVE_FEE = 2_000_000n; // 0.02 RUNE, deducted by the protocol
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const get = (env: SendEnv, c: ChainInfo, path: string) => firstOf(eps(c), (u) => jget(env.fetch, u + path));

const findNum = (o: any, key: string): string | undefined => { if (!o || typeof o !== 'object') return undefined; if (o[key] != null) return String(o[key]); for (const v of Object.values(o)) { const r = findNum(v, key); if (r != null) return r; } return undefined; };
function nodeMinPrice(cfg: any, denom: string): number {
  const s = String(cfg?.minimum_gas_price ?? ''); const m = s.split(',').map((x) => x.trim()).find((x) => x.endsWith(denom) && /^[\d.]+/.test(x));
  return m ? parseFloat(m) : 0;
}
interface Ctx { accountNumber: string; sequence: string; chainId: string; gas: number; price: Record<FeeTierId, number>; denom: string; spec: Spec }

export const cosmosFamily: SendFamily = {
  kinds: ['cosmos'], memo: 'memo', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const spec = COSMOS_SPECS[chain.id]; const isToken = p.asset.kind === 'token';
    if (!spec) throw new SendError('network', `${chain.name} is not configured for sending yet`);
    const coin = env.core.CoinType[chain.ct];
    if (!env.core.AnyAddress.isValid(p.to, coin)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const denom = isToken ? p.asset.contract! : spec.denom;
    const [acc, nat, tok, node, cfg] = await Promise.all([
      get(env, chain, `/cosmos/auth/v1beta1/accounts/${p.from}`).catch((e) => (e?.status === 404 || e?.status === 400 || e?.status === 500 ? null : Promise.reject(e))),
      get(env, chain, `/cosmos/bank/v1beta1/balances/${p.from}/by_denom?denom=${encodeURIComponent(spec.denom)}`),
      isToken ? get(env, chain, `/cosmos/bank/v1beta1/balances/${p.from}/by_denom?denom=${encodeURIComponent(denom)}`) : Promise.resolve(null),
      get(env, chain, '/cosmos/base/tendermint/v1beta1/node_info'),
      get(env, chain, '/cosmos/base/node/v1beta1/config').catch(() => ({})),
    ]);
    const nativeBalance = BigInt(nat?.balance?.amount ?? 0); const assetBalance = isToken ? BigInt(tok?.balance?.amount ?? 0) : nativeBalance;
    const issues = [];
    const accountNumber = findNum(acc?.account, 'account_number'); const sequence = findNum(acc?.account, 'sequence') ?? '0';
    if (accountNumber == null) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
    const base = Math.max(spec.gasPrice, nodeMinPrice(cfg, spec.denom));
    const mult: Record<FeeTierId, number> = { slow: 1, average: 1.5, fast: 2.5 };
    const price = { slow: base * mult.slow, average: base * mult.average, fast: base * mult.fast };
    const feeOf = (id: FeeTierId) => (spec.thor ? THOR_NATIVE_FEE : BigInt(Math.ceil(price[id] * spec.gas)));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: feeOf(id), max: isToken ? assetBalance : sub0(nativeBalance, feeOf(id)), detail: spec.thor ? 'protocol fee' : `${price[id]} ${spec.denom}/gas` }));
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance, fee: tiers[1].fee }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: nativeBalance.toString(), assetBalance: assetBalance.toString(), issues,
      ctx: { accountNumber: accountNumber ?? '0', sequence, chainId: node?.default_node_info?.network ?? '', gas: spec.gas, price, denom, spec } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!;
    if (!c.chainId) throw new SendError('network', 'Could not read the chain id from the node');
    const amount = p.isMax ? t.max : p.amount; const coin = env.core.CoinType[p.chain.ct];
    const amounts = [{ denom: c.denom, amount: amount.toString() }];
    const message: any = c.spec.thor
      ? { thorchainSendMessage: { fromAddress: env.core.AnyAddress.createWithString(p.from, coin).data(), toAddress: env.core.AnyAddress.createWithString(p.to, coin).data(), amounts } }
      : { sendCoinsMessage: { fromAddress: p.from, toAddress: p.to, amounts } };
    const fee = c.spec.thor ? { gas: c.gas, amounts: [] } : { gas: c.gas, amounts: [{ denom: c.spec.denom, amount: t.fee.toString() }] };
    const input = TW.Cosmos.Proto.SigningInput.create({
      signingMode: TW.Cosmos.Proto.SigningMode.Protobuf, accountNumber: c.accountNumber, chainId: c.chainId, sequence: c.sequence, memo: p.memo ?? '',
      mode: TW.Cosmos.Proto.BroadcastMode.SYNC, privateKey: key, messages: [message], fee,
    } as any);
    const out = TW.Cosmos.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Cosmos.Proto.SigningInput.encode(input).finish(), coin));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.serialized, meta: { sequence: c.sequence } };
  },
  async broadcast(env, chain, tx) {
    const r = await firstOf(eps(chain), (u) => jpost(env.fetch, u + '/cosmos/tx/v1beta1/txs', tx.raw));
    const t = r?.tx_response; if (!t) throw new Error('Unexpected broadcast response');
    if (t.code) throw new Error(t.raw_log || `Rejected (code ${t.code})`);
    return t.txhash;
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await get(env, chain, `/cosmos/tx/v1beta1/txs/${hash}`); const t = r?.tx_response; if (!t) return { state: 'unknown' };
      return t.code ? { state: 'failed', block: String(t.height), error: t.raw_log } : { state: 'confirmed', block: String(t.height), timestamp: t.timestamp ? Math.floor(Date.parse(t.timestamp) / 1000) : undefined };
    } catch (e: any) { return e?.status === 404 ? { state: 'pending' } : { state: 'unknown' }; }
  },
};
