# Handover documentation

**1A1 Research Cell — research archive and publication platform**
Lahore Grammar School 1-A-1, Lahore

This document is written for whoever maintains or takes ownership of this
project after the original developer. It assumes you can use a terminal and
read code, but not that you know anything about this codebase.

If you are a member of school administration or Research Cell leadership and
you want to *use* the system rather than maintain it, read
[ADMINISTRATOR-GUIDE.md](./ADMINISTRATOR-GUIDE.md) instead.

> ## ⚠ Restructuring in progress — read this first
>
> The school has decided the site needs **no student accounts and no individual
> logins**. The private management area is now reached with **one shared
> password**, held by Research Cell leadership and school administration.
>
> **Session 1 of 4 is complete.** What is true today:
>
> - The public site is unchanged and needs no account of any kind.
> - The CMS is at `/admin`, entered at `/login` with the shared password.
>   It has seven sections: Research, Drafts, Journals, People, Resources,
>   Announcements, Site content.
> - Student registration, the per-student dashboard, the submission and review
>   workflow, and the account-approval screens have been **removed**.
> - People photographs have been **removed entirely** — columns, storage bucket
>   and policies.
> - No data was deleted. Journal I, its authorships, credits, founders and the
>   audit log are all intact.
>
> **Sections 6 to 10 below still describe the previous account-based system**
> and have not yet been rewritten. Where they disagree with this box, this box
> is correct. A full rewrite is scheduled for the end of the restructuring, so
> that it is written once against the finished architecture rather than three
> times against moving parts.
>
> See **Private CMS access** immediately below for how to get in.

## Private CMS access

There is one password. Everyone who manages the site uses it.

**Setting or changing it:**

```bash
node scripts/hash-cms-password.mjs
```

It prompts for the password, prints a `CMS_PASSWORD_HASH=…` line, and stores
the password nowhere. Put that line in `.env.local` for development and in the
Vercel environment for production, then redeploy. Keep the password itself in
the school's password manager.

**Why there are three variables and not one.** Accepting the password is only
the first step; the server then signs in to Supabase as an ordinary account
holding the `school_admin` role, and that session is what talks to the
database. It would be simpler to use the service-role key instead, but that key
ignores every Row Level Security policy in the schema — the CMS would become
trusted code and any mistake in a server action would become a whole-database
mistake. Signing in as an ordinary account keeps the database enforcing exactly
what it enforced before.

| Variable | What it is |
|---|---|
| `CMS_PASSWORD_HASH` | scrypt hash of the shared password. The only secret anyone is told. |
| `CMS_SUPABASE_EMAIL` | An existing Supabase account with the `school_admin` role. |
| `CMS_SUPABASE_PASSWORD` | That account's password. Nobody is told it; it never reaches a browser. |

Rotating the shared password does not touch the Supabase account, and a leaked
shared password does not give anyone direct API access.

**One trap worth knowing.** The hash is stored with `:` separators, never
`# Handover documentation

**1A1 Research Cell — research archive and publication platform**
Lahore Grammar School 1-A-1, Lahore

This document is written for whoever maintains or takes ownership of this
project after the original developer. It assumes you can use a terminal and
read code, but not that you know anything about this codebase.

If you are a member of school administration or Research Cell leadership and
you want to *use* the system rather than maintain it, read
[ADMINISTRATOR-GUIDE.md](./ADMINISTRATOR-GUIDE.md) instead.

. Next expands environment variables when it loads `.env` files, so a
`# Handover documentation

**1A1 Research Cell — research archive and publication platform**
Lahore Grammar School 1-A-1, Lahore

This document is written for whoever maintains or takes ownership of this
project after the original developer. It assumes you can use a terminal and
read code, but not that you know anything about this codebase.

If you are a member of school administration or Research Cell leadership and
you want to *use* the system rather than maintain it, read
[ADMINISTRATOR-GUIDE.md](./ADMINISTRATOR-GUIDE.md) instead.

 in the value is silently replaced by nothing — the hash arrives truncated
and the correct password stops working, with no error to explain it. This was a
real bug during Session 1.

**Not yet done:** there is no rate limiting on password attempts beyond a
one-second delay after a wrong guess. On serverless that delay cannot hold state
across instances. Real throttling belongs in front of the application and is
recorded in section 15.

---

**Contents**

