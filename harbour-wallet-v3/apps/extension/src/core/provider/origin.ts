// Origin helpers. A dApp is identified by the browser-reported origin of the frame that sent the request (never by page-supplied data).
export function normalizeOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw || raw === 'null') return null;
  let u: URL; try { u = new URL(raw); } catch { return null; }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.origin;
  return null;
}
export const hostnameOf = (origin: string): string => { try { return new URL(origin).hostname.toLowerCase(); } catch { return ''; } };
export const isLocalOrigin = (origin: string): boolean => { const h = hostnameOf(origin); return h === 'localhost' || h === '127.0.0.1'; };
/** Punycode / mixed-script lookalike hint: any label starting with `xn--`. */
export const isPunycodeHost = (host: string): boolean => host.split('.').some((l) => l.startsWith('xn--'));
/** Insecure = plain http to a non-local host (the content script is never injected there, but the check stays defensive). */
export const isInsecureOrigin = (origin: string): boolean => { try { const u = new URL(origin); return u.protocol !== 'https:' && !isLocalOrigin(origin); } catch { return true; } };
export const displayHost = (origin: string): string => { try { return new URL(origin).host; } catch { return origin; } };
/** Domains the provider is never injected on (Trust Wallet's BLOCKED_DOMAINS, evidences/re-evidence/12-dapp-provider). */
export const BLOCKED_DOMAINS = ['facebook.com', 'fb.com', 'messenger.com', 'instagram.com', 'threads.net', 'whatsapp.com', 'meta.com', 'workplace.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'snapchat.com', 'calendar.google.com', 'mail.google.com', 'docs.google.com', 'drive.google.com', 'meet.google.com', 'keep.google.com'];
export const isBlockedDomain = (hostname: string): boolean => BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));

/** RPC URLs supplied by a dApp must not point at the user's LAN or cloud metadata (the wallet would otherwise probe them before approval). Loopback stays allowed for local dev chains. */
export function isPrivateNetworkUrl(raw: string): boolean {
  let h: string; try { h = new URL(raw).hostname.toLowerCase(); } catch { return true; }
  if (h === 'localhost' || h === '127.0.0.1') return false;
  if (h.startsWith('[')) return true; // any IPv6 literal (incl. ::1, fc00::/7, fe80::/10)
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localdomain') || !h.includes('.')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/); if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

// PT-06: WalletConnect peers DECLARE their URL, so their permissions live under a separate key (`<origin>#walletconnect`). A WC session
// can never share, reuse or change the permission of the real site's injected connection (and vice versa).
export const WC_SUFFIX = '#walletconnect';
export const isWcKey = (o: string): boolean => typeof o === 'string' && o.endsWith(WC_SUFFIX);
export const wcKey = (origin: string): string => (isWcKey(origin) ? origin : origin + WC_SUFFIX);
export const baseOrigin = (o: string): string => (isWcKey(o) ? o.slice(0, -WC_SUFFIX.length) : o);
