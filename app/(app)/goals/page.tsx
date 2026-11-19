import { requireUser } from "@/lib/supabase/server";
import { buildGoalProgressIndex } from "@/lib/engine/goals";
import { GoalsView } from "./goals-view";

export const metadata = { title: "My Goals" };

export default async function GoalsPage() {
  const { supabase } = await requireUser();
  const [goals, milestones, tasks, areas] = await Promise.all([
    supabase.from("goals").select("*").order("created_at"),
    supabase.from("milestones").select("*").not("goal_id", "is", null).order("sort_order").order("created_at"),
    supabase.from("tasks").select("*").not("goal_id", "is", null).order("due_date", { nullsFirst: false }),
    supabase.from("life_areas").select("*").order("sort_order"),
  ]);
  for (const r of [goals, milestones, tasks, areas]) if (r.error) throw new Error(r.error.message);
  const idx = buildGoalProgressIndex(goals.data!, milestones.data!, tasks.data!);
  const progress = Object.fromEntries(goals.data!.map((g) => [g.id, idx.get(g.id)]));
  return <GoalsView goals={goals.data!} milestones={milestones.data!} tasks={tasks.data!} areas={areas.data!} progress={progress} />;
}
