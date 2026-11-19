"use client";
import { useState } from "react";
import { Code2, Users, Plus, Pencil, Clock, Trash2, Gauge, Archive } from "lucide-react";
import { PageHeader, EmptyState, Badge, Progress, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { ResourceList } from "@/components/shared/resources";
import { LineSeriesChart } from "@/components/charts";
import { formatDate, formatMinutes, startOfMonthISO, todayISO, isoFromTimestamp } from "@/lib/dates";
import { useDb } from "@/lib/hooks/use-db";
import { ToggleCheck } from "@/components/shared/toggle-check";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

const SOFT_DEFAULTS = ["Communication", "Leadership", "Discipline", "Critical thinking", "Problem solving", "Negotiation", "Time management", "Public speaking"];

export function SkillsView({ kind, skills, sessions, assessments, milestones, resources }: {
  kind: "hard" | "soft"; skills: Row<"skills">[]; sessions: Row<"skill_sessions">[]; assessments: Row<"skill_assessments">[]; milestones: Row<"milestones">[]; resources: Row<"resources">[];
}) {
  const db = useDb();
  const today = todayISO();
  const form = useFormState<Row<"skills">>();
  const sessForm = useFormState<Row<"skill_sessions">>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const active = skills.filter((s) => !s.archived_at);
  const Icon = kind === "hard" ? Code2 : Users;
  const title = kind === "hard" ? "Hard Skills" : "Soft Skills";

  const fields: Field[] = [
    { name: "name", label: "Skill", required: true },
    { name: "category", label: "Category", placeholder: kind === "hard" ? "Programming, Design…" : "Interpersonal, Self-management…" },
    { name: "current_level", label: "Current level (0–10)", type: "number", min: 0, max: 10, required: true },
    { name: "target_level", label: "Target level (1–10)", type: "number", min: 1, max: 10, required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "improvement_plan", label: kind === "hard" ? "Learning roadmap" : "Improvement plan", type: "markdown" },
  ];
  const sessFields: Field[] = [
    { name: "session_date", label: "Date", type: "date", required: true },
    { name: "duration_minutes", label: "Minutes", type: "number", min: 1, max: 1440, required: true },
    { name: "notes", label: kind === "hard" ? "What did you learn / build?" : "What did you practise?", type: "textarea" },
  ];

  const totalMin = sessions.reduce((a, s) => a + s.duration_minutes, 0);
  const monthMin = sessions.filter((s) => s.session_date >= startOfMonthISO(today)).reduce((a, s) => a + s.duration_minutes, 0);
  const avgGap = active.length ? active.reduce((a, s) => a + Math.min(100, (s.current_level / s.target_level) * 100), 0) / active.length : null;
  const detail = detailId ? skills.find((s) => s.id === detailId) : null;

  return (
    <div>
      <PageHeader title={title} icon={Icon} description={kind === "hard" ? "Technical skills, roadmaps, resources and practical projects" : "Interpersonal and personal effectiveness skills"}
        actions={<Button onClick={() => form.create({ current_level: 1, target_level: 7 })}><Plus /> New skill</Button>} />

      {!active.length ? (
        <div className="space-y-4">
          <EmptyState icon={Icon} title={`No ${kind} skills yet`} description="Add a skill, rate yourself honestly and set a target level." />
          {kind === "soft" && (
            <Card><CardHeader><CardTitle>Quick add</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">{SOFT_DEFAULTS.map((n) => <Button key={n} size="sm" variant="outline" onClick={() => db.insert("skills", { kind, name: n, current_level: 3, target_level: 7 }, `Added ${n}`)}><Plus /> {n}</Button>)}</CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Skills" value={active.length} icon={Icon} />
            <StatCard label="Avg. level vs target" value={avgGap === null ? "—" : `${Math.round(avgGap)}%`} icon={Gauge} />
            <StatCard label="Practice this month" value={formatMinutes(monthMin)} icon={Clock} />
            <StatCard label="Practice all time" value={formatMinutes(totalMin)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((s) => {
              const mins = sessions.filter((x) => x.skill_id === s.id).reduce((a, x) => a + x.duration_minutes, 0);
              const ms = milestones.filter((m) => m.skill_id === s.id);
              return (
                <button key={s.id} onClick={() => setDetailId(s.id)} className="rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-medium">{s.name}</p>{s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}</div>
                    <span className="text-sm font-semibold tabular-nums">{s.current_level}<span className="text-muted-foreground">/{s.target_level}</span></span>
                  </div>
                  <Progress className="mt-3" value={(s.current_level / s.target_level) * 100} />
                  <p className="mt-2 text-xs text-muted-foreground">{formatMinutes(mins)} practised{ms.length ? ` · ${ms.filter((m) => m.completed_at).length}/${ms.length} milestones` : ""}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detail && (
        <SkillDetail skill={detail} sessions={sessions.filter((s) => s.skill_id === detail.id)} assessments={assessments.filter((a) => a.skill_id === detail.id)}
          milestones={milestones.filter((m) => m.skill_id === detail.id)} resources={resources.filter((r) => r.skill_id === detail.id)}
          onClose={() => setDetailId(null)} onEdit={() => { form.edit(detail); setDetailId(null); }} onLog={() => sessForm.create({ session_date: today, duration_minutes: 45 })} onEditSession={sessForm.edit} />
      )}

      <EntityForm table="skills" title={form.record ? "Edit skill" : "New skill"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults} extra={{ kind }} />
      <EntityForm table="skill_sessions" title={sessForm.record ? "Edit practice session" : "Log practice"} fields={sessFields} open={sessForm.open} onClose={sessForm.close} record={sessForm.record} defaults={sessForm.defaults}
        extra={sessForm.record ? undefined : { skill_id: detailId }} />
    </div>
  );
}

function SkillDetail({ skill, sessions, assessments, milestones, resources, onClose, onEdit, onLog, onEditSession }: {
  skill: Row<"skills">; sessions: Row<"skill_sessions">[]; assessments: Row<"skill_assessments">[]; milestones: Row<"milestones">[]; resources: Row<"resources">[];
  onClose: () => void; onEdit: () => void; onLog: () => void; onEditSession: (s: Row<"skill_sessions">) => void;
}) {
  const db = useDb();
  const [ms, setMs] = useState("");
  const [level, setLevel] = useState(String(skill.current_level));
  const [note, setNote] = useState("");
  const history = assessments.map((a) => ({ date: formatDate(a.assessed_on), level: a.level }));

  async function assess(e: React.FormEvent) {
    e.preventDefault();
    const lv = Math.max(0, Math.min(10, Number(level)));
    const ok = await db.insert("skill_assessments", { skill_id: skill.id, level: lv, note: note || null }, undefined);
    if (ok) { await db.update("skills", skill.id, { current_level: lv }, "Self-assessment recorded"); setNote(""); }
  }

  return (
    <Dialog open onClose={onClose} title={skill.name} description={`Level ${skill.current_level} / target ${skill.target_level}${skill.category ? ` · ${skill.category}` : ""}`} className="w-[min(100vw-1.5rem,44rem)]">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
          <Button size="sm" variant="outline" onClick={onLog}><Clock /> Log practice</Button>
          <Button size="sm" variant="ghost" onClick={async () => { await db.update("skills", skill.id, { archived_at: new Date().toISOString() }, "Archived"); onClose(); }}><Archive /> Archive</Button>
        </div>
        {skill.description && <p className="text-sm">{skill.description}</p>}
        {skill.improvement_plan && <section><h3 className="mb-1 text-sm font-semibold">{skill.kind === "hard" ? "Roadmap" : "Improvement plan"}</h3><p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{skill.improvement_plan}</p></section>}

        <section>
          <h3 className="mb-2 text-sm font-semibold">Self-assessment</h3>
          <form onSubmit={assess} className="flex flex-wrap gap-2">
            <Input type="number" min={0} max={10} value={level} onChange={(e) => setLevel(e.target.value)} className="w-20" aria-label="Level" />
            <Input placeholder="Why this level? (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="min-w-40 flex-1" />
            <Button type="submit" variant="outline" className="h-9"><Gauge /> Record</Button>
          </form>
          {history.length > 1 && <div className="mt-3"><LineSeriesChart data={history} xKey="date" series={[{ key: "level", label: "Level" }]} domain={[0, 10]} height={160} /></div>}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
          <ul className="space-y-1">
            {milestones.map((m) => (
              <li key={m.id} className="group flex items-center gap-2 text-sm">
                <ToggleCheck label="Toggle complete" checked={!!m.completed_at} onToggle={(next) => db.update("milestones", m.id, { completed_at: next ? new Date().toISOString() : null }, undefined)} />
                <span className={cn("flex-1", m.completed_at && "text-muted-foreground line-through")}>{m.title}</span>
                <button className="opacity-0 group-hover:opacity-100" onClick={() => db.remove("milestones", m.id)} aria-label="Delete"><Trash2 className="size-3.5 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (ms.trim() && await db.insert("milestones", { skill_id: skill.id, title: ms.trim(), sort_order: milestones.length }, "Milestone added")) setMs(""); }}>
            <Input placeholder={skill.kind === "hard" ? "e.g. Build a REST API project" : "e.g. Give a 5-minute talk"} value={ms} onChange={(e) => setMs(e.target.value)} /><Button type="submit" variant="outline" className="h-9" aria-label="Add milestone"><Plus /></Button>
          </form>
        </section>

        <ResourceList resources={resources} link={{ skill_id: skill.id }} />

        <section>
          <h3 className="mb-2 text-sm font-semibold">Practice log</h3>
          {sessions.length ? (
            <ul className="space-y-1 text-sm">{sessions.slice(0, 15).map((s) => (
              <li key={s.id}><button onClick={() => onEditSession(s)} className="flex w-full justify-between gap-2 text-left hover:text-primary"><span className="truncate">{s.notes || "Practice"}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDate(s.session_date)} · {formatMinutes(s.duration_minutes)}</span></button></li>
            ))}</ul>
          ) : <p className="text-xs text-muted-foreground">No sessions yet.</p>}
        </section>
        <Badge>Created {formatDate(isoFromTimestamp(skill.created_at))}</Badge>
      </div>
    </Dialog>
  );
}
