// Expected-fail convention for QA tests (mirrors the Go helper expectKnownBug). A test that demonstrates a bug listed in
// qa/BUGS_FOUND.md calls knownBug(t, 'BUG-NN', reproduced, evidence):
//   - bug still reproduces  -> the test is reported as SKIPPED with "KNOWN BUG BUG-NN: <evidence>" (suite stays green, bug visible);
//   - bug no longer reproduces -> the test FAILS, so the marker is removed together with the fix;
//   - HB_QA_STRICT=1        -> a reproducing bug FAILS (use in the audit pipeline to list every open bug as a failure).
import assert from 'node:assert/strict';

export function knownBug(t, id, reproduced, evidence) {
  if (!reproduced) assert.fail(`${id} no longer reproduces: remove the knownBug marker and close the entry in qa/BUGS_FOUND.md`);
  if (process.env.HB_QA_STRICT === '1') assert.fail(`KNOWN BUG ${id}: ${evidence}`);
  t.skip(`KNOWN BUG ${id}: ${evidence}`);
  return true;
}

/** Freeze Date.now at `start` and let the test move it; returns { now, advance(ms), restore() }. setTimeout is untouched. */
export function fakeClock(start = Date.now()) {
  const real = Date.now; let t = start;
  Date.now = () => t;
  return { get now() { return t; }, advance(ms) { t += ms; }, set(v) { t = v; }, restore() { Date.now = real; } };
}
