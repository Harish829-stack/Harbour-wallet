// AaveKit (Aave's official V3 GraphQL API, the backend behind @aave/client) for Earn.
// https://aave.com/docs/aave-v3/getting-started/graphql — endpoint https://api.v3.aave.com/graphql
//
// We call the API directly instead of bundling @aave/client: the SDK needs viem >= 2.31
// (Harbour pins 2.21.19) and adds urql/graphcache to the service worker. The SDK's
// supply/withdraw actions are thin wrappers over these same GraphQL queries.
//
// Trust model: AaveKit is an untrusted calldata builder. Every transaction it returns is
// decoded and checked against the reviewed token, amount, owner, chain and a fixed
// contract allowlist (Aave address book) before it can enter a review. Balances and
// supplied amounts are read on-chain, not taken from the API.
import { decodeFunctionData, formatUnits, getAddress, isAddress, parseAbi, zeroAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { poolAbi, tokenAbi } from './abis';
import { sameAddress } from './rpc';
import { reserve } from './aave';
import type { DefiClient } from './rpc';
import type { AaveDeployment } from './config';
import type { DefiCall, EarnAsset, PreparedDefi } from './types';

export const AAVEKIT_URL = 'https://api.v3.aave.com/graphql';
/** Earn uses AaveKit first; ERC-20 reserves fall back to direct contract reads/calls if the API is down. */
export const EARN_PROVIDER: 'aavekit' | 'onchain' = 'aavekit';
export const NATIVE_TOKEN: Address = zeroAddress;

// https://github.com/aave-dao/aave-address-book/blob/main/src/ts/AaveV3BaseSepolia.ts
const PERIPHERY: Record<number, { addressesProvider: Address; gateway: Address }> = {
  84532: { addressesProvider: '0xE4C23309117Aa30342BFaae6c95c6478e0A4Ad00', gateway: '0x0568130e794429D2eEBC4dafE18f25Ff1a1ed8b6' },
};
/** Aave WETH gateway for a chain (the spender of the aWETH approval made by a native withdraw), if the market has one. */
export const aaveGateway = (chainId: number): Address | undefined => PERIPHERY[chainId]?.gateway;
export const gatewayAbi = parseAbi([
  'function depositETH(address,address onBehalfOf,uint16 referralCode) payable',
  'function withdrawETH(address,uint256 amount,address to)',
]);

/** Network/API failures; callers may fall back to on-chain. Validation failures are plain Errors and never fall back. */
export class AaveKitUnavailable extends Error {}
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const friendly = (message: string): string => {
  if (/supply cap/i.test(message)) return 'This deposit exceeds the remaining supply cap.';
  if (/no supply to withdraw|not enough|exceeds/i.test(message)) return 'This amount is not available to withdraw.';
  if (/health factor|collateral/i.test(message)) return 'This withdrawal would put your borrowed position at risk.';
  if (/paused|frozen|inactive/i.test(message)) return 'This Aave reserve is not accepting this action right now.';
  return 'Aave could not prepare this transaction. Try again shortly.';
};

export async function aaveKitQuery<T>(query: string, variables: Record<string, unknown>, fetcher: Fetcher = fetch): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let body: any;
  try {
    const response = await fetcher(AAVEKIT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }), signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new AaveKitUnavailable('Aave data is temporarily unavailable. Try again shortly.');
    body = await response.json();
  } catch (error) {
    if (error instanceof AaveKitUnavailable) throw error;
    throw new AaveKitUnavailable('Aave data is temporarily unavailable. Try again shortly.');
  } finally { clearTimeout(timer); }
  if (body?.errors?.length) {
    const message = String(body.errors[0]?.message ?? '');
    if (/bad user input/i.test(message)) throw new Error(friendly(message));
    throw new AaveKitUnavailable('Aave data is temporarily unavailable. Try again shortly.');
  }
  if (!body?.data) throw new AaveKitUnavailable('Aave data is temporarily unavailable. Try again shortly.');
  return body.data as T;
}

