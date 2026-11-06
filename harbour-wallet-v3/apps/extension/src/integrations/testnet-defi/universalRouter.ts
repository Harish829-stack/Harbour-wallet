// Universal Router calldata check for Uniswap Trading API swaps with NATIVE ETH input (the API targets the router directly then;
// token input goes through the no-Permit2 proxy). The API is a remote party: before anything is signed, Harbour decodes
// `execute(commands, inputs, deadline)` and refuses anything that is not a plain swap paying the user:
//   - only swap / wrap / unwrap / sweep commands (no Permit2 pulls, TRANSFER, PAY_PORTION or anything else that moves funds);
//   - every recipient is the user, MSG_SENDER (address(1) = the user) or ADDRESS_THIS (address(2) = the router, intermediate);
//   - the leg that pays the user enforces at least the reviewed minimum output;
//   - the swap spends exactly the reviewed input, starts from the reviewed input asset and ends in the reviewed output asset;
//   - the deadline is in the future and at most one hour away.
// Command ids: Uniswap universal-router Commands.sol; V4 action ids: v4-periphery Actions.sol.
import { decodeAbiParameters, decodeFunctionData, parseAbi, zeroAddress } from 'viem';
import type { Address, Hex } from 'viem';

const UR_ABI = parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);
const C = { V3_IN: 0x00, SWEEP: 0x04, V2_IN: 0x08, WRAP_ETH: 0x0b, UNWRAP_WETH: 0x0c, V4_SWAP: 0x10 } as const;
const A = { SWAP_EXACT_IN_SINGLE: 0x06, SWAP_EXACT_IN: 0x07, SETTLE: 0x0b, SETTLE_ALL: 0x0c, TAKE: 0x0e, TAKE_ALL: 0x0f } as const;
const MSG_SENDER = '0x0000000000000000000000000000000000000001', ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
const POOL_KEY = { type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] } as const;
const PATH_KEY = { type: 'tuple[]', components: [{ name: 'intermediateCurrency', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }, { name: 'hookData', type: 'bytes' }] } as const;
// v4-periphery has shipped two layouts of the exact-in structs (the newer adds per-hop slippage). Each candidate is accepted only
// if it decodes AND its amountIn / input currency match the reviewed swap, so a wrong layout can never be mistaken for a right one.
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
  let minimumEnforced = false; let spent = 0n;
  const dec = <T>(types: readonly unknown[], hex: Hex): T => { try { return decodeAbiParameters(types as any, hex) as T; } catch { return bad('undecodable step'); } };
  ids.forEach((raw, i) => {
    const id = raw & 0x3f; const input = inputs[i];
    if (raw & 0x80) bad('reverting steps are not allowed'); // allow-revert flag: a skipped step could drop the minimum check
    switch (id) {
      case C.WRAP_ETH: { const [r] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); break; }
      case C.UNWRAP_WETH: { const [r, min] = dec<[Address, bigint]>([{ type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); if (outIsEth && paysUser(r) && min >= x.minimumOut) minimumEnforced = true; break; }
      case C.SWEEP: { const [token, r, min] = dec<[Address, Address, bigint]>([{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], input); if (!recipientOk(r)) bad('recipient'); if (eq(token, x.tokenOut) && paysUser(r) && min >= x.minimumOut) minimumEnforced = true; break; }
      case C.V3_IN: case C.V2_IN: {
        const pathType = id === C.V3_IN ? { type: 'bytes' } : { type: 'address[]' };
        const [r, amountIn, min, path, payerIsUser] = dec<[Address, bigint, bigint, Hex | Address[], boolean]>([{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, pathType, { type: 'bool' }], input);
        if (!recipientOk(r)) bad('recipient');
        if (payerIsUser) bad('token pull from the wallet'); // native input: the router pays from the ETH it was sent, never via Permit2
        spent += amountIn;
        const last = typeof path === 'string' ? `0x${path.slice(-40)}` : path[path.length - 1];
        const lastOk = eq(last, outIsEth ? x.weth : x.tokenOut);
        if (!lastOk) bad('output asset');
        if (paysUser(r) && !outIsEth && min >= x.minimumOut) minimumEnforced = true;
        break;
      }
      case C.V4_SWAP: {
        const [actions, params] = dec<[Hex, readonly Hex[]]>([{ type: 'bytes' }, { type: 'bytes[]' }], input);
        const acts = (actions.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16));
        if (!acts.length || acts.length !== params.length || acts.length > 8) bad('malformed V4 actions');
        acts.forEach((a, j) => {
          const p = params[j];
          if (a === A.SWAP_EXACT_IN) {
            const hit = EXACT_IN_LAYOUTS.map((l) => { try { return (decodeAbiParameters(l as any, p) as any)[0]; } catch { return null; } })
              .find((v) => v && v.amountIn === x.amountIn && eq(v.currencyIn, x.tokenIn) && v.path.length > 0);
            if (!hit) bad('V4 swap amount or input asset');
            if (!eq(hit.path[hit.path.length - 1].intermediateCurrency, x.tokenOut)) bad('output asset');
            spent += hit.amountIn; if (hit.amountOutMinimum >= x.minimumOut) minimumEnforced = true;
          } else if (a === A.SWAP_EXACT_IN_SINGLE) {
            const hit = EXACT_IN_SINGLE_LAYOUTS.map((l) => { try { return (decodeAbiParameters(l as any, p) as any)[0]; } catch { return null; } })
              .find((v) => v && v.amountIn === x.amountIn && eq(v.zeroForOne ? v.poolKey.currency0 : v.poolKey.currency1, x.tokenIn));
            if (!hit) bad('V4 swap amount or input asset');
            if (!eq(hit.zeroForOne ? hit.poolKey.currency1 : hit.poolKey.currency0, x.tokenOut)) bad('output asset');
            spent += hit.amountIn; if (hit.amountOutMinimum >= x.minimumOut) minimumEnforced = true;
          } else if (a === A.SETTLE) {
            const [cur, , payerIsUser] = dec<[Address, bigint, boolean]>([{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }], p);
            if (!eq(cur, x.tokenIn)) bad('settled asset');
            if (payerIsUser && !inIsEth) bad('token pull from the wallet');
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
  if (!minimumEnforced) bad('minimum output not enforced');
}
