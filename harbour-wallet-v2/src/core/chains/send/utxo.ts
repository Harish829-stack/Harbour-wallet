// Bitcoin (Esplora-compatible API: mempool.space / blockstream.info). UTXOs + fee rates via REST, coin selection / change /
// dust handling / segwit signing by wallet-core (AnySigner.plan + sign). Change goes back to the sending address.
// TW evidence: send.confirm.bitcoin-dust-error, modal-edit-fee.bitcoin.network-fee.label (sat/vB tiers).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendParams, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, firstOf, hexToBytes, bytesToHex, issue, jget, trimUrl } from './util';

interface Utxo { txid: string; vout: number; value: number }
interface Ctx { utxos: Utxo[]; rates: Record<FeeTierId, number>; lockScript: Uint8Array; plans: Record<FeeTierId, { fee: bigint; max: bigint; error: number }> }
const DUST_PLACEHOLDER = 1000;
const endpoints = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);

export async function fetchRates(env: SendEnv, chain: ChainInfo): Promise<Record<FeeTierId, number>> {
  return firstOf(endpoints(chain), async (u) => {
    try {
      const r = await jget(env.fetch, `${u}/v1/fees/recommended`);
      if (r && Number.isFinite(r.fastestFee)) return { slow: Math.max(1, r.hourFee ?? r.economyFee ?? 1), average: Math.max(1, r.halfHourFee ?? r.hourFee ?? 1), fast: Math.max(1, r.fastestFee) };
    } catch { /* blockstream-style fallback below */ }
    const e = await jget(env.fetch, `${u}/fee-estimates`);
    const pick = (k: string, d: number) => Math.max(1, Math.ceil(Number(e?.[k] ?? d)));
    return { slow: pick('6', 2), average: pick('3', 4), fast: pick('1', 8) };
  });
}
function planFor(env: SendEnv, p: SendParams, utxos: Utxo[], lock: Uint8Array, rate: number, amount: number, max: boolean) {
  const { AnySigner, CoinType, HexCoding } = env.core; const coin = CoinType[p.chain.ct];
  const input = TW.Bitcoin.Proto.SigningInput.create({
    hashType: 1, amount, byteFee: rate, toAddress: p.to, changeAddress: p.from, coinType: coin, useMaxAmount: max,
    utxo: utxos.map((u) => ({ outPoint: { hash: hexToBytes(u.txid).reverse(), index: u.vout, sequence: 0xffffffff }, script: lock, amount: u.value })),
  } as any);
  void HexCoding;
  return { input, plan: TW.Bitcoin.Proto.TransactionPlan.decode(AnySigner.plan(TW.Bitcoin.Proto.SigningInput.encode(input).finish(), coin)) };
}

export const utxoFamily: SendFamily = {
  kinds: ['utxo'], memo: 'none', tokens: false,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const coin = env.core.CoinType[chain.ct];
    if (!env.core.AnyAddress.isValid(p.to, coin)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [utxosRaw, rates] = await Promise.all([firstOf(endpoints(chain), (u) => jget(env.fetch, `${u}/address/${p.from}/utxo`)), fetchRates(env, chain)]);
    const utxos: Utxo[] = (utxosRaw as any[]).map((u) => ({ txid: u.txid, vout: u.vout, value: Number(u.value) }));
    const total = utxos.reduce((s, u) => s + u.value, 0);
    const lock: Uint8Array = env.core.BitcoinScript.lockScriptForAddress(p.from, coin).data();
    const amt = p.amount > 0n ? Number(p.amount) : DUST_PLACEHOLDER;
    const issues = []; const plans = {} as Ctx['plans'];
    for (const id of ['slow', 'average', 'fast'] as FeeTierId[]) {
      let fee = 0n, max = 0n, error = 0;
      if (utxos.length) {
        const sendPlan = planFor(env, p, utxos, lock, rates[id], amt, false).plan;
        const maxPlan = planFor(env, p, utxos, lock, rates[id], total, true).plan;
        error = sendPlan.error as number; fee = BigInt(sendPlan.fee.toString());
        if (error !== 0 && maxPlan.error === 0) fee = BigInt(maxPlan.fee.toString());
        max = maxPlan.error === 0 ? BigInt(maxPlan.amount.toString()) : 0n;
        if (error !== 0 && fee === 0n) fee = BigInt(Math.ceil(rates[id] * 141));
      } else fee = BigInt(Math.ceil(rates[id] * 141));
      plans[id] = { fee, max, error };
    }
    const bal = BigInt(total);
    if (p.amount > 0n && p.amount > bal) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
    else if (p.amount > 0n && plans.average.error !== 0) issues.push(issue(p.amount < 546n ? 'dust' : 'insufficient-funds', p.amount < 546n ? MSG.dust : MSG.insufficientFunds, true));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: plans[id].fee, max: plans[id].max, detail: `${rates[id]} sat/vB` }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: bal.toString(), assetBalance: bal.toString(), issues, ctx: { utxos, rates, lockScript: lock, plans } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const { AnySigner, CoinType } = env.core; const coin = CoinType[p.chain.ct];
    const total = c.utxos.reduce((s, u) => s + u.value, 0);
    const max = !!p.isMax;
    const { input } = planFor(env, p, c.utxos, c.lockScript, c.rates[tier], max ? total : Number(p.amount), max);
    (input as any).privateKey = [key];
    const out = TW.Bitcoin.Proto.SigningOutput.decode(AnySigner.sign(TW.Bitcoin.Proto.SigningInput.encode(input).finish(), coin));
    if (out.error) { throw new SendError(p.amount < 546n ? 'dust' : 'insufficient-funds', p.amount < 546n ? MSG.dust : (out.errorMessage || MSG.insufficientFunds)); }
    return { raw: bytesToHex(out.encoded), hash: out.transactionId, meta: { feeRate: c.rates[tier] } };
  },
  async broadcast(env, chain, tx) {
    return firstOf(endpoints(chain), async (u) => {
      const res = await env.fetch(`${u}/tx`, { method: 'POST', body: tx.raw, headers: { 'content-type': 'text/plain' }, signal: AbortSignal.timeout(15000) });
      const t = (await res.text()).trim();
      if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
      return t || tx.hash || '';
    });
  },
  async status(env, chain, hash): Promise<TxStatus> {
    const st = await firstOf(endpoints(chain), (u) => jget(env.fetch, `${u}/tx/${hash}`).catch((e) => { if (e?.status === 404) return null; throw e; }));
    if (!st) return { state: 'unknown' };
    if (!st.status?.confirmed) return { state: 'pending', fee: st.fee != null ? String(st.fee) : undefined };
    let conf: number | undefined; try { const tip = await firstOf(endpoints(chain), (u) => jget(env.fetch, `${u}/blocks/tip/height`)); conf = Number(tip) - st.status.block_height + 1; } catch { /* optional */ }
    return { state: 'confirmed', block: String(st.status.block_height), confirmations: conf, fee: st.fee != null ? String(st.fee) : undefined, timestamp: st.status.block_time };
  },
};