const MARKETS = `query HarbourEarnMarkets($r: MarketsRequest!) { markets(request: $r) { address chain { chainId }
  reserves(request: { reserveType: SUPPLY }) { underlyingToken { address symbol decimals } aToken { address } acceptsNative { symbol decimals }
    isFrozen isPaused supplyInfo { apy { formatted } supplyCapReached supplyCap { amount { raw } } total { value } } } } }`;
const TX = 'to from data value chainId operation';
const PLAN = `__typename ... on TransactionRequest { ${TX} } ... on ApprovalRequired { approval { ${TX} } originalTransaction { ${TX} } }
  ... on InsufficientBalanceError { required { value } available { value } }`;
const SUPPLY = `query HarbourEarnSupply($r: SupplyRequest!) { value: supply(request: $r) { ${PLAN} } }`;
const WITHDRAW = `query HarbourEarnWithdraw($r: WithdrawRequest!) { value: withdraw(request: $r) { ${PLAN} } }`;

interface KitReserve {
  underlyingToken: { address: string; symbol: string; decimals: number }; aToken: { address: string };
  acceptsNative: { symbol: string; decimals: number } | null; isFrozen: boolean; isPaused: boolean;
  supplyInfo: { apy: { formatted: string }; supplyCapReached: boolean; supplyCap: { amount: { raw: string } }; total: { value: string } };
}
interface KitTx { to: string; from: string; data: string; value: string; chainId: number; operation?: string | null }
type KitPlan = ({ __typename: 'TransactionRequest' } & KitTx)
  | { __typename: 'ApprovalRequired'; approval: KitTx; originalTransaction: KitTx }
  | { __typename: 'InsufficientBalanceError' };

const addr = (value: unknown): Address => {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new AaveKitUnavailable('Aave returned invalid market data.');
  return getAddress(value.toLowerCase());
};

async function kitReserves(deployment: AaveDeployment, fetcher?: Fetcher): Promise<KitReserve[]> {
  const data = await aaveKitQuery<{ markets: { address: string; chain: { chainId: number }; reserves: KitReserve[] }[] }>(MARKETS, { r: { chainIds: [deployment.chainId] } }, fetcher);
  // Only the reviewed market (address book) is accepted, even if the API lists others.
  const market = data.markets?.find((m) => m.chain?.chainId === deployment.chainId && sameAddress(m.address, deployment.pool));
  if (!market) throw new AaveKitUnavailable(`Aave has no ${deployment.name} market right now.`);
  return market.reserves ?? [];
}

/** Reserve state (active/paused/frozen/cap/liquidity) and balances come from the chain, not the API. AaveKit
 *  reports supplyCapReached=true for Base Sepolia reserves whose on-chain cap is 0 (= unlimited), e.g. USDC/USDT,
 *  so its flags are not used for gating. Returns the ERC-20 row and, for the wrapped-native reserve, the ETH row. */
async function toAssets(client: DefiClient, owner: Address, r: KitReserve, deployment: AaveDeployment, want: 'erc20' | 'native' | 'both'): Promise<EarnAsset[]> {
  const onchain = await reserve(client, addr(r.underlyingToken.address), owner, deployment);
  if (!sameAddress(onchain.aToken, r.aToken.address)) throw new AaveKitUnavailable('Aave returned inconsistent market data.');
  const apy = Number(r.supplyInfo.apy?.formatted);
  const base = { ...onchain, apy: Number.isFinite(apy) ? apy : onchain.apy };
  const out: EarnAsset[] = want === 'native' ? [] : [base];
  if (want !== 'erc20' && r.acceptsNative && PERIPHERY[deployment.chainId]) {
    const balance = await client.getBalance({ address: owner });
    out.unshift({ ...base, address: NATIVE_TOKEN, symbol: String(r.acceptsNative.symbol).slice(0, 24), decimals: 18, balance: balance.toString() });
  }
  return out;
}

