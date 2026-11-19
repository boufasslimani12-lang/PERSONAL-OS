import Link from "next/link";
import {
  LayoutDashboard, ListChecks, Repeat, CalendarDays, Target, Activity, Flag, Dumbbell, GraduationCap, Wallet, NotebookPen, CheckCircle2,
  Languages, Code2, Users, Briefcase, Moon, Sprout, type LucideIcon,
} from "lucide-react";
import { loadLifeSnapshot, SCORE_WINDOW_DAYS } from "@/lib/server/snapshot";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, EmptyState, Progress, ProgressRing, StatCard } from "@/components/ui/misc";
import { TaskRow } from "@/components/shared/task-row";
import { HabitCheck } from "@/components/shared/habit-check";
import { BarSeriesChart } from "@/components/charts";
import { CustomizeDashboard, DASHBOARD_WIDGETS } from "./customize";
import { addDaysISO, addMonthsISO, eachDayISO, endOfMonthISO, formatDate, formatDateTime, isoFromTimestamp, relativeDayLabel, startOfMonthISO } from "@/lib/dates";
import { isDueToday, aggregateConsistency } from "@/lib/engine/habits";
import { compareTasks, taskCompletionRate } from "@/lib/engine/tasks";
import { expandEvents } from "@/lib/engine/calendar";
import { summarize } from "@/lib/engine/finance";
import { formatMoney, formatPct } from "@/lib/format";
import { AREA_HREF } from "@/lib/nav";

export const metadata = { title: "Dashboard" };

const AREA_ICONS: Record<string, LucideIcon> = {
  health: Dumbbell, education: GraduationCap, languages: Languages, hard_skills: Code2, soft_skills: Users,
  career: Briefcase, religion: Moon, finance: Wallet, growth: Sprout, mind: NotebookPen,
};

