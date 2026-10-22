// Central, redacting logger. Nothing in the codebase should call console.* directly (enforced by lint).
// Only messages are logged, never stacks or error objects, and anything that looks like a secret is masked first:
// API keys in URLs (query or path), long hex strings (private keys, hashes), mnemonic-shaped word runs, long base58/base64 blobs.
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/gi;
const QS_SECRET = /([?&](?:api[-_]?key|apikey|key|token|access[-_]?token|auth|secret|signature|sig|password)=)[^&\s"']*/gi;
const LONG_SEGMENT = /(?<=\/)[A-Za-z0-9_-]{20,}(?=\/|$|\?)/g; // /v2/<alchemy-key>, /v3/<infura-key>, quicknode paths
const HEX_BLOB = /\b(?:0x)?[0-9a-fA-F]{64,}\b/g;
const MNEMONIC = /\b(?:[a-z]{3,8} ){11,}[a-z]{3,8}\b/g;
const BLOB = /\b[A-Za-z0-9+/=_-]{80,}\b/g;
const MAX = 300;

export function redact(input: unknown): string {
  let s: string;
  if (input instanceof Error) s = `${input.name}: ${input.message}`;
  else if (typeof input === 'string') s = input;
  else { try { s = JSON.stringify(input) ?? String(input); } catch { s = String(input); } }
  s = s.replace(URL_RE, (u) => {
    const [base, query = ''] = u.split('?');
    const host = base.replace(/^(https?:\/\/[^/]+)\/?.*$/i, '$1');
    const path = base.slice(host.length).replace(LONG_SEGMENT, '***');
    const subdomain = host.replace(/^(https?:\/\/)([A-Za-z0-9_-]{24,})(\.)/i, '$1***$3'); // quicknode-style key-in-hostname
    return `${subdomain}${path}${query ? `?${query.replace(/(^|&)([^=&]+)=([^&]*)/g, (_m, a, k) => `${a}${k}=***`)}` : ''}`;
  });
  s = s.replace(QS_SECRET, '$1***').replace(HEX_BLOB, '[hex]').replace(MNEMONIC, '[redacted]').replace(BLOB, '[redacted]');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > MAX ? `${s.slice(0, MAX)}…` : s;
}

export function logError(scope: string, err?: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[harbour] ${scope}${err === undefined ? '' : `: ${redact(err)}`}`);
}
export function logWarn(scope: string, detail?: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[harbour] ${scope}${detail === undefined ? '' : `: ${redact(detail)}`}`);
}
