"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListChecks, Plus, LayoutList, Columns3, FolderKanban, Pencil, History, Search } from "lucide-react";
import { PageHeader, Badge, EmptyState, Tabs, Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { TaskRow, TaskCheck } from "@/components/shared/task-row";
import { PRIORITIES, PROJECT_STATUSES, RECURRENCES, TASK_STATUSES, optionLabel, optionTone } from "@/lib/constants";
import { addDaysISO, formatDate, formatDateTime, relativeDayLabel, todayISO } from "@/lib/dates";
import { compareTasks } from "@/lib/engine/tasks";
import { useDb } from "@/lib/hooks/use-db";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { cn } from "@/lib/utils";
import { areaOptions } from "@/lib/life-areas";
import type { LifeArea, Project, Row, Task } from "@/lib/types";

type View = "today" | "upcoming" | "all" | "overdue" | "completed" | "projects" | "areas";

export function TasksView({ tasks, projects, goals, areas, completions }: {
  tasks: Task[]; projects: Project[]; goals: { id: string; title: string; level: string }[]; areas: LifeArea[]; completions: Row<"task_completions">[];
}) {
  const params = useSearchParams();
  const [view, setView] = useState<View>((params.get("view") as View) ?? "today");
  const [layout, setLayout] = useState<"list" | "kanban">("list");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const form = useFormState<Task>();
  const projectForm = useFormState<Project>();
  const db = useDb();
  const today = todayISO();
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const top = tasks.filter((t) => !t.parent_task_id);
  const sub = (id: string) => tasks.filter((t) => t.parent_task_id === id);
  const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled";
  const search = (t: Task) => !q || (t.title + " " + (t.description ?? "") + " " + (t.category ?? "")).toLowerCase().includes(q.toLowerCase());

  const sets: Record<Exclude<View, "projects" | "areas">, Task[]> = {
    today: top.filter((t) => isOpen(t) && t.due_date && t.due_date <= today),
    upcoming: top.filter((t) => isOpen(t) && t.due_date && t.due_date > today),
    all: top.filter(isOpen),
    overdue: top.filter((t) => isOpen(t) && t.due_date && t.due_date < today),
    completed: top.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  };

  const fields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "due_date", label: "Due date", type: "date" },
    { name: "due_time", label: "Time", type: "time" },
    { name: "priority", label: "Priority", type: "select", required: true, options: PRIORITIES },
    { name: "status", label: "Status", type: "select", required: true, options: TASK_STATUSES },
    { name: "project_id", label: "Project", type: "select", options: projects.map((p) => ({ value: p.id, label: p.title })) },
    { name: "goal_id", label: "Goal", type: "select", options: goals.map((g) => ({ value: g.id, label: g.title })) },
    { name: "life_area_id", label: "Life area", type: "select", options: areaOptions(areas, form.record?.life_area_id ?? (form.defaults?.life_area_id as string | undefined)) },
    { name: "category", label: "Category", placeholder: "e.g. admin, deep work" },
    { name: "recurrence", label: "Repeats", type: "select", options: RECURRENCES, help: "Recurring tasks need a due date" },
    { name: "recurrence_interval", label: "Every N periods", type: "number", min: 1, max: 365, required: true, showIf: (v) => !!v.recurrence && v.recurrence !== "weekdays" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const projectFields: Field[] = [
    { name: "title", label: "Project name", required: true, full: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "status", label: "Status", type: "select", required: true, options: PROJECT_STATUSES },
    { name: "life_area_id", label: "Life area", type: "select", options: areaOptions(areas, projectForm.record?.life_area_id ?? (projectForm.defaults?.life_area_id as string | undefined)) },
    { name: "goal_id", label: "Goal", type: "select", options: goals.map((g) => ({ value: g.id, label: g.title })) },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "due_date", label: "Due date", type: "date" },
    { name: "color", label: "Color", type: "color" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    const due = view === "today" ? today : view === "upcoming" ? addDaysISO(today, 1) : null;
    if (await db.insert("tasks", { title, due_date: due }, "Task added")) setQuick("");
  }

  const newDefaults = () => ({ priority: "medium", status: "todo", recurrence_interval: 1, due_date: view === "today" ? today : null });
  const detail = detailId ? tasks.find((t) => t.id === detailId) : null;

  const list = view === "projects" || view === "areas" ? [] : sets[view].filter(search).sort(view === "completed" ? () => 0 : compareTasks);

  return (
    <div>
      <PageHeader title="Tasks & Projects" icon={ListChecks} description="Plan, prioritise and complete your work"
        actions={<>
          <Button variant="outline" onClick={() => projectForm.create({ status: "active", kind: "general" })}><FolderKanban /> New project</Button>
          <Button onClick={() => form.create(newDefaults())}><Plus /> New task</Button>
        </>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={view} onChange={setView} items={[
          { value: "today", label: "Today", count: sets.today.length },
          { value: "upcoming", label: "Upcoming", count: sets.upcoming.length },
          { value: "all", label: "All", count: sets.all.length },
          { value: "overdue", label: "Overdue", count: sets.overdue.length },
          { value: "completed", label: "Completed" },
          { value: "projects", label: "By project" },
          { value: "areas", label: "By life area" },
        ]} />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-44 pl-8" />
          </div>
          {view !== "projects" && view !== "areas" && (
            <div className="flex rounded-lg border border-border p-0.5">
              <button className={cn("rounded-md p-1.5", layout === "list" && "bg-muted")} onClick={() => setLayout("list")} aria-label="List view"><LayoutList className="size-4" /></button>
              <button className={cn("rounded-md p-1.5", layout === "kanban" && "bg-muted")} onClick={() => setLayout("kanban")} aria-label="Kanban view"><Columns3 className="size-4" /></button>
            </div>
          )}
        </div>
      </div>

      {view !== "completed" && view !== "projects" && view !== "areas" && (
        <form onSubmit={quickAdd} className="mb-4 flex gap-2">
          <Input placeholder={`Quick add a task${view === "today" ? " for today" : ""}… (press Enter)`} value={quick} onChange={(e) => setQuick(e.target.value)} />
          <Button type="submit" variant="outline" className="h-9" aria-label="Add task"><Plus /></Button>
        </form>
      )}

      {view === "projects" ? (
        <ProjectsBoard projects={projects} tasks={top} search={search} areaById={areaById} onEditProject={projectForm.edit} onOpenTask={(t) => setDetailId(t.id)} onAddTask={(p) => form.create({ ...newDefaults(), project_id: p.id, life_area_id: p.life_area_id })} />
      ) : view === "areas" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...areas, null].map((a) => {
            const ts = top.filter((t) => isOpen(t) && search(t) && (a ? t.life_area_id === a.id : !t.life_area_id)).sort(compareTasks);
            if (!ts.length) return null;
            return (
              <Card key={a?.id ?? "none"}>
                <CardHeader><CardTitle className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: a?.color ?? "var(--muted-foreground)" }} />{a?.name ?? "No life area"} <span className="font-normal text-muted-foreground">{ts.length}</span></CardTitle></CardHeader>
                <CardContent className="-mx-2">{ts.map((t) => <TaskRow key={t.id} task={t} onOpen={(x) => setDetailId(x.id)} />)}</CardContent>
              </Card>
            );
          })}
          {!top.some(isOpen) && <EmptyState icon={ListChecks} title="No open tasks" className="md:col-span-2" />}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={ListChecks} title={view === "today" ? "You're clear for today" : view === "overdue" ? "Nothing overdue" : "No tasks here"} description="Use quick add above or create a detailed task." />
      ) : layout === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(["todo", "in_progress", "done"] as const).map((st) => {
            const col = view === "completed" ? (st === "done" ? list : []) : list.filter((t) => t.status === st);
            return <KanbanColumn key={st} status={st} tasks={col} projectById={projectById} onOpen={(t) => setDetailId(t.id)} />;
          })}
        </div>
      ) : (
        <Card className="p-2">
          {list.map((t) => {
            const s = sub(t.id);
            return <TaskRow key={t.id} task={t} onOpen={(x) => setDetailId(x.id)} projectName={t.project_id ? projectById.get(t.project_id)?.title : undefined}
              areaName={t.life_area_id ? areaById.get(t.life_area_id)?.name : undefined} subtaskCount={{ done: s.filter((x) => x.status === "done").length, total: s.length }} />;
          })}
        </Card>
      )}

      <EntityForm table="tasks" title={form.record ? "Edit task" : "New task"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults}
        transform={(v) => ({ ...v, recurrence: v.due_date ? v.recurrence : null, recurrence_interval: v.recurrence_interval ?? 1 })} />
      <EntityForm table="projects" title={projectForm.record ? "Edit project" : "New project"} fields={projectFields} open={projectForm.open} onClose={projectForm.close} record={projectForm.record} defaults={projectForm.defaults}
        transform={(v) => ({ ...v, completed_at: v.status === "completed" ? new Date().toISOString() : null })} />

      {detail && (
        <TaskDetail task={detail} subtasks={sub(detail.id)} history={completions.filter((c) => c.task_id === detail.id)} project={detail.project_id ? projectById.get(detail.project_id) : undefined}
          goal={goals.find((g) => g.id === detail.goal_id)} area={detail.life_area_id ? areaById.get(detail.life_area_id) : undefined}
          onClose={() => setDetailId(null)} onEdit={() => { form.edit(detail); setDetailId(null); }} />
      )}
    </div>
  );
}

