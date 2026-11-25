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

import { dateInZone, hourInZone, isValidTimeZone } from "../lib/dates.ts";
test("time zone: calendar day and hour follow the profile zone, not the server's", () => {
  const instant = new Date("2026-01-01T23:30:00Z"); // 00:30 on Jan 2 in Casablanca (UTC+1)
  assert.equal(dateInZone(instant, "Africa/Casablanca"), "2026-01-02");
  assert.equal(dateInZone(instant, "UTC"), "2026-01-01");
  assert.equal(dateInZone(instant, "America/New_York"), "2026-01-01");
  assert.equal(hourInZone(instant, "Africa/Casablanca"), 0);
  assert.equal(isValidTimeZone("Africa/Casablanca"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
});

test("calendar: occurrences use the event's local day in the given zone", () => {
  const ev = { id: "e", start_at: "2026-01-04T23:30:00Z", end_at: null, recurrence: "weekly", recurrence_until: null };
  const occ = expandEvents([ev], "2026-01-01", "2026-01-20", "Africa/Casablanca");
  assert.deepEqual(occ.map((o) => o.occurrence_date), ["2026-01-05", "2026-01-12", "2026-01-19"]);
  assert.equal(occ[1].occurrence_start, "2026-01-11T23:30:00.000Z");
});

import { toZonedWallTime, fromZonedWallTime } from "../lib/dates.ts";
test("time zone: datetime inputs round-trip in the profile zone", () => {
  assert.equal(toZonedWallTime("2026-01-01T23:30:00.000Z", "Africa/Casablanca"), "2026-01-02T00:30");
  assert.equal(fromZonedWallTime("2026-01-02T00:30", "Africa/Casablanca"), "2026-01-01T23:30:00.000Z");
  assert.equal(fromZonedWallTime("2026-07-01T09:00", "America/New_York"), "2026-07-01T13:00:00.000Z"); // EDT
  assert.equal(fromZonedWallTime("2026-01-15T09:00", "America/New_York"), "2026-01-15T14:00:00.000Z"); // EST
  for (const ts of ["2026-03-29T01:30:00.000Z", "2026-10-25T12:00:00.000Z"]) {
    assert.equal(fromZonedWallTime(toZonedWallTime(ts, "Europe/Paris"), "Europe/Paris"), ts);
  }
});

import { buildCsp, createNonce } from "../lib/security/csp.ts";
test("CSP: nonce-based scripts, Supabase-only connections, no framing", () => {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, supabaseUrl: "https://abc.supabase.co", isDev: false });
  assert.match(csp, new RegExp(`script-src 'self' 'nonce-${nonce.replace(/[+/=]/g, "\\$&")}' 'strict-dynamic'`));
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
  assert.ok(!/unsafe-eval/.test(csp));
  assert.ok(csp.includes("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.notEqual(createNonce(), createNonce());
  assert.ok(buildCsp({ nonce, supabaseUrl: "", isDev: true }).includes("'unsafe-eval'"));
});

import { activeAreas, areaFilterOptions, areaOptions, inactiveAreaPages } from "../lib/life-areas.ts";
test("life areas: inactive areas leave navigation and new-item selectors but stay on their records", () => {
  const areas = [
    { id: "h", key: "health", name: "Fitness & Health", is_active: false },
    { id: "e", key: "education", name: "Education", is_active: true },
    { id: "m", key: "mind", name: "Mind & Reflection", is_active: false },
  ];
  assert.deepEqual(activeAreas(areas).map((a) => a.id), ["e"]);
  assert.deepEqual(inactiveAreaPages(areas), [{ href: "/fitness", name: "Fitness & Health" }, { href: "/journal", name: "Mind & Reflection" }]);
  assert.deepEqual(areaOptions(areas).map((o) => o.value), ["e"]);
  assert.deepEqual(areaOptions(areas, "h"), [{ value: "h", label: "Fitness & Health (inactive)" }, { value: "e", label: "Education" }]);
  assert.equal(areaFilterOptions(areas).length, 3);
  assert.equal(areaFilterOptions(areas)[0].label, "Fitness & Health (inactive)");
});

import { todayTaskSummary, dailyFocus, sortUpcoming, dailySubtitle, greeting } from "../lib/engine/dashboard.ts";
test("dashboard: today's task summary separates today from overdue", () => {
  const today = "2026-01-10";
  const dateOf = (ts: string) => ts.slice(0, 10);
  const tasks = [
    { id: "a", status: "todo", priority: "medium", due_date: today },
    { id: "b", status: "todo", priority: "medium", due_date: "2026-01-08" },
    { id: "c", status: "done", priority: "medium", due_date: today },
    { id: "s", status: "todo", priority: "medium", due_date: today, parent_task_id: "a" },
  ];
  const completions = [
    { task_id: "c", occurrence_date: today, completed_at: "2026-01-10T09:00:00Z" },
    { task_id: "r", occurrence_date: "2026-01-09", completed_at: "2026-01-10T09:00:00Z" }, // late completion of yesterday's occurrence
    { task_id: "u", occurrence_date: null, completed_at: "2026-01-10T11:00:00Z" },
  ];
  assert.deepEqual(todayTaskSummary(tasks, completions, today, dateOf), { done: 2, total: 3, overdue: 1 });
});

test("dashboard: daily focus picks due/overdue by priority, then important undated, then done today", () => {
  const today = "2026-01-10";
  const dateOf = (ts: string) => ts.slice(0, 10);
  const t = (id: string, o: Record<string, unknown>) => ({ id, status: "todo", priority: "medium", due_date: null, ...o });
  const tasks = [
    t("low-today", { priority: "low", due_date: today }),
    t("crit-overdue", { priority: "critical", due_date: "2026-01-05" }),
    t("high-undated", { priority: "high" }),
    t("med-undated", {}),
    t("future", { priority: "critical", due_date: "2026-02-01" }),
    t("done", { status: "done", completed_at: "2026-01-10T08:00:00Z" }),
  ];
  assert.deepEqual(dailyFocus(tasks, today, dateOf).map((x) => x.id), ["crit-overdue", "low-today", "high-undated"]);
  assert.deepEqual(dailyFocus(tasks, today, dateOf, 5).map((x) => x.id), ["crit-overdue", "low-today", "high-undated", "done"]);
  assert.deepEqual(dailyFocus([], today, dateOf), []);
});

test("dashboard: upcoming is chronological; greeting and subtitle are stable", () => {
  const items = [
    { kind: "Event", title: "B", date: "2026-01-11", time: "09:00", href: "", key: "1" },
    { kind: "Task", title: "A", date: "2026-01-11", time: null, href: "", key: "2" },
    { kind: "Event", title: "C", date: "2026-01-10", time: "18:00", href: "", key: "3" },
  ];
  assert.deepEqual(sortUpcoming(items).map((i) => i.key), ["3", "2", "1"]);
  assert.equal(greeting(8), "Good morning");
  assert.equal(greeting(14), "Good afternoon");
  assert.equal(greeting(21), "Good evening");
  assert.equal(dailySubtitle("2026-01-10"), dailySubtitle("2026-01-10"));
  assert.notEqual(dailySubtitle("2026-01-10"), dailySubtitle("2026-01-11"));
});

import { exerciseSessions, exerciseProgress, previousPerformance, nextTrainingDay, orderWorkoutExercises, workoutSummary, targetRepsValue } from "../lib/engine/fitness.ts";
test("fitness: per-exercise progression from finished workouts only", () => {
  const workouts = [
    { id: "w1", started_at: "2026-01-01T10:00:00Z", ended_at: "2026-01-01T11:00:00Z", template_id: "d1" },
    { id: "w2", started_at: "2026-01-04T10:00:00Z", ended_at: "2026-01-04T11:10:00Z", template_id: "d2" },
    { id: "w3", started_at: "2026-01-08T10:00:00Z", ended_at: null, template_id: "d1" }, // unfinished: ignored
  ];
  const s = (workout_id: string, set_number: number, weight: number, reps: number, completed = true, exercise_id = "bench") => ({ workout_id, set_number, weight, reps, completed, exercise_id });
  const sets = [
    s("w1", 1, 40, 12), s("w1", 2, 45, 10), s("w1", 3, 45, 8),
    s("w2", 1, 45, 12), s("w2", 2, 50, 8), s("w2", 3, 60, 5, false),
    s("w3", 1, 70, 5),
    s("w1", 1, 100, 5, true, "squat"),
  ];
  const sessions = exerciseSessions("bench", sets, workouts);
  assert.deepEqual(sessions.map((x) => [x.workoutId, x.topWeight, x.topReps, x.sets]), [["w1", 45, 10, 3], ["w2", 50, 8, 2]]);
  assert.deepEqual(exerciseProgress(sessions), { sessions: 2, latestWeight: 50, previousWeight: 45, bestWeight: 50, latestReps: 8, change: 5 });
  assert.deepEqual(exerciseProgress([]), { sessions: 0, latestWeight: null, previousWeight: null, bestWeight: null, latestReps: null, change: null });
  const prev = previousPerformance("bench", sets, workouts, "w2")!;
  assert.equal(prev.startedAt, workouts[0].started_at);
  assert.deepEqual(prev.sets.map((x) => x.weight), [40, 45, 45]);
  assert.equal(previousPerformance("deadlift", sets, workouts), null);
  assert.deepEqual(workoutSummary(workouts[1], sets), { exercises: 1, sets: 2, volume: 45 * 12 + 50 * 8, minutes: 70 });
});

test("fitness: next training day cycles through the program; exercise order follows the day", () => {
  const days = [{ id: "d1" }, { id: "d2" }, { id: "d3" }];
  const w = (template_id: string, started_at: string, ended_at: string | null = started_at) => ({ id: started_at, template_id, started_at, ended_at });
  assert.equal(nextTrainingDay(days, [])!.id, "d1");
  assert.equal(nextTrainingDay(days, [w("d1", "2026-01-01")])!.id, "d2");
  assert.equal(nextTrainingDay(days, [w("d1", "2026-01-01"), w("d3", "2026-01-05")])!.id, "d1");
  assert.equal(nextTrainingDay(days, [w("d2", "2026-01-09", null)])!.id, "d1"); // unfinished doesn't advance
  assert.equal(nextTrainingDay([], []), null);
  const order = orderWorkoutExercises([{ exercise_id: "x", set_number: 1 }, { exercise_id: "b", set_number: 1 }, { exercise_id: "a", set_number: 1 }], ["a", "b"]);
  assert.deepEqual(order, ["a", "b", "x"]);
  assert.equal(targetRepsValue("8-12"), 8);
  assert.equal(targetRepsValue("AMRAP"), null);
});

import { formatTime, formatDateTime } from "../lib/dates.ts";
test("time formatting is locale-independent HH:mm in the given zone", () => {
  assert.equal(formatTime("2026-01-01T08:05:00Z", "Africa/Casablanca"), "09:05");
  assert.equal(formatTime("2026-01-01T23:30:00Z", "Africa/Casablanca"), "00:30");
  assert.equal(formatTime("2026-07-01T13:00:00Z", "America/New_York"), "09:00");
  assert.equal(formatDateTime("2026-01-01T23:30:00Z", "Africa/Casablanca"), "Jan 2, 00:30");
});

import { buildZoneRules, setAppTimeZone } from "../lib/dates.ts";
test("zone rules: server-built offsets drive conversions, matching Intl and catching DST", () => {
  const from = Date.parse("2026-01-01T00:00:00Z");
  const to = Date.parse("2027-01-01T00:00:00Z");
  const paris = buildZoneRules("Europe/Paris", from, to);
  assert.deepEqual(paris.transitions.map((t) => [new Date(t.at).toISOString(), t.offset]), [
    ["2026-01-01T00:00:00.000Z", 60],
    ["2026-03-29T01:00:00.000Z", 120],
    ["2026-10-25T01:00:00.000Z", 60],
  ]);
  setAppTimeZone("Europe/Paris", paris);
  assert.equal(dateInZone(new Date("2026-06-30T22:30:00Z")), "2026-07-01");
  assert.equal(formatTime("2026-06-30T22:30:00Z"), "00:30");
  assert.equal(fromZonedWallTime("2026-03-29T03:30"), "2026-03-29T01:30:00.000Z");
  // a table that differs from the runtime's own tz data wins (the browser follows the server)
  setAppTimeZone("Europe/Paris", { tz: "Europe/Paris", from, to, transitions: [{ at: from, offset: 0 }] });
  assert.equal(formatTime("2026-06-30T22:30:00Z"), "22:30");
  assert.equal(fromZonedWallTime("2026-06-30T09:00"), "2026-06-30T09:00:00.000Z");
  setAppTimeZone(undefined);
});
