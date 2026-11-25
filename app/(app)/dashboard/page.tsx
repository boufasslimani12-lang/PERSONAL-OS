import Link from "next/link";
import {
  ListChecks, Repeat, CalendarDays, Target, Activity, Dumbbell, GraduationCap, Languages, Code2, Users,
  Briefcase, Moon, Wallet, Sprout, NotebookPen, Flame, ChevronRight, Plus, PenLine, type LucideIcon,
} from "lucide-react";
import { loadLifeSnapshot, SCORE_WINDOW_DAYS } from "@/lib/server/snapshot";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, EmptyState, Progress, ProgressRing } from "@/components/ui/misc";
import { TaskCheck } from "@/components/shared/task-row";
import { HabitCheck } from "@/components/shared/habit-check";
import { BarSeriesChart } from "@/components/charts";
import { CustomizeDashboard } from "./customize";
import { addDaysISO, eachDayISO, formatDate, formatTime, relativeDayLabel } from "@/lib/dates";
import { isDueToday, currentStreak } from "@/lib/engine/habits";
import { expandEvents, eventRangeFilter, eventRangeUpperBound } from "@/lib/engine/calendar";
import { dailyFocus, dailySubtitle, greeting, sortUpcoming, todayTaskSummary, type Upcoming } from "@/lib/engine/dashboard";
import { PRIORITIES, optionLabel, optionTone } from "@/lib/constants";
import { AREA_HREF } from "@/lib/life-areas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const AREA_ICONS: Record<string, LucideIcon> = {
  health: Dumbbell, education: GraduationCap, languages: Languages, hard_skills: Code2, soft_skills: Users,
  career: Briefcase, religion: Moon, finance: Wallet, growth: Sprout, mind: NotebookPen,
};

