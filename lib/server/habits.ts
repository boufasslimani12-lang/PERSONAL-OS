import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/dates";

export async function loadHabits(module: "habits" | "religion") {
  const { supabase, user } = await requireUser();
  const from = addDaysISO(todayISO(), -400);
  const [habits, areas, profile] = await Promise.all([
    supabase.from("habits").select("*").eq("module", module).order("sort_order").order("created_at"),
    supabase.from("life_areas").select("*").order("sort_order"),
    supabase.from("profiles").select("week_starts_on").eq("user_id", user.id).maybeSingle(),
  ]);
  for (const r of [habits, areas]) if (r.error) throw new Error(r.error.message);
  const ids = habits.data!.map((h) => h.id);
  const logs = ids.length
    ? await supabase.from("habit_logs").select("*").in("habit_id", ids).gte("log_date", from).order("log_date")
    : { data: [], error: null };
  if (logs.error) throw new Error(logs.error.message);
  return { habits: habits.data!, logs: logs.data!, areas: areas.data!, weekStartsOn: profile.data?.week_starts_on ?? 1 };
}
