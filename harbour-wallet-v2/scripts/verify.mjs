// One command for every commit:  npm run verify
// type-check -> unit tests -> gateway type-check -> production build (to a temp dir) -> secret-leak scan of the bundle.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(tmpdir(), `harbour-verify-${process.pid}`);
const run = (name, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: process.env });
  const ok = r.status === 0; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) { console.log((r.stdout + r.stderr).split('\n').slice(-25).join('\n')); process.exit(1); }
};
run('tsc (extension)', 'npx', ['tsc', '--noEmit']);
run('tsc (gateway)', 'npx', ['tsc', '-p', 'gateway/tsconfig.json']);
if (!process.argv.includes('--skip-tests')) run('unit tests', 'npm', ['test', '--silent']);
for (const sc of ['prepare-wasm', 'build-inpage', 'build-content']) run(`prebuild ${sc}`, 'node', [`scripts/${sc}.mjs`]);
run('production build', 'npx', ['vite', 'build', '--outDir', out, '--emptyOutDir']);

// Leak scan: no secret from the key file, and no obvious key shapes, may appear in the built extension.
const secrets = [];
for (const f of [path.join(root, '..', 'harbour-keys.env'), path.join(root, '.env.local')]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z_]+)=(.+)$/); if (m && m[2].length > 12 && !/^(VITE_|TEST_)/.test(m[1])) secrets.push(m[2].trim());
  }
}
const SHAPES = [/sk_(live|test)_[A-Za-z0-9]{16,}/, /x-lifi-api-key/i, /api[-_]?key=[A-Za-z0-9]{16,}/i];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(js|html|json|css|map)$/.test(n) ? [p] : []; });
const hits = [];
for (const f of walk(out)) { const t = readFileSync(f, 'utf8'); if (secrets.some((s) => t.includes(s)) || SHAPES.some((re) => re.test(t))) hits.push(path.relative(out, f)); }
console.log(`${hits.length ? 'FAIL' : 'PASS'}  secret-leak scan (${secrets.length} key values checked)`);
if (hits.length) { console.log(hits.join('\n')); process.exit(1); }
console.log('\nAll verification steps passed.');
