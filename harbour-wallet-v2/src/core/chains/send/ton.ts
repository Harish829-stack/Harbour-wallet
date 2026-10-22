// TON (toncenter v2 HTTP API). Wallet v4r2 transfers with optional text comment; non-bounceable when the destination is not deployed.
// Fee: toncenter's estimateFee needs a signed external message, so a fixed 0.01 TON ceiling is shown (typical real fee ~0.005-0.007 TON; unused part stays in the wallet).
// Jettons: the sender's jetton-wallet contract comes from the toncenter v3 index; the transfer attaches 0.05 TON (unused part is returned to the sender as excess).
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { tonJettonWallet } from '../adapters/tokens';
import { bigToBytes, firstOf, fundsIssues, issue, jget, jpost, sub0, trimUrl, utf8 } from './util';

const FEE_CEILING = 10_000_000n; // 0.01 TON
const JETTON_ATTACH = 50_000_000n; // 0.05 TON attached to a jetton transfer
const JETTON_FORWARD = 1n;
const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const api = async (env: SendEnv, c: ChainInfo, path: string) => { const j = await firstOf(eps(c), (u) => jget(env.fetch, u + path)); if (j?.ok === false) throw new Error(j.error || 'toncenter error'); return j.result; };
interface Ctx { seqno: number; bounceable: boolean; jettonWallet?: string }

export const tonFamily: SendFamily = {
  kinds: ['ton'], memo: 'comment', tokens: true,
  validateMemo: (m) => (utf8(m).length <= 120 ? null : 'Comment is too long (max 120 bytes)'),
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p;
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.ton)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [w, dest] = await Promise.all([api(env, chain, `/getWalletInformation?address=${encodeURIComponent(p.from)}`), api(env, chain, `/getAddressInformation?address=${encodeURIComponent(p.to)}`)]);
    const balance = BigInt(w.balance ?? 0); const seqno = Number(w.seqno ?? 0); const destActive = dest?.state === 'active';
    if (p.asset.kind === 'token') {
      const j = await tonJettonWallet(chain, p.from, p.asset.contract ?? '', env.fetch).catch(() => { throw new SendError('network', 'Could not look up your jetton wallet'); });
      const issues = fundsIssues({ amount: p.amount, isToken: true, assetBalance: j.balance, nativeBalance: balance, fee: JETTON_ATTACH });
      if (!j.wallet) issues.push(issue('insufficient-funds', 'You do not hold this jetton.', true));
      if (p.memo) issues.push(issue('invalid-memo', 'Comments are not supported on jetton transfers.', true));
      const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: FEE_CEILING, feeMax: JETTON_ATTACH, max: j.balance }));
      return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: j.balance.toString(), issues, recipientInactive: !destActive, ctx: { seqno, bounceable: true, jettonWallet: j.wallet ?? undefined } as Ctx };
    }
    const issues = [];
    const bounceable = destActive && !/^UQ/.test(p.to);
    if (!destActive) issues.push(issue('info', 'The recipient wallet is not deployed yet. The transfer is sent non-bounceable so the funds are not returned.', false));
    const tiers = (['slow', 'average', 'fast'] as const).map((id) => ({ id, fee: FEE_CEILING, max: sub0(balance, FEE_CEILING) }));
    issues.push(...fundsIssues({ amount: p.amount, isToken: false, assetBalance: balance, nativeBalance: balance, fee: FEE_CEILING }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: balance.toString(), assetBalance: balance.toString(), issues, recipientInactive: !destActive, ctx: { seqno, bounceable } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!; const amount = p.isMax ? t.max : p.amount; const now = Math.floor((env.now ?? Date.now)() / 1000);
    if (p.asset.kind === 'token') {
      if (!c.jettonWallet) throw new SendError('estimate-failed', 'You do not hold this jetton');
      const jt = TW.TheOpenNetwork.Proto.SigningInput.create({ privateKey: key, sequenceNumber: c.seqno, expireAt: now + 600, walletVersion: TW.TheOpenNetwork.Proto.WalletVersion.WALLET_V4_R2,
        messages: [{ dest: c.jettonWallet, amount: bigToBytes(JETTON_ATTACH), mode: 3, bounceable: true, jettonTransfer: { queryId: 0, jettonAmount: bigToBytes(p.isMax ? BigInt(q.assetBalance) : p.amount), toOwner: p.to, responseAddress: p.from, forwardAmount: bigToBytes(JETTON_FORWARD) } }] } as any);
      const jo = TW.TheOpenNetwork.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.TheOpenNetwork.Proto.SigningInput.encode(jt).finish(), env.core.CoinType.ton));
      if (jo.error) throw new SendError('estimate-failed', jo.errorMessage || 'Could not build the transaction');
      return { raw: jo.encoded };
    }
    const input = TW.TheOpenNetwork.Proto.SigningInput.create({ privateKey: key, sequenceNumber: c.seqno, expireAt: now + 600, walletVersion: TW.TheOpenNetwork.Proto.WalletVersion.WALLET_V4_R2,
      messages: [{ dest: p.to, amount: bigToBytes(amount), mode: 3, bounceable: c.bounceable, ...(p.memo ? { comment: p.memo } : {}) }] } as any);
    const out = TW.TheOpenNetwork.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.TheOpenNetwork.Proto.SigningInput.encode(input).finish(), env.core.CoinType.ton));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.encoded };
  },
  async broadcast(env, chain, tx) {
    const j = await firstOf(eps(chain), (u) => jpost(env.fetch, u + '/sendBocReturnHash', { boc: tx.raw }));
    if (j?.ok === false) throw new Error(j.error || 'Rejected');
    return j?.result?.hash ?? '';
  },
  async status(env, chain, hash): Promise<TxStatus> {
    try {
      const r = await api(env, chain, `/getTransactions?address=&hash=${encodeURIComponent(hash)}&limit=1`);
      return Array.isArray(r) && r.length ? { state: 'confirmed', timestamp: r[0].utime, fee: r[0].fee } : { state: 'pending' };
    } catch { return { state: 'unknown' }; }
  },
};
