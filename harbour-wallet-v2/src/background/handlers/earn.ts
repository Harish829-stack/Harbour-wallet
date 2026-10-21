// Feature message handlers: earn (native staking). Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// Messages: earnAvailable, earnList, earnDetails, earnPrepare, earnSubmit. Keys never leave the background; the UI only ever sees summaries.
import type { Handler, HandlerCtx, HandlerMap } from './types';
import { local } from '../../core/storage';
import { chainById, explorerTxUrl } from '../../core/chains/index';
import { addressFor, fetchNativeBalance } from '../../core/chains/adapters';
import { getRpcUrls } from '../../core/chains/rpcUrls';
import { solanaRpcUrl } from '../../core/rpc';
import { openActiveKeys } from '../keys';
import { activeInfo, earnAvailability, withCoinKey } from './earnKeys';
import { estimatePlan, runPlan } from './earnEvm';
import type { StakeAction, StakeListItem, Position, StakeAssetDef, Validator } from '../../core/staking/types';
import { stakingAsset } from '../../core/staking/registry';
import { loadDetails, loadList, toRaw, type StakeEnv, type StakeDetails } from '../../core/staking/service';
import { broadcastCosmos, cosmosFee, fetchCosmosBalance, fetchCosmosSigningContext, signCosmos, validAddress, type CosmosOp } from '../../core/staking/cosmos';
import { isSolAddress, sendSolana, signSolanaStake, solRpc, solanaBlockhash } from '../../core/staking/solana';
import { bscBalanceShares, bscCreditFor, bscPlan, bscSharesFor, ethCall, isEvmAddress, lidoAllowance, lidoClaimPlan, lidoStakePlan, lidoUnstakePlan, type CallPlan, LIDO, stethAbi } from '../../core/staking/evm';
import { decodeFunctionResult, encodeFunctionData } from 'viem';
import { rocketStakePlan, rocketUnstakePlan } from '../../core/staking/evm';
import { fetchTronState, tronContracts, signTronContract, broadcastTron, tronPost } from '../../core/staking/tron';
import { fetchTezosContext, tezosTarget, tezosFee, signTezosDelegation, injectTezos } from '../../core/staking/tezos';
import { fetchCardanoState, cardanoStakeInput, cardanoTipSlot, STAKE_KEY_DEPOSIT } from '../../core/staking/cardano';
import { cardanoPlan, cardanoSign, cardanoSubmit } from '../../core/chains/cardano';
import { poolsApi, poolMember, polkadotCall, polkadotFee, polkadotSubmit } from '../../core/staking/polkadot';

const env = (): StakeEnv => ({ f: fetch.bind(globalThis) as typeof fetch, rpcUrls: getRpcUrls, solUrls: () => [solanaRpcUrl(), ...(chainById('solana')?.endpoints ?? [])].filter((u, i, a) => a.indexOf(u) === i) });
const LIST_KEY = 'earn:list:v1'; const LIST_TTL = 5 * 60_000;
const ACTIONS: StakeAction[] = ['stake', 'unstake', 'redelegate', 'compound', 'claim', 'withdraw'];
const fail = (error: string, code = 'error') => ({ ok: false as const, error, code });

interface Req { chainId: string; action: StakeAction; amount?: string; max?: boolean; validator?: string; toValidator?: string; positionId?: string }
export interface Summary {
  chainId: string; symbol: string; decimals: number; action: StakeAction; address: string;
  amount: string; validatorId?: string; validatorName?: string; toValidatorId?: string; toValidatorName?: string;
  fee: string; feeSymbol: string; feeDecimals: number; feeExact: boolean; steps: number; notes: string[]; balance: string;
}
interface Plan { summary: Summary; run: () => Promise<string[]> }

