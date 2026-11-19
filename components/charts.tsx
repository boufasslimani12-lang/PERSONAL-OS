"use client";
// Chart primitives (Recharts). Rules: categorical hues in fixed order (--series-N), one y-axis,
// recessive grid, rounded 4px bar ends, 2px lines, tooltip on every chart, legend for ≥ 2 series.
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";
import { formatMoney } from "@/lib/format";

export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export interface SeriesDef { key: string; label: string; color?: string }

/** Serializable formatter spec, so Server Components can configure charts (functions can't cross the boundary). */
export type ValueFormat = { kind: "percent" | "hours" | "kg" | "number" } | { kind: "money"; currency: string };
function resolveFormat(format?: (v: number) => string, valueFormat?: ValueFormat) {
  if (format) return format;
  if (!valueFormat) return undefined;
  switch (valueFormat.kind) {
    case "percent": return (v: number) => `${v}%`;
    case "hours": return (v: number) => `${v} h`;
    case "kg": return (v: number) => `${v} kg`;
    case "money": return (v: number) => formatMoney(v, valueFormat.currency);
    default: return (v: number) => String(v);
  }
}

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium tabular-nums text-foreground">{format ? format(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function BarSeriesChart({ data, xKey, series, height = 220, stacked, format: formatFn, valueFormat, unit }: {
  data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number; stacked?: boolean; format?: (v: number) => string; valueFormat?: ValueFormat; unit?: string;
}) {
  const format = resolveFormat(formatFn, valueFormat);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} allowDecimals={false} unit={unit} />
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<TooltipBox format={format} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? SERIES[i]} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} stackId={stacked ? "s" : undefined} maxBarSize={28} stroke="var(--card)" strokeWidth={stacked ? 1 : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeriesChart({ data, xKey, series, height = 220, format: formatFn, valueFormat, domain, area }: {
  data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; height?: number; format?: (v: number) => string; valueFormat?: ValueFormat; domain?: [number | "auto", number | "auto"]; area?: boolean;
}) {
  const format = resolveFormat(formatFn, valueFormat);
  if (area && series.length === 1) {
    const s = series[0];
    const color = s.color ?? SERIES[0];
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} domain={domain ?? ["auto", "auto"]} />
          <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<TooltipBox format={format} />} />
          <Area type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} domain={domain ?? ["auto", "auto"]} />
        <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<TooltipBox format={format} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? SERIES[i]} strokeWidth={2} dot={data.length < 20 ? { r: 3 } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal labelled bars — used instead of pies for share-of-total breakdowns. */
export function BreakdownBars({ items, format }: { items: { label: string; value: number; color?: string; hint?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it, idx) => (
        <li key={it.label + idx} className="text-xs">
          <div className="mb-1 flex justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate"><span className="size-2 shrink-0 rounded-full" style={{ background: it.color ?? SERIES[0] }} />{it.label}</span>
            <span className="tabular-nums text-muted-foreground">{format ? format(it.value) : it.value}{it.hint ? ` · ${it.hint}` : ""}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" title={`${it.label}: ${format ? format(it.value) : it.value}`}>
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? SERIES[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
