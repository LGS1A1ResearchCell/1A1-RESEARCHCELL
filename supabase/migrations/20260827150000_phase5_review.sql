-- =============================================================================
-- Phase 5 — the review system
-- =============================================================================
-- The review machinery already existed: decisions limited to revision_required
-- and approved, feedback mandatory on a revision, reviews append-only, feedback
-- held apart from the student's document. What was missing was everything that
-- makes a review *mean* something.
--
-- Four gaps, each confirmed against the running database before this was
-- written:
--
--   1. A student could upload a new version to an APPROVED paper. What
--      leadership approved need not be what reached the journal.
--   2. Leadership could approve their own research. Not hypothetical: Journal
--      I's Editor-in-Chief is also an author in that issue.
--   3. One version could carry several contradictory decisions at once.
--   4. A review did not move the paper. A "revision required" decision could
--      sit against a paper still showing as submitted.
--
-- All four are closed here.
-- =============================================================================


-- =============================================================================
-- One decision per version
-- =============================================================================
-- A version receives exactly one recorded decision, which is what the
-- specification's own example describes: version 1 revision, version 2
-- revision, version 3 approved. Another look at the work requires the student
-- to submit another version, which is the honest way to record it.

alter table reviews add constraint reviews_one_per_version unique (version_id);

comment on constraint reviews_one_per_version on reviews is
  'A version carries a single decision. Reviewing again means reviewing a new version, so contradictory decisions can never stand side by side.';


-- =============================================================================
-- Who may review, and what they may review
-- =============================================================================
-- Nobody reviews their own work. This applies to everyone, School
-- Administration included: if a reviewer is named as an author, someone else
-- decides. With a Head and a Deputy the other one reviews; if both are authors,
-- administration does.
--
-- Note this is checked against research_authors rather than against who
-- submitted, so a co-author who took no part in writing still cannot review the
-- paper their name is on.

create or replace function public.guard_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_status  public.project_status;
  v_person  uuid;
begin
  select rv.project_id into v_project
  from public.research_versions rv
  where rv.id = new.version_id;

  if v_project is null then
    raise exception 'That version of the research does not exist.'
      using errcode = 'P0002';
  end if;

  -- Migrations, seeds and the service-role client, which already bypass RLS.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_leadership() then
    raise exception 'Only Research Cell leadership may review research.'
      using errcode = '42501';
  end if;

  -- Nobody reviews research they are an author of.
  v_person := public.current_person_id();
  if v_person is not null and exists (
    select 1 from public.research_authors ra
    where ra.project_id = v_project and ra.person_id = v_person
  ) then
    raise exception
      'You are an author of this research and cannot review it. Another reviewer must decide this submission.'
      using errcode = '42501';
  end if;

  -- Only work that has actually been submitted is reviewable. A draft, a
  -- submission still gathering author confirmations, and an already-published
  -- paper are all out of scope.
  select status into v_status
  from public.research_projects where id = v_project;

  if v_status not in ('submitted', 'under_review') then
    raise exception 'This submission is not currently open for review (it is %).', v_status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger reviews_guard
  before insert on public.reviews
  for each row execute function public.guard_review();


-- =============================================================================
-- A review moves the paper, notifies its authors, and is audited
-- =============================================================================
-- Recording a decision and changing the paper's state are one action, so the
-- two can never disagree. The reviewer does one thing; everything that follows
-- from it happens with it.
--
-- The status update below re-enters guard_project_status as the same caller, so
-- the transition is still checked: only leadership can reach these states, and
-- only from a reviewable one.

create or replace function public.apply_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_title   text;
begin
  select rv.project_id into v_project
  from public.research_versions rv where rv.id = new.version_id;

  select title into v_title
  from public.research_projects where id = v_project;

  if new.decision = 'approved' then
    update public.research_projects
       set status = 'approved', approved_at = now()
     where id = v_project;
  else
    update public.research_projects
       set status = 'revision_required'
     where id = v_project;
  end if;

  -- Every author is told, not only the Team Leader: the decision concerns work
  -- they are all named on.
  insert into public.notifications
    (recipient_id, type, title, body, entity_type, entity_id)
  select pr.id,
         case when new.decision = 'approved'
              then 'research.approved' else 'research.revision_required' end,
         case when new.decision = 'approved'
              then 'Your research has been approved'
              else 'A revision has been requested' end,
         case when new.decision = 'approved'
              then 'The Research Cell has approved "' || v_title || '".'
              else 'The Research Cell has asked for a revision to "' || v_title ||
                   '". The reviewer''s feedback is on your submission.' end,
         'research_project', v_project
  from public.research_authors ra
  join public.profiles pr on pr.person_id = ra.person_id
  where ra.project_id = v_project and pr.status = 'active';

  insert into public.activity_log
    (actor_id, action, entity_type, entity_id, metadata)
  values
    (auth.uid(),
     case when new.decision = 'approved'
          then 'research.approved' else 'research.revision_requested' end,
     'research_project', v_project,
     jsonb_build_object('review_id', new.id, 'version_id', new.version_id));

  return new;
