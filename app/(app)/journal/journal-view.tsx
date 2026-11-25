"use client";
import { useMemo, useState } from "react";
import { NotebookPen, Plus, Search, Pin, Tag, Eye, Pencil, Trash2, Lock } from "lucide-react";
import { PageHeader, EmptyState, Tabs, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Attachments } from "@/components/shared/attachments";
import { addDaysISO, formatDate, startOfMonthISO, startOfWeekISO, todayISO } from "@/lib/dates";
import { renderMarkdown } from "@/lib/markdown";
import { useDb } from "@/lib/hooks/use-db";
import { useCreateFromQuery } from "@/lib/hooks/use-create-from-query";
import { cn } from "@/lib/utils";
import { areaOptions, type AreaLike } from "@/lib/life-areas";
import type { Row } from "@/lib/types";

type Note = Row<"notes">;
type Kind = "daily" | "weekly" | "monthly" | "note";
const KIND_LABEL: Record<Kind, string> = { daily: "Daily journal", weekly: "Weekly reflection", monthly: "Monthly review", note: "Note" };
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const TEMPLATES: Record<Kind, string> = {
  daily: "## Gratitude\n- \n\n## What went well today\n- \n\n## What could be better\n- \n\n## Tomorrow's focus\n- ",
  weekly: "## Wins this week\n- \n\n## Challenges\n- \n\n## Lessons learned\n- \n\n## Priorities for next week\n1. ",
  monthly: "## Highlights\n- \n\n## Progress on goals\n- \n\n## What I'll change next month\n- ",
  note: "",
};

