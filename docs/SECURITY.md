# Security

## Data access
- Every `public` table has Row Level Security with owner-only policies (`auth.uid() = user_id`); 38 tables, 152 policies.
- The `attachments` storage bucket is private; objects live under `<user_id>/…` and are served with 60-second signed URLs.
- The browser only ever holds the **publishable** key. No service-role key is used by the app or stored in the repo.
- `public.rls_auto_enable()` + event trigger `ensure_rls` (Supabase-provided) automatically enable RLS on new public tables.

## HTTP hardening
- Content-Security-Policy per request (`proxy.ts`, `lib/security/csp.ts`): nonce + `strict-dynamic` scripts,
  no `unsafe-eval`, `connect-src` limited to the app and the Supabase host, `frame-ancestors 'none'`,
  `object-src 'none'`, `form-action 'self'`, `base-uri 'self'`. `style-src` allows inline styles (React style attributes).
- Static headers (`next.config.ts`): HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy, Permissions-Policy, COOP.
- Zod runs in jitless mode so validation never needs `eval`.
- Browser tests fail on any CSP violation.

## Authentication
- Email + password. The app hides sign-up (`NEXT_PUBLIC_ALLOW_SIGNUP=false`), but **the Supabase Auth setting is what
  actually blocks sign-ups**. As of 19 Nov 2026, `GET /auth/v1/settings` reports `"disable_signup": false` — see the
  pending actions below.
- Recommended Supabase Auth settings: sign-ups disabled, minimum password length ≥ 8, leaked-password protection on.

## Pending owner actions (as of 19 Nov 2026)
| ID | Action | Where |
|---|---|---|
| H2 | Turn off "Allow new users to sign up"; set minimum password length 8+ | Supabase → Authentication → Sign In / Providers, Policies |
| M4 | Approve revoking public execute on `rls_auto_enable()` (SQL below) | — |
| M2 | Approve deleting the QA account `qa-temp@personal-os.test` (SQL below) | — |

### M4 — proposed SQL (not applied)
```sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```
Impact analysis: the function returns `event_trigger`, so PostgREST cannot invoke it as an RPC in a useful way and
nothing in the app calls it. Its only consumer is the event trigger `ensure_rls`, which runs it as the table-creating
role (`postgres`/`supabase_admin` during migrations), and `postgres` keeps EXECUTE as owner. Revoking from `PUBLIC`,
`anon` and `authenticated` therefore removes the advisor warning without changing behaviour. Reversible with
`grant execute on function public.rls_auto_enable() to anon, authenticated;`.

### M2 — proposed SQL (not applied)
```sql
-- QA account only; verified to own 74 rows, 0 storage files and no links to the owner's data.
delete from auth.users where id = '14e787aa-7f7b-4b6d-8267-b63cf847476e' and email = 'qa-temp@personal-os.test';
```
`ON DELETE CASCADE` removes that account's profile, life areas, categories, exercises and test records. The owner
account (`boufas12309@gmail.com`) is not referenced and is unaffected.
