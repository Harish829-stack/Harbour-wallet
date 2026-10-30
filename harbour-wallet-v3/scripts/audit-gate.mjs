// CI gate for `npm audit` (audit V3-22). Fails on any high/critical advisory in production dependencies unless it is listed in
// audit-exceptions.json with a reason and a review date. An exception whose review date has passed fails the build again, so an
// accepted risk cannot be forgotten.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const exceptions = JSON.parse(readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'));
let raw;
try { raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
catch (e) { raw = e.stdout; } // npm audit exits non-zero when it finds anything
const report = JSON.parse(raw);
const found = new Map();
for (const v of Object.values(report.vulnerabilities ?? {})) {
  for (const via of v.via ?? []) {
    if (typeof via === 'object' && via.url && ['high', 'critical'].includes(via.severity)) found.set(via.url.split('/').pop(), { title: via.title, package: via.name, severity: via.severity });
  }
}
const today = new Date().toISOString().slice(0, 10);
const problems = [];
for (const [id, a] of found) {
  const ex = exceptions.find((e) => e.id === id);
  if (!ex) problems.push(`${id} (${a.severity}, ${a.package}): ${a.title} - no exception on file`);
  else if (ex.reviewBy < today) problems.push(`${id}: exception expired on ${ex.reviewBy} - re-check upstream and renew or remove it`);
  else console.log(`accepted until ${ex.reviewBy}: ${id} (${a.package}) - ${ex.reason}`);
}
for (const ex of exceptions) if (!found.has(ex.id)) console.log(`note: exception ${ex.id} no longer matches an advisory and can be removed`);
if (problems.length) { console.error('npm audit gate failed:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`npm audit gate passed (${found.size} high/critical advisories, all with a current exception)`);