export function JournalView({ notes, areas, goals, projects, habits }: {
  notes: Note[]; areas: (AreaLike & { color: string })[]; goals: { id: string; title: string }[]; projects: { id: string; title: string }[]; habits: { id: string; name: string }[];
}) {
  const today = todayISO();
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Partial<Note> | null>(null);
  const [viewing, setViewing] = useState<Note | null>(null);
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);

  const list = notes
    .filter((n) => (kind === "all" || n.kind === kind) && (!tag || n.tags.includes(tag)) && (!from || n.entry_date >= from) && (!to || n.entry_date <= to))
    .filter((n) => !q || `${n.title ?? ""} ${n.content} ${n.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  function startNew(k: Kind) {
    const date = k === "weekly" ? startOfWeekISO(today) : k === "monthly" ? startOfMonthISO(today) : today;
    const existing = k !== "note" ? notes.find((n) => n.kind === k && n.entry_date === date) : undefined;
    if (existing) return setEditing(existing);
    setEditing({
      kind: k, entry_date: date, content: TEMPLATES[k], tags: [],
      title: k === "daily" ? formatDate(date, { weekday: "long", month: "long", day: "numeric" }) : k === "weekly" ? `Week of ${formatDate(date)}` : k === "monthly" ? formatDate(date, { month: "long", year: "numeric" }) : "",
    });
  }

  const todayDaily = notes.find((n) => n.kind === "daily" && n.entry_date === today);
  useCreateFromQuery(["daily", "note"], (v) => startNew(v as Kind));
  const streak = (() => { let d = todayDaily ? today : addDaysISO(today, -1); let s = 0; const set = new Set(notes.filter((n) => n.kind === "daily").map((n) => n.entry_date)); while (set.has(d)) { s++; d = addDaysISO(d, -1); } return s; })();

  return (
    <div>
      <PageHeader title="Journal & Notes" icon={NotebookPen} description={`Private entries · ${streak}-day journaling streak`}
        actions={<>
          <Button variant="outline" onClick={() => startNew("weekly")}>Weekly reflection</Button>
          <Button variant="outline" onClick={() => startNew("monthly")}>Monthly review</Button>
          <Button variant="outline" onClick={() => startNew("note")}><Plus /> Note</Button>
          <Button onClick={() => startNew("daily")}><NotebookPen /> {todayDaily ? "Today's entry" : "Write today"}</Button>
        </>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={kind} onChange={setKind} items={[{ value: "all", label: "All", count: notes.length }, ...(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k], count: notes.filter((n) => n.kind === k).length }))]} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-44 pl-8" /></div>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-36"><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" aria-label="To date" />
        </div>
      </div>

      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((n) => (
            <Card key={n.id} className="flex cursor-pointer flex-col p-4 transition-shadow hover:shadow-md" onClick={() => setViewing(n)}>
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 font-medium">{n.title || "Untitled"}</p>
                <span className="flex shrink-0 items-center gap-1">{n.is_pinned && <Pin className="size-3.5 text-primary" />}{n.mood && <span>{MOODS[n.mood - 1]}</span>}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{KIND_LABEL[n.kind as Kind]} · {formatDate(n.entry_date, { month: "short", day: "numeric", year: "numeric" })}</p>
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-xs text-muted-foreground">{n.content.replace(/[#*>`]/g, "").trim()}</p>
              {n.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{n.tags.map((t) => <Badge key={t}>#{t}</Badge>)}</div>}
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={NotebookPen} title={notes.length ? "No entries match" : "Start journaling"} description="Daily entries, weekly reflections, monthly reviews and free-form notes — all private to you." action={!notes.length && <Button onClick={() => startNew("daily")}>Write today&apos;s entry</Button>} />}

      {viewing && (
        <Dialog open onClose={() => setViewing(null)} title={viewing.title || "Untitled"} description={`${KIND_LABEL[viewing.kind as Kind]} · ${formatDate(viewing.entry_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`} className="w-[min(100vw-1.5rem,48rem)]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(viewing); setViewing(null); }}><Pencil /> Edit</Button>
              {viewing.mood && <span title="Mood">{MOODS[viewing.mood - 1]}</span>}
              {viewing.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
              <LinkBadges note={viewing} areas={areas} goals={goals} projects={projects} habits={habits} />
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" /> Private</span>
            </div>
            <article className="prose-note text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(viewing.content) }} />
            <Attachments entityType="note" entityId={viewing.id} />
          </div>
        </Dialog>
      )}
      {editing && <NoteEditor note={editing} areas={areas} goals={goals} projects={projects} habits={habits} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LinkBadges({ note, areas, goals, projects, habits }: { note: Note; areas: { id: string; name: string }[]; goals: { id: string; title: string }[]; projects: { id: string; title: string }[]; habits: { id: string; name: string }[] }) {
  const items = [
    note.life_area_id && areas.find((a) => a.id === note.life_area_id)?.name,
    note.goal_id && `Goal: ${goals.find((g) => g.id === note.goal_id)?.title ?? "—"}`,
    note.project_id && `Project: ${projects.find((p) => p.id === note.project_id)?.title ?? "—"}`,
    note.habit_id && `Habit: ${habits.find((h) => h.id === note.habit_id)?.name ?? "—"}`,
  ].filter(Boolean) as string[];
  return <>{items.map((i) => <Badge key={i} tone="primary">{i}</Badge>)}</>;
}

function NoteEditor({ note, areas, goals, projects, habits, onClose }: {
  note: Partial<Note>; areas: AreaLike[]; goals: { id: string; title: string }[]; projects: { id: string; title: string }[]; habits: { id: string; name: string }[]; onClose: () => void;
}) {
  const db = useDb();
  const [v, setV] = useState({ ...note, tags: note.tags ?? [] });
  const [preview, setPreview] = useState(false);
  const [tagText, setTagText] = useState((note.tags ?? []).join(", "));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof Note, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    const payload = {
      kind: v.kind!, title: v.title?.trim() || null, content: v.content ?? "", entry_date: v.entry_date!, mood: v.mood ?? null,
      tags: tagText.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean),
      life_area_id: v.life_area_id || null, goal_id: v.goal_id || null, project_id: v.project_id || null, habit_id: v.habit_id || null, is_pinned: !!v.is_pinned,
    };
    if (!payload.entry_date) return db.toast("Date is required", "error");
    const ok = note.id ? await db.update("notes", note.id, payload) : await db.insert("notes", payload);
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={note.id ? "Edit entry" : `New ${KIND_LABEL[(v.kind as Kind) ?? "note"].toLowerCase()}`} className="w-[min(100vw-1.5rem,52rem)]"
      footer={<div className="flex w-full items-center justify-between">
        <div>{note.id && <Button variant={confirmDel ? "destructive" : "ghost"} size="sm" onClick={async () => { if (!confirmDel) return setConfirmDel(true); if (await db.remove("notes", note.id!)) onClose(); }}><Trash2 /> {confirmDel ? "Confirm delete" : "Delete"}</Button>}</div>
        <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={db.pending}>Save</Button></div>
      </div>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
          <Input placeholder="Title" value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} aria-label="Title" />
          <Select value={v.kind} onChange={(e) => set("kind", e.target.value)} aria-label="Type">{(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>
          <Input type="date" value={v.entry_date ?? ""} onChange={(e) => set("entry_date", e.target.value)} aria-label="Date" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">Mood</span>
            {MOODS.map((m, i) => <button key={m} type="button" onClick={() => set("mood", v.mood === i + 1 ? null : i + 1)} className={cn("rounded-md px-1 text-lg transition-opacity", v.mood === i + 1 ? "bg-accent" : "opacity-50 hover:opacity-100")} aria-label={`Mood ${i + 1}`}>{m}</button>)}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={!!v.is_pinned} onChange={(e) => set("is_pinned", e.target.checked)} /> Pin</label>
            <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>{preview ? <><Pencil /> Write</> : <><Eye /> Preview</>}</Button>
          </div>
        </div>
        {preview
          ? <article className="prose-note min-h-64 rounded-lg border border-border p-3 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.content ?? "") }} />
          : <Textarea className="min-h-64 font-mono text-[13px]" value={v.content ?? ""} onChange={(e) => set("content", e.target.value)} placeholder="Write freely… Markdown supported: # heading, **bold**, - lists, > quotes, [link](https://…)" />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label><Tag className="mr-1 inline size-3" />Tags</Label><Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="gratitude, work, ideas" /></div>
          <div className="space-y-1"><Label>Life area</Label><Select value={v.life_area_id ?? ""} onChange={(e) => set("life_area_id", e.target.value)}><option value="">—</option>{areaOptions(areas, note.life_area_id).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
          <div className="space-y-1"><Label>Goal</Label><Select value={v.goal_id ?? ""} onChange={(e) => set("goal_id", e.target.value)}><option value="">—</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></div>
          <div className="space-y-1"><Label>Project</Label><Select value={v.project_id ?? ""} onChange={(e) => set("project_id", e.target.value)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></div>
          <div className="space-y-1"><Label>Habit</Label><Select value={v.habit_id ?? ""} onChange={(e) => set("habit_id", e.target.value)}><option value="">—</option>{habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></div>
        </div>
      </div>
    </Dialog>
  );
}
