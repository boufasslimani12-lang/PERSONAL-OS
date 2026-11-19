"use client";
import { setAppTimeZone } from "@/lib/dates";

/**
 * Makes every client-side date helper (todayISO, isoFromTimestamp, formatDateTime…) use the profile time zone.
 * It runs during render, before any child view computes a date, on the server pass and in the browser alike,
 * so server HTML and hydration agree.
 */
export function DateProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  setAppTimeZone(timeZone);
  return <>{children}</>;
}
