// Solana: native SOL + SPL / Token-2022 transfers (creates the recipient's associated token account when it does not exist),
// recent blockhash, compute-budget priority fee (slow/average/fast from getRecentPrioritizationFees). Signing: wallet-core.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendParams, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, firstOf, fundsIssues, issue, rpc, sub0, formatUnits } from './util';
import { solanaRpcUrl } from '../../rpc';

const BASE_FEE = 5000n; // lamports per signature
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const MAX_PRICE = 2_000_000; // micro-lamports per compute unit: hard ceiling so a spike cannot drain the wallet
const urls = (c: ChainInfo) => Array.from(new Set([...(c.endpoints ?? []), (() => { try { return solanaRpcUrl(); } catch { return ''; } })()].filter(Boolean)));
const call = (env: SendEnv, c: ChainInfo, m: string, params: unknown[]) => firstOf(urls(c), (u) => rpc(env.fetch, u, m, params));

interface Ctx { blockhash: string; price: Record<FeeTierId, number>; limit: number; token?: { program: number; senderAta: string; recipientAta: string; createAta: boolean; decimals: number }; rent: bigint; recipientExists: boolean }

export const solanaFamily: SendFamily = {
  kinds: ['solana'], memo: 'memo', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const coin = env.core.CoinType.solana; const isToken = p.asset.kind === 'token';
    if (!env.core.AnyAddress.isValid(p.to, coin)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [bal, bh, fees, toInfo, rent0] = await Promise.all([
      call(env, chain, 'getBalance', [p.from, { commitment: 'confirmed' }]),
      call(env, chain, 'getLatestBlockhash', [{ commitment: 'confirmed' }]),
      call(env, chain, 'getRecentPrioritizationFees', [[]]).catch(() => []),
      call(env, chain, 'getAccountInfo', [p.to, { encoding: 'base64', commitment: 'confirmed' }]).catch(() => ({ value: undefined })),
      call(env, chain, 'getMinimumBalanceForRentExemption', [0]).catch(() => 890880),
    ]);
    const nativeBalance = BigInt(bal.value); const recipientExists = !!toInfo?.value;
    const sorted: number[] = (fees as any[]).map((f) => Number(f.prioritizationFee)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    const pct = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
    const price: Record<FeeTierId, number> = { slow: 0, average: Math.min(MAX_PRICE, pct(0.5)), fast: Math.min(MAX_PRICE, Math.max(pct(0.9), pct(0.5) * 2)) };
    const issues = []; let limit = p.memo ? 30_000 : 1_000; let assetBalance = nativeBalance; let token: Ctx['token']; let extraRent = 0n;
    if (isToken) {
      const mint = p.asset.contract!;
      const mintInfo = await call(env, chain, 'getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      if (!mintInfo?.value) throw new SendError('token-not-registered', 'Token mint not found on Solana');
      const program = mintInfo.value.owner === TOKEN_2022 ? 1 : 0;
      const decimals = Number(mintInfo.value.data?.parsed?.info?.decimals ?? p.asset.decimals);
      const accts = await call(env, chain, 'getTokenAccountsByOwner', [p.from, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      const list: Array<{ pubkey: string; amount: bigint }> = (accts?.value ?? []).map((a: any) => ({ pubkey: a.pubkey, amount: BigInt(a.account.data.parsed.info.tokenAmount.amount) })).sort((a: any, b: any) => (a.amount > b.amount ? -1 : 1));
      assetBalance = list[0]?.amount ?? 0n;
      const sa = env.core.SolanaAddress.createWithString(p.to);
      const recipientAta: string = program === 1 ? sa.token2022Address(mint) : sa.defaultTokenAddress(mint); sa.delete();
      const ataInfo = await call(env, chain, 'getAccountInfo', [recipientAta, { encoding: 'base64', commitment: 'confirmed' }]).catch(() => ({ value: undefined }));
      const createAta = !ataInfo?.value;
      if (createAta) extraRent = BigInt(await call(env, chain, 'getMinimumBalanceForRentExemption', [program === 1 ? 170 : 165]).catch(() => 2039280));
      limit = Math.max(limit, createAta ? 100_000 : 60_000);
      token = { program, senderAta: list[0]?.pubkey ?? '', recipientAta, createAta, decimals };
      if (!list.length) issues.push(issue('insufficient-funds', MSG.insufficientFunds, true));
      if (createAta) issues.push(issue('info', `The recipient has no ${p.asset.symbol} account yet. It will be created for you (about ${formatUnits(extraRent, 9)} SOL, paid by you).`, false));
    }
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => {
      const prio = (BigInt(limit) * BigInt(price[id]) + 999_999n) / 1_000_000n;
      const fee = BASE_FEE + prio + extraRent;
      return { id, fee, max: isToken ? assetBalance : sub0(nativeBalance, fee), detail: price[id] ? `${price[id]} µ-lamports/CU` : 'base fee' };
    });
    const avg = tiers[1].fee;
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance, fee: avg }));
    const rent: bigint = BigInt(rent0);
    if (!isToken && p.amount > 0n) {
      if (!recipientExists && p.amount < rent) issues.push(issue('below-minimum', `The recipient account does not exist yet: send at least ${formatUnits(rent, 9)} SOL to activate it.`, true));
      const left = nativeBalance - p.amount - avg;
      if (left > 0n && left < rent && !p.isMax) issues.push(issue('reserve', `Your account must keep at least ${formatUnits(rent, 9)} SOL (rent exemption) or be emptied.`, true));
    }
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: nativeBalance.toString(), assetBalance: assetBalance.toString(), issues, recipientInactive: !recipientExists, ctx: { blockhash: bh.value.blockhash, price, limit, token, rent, recipientExists } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const { AnySigner, CoinType } = env.core;
    const t = q.tiers.find((x) => x.id === tier)!;
    const amount = p.isMax ? t.max : p.amount;
    const base: any = { privateKey: key, recentBlockhash: c.blockhash, sender: p.from, priorityFeePrice: { price: c.price[tier] }, priorityFeeLimit: { limit: c.limit }, txEncoding: TW.Solana.Proto.Encoding.Base58 };
    if (p.asset.kind === 'token') {
      const k = c.token!; const prog = k.program === 1 ? TW.Solana.Proto.TokenProgramId.Token2022Program : TW.Solana.Proto.TokenProgramId.TokenProgram;
      const common = { tokenMintAddress: p.asset.contract, senderTokenAddress: k.senderAta, recipientTokenAddress: k.recipientAta, amount: amount.toString(), decimals: k.decimals, tokenProgramId: prog, ...(p.memo ? { memo: p.memo } : {}) };
      if (k.createAta) base.createAndTransferTokenTransaction = { ...common, recipientMainAddress: p.to };
      else base.tokenTransferTransaction = common;
    } else base.transferTransaction = { recipient: p.to, value: amount.toString(), ...(p.memo ? { memo: p.memo } : {}) };
    const input = TW.Solana.Proto.SigningInput.create(base);
    const out = TW.Solana.Proto.SigningOutput.decode(AnySigner.sign(TW.Solana.Proto.SigningInput.encode(input).finish(), CoinType.solana));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.encoded, meta: { blockhash: c.blockhash } };
  },
  async broadcast(env, chain, tx) {
    return await call(env, chain, 'sendTransaction', [tx.raw, { encoding: 'base58', preflightCommitment: 'confirmed', maxRetries: 3 }]);
  },
  async status(env, chain, hash): Promise<TxStatus> {
    const r = await call(env, chain, 'getSignatureStatuses', [[hash], { searchTransactionHistory: true }]);
    const s = r?.value?.[0]; if (!s) return { state: 'unknown' };
    if (s.err) return { state: 'failed', block: String(s.slot), error: JSON.stringify(s.err) };
    return { state: s.confirmationStatus === 'finalized' || s.confirmationStatus === 'confirmed' ? 'confirmed' : 'pending', block: String(s.slot), confirmations: s.confirmations ?? undefined };
  },
};
