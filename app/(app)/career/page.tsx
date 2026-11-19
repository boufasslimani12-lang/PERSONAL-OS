import { requireUser } from "@/lib/supabase/server";
import { CareerView } from "./career-view";

export const metadata = { title: "Career & Business" };

export default async function CareerPage() {
  const { supabase } = await requireUser();
  const projects = await supabase.from("projects").select("*").in("kind", ["career_objective", "business_idea", "business_project"]).order("created_at");
  if (projects.error) throw new Error(projects.error.message);
  const ids = projects.data.map((p) => p.id);
  const [tasks, milestones, resources, goals, areas] = await Promise.all([
    ids.length ? supabase.from("tasks").select("*").in("project_id", ids).is("parent_task_id", null).order("due_date", { nullsFirst: false }) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("milestones").select("*").in("project_id", ids).order("sort_order").order("created_at") : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("resources").select("*").in("project_id", ids) : Promise.resolve({ data: [], error: null }),
    supabase.from("goals").select("id,title").is("archived_at", null).not("status", "in", "(completed,cancelled)"),
    supabase.from("life_areas").select("id,key"),
  ]);
  for (const r of [tasks, milestones, resources, goals, areas]) if (r.error) throw new Error(r.error.message);
  const careerArea = areas.data!.find((a) => a.key === "career")?.id ?? null;
  return <CareerView projects={projects.data} tasks={tasks.data!} milestones={milestones.data!} resources={resources.data!} goals={goals.data!} careerArea={careerArea} />;
}
