-- =============================================================================
-- Phase 1 fixes — D1 to D7
-- =============================================================================
-- Seven defects found by testing the schema against the real database and the
-- real Journal I data. Each section states the defect, then the fix.
--
-- A note on `auth.uid() is null`, which recurs below. That condition is true
-- for migrations, seeds and the service-role client — contexts that already
-- bypass Row Level Security entirely and are server-side only. The guards here
-- exempt it so that historical backfill remains possible; it grants a caller
-- nothing they did not already have.
-- =============================================================================


-- =============================================================================
-- D1 — TRUNCATE, TRIGGER and REFERENCES were granted to anon and authenticated
-- =============================================================================
-- Supabase grants ALL on public tables to the client roles by default, and ALL
-- includes TRUNCATE. Row Level Security does not apply to TRUNCATE: privilege
-- is the only control. Anyone holding the publishable key — which ships to
-- every browser — could therefore empty any table, including reviews and the
-- audit log, regardless of policy.
--
-- No REST client needs any of these three. TRIGGER and REFERENCES are revoked
-- alongside TRUNCATE because they are equally unnecessary and equally
-- schema-altering.

revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;

-- Future tables must not inherit them either. This applies to objects created
-- by the role running migrations, which is the role that creates every table
-- in this schema.
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;


-- =============================================================================
-- D7 — set_updated_at had a mutable search_path
-- =============================================================================
-- Not exploitable, since the body resolves only now() from pg_catalog, but it
-- is inconsistent with the twelve authorization functions and is flagged by
-- Supabase's own linter. It stays SECURITY INVOKER: it needs no elevated
-- rights, and a trigger that only stamps NEW should not have any.

alter function public.set_updated_at() set search_path = '';


-- =============================================================================
-- D5 — historical journals could not be represented
-- =============================================================================
-- `journals_approved_consistently` required approved_by whenever approved_at
-- was set, and approved_by references profiles. Journal I was published before
-- this system existed and its people hold no accounts, so it could not be
-- stored at all.
--
-- The constraint is relaxed in one direction only: an approver still implies a
-- timestamp, but a timestamp may stand without an in-system approver. That is
-- the historical case and nothing else.
--
-- The requirement for new approvals is NOT weakened. It moves into
-- guard_journal_publication below, which now requires a live approver to
-- identify themselves — so the only route to an approver-less approval is a
-- server-side backfill.

alter table journals drop constraint journals_approved_consistently;

alter table journals add constraint journals_approved_consistently
  check (approved_by is null or approved_at is not null);

comment on constraint journals_approved_consistently on journals is
  'An approver implies an approval timestamp. The reverse is deliberately not required: a journal published before this system existed has an approval date but no in-system approver. New approvals are held to the stricter rule by guard_journal_publication.';


-- =============================================================================
-- D6 — a research project could never be deleted
-- =============================================================================
-- Deleting a project cascaded to research_authors, which fired the authorship
-- audit trigger, which inserted a row whose foreign key pointed at the project
-- being removed. The delete always failed, making the
-- research_projects_lead_delete_draft policy dead code: students could not
-- discard their own unsubmitted drafts.
--
-- Two changes, both needed. The trigger stops recording a removal when the
-- parent project is itself going away — there is no longer anything for the
-- record to describe. The foreign key cascades so that any rows already
-- written disappear with the project.
--
-- Append-only behaviour is unchanged for projects that still exist: the skip
-- applies only when the project row is already gone.

alter table research_authorship_changes
  drop constraint research_authorship_changes_project_id_fkey;

alter table research_authorship_changes
  add constraint research_authorship_changes_project_id_fkey
  foreign key (project_id) references research_projects (id) on delete cascade;

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
  end if;

  -- DELETE. If the project itself is being removed, this row is disappearing
  -- as part of that removal rather than being an authorship decision, and
  -- there is no surviving project for the record to reference.
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


