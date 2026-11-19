import type { Tone } from "@/components/ui/misc";

export const PRIORITIES = [
  { value: "low", label: "Low", tone: "default" },
  { value: "medium", label: "Medium", tone: "info" },
  { value: "high", label: "High", tone: "warning" },
  { value: "critical", label: "Critical", tone: "danger" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export const GOAL_LEVELS = [
  { value: "annual", label: "Annual" },
  { value: "quarterly", label: "Quarterly" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
] as const;

export const GOAL_STATUSES = [
  { value: "not_started", label: "Not started", tone: "default" },
  { value: "active", label: "Active", tone: "primary" },
  { value: "on_hold", label: "On hold", tone: "warning" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "default" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export const TASK_STATUSES = [
  { value: "todo", label: "To do", tone: "default" },
  { value: "in_progress", label: "In progress", tone: "info" },
  { value: "done", label: "Done", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "default" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export const PROJECT_STATUSES = [
  { value: "idea", label: "Idea", tone: "default" },
  { value: "planned", label: "Planned", tone: "info" },
  { value: "active", label: "Active", tone: "primary" },
  { value: "on_hold", label: "On hold", tone: "warning" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "default" },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export const RECURRENCES = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

export const CEFR = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const LANGUAGE_SKILLS = ["vocabulary", "grammar", "listening", "speaking", "reading", "writing"] as const;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const CURRENCIES = ["MAD", "EUR", "USD", "GBP", "CAD", "AED", "SAR", "TRY", "CHF", "JPY"] as const;

export function optionLabel(list: readonly { value: string; label: string }[], v: string | null | undefined) {
  return list.find((x) => x.value === v)?.label ?? v ?? "";
}
export function optionTone(list: readonly { value: string; tone: Tone }[], v: string | null | undefined): Tone {
  return list.find((x) => x.value === v)?.tone ?? "default";
}