export async function listEarnAssetsKit(client: DefiClient, owner: Address, deployment: AaveDeployment, fetcher?: Fetcher): Promise<EarnAsset[]> {
  const reserves = await kitReserves(deployment, fetcher);
  // One on-chain read set per reserve; the ETH row reuses the WETH reserve's state.
  const results = await Promise.allSettled(reserves.map((r) => toAssets(client, owner, r, deployment, 'both')));
  const assets = results.flatMap((x) => x.status === 'fulfilled' ? x.value : []);
  // Native ETH first (supplied through Aave's WETH gateway).
  return assets.filter((a) => a.canSupply || BigInt(a.supplied) > 0n).sort((a, b) => Number(b.address === NATIVE_TOKEN) - Number(a.address === NATIVE_TOKEN));
}

/** Reads only the reserve being reviewed (not the whole market). */
async function kitAsset(client: DefiClient, owner: Address, token: Address, deployment: AaveDeployment, fetcher?: Fetcher): Promise<EarnAsset | undefined> {
  const reserves = await kitReserves(deployment, fetcher);
  const native = token === NATIVE_TOKEN;
  const r = native ? reserves.find((x) => x.acceptsNative) : reserves.find((x) => sameAddress(x.underlyingToken.address, token));
  if (!r) return undefined;
  return (await toAssets(client, owner, r, deployment, native ? 'native' : 'erc20'))[0];
}

const bad = (): never => { throw new Error('Aave returned an unexpected transaction. Nothing was sent.'); };

/** Decodes one AaveKit transaction and accepts only the exact call the user reviewed. Exported for tests. */
export function verifyKitTx(tx: KitTx, ctx: { owner: Address; token: Address; aToken: Address; amount: bigint; action: 'supply' | 'withdraw'; deployment: AaveDeployment }, step: 'approval' | 'main'): DefiCall {
  const { owner, token, aToken, amount, action, deployment } = ctx;
  const native = token === NATIVE_TOKEN;
  const periphery = PERIPHERY[deployment.chainId];
  if (Number(tx.chainId) !== deployment.chainId || !sameAddress(tx.from, owner)) bad();
  if (typeof tx.data !== 'string' || !/^0x[0-9a-fA-F]*$/.test(tx.data)) bad();
  const to = addr(tx.to); const data = tx.data as Hex;
  let value: bigint; try { value = BigInt(tx.value ?? '0'); } catch { return bad(); }
  if (step === 'approval') {
    // ERC-20 supply approves the underlying to the Pool; native withdraw approves aWETH to the gateway.
    const expectedToken = action === 'supply' && !native ? token : action === 'withdraw' && native ? aToken : bad();
    const spender = action === 'supply' ? deployment.pool : periphery?.gateway ?? bad();
    if (!sameAddress(to, expectedToken) || value !== 0n) bad();
    const call = decodeFunctionData({ abi: tokenAbi, data });
    // Never accept unlimited approvals: allow at most 1% over the reviewed amount (interest rounding).
    if (call.functionName !== 'approve' || !sameAddress(call.args[0] as string, spender) || (call.args[1] as bigint) < amount || (call.args[1] as bigint) > amount + amount / 100n + 1n) bad();
    return { to, data, value, label: 'Approve exact amount' };
  }
  if (native) {
    if (!periphery || !sameAddress(to, periphery.gateway)) bad();
    const call = decodeFunctionData({ abi: gatewayAbi, data });
    // The gateway ignores the first argument; AaveKit passes the addresses provider.
    const poolArg = call.args[0] as string;
    if (!sameAddress(poolArg, deployment.pool) && !sameAddress(poolArg, periphery!.addressesProvider)) bad();
    if (action === 'supply' && (call.functionName !== 'depositETH' || !sameAddress(call.args[1] as string, owner) || value !== amount)) bad();
    if (action === 'withdraw' && (call.functionName !== 'withdrawETH' || call.args[1] !== amount || !sameAddress(call.args[2] as string, owner) || value !== 0n)) bad();
    return { to, data, value, label: action === 'supply' ? 'Supply ETH to Aave V3' : 'Withdraw ETH from Aave V3' };
  }
  if (!sameAddress(to, deployment.pool) || value !== 0n) bad();
  const call = decodeFunctionData({ abi: poolAbi, data });
  if (action === 'supply' && (call.functionName !== 'supply' || !sameAddress(call.args[0] as string, token) || call.args[1] !== amount || !sameAddress(call.args[2] as string, owner))) bad();
  if (action === 'withdraw' && (call.functionName !== 'withdraw' || !sameAddress(call.args[0] as string, token) || call.args[1] !== amount || !sameAddress(call.args[2] as string, owner))) bad();
  return { to, data, value, label: action === 'supply' ? 'Supply to Aave V3' : 'Withdraw from Aave V3' };
}

