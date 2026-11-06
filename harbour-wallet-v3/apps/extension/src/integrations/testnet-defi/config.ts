/** One switch restores the existing Swap aggregators and native staking screens/handlers. */
export const DEFI_CONFIG: Readonly<{ mode: 'testnet' | 'legacy' }> = Object.freeze({ mode: 'testnet' });
export const testnetDefiEnabled = (): boolean => DEFI_CONFIG.mode === 'testnet';

// https://developers.uniswap.org/deployments (Ethereum Sepolia, V3 + SwapRouter02)
// https://github.com/aave-dao/aave-address-book/blob/main/src/ts/AaveV3Sepolia.ts
export const SEPOLIA = Object.freeze({
  id: 'sepolia', chainId: 11155111, name: 'Ethereum Sepolia',
  pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
  dataProvider: '0x3e9708d80f7B3e43118013075F7e95CE3AB31F31',
  // Uniswap Trading API proxy used for TOKEN input when Permit2 is disabled (the gateway sends x-permit2-disabled: true).
  // It is both the approval spender and the swap target. Current CREATE2 address (same on every chain); the API may still
  // return the deprecated one, so both are accepted, and the swap must target the very proxy the approval named:
  // https://developers.uniswap.org/docs/trading/swapping-api/concepts/no-permit2-workflow
  apiRouter: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
  apiRouterLegacy: '0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9',
  // Native ETH input needs no approval, so the API targets the Universal Router directly (Sepolia deployment:
  // https://developers.uniswap.org/deployments). Its calldata is decoded and checked in universalRouter.ts.
  universalRouter: '0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3',
  // Verified against SwapRouter02.WETH9() and the Uniswap Core SDK WETH9 registry.
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
} as const);

// Official Aave V3 Base Sepolia market. Earn supports this market; Uniswap
// Swap remains on Ethereum Sepolia for now.
export type AaveDeployment = { id: string; chainId: number; name: string; pool: `0x${string}`; dataProvider: `0x${string}` };
export const BASE_SEPOLIA: AaveDeployment = Object.freeze({
  id: 'base-sepolia', chainId: 84532, name: 'Base Sepolia',
  pool: '0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27',
  dataProvider: '0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b',
} as const);

export const PLAN_TTL_MS = 120_000;
export const SWAP_BASES = [SEPOLIA.weth, '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'] as const;
export function assertTestnetNetwork(id: string): void {
  if (!testnetDefiEnabled() || id !== SEPOLIA.id) throw new Error('Select Ethereum Sepolia to test Uniswap Swap.');
}
export function aaveDeployment(id: string): AaveDeployment {
  if (!testnetDefiEnabled()) throw new Error('Testnet Earn is disabled.');
  if (id === BASE_SEPOLIA.id) return BASE_SEPOLIA;
  throw new Error('Select Base Sepolia to test Aave Earn.');
}