async function ready(ctx: HandlerCtx) {
  const info = await activeInfo(ctx);
  const av = earnAvailability(info);
  if (!av.available || !info) throw Object.assign(new Error(av.reason === 'hardware' ? 'Earn is not available for hardware wallets' : 'Earn is not available for this wallet'), { code: av.reason ?? 'unavailable' });
  return info;
}
const validators = (d: StakeDetails): Map<string, Validator> => new Map(d.validators.map((v) => [v.id, v]));
const bad = (m: string, code = 'bad_request') => Object.assign(new Error(m), { code });
const pos = (d: StakeDetails, id?: string): Position => { const p = d.overview.positions.find((x) => x.id === id); if (!p) throw bad('Position not found (it may have changed — refresh)'); return p; };
const days = (n: number | null | undefined) => (n ? `${n} days` : 'the protocol unbonding period');

async function nativeBalance(def: StakeAssetDef, address: string, denom?: string): Promise<bigint> {
  const chain = chainById(def.chainId)!; const f = env().f;
  if (def.family === 'cosmos') return fetchCosmosBalance(chain, address, denom!, f);
  const r = await fetchNativeBalance(chain, address, f);
  if (!r.ok) throw bad(r.error ?? 'Could not read balance', 'balance_failed');
  return BigInt(r.raw);
}

