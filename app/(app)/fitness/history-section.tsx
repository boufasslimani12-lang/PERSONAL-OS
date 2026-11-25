"use client";
import { useState } from "react";
import { History, Trash2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useDb } from "@/lib/hooks/use-db";
import { useConfirm } from "@/components/ui/confirm";
import { orderWorkoutExercises, workoutSummary, type LoggedSet } from "@/lib/engine/fitness";
import { formatDate, formatMinutes, formatTime, isoFromTimestamp } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

export function HistorySection({ workouts, sets, exercises, dayExercises }: {
  workouts: Row<"workouts">[]; sets: Row<"workout_sets">[]; exercises: Row<"exercises">[]; dayExercises: Row<"workout_template_exercises">[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const finished = workouts.filter((w) => w.ended_at).sort((a, b) => b.started_at.localeCompare(a.started_at));
  const open = openId ? finished.find((w) => w.id === openId) : undefined;

  if (!finished.length) return <EmptyState icon={History} title="No workouts yet" description="Finished sessions appear here with their exercises, sets and duration." />;
  return (
    <>
      <Card className="divide-y divide-border">
        {finished.map((w) => {
          const sum = workoutSummary(w, sets as LoggedSet[]);
          return (
            <button key={w.id} onClick={() => setOpenId(w.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40">
              <span className="w-12 shrink-0 text-center leading-tight">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{formatDate(isoFromTimestamp(w.started_at), { month: "short" })}</span>
                <span className="block text-lg font-semibold tabular-nums">{Number(isoFromTimestamp(w.started_at).slice(8))}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{w.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(isoFromTimestamp(w.started_at), { weekday: "long" })} · {formatTime(w.started_at)} · {sum.minutes !== null ? formatMinutes(sum.minutes) : "—"}
                </span>
              </span>
              <span className="text-right text-xs text-muted-foreground">
                <span className="block"><span className="font-medium text-foreground tabular-nums">{sum.exercises}</span> exercises</span>
                <span className="block"><span className="font-medium text-foreground tabular-nums">{sum.sets}</span> sets · {formatNumber(sum.volume)} kg</span>
              </span>
            </button>
          );
        })}
      </Card>
      {open && <WorkoutDetail workout={open} sets={sets.filter((s) => s.workout_id === open.id)} exercises={exercises} dayExercises={dayExercises} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** A finished workout's recorded sets. Sets can be corrected in place; the session's date and duration stay as recorded. */
function WorkoutDetail({ workout, sets, exercises, dayExercises, onClose }: {
  workout: Row<"workouts">; sets: Row<"workout_sets">[]; exercises: Row<"exercises">[]; dayExercises: Row<"workout_template_exercises">[]; onClose: () => void;
}) {
  const db = useDb();
  const confirm = useConfirm();
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const order = orderWorkoutExercises(sets, dayExercises.filter((d) => d.template_id === workout.template_id).sort((a, b) => a.sort_order - b.sort_order).map((d) => d.exercise_id));
  const sum = workoutSummary(workout, sets as LoggedSet[]);
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open onClose={onClose} title={workout.name}
      description={`${formatDate(isoFromTimestamp(workout.started_at), { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${formatTime(workout.started_at)} · ${sum.minutes !== null ? formatMinutes(sum.minutes) : "—"} · ${sum.sets} sets`}
      className="w-[min(100vw-1.5rem,40rem)]">
      <div className="space-y-5">
        {order.map((exId) => (
          <section key={exId}>
            <h3 className="mb-2 text-sm font-semibold">{byId.get(exId)?.name ?? "Exercise"}</h3>
            <div className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="text-center">Set</span><span>kg</span><span>Reps</span><span className="text-center">Done</span>
              {sets.filter((s) => s.exercise_id === exId).sort((a, b) => a.set_number - b.set_number).map((s) => (
                <div key={s.id} className="contents">
                  <span className="text-center text-sm font-semibold tabular-nums text-foreground">{s.set_number}</span>
                  <Input className="h-9 px-2 tabular-nums" type="number" inputMode="decimal" step="0.5" defaultValue={s.weight ?? ""} aria-label={`Set ${s.set_number} weight in kg`}
                    onBlur={(e) => { const v = num(e.target.value); if ((v === null || (v >= 0 && v <= 1000)) && v !== (s.weight === null ? null : Number(s.weight))) db.update("workout_sets", s.id, { weight: v }, "Set updated"); }} />
                  <Input className="h-9 px-2 tabular-nums" type="number" inputMode="numeric" defaultValue={s.reps ?? ""} aria-label={`Set ${s.set_number} reps`}
                    onBlur={(e) => { const v = num(e.target.value); if ((v === null || (v >= 0 && v <= 1000)) && v !== s.reps) db.update("workout_sets", s.id, { reps: v === null ? null : Math.round(v) }, "Set updated"); }} />
                  <button className={cn("mx-auto grid size-8 place-items-center rounded-md border-2", s.completed ? "border-success bg-success text-white" : "border-border")}
                    onClick={() => db.update("workout_sets", s.id, { completed: !s.completed }, "Set updated")} aria-label={s.completed ? `Mark set ${s.set_number} not done` : `Mark set ${s.set_number} done`} aria-pressed={s.completed}>
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
        {workout.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{workout.notes}</p>}
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={async () => {
            if (await confirm({ title: `Delete “${workout.name}”?`, description: "The workout and all its sets are deleted. Progression is recalculated." })) {
              if (await db.remove("workouts", workout.id)) onClose();
            }
          }}><Trash2 /> Delete workout</Button>
        </div>
      </div>
    </Dialog>
  );
}
