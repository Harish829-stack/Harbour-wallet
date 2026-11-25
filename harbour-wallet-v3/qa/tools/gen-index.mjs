import fs from 'node:fs'; import path from 'node:path';
const R = process.argv[2]; const ext = path.join(R, 'apps/extension/src'); const be = path.join(R, 'apps/backend');
const rel = (p) => path.relative(R, p);
const lines = (p) => fs.readFileSync(p, 'utf8').split('\n');
const out = [];
// 1. INTERNAL messages
const hfiles = [...fs.readdirSync(path.join(ext, 'background/modules')).map((f) => path.join(ext, 'background/modules', f)), ...fs.readdirSync(path.join(ext, 'background/handlers')).map((f) => path.join(ext, 'background/handlers', f))].filter((f) => f.endsWith('.ts'));
const msgs = [];
for (const f of hfiles) {
  const L = lines(f); const src = L.join('\n');
  const m = src.match(/export const handlers: HandlerMap = \{([^}]*)\};/);
  let names = [];
  if (m && !m[1].includes('(')) names = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(':')[0].trim());
  else {
    const start = L.findIndex((l) => /export const handlers: HandlerMap = \{/.test(l));
    if (start >= 0) {
      let end = L.findIndex((l, i) => i > start && /^\};/.test(l)); if (end < 0) end = L.length;
      for (let i = start + 1; i < end; i++) { const mm = L[i].match(/^  (?:async )?([a-zA-Z][a-zA-Z0-9_]*)(?:: async| ?\(m)/); if (mm) names.push(mm[1]); }
    }
  }
  for (const n of [...new Set(names)]) {
    let ln = L.findIndex((l) => new RegExp(`^  (async )?${n}(: async|\\s?\\()`).test(l));
    if (ln < 0) ln = L.findIndex((l) => new RegExp(`^(export )?(async )?(function|const) ${n}\\b`).test(l));
    msgs.push([n, `${rel(f)}:${ln + 1}`]);
  }
}
fs.writeFileSync(path.join(process.argv[3], 'messages.tsv'), msgs.map((x) => x.join('\t')).join('\n'));
// 2. provider methods
const mf = path.join(ext, 'core/provider/methods.ts'); const ML = lines(mf);
const pm = []; let ns = '';
for (const [i, l] of ML.entries()) {
  if (/export const EVM_METHODS/.test(l)) ns = 'evm'; if (/export const SOLANA_METHODS/.test(l)) ns = 'solana'; if (/export const MULTI_METHODS/.test(l)) ns = 'multi'; if (/export const UNSUPPORTED_EVM/.test(l)) ns = '';
  if (!ns) continue;
  for (const mm of l.matchAll(/\b([a-zA-Z_0-9]+): (\{[^}]*\}|L)/g)) pm.push([ns, mm[1], mm[2] === 'L' ? 'local' : (mm[2].match(/kind: '(\w+)'/) || [])[1], /approval: true/.test(mm[2]) ? 'Y' : '', /needsConnection: true/.test(mm[2]) ? 'Y' : '', `${rel(mf)}:${i + 1}`]);
  if (ns === 'evm' && /^\s+'eth_/.test(l)) for (const mm of l.matchAll(/'([a-zA-Z_0-9]+)'/g)) pm.push([ns, mm[1], 'rpc', '', '', `${rel(mf)}:${i + 1}`]);
}
fs.writeFileSync(path.join(process.argv[3], 'provider.tsv'), pm.map((x) => x.join('\t')).join('\n'));
// 3. Go funcs
const gofiles = []; const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (!['contracttest', 'testdata', 'deploy'].includes(n)) walk(p); } else if (p.endsWith('.go') && !p.endsWith('_test.go')) gofiles.push(p); } };
for (const d of ['cmd', 'internal', 'adapters', 'migrations']) walk(path.join(be, d));
const gf = []; for (const f of gofiles.sort()) for (const [i, l] of lines(f).entries()) { const mm = l.match(/^func (\([^)]*\) )?([A-Za-z0-9_]+)/); if (mm) gf.push([rel(f) + ':' + (i + 1), (mm[1] ? mm[1].trim() + ' ' : '') + mm[2]]); }
fs.writeFileSync(path.join(process.argv[3], 'gofuncs.tsv'), gf.map((x) => x.join('\t')).join('\n'));
// 4. routes
const rt = []; for (const f of gofiles) for (const [i, l] of lines(f).entries()) { const mm = l.match(/\br(?:\.With\([^)]*\))?\.(Get|Post|Put|Delete)\("([^"]+)", ([a-zA-Z.]+)/); if (mm) rt.push([mm[1].toUpperCase(), mm[2], mm[3], rel(f) + ':' + (i + 1)]); }
fs.writeFileSync(path.join(process.argv[3], 'routes.tsv'), rt.map((x) => x.join('\t')).join('\n'));
// 5. DB objects
const db = []; for (const f of fs.readdirSync(path.join(be, 'migrations')).filter((n) => n.endsWith('.sql')).sort()) for (const [i, l] of lines(path.join(be, 'migrations', f)).entries()) { const mm = l.match(/^(CREATE (?:TABLE|INDEX|OR REPLACE FUNCTION|ROLE)|ALTER TABLE|\s+CREATE ROLE)\s+(?:IF NOT EXISTS )?([a-z_0-9]+)/i); if (mm) db.push([mm[1].trim(), mm[2], `apps/backend/migrations/${f}:${i + 1}`]); }
fs.writeFileSync(path.join(process.argv[3], 'db.tsv'), db.map((x) => x.join('\t')).join('\n'));
console.log(msgs.length, pm.length, gf.length, rt.length, db.length);
