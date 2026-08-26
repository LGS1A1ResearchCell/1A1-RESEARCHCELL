-- =============================================================================
-- Research: projects, authorship, versions, reviews
-- =============================================================================
-- Two rules drive the shape of this file:
--
--   1. Research is never overwritten. A submission accumulates versions; each
--      version keeps its own storage object. Nothing here has an UPDATE path
--      that can replace a document.
--
--   2. Authorship is permanent and points at `people`, not accounts. A paper in
--      Journal I keeps its authors whether or not those students ever log in
--      again.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- subjects
-- -----------------------------------------------------------------------------
-- A controlled list, so the public library can filter reliably. Deliberately
-- shallow: `research_area` on the project is free text, which is how Journal I
-- already works ("Paper on Cultural Anthropology and Gender Studies"). Keeping
-- the fine-grained axis as text avoids committing to a taxonomy before the
-- school has decided the scope of the Research Cell.
create table subjects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- research_projects
-- -----------------------------------------------------------------------------
create table research_projects (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,

  research_type    research_type not null,
  authorship_mode  authorship_mode not null,

  -- Journal I prints a team name ("LGS 1A1 Secondary Research Team - A2"), so
  -- reproducing the published record faithfully requires storing it. Null for
  -- individual work.
  team_name        text,

  subject_id       uuid references subjects (id) on delete set null,
  research_area    text,
  abstract         text,

  academic_year_id uuid references academic_years (id) on delete restrict,

  status           project_status not null default 'draft',

  -- The submitting student. Null for historical records backfilled from
  -- Journal I, whose authors predate the system and may hold no account.
  created_by       uuid references profiles (id) on delete set null,

  submitted_at     timestamptz,
  approved_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A team name only makes sense on team research.
  constraint research_projects_team_name_requires_team check (
    team_name is null or authorship_mode = 'team'
  )
);

create index research_projects_status_idx on research_projects (status);
create index research_projects_year_idx on research_projects (academic_year_id);
create index research_projects_subject_idx on research_projects (subject_id);
create index research_projects_type_idx on research_projects (research_type);
create index research_projects_created_by_idx on research_projects (created_by);

create trigger research_projects_set_updated_at
  before update on research_projects
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- research_authors
-- -----------------------------------------------------------------------------
-- References people rather than profiles: authorship must outlive accounts.
--
-- author_role carries the per-project Team Leader designation. This is not a
-- permission level; it is scoped to one project and grants write access to that
-- project only, which the RLS policies express directly.
create table research_authors (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references research_projects (id) on delete cascade,
  person_id           uuid not null references people (id) on delete restrict,

  author_role         author_role not null default 'co_author',
  author_order        integer not null default 0,

  confirmation_status confirmation_status not null default 'pending',
  confirmed_at        timestamptz,

  added_by            uuid references profiles (id) on delete set null,
  created_at          timestamptz not null default now(),

  unique (project_id, person_id),

  constraint research_authors_confirmed_has_timestamp check (
    (confirmation_status = 'confirmed') = (confirmed_at is not null)
  )
);

create index research_authors_project_idx on research_authors (project_id);
create index research_authors_person_idx on research_authors (person_id);

-- Exactly one team leader (or sole author) per project.
create unique index research_authors_one_lead
  on research_authors (project_id)
  where author_role in ('team_leader', 'sole_author');

comment on table research_authors is
  'Permanent authorship. Points at people rather than profiles so that a paper keeps its authors regardless of whether those students still hold accounts.';

-- -----------------------------------------------------------------------------
-- research_authorship_changes
-- -----------------------------------------------------------------------------
-- Required by specification: authors are never silently added or removed. Every
-- change to the author list leaves a row here, including the actor and reason.
create table research_authorship_changes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references research_projects (id) on delete cascade,
  person_id  uuid not null references people (id) on delete restrict,
  change     authorship_change not null,
  actor_id   uuid references profiles (id) on delete set null,
  reason     text,
  created_at timestamptz not null default now()
);

create index research_authorship_changes_project_idx
  on research_authorship_changes (project_id);

-- -----------------------------------------------------------------------------
-- research_versions
-- -----------------------------------------------------------------------------
-- Append-only. Each row owns a distinct storage object; no update path replaces
-- document_path, and RLS grants no UPDATE or DELETE on this table to anyone.
create table research_versions (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references research_projects (id) on delete cascade,
  version_number      integer not null,

  document_path       text not null,
  document_filename   text not null,
  document_mime       text,
  document_size_bytes bigint,

  submitted_by        uuid references profiles (id) on delete set null,
  submitted_at        timestamptz not null default now(),
  notes               text,

  unique (project_id, version_number),
  constraint research_versions_number_positive check (version_number >= 1)
);

create index research_versions_project_idx
  on research_versions (project_id, version_number desc);

comment on table research_versions is
  'Append-only. Version 1 is the original submission; each requested revision produces a new row. Previous documents remain retrievable indefinitely.';

-- -----------------------------------------------------------------------------
-- research_supporting_files
-- -----------------------------------------------------------------------------
create table research_supporting_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references research_projects (id) on delete cascade,
  version_id  uuid references research_versions (id) on delete cascade,
  file_path   text not null,
  filename    text not null,
  mime        text,
  size_bytes  bigint,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index research_supporting_files_project_idx
  on research_supporting_files (project_id);

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
-- Attached to a version, not a project, so the review history reads as
-- "version 2 -> revision requested" without reconstruction.
--
-- Feedback is mandatory when a revision is requested. That is enforced here as
-- a CHECK constraint rather than in form validation, so it holds even against a
-- hand-crafted request.
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references research_versions (id) on delete cascade,
  reviewer_id uuid references profiles (id) on delete set null,
  decision    review_decision not null,
  feedback    text,
  created_at  timestamptz not null default now(),

  constraint reviews_revision_requires_feedback check (
    decision <> 'revision_required'
    or (feedback is not null and length(btrim(feedback)) > 0)
  )
);

create index reviews_version_idx on reviews (version_id);
create index reviews_reviewer_idx on reviews (reviewer_id);

comment on table reviews is
  'Permanent review record, append-only. Decisions are limited to revision_required and approved; there is deliberately no rejection outcome. Feedback is stored here rather than against the student document, which is never modified.';
