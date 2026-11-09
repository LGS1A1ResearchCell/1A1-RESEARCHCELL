-- =============================================================================
-- CMS-only storage policies
-- =============================================================================
-- The storage-layer counterpart of 20261108120000_cms_only_policies.sql. Six
-- policies on storage.objects still key on the account-era helpers, which
-- leaves a leadership account able to upload, replace and delete the cover and
-- PDF of an unpublished journal through the Storage API directly -- bypassing
-- both the website and the table policies -- and any authenticated identity
-- able to read every object in resource-files.
--
-- All six were verified present under exactly these names on the Research Cell
-- Testing project on 2026-11-08.
--
-- No CMS capability is lost. journal_asset_writable() returns
-- `status <> 'published' OR is_school_admin()`, which is unconditionally true
-- when is_school_admin() is true, so `is_school_admin() AND
-- journal_asset_writable(...)` is equivalent to `is_school_admin()` alone, and
-- the administrator could already act on a published issue.
--
-- KEPT UNCHANGED: "journal assets are publicly readable", "published research
-- pdfs are readable", "administration deletes journal assets", "administration
-- deletes research files", "administration manages resource files", "the cms
-- manages research pdfs".
--
-- journal_asset_writable() loses its last caller and is kept, like every other
-- helper.
--
-- NO PRIVILEGE IS GRANTED OR REVOKED HERE. anon and authenticated already hold
-- USAGE on schema storage and SELECT, INSERT, UPDATE and DELETE on
-- storage.objects and storage.buckets, granted by supabase_storage_admin; and a
-- migration running as `postgres` could not alter those grants in any case,
-- because `postgres` is not a member of supabase_storage_admin. RLS is the
-- control here, and these policies are it.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Journal covers and PDFs
-- -----------------------------------------------------------------------------

drop policy if exists "leadership uploads journal assets" on storage.objects;
create policy "administration uploads journal assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_school_admin()
  );

-- Replaced rather than dropped. The application replaces an asset by uploading
-- a new path and deleting the old one, but the Storage API may UPDATE the
-- object row's metadata after an insert, and authenticated already holds UPDATE
-- on storage.objects, so the policy is the only control. Keeping one costs
-- nothing and avoids a failure that would be hard to attribute.
--
-- UNRESOLVED, flagged in the audit: whether an upload genuinely needs this
-- UPDATE policy cannot be settled from source and requires a functional upload
-- test. The policy is kept precisely so that question cannot break an upload.
drop policy if exists "leadership replaces journal assets" on storage.objects;
create policy "administration replaces journal assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_school_admin()
  )
  with check (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_school_admin()
  );

-- Dropped outright, not replaced: "administration deletes journal assets"
-- already covers both buckets for is_school_admin() with no status restriction,
-- so this policy's only effect was to extend deletion to leadership accounts on
-- an open journal.
drop policy if exists "leadership removes assets from an open journal" on storage.objects;


-- -----------------------------------------------------------------------------
-- 2. Research submissions and supporting documents
-- -----------------------------------------------------------------------------
-- For research-submissions both are redundant: "the cms manages research pdfs"
-- is FOR ALL on is_school_admin(). They are reissued rather than dropped
-- because they also cover supporting-documents, which has no administration
-- policy for SELECT or INSERT at all.

drop policy if exists "authors and leadership read research files" on storage.objects;
create policy "administration reads research files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('research-submissions', 'supporting-documents')
    and public.is_school_admin()
  );

drop policy if exists "the team leader uploads research files" on storage.objects;
create policy "administration uploads research files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('research-submissions', 'supporting-documents')
    and public.is_school_admin()
  );

-- Still no UPDATE policy on these two buckets, deliberately: a revision is a
-- new object at a new path, and overwriting a submitted document in place must
-- remain impossible. That was the original design and it is unchanged.


-- -----------------------------------------------------------------------------
-- 3. Resource files
-- -----------------------------------------------------------------------------
-- This admitted ANY authenticated identity -- including every dormant account
-- -- to every object in resource-files, with no administrator test.
-- "administration manages resource files" is FOR ALL on is_school_admin() and
-- already covers the CMS, and no code path reads this bucket, so nothing is
-- lost.

drop policy if exists "signed-in users read resource files" on storage.objects;
