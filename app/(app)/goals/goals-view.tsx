"use client";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Target, Plus, Search, Archive, ArchiveRestore, Pencil, CheckCircle2, ChevronRight, Flag, Trash2, CalendarClock } from "lucide-react";
import { PageHeader, Badge, EmptyState, Progress, Tabs, ProgressRing } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Select, Checkbox } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { TaskRow } from "@/components/shared/task-row";
import { GOAL_LEVELS, GOAL_STATUSES, PRIORITIES, optionLabel, optionTone } from "@/lib/constants";
import { deadlineState, type GoalProgress } from "@/lib/engine/goals";
import { formatDate, relativeDayLabel, todayISO } from "@/lib/dates";
import { useDb } from "@/lib/hooks/use-db";
import { ToggleCheck } from "@/components/shared/toggle-check";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Goal, LifeArea, Row, Task } from "@/lib/types";

const LEVEL_ORDER = ["annual", "quarterly", "monthly", "weekly"];

export function GoalsView({ goals, milestones, tasks, areas, progress }: {
  goals: Goal[]; milestones: Row<"milestones">[]; tasks: Task[]; areas: LifeArea[]; progress: Record<string, GoalProgress>;
}) {
  const params = useSearchParams();
  const [level, setLevel] = useState<string>(params.get("level") ?? "all");
  const [status, setStatus] = useState("open");
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(params.get("open"));
  const form = useFormState<Goal>();
  const today = todayISO();
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  useEffect(() => { const o = params.get("open"); if (o) setDetailId(o); }, [params]);

  const matches = (g: Goal) =>
    (showArchived ? !!g.archived_at : !g.archived_at) &&
    (level === "all" || g.level === level) &&
    (status === "all" || (status === "open" ? !["completed", "cancelled"].includes(g.status) : g.status === status)) &&
    (!area || g.life_area_id === area) &&
    (!q || (g.title + " " + (g.description ?? "") + " " + (g.notes ?? "")).toLowerCase().includes(q.toLowerCase()));

  const filtered = goals.filter(matches);
  const filteredIds = new Set(filtered.map((g) => g.id));
  // Tree mode when looking at all levels: roots are goals whose parent isn't in the filtered set.
  const childrenOf = (id: string) => filtered.filter((g) => g.parent_id === id);
  const roots = level === "all" ? filtered.filter((g) => !g.parent_id || !filteredIds.has(g.parent_id)) : filtered;
  roots.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || (a.target_date ?? "9").localeCompare(b.target_date ?? "9"));

  const counts = Object.fromEntries(GOAL_LEVELS.map((l) => [l.value, goals.filter((g) => g.level === l.value && !g.archived_at).length]));

  const fields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "level", label: "Level", type: "select", required: true, options: GOAL_LEVELS },
    {
      name: "parent_id", label: "Parent goal", type: "select",
      options: goals.filter((g) => !g.archived_at && g.level !== "weekly" && g.id !== form.record?.id).map((g) => ({ value: g.id, label: `${optionLabel(GOAL_LEVELS, g.level)} · ${g.title}` })),
      help: "Annual → Quarterly → Monthly → Weekly",
    },
    { name: "life_area_id", label: "Life area", type: "select", options: areas.map((a) => ({ value: a.id, label: a.name })) },
    { name: "priority", label: "Priority", type: "select", required: true, options: PRIORITIES },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "target_date", label: "Target date", type: "date" },
    { name: "status", label: "Status", type: "select", required: true, options: GOAL_STATUSES },
    { name: "progress_mode", label: "Progress", type: "select", required: true, options: [{ value: "auto", label: "Automatic (sub-goals, milestones, tasks)" }, { value: "manual", label: "Manual" }] },
    { name: "manual_progress", label: "Manual progress (%)", type: "number", min: 0, max: 100, required: true, showIf: (v) => v.progress_mode === "manual" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const detail = detailId ? goals.find((g) => g.id === detailId) : null;

  return (
    <div>
      <PageHeader title="My Goals" description="Annual → Quarterly → Monthly → Weekly → Daily tasks" icon={Target}
        actions={<Button onClick={() => form.create({ level: level === "all" ? "annual" : level, status: "active", priority: "medium", progress_mode: "auto", manual_progress: 0, start_date: today })}><Plus /> New goal</Button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={level} onChange={setLevel} items={[{ value: "all", label: "All" }, ...GOAL_LEVELS.map((l) => ({ value: l.value, label: l.label, count: counts[l.value] }))]} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search goals…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48 pl-8" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="open">Open</option>
            <option value="all">All statuses</option>
            {GOAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Select value={area} onChange={(e) => setArea(e.target.value)} className="w-44">
            <option value="">All life areas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
        </div>
      </div>

      {roots.length === 0 ? (
        <EmptyState icon={Target} title={goals.length ? "No goals match your filters" : "Set your first goal"}
          description={goals.length ? "Try clearing filters." : "Start with an annual goal, then break it into quarterly, monthly and weekly goals."}
          action={!goals.length && <Button onClick={() => form.create({ level: "annual", status: "active", priority: "medium", progress_mode: "auto", manual_progress: 0 })}><Plus /> Create annual goal</Button>} />
      ) : (
        <Card className="divide-y divide-border">
          {roots.map((g) => (
            <GoalNode key={g.id} goal={g} depth={0} childrenOf={level === "all" ? childrenOf : () => []} progress={progress} areaById={areaById} today={today} onOpen={setDetailId} />
          ))}
        </Card>
      )}

      <EntityForm table="goals" title={form.record ? "Edit goal" : "New goal"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults}
        transform={(v) => ({ ...v, completed_at: v.status === "completed" ? (form.record?.completed_at ?? new Date().toISOString()) : null })} />

      {detail && (
        <GoalDetail goal={detail} goals={goals} milestones={milestones.filter((m) => m.goal_id === detail.id)} tasks={tasks.filter((t) => t.goal_id === detail.id)}
          progress={progress[detail.id]} area={detail.life_area_id ? areaById.get(detail.life_area_id) : undefined} onClose={() => setDetailId(null)}
          onEdit={() => form.edit(detail)} onOpenGoal={setDetailId} onAddChild={() => {
            const next = LEVEL_ORDER[LEVEL_ORDER.indexOf(detail.level) + 1];
            form.create({ level: next ?? "weekly", parent_id: detail.id, life_area_id: detail.life_area_id, status: "active", priority: detail.priority, progress_mode: "auto", manual_progress: 0, start_date: today });
          }} />
      )}
    </div>
  );
}

function DeadlineBadge({ goal, today }: { goal: Goal; today: string }) {
  const st = deadlineState(goal.target_date, today, goal.status === "completed");
  if (st === "none" || st === "done" || !goal.target_date) return null;
  return <Badge tone={st === "overdue" ? "danger" : st === "due_soon" ? "warning" : "default"}><CalendarClock className="size-3" />{relativeDayLabel(goal.target_date, today)}</Badge>;
}

function GoalNode({ goal, depth, childrenOf, progress, areaById, today, onOpen }: {
  goal: Goal; depth: number; childrenOf: (id: string) => Goal[]; progress: Record<string, GoalProgress>; areaById: Map<string, LifeArea>; today: string; onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const kids = childrenOf(goal.id);
  const p = progress[goal.id];
  const area = goal.life_area_id ? areaById.get(goal.life_area_id) : undefined;
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-3 hover:bg-muted/40" style={{ paddingLeft: 12 + depth * 22 }}>
        <button onClick={() => setOpen(!open)} className={cn("grid size-5 place-items-center rounded text-muted-foreground", !kids.length && "invisible")} aria-label="Toggle sub-goals">
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <button onClick={() => onOpen(goal.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <Badge tone="primary">{optionLabel(GOAL_LEVELS, goal.level)}</Badge>
              <span className={cn("truncate text-sm font-medium", goal.status === "completed" && "text-muted-foreground line-through")}>{goal.title}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {area && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: area.color }} />{area.name}</span>}
              {goal.status !== "active" && <Badge tone={optionTone(GOAL_STATUSES, goal.status)}>{optionLabel(GOAL_STATUSES, goal.status)}</Badge>}
              {goal.priority !== "medium" && <Badge tone={optionTone(PRIORITIES, goal.priority)}>{optionLabel(PRIORITIES, goal.priority)}</Badge>}
              <DeadlineBadge goal={goal} today={today} />
            </span>
          </span>
          <span className="flex w-40 items-center gap-2">
            <Progress value={p?.value ?? 0} color={area?.color} />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{formatPct(p?.value)}</span>
          </span>
        </button>
      </div>
      {open && kids.map((k) => <GoalNode key={k.id} goal={k} depth={depth + 1} childrenOf={childrenOf} progress={progress} areaById={areaById} today={today} onOpen={onOpen} />)}
    </div>
  );
}

function GoalDetail({ goal, goals, milestones, tasks, progress, area, onClose, onEdit, onOpenGoal, onAddChild }: {
  goal: Goal; goals: Goal[]; milestones: Row<"milestones">[]; tasks: Task[]; progress?: GoalProgress; area?: LifeArea;
  onClose: () => void; onEdit: () => void; onOpenGoal: (id: string) => void; onAddChild: () => void;
}) {
  const db = useDb();
  const [ms, setMs] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const today = todayISO();
  const parent = goal.parent_id ? goals.find((g) => g.id === goal.parent_id) : null;
  const children = goals.filter((g) => g.parent_id === goal.id && !g.archived_at);
  const topTasks = tasks.filter((t) => !t.parent_task_id);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!ms.trim()) return;
    if (await db.insert("milestones", { goal_id: goal.id, title: ms.trim(), sort_order: milestones.length }, "Milestone added")) setMs("");
  }
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    if (await db.insert("tasks", { title: taskTitle.trim(), goal_id: goal.id, life_area_id: goal.life_area_id, due_date: taskDue || null }, "Task added")) { setTaskTitle(""); setTaskDue(""); }
  }

  return (
    <Dialog open onClose={onClose} title={goal.title} description={`${optionLabel(GOAL_LEVELS, goal.level)} goal${area ? ` · ${area.name}` : ""}`} className="w-[min(100vw-1.5rem,44rem)]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={progress?.value ?? 0} color={area?.color} />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {progress?.basis === "manual" && "Manual progress"}
              {progress?.basis === "auto" && `Automatic: ${progress.doneUnits} of ${progress.units} items complete (sub-goals, milestones, tasks)`}
              {progress?.basis === "empty" && "Automatic: add sub-goals, milestones or tasks to measure progress"}
              {progress?.basis === "completed" && `Completed ${goal.completed_at ? formatDate(goal.completed_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" }) : ""}`}
              {progress?.basis === "cancelled" && "Cancelled — excluded from progress"}
            </p>
            <p>{goal.start_date && `Start ${formatDate(goal.start_date)}`}{goal.target_date && ` · Target ${formatDate(goal.target_date, { month: "short", day: "numeric", year: "numeric" })}`}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={optionTone(GOAL_STATUSES, goal.status)}>{optionLabel(GOAL_STATUSES, goal.status)}</Badge>
              <Badge tone={optionTone(PRIORITIES, goal.priority)}>{optionLabel(PRIORITIES, goal.priority)} priority</Badge>
              <DeadlineBadge goal={goal} today={today} />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
            {goal.status !== "completed" && (
              <Button size="sm" variant="outline" onClick={() => db.update("goals", goal.id, { status: "completed", completed_at: new Date().toISOString() }, "Goal completed 🎉")}><CheckCircle2 /> Complete</Button>
            )}
            <Button size="sm" variant="ghost" onClick={async () => { await db.update("goals", goal.id, { archived_at: goal.archived_at ? null : new Date().toISOString() }, goal.archived_at ? "Restored" : "Archived"); onClose(); }}>
              {goal.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
            </Button>
          </div>
        </div>

        {goal.description && <p className="whitespace-pre-wrap text-sm">{goal.description}</p>}
        {parent && <p className="text-xs text-muted-foreground">Part of: <button className="text-primary hover:underline" onClick={() => onOpenGoal(parent.id)}>{parent.title}</button></p>}

        {goal.level !== "weekly" && (
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Sub-goals</h3><Button size="sm" variant="ghost" onClick={onAddChild}><Plus /> Add</Button></div>
            {children.length ? (
              <ul className="space-y-2">
                {children.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => onOpenGoal(c.id)} className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted/50">
                      <Badge>{optionLabel(GOAL_LEVELS, c.level)}</Badge><span className="flex-1 truncate">{c.title}</span><span className="text-xs text-muted-foreground">{optionLabel(GOAL_STATUSES, c.status)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No sub-goals yet.</p>}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
          <ul className="space-y-1">
            {milestones.map((m) => (
              <li key={m.id} className="group flex items-center gap-2 text-sm">
                <ToggleCheck label="Toggle complete" checked={!!m.completed_at} onToggle={(next) => db.update("milestones", m.id, { completed_at: next ? new Date().toISOString() : null }, undefined)} />
                <span className={cn("flex-1", m.completed_at && "text-muted-foreground line-through")}>{m.title}</span>
                {m.due_date && <span className="text-xs text-muted-foreground">{formatDate(m.due_date)}</span>}
                <button className="opacity-0 group-hover:opacity-100" onClick={() => db.remove("milestones", m.id)} aria-label="Delete milestone"><Trash2 className="size-3.5 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <form onSubmit={addMilestone} className="mt-2 flex gap-2"><Input placeholder="Add a milestone…" value={ms} onChange={(e) => setMs(e.target.value)} /><Button type="submit" variant="outline" size="sm" className="h-9"><Flag /> Add</Button></form>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Related tasks</h3>
          <div className="-mx-2">{topTasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          {!topTasks.length && <p className="text-xs text-muted-foreground">No tasks linked yet.</p>}
          <form onSubmit={addTask} className="mt-2 flex gap-2">
            <Input placeholder="Add a task for this goal…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="w-40" />
            <Button type="submit" variant="outline" size="sm" className="h-9"><Plus /></Button>
          </form>
        </section>

        {goal.notes && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{goal.notes}</p>
          </section>
        )}
      </div>
    </Dialog>
  );
}
