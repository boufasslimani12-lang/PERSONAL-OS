"use client";
import { useState } from "react";
import { Sprout, Plus, BookOpen, GraduationCap, Mountain, Lightbulb, Trophy, MessageSquareQuote, TrendingUp, Star, type LucideIcon } from "lucide-react";
import { PageHeader, StatCard, EmptyState, Tabs, Progress, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { formatDate, todayISO } from "@/lib/dates";
import { useDb } from "@/lib/hooks/use-db";
import type { Row } from "@/lib/types";

type Kind = "course" | "challenge" | "lesson" | "achievement" | "reflection" | "improvement";
const KINDS: { value: Kind; label: string; single: string; icon: LucideIcon; tracked: boolean }[] = [
  { value: "course", label: "Courses", single: "course", icon: GraduationCap, tracked: true },
  { value: "challenge", label: "Challenges", single: "challenge", icon: Mountain, tracked: true },
  { value: "improvement", label: "Improvement goals", single: "improvement goal", icon: TrendingUp, tracked: true },
  { value: "lesson", label: "Lessons learned", single: "lesson", icon: Lightbulb, tracked: false },
  { value: "achievement", label: "Achievements", single: "achievement", icon: Trophy, tracked: false },
  { value: "reflection", label: "Reflections", single: "reflection", icon: MessageSquareQuote, tracked: false },
];
const ITEM_STATUS = [{ value: "planned", label: "Planned" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "abandoned", label: "Abandoned" }];
const BOOK_STATUS = [{ value: "to_read", label: "To read" }, { value: "reading", label: "Reading" }, { value: "finished", label: "Finished" }, { value: "abandoned", label: "Abandoned" }];

export function GrowthView({ books, items }: { books: Row<"books">[]; items: Row<"growth_items">[] }) {
  const db = useDb();
  const today = todayISO();
  const year = today.slice(0, 4);
  const [tab, setTab] = useState<"books" | Kind>("books");
  const bookForm = useFormState<Row<"books">>();
  const itemForm = useFormState<Row<"growth_items">>();
  const kind = KINDS.find((k) => k.value === tab);

  const bookFields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "author", label: "Author" },
    { name: "status", label: "Status", type: "select", required: true, options: BOOK_STATUS },
    { name: "total_pages", label: "Total pages", type: "number", min: 1 },
    { name: "current_page", label: "Current page", type: "number", min: 0, required: true },
    { name: "started_on", label: "Started", type: "date" },
    { name: "finished_on", label: "Finished", type: "date" },
    { name: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5 },
    { name: "notes", label: "Notes & takeaways", type: "markdown" },
  ];
  const itemFields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "description", label: kind?.value === "reflection" || kind?.value === "lesson" ? "Content" : "Description", type: kind?.value === "reflection" ? "markdown" : "textarea" },
    { name: "occurred_on", label: "Date", type: "date" },
    { name: "url", label: "Link", type: "url" },
    ...(kind?.tracked ? ([{ name: "status", label: "Status", type: "select", required: true, options: ITEM_STATUS }, { name: "progress", label: "Progress (%)", type: "number", min: 0, max: 100, required: true }] as Field[]) : []),
  ];

  const finishedThisYear = books.filter((b) => b.status === "finished" && (b.finished_on ?? "").startsWith(year)).length;
  const pagesRead = books.reduce((a, b) => a + (b.status === "finished" ? b.total_pages ?? b.current_page : b.current_page), 0);
  const list = items.filter((i) => i.kind === tab);

  return (
    <div>
      <PageHeader title="Personal Growth" icon={Sprout} description="Books, courses, challenges, lessons, achievements and reflections"
        actions={tab === "books"
          ? <Button onClick={() => bookForm.create({ status: "reading", current_page: 0, started_on: today })}><Plus /> Book</Button>
          : <Button onClick={() => itemForm.create({ status: "active", progress: 0, occurred_on: today })}><Plus /> New {kind?.single}</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Books finished in ${year}`} value={finishedThisYear} icon={BookOpen} />
        <StatCard label="Currently reading" value={books.filter((b) => b.status === "reading").length} hint={`${pagesRead} pages read in total`} />
        <StatCard label="Active challenges & courses" value={items.filter((i) => ["course", "challenge", "improvement"].includes(i.kind) && i.status === "active").length} icon={Mountain} />
        <StatCard label={`Achievements in ${year}`} value={items.filter((i) => i.kind === "achievement" && (i.occurred_on ?? i.created_at).startsWith(year)).length} icon={Trophy} tone="#eab308" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "books", label: "Books", count: books.length }, ...KINDS.map((k) => ({ value: k.value, label: k.label, count: items.filter((i) => i.kind === k.value).length }))]} />

      {tab === "books" ? (
        books.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {books.map((b) => {
              const pct = b.total_pages ? (b.current_page / b.total_pages) * 100 : b.status === "finished" ? 100 : 0;
              return (
                <Card key={b.id} className="p-4">
                  <button onClick={() => bookForm.edit(b)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{b.author ?? "Unknown author"}</p></div>
                      <Badge tone={b.status === "finished" ? "success" : b.status === "reading" ? "info" : "default"}>{BOOK_STATUS.find((s) => s.value === b.status)?.label}</Badge>
                    </div>
                    {b.rating && <p className="mt-1 flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={i < b.rating! ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-muted-foreground/40"} />)}</p>}
                  </button>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={pct} /><span className="whitespace-nowrap tabular-nums">{b.current_page}{b.total_pages ? ` / ${b.total_pages}` : ""} p.</span></div>
                  {b.status === "reading" && (
                    <form className="mt-2 flex gap-2" onSubmit={async (e) => {
                      e.preventDefault();
                      const page = Number(new FormData(e.currentTarget).get("page"));
                      if (!page && page !== 0) return;
                      const finished = !!b.total_pages && page >= b.total_pages;
                      await db.update("books", b.id, { current_page: b.total_pages ? Math.min(page, b.total_pages) : page, ...(finished ? { status: "finished", finished_on: today } : {}) }, finished ? "Book finished 🎉" : "Progress saved");
                      e.currentTarget.reset();
                    }}>
                      <Input name="page" type="number" min={0} placeholder="Current page" className="h-8" />
                      <Button type="submit" size="sm" variant="outline">Update</Button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
        ) : <EmptyState icon={BookOpen} title="Your reading list is empty" description="Add books you're reading or want to read." />
      ) : list.length ? (
        <Card className="divide-y divide-border">
          {list.map((i) => (
            <button key={i.id} onClick={() => itemForm.edit(i)} className="block w-full px-4 py-3 text-left hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{i.title}</p>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {kind?.tracked && <Badge tone={i.status === "completed" ? "success" : i.status === "active" ? "info" : "default"}>{ITEM_STATUS.find((s) => s.value === i.status)?.label}</Badge>}
                  {i.occurred_on && formatDate(i.occurred_on, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {i.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{i.description}</p>}
              {kind?.tracked && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={i.progress} /><span className="w-9 text-right tabular-nums">{i.progress}%</span></div>}
            </button>
          ))}
        </Card>
      ) : kind && <EmptyState icon={kind.icon} title={`No ${kind.label.toLowerCase()} yet`} />}

      <EntityForm table="books" title={bookForm.record ? "Edit book" : "New book"} fields={bookFields} open={bookForm.open} onClose={bookForm.close} record={bookForm.record} defaults={bookForm.defaults}
        transform={(v) => ({ ...v, finished_on: v.status === "finished" ? (v.finished_on ?? today) : v.finished_on })} />
      <EntityForm table="growth_items" title={itemForm.record ? `Edit ${kind?.single}` : `New ${kind?.single}`} fields={itemFields} open={itemForm.open} onClose={itemForm.close} record={itemForm.record} defaults={itemForm.defaults}
        extra={{ kind: itemForm.record?.kind ?? tab }} transform={(v) => ({ ...v, progress: v.status === "completed" ? 100 : v.progress })} />
    </div>
  );
}
