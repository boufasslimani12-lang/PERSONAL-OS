// Task engine. Every completion (one-off or recurring occurrence) writes a task_completions row whose
// occurrence_date is the due date it satisfied (or the completion day for undated tasks).
// Completion rate for a window = completions in window / (completions in window + open tasks due in window up to today).
import { addDaysISO, addMonthsISO, dayOfWeek, type ISODate } from "../dates.ts";

export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly";

export function nextOccurrence(from: ISODate, recurrence: Recurrence, interval = 1): ISODate {
  const n = Math.max(1, interval);
  switch (recurrence) {
    case "daily":
      return addDaysISO(from, n);
    case "weekly":
      return addDaysISO(from, 7 * n);
    case "monthly":
      return addMonthsISO(from, n);
    case "weekdays": {
      let d = addDaysISO(from, 1);
      while (dayOfWeek(d) === 0 || dayOfWeek(d) === 6) d = addDaysISO(d, 1);
      return d;
    }
  }
}

export interface TaskLike2 { status: string; due_date: string | null; parent_task_id?: string | null }
export interface CompletionLike { occurrence_date: string | null; completed_at: string }

export function isOverdue(t: TaskLike2, today: ISODate) {
  return t.status !== "done" && t.status !== "cancelled" && !!t.due_date && t.due_date < today;
}

export interface Rate { done: number; total: number; rate: number | null }

export function taskCompletionRate(tasks: TaskLike2[], completions: CompletionLike[], from: ISODate, to: ISODate, today: ISODate): Rate {
  const end = to > today ? today : to;
  const done = completions.filter((c) => {
    const d = c.occurrence_date ?? c.completed_at.slice(0, 10);
    return d >= from && d <= end;
  }).length;
  const open = tasks.filter(
    (t) => !t.parent_task_id && t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date >= from && t.due_date <= end && t.due_date < today,
  ).length;
  const total = done + open;
  return { done, total, rate: total ? (done / total) * 100 : null };
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function compareTasks(a: { priority: string; due_date: string | null; due_time?: string | null; sort_order?: number }, b: typeof a) {
  const ad = a.due_date ?? "9999-99-99";
  const bd = b.due_date ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (p) return p;
  return (a.due_time ?? "99") < (b.due_time ?? "99") ? -1 : 1;
}
