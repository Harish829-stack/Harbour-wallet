// Onboarding state rules (pure). Evidence: chunks/onboarding (`Page`: idle timeout 600000 ms, eventsThrottle 500, paused once the flow
// completed; `HOME`: canCreateWallet false -> BLOCKED_MAX_WALLETS; `useOnboardingType`: no wallets -> first-wallet, else additional-wallet).
import { canCreateWallet } from './importKey';

export const ONBOARDING_IDLE_MS = 600_000;
export const ONBOARDING_EVENT_THROTTLE_MS = 500;
export const QR_SCAN_INTERVAL_MS = 80; // chunks/import-qr: delayBetweenScanAttempts / delayBetweenScanSuccess

export interface IdleGuardOptions {
  timeout?: number; throttle?: number; onIdle: () => void;
  now?: () => number; setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (h: unknown) => void;
}
/** react-idle-timer replacement: `activity()` restarts the countdown (at most once per `throttle` ms); `pause()` stops it for good. */
export function createIdleGuard(o: IdleGuardOptions) {
  const timeout = o.timeout ?? ONBOARDING_IDLE_MS; const throttle = o.throttle ?? ONBOARDING_EVENT_THROTTLE_MS;
  const now = o.now ?? Date.now; const set = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms)); const clear = o.clearTimer ?? ((h) => clearTimeout(h as any));
  let handle: unknown = null; let last = -Infinity; let running = false;
  const arm = () => { if (handle != null) clear(handle); handle = set(() => { handle = null; if (running) o.onIdle(); }, timeout); };
  return {
    start() { running = true; last = now(); arm(); },
    activity() { if (!running) return; const t = now(); if (t - last < throttle) return; last = t; arm(); },
    pause() { running = false; if (handle != null) { clear(handle); handle = null; } },
    get running() { return running; },
  };
}

export type OnboardingMode = 'first-wallet' | 'locked' | 'interrupted' | 'blocked' | 'additional-wallet';
export interface VaultSnapshot { hasVault: boolean; unlocked: boolean; walletCount: number }
/**
 *  no vault                          -> first-wallet (terms + authentication)
 *  vault, locked                     -> locked (unlock first; every wallet handler needs an unlocked vault, TW IsUnlocked)
 *  vault, unlocked, no wallet        -> interrupted (a previous setup stopped after the password; resume or start over)
 *  vault, unlocked, limit reached    -> blocked (BLOCKED_MAX_WALLETS)
 *  vault, unlocked, has wallets      -> additional-wallet (terms and authentication are skipped)
 */
export function onboardingMode(s: VaultSnapshot): OnboardingMode {
  if (!s.hasVault) return 'first-wallet';
  if (!s.unlocked) return 'locked';
  if (s.walletCount === 0) return 'interrupted';
  return canCreateWallet(s.walletCount) ? 'additional-wallet' : 'blocked';
}

// Steps that may be restored after a tab reload. Secrets and passwords live only in memory, so any step that needs them restarts at
// its entry point instead of resuming with missing data.
export type OnboardingStep = 'welcome' | 'authentication' | 'biometrics' | 'password' | 'sources' | 'trust-method' | 'instructions' | 'secret' | 'network' | 'solana' | 'qr-mobile' | 'qr-scan' | 'qr-code' | 'ledger' | 'passkey' | 'boundary' | 'completed';
export type OnboardingFlow = 'create' | 'import' | 'qr' | 'ledger' | 'passkey';
const RESTORABLE: Record<'first-wallet' | 'additional-wallet' | 'interrupted', OnboardingStep[]> = {
  'first-wallet': ['welcome', 'authentication'],
  'additional-wallet': ['welcome', 'sources', 'trust-method', 'secret', 'qr-mobile', 'ledger'],
  interrupted: ['welcome', 'sources', 'trust-method', 'secret', 'qr-mobile', 'ledger'],
};
const FALLBACK: Record<'first-wallet' | 'additional-wallet' | 'interrupted', OnboardingStep> = { 'first-wallet': 'welcome', 'additional-wallet': 'welcome', interrupted: 'sources' };
export interface SavedStep { step: OnboardingStep; flow: OnboardingFlow; source: 'trust' | 'other'; at: number }
export const STEP_KEY = 'hb:onboarding:step';
export const serializeStep = (s: Omit<SavedStep, 'at'>, at = Date.now()): string => JSON.stringify({ ...s, at });
export function restoreStep(raw: string | null | undefined, mode: OnboardingMode, now = Date.now()): { step: OnboardingStep; flow: OnboardingFlow; source: 'trust' | 'other' } | null {
  if (mode !== 'first-wallet' && mode !== 'additional-wallet' && mode !== 'interrupted') return null;
  try {
    const v = JSON.parse(String(raw ?? 'null')) as SavedStep | null;
    if (!v || typeof v.at !== 'number' || now - v.at > ONBOARDING_IDLE_MS) return null;
    const okFlow: OnboardingFlow[] = ['create', 'import', 'qr', 'ledger', 'passkey'];
    if (!okFlow.includes(v.flow) || (v.source !== 'trust' && v.source !== 'other')) return null;
    const allowed = RESTORABLE[mode];
    // A first-wallet user mid-way through the password step must start the authentication choice again.
    const step = allowed.includes(v.step) ? v.step : FALLBACK[mode];
    return { step, flow: v.flow, source: v.source };
  } catch { return null; }
}

// ---------- camera (import-qr: ScannerBox / ImportWithQr) ----------
export type CameraError = 'denied' | 'in-use' | 'no-camera' | 'unsupported' | 'other';
export function cameraErrorKind(e: unknown): CameraError {
  const name = String((e as any)?.name ?? '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  if (name === 'TypeError') return 'unsupported';
  return 'other';
}
export const CAMERA_MESSAGES: Record<CameraError, string> = {
  denied: 'Camera access denied. Please enable camera permissions.',
  'in-use': 'Camera is currently in use or unavailable. Please close other applications using the camera and try again.',
  'no-camera': 'No camera was found on this computer.',
  unsupported: 'This browser cannot access the camera.',
  other: 'The camera could not be started.',
};
export const QR_PARSE_ERROR = 'Scan failed. Ensure you are scanning the correct QR code. Hold still and try again.';