end;
$$;

create trigger reviews_apply_decision
  after insert on public.reviews
  for each row execute function public.apply_review_decision();


-- =============================================================================
-- An approved paper cannot be quietly changed
-- =============================================================================
-- add_research_version checked authorship but not the state of the project, so
-- a student could add a version after approval and change what had been
-- approved. It now refuses once the work is approved or published.
--
-- Corrections before publication remain possible: leadership can reopen an
-- approved paper for revision, which allows uploads again and requires a fresh
-- review. That path is added to the status machine below.

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
  v_next   integer;
  v_status public.project_status;
begin
  if not public.is_active_account() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  if not public.is_project_lead(p_project_id) then
    raise exception 'Only the Team Leader may upload a document for this submission.'
      using errcode = '42501';
  end if;

  select status into v_status
  from public.research_projects where id = p_project_id for update;

  if v_status is null then
    raise exception 'That submission does not exist.' using errcode = 'P0002';
  end if;

  if v_status in ('approved', 'published') then
    raise exception
      'This research has already been approved and cannot be changed. Ask Research Cell leadership to reopen it if a correction is needed.'
      using errcode = '42501';
  end if;

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
-- Reopening an approved paper
-- =============================================================================
-- The one route back out of 'approved', available to leadership only and only
-- as far as 'revision_required'. The approval timestamp is cleared with it: the
-- earlier approval no longer stands, and a fresh review is required before the
-- paper is approved again. The review that granted the original approval
-- remains in the history, attached to the version it judged.

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

    -- Reopening an approved paper for a further revision, before publication.
    if old.status = 'approved' and new.status = 'revision_required' then
      new.approved_at := null;
      return new;
    end if;
  end if;

  if old.status = 'approved' then
    raise exception 'Approved research can only be reopened by Research Cell leadership.'
      using errcode = '42501';
  end if;

  if not public.is_project_lead(new.id) then
    raise exception 'Only the Team Leader may change the status of this submission.'
      using errcode = '42501';
  end if;

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
-- Review history
-- =============================================================================
-- The permanent record the specification asks for: version, date, reviewer,
-- decision, feedback, in one place rather than reassembled by every page that
-- needs it.
--
-- security_invoker keeps Row Level Security in force, so this shows an author
-- the reviews of their own work, shows leadership everything, and shows an
-- anonymous visitor nothing at all.
--
-- The reviewer's name needs one narrow exception. Under security_invoker the
-- join runs as the caller, and a student cannot read `profiles` -- so an author
-- saw their feedback with the reviewer blank, which the specification requires
-- to be shown. The lookup below is therefore SECURITY DEFINER, and only the
-- lookup: WHICH reviews the caller sees is still decided entirely by RLS on
-- `reviews`, so an anonymous visitor gets no rows and a student gets only the
-- reviews of their own work. The elevation resolves a name for a row the caller
-- was already entitled to read.

create or replace function public.reviewer_display_name(p_profile uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pe.full_name
  from public.profiles pr
  join public.people pe on pe.id = pr.person_id
  where pr.id = p_profile;
$$;

revoke all on function public.reviewer_display_name(uuid) from public, anon;
grant execute on function public.reviewer_display_name(uuid) to authenticated;

create or replace view public.research_review_history
with (security_invoker = true)
as
select
  r.id            as review_id,
  rv.project_id,
  rv.version_number,
  rv.document_filename,
  rv.submitted_at as version_submitted_at,
  r.decision,
  r.feedback,
  r.created_at    as reviewed_at,
  public.reviewer_display_name(r.reviewer_id) as reviewer_name
from public.reviews r
join public.research_versions rv on rv.id = r.version_id;

comment on view public.research_review_history is
  'Permanent review history: version, date, reviewer, decision and feedback. security_invoker keeps RLS in force, so it discloses exactly what the underlying policies already allow.';

grant select on public.research_review_history to authenticated;
