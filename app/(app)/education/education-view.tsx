"use client";
import { useMemo, useState } from "react";
import { GraduationCap, Plus, Pencil, Clock, BookOpen, FileText, ChevronRight, Trash2, Award } from "lucide-react";
import { PageHeader, StatCard, EmptyState, Badge, Progress, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { Attachments } from "@/components/shared/attachments";
import { BarSeriesChart } from "@/components/charts";
import { addDaysISO, formatDate, formatDateTime, formatMinutes, relativeDayLabel, startOfMonthISO, startOfWeekISO, todayISO, isoFromTimestamp } from "@/lib/dates";
import { subjectGrade, semesterAveragePct } from "@/lib/engine/education";
import { formatPct } from "@/lib/format";
import { useDb } from "@/lib/hooks/use-db";
import { useConfirm } from "@/components/ui/confirm";
import { ToggleCheck } from "@/components/shared/toggle-check";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

type Subject = Row<"subjects">;
const ASSESSMENT_KINDS = [{ value: "assignment", label: "Assignment" }, { value: "exam", label: "Exam" }, { value: "quiz", label: "Quiz" }, { value: "project", label: "Project" }, { value: "other", label: "Other" }];

export function EducationView({ years, semesters, subjects, courses, chapters, lessons, sessions, assessments }: {
  years: Row<"academic_years">[]; semesters: Row<"semesters">[]; subjects: Subject[]; courses: Row<"courses">[]; chapters: Row<"chapters">[];
  lessons: Row<"lessons">[]; sessions: Row<"study_sessions">[]; assessments: Row<"assessments">[];
}) {
  const today = todayISO();
  const [yearId, setYearId] = useState(years[0]?.id ?? "");
  const yearSems = semesters.filter((s) => s.academic_year_id === yearId);
  const current = yearSems.find((s) => s.start_date && s.end_date && s.start_date <= today && today <= s.end_date) ?? yearSems.at(-1);
  const [semId, setSemId] = useState(current?.id ?? "");
  const sem = yearSems.find((s) => s.id === semId) ?? yearSems[0];
  const semSubjects = subjects.filter((s) => s.semester_id === sem?.id);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<"subjects" | "assessments" | "sessions">("subjects");

  const yearForm = useFormState<Row<"academic_years">>();
  const semForm = useFormState<Row<"semesters">>();
  const subjForm = useFormState<Subject>();
  const sessForm = useFormState<Row<"study_sessions">>();
  const assessForm = useFormState<Row<"assessments">>();

  // Lesson progress per subject
  const lessonStats = useMemo(() => {
    const courseSubj = new Map(courses.map((c) => [c.id, c.subject_id]));
    const chapterSubj = new Map(chapters.map((c) => [c.id, courseSubj.get(c.course_id)]));
    const m = new Map<string, { done: number; total: number }>();
    for (const l of lessons) {
      const sid = chapterSubj.get(l.chapter_id);
      if (!sid) continue;
      const cur = m.get(sid) ?? { done: 0, total: 0 };
      cur.total++;
      if (l.completed_at) cur.done++;
      m.set(sid, cur);
    }
    return m;
  }, [courses, chapters, lessons]);

  const subjIds = new Set(semSubjects.map((s) => s.id));
  const semSessions = sessions.filter((s) => s.subject_id && subjIds.has(s.subject_id));
  const minutesBy = (from: string) => sessions.filter((s) => isoFromTimestamp(s.started_at) >= from).reduce((a, s) => a + s.duration_minutes, 0);
  const avg = semesterAveragePct(semSubjects, assessments);
  const semAssess = assessments.filter((a) => subjIds.has(a.subject_id));
  const upcoming = semAssess.filter((a) => a.status === "pending" && a.due_date && a.due_date >= today);
  const perSubject = semSubjects.map((s) => ({ subject: s.name.length > 12 ? s.name.slice(0, 11) + "…" : s.name, hours: Math.round(semSessions.filter((x) => x.subject_id === s.id).reduce((a, x) => a + x.duration_minutes, 0) / 6) / 10 }));
  const weeks = Array.from({ length: 8 }, (_, i) => startOfWeekISO(addDaysISO(today, -7 * (7 - i))));
  const weekly = weeks.map((w) => ({ week: formatDate(w), hours: Math.round(sessions.filter((s) => isoFromTimestamp(s.started_at) >= w && isoFromTimestamp(s.started_at) < addDaysISO(w, 7)).reduce((a, s) => a + s.duration_minutes, 0) / 6) / 10 }));

  const subjOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const fields = {
    year: [{ name: "name", label: "Name", required: true, placeholder: "2026–2027" }, { name: "start_date", label: "Start", type: "date" }, { name: "end_date", label: "End", type: "date" }] as Field[],
    sem: [{ name: "name", label: "Name", required: true, placeholder: "Semester 1" }, { name: "start_date", label: "Start", type: "date" }, { name: "end_date", label: "End", type: "date" }] as Field[],
    subj: [
      { name: "name", label: "Subject", required: true, full: true }, { name: "code", label: "Code" }, { name: "teacher", label: "Teacher" },
      { name: "coefficient", label: "Coefficient / credits", type: "number", min: 0.01, required: true },
      { name: "grade_scale", label: "Grade scale (max)", type: "number", min: 1, required: true, help: "e.g. 20, 100, 4" },
      { name: "color", label: "Color", type: "color" },
    ] as Field[],
    sess: [
      { name: "subject_id", label: "Subject", type: "select", options: subjOptions, required: true },
      { name: "started_at", label: "When", type: "datetime", required: true },
      { name: "duration_minutes", label: "Duration (minutes)", type: "number", min: 1, max: 1440, required: true },
      { name: "notes", label: "Notes", type: "textarea" },
    ] as Field[],
    assess: [
      { name: "title", label: "Title", required: true, full: true },
      { name: "subject_id", label: "Subject", type: "select", options: subjOptions, required: true },
      { name: "kind", label: "Type", type: "select", options: ASSESSMENT_KINDS, required: true },
      { name: "due_date", label: "Due / exam date", type: "date" },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "pending", label: "Pending" }, { value: "submitted", label: "Submitted" }, { value: "graded", label: "Graded" }] },
      { name: "score", label: "Score", type: "number", min: 0 },
      { name: "max_score", label: "Out of", type: "number", min: 0.01 },
      { name: "weight", label: "Weight", type: "number", min: 0.01, required: true, help: "Relative weight inside the subject" },
      { name: "notes", label: "Notes", type: "textarea" },
    ] as Field[],
  };

  const detail = detailId ? subjects.find((s) => s.id === detailId) : null;
  const nowLocal = new Date().toISOString();

  if (!years.length) {
    return (
      <div>
        <PageHeader title="Education" icon={GraduationCap} description="Academic years, semesters, subjects, courses and lessons" />
        <EmptyState icon={GraduationCap} title="Set up your academic year" description="Create an academic year, then add semesters and subjects." action={<Button onClick={() => yearForm.create({})}><Plus /> New academic year</Button>} />
        <EntityForm table="academic_years" title="New academic year" fields={fields.year} open={yearForm.open} onClose={yearForm.close} record={yearForm.record} defaults={yearForm.defaults} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Education" icon={GraduationCap} description="Academic years, semesters, subjects, courses and lessons"
        actions={<>
          <Button variant="outline" onClick={() => assessForm.create({ kind: "exam", status: "pending", weight: 1, max_score: sem ? 20 : null })} disabled={!subjects.length}><Award /> Assessment</Button>
          <Button onClick={() => sessForm.create({ started_at: nowLocal, duration_minutes: 45, subject_id: semSubjects[0]?.id })} disabled={!subjects.length}><Clock /> Log study</Button>
        </>} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select value={yearId} onChange={(e) => { setYearId(e.target.value); setSemId(""); }} className="w-44">{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select>
        <Button size="icon" variant="ghost" onClick={() => yearForm.edit(years.find((y) => y.id === yearId)!)} aria-label="Edit year"><Pencil /></Button>
        <Button size="sm" variant="ghost" onClick={() => yearForm.create({})}><Plus /> Year</Button>
        <span className="mx-1 h-5 w-px bg-border" />
        {yearSems.length > 0 && <Tabs value={sem?.id ?? ""} onChange={setSemId} items={yearSems.map((s) => ({ value: s.id, label: s.name }))} />}
        {sem && <Button size="icon" variant="ghost" onClick={() => semForm.edit(sem)} aria-label="Edit semester"><Pencil /></Button>}
        <Button size="sm" variant="ghost" onClick={() => semForm.create({})}><Plus /> Semester</Button>
      </div>

      {!sem ? (
        <EmptyState icon={BookOpen} title="Add a semester" action={<Button onClick={() => semForm.create({})}><Plus /> New semester</Button>} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Semester average" value={formatPct(avg, 1)} hint={avg === null ? "No graded assessments" : "weighted by coefficient"} icon={Award} />
            <StatCard label="Study this week" value={formatMinutes(minutesBy(startOfWeekISO(today)))} icon={Clock} />
            <StatCard label="Study this month" value={formatMinutes(minutesBy(startOfMonthISO(today)))} />
            <StatCard label="Upcoming" value={upcoming.length} hint="pending assignments & exams" icon={FileText} />
          </div>

          <Tabs value={tab} onChange={setTab} items={[{ value: "subjects", label: "Subjects", count: semSubjects.length }, { value: "assessments", label: "Assignments & exams", count: semAssess.length }, { value: "sessions", label: "Study sessions", count: semSessions.length }]} />

          {tab === "subjects" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {semSubjects.map((s) => {
                  const ls = lessonStats.get(s.id) ?? { done: 0, total: 0 };
                  const g = subjectGrade(s, assessments);
                  const mins = sessions.filter((x) => x.subject_id === s.id).reduce((a, x) => a + x.duration_minutes, 0);
                  return (
                    <button key={s.id} onClick={() => setDetailId(s.id)} className="rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="truncate font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{[s.code, s.teacher, `coef ${Number(s.coefficient)}`].filter(Boolean).join(" · ")}</p></div>
                        <span className="text-right"><span className="block text-lg font-semibold tabular-nums">{g === null ? "—" : g.toFixed(2)}</span><span className="text-[10px] text-muted-foreground">/ {Number(s.grade_scale)}</span></span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={ls.total ? (ls.done / ls.total) * 100 : 0} color={s.color ?? undefined} /><span className="whitespace-nowrap">{ls.done}/{ls.total} lessons</span></div>
                      <p className="mt-2 text-xs text-muted-foreground">{formatMinutes(mins)} studied</p>
                    </button>
                  );
                })}
                <button onClick={() => subjForm.create({ coefficient: 1, grade_scale: 20, color: "#3b82f6" })} className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40"><span className="flex items-center gap-1"><Plus className="size-4" /> Add subject</span></button>
              </div>
              {semSessions.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card><CardHeader><div><CardTitle>Study hours by subject</CardTitle><CardDescription>This semester</CardDescription></div></CardHeader><CardContent><BarSeriesChart data={perSubject} xKey="subject" series={[{ key: "hours", label: "Hours" }]} format={(v) => `${v} h`} /></CardContent></Card>
                  <Card><CardHeader><div><CardTitle>Weekly study hours</CardTitle><CardDescription>Last 8 weeks, all subjects</CardDescription></div></CardHeader><CardContent><BarSeriesChart data={weekly} xKey="week" series={[{ key: "hours", label: "Hours", color: "var(--series-3)" }]} format={(v) => `${v} h`} /></CardContent></Card>
                </div>
              )}
            </>
          )}

          {tab === "assessments" && (
            semAssess.length ? (
              <Card className="divide-y divide-border">
                {semAssess.map((a) => {
                  const s = subjects.find((x) => x.id === a.subject_id);
                  return (
                    <button key={a.id} onClick={() => assessForm.edit(a)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/40">
                      <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{s?.name} · {a.kind}{a.due_date ? ` · ${relativeDayLabel(a.due_date, today)}` : ""}</p></div>
                      <div className="flex items-center gap-2">
                        {a.score !== null && a.max_score && <span className="text-sm font-semibold tabular-nums">{Number(a.score)}/{Number(a.max_score)}</span>}
                        <Badge tone={a.status === "graded" ? "success" : a.due_date && a.due_date < today ? "danger" : "warning"}>{a.status}</Badge>
                      </div>
                    </button>
                  );
                })}
              </Card>
            ) : <EmptyState icon={Award} title="No assignments or exams" />
          )}

          {tab === "sessions" && (
            semSessions.length ? (
              <Card className="divide-y divide-border">
                {semSessions.slice(0, 50).map((x) => (
                  <button key={x.id} onClick={() => sessForm.edit(x)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/40">
                    <span>{subjects.find((s) => s.id === x.subject_id)?.name ?? "—"}{x.notes && <span className="text-muted-foreground"> · {x.notes}</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(x.started_at)} · {formatMinutes(x.duration_minutes)}</span>
                  </button>
                ))}
              </Card>
            ) : <EmptyState icon={Clock} title="No study sessions logged" />
          )}
        </div>
      )}

      <EntityForm table="academic_years" title={yearForm.record ? "Edit academic year" : "New academic year"} fields={fields.year} open={yearForm.open} onClose={yearForm.close} record={yearForm.record} defaults={yearForm.defaults} />
      <EntityForm table="semesters" title={semForm.record ? "Edit semester" : "New semester"} fields={fields.sem} open={semForm.open} onClose={semForm.close} record={semForm.record} defaults={semForm.defaults} extra={{ academic_year_id: yearId }} />
      <EntityForm table="subjects" title={subjForm.record ? "Edit subject" : "New subject"} fields={fields.subj} open={subjForm.open} onClose={subjForm.close} record={subjForm.record} defaults={subjForm.defaults} extra={subjForm.record ? undefined : { semester_id: sem?.id }} />
      <EntityForm table="study_sessions" title={sessForm.record ? "Edit study session" : "Log study session"} fields={fields.sess} open={sessForm.open} onClose={sessForm.close} record={sessForm.record} defaults={sessForm.defaults} extra={sessForm.record ? undefined : { lesson_id: (sessForm.defaults?.lesson_id as string | undefined) ?? null }} />
      <EntityForm table="assessments" title={assessForm.record ? "Edit assessment" : "New assessment"} fields={fields.assess} open={assessForm.open} onClose={assessForm.close} record={assessForm.record} defaults={assessForm.defaults}
        transform={(v) => ({ ...v, status: v.score !== null && v.score !== undefined ? "graded" : v.status })} />

      {detail && (
        <SubjectDetail subject={detail} courses={courses.filter((c) => c.subject_id === detail.id)} chapters={chapters} lessons={lessons} assessments={assessments.filter((a) => a.subject_id === detail.id)}
          onClose={() => setDetailId(null)} onEdit={() => { subjForm.edit(detail); setDetailId(null); }} onLog={(lessonId) => sessForm.create({ started_at: nowLocal, duration_minutes: 45, subject_id: detail.id, lesson_id: lessonId })} />
      )}
    </div>
  );
}

function SubjectDetail({ subject, courses, chapters, lessons, assessments, onClose, onEdit, onLog }: {
  subject: Subject; courses: Row<"courses">[]; chapters: Row<"chapters">[]; lessons: Row<"lessons">[]; assessments: Row<"assessments">[];
  onClose: () => void; onEdit: () => void; onLog: (lessonId?: string) => void;
}) {
  const db = useDb();
  const [course, setCourse] = useState("");
  const g = subjectGrade(subject, assessments);
  return (
    <Dialog open onClose={onClose} title={subject.name} description={`Grade ${g === null ? "—" : `${g.toFixed(2)} / ${Number(subject.grade_scale)}`} · coefficient ${Number(subject.coefficient)}`} className="w-[min(100vw-1.5rem,46rem)]">
      <div className="space-y-5">
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit subject</Button><Button size="sm" variant="outline" onClick={() => onLog()}><Clock /> Log study</Button></div>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Courses → chapters → lessons</h3>
          {courses.map((c) => <CourseNode key={c.id} course={c} chapters={chapters.filter((ch) => ch.course_id === c.id)} lessons={lessons} onLog={onLog} />)}
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (course.trim() && await db.insert("courses", { subject_id: subject.id, title: course.trim(), sort_order: courses.length }, "Course added")) setCourse(""); }}>
            <Input placeholder="Add a course…" value={course} onChange={(e) => setCourse(e.target.value)} /><Button type="submit" variant="outline" className="h-9" aria-label="Add course"><Plus /></Button>
          </form>
        </section>
        <Attachments entityType="subject" entityId={subject.id} />
      </div>
    </Dialog>
  );
}

