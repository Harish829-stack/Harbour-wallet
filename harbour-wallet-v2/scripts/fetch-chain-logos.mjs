// Downloads each chain's logo from the public trustwallet/assets repository into public-production/chains/<id>.png (bundled locally,
// so the extension never hot-links images). Run once; commit the PNGs. Falls back to the wallet-core id folder.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const rows = JSON.parse(fs.readFileSync('src/core/chains/registry.json', 'utf8'));
fs.mkdirSync('public-production/chains', { recursive: true });
const base = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const fail = [];
for (const r of rows) {
  const out = `public-production/chains/${r.id}.png`;
  if (fs.existsSync(out) && fs.statSync(out).size > 200) continue;
  let ok = false;
  for (const h of [r.id, r.wcId, r.id.replace(/_/g, ''), r.name.toLowerCase().replace(/\s+/g, '')]) {
    // curl honours the environment's proxy settings (Node's fetch does not).
    const r2 = spawnSync('curl', ['-sfL', '-m', '20', '-o', out, `${base}/${h}/info/logo.png`]);
    if (r2.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 200) { ok = true; break; }
    try { fs.rmSync(out, { force: true }); } catch {}
  }
  if (!ok) fail.push(r.id);
}
console.log('failed:', fail.join(', ') || 'none');
