// Registry of provider adapters + key sanitising + the final checkout URL builder.
import type { RampKeys, RampProviderId } from './types';
import { enforceTrustedAddress } from './guard';
import { ProviderError, type ProviderDef, type WidgetInput } from './kit';
import { transak, ramp } from './pA';
import { moonpay, mercuryo } from './pB';
import { banxa, onramper } from './pC';
export { ProviderError, PAYMENT_CATEGORIES, categoryOf, compositeCode } from './kit';
export type { ProviderDef, WidgetInput, KeyField, ProviderCode } from './kit';
export { transak, ramp, moonpay, mercuryo, banxa, onramper };

export const PROVIDERS: ProviderDef[] = [transak, ramp, moonpay, mercuryo, banxa, onramper];
export const providerById = (id: unknown): ProviderDef | undefined => PROVIDERS.find((p) => p.id === id);

/** Validate and sanitise user-entered keys for one provider. Returns only known fields that match their pattern. */
export function sanitizeKeys(p: ProviderDef, input: unknown): { ok: true; keys: Record<string, string> } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid keys' };
  const out: Record<string, string> = {};
  for (const f of p.keyFields) {
    const raw = (input as any)[f.field];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string') return { ok: false, error: `${f.label} must be text` };
    const v = raw.trim();
    if (!f.pattern.test(v)) return { ok: false, error: `${f.label} looks invalid for ${p.name}` };
    out[f.field] = v;
  }
  return { ok: true, keys: out };
}
export const keysFor = (all: RampKeys | undefined, id: RampProviderId): Record<string, string> => ({ ...(all?.[id] ?? {}) });

/** Build the final, validated checkout URL. `address` must already be the wallet's own address (the caller derives it from the vault). */
export function buildCheckoutUrl(p: ProviderDef, input: WidgetInput, keys: Record<string, string>): { url: string; addressField?: string } {
  if (!p.modes.includes(input.mode)) throw new ProviderError('unsupported', `${p.name} does not support ${input.mode}`);
  const code = p.code(input.asset); if (!code) throw new ProviderError('unsupported', `${p.name} does not support ${input.asset.symbol} on ${input.asset.chainName}`);
  const miss = p.widgetNeeds.filter((k) => !keys[k]); if (miss.length) throw new ProviderError('needs_key', `${p.name} needs ${miss.join(', ')} (Settings › Developer › Ramp API keys)`);
  const { url, addressField } = p.widget(input, code, keys);
  enforceTrustedAddress(url, addressField, input.address);
  if (!p.hosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) throw new ProviderError('error', 'Provider host not allowed');
  return { url: url.toString(), addressField };
}
