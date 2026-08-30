-- =============================================================================
-- Phase 4 — research submission, team assembly and author confirmation
-- =============================================================================
-- Three decisions shape this file.
--
--   1. A Team Leader needs to find their co-authors. Until now a student could
--      see only public profiles, which are the historical Journal I authors --
--      people with no accounts, who can never confirm anything. The two real
--      student accounts were invisible. Team research was literally
--      unbuildable. Fixed below with a deliberately narrow directory.
--
--   2. The author list freezes once a co-author confirms. A confirmation is a
--      statement by a named student that they worked on this paper; it must not
--      be possible to rearrange the authorship around it afterwards.
--
--   3. A paper cannot reach review with nothing to read.
-- =============================================================================


-- =============================================================================
-- The member directory
-- =============================================================================
-- A function rather than a Row Level Security policy, and deliberately so.
--
-- RLS grants rows, not columns. A policy letting students see one another would
-- expose every column of `people` -- quote, photograph, year joined -- to the
-- whole student body. This returns three columns and nothing else.
--
-- It is also narrower than a policy in every other respect: active student
-- accounts only, so suspended and alumni accounts are absent; the historical
-- Journal I people are absent because they hold no account; the caller is
-- excluded from their own results; and it answers nothing at all unless the
-- caller is themselves an active account.
--
-- This does not change who appears on the public site. It exists solely so that
-- a Team Leader can name the people they worked with.

create or replace function public.search_research_cell_members(
  p_query text default null
)
returns table (
  id            uuid,
  full_name     text,
  class_section public.class_section
)
language sql
stable
security definer
set search_path = ''
as $$
  select pe.id, pe.full_name, pe.class_section
  from public.people pe
  join public.profiles pr on pr.person_id = pe.id
  where public.is_active_account()
    and pr.status = 'active'
    and pe.kind = 'student'
    and pe.id is distinct from public.current_person_id()
    and (
      p_query is null
      or btrim(p_query) = ''
      or pe.full_name ilike '%' || btrim(p_query) || '%'
    )
  order by pe.full_name
  limit 50;
$$;

revoke all on function public.search_research_cell_members(text) from public, anon;
grant execute on function public.search_research_cell_members(text) to authenticated;

comment on function public.search_research_cell_members is
  'Minimal directory for team assembly: name and class of active student accounts only. Returns three columns rather than whole rows, and nothing at all to a caller who is not an active account. Unrelated to public profile visibility.';


-- =============================================================================
-- Project slugs
-- =============================================================================

