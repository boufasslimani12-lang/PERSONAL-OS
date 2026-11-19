"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Timer, Trash2, Flag, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useDb } from "@/lib/hooks/use-db";
import { useConfirm } from "@/components/ui/confirm";
import { totalVolume } from "@/lib/engine/fitness";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
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

export function WorkoutLogger({ workout, sets, exercises }: { workout: Row<"workouts">; sets: Row<"workout_sets">[]; exercises: Row<"exercises">[] }) {
  const db = useDb();
  const confirm = useConfirm();
  const now = useNow();
  const toast = db.toast;
  const rest$ = useRestTimer(useCallback(() => {
    try { navigator.vibrate?.(300); } catch {}
    toast("Rest finished — next set!");
  }, [toast]));
  const restUntil = rest$.restUntil;
  const [addEx, setAddEx] = useState("");
  const [name, setName] = useState(workout.name);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const order: string[] = [];
  for (const s of sets) if (!order.includes(s.exercise_id)) order.push(s.exercise_id);
  const elapsed = (now - new Date(workout.started_at).getTime()) / 1000;
  const rest = restUntil ? Math.max(0, (restUntil - now) / 1000) : 0;

  async function patch(s: Row<"workout_sets">, values: Partial<Row<"workout_sets">>) {
    await db.update("workout_sets", s.id, values, undefined);
  }
  async function toggle(s: Row<"workout_sets">) {
    await patch(s, { completed: !s.completed });
    if (!s.completed) rest$.start(s.rest_seconds ?? 90);
  }
  async function addSet(exerciseId: string) {
    const prev = sets.filter((s) => s.exercise_id === exerciseId).at(-1);
    await db.insert("workout_sets", { workout_id: workout.id, exercise_id: exerciseId, set_number: (prev?.set_number ?? 0) + 1, reps: prev?.reps ?? null, weight: prev?.weight ?? null, rest_seconds: prev?.rest_seconds ?? 90, completed: false }, undefined);
  }
  async function finish() {
    // Ask the database, not props: a set ticked a moment ago may not have been refreshed into props yet.
    const { count, error } = await db.supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workout.id).eq("completed", true);
    if (error) return db.toast(error.message, "error");
    if (!count) {
      await db.remove("workouts", workout.id, "No sets were completed — workout discarded");
      return;
    }
    // drop sets that were never performed
    await db.supabase.from("workout_sets").delete().eq("workout_id", workout.id).eq("completed", false);
    await db.update("workouts", workout.id, { ended_at: new Date().toISOString(), name: name.trim() || "Workout" }, "Workout saved 💪");
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== workout.name && db.update("workouts", workout.id, { name }, undefined)} className="h-8 max-w-xs border-transparent px-1 text-base font-semibold hover:border-input" aria-label="Workout name" />
          <CardDescription className="mt-1 flex items-center gap-3 px-1">
            <span className="flex items-center gap-1 tabular-nums"><Timer className="size-3.5" />{mmss(elapsed)}</span>
            <span>{sets.filter((s) => s.completed).length} sets done</span>
            <span>{formatNumber(totalVolume(sets))} kg volume</span>
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={async () => (await confirm({ title: "Discard this workout?", description: "All sets logged in this session are deleted.", confirmLabel: "Discard" })) && db.remove("workouts", workout.id, "Workout discarded")}><X /> Discard</Button>
          <Button size="sm" onClick={finish} loading={db.pending}><Flag /> Finish</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {restUntil && (
          <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
            <span className="flex items-center gap-2"><Timer className="size-4" /> Rest <span className="font-semibold tabular-nums">{mmss(rest)}</span></span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => rest$.extend(30)}>+30s</Button>
              <Button size="sm" variant="ghost" onClick={rest$.skip}>Skip</Button>
            </div>
          </div>
        )}
        {order.map((exId) => {
          const ex = byId.get(exId);
          const rows = sets.filter((s) => s.exercise_id === exId);
          const cardio = ex?.category === "cardio";
          return (
            <div key={exId}>
              <CardTitle className="mb-2">{ex?.name}</CardTitle>
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem_2rem] items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2">
                <span>Set</span><span>{cardio ? "Minutes" : "Reps"}</span><span>{cardio ? "Distance (m)" : "Weight (kg)"}</span><span>RPE</span><span /><span />
                {rows.map((s) => (
                  <SetRow key={s.id} s={s} cardio={cardio} onPatch={(v) => patch(s, v)} onToggle={() => toggle(s)} onDelete={() => db.remove("workout_sets", s.id, undefined)} />
                ))}
              </div>
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => addSet(exId)}><Plus /> Add set</Button>
            </div>
          );
        })}
        <div className="flex gap-2 border-t border-border pt-3">
          <Select value={addEx} onChange={(e) => setAddEx(e.target.value)}><option value="">Add exercise…</option>{exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
          <Button variant="outline" className="h-9" disabled={!addEx} onClick={async () => { await addSet(addEx); setAddEx(""); }}><Plus /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SetRow({ s, cardio, onPatch, onToggle, onDelete }: { s: Row<"workout_sets">; cardio: boolean; onPatch: (v: Partial<Row<"workout_sets">>) => void; onToggle: () => void; onDelete: () => void }) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <>
      <span className="text-center text-xs font-medium text-foreground">{s.set_number}</span>
      {cardio ? (
        <Input className="h-8" type="number" inputMode="decimal" defaultValue={s.duration_seconds ? s.duration_seconds / 60 : ""} onBlur={(e) => onPatch({ duration_seconds: e.target.value ? Math.round(Number(e.target.value) * 60) : null })} aria-label="Minutes" />
      ) : (
        <Input className="h-8" type="number" inputMode="numeric" defaultValue={s.reps ?? ""} onBlur={(e) => num(e.target.value) !== s.reps && onPatch({ reps: num(e.target.value) })} aria-label="Reps" />
      )}
      {cardio ? (
        <Input className="h-8" type="number" inputMode="decimal" defaultValue={s.distance_m ?? ""} onBlur={(e) => onPatch({ distance_m: num(e.target.value) })} aria-label="Distance" />
      ) : (
        <Input className="h-8" type="number" inputMode="decimal" step="0.5" defaultValue={s.weight ?? ""} onBlur={(e) => num(e.target.value) !== (s.weight === null ? null : Number(s.weight)) && onPatch({ weight: num(e.target.value) })} aria-label="Weight" />
      )}
      <Input className="h-8" type="number" inputMode="decimal" min={1} max={10} step="0.5" defaultValue={s.rpe ?? ""} onBlur={(e) => { const v = num(e.target.value); if (v === null || (v >= 1 && v <= 10)) onPatch({ rpe: v }); }} aria-label="RPE" />
      <button onClick={onToggle} className={cn("grid size-8 place-items-center rounded-md border-2", s.completed ? "border-success bg-success text-white" : "border-border hover:border-primary")} aria-label={s.completed ? "Mark set not done" : "Mark set done"}>
        <Check className="size-4" strokeWidth={3} />
      </button>
      <button onClick={onDelete} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" aria-label="Delete set"><Trash2 className="size-3.5" /></button>
    </>
  );
}
