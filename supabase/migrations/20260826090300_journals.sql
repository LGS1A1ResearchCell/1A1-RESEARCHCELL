-- =============================================================================
-- Journals: issues, contents, editorial credits, corrections
-- =============================================================================
-- Research Cell leadership creates journals; School Administration approves
-- publication. A published journal is never silently edited -- corrections are
-- additive records.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- journals
-- -----------------------------------------------------------------------------
create table journals (
  id                         uuid primary key default gen_random_uuid(),
  title                      text not null,
  volume_label               text,
  slug                       text not null unique,

  academic_year_id           uuid not null references academic_years (id) on delete restrict,
  description                text,

  cover_path                 text,
  pdf_path                   text,

  status                     journal_status not null default 'draft',

  created_by                 uuid references profiles (id) on delete set null,

  submitted_for_approval_by  uuid references profiles (id) on delete set null,
  submitted_for_approval_at  timestamptz,

  -- Approval is School Administration's act alone. The RLS policies are what
  -- actually restrict it; these columns record who exercised it.
  approved_by                uuid references profiles (id) on delete set null,
  approved_at                timestamptz,
  published_at               timestamptz,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint journals_approved_consistently
    check ((approved_by is null) = (approved_at is null)),
  constraint journals_published_requires_approval
    check (status <> 'published' or approved_at is not null)
);

-- One journal per academic year, which is the current intended model. Expressed
-- as a unique index rather than a table constraint so it can be dropped later
-- without rewriting the table, should the school move to multiple issues.
create unique index journals_one_per_year on journals (academic_year_id);

create index journals_status_idx on journals (status);

create trigger journals_set_updated_at
  before update on journals
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- journal_papers
-- -----------------------------------------------------------------------------
create table journal_papers (
  id            uuid primary key default gen_random_uuid(),
  journal_id    uuid not null references journals (id) on delete cascade,
  project_id    uuid not null references research_projects (id) on delete restrict,
  display_order integer not null default 0,
  start_page    integer,
  end_page      integer,
  created_at    timestamptz not null default now(),

  unique (journal_id, project_id),
  constraint journal_papers_pages_ordered check (
    start_page is null or end_page is null or end_page >= start_page
  )
);

create index journal_papers_journal_idx
  on journal_papers (journal_id, display_order);
create index journal_papers_project_idx on journal_papers (project_id);

-- -----------------------------------------------------------------------------
-- journal_credits
-- -----------------------------------------------------------------------------
-- The masthead. Held per journal and frozen to it: because these rows reference
-- journal_id and are never derived from the leadership table, a change of Head
-- of Research cannot retroactively alter who is credited on Journal I.
--
-- credit_title is text rather than an enum because Journal I already carries
-- four distinct titles (Editor-in-Chief, Associate Editor, Mentor, Graphics
-- Designer) and future issues may credit roles nobody has thought of yet. An
-- enum would demand a migration each time.
create table journal_credits (
  id            uuid primary key default gen_random_uuid(),
  journal_id    uuid not null references journals (id) on delete cascade,
  person_id     uuid not null references people (id) on delete restrict,
  credit_title  text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),

  unique (journal_id, person_id, credit_title)
);

create index journal_credits_journal_idx
  on journal_credits (journal_id, display_order);

comment on table journal_credits is
  'Per-journal editorial masthead, independent of the leadership table. Research Cell leadership and journal editorial roles are separate concepts: the Editor-in-Chief of a given issue may or may not be that year Head of Research, and the credit must not change when leadership rotates.';

-- -----------------------------------------------------------------------------
-- journal_corrections
-- -----------------------------------------------------------------------------
-- Corrections are additive. The published record is never rewritten; a
-- correction is a new, separately approved fact about it.
create table journal_corrections (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid not null references journals (id) on delete cascade,
  description text not null,
  recorded_by uuid references profiles (id) on delete set null,
  approved_by uuid references profiles (id) on delete set null,
  approved_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint journal_corrections_approved_consistently
    check ((approved_by is null) = (approved_at is null))
);

create index journal_corrections_journal_idx on journal_corrections (journal_id);