create or replace function public.generate_project_slug(p_title text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         integer := 1;
begin
  -- Long titles make unusable URLs; Journal I's run past 130 characters.
  base := regexp_replace(lower(btrim(coalesce(p_title, ''))), '[^a-z0-9]+', '-', 'g');
  base := btrim(base, '-');
  base := left(base, 60);
  base := btrim(base, '-');
  if base = '' then
    base := 'research';
  end if;

  candidate := base;
  while exists (select 1 from public.research_projects rp where rp.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.generate_project_slug(text) from public, anon;
grant execute on function public.generate_project_slug(text) to authenticated, service_role;


-- =============================================================================
-- create_research_project
-- =============================================================================
-- Creating a project and recording its Team Leader happen together or not at
-- all. Doing this in two client calls would leave a window in which a project
-- exists with no leader -- and research_authors_one_lead would then let anyone
-- claim the role.
--
-- The caller becomes sole_author on individual work and team_leader on team
-- work, confirmed either way: they are the student who started the submission,
-- which is what the specification says makes them the Team Leader.

create or replace function public.create_research_project(
  p_title           text,
  p_research_type   public.research_type,
  p_authorship_mode public.authorship_mode,
  p_subject_id      uuid    default null,
  p_research_area   text    default null,
  p_abstract        text    default null,
  p_team_name       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person  uuid;
  v_project uuid;
  v_year    uuid;
  v_title   text;
begin
  if not public.is_active_account() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  v_person := public.current_person_id();
  if v_person is null then
    raise exception 'Your profile is not set up yet.' using errcode = 'P0002';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if length(v_title) < 5 then
    raise exception 'Please give your research a title.' using errcode = '22023';
  end if;

  -- A team name only makes sense on team work; the table constraint agrees.
  if p_authorship_mode = 'individual' and p_team_name is not null then
    raise exception 'Individual research does not have a team name.' using errcode = '22023';
  end if;

  select id into v_year from public.academic_years where is_current;

  insert into public.research_projects
    (title, slug, research_type, authorship_mode, team_name, subject_id,
     research_area, abstract, academic_year_id, status, created_by)
  values
    (v_title, public.generate_project_slug(v_title), p_research_type,
     p_authorship_mode, nullif(btrim(coalesce(p_team_name, '')), ''), p_subject_id,
     nullif(btrim(coalesce(p_research_area, '')), ''),
     nullif(btrim(coalesce(p_abstract, '')), ''),
     v_year, 'draft', auth.uid())
  returning id into v_project;

  insert into public.research_authors
    (project_id, person_id, author_role, author_order, confirmation_status,
     confirmed_at, added_by)
  values
    (v_project, v_person,
     -- Explicitly cast: a CASE resolves to text, which Postgres will not
     -- implicitly coerce to an enum column.
     (case when p_authorship_mode = 'team' then 'team_leader' else 'sole_author' end)::public.author_role,
     1, 'confirmed', now(), auth.uid());

  return v_project;
end;
$$;

revoke all on function public.create_research_project(text, public.research_type, public.authorship_mode, uuid, text, text, text)
  from public, anon;
grant execute on function public.create_research_project(text, public.research_type, public.authorship_mode, uuid, text, text, text)
  to authenticated;


-- =============================================================================
-- add_research_version
-- =============================================================================
-- version_number was client-supplied against a unique constraint, so two
-- uploads racing each other produced a failure rather than versions 1 and 2.
-- Assigned here under a lock on the project row instead.
--
-- Nothing in this function can overwrite an existing version: it only ever
-- inserts, and research_versions has UPDATE and DELETE revoked outright.

create or replace function public.add_research_version(
  p_project_id  uuid,
  p_path        text,
  p_filename    text,
  p_mime        text default null,
  p_size_bytes  bigint default null,
  p_notes       text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if not public.is_active_account() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  if not public.is_project_lead(p_project_id) then
    raise exception 'Only the Team Leader may upload a document for this submission.'
      using errcode = '42501';
  end if;

  -- Serialise concurrent uploads on the same project.
  perform 1 from public.research_projects where id = p_project_id for update;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.research_versions where project_id = p_project_id;

  insert into public.research_versions
    (project_id, version_number, document_path, document_filename,
     document_mime, document_size_bytes, submitted_by, notes)
  values
    (p_project_id, v_next, p_path, p_filename, p_mime, p_size_bytes, auth.uid(),
     nullif(btrim(coalesce(p_notes, '')), ''));

  return v_next;
end;
$$;

revoke all on function public.add_research_version(uuid, text, text, text, bigint, text)
  from public, anon;
grant execute on function public.add_research_version(uuid, text, text, text, bigint, text)
  to authenticated;


-- =============================================================================
-- The author list freezes once a co-author confirms
-- =============================================================================
-- A confirmation is a named student stating that they worked on this paper. Once
-- one has been given, the authorship around it must not be rearranged.
--
-- The Team Leader's own confirmation does NOT count. They are confirmed the
-- instant they create the project, so counting it would freeze the list before a
-- single co-author could be added and make team research impossible. Only
-- confirmations by co-authors close the list.

create or replace function public.guard_authorship_frozen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project   uuid;
  v_confirmed integer;
begin
  if tg_op = 'DELETE' then
    v_project := old.project_id;
  else
    v_project := new.project_id;
  end if;

  -- Migrations, seeds, service-role, and School Administration corrections.
  if auth.uid() is null or public.is_school_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select count(*) into v_confirmed
  from public.research_authors ra
  where ra.project_id = v_project
    and ra.author_role = 'co_author'
    and ra.confirmation_status = 'confirmed';

  if v_confirmed > 0 then
    raise exception
      'The author list is fixed: % co-author(s) have already confirmed their authorship. Ask school administration if a correction is needed.',
      v_confirmed
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger research_authors_frozen_insert
  before insert on public.research_authors
  for each row execute function public.guard_authorship_frozen();

create trigger research_authors_frozen_delete
  before delete on public.research_authors
  for each row execute function public.guard_authorship_frozen();


-- =============================================================================
-- A paper cannot reach review with nothing to read
-- =============================================================================
-- Extends the Phase 1 status machine. Everything it already enforced is
-- unchanged; this adds the requirement that a document exists before the work
-- leaves draft, and that a co-author added to a team submission holds an
-- account -- otherwise the paper waits forever for a confirmation that can
-- never come.

create or replace function public.guard_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_lead     boolean;
  unconfirmed integer;
  versions    integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_school_admin() then
    return new;
  end if;

  is_lead := public.is_leadership();

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new research project must start as a draft.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'published' then
    raise exception 'Research becomes published through the journal workflow, not directly.'
      using errcode = '42501';
  end if;

  if old.status = 'published' then
    raise exception 'Published research cannot be moved out of the archive.'
      using errcode = '42501';
  end if;

  if new.status in ('under_review', 'revision_required', 'approved')
     and not is_lead then
    raise exception 'Only Research Cell leadership may move research to %.', new.status
      using errcode = '42501';
  end if;

  if is_lead then
    if old.status in ('submitted', 'under_review', 'revision_required')
       and new.status in ('under_review', 'revision_required', 'approved') then
      return new;
    end if;
  end if;

  if not public.is_project_lead(new.id) then
    raise exception 'Only the Team Leader may change the status of this submission.'
      using errcode = '42501';
  end if;

  -- A document must exist before the work leaves draft.
  if new.status in ('awaiting_author_confirmation', 'submitted') then
    select count(*) into versions
    from public.research_versions rv where rv.project_id = new.id;

    if versions = 0 then
      raise exception 'Upload your paper before submitting it.'
        using errcode = '42501';
    end if;
  end if;

  if new.status = 'submitted' and new.authorship_mode = 'team' then
    unconfirmed := public.unconfirmed_author_count(new.id);
    if unconfirmed > 0 then
      raise exception
        'This submission still has % author(s) awaiting confirmation and cannot proceed to review.',
        unconfirmed
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'draft' and new.status = 'submitted'
     and new.authorship_mode = 'team' then
    raise exception 'Team research must go through author confirmation before submission.'
      using errcode = '42501';
  end if;

  if (old.status = 'draft'
        and new.status in ('awaiting_author_confirmation', 'submitted'))
     or (old.status = 'awaiting_author_confirmation'
        and new.status in ('draft', 'submitted'))
     or (old.status = 'revision_required'
        and new.status in ('submitted', 'awaiting_author_confirmation')) then
    return new;
  end if;

  raise exception 'Cannot move a submission from % to %.', old.status, new.status
    using errcode = '42501';
end;
$$;


-- =============================================================================
-- A co-author must hold an active account
-- =============================================================================
-- Not a preference: a co-author without an account can never confirm, so the
-- submission would sit at "awaiting author confirmation" indefinitely. Journal I
-- authors are exempt, since they are backfilled with auth.uid() null.

create or replace function public.guard_authorship_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_account boolean;
begin
  if auth.uid() is null or public.is_school_admin() then
    return new;
  end if;

  if new.person_id = public.current_person_id() then
    return new;
  end if;

  select exists (
    select 1 from public.profiles pr
    where pr.person_id = new.person_id and pr.status = 'active'
  ) into has_account;

  if not has_account then
    raise exception
      'That person does not have an active Research Cell account, so they could never confirm their authorship.'
      using errcode = '42501';
  end if;

  -- Confirmation belongs to the author it names, never to whoever added them.
  new.confirmation_status := 'pending';
  new.confirmed_at := null;
  return new;
end;
$$;


-- =============================================================================
-- Notify a co-author that their confirmation is needed
-- =============================================================================
-- Students cannot write notifications directly -- notifications_leadership_insert
-- is leadership-only -- so this rides on the authorship audit trigger, which
-- already fires on exactly the right event.

create or replace function public.record_authorship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_authorship_changes
      (project_id, person_id, change, actor_id)
    values
      (new.project_id, new.person_id, 'added', auth.uid());

    -- Only co-authors need to be asked; the leader confirmed by starting.
    if new.author_role = 'co_author' and new.confirmation_status <> 'confirmed' then
      insert into public.notifications
        (recipient_id, type, title, body, entity_type, entity_id)
      select pr.id,
             'authorship.confirmation_required',
             'Confirm your authorship',
             'You have been added as an author on a research submission. It cannot go to review until you confirm.',
             'research_project',
             new.project_id
      from public.profiles pr
      where pr.person_id = new.person_id and pr.status = 'active';
    end if;

    return new;
  end if;

  if not exists (
    select 1 from public.research_projects rp where rp.id = old.project_id
  ) then
    return old;
  end if;

  insert into public.research_authorship_changes
    (project_id, person_id, change, actor_id)
  values
    (old.project_id, old.person_id, 'removed', auth.uid());
  return old;
end;
$$;
