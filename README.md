# Expense Manager

A production-quality **Expense Manager Progressive Web App** built with **React + Vite + TypeScript + Tailwind CSS**, implementing a strict Apple-marketing-derived design system.

## Highlights

- **Cloud sync** — Supabase Auth + Postgres with row-level security; each user's data is isolated in the cloud.
- **Installable PWA** — manifest + service worker, offline-capable shell (`vite-plugin-pwa`).
- **Role-based access** — `Owner` / `Member` / `Viewer`, enforced in both the UI and the repository layer.
- **Light / Dark / System** themes, persisted per-user, with live OS-theme updates and no flash on load.
- **Single accent color** (Action Blue) across the entire app — no second hue.
- **Purposeful motion** via Framer Motion (one system-wide press-scale, spring sheets, count-ups, chart draw-in), all respecting `prefers-reduced-motion`.

## Tech stack

| Concern | Choice |
|---|---|
| Build | Vite |
| UI | React + TypeScript |
| Styling | Tailwind CSS (tokens in `src/styles/tokens.css`) |
| Motion | Framer Motion |
| Charts | Recharts |
| Persistence | Supabase (Postgres + Auth). IndexedDB fallback when env vars are absent. |
| Auth | Supabase Auth (email + password) |
| PWA | `vite-plugin-pwa` |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (or open your existing one).
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. Copy `.env.example` to `.env.local` and paste your keys:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. Open **SQL Editor** in Supabase and run the full contents of `supabase/schema.sql`.
5. In **Authentication → Providers → Email**, disable **Confirm email** for local dev (optional — otherwise users must confirm before sign-in).
6. Restart the dev server: `npm run dev`.

### Switching Supabase accounts

When you move to a new Supabase project:

1. Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Run `supabase/schema.sql` on the new project (SQL Editor).
3. **Log the CLI into the same account** that owns the project (see below).
4. Link: `supabase link --project-ref YOUR-PROJECT-REF` (ref = subdomain in the URL).
5. Re-deploy Edge Functions and secrets on the new project.

**CLI shows the wrong projects?** The Supabase CLI login is separate from `.env.local`. If `supabase projects list` shows a different org (e.g. KBS) than your app URL, run:

```bash
supabase logout
supabase login          # sign in with the account that owns your expense-manager project
supabase link --project-ref hjhysmcablfoyhwrehsc   # use your project ref from .env.local
supabase functions deploy send-partner-push
```

**Browser login fails (“Could not create CLI login session”)?** Skip the browser flow and use a personal access token:

1. Open [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) while signed into the **correct** account.
2. **Generate new token** → copy it (starts with `sbp_`).
3. In terminal:

```bash
supabase logout
supabase login --token sbp_YOUR_TOKEN_HERE
supabase projects list    # should show hjhysmcablfoyhwrehsc
supabase link --project-ref hjhysmcablfoyhwrehsc
supabase functions deploy send-partner-push
```

If login still fails, update the CLI (`brew upgrade supabase` or `npm i -g supabase@latest`) and retry.

To keep multiple Supabase accounts on one machine, use CLI profiles:

```bash
supabase login --profile expense-manager
supabase link --project-ref hjhysmcablfoyhwrehsc --profile expense-manager
supabase functions deploy send-partner-push --profile expense-manager
```

Each signed-up user gets a `profiles` row (via database trigger) and their own categories, expenses, receipts, and recurring rules — protected by Row Level Security.

### Web Push (optional — partner alerts when app is closed)

Background push needs **three things** beyond in-app Realtime alerts:

1. Run `npm run vapid:generate` and add `VITE_VAPID_PUBLIC_KEY` to `.env.local`.
2. In Supabase → **Edge Functions → Secrets**, set:
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)
   - `PARTNER_PUSH_WEBHOOK_SECRET` (any long random string)
3. Deploy: `supabase functions deploy send-partner-push --project-ref hjhysmcablfoyhwrehsc`
4. Run `supabase/migrations/20260704_partner_push_config_table.sql` in SQL Editor (or re-run `20260703` if fresh), then set the secret:

```sql
insert into public.partner_push_config (id, webhook_secret)
values (1, 'same-secret-as-PARTNER_PUSH_WEBHOOK_SECRET')
on conflict (id) do update set webhook_secret = excluded.webhook_secret;
```

5. **Both users** enable **Partner activity alerts** in Settings (registers their device).
6. **iPhone:** Add to Home Screen (iOS 16.4+). Use **Test background push** in Settings, then close the app.

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # typecheck + production build (also generates the service worker)
npm run preview    # preview the production build (test PWA/offline)
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate PWA icons from scripts/generate-icons.mjs
```
## Project structure

```
src/
  styles/        tokens.css (single source of color truth) + global styles
  lib/           types, formatting, analytics, motion, icons, helpers
  data/          Supabase + local repositories, AppDataProvider
  lib/supabase/  Supabase client, types, mappers
  auth/          local AuthProvider (signup/login/session)
  theme/         ThemeProvider (light/dark/system, per-user)
  components/    design-system component library (§4)
  features/      composed feature units (expense sheet/row, charts, sheets)
  layout/        AppShell (bottom tabs / left rail) + Screen primitives
  screens/       Dashboard, Transactions, Budgets, Insights, Settings, Auth, Dev
```

## Design system notes

- Colors are **only** referenced via tokens (CSS custom properties mirrored into Tailwind). The lone interactive color is `--color-primary` (Action Blue), becoming Sky Link Blue (`--color-primary-focus`) on dark surfaces.
- The **only** shadow in the system is reserved for the Add-Expense FAB and "lifted" receipt thumbnails. Cards use a 1px hairline border instead.
- Pills are reserved for actions/chips; cards use the 18px `lg` radius.
- Font weights are limited to 300 / 400 / 600 / 700 (never 500). Body copy is 17px.

## Roles

| Capability | Owner | Member | Viewer |
|---|---|---|---|
| View dashboard & insights | ✓ | ✓ | ✓ |
| Add / edit / delete expenses | ✓ | ✓ | — |
| Manage recurring expenses | ✓ | ✓ | — |
| Manage categories & budget limits | ✓ | — | — |
| Export / delete all data | ✓ | — | — |

Viewer never renders add/edit/delete controls, and the repository rejects writes from disallowed roles even if called directly.

## Component showcase

Visit `/dev` for a storybook-style page that renders the component library against the design tokens.
