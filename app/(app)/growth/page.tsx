import { requireUser } from "@/lib/supabase/server";
import { GrowthView } from "./growth-view";

export const metadata = { title: "Personal Growth" };

export default async function GrowthPage() {
  const { supabase } = await requireUser();
  const [books, items] = await Promise.all([
    supabase.from("books").select("*").order("updated_at", { ascending: false }),
    supabase.from("growth_items").select("*").order("occurred_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);
  for (const r of [books, items]) if (r.error) throw new Error(r.error.message);
  return <GrowthView books={books.data!} items={items.data!} />;
}
