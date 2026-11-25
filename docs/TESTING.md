# Testing

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript + React hooks rules) |
| `npm test` | Unit tests for the calculation engine, dates/time zones, Markdown and CSP (`tests/*.test.ts`) |
| `npm run test:e2e` | Playwright browser tests (`tests/e2e/`) |
| `npm run check` | typecheck + lint + unit tests + build |

## Browser tests run only against a local Supabase
`tests/e2e/env.ts` refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` points to `localhost`/`127.0.0.1`.
Each run creates a throwaway confirmed user through the local Auth admin API and deletes it afterwards
(all its rows cascade). The production database is never touched.

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta,mailpit
eval "$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY E2E_SUPABASE_SECRET_KEY=$SECRET_KEY
npm run build && npm run test:e2e
```
The local stack applies `supabase/migrations/` to a fresh database, so the suite also validates the schema.

What the suite covers: security headers and CSP (any CSP violation or console error fails the test), auth redirect,
all 17 pages, no horizontal scroll at 390 px, goals/milestones/tasks progress, quick-add and recurring tasks,
habit check-ins, finance totals, safe Markdown, workout logging with rest timer and in-app delete confirmation,
calendar events, profile time-zone handling, and life-area activation (`tests/e2e/life-areas.spec.ts`:
sidebar, persistence, analytics/dashboard exclusion, selectors, data kept, reactivation, several areas, simulated
save failure with rollback, and one request per click while saving).

CI (`.github/workflows/ci.yml`) runs all of the above on every push to `main` and `claude/**` and on pull requests.
