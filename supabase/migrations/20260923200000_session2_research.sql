-- =============================================================================
-- Session 2 — the research system
-- =============================================================================
-- Research is now written and published from the CMS. There is no submission,
-- no author confirmation and no review: a paper is a draft until someone with
-- the shared password publishes it, and that is the whole workflow.
--
-- Two consequences drive most of this file:
--
--   1. "Published" stops meaning "in a published journal" and starts meaning
--      what it says — the paper's own status. Journals keep their own archive
--      and are untouched; research simply no longer depends on them to exist
--      publicly.
--
--   2. The CMS needs write access to research. It never had any: every write
--      policy on these tables was scoped to the student who created the row,
--      because that was who used to do the writing.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The academic record a paper carries
-- -----------------------------------------------------------------------------
-- Supervisor and references are new; the rest already existed. Everything is
-- nullable except the title, deliberately: the school has not supplied
-- abstracts, supervisors or references for the Journal I papers, and a NOT NULL
-- column is an instruction to invent them.

alter table public.research_projects
  add column if not exists supervisor       text,
  add column if not exists references_text  text,
  add column if not exists pdf_path         text,
  add column if not exists pdf_filename     text,
  add column if not exists pdf_size_bytes   bigint,
  add column if not exists published_at     timestamptz;

comment on column public.research_projects.supervisor is
  'Free text. A supervisor is a name on a paper, not a person who needs a record in this system or an account in it.';
comment on column public.research_projects.references_text is
  'The reference list as written, one per line. Deliberately unstructured: the school has not specified a citation style, and imposing one would silently rewrite what authors submitted.';
comment on column public.research_projects.pdf_path is
  'Object name in the research-submissions bucket. One current PDF per paper.';

-- Research type and individual/team were compulsory because the old submission
-- form asked for them. They are part of the archive taxonomy, so the columns
-- stay and Journal I keeps its values -- but new research need not claim a type
-- it does not have.
alter table public.research_projects
  alter column research_type   drop not null,
  alter column authorship_mode drop not null;


-- -----------------------------------------------------------------------------
-- 2. Two states, and only two
-- -----------------------------------------------------------------------------
-- The project_status enum still carries the five intermediate states of the
-- retired review workflow. The enum type is shared and dropping values from an
-- enum in place is not possible, so the restriction is expressed as a check
-- constraint instead. It applies to everyone, including the CMS account and the
-- service-role client: "draft or published" is a rule about the data, not about
-- who is writing.

alter table public.research_projects
  drop constraint if exists research_projects_two_states;

alter table public.research_projects
  add constraint research_projects_two_states
  check (status in ('draft', 'published'));

-- The old state machine enforced submission, confirmation and review
-- transitions. All three are gone, and it exempted School Administration
-- anyway, so it now enforces nothing while implying a workflow that does not
-- exist.
drop trigger if exists research_projects_guard_status on public.research_projects;
drop function if exists public.guard_project_status();

-- Papers already in the archive were published when their journal was.
update public.research_projects rp
set published_at = j.published_at
from public.journal_papers jp
join public.journals j on j.id = jp.journal_id
where jp.project_id = rp.id
  and rp.status = 'published'
  and rp.published_at is null
  and j.published_at is not null;


-- -----------------------------------------------------------------------------
-- 3. What "public" means
-- -----------------------------------------------------------------------------
-- Previously: reachable because some journal containing it was published.
-- Now: reachable because it is published. Every policy that already calls
-- is_project_public() -- on research_projects, research_authors and
-- research_versions -- follows automatically.
--
-- The six Journal I papers are already status = 'published', so nothing that is
-- public today stops being public.

create or replace function public.is_project_public(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.research_projects rp
    where rp.id = target_project
      and rp.status = 'published'
  );
$$;

comment on function public.is_project_public is
  'True when a paper is published. Publication is a property of the paper itself; a journal is a collection of papers, not what makes them public.';


-- -----------------------------------------------------------------------------
-- 4. The CMS can write research
-- -----------------------------------------------------------------------------
-- The existing write policies are all scoped to the student who created a row
-- (is_project_lead, created_by = auth.uid()). Under the shared-password CMS
-- there is no such student, so without these the management area can read
-- research and change nothing.
--
-- These grant the CMS account what the school asked it to have and nothing
-- wider: is_school_admin() is false for anonymous visitors, and there are no
-- other accounts.

drop policy if exists research_projects_cms_write on public.research_projects;
create policy research_projects_cms_write
  on public.research_projects
  for all
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());

drop policy if exists research_authors_cms_write on public.research_authors;
create policy research_authors_cms_write
  on public.research_authors
  for all
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());


