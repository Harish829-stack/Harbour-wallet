// harbour-gateway client: X-HB-DEVICE-ID header, TW-shaped routes. When no gateway is configured callers use direct providers.
import { http, type HttpOptions } from './httpClient';
import { GATEWAY_URL } from './endpoints';

const DEVICE_KEY = 'wallet:deviceId';
let deviceId: string | undefined;
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const { local } = await import('../core/storage'); // lazy: keeps the Kit importable outside the extension runtime
  let id = await local.get<string>(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); await local.set(DEVICE_KEY, id); }
  return (deviceId = id);
}
export const gatewayEnabled = () => GATEWAY_URL !== '';

export async function gatewayJson<T = any>(path: string, opts: HttpOptions = {}): Promise<T> {
  if (!GATEWAY_URL) throw new Error('gateway not configured');
  return http.json<T>(`${GATEWAY_URL}${path}`, { ...opts, headers: { 'X-HB-DEVICE-ID': await getDeviceId(), accept: 'application/json', ...opts.headers } });
}
