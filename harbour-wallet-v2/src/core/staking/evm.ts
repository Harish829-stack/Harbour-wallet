// EVM staking through public contracts: Lido (Ethereum, stETH + WithdrawalQueueERC721) and BNB Chain StakeHub (native BNB
// delegation). Read paths are `eth_call` over the chain's public RPC list (injectable fetch); write paths are plain
// call plans ({to,data,value}) signed by the background (viem) — nothing here touches keys.
import { encodeFunctionData, decodeFunctionResult, parseAbi, isAddress, getAddress } from 'viem';
import type { Fetcher } from '../chains/adapters/types';
import { firstOf, jsonPost } from '../chains/adapters/types';
import type { Position, StakeAction, StakeOverview, Validator, ValidatorMeta } from './types';
import { stakeError } from './types';

export interface CallPlan { to: `0x${string}`; data: `0x${string}`; value: bigint; label: string; /** upper-bound gas used when estimation is impossible (depends on an earlier tx) */ gasFallback: bigint }

export async function ethCall(f: Fetcher, urls: string[], to: string, data: string): Promise<`0x${string}`> {
  return firstOf(urls, async (u) => {
    const j = await jsonPost(f, u, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }, 12000);
    if (typeof j?.result !== 'string' || !/^0x/.test(j.result)) throw new Error(j?.error?.message ?? 'bad eth_call response');
    return j.result as `0x${string}`;
  });
}
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const mcAbi = parseAbi(['struct Call3 { address target; bool allowFailure; bytes callData; }', 'struct Result { bool success; bytes returnData; }', 'function aggregate3(Call3[] calls) payable returns (Result[] returnData)']);
/** Batched read; failures come back as null per call. */
export async function multicall(f: Fetcher, urls: string[], calls: Array<{ to: string; data: `0x${string}` }>): Promise<Array<`0x${string}` | null>> {
  if (!calls.length) return [];
  const out: Array<`0x${string}` | null> = [];
  for (let i = 0; i < calls.length; i += 100) {
    const chunk = calls.slice(i, i + 100);
    const data = encodeFunctionData({ abi: mcAbi, functionName: 'aggregate3', args: [chunk.map((c) => ({ target: c.to as `0x${string}`, allowFailure: true, callData: c.data }))] });
    const raw = await ethCall(f, urls, MULTICALL3, data);
    const res = decodeFunctionResult({ abi: mcAbi, functionName: 'aggregate3', data: raw }) as ReadonlyArray<{ success: boolean; returnData: `0x${string}` }>;
    for (const r of res) out.push(r.success && r.returnData !== '0x' ? r.returnData : null);
  }
  return out;
}

// ======================================================= Lido (Ethereum)
export const LIDO = {
  stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as const,
  queue: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1' as const,
  aprUrl: 'https://eth-api.lido.fi/v1/protocol/steth/apr/sma',
  minWithdrawal: 100n, maxWithdrawal: 1000n * 10n ** 18n,
};
export const stethAbi = parseAbi(['function submit(address _referral) payable returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function approve(address spender, uint256 amount) returns (bool)', 'function allowance(address owner, address spender) view returns (uint256)']);
export const queueAbi = parseAbi([
  'function requestWithdrawals(uint256[] _amounts, address _owner) returns (uint256[] requestIds)',
  'function getWithdrawalRequests(address _owner) view returns (uint256[])',
  'function getWithdrawalStatus(uint256[] _requestIds) view returns ((uint256 amountOfStETH, uint256 amountOfShares, address owner, uint256 timestamp, bool isFinalized, bool isClaimed)[] statuses)',
  'function claimWithdrawal(uint256 _requestId)',
]);
const ZERO = '0x0000000000000000000000000000000000000000' as const;

