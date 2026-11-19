import { BarChart3, Info } from "lucide-react";
import { loadLifeSnapshot, SCORE_WINDOW_DAYS } from "@/lib/server/snapshot";
import { PageHeader, ProgressRing, StatCard, Progress, EmptyState } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarSeriesChart, LineSeriesChart } from "@/components/charts";
import { addDaysISO, addMonthsISO, endOfMonthISO, formatDate, startOfMonthISO, startOfWeekISO } from "@/lib/dates";
import { aggregateConsistency } from "@/lib/engine/habits";
import { taskCompletionRate } from "@/lib/engine/tasks";
import { summarize } from "@/lib/engine/finance";
import { formatMoney, formatPct } from "@/lib/format";

export const metadata = { title: "Analytics" };

const pct = (v: number | null) => (v === null ? null : Math.round(v));

export default async function AnalyticsPage() {
  const s = await loadLifeSnapshot();
  const { supabase, today } = s;
  const since = addDaysISO(startOfWeekISO(today, s.weekStartsOn), -7 * 11);
  const sixMonths = addMonthsISO(startOfMonthISO(today), -5);
  const currency = s.profile?.currency ?? "MAD";

  const [study, workouts, skillS, langS, txs, cats, skills] = await Promise.all([
    supabase.from("study_sessions").select("started_at,duration_minutes").gte("started_at", since),
    supabase.from("workouts").select("started_at,ended_at").gte("started_at", since).not("ended_at", "is", null),
    supabase.from("skill_sessions").select("session_date,duration_minutes").gte("session_date", since),
    supabase.from("language_sessions").select("session_date,duration_minutes").gte("session_date", since),
    supabase.from("transactions").select("*").gte("occurred_on", sixMonths).eq("currency", currency),
    supabase.from("finance_categories").select("*"),
    supabase.from("skills").select("kind,current_level,target_level").is("archived_at", null),
  ]);

  const weeks = Array.from({ length: 12 }, (_, i) => addDaysISO(since, 7 * i));
  const inWeek = (d: string, w: string) => d >= w && d < addDaysISO(w, 7);
  const weekly = weeks.map((w) => {
    const end = addDaysISO(w, 6);
    const tr = taskCompletionRate(s.tasks, s.completions, w, end, today);
    const hr = aggregateConsistency(s.habits, s.habitLogs, w, end, today, s.weekStartsOn);
    const h = (rows: { d: string; m: number }[]) => Math.round(rows.filter((r) => inWeek(r.d, w)).reduce((a, r) => a + r.m, 0) / 6) / 10;
    return {
      week: formatDate(w),
      tasks: pct(tr.rate), habits: pct(hr.rate),
      study: h((study.data ?? []).map((x) => ({ d: x.started_at.slice(0, 10), m: x.duration_minutes }))),
      skills: h((skillS.data ?? []).map((x) => ({ d: x.session_date, m: x.duration_minutes }))),
      languages: h((langS.data ?? []).map((x) => ({ d: x.session_date, m: x.duration_minutes }))),
      workouts: (workouts.data ?? []).filter((x) => inWeek(x.started_at.slice(0, 10), w)).length,
    };
  });

  const months = Array.from({ length: 6 }, (_, i) => addMonthsISO(startOfMonthISO(today), i - 5));
  const finance = months.map((m) => {
    const x = summarize(txs.data ?? [], cats.data ?? [], m, endOfMonthISO(m));
    return { month: formatDate(m, { month: "short" }), net: x.net, savingsRate: x.savingsRate === null ? null : Math.round(x.savingsRate) };
  });

  const goalCounts = ["annual", "quarterly", "monthly", "weekly"].map((l) => {
    const gs = s.goals.filter((g) => g.level === l && g.status !== "cancelled");
    return { level: l[0].toUpperCase() + l.slice(1), completed: gs.filter((g) => g.status === "completed").length, open: gs.filter((g) => g.status !== "completed").length };
  });
  const allGoals = s.goals.filter((g) => g.status !== "cancelled");
  const goalCompletion = allGoals.length ? (allGoals.filter((g) => g.status === "completed").length / allGoals.length) * 100 : null;
  const tr30 = taskCompletionRate(s.tasks, s.completions, s.window.from, today, today);
  const hr30 = aggregateConsistency(s.habits, s.habitLogs, s.window.from, today, today, s.weekStartsOn);
  const skillProgress = (skills.data ?? []).length ? (skills.data ?? []).reduce((a, k) => a + Math.min(100, (k.current_level / k.target_level) * 100), 0) / skills.data!.length : null;
  const hasWeekly = weekly.some((w) => w.tasks !== null || w.habits !== null);
  const hasTime = weekly.some((w) => w.study || w.skills || w.languages);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" icon={BarChart3} description="Your life progress engine — every number is explained below" />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-5">
          <ProgressRing value={s.overall.value} size={96} stroke={8} />
          <div className="min-w-60 flex-1">
            <p className="text-lg font-semibold">Overall life progress</p>
            <p className="text-sm text-muted-foreground">
              {s.overall.value === null ? "No area has tracked data yet. Areas without data are never counted as 0%." :
                `Average of ${s.overall.coverage} of ${s.overall.total} life areas that have data in the last ${SCORE_WINDOW_DAYS} days. Areas without data are excluded, not counted as 0%.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Goal completion" value={formatPct(goalCompletion)} hint={`${allGoals.filter((g) => g.status === "completed").length}/${allGoals.length} goals`} />
            <StatCard label="Task completion" value={formatPct(tr30.rate)} hint={`${tr30.done}/${tr30.total} · ${SCORE_WINDOW_DAYS}d`} />
            <StatCard label="Habit consistency" value={formatPct(hr30.rate)} hint={`${hr30.done}/${hr30.expected} · ${SCORE_WINDOW_DAYS}d`} />
            <StatCard label="Skill level vs target" value={formatPct(skillProgress)} hint={`${skills.data?.length ?? 0} skills`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Progress by life area</CardTitle><CardDescription>Each area score is the mean of the components that have data</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Area</th><th className="py-2 font-medium">Goals</th><th className="py-2 font-medium">Tasks ({SCORE_WINDOW_DAYS}d)</th><th className="py-2 font-medium">Habits ({SCORE_WINDOW_DAYS}d)</th><th className="w-48 py-2 font-medium">Score</th></tr></thead>
            <tbody>
              {s.scores.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="py-2"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: a.color }} />{a.name}</span></td>
                  <td className="py-2 tabular-nums text-muted-foreground">{formatPct(a.components.goals)}</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{formatPct(a.components.tasks)}</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{formatPct(a.components.habits)}</td>
                  <td className="py-2"><span className="flex items-center gap-2"><Progress value={a.score} color={a.color} /><span className="w-14 text-right text-xs font-medium tabular-nums">{a.score === null ? "No data" : `${Math.round(a.score)}%`}</span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Weekly performance</CardTitle><CardDescription>Task completion rate and habit consistency (%), last 12 weeks</CardDescription></div></CardHeader>
          <CardContent>{hasWeekly ? <LineSeriesChart data={weekly} xKey="week" domain={[0, 100]} series={[{ key: "tasks", label: "Task completion" }, { key: "habits", label: "Habit consistency" }]} valueFormat={{ kind: "percent" }} /> : <EmptyState icon={BarChart3} title="Not enough data yet" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Time invested in learning</CardTitle><CardDescription>Hours per week: study, skills, languages</CardDescription></div></CardHeader>
          <CardContent>{hasTime ? <BarSeriesChart stacked data={weekly} xKey="week" series={[{ key: "study", label: "Study" }, { key: "skills", label: "Skills" }, { key: "languages", label: "Languages" }]} valueFormat={{ kind: "hours" }} /> : <EmptyState icon={BarChart3} title="No learning sessions logged" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Workout frequency</CardTitle><CardDescription>Completed workouts per week</CardDescription></div></CardHeader>
          <CardContent>{weekly.some((w) => w.workouts) ? <BarSeriesChart data={weekly} xKey="week" series={[{ key: "workouts", label: "Workouts", color: "var(--series-8)" }]} /> : <EmptyState icon={BarChart3} title="No workouts logged" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Goals by level</CardTitle><CardDescription>Completed vs open (cancelled excluded)</CardDescription></div></CardHeader>
          <CardContent>{allGoals.length ? <BarSeriesChart stacked data={goalCounts} xKey="level" series={[{ key: "completed", label: "Completed", color: "var(--series-3)" }, { key: "open", label: "Open", color: "var(--series-1)" }]} /> : <EmptyState icon={BarChart3} title="No goals yet" />}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Financial performance</CardTitle><CardDescription>Net balance per month ({currency})</CardDescription></div></CardHeader>
          <CardContent>{finance.some((f) => f.net) ? <BarSeriesChart data={finance} xKey="month" series={[{ key: "net", label: "Net balance", color: "var(--series-3)" }]} valueFormat={{ kind: "money", currency }} /> : <EmptyState icon={BarChart3} title="No transactions in the last 6 months" />}
            {finance.some((f) => f.savingsRate !== null) && <p className="mt-2 text-xs text-muted-foreground">Savings rate: {finance.map((f) => `${f.month} ${f.savingsRate === null ? "—" : `${f.savingsRate}%`}`).join(" · ")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><Info className="size-4" /> How every number is calculated</CardTitle></div></CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            {[
              ["Goal progress", "Completed → 100%. Cancelled → excluded. Manual mode → your value. Automatic mode → equal-weighted average of its sub-goals (their own progress), milestones (0 or 100) and linked top-level tasks (0 or 100). An automatic goal with nothing to measure shows 0% and says so."],
              ["Task completion rate", "Completions whose due date falls in the window ÷ (those completions + open tasks that were due in the window before today). Tasks due today don't count against you until the day is over. Recurring tasks count each occurrence."],
              ["Habit consistency", "Completed scheduled check-ins ÷ scheduled check-ins. A check-in is complete when its value reaches the target stored on that day's log, so changing a target never rewrites history. Today (or the current week for weekly habits) only counts once completed. Across habits we use total done ÷ total expected, not an average of percentages."],
              ["Streaks", "Consecutive scheduled days (or weeks for weekly habits) completed, ending today or yesterday. Unscheduled days don't break a streak."],
              ["Life-area score", `Mean of the components with data: average progress of the area's top-level goals, the area's task completion rate (${SCORE_WINDOW_DAYS} days) and habit consistency (${SCORE_WINDOW_DAYS} days). With no data the area shows “No data”, never 0%.`],
              ["Overall life progress", "Mean of the life-area scores that have data, always shown with its coverage (e.g. “4 of 10 areas”), so one tracked area is never presented as your whole life."],
              ["Finance", "Net = income − expenses. Savings rate = net ÷ income (shown as “—” when there's no income). Budget utilisation = spending in budgeted categories ÷ their budgets. Only transactions in your profile currency are summed; no exchange rates are invented."],
              ["Grades & skills", "Subject grade = weighted mean of graded assessments on the subject's scale. Semester average = coefficient-weighted mean expressed as %. Skill progress = current level ÷ target level."],
            ].map(([t, d]) => <div key={t}><dt className="font-medium">{t}</dt><dd className="mt-0.5 text-muted-foreground">{d}</dd></div>)}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
