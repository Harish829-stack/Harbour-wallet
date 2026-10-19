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
/** Domains the provider is never injected on (Trust Wallet's BLOCKED_DOMAINS, evidence/12-dapp-provider). */
export const BLOCKED_DOMAINS = ['facebook.com', 'fb.com', 'messenger.com', 'instagram.com', 'threads.net', 'whatsapp.com', 'meta.com', 'workplace.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'snapchat.com', 'calendar.google.com', 'mail.google.com', 'docs.google.com', 'drive.google.com', 'meet.google.com', 'keep.google.com'];
export const isBlockedDomain = (hostname: string): boolean => BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
