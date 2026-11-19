import "server-only";
import { requireUser } from "@/lib/supabase/server";

export async function loadSkills(kind: "hard" | "soft") {
  const { supabase } = await requireUser();
  const skills = await supabase.from("skills").select("*").eq("kind", kind).order("created_at");
  if (skills.error) throw new Error(skills.error.message);
  const ids = skills.data.map((s) => s.id);
  if (!ids.length) return { skills: [], sessions: [], assessments: [], milestones: [], resources: [] };
  const [sessions, assessments, milestones, resources] = await Promise.all([
    supabase.from("skill_sessions").select("*").in("skill_id", ids).order("session_date", { ascending: false }),
    supabase.from("skill_assessments").select("*").in("skill_id", ids).order("assessed_on"),
    supabase.from("milestones").select("*").in("skill_id", ids).order("sort_order").order("created_at"),
    supabase.from("resources").select("*").in("skill_id", ids).order("created_at"),
  ]);
  for (const r of [sessions, assessments, milestones, resources]) if (r.error) throw new Error(r.error.message);
  return { skills: skills.data, sessions: sessions.data!, assessments: assessments.data!, milestones: milestones.data!, resources: resources.data! };
}
