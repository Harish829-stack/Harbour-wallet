// Push notifications for harbour-gateway: device registration (KV) + a cron watcher that polls registered addresses and sends
// FCM HTTP v1 data messages (shown by the extension's chrome.gcm listener). Needs the CACHE KV binding, a cron trigger and the
// FCM_SERVICE_ACCOUNT secret (Firebase service-account JSON). Free-plan budget: 50 subrequests per invocation, so each run
// checks a rotating slice of addresses (PUSH_BUDGET); KV writes happen only when something changed.
interface KV { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>; delete(k: string): Promise<void>; list(o: { prefix: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> }
export interface PushEnv { CACHE?: KV; FCM_SERVICE_ACCOUNT?: string; ETHERSCAN_API_KEY?: string; HELIUS_API_KEY?: string; TRONGRID_API_KEY?: string }
export interface Watch { chainId: string; address: string }
export interface Reg { token: string; addresses: Watch[]; topics: { activity: boolean; product_announcement: boolean }; cursors: Record<string, string>; at: number }
export interface Notice { title: string; body: string; url?: string }

const EVM: Record<string, { id: number; sym: string; explorer: string }> = {
  ethereum: { id: 1, sym: 'ETH', explorer: 'https://etherscan.io/tx/' }, smartchain: { id: 56, sym: 'BNB', explorer: 'https://bscscan.com/tx/' },
  polygon: { id: 137, sym: 'POL', explorer: 'https://polygonscan.com/tx/' }, arbitrum: { id: 42161, sym: 'ETH', explorer: 'https://arbiscan.io/tx/' }, base: { id: 8453, sym: 'ETH', explorer: 'https://basescan.org/tx/' },
};
const ADDR: Record<string, RegExp> = { evm: /^0x[0-9a-fA-F]{40}$/, solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, bitcoin: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/ };
export const PUSH_BUDGET = 40;
const MAX_ADDRESSES = 12;
const TTL = 30 * 86400;

export function validWatch(w: any): w is Watch {
  if (!w || typeof w.chainId !== 'string' || typeof w.address !== 'string') return false;
  if (EVM[w.chainId]) return ADDR.evm.test(w.address);
  return !!ADDR[w.chainId] && ADDR[w.chainId].test(w.address);
}
export async function regKey(token: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return 'push:' + Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}
const fmt = (raw: string, decimals: number) => { const v = BigInt(raw); const base = 10n ** BigInt(decimals); const w = v / base; const fr = (v % base).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, ''); return `${w}${fr ? '.' + fr : ''}`; };

export async function register(env: PushEnv, body: any): Promise<{ status: number; body: unknown }> {
  if (!env.CACHE) return { status: 503, body: { error: 'push_unavailable' } };
  const token = String(body?.token ?? '');
  if (!/^[A-Za-z0-9:_\-.]{20,4096}$/.test(token)) return { status: 400, body: { error: 'bad_token' } };
  const addresses = (Array.isArray(body?.addresses) ? body.addresses : []).filter(validWatch).slice(0, MAX_ADDRESSES).map((w: Watch) => ({ chainId: w.chainId, address: w.address }));
  const key = await regKey(token);
  const prev: Reg | null = JSON.parse((await env.CACHE.get(key)) ?? 'null');
  const cursors: Record<string, string> = {};
  for (const w of addresses) { const k = `${w.chainId}:${w.address}`; if (prev?.cursors?.[k]) cursors[k] = prev.cursors[k]; }
  const reg: Reg = { token, addresses, topics: { activity: body?.topics?.activity !== false, product_announcement: body?.topics?.product_announcement !== false }, cursors, at: Date.now() };
  await env.CACHE.put(key, JSON.stringify(reg), { expirationTtl: TTL });
  return { status: 200, body: { ok: true, watching: addresses.length } };
}
export async function unregister(env: PushEnv, body: any): Promise<{ status: number; body: unknown }> {
  if (!env.CACHE) return { status: 503, body: { error: 'push_unavailable' } };
  const token = String(body?.token ?? ''); if (!token) return { status: 400, body: { error: 'bad_token' } };
  await env.CACHE.delete(await regKey(token));
  return { status: 200, body: { ok: true } };
}

type F = typeof fetch;
const getJson = async (f: F, url: string, init?: RequestInit) => { const r = await f(url, init); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<any>; };

/** New incoming activity for one address since `cursor`. The first look (no cursor) only sets the cursor. Uses 1-2 subrequests. */
export async function checkAddress(env: PushEnv, w: Watch, cursor: string | undefined, f: F = fetch): Promise<{ notices: Notice[]; cursor?: string; calls: number }> {
  const evm = EVM[w.chainId];
  if (evm) {
    if (!env.ETHERSCAN_API_KEY) return { notices: [], cursor, calls: 0 };
    const q = (action: string) => `https://api.etherscan.io/v2/api?chainid=${evm.id}&module=account&action=${action}&address=${w.address}&startblock=${cursor ? Number(cursor) + 1 : 0}&sort=desc&page=1&offset=15&apikey=${env.ETHERSCAN_API_KEY}`;
    const [native, tokens] = await Promise.all([getJson(f, q('txlist')).catch(() => null), getJson(f, q('tokentx')).catch(() => null)]);
    const rows = [...(Array.isArray(native?.result) ? native.result.map((t: any) => ({ ...t, _native: true })) : []), ...(Array.isArray(tokens?.result) ? tokens.result : [])];
    const top = rows.reduce((m: number, t: any) => Math.max(m, Number(t.blockNumber) || 0), Number(cursor ?? 0));
    if (!cursor) return { notices: [], cursor: String(top || 0), calls: 2 };
    const me = w.address.toLowerCase();
    const notices = rows.filter((t: any) => String(t.to).toLowerCase() === me && t.isError !== '1' && BigInt(t.value ?? '0') > 0n).slice(0, 3).map((t: any) => {
      const sym = t._native ? evm.sym : `${String(t.tokenSymbol ?? 'token').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 12) || 'token'} (unverified token)`; const dec = t._native ? 18 : Number(t.tokenDecimal ?? 18);
      return { title: `Received ${fmt(String(t.value), dec)} ${sym}`, body: `On ${w.chainId} from ${String(t.from).slice(0, 8)}…${String(t.from).slice(-4)}`, url: evm.explorer + t.hash };
    });
    return { notices, cursor: String(top), calls: 2 };
  }
  if (w.chainId === 'tron') {
    const since = cursor ? Number(cursor) + 1 : Date.now();
    const h: Record<string, string> = env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY } : {};
    const j = await getJson(f, `https://api.trongrid.io/v1/accounts/${w.address}/transactions?only_to=true&only_confirmed=true&limit=10&min_timestamp=${since}`, { headers: h }).catch(() => null);
    const rows: any[] = Array.isArray(j?.data) ? j.data : [];
    const top = rows.reduce((m, t) => Math.max(m, Number(t.block_timestamp) || 0), Number(cursor ?? Date.now()));
    if (!cursor) return { notices: [], cursor: String(top), calls: 1 };
    const notices = rows.map((t) => t?.raw_data?.contract?.[0]).filter((c) => c?.type === 'TransferContract').slice(0, 3)
      .map((c) => ({ title: `Received ${fmt(String(c.parameter?.value?.amount ?? 0), 6)} TRX`, body: 'On TRON', url: undefined }));
    return { notices, cursor: String(top), calls: 1 };
  }
  if (w.chainId === 'solana') {
    if (!env.HELIUS_API_KEY) return { notices: [], cursor, calls: 0 };
    const j = await getJson(f, `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [w.address, { limit: 10, ...(cursor ? { until: cursor } : {}) }] }) }).catch(() => null);
    const sigs: any[] = (Array.isArray(j?.result) ? j.result : []).filter((s: any) => !s.err);
    const top = sigs[0]?.signature ?? cursor;
    if (!cursor) return { notices: [], cursor: top ?? '', calls: 1 };
    const notices = sigs.slice(0, 1).map((s) => ({ title: 'New Solana activity', body: sigs.length > 1 ? `${sigs.length} new transactions on your account` : 'A new transaction on your account', url: `https://solscan.io/tx/${s.signature}` }));
    return { notices, cursor: top, calls: 1 };
  }
  if (w.chainId === 'bitcoin') {
    const txs: any[] = await getJson(f, `https://mempool.space/api/address/${w.address}/txs`).catch(() => []);
    const confirmed = (Array.isArray(txs) ? txs : []).filter((t) => t?.status?.confirmed);
    const top = confirmed[0]?.txid ?? cursor;
    if (!cursor) return { notices: [], cursor: top ?? '', calls: 1 };
    const fresh: any[] = []; for (const t of confirmed) { if (t.txid === cursor) break; fresh.push(t); }
    const notices = fresh.map((t) => ({ t, v: (t.vout ?? []).filter((o: any) => o.scriptpubkey_address === w.address).reduce((n: number, o: any) => n + Number(o.value ?? 0), 0), spent: (t.vin ?? []).some((i: any) => i?.prevout?.scriptpubkey_address === w.address) }))
      .filter((x) => x.v > 0 && !x.spent).slice(0, 3).map((x) => ({ title: `Received ${fmt(String(x.v), 8)} BTC`, body: 'On Bitcoin', url: `https://mempool.space/tx/${x.t.txid}` }));
    return { notices, cursor: top, calls: 1 };
  }
  return { notices: [], cursor, calls: 0 };
}

// ---- FCM HTTP v1 ----
const b64url = (b: ArrayBuffer | Uint8Array | string) => { const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer); let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export async function fcmAccessToken(sa: { client_email: string; private_key: string }, f: F = fetch, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64url(sig)}` });
  const j: any = await r.json(); if (!j?.access_token) throw new Error('FCM auth failed');
  return j.access_token;
}
/** Returns false when FCM says the token is gone (the registration is then deleted). */
export async function fcmSend(projectId: string, access: string, token: string, n: Notice, f: F = fetch): Promise<boolean> {
  const r = await f(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ message: { token, data: { title: n.title, body: n.body, ...(n.url ? { url: n.url } : {}) } } }) });
  if (r.status === 404 || r.status === 400) { const t = await r.text(); if (/UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/.test(t)) return false; }
  return true;
}

/** Cron entry: a rotating slice of (registration, address) pairs within the subrequest budget. */
export async function runWatcher(env: PushEnv, f: F = fetch, budget = PUSH_BUDGET): Promise<{ checked: number; sent: number }> {
  if (!env.CACHE || !env.FCM_SERVICE_ACCOUNT) return { checked: 0, sent: 0 };
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const keys = (await env.CACHE.list({ prefix: 'push:', limit: 1000 })).keys.map((k) => k.name).filter((k) => k !== 'push:_offset');
  if (!keys.length) return { checked: 0, sent: 0 };
  let offset = Number((await env.CACHE.get('push:_offset')) ?? 0) % keys.length;
  let calls = 3; let checked = 0; let sent = 0; let access: string | null = null; // 3 = list + offset read + token exchange reserve
  for (let i = 0; i < keys.length && calls < budget; i++) {
    const key = keys[(offset + i) % keys.length];
    const reg: Reg | null = JSON.parse((await env.CACHE.get(key)) ?? 'null'); calls++;
    if (!reg?.topics?.activity) continue;
    let changed = false; let gone = false;
    try {
    for (const w of reg.addresses) {
      if (calls + 2 > budget) break;
      const k = `${w.chainId}:${w.address}`;
      const r = await checkAddress(env, w, reg.cursors[k], f); calls += r.calls; checked++;
      if (r.cursor !== undefined && r.cursor !== reg.cursors[k]) { reg.cursors[k] = r.cursor; changed = true; }
      for (const n of r.notices) {
        if (calls >= budget) break;
        access ??= await fcmAccessToken(sa, f);
        calls++; if (!(await fcmSend(sa.project_id, access, reg.token, n, f))) { gone = true; break; }
        sent++;
      }
      if (gone) break;
    }
    } catch { /* one malformed registration or upstream row must never stall the whole run (INF-05) */ }
    if (gone) await env.CACHE.delete(key);
    else if (changed) await env.CACHE.put(key, JSON.stringify(reg), { expirationTtl: TTL });
    offset = (offset + i + 1) % keys.length;
  }
  await env.CACHE.put('push:_offset', String(offset));
  return { checked, sent };
}
