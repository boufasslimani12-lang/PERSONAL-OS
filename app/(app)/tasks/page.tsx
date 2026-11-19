import { requireUser } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/dates";
import { getDateContext } from "@/lib/server/date-context";
import { TasksView } from "./tasks-view";

export const metadata = { title: "Tasks & Projects" };

export default async function TasksPage() {
  const { supabase } = await requireUser();
  const { today } = await getDateContext();
  const [tasks, projects, goals, areas, completions] = await Promise.all([
    supabase.from("tasks").select("*").order("sort_order").order("created_at"),
    supabase.from("projects").select("*").is("archived_at", null).order("created_at"),
    supabase.from("goals").select("id,title,level").is("archived_at", null).not("status", "in", "(completed,cancelled)"),
    supabase.from("life_areas").select("*").order("sort_order"),
    supabase.from("task_completions").select("*").gte("completed_at", addDaysISO(today, -365)).order("completed_at", { ascending: false }),
  ]);
  for (const r of [tasks, projects, goals, areas, completions]) if (r.error) throw new Error(r.error.message);
  return <TasksView tasks={tasks.data!} projects={projects.data!} goals={goals.data!} areas={areas.data!} completions={completions.data!} />;
}
