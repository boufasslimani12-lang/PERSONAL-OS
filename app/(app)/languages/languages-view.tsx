"use client";
import { useState } from "react";
import { Languages, Plus, Pencil, Clock, BookA, Check, X } from "lucide-react";
import { PageHeader, EmptyState, Badge, Progress, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { ResourceList } from "@/components/shared/resources";
import { BreakdownBars, SERIES } from "@/components/charts";
import { CEFR, LANGUAGE_SKILLS } from "@/lib/constants";
import { addDaysISO, formatDate, formatMinutes, startOfWeekISO, todayISO } from "@/lib/dates";
import { scheduleReview } from "@/lib/engine/vocabulary";
import { useDb } from "@/lib/hooks/use-db";
import type { Row } from "@/lib/types";

const cefrIdx = (l: string) => CEFR.indexOf(l as (typeof CEFR)[number]);

export function LanguagesView({ languages, sessions, vocab, resources }: { languages: Row<"languages">[]; sessions: Row<"language_sessions">[]; vocab: Row<"vocabulary">[]; resources: Row<"resources">[] }) {
  const today = todayISO();
  const weekStart = startOfWeekISO(today);
  const langForm = useFormState<Row<"languages">>();
  const sessForm = useFormState<Row<"language_sessions">>();
  const vocabForm = useFormState<Row<"vocabulary">>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const active = languages.filter((l) => !l.archived_at);

  const langFields: Field[] = [
    { name: "name", label: "Language", required: true },
    { name: "weekly_goal_minutes", label: "Weekly goal (minutes)", type: "number", min: 0, required: true },
    { name: "current_level", label: "Current level", type: "select", required: true, options: CEFR.map((c) => ({ value: c, label: c })) },
    { name: "target_level", label: "Target level", type: "select", required: true, options: CEFR.slice(1).map((c) => ({ value: c, label: c })) },
    { name: "target_date", label: "Target date", type: "date" },
    { name: "notes", label: "Notes / goals", type: "textarea" },
  ];
  const sessFields: Field[] = [
    { name: "language_id", label: "Language", type: "select", required: true, options: active.map((l) => ({ value: l.id, label: l.name })) },
    { name: "skill", label: "Skill", type: "select", required: true, options: LANGUAGE_SKILLS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
    { name: "session_date", label: "Date", type: "date", required: true },
    { name: "duration_minutes", label: "Minutes", type: "number", min: 1, max: 1440, required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const vocabFields: Field[] = [
    { name: "term", label: "Word / phrase", required: true },
    { name: "translation", label: "Translation" },
    { name: "example", label: "Example sentence", type: "textarea" },
    { name: "next_review_on", label: "Next review", type: "date", required: true },
  ];

  const weekMin = sessions.filter((s) => s.session_date >= weekStart).reduce((a, s) => a + s.duration_minutes, 0);
  const totalMin = sessions.reduce((a, s) => a + s.duration_minutes, 0);
  const due = vocab.filter((v) => v.next_review_on <= today);
  const detail = detailId ? languages.find((l) => l.id === detailId) : null;

  return (
    <div>
      <PageHeader title="Languages" icon={Languages} description="Levels, practice time per skill and vocabulary review"
        actions={<>
          <Button variant="outline" onClick={() => langForm.create({ current_level: "A1", target_level: "B2", weekly_goal_minutes: 180 })}><Plus /> Language</Button>
          <Button disabled={!active.length} onClick={() => sessForm.create({ language_id: active[0]?.id, skill: "vocabulary", session_date: today, duration_minutes: 30 })}><Clock /> Log session</Button>
        </>} />
      {!active.length ? (
        <EmptyState icon={Languages} title="Add a language you're learning" description="Set your current and target CEFR level and a weekly time goal." action={<Button onClick={() => langForm.create({ current_level: "A1", target_level: "B2", weekly_goal_minutes: 180 })}><Plus /> Add language</Button>} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="This week" value={formatMinutes(weekMin)} icon={Clock} />
            <StatCard label="All time" value={formatMinutes(totalMin)} />
            <StatCard label="Vocabulary" value={vocab.length} hint="words & phrases" icon={BookA} />
            <StatCard label="Due for review" value={due.length} hint="today" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((l) => {
              const ls = sessions.filter((s) => s.language_id === l.id);
              const wk = ls.filter((s) => s.session_date >= weekStart).reduce((a, s) => a + s.duration_minutes, 0);
              const bySkill = LANGUAGE_SKILLS.map((sk, i) => ({ label: sk[0].toUpperCase() + sk.slice(1), value: ls.filter((s) => s.skill === sk).reduce((a, s) => a + s.duration_minutes, 0), color: SERIES[i] }));
              const levelPct = Math.max(0, Math.min(100, (cefrIdx(l.current_level) / Math.max(1, cefrIdx(l.target_level))) * 100));
              const lvDue = vocab.filter((v) => v.language_id === l.id && v.next_review_on <= today).length;
              return (
                <Card key={l.id}>
                  <CardHeader>
                    <div>
                      <CardTitle className="text-base">{l.name}</CardTitle>
                      <CardDescription>
                        <Badge tone="primary">{l.current_level}</Badge> → <Badge>{l.target_level}</Badge>{l.target_date && ` by ${formatDate(l.target_date, { month: "short", year: "numeric" })}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setReviewId(l.id)} disabled={!lvDue}>Review {lvDue || ""}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(l.id)}>Open</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Level progress (CEFR steps)</span><span>{Math.round(levelPct)}%</span></div><Progress value={levelPct} /></div>
                    <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Weekly goal</span><span className="tabular-nums">{formatMinutes(wk)} / {formatMinutes(l.weekly_goal_minutes)}</span></div><Progress value={l.weekly_goal_minutes ? (wk / l.weekly_goal_minutes) * 100 : 0} color="var(--series-3)" /></div>
                    {ls.length > 0 && <BreakdownBars items={bySkill.filter((b) => b.value > 0)} format={(v) => formatMinutes(v)} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {detail && (
        <Dialog open onClose={() => setDetailId(null)} title={detail.name} description={`${detail.current_level} → ${detail.target_level}`} className="w-[min(100vw-1.5rem,44rem)]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { langForm.edit(detail); setDetailId(null); }}><Pencil /> Edit</Button>
              <Button size="sm" variant="outline" onClick={() => vocabForm.create({ next_review_on: today })}><Plus /> Vocabulary</Button>
              <Button size="sm" variant="outline" onClick={() => sessForm.create({ language_id: detail.id, skill: "speaking", session_date: today, duration_minutes: 30 })}><Clock /> Log session</Button>
            </div>
            {detail.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.notes}</p>}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Vocabulary ({vocab.filter((v) => v.language_id === detail.id).length})</h3>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {vocab.filter((v) => v.language_id === detail.id).map((v) => (
                  <li key={v.id}><button onClick={() => vocabForm.edit(v)} className="flex w-full justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/40">
                    <span><span className="font-medium">{v.term}</span>{v.translation && <span className="text-muted-foreground"> — {v.translation}</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{v.next_review_on <= today ? "due" : formatDate(v.next_review_on)}</span>
                  </button></li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Recent sessions</h3>
              <ul className="space-y-1 text-sm">
                {sessions.filter((s) => s.language_id === detail.id).slice(0, 12).map((s) => (
                  <li key={s.id}><button onClick={() => sessForm.edit(s)} className="flex w-full justify-between gap-2 text-left hover:text-primary"><span className="capitalize">{s.skill}{s.notes && <span className="normal-case text-muted-foreground"> · {s.notes}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDate(s.session_date)} · {formatMinutes(s.duration_minutes)}</span></button></li>
                ))}
              </ul>
            </section>
            <ResourceList resources={resources.filter((r) => r.language_id === detail.id)} link={{ language_id: detail.id }} />
          </div>
        </Dialog>
      )}

      {reviewId && <VocabReview words={vocab.filter((v) => v.language_id === reviewId && v.next_review_on <= today)} onClose={() => setReviewId(null)} />}

      <EntityForm table="languages" title={langForm.record ? "Edit language" : "New language"} fields={langFields} open={langForm.open} onClose={langForm.close} record={langForm.record} defaults={langForm.defaults} />
      <EntityForm table="language_sessions" title={sessForm.record ? "Edit session" : "Log learning session"} fields={sessFields} open={sessForm.open} onClose={sessForm.close} record={sessForm.record} defaults={sessForm.defaults} />
      <EntityForm table="vocabulary" title={vocabForm.record ? "Edit word" : "New word"} fields={vocabFields} open={vocabForm.open} onClose={vocabForm.close} record={vocabForm.record} defaults={vocabForm.defaults} extra={vocabForm.record ? undefined : { language_id: detailId }} />
    </div>
  );
}

function VocabReview({ words, onClose }: { words: Row<"vocabulary">[]; onClose: () => void }) {
  const db = useDb();
  const [queue] = useState(() => [...words].sort(() => Math.random() - 0.5));
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const w = queue[i];
  async function grade(remembered: boolean) {
    const next = scheduleReview(w.repetitions, remembered);
    await db.update("vocabulary", w.id, { repetitions: next.repetitions, interval_days: next.interval, next_review_on: addDaysISO(todayISO(), next.interval) }, undefined);
    setReveal(false);
    if (i + 1 >= queue.length) { db.toast(`Review complete — ${queue.length} words`); onClose(); } else setI(i + 1);
  }
  if (!w) return null;
  return (
    <Dialog open onClose={onClose} title="Vocabulary review" description={`${i + 1} of ${queue.length}`}>
      <div className="space-y-6 py-4 text-center">
        <p className="text-2xl font-semibold">{w.term}</p>
        {reveal ? (
          <div className="space-y-1"><p className="text-lg">{w.translation || "—"}</p>{w.example && <p className="text-sm italic text-muted-foreground">{w.example}</p>}</div>
        ) : <Button variant="outline" onClick={() => setReveal(true)}>Show answer</Button>}
        {reveal && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => grade(false)}><X /> Forgot</Button>
            <Button onClick={() => grade(true)}><Check /> Remembered</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
