import { requireUser } from "@/lib/supabase/server";
import { LanguagesView } from "./languages-view";

export const metadata = { title: "Languages" };

export default async function LanguagesPage() {
  const { supabase } = await requireUser();
  const [languages, sessions, vocab, resources] = await Promise.all([
    supabase.from("languages").select("*").order("created_at"),
    supabase.from("language_sessions").select("*").order("session_date", { ascending: false }),
    supabase.from("vocabulary").select("*").order("next_review_on"),
    supabase.from("resources").select("*").not("language_id", "is", null).order("created_at"),
  ]);
  for (const r of [languages, sessions, vocab, resources]) if (r.error) throw new Error(r.error.message);
  return <LanguagesView languages={languages.data!} sessions={sessions.data!} vocab={vocab.data!} resources={resources.data!} />;
}
