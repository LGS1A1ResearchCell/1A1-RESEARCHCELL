-- =============================================================================
-- Authorization primitives
-- =============================================================================
-- Every function here is SECURITY DEFINER with an empty search_path.
--
--   SECURITY DEFINER  -- so a policy can consult user_roles even though RLS is
--                        enabled on user_roles itself, without recursion.
--   search_path = ''  -- so a caller cannot shadow `public` or `auth` with their
--                        own schema and redirect these lookups. Every reference
--                        below is therefore fully qualified.
--
-- Roles are read from the user_roles table, never from JWT claims. A JWT claim
-- is supplied by the client and can be edited; a table row cannot.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- current_person_id
-- -----------------------------------------------------------------------------
create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.person_id from public.profiles p where p.id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- is_active_account
-- -----------------------------------------------------------------------------
-- The single gate that separates accounts which may act from accounts which may
-- only read. A pending sign-up, a suspended account and an alumnus all fail
-- this check, which is what makes alumni read-only.
--
-- If the school later decides alumni retain full access, that policy change is
-- made here, in one place, rather than across forty policies.
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.status = 'active' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- is_school_admin
-- -----------------------------------------------------------------------------
-- Deliberately narrow. This must never be widened to include leadership: it is
-- the check standing between Research Cell leadership and the actions reserved
-- to School Administration -- account approval, suspension, permission changes
-- and journal publication.
create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account() and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'school_admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- is_leadership
-- -----------------------------------------------------------------------------
-- True for Head/Deputy Head of Research AND for School Administration, since
-- administration may do everything leadership may do.
create or replace function public.is_leadership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account() and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('leadership', 'school_admin')
  );
$$;

-- -----------------------------------------------------------------------------
-- is_project_author / is_project_lead
-- -----------------------------------------------------------------------------
-- The per-project Team Leader role lives here rather than in the role system.
-- It grants write access to one project and nothing else.
--
-- Both functions also treat the student who created the project as an
-- author/lead, independently of the research_authors rows. Two reasons:
--
--   1. It matches the specification directly -- the student who starts a team
--      submission *is* the Team Leader, by definition and permanently.
--   2. It resolves a bootstrapping deadlock. Immediately after a project is
--      inserted it has no author rows yet, so a check based purely on
--      research_authors would leave the creator unable to add the very first
--      author, including themselves.
--
-- Backfilled historical projects have created_by null, so the fallback has no
-- effect on the Journal I archive.
create or replace function public.is_project_author(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.research_authors ra
    where ra.project_id = target_project
      and ra.person_id = public.current_person_id()
  ) or exists (
    select 1 from public.research_projects rp
    where rp.id = target_project
      and rp.created_by = auth.uid()
  );
$$;

create or replace function public.is_project_lead(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.research_authors ra
    where ra.project_id = target_project
      and ra.person_id = public.current_person_id()
      and ra.author_role in ('team_leader', 'sole_author')
  ) or exists (
    select 1 from public.research_projects rp
    where rp.id = target_project
      and rp.created_by = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- is_project_public
-- -----------------------------------------------------------------------------
-- Research becomes public exactly when it appears in a journal that School
-- Administration has published. Approval alone does not make it public.
create or replace function public.is_project_public(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.journal_papers jp
    join public.journals j on j.id = jp.journal_id
    where jp.project_id = target_project
      and j.status = 'published'
  );
$$;

-- =============================================================================
-- Column guards
-- =============================================================================
-- Row Level Security decides which rows a user may write, but not which columns
-- within them. These triggers close that gap for the privileged fields.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: status, email and person linkage are administration-only
-- -----------------------------------------------------------------------------
-- Without this, a student permitted to update their own profile row could set
-- their own status from 'pending' to 'active' and self-approve.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only School Administration may change account status.'
        using errcode = '42501';
    end if;
    if new.person_id is distinct from old.person_id then
      raise exception 'A profile cannot be reassigned to a different person.'
        using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email changes must go through account administration.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- -----------------------------------------------------------------------------
-- Journals: publication is School Administration's act alone
-- -----------------------------------------------------------------------------
-- Leadership may create a journal, fill it and submit it for approval. They may
-- not approve it, publish it, or edit one already published. RLS lets them
-- update the row; this decides how far that update may go.
create or replace function public.guard_journal_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_school_admin() then
    return new;
  end if;

  if old.status = 'published' then
    raise exception 'A published journal cannot be edited. Record a correction instead.'
      using errcode = '42501';
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'Only School Administration may publish a journal.'
      using errcode = '42501';
  end if;

  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Only School Administration may approve a journal.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger journals_guard_publication
  before update on public.journals
  for each row execute function public.guard_journal_publication();

-- -----------------------------------------------------------------------------
-- Corrections: recording is leadership's, approving is administration's
-- -----------------------------------------------------------------------------
create or replace function public.guard_correction_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_school_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.approved_by is not null or new.approved_at is not null then
      raise exception 'Only School Administration may approve a correction.'
        using errcode = '42501';
    end if;
  else
    if new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'Only School Administration may approve a correction.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger journal_corrections_guard_approval
  before insert or update on public.journal_corrections
  for each row execute function public.guard_correction_approval();

-- -----------------------------------------------------------------------------
-- Authorship: additions and removals are recorded, always
-- -----------------------------------------------------------------------------
-- The specification requires that authors are never silently added or removed.
-- Making this a trigger rather than an application concern means the record is
-- written even if a future code path forgets to.
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
    return new;
  else
    insert into public.research_authorship_changes
      (project_id, person_id, change, actor_id)
    values
      (old.project_id, old.person_id, 'removed', auth.uid());
    return old;
  end if;
end;
$$;

create trigger research_authors_record_addition
  after insert on public.research_authors
  for each row execute function public.record_authorship_change();

create trigger research_authors_record_removal
  after delete on public.research_authors
  for each row execute function public.record_authorship_change();

-- -----------------------------------------------------------------------------
-- Authorship confirmation: a co-author confirms for themselves only
-- -----------------------------------------------------------------------------
create or replace function public.guard_authorship_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_school_admin() then
    return new;
  end if;

  -- A co-author may change their own confirmation and nothing else.
  if new.person_id = public.current_person_id()
     and not public.is_project_lead(new.project_id) then
    if new.project_id is distinct from old.project_id
       or new.person_id is distinct from old.person_id
       or new.author_role is distinct from old.author_role
       or new.author_order is distinct from old.author_order then
      raise exception 'You may only confirm or decline your own authorship.'
        using errcode = '42501';
    end if;
  end if;

  -- Nobody may hand themselves the team lead role after the fact.
  if new.author_role is distinct from old.author_role
     and new.author_role in ('team_leader', 'sole_author')
     and not public.is_school_admin() then
    raise exception 'The team leader is the student who created the submission and cannot be reassigned here.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger research_authors_guard_confirmation
  before update on public.research_authors
  for each row execute function public.guard_authorship_confirmation();
