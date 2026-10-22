import { getCore } from '../../core/walletCore';
import { VaultService } from '../../core/vaultService';
import { WalletService } from '../../core/walletService';
import { local, KEYS } from '../../core/storage';
import { ALL_CHAINS, TESTNET_CHAINS, DEFAULT_HOME_CHAINS } from '../../core/chains/index';
import { setNetworkState, getNetworkState } from '../../core/networkRegistry';

// Trust Wallet shows only its default assets on a fresh wallet; everything else is enabled from Manage crypto.
export const defaultHiddenAssets = (): string[] => [...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => c.id).filter((id) => !DEFAULT_HOME_CHAINS.includes(id));

// Custom networks live in plain local storage (not secret) and are mirrored into the in-memory registry that rpcUrl() reads.
export const networksReady: Promise<void> = local.get<any>(KEYS.NETWORKS).then((n) => setNetworkState(n)).catch(() => {});
export const saveNetworks = async () => { await local.set(KEYS.NETWORKS, getNetworkState()); };

/** Per-event context: wallet-core, vault and wallet services (waits for the custom-network mirror first). */
export async function buildCtx(sender: any) {
  await networksReady;
  const core = await getCore();
  return { core, vault: new VaultService(core), wallet: new WalletService(core), sender };
}
export type Msg = { type: string; [k: string]: any };
