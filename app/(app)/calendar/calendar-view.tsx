"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { PageHeader, Tabs, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntityForm, useFormState, type Field } from "@/components/forms/entity-form";
import { addDaysISO, addMonthsISO, eachDayISO, endOfMonthISO, formatDate, formatTime, fromZonedWallTime, hourInZone, startOfMonthISO, startOfWeekISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

export interface CalItem {
  key: string; source: "event" | "task" | "workout" | "study" | "goal" | "assessment"; id: string; title: string; date: string;
  start: string | null; end: string | null; color: string; meta?: string; done?: boolean; recurring?: boolean;
}
type View = "day" | "week" | "month" | "agenda";

const SOURCE_HREF: Record<CalItem["source"], string> = { event: "", task: "/tasks", workout: "/fitness", study: "/education", goal: "/goals", assessment: "/education" };

function timeLabel(i: CalItem) {
  if (!i.start) return "";
  return formatTime(i.start);
}

export function CalendarView({ today, anchor, view, items, events }: { today: string; anchor: string; view: View; items: CalItem[]; events: Row<"events">[]; areas: string[] }) {
  const router = useRouter();
  const form = useFormState<Row<"events">>();
  const go = (date: string, v: View = view) => router.push(`/calendar?date=${date}&view=${v}`);
  const step = (dir: 1 | -1) => go(view === "month" ? addMonthsISO(anchor, dir) : view === "week" ? addDaysISO(anchor, 7 * dir) : view === "day" ? addDaysISO(anchor, dir) : addDaysISO(anchor, 14 * dir));
  const byDate = new Map<string, CalItem[]>();
  for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
  for (const list of byDate.values()) list.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

  const fields: Field[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "event", label: "Event" }, { value: "reminder", label: "Reminder" }, { value: "deadline", label: "Deadline" }] },
    { name: "all_day", label: "All day", type: "checkbox" },
    { name: "start_at", label: "Starts", type: "datetime", required: true },
    { name: "end_at", label: "Ends", type: "datetime" },
    { name: "recurrence", label: "Repeats", type: "select", options: [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }] },
    { name: "recurrence_until", label: "Repeat until", type: "date", showIf: (v) => !!v.recurrence },
    { name: "location", label: "Location" },
    { name: "color", label: "Color", type: "color" },
    { name: "description", label: "Description", type: "textarea" },
  ];

  const newEvent = (date: string, hour = 9) => {
    const d = new Date(fromZonedWallTime(`${date}T${String(hour).padStart(2, "0")}:00`));
    form.create({ kind: "event", start_at: d.toISOString(), end_at: new Date(d.getTime() + 3600000).toISOString(), color: "#6366f1", all_day: false });
  };
  const openItem = (i: CalItem) => {
    if (i.source === "event") {
      const e = events.find((x) => x.id === i.id);
      if (e) form.edit(e);
    } else router.push(SOURCE_HREF[i.source]);
  };

  const title =
    view === "month" ? formatDate(anchor, { month: "long", year: "numeric" })
    : view === "week" ? `Week of ${formatDate(startOfWeekISO(anchor), { month: "short", day: "numeric", year: "numeric" })}`
    : view === "day" ? formatDate(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Agenda";

  return (
    <div>
      <PageHeader title="Calendar" icon={CalendarDays} description="Events, tasks, deadlines, study sessions and workouts in one place"
        actions={<Button onClick={() => newEvent(anchor)}><Plus /> New event</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => go(today)}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
          <h2 className="ml-2 text-base font-semibold">{title}</h2>
        </div>
        <Tabs value={view} onChange={(v) => go(anchor, v)} items={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "agenda", label: "Agenda" }]} />
      </div>

      {view === "month" && <MonthGrid anchor={anchor} today={today} byDate={byDate} onDay={(d) => go(d, "day")} onItem={openItem} />}
      {view === "week" && <WeekGrid anchor={anchor} today={today} byDate={byDate} onDay={(d) => go(d, "day")} onItem={openItem} onNew={newEvent} />}
      {view === "day" && <DayList date={anchor} items={byDate.get(anchor) ?? []} onItem={openItem} onNew={(h) => newEvent(anchor, h)} />}
      {view === "agenda" && <Agenda from={anchor < today ? today : anchor} byDate={byDate} today={today} onItem={openItem} />}

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {[["Events", "#6366f1"], ["Tasks", "#64748b"], ["Workouts", "#ef4444"], ["Study", "#3b82f6"], ["Goal deadlines", "#f59e0b"], ["Exams & assignments", "#8b5cf6"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>

      <EntityForm table="events" title={form.record ? "Edit event" : "New event"} fields={fields} open={form.open} onClose={form.close} record={form.record} defaults={form.defaults}
        transform={(v) => ({ ...v, end_at: v.end_at && (v.end_at as string) < (v.start_at as string) ? v.start_at : v.end_at, recurrence_until: v.recurrence ? v.recurrence_until : null })} />
    </div>
  );
}

function Chip({ i, onItem }: { i: CalItem; onItem: (i: CalItem) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onItem(i); }} className={cn("flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted", i.done && "line-through opacity-60")} title={`${i.title}${i.meta ? ` · ${i.meta}` : ""}`}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: i.color }} />
      {i.start && <span className="text-muted-foreground">{timeLabel(i)}</span>}
      <span className="truncate">{i.title}</span>
    </button>
  );
}

