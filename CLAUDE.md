# CLAUDE.md — working on Personal OS

Private single-user life-management app. Next.js 16 App Router + Supabase. Read `docs/ARCHITECTURE.md` first.

## Commands
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run test:e2e`
- Run `npm run check` before committing; run `npm run test:e2e` (local Supabase, docs/TESTING.md) for UI changes.
- Browser tests must never point at the production Supabase project (`tests/e2e/env.ts` enforces this).

## Conventions
- **Pages** (`app/(app)/<module>/page.tsx`) are Server Components: they call `requireUser()` and fetch with the
  server Supabase client, then render a `"use client"` view component that receives plain data.
- **Never pass functions or components (e.g. Lucide icons) from a Server Component to a Client Component.**
  Pass strings/data instead (charts take `valueFormat`, not `format`, from server code).
- **Mutations** happen client-side via `useDb()` (`lib/hooks/use-db.ts`) → Supabase with RLS → `router.refresh()`.
- **Forms**: use `EntityForm` (`components/forms/entity-form.tsx`) with a `Field[]` config; it validates with Zod,
  converts empty strings to `null` and handles create/update/delete.
- **Calculations** live in `lib/engine/*` as pure functions with relative `.ts` imports so `node --test` can run them.
  Any new metric must be added there, unit-tested, and documented in `docs/ANALYTICS.md`.
- Dates: calendar dates are ISO strings (`YYYY-MM-DD`) handled by `lib/dates.ts` — don't use `new Date("YYYY-MM-DD")` (UTC drift).
  "Today" and timestamp→day conversions use the **profile time zone**: `getDateContext()` on the server,
  `todayISO()`/`isoFromTimestamp()` on the client (set by `DateProvider`). Never `ts.slice(0, 10)` or `new Date().getHours()`.
- Security: no `eval`/`new Function`, no inline `<script>` without the CSP nonce, no new external hosts without
  updating `lib/security/csp.ts`. Deletions use `useConfirm()`, never `window.confirm`.
- Never show fake numbers. Missing data → "No data"/"—", never 0%.
- UI: Tailwind tokens from `app/globals.css` (`bg-card`, `text-muted-foreground`, …); both light and dark must work;
  layouts must work at 390px width with no page-level horizontal scroll.

## Database
- Schema changes = a new file in `supabase/migrations/` (timestamped). Every user table needs `user_id uuid default auth.uid()`,
  `created_at`, `updated_at`, then `select public.pos_secure_table('<table>')` to add RLS + trigger + index.
- Regenerate types after schema changes into `lib/supabase/database.types.ts`.
- Habit logs store a `target_value` snapshot — never rewrite historical logs when a habit changes.
- Completing a task always inserts into `task_completions` (`useTaskActions`).

## Secrets
Only the publishable key is used. Never commit `.env*` files or service-role keys.
