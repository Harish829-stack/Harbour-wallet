// Harbour backend (backend/ in this repo) endpoints and the networks it serves. Build-time, public values only: the extension
// authenticates with a per-install device key (device.ts), never with an API key.
import { HARBOUR_CHAIN_LIST, HARBOUR_CLIENT_CHAIN_IDS } from './chainList.gen';
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

/** Extension-facing API, e.g. http://localhost:8080 in development. */
export const HB_API_URL: string = (env.VITE_HB_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

/** Loopback hosts (a backend on this computer): the only place plaintext http/ws is acceptable. */
export const isLoopbackUrl = (u: string): boolean => {
  try { const h = new URL(u).hostname.replace(/^\[|\]$/g, ''); return h === 'localhost' || h === '127.0.0.1' || h === '::1'; } catch { return false; }
};
/** https/wss everywhere except a backend on this computer (local development). vite.config.ts refuses to build otherwise,
 *  and the client refuses to talk to an insecure non-local API in case a build slipped through. */
export const isSecureEndpoint = (u: string, scheme: 'http' | 'ws' = 'http'): boolean => {
  try { const p = new URL(u).protocol; return p === `${scheme}s:` || (p === `${scheme}:` && isLoopbackUrl(u)); } catch { return false; }
};
export const HB_API_SECURE: boolean = isSecureEndpoint(HB_API_URL);

/** Networks served by the backend: registry id -> backend chain name (backend/config/chains.yaml) and EVM chain id.
 *  The list is generated from chains.yaml (backend/scripts/gen_chains.py). `indexed` chains also get history, activity and NFTs
 *  from the backend database; the others are served by the RPC proxy only (balances, fees, send). */
export const HARBOUR_CHAINS: ReadonlyArray<{ id: string; backend: string; evmChainId: number; indexed: boolean }> = HARBOUR_CHAIN_LIST;
const byId = new Map(HARBOUR_CHAINS.map((c) => [c.id, c]));
const byEvm = new Map(HARBOUR_CHAINS.map((c) => [c.evmChainId, c]));
const byBackend = new Map(HARBOUR_CHAINS.map((c) => [c.backend, c]));

export const HARBOUR_CHAIN_IDS: string[] = HARBOUR_CHAINS.map((c) => c.id);
/** Non-EVM networks this build offers. The backend does not serve them: the extension talks to each chain's public endpoints. */
export const CLIENT_CHAIN_IDS: string[] = [...HARBOUR_CLIENT_CHAIN_IDS];
const clientSet = new Set(CLIENT_CHAIN_IDS);
export const isClientChain = (id?: string | null): boolean => !!id && clientSet.has(id);
export const isHarbourChain = (id?: string | null): boolean => !!id && byId.has(id);
export const isHarbourEvm = (chainId?: number | null): boolean => chainId != null && byEvm.has(Number(chainId));
/** Chains whose balances, history and NFTs come from the backend database (the rest are read from RPC / public explorers). */
export const INDEXED_CHAINS = HARBOUR_CHAINS.filter((c) => c.indexed);
export const isIndexedChain = (id?: string | null): boolean => !!id && !!byId.get(id)?.indexed;
export const isIndexedEvm = (chainId?: number | null): boolean => chainId != null && !!byEvm.get(Number(chainId))?.indexed;
export const backendChainOf = (idOrEvm: string | number): string | undefined =>
  (typeof idOrEvm === 'number' ? byEvm.get(idOrEvm) : byId.get(idOrEvm))?.backend;
export const chainIdOfBackend = (backend: string): string | undefined => byBackend.get(backend)?.id;
export const evmIdOfBackend = (backend: string): number | undefined => byBackend.get(backend)?.evmChainId;

/** The JSON-RPC URL the extension uses for a Harbour network: the API's allow-listed proxy (requests are signed by fetchHook.ts). */
export const harbourRpcUrl = (evmChainId: number): string | undefined => {
  const b = backendChainOf(evmChainId);
  return b ? `${HB_API_URL}/v1/rpc/${b}` : undefined;
};
