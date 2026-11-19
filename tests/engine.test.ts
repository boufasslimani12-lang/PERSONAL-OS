import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGoalProgressIndex, deadlineState } from "../lib/engine/goals.ts";
import { currentStreak, longestStreak, consistency, aggregateConsistency } from "../lib/engine/habits.ts";
import { nextOccurrence, taskCompletionRate } from "../lib/engine/tasks.ts";
import { summarize } from "../lib/engine/finance.ts";
import { scoreArea, overallProgress } from "../lib/engine/life-areas.ts";
import { personalRecords, totalVolume, bmi } from "../lib/engine/fitness.ts";
import { subjectGrade, semesterAveragePct } from "../lib/engine/education.ts";
import { scheduleReview } from "../lib/engine/vocabulary.ts";
import { addMonthsISO, startOfWeekISO } from "../lib/dates.ts";

const g = (id: string, extra: Partial<{ parent_id: string | null; status: string; progress_mode: string; manual_progress: number }> = {}) => ({
  id, parent_id: null, status: "active", progress_mode: "auto", manual_progress: 0, ...extra,
});

test("goal progress: auto averages children, milestones and tasks", () => {
  const goals = [g("A"), g("B", { parent_id: "A", status: "completed" }), g("C", { parent_id: "A", progress_mode: "manual", manual_progress: 50 })];
  const ms = [{ goal_id: "A", completed_at: "2026-01-01" }, { goal_id: "A", completed_at: null }];
  const tasks = [{ goal_id: "A", status: "done" }, { goal_id: "A", status: "cancelled" }];
  const idx = buildGoalProgressIndex(goals, ms, tasks);
  // units: B=100, C=50, m1=100, m2=0, t1=100 → 350/5 = 70
  assert.equal(idx.get("A").value, 70);
  assert.equal(idx.get("A").units, 5);
});

test("goal progress: empty auto goal is 0, cancelled is excluded", () => {
  const idx = buildGoalProgressIndex([g("A"), g("X", { status: "cancelled" }), g("P"), g("K", { parent_id: "P", status: "cancelled" })], [], []);
  assert.deepEqual([idx.get("A").value, idx.get("A").basis], [0, "empty"]);
  assert.equal(idx.get("X").value, null);
  assert.equal(idx.get("P").basis, "empty"); // cancelled child doesn't count
});

test("deadline state", () => {
  assert.equal(deadlineState("2026-01-01", "2026-01-05", false), "overdue");
  assert.equal(deadlineState("2026-01-08", "2026-01-05", false), "due_soon");
  assert.equal(deadlineState("2026-03-08", "2026-01-05", false), "on_track");
  assert.equal(deadlineState("2026-01-01", "2026-01-05", true), "done");
});

const habit = { id: "h", frequency: "daily", times_per_week: 1, days_of_week: [] as number[], start_date: "2026-01-01" };
const log = (d: string, completed = true) => ({ habit_id: "h", log_date: d, completed });

test("daily streak: today not yet done does not break streak", () => {
  const logs = [log("2026-01-08"), log("2026-01-09"), log("2026-01-10")];
  assert.equal(currentStreak(habit, logs, "2026-01-11"), 3);
  assert.equal(currentStreak(habit, [...logs, log("2026-01-11")], "2026-01-11"), 4);
  assert.equal(currentStreak(habit, [log("2026-01-08")], "2026-01-11"), 0);
});

test("custom-day streak skips unscheduled days", () => {
  // Mon(1)/Wed(3)/Fri(5). 2026-01-05 is a Monday.
  const h = { ...habit, frequency: "custom", days_of_week: [1, 3, 5] };
  const logs = [log("2026-01-05"), log("2026-01-07"), log("2026-01-09")];
  assert.equal(currentStreak(h, logs, "2026-01-11"), 3);
  assert.equal(longestStreak(h, logs, "2026-01-11"), 3);
});

test("incomplete logs (value below snapshot target) do not count", () => {
  assert.equal(currentStreak(habit, [log("2026-01-10", false)], "2026-01-11"), 0);
});

test("consistency excludes today while in progress", () => {
  const logs = [log("2026-01-01"), log("2026-01-02"), log("2026-01-04")];
  const c = consistency(habit, logs, "2026-01-01", "2026-01-31", "2026-01-05");
  assert.deepEqual([c.done, c.expected], [3, 4]);
  assert.equal(c.rate, 75);
});

test("weekly habit consistency caps completions and skips unfinished current week", () => {
  const h = { ...habit, frequency: "weekly", times_per_week: 2, start_date: "2026-01-05" };
  // week of Jan 5: 3 logs (capped to 2); week of Jan 12: 1 log; current week Jan 19: 0 (skipped)
  const logs = [log("2026-01-05"), log("2026-01-06"), log("2026-01-07"), log("2026-01-13")];
  const c = consistency(h, logs, "2026-01-01", "2026-01-31", "2026-01-20");
  assert.deepEqual([c.done, c.expected], [3, 4]);
  assert.equal(currentStreak(h, logs, "2026-01-20"), 0);
  assert.equal(currentStreak(h, logs, "2026-01-14"), 1);
});

test("aggregate consistency is total done / total expected", () => {
  const h2 = { ...habit, id: "h2" };
  const logs = [log("2026-01-01"), { habit_id: "h2", log_date: "2026-01-01", completed: false }];
  const c = aggregateConsistency([habit, h2], logs, "2026-01-01", "2026-01-01", "2026-01-02");
  assert.deepEqual([c.done, c.expected, c.rate], [1, 2, 50]);
});

