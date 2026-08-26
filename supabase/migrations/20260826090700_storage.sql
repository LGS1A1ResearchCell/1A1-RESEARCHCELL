-- =============================================================================
-- Storage buckets and access policies
-- =============================================================================
-- Six buckets, split by whether their contents are public record or not.
--
--   PUBLIC   profile-photos, journal-covers, journal-pdfs
--            Contents of a published journal, and portraits the school has
--            chosen to display. Served over the CDN.
--
--   PRIVATE  research-submissions, supporting-documents, resource-files
--            Student work in progress. Never CDN-served; every read is
--            authorised against the same rules as the research tables, and
--            delivered through short-lived signed URLs.
--
-- Journal PDFs are public rather than signed because a published journal is
-- explicitly public record, and signing would break linking and citation.
-- Unpublished journal PDFs are simply not uploaded to this bucket until
-- publication.
--
-- Path convention for private research files:
--     research-submissions/<project_id>/v<version>/<filename>
-- The first path segment is the project id, which is what the policies below
-- test against. Application code must not deviate from it.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),

  ('journal-covers', 'journal-covers', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),

  ('journal-pdfs', 'journal-pdfs', true, 104857600,
   array['application/pdf']),

  ('research-submissions', 'research-submissions', false, 52428800,
   array['application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),

  ('supporting-documents', 'supporting-documents', false, 52428800, null),

  ('resource-files', 'resource-files', false, 52428800, null)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- profile-photos
-- -----------------------------------------------------------------------------
-- Path convention: profile-photos/<person_id>/<filename>
create policy "profile photos are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-photos');

create policy "a student manages their own photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and public.is_active_account()
    and (storage.foldername(name))[1] = public.current_person_id()::text
  );

create policy "a student replaces their own photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.is_active_account()
    and (storage.foldername(name))[1] = public.current_person_id()::text
  );

create policy "a student removes their own photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.is_active_account()
    and (storage.foldername(name))[1] = public.current_person_id()::text
  );

create policy "administration manages any photo"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'profile-photos' and public.is_school_admin())
  with check (bucket_id = 'profile-photos' and public.is_school_admin());

-- -----------------------------------------------------------------------------
-- journal-covers and journal-pdfs
-- -----------------------------------------------------------------------------
create policy "journal assets are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('journal-covers', 'journal-pdfs'));

create policy "leadership uploads journal assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_leadership()
  );

create policy "leadership replaces journal assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_leadership()
  );

-- Deletion is administration's alone: removing the PDF of a published journal
-- would break the public archive.
create policy "administration deletes journal assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('journal-covers', 'journal-pdfs')
    and public.is_school_admin()
  );

-- -----------------------------------------------------------------------------
-- research-submissions and supporting-documents
-- -----------------------------------------------------------------------------
-- Read mirrors the research tables exactly: an author of the project, or
-- Research Cell leadership. Note there is no `anon` policy at all -- an
-- unpublished submission is unreachable without a session, and a published one
-- is read through the journal PDF rather than the raw submission.
create policy "authors and leadership read research files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('research-submissions', 'supporting-documents')
    and (
      public.is_leadership()
      or public.is_project_author(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "the team leader uploads research files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('research-submissions', 'supporting-documents')
    and public.is_active_account()
    and public.is_project_lead(((storage.foldername(name))[1])::uuid)
  );

-- No UPDATE policy, deliberately. A revision is a new version at a new path;
-- overwriting a submitted document in place must remain impossible.

-- Deletion is limited to administration, for genuine mistakes only. Students
-- and leadership cannot remove submitted work.
create policy "administration deletes research files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('research-submissions', 'supporting-documents')
    and public.is_school_admin()
  );

-- -----------------------------------------------------------------------------
-- resource-files
-- -----------------------------------------------------------------------------
-- Private bucket, served to signed-in users through signed URLs. Resources
-- intended for the general public are attached to a published `resources` row
-- and surfaced through that instead.
create policy "signed-in users read resource files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resource-files');

create policy "administration manages resource files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'resource-files' and public.is_school_admin())
  with check (bucket_id = 'resource-files' and public.is_school_admin());
