-- PERSONAL OS — workout programs (additive, non-destructive)
-- A program groups training days (existing workout_templates). Exactly one non-archived program can be active.
-- Existing rows are untouched except for the backfill below, which only fills the new nullable program_id.

create table public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  is_active boolean not null default false,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Owner-only RLS (select/insert/update/delete where auth.uid() = user_id), updated_at trigger, user_id index.
select public.pos_secure_table('workout_programs');

-- At most one active, non-archived program per user.
create unique index workout_programs_one_active on public.workout_programs (user_id) where is_active and archived_at is null;

alter table public.workout_templates
  add column program_id uuid references public.workout_programs(id) on delete set null;
create index workout_templates_program_idx on public.workout_templates (program_id);

-- Backfill: one program per existing split name, so earlier training days keep their grouping.
insert into public.workout_programs (user_id, name)
select distinct t.user_id, left(t.split_name, 120)
from public.workout_templates t
where t.split_name is not null and btrim(t.split_name) <> '' and t.program_id is null;

update public.workout_templates t
set program_id = p.id
from public.workout_programs p
where t.program_id is null and p.user_id = t.user_id and p.name = left(t.split_name, 120);

-- Make the caller's chosen program the active one (atomic). SECURITY INVOKER: RLS limits it to the caller's rows.
create or replace function public.set_active_workout_program(p_program_id uuid)
returns void language plpgsql security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.workout_programs where id = p_program_id and archived_at is null) then
    raise exception 'Program not found' using errcode = 'P0002';
  end if;
  update public.workout_programs set is_active = false where is_active and id <> p_program_id;
  update public.workout_programs set is_active = true where id = p_program_id;
end;
$$;

-- Copy a program with its training days and their exercises (atomic). SECURITY INVOKER: RLS applies,
-- and new rows default to user_id = auth.uid().
create or replace function public.duplicate_workout_program(p_program_id uuid, p_name text default null)
returns uuid language plpgsql security invoker
set search_path = ''
as $$
declare
  new_program uuid;
  day record;
  new_day uuid;
begin
  insert into public.workout_programs (name, description, sort_order)
  select coalesce(nullif(btrim(p_name), ''), left(name || ' (copy)', 120)), description, sort_order + 1
  from public.workout_programs where id = p_program_id
  returning id into new_program;
  if new_program is null then
    raise exception 'Program not found' using errcode = 'P0002';
  end if;
  for day in
    select * from public.workout_templates where program_id = p_program_id and archived_at is null order by sort_order, created_at
  loop
    insert into public.workout_templates (name, split_name, description, sort_order, program_id)
    values (day.name, day.split_name, day.description, day.sort_order, new_program)
    returning id into new_day;
    insert into public.workout_template_exercises (template_id, exercise_id, sort_order, target_sets, target_reps, target_weight, rest_seconds, notes)
    select new_day, exercise_id, sort_order, target_sets, target_reps, target_weight, rest_seconds, notes
    from public.workout_template_exercises where template_id = day.id;
  end loop;
  return new_program;
end;
$$;

revoke execute on function public.set_active_workout_program(uuid) from public, anon;
revoke execute on function public.duplicate_workout_program(uuid, text) from public, anon;
grant execute on function public.set_active_workout_program(uuid) to authenticated;
grant execute on function public.duplicate_workout_program(uuid, text) to authenticated;