export default async function DashboardPage() {
  const s = await loadLifeSnapshot();
  const { supabase, today } = s;
  const hidden = new Set<string>(Array.isArray(s.profile?.dashboard_widgets) ? (s.profile!.dashboard_widgets as string[]) : []);
  const show = (k: string) => !hidden.has(k);
  const in14 = addDaysISO(today, 14);
  const sixMonthsAgo = addMonthsISO(startOfMonthISO(today), -5);

  const [events, workouts, txs, cats, study, notes, assessments, projects] = await Promise.all([
    supabase.from("events").select("*").or(`start_at.lte.${in14}T23:59:59,recurrence.not.is.null`),
    supabase.from("workouts").select("id,name,started_at,ended_at").gte("started_at", sixMonthsAgo).order("started_at", { ascending: false }),
    supabase.from("transactions").select("*").gte("occurred_on", startOfMonthISO(today)).order("occurred_on", { ascending: false }),
    supabase.from("finance_categories").select("*"),
    supabase.from("study_sessions").select("id,started_at,duration_minutes,notes").gte("started_at", addDaysISO(today, -60)).order("started_at", { ascending: false }),
    supabase.from("notes").select("id,title,kind,entry_date,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("assessments").select("id,title,due_date,kind,status").eq("status", "pending").gte("due_date", today).lte("due_date", in14),
    supabase.from("projects").select("id,title,due_date,status").is("archived_at", null).not("status", "in", "(completed,cancelled)").gte("due_date", today).lte("due_date", in14),
  ]);

  const currency = s.profile?.currency ?? "MAD";
  const areaById = new Map(s.areas.map((a) => [a.id, a]));

  // Today
  const openTasks = s.tasks.filter((t) => !t.parent_task_id && t.status !== "done" && t.status !== "cancelled");
  const todayTasks = openTasks.filter((t) => t.due_date && t.due_date <= today).sort(compareTasks);
  const doneToday = s.completions.filter((c) => isoFromTimestamp(c.completed_at) === today).length;
  const todayHabits = s.habits.filter((h) => isDueToday(h, today, s.habitLogs, s.weekStartsOn));
  const logsToday = new Map(s.habitLogs.filter((l) => l.log_date === today).map((l) => [l.habit_id, l]));
  const habitsDone = todayHabits.filter((h) => logsToday.get(h.id)?.completed).length;

  // Upcoming
  const deadlines = [
    ...openTasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= in14).map((t) => ({ id: t.id, title: t.title, date: t.due_date!, kind: "Task", href: "/tasks" })),
    ...s.goals.filter((g) => g.target_date && g.target_date >= today && g.target_date <= in14 && !["completed", "cancelled"].includes(g.status)).map((g) => ({ id: g.id, title: g.title, date: g.target_date!, kind: "Goal", href: `/goals?open=${g.id}` })),
    ...(assessments.data ?? []).map((a) => ({ id: a.id, title: a.title, date: a.due_date!, kind: a.kind === "exam" ? "Exam" : "Assignment", href: "/education" })),
    ...(projects.data ?? []).map((p) => ({ id: p.id, title: p.title, date: p.due_date!, kind: "Project", href: "/tasks?view=projects" })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const upcomingEvents = expandEvents(events.data ?? [], today, addDaysISO(today, 7)).slice(0, 6);

  // Weekly goals
  const weeklyGoals = s.goals.filter((g) => g.level === "weekly" && !["completed", "cancelled"].includes(g.status)).slice(0, 6);

  // Goal stats
  const yearStart = today.slice(0, 4) + "-01-01";
  const activeGoals = s.goals.filter((g) => ["active", "not_started", "on_hold"].includes(g.status));
  const completedThisYear = s.goals.filter((g) => g.status === "completed" && (g.completed_at ?? g.updated_at) >= yearStart).length;
  const overdueGoals = activeGoals.filter((g) => g.target_date && g.target_date < today).length;
  const avgGoal = activeGoals.length ? activeGoals.reduce((a, g) => a + (s.goalIndex.get(g.id).value ?? 0), 0) / activeGoals.length : null;

  // Weekly productivity: last 7 days
  const week = eachDayISO(addDaysISO(today, -6), today);
  const productivity = week.map((d) => ({
    day: formatDate(d, { weekday: "short" }),
    tasks: s.completions.filter((c) => isoFromTimestamp(c.completed_at) === d).length,
    habits: s.habitLogs.filter((l) => l.log_date === d && l.completed).length,
  }));
  const hasProductivity = productivity.some((p) => p.tasks || p.habits);

  // Monthly performance: last 6 months, rates
  const months = Array.from({ length: 6 }, (_, i) => addMonthsISO(startOfMonthISO(today), i - 5));
  const monthly = months.map((m) => {
    const end = endOfMonthISO(m);
    const tr = taskCompletionRate(s.tasks, s.completions, m, end, today);
    const hr = aggregateConsistency(s.habits, s.habitLogs, m, end, today, s.weekStartsOn);
    return { month: formatDate(m, { month: "short" }), tasks: tr.rate === null ? null : Math.round(tr.rate), habits: hr.rate === null ? null : Math.round(hr.rate) };
  });
  const hasMonthly = monthly.some((m) => m.tasks !== null || m.habits !== null);

  // Month snapshot
  const fin = summarize((txs.data ?? []).filter((t) => t.currency === currency), cats.data ?? [], s.month.from, s.month.to);
  const workoutsThisMonth = (workouts.data ?? []).filter((w) => w.started_at.slice(0, 10) >= s.month.from).length;
  const studyMinMonth = (study.data ?? []).filter((x) => x.started_at.slice(0, 10) >= s.month.from).reduce((a, x) => a + x.duration_minutes, 0);

  // Recent activity
  const taskTitle = new Map(s.tasks.map((t) => [t.id, t.title]));
  const habitName = new Map(s.habits.map((h) => [h.id, h.name]));
  const activity = [
    ...s.completions.slice(-20).map((c) => ({ at: c.completed_at, icon: CheckCircle2, text: `Completed “${taskTitle.get(c.task_id) ?? "task"}”` })),
    ...s.habitLogs.filter((l) => l.completed).slice(-20).map((l) => ({ at: l.updated_at, icon: Repeat, text: `Checked in “${habitName.get(l.habit_id) ?? "habit"}”` })),
    ...(workouts.data ?? []).slice(0, 5).map((w) => ({ at: w.started_at, icon: Dumbbell, text: `Workout: ${w.name}` })),
    ...(txs.data ?? []).slice(0, 5).map((t) => ({ at: t.created_at, icon: Wallet, text: `${t.kind === "income" ? "Income" : "Expense"} ${formatMoney(Number(t.amount), t.currency)}${t.description ? ` · ${t.description}` : ""}` })),
    ...(notes.data ?? []).map((n) => ({ at: n.created_at, icon: NotebookPen, text: `Wrote ${n.kind === "note" ? "note" : `${n.kind} journal`}${n.title ? ` “${n.title}”` : ""}` })),
    ...(study.data ?? []).slice(0, 5).map((x) => ({ at: x.started_at, icon: GraduationCap, text: `Studied ${x.duration_minutes} min` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isNewUser = s.goals.length === 0 && s.tasks.length === 0 && s.habits.length === 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-accent via-card to-card p-5 sm:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{formatDate(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting}, {s.profile?.display_name ?? "there"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayTasks.length} task{todayTasks.length === 1 ? "" : "s"} due · {habitsDone}/{todayHabits.length} habits done · {doneToday} completed today
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Overall life progress</p>
            <p className="text-[11px] text-muted-foreground">
              {s.overall.coverage ? `Based on ${s.overall.coverage} of ${s.overall.total} areas · last ${SCORE_WINDOW_DAYS} days` : "No tracked data yet"}
            </p>
          </div>
          <ProgressRing value={s.overall.value} size={76} stroke={7} />
          <CustomizeDashboard hidden={[...hidden]} />
        </div>
      </div>

      {isNewUser && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Welcome to your Personal OS 👋</p>
              <p className="text-xs text-muted-foreground">Start by setting an annual goal, adding today&apos;s tasks and one or two habits. Your dashboard fills in as you track.</p>
            </div>
            <div className="flex gap-2 text-sm">
              <Link className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" href="/goals">Set a goal</Link>
              <Link className="rounded-lg border border-border px-3 py-1.5" href="/habits">Add a habit</Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Life areas */}
      {show("areas") && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Life areas</h2>
            <Link href="/analytics" className="text-xs text-primary hover:underline">How is this calculated?</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {s.scores.map((a) => {
              const Icon = AREA_ICONS[a.key] ?? Target;
              return (
                <Link key={a.id} href={AREA_HREF[a.key] ?? "/analytics"} className="group rounded-xl border border-border bg-card p-3.5 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${a.color}1f`, color: a.color }}><Icon className="size-4" /></span>
                    <span className="text-sm font-semibold tabular-nums">{a.score === null ? <span className="text-xs font-normal text-muted-foreground">No data</span> : `${Math.round(a.score)}%`}</span>
                  </div>
                  <p className="mt-2 truncate text-xs font-medium">{a.name}</p>
                  <Progress value={a.score} color={a.color} className="mt-2" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {show("today_tasks") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Today&apos;s tasks</CardTitle><CardDescription>Due today and overdue</CardDescription></div>
              <Link href="/tasks" className="text-xs text-primary hover:underline">All tasks</Link>
            </CardHeader>
            <CardContent>
              {todayTasks.length ? (
                <div className="-mx-2">{todayTasks.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} areaName={t.life_area_id ? areaById.get(t.life_area_id)?.name : undefined} />)}</div>
              ) : (
                <EmptyState icon={ListChecks} title="Nothing due today" description="Plan your day from the Tasks page." />
              )}
            </CardContent>
          </Card>
        )}

        {show("today_habits") && (
          <Card>
            <CardHeader>
              <div><CardTitle>Today&apos;s habits</CardTitle><CardDescription>{habitsDone} of {todayHabits.length} completed</CardDescription></div>
              <Link href="/habits" className="text-xs text-primary hover:underline">Habits</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayHabits.length ? (
                todayHabits.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm"><span className="size-2 shrink-0 rounded-full" style={{ background: h.color }} /><span className="truncate">{h.name}</span></span>
                    <HabitCheck habit={h} log={logsToday.get(h.id)} date={today} compact />
                  </div>
                ))
              ) : (
                <EmptyState icon={Repeat} title="No habits scheduled" description="Create habits to build consistency." />
              )}
            </CardContent>
          </Card>
        )}

        {show("deadlines") && (
          <Card>
            <CardHeader><div><CardTitle>Upcoming deadlines</CardTitle><CardDescription>Next 14 days</CardDescription></div></CardHeader>
            <CardContent>
              {deadlines.length ? (
                <ul className="space-y-2">
                  {deadlines.map((d) => (
                    <li key={d.kind + d.id}>
                      <Link href={d.href} className="flex items-center justify-between gap-2 text-sm hover:text-primary">
                        <span className="flex min-w-0 items-center gap-2"><Badge>{d.kind}</Badge><span className="truncate">{d.title}</span></span>
                        <span className="shrink-0 text-xs text-muted-foreground">{relativeDayLabel(d.date, today)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={Flag} title="No upcoming deadlines" />}
            </CardContent>
          </Card>
        )}

        {show("events") && (
          <Card>
            <CardHeader>
              <div><CardTitle>Upcoming events</CardTitle><CardDescription>Next 7 days</CardDescription></div>
              <Link href="/calendar" className="text-xs text-primary hover:underline">Calendar</Link>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length ? (
                <ul className="space-y-2">
                  {upcomingEvents.map((e) => (
                    <li key={e.id + e.occurrence_date} className="flex items-center gap-3 text-sm">
                      <span className="w-1 self-stretch rounded-full" style={{ background: e.color ?? "var(--primary)" }} />
                      <div className="min-w-0">
                        <p className="truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.all_day ? `${relativeDayLabel(e.occurrence_date, today)} · all day` : formatDateTime(e.occurrence_start)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={CalendarDays} title="No events this week" />}
            </CardContent>
          </Card>
        )}

        {show("weekly_goals") && (
          <Card>
            <CardHeader>
              <div><CardTitle>Weekly goals</CardTitle><CardDescription>Active this week</CardDescription></div>
              <Link href="/goals?level=weekly" className="text-xs text-primary hover:underline">Goals</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {weeklyGoals.length ? weeklyGoals.map((g) => {
                const p = s.goalIndex.get(g.id).value;
                return (
                  <Link key={g.id} href={`/goals?open=${g.id}`} className="block">
                    <div className="mb-1 flex justify-between text-sm"><span className="truncate">{g.title}</span><span className="text-xs tabular-nums text-muted-foreground">{formatPct(p)}</span></div>
                    <Progress value={p} color={g.life_area_id ? areaById.get(g.life_area_id)?.color : undefined} />
                  </Link>
                );
              }) : <EmptyState icon={Target} title="No weekly goals" description="Break monthly goals into weekly ones." />}
            </CardContent>
          </Card>
        )}
      </div>

      {show("stats") && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active goals" value={activeGoals.length} hint={`${formatPct(avgGoal)} avg progress · ${overdueGoals} overdue`} icon={Target} />
          <StatCard label="Goals completed" value={completedThisYear} hint={`in ${today.slice(0, 4)}`} icon={CheckCircle2} />
          <StatCard label="Workouts" value={workoutsThisMonth} hint={`${Math.round(studyMinMonth / 6) / 10}h study this month`} icon={Dumbbell} />
          <StatCard label="Net this month" value={formatMoney(fin.net, currency)} hint={fin.savingsRate === null ? "No income recorded" : `${formatPct(fin.savingsRate)} savings rate`} icon={Wallet} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {show("productivity") && (
          <Card>
            <CardHeader><div><CardTitle>Weekly productivity</CardTitle><CardDescription>Tasks and habits completed per day</CardDescription></div></CardHeader>
            <CardContent>
              {hasProductivity ? (
                <BarSeriesChart data={productivity} xKey="day" series={[{ key: "tasks", label: "Tasks" }, { key: "habits", label: "Habits" }]} />
              ) : <EmptyState icon={Activity} title="No activity in the last 7 days" />}
            </CardContent>
          </Card>
        )}
        {show("monthly") && (
          <Card>
            <CardHeader><div><CardTitle>Monthly performance</CardTitle><CardDescription>Task completion rate and habit consistency (%)</CardDescription></div></CardHeader>
            <CardContent>
              {hasMonthly ? (
                <BarSeriesChart data={monthly} xKey="month" unit="%" series={[{ key: "tasks", label: "Task completion" }, { key: "habits", label: "Habit consistency" }]} valueFormat={{ kind: "percent" }} />
              ) : <EmptyState icon={Activity} title="Not enough history yet" description="Complete tasks with due dates and track habits to see monthly trends." />}
            </CardContent>
          </Card>
        )}
      </div>

      {show("activity") && (
        <Card>
          <CardHeader><div><CardTitle>Recent activity</CardTitle></div></CardHeader>
          <CardContent>
            {activity.length ? (
              <ul className="divide-y divide-border">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <a.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={LayoutDashboard} title="No activity yet" description="Your latest actions across all modules appear here." />}
          </CardContent>
        </Card>
      )}
      <p className="sr-only">{DASHBOARD_WIDGETS.length} widgets available</p>
    </div>
  );
}
