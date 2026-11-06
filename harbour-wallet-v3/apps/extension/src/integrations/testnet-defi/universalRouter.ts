// Universal Router calldata check for Uniswap Trading API swaps with NATIVE ETH input (the API targets the router directly then;
// token input goes through the no-Permit2 proxy). The API is a remote party: before anything is signed, Harbour decodes
// `execute(commands, inputs, deadline)` and refuses anything that is not a plain swap paying the user:
//   - only swap / wrap / unwrap / sweep commands (no Permit2 pulls, TRANSFER, PAY_PORTION or anything else that moves funds);
//   - every recipient is the user, MSG_SENDER (address(1) = the user) or ADDRESS_THIS (address(2) = the router, intermediate);
//   - the reviewed minimum output is enforced: by one final step that pays the user (SWEEP / TAKE_ALL / UNWRAP_WETH), or by the
//     per-leg minimums of a split route adding up to it (each leg reverts on its own minimum, so the user gets at least the sum);
//   - every swap leg starts from the reviewed input asset and ends in the reviewed output asset, and the legs together spend
//     exactly the reviewed input (split routes divide it across several pools/legs). A leg may start from WETH only after the
//     router wrapped the user's ETH (WRAP_ETH to itself), and every settlement is paid by the router, never pulled from the wallet;
//   - the deadline is in the future and at most one hour away.
// Command ids: Uniswap universal-router Commands.sol; V4 action ids: v4-periphery Actions.sol.
import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, parseAbi, zeroAddress } from 'viem';
import type { Address, Hex } from 'viem';

const UR_ABI = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);
const C = { V3_IN: 0x00, SWEEP: 0x04, V2_IN: 0x08, WRAP_ETH: 0x0b, UNWRAP_WETH: 0x0c, V4_SWAP: 0x10 } as const;
const A = { SWAP_EXACT_IN_SINGLE: 0x06, SWAP_EXACT_IN: 0x07, SETTLE: 0x0b, SETTLE_ALL: 0x0c, TAKE: 0x0e, TAKE_ALL: 0x0f } as const;
const MSG_SENDER = '0x0000000000000000000000000000000000000001', ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
const POOL_KEY = { type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] } as const;
const PATH_KEY = { type: 'tuple[]', components: [{ name: 'intermediateCurrency', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }, { name: 'hookData', type: 'bytes' }] } as const;
// v4-periphery has shipped two layouts of the exact-in structs (the newer adds per-hop slippage). A candidate is accepted only if
// it decodes AND re-encodes to exactly the same bytes (canonical ABI), so a wrong layout can never be mistaken for a right one;
// its input currency must then match the reviewed swap.
const EXACT_IN_LAYOUTS = [
  [{ type: 'tuple', components: [{ name: 'currencyIn', type: 'address' }, { name: 'path', ...PATH_KEY }, { name: 'maxHopSlippage', type: 'uint256[]' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }] }],
  [{ type: 'tuple', components: [{ name: 'currencyIn', type: 'address' }, { name: 'path', ...PATH_KEY }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }] }],
] as const;
const EXACT_IN_SINGLE_LAYOUTS = [
  [{ type: 'tuple', components: [{ name: 'poolKey', ...POOL_KEY }, { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }, { name: 'minHopPriceX36', type: 'uint256' }, { name: 'hookData', type: 'bytes' }] }],
  [{ type: 'tuple', components: [{ name: 'poolKey', ...POOL_KEY }, { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }, { name: 'hookData', type: 'bytes' }] }],
] as const;

export interface RouterExpectation { owner: Address; tokenIn: Address; tokenOut: Address; amountIn: bigint; minimumOut: bigint; weth: Address; nowSec: number }
const bad = (why: string): never => { throw new Error(`Uniswap returned a swap Harbour cannot verify (${why}). Nothing was submitted.`); };
const eq = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();

