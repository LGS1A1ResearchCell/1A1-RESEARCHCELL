-- =============================================================================
-- Phase 6 — journals, approval and the public archive
-- =============================================================================
-- The journal tables existed from Phase 1. What was missing was the workflow
-- around them. Eight gaps, each confirmed against the running database before
-- this was written:
--
--   1. Unapproved research could be put into a journal. A draft could have been
--      published.
--   2. A published journal's contents were still editable. journal_papers and
--      journal_credits had no status check, so papers could be added to or
--      removed from a published issue silently -- which the specification
--      forbids outright.
--   3. Publishing a journal did not mark its papers published. Phase 5 already
--      says research becomes published "through the journal workflow"; nothing
--      actually did it.
--   4. An empty journal could be submitted and published.
--   5. The status sequence was unenforced: leadership could move a journal
--      anywhere short of publishing it.
--   6. Journal assets had no journal scoping, so leadership could replace a
--      PUBLISHED journal's PDF.
--   7. One paper could appear in several journals.
--   8. Bylines would not resolve. A student approved through the Phase 2 flow
--      has is_public=false, so their name would be blank on the public journal
--      page -- a journal with anonymous authors. Journal I only works today
--      because its people were seeded public.
--
-- School Administration keeps the override it has everywhere else in this
-- system. That is a continuation of the pattern from Phases 2 to 5, not a new
-- licence: publishing still requires an approval to be recorded.
-- =============================================================================


-- =============================================================================
-- Helpers
-- =============================================================================

create or replace function public.journal_is_open(p_journal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select j.status <> 'published' from public.journals j where j.id = p_journal),
    false
  );
$$;

revoke all on function public.journal_is_open(uuid) from public, anon;
grant execute on function public.journal_is_open(uuid) to authenticated, service_role;


-- =============================================================================
-- One journal per paper
-- =============================================================================
-- A paper belongs in one issue of the archive. Appearing twice would double it
-- in the public record and make "which journal published this?" unanswerable.

create unique index journal_papers_one_journal_per_paper
  on journal_papers (project_id);


-- =============================================================================
-- Only approved research, and only while the journal is open
-- =============================================================================

create or replace function public.guard_journal_papers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal uuid;
  v_status  public.project_status;
begin
  v_journal := coalesce(new.journal_id, old.journal_id);

  -- Migrations, seeds and the service-role client.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- A published issue is closed. Corrections are recorded separately, which is
  -- what keeps the historical record honest.
  if not public.journal_is_open(v_journal) then
    raise exception
      'This journal has been published and its contents cannot be changed. Record a correction instead.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Only research the Research Cell has actually approved may be included.
  select status into v_status
  from public.research_projects where id = new.project_id;

  if v_status is null then
    raise exception 'That research does not exist.' using errcode = 'P0002';
  end if;

  if v_status not in ('approved', 'published') then
    raise exception
      'Only approved research can be added to a journal. This paper is %.', v_status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger journal_papers_guard
  before insert or update or delete on public.journal_papers
  for each row execute function public.guard_journal_papers();


-- =============================================================================
-- The masthead is frozen once published
-- =============================================================================
-- journal_credits was already independent of the leadership table so a change
-- of Head could not rewrite Journal I's masthead. This closes the other route:
-- editing the credits directly after publication.

create or replace function public.guard_journal_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal uuid;
begin
  v_journal := coalesce(new.journal_id, old.journal_id);

  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if not public.journal_is_open(v_journal) then
    raise exception
      'This journal has been published and its credits cannot be changed. Record a correction instead.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger journal_credits_guard
  before insert or update or delete on public.journal_credits
  for each row execute function public.guard_journal_credits();


-- =============================================================================
-- The journal status sequence
-- =============================================================================
--   draft  ->  pending_admin_approval  ->  published
--
-- Leadership create the journal, fill it and submit it. They cannot approve or
-- publish it; that is School Administration's act, and it is what the
-- specification means by "publication requires School Administration approval".
--
-- Submitting requires at least one paper: an empty journal is not a journal.
--
-- School Administration is exempt from the sequence, as it is from every other
-- workflow in this system. It is not exempt from the substance: publishing
-- still records an approval and still requires contents.

create or replace function public.guard_journal_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papers integer;
begin
  -- Migrations, seeds and the service-role client.
  if auth.uid() is null then
    return new;
  end if;

  select count(*) into v_papers
  from public.journal_papers jp where jp.journal_id = new.id;

  if public.is_school_admin() then
    -- An approval recorded through the application must name its approver.
    if new.approved_at is not null and new.approved_by is null then
      raise exception 'An approval recorded through the application must name the approver.'
        using errcode = '42501';
    end if;
    -- Even an administrator does not publish an empty journal.
    if new.status = 'published' and old.status is distinct from 'published'
       and v_papers = 0 then
      raise exception 'A journal cannot be published with no papers in it.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- ---------------------------------------------------------------- leadership
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

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'pending_admin_approval' then
      if v_papers = 0 then
        raise exception 'Add at least one approved paper before submitting this journal for approval.'
          using errcode = '42501';
      end if;
      new.submitted_for_approval_by := auth.uid();
      new.submitted_for_approval_at := now();
    elsif old.status = 'pending_admin_approval' and new.status = 'draft' then
      -- Withdrawing a submission, so it can be worked on again.
      new.submitted_for_approval_by := null;
      new.submitted_for_approval_at := null;
    else
      raise exception 'Cannot move a journal from % to %.', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- =============================================================================
-- Publishing a journal publishes its papers
-- =============================================================================
-- Phase 5 refuses to let anyone set a paper to 'published' directly, on the
-- grounds that it happens "through the journal workflow". This is that
-- workflow. Every author is told, and the act is audited.

