// Release and build tooling (EXT-14, X-07): the real scripts are run against throwaway copies of the repo layout with a
// throwaway Ed25519 key generated in the test. Nothing here reads the real release key, key files or .env files.
// TEST_PLAN: T-EXT-031, T-EXT-033, T-X-009.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, createHash, sign, createPrivateKey } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPTS = path.join(EXT, 'scripts');

/** A fake checkout: <tmp>/a/b/c/ext/{scripts,dist}. release.mjs looks for its key file three levels above ext/, so the
 *  default key path stays inside the sandbox too. */
function sandbox({ api = 'https://api.harbour.example', hostPerms = ['https://api.harbour.example/*'], local = false } = {}) {
  const top = mkdtempSync(path.join(tmpdir(), 'hb-rel-'));
  const root = path.join(top, 'a', 'b', 'c', 'ext');
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  for (const f of ['release.mjs', 'verify-release.mjs', 'lib-zip.mjs']) copyFileSync(path.join(SCRIPTS, f), path.join(root, 'scripts', f));
  const dist = path.join(root, 'dist'); mkdirSync(path.join(dist, 'assets'), { recursive: true });
  writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({ name: 'Harbour QA', version: '9.9.9', manifest_version: 3, host_permissions: hostPerms }));
  writeFileSync(path.join(dist, 'build-info.json'), JSON.stringify({ api, local }));
  writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log("harbour qa bundle");\n'.repeat(50));
  return { top, root, dist, cleanup: () => rmSync(top, { recursive: true, force: true }) };
}
const keypair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), pub: publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('base64') };
};
const node = (cwd, args, env = {}) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(HB_RELEASE|HARBOUR_RELEASE)/.test(k)));
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...clean, ...env } });
};

test('T-EXT-031: release.mjs signs a deterministic zip; verify-release.mjs accepts it and rejects a tampered byte, a wrong pin and a swapped signer', () => {
  const s = sandbox(); const k = keypair();
  try {
    const env = { HB_RELEASE_KEY_PEM: k.pem, HB_RELEASE_APPROVERS: 'alice,bob' };
    const r = node(s.root, ['scripts/release.mjs', '--no-build'], env);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(path.join(s.root, 'release-signer.pub'), 'utf8').trim(), k.pub, 'first release pins the signer');
    const zip = path.join(s.root, 'releases', 'harbour-9.9.9.zip');
    const meta = JSON.parse(readFileSync(path.join(s.root, 'releases', 'harbour-9.9.9.release.json'), 'utf8'));
    assert.equal(meta.sha256, createHash('sha256').update(readFileSync(zip)).digest('hex'));
    assert.deepEqual(meta.approvers, ['alice', 'bob']);
    assert.ok(meta.files.some((f) => f.path === 'assets/app.js'));
    const first = readFileSync(zip);
    // deterministic: a second release of the same dist is byte-identical
    assert.equal(node(s.root, ['scripts/release.mjs', '--no-build'], env).status, 0);
    assert.ok(readFileSync(zip).equals(first), 'same dist → byte-identical zip');

    const ok = node(s.root, ['scripts/verify-release.mjs', zip]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr); assert.match(ok.stdout, /signature OK · sha256 OK/);

    // tamper one byte in the middle of the archive
    const bad = Buffer.from(first); bad[bad.length >> 1] ^= 0x01; writeFileSync(zip, bad);
    const t1 = node(s.root, ['scripts/verify-release.mjs', zip]);
    assert.equal(t1.status, 1, 'tampered zip refused'); assert.match(t1.stdout, /signature BAD/);
    writeFileSync(zip, first);

    // a different pinned key (argument) is refused even though release.json names the real signer
    const other = keypair();
    const t2 = node(s.root, ['scripts/verify-release.mjs', zip, other.pub]);
    assert.notEqual(t2.status, 0, 'wrong pinned key refused');

    // an attacker re-signs the zip with their own key and rewrites release.json: the repo pin still wins
    const evil = keypair();
    writeFileSync(`${zip}.sig`, sign(null, first, createPrivateKey(evil.pem)).toString('base64') + '\n');
    const mf = path.join(s.root, 'releases', 'harbour-9.9.9.release.json');
    writeFileSync(mf, JSON.stringify({ ...meta, signer: evil.pub }));
    assert.equal(node(s.root, ['scripts/verify-release.mjs', zip]).status, 1, 'release.json signer swap refused');
    writeFileSync(mf, JSON.stringify({ ...meta }));
    assert.equal(node(s.root, ['scripts/verify-release.mjs', zip]).status, 1, 'foreign signature refused under the pinned key');

    // no pin anywhere → refuses to trust release.json
    rmSync(path.join(s.root, 'release-signer.pub'));
    assert.equal(node(s.root, ['scripts/verify-release.mjs', zip]).status, 2, 'no pinned signer → refuse');
  } finally { s.cleanup(); }
});


