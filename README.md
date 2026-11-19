# Personal OS

A private, single-user **Personal Operating System**: one coherent app to plan, track and improve every
important area of life — goals, tasks, habits, calendar, fitness, education, languages, skills, career,
religion, finance, personal growth and journaling — with an honest analytics engine on top.

> Not a multi-tenant SaaS. Every row belongs to one authenticated owner and is protected by Postgres Row Level Security.

## Modules

| Module | Highlights |
|---|---|
| **Dashboard** | Overall life progress (with coverage), 10 life-area cards, today's tasks & habits, deadlines, events, weekly goals, productivity & monthly charts, recent activity, customizable widgets |
| **My Goals** | Annual → Quarterly → Monthly → Weekly hierarchy, milestones, linked tasks, auto/manual progress, filters, search, archive, deadline badges |
| **Tasks & Projects** | Today / Upcoming / All / Overdue / Completed / By project / By life area, list + Kanban (drag & drop), subtasks, recurrence, completion history |
| **Habits** | Binary & measurable habits, daily / N-per-week / specific days, streaks, consistency, heatmap, history kept when settings change |
| **Calendar** | Day / Week / Month / Agenda; shows events, tasks, workouts, study sessions, goal & exam deadlines without duplicating records; recurring events |
| **Fitness & Health** | Exercise library, user-built programs, live workout logger with rest timer, PRs, e1RM, volume, frequency, body metrics, BMI |
| **Education** | Year → Semester → Subject → Course → Chapter → Lesson, study sessions, assignments/exams, flexible grading scales, attachments |
| **Languages** | CEFR current/target, weekly time goals, sessions per skill, spaced-repetition vocabulary review, resources |
| **Hard / Soft Skills** | Skill library, roadmaps/improvement plans, milestones, resources, practice log, self-assessment history |
| **Career & Business** | Career objectives, business ideas (promote to project), business projects with milestones, tasks, resources, attachments |
| **Religion** | Configurable practices (prayer, Quran reading/memorization, adhkar…) on the habit engine — nothing imposed |
| **Finance** | Transactions, categories, monthly budgets, savings goals, income vs expenses, savings rate, budget utilisation (MAD default) |
| **Personal Growth** | Books & reading progress, courses, challenges, lessons learned, achievements, reflections, improvement goals |
| **Journal & Notes** | Daily / weekly / monthly templates, free notes, Markdown, tags, mood, search, date filters, links to goals/projects/habits/areas |
| **Analytics** | Life-area scores with components, weekly performance, learning time, workouts, goals by level, finance — with every formula documented |
| **Settings** | Profile, currency, time zone, week start, life areas, password, full JSON export |

## Tech stack

Node 22 · Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style UI primitives · Lucide · Recharts ·
Zod · Supabase (Postgres, Auth, Storage, RLS) · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

1. Apply the database schema: run `supabase/migrations/*.sql` in order (Supabase SQL editor or `supabase db push`).
2. Set `NEXT_PUBLIC_ALLOW_SIGNUP=true`, open `/login` and create your single owner account.
3. Set `NEXT_PUBLIC_ALLOW_SIGNUP=false` again **and** disable sign-ups in Supabase → Authentication → Sign In / Providers.

On sign-up a database trigger creates your profile, the 10 life areas, default finance categories and a starter
exercise library. No fake progress data is ever inserted.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (engine, dates/time zones, Markdown, CSP) |
| `npm run test:e2e` | Playwright browser tests against a local Supabase — see docs/TESTING.md |
| `npm run check` | Everything except browser tests |

## Environment variables

| Name | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key — safe for the browser; RLS protects data |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `true` only while creating the owner account |

Never commit `.env.local` or any service-role key. The app does not need a service-role key.

## Deploying to Vercel

Import the GitHub repository in Vercel (framework preset: Next.js), add the environment variables above for
Production and Preview, and deploy. In Supabase → Authentication → URL Configuration, add your Vercel domain as
Site URL and `https://<domain>/auth/callback` as a redirect URL.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure, data flow, conventions
- [docs/DATABASE.md](docs/DATABASE.md) — tables, relationships, RLS, storage
- [docs/ANALYTICS.md](docs/ANALYTICS.md) — exactly how every percentage is calculated
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — services, URLs, configuration and go-live checklist
- [docs/RELEASE.md](docs/RELEASE.md) — branches, preview → production flow, rollback
- [docs/TESTING.md](docs/TESTING.md) — unit, lint and browser tests; local Supabase
- [docs/SECURITY.md](docs/SECURITY.md) — RLS, CSP and headers, auth, pending owner actions
- [CLAUDE.md](CLAUDE.md) — guide for AI-assisted development
