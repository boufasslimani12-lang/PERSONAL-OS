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
