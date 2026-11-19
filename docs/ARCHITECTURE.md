# Architecture

```
app/
  layout.tsx              root: theme script, toast provider
  login/, auth/callback/  authentication (email + password, email confirmation callback)
  (app)/layout.tsx        authenticated shell: sidebar (desktop), top bar + bottom nav (mobile)
  (app)/<module>/page.tsx Server Component — loads data with RLS-scoped Supabase client
  (app)/<module>/*-view.tsx Client Component — UI, filters, dialogs, mutations
components/
  ui/                     shadcn-style primitives (button, form, card, dialog, misc, toast)
  forms/entity-form.tsx   config-driven create/edit/delete dialog with Zod validation
  shared/                 cross-module pieces (task row, habit check, habits board, attachments, resources, toggle check)
  charts.tsx, heatmap.tsx Recharts wrappers (palette tokens --series-1..8)
lib/
  engine/                 pure calculation engine (goals, habits, tasks, finance, fitness, education, calendar, life areas)
  server/                 server-only loaders (life snapshot shared by dashboard + analytics, habits, skills)
  supabase/               browser/server clients, session proxy helper, generated DB types
  hooks/                  useDb (mutations + refresh + toasts), useTaskActions (completion/recurrence)
  dates.ts, format.ts, markdown.ts, constants.ts, nav.ts
proxy.ts                  Next 16 proxy (formerly middleware): refreshes the Supabase session, guards routes
supabase/migrations/      SQL schema (source of truth)
tests/                    engine unit tests
```

## Data flow
1. `proxy.ts` refreshes the auth cookie and redirects signed-out users to `/login`.
2. A page calls `requireUser()` (cached per request) and queries Supabase. RLS restricts every query to the owner.
3. The page renders a client view with plain serialisable props.
4. The view mutates through `useDb()`; on success it calls `router.refresh()`, re-running the Server Component.

## Cross-module integration
- **Life areas** are the shared dimension: goals, tasks, projects, habits, events, skills and notes can reference one.
- **Goals ↔ tasks ↔ projects ↔ milestones** share one task table and one milestone table.
- **Religion** reuses the habit engine (`habits.module = 'religion'`).
- **Calendar** reads tasks, workouts, study sessions, goal targets and assessments directly — it never copies them into `events`.
- **Dashboard and Analytics** both use `loadLifeSnapshot()`, so they always show identical numbers.

## Internationalisation readiness
UI strings are plain English literals concentrated in view components and `lib/constants.ts`; dates and currency use
`Intl` APIs; `profiles.locale` is stored for a future translation layer.
