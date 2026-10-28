// User-facing error text. Raw failures ("HTTP 404", "fetch failed", stack-like text, provider names, URLs) never reach the screen.
// Internal codes (LOCKED, TOO_MANY_ATTEMPTS, needs_key, ...) are single tokens the UI branches on, so they pass through untouched.
const NETWORK_TEXT = 'The network is unreachable or busy right now. Please check your connection and try again.';
const GENERIC_TEXT = 'Something went wrong. Please try again.';
const NETWORK = /fetch failed|failed to fetch|network ?error|network request|timeout|timed out|abort(ed)?\b|rate.?limit|circuit open|failed to load|you are offline|\bECONN|ENOTFOUND|socket|all RPC endpoints|no (nodes|provider) available|load failed/i;
const TECHNICAL = /TypeError|SyntaxError|ReferenceError|RangeError|Unexpected (token|end)|JSON|undefined|\bnull\b|is not a function|cannot read|Failed to execute|https?:\/\/|0x[0-9a-f]{16,}|\bat \S+:\d+:\d+|invalid response|stack|\bECONN|CORS|\[object/i;
const CODE = /^\S+$/; // a single token with no spaces is a code, not prose

const forStatus = (s: number): string => {
  if (s === 401 || s === 403) return 'The data provider isn’t available for this request right now. Please try again later.';
  if (s === 404 || s === 410) return 'This information isn’t available right now. Please try again later.';
  if (s === 408 || s === 504) return 'The request took too long. Please try again.';
  if (s === 429) return 'Too many requests. Please wait a moment and try again.';
  if (s >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
  return 'We couldn’t complete that request. Please try again.';
};

/** Turns any raw error text into something safe and readable. Short human sentences are kept as they are. */
export function userText(raw: unknown): string {
  const m = (raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '').trim();
  if (!m) return GENERIC_TEXT;
  const http = m.match(/\bHTTP\s*(?:error\s*)?(\d{3})\b|\bstatus(?: code)?[: ]+(\d{3})\b|\((\d{3})\)/i);
  if (http) return forStatus(Number(http[1] ?? http[2] ?? http[3]));
  if (/^HTTP error$/i.test(m)) return forStatus(500);
  if (CODE.test(m)) return m;
  if (NETWORK.test(m)) return NETWORK_TEXT;
  if (TECHNICAL.test(m) || m.length > 220) return GENERIC_TEXT;
  return m;
}

export function friendlyMessage(err: unknown): string {
  const t = userText(err);
  return CODE.test(t) ? GENERIC_TEXT : t;
}

/** Rewrites every string `error` field in a background response (including nested `errors[]`) so the popup never shows raw failures. */
export function sanitizeResult<T>(value: T, depth = 0): T {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeResult(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = k === 'error' && typeof v === 'string' ? userText(v) : v && typeof v === 'object' ? sanitizeResult(v, depth + 1) : v;
  }
  return out as T;
}
