import { requireUser } from "@/lib/supabase/server";
import { addMonthsISO, endOfMonthISO, startOfMonthISO, todayISO } from "@/lib/dates";
import { FinanceView } from "./finance-view";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? `${sp.month}-01` : startOfMonthISO(todayISO());
  const from = addMonthsISO(month, -11);
  const { supabase, user } = await requireUser();
  const [txs, cats, savings, profile] = await Promise.all([
    supabase.from("transactions").select("*").gte("occurred_on", from).lte("occurred_on", endOfMonthISO(month)).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("finance_categories").select("*").order("kind").order("name"),
    supabase.from("savings_goals").select("*").order("created_at"),
    supabase.from("profiles").select("currency").eq("user_id", user.id).maybeSingle(),
  ]);
  for (const r of [txs, cats, savings]) if (r.error) throw new Error(r.error.message);
  return <FinanceView month={month} txs={txs.data!} categories={cats.data!} savings={savings.data!} currency={profile.data?.currency ?? "MAD"} />;
}
