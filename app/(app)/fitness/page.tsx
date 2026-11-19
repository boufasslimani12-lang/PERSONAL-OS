import { requireUser } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/dates";
import { getDateContext } from "@/lib/server/date-context";
import { FitnessView } from "./fitness-view";

export const metadata = { title: "Fitness & Health" };

export default async function FitnessPage() {
  const { supabase } = await requireUser();
  const { today } = await getDateContext();
  const since = addDaysISO(today, -365);
  const [exercises, templates, templateExercises, workouts, metrics] = await Promise.all([
    supabase.from("exercises").select("*").order("name"),
    supabase.from("workout_templates").select("*").is("archived_at", null).order("sort_order").order("created_at"),
    supabase.from("workout_template_exercises").select("*").order("sort_order"),
    supabase.from("workouts").select("*").gte("started_at", since).order("started_at", { ascending: false }),
    supabase.from("body_metrics").select("*").order("measured_on"),
  ]);
  for (const r of [exercises, templates, templateExercises, workouts, metrics]) if (r.error) throw new Error(r.error.message);
  const ids = workouts.data!.map((w) => w.id);
  const sets = ids.length ? await supabase.from("workout_sets").select("*").in("workout_id", ids).order("set_number") : { data: [], error: null };
  if (sets.error) throw new Error(sets.error.message);
  return <FitnessView exercises={exercises.data!} templates={templates.data!} templateExercises={templateExercises.data!} workouts={workouts.data!} sets={sets.data!} metrics={metrics.data!} />;
}
