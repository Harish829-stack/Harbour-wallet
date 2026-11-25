// Full local stack for E2E tests: the REAL Harbour Go API (built from apps/backend) on 127.0.0.1:8080, backed by a dedicated Postgres
// database and Redis DB, with its rpc-gateway pointed at the deterministic mock chain (mock-chain.mjs). Nothing leaves the machine.
//
// Requirements (explicit, never silently skipped by the tests that need them):
//   HB_E2E_POSTGRES_ADMIN_URL  e.g. postgres://harbour@127.0.0.1:5432/postgres?sslmode=disable  (a role that may CREATE DATABASE)
//   HB_E2E_REDIS_URL           e.g. redis://127.0.0.1:6379/13
//   HB_E2E_API_BIN             path to a built `apps/backend/cmd/api` binary  (or `go` on PATH: it is built into node_modules/.cache)
// `stackRequirements()` returns the missing ones; tests report them as a SKIP *with that list* and `npm run test:e2e` fails if any is missing.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import net from 'node:net';
import { startMockChain } from './mock-chain.mjs';

const EXT = fileURLToPath(new URL('../../', import.meta.url));
const BACKEND = join(EXT, '../backend');
export const API_PORT = 8080; // the extension's default HB_API_URL (http://localhost:8080) — no build-time override needed

export function stackRequirements() {
  const missing = [];
  if (!process.env.HB_E2E_POSTGRES_ADMIN_URL) missing.push('HB_E2E_POSTGRES_ADMIN_URL');
  if (!process.env.HB_E2E_REDIS_URL) missing.push('HB_E2E_REDIS_URL');
  if (!process.env.HB_E2E_API_BIN && spawnSync('go', ['version']).status !== 0) missing.push('HB_E2E_API_BIN (or go on PATH)');
  return missing;
}

function apiBinary() {
  if (process.env.HB_E2E_API_BIN) return process.env.HB_E2E_API_BIN;
  const out = join(EXT, 'node_modules/.cache/harbour-qa/hb-api'); mkdirSync(join(EXT, 'node_modules/.cache/harbour-qa'), { recursive: true });
  const r = spawnSync('go', ['build', '-o', out, './cmd/api'], { cwd: BACKEND, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`go build ./cmd/api failed:\n${r.stderr}`);
  return out;
}

async function psql(adminUrl, sql) {
  // Uses the API binary's own driver indirectly would be nicer; psql is the portable admin tool here.
  const r = spawnSync('psql', [adminUrl, '-v', 'ON_ERROR_STOP=1', '-qc', sql], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
}

/** Per-IP rate limits and daily counters live in Redis and survive between runs (every test client is 127.0.0.1): start from an empty DB. */
async function flushRedis(url) {
  const u = new URL(url); const db = u.pathname.replace('/', '') || '0';
  if (!/^\d+$/.test(db)) throw new Error('HB_E2E_REDIS_URL must name a numeric DB');
  await new Promise((resolve, reject) => {
    const sock = net.connect(Number(u.port || 6379), u.hostname); let buf = '';
    const cmd = (...a) => `*${a.length}\r\n${a.map((x) => `$${Buffer.byteLength(x)}\r\n${x}\r\n`).join('')}`;
    sock.on('connect', () => sock.write(cmd('SELECT', db) + cmd('FLUSHDB')));
    sock.on('data', (d) => { buf += d; if ((buf.match(/\+OK\r\n/g) ?? []).length >= 2) { sock.end(); resolve(); } else if (buf.includes('-')) { sock.destroy(); reject(new Error(`redis: ${buf}`)); } });
    sock.on('error', reject); setTimeout(() => reject(new Error('redis flush timed out')), 5000);
  });
}

/** `established: true` disables the 24 h probation tier (a test fixture standing for a device registered days ago). */
export async function startStack({ funded = {}, powDifficulty = 6, chains = { sepolia: 11155111, 'base-sepolia': 84532, ethereum: 1, base: 8453 }, established = false } = {}) {
  const missing = stackRequirements(); if (missing.length) throw new Error(`E2E stack not configured: ${missing.join(', ')}`);
  await flushRedis(process.env.HB_E2E_REDIS_URL);
  const chain = await startMockChain({ chains, funded });
  const db = `harbour_e2e_${process.pid}_${Date.now() % 1e6}`;
  const admin = process.env.HB_E2E_POSTGRES_ADMIN_URL;
  await psql(admin, `CREATE DATABASE ${db}`);
  const dbUrl = admin.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);
  const env = { ...process.env, POSTGRES_URL: dbUrl, REDIS_URL: process.env.HB_E2E_REDIS_URL, ADDRESS_LINK_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    RPC_GATEWAY_URL: chain.url, GATEWAY_INTERNAL_TOKEN: '', POW_DIFFICULTY: String(powDifficulty), API_ADDR: `127.0.0.1:${API_PORT}`, NATS_URL: '' };
  const logs = [];
  let cfgDir = join(BACKEND, 'config'); let tmpCfg = null;
  if (established) {
    tmpCfg = join(tmpdir(), `hb-e2e-config-${process.pid}-${Date.now()}`); cpSync(cfgDir, tmpCfg, { recursive: true });
    const f = join(tmpCfg, 'api.yaml'); writeFileSync(f, readFileSync(f, 'utf8').replace(/^(\s*)probation_tier: probation/m, '$1probation_tier: ""')); cfgDir = tmpCfg;
  }
  const proc = spawn(apiBinary(), ['-migrate', '-config', cfgDir, '-env', '/dev/null'], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (d) => logs.push(String(d))); proc.stderr.on('data', (d) => logs.push(String(d)));
  const base = `http://127.0.0.1:${API_PORT}`;
  for (let i = 0; ; i++) {
    try { const r = await fetch(`${base}/healthz`); if (r.status < 500) break; } catch { /* starting */ }
    if (proc.exitCode !== null || i > 300) { await chain.close(); throw new Error(`API did not start:\n${logs.join('').slice(-3000)}`); }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    base, chain, logs, db,
    async stop() {
      proc.kill('SIGTERM'); await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
      await chain.close();
      try { await psql(admin, `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); } catch { /* best effort */ }
      if (tmpCfg) rmSync(tmpCfg, { recursive: true, force: true });
    },
  };
}
export const backendDir = BACKEND;
export const extensionDir = EXT;
void existsSync;
