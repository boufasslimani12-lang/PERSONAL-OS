import { requireUser } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [profile, areas] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("life_areas").select("*").order("sort_order"),
  ]);
  if (areas.error) throw new Error(areas.error.message);
  return <SettingsView email={user.email ?? ""} profile={profile.data} areas={areas.data!} />;
}
