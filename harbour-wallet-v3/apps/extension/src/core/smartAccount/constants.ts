// Smart accounts (EIP-7702 + ERC-4337 v0.7). Everything an operation may touch is pinned HERE, per chain, in the build:
// the delegate contract, the EntryPoint and the paymasters. Nothing in this file (or any address a signature depends on) is ever
// taken from a bundler, paymaster, backend or dApp reply. Changing a pin is a reviewed code change (documentation/smart-accounts/02).
export type Address = `0x${string}`;

/** Remote feature flag (signed config). Off by default; everything in core/smartAccount is unreachable while it is false. */
export const SMART_ACCOUNT_FLAG = 'smartAccounts';

/** ERC-4337 EntryPoint v0.7, the one MetaMask's EIP7702StatelessDeleGator v1.3.0 targets. */
export const ENTRYPOINT_V07: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

/** MetaMask EIP7702StatelessDeleGator v1.3.0 per EVM chain id (lowercase). Testnets only until the P7 checks run per mainnet.
 *  The runtime code differs between chains in exactly two immutables (chain id and EIP-712 domain separator): never compare raw
 *  code hashes across chains. */
export const DELEGATES: Readonly<Record<number, Address>> = Object.freeze({
  11155111: '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b',
  84532: '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b',
});

/** Paymasters a sponsored operation may name, per chain (lowercase). Pimlico's verifying paymaster (v0.7), observed on both testnets. */
export const PAYMASTERS: Readonly<Record<number, readonly Address[]>> = Object.freeze({
  11155111: Object.freeze(['0x777777777777aec03fd955926dbf81597e66834c'] as Address[]),
  84532: Object.freeze(['0x777777777777aec03fd955926dbf81597e66834c'] as Address[]),
});

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';
/** Fixed gas limit for the self-sent upgrade / revoke transaction. Measured: 58,061 (Sepolia) and 36,844 (Base Sepolia). */
export const TYPE4_GAS_LIMIT = 150_000n;
/** Most calls in one operation, and how long a prepared operation stays valid (ms). */
export const MAX_CALLS = 16;
export const PREPARED_TTL_MS = 120_000;

/** Upper bounds the guard enforces on gas numbers a provider returns (wei / gas units). Testnet-safe, tightened per chain before mainnet. */
export const LIMITS = Object.freeze({
  maxCallGasLimit: 5_000_000n,
  maxVerificationGasLimit: 2_000_000n,
  maxPreVerificationGas: 1_000_000n,
  maxPaymasterVerificationGasLimit: 1_000_000n,
  maxPaymasterPostOpGasLimit: 1_000_000n,
  /** Highest total fee (gas limits x maxFeePerGas) the user can be asked to pay for one operation, in wei. 0.01 ETH. */
  maxTotalFeeWei: 10_000_000_000_000_000n,
  /** Highest maxFeePerGas accepted (wei). 1000 gwei. */
  maxFeePerGasWei: 1_000_000_000_000n,
});

export const delegateFor = (chainId: number): Address | null => DELEGATES[chainId] ?? null;
export const isSmartAccountChain = (chainId: number): boolean => Object.prototype.hasOwnProperty.call(DELEGATES, chainId);
export const isPinnedPaymaster = (chainId: number, a: string): boolean => (PAYMASTERS[chainId] ?? []).includes(a.toLowerCase() as Address);
