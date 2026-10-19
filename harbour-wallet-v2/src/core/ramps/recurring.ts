// Recurring buy. TW's flow (RecurringBuySetup -> background RECURRING_BUY_CHECKOUT -> provider checkoutUrl) is Mercuryo-only and server
// side. Harbour has no such backend, so the public equivalent is: do the first purchase through the Mercuryo widget AND hand the user an
// iCalendar (.ics) reminder with a weekly/monthly RRULE so each later purchase is one tap. Recorded as a deviation (Partial).
export type Frequency = 'weekly' | 'monthly';
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateOnly = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
/** RFC 5545 line folding at 75 octets. */
function fold(line: string): string {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = '';
  for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch; }
  out.push(cur); return out.join('\r\n ');
}
export function nextOccurrence(freq: Frequency, start: Date): { chargeDay: string; rrule: string } {
  return freq === 'monthly'
    ? { chargeDay: String(start.getUTCDate()), rrule: `FREQ=MONTHLY;BYMONTHDAY=${Math.min(start.getUTCDate(), 28)}` }
    : { chargeDay: DAYS[start.getUTCDay()], rrule: `FREQ=WEEKLY;BYDAY=${DAYS[start.getUTCDay()]}` };
}
export function buildRecurringIcs(o: { uid: string; title: string; description: string; freq: Frequency; start: Date; now?: Date }): string {
  if (!/^[A-Za-z0-9._-]{4,64}$/.test(o.uid)) throw new Error('bad uid');
  if (Number.isNaN(o.start.getTime())) throw new Error('bad start date');
  const { rrule } = nextOccurrence(o.freq, o.start);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Harbour Wallet//Recurring buy reminder//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${o.uid}@harbour-wallet.local`, `DTSTAMP:${stamp(o.now ?? new Date())}`, `DTSTART;VALUE=DATE:${dateOnly(o.start)}`, `RRULE:${rrule}`,
    `SUMMARY:${esc(o.title)}`, `DESCRIPTION:${esc(o.description)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(o.title)}`, 'TRIGGER:PT0S', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
