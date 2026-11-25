// QA (perf smoke): the registration proof-of-work at the server's default difficulty (20 bits) is solved by the extension's solvePow in < 10 s.
// TEST_PLAN: T-BE-089 (JS half; the Go half is internal/devicesig/qa_pow_test.go). Several challenges, so one unlucky counter cannot fail it alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { harness } from './harness.mjs';

const H = await harness(`export { solvePow } from './core/harbour/device';`);
const { M } = H;

test('T-BE-089: solvePow at difficulty 20 finishes in < 10 s (median of 3 challenges) and the answer verifies', async () => {
  const times = [];
  for (const ch of ['qa-pow-perf-1', 'qa-pow-perf-2', 'qa-pow-perf-3']) {
    const t0 = performance.now();
    const counter = await M.solvePow(ch, 'QA_PUB_KEY_B64', 20);
    times.push(performance.now() - t0);
    const h = crypto.createHash('sha256').update(`${ch}:QA_PUB_KEY_B64:${counter}`).digest();
    assert.equal(h[0], 0); assert.equal(h[1], 0); assert.ok(h[2] < 16, 'at least 20 leading zero bits');
  }
  times.sort((a, b) => a - b);
  assert.ok(times[1] < 10000, `median ${Math.round(times[1])} ms (all: ${times.map(Math.round)})`);
});
