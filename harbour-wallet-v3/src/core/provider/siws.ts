// Sign-In With Solana (Phantom / Solana Wallet Standard `solana:signIn`): message construction and parsing so the approval screen can flag mismatches.
export interface Siws { domain: string; address: string; statement?: string; uri?: string; version?: string; chainId?: string; nonce?: string; issuedAt?: string; expirationTime?: string; notBefore?: string; requestId?: string; resources?: string[] }
const HEAD = / wants you to sign in with your Solana account:\n([1-9A-HJ-NP-Za-km-z]{32,44})\n/;
export function createSiwsMessage(i: Siws): string {
  let m = `${i.domain} wants you to sign in with your Solana account:\n${i.address}`;
  if (i.statement) m += `\n\n${i.statement}`;
  const f: string[] = [];
  if (i.uri) f.push(`URI: ${i.uri}`); if (i.version) f.push(`Version: ${i.version}`); if (i.chainId) f.push(`Chain ID: ${i.chainId}`); if (i.nonce) f.push(`Nonce: ${i.nonce}`);
  if (i.issuedAt) f.push(`Issued At: ${i.issuedAt}`); if (i.expirationTime) f.push(`Expiration Time: ${i.expirationTime}`); if (i.notBefore) f.push(`Not Before: ${i.notBefore}`); if (i.requestId) f.push(`Request ID: ${i.requestId}`);
  if (i.resources?.length) f.push('Resources:', ...i.resources.map((r) => `- ${r}`));
  if (f.length) m += `\n\n${f.join('\n')}`;
  return m;
}
export function parseSiws(message: string): Siws | null {
  const idx = message.indexOf(' wants you to sign in with your Solana account:\n'); if (idx <= 0 || /\s/.test(message.slice(0, idx))) return null;
  const m = HEAD.exec(message.slice(idx)); if (!m) return null;
  const domain = message.slice(0, idx); const rest = message.slice(idx + m[0].length);
  const field = (n: string) => new RegExp(`^${n}: (.*)$`, 'm').exec(rest)?.[1]?.trim();
  const stmt = rest.startsWith('\n') ? rest.slice(1).split('\n\n')[0] : undefined;
  const res = /^Resources:\n((?:- .*\n?)+)/m.exec(rest)?.[1]?.split('\n').filter(Boolean).map((l) => l.replace(/^- /, ''));
  return { domain, address: m[1], statement: stmt && !/^URI: /.test(stmt) ? stmt.trim() : undefined, uri: field('URI'), version: field('Version'), chainId: field('Chain ID'), nonce: field('Nonce'), issuedAt: field('Issued At'), expirationTime: field('Expiration Time'), notBefore: field('Not Before'), requestId: field('Request ID'), resources: res };
}
/** Human-readable problems with a sign-in request, shown as warnings on the approval screen. */
export function siwsIssues(s: Siws, ctx: { host: string; address: string; now?: number }): string[] {
  const out: string[] = []; const now = ctx.now ?? Date.now();
  if (s.domain.toLowerCase() !== ctx.host.toLowerCase()) out.push(`The sign-in message is for ${s.domain}, but this request comes from ${ctx.host}.`);
  if (s.address !== ctx.address) out.push('The sign-in message names a different account than the one connected.');
  if (s.uri) { try { if (new URL(s.uri).host.toLowerCase() !== ctx.host.toLowerCase()) out.push('The sign-in URI points to a different site.'); } catch { out.push('The sign-in URI is invalid.'); } }
  if (s.expirationTime && Date.parse(s.expirationTime) < now) out.push('This sign-in request has already expired.');
  if (s.notBefore && Date.parse(s.notBefore) > now) out.push('This sign-in request is not valid yet.');
  if (!s.nonce) out.push('The sign-in message has no nonce, so it could be replayed.');
  return out;
}
