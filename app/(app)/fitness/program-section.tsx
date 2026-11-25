"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Copy, Pencil, Play, Plus, Star, Trash2, Timer, Database, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Input, Select, Label } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { useConfirm } from "@/components/ui/confirm";
import { useDb } from "@/lib/hooks/use-db";
import { useWorkoutActions } from "@/lib/hooks/use-workout-actions";
import { nextTrainingDay, type LoggedSet, type WorkoutLike } from "@/lib/engine/fitness";
import { formatDate, isoFromTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

type Program = Row<"workout_programs">;
type Day = Row<"workout_templates">;
type DayExercise = Row<"workout_template_exercises">;
type Exercise = Row<"exercises">;

const programFields: Field[] = [
  { name: "name", label: "Program name", required: true, placeholder: "e.g. Upper / Lower 4-day", full: true },
  { name: "description", label: "Description", type: "textarea", placeholder: "Goal, schedule, notes…" },
];
const dayFields: Field[] = [
  { name: "name", label: "Training day name", required: true, placeholder: "e.g. Upper A", full: true },
  { name: "description", label: "Notes", type: "textarea" },
];

export function ProgramSection({ programsAvailable, programs, days, dayExercises, exercises, workouts, sets, openWorkout, onStarted, onNewExercise }: {
  programsAvailable: boolean; programs: Program[]; days: Day[]; dayExercises: DayExercise[]; exercises: Exercise[];
  workouts: Row<"workouts">[]; sets: LoggedSet[]; openWorkout: Row<"workouts"> | undefined; onStarted: (workoutId?: string) => void; onNewExercise: () => void;
}) {
  const db = useDb();
  const confirm = useConfirm();
  const actions = useWorkoutActions();
  const programForm = useFormState<Program>();
  const dayForm = useFormState<Day>();
  const [showArchived, setShowArchived] = useState(false);

  const live = programs.filter((p) => !p.archived_at);
  const archived = programs.filter((p) => p.archived_at);
  const activeProgram = live.find((p) => p.is_active);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = live.find((p) => p.id === selectedId) ?? activeProgram ?? live[0];
  const programDays = days
    .filter((d) => !d.archived_at && selected && d.program_id === selected.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const unassigned = days.filter((d) => !d.archived_at && !d.program_id);
  const exercisesFor = (dayId: string) => dayExercises.filter((x) => x.template_id === dayId).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const history = { sets, workouts: workouts as WorkoutLike[] };
  const next = selected && selected.id === activeProgram?.id ? nextTrainingDay(programDays, workouts) : null;
  const lastDone = (dayId: string) => workouts.find((w) => w.ended_at && w.template_id === dayId);

  async function start(day: Day) {
    if (openWorkout) {
      onStarted(openWorkout.id);
      return db.toast("Finish or discard the workout in progress first", "error");
    }
    const id = await actions.startFromDay(day, exercisesFor(day.id), history);
    if (id) onStarted(id);
  }
  async function setActive(p: Program) {
    await db.run(() => db.supabase.rpc("set_active_workout_program", { p_program_id: p.id }), `${p.name} is now your active program`);
  }
  async function duplicate(p: Program) {
    const { data, error } = await db.supabase.rpc("duplicate_workout_program", { p_program_id: p.id });
    if (error) return db.toast(error.message, "error");
    db.toast(`Duplicated ${p.name}`);
    setSelectedId(data as string);
    db.refresh();
  }
  async function archive(p: Program) {
    const ok = await confirm({ title: `Archive “${p.name}”?`, description: "It's hidden from your programs. Training days and workout history are kept, and you can restore it any time.", confirmLabel: "Archive", tone: "default" });
    if (ok && (await db.update("workout_programs", p.id, { archived_at: new Date().toISOString(), is_active: false }, "Program archived"))) setSelectedId(null);
  }

  if (!programsAvailable) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Database className="size-5" /></span>
          <div className="flex-1">
            <p className="font-medium">Workout programs need a one-time database update</p>
            <p className="text-sm text-muted-foreground">The migration <code className="text-xs">20261125000001_workout_programs.sql</code> hasn&apos;t been applied to this database yet. Workout tracking, progression and history keep working meanwhile.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Program picker */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="program-select">Program</Label>
            {live.length ? (
              <Select id="program-select" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
                {live.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_active ? " (active)" : ""}</option>)}
              </Select>
            ) : <p className="text-sm text-muted-foreground">No programs yet.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {selected && !selected.is_active && <Button size="sm" variant="outline" onClick={() => setActive(selected)}><Star /> Set active</Button>}
            {selected && <Button size="sm" variant="outline" onClick={() => programForm.edit(selected)}><Pencil /> Edit</Button>}
            {selected && <Button size="sm" variant="outline" onClick={() => duplicate(selected)}><Copy /> Duplicate</Button>}
            {selected && <Button size="sm" variant="ghost" onClick={() => archive(selected)}><Archive /> Archive</Button>}
            <Button size="sm" onClick={() => programForm.create({})}><Plus /> New program</Button>
          </div>
        </CardContent>
      </Card>

      {!selected ? (
        <EmptyState icon={CalendarClock} title="Create your workout program" description="Name it, add training days such as “Upper A” and “Lower A”, then add the exercises with their sets, reps and rest."
          action={<Button onClick={() => programForm.create({})}><Plus /> New program</Button>} />
      ) : (
        <>
          {selected.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p>}

          {/* Next session */}
          {next && (
            <Card className="border-primary/30" role="region" aria-label="Next session">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Play className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{openWorkout ? "Workout in progress" : "Next session"}</p>
                  <p className="font-semibold">{openWorkout ? openWorkout.name : next.name}</p>
                  {!openWorkout && <p className="text-xs text-muted-foreground">{exercisesFor(next.id).length} exercises{lastDone(next.id) ? ` · last done ${formatDate(isoFromTimestamp(lastDone(next.id)!.started_at))}` : ""}</p>}
                </div>
                <Button onClick={() => (openWorkout ? onStarted(openWorkout.id) : start(next))} loading={actions.pending}>{openWorkout ? <><Timer /> Resume</> : <><Play /> Start {next.name}</>}</Button>
              </CardContent>
            </Card>
          )}

          {/* Training days */}
          <div className="grid gap-4 xl:grid-cols-2">
            {programDays.map((d, i) => (
              <DayCard key={d.id} index={i + 1} day={d} items={exercisesFor(d.id)} exercises={exercises} lastDone={lastDone(d.id)}
                isNext={next?.id === d.id && !openWorkout} onStart={() => start(d)} onEdit={() => dayForm.edit(d)} onNewExercise={onNewExercise} />
            ))}
            <button onClick={() => dayForm.create({})} className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40">
              <span className="flex items-center gap-1.5"><Plus className="size-4" /> Add training day</span>
            </button>
          </div>
        </>
      )}

      {unassigned.length > 0 && (
        <Card>
          <CardHeader><div><CardTitle>Days not in a program</CardTitle><CardDescription>Created before programs existed. Move them into a program to use them.</CardDescription></div></CardHeader>
          <CardContent className="space-y-2">
            {unassigned.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <Select aria-label={`Move ${d.name} to program`} className="w-48" defaultValue="" onChange={(e) => e.target.value && db.update("workout_templates", d.id, { program_id: e.target.value, sort_order: programDays.length + 1 }, "Day moved")}>
                  <option value="">Move to…</option>
                  {live.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {archived.length > 0 && (
        <div>
          <button className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} archived programs ({archived.length})</button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate text-muted-foreground">{p.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => db.update("workout_programs", p.id, { archived_at: null }, `${p.name} restored`)}><ArchiveRestore /> Restore</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EntityForm table="workout_programs" title={programForm.record ? "Edit program" : "New program"} fields={programFields} open={programForm.open} onClose={programForm.close}
        record={programForm.record} defaults={programForm.defaults} allowDelete={false}
        extra={programForm.record ? undefined : { is_active: !activeProgram, sort_order: programs.length }} />
      <EntityForm table="workout_templates" title={dayForm.record ? "Edit training day" : "New training day"} fields={dayFields} open={dayForm.open} onClose={dayForm.close}
        record={dayForm.record} defaults={dayForm.defaults} allowDelete={false}
        extra={dayForm.record ? undefined : { program_id: selected?.id, sort_order: programDays.length + 1 }} />
    </div>
  );
}

function DayCard({ index, day, items, exercises, lastDone, isNext, onStart, onEdit, onNewExercise }: {
  index: number; day: Day; items: DayExercise[]; exercises: Exercise[]; lastDone?: Row<"workouts">; isNext: boolean;
  onStart: () => void; onEdit: () => void; onNewExercise: () => void;
}) {
  const db = useDb();
  const confirm = useConfirm();
  const [adding, setAdding] = useState("");
  // Compact read view by default; editing reveals inputs, ordering and removal. Empty days open in edit mode.
  const [editing, setEditing] = useState(items.length === 0);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  async function move(i: number, dir: -1 | 1) {
    const a = items[i];
    const b = items[i + dir];
    if (!a || !b) return;
    // Renumber the whole list so equal sort_order values can't make the swap a no-op.
    const order = items.map((x) => x.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await db.run(async () => {
      for (const [n, id] of order.entries()) {
        const { error } = await db.supabase.from("workout_template_exercises").update({ sort_order: n + 1 }).eq("id", id);
        if (error) return { error };
      }
      return { error: null };
    }, undefined);
  }
  async function archiveDay() {
    const ok = await confirm({ title: `Remove “${day.name}” from this program?`, description: "The day is archived. Workouts you logged with it stay in your history.", confirmLabel: "Remove", tone: "default" });
    if (ok) await db.update("workout_templates", day.id, { archived_at: new Date().toISOString() }, "Training day removed");
  }

  return (
    <Card className={cn(isNext && "ring-1 ring-primary/40")}>
      <CardHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Day {index}{isNext ? " · next" : ""}</p>
          <CardTitle className="truncate text-base">{day.name}</CardTitle>
          <CardDescription>{items.length} exercise{items.length === 1 ? "" : "s"}{lastDone ? ` · last done ${formatDate(isoFromTimestamp(lastDone.started_at))}` : ""}</CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          {editing && <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Rename ${day.name}`}><Pencil /></Button>}
          {editing && <Button size="icon" variant="ghost" onClick={archiveDay} aria-label={`Remove ${day.name}`}><Archive /></Button>}
          <Button size="sm" variant={editing ? "secondary" : "ghost"} onClick={() => setEditing(!editing)} aria-pressed={editing} aria-label={`Edit ${day.name} exercises`}>{editing ? "Done" : "Edit"}</Button>
          <Button size="sm" onClick={onStart} disabled={!items.length} aria-label={`Start ${day.name}`}><Play /> Start</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {day.description && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{day.description}</p>}
        {!editing && (
          <ol className="divide-y divide-border">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-baseline gap-3 py-2">
                <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{byId.get(it.exercise_id)?.name ?? "Exercise"}</span>
                  {it.notes && <span className="block truncate text-xs text-muted-foreground">{it.notes}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{it.target_sets} × {it.target_reps} · {it.rest_seconds}s</span>
              </li>
            ))}
          </ol>
        )}
        {editing && <><ol className="space-y-2">
          {items.map((it, i) => (
            <li key={it.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{byId.get(it.exercise_id)?.name ?? "Exercise"}</span>
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove exercise" onClick={async () => (await confirm({ title: `Remove ${byId.get(it.exercise_id)?.name ?? "this exercise"} from ${day.name}?`, description: "Logged sets in your history are kept." })) && db.remove("workout_template_exercises", it.id, "Exercise removed")}><Trash2 /></Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 pl-7">
                <NumberField label="Sets" value={it.target_sets} min={1} max={50} onSave={(v) => db.update("workout_template_exercises", it.id, { target_sets: v }, undefined)} />
                <TextField label="Reps" value={it.target_reps} maxLength={20} onSave={(v) => db.update("workout_template_exercises", it.id, { target_reps: v || "8-12" }, undefined)} />
                <NumberField label="Rest (s)" value={it.rest_seconds} min={0} max={3600} step={15} onSave={(v) => db.update("workout_template_exercises", it.id, { rest_seconds: v }, undefined)} />
                <div className="col-span-3">
                  <TextField label="Notes" value={it.notes ?? ""} maxLength={500} placeholder="Tempo, grip, cues…" onSave={(v) => db.update("workout_template_exercises", it.id, { notes: v || null }, undefined)} />
                </div>
              </div>
            </li>
          ))}
        </ol>
        {!items.length && <p className="py-2 text-center text-xs text-muted-foreground">Add the exercises for this day.</p>}
        <form className="flex gap-2 pt-1" onSubmit={async (e) => {
          e.preventDefault();
          if (!adding) return;
          const ok = await db.insert("workout_template_exercises", { template_id: day.id, exercise_id: adding, sort_order: items.length + 1, target_sets: 3, target_reps: "8-12", rest_seconds: 90 }, "Exercise added");
          if (ok) setAdding("");
        }}>
          <Select aria-label={`Exercise to add to ${day.name}`} value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Add exercise…</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Button type="submit" variant="outline" className="h-9" disabled={!adding} aria-label="Add exercise"><Plus /></Button>
        </form>
        <button type="button" onClick={onNewExercise} className="text-xs text-primary hover:underline">Exercise not listed? Create it</button>
        </>}
      </CardContent>
    </Card>
  );
}

function NumberField({ label, value, min, max, step = 1, onSave }: { label: string; value: number; min: number; max: number; step?: number; onSave: (v: number) => void }) {
  return (
    <label className="space-y-0.5">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input type="number" inputMode="numeric" className="h-8 px-2 text-sm" min={min} max={max} step={step} defaultValue={value} key={value}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v) || v < min || v > max) { e.target.value = String(value); return; }
          if (v !== value) onSave(Math.round(v));
        }} />
    </label>
  );
}

function TextField({ label, value, maxLength, placeholder, onSave }: { label: string; value: string; maxLength: number; placeholder?: string; onSave: (v: string) => void }) {
  return (
    <label className="block space-y-0.5">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input className="h-8 px-2 text-sm" maxLength={maxLength} placeholder={placeholder} defaultValue={value} key={value}
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== value) onSave(v); }} />
    </label>
  );
}
