"use client";
import { useMemo, useState } from "react";
import { Dumbbell, Plus, Play, Pencil, Scale, Timer, X, CalendarClock } from "lucide-react";
import { PageHeader, Tabs, StatCard, EmptyState, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { LineSeriesChart } from "@/components/charts";
import { useConfirm } from "@/components/ui/confirm";
import { useWorkoutActions } from "@/lib/hooks/use-workout-actions";
import { formatDate, formatTime, isoFromTimestamp, todayISO } from "@/lib/dates";
import { bmi, type LoggedSet, type WorkoutLike } from "@/lib/engine/fitness";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";
import { WorkoutLogger } from "./workout-logger";
import { ProgramSection } from "./program-section";
import { ProgressionSection } from "./progression-section";
import { HistorySection } from "./history-section";

type Tab = "program" | "workout" | "progression" | "history" | "body" | "library";
const CATEGORIES = ["strength", "cardio", "mobility", "bodyweight", "sport", "other"].map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }));

export function FitnessView({ programsAvailable, programs, exercises, days, dayExercises, workouts, sets, metrics }: {
  programsAvailable: boolean; programs: Row<"workout_programs">[]; exercises: Row<"exercises">[]; days: Row<"workout_templates">[];
  dayExercises: Row<"workout_template_exercises">[]; workouts: Row<"workouts">[]; sets: Row<"workout_sets">[]; metrics: Row<"body_metrics">[];
}) {
  const unfinished = useMemo(() => workouts.filter((w) => !w.ended_at).sort((a, b) => b.started_at.localeCompare(a.started_at)), [workouts]);
  const [tab, setTab] = useState<Tab>(unfinished.length ? "workout" : "program");
  const [currentId, setCurrentId] = useState<string | null>(unfinished[0]?.id ?? null);
  const current = unfinished.find((w) => w.id === currentId) ?? unfinished[0];
  const exForm = useFormState<Row<"exercises">>();
  const history = { sets: sets as LoggedSet[], workouts: workouts as WorkoutLike[] };

  function goToWorkout(id?: string) {
    if (id) setCurrentId(id);
    setTab("workout");
  }

  const exFields: Field[] = [
    { name: "name", label: "Name", required: true, full: true },
    { name: "category", label: "Category", type: "select", required: true, options: CATEGORIES },
    { name: "muscle_group", label: "Muscle group" },
    { name: "equipment", label: "Equipment" },
    { name: "instructions", label: "Instructions", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader title="Fitness & Health" icon={Dumbbell} description="Your program, today's session and your progress"
        actions={current && tab !== "workout" ? <Button onClick={() => goToWorkout(current.id)}><Timer /> Resume workout</Button> : null} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "program", label: "My program" },
          { value: "workout", label: unfinished.length ? "Workout · live" : "Workout" },
          { value: "progression", label: "Progression" },
          { value: "history", label: "History", count: workouts.filter((w) => w.ended_at).length },
        ]} />
        <div className="flex gap-1 text-xs" role="tablist" aria-label="More">
          {(["body", "library"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("rounded-md px-2.5 py-1.5 font-medium transition-colors", tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "body" ? "Body metrics" : "Exercise library"}
            </button>
          ))}
        </div>
      </div>

      {tab === "program" && (
        <ProgramSection programsAvailable={programsAvailable} programs={programs} days={days} dayExercises={dayExercises} exercises={exercises}
          workouts={workouts} sets={history.sets} openWorkout={current} onStarted={goToWorkout} onNewExercise={() => exForm.create({ category: "strength" })} />
      )}

      {tab === "workout" && (
        <WorkoutTab current={current} unfinished={unfinished} onSelect={setCurrentId} sets={sets} exercises={exercises} dayExercises={dayExercises}
          history={history} programs={programs} days={days} onPickProgramDay={() => setTab("program")} />
      )}

      {tab === "progression" && <ProgressionSection exercises={exercises} sets={history.sets} workouts={history.workouts} />}
      {tab === "history" && <HistorySection workouts={workouts} sets={sets} exercises={exercises} dayExercises={dayExercises} />}
      {tab === "body" && <BodyMetrics metrics={metrics} />}
      {tab === "library" && <ExerciseLibrary exercises={exercises} onCreate={() => exForm.create({ category: "strength" })} onEdit={exForm.edit} />}

      <EntityForm table="exercises" title={exForm.record ? "Edit exercise" : "New exercise"} fields={exFields} open={exForm.open} onClose={exForm.close} record={exForm.record} defaults={exForm.defaults} />
    </div>
  );
}

