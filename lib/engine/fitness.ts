// Fitness engine. Volume = Σ reps × weight over completed sets. Estimated 1RM uses Epley: w × (1 + reps/30).
export interface SetLike { exercise_id: string; reps: number | null; weight: number | null; completed: boolean; workout_id: string }

export function setVolume(s: SetLike) {
  return s.completed && s.reps && s.weight ? s.reps * Number(s.weight) : 0;
}

export function totalVolume(sets: SetLike[]) {
  return sets.reduce((a, s) => a + setVolume(s), 0);
}

export function estimated1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export interface PR { exercise_id: string; maxWeight: number; best1RM: number; maxReps: number }

export function personalRecords(sets: SetLike[]): Map<string, PR> {
  const out = new Map<string, PR>();
  for (const s of sets) {
    if (!s.completed) continue;
    const cur = out.get(s.exercise_id) ?? { exercise_id: s.exercise_id, maxWeight: 0, best1RM: 0, maxReps: 0 };
    const w = Number(s.weight ?? 0);
    const r = s.reps ?? 0;
    cur.maxWeight = Math.max(cur.maxWeight, w);
    cur.maxReps = Math.max(cur.maxReps, r);
    cur.best1RM = Math.max(cur.best1RM, estimated1RM(w, r));
    out.set(s.exercise_id, cur);
  }
  return out;
}

export function bmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// ---------------------------------------------------------------------------------------------
// Workout progression (docs/ANALYTICS.md). Only completed sets of finished workouts count.
// ---------------------------------------------------------------------------------------------
export interface WorkoutLike { id: string; started_at: string; ended_at: string | null; template_id?: string | null }
export interface LoggedSet extends SetLike { set_number: number; id?: string }

export interface ExerciseSession {
  workoutId: string;
  startedAt: string;
  topWeight: number; // heaviest completed set
  topReps: number; // reps done at that weight (best of ties)
  sets: number; // completed sets
  volume: number;
}

/** One entry per finished workout that contains completed sets of the exercise, oldest first. */
export function exerciseSessions(exerciseId: string, sets: LoggedSet[], workouts: WorkoutLike[]): ExerciseSession[] {
  const finished = new Map(workouts.filter((w) => w.ended_at).map((w) => [w.id, w]));
  const byWorkout = new Map<string, LoggedSet[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || !s.completed || !finished.has(s.workout_id)) continue;
    byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s]);
  }
  const out: ExerciseSession[] = [];
  for (const [workoutId, list] of byWorkout) {
    let topWeight = 0;
    let topReps = 0;
    for (const s of list) {
      const w = Number(s.weight ?? 0);
      const r = s.reps ?? 0;
      if (w > topWeight || (w === topWeight && r > topReps)) { topWeight = w; topReps = r; }
    }
    out.push({ workoutId, startedAt: finished.get(workoutId)!.started_at, topWeight, topReps, sets: list.length, volume: totalVolume(list) });
  }
  return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export interface ExerciseProgress {
  sessions: number;
  latestWeight: number | null;
  previousWeight: number | null;
  bestWeight: number | null;
  latestReps: number | null;
  change: number | null; // latest − previous
}

export function exerciseProgress(sessions: ExerciseSession[]): ExerciseProgress {
  if (!sessions.length) return { sessions: 0, latestWeight: null, previousWeight: null, bestWeight: null, latestReps: null, change: null };
  const latest = sessions[sessions.length - 1];
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  return {
    sessions: sessions.length,
    latestWeight: latest.topWeight,
    previousWeight: previous ? previous.topWeight : null,
    bestWeight: Math.max(...sessions.map((s) => s.topWeight)),
    latestReps: latest.topReps,
    change: previous ? latest.topWeight - previous.topWeight : null,
  };
}

/** Completed sets from the most recent finished workout with this exercise (excluding one workout), by set number. */
export function previousPerformance(exerciseId: string, sets: LoggedSet[], workouts: WorkoutLike[], excludeWorkoutId?: string): { startedAt: string; sets: LoggedSet[] } | null {
  const sessions = exerciseSessions(exerciseId, sets, workouts.filter((w) => w.id !== excludeWorkoutId));
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  return {
    startedAt: last.startedAt,
    sets: sets.filter((s) => s.workout_id === last.workoutId && s.exercise_id === exerciseId && s.completed).sort((a, b) => a.set_number - b.set_number),
  };
}

/** The training day after the one most recently finished in this program (cycling); the first day if none. */
export function nextTrainingDay<D extends { id: string }>(days: D[], workouts: WorkoutLike[]): D | null {
  if (!days.length) return null;
  const ids = new Set(days.map((d) => d.id));
  const last = workouts.filter((w) => w.ended_at && w.template_id && ids.has(w.template_id)).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!last) return days[0];
  const i = days.findIndex((d) => d.id === last.template_id);
  return days[(i + 1) % days.length];
}

/** Exercise order inside a workout: the training day's order first, then exercises added during the session. */
export function orderWorkoutExercises(sets: { exercise_id: string; set_number: number }[], dayOrder: string[]): string[] {
  const seen: string[] = [];
  for (const s of sets) if (!seen.includes(s.exercise_id)) seen.push(s.exercise_id);
  const rank = (id: string) => (dayOrder.includes(id) ? dayOrder.indexOf(id) : dayOrder.length + seen.indexOf(id));
  return seen.sort((a, b) => rank(a) - rank(b));
}

export function workoutSummary(w: WorkoutLike, sets: LoggedSet[]) {
  const done = sets.filter((s) => s.workout_id === w.id && s.completed);
  return {
    exercises: new Set(done.map((s) => s.exercise_id)).size,
    sets: done.length,
    volume: totalVolume(done),
    minutes: w.ended_at ? Math.max(0, Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000)) : null,
  };
}

/** First number of a reps target like "8-12" or "10", for prefilling a set. */
export function targetRepsValue(target: string): number | null {
  const m = /\d+/.exec(target);
  return m ? Number(m[0]) : null;
}
