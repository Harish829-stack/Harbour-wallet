// Build-time endpoints. No API key ever lives here: keys are held by harbour-gateway (plan A8).
import { HB_API_URL } from '../core/harbour/config';
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
/** Third-party gateway: the Harbour backend's /v1/gw (holds the API keys, allow-lists paths, caches). Requests to it are signed
 *  with the device key by core/harbour/fetchHook.ts. VITE_HB_GATEWAY_URL overrides it; an empty value means direct public endpoints only. */
export const GATEWAY_URL: string = (env.VITE_HB_GATEWAY_URL ?? `${HB_API_URL}/v1/gw`).replace(/\/$/, '');
export const CONFIG_URL: string = env.VITE_HB_CONFIG_URL ?? (GATEWAY_URL ? `${GATEWAY_URL}/v1/config` : '');
export const CONFIG_PUBLIC_KEY: string = env.VITE_HB_CONFIG_PUBKEY ?? ''; // base64 Ed25519; empty disables remote config
