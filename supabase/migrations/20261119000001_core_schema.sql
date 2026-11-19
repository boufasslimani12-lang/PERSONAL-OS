-- PERSONAL OS — core schema
-- Single-user personal platform. Every row is owned by auth.uid() and protected by RLS.
-- Conventions:
--   * every user table has: id uuid pk, user_id uuid (defaults to auth.uid()), created_at, updated_at
--   * "life_area_id" links a record to one of the user's life areas (nullable)
--   * dates without time use `date`; instants use `timestamptz`

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Applies owner column defaults, updated_at trigger and owner-only RLS to a table.
create or replace function public.pos_secure_table(tbl text)
returns void language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "owner_select" on public.%I', tbl);
  execute format('drop policy if exists "owner_insert" on public.%I', tbl);
  execute format('drop policy if exists "owner_update" on public.%I', tbl);
  execute format('drop policy if exists "owner_delete" on public.%I', tbl);
  execute format('create policy "owner_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "owner_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "owner_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "owner_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tbl);
  execute format('drop trigger if exists trg_updated_at on public.%I', tbl);
  execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl);
  execute format('create index if not exists %I on public.%I (user_id)', tbl || '_user_id_idx', tbl);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile & life areas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'MAD',
  locale text not null default 'en',
  timezone text not null default 'Africa/Casablanca',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  dashboard_widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  color text not null default '#6366f1',
  icon text not null default 'circle',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Goals, projects, milestones, tasks
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references public.goals(id) on delete set null,
  level text not null default 'annual' check (level in ('annual','quarterly','monthly','weekly')),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  life_area_id uuid references public.life_areas(id) on delete set null,
  start_date date,
  target_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'active' check (status in ('not_started','active','on_hold','completed','cancelled')),
  progress_mode text not null default 'auto' check (progress_mode in ('auto','manual')),
  manual_progress int not null default 0 check (manual_progress between 0 and 100),
  notes text,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_parent_idx on public.goals(parent_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'general' check (kind in ('general','career_objective','business_idea','business_project')),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  status text not null default 'active' check (status in ('idea','planned','active','on_hold','completed','cancelled')),
  start_date date,
  due_date date,
  learning_requirements text,
  notes text,
  color text,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hard','soft')),
  name text not null,
  category text,
  description text,
  current_level int not null default 1 check (current_level between 0 and 10),
  target_level int not null default 7 check (target_level between 1 and 10),
  improvement_plan text,
  life_area_id uuid references public.life_areas(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_one_owner check (num_nonnulls(goal_id, project_id, skill_id) = 1)
);
create index milestones_goal_idx on public.milestones(goal_id);
create index milestones_project_idx on public.milestones(project_id);
create index milestones_skill_idx on public.milestones(skill_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  category text,
  project_id uuid references public.projects(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  life_area_id uuid references public.life_areas(id) on delete set null,
  -- recurrence: null = one-off; otherwise 'daily' | 'weekdays' | 'weekly' | 'monthly'
  recurrence text check (recurrence in ('daily','weekdays','weekly','monthly')),
  recurrence_interval int not null default 1 check (recurrence_interval between 1 and 365),
  notes text,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_due_idx on public.tasks(user_id, due_date);
create index tasks_parent_idx on public.tasks(parent_task_id);
create index tasks_goal_idx on public.tasks(goal_id);
create index tasks_project_idx on public.tasks(project_id);

-- Completion history. One row each time a task (or one occurrence of a recurring task) is completed.
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  occurrence_date date,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_completions_task_idx on public.task_completions(task_id);
create index task_completions_date_idx on public.task_completions(user_id, completed_at);

-- ---------------------------------------------------------------------------
-- Habits (also used by the Religion module via module = 'religion')
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module text not null default 'habits' check (module in ('habits','religion')),
  name text not null,
  description text,
  category text,
  life_area_id uuid references public.life_areas(id) on delete set null,
  kind text not null default 'binary' check (kind in ('binary','measurable')),
  unit text,
  target_value numeric not null default 1 check (target_value > 0),
  -- daily: every day. weekly: `times_per_week` completions per week. custom: on `days_of_week` (0=Sun..6=Sat)
  frequency text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  times_per_week int not null default 1 check (times_per_week between 1 and 7),
  days_of_week smallint[] not null default '{}',
  color text not null default '#10b981',
  start_date date not null default current_date,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logs keep a snapshot of the target at the time of logging, so editing a habit never rewrites history.
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  value numeric not null default 1 check (value >= 0),
  target_value numeric not null default 1 check (target_value > 0),
  completed boolean generated always as (value >= target_value) stored,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index habit_logs_date_idx on public.habit_logs(user_id, log_date);

-- ---------------------------------------------------------------------------
-- Calendar events (tasks/workouts/study sessions are NOT duplicated here; the calendar reads them directly)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'event' check (kind in ('event','reminder','deadline')),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  recurrence text check (recurrence in ('daily','weekly','monthly','yearly')),
  recurrence_until date,
  life_area_id uuid references public.life_areas(id) on delete set null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);
create index events_start_idx on public.events(user_id, start_at);

-- ---------------------------------------------------------------------------
-- Fitness & health
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'strength' check (category in ('strength','cardio','mobility','bodyweight','sport','other')),
  muscle_group text,
  equipment text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  split_name text,
  description text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sort_order int not null default 0,
  target_sets int not null default 3 check (target_sets between 1 and 50),
  target_reps text not null default '8-12',
  target_weight numeric,
  rest_seconds int not null default 90 check (rest_seconds between 0 and 3600),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wte_template_idx on public.workout_template_exercises(template_id);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_started_idx on public.workouts(user_id, started_at);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number int not null default 1,
  reps int check (reps >= 0),
  weight numeric check (weight >= 0),
  duration_seconds int check (duration_seconds >= 0),
  distance_m numeric check (distance_m >= 0),
  rpe numeric check (rpe between 1 and 10),
  rest_seconds int,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_sets_workout_idx on public.workout_sets(workout_id);
create index workout_sets_exercise_idx on public.workout_sets(exercise_id);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric check (weight_kg > 0),
  height_cm numeric check (height_cm > 0),
  body_fat_pct numeric check (body_fat_pct between 0 and 100),
  waist_cm numeric, chest_cm numeric, arm_cm numeric, thigh_cm numeric, hips_cm numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index body_metrics_date_idx on public.body_metrics(user_id, measured_on);

-- ---------------------------------------------------------------------------
-- Education: academic year > semester > subject > course > chapter > lesson
-- ---------------------------------------------------------------------------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  start_date date, end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  start_date date, end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  code text,
  teacher text,
  coefficient numeric not null default 1 check (coefficient > 0),
  grade_scale numeric not null default 20 check (grade_scale > 0),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  notes text,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  started_at timestamptz not null default now(),
  duration_minutes int not null check (duration_minutes between 1 and 1440),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_sessions_started_idx on public.study_sessions(user_id, started_at);
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  kind text not null default 'exam' check (kind in ('assignment','exam','quiz','project','other')),
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending','submitted','graded')),
  score numeric check (score >= 0),
  max_score numeric check (max_score > 0),
  weight numeric not null default 1 check (weight > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Languages
-- ---------------------------------------------------------------------------
create table public.languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  current_level text not null default 'A1' check (current_level in ('A0','A1','A2','B1','B2','C1','C2')),
  target_level text not null default 'B2' check (target_level in ('A1','A2','B1','B2','C1','C2')),
  target_date date,
  weekly_goal_minutes int not null default 180 check (weekly_goal_minutes >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.language_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language_id uuid not null references public.languages(id) on delete cascade,
  session_date date not null default current_date,
  skill text not null check (skill in ('vocabulary','grammar','listening','speaking','reading','writing')),
  duration_minutes int not null check (duration_minutes between 1 and 1440),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language_id uuid not null references public.languages(id) on delete cascade,
  term text not null,
  translation text,
  example text,
  next_review_on date not null default current_date,
  interval_days int not null default 0,
  repetitions int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vocabulary_review_idx on public.vocabulary(language_id, next_review_on);

-- ---------------------------------------------------------------------------
-- Skills (hard & soft) logging
-- ---------------------------------------------------------------------------
create table public.skill_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  session_date date not null default current_date,
  duration_minutes int not null check (duration_minutes between 1 and 1440),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  assessed_on date not null default current_date,
  level int not null check (level between 0 and 10),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generic learning resources (languages, skills, projects, growth)
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  url text,
  kind text not null default 'link' check (kind in ('link','book','course','video','article','tool','project','other')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  language_id uuid references public.languages(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  color text not null default '#64748b',
  monthly_budget numeric check (monthly_budget >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, name)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'MAD',
  category_id uuid references public.finance_categories(id) on delete set null,
  description text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_date_idx on public.transactions(user_id, occurred_on);
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Personal growth
-- ---------------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  author text,
  total_pages int check (total_pages > 0),
  current_page int not null default 0 check (current_page >= 0),
  status text not null default 'to_read' check (status in ('to_read','reading','finished','abandoned')),
  started_on date, finished_on date,
  rating int check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.growth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('course','challenge','lesson','achievement','reflection','improvement')),
  title text not null,
  description text,
  status text not null default 'active' check (status in ('planned','active','completed','abandoned')),
  progress int not null default 0 check (progress between 0 and 100),
  occurred_on date,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal & notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'note' check (kind in ('daily','weekly','monthly','note')),
  title text,
  content text not null default '',
  entry_date date not null default current_date,
  tags text[] not null default '{}',
  mood smallint check (mood between 1 and 5),
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  habit_id uuid references public.habits(id) on delete set null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_date_idx on public.notes(user_id, entry_date);
create index notes_tags_idx on public.notes using gin(tags);

-- ---------------------------------------------------------------------------
-- Attachments (files live in the private "attachments" storage bucket)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('subject','lesson','assessment','note','project','goal')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attachments_entity_idx on public.attachments(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Apply ownership RLS + triggers to every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','life_areas','goals','projects','skills','milestones','tasks','task_completions',
    'habits','habit_logs','events','exercises','workout_templates','workout_template_exercises',
    'workouts','workout_sets','body_metrics','academic_years','semesters','subjects','courses',
    'chapters','lessons','study_sessions','assessments','languages','language_sessions','vocabulary',
    'skill_sessions','skill_assessments','resources','finance_categories','transactions',
    'savings_goals','books','growth_items','notes','attachments'
  ] loop
    perform public.pos_secure_table(t);
  end loop;
end $$;

-- Indexes on remaining foreign keys
create index goals_life_area_idx on public.goals(life_area_id);
create index projects_goal_idx on public.projects(goal_id);
create index projects_life_area_idx on public.projects(life_area_id);
create index tasks_life_area_idx on public.tasks(life_area_id);
create index habits_life_area_idx on public.habits(life_area_id);
create index habit_logs_habit_idx on public.habit_logs(habit_id);
create index events_life_area_idx on public.events(life_area_id);
create index wte_exercise_idx on public.workout_template_exercises(exercise_id);
create index workouts_template_idx on public.workouts(template_id);
create index semesters_year_idx on public.semesters(academic_year_id);
create index subjects_semester_idx on public.subjects(semester_id);
create index courses_subject_idx on public.courses(subject_id);
create index chapters_course_idx on public.chapters(course_id);
create index lessons_chapter_idx on public.lessons(chapter_id);
create index study_sessions_subject_idx on public.study_sessions(subject_id);
create index study_sessions_lesson_idx on public.study_sessions(lesson_id);
create index assessments_subject_idx on public.assessments(subject_id);
create index language_sessions_lang_idx on public.language_sessions(language_id);
create index skills_life_area_idx on public.skills(life_area_id);
create index skill_sessions_skill_idx on public.skill_sessions(skill_id);
create index skill_assessments_skill_idx on public.skill_assessments(skill_id);
create index resources_language_idx on public.resources(language_id);
create index resources_skill_idx on public.resources(skill_id);
create index resources_project_idx on public.resources(project_id);
create index transactions_category_idx on public.transactions(category_id);
create index notes_life_area_idx on public.notes(life_area_id);
create index notes_goal_idx on public.notes(goal_id);
create index notes_project_idx on public.notes(project_id);
create index notes_habit_idx on public.notes(habit_id);

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile, ten life areas, default finance categories and a starter exercise library.
-- Nothing here is fake progress data — only configuration the user can edit or delete.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.life_areas (user_id, key, name, color, icon, sort_order) values
    (new.id, 'health',      'Fitness & Health',   '#ef4444', 'dumbbell',       1),
    (new.id, 'education',   'Education',          '#3b82f6', 'graduation-cap', 2),
    (new.id, 'languages',   'Languages',          '#06b6d4', 'languages',      3),
    (new.id, 'hard_skills', 'Hard Skills',        '#8b5cf6', 'code',           4),
    (new.id, 'soft_skills', 'Soft Skills',        '#ec4899', 'users',          5),
    (new.id, 'career',      'Career & Business',  '#f59e0b', 'briefcase',      6),
    (new.id, 'religion',    'Religion',           '#14b8a6', 'moon',           7),
    (new.id, 'finance',     'Finance',            '#22c55e', 'wallet',         8),
    (new.id, 'growth',      'Personal Growth',    '#f97316', 'sprout',         9),
    (new.id, 'mind',        'Mind & Reflection',  '#6366f1', 'notebook-pen',  10);

  insert into public.finance_categories (user_id, name, kind, color) values
    (new.id, 'Salary', 'income', '#22c55e'),
    (new.id, 'Freelance', 'income', '#10b981'),
    (new.id, 'Other income', 'income', '#84cc16'),
    (new.id, 'Housing', 'expense', '#ef4444'),
    (new.id, 'Food', 'expense', '#f97316'),
    (new.id, 'Transport', 'expense', '#f59e0b'),
    (new.id, 'Utilities', 'expense', '#eab308'),
    (new.id, 'Health', 'expense', '#ec4899'),
    (new.id, 'Education', 'expense', '#3b82f6'),
    (new.id, 'Leisure', 'expense', '#8b5cf6'),
    (new.id, 'Other', 'expense', '#64748b');

  insert into public.exercises (user_id, name, category, muscle_group, equipment) values
    (new.id, 'Barbell Back Squat', 'strength', 'Legs', 'Barbell'),
    (new.id, 'Barbell Bench Press', 'strength', 'Chest', 'Barbell'),
    (new.id, 'Deadlift', 'strength', 'Back', 'Barbell'),
    (new.id, 'Overhead Press', 'strength', 'Shoulders', 'Barbell'),
    (new.id, 'Barbell Row', 'strength', 'Back', 'Barbell'),
    (new.id, 'Pull-up', 'bodyweight', 'Back', 'Bodyweight'),
    (new.id, 'Push-up', 'bodyweight', 'Chest', 'Bodyweight'),
    (new.id, 'Dumbbell Lunge', 'strength', 'Legs', 'Dumbbell'),
    (new.id, 'Plank', 'bodyweight', 'Core', 'Bodyweight'),
    (new.id, 'Running', 'cardio', 'Full body', 'None');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.pos_secure_table(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private attachments bucket, files stored under "<user_id>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create policy "attachments_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