/** Validates a request against live chain state and builds the executable plan. Used by BOTH prepare and submit. */
async function buildPlan(ctx: HandlerCtx, req: Req): Promise<Plan> {
  const info = await ready(ctx);
  const def = stakingAsset(req.chainId); const chain = chainById(req.chainId);
  if (!def || !chain) throw bad('Staking is not available for this network', 'unsupported');
  if (!ACTIONS.includes(req.action)) throw bad('Unknown action');
  const address = addressFor(chain, info.addresses); if (!address) throw bad('No address for this network', 'no_address');
  const e = env();
  const d = await loadDetails(e, def.chainId, address);
  const vmap = validators(d);
  const base: Summary = { chainId: def.chainId, symbol: def.symbol, decimals: def.decimals, action: req.action, address, amount: '0', fee: '0', feeSymbol: def.symbol, feeDecimals: def.decimals, feeExact: false, steps: 1, notes: [], balance: '0' };
  const needAmount = (max?: bigint): bigint => {
    if (req.max && max != null) return max;
    const a = toRaw(req.amount ?? '', def.decimals); if (a == null) throw bad('Enter a valid amount', 'bad_amount'); return a;
  };
  const vname = (id?: string) => (id ? vmap.get(id)?.name ?? d.overview.positions.find((p) => p.validatorId === id)?.validatorName : undefined);

  // ------------------------------------------------------------ Cosmos family
  if (def.family === 'cosmos') {
    const denom = d.bondDenom!; const lock = d.overview.lockDays;
    const balance = await nativeBalance(def, address, denom); base.balance = balance.toString();
    const op: CosmosOp = { action: req.action, delegator: address, denom };
    let nMsgs = 1;
    if (req.action === 'stake') {
      if (!req.validator || !validAddress(chain, req.validator)) throw bad('Choose a validator'); const v = vmap.get(req.validator);
      if (v && !v.active) throw bad('This validator is not active');
      const amt = needAmount(); if (amt < BigInt(def.minStake)) throw bad('Amount is below the minimum'); op.validator = req.validator; op.amount = amt.toString();
      base.amount = op.amount; base.validatorId = req.validator; base.validatorName = v?.name;
      base.notes.push(`Unstaking takes ${days(lock)} before funds are available.`, 'Rewards accrue every block and can be claimed or compounded.');
    } else if (req.action === 'unstake' || req.action === 'redelegate') {
      if (!req.validator || !validAddress(chain, req.validator)) throw bad('Choose a validator');
      const p = d.overview.positions.find((x) => x.status === 'active' && x.validatorId === req.validator); if (!p) throw bad('You have no stake with this validator');
      const amt = needAmount(BigInt(p.amount)); if (amt > BigInt(p.amount)) throw bad('Amount exceeds your staked balance', 'bad_amount');
      op.validator = req.validator; op.amount = amt.toString(); base.amount = op.amount; base.validatorId = req.validator; base.validatorName = vname(req.validator);
      if (req.action === 'unstake') base.notes.push(`Funds are locked for ${days(lock)} while unbonding and earn no rewards.`, 'Pending rewards for this validator are paid out automatically.');
      else {
        if (!req.toValidator || !validAddress(chain, req.toValidator) || req.toValidator === req.validator) throw bad('Choose a different destination validator');
        const t = vmap.get(req.toValidator); if (t && !t.active) throw bad('The destination validator is not active');
        op.toValidator = req.toValidator; base.toValidatorId = req.toValidator; base.toValidatorName = t?.name;
        base.notes.push('Redelegation moves your stake immediately, without unbonding.', `You cannot redelegate this stake again until ${days(lock)} have passed.`);
      }
    } else if (req.action === 'claim' || req.action === 'compound') {
      const withRewards = d.overview.positions.filter((p) => p.status === 'active' && BigInt(p.rewards ?? '0') > 0n && (!req.validator || p.validatorId === req.validator)).slice(0, 8);
      if (!withRewards.length) throw bad('There are no rewards to ' + req.action, 'nothing_to_claim');
      op.rewards = withRewards.map((p) => ({ validator: p.validatorId, amount: p.rewards! })); nMsgs = op.rewards.length;
      base.amount = withRewards.reduce((n, p) => n + BigInt(p.rewards!), 0n).toString();
      base.validatorId = withRewards.length === 1 ? withRewards[0].validatorId : undefined; base.validatorName = withRewards.length === 1 ? vname(withRewards[0].validatorId) : `${withRewards.length} validators`;
      base.notes.push(req.action === 'compound' ? 'Rewards are withdrawn and staked again with the same validators.' : 'Rewards are paid out to your wallet.');
    } else throw bad('This action is not available for ' + def.symbol, 'unsupported');
    const fee = cosmosFee(def.chainId, denom, req.action, nMsgs); base.fee = fee.amount; base.feeExact = false; base.feeSymbol = def.symbol;
    base.notes.push('Network fee is an estimate at the chain\'s minimum gas price.');
    const spend = (req.action === 'stake' ? BigInt(base.amount) : 0n) + BigInt(fee.amount);
    if (balance < spend) throw bad(`Not enough ${def.symbol} to cover the amount and network fee`, 'insufficient_funds');
    return { summary: base, run: async () => withCoinKey(ctx, chain.ct, async (key) => {
      const sctx = await fetchCosmosSigningContext(chain, address, e.f);
      const signed = signCosmos(ctx.core, chain, { op, accountNumber: sctx.accountNumber, sequence: sctx.sequence, chainId: sctx.chainId, fee, privateKey: key });
      return [await broadcastCosmos(chain, e.f, signed.body)];
    }) };
  }

  // ------------------------------------------------------------ Solana
  if (def.family === 'solana') {
    const urls = e.solUrls();
    const balance = BigInt((await solRpc(e.f, urls, 'getBalance', [address, { commitment: 'confirmed' }]))?.value ?? 0); base.balance = balance.toString();
    base.fee = '5000'; base.feeExact = false;
    let args: any;
    if (req.action === 'stake') {
      const v = req.validator; if (!isSolAddress(v)) throw bad('Choose a validator'); const vv = vmap.get(v); if (vv && !vv.active) throw bad('This validator is delinquent');
      const amt = needAmount(); if (amt < BigInt(def.minStake)) throw bad('Amount is below the minimum'); base.amount = amt.toString(); base.validatorId = v; base.validatorName = vv?.name;
      if (balance < amt + 5000n) throw bad('Not enough SOL to cover the amount and network fee', 'insufficient_funds');
      base.notes.push('A new stake account is created. About 0.00228 SOL of it is held as account rent and is returned when you withdraw.', 'Stake activates at the start of the next epoch (about 2 days).');
      args = { action: 'stake', validator: v, amount: base.amount };
    } else if (req.action === 'unstake') {
      const p = pos(d, req.positionId); if (p.status !== 'active' && p.status !== 'activating') throw bad('This stake account is not active');
      base.amount = p.amount; base.validatorId = p.validatorId; base.validatorName = p.validatorName;
      base.notes.push('The whole stake account is deactivated; it cools down for the rest of the epoch, then you can withdraw.');
      args = { action: 'unstake', stakeAccount: p.id };
    } else if (req.action === 'withdraw' || req.action === 'claim') {
      const p = pos(d, req.positionId); if (p.status !== 'inactive') throw bad('This stake account is not withdrawable yet');
      base.amount = p.amount; base.validatorId = p.validatorId; base.validatorName = p.validatorName; base.notes.push('The full balance of the stake account is returned to your wallet.');
      args = { action: 'withdraw', stakeAccount: p.id, amount: p.amount };
    } else throw bad('This action is not available for SOL', 'unsupported');
    if (balance < 5000n) throw bad('Not enough SOL to cover the network fee', 'insufficient_funds');
    base.notes.push('Rewards are added to the stake account automatically each epoch.');
    return { summary: base, run: async () => {
      const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
      try {
        const sk = keys.solanaKey(); const bytes: Uint8Array = sk.key.data();
        try {
          const blockhash = await solanaBlockhash(e.f, urls);
          const { encoded } = signSolanaStake(ctx.core, { ...args, sender: sk.address, privateKey: bytes, blockhash });
          return [await sendSolana(e.f, urls, encoded)];
        } finally { bytes.fill(0); }
      } finally { keys.dispose(); }
    } };
  }

  // ------------------------------------------------------------ TRON (Stake 2.0)
  if (def.family === 'tron') {
    const st = await fetchTronState(chain, address, e.f); base.balance = st.balance.toString();
    let action = req.action;
    if (action === 'claim' && req.positionId?.startsWith('unfreeze:')) action = 'withdraw'; // expired unfreezes
    const amount = action === 'stake' ? needAmount() : action === 'unstake' ? needAmount(st.frozen) : undefined;
    const contracts = tronContracts(action, { owner: address, state: st, amount, validator: req.validator, toValidator: req.toValidator });
    base.amount = (amount ?? (action === 'claim' ? st.reward : action === 'withdraw' ? st.unfreezing.filter((u) => u.expireAt <= Date.now()).reduce((n, u) => n + u.amount, 0n) : st.frozen)).toString();
    base.validatorId = req.validator; base.validatorName = vname(req.validator); base.toValidatorId = req.toValidator; base.toValidatorName = vname(req.toValidator);
    base.steps = contracts.length; base.fee = (BigInt(contracts.length) * 350_000n).toString(); base.feeExact = false;
    base.notes.push('Usually free: TRON accounts get daily free bandwidth; otherwise about 0.35 TRX per transaction is burned.');
    if (action === 'stake') base.notes.push('Your TRX is frozen for bandwidth and its TRON Power is voted for this Super Representative.', `Unfreezing takes ${days(def.lockDays)}.`);
    if (action === 'unstake') base.notes.push(`Unfrozen TRX is available after ${days(def.lockDays)}; votes above your remaining TRON Power are removed.`);
    if (action === 'claim') base.notes.push('Voting rewards can be claimed once every 24 hours.');
    if (action === 'withdraw' && BigInt(base.amount) <= 0n) throw bad('Nothing is withdrawable yet', 'nothing_to_claim');
    if (st.balance < (action === 'stake' ? amount! : 0n)) throw bad('Not enough TRX for this amount', 'insufficient_funds');
    return { summary: base, run: async () => withCoinKey(ctx, chain.ct, async (key) => {
      const out: string[] = [];
      for (const c of contracts) {
        const block = await tronPost(chain, e.f, '/wallet/getnowblock', {});
        const signed = signTronContract(ctx.core, c, block, key);
        out.push(await broadcastTron(chain, e.f, signed.json));
      }
      return out;
    }) };
  }

  // ------------------------------------------------------------ Tezos (baker delegation)
  if (def.family === 'tezos') {
    const tctx = await fetchTezosContext(chain, address, e.f); base.balance = tctx.balance.toString();
    const delegate = tezosTarget(req.action, { validator: req.validator, toValidator: req.toValidator, current: tctx.delegate });
    const fee = tezosFee(tctx.revealed);
    base.amount = tctx.balance.toString(); base.fee = fee.toString(); base.feeExact = true;
    base.validatorId = req.action === 'redelegate' ? tctx.delegate : delegate || tctx.delegate; base.validatorName = vname(base.validatorId);
    if (req.action === 'redelegate') { base.toValidatorId = delegate; base.toValidatorName = vname(delegate); }
    base.notes.push(delegate ? 'Your whole XTZ balance is delegated; it stays in your wallet and can be spent any time.' : 'Delegation stops; your XTZ stays in your wallet.', 'Bakers pay rewards to your address directly, usually every cycle (about 3 days).');
    if (!tctx.revealed) base.notes.push('This first operation also reveals your public key on Tezos.');
    if (tctx.balance < fee) throw bad('Not enough XTZ to cover the network fee', 'insufficient_funds');
    return { summary: base, run: async () => withCoinKey(ctx, chain.ct, async (key) => {
      const fresh = await fetchTezosContext(chain, address, e.f);
      return [await injectTezos(chain, e.f, signTezosDelegation(ctx.core, { source: address, ctx: fresh, delegate, key }))];
    }) };
  }

  // ------------------------------------------------------------ Cardano (pool delegation)
  if (def.family === 'cardano') {
    const st = await fetchCardanoState(chain, address, e.f); base.balance = st.balance.toString();
    const slot = await cardanoTipSlot(e.f, chain);
    const pool = req.action === 'redelegate' ? req.toValidator : req.validator;
    const input = cardanoStakeInput(req.action, st, slot, pool);
    const plan = cardanoPlan(ctx.core, input);
    if (plan.error) throw bad('Not enough ADA to cover this transaction, its fee and the 2 ADA deposit', 'insufficient_funds');
    base.fee = plan.fee.toString(); base.feeExact = true;
    base.amount = (req.action === 'claim' || req.action === 'compound' ? st.rewards : st.total).toString();
    base.validatorId = req.action === 'redelegate' ? st.pool ?? undefined : pool ?? st.pool ?? undefined; base.validatorName = vname(base.validatorId);
    if (req.action === 'redelegate') { base.toValidatorId = pool; base.toValidatorName = vname(pool); }
    if (input.registerStakingKey) base.notes.push(`Registering your stake key takes a ${Number(STAKE_KEY_DEPOSIT) / 1e6} ADA deposit, returned when you stop staking.`);
    if (input.deregisterStakingKey) base.notes.push(`Your ${Number(STAKE_KEY_DEPOSIT) / 1e6} ADA stake-key deposit is returned.`);
    if (input.voteDelegation) base.notes.push('Withdrawing rewards requires a governance vote delegation; Harbour sets it to "Always abstain".');
    base.notes.push('Your ADA never leaves your wallet and is not locked. Rewards start after 2 epochs (about 10 days).');
    return { summary: base, run: async () => withCoinKey(ctx, chain.ct, async (key) => {
      const fresh = await fetchCardanoState(chain, address, e.f);
      const signed = cardanoSign(ctx.core, { ...cardanoStakeInput(req.action, fresh, await cardanoTipSlot(e.f, chain), pool), privateKey: [key] });
      return [(await cardanoSubmit(e.f, signed.cbor, chain)) || signed.txId];
    }) };
  }

  // ------------------------------------------------------------ Polkadot (nomination pools)
  if (def.family === 'polkadot') {
    const api = await poolsApi();
    const [member, acct] = await Promise.all([poolMember(api, address), api.query.system.account(address)]);
    const free = BigInt(acct.data.free.toString()); base.balance = free.toString();
    let action = req.action;
    if (action === 'claim' && req.positionId?.startsWith('unbond:')) action = 'withdraw';
    const amount = action === 'stake' ? needAmount() : action === 'unstake' ? needAmount(BigInt(d.overview.staked)) : undefined;
    const call = await polkadotCall(api, action, { address, member, amount, pool: req.validator, max: req.max, minJoin: BigInt(d.minJoin ?? def.minStake) });
    const fee = await polkadotFee(api, call, address);
    base.amount = (amount ?? (action === 'claim' || action === 'compound' ? BigInt(d.overview.rewards) : BigInt(d.overview.claimable))).toString();
    base.fee = fee.toString(); base.feeExact = false; base.validatorId = member ? String(member.poolId) : req.validator; base.validatorName = vname(base.validatorId);
    if (action === 'stake') base.notes.push(`Unbonding from a pool takes ${days(def.lockDays)}.`, 'Rewards accrue in the pool; claim them or compound them into your stake.');
    if (action === 'unstake') base.notes.push(`Funds unbond for ${days(def.lockDays)} and earn no rewards meanwhile; then withdraw them here.`);
    if (free < (action === 'stake' ? amount! : 0n) + fee) throw bad('Not enough DOT to cover the amount and network fee (keep 0.01 DOT for the existential deposit)', 'insufficient_funds');
    return { summary: base, run: async () => withCoinKey(ctx, chain.ct, async (key) => {
      const pk = ctx.core.PrivateKey.createWithData(key);
      try {
        const fresh = await polkadotCall(api, action, { address, member: await poolMember(api, address), amount, pool: req.validator, max: req.max, minJoin: BigInt(d.minJoin ?? def.minStake) });
        return [await polkadotSubmit(api, fresh, address, (msg) => pk.sign(msg, ctx.core.Curve.ed25519))];
      } finally { pk.delete(); }
    }) };
  }

  // ------------------------------------------------------------ EVM (Lido / BNB StakeHub)
  const urls = getRpcUrls(chain);
  const balance = await nativeBalance(def, address); base.balance = balance.toString();
  let plan: CallPlan[] = [];
  if (def.family === 'lido') {
    const owner = address;
    if (req.action === 'stake' && req.validator === 'rocketpool') {
      const amt = needAmount(); base.amount = amt.toString(); base.validatorId = 'rocketpool'; base.validatorName = 'Rocket Pool'; plan = await rocketStakePlan(e.f, urls, amt);
      base.notes.push('You receive rETH. It does not rebase: its ETH value grows as rewards accrue. You can redeem or swap it any time.');
    } else if (req.action === 'unstake' && (req.validator === 'rocketpool' || req.positionId === 'reth')) {
      const p = d.overview.positions.find((x) => x.id === 'reth'); if (!p) throw bad('You have no rETH to redeem');
      const amt = needAmount(BigInt(p.amount)); const all = !!req.max || amt >= BigInt(p.amount);
      const r = await rocketUnstakePlan(e.f, urls, address, amt, all); plan = r.plan; base.amount = r.eth.toString(); base.validatorId = 'rocketpool'; base.validatorName = 'Rocket Pool';
      base.notes.push('rETH is burned for ETH immediately from the Rocket Pool deposit pool.');
    } else if (req.action === 'stake') {
      const amt = needAmount(); base.amount = amt.toString(); base.validatorId = 'lido'; base.validatorName = 'Lido'; plan = lidoStakePlan(amt);
      base.notes.push('You receive stETH 1:1. It earns rewards through a daily balance rebase and can be swapped or withdrawn any time.');
    } else if (req.action === 'unstake') {
      const p = d.overview.positions.find((x) => x.id === 'steth'); if (!p) throw bad('You have no stETH to withdraw');
      const amt = needAmount(BigInt(p.amount)); if (amt > BigInt(p.amount)) throw bad('Amount exceeds your stETH balance', 'bad_amount');
      const allowance = await lidoAllowance(e.f, urls, owner); plan = lidoUnstakePlan(amt, owner, allowance); base.amount = amt.toString(); base.validatorId = 'lido'; base.validatorName = 'Lido';
      base.notes.push('This requests a withdrawal from the Lido queue; it usually finalizes in 1-5 days, then you claim your ETH here.'); if (plan.length > 1) base.notes.push('Step 1 approves stETH for the withdrawal queue.');
    } else if (req.action === 'claim' || req.action === 'withdraw') {
      const p = pos(d, req.positionId); if (p.status !== 'claimable') throw bad('This withdrawal is not ready yet'); base.amount = p.amount; base.validatorName = 'Lido'; plan = lidoClaimPlan(BigInt(p.id));
    } else throw bad('This action is not available for ETH', 'unsupported');
  } else {
    const creditShares = async (op: string, amt: bigint, full: bigint) => { const credit = await bscCreditFor(e.f, urls, op); return amt >= full ? bscBalanceShares(e.f, urls, credit, address) : bscSharesFor(e.f, urls, credit, amt); };
    if (req.action === 'stake') {
      const v = req.validator; if (!isEvmAddress(v) || !vmap.has(v)) throw bad('Choose a validator'); if (!vmap.get(v)!.active) throw bad('This validator is not active');
      const amt = needAmount(); if (amt < BigInt(def.minStake)) throw bad('Amount is below the minimum'); base.amount = amt.toString(); base.validatorId = v; base.validatorName = vmap.get(v)?.name; plan = bscPlan('stake', { validator: v, amount: amt });
      base.notes.push('Unstaking takes 7 days before BNB can be claimed.');
    } else if (req.action === 'unstake' || req.action === 'redelegate') {
      const v = req.validator; if (!isEvmAddress(v)) throw bad('Choose a validator');
      const p = d.overview.positions.find((x) => x.status === 'active' && x.validatorId === v); if (!p) throw bad('You have no stake with this validator');
      const amt = needAmount(BigInt(p.amount)); if (amt > BigInt(p.amount)) throw bad('Amount exceeds your staked balance', 'bad_amount');
      const shares = await creditShares(v, amt, BigInt(p.amount)); base.amount = amt.toString(); base.validatorId = v; base.validatorName = vmap.get(v)?.name ?? p.validatorName;
      if (req.action === 'unstake') { plan = bscPlan('unstake', { validator: v, shares }); base.notes.push('Unbonding takes 7 days; claim your BNB here afterwards.'); }
      else { if (!isEvmAddress(req.toValidator) || req.toValidator === v || !vmap.get(req.toValidator)?.active) throw bad('Choose a different, active destination validator'); plan = bscPlan('redelegate', { validator: v, toValidator: req.toValidator, shares }); base.toValidatorId = req.toValidator; base.toValidatorName = vmap.get(req.toValidator)?.name; base.notes.push('Redelegation is instant but the protocol charges a small redelegation fee.'); }
    } else if (req.action === 'claim' || req.action === 'withdraw') {
      const p = pos(d, req.positionId); if (p.status !== 'claimable') throw bad('Nothing is claimable yet'); base.amount = p.amount; base.validatorId = p.validatorId; base.validatorName = p.validatorName; plan = bscPlan('claim', { validator: p.validatorId });
    } else throw bad('This action is not available for BNB', 'unsupported');
  }
  const est = await estimatePlan(chain, address as `0x${string}`, plan).catch(() => null);
  if (!est) throw bad('Could not estimate the network fee; check your connection and try again', 'fee_failed');
  base.fee = est.fee.toString(); base.feeExact = est.exact; base.steps = plan.length;
  const spend = plan.reduce((n, c) => n + c.value, 0n) + est.fee;
  if (balance < spend) throw bad(`Not enough ${def.symbol} to cover the amount and network fee`, 'insufficient_funds');
  return { summary: base, run: async () => {
    const keys = await openActiveKeys(ctx.core, ctx.vault, ctx.wallet);
    try { return await runPlan(chain, keys.evmPrivateKey(), plan); } finally { keys.dispose(); }
  } };
}

