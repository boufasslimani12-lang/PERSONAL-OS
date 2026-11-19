// Calendar heatmap (sequential: one hue, opacity steps). Each cell has a title tooltip.
import { addDaysISO, formatDate, startOfWeekISO } from "@/lib/dates";

export function Heatmap({ values, to, weeks = 18, color = "var(--series-3)", label = "completions" }: {
  values: Record<string, number>; // date → 0..1 intensity (or count normalised by max)
  to: string;
  weeks?: number;
  color?: string;
  label?: string;
}) {
  const start = addDaysISO(startOfWeekISO(to, 1), -7 * (weeks - 1));
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDaysISO(start, w * 7 + d)));
  const max = Math.max(1, ...Object.values(values));
  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1" role="img" aria-label={`Heatmap of ${label}`}>
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((d) => {
            const v = values[d] ?? 0;
            const future = d > to;
            return (
              <div
                key={d}
                title={future ? "" : `${formatDate(d, { weekday: "short", month: "short", day: "numeric" })}: ${v} ${label}`}
                className="size-3 rounded-[3px]"
                style={{ background: future ? "transparent" : v ? color : "var(--muted)", opacity: future ? 0 : v ? 0.3 + 0.7 * (v / max) : 1 }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
