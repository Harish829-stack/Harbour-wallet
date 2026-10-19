// Polkadot / Kusama (Substrate HTTP JSON-RPC). balances.transfer with a mortal era anchored at the finalized head, nonce from
// system_accountNextIndex, fee from payment_queryInfo on a dummy-signed extrinsic of identical size. Balances come from the shared
// read-only adapter (core/chains/adapters). Existential deposit: Max leaves it in the account; sending below it to an empty account is blocked.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bigToBytes, bytesToHex, firstOf, fundsIssues, hexToBytes, issue, rpc, sub0, trimUrl, formatUnits } from './util';
import { fetchNativeBalance } from '../adapters';

const ED: Record<string, bigint> = { polkadot: 10_000_000_000n, kusama: 333_333_333n }; // 1 DOT / 0.000333333333 KSM [certain: current runtime constants]
const PREFIX: Record<string, number> = { polkadot: 0, kusama: 2 };
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[] = []) => firstOf(eps(c), (u) => rpc(env.fetch, u, m, params));
interface Ctx { blockHash: string; genesis: string; blockNumber: number; nonce: number; specVersion: number; txVersion: number }

function signInput(env: SendEnv, p: { chain: ChainInfo; to: string }, c: Ctx, value: bigint, key: Uint8Array) {
  return TW.Polkadot.Proto.SigningInput.create({ genesisHash: hexToBytes(c.genesis), blockHash: hexToBytes(c.blockHash), nonce: c.nonce, specVersion: c.specVersion, transactionVersion: c.txVersion, era: { blockNumber: c.blockNumber, period: 64 },
    network: PREFIX[p.chain.id] ?? 0, multiAddress: true, privateKey: key, balanceCall: { transfer: { toAddress: p.to, value: bigToBytes(value) } } } as any);
}
const signHex = (env: SendEnv, coin: any, input: any): string => {
  const out = TW.Polkadot.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Polkadot.Proto.SigningInput.encode(input).finish(), coin));
  if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction'); return '0x' + bytesToHex(out.encoded);
};

export const polkadotFamily: SendFamily = {
  kinds: ['substrate'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const coin = env.core.CoinType[chain.ct];
    if (!env.core.AnyAddress.isValid(p.to, coin)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [fin, genesis, rv, nonce, bal, destBal] = await Promise.all([call(env, chain, 'chain_getFinalizedHead'), call(env, chain, 'chain_getBlockHash', [0]), call(env, chain, 'state_getRuntimeVersion'), call(env, chain, 'system_accountNextIndex', [p.from]),
      fetchNativeBalance(chain, p.from, env.fetch), fetchNativeBalance(chain, p.to, env.fetch)]);
    if (!bal.ok) throw new SendError('network', 'Could not read your balance: ' + (bal.error ?? 'unavailable'));
    const header = await call(env, chain, 'chain_getHeader', [fin]);
    const ctx: Ctx = { blockHash: fin, genesis, blockNumber: Number(BigInt(header.number)), nonce: Number(nonce), specVersion: rv.specVersion, txVersion: rv.transactionVersion };
    const ed = ED[chain.id] ?? 0n; const balance = BigInt(bal.raw); const issues = [];
    // Fee: ask the node for the partial fee of a dummy-signed extrinsic (same length as the real one).
    let fee = 0n;
    try {
      const dummy = env.core.PrivateKey.create(); const amt = p.amount > 0n ? p.amount : ed;
      const hex = signHex(env, coin, signInput(env, p, ctx, amt, dummy.data())); dummy.delete();
      const info = await call(env, chain, 'payment_queryInfo', [hex]); fee = BigInt(info.partialFee);
    } catch { fee = chain.id === 'kusama' ? 20_000_000_000n : 160_000_000n; issues.push(issue('estimate-failed', 'Could not ask the node for the exact fee; showing a typical value.', false)); }
    const destEmpty = destBal.ok && BigInt(destBal.raw) === 0n;
    if (destEmpty && p.amount > 0n && p.amount < ed) issues.push(issue('inactive-account', `This account is inactive: send at least ${formatUnits(ed, chain.decimals)} ${chain.symbol} to activate it.`, true));
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee, max: sub0(balance, fee + ed) }));
    issues.push(...fundsIssues({ amount: p.amount, isToken: false, assetBalance: sub0(balance, ed), nativeBalance: sub0(balance, ed), fee }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, reserve: ed.toString(), recipientInactive: destEmpty, ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    return { raw: signHex(env, env.core.CoinType[p.chain.ct], signInput(env, p, c, amount, key)) };
  },
  async broadcast(env, chain, tx) { return String(await call(env, chain, 'author_submitExtrinsic', [tx.raw])); },
};
