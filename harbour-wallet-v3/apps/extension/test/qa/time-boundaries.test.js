// QA (T-X-003, extension part): time-based rules depend on elapsed milliseconds / UTC only, never on the local wall clock. The
// process runs in America/New_York and the clock is moved across the 2026-03-08 DST jump (02:00 → 03:00 local) and a month end.
// (Backend part: TestQADailyCounterUTCMidnight in apps/backend/internal/api/qa_integration3_test.go.)
process.env.TZ = 'America/New_York';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { fakeClock } from './known-bug.mjs';

const H = await harness(`
  export { grantReauth, hasReauth, consumeReauth } from './background/reauth';
  export { armLockTimer, LOCK_ALARM } from './background/settingsService';
`);
const { M, F } = H;

test('T-X-003: a 2-minute re-auth grant lasts exactly 2 minutes across the DST jump (wall clock jumps 1 h)', async () => {
  H.reset();
  assert.equal(new Date(Date.UTC(2026, 2, 8, 6, 59)).getHours(), 1, 'process really runs in New York time');
  const clock = fakeClock(Date.UTC(2026, 2, 8, 6, 59, 0)); // 01:59 EST
  try {
    await M.grantReauth('reveal', { method: 'password' });
    clock.advance(60_000); // 03:00 EDT — one real minute later, the wall clock moved by an hour and a minute
    assert.equal(new Date(clock.now).getHours(), 3);
    assert.equal(await M.hasReauth('reveal', {}), true, 'still valid one real minute later');
    clock.advance(60_001);
    assert.equal(await M.hasReauth('reveal', {}), false, 'expired after two real minutes');
    // month end + fall-back DST (01:00–02:00 repeats on 2026-11-01)
    clock.set(Date.UTC(2026, 10, 1, 5, 59, 0)); // 01:59 EDT
    await M.grantReauth('addWallet', { method: 'password' });
    clock.advance(9 * 60_000); // 01:08 EST (wall clock went backwards)
    assert.equal(await M.hasReauth('addWallet', {}), true);
    clock.advance(60_001);
    assert.equal(await M.hasReauth('addWallet', {}), false, '10-minute grant ends after 10 real minutes');
  } finally { clock.restore(); }
});

test('T-X-003: the auto-lock alarm is a relative delay in minutes (no wall-clock "when")', async () => {
  H.reset();
  await M.armLockTimer(15);
  const a = F.alarms.find((x) => (x.name ?? x[0]) === M.LOCK_ALARM) ?? F.alarms.at(-1);
  const info = a.info ?? a[1] ?? a;
  assert.equal(info.delayInMinutes, 15, JSON.stringify(a));
  assert.equal(info.when, undefined, 'no absolute time that a timezone or DST change could shift');
});
