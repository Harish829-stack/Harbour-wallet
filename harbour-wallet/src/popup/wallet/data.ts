// Dummy/presentation data for screens that need the network in a real deployment.
// Live data (Sepolia balance, send) comes from the background via RPC; everything here is
// static sample content clearly used only for UI. Colors are neutral brand-free swatches.

export interface Asset { id: string; name: string; sym: string; color: string; chainId?: number; evm: boolean; price: number; change: number; }

export const ASSETS: Asset[] = [
  { id: 'ethereum',   name: 'Ethereum',        sym: 'ETH', color: '#6372f0', chainId: 1,        evm: true,  price: 3180.42, change: 1.9 },
  { id: 'smartchain', name: 'BNB Smart Chain', sym: 'BNB', color: '#d9a21b', chainId: 56,       evm: true,  price: 612.10,  change: -0.8 },
  { id: 'polygon',    name: 'Polygon',         sym: 'POL', color: '#8247e5', chainId: 137,      evm: true,  price: 0.52,    change: 3.2 },
  { id: 'arbitrum',   name: 'Arbitrum',        sym: 'ETH', color: '#28a0f0', chainId: 42161,    evm: true,  price: 3180.42, change: 1.9 },
  { id: 'base',       name: 'Base',            sym: 'ETH', color: '#2456f5', chainId: 8453,     evm: true,  price: 3180.42, change: 1.9 },
  { id: 'sepolia',    name: 'Sepolia',         sym: 'ETH', color: '#7a7f93', chainId: 11155111, evm: true,  price: 0,       change: 0 },
  { id: 'bitcoin',    name: 'Bitcoin',         sym: 'BTC', color: '#f7931a', evm: false, price: 97250, change: 0.6 },
  { id: 'solana',     name: 'Solana',          sym: 'SOL', color: '#17c0a0', evm: false, price: 212.4,  change: 4.1 },
];
export const assetOf = (id: string) => ASSETS.find((a) => a.id === id);

export interface Trending { rank: number; name: string; sym: string; color: string; price: number; change: number; }
export const TRENDING: Trending[] = [
  { rank: 1, name: 'Ethereum', sym: 'ETH', color: '#6372f0', price: 3180.42, change: 1.9 },
  { rank: 2, name: 'Solana', sym: 'SOL', color: '#17c0a0', price: 212.4, change: 4.1 },
  { rank: 3, name: 'BNB', sym: 'BNB', color: '#d9a21b', price: 612.1, change: -0.8 },
  { rank: 4, name: 'Chainlink', sym: 'LINK', color: '#2a5ada', price: 18.2, change: 6.4 },
  { rank: 5, name: 'Uniswap', sym: 'UNI', color: '#e84f9b', price: 11.7, change: -2.1 },
  { rank: 6, name: 'Arbitrum', sym: 'ARB', color: '#28a0f0', price: 0.84, change: 2.7 },
  { rank: 7, name: 'Polygon', sym: 'POL', color: '#8247e5', price: 0.52, change: 3.2 },
  { rank: 8, name: 'Aave', sym: 'AAVE', color: '#9896ff', price: 162.5, change: 5.0 },
];

export interface Dapp { name: string; cat: string; color: string; }
export const DAPPS: Dapp[] = [
  { name: 'UniStyle DEX', cat: 'Exchange', color: '#e84f9b' }, { name: 'AaveLend', cat: 'Lending', color: '#9896ff' },
  { name: 'OpenBazaar', cat: 'NFT Market', color: '#2456f5' }, { name: 'LidoStake', cat: 'Staking', color: '#17c0a0' },
  { name: 'PancakeDEX', cat: 'Exchange', color: '#d9a21b' }, { name: 'CurveFi', cat: 'Stablecoins', color: '#6372f0' },
];
export const DAPP_CATS = ['Popular', 'Exchange', 'NFT', 'Lending', 'Games', 'Social'];

export interface Activity { id: string; type: 'send' | 'receive' | 'swap'; sym: string; color: string; amount: string; sub: string; usd: string; time: string; status: 'confirmed' | 'pending'; }
export const ACTIVITY: Activity[] = [
  { id: 'a1', type: 'receive', sym: 'ETH', color: '#6372f0', amount: '+0.250 ETH', sub: 'From 0x7a…3Df1', usd: '$795.11', time: 'Today 10:24', status: 'confirmed' },
  { id: 'a2', type: 'send', sym: 'POL', color: '#8247e5', amount: '-120 POL', sub: 'To 0x19…9c0b', usd: '$62.40', time: 'Yesterday', status: 'confirmed' },
  { id: 'a3', type: 'swap', sym: 'BNB', color: '#d9a21b', amount: '0.5 BNB → 1.2k CAKE', sub: 'PancakeDEX', usd: '$306.05', time: 'Mar 12', status: 'confirmed' },
  { id: 'a4', type: 'send', sym: 'ETH', color: '#6372f0', amount: '-0.05 ETH', sub: 'To 0xab…77e2', usd: '$159.02', time: 'Mar 10', status: 'confirmed' },
];

export interface Stake { name: string; sym: string; color: string; apr: string; }
export const STAKING: Stake[] = [
  { name: 'Ethereum', sym: 'ETH', color: '#6372f0', apr: '3.6%' }, { name: 'BNB', sym: 'BNB', color: '#d9a21b', apr: '2.1%' },
  { name: 'Solana', sym: 'SOL', color: '#17c0a0', apr: '7.2%' }, { name: 'Polygon', sym: 'POL', color: '#8247e5', apr: '4.4%' },
];

export interface BuyProvider { name: string; fee: string; methods: string; }
export const BUY_PROVIDERS: BuyProvider[] = [
  { name: 'MoonRamp', fee: '1.0%', methods: 'Card · Apple Pay' }, { name: 'Banxa Pay', fee: '0.9%', methods: 'Card · Bank' }, { name: 'Transak Go', fee: '1.2%', methods: 'Card · SEPA' },
];

export const NFTS = [
  { id: 'n1', name: 'Harbour Genesis #128', collection: 'Harbour Genesis', color: '#6372f0' },
  { id: 'n2', name: 'Pixel Dock #44', collection: 'Pixel Dock', color: '#17c0a0' },
  { id: 'n3', name: 'Lighthouse #7', collection: 'Lighthouses', color: '#d9a21b' },
];

// A 24-point sample sparkline (0..1) for token-detail charts.
export const SPARK = [0.42, 0.45, 0.4, 0.5, 0.55, 0.52, 0.6, 0.58, 0.63, 0.7, 0.66, 0.72, 0.68, 0.75, 0.8, 0.78, 0.74, 0.82, 0.88, 0.85, 0.9, 0.86, 0.92, 1.0];

export const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
