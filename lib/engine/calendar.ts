// Expands recurring events into concrete occurrences inside [from, to] (ISO dates, inclusive).
// Occurrences are virtual — nothing is duplicated in the database.
import { addDaysISO, addMonthsISO, dateInZone, daysBetween } from "../dates.ts";

export interface EventLike {
  id: string;
  start_at: string;
  end_at: string | null;
  recurrence: string | null;
  recurrence_until: string | null;
}
export type Occurrence<T> = T & { occurrence_date: string; occurrence_start: string; occurrence_end: string | null };

export function expandEvents<T extends EventLike>(events: T[], from: string, to: string, tz?: string): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  for (const e of events) {
    const start = new Date(e.start_at);
    const durationMs = e.end_at ? new Date(e.end_at).getTime() - start.getTime() : null;
    const firstDate = dateInZone(start, tz);
    const until = e.recurrence_until && e.recurrence_until < to ? e.recurrence_until : to;
    const push = (date: string) => {
      const s = new Date(start.getTime() + daysBetween(firstDate, date) * 86_400_000);
      out.push({ ...e, occurrence_date: date, occurrence_start: s.toISOString(), occurrence_end: durationMs !== null ? new Date(s.getTime() + durationMs).toISOString() : null });
    };
    if (!e.recurrence) {
      if (firstDate >= from && firstDate <= to) push(firstDate);
      continue;
    }
    let date = firstDate;
    for (let i = 0; i < 2000 && date <= until; i++) {
      if (date >= from) push(date);
      date =
        e.recurrence === "daily" ? addDaysISO(firstDate, i + 1)
        : e.recurrence === "weekly" ? addDaysISO(firstDate, 7 * (i + 1))
        : e.recurrence === "monthly" ? addMonthsISO(firstDate, i + 1)
        : addMonthsISO(firstDate, 12 * (i + 1));
    }
  }
  return out.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start));
}
