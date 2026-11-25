"use client";
import { useMemo, useState } from "react";
import { Plus, Flame, Trophy, Repeat, Archive, ArchiveRestore, Pencil, Moon } from "lucide-react";
import { PageHeader, Badge, EmptyState, StatCard, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { HabitCheck } from "@/components/shared/habit-check";
import { Heatmap } from "@/components/heatmap";
import { WEEKDAYS } from "@/lib/constants";
import { addDaysISO, eachDayISO, formatDate, startOfMonthISO, todayISO, endOfMonthISO, isoFromTimestamp } from "@/lib/dates";
import { consistency, currentStreak, longestStreak, isScheduledOn, aggregateConsistency, isDueToday } from "@/lib/engine/habits";
import { formatPct } from "@/lib/format";
import { useDb } from "@/lib/hooks/use-db";
import { useCreateFromQuery } from "@/lib/hooks/use-create-from-query";
import { cn } from "@/lib/utils";
import { areaOptions } from "@/lib/life-areas";
import type { Habit, HabitLog, LifeArea } from "@/lib/types";

export interface HabitTemplate { name: string; kind: "binary" | "measurable"; unit?: string; target_value: number; frequency: "daily" | "weekly" | "custom"; times_per_week?: number; category?: string }

export function HabitsBoard({ module, title, description, habits, logs, areas, weekStartsOn, defaultAreaKey, templates, categoryLabel = "Category" }: {
  module: "habits" | "religion"; title: string; description: string; habits: Habit[]; logs: HabitLog[]; areas: LifeArea[]; weekStartsOn: number;
  defaultAreaKey?: string; templates?: HabitTemplate[]; categoryLabel?: string;
}) {
  const today = todayISO();
  const icon = module === "religion" ? Moon : Repeat;
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [category, setCategory] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const form = useFormState<Habit>();
  const db = useDb();
  const logsByHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const l of logs) m.set(l.habit_id, [...(m.get(l.habit_id) ?? []), l]);
    return m;
  }, [logs]);
  const defaultArea = areas.find((a) => a.key === defaultAreaKey)?.id ?? null;

  const active = habits.filter((h) => !h.archived_at);
  const categories = [...new Set(habits.map((h) => h.category).filter(Boolean))] as string[];
  const shown = (tab === "active" ? active : habits.filter((h) => h.archived_at)).filter((h) => category === "all" || h.category === category);
  const days = eachDayISO(addDaysISO(today, -6), today);

  const dueToday = active.filter((h) => isDueToday(h, today, logs, weekStartsOn));
  const doneToday = dueToday.filter((h) => logsByHabit.get(h.id)?.some((l) => l.log_date === today && l.completed)).length;
  const weekC = aggregateConsistency(active, logs, addDaysISO(today, -6), today, today, weekStartsOn);
  const monthC = aggregateConsistency(active, logs, startOfMonthISO(today), endOfMonthISO(today), today, weekStartsOn);
  const bestStreak = Math.max(0, ...active.map((h) => currentStreak(h, logsByHabit.get(h.id) ?? [], today, weekStartsOn)));

  const fields: Field[] = [
    { name: "name", label: "Name", required: true, full: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "binary", label: "Yes / No" }, { value: "measurable", label: "Measurable (quantity, duration…)" }] },
    { name: "unit", label: "Unit", placeholder: "pages, minutes, glasses…", showIf: (v) => v.kind === "measurable" },
    { name: "target_value", label: "Daily target", type: "number", min: 0.01, required: true, showIf: (v) => v.kind === "measurable" },
    { name: "frequency", label: "Frequency", type: "select", required: true, options: [{ value: "daily", label: "Every day" }, { value: "weekly", label: "N times per week" }, { value: "custom", label: "Specific days" }] },
    { name: "times_per_week", label: "Times per week", type: "number", min: 1, max: 7, required: true, showIf: (v) => v.frequency === "weekly" },
    { name: "days_of_week", label: "Days (0=Sun … 6=Sat)", type: "tags", placeholder: "1, 3, 5", showIf: (v) => v.frequency === "custom", help: "Comma-separated day numbers" },
    { name: "category", label: categoryLabel },
    { name: "life_area_id", label: "Life area", type: "select", options: areaOptions(areas, form.record?.life_area_id ?? (form.defaults?.life_area_id as string | undefined)) },
    { name: "start_date", label: "Start date", type: "date", required: true, help: "Days before this are not counted" },
    { name: "color", label: "Color", type: "color" },
  ];

  const detail = detailId ? habits.find((h) => h.id === detailId) : null;
  useCreateFromQuery(["habit"], () => form.create({ kind: "binary", target_value: 1, frequency: "daily", times_per_week: 3, start_date: today, color: module === "religion" ? "#14b8a6" : "#10b981", life_area_id: defaultArea }));

  async function addTemplate(t: HabitTemplate) {
    await db.insert("habits", {
      module, name: t.name, kind: t.kind, unit: t.unit ?? null, target_value: t.target_value, frequency: t.frequency,
      times_per_week: t.times_per_week ?? 1, category: t.category ?? null, life_area_id: defaultArea, start_date: today,
    }, `Added “${t.name}”`);
  }

  return (
    <div>
      <PageHeader title={title} description={description} icon={icon}
        actions={<Button onClick={() => form.create({ kind: "binary", target_value: 1, frequency: "daily", times_per_week: 3, start_date: today, color: module === "religion" ? "#14b8a6" : "#10b981", life_area_id: defaultArea })}><Plus /> New {module === "religion" ? "practice" : "habit"}</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={`${doneToday}/${dueToday.length}`} hint="scheduled completed" icon={Repeat} />
        <StatCard label="This week" value={formatPct(weekC.rate)} hint={`${weekC.done} of ${weekC.expected} check-ins`} />
        <StatCard label="This month" value={formatPct(monthC.rate)} hint={`${monthC.done} of ${monthC.expected} check-ins`} />
        <StatCard label="Best current streak" value={bestStreak} hint="periods in a row" icon={Flame} tone="#f97316" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: "active", label: "Active", count: active.length }, { value: "archived", label: "Archived", count: habits.length - active.length }]} />
        {categories.length > 0 && (
          <Tabs value={category} onChange={setCategory} items={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        )}
      </div>

      {shown.length === 0 ? (
        <div className="space-y-4">
          <EmptyState icon={icon} title={tab === "archived" ? "No archived items" : `No ${module === "religion" ? "practices" : "habits"} yet`}
            description={module === "religion" ? "Add the practices you want to track and set your own targets — nothing is imposed." : "Start small: one or two habits you can do every day."} />
          {tab === "active" && templates && templates.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Quick start (optional)</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {templates.map((t) => <Button key={t.name} size="sm" variant="outline" onClick={() => addTemplate(t)}><Plus /> {t.name}</Button>)}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">{module === "religion" ? "Practice" : "Habit"}</th>
                {days.map((d) => <th key={d} className={cn("w-11 px-1 py-2 text-center font-medium", d === today && "text-foreground")}>{formatDate(d, { weekday: "narrow" })}<br /><span className="font-normal">{d.slice(8)}</span></th>)}
                <th className="px-2 py-2 text-center font-medium">Streak</th>
                <th className="px-4 py-2 text-right font-medium">30-day</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((h) => {
                const hl = logsByHabit.get(h.id) ?? [];
                const byDate = new Map(hl.map((l) => [l.log_date, l]));
                const streak = currentStreak(h, hl, today, weekStartsOn);
                const c30 = consistency(h, hl, addDaysISO(today, -29), today, today, weekStartsOn);
                return (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <button onClick={() => setDetailId(h.id)} className="text-left">
                        <span className="flex items-center gap-2 font-medium"><span className="size-2 rounded-full" style={{ background: h.color }} />{h.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {h.frequency === "daily" ? "Daily" : h.frequency === "weekly" ? `${h.times_per_week}× / week` : h.days_of_week.map((d) => WEEKDAYS[d]).join(", ")}
                          {h.kind === "measurable" && ` · ${Number(h.target_value)} ${h.unit ?? ""}`}
                          {h.category && ` · ${h.category}`}
                        </span>
                      </button>
                    </td>
                    {days.map((d) => (
                      <td key={d} className="px-1 py-2 text-center">
                        {h.kind === "binary" ? (
                          isScheduledOn(h, d) || h.frequency === "weekly" ? <div className="flex justify-center"><HabitCheck habit={h} log={byDate.get(d)} date={d} /></div> : <span className="text-muted-foreground/40">·</span>
                        ) : (
                          <MeasurableCell habit={h} log={byDate.get(d)} date={d} />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center"><span className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"><Flame className={cn("size-3.5", streak ? "text-orange-500" : "text-muted-foreground")} />{streak}</span></td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">{formatPct(c30.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <EntityForm table="habits" title={form.record ? "Edit" : "New"} description="Editing settings never changes past check-ins." fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults}
        extra={{ module }}
        transform={(v) => ({
          ...v,
          target_value: v.kind === "binary" ? 1 : v.target_value,
          days_of_week: Array.isArray(v.days_of_week) ? (v.days_of_week as string[]).map(Number).filter((n) => n >= 0 && n <= 6) : [],
          frequency: v.frequency === "custom" && !(v.days_of_week as string[])?.length ? "daily" : v.frequency,
        })} />

      {detail && <HabitDetail habit={detail} logs={logsByHabit.get(detail.id) ?? []} weekStartsOn={weekStartsOn} onClose={() => setDetailId(null)} onEdit={() => { form.edit(detail); setDetailId(null); }} />}
    </div>
  );
}

function MeasurableCell({ habit, log, date }: { habit: Habit; log?: HabitLog; date: string }) {
  const [open, setOpen] = useState(false);
  const scheduled = isScheduledOn(habit, date) || habit.frequency === "weekly";
  if (!scheduled) return <span className="text-muted-foreground/40">·</span>;
  const pct = log ? Math.min(1, Number(log.value) / Number(log.target_value)) : 0;
  return (
    <>
      <button onClick={() => setOpen(true)} className="mx-auto grid size-8 place-items-center rounded-lg border-2 text-[10px] font-semibold tabular-nums"
        style={{ borderColor: log ? habit.color : "var(--border)", background: log?.completed ? habit.color : pct ? `${habit.color}33` : undefined, color: log?.completed ? "white" : undefined }}
        title={log ? `${Number(log.value)} / ${Number(log.target_value)} ${habit.unit ?? ""}` : "Log value"}>
        {log ? Number(log.value) : ""}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={habit.name} description={formatDate(date, { weekday: "long", month: "long", day: "numeric" })}>
        <div className="flex flex-col items-center gap-3 py-2">
          <HabitCheck habit={habit} log={log} date={date} />
          <p className="text-xs text-muted-foreground">Target: {log ? Number(log.target_value) : Number(habit.target_value)} {habit.unit}</p>
        </div>
      </Dialog>
    </>
  );
}

function HabitDetail({ habit, logs, weekStartsOn, onClose, onEdit }: { habit: Habit; logs: HabitLog[]; weekStartsOn: number; onClose: () => void; onEdit: () => void }) {
  const db = useDb();
  const today = todayISO();
  const [note, setNote] = useState("");
  const values: Record<string, number> = {};
  for (const l of logs) if (l.completed) values[l.log_date] = habit.kind === "binary" ? 1 : Number(l.value);
  const c30 = consistency(habit, logs, addDaysISO(today, -29), today, today, weekStartsOn);
  const c7 = consistency(habit, logs, addDaysISO(today, -6), today, today, weekStartsOn);
  const todayLog = logs.find((l) => l.log_date === today);
  return (
    <Dialog open onClose={onClose} title={habit.name} description={habit.description ?? undefined} className="w-[min(100vw-1.5rem,42rem)]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Current streak" value={currentStreak(habit, logs, today, weekStartsOn)} icon={Flame} tone="#f97316" />
          <StatCard label="Longest streak" value={longestStreak(habit, logs, today, weekStartsOn)} icon={Trophy} tone="#eab308" />
          <StatCard label="7-day" value={formatPct(c7.rate)} hint={`${c7.done}/${c7.expected}`} />
          <StatCard label="30-day" value={formatPct(c30.rate)} hint={`${c30.done}/${c30.expected}`} />
        </div>
        {habit.kind === "measurable" && (
          <p className="text-xs text-muted-foreground">
            Total logged (last 400 days): <span className="font-semibold text-foreground tabular-nums">{logs.reduce((a, l) => a + Number(l.value), 0)} {habit.unit}</span>
            {" · "}This month: <span className="font-semibold text-foreground tabular-nums">{logs.filter((l) => l.log_date >= startOfMonthISO(today)).reduce((a, l) => a + Number(l.value), 0)} {habit.unit}</span>
          </p>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Last 26 weeks</p>
          <Heatmap values={values} to={today} weeks={26} color={habit.color} label={habit.kind === "binary" ? "done" : habit.unit ?? "units"} />
        </div>
        <div>
          <Label>Note for today</Label>
          <form className="mt-1 flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            await db.run(() => db.supabase.from("habit_logs").upsert({ habit_id: habit.id, log_date: today, value: todayLog ? Number(todayLog.value) : 0, target_value: todayLog ? Number(todayLog.target_value) : Number(habit.target_value), note: note.trim() }, { onConflict: "habit_id,log_date" }), "Note saved");
            setNote("");
          }}>
            <Input placeholder={todayLog?.note ?? "How did it go?"} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" variant="outline" className="h-9">Save</Button>
          </form>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">History</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {[...logs].reverse().slice(0, 60).map((l) => (
              <li key={l.id} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                <span>{formatDate(l.log_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}{l.note && <span className="text-muted-foreground"> — {l.note}</span>}</span>
                <span className="tabular-nums">{habit.kind === "binary" ? (l.completed ? "✓" : "—") : `${Number(l.value)}/${Number(l.target_value)} ${habit.unit ?? ""}`}</span>
              </li>
            ))}
            {!logs.length && <li className="text-muted-foreground">No check-ins yet.</li>}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={async () => { await db.update("habits", habit.id, { archived_at: habit.archived_at ? null : new Date().toISOString() }, habit.archived_at ? "Restored" : "Archived — history kept"); onClose(); }}>
            {habit.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
          </Button>
          <Button variant="outline" onClick={onEdit}><Pencil /> Edit settings</Button>
        </div>
        {habit.archived_at && <Badge>Archived {formatDate(isoFromTimestamp(habit.archived_at))}</Badge>}
      </div>
    </Dialog>
  );
}
