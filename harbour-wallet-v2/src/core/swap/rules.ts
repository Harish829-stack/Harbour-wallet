// Pure swap rules ported from TW's recovered client logic (evidences/re-evidence/25-swap/SWAP-SPEC.md).
export const SLIPPAGE_PRESETS = ['0.1', '0.5', '1.0', '2.5'] as const; // App chunk `iv`
export const SLIPPAGE_MAX = 30;           // SettingsModal clamps to 30
export const SLIPPAGE_STEP = 0.1;         // stepSlippage(±.1)
export const HIGH_SLIPPAGE_ABOVE = 5;     // `D=R>5` -> swap.high-slippage-warning
export const DEFAULT_SLIPPAGE = '2';      // blur fallback "2" and the page's useState("2")
export const QUOTE_REFRESH_SECONDS = 60;  // AmberRouteConfig default "60s"; refreshInterval:60
export const SWAP_WATCH_TIMEOUT_MS = 18e5; // 30 min (oC=18e5)

// resolvePriceImpactSeverity(g,M,T,I=20): g<=-(T>0?T:20) severe, g<=-(M>0?M:5) moderate.
export type ImpactSeverity = 'none' | 'moderate' | 'severe';
export function priceImpactSeverity(impact: number | undefined, medium = 0, high = 0): ImpactSeverity {
  if (impact == null || !Number.isFinite(impact)) return 'none';
  if (impact <= -(high > 0 ? high : 20)) return 'severe';
  if (impact <= -(medium > 0 ? medium : 5)) return 'moderate';
  return 'none';
}
export function stepSlippage(current: string, delta: number): string {
  const r = Number(current) || 0;
  return Number(Math.min(SLIPPAGE_MAX, Math.max(0, r + delta)).toFixed(1)).toString();
}
// onBlur of the slippage input: "" / NaN / <=0 -> "2"; else min(value, 30).
export function normalizeSlippage(raw: string): string {
  const g = Number(raw);
  return raw === '' || Number.isNaN(g) || g <= 0 ? DEFAULT_SLIPPAGE : String(Math.min(g, SLIPPAGE_MAX));
}
// onChange guard: ignore non-numeric / negative / 0x input; clamp >30 to "30".
export function acceptSlippageInput(prev: string, next: string): string {
  if (next === '') return next;
  if (next.startsWith('0x') || Number.isNaN(Number(next)) || Number(next) < 0) return prev;
  return Number(next) > SLIPPAGE_MAX ? String(SLIPPAGE_MAX) : next;
}
export const isHighSlippage = (s: string) => (Number(s) || 0) > HIGH_SLIPPAGE_ABOVE;
// Slippage.effective (Kotlin): userSelected ?: suggested ?: 3
export const effectiveSlippage = (userSelected?: number | null, suggested?: number | null) => userSelected ?? suggested ?? 3;
// isOrderPollDue: <15s -> 2s, <40s -> 5s, else 10s
export const pollDelayMs = (elapsedMs: number) => (elapsedMs < 15e3 ? 2e3 : elapsedMs < 4e4 ? 5e3 : 1e4);

export interface CtaInput {
  isPairSet: boolean; hasSpendAmount: boolean; cannotCoverGas: boolean; feeSymbol?: string;
  showsAllowance: boolean; isHardwareWallet?: boolean; spendSymbol?: string;
  needsPriceImpactAck: boolean; insufficientBalance: boolean; balanceSymbol?: string;
  isLoading?: boolean; hasQuoteError?: boolean;
}
export type CtaKind = 'select-token' | 'enter-amount' | 'insufficient-gas' | 'approve' | 'approve-and-swap' | 'accept-price-impact' | 'insufficient-balance' | 'swap' | 'loading' | 'error';
// resolveLabel(): select-token -> enter-amount -> insufficient-gas -> approve(-and-swap)
//   -> accept-price-impact -> insufficient-balance | swap   (exact order from the App chunk)
export function resolveCta(i: CtaInput): { kind: CtaKind; label: string; enabled: boolean } {
  if (!i.isPairSet) return { kind: 'select-token', label: 'Select a token', enabled: false };
  if (!i.hasSpendAmount) return { kind: 'enter-amount', label: 'Enter an amount', enabled: false };
  if (i.isLoading) return { kind: 'loading', label: 'Getting a new quote', enabled: false };
  if (i.cannotCoverGas) return { kind: 'insufficient-gas', label: `Insufficient ${i.feeSymbol ?? ''} for gas`.replace('  ', ' '), enabled: false };
  if (i.insufficientBalance) return { kind: 'insufficient-balance', label: `Insufficient ${i.balanceSymbol ?? ''} balance`.replace('  ', ' '), enabled: false };
  if (i.hasQuoteError) return { kind: 'error', label: 'Swap', enabled: false };
  if (i.showsAllowance) return i.isHardwareWallet
    ? { kind: 'approve', label: `Approve ${i.spendSymbol ?? ''}`.trim(), enabled: true }
    : { kind: 'approve-and-swap', label: 'Approve and Swap', enabled: true };
  if (i.needsPriceImpactAck) return { kind: 'accept-price-impact', label: 'Accept price impact', enabled: true };
  return { kind: 'swap', label: 'Swap', enabled: true };
}