function CourseNode({ course, chapters, lessons, onLog }: { course: Row<"courses">; chapters: Row<"chapters">[]; lessons: Row<"lessons">[]; onLog: (lessonId?: string) => void }) {
  const db = useDb();
  const confirm = useConfirm();
  const [open, setOpen] = useState(true);
  const [ch, setCh] = useState("");
  const all = lessons.filter((l) => chapters.some((c) => c.id === l.chapter_id));
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} aria-label="Toggle"><ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} /></button>
        <span className="flex-1 text-sm font-medium">{course.title}</span>
        <span className="text-xs text-muted-foreground">{all.filter((l) => l.completed_at).length}/{all.length}</span>
        <button onClick={async () => (await confirm({ title: `Delete course “${course.title}”?`, description: "Its chapters and lessons are deleted too. Study sessions stay, without the lesson link." })) && db.remove("courses", course.id)} aria-label="Delete course"><Trash2 className="size-3.5 text-muted-foreground" /></button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          {chapters.map((c) => <ChapterNode key={c.id} chapter={c} lessons={lessons.filter((l) => l.chapter_id === c.id)} onLog={onLog} />)}
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (ch.trim() && await db.insert("chapters", { course_id: course.id, title: ch.trim(), sort_order: chapters.length }, "Chapter added")) setCh(""); }}>
            <Input className="h-8" placeholder="Add a chapter…" value={ch} onChange={(e) => setCh(e.target.value)} /><Button type="submit" size="sm" variant="ghost" aria-label="Add chapter"><Plus /></Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ChapterNode({ chapter, lessons, onLog }: { chapter: Row<"chapters">; lessons: Row<"lessons">[]; onLog: (lessonId?: string) => void }) {
  const db = useDb();
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  return (
    <div>
      <p className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        {chapter.title}
        <button onClick={async () => (await confirm({ title: `Delete chapter “${chapter.title}”?`, description: "Its lessons are deleted too." })) && db.remove("chapters", chapter.id)} aria-label="Delete chapter"><Trash2 className="size-3" /></button>
      </p>
      <ul className="mt-1 space-y-1 pl-2">
        {lessons.map((l) => (
          <li key={l.id} className="group flex items-center gap-2 text-sm">
            <ToggleCheck label="Toggle complete" checked={!!l.completed_at} onToggle={(next) => db.update("lessons", l.id, { completed_at: next ? new Date().toISOString() : null }, undefined)} />
            <span className={cn("flex-1", l.completed_at && "text-muted-foreground line-through")}>{l.title}</span>
            <button className="opacity-0 group-hover:opacity-100" onClick={() => onLog(l.id)} title="Log study for this lesson"><Clock className="size-3.5 text-muted-foreground" /></button>
            <button className="opacity-0 group-hover:opacity-100" onClick={async () => (await confirm({ title: `Delete lesson “${l.title}”?` })) && db.remove("lessons", l.id)} aria-label="Delete lesson"><Trash2 className="size-3.5 text-muted-foreground" /></button>
          </li>
        ))}
      </ul>
      <form className="mt-1 flex gap-2 pl-2" onSubmit={async (e) => { e.preventDefault(); if (title.trim() && await db.insert("lessons", { chapter_id: chapter.id, title: title.trim(), sort_order: lessons.length }, undefined)) setTitle(""); }}>
        <Input className="h-7 text-xs" placeholder="Add lesson…" value={title} onChange={(e) => setTitle(e.target.value)} />
      </form>
    </div>
  );
}
