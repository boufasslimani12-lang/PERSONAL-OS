import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { getDateContext } from "@/lib/server/date-context";
import { addDaysISO, startOfMonthISO, addMonthsISO, endOfMonthISO } from "@/lib/dates";
import { buildGoalProgressIndex } from "@/lib/engine/goals";
import { aggregateConsistency } from "@/lib/engine/habits";
import { taskCompletionRate } from "@/lib/engine/tasks";
import { scoreArea, overallProgress, type AreaScore } from "@/lib/engine/life-areas";

export const SCORE_WINDOW_DAYS = 30;

/**
 * Loads everything the life-progress engine needs and computes area scores.
 * Shared by the dashboard and analytics so both show identical numbers.
 */
export async function loadLifeSnapshot() {
  const { supabase, user } = await requireUser();
  const dates = await getDateContext();
  const { today, tz } = dates;
  const historyFrom = addMonthsISO(startOfMonthISO(today), -6);

  const [profile, areas, goals, milestones, tasks, completions, habits, habitLogs] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("life_areas").select("*").order("sort_order"),
    supabase.from("goals").select("*").is("archived_at", null).order("target_date", { ascending: true, nullsFirst: false }),
    supabase.from("milestones").select("*").not("goal_id", "is", null),
    supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("task_completions").select("*").gte("completed_at", historyFrom),
    supabase.from("habits").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("habit_logs").select("*").gte("log_date", historyFrom),
  ]);

  const err = [profile, areas, goals, milestones, tasks, completions, habits, habitLogs].find((r) => r.error)?.error;
  if (err) throw new Error(err.message);

  const weekStartsOn = dates.weekStartsOn;
  const goalIndex = buildGoalProgressIndex(goals.data!, milestones.data!, tasks.data!);
  const from = addDaysISO(today, -(SCORE_WINDOW_DAYS - 1));
  const goalsById = new Map(goals.data!.map((g) => [g.id, g]));
  const taskIdsByArea = new Map<string, Set<string>>();
  for (const t of tasks.data!) if (t.life_area_id) taskIdsByArea.set(t.life_area_id, (taskIdsByArea.get(t.life_area_id) ?? new Set()).add(t.id));

  const scores: (AreaScore & { name: string; color: string; key: string; icon: string })[] = areas.data!
    .filter((a) => a.is_active)
    .map((a) => {
      // top-level within the area: no parent, or parent belongs to another area (avoids double counting)
      const areaGoals = goals.data!.filter(
        (g) => g.life_area_id === a.id && g.status !== "cancelled" && (!g.parent_id || goalsById.get(g.parent_id)?.life_area_id !== a.id),
      );
      const goalProgress = areaGoals.map((g) => goalIndex.get(g.id).value).filter((v): v is number => v !== null);
      const areaTasks = tasks.data!.filter((t) => t.life_area_id === a.id);
      const ids = taskIdsByArea.get(a.id) ?? new Set();
      const tr = taskCompletionRate(areaTasks, completions.data!.filter((c) => ids.has(c.task_id)), from, today, today, tz);
      const areaHabits = habits.data!.filter((h) => h.life_area_id === a.id);
      const hr = aggregateConsistency(areaHabits, habitLogs.data!, from, today, today, weekStartsOn);
      return { ...scoreArea({ id: a.id, goalProgress, taskRate: tr.rate, habitRate: hr.rate }), name: a.name, color: a.color, key: a.key, icon: a.icon };
    });

  return {
    supabase,
    user,
    today,
    tz,
    dates,
    profile: profile.data,
    weekStartsOn,
    areas: areas.data!,
    goals: goals.data!,
    milestones: milestones.data!,
    tasks: tasks.data!,
    completions: completions.data!,
    habits: habits.data!,
    habitLogs: habitLogs.data!,
    goalIndex,
    scores,
    overall: overallProgress(scores),
    window: { from, to: today },
    month: { from: startOfMonthISO(today), to: endOfMonthISO(today) },
  };
}
