# 1A1 Research Cell

The research archive and publication platform of the **1A1 Research Cell**,
Lahore Grammar School 1-A-1, Lahore.

The site is two things at once: a public archive of the Research Cell's
published work, and a private system through which students submit research and
the Research Cell and school administration review, approve and publish it.

> **Status: in development.** Not deployed, not public, and seeded with
> placeholder content. Wording marked `[PLACEHOLDER]` is awaiting approved text
> from the school and has deliberately not been invented.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase — PostgreSQL, Auth, Storage, Row Level Security |
| Hosting | Vercel (not yet configured) |

---

## Getting started

```bash
npm install
```

Copy the environment template and fill it in from your Supabase project
(Project Settings → API):

```bash
cp .env.example .env.local
```

Then:

```bash
npm run dev
```

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:link` | Link the repo to a Supabase project |
| `npm run db:push` | Apply migrations to the linked project |
| `npm run db:types` | Regenerate `src/lib/types/database.ts` from the live schema |

---

## Applying the database schema

The migrations in `supabase/migrations` are plain SQL and apply equally to a
local Supabase stack or a hosted project.

**Against a hosted project** (no Docker needed):

```bash
npm run db:link
npm run db:push
npm run db:types
```

**Against a local stack** (needs Docker Desktop):

```bash
npx supabase start
npx supabase db reset
```

`supabase/seed.sql` loads reference data and placeholder copy. It creates no
accounts and contains no personal data.

---

## Architecture

```
src/
  app/
    (public)/          Public archive — header, footer, main navigation
    (auth)/            Sign-in routes, minimal layout
  components/
    brand/             Dual-logo lockup
    site/              Header, footer, shared page furniture
  lib/
    env.ts             Validated environment access; nothing else reads process.env
    supabase/
      client.ts        Browser client   — anon key, subject to RLS
      server.ts        Server client    — anon key, subject to RLS
      session.ts       Session refresh, used by proxy.ts
      admin.ts         Service-role     — BYPASSES RLS, server-only
  proxy.ts             Next 16 proxy convention; refreshes the auth session
supabase/
  migrations/          Schema, policies and storage, in order
  seed.sql             Reference data and placeholder content
```

### Security model

Authorization lives in the **database**, not in the interface. Hiding a button
is presentation; Row Level Security is enforcement.

There are exactly **three permission levels**:

1. **Student**
2. **Research Cell Leadership** — Head and Deputy Head of Research
3. **School Administration**

"Team Leader" is deliberately **not** a fourth level. It is a per-project role
recorded on `research_authors`, granting write access to one submission only.

Roles are read from the `user_roles` table through `SECURITY DEFINER` functions
with an empty `search_path`. They are never read from JWT claims, which a client
can edit.

Actions reserved to School Administration — approving registrations, suspending
accounts, changing permissions, publishing journals — are enforced by
`is_school_admin()` and by guard triggers, so leadership cannot perform them
even by crafting requests directly against the database.

Several tables are **append-only**: `research_versions`, `reviews`,
`research_authorship_changes` and `activity_log` have `UPDATE` and `DELETE`
revoked from client roles outright, so research is never overwritten and the
review record cannot be rewritten.

### Key modelling decisions

**`people` and `profiles` are separate.** A `person` is a human in the Research
Cell's record and may never have had an account; a `profile` is the account
attached to one. Public identity — name, photo, quote — lives on `people`, so a
profile and its authorship survive graduation and account deactivation.
Authorship references `people`, never accounts.

**Journal editorial credits are separate from leadership.** Head and Deputy Head
of Research are annual appointments in `leadership`. A journal's masthead lives
in `journal_credits`, tied to that issue. The Editor-in-Chief of an issue may or
may not be that year's Head, and a change of leadership must never retroactively
alter who is credited on a published journal.

**Research becomes public only through publication.** `is_project_public()`
returns true only when a paper appears in a journal with status `published`.
Approval alone does not expose anything.

**Open questions are stored, not hard-coded.** The tagline lives in
`site_content`, because whether the Research Cell describes itself as scientific
or as spanning all disciplines is still undecided. Nothing in the schema
restricts research to STEM subjects. Whether alumni retain access is decided by
a single function, `is_active_account()`, rather than by scattered policies.

---

## Handover

The project is built to be transferred to school ownership.

Nothing identifies a personal account. There are no credentials in the
repository, no hard-coded emails, no hard-coded domain, and no dependency on any
individual's account. Configuration is entirely in environment variables, and
`supabase/config.toml` names no specific project.

To hand over:

1. Transfer the GitHub repository to the school's organisation.
2. Create a Supabase project in the school's organisation; run `db:push` and
   `seed.sql` against it.
3. Create a Vercel project in the school's team and set the environment
   variables from `.env.example`.
4. Point the school's domain at the Vercel deployment and update
   `NEXT_PUBLIC_SITE_URL`.

No code changes are required at any step.

---

## Storage

| Bucket | Visibility | Contents |
|---|---|---|
| `profile-photos` | public | Portraits shown on People pages |
| `journal-covers` | public | Journal cover images |
| `journal-pdfs` | public | Published journal PDFs |
| `research-submissions` | private | Submitted papers, one object per version |
| `supporting-documents` | private | Supplementary files |
| `resource-files` | private | Research Cell documents and templates |

Private buckets are read through short-lived signed URLs, authorised by the same
rules as the research tables. Production uploads are never committed to git.
