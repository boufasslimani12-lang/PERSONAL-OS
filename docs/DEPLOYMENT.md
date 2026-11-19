# Deployment & project information

## Services

| Service | Value |
|---|---|
| GitHub repository | https://github.com/boufasslimani12-lang/PERSONAL-OS |
| Working branch | `claude/inspiring-planck-grxcw1` (no `main` branch yet) |
| Supabase project | `grhbvkksrwsqwdznfbnj` — https://supabase.com/dashboard/project/grhbvkksrwsqwdznfbnj |
| Supabase API URL | https://grhbvkksrwsqwdznfbnj.supabase.co (region eu-west-1, Postgres 17) |
| Vercel project (account `boufas01`) | deployed from GitHub, e.g. https://personal-bq8glo0hs-boufas01.vercel.app |
| Vercel project (account `boufaskhalid75-hub`) | `personal-os` (`prj_mqWyRkNVlWP99GlM1hgLlgW5hKun`) — env vars set, not Git-connected, no live deployment |

## Configuration
The public Supabase URL and publishable key are built-in defaults in `lib/supabase/config.ts`, so every build
connects to the confirmed project without extra setup. Optional overrides (Vercel → Settings → Environment Variables,
Production + Preview, then redeploy):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Point at a different Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its publishable key (public) |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `true` only to show the sign-up form; default `false` |

`NEXT_PUBLIC_*` values are compiled into the build — changing them requires a redeploy.
Never add a service-role key anywhere.

## Supabase checklist
1. Authentication → Users → **Add user** (tick *Auto Confirm User*) to create the owner account.
2. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. Authentication → URL Configuration → Site URL = your Vercel URL; add `https://<your-domain>/auth/callback` to Redirect URLs.

## Before going to Production
- Merge `claude/inspiring-planck-grxcw1` into `main` and set `main` as the Vercel production branch.
- Keep a single Vercel project for Personal OS (two exist today, in two accounts).
- Vercel Authentication protects preview URLs; production custom domains are public — the app itself requires login.
