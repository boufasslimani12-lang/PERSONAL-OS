"use client";
import { useState } from "react";
import { Check, Plus, Minus } from "lucide-react";
import { useDb } from "@/lib/hooks/use-db";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "@/lib/types";

/** Toggle (binary) or stepper (measurable) for one habit on one date. Writes a target snapshot on the log. */
export function HabitCheck({ habit, log, date, compact }: { habit: Habit; log?: HabitLog; date: string; compact?: boolean }) {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const target = Number(habit.target_value);
  const value = log ? Number(log.value) : 0;
  const done = !!log?.completed;

  async function setValue(v: number) {
    setBusy(true);
    if (v <= 0) {
      if (log) await db.remove("habit_logs", log.id, "Log cleared");
    } else {
      // Keep the original target snapshot when editing an existing log — history is never rewritten.
      await db.run(
        () => db.supabase.from("habit_logs").upsert(
          { habit_id: habit.id, log_date: date, value: v, target_value: log ? Number(log.target_value) : target },
          { onConflict: "habit_id,log_date" },
        ),
        undefined,
      );
    }
    setBusy(false);
  }

  if (habit.kind === "binary") {
    return (
      <button
        disabled={busy}
        onClick={() => setValue(done ? 0 : target)}
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        className={cn("grid size-8 shrink-0 place-items-center rounded-lg border-2 transition-all disabled:opacity-50", done ? "border-transparent text-white" : "border-border hover:border-primary")}
        style={done ? { background: habit.color } : undefined}
      >
        {done && <Check className="size-4" strokeWidth={3} />}
      </button>
    );
  }
  const step = target >= 20 ? Math.round(target / 10) : 1;
  return (
    <div className={cn("flex shrink-0 items-center gap-1", busy && "opacity-60")}>
      <button className="grid size-7 place-items-center rounded-md border border-border hover:bg-muted" onClick={() => setValue(Math.max(0, value - step))} aria-label="Decrease"><Minus className="size-3.5" /></button>
      <span className={cn("min-w-14 text-center text-xs tabular-nums", done && "font-semibold text-success")}>
        {value}/{log ? Number(log.target_value) : target}{!compact && habit.unit ? ` ${habit.unit}` : ""}
      </span>
      <button className="grid size-7 place-items-center rounded-md border border-border hover:bg-muted" onClick={() => setValue(value + step)} aria-label="Increase"><Plus className="size-3.5" /></button>
    </div>
  );
}
