// Harbour backend (backend/ in this repo) endpoints and the networks it serves. Build-time, public values only: the extension
// authenticates with a per-install device key (device.ts), never with an API key.
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

/** Extension-facing API, e.g. http://localhost:8080 in development. */
export const HB_API_URL: string = (env.VITE_HB_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

/** Networks served by the backend: registry id -> backend chain name (backend/config/chains.yaml) and EVM chain id. */
export const HARBOUR_CHAINS: ReadonlyArray<{ id: string; backend: string; evmChainId: number }> = [
  { id: 'sepolia', backend: 'sepolia', evmChainId: 11155111 },
  { id: 'base-sepolia', backend: 'base-sepolia', evmChainId: 84532 },
];
const byId = new Map(HARBOUR_CHAINS.map((c) => [c.id, c]));
const byEvm = new Map(HARBOUR_CHAINS.map((c) => [c.evmChainId, c]));
const byBackend = new Map(HARBOUR_CHAINS.map((c) => [c.backend, c]));

export const HARBOUR_CHAIN_IDS: string[] = HARBOUR_CHAINS.map((c) => c.id);
export const isHarbourChain = (id?: string | null): boolean => !!id && byId.has(id);
export const isHarbourEvm = (chainId?: number | null): boolean => chainId != null && byEvm.has(Number(chainId));
export const backendChainOf = (idOrEvm: string | number): string | undefined =>
  (typeof idOrEvm === 'number' ? byEvm.get(idOrEvm) : byId.get(idOrEvm))?.backend;
export const chainIdOfBackend = (backend: string): string | undefined => byBackend.get(backend)?.id;
export const evmIdOfBackend = (backend: string): number | undefined => byBackend.get(backend)?.evmChainId;

/** The JSON-RPC URL the extension uses for a Harbour network: the API's allow-listed proxy (requests are signed by fetchHook.ts). */
export const harbourRpcUrl = (evmChainId: number): string | undefined => {
  const b = backendChainOf(evmChainId);
  return b ? `${HB_API_URL}/v1/rpc/${b}` : undefined;
};
