<div align="center">

# Reseller Hub

**Reseller & admin control plane for KURDISTAN IPTV.**

Manage resellers, sell credits, issue customer lines, and stream a live M3U catalog —
from one responsive panel.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=white)
![Lovable](https://img.shields.io/badge/Built%20with-Lovable-000000?logo=lovable&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

</div>

---

## Overview

Reseller Hub is a two-tier subscription panel for an IPTV operation. Super admins
provision resellers and sell them credits; resellers spend those credits to create and
renew customer lines. Every credit movement and expiry calculation is enforced in the
database, so balances can never drift from what the UI shows.

The platform also serves the catalog itself: a GitHub-hosted M3U playlist is parsed,
cached, and re-published as provider endpoints (Xtream-style API, M3U feed, MAC portal),
plus direct playback for live, movie, series, MP3 and MP4 sources.

**At a glance**

| | |
|---|---|
| Currency | 1 credit = 1 subscription month |
| Connection billing | 1 credit per extra connection per month |
| Playlist source | Single GitHub M3U, refreshed automatically |
| Low-balance warning | Below 10 credits |
| Roles | `super_admin`, `reseller` |

## Key features

### Super Admin

- Create, edit, and delete reseller accounts
- Assign and adjust credit balances, with a full transaction ledger
- Monitor system health, active connections, and recent provider activity
- Track active vs. expired lines across every reseller at once
- Manage the catalog: playlists, MP4 uploads, image links, and playback tests

### Reseller

- See live credit balance and low-balance warnings
- Create and manage customer lines (username, password, expiry, connection limit)
- Renew subscriptions with credits — one click, atomic in the database
- Track active/expired customers with clear status indicators
- Copy provider host and line credentials for delivery to customers

## Modules

| Module | Path | What it does |
|---|---|---|
| Dashboard | `/dashboard` | KPIs, balance, active/expired lines, low-credit alert |
| Resellers | `/resellers` | Admin-only reseller CRUD and credit assignment |
| Lines | `/lines` | Customer line CRUD, renewal, connection limits, credentials |
| Credits | `/credits` | Balance history and transaction ledger |
| Playlists | `/playlists` | M3U catalog: categories, ordering, channel editing |
| MP4 uploads | `/youtube-episodes` | Public MP4 library with token-free playback links |
| Image to Link | `/image-to-link` | Convert uploads into permanent public image URLs |
| Contact | `/contact` | Support routing |

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Start (file-based routing, SSR) |
| Styling | Tailwind CSS 4, shadcn/ui, Radix primitives |
| Data | TanStack Query, React Hook Form, Zod |
| Backend | Supabase — Postgres, Auth, Storage, Row Level Security |
| Business logic | Postgres functions & triggers (credits, expiry, limits) |
| Playback | hls.js, mpegts.js, shaka-player |
| Testing | Vitest + PGlite (in-memory Postgres) |
| Tooling | Vite, TypeScript, ESLint, Prettier, Bun |

## Project structure

```text
.
├── src/
│   ├── routes/                # File-based routes (TanStack Router)
│   │   ├── __root.tsx         # Shell, providers, toasts
│   │   ├── auth.tsx           # Sign in
│   │   ├── _authenticated/    # Panel pages (role-guarded)
│   │   └── api/public/        # Provider endpoints & playback routes
│   ├── lib/                   # Server functions, playback, catalog, billing helpers
│   ├── components/            # Shared UI + shadcn/ui primitives
│   ├── integrations/supabase/ # Generated client & types
│   └── test/                  # Unit, routing, and permission tests
├── supabase/                  # Database migrations & config
├── drizzle/                   # Schema snapshots
└── public/                    # Static assets
```

## Getting started

### Prerequisites

- Node.js 20+ (or Bun 1.2+)
- A Supabase project (or Lovable Cloud) with the migrations applied

### Install & run

```sh
git clone <your-repository-url>
cd reseller-hub
npm install
cp .env.example .env      # then fill in the values below
npm run dev
```

The panel runs at `http://localhost:8080`.

```sh
npm run test              # unit + permission tests
npm run lint              # ESLint
npm run build             # production build
```

## Environment variables

Copy to `.env` and replace the placeholders. Never commit real values.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Publishable key (RLS applies) |
| `SUPABASE_URL` | Server | Same URL, server-side calls |
| `SUPABASE_ANON_KEY` | Server | Same key, server-side calls |

## Default admin login

> ⚠️ **Example credentials only.** These are documentation placeholders — they are not
> valid accounts. Create your own admin user, then change the password immediately
> after the first login.

```text
Email:    admin@example.com
Password: ChangeMe123!
```

- Public sign-up is disabled; admins create reseller accounts directly.
- Use a long, unique password and enable email confirmation on your auth provider.

## Security notes

- **Roles are data, not metadata.** Privileges come from a protected `user_roles`
  table, never from user-editable auth metadata.
- **RLS on every table.** All application tables have Row Level Security enabled with
  explicit policies; resellers can only read and write their own lines.
- **Billing lives in the database.** Credit deduction, renewal, and expiry run inside
  Postgres functions and triggers, so they are atomic and cannot be bypassed from the
  client.
- **Admin routes are guarded twice** — by route-level role checks and by RLS policies.
- **Playback is authorized per line.** Stream routes verify credentials and connection
  limits before proxying, and private/internal hosts are blocked on every redirect hop.
- **Never commit secrets.** Keep `.env`, service-role keys, and database passwords out
  of version control; use your host's secret store instead.

## Deployment

The app builds to an edge-deployable bundle.

```sh
npm run build
npm run preview
```

1. Push to your Git host, or publish directly from Lovable.
2. Point your custom domain at the deployment and set it as the primary address, so
   provider and stream URLs never bounce through a redirect.
3. Set the environment variables in your hosting dashboard (not in the repo).
4. Apply migrations to the production database.
5. Verify: sign in, create a test line, renew it with credits, and play a channel.

## License

Released under the [MIT License](LICENSE). Free to use, modify, and distribute with
attribution.

## Contact

Questions, issues, or feature requests: open an issue in this repository, or reach the
maintainer through the support channel listed on the in-app Contact page.

---

<p align="center">
  <sub>Built with <a href="https://lovable.dev">Lovable</a> · React · Tailwind CSS · Supabase</sub>
</p>
