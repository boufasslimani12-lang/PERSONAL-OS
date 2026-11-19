// Goal progress rules (documented in docs/ANALYTICS.md):
//  1. status "completed"  → 100
//  2. status "cancelled"  → excluded (null)
//  3. progress_mode "manual" → manual_progress
//  4. progress_mode "auto"   → equal-weighted average over every measurable unit:
//       - each non-cancelled child goal contributes its own progress (recursive)
//       - each milestone contributes 0 or 100
//       - each non-cancelled top-level task linked to the goal contributes 0 or 100
//     With no measurable units, an auto goal is at 0% (basis "empty") — we never invent progress.

export interface GoalLike {
  id: string;
  parent_id: string | null;
  status: string;
  progress_mode: string;
  manual_progress: number;
  archived_at?: string | null;
}
export interface MilestoneLike { goal_id: string | null; completed_at: string | null }
export interface TaskLike { goal_id: string | null; status: string; parent_task_id?: string | null }

export type ProgressBasis = "completed" | "manual" | "auto" | "empty" | "cancelled";
export interface GoalProgress { value: number | null; basis: ProgressBasis; units: number; doneUnits: number }

export function buildGoalProgressIndex(goals: GoalLike[], milestones: MilestoneLike[], tasks: TaskLike[]) {
  const children = new Map<string, GoalLike[]>();
  for (const g of goals) {
    if (g.parent_id) {
      const list = children.get(g.parent_id) ?? [];
      list.push(g);
      children.set(g.parent_id, list);
    }
  }
  const ms = new Map<string, MilestoneLike[]>();
  for (const m of milestones) if (m.goal_id) ms.set(m.goal_id, [...(ms.get(m.goal_id) ?? []), m]);
  const ts = new Map<string, TaskLike[]>();
  for (const t of tasks) {
    if (t.goal_id && !t.parent_task_id && t.status !== "cancelled") ts.set(t.goal_id, [...(ts.get(t.goal_id) ?? []), t]);
  }

  const memo = new Map<string, GoalProgress>();
  const visiting = new Set<string>();

  function compute(g: GoalLike): GoalProgress {
    const cached = memo.get(g.id);
    if (cached) return cached;
    if (visiting.has(g.id)) return { value: 0, basis: "empty", units: 0, doneUnits: 0 }; // cycle guard
    visiting.add(g.id);
    let result: GoalProgress;
    if (g.status === "cancelled") result = { value: null, basis: "cancelled", units: 0, doneUnits: 0 };
    else if (g.status === "completed") result = { value: 100, basis: "completed", units: 0, doneUnits: 0 };
    else if (g.progress_mode === "manual") result = { value: clampPct(g.manual_progress), basis: "manual", units: 0, doneUnits: 0 };
    else {
      const parts: number[] = [];
      for (const c of children.get(g.id) ?? []) {
        if (c.archived_at) continue;
        const p = compute(c);
        if (p.value !== null) parts.push(p.value);
      }
      for (const m of ms.get(g.id) ?? []) parts.push(m.completed_at ? 100 : 0);
      for (const t of ts.get(g.id) ?? []) parts.push(t.status === "done" ? 100 : 0);
      result = parts.length
        ? { value: parts.reduce((a, b) => a + b, 0) / parts.length, basis: "auto", units: parts.length, doneUnits: parts.filter((p) => p >= 100).length }
        : { value: 0, basis: "empty", units: 0, doneUnits: 0 };
    }
    visiting.delete(g.id);
    memo.set(g.id, result);
    return result;
  }

  const byId = new Map(goals.map((g) => [g.id, g]));
  return {
    get(id: string): GoalProgress {
      const g = byId.get(id);
      return g ? compute(g) : { value: null, basis: "empty", units: 0, doneUnits: 0 };
    },
  };
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

/** Deadline state for a goal/task/project with a target date. */
export function deadlineState(targetDate: string | null, today: string, done: boolean): "none" | "done" | "overdue" | "due_soon" | "on_track" {
  if (done) return "done";
  if (!targetDate) return "none";
  if (targetDate < today) return "overdue";
  const diff = (new Date(targetDate).getTime() - new Date(today).getTime()) / 86_400_000;
  return diff <= 7 ? "due_soon" : "on_track";
}