-- =============================================================================
-- D3 (part 1) — authorship confirmation could be given by the wrong person
-- =============================================================================
-- The previous guard only constrained a person editing their own row. A Team
-- Leader could therefore edit a co-author's row and mark them confirmed,
-- which defeats the entire point of author confirmation.
--
-- The rule is now stated directly: confirmation_status belongs to the author
-- it describes. Everything else about an authorship row — ordering, role —
-- belongs to the Team Leader.

create or replace function public.guard_authorship_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_person uuid;
begin
  -- Migrations, seeds and the service-role client.
  if auth.uid() is null then
    return new;
  end if;

  -- School Administration retains an administrative override.
  if public.is_school_admin() then
    return new;
  end if;

  actor_person := public.current_person_id();

  -- Confirmation may only be given or withdrawn by the author themselves.
  if new.confirmation_status is distinct from old.confirmation_status
     and new.person_id is distinct from actor_person then
    raise exception 'Authorship can only be confirmed by the author it names.'
      using errcode = '42501';
  end if;

  -- A co-author may change nothing except their own confirmation.
  if new.person_id = actor_person and not public.is_project_lead(new.project_id) then
    if new.project_id  is distinct from old.project_id
       or new.person_id    is distinct from old.person_id
       or new.author_role  is distinct from old.author_role
       or new.author_order is distinct from old.author_order then
      raise exception 'You may only confirm or decline your own authorship.'
        using errcode = '42501';
    end if;
  end if;

  -- Everything other than confirmation is the Team Leader's to change.
  if (new.author_role  is distinct from old.author_role
      or new.author_order is distinct from old.author_order)
     and not public.is_project_lead(new.project_id) then
    raise exception 'Only the Team Leader may change authorship details.'
      using errcode = '42501';
  end if;

  -- The team lead role is fixed at creation and cannot be reassigned here.
  if new.author_role is distinct from old.author_role
     and new.author_role in ('team_leader', 'sole_author') then
    raise exception 'The Team Leader is the student who created the submission and cannot be reassigned.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- D3 (part 2) — confirmation could also be forged at INSERT time
-- -----------------------------------------------------------------------------
-- The guard above covers UPDATE. Without this, a Team Leader could simply add
-- a co-author with confirmation_status already set to 'confirmed' and never
-- ask them at all.
--
-- Rather than raise — which would make a natural bulk insert of a team fail —
-- the value is coerced. A leader adding co-authors gets exactly what the
-- workflow intends: pending rows awaiting each author's own confirmation.

create or replace function public.guard_authorship_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_school_admin() then
    return new;
  end if;

  -- Authors may record their own confirmation as they create their row; this
  -- is how the Team Leader is confirmed on creating the submission.
  if new.person_id = public.current_person_id() then
    return new;
  end if;

  new.confirmation_status := 'pending';
  new.confirmed_at := null;
  return new;
end;
$$;

create trigger research_authors_guard_insert
  before insert on public.research_authors
  for each row execute function public.guard_authorship_insert();


-- =============================================================================
-- D2 + D3 (part 3) — project status was writable to any value by the author
-- =============================================================================
-- research_projects_lead_update allowed the Team Leader to write any column,
-- status included. A student could set their own paper to 'approved', which is
-- the single most important boundary in the review system.
--
-- Row Level Security decides which rows may be written, never which values.
-- The status machine therefore has to be a trigger.
--
-- Intended workflow:
--
--   draft
--     -> awaiting_author_confirmation   (team work)
--     -> submitted                      (individual work)
--   awaiting_author_confirmation
--     -> submitted                      ONLY once every author has confirmed
--     -> draft                          (withdraw)
--   submitted        -> under_review | revision_required | approved   (leadership)
--   under_review     -> revision_required | approved                  (leadership)
--   revision_required-> submitted | awaiting_author_confirmation      (author)
--                    -> under_review                                  (leadership)
--   published        reached only through the journal workflow
--
-- Publication is deliberately absent from every author and leadership path. A
-- paper becomes public by appearing in a journal that School Administration
-- has published, which is a separate workflow on the journals table.

