"use client";
import { useMemo, useState } from "react";
import { Dumbbell, Plus, Play, Pencil, Trophy, Scale, Activity, Timer, ListOrdered, Trash2 } from "lucide-react";
import { PageHeader, Tabs, StatCard, EmptyState, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { BarSeriesChart, LineSeriesChart } from "@/components/charts";
import { useDb } from "@/lib/hooks/use-db";
import { addDaysISO, formatDate, formatDateTime, formatMinutes, startOfWeekISO, todayISO } from "@/lib/dates";
import { personalRecords, totalVolume, bmi, estimated1RM } from "@/lib/engine/fitness";
import { formatNumber } from "@/lib/format";
import type { Row } from "@/lib/types";
import { WorkoutLogger } from "./workout-logger";

type Tab = "overview" | "workouts" | "programs" | "exercises" | "body";
const CATEGORIES = ["strength", "cardio", "mobility", "bodyweight", "sport", "other"].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }));

export function FitnessView({ exercises, templates, templateExercises, workouts, sets, metrics }: {
  exercises: Row<"exercises">[]; templates: Row<"workout_templates">[]; templateExercises: Row<"workout_template_exercises">[];
  workouts: Row<"workouts">[]; sets: Row<"workout_sets">[]; metrics: Row<"body_metrics">[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const db = useDb();
  const today = todayISO();
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const active = workouts.find((w) => !w.ended_at);
  const exForm = useFormState<Row<"exercises">>();
  const tplForm = useFormState<Row<"workout_templates">>();
  const metricForm = useFormState<Row<"body_metrics">>();
  const [exFilter, setExFilter] = useState("");

  async function start(template?: Row<"workout_templates">) {
    if (active) return setTab("workouts");
    const { data, error } = await db.supabase.from("workouts").insert({ name: template?.name ?? "Workout", template_id: template?.id ?? null }).select().single();
    if (error) return db.toast(error.message, "error");
    if (template) {
      const tes = templateExercises.filter((t) => t.template_id === template.id);
      const rows = tes.flatMap((te) => Array.from({ length: te.target_sets }, (_, i) => ({
        workout_id: data.id, exercise_id: te.exercise_id, set_number: i + 1, weight: te.target_weight, reps: parseInt(te.target_reps) || null, rest_seconds: te.rest_seconds, completed: false,
      })));
      if (rows.length) await db.supabase.from("workout_sets").insert(rows);
    }
    db.toast("Workout started");
    db.refresh();
    setTab("workouts");
  }

  // Stats
  const finished = workouts.filter((w) => w.ended_at);
  const weeks = Array.from({ length: 12 }, (_, i) => startOfWeekISO(addDaysISO(today, -7 * (11 - i))));
  const freq = weeks.map((w) => {
    const ws = finished.filter((x) => x.started_at.slice(0, 10) >= w && x.started_at.slice(0, 10) < addDaysISO(w, 7));
    return { week: formatDate(w), workouts: ws.length, volume: Math.round(totalVolume(sets.filter((s) => ws.some((x) => x.id === s.workout_id)))) };
  });
  const thisWeek = freq[freq.length - 1].workouts;
  const prs = personalRecords(sets);
  const latest = [...metrics].reverse().find((m) => m.weight_kg);
  const latestHeight = [...metrics].reverse().find((m) => m.height_cm)?.height_cm ?? null;
  const weightSeries = metrics.filter((m) => m.weight_kg).map((m) => ({ date: formatDate(m.measured_on), weight: Number(m.weight_kg) }));
  const avgDuration = finished.length ? finished.reduce((a, w) => a + (new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime()) / 60000, 0) / finished.length : 0;

  const exFields: Field[] = [
    { name: "name", label: "Name", required: true, full: true },
    { name: "category", label: "Category", type: "select", required: true, options: CATEGORIES },
    { name: "muscle_group", label: "Muscle group" },
    { name: "equipment", label: "Equipment" },
    { name: "instructions", label: "Instructions", type: "textarea" },
  ];
  const tplFields: Field[] = [
    { name: "name", label: "Workout name", required: true, placeholder: "e.g. Push A" },
    { name: "split_name", label: "Training split", placeholder: "e.g. Push/Pull/Legs" },
    { name: "description", label: "Description", type: "textarea" },
  ];
  const metricFields: Field[] = [
    { name: "measured_on", label: "Date", type: "date", required: true },
    { name: "weight_kg", label: "Weight (kg)", type: "number", min: 1 },
    { name: "height_cm", label: "Height (cm)", type: "number", min: 1 },
    { name: "body_fat_pct", label: "Body fat (%)", type: "number", min: 0, max: 100 },
    { name: "waist_cm", label: "Waist (cm)", type: "number", min: 0 },
    { name: "chest_cm", label: "Chest (cm)", type: "number", min: 0 },
    { name: "arm_cm", label: "Arm (cm)", type: "number", min: 0 },
    { name: "thigh_cm", label: "Thigh (cm)", type: "number", min: 0 },
    { name: "hips_cm", label: "Hips (cm)", type: "number", min: 0 },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Fitness & Health" icon={Dumbbell} description="Programs, workouts, progress and body metrics"
        actions={active ? <Button onClick={() => setTab("workouts")}><Timer /> Resume workout</Button> : <Button onClick={() => start()}><Play /> Start empty workout</Button>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[
        { value: "overview", label: "Overview" }, { value: "workouts", label: "Workouts", count: workouts.length }, { value: "programs", label: "Programs", count: templates.length },
        { value: "exercises", label: "Exercises", count: exercises.length }, { value: "body", label: "Body metrics" },
      ]} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="This week" value={thisWeek} hint="workouts" icon={Activity} />
            <StatCard label="Total (12 months)" value={finished.length} hint={`avg ${formatMinutes(Math.round(avgDuration))}`} icon={Dumbbell} />
            <StatCard label="Body weight" value={latest ? `${Number(latest.weight_kg)} kg` : "—"} hint={latest ? formatDate(latest.measured_on) : "Log a measurement"} icon={Scale} />
            <StatCard label="BMI" value={bmi(latest ? Number(latest.weight_kg) : null, latestHeight ? Number(latestHeight) : null)?.toFixed(1) ?? "—"} hint={latestHeight ? `${Number(latestHeight)} cm` : "Add height"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Weekly workout frequency</CardTitle><CardDescription>Last 12 weeks</CardDescription></div></CardHeader>
              <CardContent>{finished.length ? <BarSeriesChart data={freq} xKey="week" series={[{ key: "workouts", label: "Workouts" }]} /> : <EmptyState icon={Activity} title="No workouts logged yet" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Training volume</CardTitle><CardDescription>Σ reps × weight per week (kg)</CardDescription></div></CardHeader>
              <CardContent>{freq.some((f) => f.volume) ? <BarSeriesChart data={freq} xKey="week" series={[{ key: "volume", label: "Volume", color: "var(--series-3)" }]} format={(v) => `${formatNumber(v)} kg`} /> : <EmptyState icon={Activity} title="Log weighted sets to see volume" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Body weight</CardTitle></div></CardHeader>
              <CardContent>{weightSeries.length > 1 ? <LineSeriesChart data={weightSeries} xKey="date" area series={[{ key: "weight", label: "Weight (kg)" }]} format={(v) => `${v} kg`} /> : <EmptyState icon={Scale} title="Log at least two weigh-ins" action={<Button size="sm" variant="outline" onClick={() => { setTab("body"); metricForm.create({ measured_on: today, height_cm: latestHeight }); }}><Plus /> Log weight</Button>} />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Personal records</CardTitle><CardDescription>Best weight and estimated 1RM (Epley)</CardDescription></div></CardHeader>
              <CardContent>
                {prs.size ? (
                  <ul className="divide-y divide-border text-sm">
                    {[...prs.values()].filter((p) => p.maxWeight > 0 || p.maxReps > 0).sort((a, b) => b.best1RM - a.best1RM).slice(0, 8).map((p) => (
                      <li key={p.exercise_id} className="flex items-center justify-between py-1.5">
                        <span className="flex items-center gap-2"><Trophy className="size-3.5 text-amber-500" />{exById.get(p.exercise_id)?.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{p.maxWeight ? `${p.maxWeight} kg · e1RM ${Math.round(p.best1RM)} kg` : `${p.maxReps} reps`}</span>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState icon={Trophy} title="No records yet" />}
              </CardContent>
            </Card>
          </div>
          <ExerciseProgression exercises={exercises} sets={sets} workouts={workouts} />
        </div>
      )}

      {tab === "workouts" && (
        <div className="space-y-4">
          {active && <WorkoutLogger workout={active} sets={sets.filter((s) => s.workout_id === active.id)} exercises={exercises} />}
          {!active && templates.length > 0 && (
            <Card><CardHeader><CardTitle>Start from a program</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">{templates.map((t) => <Button key={t.id} variant="outline" size="sm" onClick={() => start(t)}><Play /> {t.name}</Button>)}</CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              {finished.length ? (
                <ul className="divide-y divide-border">
                  {finished.map((w) => {
                    const ws = sets.filter((s) => s.workout_id === w.id && s.completed);
                    const names = [...new Set(ws.map((s) => exById.get(s.exercise_id)?.name))].filter(Boolean);
                    return (
                      <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{w.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{formatDateTime(w.started_at)} · {formatMinutes(Math.round((new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime()) / 60000))} · {ws.length} sets · {formatNumber(totalVolume(ws))} kg{names.length ? ` · ${names.join(", ")}` : ""}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => db.update("workouts", w.id, { ended_at: null }, "Workout reopened for editing")}><Pencil /> Edit</Button>
                          <Button size="icon" variant="ghost" onClick={() => confirm("Delete this workout?") && db.remove("workouts", w.id)} aria-label="Delete workout"><Trash2 /></Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState icon={Dumbbell} title="No completed workouts" description="Start a workout to begin logging sets." />}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "programs" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => tplForm.create({})}><Plus /> New workout template</Button></div>
          {templates.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(templates.reduce<Record<string, Row<"workout_templates">[]>>((acc, t) => { (acc[t.split_name || "Unassigned split"] ||= []).push(t); return acc; }, {})).map(([split, ts]) => (
                <div key={split} className="space-y-3 md:col-span-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{split}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {ts.map((t) => <TemplateCard key={t.id} template={t} items={templateExercises.filter((x) => x.template_id === t.id)} exercises={exercises} onEdit={() => tplForm.edit(t)} onStart={() => start(t)} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={ListOrdered} title="Build your own program" description="Create workout templates (e.g. Push / Pull / Legs) with target sets, reps, weight and rest." />}
        </div>
      )}

      {tab === "exercises" && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-2">
            <Input placeholder="Filter exercises…" value={exFilter} onChange={(e) => setExFilter(e.target.value)} className="max-w-xs" />
            <Button onClick={() => exForm.create({ category: "strength" })}><Plus /> New exercise</Button>
          </div>
          <Card className="divide-y divide-border">
            {exercises.filter((e) => !exFilter || (e.name + e.muscle_group + e.equipment).toLowerCase().includes(exFilter.toLowerCase())).map((e) => (
              <button key={e.id} onClick={() => exForm.edit(e)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/40">
                <div><p className="text-sm font-medium">{e.name}</p>{e.instructions && <p className="line-clamp-1 text-xs text-muted-foreground">{e.instructions}</p>}</div>
                <div className="flex flex-wrap justify-end gap-1"><Badge tone="primary">{e.category}</Badge>{e.muscle_group && <Badge>{e.muscle_group}</Badge>}{e.equipment && <Badge>{e.equipment}</Badge>}</div>
              </button>
            ))}
          </Card>
        </div>
      )}

      {tab === "body" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => metricForm.create({ measured_on: today, height_cm: latestHeight })}><Plus /> Log measurement</Button></div>
          {metrics.length ? (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{["Date", "Weight", "Height", "Body fat", "Waist", "Chest", "Arm", "Thigh", "Hips", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {[...metrics].reverse().map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{formatDate(m.measured_on, { month: "short", day: "numeric", year: "numeric" })}</td>
                      {[m.weight_kg, m.height_cm, m.body_fat_pct, m.waist_cm, m.chest_cm, m.arm_cm, m.thigh_cm, m.hips_cm].map((v, i) => <td key={i} className="px-3 py-2 tabular-nums">{v ?? "—"}</td>)}
                      <td className="px-3 py-2"><Button size="icon" variant="ghost" onClick={() => metricForm.edit(m)} aria-label="Edit"><Pencil /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : <EmptyState icon={Scale} title="No measurements yet" description="Track weight, height and body measurements over time." />}
        </div>
      )}

      <EntityForm table="exercises" title={exForm.record ? "Edit exercise" : "New exercise"} fields={exFields} open={exForm.open} onClose={exForm.close} record={exForm.record} defaults={exForm.defaults} />
      <EntityForm table="workout_templates" title={tplForm.record ? "Edit template" : "New workout template"} fields={tplFields} open={tplForm.open} onClose={tplForm.close} record={tplForm.record} defaults={tplForm.defaults} />
      <EntityForm table="body_metrics" title={metricForm.record ? "Edit measurement" : "Log measurement"} fields={metricFields} open={metricForm.open} onClose={metricForm.close} record={metricForm.record} defaults={metricForm.defaults} />
    </div>
  );
}

function TemplateCard({ template, items, exercises, onEdit, onStart }: { template: Row<"workout_templates">; items: Row<"workout_template_exercises">[]; exercises: Row<"exercises">[]; onEdit: () => void; onStart: () => void }) {
  const db = useDb();
  const [ex, setEx] = useState("");
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{template.name}</CardTitle>{template.description && <CardDescription>{template.description}</CardDescription>}</div>
        <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit"><Pencil /></Button><Button size="sm" onClick={onStart}><Play /> Start</Button></div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="truncate">{byId.get(it.exercise_id)?.name}</span>
            <div className="flex items-center gap-1 text-xs">
              <Input aria-label="Sets" className="h-7 w-12 px-1.5 text-xs" type="number" defaultValue={it.target_sets} onBlur={(e) => Number(e.target.value) !== it.target_sets && db.update("workout_template_exercises", it.id, { target_sets: Number(e.target.value) || 1 }, undefined)} />×
              <Input aria-label="Reps" className="h-7 w-16 px-1.5 text-xs" defaultValue={it.target_reps} onBlur={(e) => e.target.value !== it.target_reps && db.update("workout_template_exercises", it.id, { target_reps: e.target.value || "8-12" }, undefined)} />
              <Input aria-label="Weight" className="h-7 w-16 px-1.5 text-xs" type="number" placeholder="kg" defaultValue={it.target_weight ?? ""} onBlur={(e) => db.update("workout_template_exercises", it.id, { target_weight: e.target.value ? Number(e.target.value) : null }, undefined)} />
              <Input aria-label="Rest seconds" className="h-7 w-14 px-1.5 text-xs" type="number" defaultValue={it.rest_seconds} title="Rest (s)" onBlur={(e) => Number(e.target.value) !== it.rest_seconds && db.update("workout_template_exercises", it.id, { rest_seconds: Number(e.target.value) || 0 }, undefined)} />
              <button onClick={() => db.remove("workout_template_exercises", it.id, "Removed")} aria-label="Remove"><Trash2 className="size-3.5 text-muted-foreground" /></button>
            </div>
          </div>
        ))}
        {items.length > 0 && <p className="text-[10px] text-muted-foreground">sets × reps · weight · rest (s)</p>}
        <div className="flex gap-2 pt-1">
          <Select value={ex} onChange={(e) => setEx(e.target.value)}><option value="">Add exercise…</option>{exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
          <Button variant="outline" className="h-9" disabled={!ex} onClick={async () => { if (await db.insert("workout_template_exercises", { template_id: template.id, exercise_id: ex, sort_order: items.length }, "Exercise added")) setEx(""); }}><Plus /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExerciseProgression({ exercises, sets, workouts }: { exercises: Row<"exercises">[]; sets: Row<"workout_sets">[]; workouts: Row<"workouts">[] }) {
  const used = exercises.filter((e) => sets.some((s) => s.exercise_id === e.id && s.completed && s.weight));
  const [id, setId] = useState(used[0]?.id ?? "");
  if (!used.length) return null;
  const wDate = new Map(workouts.map((w) => [w.id, w.started_at.slice(0, 10)]));
  const byDate = new Map<string, { top: number; e1rm: number }>();
  for (const s of sets) {
    if (s.exercise_id !== id || !s.completed || !s.weight || !s.reps) continue;
    const d = wDate.get(s.workout_id)!;
    const cur = byDate.get(d) ?? { top: 0, e1rm: 0 };
    byDate.set(d, { top: Math.max(cur.top, Number(s.weight)), e1rm: Math.max(cur.e1rm, Math.round(estimated1RM(Number(s.weight), s.reps))) });
  }
  const data = [...byDate.entries()].sort().map(([d, v]) => ({ date: formatDate(d), ...v }));
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Exercise progression</CardTitle><CardDescription>Top set weight and estimated 1RM per session</CardDescription></div>
        <Select value={id} onChange={(e) => setId(e.target.value)} className="w-48">{used.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
      </CardHeader>
      <CardContent><LineSeriesChart data={data} xKey="date" series={[{ key: "top", label: "Top set (kg)" }, { key: "e1rm", label: "Est. 1RM (kg)" }]} format={(v) => `${v} kg`} /></CardContent>
    </Card>
  );
}
