// Help screen data. TW (chunk App, `Help`): two external rows - "Help Center" (settings.help.help-center -> support.trustwallet.com) and "Support"
// (settings.help.support -> its browser-extension beginner guide) - plus a "Customer Service Verification Code" row (server-side ownership proof,
// not reproducible) and GET /v2/announcements (no public equivalent). Harbour has no support site of its own yet, so both URLs are CONFIGURABLE
// (stored locally, https only) and never defaulted to someone else's brand. A built-in FAQ covers the flows this build actually ships.
import { safeHttpsLink } from '../ramps/guard';
import { cleanText } from '../sentiment/index';

export const HELP_STORAGE = 'wallet:help:config';
export interface HelpConfig { helpCenterUrl: string; guideUrl: string; announcementsUrl: string }
export const DEFAULT_HELP: HelpConfig = { helpCenterUrl: '', guideUrl: '', announcementsUrl: '' };
export function normalizeHelp(raw: unknown): HelpConfig {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  return { helpCenterUrl: safeHttpsLink(r.helpCenterUrl), guideUrl: safeHttpsLink(r.guideUrl), announcementsUrl: safeHttpsLink(r.announcementsUrl) };
}
/** Validate an edit; an empty string clears the field, anything else must be a public https URL. */
export function applyHelpPatch(cur: HelpConfig, patch: unknown): { ok: true; config: HelpConfig } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'Invalid settings' };
  const next = { ...cur };
  for (const k of ['helpCenterUrl', 'guideUrl', 'announcementsUrl'] as const) {
    const v = (patch as any)[k]; if (v === undefined) continue;
    if (typeof v !== 'string') return { ok: false, error: 'URLs must be text' };
    if (v.trim() === '') { next[k] = ''; continue; }
    const safe = safeHttpsLink(v.trim()); if (!safe) return { ok: false, error: 'Enter a public https:// link' };
    next[k] = safe;
  }
  return { ok: true, config: next };
}

export interface Announcement { id: string; title: string; body: string; url: string; at: number }
/** Feed format (documented in SPEC): JSON array, or {items:[...]}, of {id,title,body?,url?,date?}. */
export function parseAnnouncements(body: unknown): Announcement[] {
  const rows: any[] = Array.isArray(body) ? body : Array.isArray((body as any)?.items) ? (body as any).items : [];
  const out: Announcement[] = [];
  for (const r of rows.slice(0, 30)) {
    const title = cleanText(r?.title, 120); if (!title) continue;
    const at = Date.parse(String(r?.date ?? '')); out.push({ id: cleanText(String(r?.id ?? title), 60), title, body: cleanText(r?.body, 400), url: safeHttpsLink(r?.url), at: Number.isFinite(at) ? at : 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}

export interface FaqItem { q: string; a: string }
export const FAQ: Array<{ title: string; items: FaqItem[] }> = [
  { title: 'Funding your wallet', items: [
    { q: 'How do I buy crypto?', a: 'Home › Fund › Buy crypto. Pick a currency, an asset and a network, enter an amount, compare provider quotes, then continue: the provider’s own page opens in a new tab with your wallet address pre-filled. Payment and identity checks happen on the provider’s site, not in Harbour.' },
    { q: 'Why does a provider say "Needs API key"?', a: 'Most ramp providers only give quotes to registered integrators. Harbour never ships shared keys: add your own publishable key under Settings › Developer › Ramp API keys (stored on this device only). Providers without a key are listed with the reason instead of showing made-up prices.' },
    { q: 'How do I deposit from an exchange?', a: 'Fund › Deposit from exchange. Choose Binance or Coinbase and an asset, then use the address or QR on the next screen in the exchange’s withdrawal form. Always select the same network the screen shows.' },
    { q: 'What is a recurring buy?', a: 'A repeat purchase of the same amount (dollar-cost averaging). Harbour makes the first purchase through Mercuryo and gives you a calendar reminder (.ics) for the next ones, because automatic charging needs a provider-side account.' },
  ] },
  { title: 'Discover and market data', items: [
    { q: 'Where do dApps come from?', a: 'Discover lists protocols from DeFiLlama’s open directory (ranked by total value locked). Harbour does not audit or endorse them. Opening one launches its website in a new tab.' },
    { q: 'What is market sentiment?', a: 'A score from recent news articles and social posts about an asset: positive mentions divided by positive plus negative mentions (equal counts give 50%). Items are classified by a simple keyword method or the source’s own Bullish/Bearish tag, so treat it as a rough signal.' },
  ] },
  { title: 'Safety', items: [
    { q: 'Does Harbour ever ask for my secret phrase on a provider page?', a: 'No. Never type your secret phrase or password into any website, support chat or message. Anyone who asks for it is trying to steal your funds.' },
    { q: 'Why is only my own address pre-filled?', a: 'Harbour builds every provider link itself and overwrites any address field with your own wallet address, so a tampered link cannot redirect your purchase.' },
  ] },
];
