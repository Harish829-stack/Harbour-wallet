// Build-time check of the Harbour API URL (VITE_HB_API_URL). Shared by vite.config.ts, manifest.config.ts and release.mjs.
// https everywhere; plain http only for a backend on this computer (local development). A release must be https.
export const DEFAULT_API = 'http://localhost:8080';
export const isLoopback = (u) => { try { const h = new URL(u).hostname.replace(/^\[|\]$/g, ''); return h === 'localhost' || h === '127.0.0.1' || h === '::1'; } catch { return false; } };
export function apiUrlStatus(raw) {
  const url = String(raw || DEFAULT_API).replace(/\/+$/, '');
  let proto = ''; try { proto = new URL(url).protocol; } catch { return { url, ok: false, local: false, error: `VITE_HB_API_URL is not a URL: ${url}` }; }
  const local = isLoopback(url);
  if (proto === 'https:') return { url, ok: true, local };
  if (proto === 'http:' && local) return { url, ok: true, local: true };
  return { url, ok: false, local, error: `VITE_HB_API_URL must be https:// (got ${url}). Plain http is only allowed for localhost.` };
}
