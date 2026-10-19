// Fiat on/off-ramp domain types. Shapes mirror Trust Wallet's recovered buy flow (evidence/36-ramps/SPEC.md): a quote has
// {id, provider{name,imageUrl}, paymentMethod{paymentMethod,categoryId,providerName}, digitalMoney{amount,currency}, fiatMoney{amount,currency},
// isRecommended, badges[]}; quotes are grouped by payment category. Harbour fills them from public provider endpoints (never TW's gateway).
export type RampMode = 'buy' | 'sell';
export type RampProviderId = 'transak' | 'ramp' | 'moonpay' | 'mercuryo' | 'banxa' | 'onramper';

/** A buyable/sellable asset. `assetId` is the Harbour asset id: a registry chain id for natives, `<chainId>:<SYMBOL>` for stable tokens. */
export interface RampAsset { assetId: string; symbol: string; name: string; chainId: string; chainName: string; isNative: boolean; cg?: string }

export interface FiatInfo { code: string; name: string; popular: boolean; suggested: number[]; defaultAmount: number }

export type PaymentCategoryId = 'card' | 'apple_pay' | 'google_pay' | 'bank' | 'sepa' | 'ach' | 'instant' | 'other';
export interface PaymentCategory { id: PaymentCategoryId; displayName: string }

export type QuoteBadge = 'BestPrice' | 'IsRecommended';
export interface RampQuote {
  id: string;
  mode: RampMode;
  providerId: RampProviderId;
  providerName: string;
  /** Payment category id + the provider's own label for the method (shown as "with <provider>"). */
  paymentMethod: { categoryId: PaymentCategoryId; label: string; providerName?: string };
  fiat: { currency: string; amount: number };
  /** `amount` is null for widget-only providers whose price can only be seen inside their widget. */
  crypto: { symbol: string; amount: number | null };
  feeFiat?: number;
  isRecommended: boolean;
  badges: QuoteBadge[];
}

export type ProviderStateKind = 'ok' | 'needs_key' | 'unsupported' | 'error' | 'widget_only';
export interface ProviderState { id: RampProviderId; name: string; state: ProviderStateKind; message?: string }

export interface QuoteRequest { mode: RampMode; asset: RampAsset; fiat: string; /** buy: fiat amount; sell: crypto amount (decimal string) */ amount: string }
export interface QuoteResult { quotes: RampQuote[]; categories: PaymentCategory[]; providers: ProviderState[]; bestQuoteId?: string }

export type Fetcher = typeof fetch;
export type RampKeys = Partial<Record<RampProviderId, Record<string, string>>>;
