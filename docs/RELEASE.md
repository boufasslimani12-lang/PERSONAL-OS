# Release process

One Vercel project serves Personal OS: **`personal-os` in the `boufas01` Vercel account** (Git-connected).
The second project (`personal-os` in `boufaskhalid75-hub`) is kept but unused; do not deploy from it.

## Branches
| Branch | Purpose | Vercel |
|---|---|---|
| `main` | Production. Only reviewed, CI-green code. | Production deployment |
| `claude/*`, feature branches | Development | Preview deployment per push |

## One-time setup (owner)
1. Create `main` from the approved development commit (merge `claude/inspiring-planck-grxcw1` → `main`).
2. Vercel (`boufas01`) → Project → Settings → Git → **Production Branch = `main`**.
3. Vercel → Settings → Build & Development → **Node.js Version = 22.x** (also pinned by `package.json` `engines`).
4. Vercel → Settings → Environment Variables: optional overrides only (the app defaults to the confirmed Supabase
   project). If set, enable them for **Production and Preview**.
5. GitHub → Settings → Branches → protect `main`: require the **CI** workflow (`quality` and `e2e` jobs) to pass,
   require a pull request.
6. Supabase → Authentication → URL Configuration: Site URL = production domain; add
   `https://<production-domain>/auth/callback` and `https://*-boufas01.vercel.app/auth/callback` to Redirect URLs.

## Every release
1. Work on a development branch; push → CI runs type check, lint, unit tests, build and browser tests (local Supabase).
2. Check the Vercel **Preview** of that branch.
3. Open a pull request into `main`; merge only when CI is green and the preview is verified.
4. Vercel deploys `main` to Production automatically. Verify `/login`, sign in, open `/dashboard`.
5. Rollback: Vercel → Deployments → previous production deployment → **Promote to Production** (instant, no rebuild).

## Database changes
- Every schema change is a new file in `supabase/migrations/` and is tested by CI on a fresh local database.
- Apply to production only after review, never destructive without explicit approval, and before deploying code that
  depends on it. Back up first (Supabase → Database → Backups).
