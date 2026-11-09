-- =============================================================================
-- Founders and Contributors, and CMS-managed leadership positions
-- =============================================================================
-- Two changes, both decided by the school:
--
--   1. The permanent record is six people, not two, and each card carries a
--      role title, a name and a description. No new columns: the description
--      column already holds the third line, and a structured class-year column
--      would have had no reader.
--
--   2. Leadership stops being an attribute of a person and becomes a record of
--      its own. A position exists whether or not anyone holds it, its title is
--      editable text rather than an enum, there is no limit on how many
--      positions there are, and one person may hold several.
--
-- The hard part is not the shape, it is making it impossible to change a
-- holder without recording the appointment that ended. That is enforced three
-- ways, deliberately overlapping: a CHECK constraint for the occupancy
-- invariant, triggers for derivation and history, and the absence of write
-- privileges for every client role. None of it relies on the application
-- interface behaving correctly.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Founders and Contributors
-- -----------------------------------------------------------------------------
-- Six permanent records. Nobody is identified by a hard-coded id, because the
-- ids differ between the live project and the testing project -- the seeds
-- generate them. Five people are resolved by name and must match exactly one
-- record each; a mismatch raises rather than quietly producing five cards out
-- of six.
--
-- Wafiyah Awais is the exception. Two person records share her name in the live
-- database -- one created by the Journal I seed, one by the retired
-- account-approval flow -- and only the first is the public, credited identity.
-- Her existing Website Developer contribution row is what distinguishes them,
-- so that is what identifies her here. The other record is left untouched,
-- along with its own separate authorship.

do $$
declare
  v_bushra  uuid;
  v_natasha uuid;
  v_hafsa   uuid;
  v_wafiyah uuid;
  v_noor    uuid;
  v_amna    uuid;
  v_n       integer;
begin
  select fc.person_id into v_wafiyah
    from public.founding_contributors fc
   where fc.role_title = 'Website Developer';
  if v_wafiyah is null then
    raise exception
      'The existing Website Developer contribution row was not found, so the canonical Wafiyah Awais record cannot be identified.';
  end if;

  -- Counted first, then fetched: uuid has no min(), and an ambiguous name must
  -- stop the migration rather than pick a record.
  select count(*) into v_n from public.people where full_name = 'Bushra Mehmood Lakho';
  if v_n <> 1 then
    raise exception 'Expected exactly one person named Bushra Mehmood Lakho, found %.', v_n;
  end if;
  select pe.id into v_bushra from public.people pe where pe.full_name = 'Bushra Mehmood Lakho';

  select count(*) into v_n from public.people where full_name = 'Dr. Natasha Nadeem';
  if v_n <> 1 then
    raise exception 'Expected exactly one person named Dr. Natasha Nadeem, found %.', v_n;
  end if;
  select pe.id into v_natasha from public.people pe where pe.full_name = 'Dr. Natasha Nadeem';

  select count(*) into v_n from public.people where full_name = 'Noor Alvi';
  if v_n <> 1 then
    raise exception 'Expected exactly one person named Noor Alvi, found %.', v_n;
  end if;
  select pe.id into v_noor from public.people pe where pe.full_name = 'Noor Alvi';

  select count(*) into v_n from public.people where full_name = 'Amna Iqbal';
  if v_n <> 1 then
    raise exception 'Expected exactly one person named Amna Iqbal, found %.', v_n;
  end if;
  select pe.id into v_amna from public.people pe where pe.full_name = 'Amna Iqbal';

  -- Hafsa Ahsan is an alumna of the school and has no record yet. She is a
  -- contributor and not a Research Cell member: status and academic_year_text
  -- stay null, because the Research Cell did not exist while she was a student.
  select count(*) into v_n from public.people where full_name = 'Hafsa Ahsan';
  if v_n > 1 then
    raise exception 'Expected at most one person named Hafsa Ahsan, found %.', v_n;
  elsif v_n = 0 then
    insert into public.people (full_name, slug, kind, is_public)
    values ('Hafsa Ahsan', public.generate_person_slug('Hafsa Ahsan'), 'alumni', true)
    returning id into v_hafsa;
  else
    select pe.id into v_hafsa from public.people pe where pe.full_name = 'Hafsa Ahsan';
  end if;

  -- The six rows. `year` is never named, so the value Bushra's row already
  -- carries is left exactly as it is and simply stops being displayed.
  update public.founding_contributors
     set role_title = 'Founder',
         description = 'STEM Representative, Class of 2026',
         display_order = 10
   where person_id = v_bushra;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_bushra, 'Founder', 'STEM Representative, Class of 2026', 10);
  end if;

  update public.founding_contributors
     set role_title = 'Co-founder',
         description = 'Head Girl, Class of 2018',
         display_order = 20
   where person_id = v_natasha;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_natasha, 'Co-founder', 'Head Girl, Class of 2018', 20);
  end if;

  update public.founding_contributors
     set role_title = 'Co-founder',
         description = 'STEM Representative, Class of 2019',
         display_order = 30
   where person_id = v_hafsa;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_hafsa, 'Co-founder', 'STEM Representative, Class of 2019', 30);
  end if;

  update public.founding_contributors
     set role_title = 'Website Developer',
         description = 'Lead Reviewer, Class of 2027',
         display_order = 40
   where person_id = v_wafiyah;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_wafiyah, 'Website Developer', 'Lead Reviewer, Class of 2027', 40);
  end if;

  update public.founding_contributors
     set role_title = 'Contributor',
         description = 'Literary Representative, Class of 2026 and Editor of Journal I',
         display_order = 50
   where person_id = v_noor;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_noor, 'Contributor',
            'Literary Representative, Class of 2026 and Editor of Journal I', 50);
  end if;

  update public.founding_contributors
     set role_title = 'Graphic Designer',
         description = 'Events and Logistics Representative, Class of 2027',
         display_order = 60
   where person_id = v_amna;
  if not found then
    insert into public.founding_contributors (person_id, role_title, description, display_order)
    values (v_amna, 'Graphic Designer',
            'Events and Logistics Representative, Class of 2027', 60);
  end if;
