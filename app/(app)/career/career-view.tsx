"use client";
import { useState } from "react";
import { Briefcase, Plus, Pencil, Lightbulb, Rocket, Compass, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader, EmptyState, Badge, Progress, Tabs, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { TaskRow } from "@/components/shared/task-row";
import { ResourceList } from "@/components/shared/resources";
import { Attachments } from "@/components/shared/attachments";
import { PROJECT_STATUSES, optionLabel, optionTone } from "@/lib/constants";
import { formatDate, relativeDayLabel, todayISO } from "@/lib/dates";
import { useDb } from "@/lib/hooks/use-db";
import { ToggleCheck } from "@/components/shared/toggle-check";
import { cn } from "@/lib/utils";
import type { Project, Row, Task } from "@/lib/types";

const KINDS = [
  { value: "career_objective", label: "Career objectives", single: "Career objective", icon: Compass },
  { value: "business_idea", label: "Business ideas", single: "Business idea", icon: Lightbulb },
  { value: "business_project", label: "Business projects", single: "Business project", icon: Rocket },
] as const;

export function CareerView({ projects, tasks, milestones, resources, goals, careerArea }: {
  projects: Project[]; tasks: Task[]; milestones: Row<"milestones">[]; resources: Row<"resources">[]; goals: { id: string; title: string }[]; careerArea: string | null;
}) {
  const [kind, setKind] = useState<string>("career_objective");
  const [archived, setArchived] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const form = useFormState<Project>();
  const today = todayISO();
  const meta = KINDS.find((k) => k.value === kind)!;
  const list = projects.filter((p) => p.kind === kind && (archived ? !!p.archived_at : !p.archived_at));
  const progressOf = (p: Project) => {
    const units = [...tasks.filter((t) => t.project_id === p.id && t.status !== "cancelled").map((t) => t.status === "done"), ...milestones.filter((m) => m.project_id === p.id).map((m) => !!m.completed_at)];
    if (p.status === "completed") return 100;
    return units.length ? (units.filter(Boolean).length / units.length) * 100 : null;
  };

  const fields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "kind", label: "Type", type: "select", required: true, options: KINDS.map((k) => ({ value: k.value, label: k.single })) },
    { name: "status", label: "Status", type: "select", required: true, options: PROJECT_STATUSES },
    { name: "goal_id", label: "Linked goal", type: "select", options: goals.map((g) => ({ value: g.id, label: g.title })) },
    { name: "start_date", label: "Start", type: "date" },
    { name: "due_date", label: "Deadline", type: "date" },
    { name: "learning_requirements", label: "Learning requirements", type: "textarea", help: "Skills or knowledge you need to acquire" },
    { name: "notes", label: "Notes", type: "markdown" },
  ];

  const active = projects.filter((p) => !p.archived_at);
  const detail = detailId ? projects.find((p) => p.id === detailId) : null;

  return (
    <div>
      <PageHeader title="Career & Business" icon={Briefcase} description="Professional objectives, business ideas and ventures"
        actions={<Button onClick={() => form.create({ kind, status: kind === "business_idea" ? "idea" : "active", life_area_id: careerArea })}><Plus /> New {meta.single.toLowerCase()}</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KINDS.map((k) => <StatCard key={k.value} label={k.label} value={active.filter((p) => p.kind === k.value).length} icon={k.icon} />)}
        <StatCard label="Completed" value={projects.filter((p) => p.status === "completed").length} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs value={kind} onChange={setKind} items={KINDS.map((k) => ({ value: k.value, label: k.label, count: active.filter((p) => p.kind === k.value).length }))} />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived</label>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={meta.icon} title={`No ${meta.label.toLowerCase()} yet`} description={kind === "business_idea" ? "Capture ideas quickly, then promote the promising ones to projects." : "Define what you want to achieve and break it into milestones and tasks."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => {
            const pr = progressOf(p);
            const open = tasks.filter((t) => t.project_id === p.id && t.status !== "done" && t.status !== "cancelled").length;
            return (
              <button key={p.id} onClick={() => setDetailId(p.id)} className="rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{p.title}</p>
                  <Badge tone={optionTone(PROJECT_STATUSES, p.status)}>{optionLabel(PROJECT_STATUSES, p.status)}</Badge>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={pr} /><span className="w-10 text-right tabular-nums">{pr === null ? "—" : `${Math.round(pr)}%`}</span></div>
                <p className="mt-2 text-xs text-muted-foreground">{open} open tasks{p.due_date && <> · <span className={cn(p.due_date < today && p.status !== "completed" && "text-destructive")}>{relativeDayLabel(p.due_date, today)}</span></>}</p>
              </button>
            );
          })}
        </div>
      )}

      <EntityForm table="projects" title={form.record ? "Edit" : `New ${meta.single.toLowerCase()}`} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults}
        transform={(v) => ({ ...v, life_area_id: form.record?.life_area_id ?? careerArea, completed_at: v.status === "completed" ? (form.record?.completed_at ?? new Date().toISOString()) : null })} />

      {detail && <ProjectDetail project={detail} tasks={tasks.filter((t) => t.project_id === detail.id)} milestones={milestones.filter((m) => m.project_id === detail.id)} resources={resources.filter((r) => r.project_id === detail.id)}
        goal={goals.find((g) => g.id === detail.goal_id)} onClose={() => setDetailId(null)} onEdit={() => { form.edit(detail); setDetailId(null); }} />}
    </div>
  );
}

