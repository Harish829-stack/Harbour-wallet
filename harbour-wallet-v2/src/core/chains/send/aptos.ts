// Aptos (fullnode REST). APT transfers via 0x1::aptos_account::transfer (creates the recipient account). Sequence number, gas price tiers, chain id from the node.
// Tokens: legacy coins (`0x1::aptos_account::transfer_coins<T>`) and fungible assets (primary-store transfer by metadata address).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { isMoveCoinType } from '../adapters/tokens';
import { firstOf, fundsIssues, issue, jget, jpost, sub0, trimUrl } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const MAX_GAS = 4000n;
interface Ctx { sequence: string; price: Record<FeeTierId, bigint>; chainId: number }

/** The wallet-core payload for native APT, a legacy coin type or a fungible-asset metadata address. */
export function aptosPayload(p: { to: string; asset: { kind: string; contract?: string } }, amount: bigint) {
  if (p.asset.kind !== 'token') return { transfer: { to: p.to, amount: amount.toString() } };
  const a = p.asset.contract ?? '';
  if (!isMoveCoinType(a)) return { fungibleAssetTransfer: { metadataAddress: a, to: p.to, amount: amount.toString() } };
  const [accountAddress, module, name] = a.split('::');
  return { tokenTransferCoins: { to: p.to, amount: amount.toString(), function: { accountAddress, module, name } } };
}
export const aptosFamily: SendFamily = {
  kinds: ['aptos'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.aptos)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acct, bal, gp, info, dest] = await Promise.all([
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/accounts/${p.from}`)).catch((e) => { if (e?.status === 404) return null; throw e; }),
      firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/view`, { function: '0x1::coin::balance', type_arguments: ['0x1::aptos_coin::AptosCoin'], arguments: [p.from] })).catch(() => ['0']),
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/estimate_gas_price`)).catch(() => ({ gas_estimate: 100 })),
      firstOf(eps(chain), (u) => jget(env.fetch, u)),
      firstOf(eps(chain), (u) => jget(env.fetch, `${u}/accounts/${p.to}`)).then(() => true).catch((e) => (e?.status === 404 ? false : true)),
    ]);
    const balance = BigInt(bal?.[0] ?? 0); const base = BigInt(gp.gas_estimate ?? 100);
    const isToken = p.asset.kind === 'token'; let assetBalance = balance;
    if (isToken) {
      const a = p.asset.contract ?? '';
      const tb = await (isMoveCoinType(a)
        ? firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/view`, { function: '0x1::coin::balance', type_arguments: [a], arguments: [p.from] }))
        : firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/view`, { function: '0x1::primary_fungible_store::balance', type_arguments: ['0x1::fungible_asset::Metadata'], arguments: [p.from, a] })));
      assetBalance = BigInt(tb?.[0] ?? 0);
    }
    const price = { slow: BigInt(gp.deprioritized_gas_estimate ?? base), average: base, fast: BigInt(gp.prioritized_gas_estimate ?? base * 2n) };
    const units = isToken ? (dest ? 900n : 1500n) : dest ? 600n : 1100n; const issues = [];
    if (!acct) issues.push(issue('insufficient-funds', 'This Aptos account does not exist yet (it needs to receive APT first).', true));
    if (!dest) issues.push(issue('info', 'The recipient account does not exist yet and will be created by this transfer (slightly higher fee).', false));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: units * price[id], feeMax: MAX_GAS * price[id], max: isToken ? assetBalance : sub0(balance, MAX_GAS * price[id]), detail: `${price[id]} octas/gas` }));
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance: balance, fee: tiers[1].feeMax! }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: assetBalance.toString(), issues, recipientInactive: !dest, ctx: { sequence: acct?.sequence_number ?? '0', price, chainId: Number(info.chain_id) } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount; const now = Math.floor((env.now ?? Date.now)() / 1000);
    const input = TW.Aptos.Proto.SigningInput.create({ sender: p.from, sequenceNumber: c.sequence, maxGasAmount: MAX_GAS.toString(), gasUnitPrice: c.price[tier].toString(), expirationTimestampSecs: now + 600, chainId: c.chainId, privateKey: key, ...aptosPayload(p, amount) } as any);
    const out = TW.Aptos.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Aptos.Proto.SigningInput.encode(input).finish(), env.core.CoinType.aptos));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.json };
  },
  async broadcast(env, chain, tx) {
    const j = await firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/transactions`, tx.raw));
    return j.hash;
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await firstOf(eps(chain), (u) => jget(env.fetch, `${u}/transactions/by_hash/${hash}`));
      if (r.type === 'pending_transaction') return { state: 'pending' };
      return { state: r.success ? 'confirmed' : 'failed', block: String(r.version), fee: r.gas_used && r.gas_unit_price ? String(BigInt(r.gas_used) * BigInt(r.gas_unit_price)) : undefined, error: r.success ? undefined : r.vm_status };
    } catch (e: any) { return e?.status === 404 ? { state: 'unknown' } : { state: 'unknown' }; }
  },
};