create or replace function public.apply_journal_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  update public.research_projects rp
     set status = 'published'
   from public.journal_papers jp
  where jp.journal_id = new.id
    and rp.id = jp.project_id
    and rp.status <> 'published';

  insert into public.notifications
    (recipient_id, type, title, body, entity_type, entity_id)
  select distinct pr.id,
         'journal.published',
         'Your research has been published',
         'Your research appears in ' || new.title || ', now published in the public archive.',
         'journal', new.id
  from public.journal_papers jp
  join public.research_authors ra on ra.project_id = jp.project_id
  join public.profiles pr on pr.person_id = ra.person_id
  where jp.journal_id = new.id and pr.status = 'active';

  insert into public.activity_log
    (actor_id, action, entity_type, entity_id, metadata)
  values
    (auth.uid(), 'journal.published', 'journal', new.id,
     jsonb_build_object('title', new.title,
       'papers', (select count(*) from public.journal_papers jp where jp.journal_id = new.id)));

  return new;
end;
$$;

create trigger journals_apply_publication
  after update on public.journals
  for each row execute function public.apply_journal_publication();


-- =============================================================================
-- Journal assets are scoped to their journal, and frozen once published
-- =============================================================================
-- Path convention, mirroring research submissions:
--     journal-covers/<journal_id>/<filename>
--     journal-pdfs/<journal_id>/<filename>
--
-- Without this, leadership could replace the PDF of a published journal, which
-- is exactly the silent editing the specification rules out.

create or replace function public.journal_asset_writable(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_status public.journal_status;
begin
  begin
    v_id := p_folder::uuid;
  exception when others then
    return false;      -- not a journal-scoped path
  end;

  select status into v_status from public.journals where id = v_id;
  if v_status is null then
    return false;
  end if;

  -- Administration may correct an asset even after publication; leadership may
  -- not touch a published issue at all.
  return v_status <> 'published' or public.is_school_admin();
end;
$$;

revoke all on function public.journal_asset_writable(text) from public, anon;
grant execute on function public.journal_asset_writable(text) to authenticated, service_role;

drop policy if exists "leadership uploads journal assets" on storage.objects;
drop policy if exists "leadership replaces journal assets" on storage.objects;
drop policy if exists "administration deletes journal assets" on storage.objects;

create policy "leadership uploads journal assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_leadership()
    and public.journal_asset_writable((storage.foldername(name))[1])
  );

create policy "leadership replaces journal assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_leadership()
    and public.journal_asset_writable((storage.foldername(name))[1])
  );

-- Deletion stays administration's: removing the PDF of a published journal
-- would break the public archive. The application removes a superseded cover
-- when it is replaced, which is the only routine deletion.
create policy "administration deletes journal assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_school_admin()
  );

-- Leadership may remove an asset they just replaced, but only on an open
-- journal, so a published issue keeps everything it was published with.
create policy "leadership removes assets from an open journal"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_leadership()
    and public.journal_asset_writable((storage.foldername(name))[1])
  );


-- =============================================================================
-- Public bylines
-- =============================================================================
-- A journal names its authors. That is what a journal is, and the
-- specification says so: individual journals contain their papers and authors.
--
-- Author names cannot come from the `people` table directly, because a student
-- approved through the Phase 2 flow has is_public = false by default -- their
-- profile is private until School Administration publishes it, which is the
-- Phase 3 decision and stays untouched. Reading names through that table would
-- give a published journal blank authors.
--
-- This view therefore runs as its owner rather than the caller. That is safe
-- because of what it selects, not because of who calls it: it joins through
-- journal_papers to journals and returns rows ONLY where the journal is
-- published. It cannot expose an unpublished paper, an unpublished journal, or
-- anything about a person beyond the name printed on work already in the public
-- archive. No photograph, quote, class or year joined -- those remain governed
-- by is_public and by the Phase 3 rule that only administration may publish a
-- profile.

create or replace view public.published_paper_authors
with (security_invoker = false)
as
select
  jp.journal_id,
  ra.project_id,
  ra.author_role,
  ra.author_order,
  pe.full_name,
  pe.is_public as profile_is_public,
  pe.slug      as profile_slug
from public.journal_papers jp
join public.journals j          on j.id = jp.journal_id and j.status = 'published'
join public.research_authors ra on ra.project_id = jp.project_id
join public.people pe           on pe.id = ra.person_id;

comment on view public.published_paper_authors is
  'Bylines for research already in the public archive. Runs as owner so a name resolves even when the author profile is private, and is safe because it returns rows only for papers in a published journal. Exposes the name alone: photograph, quote, class and year joined remain governed by people.is_public.';

grant select on public.published_paper_authors to anon, authenticated;


-- =============================================================================
-- Public journal contents
-- =============================================================================
-- The archive page needs a journal's papers with their ordering and page
-- numbers. security_invoker here, since research_projects already has a public
-- read policy for published work and RLS gives exactly the right answer.

create or replace view public.published_journal_papers
with (security_invoker = true)
as
select
  jp.journal_id,
  jp.project_id,
  jp.display_order,
  jp.start_page,
  jp.end_page,
  rp.title,
  rp.slug,
  rp.abstract,
  rp.research_type,
  rp.authorship_mode,
  rp.team_name,
  rp.research_area,
  s.name as subject_name
from public.journal_papers jp
join public.journals j on j.id = jp.journal_id and j.status = 'published'
join public.research_projects rp on rp.id = jp.project_id
left join public.subjects s on s.id = rp.subject_id;

grant select on public.published_journal_papers to anon, authenticated;