function KanbanColumn({ status, tasks, projectById, onOpen }: { status: string; tasks: Task[]; projectById: Map<string, Project>; onOpen: (t: Task) => void }) {
  const { setStatus } = useTaskActions();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const t = JSON.parse(e.dataTransfer.getData("application/json")) as Task;
        if (t.status !== status) setStatus(t, status);
      }}
      className={cn("min-h-40 rounded-xl border border-border bg-muted/40 p-2", over && "ring-2 ring-ring")}
    >
      <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">{optionLabel(TASK_STATUSES, status)} <span className="text-muted-foreground">{tasks.length}</span></p>
      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(t))} onClick={() => onOpen(t)}
            className="cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing">
            <div className="flex items-start gap-2">
              <TaskCheck task={t} size="sm" />
              <p className="flex-1 text-sm leading-tight">{t.title}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.due_date && <Badge tone={t.due_date < todayISO() && t.status !== "done" ? "danger" : "default"}>{relativeDayLabel(t.due_date)}</Badge>}
              {t.priority !== "medium" && <Badge tone={optionTone(PRIORITIES, t.priority)}>{optionLabel(PRIORITIES, t.priority)}</Badge>}
              {t.project_id && <Badge>{projectById.get(t.project_id)?.title}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsBoard({ projects, tasks, search, areaById, onEditProject, onOpenTask, onAddTask }: {
  projects: Project[]; tasks: Task[]; search: (t: Task) => boolean; areaById: Map<string, LifeArea>; onEditProject: (p: Project) => void; onOpenTask: (t: Task) => void; onAddTask: (p: Project) => void;
}) {
  if (!projects.length) return <EmptyState icon={FolderKanban} title="No projects yet" description="Group related tasks into projects to track them together." />;
  const unassigned = tasks.filter((t) => !t.project_id && t.status !== "done" && t.status !== "cancelled" && search(t));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => {
        const ts = tasks.filter((t) => t.project_id === p.id && t.status !== "cancelled");
        const done = ts.filter((t) => t.status === "done").length;
        const open = ts.filter((t) => t.status !== "done" && search(t)).sort(compareTasks);
        const area = p.life_area_id ? areaById.get(p.life_area_id) : undefined;
        return (
          <Card key={p.id}>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: p.color ?? area?.color ?? "var(--primary)" }} />{p.title}</CardTitle>
                <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <Badge tone={optionTone(PROJECT_STATUSES, p.status)}>{optionLabel(PROJECT_STATUSES, p.status)}</Badge>
                  {p.due_date && <span>Due {formatDate(p.due_date)}</span>}
                  {area && <span>· {area.name}</span>}
                </p>
              </div>
              <div className="flex">
                <Button size="icon" variant="ghost" onClick={() => onAddTask(p)} aria-label="Add task"><Plus /></Button>
                <Button size="icon" variant="ghost" onClick={() => onEditProject(p)} aria-label="Edit project"><Pencil /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={ts.length ? (done / ts.length) * 100 : 0} color={p.color ?? undefined} /><span className="whitespace-nowrap tabular-nums">{done}/{ts.length}</span></div>
              <div className="-mx-2">{open.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} onOpen={onOpenTask} />)}</div>
              {open.length > 6 && <p className="px-1 text-xs text-muted-foreground">+{open.length - 6} more</p>}
            </CardContent>
          </Card>
        );
      })}
      {unassigned.length > 0 && (
        <Card>
          <CardHeader><CardTitle>No project <span className="font-normal text-muted-foreground">{unassigned.length}</span></CardTitle></CardHeader>
          <CardContent className="-mx-2">{unassigned.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} onOpen={onOpenTask} />)}</CardContent>
        </Card>
      )}
    </div>
  );
}

