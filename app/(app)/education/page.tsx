import { requireUser } from "@/lib/supabase/server";
import { EducationView } from "./education-view";

export const metadata = { title: "Education" };

export default async function EducationPage() {
  const { supabase } = await requireUser();
  const [years, semesters, subjects, courses, chapters, lessons, sessions, assessments] = await Promise.all([
    supabase.from("academic_years").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("semesters").select("*").order("start_date", { nullsFirst: false }).order("created_at"),
    supabase.from("subjects").select("*").order("name"),
    supabase.from("courses").select("*").order("sort_order").order("created_at"),
    supabase.from("chapters").select("*").order("sort_order").order("created_at"),
    supabase.from("lessons").select("*").order("sort_order").order("created_at"),
    supabase.from("study_sessions").select("*").order("started_at", { ascending: false }),
    supabase.from("assessments").select("*").order("due_date", { nullsFirst: false }),
  ]);
  for (const r of [years, semesters, subjects, courses, chapters, lessons, sessions, assessments]) if (r.error) throw new Error(r.error.message);
  return <EducationView years={years.data!} semesters={semesters.data!} subjects={subjects.data!} courses={courses.data!} chapters={chapters.data!} lessons={lessons.data!} sessions={sessions.data!} assessments={assessments.data!} />;
}
