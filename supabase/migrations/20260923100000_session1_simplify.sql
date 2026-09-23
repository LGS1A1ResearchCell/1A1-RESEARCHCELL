-- =============================================================================
-- Session 1 — simplify toward "public site + one password-protected CMS"
-- =============================================================================
-- The school has decided there will be no student accounts and no individual
-- logins. The private management area becomes a single shared-password CMS
-- used by Research Cell leadership and School Administration.
--
-- This migration does only what is safe and clearly required by that decision:
--
--   1. Remove people photographs entirely, including the storage bucket that
--      existed solely to hold them.
--   2. Close student registration, which no longer leads anywhere.
--
-- It deliberately does NOT drop the accounts, roles or research-workflow
-- tables. They hold the Journal I record and the audit trail, the CMS still
-- authenticates through Supabase Auth so those policies remain the enforcement
-- layer, and removing them is neither safe nor required yet.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. People photographs
-- -----------------------------------------------------------------------------
-- The new system does not use photographs of people at all. Dropping the
-- columns rather than leaving them unused means nothing can write a photograph
-- back in later by accident, and the safeguarding question of whose face
-- appears on a public school site simply stops existing.

-- The public directory selects the photo columns, so it has to go first. It is
-- recreated below without them.
drop view if exists public.public_researchers;

alter table public.people
  drop column if exists photo_path cascade,
  drop column if exists photo_focal_x cascade,
  drop column if exists photo_focal_y cascade;

-- security_invoker means the view is evaluated with the caller's own rights, so
-- people_public_read still applies and an anonymous visitor sees only public
-- profiles. Without it a view would run as its owner and quietly bypass RLS.
create view public.public_researchers
with (security_invoker = true)
as
select
  pe.id,
  pe.full_name,
  pe.slug,
  pe.kind,
  pe.class_section,
  pe.year_joined,
  pe.quote,
  (
    select count(*)
    from public.research_authors ra
    join public.journal_papers jp on jp.project_id = ra.project_id
    join public.journals j on j.id = jp.journal_id
    where ra.person_id = pe.id and j.status = 'published'
  ) as published_paper_count
from public.people pe
where pe.is_public;

comment on view public.public_researchers is
  'Public People directory. security_invoker keeps Row Level Security in force, so this exposes exactly the rows people_public_read already allows. Carries no photograph: the system does not store images of people.';

-- The column guard still blocks visibility and identity changes. Only its
-- description changes, because presentation no longer includes a photograph.
comment on function public.guard_people_columns is
  'Row Level Security decides which rows may be written, not which columns. This leaves visibility and identity to School Administration. The system stores no photographs of people.';

-- The bucket existed only for these photographs. Dropping its policies here
-- closes every write path to it immediately, whatever happens to the bucket.
drop policy if exists "profile photos are publicly readable" on storage.objects;
drop policy if exists "a student manages their own photo"    on storage.objects;
drop policy if exists "a student replaces their own photo"   on storage.objects;
drop policy if exists "a student removes their own photo"    on storage.objects;
drop policy if exists "administration manages any photo"     on storage.objects;

-- Supabase refuses direct deletes on storage.objects and storage.buckets, so
-- the objects and the bucket itself are removed through the Storage API rather
-- than here. See docs/HANDOVER.md; the policies above are what stop anything
-- writing to the bucket in the meantime.

-- The other five buckets are untouched: they hold research documents, journal
-- PDFs, covers and resource files, none of which are affected by this decision.


-- -----------------------------------------------------------------------------
-- 2. Student registration
-- -----------------------------------------------------------------------------
-- submit_account_request() is SECURITY DEFINER and was executable by anonymous
-- visitors, because that is how a student applied for an account. With no
-- student accounts the endpoint leads nowhere, and leaving it callable would
-- leave a queue that can be filled by anyone with the publishable key and the
-- API URL -- both of which are public by design.
--
-- The account_requests table and its existing rows are kept. They are part of
-- the record of what happened, and this migration deletes no history.

revoke execute on function public.submit_account_request(
  text, text, public.class_section, integer
) from anon, authenticated;

comment on function public.submit_account_request is
  'Retired in Session 1. Student registration no longer exists: the site has no individual accounts, and the private CMS is reached with a single shared password. EXECUTE is revoked from anon and authenticated; the function and the account_requests table are kept because they are part of the historical record.';