-- -----------------------------------------------------------------------------
-- 5. What the public site reads
-- -----------------------------------------------------------------------------
-- published_journal_papers still exists and still drives the journal pages.
-- These two views are for research as its own archive, independent of whether a
-- paper has been collected into an issue.

drop view if exists public.published_research;

-- security_invoker keeps Row Level Security in force, so this returns exactly
-- the rows research_projects_public_read already allows.
create view public.published_research
with (security_invoker = true)
as
select
  rp.id,
  rp.title,
  rp.slug,
  rp.abstract,
  rp.research_area,
  rp.supervisor,
  rp.references_text,
  rp.research_type,
  rp.authorship_mode,
  rp.team_name,
  rp.pdf_path,
  rp.pdf_filename,
  rp.published_at,
  s.name  as subject_name,
  ay.label as academic_year
from public.research_projects rp
left join public.subjects s        on s.id  = rp.subject_id
left join public.academic_years ay on ay.id = rp.academic_year_id
where rp.status = 'published';

comment on view public.published_research is
  'The public research archive. security_invoker keeps RLS in force: a draft is not in this view because research_projects_public_read does not return it.';

drop view if exists public.published_research_authors;

-- Owner rights, deliberately, exactly as published_paper_authors is.
--
-- A byline has to render for a visitor even when the author has no public
-- profile -- most authors do not, and a paper with missing names is worse than
-- useless. This is safe because it returns rows only for published papers and
-- exposes the name alone: nothing else about the person crosses this boundary.
create view public.published_research_authors
with (security_invoker = false)
as
select
  ra.project_id,
  ra.author_role,
  ra.author_order,
  pe.full_name
from public.research_authors ra
join public.people pe            on pe.id = ra.person_id
join public.research_projects rp on rp.id = ra.project_id
where rp.status = 'published';

comment on view public.published_research_authors is
  'Bylines for published research. Runs as owner so a name resolves even when the author profile is private, and is safe because it returns rows only for published papers and exposes the name alone.';

grant select on public.published_research          to anon, authenticated;
grant select on public.published_research_authors  to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. PDFs
-- -----------------------------------------------------------------------------
-- PDF is the only accepted format. The bucket previously also allowed Word
-- documents, because students submitted drafts in whatever they wrote in.

update storage.buckets
set allowed_mime_types = array['application/pdf']
where id = 'research-submissions';

-- The bucket stays private. A draft's PDF must be unreachable, and the surest
-- way to guarantee that is for anonymous visitors to have no read access to it
-- at all -- not an unguessable URL, but no permission.
--
-- Published research is different: its PDF is meant to be read. This policy
-- gives anonymous visitors read access to exactly those objects, which is what
-- lets the public page mint a signed URL for them. Unpublish a paper and the
-- permission disappears with it.
create or replace function public.research_pdf_is_public(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  -- Objects are stored as "<project id>/<file>". Anything else is not a
  -- research PDF and is not readable by this route.
  begin
    v_project := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.is_project_public(v_project);
end;
$$;

comment on function public.research_pdf_is_public is
  'True when a storage object belongs to a published paper. Used by the storage policy so that publishing a paper is what makes its PDF readable, and nothing else.';

drop policy if exists "published research pdfs are readable" on storage.objects;
create policy "published research pdfs are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'research-submissions'
    and public.research_pdf_is_public(name)
  );


-- -----------------------------------------------------------------------------
-- 7. Adding an author
-- -----------------------------------------------------------------------------
-- An author is a person in the record, not an account. Naming one on a paper
-- may mean creating that person, and the slug has to be unique -- which is what
-- this helper already does. It was callable only by the service role, because
-- previously only the approval flow created people.
--
-- Only the CMS can insert into people (people_admin_write), so this grant
-- widens nothing: it lets the account that is already allowed to add a person
-- compute the slug for them.

grant execute on function public.generate_person_slug(text) to authenticated;


-- -----------------------------------------------------------------------------
-- 8. The CMS can upload a PDF
-- -----------------------------------------------------------------------------
-- The only INSERT policy on this bucket was "the team leader uploads research
-- files", scoped to the student who led a submission. Under the shared-password
-- CMS nobody is that student, so uploading failed with a row-level security
-- error while the interface reported only that the upload had not worked.
--
-- The same gap as the table policies above, in the storage layer.

drop policy if exists "the cms manages research pdfs" on storage.objects;
create policy "the cms manages research pdfs"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'research-submissions' and public.is_school_admin())
  with check (bucket_id = 'research-submissions' and public.is_school_admin());
