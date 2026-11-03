import { parseAbi } from 'viem';

export const tokenAbi = parseAbi([
  'function symbol() view returns (string)', 'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
export const poolAbi = parseAbi([
  'function getReservesList() view returns (address[])',
  'function getConfiguration(address) view returns (uint256 data)',
  'function supply(address,uint256,address,uint16)',
  'function withdraw(address,uint256,address) returns (uint256)',
]);
export const dataAbi = parseAbi([
  'function getReserveTokensAddresses(address) view returns (address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress)',
  'function getReserveData(address) view returns (uint256 unbacked,uint256 accruedToTreasuryScaled,uint256 totalAToken,uint256 totalStableDebt,uint256 totalVariableDebt,uint256 liquidityRate,uint256 variableBorrowRate,uint256 stableBorrowRate,uint256 averageStableBorrowRate,uint256 liquidityIndex,uint256 variableBorrowIndex,uint40 lastUpdateTimestamp)',
]);
export const factoryAbi = parseAbi(['function getPool(address,address,uint24) view returns (address)']);
export const liquidityAbi = parseAbi(['function liquidity() view returns (uint128)']);
export const quoterAbi = parseAbi(['function quoteExactInput(bytes,uint256) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)']);
export const routerAbi = parseAbi([
  'struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }',
  'function exactInput(ExactInputParams params) payable returns (uint256)',
  'function multicall(uint256 deadline,bytes[] data) payable returns (bytes[])',
]);
export const wethAbi = parseAbi(['function deposit() payable', 'function withdraw(uint256)']);
