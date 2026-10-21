// Probes each extra chain's endpoints live. Run on your Mac from harbour-wallet-v2: node scripts/check-chains.mjs [--write]
// --write saves the passing ids to src/core/chains/extra-enabled.json (enables them in the wallet).
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../src/core/chains/', import.meta.url);
const extras = JSON.parse(readFileSync(new URL('registry.extra.json', dir), 'utf8'));
const t = (u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(10000) });
async function probe(c) {
  for (const u of c.kind === 'evm' ? c.rpcs ?? [] : c.endpoints ?? []) {
    try {
      if (c.kind === 'evm') {
        const r = await (await t(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' })).json();
        if (parseInt(r.result, 16) === c.evmChainId) return u;
      } else if (c.api === 'blockbook') {
        const r = await (await t(`${u}/api/v2/estimatefee/2`)).json();
        if (r && 'result' in r) return u;
      } else if (c.kind === 'cardano') {
        const r = await (await t(`${u}/tip`)).json();
        if (Number(r?.[0]?.abs_slot) > 0) return u;
      }
    } catch { /* try next endpoint */ }
  }
  return null;
}
const ok = [];
for (const c of extras) { const u = await probe(c); console.log(u ? 'PASS' : 'FAIL', c.id, u ?? ''); if (u) ok.push(c.id); }
if (process.argv.includes('--write')) { writeFileSync(new URL('extra-enabled.json', dir), JSON.stringify(ok, null, 2) + '\n'); console.log('wrote extra-enabled.json:', ok.join(', ')); }
else console.log('\nPassing:', JSON.stringify(ok), '\n(re-run with --write to enable them)');
