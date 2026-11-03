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
export const wethAbi = parseAbi(['function deposit() payable', 'function withdraw(uint256)']);
