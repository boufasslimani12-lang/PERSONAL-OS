// Life-area score (docs/ANALYTICS.md):
//   area score = mean of the components that have data:
//     goals  — average progress of the area's active top-level goals
//     tasks  — task completion rate over the window for tasks tagged with the area
//     habits — habit consistency over the window for habits tagged with the area
//   An area with no data has score null ("No data") — it is NOT treated as 0%.
//   Overall life progress = mean of area scores that are not null, reported together with
//   its coverage (how many areas contributed), so a single tracked area is never shown as "your life".
export interface AreaInput {
  id: string;
  goalProgress: number[]; // 0..100 values of active, top-level goals in the area
  taskRate: number | null;
  habitRate: number | null;
}
export interface AreaScore { id: string; score: number | null; components: { goals: number | null; tasks: number | null; habits: number | null } }

export function scoreArea(a: AreaInput): AreaScore {
  const goals = a.goalProgress.length ? a.goalProgress.reduce((x, y) => x + y, 0) / a.goalProgress.length : null;
  const parts = [goals, a.taskRate, a.habitRate].filter((v): v is number => v !== null);
  return {
    id: a.id,
    score: parts.length ? parts.reduce((x, y) => x + y, 0) / parts.length : null,
    components: { goals, tasks: a.taskRate, habits: a.habitRate },
  };
}

export function overallProgress(scores: AreaScore[]): { value: number | null; coverage: number; total: number } {
  const withData = scores.filter((s) => s.score !== null);
  return {
    value: withData.length ? withData.reduce((x, s) => x + (s.score as number), 0) / withData.length : null,
    coverage: withData.length,
    total: scores.length,
  };
}
