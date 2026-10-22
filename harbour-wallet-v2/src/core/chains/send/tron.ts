// TRON (TronGrid HTTP API): native TRX and TRC-20 transfers. Bandwidth / energy aware fee estimate (free + staked resources
// first, the rest is burned in TRX), 1 TRX account-activation fee for fresh recipients, fee_limit cap for TRC-20.
import { TW } from './proto';
import type { ChainInfo } from '../types';
import type { BuiltTx, FeeTierId, SendEnv, SendFamily, SendQuote, TxStatus } from './types';
import { SendError } from './types';
import { MSG, bigToBytes, bytesToHex, firstOf, fundsIssues, hexToBytes, issue, jpost, sub0, trimUrl, formatUnits } from './util';

const eps = (c: ChainInfo) => (c.endpoints ?? []).map(trimUrl);
const post = (env: SendEnv, c: ChainInfo, path: string, body: unknown) => firstOf(eps(c), (u) => jpost(env.fetch, u + path, body));
const BW_NATIVE = 270n, BW_TRC20 = 350n;

function addrWord(env: SendEnv, addr: string): string { const b: Uint8Array = env.core.Base58.decode(addr); return bytesToHex(b.slice(b.length === 21 ? 1 : 0, 21)).padStart(64, '0'); }
interface Ctx { block: any; feeLimit: bigint; energy: bigint }

