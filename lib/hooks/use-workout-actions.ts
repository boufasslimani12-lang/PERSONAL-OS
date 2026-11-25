"use client";
import { useDb } from "./use-db";
import { previousPerformance, targetRepsValue, type LoggedSet, type WorkoutLike } from "@/lib/engine/fitness";
import type { Row } from "@/lib/types";

type Day = Row<"workout_templates">;
type DayExercise = Row<"workout_template_exercises">;

/** Workout session actions shared by the Program and Workout sections. All writes go through RLS. */
export function useWorkoutActions() {
  const db = useDb();

  /**
   * Starts a session for a training day: one planned (not yet completed) set per target set, in the day's order.
   * Weights are prefilled from the last time each set was done, otherwise from the day's target weight.
   */
  async function startFromDay(day: Day, dayExercises: DayExercise[], history: { sets: LoggedSet[]; workouts: WorkoutLike[] }) {
    const { data: workout, error } = await db.supabase.from("workouts").insert({ name: day.name, template_id: day.id }).select("id").single();
    if (error) {
      db.toast(error.message, "error");
      return null;
    }
    const rows = [...dayExercises].sort((a, b) => a.sort_order - b.sort_order).flatMap((te) => {
      const prev = previousPerformance(te.exercise_id, history.sets, history.workouts)?.sets ?? [];
      return Array.from({ length: te.target_sets }, (_, i) => ({
        workout_id: workout.id,
        exercise_id: te.exercise_id,
        set_number: i + 1,
        weight: prev[i]?.weight ?? prev[prev.length - 1]?.weight ?? te.target_weight,
        reps: targetRepsValue(te.target_reps),
        rest_seconds: te.rest_seconds,
        completed: false,
      }));
    });
    if (rows.length) {
      const { error: setsError } = await db.supabase.from("workout_sets").insert(rows);
      if (setsError) {
        await db.supabase.from("workouts").delete().eq("id", workout.id);
        db.toast(setsError.message, "error");
        return null;
      }
    }
    db.toast(`${day.name} started`);
    db.refresh();
    return workout.id;
  }

  async function startEmpty() {
    const { data, error } = await db.supabase.from("workouts").insert({ name: "Workout" }).select("id").single();
    if (error) {
      db.toast(error.message, "error");
      return null;
    }
    db.toast("Workout started");
    db.refresh();
    return data.id;
  }

  /** Finishes a session. Planned sets that were never done are dropped; a session with no completed set is discarded. */
  async function finish(workoutId: string, name?: string) {
    // Ask the database, not props: a set ticked a moment ago may not have been refreshed into props yet.
    const { count, error } = await db.supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workoutId).eq("completed", true);
    if (error) {
      db.toast(error.message, "error");
      return false;
    }
    if (!count) return db.remove("workouts", workoutId, "No sets were completed — workout discarded");
    await db.supabase.from("workout_sets").delete().eq("workout_id", workoutId).eq("completed", false);
    return db.update("workouts", workoutId, { ended_at: new Date().toISOString(), ...(name?.trim() ? { name: name.trim() } : {}) }, "Workout saved 💪");
  }

  async function discard(workoutId: string) {
    return db.remove("workouts", workoutId, "Workout discarded");
  }

  return { startFromDay, startEmpty, finish, discard, pending: db.pending };
}
