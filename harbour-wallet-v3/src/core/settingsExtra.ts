// Pure reducers and rules behind the extra Settings screens (wallet lists, developer settings, faucets, migration). No browser APIs.

// ---------- wallet kinds ----------
export type WalletKind = 'mnemonic' | 'privateKey' | 'hardware';
export interface WalletLike { id: string; label: string; type?: string; accounts?: Array<{ name?: string; addresses?: Record<string, string> }>; backupRequired?: boolean; blockchain?: string }
export const walletKind = (w: { type?: string }): WalletKind => {
  const t = String(w.type ?? 'mnemonic').toLowerCase();
  if (t === 'privatekey') return 'privateKey';
  if (t === 'ledger' || t === 'hardware' || t === 'trezor') return 'hardware';
  return 'mnemonic';
};
export const WALLET_KIND_LABEL: Record<WalletKind, string> = { mnemonic: 'Secret phrase', privateKey: 'Private key', hardware: 'Hardware wallet' };
export const canAddAccount = (w: { type?: string }): boolean => walletKind(w) === 'mnemonic';
export const canBackupPhrase = (w: { type?: string }): boolean => walletKind(w) === 'mnemonic';
export const canRevealPrivateKey = (w: { type?: string }): boolean => walletKind(w) === 'privateKey';
/** Wallet list sections in TW order: secret phrase, private key, hardware. Empty sections are omitted. */
export function groupWallets<T extends { type?: string }>(wallets: T[]): Array<{ kind: WalletKind; title: string; wallets: T[] }> {
  return (['mnemonic', 'privateKey', 'hardware'] as WalletKind[])
    .map((kind) => ({ kind, title: WALLET_KIND_LABEL[kind], wallets: wallets.filter((w) => walletKind(w) === kind) }))
    .filter((g) => g.wallets.length > 0);
}
export const shortAddress = (a: string, head = 6, tail = 4): string => (a && a.length > head + tail + 3 ? `${a.slice(0, head)}...${a.slice(-tail)}` : a || '');

// ---------- developer settings ----------
export interface DeveloperRow { key: string; label: string; sub?: string }
export const DEVELOPER_FLAGS: Array<DeveloperRow & { key: 'isCustomNonceEnabled' | 'isAdvancedGasControlsEnabled' | 'isAdvancedTransactionDataEnabled' | 'isEthSignEnabled' }> = [
  { key: 'isCustomNonceEnabled', label: 'Customize transaction nonce', sub: 'Adds a nonce field to the send review screen.' },
  { key: 'isAdvancedGasControlsEnabled', label: 'Advanced gas controls', sub: 'Edit gas price and limit before sending.' },
  { key: 'isAdvancedTransactionDataEnabled', label: 'Advanced transaction data', sub: 'Show the raw call data of a transaction.' },
  { key: 'isEthSignEnabled', label: 'Allow eth_sign requests', sub: 'Unsafe: lets a site ask you to sign an arbitrary hash.' },
];
/** Testnets are "on" when every testnet chain is visible on Home (not in the hidden list). */
export const testnetsEnabled = (hidden: readonly string[], testnetIds: readonly string[]): boolean => testnetIds.length > 0 && testnetIds.every((id) => !hidden.includes(id));
export function setTestnetsHidden(hidden: readonly string[], testnetIds: readonly string[], enabled: boolean): string[] {
  const rest = hidden.filter((id) => !testnetIds.includes(id));
  return enabled ? rest : [...rest, ...testnetIds];
}

// ---------- faucets ----------
export interface Faucet { chainId: string; label: string; url: string }
// TW's Arbitrum Sepolia row points at the Ethereum Sepolia Alchemy page (an apparent TW slip); Harbour links the Arbitrum page.
export const FAUCETS: Faucet[] = [
  { chainId: 'sepolia', label: 'Ethereum Sepolia', url: 'https://sepolia-faucet.pk910.de/' },
  { chainId: 'base-sepolia', label: 'Base Sepolia', url: 'https://www.alchemy.com/faucets/base-sepolia' },
  { chainId: 'arbitrum-sepolia', label: 'Arbitrum Sepolia', url: 'https://www.alchemy.com/faucets/arbitrum-sepolia' },
  { chainId: 'polygon-amoy', label: 'Polygon Amoy', url: 'https://faucet.polygon.technology/' },
  { chainId: 'monad-testnet', label: 'Monad Testnet', url: 'https://faucet.monad.xyz/' },
  { chainId: 'megaeth-testnet', label: 'MegaETH Testnet', url: 'https://docs.megaeth.com/user-guide/faucet' },
];
export const isSafeFaucetUrl = (u: string): boolean => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password; } catch { return false; } };

// ---------- security migration (select-source-wallet -> select-destination-wallet -> select-assets) ----------
export interface MigrationAsset { id: string; symbol: string; name: string; balance: string; address: string }
export interface MigrationState { source?: string; destination?: string; selected: string[] }
export const emptyMigration = (): MigrationState => ({ selected: [] });
export function pickSource(s: MigrationState, id: string): MigrationState {
  // changing the source invalidates the destination (if it is now the same wallet) and every asset choice
  return { source: id, destination: s.destination === id ? undefined : s.destination, selected: [] };
}
export const destinationOptions = <T extends { id: string; type?: string }>(wallets: T[], source?: string): T[] => wallets.filter((w) => w.id !== source && walletKind(w) !== 'hardware');
export function pickDestination(s: MigrationState, id: string): MigrationState { return id === s.source ? s : { ...s, destination: id }; }
export function toggleAsset(s: MigrationState, id: string): MigrationState { return { ...s, selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }; }
export function selectAllAssets(s: MigrationState, assets: MigrationAsset[]): MigrationState {
  const all = assets.map((a) => a.id); return { ...s, selected: s.selected.length === all.length ? [] : all };
}
export const hasPositiveBalance = (a: { balance: string }): boolean => /[1-9]/.test(a.balance.replace(/e.*$/i, ''));
export const migratableAssets = (assets: MigrationAsset[]): MigrationAsset[] => assets.filter(hasPositiveBalance);
export const canContinueFromSource = (s: MigrationState): boolean => !!s.source;
export const canContinueFromDestination = (s: MigrationState): boolean => !!s.source && !!s.destination && s.source !== s.destination;
export const canMigrate = (s: MigrationState): boolean => canContinueFromDestination(s) && s.selected.length > 0;
/** The send screen is opened once per selected asset, in order; the user confirms each transfer. */
export const migrationQueue = (s: MigrationState, assets: MigrationAsset[]): MigrationAsset[] => assets.filter((a) => s.selected.includes(a.id));