export const tronFamily: SendFamily = {
  kinds: ['tron'], memo: 'none', tokens: true,
  async quote(env, p): Promise<SendQuote> {
    const { chain } = p; const isToken = p.asset.kind === 'token';
    if (!env.core.AnyAddress.isValid(p.to, env.core.CoinType.tron)) throw new SendError('invalid-recipient', 'Invalid recipient address');
    const [acct, toAcct, res, params, block] = await Promise.all([
      post(env, chain, '/wallet/getaccount', { address: p.from, visible: true }),
      post(env, chain, '/wallet/getaccount', { address: p.to, visible: true }),
      post(env, chain, '/wallet/getaccountresource', { address: p.from, visible: true }).catch(() => ({})),
      firstOf(eps(chain), async (u) => { const r = await env.fetch(u + '/wallet/getchainparameters', { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).catch(() => ({})),
      post(env, chain, '/wallet/getnowblock', {}),
    ]);
    const cp = (k: string, d: number) => BigInt((params?.chainParameter ?? []).find((x: any) => x.key === k)?.value ?? d);
    const energyFee = cp('getEnergyFee', 420), bwFee = cp('getTransactionFee', 1000), newAcct = cp('getCreateNewAccountFeeInSystemContract', 1_000_000);
    const nativeBalance = BigInt(acct?.balance ?? 0); const recipientInactive = !toAcct?.address && !Object.keys(toAcct ?? {}).length;
    const bwAvail = BigInt(Math.max(0, (res.freeNetLimit ?? 0) - (res.freeNetUsed ?? 0))) + BigInt(Math.max(0, (res.NetLimit ?? 0) - (res.NetUsed ?? 0)));
    const issues = []; let assetBalance = nativeBalance; let energy = 0n; let fee = 0n; let feeLimit = 0n;
    const bw = isToken ? BW_TRC20 : BW_NATIVE; const bwBurn = bwAvail >= bw ? 0n : bw * bwFee;
    if (isToken) {
      const contract = p.asset.contract!;
      const bal = await post(env, chain, '/wallet/triggerconstantcontract', { owner_address: p.from, contract_address: contract, function_selector: 'balanceOf(address)', parameter: addrWord(env, p.from), visible: true });
      assetBalance = BigInt('0x' + (bal?.constant_result?.[0] || '0'));
      const amt = (p.amount > 0n ? p.amount : 1n).toString(16).padStart(64, '0');
      try {
        const est = await post(env, chain, '/wallet/triggerconstantcontract', { owner_address: p.from, contract_address: contract, function_selector: 'transfer(address,uint256)', parameter: addrWord(env, p.to) + amt, visible: true });
        energy = BigInt(est?.energy_used ?? 0);
        if (est?.result && est.result.result === false) issues.push(issue('estimate-failed', MSG.simulationReverted, false));
      } catch { energy = 65_000n; issues.push(issue('estimate-failed', MSG.simulationNetwork, false)); }
      if (energy === 0n) energy = 65_000n;
      const energyAvail = BigInt(Math.max(0, (res.EnergyLimit ?? 0) - (res.EnergyUsed ?? 0)));
      fee = (energy > energyAvail ? energy - energyAvail : 0n) * energyFee + bwBurn;
      feeLimit = (energy * energyFee * 2n); if (feeLimit < 10_000_000n) feeLimit = 10_000_000n; if (feeLimit > 150_000_000n) feeLimit = 150_000_000n; if (nativeBalance > 0n && feeLimit > nativeBalance) feeLimit = nativeBalance;
    } else {
      fee = bwBurn + (recipientInactive ? newAcct : 0n);
    }
    if (recipientInactive) issues.push(issue('inactive-account', isToken ? 'The recipient address has not been activated on TRON yet.' : `The recipient address is not activated on TRON. Sending to it costs an extra ${formatUnits(newAcct, 6)} TRX.`, false));
    const tiers = (['slow', 'average', 'fast'] as FeeTierId[]).map((id) => ({ id, fee, max: isToken ? assetBalance : sub0(nativeBalance, fee) }));
    issues.push(...fundsIssues({ amount: p.amount, isToken, assetBalance, nativeBalance, fee: isToken ? fee : fee }));
    return { tiers, defaultTier: 'average', feeSymbol: chain.symbol, feeDecimals: chain.decimals, nativeBalance: nativeBalance.toString(), assetBalance: assetBalance.toString(), issues, recipientInactive, ctx: { block, feeLimit, energy } as Ctx };
  },
  async build(env, p, key, q, tier): Promise<BuiltTx> {
    const c: Ctx = q.ctx; const t = q.tiers.find((x) => x.id === tier)!;
    const amount = p.isMax ? t.max : p.amount; const raw = c.block.block_header.raw_data; const now = (env.now ?? Date.now)();
    const blockHeader = { timestamp: raw.timestamp, txTrieRoot: hexToBytes(raw.txTrieRoot), parentHash: hexToBytes(raw.parentHash), number: raw.number, witnessAddress: hexToBytes(raw.witness_address), version: raw.version ?? 0 };
    const tx: any = { timestamp: now, expiration: now + 10 * 60 * 60 * 1000, blockHeader };
    if (p.asset.kind === 'token') { tx.feeLimit = c.feeLimit.toString(); tx.transferTrc20Contract = { contractAddress: p.asset.contract, ownerAddress: p.from, toAddress: p.to, amount: bigToBytes(amount) }; }
    else tx.transfer = { ownerAddress: p.from, toAddress: p.to, amount: amount.toString() };
    const input = TW.Tron.Proto.SigningInput.create({ transaction: tx, privateKey: key });
    const out = TW.Tron.Proto.SigningOutput.decode(env.core.AnySigner.sign(TW.Tron.Proto.SigningInput.encode(input).finish(), env.core.CoinType.tron));
    if (out.error) throw new SendError('estimate-failed', out.errorMessage || 'Could not build the transaction');
    return { raw: out.json, hash: bytesToHex(out.id) };
  },
  async broadcast(env, chain, tx) {
    const r = await firstOf(eps(chain), (u) => jpost(env.fetch, u + '/wallet/broadcasttransaction', tx.raw));
    if (r?.result === true || r?.txid) return r.txid || tx.hash!;
    let msg = r?.message ?? r?.code ?? 'Broadcast rejected';
    if (/^[0-9a-f]+$/i.test(String(msg)) && String(msg).length % 2 === 0) { try { msg = new TextDecoder().decode(hexToBytes(String(msg))); } catch { /* keep */ } }
    throw new Error(String(msg));
  },
  async status(env, chain, hash): Promise<TxStatus> {
    const i = await post(env, chain, '/wallet/gettransactioninfobyid', { value: hash });
    if (!i || !Object.keys(i).length) { const t = await post(env, chain, '/wallet/gettransactionbyid', { value: hash }).catch(() => ({})); return Object.keys(t ?? {}).length ? { state: 'pending' } : { state: 'unknown' }; }
    const failed = i.receipt?.result && i.receipt.result !== 'SUCCESS'; const rr = i.result === 'FAILED';
    return { state: failed || rr ? 'failed' : 'confirmed', block: String(i.blockNumber ?? ''), fee: i.fee != null ? String(i.fee) : undefined, timestamp: i.blockTimeStamp ? Math.floor(i.blockTimeStamp / 1000) : undefined, error: failed ? String(i.receipt.result) : undefined };
  },
};