function TaskDetail({ task, subtasks, history, project, goal, area, onClose, onEdit }: {
  task: Task; subtasks: Task[]; history: Row<"task_completions">[]; project?: Project; goal?: { title: string }; area?: LifeArea; onClose: () => void; onEdit: () => void;
}) {
  const db = useDb();
  const [title, setTitle] = useState("");
  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (await db.insert("tasks", { title: title.trim(), parent_task_id: task.id, project_id: task.project_id, goal_id: task.goal_id, life_area_id: task.life_area_id }, "Subtask added")) setTitle("");
  }
  return (
    <Dialog open onClose={onClose} title={task.title} description={[project?.title, goal?.title, area?.name].filter(Boolean).join(" · ") || undefined}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <TaskCheck task={task} />
          <Badge tone={optionTone(TASK_STATUSES, task.status)}>{optionLabel(TASK_STATUSES, task.status)}</Badge>
          <Badge tone={optionTone(PRIORITIES, task.priority)}>{optionLabel(PRIORITIES, task.priority)}</Badge>
          {task.due_date && <Badge>{relativeDayLabel(task.due_date)}{task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}</Badge>}
          {task.recurrence && <Badge tone="info">Repeats {task.recurrence}{task.recurrence_interval > 1 ? ` ×${task.recurrence_interval}` : ""}</Badge>}
          {task.category && <Badge>{task.category}</Badge>}
          <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}><Pencil /> Edit</Button>
        </div>
        {task.description && <p className="whitespace-pre-wrap text-sm">{task.description}</p>}
        <section>
          <h3 className="mb-1 text-sm font-semibold">Subtasks</h3>
          <div className="-mx-2">{subtasks.map((s) => <TaskRow key={s.id} task={s} showDate={false} />)}</div>
          <form onSubmit={addSub} className="mt-2 flex gap-2"><Input placeholder="Add subtask…" value={title} onChange={(e) => setTitle(e.target.value)} /><Button type="submit" variant="outline" className="h-9" aria-label="Add subtask"><Plus /></Button></form>
        </section>
        {task.notes && <section><h3 className="mb-1 text-sm font-semibold">Notes</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.notes}</p></section>}
        <section>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><History className="size-4" /> Completion history</h3>
          {history.length ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {history.slice(0, 15).map((h) => <li key={h.id}>✓ {formatDateTime(h.completed_at)}{h.occurrence_date ? ` (due ${formatDate(h.occurrence_date)})` : ""}</li>)}
            </ul>
          ) : <p className="text-xs text-muted-foreground">Not completed yet.</p>}
        </section>
      </div>
    </Dialog>
  );
}
