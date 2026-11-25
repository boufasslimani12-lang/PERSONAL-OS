"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Plus, Timer, Trash2, Flag, X, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useDb } from "@/lib/hooks/use-db";
import { useConfirm } from "@/components/ui/confirm";
import { useWorkoutActions } from "@/lib/hooks/use-workout-actions";
import { orderWorkoutExercises, previousPerformance, totalVolume, type LoggedSet, type WorkoutLike } from "@/lib/engine/fitness";
import { formatDate, isoFromTimestamp } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

// One shared 1-second clock. The server snapshot is null so the first (hydrated) render never contains a time
// that differs between server and browser; the clock starts ticking once mounted.
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockSubscribers = new Set<() => void>();
function subscribeClock(cb: () => void) {
  clockSubscribers.add(cb);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => { clockNow = Date.now(); clockSubscribers.forEach((f) => f()); }, 1000);
    queueMicrotask(() => clockSubscribers.forEach((f) => f()));
  }
  return () => {
    clockSubscribers.delete(cb);
    if (!clockSubscribers.size && clockTimer) { clearInterval(clockTimer); clockTimer = undefined; }
  };
}
function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, () => clockNow || null, () => null);
}

/** Rest countdown: started from an event handler, finished by a timeout (no state updates inside effects). */
function useRestTimer(onDone: () => void) {
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const untilRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const schedule = useCallback((until: number) => {
    if (timer.current) clearTimeout(timer.current);
    untilRef.current = until;
    setRestUntil(until);
    timer.current = setTimeout(() => { untilRef.current = null; setRestUntil(null); done.current(); }, Math.max(0, until - Date.now()));
  }, []);
  const start = useCallback((seconds: number) => schedule(Date.now() + seconds * 1000), [schedule]);
  const extend = useCallback((seconds: number) => schedule((untilRef.current ?? Date.now()) + seconds * 1000), [schedule]);
  const skip = useCallback(() => { if (timer.current) clearTimeout(timer.current); untilRef.current = null; setRestUntil(null); }, []);
  return { restUntil, start, extend, skip };
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

export function WorkoutLogger({ workout, sets, exercises, dayExercises, history }: {
  workout: Row<"workouts">; sets: Row<"workout_sets">[]; exercises: Row<"exercises">[]; dayExercises: Row<"workout_template_exercises">[];
  history: { sets: LoggedSet[]; workouts: WorkoutLike[] };
}) {
  const db = useDb();
  const confirm = useConfirm();
  const actions = useWorkoutActions();
  const now = useNow();
  const toast = db.toast;
  const rest = useRestTimer(useCallback(() => {
    try { navigator.vibrate?.(300); } catch {}
    toast("Rest finished — next set!");
  }, [toast]));
  const [addEx, setAddEx] = useState("");
  const [name, setName] = useState(workout.name);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const plan = dayExercises.filter((d) => d.template_id === workout.template_id).sort((a, b) => a.sort_order - b.sort_order);
  const order = orderWorkoutExercises(sets, plan.map((p) => p.exercise_id));
  const elapsed = now === null ? null : (now - new Date(workout.started_at).getTime()) / 1000;
  const restLeft = rest.restUntil && now !== null ? Math.max(0, (rest.restUntil - now) / 1000) : 0;
  const done = sets.filter((s) => s.completed);

  async function patch(s: Row<"workout_sets">, values: Partial<Row<"workout_sets">>) {
    await db.update("workout_sets", s.id, values, undefined);
  }
  async function toggle(s: Row<"workout_sets">) {
    await patch(s, { completed: !s.completed });
    if (!s.completed) rest.start(s.rest_seconds ?? 90);
  }
  async function addSet(exerciseId: string) {
    const prev = sets.filter((s) => s.exercise_id === exerciseId).at(-1);
    const target = plan.find((p) => p.exercise_id === exerciseId);
    await db.insert("workout_sets", {
      workout_id: workout.id, exercise_id: exerciseId, set_number: (prev?.set_number ?? 0) + 1,
      reps: prev?.reps ?? null, weight: prev?.weight ?? null, rest_seconds: prev?.rest_seconds ?? target?.rest_seconds ?? 90, completed: false,
    }, undefined);
  }

  return (
    <div className="space-y-4">
      {/* Session bar — sticky so Finish and the timers stay reachable on a phone */}
      <Card className="sticky top-12 z-20 border-primary/30 lg:top-2">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== workout.name && db.update("workouts", workout.id, { name: name.trim() }, undefined)}
                className="h-8 border-transparent px-1 text-base font-semibold hover:border-input" aria-label="Workout name" />
              <p className="flex flex-wrap gap-x-3 px-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums"><Timer className="size-3.5" />{elapsed === null ? "–:––" : mmss(elapsed)}</span>
                <span>{done.length}/{sets.length} sets</span>
                <span>{formatNumber(totalVolume(done))} kg</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => (await confirm({ title: "Discard this workout?", description: "All sets logged in this session are deleted.", confirmLabel: "Discard" })) && actions.discard(workout.id)}><X /> Discard</Button>
            <Button size="sm" onClick={() => actions.finish(workout.id, name)} loading={actions.pending}><Flag /> Finish</Button>
          </div>
          {rest.restUntil && (
            <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground" role="timer" aria-live="polite">
              <span className="flex items-center gap-2"><Timer className="size-4" /> Rest <span className="text-lg font-semibold tabular-nums">{mmss(restLeft)}</span></span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => rest.extend(30)}>+30s</Button>
                <Button size="sm" variant="ghost" onClick={rest.skip}>Skip</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {order.map((exId) => {
        const ex = byId.get(exId);
        const rows = sets.filter((s) => s.exercise_id === exId).sort((a, b) => a.set_number - b.set_number);
        const target = plan.find((p) => p.exercise_id === exId);
        const prev = previousPerformance(exId, history.sets, history.workouts, workout.id);
        const cardio = ex?.category === "cardio";
        return (
          <Card key={exId}>
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div>
                <h3 className="font-semibold">{ex?.name ?? "Exercise"}</h3>
                {target && <p className="text-xs text-muted-foreground">Target {target.target_sets} × {target.target_reps} · rest {target.rest_seconds}s{target.notes ? ` · ${target.notes}` : ""}</p>}
                <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                  <History className="mt-0.5 size-3.5 shrink-0" />
                  {prev ? <span>Last time ({formatDate(isoFromTimestamp(prev.startedAt))}): {prev.sets.map((p) => `${Number(p.weight ?? 0)}×${p.reps ?? 0}`).join(" · ")}</span> : <span>First time logging this exercise</span>}
                </p>
              </div>
              <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem_2rem] items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <span className="text-center">Set</span><span>{cardio ? "Minutes" : "kg"}</span><span>{cardio ? "Distance (m)" : "Reps"}</span><span className="text-center">Done</span><span />
                {rows.map((s) => <SetRow key={s.id} s={s} cardio={cardio} onPatch={(v) => patch(s, v)} onToggle={() => toggle(s)}
                  onDelete={async () => (await confirm({ title: `Delete set ${s.set_number}?`, confirmLabel: "Delete" })) && db.remove("workout_sets", s.id, undefined)} />)}
              </div>
              <Button size="sm" variant="ghost" onClick={() => addSet(exId)}><Plus /> Add set</Button>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex gap-2 p-3 sm:p-4">
          <Select aria-label="Exercise to add to this workout" value={addEx} onChange={(e) => setAddEx(e.target.value)}>
            <option value="">Add exercise…</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Button variant="outline" className="h-9" disabled={!addEx} onClick={async () => { await addSet(addEx); setAddEx(""); }}><Plus /> Add</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SetRow({ s, cardio, onPatch, onToggle, onDelete }: { s: Row<"workout_sets">; cardio: boolean; onPatch: (v: Partial<Row<"workout_sets">>) => void; onToggle: () => void; onDelete: () => void }) {
  const num = (v: string) => (v === "" ? null : Number(v));
  const valid = (v: number | null, max: number) => v === null || (Number.isFinite(v) && v >= 0 && v <= max);
  const field = "h-10 px-2 text-base tabular-nums sm:h-9 sm:text-sm";
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };
  return (
    <>
      <span className={cn("text-center text-sm font-semibold tabular-nums", s.completed ? "text-success" : "text-foreground")}>{s.set_number}</span>
      {cardio ? (
        <Input className={field} type="number" inputMode="decimal" defaultValue={s.duration_seconds ? s.duration_seconds / 60 : ""} aria-label={`Set ${s.set_number} minutes`} onKeyDown={blurOnEnter}
          onBlur={(e) => { const v = num(e.target.value); if (valid(v, 1440)) onPatch({ duration_seconds: v === null ? null : Math.round(v * 60) }); }} />
      ) : (
        <Input className={field} type="number" inputMode="decimal" step="0.5" defaultValue={s.weight ?? ""} aria-label={`Set ${s.set_number} weight in kg`} onKeyDown={blurOnEnter}
          onBlur={(e) => { const v = num(e.target.value); if (valid(v, 1000) && v !== (s.weight === null ? null : Number(s.weight))) onPatch({ weight: v }); }} />
      )}
      {cardio ? (
        <Input className={field} type="number" inputMode="decimal" defaultValue={s.distance_m ?? ""} aria-label={`Set ${s.set_number} distance`} onKeyDown={blurOnEnter}
          onBlur={(e) => { const v = num(e.target.value); if (valid(v, 1_000_000)) onPatch({ distance_m: v }); }} />
      ) : (
        <Input className={field} type="number" inputMode="numeric" defaultValue={s.reps ?? ""} aria-label={`Set ${s.set_number} reps`} onKeyDown={blurOnEnter}
          onBlur={(e) => { const v = num(e.target.value); if (valid(v, 1000) && v !== s.reps) onPatch({ reps: v === null ? null : Math.round(v) }); }} />
      )}
      <button onClick={onToggle} className={cn("mx-auto grid size-10 place-items-center rounded-lg border-2 transition-colors sm:size-9", s.completed ? "border-success bg-success text-white" : "border-border hover:border-primary")}
        aria-label={s.completed ? `Mark set ${s.set_number} not done` : `Mark set ${s.set_number} done`} aria-pressed={s.completed}>
        <Check className="size-5" strokeWidth={3} />
      </button>
      <button onClick={onDelete} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" aria-label={`Delete set ${s.set_number}`}><Trash2 className="size-3.5" /></button>
    </>
  );
}