let busy = false;
const parse = (msg: any): Req => ({ chainId: String(msg.chainId ?? ''), action: msg.action, amount: typeof msg.amount === 'string' ? msg.amount : undefined, max: msg.max === true, validator: typeof msg.validator === 'string' ? msg.validator : undefined, toValidator: typeof msg.toValidator === 'string' ? msg.toValidator : undefined, positionId: typeof msg.positionId === 'string' ? msg.positionId : undefined });
const errOf = (e: any) => fail(String(e?.shortMessage ?? e?.message ?? 'Request failed').slice(0, 300), e?.code ?? 'error');

const earnAvailable: Handler = async (_m, ctx) => { const a = earnAvailability(await activeInfo(ctx)); return { ok: true, ...a }; };
const earnList: Handler = async (msg, ctx) => {
  try {
    const info = await ready(ctx); const scope = `${info.walletId}:${info.derivationIndex}`;
    const cached = await local.get<{ scope: string; fetchedAt: number; items: StakeListItem[] }>(LIST_KEY);
    const mine = cached?.scope === scope ? cached : undefined;
    if (mine && !msg.refresh && Date.now() - mine.fetchedAt < LIST_TTL) return { ok: true, items: mine.items, fetchedAt: mine.fetchedAt, stale: false };
    const items = await loadList(env(), (chain) => addressFor(chain, info.addresses));
    const prev = new Map((mine?.items ?? []).map((i) => [i.chainId, i]));
    const merged = items.map((i) => (i.error && prev.has(i.chainId) && !prev.get(i.chainId)!.error ? { ...prev.get(i.chainId)!, stale: true } : i));
    const allFailed = merged.every((i) => i.error || i.stale);
    if (allFailed && mine) return { ok: true, items: mine.items, fetchedAt: mine.fetchedAt, stale: true, error: items.find((i) => i.error)?.error };
    const fetchedAt = Date.now(); await local.set(LIST_KEY, { scope, fetchedAt, items: merged });
    return { ok: true, items: merged, fetchedAt, stale: merged.some((i) => i.stale) };
  } catch (e: any) { return errOf(e); }
};
const earnDetails: Handler = async (msg, ctx) => {
  try {
    const info = await ready(ctx); const def = stakingAsset(String(msg.chainId)); const chain = def && chainById(def.chainId);
    if (!def || !chain) return fail('Staking is not available for this network', 'unsupported');
    const address = addressFor(chain, info.addresses); const d = await loadDetails(env(), def.chainId, address);
    let balance = '0'; try { balance = (await nativeBalance(def, address, d.bondDenom)).toString(); } catch { /* shown as unknown */ }
    const { family, minStake, lockDays, claimableRewards, supportsRedelegate, protocol, symbol, decimals } = def;
    // Amount kept back by MAX when staking from the spendable balance (network fee headroom). Estimate, not a quote.
    const reserve = family === 'cosmos' ? cosmosFee(def.chainId, d.bondDenom!, 'stake').amount : family === 'solana' ? '10000' : family === 'lido' ? '3000000000000000' : family === 'tron' ? '1000000' : family === 'tezos' ? '2300' : family === 'cardano' ? '2500000' : family === 'polkadot' ? '200000000' : '1000000000000000';
    return { ok: true, def: { chainId: def.chainId, family, minStake: d.minJoin ?? minStake, lockDays: d.overview.lockDays ?? lockDays, claimableRewards, supportsRedelegate, protocol, symbol, decimals }, overview: d.overview, validators: d.validators, validatorsSource: d.validatorsSource, balance, reserve, address };
  } catch (e: any) { return errOf(e); }
};
const earnPrepare: Handler = async (msg, ctx) => { try { return { ok: true, summary: (await buildPlan(ctx, parse(msg))).summary }; } catch (e: any) { return errOf(e); } };
const earnSubmit: Handler = async (msg, ctx) => {
  if (busy) return fail('Another staking transaction is in progress', 'busy');
  busy = true;
  try {
    const plan = await buildPlan(ctx, parse(msg)); const hashes = await plan.run();
    await local.remove(LIST_KEY); // positions changed; next list read refreshes
    const chain = chainById(plan.summary.chainId)!;
    return { ok: true, hash: hashes[hashes.length - 1], hashes, explorerUrl: explorerTxUrl(chain, hashes[hashes.length - 1]), summary: plan.summary };
  } catch (e: any) { return errOf(e); } finally { busy = false; }
};

export const handlers: HandlerMap = { earnAvailable, earnList, earnDetails, earnPrepare, earnSubmit };
export { ethCall, decodeFunctionResult, encodeFunctionData, LIDO, stethAbi }; // (re-exported only to keep the import list explicit for tree-shaking checks)