const addr = (a: string) => getAddress(a.toLowerCase());
export function lidoStakePlan(amount: bigint): CallPlan[] {
  if (amount <= 0n) throw stakeError('bad_amount', 'Amount must be positive');
  return [{ to: LIDO.stETH, data: encodeFunctionData({ abi: stethAbi, functionName: 'submit', args: [ZERO] }), value: amount, label: 'Stake ETH (Lido submit)', gasFallback: 150_000n }];
}
/** approve (when allowance is short) + requestWithdrawals split into <= 1000 stETH chunks. */
export function lidoUnstakePlan(amount: bigint, owner: string, allowance: bigint): CallPlan[] {
  if (!isEvmAddress(owner)) throw stakeError('bad_request', 'Invalid owner');
  if (amount < LIDO.minWithdrawal) throw stakeError('bad_amount', 'Amount is below the Lido minimum withdrawal');
  const chunks: bigint[] = []; let left = amount;
  while (left > 0n) { const c = left > LIDO.maxWithdrawal ? LIDO.maxWithdrawal : left; if (c < LIDO.minWithdrawal) { chunks[chunks.length - 1] += c; break; } chunks.push(c); left -= c; }
  const plan: CallPlan[] = [];
  if (allowance < amount) plan.push({ to: LIDO.stETH, data: encodeFunctionData({ abi: stethAbi, functionName: 'approve', args: [LIDO.queue, amount] }), value: 0n, label: 'Approve stETH for the withdrawal queue', gasFallback: 70_000n });
  plan.push({ to: LIDO.queue, data: encodeFunctionData({ abi: queueAbi, functionName: 'requestWithdrawals', args: [chunks, addr(owner)] }), value: 0n, label: 'Request withdrawal', gasFallback: 120_000n + 60_000n * BigInt(chunks.length) });
  return plan;
}
export function lidoClaimPlan(requestId: bigint): CallPlan[] {
  return [{ to: LIDO.queue, data: encodeFunctionData({ abi: queueAbi, functionName: 'claimWithdrawal', args: [requestId] }), value: 0n, label: 'Claim ETH', gasFallback: 150_000n }];
}
export async function lidoApr(f: Fetcher): Promise<number | null> {
  try {
    const res = await f(LIDO.aprUrl, { signal: AbortSignal.timeout(8000) }); if (!res.ok) return null;
    const j: any = await res.json(); const v = Number(j?.data?.smaApr);
    return Number.isFinite(v) && v > 0 && v < 100 ? Math.round(v * 100) / 100 : null;
  } catch { return null; }
}
export async function lidoAllowance(f: Fetcher, urls: string[], owner: string): Promise<bigint> {
  const raw = await ethCall(f, urls, LIDO.stETH, encodeFunctionData({ abi: stethAbi, functionName: 'allowance', args: [addr(owner), LIDO.queue] }));
  return decodeFunctionResult({ abi: stethAbi, functionName: 'allowance', data: raw }) as bigint;
}
export async function fetchLidoOverview(f: Fetcher, urls: string[], owner: string): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  if (!isEvmAddress(owner)) throw stakeError('bad_address', 'Invalid Ethereum address');
  const o = addr(owner);
  const [balRaw, idsRaw, apr] = await Promise.all([
    ethCall(f, urls, LIDO.stETH, encodeFunctionData({ abi: stethAbi, functionName: 'balanceOf', args: [o] })),
    ethCall(f, urls, LIDO.queue, encodeFunctionData({ abi: queueAbi, functionName: 'getWithdrawalRequests', args: [o] })),
    lidoApr(f),
  ]);
  const bal = decodeFunctionResult({ abi: stethAbi, functionName: 'balanceOf', data: balRaw }) as bigint;
  const ids = [...(decodeFunctionResult({ abi: queueAbi, functionName: 'getWithdrawalRequests', data: idsRaw }) as readonly bigint[])];
  const positions: Position[] = [];
  if (bal > 0n) positions.push({ id: 'steth', validatorId: 'lido', validatorName: 'Lido', amount: bal.toString(), status: 'active', apr });
  let unbonding = 0n, claimable = 0n;
  if (ids.length) {
    const recent = ids.slice(-50);
    const stRaw = await ethCall(f, urls, LIDO.queue, encodeFunctionData({ abi: queueAbi, functionName: 'getWithdrawalStatus', args: [recent] }));
    const sts = decodeFunctionResult({ abi: queueAbi, functionName: 'getWithdrawalStatus', data: stRaw }) as ReadonlyArray<{ amountOfStETH: bigint; isFinalized: boolean; isClaimed: boolean; timestamp: bigint }>;
    sts.forEach((s, i) => {
      if (s.isClaimed) return;
      positions.push({ id: recent[i].toString(), validatorId: 'lido', validatorName: 'Lido', amount: s.amountOfStETH.toString(), status: s.isFinalized ? 'claimable' : 'unbonding' });
      if (s.isFinalized) claimable += s.amountOfStETH; else unbonding += s.amountOfStETH;
    });
  }
  const validators: Validator[] = [{ id: 'lido', name: 'Lido', description: 'Liquid staking pool (stETH)', website: 'https://lido.fi', apr, commission: 10, active: true }];
  return { overview: { chainId: 'ethereum', symbol: 'ETH', decimals: 18, staked: bal.toString(), rewards: '0', unbonding: unbonding.toString(), claimable: claimable.toString(), apr, positions, lockDays: null }, validators };
}

