"use client";
import { useDb } from "./use-db";
import { nextOccurrence, type Recurrence } from "@/lib/engine/tasks";
import { todayISO } from "@/lib/dates";
import type { Task } from "@/lib/types";

/**
 * Completing a task always writes a task_completions row (history).
 * - Recurring task with a due date → the task rolls forward to its next occurrence.
 * - Otherwise → status becomes "done".
 * Un-completing a one-off task removes its latest completion row.
 */
export function useTaskActions() {
  const db = useDb();

  async function complete(t: Pick<Task, "id" | "due_date" | "recurrence" | "recurrence_interval" | "status">) {
    const occurrence = t.due_date ?? todayISO();
    const { error } = await db.supabase.from("task_completions").insert({ task_id: t.id, occurrence_date: occurrence });
    if (error) return db.toast(error.message, "error");
    if (t.recurrence && t.due_date) {
      return db.update("tasks", t.id, { due_date: nextOccurrence(t.due_date, t.recurrence as Recurrence, t.recurrence_interval), status: "todo" }, "Done — next occurrence scheduled");
    }
    return db.update("tasks", t.id, { status: "done", completed_at: new Date().toISOString() }, "Task completed");
  }

  async function reopen(t: Pick<Task, "id">) {
    const { data } = await db.supabase.from("task_completions").select("id").eq("task_id", t.id).order("completed_at", { ascending: false }).limit(1);
    if (data?.[0]) await db.supabase.from("task_completions").delete().eq("id", data[0].id);
    return db.update("tasks", t.id, { status: "todo", completed_at: null }, "Task reopened");
  }

  async function setStatus(t: Task, status: string) {
    if (status === "done" && t.status !== "done") return complete(t);
    if (t.status === "done" && status !== "done") {
      await reopen(t);
      if (status !== "todo") return db.update("tasks", t.id, { status }, undefined);
      return;
    }
    return db.update("tasks", t.id, { status }, undefined);
  }

  return { complete, reopen, setStatus, pending: db.pending };
}
