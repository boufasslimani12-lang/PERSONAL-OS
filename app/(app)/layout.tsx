import { requireUser } from "@/lib/supabase/server";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { SetupRequired } from "@/components/layout/setup-required";
import { missingSupabaseEnv } from "@/lib/supabase/config";
import { DateProvider } from "@/components/providers/date-provider";
import { getDateContext } from "@/lib/server/date-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const missing = missingSupabaseEnv();
  if (missing.length) return <SetupRequired missing={missing} />;
  const { supabase, user } = await requireUser();
  const [{ data: profile }, dates] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    getDateContext(),
  ]);
  return (
    <DateProvider timeZone={dates.tz}>
    <div className="flex min-h-dvh">
      <Sidebar name={profile?.display_name ?? user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>
    </div>
    </DateProvider>
  );
}
