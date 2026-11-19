// Date helpers working on ISO calendar dates ("YYYY-MM-DD") in the user's local time.
// Calendar dates are kept as strings end-to-end to avoid timezone drift.

export type ISODate = string;

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
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

export function isoFromTimestamp(ts: string): ISODate {
  return toISODate(new Date(ts));
}

export function formatDate(s: ISODate | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!s) return "";
  return parseISODate(s).toLocaleDateString("en", opts);
}

export function formatDateTime(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
