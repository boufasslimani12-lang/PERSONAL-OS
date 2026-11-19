// Minimal spaced-repetition schedule (Leitner-style intervals).
const STEPS = [1, 3, 7, 14, 30, 60, 120];
export function scheduleReview(repetitions: number, remembered: boolean): { repetitions: number; interval: number } {
  if (!remembered) return { repetitions: 0, interval: 1 };
  const reps = repetitions + 1;
  return { repetitions: reps, interval: STEPS[Math.min(reps - 1, STEPS.length - 1)] };
}
