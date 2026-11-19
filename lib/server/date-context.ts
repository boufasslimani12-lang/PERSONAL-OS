import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/supabase/server";
import { dateInZone, hourInZone, isValidTimeZone } from "@/lib/dates";

export const DEFAULT_TIME_ZONE = "Africa/Casablanca";

/**
 * The signed-in user's date context, computed in their profile time zone (never the server's, which is UTC on Vercel).
 * Cached per request.
 */
export const getDateContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("timezone, week_starts_on").eq("user_id", user.id).maybeSingle();
  const tz = isValidTimeZone(data?.timezone) ? data!.timezone : DEFAULT_TIME_ZONE;
  const now = new Date();
  return {
    tz,
    today: dateInZone(now, tz),
    hour: hourInZone(now, tz),
    weekStartsOn: data?.week_starts_on ?? 1,
    /** Calendar day of a timestamp in the user's zone. */
    dateOf: (ts: string) => dateInZone(new Date(ts), tz),
  };
});
