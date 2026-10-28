// Health check for every configured RPC endpoint:  node scripts/check-rpc.mjs [--strict]
// EVM: eth_chainId must match the chain. Solana: getHealth must answer ok. Prints host + latency only (never full URLs).
// Exit code 1 when a chain has fewer than 2 live endpoints (or any dead one with --strict).
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(new URL('../src/config/rpcEndpoints.json', import.meta.url), 'utf8'));
const strict = process.argv.includes('--strict');
const host = (u) => new URL(u).host;
async function probe(url, body, check) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (r.status === 429) return { ok: false, why: 'rate limited (429)' };
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    const j = await r.json();
    return check(j) ? { ok: true, ms: Date.now() - t0 } : { ok: false, why: j?.error?.message ? 'rpc error' : 'wrong answer' };
  } catch (e) { return { ok: false, why: e?.name === 'TimeoutError' ? 'timeout' : 'unreachable' }; }
}
let bad = 0;
const groups = [...Object.entries(cfg.evm).map(([id, urls]) => ({ name: `chain ${id}`, urls, body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }, check: (j) => parseInt(j?.result, 16) === Number(id) })),
  { name: 'solana', urls: cfg.solana, body: { jsonrpc: '2.0', id: 1, method: 'getHealth' }, check: (j) => j?.result === 'ok' }];
for (const g of groups) {
  const res = await Promise.all(g.urls.map((u) => probe(u, g.body, g.check)));
  const live = res.filter((r) => r.ok).length;
  console.log(`${live >= 2 ? 'PASS' : 'FAIL'}  ${g.name}: ${live}/${g.urls.length} live`);
  res.forEach((r, i) => console.log(`        ${r.ok ? 'ok  ' : 'DEAD'} ${host(g.urls[i])} ${r.ok ? `${r.ms}ms` : r.why}`));
  if (live < 2 || (strict && live < g.urls.length)) bad++;
}
process.exit(bad ? 1 : 0);
