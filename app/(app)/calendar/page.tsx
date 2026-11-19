import { requireUser } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/dates";
import { expandEvents } from "@/lib/engine/calendar";
import { CalendarView, type CalItem } from "./calendar-view";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const sp = await searchParams;
  const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const from = addDaysISO(anchor, -45);
  const to = addDaysISO(anchor, 45);
  const { supabase } = await requireUser();

  const [events, tasks, workouts, study, goals, assessments, areas] = await Promise.all([
    supabase.from("events").select("*").or(`start_at.lte.${to}T23:59:59,recurrence.not.is.null`),
    supabase.from("tasks").select("id,title,due_date,due_time,status,priority,life_area_id").gte("due_date", from).lte("due_date", to).is("parent_task_id", null),
    supabase.from("workouts").select("id,name,started_at,ended_at").gte("started_at", from).lte("started_at", `${to}T23:59:59`),
    supabase.from("study_sessions").select("id,started_at,duration_minutes,subject_id,subjects(name)").gte("started_at", from).lte("started_at", `${to}T23:59:59`),
    supabase.from("goals").select("id,title,target_date,status").is("archived_at", null).gte("target_date", from).lte("target_date", to),
    supabase.from("assessments").select("id,title,due_date,kind").gte("due_date", from).lte("due_date", to),
    supabase.from("life_areas").select("id,color"),
  ]);
  for (const r of [events, tasks, workouts, study, goals, assessments, areas]) if (r.error) throw new Error(r.error.message);
  const areaColor = new Map(areas.data!.map((a) => [a.id, a.color]));

  const items: CalItem[] = [
    ...expandEvents(events.data!, from, to).map((e) => ({
      key: `e-${e.id}-${e.occurrence_date}`, source: "event" as const, id: e.id, title: e.title, date: e.occurrence_date,
      start: e.all_day ? null : e.occurrence_start, end: e.all_day ? null : e.occurrence_end, color: e.color ?? (e.life_area_id ? areaColor.get(e.life_area_id) : undefined) ?? "#6366f1",
      meta: e.kind === "reminder" ? "Reminder" : e.kind === "deadline" ? "Deadline" : e.location ?? undefined, recurring: !!e.recurrence,
    })),
    ...tasks.data!.map((t) => ({
      key: `t-${t.id}`, source: "task" as const, id: t.id, title: t.title, date: t.due_date!,
      start: t.due_time ? new Date(`${t.due_date}T${t.due_time}`).toISOString() : null, end: null,
      color: (t.life_area_id && areaColor.get(t.life_area_id)) || "#64748b", done: t.status === "done", meta: "Task",
    })),
    ...workouts.data!.map((w) => ({ key: `w-${w.id}`, source: "workout" as const, id: w.id, title: w.name, date: w.started_at.slice(0, 10), start: w.started_at, end: w.ended_at, color: "#ef4444", meta: "Workout" })),
    ...study.data!.map((s) => ({
      key: `s-${s.id}`, source: "study" as const, id: s.id, title: `Study${(s.subjects as { name: string } | null)?.name ? `: ${(s.subjects as { name: string }).name}` : ""}`,
      date: s.started_at.slice(0, 10), start: s.started_at, end: new Date(new Date(s.started_at).getTime() + s.duration_minutes * 60000).toISOString(), color: "#3b82f6", meta: `${s.duration_minutes} min`,
    })),
    ...goals.data!.map((g) => ({ key: `g-${g.id}`, source: "goal" as const, id: g.id, title: `Goal: ${g.title}`, date: g.target_date!, start: null, end: null, color: "#f59e0b", meta: "Goal deadline", done: g.status === "completed" })),
    ...assessments.data!.map((a) => ({ key: `a-${a.id}`, source: "assessment" as const, id: a.id, title: a.title, date: a.due_date!, start: null, end: null, color: "#8b5cf6", meta: a.kind === "exam" ? "Exam" : "Assignment" })),
  ];

  const view = ["day", "week", "month", "agenda"].includes(sp.view ?? "") ? (sp.view as "day" | "week" | "month" | "agenda") : "month";
  return <CalendarView anchor={anchor} view={view} items={items} events={events.data!} areas={areas.data!.map((a) => a.id)} />;
}