export function checkUniversalRouterSwap(data: Hex, x: RouterExpectation): void {
  let commands: Hex, inputs: readonly Hex[], deadline: bigint;
  try { ({ args: [commands, inputs, deadline] } = decodeFunctionData({ abi: UR_ABI, data }) as any); } catch { return bad('not a router call'); }
  const ids = (commands.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16));
  if (!ids.length || ids.length !== inputs.length || ids.length > 8) bad('malformed commands');
  if (deadline <= BigInt(x.nowSec) || deadline > BigInt(x.nowSec + 3600)) bad('deadline');
  const recipientOk = (r: unknown) => eq(r, x.owner) || eq(r, MSG_SENDER) || eq(r, ADDRESS_THIS);
  const paysUser = (r: unknown) => eq(r, x.owner) || eq(r, MSG_SENDER);
  const outIsEth = eq(x.tokenOut, zeroAddress); const inIsEth = eq(x.tokenIn, zeroAddress);
  let minimumEnforced = false; let spent = 0n; let legMinimums = 0n; let legs = 0n; let wrapped = false;
  // The asset a swap leg may start from: the reviewed input, or WETH once the router has wrapped the user's ETH.
  const inputOk = (cur: unknown) => eq(cur, x.tokenIn) || (inIsEth && wrapped && eq(cur, x.weth));
  // A leg's spend is a positive share of the reviewed input (split routes); the total is checked against it after all steps.
  const leg = (amountIn: bigint) => { if (amountIn <= 0n || amountIn > x.amountIn) bad('swap leg amount'); spent += amountIn; legs += 1n; };
  const strict = (layouts: readonly (readonly unknown[])[], p: Hex): any => {
    for (const l of layouts) {
      try { const v = decodeAbiParameters(l as any, p) as any; if (encodeAbiParameters(l as any, v).toLowerCase() === p.toLowerCase()) return v[0]; } catch { /* next layout */ }
    }
    return null;
  };
  const dec = <T>(types: readonly unknown[], hex: Hex): T => { try { return decodeAbiParameters(types as any, hex) as T; } catch { return bad('undecodable step'); } };
  ids.forEach((raw, i) => {
    const id = raw & 0x3f; const input = inputs[i];
    if (raw & 0x80) bad('reverting steps are not allowed'); // allow-revert flag: a skipped step could drop the minimum check
    switch (id) {
      case C.WRAP_ETH: { const [r] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); if (eq(r, ADDRESS_THIS)) wrapped = true; break; }
      case C.UNWRAP_WETH: { const [r, min] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); if (outIsEth && paysUser(r) && min >= x.minimumOut) minimumEnforced = true; break; }
      case C.SWEEP: { const [token, r, min] = dec<[Address, Address, bigint]>([{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); if (eq(token, x.tokenOut) && paysUser(r) && min >= x.minimumOut) minimumEnforced = true; break; }
      case C.V3_IN: case C.V2_IN: {
        const pathType = id === C.V3_IN ? { type: 'bytes' } : { type: 'address[]' };
        const [r, amountIn, min, path, payerIsUser] = dec<[Address, bigint, bigint, Hex | Address[], boolean]>([{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, pathType, { type: 'bool' }], input);
        if (!recipientOk(r)) bad('recipient');
        if (payerIsUser) bad('token pull from the wallet'); // native input: the router pays from the ETH it was sent, never via Permit2
        leg(amountIn);
        const first = typeof path === 'string' ? `0x${path.slice(2, 42)}` : path[0];
        if (!eq(first, inIsEth ? x.weth : x.tokenIn) || (inIsEth && !wrapped)) bad('input asset'); // V2/V3 pools trade WETH, never native ETH
        const last = typeof path === 'string' ? `0x${path.slice(-40)}` : path[path.length - 1];
        const lastOk = eq(last, outIsEth ? x.weth : x.tokenOut);
        if (!lastOk) bad('output asset');
        if (paysUser(r) && !outIsEth) legMinimums += min; // this leg pays the user directly and reverts below its own minimum
        break;
      }
      case C.V4_SWAP: {
        const [actions, params] = dec<[Hex, readonly Hex[]]>([{ type: 'bytes' }, { type: 'bytes[]' }], input);
        const acts = (actions.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16));
        if (!acts.length || acts.length !== params.length || acts.length > 8) bad('malformed V4 actions');
        acts.forEach((a, j) => {
          const p = params[j];
          if (a === A.SWAP_EXACT_IN) {
            const hit = strict(EXACT_IN_LAYOUTS, p);
            if (!hit || !inputOk(hit.currencyIn) || !hit.path.length) bad('V4 swap amount or input asset');
            if (!eq(hit.path[hit.path.length - 1].intermediateCurrency, x.tokenOut)) bad('output asset');
            leg(hit.amountIn); legMinimums += hit.amountOutMinimum;
          } else if (a === A.SWAP_EXACT_IN_SINGLE) {
            const hit = strict(EXACT_IN_SINGLE_LAYOUTS, p);
            if (!hit || !inputOk(hit.zeroForOne ? hit.poolKey.currency0 : hit.poolKey.currency1)) bad('V4 swap amount or input asset');
            if (!eq(hit.zeroForOne ? hit.poolKey.currency1 : hit.poolKey.currency0, x.tokenOut)) bad('output asset');
            leg(hit.amountIn); legMinimums += hit.amountOutMinimum;
          } else if (a === A.SETTLE) {
            const [cur, , payerIsUser] = dec<[Address, bigint, boolean]>([{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }], p);
            if (!inputOk(cur)) bad('settled asset');
            if (payerIsUser && !eq(cur, zeroAddress)) bad('token pull from the wallet'); // an ERC-20 paid by the user is a Permit2 pull
          } else if (a === A.SETTLE_ALL) {
            const [cur, max] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], p);
            if (!eq(cur, x.tokenIn) || max > x.amountIn) bad('settled asset or amount');
          } else if (a === A.TAKE) {
            const [, r] = dec<[Address, Address, bigint]>([{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], p); if (!recipientOk(r)) bad('recipient');
          } else if (a === A.TAKE_ALL) {
            const [cur, min] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], p); // TAKE_ALL always pays msg.sender (the user)
            if (eq(cur, x.tokenOut) && min >= x.minimumOut) minimumEnforced = true;
          } else bad(`V4 action 0x${a.toString(16)}`);
        });
        break;
      }
      default: bad(`router command 0x${id.toString(16)}`);
    }
  });
  if (spent !== x.amountIn) bad('input amount');
  // Uniswap floors each leg's minimum separately, so a split route's minimums can sum to (legs - 1) wei under the quoted minimum.
  if (!minimumEnforced && (legs === 0n || legMinimums + legs - 1n < x.minimumOut)) bad('minimum output not enforced');
}
