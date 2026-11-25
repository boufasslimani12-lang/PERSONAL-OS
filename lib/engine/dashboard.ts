// Dashboard rules (docs/ANALYTICS.md). Pure functions; dates are ISO calendar days in the profile time zone.
import { compareTasks } from "./tasks.ts";

export interface DashTask {
  id: string; status: string; priority: string; due_date: string | null; due_time?: string | null;
  parent_task_id?: string | null; completed_at?: string | null; recurrence?: string | null;
}
export interface DashCompletion { task_id: string; occurrence_date: string | null; completed_at: string }

const isOpen = (t: DashTask) => t.status !== "done" && t.status !== "cancelled";

/**
 * Today's task progress.
 *  done  = completions whose occurrence (due) date is today, plus undated tasks completed today
 *  total = done + open top-level tasks due today
 *  overdue = open top-level tasks due before today (shown separately, never mixed into "today")
 */
export function todayTaskSummary(tasks: DashTask[], completions: DashCompletion[], today: string, dateOf: (ts: string) => string) {
  const done = completions.filter((c) => (c.occurrence_date ?? dateOf(c.completed_at)) === today).length;
  const open = tasks.filter((t) => !t.parent_task_id && isOpen(t));
  const dueToday = open.filter((t) => t.due_date === today).length;
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;
  return { done, total: done + dueToday, overdue };
}

/**
 * Up to `limit` focus tasks: open tasks due today or overdue (priority, then date), then open critical/high
 * tasks without a due date; any remaining slots show tasks completed today so finished work stays visible.
 */
export function dailyFocus<T extends DashTask>(tasks: T[], today: string, dateOf: (ts: string) => string, limit = 3): T[] {
  const top = tasks.filter((t) => !t.parent_task_id);
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const byPriority = (a: T, b: T) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || compareTasks(a, b);
  const due = top.filter((t) => isOpen(t) && t.due_date && t.due_date <= today).sort(byPriority);
  const important = top.filter((t) => isOpen(t) && !t.due_date && (t.priority === "critical" || t.priority === "high")).sort(byPriority);
  const doneToday = top.filter((t) => t.status === "done" && t.completed_at && dateOf(t.completed_at) === today);
  return [...due, ...important, ...doneToday].slice(0, limit);
}

export interface Upcoming { kind: string; title: string; date: string; time: string | null; href: string; key: string }

/** Chronological merge (date, then time; all-day/untimed items first within a day). */
export function sortUpcoming<U extends Upcoming>(items: U[]): U[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

const LINES = [
  "Make today count. One step at a time.",
  "Small steps, every day.",
  "Focus on what matters most today.",
  "Progress over perfection.",
  "Consistency builds everything.",
  "Do the next right thing.",
  "Clarity first, then action.",
];
/** A short subtitle that changes once a day (deterministic, so server and browser agree). */
export function dailySubtitle(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
  return LINES[dayOfYear % LINES.length];
}

export function greeting(hour: number): string {
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
