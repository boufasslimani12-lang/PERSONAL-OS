import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/dates";
import { getDateContext } from "@/lib/server/date-context";

export async function loadHabits(module: "habits" | "religion") {
  const { supabase } = await requireUser();
  const { today, weekStartsOn } = await getDateContext();
  const from = addDaysISO(today, -400);
  const [habits, areas] = await Promise.all([
    supabase.from("habits").select("*").eq("module", module).order("sort_order").order("created_at"),
    supabase.from("life_areas").select("*").order("sort_order"),
  ]);
  for (const r of [habits, areas]) if (r.error) throw new Error(r.error.message);
  const ids = habits.data!.map((h) => h.id);
  const logs = ids.length
    ? await supabase.from("habit_logs").select("*").in("habit_id", ids).gte("log_date", from).order("log_date")
    : { data: [], error: null };
  if (logs.error) throw new Error(logs.error.message);
  return { habits: habits.data!, logs: logs.data!, areas: areas.data!, weekStartsOn };
}