function WorkoutTab({ current, unfinished, onSelect, sets, exercises, dayExercises, history, programs, days, onPickProgramDay }: {
  current?: Row<"workouts">; unfinished: Row<"workouts">[]; onSelect: (id: string) => void; sets: Row<"workout_sets">[]; exercises: Row<"exercises">[];
  dayExercises: Row<"workout_template_exercises">[]; history: { sets: LoggedSet[]; workouts: WorkoutLike[] }; programs: Row<"workout_programs">[];
  days: Row<"workout_templates">[]; onPickProgramDay: () => void;
}) {
  const actions = useWorkoutActions();
  const confirm = useConfirm();
  const active = programs.find((p) => p.is_active && !p.archived_at);
  const activeDays = days.filter((d) => !d.archived_at && active && d.program_id === active.id).sort((a, b) => a.sort_order - b.sort_order);
  const dayExercisesFor = (id: string) => dayExercises.filter((x) => x.template_id === id);

  return (
    <div className="space-y-4">
      {unfinished.length > 1 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Unfinished workouts</p>
            {unfinished.map((w) => (
              <div key={w.id} className={cn("flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm", w.id === current?.id && "border-primary/40 bg-accent/40")}>
                <span className="min-w-0 flex-1 truncate">{w.name} · started {formatDate(isoFromTimestamp(w.started_at))} {formatTime(w.started_at)} · {sets.filter((s) => s.workout_id === w.id).length} sets</span>
                {w.id !== current?.id && <Button size="sm" variant="outline" onClick={() => onSelect(w.id)}>Resume</Button>}
                <Button size="icon" variant="ghost" aria-label={`Discard ${w.name}`} onClick={async () => (await confirm({ title: `Discard “${w.name}”?`, description: "Its sets are deleted.", confirmLabel: "Discard" })) && actions.discard(w.id)}><X /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {current ? (
        <WorkoutLogger key={current.id} workout={current} sets={sets.filter((s) => s.workout_id === current.id)} exercises={exercises} dayExercises={dayExercises} history={history} />
      ) : (
        <Card>
          <CardHeader><div><CardTitle>Start a workout</CardTitle><CardDescription>{active ? `From ${active.name}` : "Create a program to start from a training day"}</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {activeDays.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{d.name}</span><span className="text-xs text-muted-foreground">{dayExercisesFor(d.id).length} exercises</span></span>
                <Button size="sm" disabled={!dayExercisesFor(d.id).length} onClick={() => actions.startFromDay(d, dayExercisesFor(d.id), history)} loading={actions.pending}><Play /> Start</Button>
              </div>
            ))}
            {!activeDays.length && (
              <EmptyState icon={CalendarClock} title="No training days yet" description="Set up your program, or start an empty session and add exercises as you go."
                action={<Button size="sm" variant="outline" onClick={onPickProgramDay}>Open My program</Button>} />
            )}
            <div className="pt-2"><Button variant="ghost" size="sm" onClick={() => actions.startEmpty()}><Plus /> Start an empty workout</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BodyMetrics({ metrics }: { metrics: Row<"body_metrics">[] }) {
  const form = useFormState<Row<"body_metrics">>();
  const today = todayISO();
  const latest = [...metrics].reverse().find((m) => m.weight_kg);
  const latestHeight = [...metrics].reverse().find((m) => m.height_cm)?.height_cm ?? null;
  const series = metrics.filter((m) => m.weight_kg).map((m) => ({ date: formatDate(m.measured_on), weight: Number(m.weight_kg) }));
  const b = bmi(latest ? Number(latest.weight_kg) : null, latestHeight ? Number(latestHeight) : null);
  const fields: Field[] = [
    { name: "measured_on", label: "Date", type: "date", required: true },
    { name: "weight_kg", label: "Weight (kg)", type: "number", min: 1, max: 500 },
    { name: "height_cm", label: "Height (cm)", type: "number", min: 30, max: 260 },
    { name: "body_fat_pct", label: "Body fat (%)", type: "number", min: 0, max: 100 },
    { name: "waist_cm", label: "Waist (cm)", type: "number", min: 0, max: 400 },
    { name: "chest_cm", label: "Chest (cm)", type: "number", min: 0, max: 400 },
    { name: "arm_cm", label: "Arm (cm)", type: "number", min: 0, max: 200 },
    { name: "thigh_cm", label: "Thigh (cm)", type: "number", min: 0, max: 200 },
    { name: "hips_cm", label: "Hips (cm)", type: "number", min: 0, max: 400 },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-md">
          <StatCard label="Body weight" value={latest ? `${Number(latest.weight_kg)} kg` : "—"} hint={latest ? formatDate(latest.measured_on) : "No measurement yet"} icon={Scale} />
          <StatCard label="BMI" value={b ? b.toFixed(1) : "—"} hint={latestHeight ? `${Number(latestHeight)} cm` : "Add your height"} />
        </div>
        <Button onClick={() => form.create({ measured_on: today, height_cm: latestHeight })}><Plus /> Log measurement</Button>
      </div>
      {series.length > 1 && (
        <Card><CardHeader><CardTitle>Body weight</CardTitle></CardHeader><CardContent><LineSeriesChart data={series} xKey="date" area series={[{ key: "weight", label: "Weight (kg)" }]} format={(v) => `${v} kg`} /></CardContent></Card>
      )}
      {metrics.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{["Date", "Weight", "Height", "Body fat", "Waist", "Chest", "Arm", "Thigh", "Hips", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {[...metrics].reverse().map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">{formatDate(m.measured_on, { month: "short", day: "numeric", year: "numeric" })}</td>
                  {[m.weight_kg, m.height_cm, m.body_fat_pct, m.waist_cm, m.chest_cm, m.arm_cm, m.thigh_cm, m.hips_cm].map((v, i) => <td key={i} className="px-3 py-2 tabular-nums">{v ?? "—"}</td>)}
                  <td className="px-3 py-2"><Button size="icon" variant="ghost" onClick={() => form.edit(m)} aria-label="Edit measurement"><Pencil /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <EmptyState icon={Scale} title="No measurements yet" description="Track weight, height and body measurements over time." />}
      <EntityForm table="body_metrics" title={form.record ? "Edit measurement" : "Log measurement"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults} />
    </div>
  );
}

function ExerciseLibrary({ exercises, onCreate, onEdit }: { exercises: Row<"exercises">[]; onCreate: () => void; onEdit: (e: Row<"exercises">) => void }) {
  const [filter, setFilter] = useState("");
  const shown = exercises.filter((e) => !filter || `${e.name} ${e.muscle_group ?? ""} ${e.equipment ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <Input placeholder="Filter exercises…" aria-label="Filter exercises" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Button onClick={onCreate}><Plus /> New exercise</Button>
      </div>
      <Card className="divide-y divide-border">
        {shown.map((e) => (
          <button key={e.id} onClick={() => onEdit(e)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/40">
            <div className="min-w-0"><p className="text-sm font-medium">{e.name}</p>{e.instructions && <p className="line-clamp-1 text-xs text-muted-foreground">{e.instructions}</p>}</div>
            <div className="flex flex-wrap justify-end gap-1"><Badge tone="primary">{e.category}</Badge>{e.muscle_group && <Badge>{e.muscle_group}</Badge>}{e.equipment && <Badge>{e.equipment}</Badge>}</div>
          </button>
        ))}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No exercises match.</p>}
      </Card>
    </div>
  );
}