test("recurrence", () => {
  assert.equal(nextOccurrence("2026-01-09", "weekdays"), "2026-01-12"); // Fri → Mon
  assert.equal(nextOccurrence("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextOccurrence("2026-01-01", "weekly", 2), "2026-01-15");
  assert.equal(addMonthsISO("2026-03-31", -1), "2026-02-28");
  assert.equal(startOfWeekISO("2026-01-11", 1), "2026-01-05");
});

test("task completion rate counts open overdue tasks and completions", () => {
  const tasks = [
    { status: "todo", due_date: "2026-01-03" }, // missed
    { status: "todo", due_date: "2026-01-10" }, // today: not counted yet
    { status: "cancelled", due_date: "2026-01-02" },
  ];
  const completions = [{ occurrence_date: "2026-01-02", completed_at: "2026-01-02T10:00:00Z" }, { occurrence_date: null, completed_at: "2026-01-05T10:00:00Z" }];
  const r = taskCompletionRate(tasks, completions, "2026-01-01", "2026-01-31", "2026-01-10");
  assert.deepEqual([r.done, r.total], [2, 3]);
});

test("finance summary", () => {
  const cats = [{ id: "food", name: "Food", kind: "expense", color: "#000", monthly_budget: 1000 }, { id: "fun", name: "Fun", kind: "expense", color: "#000", monthly_budget: null }];
  const txs = [
    { occurred_on: "2026-01-02", kind: "income", amount: 10000, category_id: null },
    { occurred_on: "2026-01-03", kind: "expense", amount: 800, category_id: "food" },
    { occurred_on: "2026-01-04", kind: "expense", amount: 200.5, category_id: "fun" },
    { occurred_on: "2026-02-01", kind: "expense", amount: 999, category_id: "food" },
  ];
  const s = summarize(txs, cats, "2026-01-01", "2026-01-31");
  assert.equal(s.income, 10000);
  assert.equal(s.expenses, 1000.5);
  assert.equal(s.net, 8999.5);
  assert.equal(Math.round(s.savingsRate! * 100) / 100, 90);
  assert.equal(s.budgetUtilization, 80);
  assert.equal(summarize([], cats, "2026-01-01", "2026-01-31").savingsRate, null);
});

test("life areas: no data is null, not zero; overall reports coverage", () => {
  const a = scoreArea({ id: "a", goalProgress: [50, 100], taskRate: 50, habitRate: null });
  const b = scoreArea({ id: "b", goalProgress: [], taskRate: null, habitRate: null });
  assert.equal(a.score, 62.5);
  assert.equal(b.score, null);
  const o = overallProgress([a, b]);
  assert.deepEqual(o, { value: 62.5, coverage: 1, total: 2 });
});

test("fitness PRs and volume", () => {
  const sets = [
    { exercise_id: "sq", reps: 5, weight: 100, completed: true, workout_id: "w" },
    { exercise_id: "sq", reps: 1, weight: 120, completed: true, workout_id: "w" },
    { exercise_id: "sq", reps: 10, weight: 200, completed: false, workout_id: "w" },
  ];
  const pr = personalRecords(sets).get("sq")!;
  assert.equal(pr.maxWeight, 120);
  assert.equal(totalVolume(sets), 620);
  assert.equal(Math.round(bmi(70, 175)! * 10) / 10, 22.9);
});

test("education grades", () => {
  const subj = [{ id: "m", coefficient: 2, grade_scale: 20 }, { id: "p", coefficient: 1, grade_scale: 100 }, { id: "x", coefficient: 5, grade_scale: 20 }];
  const as = [
    { subject_id: "m", score: 15, max_score: 20, weight: 1, status: "graded" },
    { subject_id: "m", score: 8, max_score: 10, weight: 3, status: "graded" },
    { subject_id: "p", score: 50, max_score: 100, weight: 1, status: "graded" },
    { subject_id: "x", score: null, max_score: 20, weight: 1, status: "pending" },
  ];
  assert.equal(subjectGrade(subj[0], as), 15.75); // (15*1 + 16*3)/4
  assert.equal(subjectGrade(subj[2], as), null);
  // m = 78.75% ×2, p = 50% ×1 → 207.5/3
  assert.equal(Math.round(semesterAveragePct(subj, as)! * 100) / 100, 69.17);
});

test("vocabulary scheduling", () => {
  assert.deepEqual(scheduleReview(0, true), { repetitions: 1, interval: 1 });
  assert.deepEqual(scheduleReview(3, true), { repetitions: 4, interval: 14 });
  assert.deepEqual(scheduleReview(5, false), { repetitions: 0, interval: 1 });
});

import { expandEvents } from "../lib/engine/calendar.ts";
test("calendar: recurring events expand virtually within range", () => {
  const ev = { id: "e", start_at: new Date(2026, 0, 5, 9).toISOString(), end_at: new Date(2026, 0, 5, 10).toISOString(), recurrence: "weekly", recurrence_until: "2026-01-26" };
  const occ = expandEvents([ev], "2026-01-10", "2026-02-28");
  assert.deepEqual(occ.map((o) => o.occurrence_date), ["2026-01-12", "2026-01-19", "2026-01-26"]);
  assert.equal(new Date(occ[0].occurrence_end!).getTime() - new Date(occ[0].occurrence_start).getTime(), 3600000);
  const single = expandEvents([{ ...ev, recurrence: null }], "2026-01-01", "2026-01-31");
  assert.equal(single.length, 1);
});

import { renderMarkdown } from "../lib/markdown.ts";
test("markdown is escaped and only safe links survive", () => {
  const html = renderMarkdown("# Hi\n**bold** <script>alert(1)</script>\n- a\n- b\n[x](javascript:alert(1)) [ok](https://example.com)");
  assert.ok(html.includes("<h1>Hi</h1>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes("<ul><li>a</li><li>b</li></ul>"));
});
