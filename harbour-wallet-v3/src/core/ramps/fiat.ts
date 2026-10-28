// Fiat currencies offered by the ramp flow. Names/popularity come from TW's own base-currency table (core/fiatTable.ts, recovered from
// the extension). TW takes {default, min, max, suggestedAmounts} per currency from its backend (`/v1/buycrypto/config`-style call, not
// captured). Harbour has no such public source, so suggestions are scaled from a USD-ish base and min/max come from provider errors.
import { FIAT_TABLE } from '../fiatTable';
import type { FiatInfo } from './types';

const BASE = [50, 100, 250, 500];
/** Rough magnitude of one unit vs USD, only used to make the suggested chips sensible (not a rate). */
const SCALE: Record<string, number> = { JPY: 100, KRW: 1000, VND: 20000, IDR: 10000, CLP: 1000, COP: 4000, HUF: 300, PKR: 250, NGN: 1500, INR: 80, RUB: 90, PHP: 50, THB: 35, TWD: 30, CZK: 22, MXN: 18, ARS: 900, KES: 130, BDT: 110, EGP: 48, UAH: 40, TRY: 32, ZAR: 18, BRL: 5, SEK: 10, NOK: 10, DKK: 7, HKD: 8, CNY: 7, PLN: 4, RON: 5, ILS: 4, AED: 4, SAR: 4 };
const round = (n: number) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };

export const RAMP_FIATS: FiatInfo[] = FIAT_TABLE.filter((r) => !r[3]).map(([code, name, rating]) => {
  const s = SCALE[code] ?? 1;
  const suggested = BASE.map((b) => round(b * s));
  return { code, name, popular: rating > 0, suggested, defaultAmount: suggested[1] };
});
const byCode = new Map(RAMP_FIATS.map((f) => [f.code, f]));
export const fiatInfo = (code: string): FiatInfo | undefined => byCode.get(code);
export const isRampFiat = (code: unknown): code is string => typeof code === 'string' && byCode.has(code);
