// Cardano (Shelley base addresses) over Koios (api.koios.rest: public, keyless, PostgREST-style). Balance, UTXO send and the
// transaction primitives the staking module reuses. Coin selection, min-ADA, fees and CBOR are wallet-core's Cardano signer.
// Native tokens held in UTXOs are carried back to the change output by wallet-core; Harbour does not send Cardano tokens yet.
import { TW } from './send/proto';
import type { ChainInfo } from './types';
import type { Fetcher } from './adapters/types';
import { KOIOS, cardanoAddressInfo, cardanoTipSlot, cardanoSubmit, type CardanoUtxo } from './adapters/cardano';
export { KOIOS, cardanoAddressInfo, cardanoTipSlot, cardanoSubmit, cardanoBalance, type CardanoUtxo } from './adapters/cardano';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './send/types';
import { SendError } from './send/types';
import { MSG, issue } from './send/util';
const TTL_SLOTS = 7200; // 2 h
const hexToBytes = (h: string) => Uint8Array.from((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const base = (c?: ChainInfo) => ((c?.endpoints?.[0]) ?? KOIOS).replace(/\/$/, '');
async function kpost(f: Fetcher, url: string, body: unknown): Promise<any> {
  const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

/** wallet-core TxInput list (tokens included so the signer balances them into change). */
export function toTxInputs(address: string, utxos: CardanoUtxo[]): any[] {
  return utxos.map((u) => ({
    outPoint: { txHash: hexToBytes(u.txHash), outputIndex: u.index }, address, amount: u.lovelace.toString(),
    tokenAmount: u.assets.map((t) => ({ policyId: t.policyId, assetNameHex: t.assetNameHex, amount: hexToBytes(t.quantity.toString(16).padStart(2, '0').replace(/^(.(..)*)$/, '0$1')) })),
  }));
}
export function cardanoPlan(core: any, input: any): any {
  return TW.Cardano.Proto.TransactionPlan.decode(core.AnySigner.plan(TW.Cardano.Proto.SigningInput.encode(TW.Cardano.Proto.SigningInput.create(input)).finish(), core.CoinType.cardano));
}
export function cardanoSign(core: any, input: any): { cbor: Uint8Array; txId: string } {
  const plan = cardanoPlan(core, input);
  if (plan.error) throw new SendError('insufficient-funds', 'Not enough ADA to cover this transaction and its fee');
  const out = TW.Cardano.Proto.SigningOutput.decode(core.AnySigner.sign(TW.Cardano.Proto.SigningInput.encode(TW.Cardano.Proto.SigningInput.create({ ...input, plan })).finish(), core.CoinType.cardano));
  if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the Cardano transaction');
  return { cbor: out.encoded, txId: bytesToHex(out.txId) };
}

interface Ctx { utxos: CardanoUtxo[]; slot: number }
export const cardanoFamily: SendFamily = {
  kinds: ['cardano'], memo: 'none', tokens: false,
  async quote(env: SendEnv, p): Promise<SendQuote> {
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.cardano)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [info, slot] = await Promise.all([cardanoAddressInfo(env.fetch, p.from, p.chain), cardanoTipSlot(env.fetch, p.chain)]);
    const mk = (amount: bigint, max: boolean) => cardanoPlan(env.core, { utxos: toTxInputs(p.from, info.utxos), transferMessage: { toAddress: p.to, changeAddress: p.from, amount: amount.toString(), useMaxAmount: max }, ttl: slot + TTL_SLOTS });
    const maxPlan = info.utxos.length ? mk(0n, true) : null;
    const sendPlan = info.utxos.length && p.amount > 0n ? mk(p.amount, false) : null;
    const fee = BigInt((sendPlan && !sendPlan.error ? sendPlan.fee : maxPlan?.fee ?? 170000).toString());
    const max = maxPlan && !maxPlan.error ? BigInt(maxPlan.amount.toString()) : 0n;
    const issues = [];
    if (p.amount > 0n && p.amount < 1_000_000n) issues.push(issue('below-minimum', 'Cardano outputs must carry at least about 1 ADA.', true));
    else if (p.amount > 0n && (!sendPlan || sendPlan.error)) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee, max }));
    return { tiers, defaultTier: 'average', feeSymbol: p.chain.symbol, feeDecimals: p.chain.decimals, nativeBalance: info.balance.toString(), assetBalance: info.balance.toString(), issues, ctx: { utxos: info.utxos, slot } as Ctx };
  },
  async build(env, p, key, q): Promise<BuiltTx> {
    const c: Ctx = q.ctx;
    const { cbor, txId } = cardanoSign(env.core, { utxos: toTxInputs(p.from, c.utxos), privateKey: [key], transferMessage: { toAddress: p.to, changeAddress: p.from, amount: p.amount.toString(), useMaxAmount: !!p.isMax }, ttl: c.slot + TTL_SLOTS });
    return { raw: bytesToHex(cbor), hash: txId };
  },
  async broadcast(env, chain, tx) { return (await cardanoSubmit(env.fetch, hexToBytes(tx.raw), chain)) || tx.hash || ''; },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const rows = await kpost(env.fetch, `${base(chain)}/tx_status`, { _tx_hashes: [hash] });
      const n = Number(rows?.[0]?.num_confirmations);
      return Number.isFinite(n) && n > 0 ? { state: 'confirmed', confirmations: n } : { state: 'pending' };
    } catch { return { state: 'unknown' }; }
  },
};
