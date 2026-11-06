// VeChain (Thor REST). VET and VIP-180 token transfers (VTHO included). The network fee is paid in VTHO: gas x 1e13 wei x (1 + coef/255).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { bigToBytes, bytesToHex, firstOf, hexToBytes, issue, jget, jpost, randomBytes, sub0, trimUrl } from './util';
import { evmTransferData } from './evm';
import { MSG } from './util';

export const VTHO = '0x0000000000000000000000000000456e65726779';
const BASE_GAS_PRICE = 10n ** 13n; const COEF: Record<FeeTierId, number> = { slow: 0, average: 85, fast: 255 };
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const get = (env: SendEnv, c: ChainInfo, path: string) => firstOf(eps(c), (u) => jget(env.fetch, u + path));
const hexBig = (h: string) => BigInt(h || '0x0');
interface Ctx { chainTag: number; blockRef: string; gas: bigint }

export const vechainFamily: SendFamily = {
  kinds: ['vechain'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const isToken = p.asset.kind === 'token';
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.veChain)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acct, best, genesis] = await Promise.all([get(env, chain, `/accounts/${p.from}`), get(env, chain, '/blocks/best'), get(env, chain, '/blocks/0')]);
    const vet = hexBig(acct.balance), vtho = hexBig(acct.energy);
    let assetBalance = vet;
    if (isToken) {
      const data = '0x70a08231' + p.from.replace(/^0x/, '').toLowerCase().padStart(64, '0');
      const r = await firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/accounts/*`, { clauses: [{ to: p.asset.contract, value: '0x0', data }] }));
      assetBalance = hexBig(r?.[0]?.data ?? '0x0');
    }
    const gas = isToken ? 65_000n : 21_000n;
    const feeFor = (id: FeeTierId) => (gas * BASE_GAS_PRICE * BigInt(255 + COEF[id])) / 255n;
    const feeIsAsset = isToken && p.asset.contract?.toLowerCase() === VTHO;
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee: feeFor(id), max: isToken ? (feeIsAsset ? sub0(assetBalance, feeFor(id)) : assetBalance) : vet, detail: `${COEF[id]}/255 priority` }));
    const issues = [];
    if (p.amount > 0n && assetBalance < p.amount) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
    else if (vtho < tiers[1].fee + (feeIsAsset ? p.amount : 0n)) issues.push(issue('insufficient-fee', 'You need VTHO to pay the network fee on VeChain.', true));
    return { tiers, defaultTier: 'average', feeSymbol: 'VTHO', feeDecimals: 18, nativeBalance: vtho.toString(), assetBalance: assetBalance.toString(), issues,
      ctx: { chainTag: parseInt(genesis.id.slice(-2), 16), blockRef: best.id, gas } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount;
    const clause: any = p.asset.kind === 'token' ? { to: p.asset.contract, value: new Uint8Array(0), data: hexToBytes(evmTransferData(p.to, amount)) } : { to: p.to, value: bigToBytes(amount), data: new Uint8Array(0) };
    const nonce = BigInt('0x' + bytesToHex((env.random ?? randomBytes)(8)));
    const input = TW.VeChain.Proto.SigningInput.create({ chainTag: c.chainTag, blockRef: BigInt('0x' + c.blockRef.slice(2, 18)).toString(), expiration: 720, clauses: [clause], gasPriceCoef: COEF[tier], gas: c.gas.toString(), nonce: nonce.toString(), privateKey: key } as any);
    const out = TW.VeChain.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.VeChain.Proto.SigningInput.encode(input).finish(), env.core.CoinType.veChain));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: '0x' + bytesToHex(out.encoded) };
  },
  async broadcast(env, chain, tx) { const j = await firstOf(eps(chain), (u) => jpost(env.fetch, `${u}/transactions`, { raw: tx.raw })); return j.id; },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await get(env, chain, `/transactions/${hash}/receipt`); if (!r) return { state: 'pending' };
      return { state: r.reverted ? 'failed' : 'confirmed', block: String(r.meta?.blockNumber), fee: r.paid ? hexBig(r.paid).toString() : undefined };
    } catch { return { state: 'unknown' }; }
  },
};
