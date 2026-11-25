// QA (supply chain): install scripts are disabled, verify.mjs runs the audit gate and the lockfile check, and the audit gate itself
// behaves as documented — run against a fake `npm` on PATH that prints a canned `npm audit --json` report (no network).
// TEST_PLAN: T-REG-029, T-X-010 (npm part).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('T-REG-029: .npmrc disables dependency install scripts and pins exact versions; verify.mjs runs the audit gate and lockfile check', (t) => {
  const rc = Object.fromEntries(readFileSync(path.join(EXT, '.npmrc'), 'utf8').split('\n').filter((l) => /^[a-z-]+=/.test(l)).map((l) => l.split('=')));
  assert.equal(rc['ignore-scripts'], 'true'); assert.equal(rc['save-exact'], 'true'); assert.equal(rc['audit-level'], 'high');
  const verify = readFileSync(path.join(EXT, 'scripts/verify.mjs'), 'utf8');
  assert.match(verify, /run\('npm audit gate[^']*', 'node', \['scripts\/audit-gate\.mjs'\]\)/);
  assert.match(verify, /run\('lockfile matches package\.json', 'npm', \['ls', '--omit=dev', '--all', '--silent'\]\)/);
  const pkg = JSON.parse(readFileSync(path.join(EXT, 'package.json'), 'utf8'));
  for (const [name, v] of Object.entries(pkg.dependencies ?? {})) assert.match(String(v), /^(\d|npm:|file:|link:)/, `production dependency ${name} is pinned exactly (${v})`);
  const ranged = Object.entries(pkg.devDependencies ?? {}).filter(([, v]) => !/^(\d|npm:|file:|link:)/.test(v)).map(([k, v]) => `${k}@${v}`);
  if (ranged.length) t.diagnostic(`dev-only dependencies with ranges (the lockfile pins them): ${ranged.join(', ')}`);
});

function gate(report, exceptions) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hb-audit-'));
  mkdirSync(path.join(dir, 'scripts')); mkdirSync(path.join(dir, 'bin'));
  copyFileSync(path.join(EXT, 'scripts/audit-gate.mjs'), path.join(dir, 'scripts/audit-gate.mjs'));
  writeFileSync(path.join(dir, 'audit-exceptions.json'), JSON.stringify(exceptions));
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  const npm = path.join(dir, 'bin/npm'); writeFileSync(npm, `#!/bin/sh\ncat "${path.join(dir, 'report.json')}"\nexit 1\n`); chmodSync(npm, 0o755);
  const r = spawnSync(process.execPath, ['scripts/audit-gate.mjs'], { cwd: dir, encoding: 'utf8', env: { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` } });
  return { code: r.status, out: r.stdout + r.stderr };
}
const adv = (id, severity, name = 'pkg') => ({ vulnerabilities: { [name]: { via: [{ url: `https://github.com/advisories/${id}`, severity, name, title: `${id} title` }, 'transitive-name'] } } });
const future = '2999-01-01', past = '2001-01-01';

test('T-X-010: audit gate — clean passes; unlisted high/critical fails; current exception passes; expired exception fails; low/moderate ignored', () => {
  assert.equal(gate({ vulnerabilities: {} }, []).code, 0);
  for (const sev of ['high', 'critical']) { const r = gate(adv('GHSA-aaaa', sev), []); assert.equal(r.code, 1, sev); assert.match(r.out, /no exception on file/); }
  assert.equal(gate(adv('GHSA-aaaa', 'high'), [{ id: 'GHSA-aaaa', reviewBy: future, reason: 'x' }]).code, 0);
  const ex = gate(adv('GHSA-aaaa', 'high'), [{ id: 'GHSA-aaaa', reviewBy: past, reason: 'x' }]); assert.equal(ex.code, 1); assert.match(ex.out, /expired/);
  for (const sev of ['low', 'moderate']) assert.equal(gate(adv('GHSA-bbbb', sev), []).code, 0, sev);
  const stale = gate({ vulnerabilities: {} }, [{ id: 'GHSA-gone', reviewBy: future, reason: 'x' }]); assert.equal(stale.code, 0); assert.match(stale.out, /can be removed/);
});

test('T-X-010: the checked-in audit exceptions are well-formed, justified and not expired', () => {
  const list = JSON.parse(readFileSync(path.join(EXT, 'audit-exceptions.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  for (const e of list) {
    assert.match(e.id, /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/); assert.match(e.reviewBy, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.reviewBy >= today, `${e.id} expired on ${e.reviewBy}`);
    assert.ok(e.reason && e.reason.length > 80, `${e.id} needs a real justification`);
    assert.ok(new Date(e.reviewBy) - new Date(today) < 400 * 864e5, `${e.id}: review date more than ~13 months out`);
  }
});