1. [Architecture](#1-architecture)
2. [Repository structure](#2-repository-structure)
3. [Local setup](#3-local-setup)
4. [Environment variables](#4-environment-variables)
5. [Supabase setup and migrations](#5-supabase-setup-and-migrations)
6. [Roles and permissions](#6-roles-and-permissions)
7. [Authentication and account approval](#7-authentication-and-account-approval)
8. [Research and review workflow](#8-research-and-review-workflow)
9. [Journal workflow](#9-journal-workflow)
10. [Content management](#10-content-management)
11. [Storage buckets and policies](#11-storage-buckets-and-policies)
12. [Deployment](#12-deployment)
13. [Ownership transfer](#13-ownership-transfer)
14. [Backup and recovery](#14-backup-and-recovery)
15. [Known limitations and future considerations](#15-known-limitations-and-future-considerations)

---

## 1. Architecture

### The shape of the system

```
                    ┌─────────────────────────────────┐
   Public visitor   │  Next.js (App Router) on Vercel │
   Student          │                                 │
   Leadership   ────▶  Server Components render pages  │
   School admin     │  Server Actions perform writes   │
                    └───────────────┬─────────────────┘
                                    │  anon key + the signed-in
                                    │  user's JWT
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Supabase                       │
                    │   • PostgreSQL + Row Level      │
                    │     Security  ← authority lives │
                    │     here                        │
                    │   • Auth (GoTrue)               │
                    │   • Storage (6 buckets)         │
                    └─────────────────────────────────┘
```

### The one idea that matters

**Permissions are enforced by the database, not by the application.**

Every table has Row Level Security enabled, and every rule about who may read
or write what is expressed as a policy on that table. The Next.js application
holds no privileged position: it talks to Supabase with the same public key the
browser could use, plus whatever JWT the signed-in user has.

The practical consequence: if someone bypasses the site entirely and calls the
Supabase REST API directly with the public key, they get exactly the same
answers the site would give them. There is no back door through the UI, because
the UI was never the gate.

This is why the interface can be relatively trusting in places. When
`/my-research` asks for the caller's projects, the worst a bug there can do is
show the caller too few of their own rows — never someone else's.

> **A caveat worth internalising.** RLS is *authorisation*, not *scoping*. A
> query with no `where` clause returns everything the caller is allowed to see,
> which is not the same as everything they asked for. Queries still need their
> own filters for correctness. This bit us once during development and is worth
> remembering.

### Where each concern lives

| Concern | Enforced by | Why there |
|---|---|---|
| Who may read a row | RLS policy | Cannot be bypassed by any client |
| Who may write a row | RLS policy | Same |
| Which *columns* a writer may change | Column-guard trigger | RLS governs rows, not columns |
| Valid status transitions | `guard_project_status()` and friends | A state machine belongs next to the state |
| History that must not be rewritten | Revoked `UPDATE`/`DELETE` privileges | Append-only is a grant, not a policy |
| Multi-step operations | `SECURITY DEFINER` functions | Atomicity, and the steps need privileges the caller lacks |
| Session refresh, coarse route gating | `proxy.ts` | Cheap early rejection; not the real check |
| Page-level role checks | `requireActiveAccount()` / `requireSchoolAdmin()` | Good errors and redirects, not security |

Every `SECURITY DEFINER` function is declared `set search_path = ''` and refers
to objects by fully-qualified name, so it cannot be hijacked by a caller-set
search path.

### Numbers, as built

| | |
|---|---|
| Tables | 23, all with RLS enabled |
| RLS policies | 75 |
| Views | 5 |
| `SECURITY DEFINER` functions | 43 |
| Storage buckets | 6 (3 public, 3 private) |
| Storage policies | 15 |
| Migrations | 16 |
| Application routes | 31 |

### Framework notes

- **Next.js 16 / React 19.** Server Components by default; `"use client"`
  only where interaction requires it.
- **`proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. The file
  refreshes the Supabase session cookie and turns away visitors with no session
  at all. It does *not* check roles — that needs the database, and it happens in
  the route layouts.
- **`server-only`.** `src/lib/supabase/admin.ts` imports the `server-only`
  package, so importing the service-role client from a client component is a
  **build failure**, not a runtime leak.
- **Tailwind CSS 4** with `@theme` tokens in `src/app/globals.css`. There is no
  `tailwind.config.js`; the design tokens *are* the config.

---

## 2. Repository structure

```
1A1RESEARCHCELL/
├── docs/
│   ├── HANDOVER.md                 ← this file
│   └── ADMINISTRATOR-GUIDE.md      ← for school staff, non-technical
├── public/brand/                   Logo and wordmark assets
├── src/
│   ├── proxy.ts                    Session refresh + coarse route protection
│   ├── app/
│   │   ├── globals.css             Design tokens (@theme), base styles
│   │   ├── layout.tsx              Root layout, fonts
│   │   ├── (public)/               Archive — no session required
│   │   │   ├── page.tsx            Home
│   │   │   ├── about/  research/  research/[slug]/
│   │   │   ├── journals/  journals/[slug]/
│   │   │   └── people/  resources/
│   │   ├── (auth)/                 Sign-in, registration, account states
│   │   │   ├── login/student/      + /sign-up  + /sign-up/submitted
│   │   │   ├── login/admin/
│   │   │   └── account/inactive/   account/set-password/
│   │   └── (dashboard)/            Everything behind a session
│   │       ├── layout.tsx          requireActiveAccount() runs here
│   │       ├── dashboard/  my-research/  my-research/new  my-research/[id]
│   │       ├── notifications/  profile/
│   │       └── admin/              Leadership and school administration
│   │           ├── page.tsx        review/  review/[id]
│   │           ├── journals/  journals/[id]
│   │           ├── accounts/  people/          ← school admin only
│   │           └── content/  announcements/  resources/  activity/
│   ├── components/
│   │   ├── brand/      Wordmark
│   │   ├── site/       SiteHeader, SiteFooter, LoginPanel, SectionStub
│   │   ├── auth/       SignUpForm, SignInForm, SetPasswordForm
│   │   ├── people/     Portrait, PhotoCropper, ProfileForm
│   │   ├── admin/      AccountRequestCard, VisibilityToggle, LeadershipForm
│   │   ├── research/   SubmitForm, StatusBadge, ProjectWorkspace
│   │   ├── review/     ReviewPanel, ReviewHistory
│   │   ├── journals/   JournalBuilder, CreateJournalForm
│   │   └── content/    ContentForms
│   └── lib/
│       ├── env.ts               Validated environment access
│       ├── supabase/
│       │   ├── client.ts        Browser client
│       │   ├── server.ts        Server client (respects RLS)
│       │   ├── session.ts       Cookie handling for @supabase/ssr
│       │   └── admin.ts         Service-role client — `server-only`
│       ├── auth/                session.ts, actions.ts, years.ts
│       ├── admin/               account-actions.ts, people-actions.ts
│       ├── profile/  research/  review/  journals/  content/   (server actions)
│       └── types/database.ts    Generated from the live schema
└── supabase/
    ├── config.toml
    ├── migrations/              16 files, applied in filename order
    ├── seed.sql                 Reference data and placeholder content
    └── seeds/journal-i.sql      Journal I historical backfill
```

### Reading order for a newcomer

1. `src/app/globals.css` — the design system and, in its comments, the reasoning
   about colour and contrast.
2. `supabase/migrations/20260826090500_authz_functions.sql` — the authorisation
   primitives everything else is built from.
3. `supabase/migrations/20260826090600_rls_policies.sql` — the permission model
   in full.
4. `src/lib/auth/session.ts` — how a request becomes a known user with a role.
5. Any one workflow end to end, e.g. `src/lib/research/actions.ts` together with
   `supabase/migrations/20260827140000_phase4_submissions.sql`.

---

## 3. Local setup

### Prerequisites

- **Node.js 20 or later** (developed on Node 24)
- **npm**
- A **Supabase project** — free tier is sufficient for development
- Optionally the **Supabase CLI**, which is already a dev dependency and can be
  run through `npx supabase`

### Steps

```bash
git clone <repository-url>
cd 1A1RESEARCHCELL
npm install
```

Create your environment file from the template and fill it in from your Supabase
project (Project Settings → API):

```bash
cp .env.example .env.local
```

Link the repository to your Supabase project and apply the schema:

```bash
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

Load the reference data, and the Journal I historical record if you want it:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
psql "$SUPABASE_DB_URL" -f supabase/seeds/journal-i.sql
```

Start the development server:

```bash
npm run dev
```

The site is then at <http://localhost:3000>.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:link` | Link the repo to a Supabase project |
| `npm run db:push` | Apply migrations to the linked project |
| `npm run db:types` | Regenerate `src/lib/types/database.ts` from the live schema |
| `npm run db:diff` | Diff the live schema against the migrations |

Run `npm run db:types` after any schema change, and commit the result.

### Creating a first administrator

There is no bootstrap script, deliberately — an automated path to creating a
school-administration account is an attack surface nobody needs. Create the
first one by hand, once, against the database:

1. In the Supabase dashboard, **Authentication → Users → Add user**, with a real
   address and a password you set.
2. In the SQL editor, create the person, profile and role. The `people` row is
   the identity; the `profiles` row is the account:

   ```sql
   with p as (
     insert into people (full_name, slug, kind, is_public)
     values ('Full Name', 'full-name', 'faculty', false)
     returning id
   )
   insert into profiles (id, person_id, email, status)
   select '<auth-user-uuid>', p.id, 'address@school.example', 'active' from p;

   insert into user_roles (user_id, role)
   values ('<auth-user-uuid>', 'school_admin');
   ```

Everyone else can then be created through the application.

---

## 4. Environment variables

Five variables, no more. Nothing school-specific, developer-specific or
credential-bearing is hard-coded anywhere in the source tree — which is what
makes the handover in §13 possible.

| Variable | Secret? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Public API key. Carries no privileges of its own |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Bypasses all RLS. Server-only |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical origin, used for redirects and invite links |
| `NEXT_PUBLIC_APP_ENV` | No | `development` or `production`; a development instance says so in the UI |

### The service-role key

This key ignores every Row Level Security policy in the database. Treat it the
way you would treat the database password.

- It must **never** be prefixed `NEXT_PUBLIC_`.
- It is read only by `src/lib/supabase/admin.ts`, which imports `server-only`.
  Importing that module from a client component fails the build.
- It is used in exactly two places, both of which need privileges no user has:
  creating an auth user when a registration is approved, and deleting that auth
  user if the rest of the approval then fails.
- If it is ever exposed, rotate it immediately in Project Settings → API and
  update it everywhere it is configured.

### Setting them per platform

**Local development** — `.env.local` in the repository root. Gitignored; never
commit it.

**Vercel** — Project → Settings → Environment Variables. Add all five for the
environments you use (Production, Preview, Development). Mark
`SUPABASE_SERVICE_ROLE_KEY` as sensitive so it cannot be read back from the
dashboard. Redeploy after changing any of them; Next.js inlines the
`NEXT_PUBLIC_*` values at build time, so a change to those does nothing until
the next build.

**GitHub Actions**, if CI is ever added — repository Settings → Secrets and
variables → Actions. The three non-public values go in *Secrets*; the rest may
be *Variables*.

**Verifying nothing leaked.** The service-role key must never appear in the
client bundle:

```bash
npm run build
grep -r "SUPABASE_SERVICE_ROLE" .next/static/ || echo "clean"
```

---

## 5. Supabase setup and migrations

### Creating the project

1. Create a Supabase project. Pick the region closest to Lahore — at the time of
   writing that is Singapore or Mumbai.
2. Set a strong database password and store it in the school's password manager.
   It is not recoverable, only resettable.
3. Copy the project URL and both API keys into your environment configuration.

### Applying migrations

Migrations live in `supabase/migrations/` and are applied in filename order.
Filenames are timestamps; **never renumber or rewrite one that has been applied**
to any database you care about.

```bash
npx supabase link --project-ref <project-ref>
npm run db:push
```

| Migration | What it establishes |
|---|---|
| `20260826090000_enums_and_helpers` | Enum types, `set_updated_at()` |
| `20260826090100_identity` | `people`, `profiles`, `user_roles`, `account_requests`, `leadership`, `founding_contributors`, `academic_years` |
| `20260826090200_research` | `subjects`, `research_projects`, `research_authors`, `research_versions`, `reviews`, supporting files, authorship history |
| `20260826090300_journals` | `journals`, `journal_papers`, `journal_credits`, `journal_corrections` |
| `20260826090400_site` | `notifications`, `resources`, `announcements`, `site_content`, `activity_log` |
| `20260826090500_authz_functions` | `current_person_id()`, `is_school_admin()`, `is_leadership()`, and the other authorisation primitives; column guards |
| `20260826090600_rls_policies` | Row Level Security across all 23 tables |
| `20260826090700_storage` | The 6 buckets and their policies |
| `20260827100000_phase1_fixes` | Seven security fixes found in the Phase 1 audit — see below |
| `20260827110000_phase2_accounts` | Registration and approval functions |
| `20260827120000_d8_status_guard` | Allows the approval path to set an initial status |
| `20260827130000_phase3_profiles` | Profile visibility, leadership assignment, `public_researchers` |
| `20260827140000_phase4_submissions` | Project creation, versioning, authorship freezing |
| `20260827150000_phase5_review` | Review guards, `apply_review_decision()`, review history |
| `20260827160000_phase6_journals` | Journal assembly, approval, publication, public views |
| `20260827170000_phase7_content` | Notification guards and the audit-log triggers |

`20260827100000_phase1_fixes` is worth reading before you change anything about
permissions. The most instructive of the seven: `TRUNCATE` is not governed by
Row Level Security, so the default grants meant anyone holding the public key
could have emptied any table. The fix revokes `TRUNCATE`, `TRIGGER` and
`REFERENCES` from the client roles and alters default privileges so new tables
do not reintroduce it.

### The people / profiles split

The single most important schema decision, and the one most likely to be undone
by someone who does not know why it is there.

- **`people`** is an identity. A name, a slug, a class, a photograph. It has no
  login and it never goes away.
- **`profiles`** is an account. It is keyed to a Supabase auth user and points
  at a `people` row.

Authorship references `people`, never `profiles`. So a student can graduate,
their account can be deleted, and their name stays correctly on their paper
forever. It is also what let the Journal I contributors be recorded as authors
without creating login accounts for any of them — which the specification
required.

**Do not "simplify" this into one table.** Doing so makes the historical record
depend on the continued existence of login accounts.

### Changing the schema

1. Write a new migration; never edit an applied one.
2. Apply it to a development project first.
3. If it touches permissions, run the security suite (§ *Testing*, below) before
   and after.
4. `npm run db:types`, and commit the regenerated types.

### Testing

The development test suites are not committed to this repository — they were
written against disposable accounts on a development Supabase project and would
be actively dangerous pointed at production. They covered, at handover:

- 508 functional and permission checks across the build phases
- 80 penetration checks against real authenticated sessions for anonymous,
  student, leadership and school-administration callers
- 12 link-integrity checks (see below)
- an accessibility audit of all 31 routes

If you rebuild them, the essential shape is: sign in for real, get a JWT, and
call the Supabase REST API directly as each role. Testing through the UI only
tells you what the UI does. Two rules that were learned the hard way:

- **A test that passes for the wrong reason is a failing test.** Three checks in
  the security suite passed while asserting nothing — one because the account
  was already in the state being "prevented".
- **Never weaken a security rule to make an old test pass.** Fix the test.
- **Assert properties, not counts.** Several checks compared absolute row counts
  against a shared database, so they broke the moment a real person registered
  or published something legitimate. Assert who is included and excluded.
- **Test reachability, not only data and permissions.** This one was learned
  expensively: sixteen suites reported the public archive healthy while it was
  a dead end. Every published paper was readable over the API and no page linked
  to one, because the paper route had never been built. Data correctness and
  permission correctness are not the same thing as a person being able to get
  there. `test-links` now crawls the public site as an anonymous visitor,
  fails on any internal link that 404s, and asserts that every published paper
  is linked from both the index and its journal — while confirming that nothing
  unpublished became reachable in the process.

---

## 6. Roles and permissions

There are **exactly three** permission levels. This is deliberate and specified.

| Role | `app_role` | Who |
|---|---|---|
| Student | `student` | Research Cell members |
| Research Cell Leadership | `leadership` | Head of Research, Deputy Head of Research |
| School Administration | `school_admin` | Staff with final authority |

**"Team Leader" is not a fourth level.** It is a per-project role
(`research_authors.author_role`) that carries responsibilities within one piece
of research and no standing privilege anywhere else.

School Administration is a superset of Leadership: `is_leadership()` returns
true for school administrators, so they see everything leadership sees, plus
accounts, people, content and the audit log.

### What each role may do

| | Student | Leadership | School admin |
|---|:--:|:--:|:--:|
| Read published journals and public profiles | ✓ | ✓ | ✓ |
| Submit research, upload versions | ✓ | ✓ | ✓ |
| Read *their own* research and its reviews | ✓ | ✓ | ✓ |
| Read *anyone's* submitted research | | ✓ | ✓ |
| Record a review decision | | ✓ | ✓ |
| Create and assemble a journal | | ✓ | ✓ |
| Approve and publish a journal | | | ✓ |
| Approve or decline registrations | | | ✓ |
| Change account status, grant roles | | | ✓ |
| Make a student profile public | | | ✓ |
| Assign leadership for a year | | | ✓ |
| Edit site content, announcements, resources | | | ✓ |
| Read the audit log | | | ✓ |

Anonymous visitors read published journals, public profiles, published
resources and current announcements. Nothing else. This was verified against all
23 tables: no anonymous write succeeded anywhere.

### Account statuses

`pending` → `active` → `suspended` / `alumni`

Only `active` accounts reach anything behind a session. A suspended or alumni
account that signs in successfully is redirected to `/account/inactive` from
every protected route. A student **cannot** change their own status — verified
by suspending an account and having it attempt to reactivate itself: HTTP 403,
status unchanged.

---

## 7. Authentication and account approval

Two sign-in routes, labelled **Student Login** and **Admin Login**, as
specified. They are separate doors for clarity, not separate security
mechanisms; the account's role decides what happens after sign-in.

### Registration

```
Student fills in /login/student/sign-up
        │  submit_account_request()
        ▼
account_requests row, status 'pending'
        │
        ▼
School administration reviews at /admin/accounts
        │
        ├── Decline → decline_account_request()  (reason recorded)
        │
        └── Approve → generateLink({type:'invite'})   creates the auth user
                      complete_account_approval()     creates person + profile + role
                      │
                      ▼
              Student opens the invite link → /account/set-password
                      │
                      ▼
                  Account active
```

Registration creates **no account**. It creates a request. Nobody gets a login
until a school administrator approves it.

The student chooses their own password at the end, from the invite link. No
temporary password is ever generated, so there is no interim secret to be
intercepted or forgotten in an inbox.

### The invite link, and why it is on screen

`generateLink` creates the user and returns the link **without sending any
email**, because the school's mail arrangements were undecided at handover and
approval must not depend on an unconfigured mail provider.

So after approving a registration, the administrator sees the invite link with a
copy button, and passes it to the student themselves.

**This is the single most likely thing you will want to change**, and it is
designed to be easy: configure SMTP in Supabase (Project Settings → Auth → SMTP),
switch `generateLink` to `inviteUserByEmail`, and stop returning `inviteLink`
from `approveAccountRequest`. The UI block that displays it is
`src/components/admin/AccountRequestCard.tsx`, around the `approveState.inviteLink`
conditional.

Note that the invite link is a credential in transit. Until email is configured,
it should be handed over in person or through a channel the school already
trusts.

---

## 8. Research and review workflow

```
draft
  │  student creates the project, uploads a document
  │
  ├── team research ──▶ awaiting_author_confirmation
  │                        │ every named co-author confirms
  │                        ▼
  └──────────────────▶ submitted
                           │  leadership picks it up
                           ▼
                      under_review
                           │
            ┌──────────────┴───────────────┐
            ▼                              ▼
   revision_required                   approved
   (feedback mandatory)                    │
            │                              │  placed in a journal,
            │  student uploads             │  which is then approved
            │  a new version               │  and published
            └──────────▶ submitted         ▼
                                       published
```

### Rules that are enforced, not merely intended

- **A review decision is `revision_required` or `approved`. There is no
  rejection.** The `review_decision` enum has exactly two values, so rejection is
  not representable.
- **Revision requires feedback.** A `CHECK` constraint on `reviews` refuses a
  `revision_required` row with empty feedback.
- **Research is never overwritten.** Each upload is a new `research_versions`
  row. Earlier versions stay.
- **Review history is permanent.** `UPDATE` and `DELETE` on `reviews` are revoked
  from client roles, so a review cannot be edited or deleted by anyone — not by
  its author, not by school administration. It is append-only at the privilege
  level, which no policy change can quietly undo.
- **One review per version**, enforced by a unique constraint.
- **Students cannot move their own work forward.** `guard_project_status()`
  implements the state machine; a student setting their own project to
  `approved` is refused. This was a real defect found in the Phase 1 audit.
- **Authorship freezes at submission.** `guard_authorship_frozen()` prevents
  authors being added or removed once a project leaves the student's hands.
  Changes before that point are recorded in `research_authorship_changes`.
- **A Team Leader cannot confirm on a co-author's behalf**, on insert or update.

Reviewer identity on the student's side goes through
`reviewer_display_name()`, so a student sees who reviewed their work without
being handed the reviewer's account record.

---

## 9. Journal workflow

One journal per academic year.

```
Leadership creates a journal                    status: draft
        │
        │  add approved papers, set order,
        │  add credits, upload cover and PDF
        ▼
Submit for school approval          status: pending_admin_approval
        │
        │  (leadership may withdraw it while it waits)
        ▼
School administration approves and publishes         status: published
        │
        ▼
Appears in the public archive
```

- Only school administration can approve or publish. `guard_journal_publication()`
  enforces it in the database.
- A journal is editable only while `journal_is_open()` — that is, in `draft`.
  Once submitted, papers, credits and assets are frozen.
- Only `approved` papers may be added, enforced by `guard_journal_papers()`.
- **Corrections are additive.** A published journal is never edited. A
  `journal_corrections` row is recorded against it and displayed with it, so the
  published record and the fact of its correction both survive.

### The historical record

Journal I is loaded by `supabase/seeds/journal-i.sql`: 24 people, 6 papers, 22
authorships, 4 credits, and 2 founding contributors. **No authentication
accounts exist for any of these students**, by explicit instruction, and the
people/profiles split (§5) is what makes that possible.

Do not delete this data or its provenance. If you are cleaning up test records,
check your `where` clause against it first.

### One deliberate exception to `security_invoker`

`published_paper_authors` is the only view created with owner rights rather than
`security_invoker`. Every other view inherits the caller's permissions.

The reason: a published paper's byline must render for a visitor even when the
author's profile is private. Without this, papers by students who had not made
their profile public appeared with missing names in the public archive. The view
exposes bylines for **published** papers only, and nothing else about the person.

If you touch this view, that constraint is the thing to preserve.

---

## 10. Content management

Site wording lives in the `site_content` table and is edited at
`/admin/content` by school administration. Changing the tagline or mission
statement needs no deployment.

**The tagline is not hard-coded, on purpose.** Whether the Research Cell's remit
is STEM-only was undecided at handover, so the site does not assert an answer.
Do not bake one into the source.

Any value that is still `[PLACEHOLDER…]` is **omitted from public pages rather
than displayed**. An unwritten tagline shows nothing to a visitor; the admin
screen flags it as outstanding. This is why the site can be deployed before the
school has settled its wording.

Also editable by school administration:

- **Announcements** (`/admin/announcements`) — with start and end dates; they
  appear and disappear on their own.
- **Resources** (`/admin/resources`) — guidance and templates, each a draft until
  published.

### The audit log

`activity_log` records administrative and editorial actions: account approvals
and declines, status changes, permission grants and revocations, profile
visibility changes, leadership assignments, submissions, review decisions,
journal progress and corrections.

**Nothing can forge or erase an entry.** `INSERT`, `UPDATE` and `DELETE` on
`activity_log` are revoked from client roles outright. Every row is written by a
trigger as the action happens — including rows describing actions by school
administration, who cannot remove them either.

School administration reads it at `/admin/activity` through
`activity_log_readable`, which resolves actor names and carries
`security_invoker`, so it inherits the same restriction.

---

## 11. Storage buckets and policies

| Bucket | Public | Size limit | Types | Holds |
|---|:--:|---|---|---|
| `research-submissions` | No | 50 MB | PDF, DOC, DOCX | Research documents |
| `supporting-documents` | No | 50 MB | any | Data, appendices |
| `resource-files` | No | 50 MB | any | Guidance and templates |
| `profile-photos` | Yes | 5 MB | JPEG, PNG, WebP | Profile photographs |
| `journal-covers` | Yes | 10 MB | JPEG, PNG, WebP | Journal cover images |
| `journal-pdfs` | Yes | 100 MB | PDF | Published journal PDFs |

"Public" means readable by URL without a session. The three public buckets hold
only material that is already published or deliberately made public.

Fifteen storage policies mirror the database rules. In outline:

- **Research files** — the Team Leader uploads; authors and leadership read;
  school administration deletes. A second student cannot read another student's
  submission, verified directly against the storage API.
- **Profile photos** — a student manages their own; school administration
  manages any; anyone may read.
- **Journal assets** — leadership uploads, replaces and removes them **only while
  the journal is open** (`journal_asset_writable()`); school administration
  deletes; anyone may read.
- **Resource files** — school administration manages; any signed-in user reads.

Note that the MIME allowlist rejects a disallowed upload with an error that
looks like a permissions failure but is not. During development this repeatedly
masqueraded as a policy bug.

---

## 12. Deployment

### Vercel

1. Import the GitHub repository at <https://vercel.com/new>. Next.js is detected;
   the defaults are correct.
2. Add all five environment variables from §4 for Production (and Preview if you
   use it). Mark the service-role key sensitive.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin and
   `NEXT_PUBLIC_APP_ENV=production`.
4. Deploy.

### Custom domain

1. Vercel → Project → Settings → Domains, add the school's domain or subdomain.
2. Create the DNS records Vercel specifies with the school's registrar. A
   subdomain such as `research.lgs.edu.pk` is a `CNAME`.
3. TLS is issued automatically once DNS resolves.
4. Update `NEXT_PUBLIC_SITE_URL` to the final origin and **redeploy** — invite
   links are built from it, and it is inlined at build time.

### Supabase, before going live

- **Authentication → URL Configuration** — set the Site URL to the production
  origin and add it to Redirect URLs. The invite and password links will not
  work otherwise.
- **Authentication → SMTP** — configure it if you want approval emails sent
  automatically (§7).
- Confirm the production project has the schema: `npm run db:push`.

### Pre-deployment checklist

```bash
npm run typecheck
npm run lint
npm run build
grep -r "SUPABASE_SERVICE_ROLE" .next/static/ || echo "no secret in client bundle"
```

And check that `.env.local` is not committed: `git ls-files | grep env.local`
should print nothing.

---

## 13. Ownership transfer

The project was built to be handed to the school. No credential, email address,
account identifier or domain is hard-coded anywhere in the source tree, so the
transfer is a matter of moving three accounts.

Do these in order. The GitHub transfer should come last if Vercel is connected
to the repository, or reconnect it afterwards.

### Supabase

The database is the part that carries the data, so it deserves the most care.

1. The school creates a Supabase **organisation** under a school-owned account.
2. Current owner: Project Settings → General → **Transfer project**, choosing the
   school's organisation.
3. Verify the school can sign in and see the project.
4. **Reset the database password** (Project Settings → Database), so the previous
   owner's copy stops working. Store the new one in the school's password
   manager.
5. **Rotate the service-role key** (Project Settings → API) and update it in
   Vercel. Redeploy.
6. Remove the previous owner from the organisation's members.

Transferring a project between organisations requires both to be on compatible
plans; if the transfer option is unavailable, that is usually why.

### Vercel

1. The school creates a Vercel **team**.
2. Current owner: Project → Settings → General → **Transfer project**.
3. Re-enter the environment variables — **they do not transfer**. This is the
   step most often missed, and the symptom is a build that succeeds and a site
   that cannot reach the database.
4. Reconfigure the custom domain if it was attached to the old account.
5. Redeploy and check the live site.

### GitHub

1. The school creates a GitHub **organisation**.
2. Current owner: repository Settings → General → **Transfer ownership**.
3. Re-add collaborators; grant the maintainer role to whoever will maintain it.
4. In Vercel, confirm the Git connection still points at the repository and
   reconnect if not.

### After the transfer

- [ ] School can sign in to all three services independently
- [ ] Database password reset; service-role key rotated
- [ ] Environment variables re-entered in Vercel; site redeployed and working
- [ ] Custom domain resolving with valid TLS
- [ ] Supabase Site URL and Redirect URLs match the production origin
- [ ] At least one school-administration account exists and works
- [ ] Previous owner's access removed from all three services
- [ ] Backups configured (§14)

---

## 14. Backup and recovery

### What Supabase gives you

Backup provision depends on the plan, and this matters more than it sounds:

| Plan | Backups |
|---|---|
| Free | **None.** No automated backups at all |
| Pro | Daily automated backups, 7-day retention |
| Higher tiers | Point-in-time recovery |

**A school archive of student research should not sit on a plan with no
backups.** This is the single strongest operational recommendation in this
document. If the project stays on the free plan, the manual routine below is not
optional.

### Manual backup

Database, schema and data:

```bash
pg_dump "$SUPABASE_DB_URL" --clean --if-exists --no-owner --no-privileges \
  -f backup-$(date +%Y-%m-%d).sql
```

Storage — buckets are not covered by database backups. Download them from the
Supabase dashboard, or with the CLI:

```bash
npx supabase storage download --recursive ss://research-submissions ./backup/research
npx supabase storage download --recursive ss://journal-pdfs         ./backup/journals
```

Keep at least: the database dump, all six buckets, and a copy of the environment
configuration in the school's password manager.

A sensible routine: automated daily backups on Pro; a manual dump before any
migration; and a full manual backup, stored off-platform, at the end of each
academic year once that year's journal is published.

### Recovery

**Restoring the database:**

```bash
psql "$SUPABASE_DB_URL" -f backup-YYYY-MM-DD.sql
```

**Rebuilding from scratch** — the schema is reproducible from the repository,
which is the point of keeping migrations:

```bash
npm run db:push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
psql "$SUPABASE_DB_URL" -f supabase/seeds/journal-i.sql
```

That gives you a working system with reference data and the Journal I record,
but not subsequent submissions — those come from a backup.

**Test a restore before you need one.** Restore into a scratch Supabase project
once, and confirm Journal I comes back intact: 1 journal, 6 papers, 22
authorships, 4 credits, 2 founding contributors.

### Losing the service-role key

Rotate it in Project Settings → API, update Vercel, redeploy. Nothing else
depends on it. Rotating it does not sign anyone out.

---

## 15. Known limitations and future considerations

These are things the system does not do. They are recorded because they are
deliberate omissions or observations from the final audit, not oversights, and a
future maintainer should know which is which.

### Deliberate, pending a school decision

- **No email is sent.** Approving a registration produces an invite link the
  administrator passes on by hand. The school's mail arrangements were undecided.
  §7 describes exactly what to change.
- **Notifications are in-app only.** Students see them at `/notifications`. There
  is no email or push delivery.
- **The tagline and mission are unwritten.** Placeholder values are omitted from
  public pages rather than displayed. Whether the Research Cell is STEM-only was
  not decided, and the site does not assume an answer.
- **No bootstrap for the first administrator.** By design; see §3.
- **The Journal I PDF and cover have not been uploaded.** `journals.pdf_path`
  and `cover_path` are null, so the journal page shows a generated cover and
  no "Read the full journal" button, and each paper page says the journal is
  not yet available to read online rather than offering a link that would not
  work. Upload the PDF to the `journal-pdfs` bucket and the cover to
  `journal-covers`, then set the two columns on the Journal I row; both
  affordances appear on their own. Nothing was substituted in the meantime.
- **The six Journal I papers have no abstracts.** `abstract` is null on every
  one, so the paper pages show title, byline, type, subject, area and page
  range but no summary. The abstracts are school content and were not invented.

### Open from the Session 1 restructuring

- **No rate limiting on the CMS password.** A wrong guess costs one second and
  nothing more. One shared password with no lockout is the weakest point in the
  new design; throttling at the edge (Vercel WAF, or a Supabase-backed attempt
  counter) is the fix.
- **The CMS has no per-person accountability.** Everyone shares one password, so
  the activity log records that "school administration" acted, never who. That
  is inherent to what the school asked for, and worth knowing rather than
  discovering later.
- **Research and Drafts are read-only.** They list what exists; creating and
  editing research through the CMS is later work.
- **The documentation below has not been rewritten** for the new architecture.

### Observations from the final audit, not implemented

Recorded as future considerations rather than acted on, being outside the agreed
scope:

- **Rate limiting on registration.** `submit_account_request()` has no
  throttling, so the request queue could be flooded with junk. The exposure is
  bounded — requests create no accounts and school administration sees them
  before anything exists — but the queue could be made tedious to work through.
  A per-address or per-IP limit would close it.
- **No virus scanning on uploads.** Type and size are constrained; content is
  not inspected.
- **`activity_log` grows without bound.** Fine at school scale for many years;
  it would eventually want archiving.
- **Disabled buttons in three places** (journal submission, project advancement,
  review decisions) explain what is outstanding in adjacent visible text, which
  a screen reader reads in order. Associating those explanations programmatically
  would be an improvement, though disabled controls are not focusable, so the
  benefit is limited. The fourth such case — the research submission form, which
  explained nothing at all — was fixed.
- **No automated accessibility regression test.** The audit was thorough but was
  run against a live instance, not wired into CI.
- **Journal PDFs are public by URL.** Deliberate for published journals, but it
  means a URL, once known, does not expire.

### Accessibility, as verified at handover

All 30 routes were audited, signed in as each role, at 320px, 375px and desktop.
At handover: no horizontal overflow at any width, correct heading hierarchy and
a single `h1` per page, every form control labelled, every image with alt text,
no duplicate ids, accessible names on all links and buttons, a skip link on
every layout, and no rule anywhere that removes a focus outline.

Colour contrast meets WCAG AA throughout. Two failures were found and fixed: the
coral accent measured 3.09:1 as text on white and 2.78:1 on its own tint, and
was used for **form error messages**; and the hero tagline was 4.06:1. The brand
coral is unchanged for borders and fills — a separate `--color-cell-coral-text`
token carries the text-safe variant, following the same pattern the palette
already used for the school blue.

The one thing static analysis and scripted checks cannot establish is how this
behaves with an actual screen reader. **A pass with NVDA or VoiceOver before the
site goes public is worth the hour**, particularly on the submission and review
flows.

---

*Prepared at the conclusion of Phase 8. The commit this accompanies is the
handover baseline.*
