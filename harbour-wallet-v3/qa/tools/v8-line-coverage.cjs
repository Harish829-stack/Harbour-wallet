// Usage (from apps/extension, after a coverage run): node ../../qa/tools/v8-line-coverage.cjs <v8-cov-dir> <out.txt>. Needs @jridgewell/trace-mapping on the module path (it ships with c8: npm i -D c8).
const fs = require('fs'), path = require('path');
const { TraceMap, eachMapping } = require('@jridgewell/trace-mapping');
const covDir = process.argv[2], root = process.cwd();
const lines = new Map(); // file -> Map(line -> covered bool)
for (const f of fs.readdirSync(covDir)) {
  const j = JSON.parse(fs.readFileSync(path.join(covDir, f)));
  for (const r of j.result) {
    if (!/harbour-qa\/bundle-/.test(r.url)) continue;
    const file = r.url.replace('file://', ''); if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const m = /\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m.exec(text); if (!m) continue;
    const map = new TraceMap(JSON.parse(Buffer.from(m[1], 'base64').toString()));
    const counts = new Int32Array(text.length + 1).fill(1);
    const rs = []; for (const fn of r.functions) for (const g of fn.ranges) rs.push(g);
    rs.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
    for (const g of rs) counts.fill(g.count, g.startOffset, Math.min(g.endOffset, text.length));
    const ls = [0]; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) ls.push(i + 1);
    const seen = new Map();
    eachMapping(map, (e) => {
      if (!e.source || e.originalLine == null) return;
      const src = path.resolve(path.dirname(file), e.source); const rel = path.relative(root, src);
      if (!rel.startsWith('src/')) return;
      const off = ls[e.generatedLine - 1] + e.generatedColumn; const c = counts[off] > 0;
      const k = rel + ':' + e.originalLine; seen.set(k, (seen.get(k) || false) || c);
    });
    for (const [k, c] of seen) { const i = k.lastIndexOf(':'); const rel = k.slice(0, i), ln = +k.slice(i + 1);
      let fm = lines.get(rel); if (!fm) lines.set(rel, fm = new Map()); fm.set(ln, (fm.get(ln) || false) || c); }
  }
}
const rows = []; let T = 0, C = 0;
for (const [f, m] of lines) { let c = 0; for (const v of m.values()) if (v) c++; rows.push([f, c, m.size]); T += m.size; C += c; }
rows.sort();
const dirs = new Map(); for (const [f, c, t] of rows) { const d = path.dirname(f); const x = dirs.get(d) || [0, 0]; x[0] += c; x[1] += t; dirs.set(d, x); }
const pct = (c, t) => (t ? (100 * c / t).toFixed(1) : '-');
let out = `Line coverage of src/** by the QA suites (files that ran at least once: ${rows.length})\nOverall: ${pct(C, T)}% (${C}/${T} executable source lines mapped)\n\nPer directory\n`;
for (const [d, [c, t]] of [...dirs].sort()) out += `${pct(c, t).padStart(6)}%  ${String(c).padStart(5)}/${String(t).padEnd(5)} ${d}\n`;
out += '\nPer file\n'; for (const [f, c, t] of rows) out += `${pct(c, t).padStart(6)}%  ${String(c).padStart(4)}/${String(t).padEnd(4)} ${f}\n`;
fs.writeFileSync(process.argv[3], out); console.log(out.split('\n').slice(0, 45).join('\n'));
