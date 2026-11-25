# Analytics & progress rules

All formulas live in `lib/engine/*` and are covered by `tests/engine.test.ts`. Principles:
**no fake numbers**, **missing data is "No data", never 0%**, **in-progress periods never count against you**.
All day boundaries (today, weeks, months, "completed on") are computed in the profile time zone.

| Metric | Rule |
|---|---|
| Goal progress | Completed → 100. Cancelled → excluded. Manual → `manual_progress`. Auto → equal-weighted mean of child goals (recursive), milestones (0/100) and linked top-level non-cancelled tasks (0/100). Auto goal with no units → 0% with basis "empty" (shown explicitly). |
| Deadline state | done / overdue (target < today) / due soon (≤ 7 days) / on track / none. |
| Task completion rate | completions with occurrence date in window ÷ (those + open top-level tasks due in window before today). Each completion writes `task_completions`; recurring tasks count each occurrence. |
| Habit completed | `habit_logs.value >= habit_logs.target_value` (snapshot at log time). |
| Habit scheduling | daily = every day from `start_date`; custom = listed weekdays; weekly = `times_per_week` completions per week (excess capped). |
| Habit consistency | completed scheduled occurrences ÷ scheduled occurrences. Today (daily/custom) or the current week (weekly) is counted only once completed. Multi-habit = Σdone ÷ Σexpected. |
| Streak | consecutive completed scheduled periods ending today (or yesterday if today isn't done yet). |
| Life-area score | mean of available components: avg progress of the area's top-level goals; area task completion rate (30 d); area habit consistency (30 d). None → null. |
| Inactive life areas | Excluded from area scores and from the overall average (and its "n of N areas" total). Their records are kept and still count in global task/habit statistics. |
| Overall life progress | mean of non-null area scores, always displayed with coverage ("n of 10 areas"). |
| Finance | net = income − expenses; savings rate = net ÷ income (null if income = 0); budget utilisation = spent in budgeted categories ÷ their budgets. Only profile-currency transactions are summed (no invented FX). |
| Fitness | volume = Σ reps × weight of completed sets; e1RM (Epley) = w × (1 + reps/30); BMI = kg ÷ m². |
| Education | subject grade = Σ(score/max × scale × weight) ÷ Σweight over graded assessments; semester average = coefficient-weighted mean in %. |
| Skills | progress = current level ÷ target level. |
| Languages | level progress = CEFR index(current) ÷ index(target); weekly minutes vs goal. |
