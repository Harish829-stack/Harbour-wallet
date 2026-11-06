// NEAR (JSON-RPC). NEAR transfers signed by the account's full-access key (implicit accounts: the key is the account id).
// Fee: gas price x ~4.5e11 gas (a transfer action). Storage stake of the account stays locked (excluded from "Max").
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { b64, firstOf, fundsIssues, hexToBytes, issue, rpc, sub0, trimUrl } from './util';

const TRANSFER_GAS = 450_000_000_000n; const STORAGE_PER_BYTE = 10n ** 19n;
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: any) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
const leU128 = (n: bigint): Uint8Array => { const o = new Uint8Array(16); for (let i = 0; i < 16; i++) { o[i] = Number(n & 0xffn); n >>= 8n; } return o; };
const viewAccount = (env: SendEnv, c: ChainInfo, id: string) => call(env, c, 'query', { request_type: 'view_account', finality: 'final', account_id: id }).catch((e) => { if (/does not exist|UNKNOWN_ACCOUNT/i.test(String(e?.message))) return null; throw e; });
interface Ctx { nonce: bigint; blockHash: string; publicKey: string; pubBytes: Uint8Array }

export const nearFamily: SendFamily = {
  kinds: ['near'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.near)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acc, dest, gp] = await Promise.all([viewAccount(env, chain, p.from), viewAccount(env, chain, p.to), call(env, chain, 'gas_price', [null])]);
    const balance = BigInt(acc?.amount ?? 0); const reserve = BigInt(acc?.storage_usage ?? 182) * STORAGE_PER_BYTE;
    const fee = BigInt(gp?.gas_price ?? 100_000_000) * TRANSFER_GAS; const issues = [];
    if (!dest && !/^[0-9a-f]{64}$/.test(p.to)) issues.push(issue('inactive-account', 'This NEAR account does not exist. Check the name, or use the 64-character implicit address.', true));
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, reserve + fee) }));
    issues.push(...fundsIssues({ amount: p.amount, isToken: false, assetBalance: sub0(balance, reserve), nativeBalance: sub0(balance, reserve), fee }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, reserve: reserve.toString(), recipientInactive: !dest, ctx: {} as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const { PrivateKey, Base58 } = env.core; const pk = PrivateKey.createWithData(key); const pub = pk.getPublicKeyEd25519(); const pubBytes: Uint8Array = pub.data(); pk.delete(); pub.delete();
    const publicKey = 'ed25519:' + Base58.encodeNoCheck(pubBytes);
    // The access-key nonce / block hash are fetched at signing time (they must be fresh), so build() is the one place NEAR needs the network.
    const ak = await call(env, p.chain, 'query', { request_type: 'view_access_key', finality: 'final', account_id: p.from, public_key: publicKey });
    const input = TW.NEAR.Proto.SigningInput.create({ signerId: p.from, nonce: (BigInt(ak.nonce) + 1n).toString(), receiverId: p.to, blockHash: Base58.decodeNoCheck(ak.block_hash), actions: [{ transfer: { deposit: leU128(amount) } }], privateKey: key, publicKey: pubBytes } as any);
    const out = TW.NEAR.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.NEAR.Proto.SigningInput.encode(input).finish(), env.core.CoinType.near));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    void hexToBytes;
    return { raw: b64(out.signedTransaction), hash: Base58.encodeNoCheck(out.hash) };
  },
  async broadcast(env, chain, tx) {
    const r = await call(env, chain, 'send_tx', { signed_tx_base64: tx.raw, wait_until: 'INCLUDED' });
    return r?.transaction?.hash ?? tx.hash ?? '';
  },
  async status(env, chain, hash, from): Promise<TxStatus> {
    if (!from) return { state: 'unknown' };
    try {
      const r = await call(env, chain, 'tx', [hash, from]);
      const st = r?.status; if (st?.SuccessValue !== undefined) return { state: 'confirmed', block: r?.transaction_outcome?.block_hash };
      if (st?.Failure) return { state: 'failed', error: JSON.stringify(st.Failure) };
      return { state: 'pending' };
    } catch (e: any) { return /doesn't exist|UNKNOWN_TRANSACTION/i.test(String(e?.message)) ? { state: 'pending' } : { state: 'unknown' }; }
  },
};