// ======================================================= BNB Chain StakeHub
export const STAKE_HUB = '0x0000000000000000000000000000000000002002' as const;
export const stakeHubAbi = parseAbi([
  'function getValidatorCreditContract(address operatorAddress) view returns (address)',
  'function delegate(address operatorAddress, bool delegateVotePower) payable',
  'function undelegate(address operatorAddress, uint256 shares)',
  'function redelegate(address srcValidator, address dstValidator, uint256 shares, bool delegateVotePower)',
  'function claim(address operatorAddress, uint256 requestNumber)',
]);
export const creditAbi = parseAbi([
  'function getPooledBNB(address account) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function getSharesByPooledBNB(uint256 bnbAmount) view returns (uint256)',
  'function pendingUnbondRequest(address delegator) view returns (uint256)',
  'function claimableUnbondRequest(address delegator) view returns (uint256)',
  'function unbondRequest(address delegator, uint256 _index) view returns (uint256 shares, uint256 bnbAmount, uint256 unlockTime)',
]);
export const isEvmAddress = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s) && isAddress(s.toLowerCase());

export function bscPlan(action: StakeAction, a: { validator?: string; toValidator?: string; amount?: bigint; shares?: bigint; requests?: bigint }): CallPlan[] {
  const v = a.validator; if (!isEvmAddress(v)) throw stakeError('bad_request', 'Invalid validator operator address');
  switch (action) {
    case 'stake':
      if (!a.amount || a.amount <= 0n) throw stakeError('bad_amount', 'Amount must be positive');
      return [{ to: STAKE_HUB, data: encodeFunctionData({ abi: stakeHubAbi, functionName: 'delegate', args: [addr(v), false] }), value: a.amount, label: 'Delegate BNB', gasFallback: 400_000n }];
    case 'unstake':
      if (!a.shares || a.shares <= 0n) throw stakeError('bad_amount', 'Amount must be positive');
      return [{ to: STAKE_HUB, data: encodeFunctionData({ abi: stakeHubAbi, functionName: 'undelegate', args: [addr(v), a.shares] }), value: 0n, label: 'Undelegate BNB', gasFallback: 450_000n }];
    case 'redelegate': {
      if (!isEvmAddress(a.toValidator)) throw stakeError('bad_request', 'Invalid destination validator');
      if (!a.shares || a.shares <= 0n) throw stakeError('bad_amount', 'Amount must be positive');
      return [{ to: STAKE_HUB, data: encodeFunctionData({ abi: stakeHubAbi, functionName: 'redelegate', args: [addr(v), addr(a.toValidator), a.shares, false] }), value: 0n, label: 'Redelegate BNB', gasFallback: 600_000n }];
    }
    case 'withdraw':
    case 'claim':
      return [{ to: STAKE_HUB, data: encodeFunctionData({ abi: stakeHubAbi, functionName: 'claim', args: [addr(v), a.requests ?? 0n] }), value: 0n, label: 'Claim unbonded BNB', gasFallback: 300_000n }];
    default: throw stakeError('unsupported', `BNB staking has no "${action}" action`);
  }
}
export async function bscSharesFor(f: Fetcher, urls: string[], credit: string, amount: bigint): Promise<bigint> {
  const raw = await ethCall(f, urls, credit, encodeFunctionData({ abi: creditAbi, functionName: 'getSharesByPooledBNB', args: [amount] }));
  return decodeFunctionResult({ abi: creditAbi, functionName: 'getSharesByPooledBNB', data: raw }) as bigint;
}
export async function bscCreditFor(f: Fetcher, urls: string[], operator: string): Promise<string> {
  const raw = await ethCall(f, urls, STAKE_HUB, encodeFunctionData({ abi: stakeHubAbi, functionName: 'getValidatorCreditContract', args: [addr(operator)] }));
  const c = decodeFunctionResult({ abi: stakeHubAbi, functionName: 'getValidatorCreditContract', data: raw }) as string;
  if (/^0x0{40}$/.test(c)) throw stakeError('unknown_validator', 'Validator is not registered in StakeHub');
  return c;
}
export async function bscBalanceShares(f: Fetcher, urls: string[], credit: string, owner: string): Promise<bigint> {
  const raw = await ethCall(f, urls, credit, encodeFunctionData({ abi: creditAbi, functionName: 'balanceOf', args: [addr(owner)] }));
  return decodeFunctionResult({ abi: creditAbi, functionName: 'balanceOf', data: raw }) as bigint;
}
export async function fetchBscOverview(f: Fetcher, urls: string[], owner: string, meta: ValidatorMeta[]): Promise<{ overview: StakeOverview; validators: Validator[] }> {
  if (!isEvmAddress(owner)) throw stakeError('bad_address', 'Invalid BNB Chain address');
  const o = addr(owner);
  const ops = meta.filter((m) => isEvmAddress(m.id)).slice(0, 60);
  const validators: Validator[] = ops.map((m) => ({ ...m, apr: null, commission: null, active: true }));
  if (!ops.length) return { overview: emptyBsc([]), validators };
  const credits = await multicall(f, urls, ops.map((m) => ({ to: STAKE_HUB, data: encodeFunctionData({ abi: stakeHubAbi, functionName: 'getValidatorCreditContract', args: [addr(m.id)] }) })));
  const creditOf: Array<string | null> = credits.map((r) => { if (!r) return null; try { const c = decodeFunctionResult({ abi: stakeHubAbi, functionName: 'getValidatorCreditContract', data: r }) as string; return /^0x0{40}$/.test(c) ? null : c; } catch { return null; } });
  validators.forEach((v, i) => { if (!creditOf[i]) v.active = false; });
  const live = creditOf.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const pooled = await multicall(f, urls, live.flatMap((i) => [
    { to: creditOf[i]!, data: encodeFunctionData({ abi: creditAbi, functionName: 'getPooledBNB', args: [o] }) },
    { to: creditOf[i]!, data: encodeFunctionData({ abi: creditAbi, functionName: 'pendingUnbondRequest', args: [o] }) },
    { to: creditOf[i]!, data: encodeFunctionData({ abi: creditAbi, functionName: 'claimableUnbondRequest', args: [o] }) },
  ]));
  const positions: Position[] = []; const reqCalls: Array<{ to: string; data: `0x${string}`; i: number; k: number }> = [];
  live.forEach((i, n) => {
    const dec = (k: number, fn: 'getPooledBNB' | 'pendingUnbondRequest' | 'claimableUnbondRequest') => { const r = pooled[n * 3 + k]; return r ? (decodeFunctionResult({ abi: creditAbi, functionName: fn, data: r }) as bigint) : 0n; };
    const amount = dec(0, 'getPooledBNB'), pending = dec(1, 'pendingUnbondRequest');
    if (amount > 0n) positions.push({ id: ops[i].id, validatorId: ops[i].id, validatorName: ops[i].name, amount: amount.toString(), status: 'active', apr: null });
    for (let k = 0n; k < (pending > 20n ? 20n : pending); k++) reqCalls.push({ to: creditOf[i]!, data: encodeFunctionData({ abi: creditAbi, functionName: 'unbondRequest', args: [o, k] }), i, k: Number(k) });
  });
  const reqs = await multicall(f, urls, reqCalls.map((r) => ({ to: r.to, data: r.data })));
  const now = Date.now();
  reqs.forEach((r, n) => {
    if (!r) return;
    const [, bnb, unlock] = decodeFunctionResult({ abi: creditAbi, functionName: 'unbondRequest', data: r }) as readonly [bigint, bigint, bigint];
    const at = Number(unlock) * 1000; const i = reqCalls[n].i;
    positions.push({ id: `${ops[i].id}:${reqCalls[n].k}`, validatorId: ops[i].id, validatorName: ops[i].name, amount: bnb.toString(), status: at <= now ? 'claimable' : 'unbonding', availableAt: at });
  });
  return { overview: emptyBsc(positions), validators };
}
function emptyBsc(positions: Position[]): StakeOverview {
  let staked = 0n, unbonding = 0n, claimable = 0n;
  for (const p of positions) { const v = BigInt(p.amount); if (p.status === 'active') staked += v; else if (p.status === 'unbonding') unbonding += v; else claimable += v; }
  return { chainId: 'smartchain', symbol: 'BNB', decimals: 18, staked: staked.toString(), rewards: '0', unbonding: unbonding.toString(), claimable: claimable.toString(), apr: null, positions, lockDays: 7 };
}
