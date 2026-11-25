"use client";
import { useMemo, useState } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { Select, Label } from "@/components/ui/form";
import { LineSeriesChart } from "@/components/charts";
import { exerciseProgress, exerciseSessions, type LoggedSet, type WorkoutLike } from "@/lib/engine/fitness";
import { formatDate, isoFromTimestamp } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

const kg = (v: number | null) => (v === null ? "—" : `${formatNumber(v, 1)} kg`);

export function ProgressionSection({ exercises, sets, workouts }: { exercises: Row<"exercises">[]; sets: LoggedSet[]; workouts: WorkoutLike[] }) {
  // Only exercises with at least one completed set in a finished workout — real records only.
  const rows = useMemo(
    () => exercises
      .map((e) => ({ exercise: e, sessions: exerciseSessions(e.id, sets, workouts) }))
      .filter((r) => r.sessions.length)
      .map((r) => ({ ...r, progress: exerciseProgress(r.sessions) }))
      .sort((a, b) => b.sessions[b.sessions.length - 1].startedAt.localeCompare(a.sessions[a.sessions.length - 1].startedAt)),
    [exercises, sets, workouts],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.exercise.id === selectedId) ?? rows[0];

  if (!rows.length) {
    return <EmptyState icon={TrendingUp} title="No progression yet" description="Finish a workout with completed sets and each exercise's weight and reps history appears here." />;
  }
  const p = selected.progress;
  const chart = selected.sessions.map((s) => ({ date: formatDate(isoFromTimestamp(s.startedAt)), weight: s.topWeight }));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="min-w-0"><CardTitle>{selected.exercise.name}</CardTitle><CardDescription>Heaviest completed set per session</CardDescription></div>
          <div className="w-56 max-w-full space-y-1">
            <Label htmlFor="progression-exercise" className="sr-only">Exercise</Label>
            <Select id="progression-exercise" value={selected.exercise.id} onChange={(e) => setSelectedId(e.target.value)}>
              {rows.map((r) => <option key={r.exercise.id} value={r.exercise.id}>{r.exercise.name}</option>)}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label="Exercise summary">
            <StatCard label="Latest" value={kg(p.latestWeight)} hint={p.latestReps !== null ? `${p.latestReps} reps` : undefined} />
            <StatCard label="Previous" value={kg(p.previousWeight)} hint={p.change === null ? "First session" : <ChangeLabel change={p.change} />} />
            <StatCard label="Best" value={kg(p.bestWeight)} />
            <StatCard label="Latest reps" value={p.latestReps ?? "—"} />
            <StatCard label="Sessions" value={p.sessions} />
          </div>
          {chart.length > 1
            ? <LineSeriesChart data={chart} xKey="date" area series={[{ key: "weight", label: "Top set (kg)" }]} format={(v) => `${v} kg`} />
            : <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-xs text-muted-foreground">Log this exercise in a second workout to see the trend.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Top set</th><th className="py-2 font-medium">Sets</th><th className="py-2 text-right font-medium">Volume</th></tr></thead>
              <tbody>
                {[...selected.sessions].reverse().map((s) => (
                  <tr key={s.workoutId} className="border-b border-border last:border-0">
                    <td className="py-2">{formatDate(isoFromTimestamp(s.startedAt), { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-2 tabular-nums">{formatNumber(s.topWeight, 1)} kg × {s.topReps}</td>
                    <td className="py-2 tabular-nums">{s.sets}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatNumber(s.volume)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>All exercises</CardTitle><CardDescription>Select a row to inspect its history</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-medium">Exercise</th><th className="py-2 font-medium">Latest</th><th className="py-2 font-medium">Previous</th><th className="py-2 font-medium">Best</th><th className="py-2 font-medium">Reps</th><th className="py-2 text-right font-medium">Sessions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.exercise.id} className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-muted/40", r.exercise.id === selected.exercise.id && "bg-accent/50")} onClick={() => setSelectedId(r.exercise.id)}>
                  <td className="py-2"><button className="text-left font-medium hover:text-primary" onClick={() => setSelectedId(r.exercise.id)}>{r.exercise.name}</button></td>
                  <td className="py-2 tabular-nums">{kg(r.progress.latestWeight)}</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{kg(r.progress.previousWeight)}</td>
                  <td className="py-2 tabular-nums">{kg(r.progress.bestWeight)}</td>
                  <td className="py-2 tabular-nums">{r.progress.latestReps ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums">{r.progress.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeLabel({ change }: { change: number }) {
  if (change === 0) return <span className="inline-flex items-center gap-0.5"><Minus className="size-3" /> Same as last time</span>;
  const up = change > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5", up ? "text-success" : "text-warning")}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{up ? "+" : ""}{formatNumber(change, 1)} kg vs previous
    </span>
  );
}