function MonthGrid({ anchor, today, byDate, onDay, onItem }: { anchor: string; today: string; byDate: Map<string, CalItem[]>; onDay: (d: string) => void; onItem: (i: CalItem) => void }) {
  const start = startOfWeekISO(startOfMonthISO(anchor));
  const end = addDaysISO(startOfWeekISO(endOfMonthISO(anchor)), 6);
  const days = eachDayISO(start, end);
  const month = anchor.slice(0, 7);
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDate.get(d) ?? [];
          return (
            <div key={d} onClick={() => onDay(d)} className={cn("min-h-20 cursor-pointer border-b border-r border-border p-1 hover:bg-muted/40 sm:min-h-28", d.slice(0, 7) !== month && "bg-muted/30 text-muted-foreground")}>
              <span className={cn("mb-0.5 inline-grid size-6 place-items-center rounded-full text-xs", d === today && "bg-primary font-semibold text-primary-foreground")}>{Number(d.slice(8))}</span>
              <div className="hidden space-y-0.5 sm:block">
                {list.slice(0, 3).map((i) => <Chip key={i.key} i={i} onItem={onItem} />)}
                {list.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} more</p>}
              </div>
              {list.length > 0 && <div className="flex flex-wrap gap-0.5 px-1 sm:hidden">{list.slice(0, 4).map((i) => <span key={i.key} className="size-1.5 rounded-full" style={{ background: i.color }} />)}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekGrid({ anchor, today, byDate, onDay, onItem, onNew }: { anchor: string; today: string; byDate: Map<string, CalItem[]>; onDay: (d: string) => void; onItem: (i: CalItem) => void; onNew: (d: string) => void }) {
  const days = eachDayISO(startOfWeekISO(anchor), addDaysISO(startOfWeekISO(anchor), 6));
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => (
        <Card key={d} className={cn("min-h-40 p-2", d === today && "ring-2 ring-ring")}>
          <div className="mb-1 flex items-center justify-between">
            <button onClick={() => onDay(d)} className="text-xs font-semibold hover:text-primary">{formatDate(d, { weekday: "short", day: "numeric" })}</button>
            <button onClick={() => onNew(d)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Add event"><Plus className="size-3.5" /></button>
          </div>
          <div className="space-y-0.5">{(byDate.get(d) ?? []).map((i) => <Chip key={i.key} i={i} onItem={onItem} />)}</div>
        </Card>
      ))}
    </div>
  );
}

function DayList({ date, items, onItem, onNew }: { date: string; items: CalItem[]; onItem: (i: CalItem) => void; onNew: (h: number) => void }) {
  const allDay = items.filter((i) => !i.start);
  const timed = items.filter((i) => i.start);
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  return (
    <Card className="p-3">
      {allDay.length > 0 && (
        <div className="mb-3 space-y-1 border-b border-border pb-3">
          <p className="text-[11px] font-medium text-muted-foreground">All day · {formatDate(date)}</p>
          {allDay.map((i) => <Chip key={i.key} i={i} onItem={onItem} />)}
        </div>
      )}
      <div>
        {hours.map((h) => {
          const at = timed.filter((i) => hourInZone(new Date(i.start!)) === h);
          return (
            <div key={h} className="group flex min-h-11 gap-3 border-b border-border/60 last:border-0">
              <span className="w-12 shrink-0 pt-1 text-right text-[11px] text-muted-foreground">{String(h).padStart(2, "0")}:00</span>
              <div className="flex-1 space-y-1 py-1">
                {at.map((i) => (
                  <button key={i.key} onClick={() => onItem(i)} className="flex w-full items-center gap-2 rounded-md border-l-4 bg-muted/50 px-2 py-1 text-left text-sm hover:bg-muted" style={{ borderColor: i.color }}>
                    <span className="font-medium">{i.title}</span>
                    <span className="text-xs text-muted-foreground">{timeLabel(i)}{i.end ? `–${formatTime(i.end)}` : ""}{i.meta ? ` · ${i.meta}` : ""}</span>
                    {i.recurring && <Repeat className="size-3 text-muted-foreground" />}
                  </button>
                ))}
                {!at.length && <button onClick={() => onNew(h)} className="hidden h-8 w-full rounded-md text-left text-xs text-muted-foreground hover:bg-muted/50 group-hover:block">&nbsp;+ Add event</button>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Agenda({ from, byDate, today, onItem }: { from: string; byDate: Map<string, CalItem[]>; today: string; onItem: (i: CalItem) => void }) {
  const days = eachDayISO(from, addDaysISO(from, 30)).filter((d) => byDate.get(d)?.length);
  if (!days.length) return <EmptyState icon={CalendarDays} title="Nothing scheduled in the next 30 days" />;
  return (
    <Card className="divide-y divide-border">
      {days.map((d) => (
        <div key={d} className="flex gap-4 p-3">
          <div className="w-20 shrink-0">
            <p className={cn("text-sm font-semibold", d === today && "text-primary")}>{formatDate(d, { weekday: "short" })}</p>
            <p className="text-xs text-muted-foreground">{formatDate(d, { month: "short", day: "numeric" })}</p>
          </div>
          <ul className="flex-1 space-y-1.5">
            {byDate.get(d)!.map((i) => (
              <li key={i.key}>
                <button onClick={() => onItem(i)} className={cn("flex items-center gap-2 text-left text-sm hover:text-primary", i.done && "line-through opacity-60")}>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: i.color }} />
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">{timeLabel(i) || "—"}</span>
                  {i.title}
                  {i.meta && <span className="text-xs text-muted-foreground">· {i.meta}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="p-3 text-xs text-muted-foreground"><Link href="/tasks?view=upcoming" className="text-primary hover:underline">See all upcoming tasks →</Link></p>
    </Card>
  );
}