end
$$;

comment on table public.founding_contributors is
  'The permanent record of founders and contributors: six people, one card each, ordered by display_order. Not reachable from the management area at all -- the table has no write policy, so adding or correcting a row is a deliberate database operation. role_title, the person name and description are the three lines of the public card; `year` predates that design and is retained but not displayed.';


-- -----------------------------------------------------------------------------
-- 2. Leadership positions and their history
-- -----------------------------------------------------------------------------

create table if not exists public.leadership_positions (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  person_id        uuid references public.people (id) on delete restrict,
  assigned_at      timestamptz,
  -- The year the current appointment belongs to. Restrict, not set null: a
  -- year nulled out from under an occupied position would break the occupancy
  -- invariant below and fail with an error naming the wrong problem.
  academic_year_id uuid references public.academic_years (id) on delete restrict,
  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint leadership_positions_occupancy_coherent check (
    (person_id is null and assigned_at is null and academic_year_id is null)
    or
    (person_id is not null and assigned_at is not null and academic_year_id is not null)
  )
);

create index if not exists leadership_positions_order_idx
  on public.leadership_positions (display_order);
create index if not exists leadership_positions_person_idx
  on public.leadership_positions (person_id) where person_id is not null;

comment on table public.leadership_positions is
  'Current leadership appointments, one row per position. Titles are editable text and there is no limit on how many positions exist. A position with a null person_id is vacant and still exists. No client role holds INSERT, UPDATE or DELETE here: every change goes through a SECURITY DEFINER function owned by postgres, which is also why this table must never be given FORCE ROW LEVEL SECURITY -- the owner bypass is what lets those functions and the history trigger write.';

comment on constraint leadership_positions_occupancy_coherent on public.leadership_positions is
  'A position is either fully vacant or fully occupied. Without this, a direct update could set a holder and leave academic_year_id null -- and the appointment would later be recorded in history with no year, silently. A foreign key cannot catch that case, because a foreign key never rejects null.';

