import { setNetworkState } from '../../core/networkRegistry';
// Mirrors the background's custom-network list into the popup's registry so network names / explorers resolve in the UI.
export async function syncNetworks(bg: (m: any) => Promise<any>): Promise<any | null> {
  try { const r = await bg({ type: 'networkList' }); if (r?.ok) { setNetworkState({ custom: r.custom, rpcOverrides: r.rpcOverrides }); return r; } } catch { /* offline */ }
  return null;
}
