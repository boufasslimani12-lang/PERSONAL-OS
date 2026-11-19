"use client";
import Link from "next/link";
import { Check, Repeat, CornerDownRight } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { PRIORITIES, optionLabel, optionTone } from "@/lib/constants";
import { relativeDayLabel, todayISO } from "@/lib/dates";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function TaskCheck({ task, size = "md" }: { task: Task; size?: "sm" | "md" }) {
  const { complete, reopen, pending } = useTaskActions();
  const done = task.status === "done";
  return (
    <button
      disabled={pending}
      onClick={(e) => { e.stopPropagation(); return done ? reopen(task) : complete(task); }}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50",
        size === "sm" ? "size-4" : "size-5",
        done ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-primary",
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function TaskRow({ task, onOpen, subtaskCount, areaName, projectName, showDate = true }: {
  task: Task; onOpen?: (t: Task) => void; subtaskCount?: { done: number; total: number }; areaName?: string; projectName?: string; showDate?: boolean;
}) {
  const today = todayISO();
  const overdue = task.status !== "done" && task.due_date && task.due_date < today;
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
      onClick={() => onOpen?.(task)}
      role={onOpen ? "button" : undefined}
    >
      <TaskCheck task={task} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", task.status === "done" && "text-muted-foreground line-through")}>
          {task.parent_task_id && <CornerDownRight className="mr-1 inline size-3 text-muted-foreground" />}
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {showDate && task.due_date && <span className={cn(overdue && "font-medium text-destructive")}>{relativeDayLabel(task.due_date, today)}{task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}</span>}
          {task.recurrence && <span className="inline-flex items-center gap-0.5"><Repeat className="size-3" />{task.recurrence}</span>}
          {projectName && <span>· {projectName}</span>}
          {areaName && <span>· {areaName}</span>}
          {subtaskCount && subtaskCount.total > 0 && <span>· {subtaskCount.done}/{subtaskCount.total} subtasks</span>}
        </div>
      </div>
      {task.priority !== "medium" && <Badge tone={optionTone(PRIORITIES, task.priority)}>{optionLabel(PRIORITIES, task.priority)}</Badge>}
    </div>
  );
}

export function TaskLinkList({ tasks }: { tasks: Task[] }) {
  return (
    <div className="-mx-2">
      {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
      <Link href="/tasks" className="mt-1 block px-2 text-xs text-primary hover:underline">Open tasks →</Link>
    </div>
  );
}
