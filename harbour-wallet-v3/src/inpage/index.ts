// Harbour page provider (runs in the page's MAIN world, registered with chrome.scripting at document_start; see background/provider/index.ts).
// Defines window.ethereum (unless another wallet owns it and Harbour is not the default wallet), window.trustwallet, window.trustwallet.solana, EIP-6963 announce.
import { Bridge } from './bridge';
import { HarbourEthereum } from './ethereum';
import { HarbourSolana, HARBOUR_ICON, registerWalletStandard } from './solana';
import { isBlockedDomain } from '../core/provider/origin';
import { HarbourKeplr, HarbourAptos, HarbourTron, HarbourBitcoin, HarbourTon, registerSuiWallet } from './multi';
import { PROVIDER_FAMILIES } from '../core/harbour/policy';

function define(name: string, value: unknown, writable = true) {
  try { Object.defineProperty(window, name, { configurable: true, enumerable: true, writable, value }); } catch { try { (window as any)[name] = value; } catch { /* page froze window */ } }
}
function uuid(): string { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ } return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }); }

(function main() {
  if (!window.isSecureContext || isBlockedDomain(location.hostname)) return;
  if ((window as any).__harbourInjected) return; Object.defineProperty(window, '__harbourInjected', { value: true });
  const bridge = new Bridge();
  const eth = new HarbourEthereum(bridge);
  // Only the families this build serves are exposed to pages (core/harbour/policy.ts); the worker refuses the others as well.
  const SOL = PROVIDER_FAMILIES.solana, MULTI = PROVIDER_FAMILIES.multi;
  const sol = SOL ? new HarbourSolana(bridge) : undefined;
  const keplr = MULTI ? new HarbourKeplr(bridge) : undefined; const aptos = MULTI ? new HarbourAptos(bridge) : undefined; const tron = MULTI ? new HarbourTron(bridge) : undefined; const btc = MULTI ? new HarbourBitcoin(bridge) : undefined; const ton = MULTI ? new HarbourTon(bridge, HARBOUR_ICON) : undefined;

  // window.trustwallet: TW exposes the Ethereum provider's API plus per-chain providers on this namespace.
  const tw: any = { isHarbour: true, isTrust: true, isTrustWallet: true, request: eth.request, send: eth.send, sendAsync: eth.sendAsync, on: (e: string, f: any) => eth.on(e, f), off: (e: string, f: any) => eth.off(e, f), removeListener: (e: string, f: any) => eth.removeListener(e, f), removeAllListeners: (e?: string) => eth.removeAllListeners(e), enable: eth.enable, ethereum: eth, ...(sol ? { solana: sol } : {}), ...(MULTI ? { cosmos: keplr, aptos, tron, bitcoin: btc, ton } : {}) };
  const twProxy = new Proxy(tw, { get(t, k, r) { switch (k) { case 'chainId': return eth.getChainId; case 'networkVersion': return eth.getNetworkVersion; case 'address': return eth.getAddress; } return Reflect.get(t, k, r); } });
  define('trustwallet', twProxy); define('trustWallet', twProxy); define('harbour', twProxy);

  // window.ethereum: take it when free; if another wallet got there first, only replace it when the user made Harbour the default wallet.
  const existing = (window as any).ethereum;
  if (!existing) define('ethereum', eth);
  else (window as any).original = existing;
  // Default wallet: own window.ethereum with an accessor, not a plain value. MetaMask (and other wallets) assign window.ethereum when their own
  // script runs, which may be after ours; a data property would be overwritten and dApps like chainlist would open MetaMask. Their assignment is
  // kept as window.original (and in the EIP-6963 list) instead of replacing Harbour.
  const takeOver = () => {
    const cur = (window as any).ethereum; if (cur && cur !== eth) (window as any).original = cur;
    try { Object.defineProperty(window, 'ethereum', { configurable: true, enumerable: true, get: () => eth, set: (v: unknown) => { if (v && v !== eth) (window as any).original = v; } }); }
    catch { define('ethereum', eth); }
  };
  bridge.onInit((s) => { if (s.prefs.defaultWallet && (window as any).ethereum !== eth) takeOver(); });
  if (sol && !(window as any).solana) define('solana', sol);
  if (MULTI) {
    define('harbourTon', ton);
    if (!(window as any).keplr) define('keplr', keplr);
    if (!(window as any).aptos) define('aptos', aptos);
    if (!(window as any).tronLink) define('tronLink', tron);
    if (!(window as any).unisat) define('harbourBitcoin', btc);
  }
  try { window.dispatchEvent(new Event('ethereum#initialized')); } catch { /* ignore */ }

  // EIP-6963 multi-wallet discovery
  const info = Object.freeze({ uuid: uuid(), name: 'Harbour', icon: HARBOUR_ICON, rdns: 'app.harbourwallet' });
  const announce = () => { try { window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider: eth }) })); } catch { /* ignore */ } };
  window.addEventListener('eip6963:requestProvider', announce); announce();
  if (sol) registerWalletStandard(sol);
  if (MULTI) registerSuiWallet(bridge, HARBOUR_ICON);
})();