test('T-EXT-031 (refusals): release.mjs refuses http/tunnel/local builds, one approver, no key, and a key that does not match the pin', () => {
  const k = keypair(); const env = { HB_RELEASE_KEY_PEM: k.pem, HB_RELEASE_APPROVERS: 'alice,bob' };
  const cases = [
    [{ api: 'http://api.harbour.example' }, env, /release refused: dist\/ was built for/],
    [{ api: 'http://localhost:8080', local: true, hostPerms: ['http://localhost:8080/*'] }, env, /release refused/],
    [{ api: 'https://abc.trycloudflare.com' }, env, /temporary tunnel/],
    [{ hostPerms: ['http://api.harbour.example/*'] }, env, /release refused/],
    [{}, { ...env, HB_RELEASE_APPROVERS: 'alice' }, /two different approvers/],
    [{}, { ...env, HB_RELEASE_APPROVERS: 'alice,ALICE' }, /two different approvers/],
    [{}, { HB_RELEASE_APPROVERS: 'alice,bob' }, /no signing key/],
  ];
  for (const [opt, e, re] of cases) {
    const s = sandbox(opt);
    try {
      const r = node(s.root, ['scripts/release.mjs', '--no-build'], e);
      assert.equal(r.status, 1, `${JSON.stringify(opt)} ${JSON.stringify(Object.keys(e))}: ${r.stdout}`);
      assert.match(r.stderr, re);
      assert.ok(!existsSync(path.join(s.root, 'releases')), 'nothing written');
    } finally { s.cleanup(); }
  }
  const s = sandbox();
  try {
    writeFileSync(path.join(s.root, 'release-signer.pub'), keypair().pub + '\n');
    const r = node(s.root, ['scripts/release.mjs', '--no-build'], env);
    assert.equal(r.status, 1); assert.match(r.stderr, /does not match release-signer.pub/);
    // a key file inside the repo or readable by others is refused
    const kf = path.join(s.root, 'k.json'); writeFileSync(kf, JSON.stringify({ pub: k.pub, priv: k.pem }), { mode: 0o600 });
    const r2 = node(s.root, ['scripts/release.mjs', '--no-build', '--key-file'], { HB_RELEASE_KEY: kf, HB_RELEASE_APPROVERS: 'a,b' });
    assert.equal(r2.status, 1); assert.match(r2.stderr, /outside the repository|does not match/);
    const kf2 = path.join(s.top, 'k.json'); writeFileSync(kf2, JSON.stringify({ pub: k.pub, priv: k.pem }), { mode: 0o644 });
    const r3 = node(s.root, ['scripts/release.mjs', '--no-build', '--key-file'], { HB_RELEASE_KEY: kf2, HB_RELEASE_APPROVERS: 'a,b' });
    assert.equal(r3.status, 1); assert.match(r3.stderr, /chmod 600/);
  } finally { s.cleanup(); }
});

/** Runs the leak-scan section of scripts/verify.mjs (from "// Leak scan" to the end) against a fake bundle and fake key files.
 *  The code under test is the script's own text; only its inputs (root, out) and side effects (exit, log) are provided. */
function leakScan({ bundle, keysEnv = null, backendEnv = null, extEnvLocal = null }) {
  const src = readFileSync(path.join(SCRIPTS, 'verify.mjs'), 'utf8');
  const i = src.indexOf('// Leak scan'); assert.ok(i > 0, 'verify.mjs still has its leak-scan section');
  const top = mkdtempSync(path.join(tmpdir(), 'hb-leak-'));
  const root = path.join(top, 'a', 'repo', 'apps', 'extension'); const out = path.join(top, 'dist');
  mkdirSync(root, { recursive: true }); mkdirSync(path.join(top, 'a', 'repo', 'apps', 'backend'), { recursive: true });
  for (const [rel, body] of Object.entries(bundle)) { mkdirSync(path.dirname(path.join(out, rel)), { recursive: true }); writeFileSync(path.join(out, rel), body); }
  if (keysEnv) writeFileSync(path.join(root, '..', '..', '..', 'harbour-keys.env'), keysEnv);
  if (backendEnv) writeFileSync(path.join(root, '..', 'backend', '.env'), backendEnv);
  if (extEnvLocal) writeFileSync(path.join(root, '.env.local'), extEnvLocal);
  const logs = []; let code = 0;
  const ctx = vm.createContext({ path, existsSync, readFileSync, readdirSync, statSync, root, out, console: { log: (x) => logs.push(String(x)) }, process: { exit: (c) => { code = c; throw new Error('__exit__'); } } });
  try { vm.runInContext(src.slice(i), ctx); } catch (e) { if (e.message !== '__exit__') throw e; }
  rmSync(top, { recursive: true, force: true });
  return { code, logs: logs.join('\n') };
}

