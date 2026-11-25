import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/supabase/server";
import { buildZoneRules, dateInZone, hourInZone, isValidTimeZone, type ZoneRules } from "@/lib/dates";

export const DEFAULT_TIME_ZONE = "Africa/Casablanca";

// Offset rules for the profile zone (±2 years), built from the server's tz data and sent to the browser so both
// sides convert identically. Cached per zone per day; a few thousand Intl calls on a miss.
const rulesCache = new Map<string, ZoneRules>();
function zoneRules(tz: string, now: Date): ZoneRules {
  const key = `${tz}|${now.toISOString().slice(0, 10)}`;
  let rules = rulesCache.get(key);
  if (!rules) {
    const year = 365 * 86_400_000;
    rules = buildZoneRules(tz, now.getTime() - 2 * year, now.getTime() + 2 * year);
    if (rulesCache.size > 50) rulesCache.clear();
    rulesCache.set(key, rules);
  }
  return rules;
}

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
    rules: zoneRules(tz, now),
    today: dateInZone(now, tz),
    hour: hourInZone(now, tz),
    weekStartsOn: data?.week_starts_on ?? 1,
    /** Calendar day of a timestamp in the user's zone. */
    dateOf: (ts: string) => dateInZone(new Date(ts), tz),
  };
});
