// Reproducible-build check: two clean production builds must produce identical files (and identical deterministic zips).
//   node scripts/repro.mjs
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles, zipDir } from './lib-zip.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
for (const s of ['prepare-wasm', 'build-inpage', 'build-content']) execSync(`node scripts/${s}.mjs`, { cwd: root, stdio: 'ignore' });
const dirs = [1, 2].map((i) => { const d = mkdtempSync(path.join(tmpdir(), `hb-repro-${i}-`)); execSync(`npx vite build --outDir ${d} --emptyOutDir`, { cwd: root, stdio: 'ignore' }); return d; });
const [a, b] = dirs.map((d) => new Map(listFiles(d).map((f) => [f, sha(readFileSync(path.join(d, f)))])));
const diff = [...new Set([...a.keys(), ...b.keys()])].filter((f) => a.get(f) !== b.get(f));
const [za, zb] = dirs.map((d) => sha(zipDir(d).zip));
console.log(diff.length ? `NOT reproducible: ${diff.length} file(s) differ:\n  ${diff.slice(0, 20).join('\n  ')}` : `reproducible: ${a.size} files identical; zip ${za === zb ? 'identical' : 'DIFFERS'} (${za})`);
process.exit(diff.length || za !== zb ? 1 : 0);
