// Date helpers working on ISO calendar dates ("YYYY-MM-DD") in the user's local time.
// Calendar dates are kept as strings end-to-end to avoid timezone drift.

export type ISODate = string;

// The user's time zone (profiles.timezone). Set once per render by <DateProvider> on the client;
// server code passes the zone explicitly via getDateContext(). Falls back to the runtime's local zone.
let appTimeZone: string | undefined;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setAppTimeZone(tz: string | null | undefined) {
  appTimeZone = isValidTimeZone(tz) ? tz : undefined;
}

export function getAppTimeZone() {
  return appTimeZone;
}

/** Calendar date of an instant in a time zone (default: the app time zone). */
export function dateInZone(d: Date, tz: string | undefined = appTimeZone): ISODate {
  if (!tz) return toISODate(d);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Hour of day (0-23) of an instant in a time zone (default: the app time zone). */
export function hourInZone(d: Date, tz: string | undefined = appTimeZone): number {
  if (!tz) return d.getHours();
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d));
}

function zoneOffsetMs(d: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - Math.floor(d.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DDTHH:mm" wall-clock time of an instant in a zone (for datetime-local inputs). */
export function toZonedWallTime(ts: string, tz: string | undefined = appTimeZone): string {
  const d = new Date(ts);
  if (!tz) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return new Date(d.getTime() + zoneOffsetMs(d, tz)).toISOString().slice(0, 16);
}

/** Instant (ISO string) for a "YYYY-MM-DDTHH:mm" wall-clock time in a zone. */
export function fromZonedWallTime(wall: string, tz: string | undefined = appTimeZone): string {
  if (!tz) return new Date(wall).toISOString();
  const guess = new Date(wall + ":00Z");
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, tz));
  // second pass corrects instants that sit on the other side of a DST change
  return new Date(guess.getTime() - zoneOffsetMs(first, tz)).toISOString();
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

export function formatDateTime(ts: string | null | undefined, tz?: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz ?? appTimeZone });
}

export function formatTime(ts: string, tz?: string) {
  return new Date(ts).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", timeZone: tz ?? appTimeZone });
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
