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
proxy.ts                  Next 16 proxy: per-request CSP nonce, refreshes the Supabase session, guards routes
lib/security/csp.ts       Content-Security-Policy builder and static security headers
lib/server/date-context.ts  today/hour/dateOf in the profile time zone (per request)
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

## Active / inactive life areas
`life_areas.is_active` is the single switch (Settings → Life areas). `lib/life-areas.ts` decides its effects:
- **Navigation**: the app layout reads the areas on every render and hides the module page of each inactive area
  (`AREA_HREF`; *Mind & Reflection* maps to Journal & Notes). The page stays reachable by URL and shows a notice.
- **Scoring**: `loadLifeSnapshot()` scores active areas only, so the dashboard and analytics exclude inactive ones.
- **Selectors**: new records offer active areas only (`areaOptions`); a record already linked to an inactive area
  keeps it, labelled "(inactive)". Filters list every area (`areaFilterOptions`) so old records stay findable.
- Deactivating never deletes or changes records; reactivating restores everything.

## Dashboard and Fitness
- Dashboard (`app/(app)/dashboard/page.tsx`) is a Server Component on top of `loadLifeSnapshot()` (same scores as
  Analytics) and `lib/engine/dashboard.ts` (today's tasks, focus, upcoming). Task and habit controls reuse
  `TaskCheck`/`HabitCheck`, so they write the same records as the Tasks and Habits pages.
- Quick actions link to `?new=<kind>`; `useCreateFromQuery()` opens that module's existing create dialog.
- Fitness (`app/(app)/fitness/`): `program-section` (programs, days, exercises), `workout-logger` (live session),
  `progression-section`, `history-section`; session actions in `lib/hooks/use-workout-actions.ts`; calculations in
  `lib/engine/fitness.ts`.

## Time zones
The server runs in UTC. Every "today", day boundary and displayed time uses `profiles.timezone`
(default Africa/Casablanca): `getDateContext()` on the server and `DateProvider` + `lib/dates.ts` on the client.

## Internationalisation readiness
UI strings are plain English literals concentrated in view components and `lib/constants.ts`; dates and currency use
`Intl` APIs; `profiles.locale` is stored for a future translation layer.