test('T-EXT-033: the verify.mjs leak scan flags a bundle with an Alchemy key URL, a value from the key file, and passes a clean bundle', () => {
  const clean = leakScan({ bundle: { 'assets/a.js': 'fetch("https://api.harbour.example/v1/me")', 'index.html': '<html></html>' } });
  assert.equal(clean.code, 0, clean.logs); assert.match(clean.logs, /PASS {2}secret-leak scan/);

  const alchemy = leakScan({ bundle: { 'assets/a.js': 'const u="https://eth-mainnet.g.alchemy.com/v2/AbCdEfGhIjKlMnOpQrStUv12"', 'assets/b.js': 'ok' } });
  assert.equal(alchemy.code, 1); assert.match(alchemy.logs, /assets\/a\.js/); assert.doesNotMatch(alchemy.logs, /assets\/b\.js/);

  for (const shape of ['sk_live_abcdefghijklmnop1234', 'https://mainnet.infura.io/v3/0123456789abcdef0123456789abcdef', 'https://mainnet.helius-rpc.com/?api-key=x', 'headers:{"x-lifi-api-key":k}', 'https://api.pimlico.io/v2/1/rpc?apikey=abc']) {
    assert.equal(leakScan({ bundle: { 'x.js': shape } }).code, 1, shape);
  }
  // values read from the fake key files (any secret-looking VAR=value longer than 12 chars) are searched verbatim
  const fakeSecret = 'qa-fake-provider-secret-7f3e9a';
  const fromKeys = leakScan({ bundle: { 'assets/c.js': `const k="${fakeSecret}"` }, keysEnv: `PROVIDER_KEY=${fakeSecret}\n` });
  assert.equal(fromKeys.code, 1, fromKeys.logs); assert.match(fromKeys.logs, /1 key values checked/);
  const fromBackend = leakScan({ bundle: { 'm.js.map': `"${fakeSecret}"` }, backendEnv: `ALCHEMY_API_KEY=${fakeSecret}\nPUBLIC_API_URL=https://api.harbour.example\n` });
  assert.equal(fromBackend.code, 1, 'source maps are scanned too');
  // the backend's non-secret values (URLs) may legitimately appear in the bundle
  const url = leakScan({ bundle: { 'a.js': 'https://api.harbour.example/v1' }, backendEnv: 'HB_PUBLIC_BASE_URL=https://api.harbour.example\n' });
  assert.equal(url.code, 0, url.logs);
  const local = leakScan({ bundle: { 'a.js': `"${fakeSecret}"` }, extEnvLocal: `MY_TOKEN=${fakeSecret}\n` });
  assert.equal(local.code, 1, 'the extension .env.local is checked too');
});

test('T-X-009: a production build refuses a plain-http non-loopback API; an insecure endpoint switches mainnet signing off', async () => {
  const { apiUrlStatus, isLoopback, DEFAULT_API } = await import(path.join(SCRIPTS, 'api-url.mjs'));
  assert.equal(DEFAULT_API, 'http://localhost:8080');
  for (const u of ['http://api.harbour.example', 'http://10.0.0.5:8080', 'http://localhost.evil.example', 'ftp://api.harbour.example', 'not a url', 'http://127.0.0.1.nip.io'])
    assert.equal(apiUrlStatus(u).ok, false, u);
  for (const u of ['https://api.harbour.example', 'http://localhost:8080', 'http://127.0.0.1:8080/', 'http://[::1]:8080', undefined, '']) assert.equal(apiUrlStatus(u).ok, true, String(u));
  assert.equal(apiUrlStatus('http://localhost:8080').local, true); assert.equal(apiUrlStatus('https://api.harbour.example').local, false);
  assert.equal(isLoopback('http://[::1]:1'), true);
  assert.match(apiUrlStatus('http://api.harbour.example').error, /must be https/);
  // vite.config.ts throws on !ok (the build is refused)
  const vite = readFileSync(path.join(EXT, 'vite.config.ts'), 'utf8');
  assert.match(vite, /const api = apiUrlStatus\(loadEnv\(.*\)\.VITE_HB_API_URL\);\s*if \(!api\.ok\) throw new Error\(api\.error\)/);
  // runtime: the bundled policy with an http non-loopback API reports HB_API_SECURE=false and mainnetSigningReady()=false
  const { build } = await import('esbuild');
  const load = async (env) => {
    const out = await build({ stdin: { contents: "export { mainnetSigningReady } from './core/harbour/policy'; export { HB_API_SECURE } from './core/harbour/config';", resolveDir: path.join(EXT, 'src'), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', define: { 'import.meta.env': JSON.stringify(env) } });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
  };
  const insecure = await load({ VITE_HB_API_URL: 'http://api.harbour.example', PROD: true, MODE: 'production' });
  assert.equal(insecure.HB_API_SECURE, false); assert.equal(insecure.mainnetSigningReady(), false);
  const secure = await load({ VITE_HB_API_URL: 'https://api.harbour.example', PROD: true, MODE: 'production' });
  assert.equal(secure.HB_API_SECURE, true);
});
