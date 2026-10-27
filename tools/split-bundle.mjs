// Split Trust Wallet's single-file background.js into one file per bundled module, so REA can analyse each
// module within its per-record limits. Source text is copied byte-for-byte; manifest.json records every byte range.
// Usage: node --max-old-space-size=8192 split-bundle.mjs <bundle.js> <outDir> [batchBytes]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), 'toolchain', 'package.json'));
const { parse } = require('@babel/parser');

const [src, out, batchArg] = process.argv.slice(2);
const BATCH = Number(batchArg || 200 * 1024);
const text = readFileSync(src, 'utf8');
const ast = parse(text, { sourceType: 'script', errorRecovery: true, ranges: false, tokens: false });

// Find the largest function body in the top-level program (the bundle's wrapper function).
let body = ast.program.body;
let best = null;
const consider = (fn) => { if (fn && fn.body && fn.body.type === 'BlockStatement' && (!best || fn.end - fn.start > best.end - best.start)) best = fn; };
for (const st of ast.program.body) {
  if (st.type === 'VariableDeclaration') for (const d of st.declarations) { const c = d.init; if (c && c.type === 'CallExpression') consider(c.callee); }
  if (st.type === 'ExpressionStatement') { const e = st.expression; const c = e.type === 'UnaryExpression' ? e.argument : e; if (c && c.type === 'CallExpression') consider(c.callee); }
}
if (best && best.end - best.start > text.length / 2) body = best.body.body;

const wrapperName = (init) => {
  if (!init || init.type !== 'CallExpression' || init.callee.type !== 'Identifier') return null;
  const n = init.callee.name;
  return /^__(esmMin|commonJSMin|esm|commonJS|lazy)/.test(n) ? n : null;
};
const units = []; let glue = [];
const flushGlue = () => { if (glue.length) { units.push({ kind: 'glue', name: `glue_${units.length}`, start: glue[0].start, end: glue.at(-1).end }); glue = []; } };
for (const st of body) {
  if (st.type === 'VariableDeclaration' && st.declarations.some((d) => wrapperName(d.init))) {
    for (const d of st.declarations) {
      const w = wrapperName(d.init);
      if (w) { flushGlue(); units.push({ kind: w, name: d.id.type === 'Identifier' ? d.id.name : `anon_${units.length}`, start: d.start, end: d.end }); }
      else glue.push(d);
    }
  } else glue.push(st);
}
flushGlue();

mkdirSync(join(out, 'modules'), { recursive: true });
const safe = (s) => s.replace(/[^A-Za-z0-9_$.-]/g, '_').slice(0, 80);
const manifest = { source: src, sha256: createHash('sha256').update(text).digest('hex'), bytes: text.length, units: [], batches: [] };
let batch = [], size = 0;
units.forEach((u, i) => {
  const file = `modules/${String(i).padStart(5, '0')}_${safe(u.name)}.js`;
  const code = text.slice(u.start, u.end);
  const last = i === units.length - 1 && u.kind === 'glue'; // the wrapper's closing statements contain its `return`
  const body = u.kind !== 'glue' ? `var ${code};` : last ? `(function () {\n${code}\n});` : code;
  writeFileSync(join(out, file), `// ${u.kind} ${u.name} | ${src} [${u.start}, ${u.end})\n${body}\n`);
  manifest.units.push({ file, kind: u.kind, name: u.name, start: u.start, end: u.end });
  if (size && size + code.length > BATCH) { manifest.batches.push(batch); batch = []; size = 0; }
  batch.push(file); size += code.length;
});
if (batch.length) manifest.batches.push(batch);
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
const kinds = manifest.units.reduce((m, u) => ((m[u.kind] = (m[u.kind] || 0) + 1), m), {});
console.log(JSON.stringify({ units: manifest.units.length, kinds, batches: manifest.batches.length }));