export async function prepareEarnKit(client: DefiClient, owner: Address, token: Address, amount: bigint, action: 'supply' | 'withdraw', deployment: AaveDeployment, fetcher?: Fetcher): Promise<PreparedDefi> {
  const asset = await kitAsset(client, owner, token, deployment, fetcher);
  if (!asset) throw new Error(`This token is not supported by Aave on ${deployment.name}.`);
  if (action === 'supply') {
    if (!asset.canSupply) throw new Error(asset.reason ?? 'Deposits are unavailable.');
    if (amount > BigInt(asset.balance)) throw new Error('Insufficient token balance.');
    if (asset.supplyRemaining !== null && amount > BigInt(asset.supplyRemaining)) throw new Error('This deposit exceeds the remaining supply cap.');
  } else {
    if (!asset.canWithdraw || amount > BigInt(asset.supplied)) throw new Error('This amount is not available to withdraw.');
    if (amount > BigInt(asset.availableLiquidity)) throw new Error('There is not enough available liquidity to withdraw this amount.');
  }
  const native = token === NATIVE_TOKEN;
  const value = formatUnits(amount, asset.decimals);
  const reserveToken = native ? undefined : token;
  const r = action === 'supply'
    ? { market: deployment.pool, chainId: deployment.chainId, sender: owner, amount: native ? { native: value } : { erc20: { currency: reserveToken, value } } }
    : { market: deployment.pool, chainId: deployment.chainId, sender: owner, amount: native ? { native: { value: { exact: value } } } : { erc20: { currency: reserveToken, value: { exact: value } } } };
  let plan: KitPlan;
  try { ({ value: plan } = await aaveKitQuery<{ value: KitPlan }>(action === 'supply' ? SUPPLY : WITHDRAW, { r }, fetcher)); }
  catch (error) {
    // On-chain checks above already passed; if AaveKit disagrees (e.g. its cap quirk), let ERC-20
    // reserves use the direct contract builder, which re-validates and is simulated before review.
    if (!native && !(error instanceof AaveKitUnavailable)) throw new AaveKitUnavailable(error instanceof Error ? error.message : 'AaveKit refused.');
    throw error;
  }
  if (plan?.__typename === 'InsufficientBalanceError') throw new Error('Insufficient token balance.');
  const ctx = { owner, token, aToken: asset.aToken, amount, action, deployment };
  const calls = plan?.__typename === 'ApprovalRequired'
    ? [verifyKitTx(plan.approval, ctx, 'approval'), verifyKitTx(plan.originalTransaction, ctx, 'main')]
    : plan?.__typename === 'TransactionRequest' ? [verifyKitTx(plan, ctx, 'main')] : bad();
  return { calls, review: { action, symbol: asset.symbol, decimals: asset.decimals, amount: amount.toString(), apy: asset.apy } };
}
