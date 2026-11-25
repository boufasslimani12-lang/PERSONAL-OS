// Date helpers working on ISO calendar dates ("YYYY-MM-DD") in the user's local time.
// Calendar dates are kept as strings end-to-end to avoid timezone drift.

export type ISODate = string;

// The user's time zone (profiles.timezone) and, optionally, its UTC-offset rules as computed by the SERVER.
// Browsers can ship older tz data than the server (e.g. a country changing its offset), which would make
// server-rendered and hydrated times disagree and convert form input differently. With a ZoneRules table set
// (by <DateProvider>), every conversion here uses the server's rules, so display and entry always agree.
// Server code passes the zone explicitly via getDateContext(); without a zone, the runtime's local zone is used.
let appTimeZone: string | undefined;
let appRules: ZoneRules | undefined;

/** UTC-offset transitions of one zone over a window: offset (minutes) applies from `at` (ms) until the next entry. */
export interface ZoneRules { tz: string; from: number; to: number; transitions: { at: number; offset: number }[] }

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setAppTimeZone(tz: string | null | undefined, rules?: ZoneRules) {
  appTimeZone = isValidTimeZone(tz) ? tz : undefined;
  appRules = rules && rules.tz === appTimeZone ? rules : undefined;
}

export function getAppTimeZone() {
  return appTimeZone;
}

/** Offset of `tz` from UTC at instant `ms`, in minutes, according to this runtime's tz data. */
function intlOffsetMinutes(ms: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Offset in minutes at `ms`: from the server's rules when they cover the instant, otherwise from Intl. */
function offsetMinutes(ms: number, tz: string): number {
  const r = appRules;
  if (r && r.tz === tz && ms >= r.from && ms < r.to && r.transitions.length) {
    let lo = 0;
    let hi = r.transitions.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (r.transitions[mid].at <= ms) lo = mid;
      else hi = mid - 1;
    }
    return r.transitions[lo].offset;
  }
  return intlOffsetMinutes(ms, tz);
}

/** Builds offset rules for `tz` between two instants from this runtime's tz data (used on the server). */
export function buildZoneRules(tz: string, from: number, to: number): ZoneRules {
  const step = 86_400_000; // offset changes are weeks apart; the exact minute is then binary-searched
  const transitions = [{ at: from, offset: intlOffsetMinutes(from, tz) }];
  for (let t = from + step; t < to; t += step) {
    const off = intlOffsetMinutes(t, tz);
    if (off === transitions[transitions.length - 1].offset) continue;
    // binary-search the exact minute of the change inside (t - step, t]
    let lo = t - step;
    let hi = t;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
      if (intlOffsetMinutes(mid, tz) === off) hi = mid;
      else lo = mid;
    }
    transitions.push({ at: hi, offset: off });
  }
  return { tz, from, to, transitions };
}

/** Wall-clock fields of an instant in a zone (UTC getters on the shifted instant). */
function shifted(d: Date, tz: string | undefined): Date {
  if (!tz) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
  return new Date(d.getTime() + offsetMinutes(d.getTime(), tz) * 60_000);
}

/** Calendar date of an instant in a time zone (default: the app time zone). */
export function dateInZone(d: Date, tz: string | undefined = appTimeZone): ISODate {
  return shifted(d, tz).toISOString().slice(0, 10);
}

/** Hour of day (0-23) of an instant in a time zone (default: the app time zone). */
export function hourInZone(d: Date, tz: string | undefined = appTimeZone): number {
  return shifted(d, tz).getUTCHours();
}

/** "YYYY-MM-DDTHH:mm" wall-clock time of an instant in a zone (for datetime-local inputs). */
export function toZonedWallTime(ts: string, tz: string | undefined = appTimeZone): string {
  return shifted(new Date(ts), tz).toISOString().slice(0, 16);
}

/** Instant (ISO string) for a "YYYY-MM-DDTHH:mm" wall-clock time in a zone. */
export function fromZonedWallTime(wall: string, tz: string | undefined = appTimeZone): string {
  if (!tz) return new Date(wall).toISOString();
  const guess = Date.parse(wall + ":00Z");
  const first = guess - offsetMinutes(guess, tz) * 60_000;
  // second pass corrects instants that sit on the other side of an offset change
  return new Date(guess - offsetMinutes(first, tz) * 60_000).toISOString();
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(tz?: string): ISODate {
  return dateInZone(new Date(), tz ?? appTimeZone);
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonthsISO(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(s: ISODate): number {
  return parseISODate(s).getDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function startOfWeekISO(s: ISODate, weekStartsOn = 1): ISODate {
  const diff = (dayOfWeek(s) - weekStartsOn + 7) % 7;
  return addDaysISO(s, -diff);
}

export function startOfMonthISO(s: ISODate): ISODate {
  return s.slice(0, 7) + "-01";
}

export function endOfMonthISO(s: ISODate): ISODate {
  const d = parseISODate(startOfMonthISO(s));
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function eachDayISO(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

export function isoFromTimestamp(ts: string, tz?: string): ISODate {
  return dateInZone(new Date(ts), tz ?? appTimeZone);
}

export function formatDate(s: ISODate | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!s) return "";
  return parseISODate(s).toLocaleDateString("en", opts);
}

// Times are built from numeric parts ("HH:mm", 24-hour) instead of locale strings: locale time formats differ
// between ICU versions (Node vs browser), which would make server-rendered and hydrated text disagree.
function timeParts(d: Date, tz: string | undefined): { h: number; m: number } {
  const w = shifted(d, tz);
  return { h: w.getUTCHours(), m: w.getUTCMinutes() };
}

export function formatTime(ts: string, tz?: string) {
  const { h, m } = timeParts(new Date(ts), tz ?? appTimeZone);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDateTime(ts: string | null | undefined, tz?: string) {
  if (!ts) return "";
  const zone = tz ?? appTimeZone;
  return `${formatDate(dateInZone(new Date(ts), zone))}, ${formatTime(ts, zone)}`;
}

/** Human label relative to today: "Today", "Tomorrow", "3 days overdue", "in 5 days". */
export function relativeDayLabel(s: ISODate, today: ISODate = todayISO()): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return `in ${diff} days`;
  return formatDate(s);
}

export function formatMinutes(min: number) {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