function ProjectDetail({ project, tasks, milestones, resources, goal, onClose, onEdit }: {
  project: Project; tasks: Task[]; milestones: Row<"milestones">[]; resources: Row<"resources">[]; goal?: { title: string }; onClose: () => void; onEdit: () => void;
}) {
  const db = useDb();
  const [ms, setMs] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  return (
    <Dialog open onClose={onClose} title={project.title} description={[optionLabel(PROJECT_STATUSES, project.status), goal && `Goal: ${goal.title}`, project.due_date && `Deadline ${formatDate(project.due_date, { month: "short", day: "numeric", year: "numeric" })}`].filter(Boolean).join(" · ")} className="w-[min(100vw-1.5rem,46rem)]">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
          {project.kind === "business_idea" && <Button size="sm" variant="outline" onClick={() => db.update("projects", project.id, { kind: "business_project", status: "planned" }, "Promoted to business project")}><Rocket /> Promote to project</Button>}
          <Button size="sm" variant="ghost" onClick={async () => { await db.update("projects", project.id, { archived_at: project.archived_at ? null : new Date().toISOString() }, project.archived_at ? "Restored" : "Archived"); onClose(); }}>{project.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}</Button>
        </div>
        {project.description && <p className="whitespace-pre-wrap text-sm">{project.description}</p>}
        {project.learning_requirements && <section><h3 className="mb-1 text-sm font-semibold">Learning requirements</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.learning_requirements}</p></section>}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
          <ul className="space-y-1">{milestones.map((m) => (
            <li key={m.id} className="group flex items-center gap-2 text-sm">
              <ToggleCheck label="Toggle complete" checked={!!m.completed_at} onToggle={(next) => db.update("milestones", m.id, { completed_at: next ? new Date().toISOString() : null }, undefined)} />
              <span className={cn("flex-1", m.completed_at && "text-muted-foreground line-through")}>{m.title}</span>
              <button className="opacity-0 group-hover:opacity-100" onClick={() => db.remove("milestones", m.id)} aria-label="Delete"><Trash2 className="size-3.5 text-muted-foreground" /></button>
            </li>))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (ms.trim() && await db.insert("milestones", { project_id: project.id, title: ms.trim(), sort_order: milestones.length }, "Milestone added")) setMs(""); }}>
            <Input placeholder="Add milestone…" value={ms} onChange={(e) => setMs(e.target.value)} /><Button type="submit" variant="outline" className="h-9" aria-label="Add milestone"><Plus /></Button>
          </form>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold">Tasks</h3>
          <div className="-mx-2">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (task.trim() && await db.insert("tasks", { title: task.trim(), project_id: project.id, goal_id: project.goal_id, life_area_id: project.life_area_id, due_date: due || null }, "Task added")) { setTask(""); setDue(""); } }}>
            <Input placeholder="Add task…" value={task} onChange={(e) => setTask(e.target.value)} /><Input type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} /><Button type="submit" variant="outline" className="h-9" aria-label="Add task"><Plus /></Button>
          </form>
        </section>
        <ResourceList resources={resources} link={{ project_id: project.id }} />
        {project.notes && <section><h3 className="mb-1 text-sm font-semibold">Notes</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.notes}</p></section>}
        <Attachments entityType="project" entityId={project.id} />
      </div>
    </Dialog>
  );
}
