-- =============================================================================
-- Session 3 — the people framework
-- =============================================================================
-- Three kinds of person appear on the public People page, and they are governed
-- differently on purpose:
--
--   Founders     recorded once, in code. The CMS cannot add, change or remove
--                them, and this migration takes that permission away rather
--                than relying on the interface not to offer it.
--
--   Leadership   entered by hand in the CMS, with a title written by hand.
--                No fixed titles and no fixed number.
--
--   Members      entered by hand in the CMS.
--
-- Leadership and members are the same table and differ by one field, because
-- the only difference between them is what they are called.
--
-- This migration adds no people. The school has not approved the lists.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. What makes someone a member of the Research Cell
-- -----------------------------------------------------------------------------
-- `people` holds two quite different things. Most rows are names on papers:
-- authors, recorded so that a byline survives, who were never members of
-- anything this system tracks. A smaller set are people the Research Cell
-- actually lists.
--
-- `status` is what separates them. Null means "a name on a paper". Setting it
-- is what makes someone appear on the People page, and it is set only from the
-- Edit People screen.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type public.member_status as enum ('student', 'leadership');
  end if;
end
$$;

alter table public.people
  add column if not exists status             public.member_status,
  add column if not exists leadership_title   text,
  add column if not exists academic_year_text text,
  add column if not exists moved_to_past_at   timestamptz;

comment on column public.people.status is
  'student or leadership for someone the Research Cell lists; null for a person who exists only as an author on a paper.';
comment on column public.people.leadership_title is
  'Written by hand, per person. There is no list of permitted titles and no limit on how many people may hold one.';
comment on column public.people.academic_year_text is
  'Exactly what was typed: "2025-26", "2025-27", or anything else. A member may span two A-Level years, so this is never parsed, split or inferred from a date.';
comment on column public.people.moved_to_past_at is
  'Null means current. Set only by a deliberate "Move to past" action -- nothing here moves anyone because a calendar year changed.';

-- A title belongs to leadership. Enforced here rather than only in the form, so
-- a student cannot acquire one through the API either.
alter table public.people
  drop constraint if exists people_title_requires_leadership;
alter table public.people
  add constraint people_title_requires_leadership
  check (leadership_title is null or status = 'leadership');


-- -----------------------------------------------------------------------------
-- 2. Founders are not the CMS's to change
-- -----------------------------------------------------------------------------
-- The write policy is removed outright. What remains is the public read policy,
-- so founders can be displayed and by no route edited: adding them is a
-- migration, which runs with rights the CMS does not have.

drop policy if exists founding_contributors_admin_write on public.founding_contributors;

comment on table public.founding_contributors is
  'Founders. Seeded in code once the school confirms the list; deliberately not writable by the CMS, so a founder cannot be added, renamed or removed from the management area.';

-- Removing the write policy protects the founding_contributors row. It does not
-- protect the people row it points at, which the CMS can otherwise edit or
-- delete -- deleting it would cascade and take the founder with it.
--
-- The same guard refuses to delete anyone whose name is on a published paper or
-- in a journal masthead. Authorship outliving the person's record is the whole
-- reason people and accounts were separated in the first place.
create or replace function public.guard_person_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Migrations and the service-role client, which seed and correct the record.
  if auth.uid() is null then
    return old;
  end if;

  if exists (select 1 from public.founding_contributors fc where fc.person_id = old.id) then
    raise exception
      'Founders cannot be removed from the management area. They are recorded in code.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.research_authors ra where ra.person_id = old.id) then
    raise exception
      'This person is an author on published research. Removing them would take their name off the paper.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.journal_credits jc where jc.person_id = old.id) then
    raise exception
      'This person is credited in a journal. Removing them would take their name out of it.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists people_guard_deletion on public.people;
create trigger people_guard_deletion
  before delete on public.people
  for each row execute function public.guard_person_deletion();

create or replace function public.guard_founder_person()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if exists (select 1 from public.founding_contributors fc where fc.person_id = new.id) then
    raise exception
      'Founders cannot be edited from the management area. They are recorded in code.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists people_guard_founder on public.people;
create trigger people_guard_founder
  before update on public.people
  for each row execute function public.guard_founder_person();


-- -----------------------------------------------------------------------------
-- 3. The old leadership table goes
-- -----------------------------------------------------------------------------
-- It modelled leadership as two named posts -- head and deputy -- appointed per
-- academic year. The school has asked for titles written by hand and for no
-- limit on how many people hold one, which is the opposite of an enum with two
-- values. It holds no rows, so nothing is lost.

drop function if exists public.assign_leadership(uuid, public.leadership_role, uuid, uuid);
drop table if exists public.leadership;
drop type if exists public.leadership_role;


-- -----------------------------------------------------------------------------
-- 4. What the public may read
-- -----------------------------------------------------------------------------
-- is_public was the old safeguarding gate: a student's profile appeared only
-- when School Administration said so. There are no student profiles now, and
-- someone is listed because the CMS deliberately listed them -- which is what
-- having a status means.

drop policy if exists people_public_read on public.people;
create policy people_public_read
  on public.people
  for select
  to anon, authenticated
  using (is_public or status is not null);

drop view if exists public.current_people;

-- security_invoker: Row Level Security still decides, so this view cannot show
-- more than people_public_read already allows.
create view public.current_people
with (security_invoker = true)
as
select
  pe.id,
  pe.full_name,
  pe.status,
  pe.leadership_title,
  pe.academic_year_text
from public.people pe
where pe.status is not null
  and pe.moved_to_past_at is null;

comment on view public.current_people is
  'People the Research Cell currently lists. A person with no status is a name on a paper, not a member, and does not appear here.';

drop view if exists public.past_people;

create view public.past_people
with (security_invoker = true)
as
select
  pe.id,
  pe.full_name,
  pe.status,
  pe.leadership_title,
  pe.academic_year_text,
  pe.moved_to_past_at
from public.people pe
where pe.status is not null
  and pe.moved_to_past_at is not null;

comment on view public.past_people is
  'People moved to the past by hand. academic_year_text is shown exactly as it was entered -- "2025-27" stays "2025-27" and is never split into years.';

grant select on public.current_people to anon, authenticated;
grant select on public.past_people    to anon, authenticated;
