// Sign-In-With-Ethereum (EIP-4361) message parsing so the approval screen can show a sign-in card and flag mismatches (TW: sign-siwe.* / sign-message.*.mismatch).
export interface Siwe { domain: string; address: string; statement?: string; uri?: string; version?: string; chainId?: number; nonce?: string; issuedAt?: string; expirationTime?: string }
export function parseSiwe(message: string): Siwe | null {
  const m = /^([^\s]+) wants you to sign in with your Ethereum account:\n(0x[0-9a-fA-F]{40})\n/.exec(message);
  if (!m) return null;
  const rest = message.slice(m[0].length);
  const field = (name: string) => new RegExp(`^${name}: (.*)$`, 'm').exec(rest)?.[1]?.trim();
  const chain = field('Chain ID');
  const stmt = rest.startsWith('\n') ? rest.slice(1).split('\n\n')[0] : undefined;
  return { domain: m[1], address: m[2], statement: stmt && !/^URI: /.test(stmt) ? stmt.trim() : undefined, uri: field('URI'), version: field('Version'), chainId: chain && /^\d+$/.test(chain) ? Number(chain) : undefined, nonce: field('Nonce'), issuedAt: field('Issued At'), expirationTime: field('Expiration Time') };
}
export type SiweIssue = 'domain' | 'address' | 'chain';
export function siweIssues(s: Siwe, ctx: { host: string; address: string; chainId: number }): SiweIssue[] {
  const out: SiweIssue[] = [];
  if (s.domain.toLowerCase() !== ctx.host.toLowerCase()) out.push('domain');
  if (s.address.toLowerCase() !== ctx.address.toLowerCase()) out.push('address');
  if (s.chainId !== undefined && s.chainId !== ctx.chainId) out.push('chain');
  return out;
}
