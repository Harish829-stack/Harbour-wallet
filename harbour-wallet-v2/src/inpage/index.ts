// Harbour page provider (runs in the page's MAIN world, registered with chrome.scripting at document_start; see background/provider/index.ts).
// Defines window.ethereum (unless another wallet owns it and Harbour is not the default wallet), window.trustwallet, window.trustwallet.solana, EIP-6963 announce.
import { Bridge } from './bridge';
import { HarbourEthereum } from './ethereum';
import { HarbourSolana, HARBOUR_ICON, registerWalletStandard } from './solana';
import { isBlockedDomain } from '../core/provider/origin';

function define(name: string, value: unknown, writable = true) {
  try { Object.defineProperty(window, name, { configurable: true, enumerable: true, writable, value }); } catch { try { (window as any)[name] = value; } catch { /* page froze window */ } }
}
function uuid(): string { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ } return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }); }

(function main() {
  if (!window.isSecureContext || isBlockedDomain(location.hostname)) return;
  if ((window as any).__harbourInjected) return; Object.defineProperty(window, '__harbourInjected', { value: true });
  const bridge = new Bridge();
  const eth = new HarbourEthereum(bridge);
  const sol = new HarbourSolana(bridge);

  // window.trustwallet: TW exposes the Ethereum provider's API plus per-chain providers on this namespace.
  const tw: any = { isHarbour: true, isTrust: true, isTrustWallet: true, request: eth.request, send: eth.send, sendAsync: eth.sendAsync, on: (e: string, f: any) => eth.on(e, f), off: (e: string, f: any) => eth.off(e, f), removeListener: (e: string, f: any) => eth.removeListener(e, f), removeAllListeners: (e?: string) => eth.removeAllListeners(e), enable: eth.enable, solana: sol, ethereum: eth };
  const twProxy = new Proxy(tw, { get(t, k, r) { switch (k) { case 'chainId': return eth.getChainId; case 'networkVersion': return eth.getNetworkVersion; case 'address': return eth.getAddress; } return Reflect.get(t, k, r); } });
  define('trustwallet', twProxy); define('trustWallet', twProxy); define('harbour', twProxy);

  // window.ethereum: take it when free; if another wallet got there first, only replace it when the user made Harbour the default wallet.
  const existing = (window as any).ethereum;
  if (!existing) define('ethereum', eth);
  else (window as any).original = existing;
  bridge.onInit((s) => { if ((window as any).ethereum && (window as any).ethereum !== eth && s.prefs.defaultWallet) { (window as any).original = (window as any).ethereum; define('ethereum', eth); } });
  if (!(window as any).solana) define('solana', sol);
  try { window.dispatchEvent(new Event('ethereum#initialized')); } catch { /* ignore */ }

  // EIP-6963 multi-wallet discovery
  const info = Object.freeze({ uuid: uuid(), name: 'Harbour', icon: HARBOUR_ICON, rdns: 'app.harbourwallet' });
  const announce = () => { try { window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider: eth }) })); } catch { /* ignore */ } };
  window.addEventListener('eip6963:requestProvider', announce); announce();
  registerWalletStandard(sol);
})();
