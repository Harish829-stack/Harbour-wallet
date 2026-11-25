// QA (property): recurring-buy day/month keys come from the UTC calendar for random instants around UTC day and month boundaries,
// whatever the machine's zone. The Go side (daily counter at UTC midnight) is TestQADailyCounterUTCMidnight. TEST_PLAN: T-X-013.
process.env.TZ = 'Pacific/Kiritimati'; // UTC+14: local date differs from the UTC date for most of the day
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const o = await build({ stdin: { contents: "export * from './src/core/ramps/recurring.ts'", resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const R = await import('data:text/javascript;base64,' + Buffer.from(o.outputFiles[0].text).toString('base64'));
const RUNS = Number(process.env.HB_FUZZ_RUNS ?? 300);
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// instants within +-36 h of a UTC midnight / month start in 2020..2032
const nearBoundary = fc.record({ y: fc.integer({ min: 2020, max: 2032 }), m: fc.integer({ min: 0, max: 11 }), d: fc.constantFrom(1, 1, 1, 15, 28, 29, 30, 31), off: fc.integer({ min: -36 * 3600, max: 36 * 3600 }) })
  .map(({ y, m, d, off }) => new Date(Date.UTC(y, m, d) + off * 1000)).filter((x) => !Number.isNaN(x.getTime()));
const iso = (d) => d.toISOString(); // independent oracle: ISO strings are UTC

test('T-X-013: the machine zone really differs from UTC for this test', () => { assert.equal(new Date(Date.UTC(2026, 0, 1, 12)).getHours(), 2); });
test('T-X-013: weekday / month-day / DTSTART come from UTC for random boundary instants', () => {
  fc.assert(fc.property(nearBoundary, (d) => {
    const s = iso(d); const [Y, M, D] = [s.slice(0, 4), s.slice(5, 7), s.slice(8, 10)];
    const w = R.nextOccurrence('weekly', d), m = R.nextOccurrence('monthly', d);
    assert.equal(w.chargeDay, DAYS[new Date(`${Y}-${M}-${D}T00:00:00Z`).getUTCDay()]); assert.equal(w.rrule, `FREQ=WEEKLY;BYDAY=${w.chargeDay}`);
    assert.equal(m.chargeDay, String(Number(D))); assert.equal(m.rrule, `FREQ=MONTHLY;BYMONTHDAY=${Math.min(Number(D), 28)}`);
    const ics = R.buildRecurringIcs({ uid: 'qa-uid-1', title: 't', description: 'd', freq: 'monthly', start: d, now: d });
    assert.ok(ics.includes(`DTSTART;VALUE=DATE:${Y}${M}${D}\r\n`), ics.split('\r\n').find((l) => l.startsWith('DTSTART')));
    assert.ok(ics.includes(`DTSTAMP:${Y}${M}${D}T${s.slice(11, 13)}${s.slice(14, 16)}${s.slice(17, 19)}Z`));
  }), { numRuns: RUNS });
});
test('T-X-013: explicit boundaries — 23:59:59.999Z vs 00:00:00.000Z, month end, leap day', () => {
  const k = (iso) => R.nextOccurrence('monthly', new Date(iso)).chargeDay;
  assert.equal(k('2026-01-31T23:59:59.999Z'), '31'); assert.equal(k('2026-02-01T00:00:00.000Z'), '1');
  assert.equal(k('2028-02-29T23:59:59.999Z'), '29'); assert.equal(k('2028-03-01T00:00:00.000Z'), '1');
  assert.equal(R.nextOccurrence('monthly', new Date('2026-01-31T00:00:00Z')).rrule, 'FREQ=MONTHLY;BYMONTHDAY=28', 'days 29-31 clamp to 28 so every month has the day');
  assert.equal(R.nextOccurrence('weekly', new Date('2026-11-20T23:59:59.999Z')).chargeDay, 'FR'); assert.equal(R.nextOccurrence('weekly', new Date('2026-11-21T00:00:00Z')).chargeDay, 'SA');
});
