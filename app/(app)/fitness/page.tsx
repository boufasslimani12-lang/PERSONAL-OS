import { requireUser } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/dates";
import { getDateContext } from "@/lib/server/date-context";
import { FitnessView } from "./fitness-view";

export const metadata = { title: "Fitness & Health" };

/** PostgREST/Postgres codes for "relation does not exist" (migration not applied yet). */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

export default async function FitnessPage() {
  const { supabase } = await requireUser();
  const { today } = await getDateContext();
  const since = addDaysISO(today, -730);
  const [programs, exercises, days, dayExercises, workouts, metrics] = await Promise.all([
    supabase.from("workout_programs").select("*").order("sort_order").order("created_at"),
    supabase.from("exercises").select("*").order("name"),
    supabase.from("workout_templates").select("*").order("sort_order").order("created_at"),
    supabase.from("workout_template_exercises").select("*").order("sort_order").order("created_at"),
    supabase.from("workouts").select("*").gte("started_at", since).order("started_at", { ascending: false }),
    supabase.from("body_metrics").select("*").order("measured_on"),
  ]);
  const programsAvailable = !programs.error || !MISSING_TABLE.has(programs.error.code ?? "");
  if (programs.error && programsAvailable) throw new Error(programs.error.message);
  for (const r of [exercises, days, dayExercises, workouts, metrics]) if (r.error) throw new Error(r.error.message);

  const ids = workouts.data!.map((w) => w.id);
  const sets = ids.length ? await supabase.from("workout_sets").select("*").in("workout_id", ids).order("set_number").order("created_at") : { data: [], error: null };
  if (sets.error) throw new Error(sets.error.message);

  return (
    <FitnessView
      programsAvailable={programsAvailable}
      programs={programs.data ?? []}
      exercises={exercises.data!}
      days={days.data!}
      dayExercises={dayExercises.data!}
      workouts={workouts.data!}
      sets={sets.data!}
      metrics={metrics.data!}
    />
  );
}