create or replace function public.unconfirmed_author_count(target_project uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.research_authors ra
  where ra.project_id = target_project
    and ra.confirmation_status <> 'confirmed';
$$;

create or replace function public.guard_project_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_lead   boolean;
  unconfirmed integer;
begin
  -- Migrations, seeds and the service-role client.
  if auth.uid() is null then
    return new;
  end if;

  -- School Administration retains an administrative override.
  if public.is_school_admin() then
    return new;
  end if;

  is_lead := public.is_leadership();

  -- ---------------------------------------------------------------------
  -- INSERT: a new project always starts as a draft.
  -- Without this the whole status machine could be skipped by choosing the
  -- final status at creation time.
  -- ---------------------------------------------------------------------
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new research project must start as a draft.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- No status change: nothing here to police.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- ---------------------------------------------------------------------
  -- Publication is not reachable from this table.
  -- ---------------------------------------------------------------------
  if new.status = 'published' then
    raise exception 'Research becomes published through the journal workflow, not directly.'
      using errcode = '42501';
  end if;

  if old.status = 'published' then
    raise exception 'Published research cannot be moved out of the archive.'
      using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------------
  -- Review outcomes belong to Research Cell leadership.
  -- ---------------------------------------------------------------------
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

  -- ---------------------------------------------------------------------
  -- Author-driven transitions.
  -- ---------------------------------------------------------------------
  if not public.is_project_lead(new.id) then
    raise exception 'Only the Team Leader may change the status of this submission.'
      using errcode = '42501';
  end if;

  -- Every author must have confirmed before the work can reach review. This
  -- covers team work reaching 'submitted' by ANY route, not merely the one
  -- transition out of awaiting_author_confirmation.
  if new.status = 'submitted' and new.authorship_mode = 'team' then
    unconfirmed := public.unconfirmed_author_count(new.id);
    if unconfirmed > 0 then
      raise exception
        'This submission still has % author(s) awaiting confirmation and cannot proceed to review.',
        unconfirmed
        using errcode = '42501';
    end if;
  end if;

  -- Team work must pass through author confirmation rather than skipping it.
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

create trigger research_projects_guard_status
  before insert or update on public.research_projects
  for each row execute function public.guard_project_status();


-- =============================================================================
-- D4 — insert().select() failed on every insert
-- =============================================================================
-- research_projects_author_read tested is_project_author(id). That function is
-- STABLE and queries research_projects, so during INSERT ... RETURNING it
-- cannot see the row being written. The insert succeeded and the read-back was
-- refused, surfacing as a 403 on the ordinary Supabase client call
-- .insert().select().
--
-- The fix is to give each policy a direct column predicate, which is evaluated
-- against the new row itself rather than through a snapshot-bound subquery.
--
-- Audited across the schema for the same self-referential shape:
--
--   research_projects_author_read  is_project_author -> research_projects   FIXED
--   research_authors_author_read   is_project_author -> research_authors    FIXED
--   user_roles_admin_write         is_school_admin   -> user_roles          safe:
--       resolves the ACTOR's existing row, never the row being inserted
--   reviews_author_read            -> research_versions   different table, safe
--   research_versions_*            -> research_authors    different table, safe
--   journal_papers / credits       -> journals            different table, safe
--   people_self_read               -> profiles            different table, safe

alter policy research_projects_author_read on research_projects
  using (created_by = auth.uid() or is_project_author(id));

alter policy research_authors_author_read on research_authors
  using (person_id = current_person_id() or is_project_author(project_id));


-- =============================================================================
-- D5 (continued) — keep new approvals strict
-- =============================================================================
-- With the constraint relaxed for historical records, the requirement that a
-- real approval names a real approver moves here, where a live session exists
-- to be checked.

create or replace function public.guard_journal_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Migrations, seeds and the service-role client.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_school_admin() then
    -- An approval recorded through the application must identify its approver.
    -- The relaxed table constraint exists for historical backfill only.
    if new.approved_at is not null and new.approved_by is null then
      raise exception 'An approval recorded through the application must name the approver.'
        using errcode = '42501';
    end if;
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
