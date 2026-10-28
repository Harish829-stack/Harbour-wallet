// Build-time endpoints. No API key ever lives here: keys are held by harbour-gateway (plan A8).
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
export const GATEWAY_URL: string = (env.VITE_HB_GATEWAY_URL ?? '').replace(/\/$/, ''); // empty = direct public endpoints only
export const CONFIG_URL: string = env.VITE_HB_CONFIG_URL ?? (GATEWAY_URL ? `${GATEWAY_URL}/v1/config` : '');
export const CONFIG_PUBLIC_KEY: string = env.VITE_HB_CONFIG_PUBKEY ?? ''; // base64 Ed25519; empty disables remote config