const QUICK_ACTIONS = [
  { href: "/tasks?new=task", label: "Task", icon: ListChecks },
  { href: "/habits?new=habit", label: "Habit", icon: Repeat },
  { href: "/goals?new=goal", label: "Goal", icon: Target },
  { href: "/journal?new=daily", label: "Journal", icon: PenLine },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export default async function DashboardPage() {
  const s = await loadLifeSnapshot();
  const { supabase, today, dates } = s;
  const hidden = new Set<string>(Array.isArray(s.profile?.dashboard_widgets) ? (s.profile!.dashboard_widgets as string[]) : []);
  const show = (k: string) => !hidden.has(k);
  const in7 = addDaysISO(today, 7);
  const in14 = addDaysISO(today, 14);

  const [events, assessments, projects] = await Promise.all([
    supabase.from("events").select("*").lte("start_at", eventRangeUpperBound(in7)).or(eventRangeFilter(today)),
    supabase.from("assessments").select("id,title,due_date,kind").eq("status", "pending").gte("due_date", today).lte("due_date", in14),
    supabase.from("projects").select("id,title,due_date").is("archived_at", null).not("status", "in", "(completed,cancelled)").gte("due_date", today).lte("due_date", in14),
  ]);

  const areaById = new Map(s.areas.map((a) => [a.id, a]));

  // B. Daily overview
  const taskSummary = todayTaskSummary(s.tasks, s.completions, today, dates.dateOf);
  const todayHabits = s.habits.filter((h) => isDueToday(h, today, s.habitLogs, s.weekStartsOn));
  const logsToday = new Map(s.habitLogs.filter((l) => l.log_date === today).map((l) => [l.habit_id, l]));
  const habitsDone = todayHabits.filter((h) => logsToday.get(h.id)?.completed).length;
  const activeGoals = s.goals.filter((g) => g.status === "active" || g.status === "not_started");
  const goalsDueSoon = activeGoals.filter((g) => g.target_date && g.target_date >= today && g.target_date <= in14).length;

  // C. Daily focus
  const focus = dailyFocus(s.tasks, today, dates.dateOf, 3);

  // D. Habit streaks (only shown when the streak is real, i.e. > 0)
  const logsByHabit = new Map<string, typeof s.habitLogs>();
  for (const l of s.habitLogs) logsByHabit.set(l.habit_id, [...(logsByHabit.get(l.habit_id) ?? []), l]);

  // F. Weekly productivity — last 7 days, real completions only
  const week = eachDayISO(addDaysISO(today, -6), today);
  const productivity = week.map((d) => ({
    day: formatDate(d, { weekday: "short" }),
    tasks: s.completions.filter((c) => dates.dateOf(c.completed_at) === d).length,
    habits: s.habitLogs.filter((l) => l.log_date === d && l.completed).length,
  }));
  const hasProductivity = productivity.some((p) => p.tasks || p.habits);

  // G. Upcoming — events, deadlines and scheduled activities, chronological
  const upcoming = sortUpcoming<Upcoming & { color?: string }>([
    ...expandEvents(events.data ?? [], today, in7, s.tz).map((e) => ({
      kind: e.kind === "reminder" ? "Reminder" : e.kind === "deadline" ? "Deadline" : "Event", title: e.title, date: e.occurrence_date,
      time: e.all_day ? null : formatTime(e.occurrence_start, s.tz), href: "/calendar?view=agenda", key: `e-${e.id}-${e.occurrence_date}`, color: e.color ?? undefined,
    })),
    ...s.tasks.filter((t) => !t.parent_task_id && t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date > today && t.due_date <= in7)
      .map((t) => ({ kind: "Task", title: t.title, date: t.due_date!, time: t.due_time?.slice(0, 5) ?? null, href: "/tasks?view=upcoming", key: `t-${t.id}` })),
    ...s.goals.filter((g) => g.target_date && g.target_date >= today && g.target_date <= in14 && !["completed", "cancelled"].includes(g.status))
      .map((g) => ({ kind: "Goal", title: g.title, date: g.target_date!, time: null, href: `/goals?open=${g.id}`, key: `g-${g.id}` })),
    ...(assessments.data ?? []).map((a) => ({ kind: a.kind === "exam" ? "Exam" : "Assignment", title: a.title, date: a.due_date!, time: null, href: "/education", key: `a-${a.id}` })),
    ...(projects.data ?? []).map((p) => ({ kind: "Project", title: p.title, date: p.due_date!, time: null, href: "/tasks?view=projects", key: `p-${p.id}` })),
  ]).slice(0, 7);

  const name = s.profile?.display_name?.trim() || "there";

  return (
    <div className="space-y-6">
      {/* A. Welcome header + H. Quick actions */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6" aria-label="Today">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{formatDate(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{greeting(dates.hour)}, {name}.</h1>
            <p className="text-sm text-muted-foreground">{dailySubtitle(today)}</p>
            <p className="pt-1 text-sm">
              <span className="font-medium tabular-nums">{taskSummary.done}/{taskSummary.total}</span> <span className="text-muted-foreground">tasks</span>
              <span className="mx-2 text-border">•</span>
              <span className="font-medium tabular-nums">{habitsDone}/{todayHabits.length}</span> <span className="text-muted-foreground">habits done today</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium">Life progress</p>
              <p className="max-w-40 text-[11px] leading-snug text-muted-foreground">
                {s.overall.coverage ? `${s.overall.coverage} of ${s.overall.total} areas with data · ${SCORE_WINDOW_DAYS} days` : "No tracked data yet"}
              </p>
            </div>
            <ProgressRing value={s.overall.value} size={68} stroke={6} />
            <CustomizeDashboard hidden={[...hidden]} />
          </div>
        </div>
        {show("quick") && (
          <nav className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4" aria-label="Quick actions">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground">
                {a.href.includes("new=") ? <Plus className="size-3.5" /> : <a.icon className="size-3.5" />}
                {a.href.includes("new=") ? a.label : `Open ${a.label}`}
              </Link>
            ))}
          </nav>
        )}
      </section>

      {/* B. Daily overview */}
      {show("overview") && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Daily overview">
          <Kpi href="/tasks" icon={ListChecks} label="Tasks completed" value={`${taskSummary.done}/${taskSummary.total}`}
            hint={taskSummary.total ? `${taskSummary.total - taskSummary.done} left today` : "Nothing due today"} alert={taskSummary.overdue ? `${taskSummary.overdue} overdue` : undefined} />
          <Kpi href="/habits" icon={Repeat} label="Habits completed" value={`${habitsDone}/${todayHabits.length}`}
            hint={todayHabits.length ? (habitsDone === todayHabits.length ? "All done for today" : `${todayHabits.length - habitsDone} to go`) : "No habits scheduled"} />
          <Kpi href="/goals" icon={Target} label="Active goals" value={String(activeGoals.length)}
            hint={goalsDueSoon ? `${goalsDueSoon} due in the next 14 days` : activeGoals.length ? "No deadlines in the next 14 days" : "Set your first goal"} />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* C. Daily focus */}
        {show("focus") && (
          <Card className="lg:col-span-2" role="region" aria-label="Daily focus">
            <CardHeader>
              <div><CardTitle>Daily focus</CardTitle><CardDescription>Your top priorities for today</CardDescription></div>
              <Link href="/tasks" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">All tasks <ChevronRight className="size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {focus.length ? (
                <ul className="divide-y divide-border">
                  {focus.map((t) => {
                    const area = t.life_area_id ? areaById.get(t.life_area_id) : undefined;
                    const overdue = t.status !== "done" && t.due_date && t.due_date < today;
                    return (
                      <li key={t.id} className="flex items-center gap-3 py-2.5">
                        <TaskCheck task={t} />
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            {t.status === "done" ? <span className="text-success">Completed</span>
                              : t.due_date ? <span className={cn(overdue && "font-medium text-destructive")}>{relativeDayLabel(t.due_date, today)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}</span>
                              : <span>No due date</span>}
                            {area && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: area.color }} />{area.name}</span>}
                          </p>
                        </div>
                        <Badge tone={optionTone(PRIORITIES, t.priority)}>{optionLabel(PRIORITIES, t.priority)}</Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={ListChecks} title="No priorities for today" description="Tasks due today, overdue tasks and high-priority tasks without a date appear here."
                  action={<Link href="/tasks?new=task" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"><Plus className="size-3.5" /> Create a task</Link>} />
              )}
            </CardContent>
          </Card>
        )}

        {/* D. Today's habits */}
        {show("habits") && (
          <Card role="region" aria-label="Today's habits">
            <CardHeader>
              <div><CardTitle>Today&apos;s habits</CardTitle><CardDescription>{todayHabits.length ? `${habitsDone} of ${todayHabits.length} done` : "Nothing scheduled"}</CardDescription></div>
              <Link href="/habits" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">Habits <ChevronRight className="size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {todayHabits.length ? (
                <ul className="space-y-1">
                  {todayHabits.map((h) => {
                    const log = logsToday.get(h.id);
                    const streak = currentStreak(h, logsByHabit.get(h.id) ?? [], today, s.weekStartsOn);
                    return (
                      <li key={h.id} className="flex items-center gap-3 rounded-lg py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm", log?.completed && "text-muted-foreground")}>{h.name}</p>
                          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{log?.completed ? "Done" : h.kind === "measurable" ? `${log ? Number(log.value) : 0}/${Number(h.target_value)} ${h.unit ?? ""}` : "Not done yet"}</span>
                            {streak > 0 && <span className="inline-flex items-center gap-0.5" title={`${streak}-${h.frequency === "weekly" ? "week" : "day"} streak`}><Flame className="size-3 text-orange-500" />{streak}</span>}
                          </p>
                        </div>
                        <HabitCheck habit={h} log={log} date={today} compact />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={Repeat} title="No habits today" description="Build routines that show up here every day."
                  action={<Link href="/habits?new=habit" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"><Plus className="size-3.5" /> Add a habit</Link>} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* E. Life areas (active only — same scores as Analytics) */}
      {show("areas") && (
        <section aria-labelledby="areas-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="areas-heading" className="text-sm font-semibold">Life areas</h2>
            <Link href="/analytics" className="text-xs text-muted-foreground hover:text-primary">How is this calculated?</Link>
          </div>
          {s.scores.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {s.scores.map((a) => {
                const Icon = AREA_ICONS[a.key] ?? Target;
                return (
                  <Link key={a.id} href={AREA_HREF[a.key] ?? "/analytics"} className="group rounded-xl border border-border bg-card p-3.5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${a.color}1a`, color: a.color }}><Icon className="size-4" /></span>
                      <span className="text-sm font-semibold tabular-nums">{a.score === null ? <span className="text-[11px] font-normal text-muted-foreground">No data</span> : `${Math.round(a.score)}%`}</span>
                    </div>
                    <p className="mt-2.5 truncate text-xs font-medium">{a.name}</p>
                    <Progress value={a.score} color={a.color} className="mt-2" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Target} title="All life areas are inactive" description="Turn areas back on in Settings to see their progress." action={<Link href="/settings#life-areas" className="text-xs font-medium text-primary hover:underline">Open Settings</Link>} />
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* F. Weekly productivity */}
        {show("productivity") && (
          <Card className="lg:col-span-2" role="region" aria-label="Weekly productivity">
            <CardHeader><div><CardTitle>Weekly productivity</CardTitle><CardDescription>Tasks and habits completed per day, last 7 days</CardDescription></div></CardHeader>
            <CardContent>
              {hasProductivity
                ? <BarSeriesChart data={productivity} xKey="day" height={200} series={[{ key: "tasks", label: "Tasks" }, { key: "habits", label: "Habits" }]} />
                : <EmptyState icon={Activity} title="No completions in the last 7 days" description="Complete a task or check in a habit and it shows up here." />}
            </CardContent>
          </Card>
        )}

        {/* G. Upcoming */}
        {show("upcoming") && (
          <Card role="region" aria-label="Upcoming">
            <CardHeader>
              <div><CardTitle>Upcoming</CardTitle><CardDescription>Events and deadlines ahead</CardDescription></div>
              <Link href="/calendar?view=agenda" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">Calendar <ChevronRight className="size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="space-y-2.5">
                  {upcoming.map((u) => (
                    <li key={u.key}>
                      <Link href={u.href} className="flex items-center gap-3 text-sm hover:text-primary">
                        <span className="w-11 shrink-0 text-center leading-tight">
                          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{formatDate(u.date, { weekday: "short" })}</span>
                          <span className="block text-sm font-semibold tabular-nums">{Number(u.date.slice(8))}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{u.title}</span>
                          <span className="block text-[11px] text-muted-foreground">{u.kind} · {u.date === today ? "Today" : relativeDayLabel(u.date, today)}{u.time ? ` · ${u.time}` : ""}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={CalendarDays} title="Nothing coming up" description="Events in the next 7 days and deadlines in the next 14 appear here." />}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({ href, icon: Icon, label, value, hint, alert }: { href: string; icon: LucideIcon; label: string; value: string; hint: string; alert?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block text-xl font-semibold tabular-nums tracking-tight">{value}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{hint}{alert && <span className="font-medium text-destructive"> · {alert}</span>}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
