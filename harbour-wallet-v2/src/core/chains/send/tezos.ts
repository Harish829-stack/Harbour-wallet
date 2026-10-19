// Tezos (public node RPC). tz1 transfers with automatic reveal of the public key on the first outgoing operation, counter / branch from head.
// Fees are fixed conservative values (gas_limit/fee overpay slightly; the node refunds nothing, the extra is a few hundred mutez) because
// simulate_operation needs a signature + chain id round trip: documented estimate. New destination accounts burn 0.06425 XTZ (257 bytes storage).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bytesToHex, firstOf, fundsIssues, jget, jpost, sub0, trimUrl } from './util';

const TX_FEE = 1000n, REVEAL_FEE = 1000n, TX_GAS = 2000, REVEAL_GAS = 1000, NEW_ACCOUNT_BURN = 64250n, NEW_ACCOUNT_STORAGE = 257;
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const get = (env: SendEnv, c: ChainInfo, path: string) => firstOf(eps(c), (u) => jget(env.fetch, u + path));
const maybe = (env: SendEnv, c: ChainInfo, path: string) => get(env, c, path).catch((e) => { if (e?.status === 404 || e?.status === 500) return null; throw e; });
interface Ctx { branch: string; counter: bigint; revealed: boolean; destNew: boolean }

export const tezosFamily: SendFamily = {
  kinds: ['tezos'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.tezos)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const ctxp = '/chains/main/blocks/head/context/contracts/';
    const [branch, bal, counter, mk, destBal] = await Promise.all([get(env, chain, '/chains/main/blocks/head/hash'), get(env, chain, `${ctxp}${p.from}/balance`), get(env, chain, `${ctxp}${p.from}/counter`), maybe(env, chain, `${ctxp}${p.from}/manager_key`), maybe(env, chain, `${ctxp}${p.to}/balance`)]);
    const balance = BigInt(bal); const revealed = !!mk; const destNew = destBal == null;
    const fee = TX_FEE + (revealed ? 0n : REVEAL_FEE) + (destNew ? NEW_ACCOUNT_BURN : 0n);
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, fee) }));
    const issues = fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee });
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, recipientInactive: destNew, ctx: { branch, counter: BigInt(counter), revealed, destNew } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const { PrivateKey } = env.core; const pk = PrivateKey.createWithData(key); const pub = pk.getPublicKeyEd25519(); const pubBytes: Uint8Array = pub.data(); pk.delete(); pub.delete();
    const K = TW.Tezos.Proto.Operation.OperationKind; const ops: any[] = []; let counter = c.counter;
    if (!c.revealed) { counter += 1n; ops.push({ source: p.from, fee: REVEAL_FEE.toString(), counter: counter.toString(), gasLimit: REVEAL_GAS, storageLimit: 0, kind: K.REVEAL, revealOperationData: { publicKey: pubBytes } }); }
    counter += 1n;
    ops.push({ source: p.from, fee: TX_FEE.toString(), counter: counter.toString(), gasLimit: TX_GAS, storageLimit: c.destNew ? NEW_ACCOUNT_STORAGE : 0, kind: K.TRANSACTION, transactionOperationData: { destination: p.to, amount: amount.toString() } });
    const input = TW.Tezos.Proto.SigningInput.create({ operationList: { branch: c.branch, operations: ops }, privateKey: key } as any);
    const out = TW.Tezos.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Tezos.Proto.SigningInput.encode(input).finish(), env.core.CoinType.tezos));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: bytesToHex(out.encoded) };
  },
  async broadcast(env, chain, tx) { const h = await firstOf(eps(chain), (u) => jpost(env.fetch, u + '/injection/operation', JSON.stringify(tx.raw))); return String(h); },
  async status(env, _chain, hash): Promise<TxStatus> {
    // TzKT public indexer (api.tzkt.io): the node RPC has no by-hash lookup.
    try {
      const ops: any[] = await jget(env.fetch, `https://api.tzkt.io/v1/operations/${hash}`);
      if (!Array.isArray(ops) || !ops.length) return { state: 'pending' };
      const tx = ops.find((o) => o.type === 'transaction') ?? ops[0];
      return { state: tx.status === 'applied' ? 'confirmed' : 'failed', block: String(tx.level), fee: String((tx.bakerFee ?? 0) + (tx.storageFee ?? 0)), timestamp: tx.timestamp ? Math.floor(Date.parse(tx.timestamp) / 1000) : undefined };
    } catch (e: any) { return e?.status === 404 ? { state: 'pending' } : { state: 'unknown' }; }
  },
};
