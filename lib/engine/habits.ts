// Habit engine. Rules (docs/ANALYTICS.md):
//  * A log is "completed" when value >= the target snapshot stored on the log (DB generated column),
//    so editing a habit's target never rewrites history.
//  * daily  → scheduled every day; custom → scheduled on days_of_week; weekly → N completions per week.
//  * A period still in progress (today / the current week) only counts once it has been completed;
//    it never counts against you before it is over.
import { addDaysISO, dayOfWeek, startOfWeekISO, type ISODate } from "../dates.ts";

export interface HabitLike {
  id: string;
  frequency: string; // daily | weekly | custom
  times_per_week: number;
  days_of_week: number[];
  start_date: string;
  archived_at?: string | null;
}
export interface HabitLogLike { habit_id: string; log_date: string; completed: boolean | null; value?: number }

export function isScheduledOn(h: HabitLike, d: ISODate): boolean {
  if (d < h.start_date) return false;
  if (h.frequency === "custom") return h.days_of_week.includes(dayOfWeek(d));
  return true; // daily; weekly habits can be done any day
}

function completedSet(logs: HabitLogLike[]): Set<string> {
  return new Set(logs.filter((l) => l.completed).map((l) => l.log_date));
}

export function currentStreak(h: HabitLike, logs: HabitLogLike[], today: ISODate, weekStartsOn = 1): number {
  const done = completedSet(logs);
  if (h.frequency === "weekly") {
    let streak = 0;
    let week = startOfWeekISO(today, weekStartsOn);
    // current week: counts if already met, otherwise doesn't break the streak
    if (countInWeek(done, week) >= h.times_per_week) streak++;
    week = addDaysISO(week, -7);
    while (week >= startOfWeekISO(h.start_date, weekStartsOn)) {
      if (countInWeek(done, week) >= h.times_per_week) streak++;
      else break;
      week = addDaysISO(week, -7);
    }
    return streak;
  }
  let streak = 0;
  let d = today;
  if (!done.has(d)) d = addDaysISO(d, -1); // today still in progress
  for (let guard = 0; guard < 3660 && d >= h.start_date; guard++, d = addDaysISO(d, -1)) {
    if (!isScheduledOn(h, d)) continue;
    if (done.has(d)) streak++;
    else break;
  }
  return streak;
}

export function longestStreak(h: HabitLike, logs: HabitLogLike[], today: ISODate, weekStartsOn = 1): number {
  const done = completedSet(logs);
  let best = 0;
  let run = 0;
  if (h.frequency === "weekly") {
    for (let w = startOfWeekISO(h.start_date, weekStartsOn); w <= today; w = addDaysISO(w, 7)) {
      if (countInWeek(done, w) >= h.times_per_week) best = Math.max(best, ++run);
      else if (w !== startOfWeekISO(today, weekStartsOn)) run = 0;
    }
    return best;
  }
  for (let d = h.start_date; d <= today; d = addDaysISO(d, 1)) {
    if (!isScheduledOn(h, d)) continue;
    if (done.has(d)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return best;
}

function countInWeek(done: Set<string>, weekStart: ISODate) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (done.has(addDaysISO(weekStart, i))) n++;
  return n;
}

export interface Consistency { done: number; expected: number; rate: number | null }

/** Share of scheduled occurrences completed in [from, to] (to is capped at today). */
export function consistency(h: HabitLike, logs: HabitLogLike[], from: ISODate, to: ISODate, today: ISODate, weekStartsOn = 1): Consistency {
  const done = completedSet(logs);
  const end = to > today ? today : to;
  const start = from < h.start_date ? h.start_date : from;
  let expected = 0;
  let got = 0;
  if (start > end) return { done: 0, expected: 0, rate: null };

  if (h.frequency === "weekly") {
    const currentWeek = startOfWeekISO(today, weekStartsOn);
    for (let w = startOfWeekISO(start, weekStartsOn); w <= end; w = addDaysISO(w, 7)) {
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDaysISO(w, i);
        if (d >= start && d <= end && done.has(d)) n++;
      }
      const capped = Math.min(n, h.times_per_week);
      if (w === currentWeek && capped < h.times_per_week) continue; // in progress
      expected += h.times_per_week;
      got += capped;
    }
  } else {
    for (let d = start; d <= end; d = addDaysISO(d, 1)) {
      if (!isScheduledOn(h, d)) continue;
      if (d === today && !done.has(d)) continue; // in progress
      expected++;
      if (done.has(d)) got++;
    }
  }
  return { done: got, expected, rate: expected ? (got / expected) * 100 : null };
}

/** Aggregate consistency across many habits = total done / total expected (not an average of rates). */
export function aggregateConsistency(habits: HabitLike[], logs: HabitLogLike[], from: ISODate, to: ISODate, today: ISODate, weekStartsOn = 1): Consistency {
  let done = 0;
  let expected = 0;
  for (const h of habits) {
    if (h.archived_at) continue;
    const c = consistency(h, logs.filter((l) => l.habit_id === h.id), from, to, today, weekStartsOn);
    done += c.done;
    expected += c.expected;
  }
  return { done, expected, rate: expected ? (done / expected) * 100 : null };
}

export function isDueToday(h: HabitLike, today: ISODate, logs: HabitLogLike[], weekStartsOn = 1): boolean {
  if (h.archived_at || today < h.start_date) return false;
  if (h.frequency === "weekly") {
    const done = completedSet(logs.filter((l) => l.habit_id === h.id));
    const week = startOfWeekISO(today, weekStartsOn);
    return countInWeek(done, week) < h.times_per_week || done.has(today);
  }
  return isScheduledOn(h, today);
}
