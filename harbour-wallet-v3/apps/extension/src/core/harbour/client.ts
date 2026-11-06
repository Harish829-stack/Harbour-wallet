// Signed calls to the Harbour API. Every /v1/me, /v1/rpc and /v1/tx request carries the device signature
// (canonical string identical to backend/internal/devicesig). Errors are the API's user-presentable messages.
import { sha256 } from '@noble/hashes/sha256';
import { HB_API_URL, HB_API_SECURE } from './config';
import { deviceIdentity, resetDevice, b64url, parseResponse, HarbourApiError, type Identity } from './device';
export { HarbourApiError };
import { checkPortfolio, checkHistory, checkNfts, checkAddresses, checkBroadcast } from './schema';

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const canonical = (method: string, pathAndQuery: string, date: string, nonce: string, device: string, body: Uint8Array): string =>
  ['HB1', method.toUpperCase(), pathAndQuery, date, nonce, device, hex(sha256(body))].join('\n');

// The un-hooked fetch (captured before the service worker wraps globalThis.fetch) so API calls never loop through the RPC hook.
let rawFetch: typeof fetch = (...a) => fetch(...a);
export const setRawFetch = (f: typeof fetch): void => { rawFetch = f; };

async function signedHeaders(id: Identity, method: string, pathAndQuery: string, raw: Uint8Array): Promise<Record<string, string>> {
  const date = String(Math.floor(Date.now() / 1000));
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)));
  const sig = b64url(await id.sign(enc.encode(canonical(method, pathAndQuery, date, nonce, id.deviceId, raw))));
  return { 'X-HB-Device': id.deviceId, 'X-HB-Date': date, 'X-HB-Nonce': nonce, 'X-HB-Signature': sig };
}

/** Raw signed request (returns the Response). Re-registers once if the server no longer knows this device. */
export async function signedRequest(method: string, pathAndQuery: string, body?: unknown, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
  const raw = body === undefined ? new Uint8Array() : enc.encode(typeof body === 'string' ? body : JSON.stringify(body));
  if (!HB_API_SECURE) throw new HarbourApiError(0, 'insecure_api', 'Harbour cannot reach its servers securely. Please update the extension.', false);
  for (let attempt = 0; ; attempt++) {
    const id = await deviceIdentity(HB_API_URL, rawFetch);
    const res = await rawFetch(HB_API_URL + pathAndQuery, {
      method, signal: signal ?? AbortSignal.timeout(20_000), credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...headers, ...(await signedHeaders(id, method, pathAndQuery, raw)) },
      body: raw.length ? raw : undefined,
    });
    if (res.status === 401 && attempt === 0) {
      const code = (await res.clone().json().catch(() => ({})))?.error?.code;
      // Only a device the server has never heard of (database reset) registers again. A revoked device, a bad signature or a
      // replayed nonce must not rotate the key: that would undo a server-side ban and let a network attacker force resets.
      if (code === 'device_unknown') { await resetDevice(); continue; }
    }
    return res;
  }
}
export const api = async <T = any>(method: string, pathAndQuery: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
  parseResponse(await signedRequest(method, pathAndQuery, body, headers));

// ---------- typed endpoints ----------
export interface AssetView { chain: string; asset_ref: string; kind: string; symbol: string | null; name: string | null; decimals: number | null; logo_url: string | null; spam: boolean; verified: boolean }
export interface Holding extends AssetView { amount_raw: string; amount: string; price: { usd: number | null; flag: string }; value_usd: number | null }
export interface AddressPortfolio { chain: string; address: string; synced: boolean; backfill_state: string; as_of_block: number; value_usd: number; assets: Holding[] }
export interface Portfolio { value_usd: number; addresses: AddressPortfolio[] }
export interface HistoryTransfer extends AssetView { amount_raw: string; amount: string; direction: 'in' | 'out' | 'self'; counterparty?: string; token_id?: string }
export interface HistoryRow { chain: string; address: string; tx_hash: string; block_time: string; direction: string; finality: string; transfers: HistoryTransfer[] }
export interface History { items: HistoryRow[]; cursor?: string; loading_older?: boolean }
export interface NftView { chain: string; address: string; contract: string; collection: string | null; token_id: string; amount: string; name: string | null; standard: string; image_url: string | null; spam: boolean }
export interface AddressRef { chain: string; address: string }

const q = (refs?: AddressRef[]) => (refs?.length ? `addresses=${encodeURIComponent(refs.map((r) => `${r.chain}:${r.address}`).join(','))}` : '');
export const getPortfolio = async (refs?: AddressRef[]) => checkPortfolio(await api('GET', `/v1/me/portfolio${refs?.length ? `?${q(refs)}` : ''}`), refs);
export const getHistory = async (refs: AddressRef[], cursor?: string, limit = 50): Promise<History> =>
  checkHistory(await api('GET', `/v1/me/history?${[q(refs), `limit=${limit}`, cursor ? `cursor=${encodeURIComponent(cursor)}` : ''].filter(Boolean).join('&')}`), refs);
export const getNfts = async (refs?: AddressRef[]) => checkNfts(await api('GET', `/v1/me/nfts${refs?.length ? `?${q(refs)}` : ''}`), refs);
export const listAddresses = async () => checkAddresses(await api('GET', '/v1/me/addresses'));
export const putAddresses = (add: AddressRef[], remove: AddressRef[]) =>
  api('PUT', '/v1/me/addresses', { add, remove }, { 'Idempotency-Key': crypto.randomUUID() });
export const broadcastTx = async (chain: string, raw: string, session?: string) =>
  checkBroadcast(await api('POST', `/v1/tx/${chain}/broadcast`, { raw },
    { 'Idempotency-Key': `bc-${raw.slice(-24)}`, ...(session ? { 'X-HB-Session': session } : {}) }), raw);
export const realtimeToken = () => api<{ url: string; token: string; expires_at: number; subscriptions: Array<{ channel: string; token: string }> }>('POST', '/v1/realtime/token', {});
export const vapidKey = async (): Promise<string> => { if (!HB_API_SECURE) throw new HarbourApiError(0, 'insecure_api', 'Harbour cannot reach its servers securely.', false); return (await parseResponse(await rawFetch(`${HB_API_URL}/v1/push/vapid`, { credentials: 'omit' }))).public_key; };
export const putPush = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) => api('PUT', '/v1/me/push', sub);
export const deletePush = () => api('DELETE', '/v1/me/push');

/** Absolute URL for a media path the API returned (`/v1/media/<key>`). */
export const mediaUrl = (p: string | null | undefined): string => (p && p.startsWith('/v1/media/') ? HB_API_URL + p : '');
