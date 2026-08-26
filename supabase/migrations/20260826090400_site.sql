-- =============================================================================
-- Site: notifications, resources, announcements, editable content, audit log
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
-- In-app only. `type` is text rather than an enum so that a new notification
-- kind never requires a migration, and `entity_type` / `entity_id` form a loose
-- pointer back to whatever the notification concerns.
--
-- An email layer can later read from this same table. Nothing here depends on
-- the school's mail infrastructure existing.
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx
  on notifications (recipient_id, created_at desc);
create index notifications_unread_idx
  on notifications (recipient_id)
  where read_at is null;

-- -----------------------------------------------------------------------------
-- resources
-- -----------------------------------------------------------------------------
-- Structure only. Official wording is not invented here; rows are seeded with
-- explicit placeholders until the school supplies approved text.
create table resources (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  title         text not null,
  slug          text not null unique,
  description   text,
  body          text,
  file_path     text,
  external_url  text,
  display_order integer not null default 0,
  is_published  boolean not null default false,
  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index resources_category_idx on resources (category, display_order);
create index resources_published_idx on resources (is_published) where is_published;

create trigger resources_set_updated_at
  before update on resources
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- announcements
-- -----------------------------------------------------------------------------
-- Display is time-bounded. Expiry is evaluated in the read policy against
-- now(), so an announcement stops appearing on its end date without any
-- scheduled job.
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  starts_on  date not null default current_date,
  ends_on    date,
  is_visible boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcements_dates_ordered check (
    ends_on is null or ends_on >= starts_on
  )
);

create index announcements_window_idx on announcements (starts_on, ends_on);

create trigger announcements_set_updated_at
  before update on announcements
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- site_content
-- -----------------------------------------------------------------------------
-- Keyed text fragments, so wording changes do not require a redeployment.
--
-- Scope is deliberately limited to copy: the tagline, homepage introduction,
-- About text, FAQ entries and contact details. Application structure is not
-- editable, which keeps the surface small enough to stay safe.
--
-- The tagline in particular is stored here rather than hard-coded, because the
-- question of whether the Research Cell is restricted to scientific subjects is
-- still open.
create table site_content (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  value       text,
  format      site_content_format not null default 'text',
  description text,
  updated_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger site_content_set_updated_at
  before update on site_content
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- activity_log
-- -----------------------------------------------------------------------------
-- Private administrative audit trail. Append-only: no policy grants UPDATE or
-- DELETE to any role, and students cannot read it at all.
create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index activity_log_created_idx on activity_log (created_at desc);
create index activity_log_actor_idx on activity_log (actor_id);
create index activity_log_entity_idx on activity_log (entity_type, entity_id);

comment on table activity_log is
  'Append-only administrative audit trail. actor_id is nullable and set null on account deletion so that a log entry survives the removal of the account that produced it.';
