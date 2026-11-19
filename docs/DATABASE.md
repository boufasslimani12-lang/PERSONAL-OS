# Database

Source of truth: `supabase/migrations/`. Postgres 17 on Supabase.

## Security model
- Every table in `public` has `user_id uuid not null default auth.uid()` → `auth.users(id) on delete cascade`.
- `public.pos_secure_table(tbl)` enables RLS and creates four owner-only policies (`select/insert/update/delete` where
  `auth.uid() = user_id`), an `updated_at` trigger and a `user_id` index. Execute on it is revoked from API roles.
- `handle_new_user()` (security definer, trigger on `auth.users`) bootstraps the profile, 10 life areas,
  default finance categories and a starter exercise library. Execute revoked from API roles.
- Storage bucket `attachments` is **private** (25 MB limit). Object paths start with the owner's user id and storage
  policies only allow access to `<auth.uid()>/…`. Files are opened with short-lived signed URLs.

## Tables
| Domain | Tables |
|---|---|
| Core | `profiles`, `life_areas` |
| Planning | `goals` (self-referencing `parent_id`, `level`), `projects` (`kind`: general / career_objective / business_idea / business_project), `milestones` (exactly one of goal/project/skill), `tasks` (`parent_task_id` for subtasks, `recurrence`), `task_completions` |
| Habits & religion | `habits` (`module`: habits / religion, `kind`: binary / measurable, `frequency`), `habit_logs` (unique per habit+date, `target_value` snapshot, generated `completed`) |
| Calendar | `events` (`recurrence`, `recurrence_until`) |
| Fitness | `exercises`, `workout_templates`, `workout_template_exercises`, `workouts` (`ended_at null` = in progress), `workout_sets`, `body_metrics` |
| Education | `academic_years` → `semesters` → `subjects` → `courses` → `chapters` → `lessons`; `study_sessions`, `assessments` |
| Languages | `languages`, `language_sessions`, `vocabulary` (spaced repetition) |
| Skills | `skills` (`kind`: hard / soft), `skill_sessions`, `skill_assessments` |
| Shared | `resources` (language / skill / project), `attachments` (polymorphic `entity_type` + `entity_id`, file in storage) |
| Finance | `finance_categories` (`monthly_budget`), `transactions` (positive `amount`, `kind`, `currency`), `savings_goals` |
| Growth | `books`, `growth_items` (`kind`: course / challenge / lesson / achievement / reflection / improvement) |
| Journal | `notes` (`kind`: daily / weekly / monthly / note, `tags text[]`, `mood`, links to area/goal/project/habit) |

## History preservation
- Habit logs keep the target in force when logged; editing or archiving a habit never alters past logs.
- Task completions are append-only rows; recurring tasks roll their `due_date` forward.
- Skill self-assessments are stored as rows, giving a level history.
- Archiving (`archived_at`) is preferred over deleting for goals, projects, habits, skills and languages.

## Advisor note
The Supabase security advisor flags `public.rls_auto_enable()` (a platform-provided SECURITY DEFINER function, not
part of this schema) as executable by `anon`/`authenticated`. Review it in the Supabase dashboard and revoke execute
if you don't rely on it.
