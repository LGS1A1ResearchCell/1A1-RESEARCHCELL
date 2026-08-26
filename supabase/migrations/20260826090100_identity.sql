-- =============================================================================
-- Identity: people, accounts, roles, registration requests
-- =============================================================================
-- The central decision in this file is the split between `people` and
-- `profiles`.
--
--   people   -- a human being in the Research Cell's record. May never have had
--              an account. Journal I credits roughly thirty students, a faculty
--              mentor and a graphics designer; all of them need to exist here.
--              Public identity (name, photo, quote) lives on this table because
--              it must survive an account being deactivated at graduation.
--
--   profiles -- the account attached to a person. Holds private, account-scoped
--              data only (email, status). One-to-one with auth.users.
--
-- Authorship references `people`, never `profiles`. That is what makes
-- authorship permanent and independent of whether a login exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- academic_years
-- -----------------------------------------------------------------------------
-- A supporting table rather than a text column. Academic year is referenced by
-- journals, leadership terms and research projects; storing it once prevents
-- the label drift ("2025-26" vs "2025/26") that would otherwise quietly break
-- grouping and filtering across all three.
create table academic_years (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_years_dates_ordered check (ends_on > starts_on)
);

-- At most one current year at a time.
create unique index academic_years_single_current
  on academic_years (is_current)
  where is_current;

-- -----------------------------------------------------------------------------
-- people
-- -----------------------------------------------------------------------------
create table people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  slug          text not null unique,
  kind          person_kind not null default 'student',

  -- Student-specific; null for faculty and external contributors.
  class_section class_section,
  year_joined   integer,

  quote         text,

  -- Storage object path, plus the focal point used to centre the circular crop.
  -- Expressed as fractions of width and height so the same values hold at any
  -- rendered size. The default sits above centre, which suits head-and-
  -- shoulders portraits far better than dead centre does.
  photo_path    text,
  photo_focal_x numeric(4,3) not null default 0.500,
  photo_focal_y numeric(4,3) not null default 0.400,

  -- Whether this person appears on the public People pages. Conservative by
  -- default: nothing about a student becomes public without a deliberate act.
  is_public     boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint people_focal_x_range check (photo_focal_x between 0 and 1),
  constraint people_focal_y_range check (photo_focal_y between 0 and 1),
  constraint people_year_joined_sane check (
    year_joined is null or year_joined between 2000 and 2100
  )
);

create index people_kind_idx on people (kind);
create index people_public_idx on people (is_public) where is_public;

create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();

comment on column people.year_joined is
  'Entered manually. It cannot be inferred from the current year, since a student who joined in 2025 remains a 2025 joiner indefinitely.';

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  person_id    uuid not null unique references people (id) on delete restrict,
  email        text not null,
  status       account_status not null default 'pending',

  -- Set the first time the student completes the one-time dashboard
  -- explanation of individual versus team submission.
  onboarded_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_status_idx on profiles (status);
create index profiles_person_idx on profiles (person_id);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

comment on table profiles is
  'Account data only. Public-facing fields live on people, so that a public profile and its authorship survive the account being suspended or deactivated at graduation. The person_id foreign key uses ON DELETE RESTRICT so a person carrying authorship can never be removed as a side effect of deleting an account.';

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
-- A table rather than a column on profiles, so that every grant records who
-- made it and when. Roles are never read from JWT claims, which a client can
-- tamper with; see current_app_role() in the RLS migration.
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  role       app_role not null,
  granted_by uuid references profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);

create index user_roles_user_idx on user_roles (user_id);

-- -----------------------------------------------------------------------------
-- account_requests
-- -----------------------------------------------------------------------------
-- A sign-up creates an auth user AND a request. The account is unusable until
-- School Administration approves it. Approval is recorded here and does not
-- depend on email delivery in any way, so the workflow is complete today and an
-- email layer can be added later without touching the schema.
create table account_requests (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete cascade,

  full_name     text not null,
  email         text not null,
  class_section class_section not null,
  year_joined   integer not null,

  status        account_status not null default 'pending',
  reviewed_by   uuid references profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,

  created_at    timestamptz not null default now(),

  constraint account_requests_year_sane
    check (year_joined between 2000 and 2100),
  constraint account_requests_reviewed_consistently
    check ((reviewed_by is null) = (reviewed_at is null))
);

create index account_requests_status_idx on account_requests (status);

-- -----------------------------------------------------------------------------
-- leadership
-- -----------------------------------------------------------------------------
-- Annual appointments. Historical rows are never deleted, so past leadership
-- remains queryable. Founders are NOT recorded here -- see
-- founding_contributors -- so that a founder can never be rotated out when a
-- new Head is appointed.
create table leadership (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references people (id) on delete restrict,
  role             leadership_role not null,
  academic_year_id uuid not null references academic_years (id) on delete restrict,
  appointed_by     uuid references profiles (id) on delete set null,
  created_at       timestamptz not null default now(),

  -- One Head and one Deputy per academic year.
  unique (academic_year_id, role)
);

create index leadership_person_idx on leadership (person_id);
create index leadership_year_idx on leadership (academic_year_id);

-- -----------------------------------------------------------------------------
-- founding_contributors
-- -----------------------------------------------------------------------------
create table founding_contributors (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references people (id) on delete restrict,
  role_title    text not null,
  description   text,
  year          integer,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index founding_contributors_order_idx
  on founding_contributors (display_order);
