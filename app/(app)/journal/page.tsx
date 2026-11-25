import { requireUser } from "@/lib/supabase/server";
import { JournalView } from "./journal-view";

export const metadata = { title: "Journal & Notes" };

export default async function JournalPage() {
  const { supabase } = await requireUser();
  const [notes, areas, goals, projects, habits] = await Promise.all([
    supabase.from("notes").select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("life_areas").select("id,key,name,color,is_active").order("sort_order"),
    supabase.from("goals").select("id,title").is("archived_at", null),
    supabase.from("projects").select("id,title").is("archived_at", null),
    supabase.from("habits").select("id,name").is("archived_at", null),
  ]);
  for (const r of [notes, areas, goals, projects, habits]) if (r.error) throw new Error(r.error.message);
  return <JournalView notes={notes.data!} areas={areas.data!} goals={goals.data!} projects={projects.data!} habits={habits.data!} />;
}