create table if not exists public.leadership_history (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references public.people (id) on delete restrict,
  -- Set null, not cascade: deleting a position must not erase the record that
  -- somebody held it. title and academic_year_label are frozen for the same
  -- reason.
  position_id         uuid references public.leadership_positions (id) on delete set null,
  title               text not null,
  academic_year_id    uuid references public.academic_years (id) on delete set null,
  academic_year_label text,
  started_at          timestamptz,
  ended_at            timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists leadership_history_person_idx
  on public.leadership_history (person_id);
create index if not exists leadership_history_year_idx
  on public.leadership_history (academic_year_id);

comment on table public.leadership_history is
  'One row per completed leadership appointment, written only by the trigger on leadership_positions. Append-only: no role holds INSERT, UPDATE or DELETE and there is no write policy. title and academic_year_label are snapshots, so a position renamed or an academic year relabelled or deleted later cannot alter what the record says. Display the label; use academic_year_id only to group and join.';


-- -----------------------------------------------------------------------------
-- 3. The invariants, enforced by trigger on every write path
-- -----------------------------------------------------------------------------
-- These bind the table owner and the service role as well as the CMS, which is
-- the point: privileges close the client path, triggers close the rest.

create or replace function public.guard_position_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_id is not null
     or new.assigned_at is not null
     or new.academic_year_id is not null then
    raise exception
      'A leadership position is created vacant. Assign a holder afterwards with assign_leadership_position(), so the appointment is dated and recorded.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists leadership_positions_guard_insert on public.leadership_positions;
create trigger leadership_positions_guard_insert
  before insert on public.leadership_positions
  for each row execute function public.guard_position_insert();

-- assigned_at is derived from the holder transition rather than supplied, so
-- started_at in the history cannot be back-dated by whoever writes the update.
create or replace function public.derive_position_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_id is distinct from old.person_id then
    if new.person_id is null then
      -- Vacating clears the whole appointment together.
      new.assigned_at      := null;
      new.academic_year_id := null;
    else
      if new.academic_year_id is null then
        raise exception
          'A leadership appointment needs an academic year. Use assign_leadership_position(), which resolves the current year.'
          using errcode = '23514';
      end if;
      new.assigned_at := now();
    end if;
  else
    -- Holder unchanged: the date of their appointment is not the caller's to
    -- rewrite. academic_year_id deliberately passes through, so a year
    -- recorded in error can be corrected without inventing a history row --
    -- the occupancy constraint still forbids nulling it while occupied.
    new.assigned_at := old.assigned_at;
  end if;
  return new;
end;
$$;

drop trigger if exists leadership_positions_derive on public.leadership_positions;
create trigger leadership_positions_derive
  before update on public.leadership_positions
  for each row execute function public.derive_position_assignment();

drop trigger if exists leadership_positions_set_updated_at on public.leadership_positions;
create trigger leadership_positions_set_updated_at
  before update on public.leadership_positions
  for each row execute function public.set_updated_at();

-- History is a consequence of the change, not something a caller has to
-- remember. Any statement that moves a holder off a position records it.
create or replace function public.record_leadership_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.person_id is not null and new.person_id is distinct from old.person_id then
    insert into public.leadership_history
      (person_id, position_id, title, academic_year_id, academic_year_label,
       started_at, ended_at)
    values
      (old.person_id, old.id, old.title, old.academic_year_id,
       (select ay.label from public.academic_years ay where ay.id = old.academic_year_id),
       old.assigned_at, now());
  end if;
  return null;
end;
$$;

drop trigger if exists leadership_positions_record_history on public.leadership_positions;
create trigger leadership_positions_record_history
  after update on public.leadership_positions
  for each row execute function public.record_leadership_history();

create or replace function public.guard_position_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.person_id is not null then
    raise exception
      'Vacate this position before deleting it, so the appointment it holds is recorded in the leadership history.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists leadership_positions_guard_delete on public.leadership_positions;
create trigger leadership_positions_guard_delete
  before delete on public.leadership_positions
  for each row execute function public.guard_position_delete();


-- -----------------------------------------------------------------------------
-- 4. Who may read, and who may write
-- -----------------------------------------------------------------------------
-- Reading is public: positions and history are part of the public record.
-- Writing is nobody's, directly. Supabase grants anon and authenticated full
-- DML on every new table in this schema by default, so the privileges have to
-- be taken back explicitly -- leaving them in place is how the first draft of
-- this design would have allowed a position to be inserted already occupied.

alter table public.leadership_positions enable row level security;
alter table public.leadership_history   enable row level security;

drop policy if exists leadership_positions_public_read on public.leadership_positions;
create policy leadership_positions_public_read
  on public.leadership_positions
  for select to anon, authenticated using (true);

drop policy if exists leadership_history_public_read on public.leadership_history;
create policy leadership_history_public_read
  on public.leadership_history
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.leadership_positions from anon, authenticated;
revoke insert, update, delete on public.leadership_history   from anon, authenticated;

grant select on public.leadership_positions to anon, authenticated;
grant select on public.leadership_history   to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. The functions the management area calls
-- -----------------------------------------------------------------------------
-- Each one checks is_school_admin() itself. SECURITY DEFINER bypasses Row
-- Level Security, so the check cannot be left to a policy.

create or replace function public.create_leadership_position(
  p_title text,
  p_display_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may create leadership positions.'
      using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'Give the position a title.' using errcode = '22023';
  end if;

  insert into public.leadership_positions (title, display_order)
  values (btrim(p_title), coalesce(p_display_order, 0))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_leadership_position(
  p_position uuid,
  p_title text,
  p_display_order integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may rename leadership positions.'
      using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'Give the position a title.' using errcode = '22023';
  end if;

  update public.leadership_positions
     set title = btrim(p_title),
         display_order = coalesce(p_display_order, display_order)
   where id = p_position;

  if not found then
    raise exception 'That leadership position does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_leadership_position(p_position uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may delete leadership positions.'
      using errcode = '42501';
  end if;

  -- An occupied position is refused by the delete guard, with its own message.
  delete from public.leadership_positions where id = p_position;

  if not found then
    raise exception 'That leadership position does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.assign_leadership_position(
  p_position uuid,
  p_person uuid,
  p_academic_year_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year    uuid;
  v_current uuid;
  v_found   boolean;
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may assign leadership.'
      using errcode = '42501';
  end if;

  -- Assigning and vacating are separate operations on purpose. A null person
  -- here is a mistake, not a request to vacate.
  if p_person is null then
    raise exception
      'To remove a holder, use vacate_leadership_position(). This function only assigns.'
      using errcode = '22023';
  end if;
  if p_position is null then
    raise exception 'No leadership position was given.' using errcode = '22023';
  end if;

  v_year := coalesce(p_academic_year_id,
                     (select ay.id from public.academic_years ay where ay.is_current));
  if v_year is null then
    raise exception
      'No current academic year is set. Set one before assigning leadership, or pass the year explicitly.'
      using errcode = 'P0002';
  end if;

  select lp.person_id, true into v_current, v_found
    from public.leadership_positions lp where lp.id = p_position for update;
  if v_found is not true then
    raise exception 'That leadership position does not exist.' using errcode = 'P0002';
  end if;

  -- Reassigning a position to the person who already holds it changes nothing
  -- and must not record an appointment as having ended.
  if v_current is not distinct from p_person then
    return;
  end if;

  if not exists (
    select 1 from public.people pe
     where pe.id = p_person and pe.moved_to_past_at is null
  ) then
    raise exception 'That person is not a current record.' using errcode = 'P0002';
  end if;

  update public.leadership_positions
     set person_id = p_person,
         academic_year_id = v_year
   where id = p_position;
end;
$$;

create or replace function public.vacate_leadership_position(p_position uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
  v_found   boolean;
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may change leadership.'
      using errcode = '42501';
  end if;

  select lp.person_id, true into v_current, v_found
    from public.leadership_positions lp where lp.id = p_position for update;
  if v_found is not true then
    raise exception 'That leadership position does not exist.' using errcode = 'P0002';
  end if;

  if v_current is null then
    return;   -- already vacant
  end if;

  update public.leadership_positions
     set person_id = null,
         academic_year_id = null
   where id = p_position;
end;
$$;

-- Archiving is one statement over every position the person holds, so each
-- appointment is recorded by the trigger and every position is vacated
-- together with the archive flag -- or none of it happens.
create or replace function public.archive_person(p_person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may archive people.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.people pe where pe.id = p_person) then
    raise exception 'That person does not exist.' using errcode = 'P0002';
  end if;

  update public.leadership_positions
     set person_id = null,
         academic_year_id = null
   where person_id = p_person;

  update public.people
     set moved_to_past_at = now()
   where id = p_person and moved_to_past_at is null;
end;
$$;

-- Restoring clears the archive flag and nothing else. An appointment that
-- ended stays ended: coming back is not the same as being re-appointed.
create or replace function public.restore_person(p_person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_admin() then
    raise exception 'Only the management area may restore people.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.people pe where pe.id = p_person) then
    raise exception 'That person does not exist.' using errcode = 'P0002';
  end if;

  update public.people set moved_to_past_at = null where id = p_person;
end;
$$;

revoke all on function public.create_leadership_position(text, integer) from public, anon;
revoke all on function public.update_leadership_position(uuid, text, integer) from public, anon;
revoke all on function public.delete_leadership_position(uuid) from public, anon;
revoke all on function public.assign_leadership_position(uuid, uuid, uuid) from public, anon;
revoke all on function public.vacate_leadership_position(uuid) from public, anon;
revoke all on function public.archive_person(uuid) from public, anon;
revoke all on function public.restore_person(uuid) from public, anon;

grant execute on function public.create_leadership_position(text, integer) to authenticated;
grant execute on function public.update_leadership_position(uuid, text, integer) to authenticated;
grant execute on function public.delete_leadership_position(uuid) to authenticated;
grant execute on function public.assign_leadership_position(uuid, uuid, uuid) to authenticated;
grant execute on function public.vacate_leadership_position(uuid) to authenticated;
grant execute on function public.archive_person(uuid) to authenticated;
grant execute on function public.restore_person(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 6. Deleting a person, with leadership taken into account
-- -----------------------------------------------------------------------------
-- The foreign keys already refuse, but with a constraint name rather than a
-- sentence. This keeps the explanation in the same voice as the others.

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

  if exists (select 1 from public.leadership_positions lp where lp.person_id = old.id) then
    raise exception
      'This person currently holds a leadership position. Vacate it first, so the appointment is recorded.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.leadership_history lh where lh.person_id = old.id) then
    raise exception
      'This person appears in the leadership history. Removing them would take their appointment out of the record.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. What the public site reads
-- -----------------------------------------------------------------------------
-- security_invoker on all three, so Row Level Security still decides the rows.

create or replace view public.current_leadership
with (security_invoker = true)
as
select
  lp.id,
  lp.title,
  lp.display_order,
  lp.person_id,
  pe.full_name,
  lp.assigned_at,
  lp.academic_year_id,
  ay.label as academic_year
from public.leadership_positions lp
join public.people pe on pe.id = lp.person_id
left join public.academic_years ay on ay.id = lp.academic_year_id
where lp.person_id is not null
  and pe.moved_to_past_at is null;

comment on view public.current_leadership is
  'Filled leadership positions only. A vacant position is a real record but has nothing to show on a public page, so it is not returned here.';

create or replace view public.past_leadership
with (security_invoker = true)
as
select
  lh.id,
  lh.person_id,
  pe.full_name,
  lh.title,
  lh.academic_year_label,
  lh.academic_year_id,
  lh.started_at,
  lh.ended_at
from public.leadership_history lh
join public.people pe on pe.id = lh.person_id;

comment on view public.past_leadership is
  'Completed leadership appointments. academic_year_label is the snapshot taken when the appointment ended and is what should be displayed.';

-- Current members are the people the Research Cell lists who are not currently
-- holding a position -- a position holder belongs under leadership and should
-- not appear twice. The column list is unchanged so existing callers still work.
drop view if exists public.current_people;
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
  and pe.moved_to_past_at is null
  and not exists (
    select 1 from public.leadership_positions lp where lp.person_id = pe.id
  );

comment on view public.current_people is
  'Current members: people the Research Cell lists who have not been archived and do not currently hold a leadership position. A permanent contributor is not a member and has no status, so none of them appear here.';

grant select on public.current_leadership to anon, authenticated;
grant select on public.past_leadership    to anon, authenticated;
grant select on public.current_people     to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 8. The three initial positions
-- -----------------------------------------------------------------------------
-- Created vacant, because that is the only way a position can be created. The
-- Lead Reviewer appointment is then made as a separate statement, which is the
-- same path the management area takes -- the triggers date it and would record
-- its end.

insert into public.leadership_positions (title, display_order)
select v.title, v.ord
  from (values
    ('Head of Research', 10),
    ('Deputy Head of Research', 20),
    ('Lead Reviewer', 30)
  ) as v(title, ord)
 where not exists (
   select 1 from public.leadership_positions lp where lp.title = v.title
 );

do $$
declare
  v_position uuid;
  v_person   uuid;
  v_year     uuid;
  v_holder   uuid;
begin
  select lp.id, lp.person_id into v_position, v_holder
    from public.leadership_positions lp where lp.title = 'Lead Reviewer';
  if v_position is null then
    raise exception 'The Lead Reviewer position was not created.';
  end if;

  -- Already assigned by an earlier run: leave it alone.
  if v_holder is not null then
    return;
  end if;

  select fc.person_id into v_person
    from public.founding_contributors fc
   where fc.role_title = 'Website Developer';
  if v_person is null then
    raise exception 'The canonical Wafiyah Awais record could not be identified.';
  end if;

  select ay.id into v_year from public.academic_years ay where ay.is_current;
  if v_year is null then
    raise exception
      'No current academic year is set, so the Lead Reviewer appointment cannot be dated.';
  end if;

  update public.leadership_positions
     set person_id = v_person,
         academic_year_id = v_year
   where id = v_position;
end
$$;
