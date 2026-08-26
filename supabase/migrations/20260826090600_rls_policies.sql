-- =============================================================================
-- Row Level Security policies
-- =============================================================================
-- RLS is enabled on every table in this schema without exception. Where a table
-- should be unreachable by clients, it gets RLS and no policy, which denies by
-- default.
--
-- Two conventions used throughout:
--
--   * Read policies for the public use `anon, authenticated` and test only
--     published state. Nothing unpublished is ever visible to `anon`.
--   * Write policies test `is_active_account()` via the role helpers, so a
--     pending, suspended or alumni account cannot write even where it can read.
--
-- Append-only tables additionally have UPDATE and DELETE revoked at the grant
-- level. A missing policy already denies, but revoking the privilege means a
-- future policy added by mistake still cannot overwrite a research version, a
-- review or an audit entry.
-- =============================================================================

alter table academic_years              enable row level security;
alter table people                      enable row level security;
alter table profiles                    enable row level security;
alter table user_roles                  enable row level security;
alter table account_requests            enable row level security;
alter table leadership                  enable row level security;
alter table founding_contributors       enable row level security;
alter table subjects                    enable row level security;
alter table research_projects           enable row level security;
alter table research_authors            enable row level security;
alter table research_authorship_changes enable row level security;
alter table research_versions           enable row level security;
alter table research_supporting_files   enable row level security;
alter table reviews                     enable row level security;
alter table journals                    enable row level security;
alter table journal_papers              enable row level security;
alter table journal_credits             enable row level security;
alter table journal_corrections         enable row level security;
alter table notifications               enable row level security;
alter table resources                   enable row level security;
alter table announcements               enable row level security;
alter table site_content                enable row level security;
alter table activity_log                enable row level security;

-- -----------------------------------------------------------------------------
-- Append-only enforcement at the privilege level
-- -----------------------------------------------------------------------------
revoke update, delete on research_versions           from anon, authenticated;
revoke update, delete on reviews                     from anon, authenticated;
revoke update, delete on research_authorship_changes from anon, authenticated;
revoke insert, update, delete on activity_log        from anon, authenticated;

-- =============================================================================
-- Reference data
-- =============================================================================

-- academic_years -- public, since journals and leadership are grouped by it.
create policy academic_years_public_read on academic_years
  for select to anon, authenticated using (true);

create policy academic_years_leadership_insert on academic_years
  for insert to authenticated with check (is_leadership());

create policy academic_years_admin_update on academic_years
  for update to authenticated using (is_school_admin()) with check (is_school_admin());

-- subjects -- public, needed to render library filters.
create policy subjects_public_read on subjects
  for select to anon, authenticated using (true);

create policy subjects_leadership_write on subjects
  for all to authenticated using (is_leadership()) with check (is_leadership());

-- =============================================================================
-- People and accounts
-- =============================================================================

-- people
-- Public reads are limited to rows explicitly marked public. is_public defaults
-- to false, so a student is never exposed by omission.
create policy people_public_read on people
  for select to anon, authenticated using (is_public);

create policy people_self_read on people
  for select to authenticated using (id = current_person_id());

create policy people_leadership_read on people
  for select to authenticated using (is_leadership());

-- A student maintains their own public profile: photo, quote, crop position.
create policy people_self_update on people
  for update to authenticated
  using (id = current_person_id() and is_active_account())
  with check (id = current_person_id() and is_active_account());

create policy people_admin_write on people
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

-- profiles
-- Not readable by leadership: student email addresses are private, and
-- leadership has no workflow that requires them. Names come from `people`.
create policy profiles_self_read on profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_admin_read on profiles
  for select to authenticated using (is_school_admin());

-- Self-update exists so onboarded_at can be recorded. The column guard trigger
-- prevents status, email and person_id from being touched here.
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_update on profiles
  for update to authenticated
  using (is_school_admin()) with check (is_school_admin());

-- user_roles
-- The whole permission model rests on this table being writable by School
-- Administration and nobody else. Leadership gets no write policy at all.
create policy user_roles_self_read on user_roles
  for select to authenticated using (user_id = auth.uid());

create policy user_roles_admin_read on user_roles
  for select to authenticated using (is_school_admin());

create policy user_roles_admin_write on user_roles
  for all to authenticated
  using (is_school_admin()) with check (is_school_admin());

-- account_requests
-- An applicant may create their own request and watch its status. Only
-- administration may review one.
create policy account_requests_self_insert on account_requests
  for insert to authenticated with check (auth_user_id = auth.uid());

create policy account_requests_self_read on account_requests
  for select to authenticated using (auth_user_id = auth.uid());

create policy account_requests_admin_read on account_requests
  for select to authenticated using (is_school_admin());

create policy account_requests_admin_update on account_requests
  for update to authenticated
  using (is_school_admin()) with check (is_school_admin());

-- leadership and founding_contributors -- public record, administration-managed.
create policy leadership_public_read on leadership
  for select to anon, authenticated using (true);

create policy leadership_admin_write on leadership
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

create policy founding_contributors_public_read on founding_contributors
  for select to anon, authenticated using (true);

create policy founding_contributors_admin_write on founding_contributors
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

-- =============================================================================
-- Research
-- =============================================================================

-- research_projects
create policy research_projects_public_read on research_projects
  for select to anon, authenticated using (is_project_public(id));

create policy research_projects_author_read on research_projects
  for select to authenticated using (is_project_author(id));

create policy research_projects_leadership_read on research_projects
  for select to authenticated using (is_leadership());

create policy research_projects_student_insert on research_projects
  for insert to authenticated
  with check (is_active_account() and created_by = auth.uid());

-- The team leader may edit while the work is still theirs to edit. Once it is
-- published it is part of the archive and closed to them.
create policy research_projects_lead_update on research_projects
  for update to authenticated
  using (is_project_lead(id) and is_active_account() and status <> 'published')
  with check (is_project_lead(id) and is_active_account() and status <> 'published');

-- Leadership updates status as review proceeds.
create policy research_projects_leadership_update on research_projects
  for update to authenticated
  using (is_leadership()) with check (is_leadership());

-- Only an unsubmitted draft may be discarded. Nothing that has entered review
-- can be deleted by anyone.
create policy research_projects_lead_delete_draft on research_projects
  for delete to authenticated
  using (is_project_lead(id) and is_active_account() and status = 'draft');

-- research_authors
create policy research_authors_public_read on research_authors
  for select to anon, authenticated using (is_project_public(project_id));

create policy research_authors_author_read on research_authors
  for select to authenticated using (is_project_author(project_id));

create policy research_authors_leadership_read on research_authors
  for select to authenticated using (is_leadership());

create policy research_authors_lead_insert on research_authors
  for insert to authenticated
  with check (is_project_lead(project_id) and is_active_account());

-- Covers two cases: the lead reordering authors, and a co-author confirming
-- their own authorship. The guard trigger keeps the second case narrow.
create policy research_authors_update on research_authors
  for update to authenticated
  using (
    is_active_account()
    and (is_project_lead(project_id) or person_id = current_person_id())
  )
  with check (
    is_active_account()
    and (is_project_lead(project_id) or person_id = current_person_id())
  );

create policy research_authors_lead_delete on research_authors
  for delete to authenticated
  using (is_project_lead(project_id) and is_active_account());

-- research_authorship_changes -- readable as provenance, never writable directly.
-- Rows are written exclusively by the trigger on research_authors.
create policy research_authorship_changes_author_read on research_authorship_changes
  for select to authenticated using (is_project_author(project_id));

create policy research_authorship_changes_leadership_read on research_authorship_changes
  for select to authenticated using (is_leadership());

-- research_versions -- insert and read only; update/delete revoked above.
create policy research_versions_public_read on research_versions
  for select to anon, authenticated using (is_project_public(project_id));

create policy research_versions_author_read on research_versions
  for select to authenticated using (is_project_author(project_id));

create policy research_versions_leadership_read on research_versions
  for select to authenticated using (is_leadership());

create policy research_versions_lead_insert on research_versions
  for insert to authenticated
  with check (is_project_lead(project_id) and is_active_account());

-- research_supporting_files
create policy research_supporting_files_author_read on research_supporting_files
  for select to authenticated using (is_project_author(project_id));

create policy research_supporting_files_leadership_read on research_supporting_files
  for select to authenticated using (is_leadership());

create policy research_supporting_files_lead_write on research_supporting_files
  for all to authenticated
  using (is_project_lead(project_id) and is_active_account())
  with check (is_project_lead(project_id) and is_active_account());

-- reviews
-- Never public: reviewer feedback stays between the authors and the Research
-- Cell. Authors see every review on their own work, which is what makes the
-- review history visible in the student dashboard.
create policy reviews_author_read on reviews
  for select to authenticated
  using (
    exists (
      select 1 from research_versions rv
      where rv.id = reviews.version_id and is_project_author(rv.project_id)
    )
  );

create policy reviews_leadership_read on reviews
  for select to authenticated using (is_leadership());

create policy reviews_leadership_insert on reviews
  for insert to authenticated
  with check (is_leadership() and reviewer_id = auth.uid());

-- =============================================================================
-- Journals
-- =============================================================================

create policy journals_public_read on journals
  for select to anon, authenticated using (status = 'published');

create policy journals_leadership_read on journals
  for select to authenticated using (is_leadership());

create policy journals_leadership_insert on journals
  for insert to authenticated
  with check (is_leadership() and created_by = auth.uid());

-- Leadership may edit and submit for approval; the guard trigger stops them
-- approving, publishing, or touching an already published issue.
create policy journals_leadership_update on journals
  for update to authenticated
  using (is_leadership()) with check (is_leadership());

create policy journals_admin_delete on journals
  for delete to authenticated using (is_school_admin() and status <> 'published');

-- journal_papers / journal_credits -- visible once the issue is published.
create policy journal_papers_public_read on journal_papers
  for select to anon, authenticated
  using (exists (
    select 1 from journals j
    where j.id = journal_papers.journal_id and j.status = 'published'
  ));

create policy journal_papers_leadership_read on journal_papers
  for select to authenticated using (is_leadership());

create policy journal_papers_leadership_write on journal_papers
  for all to authenticated using (is_leadership()) with check (is_leadership());

create policy journal_credits_public_read on journal_credits
  for select to anon, authenticated
  using (exists (
    select 1 from journals j
    where j.id = journal_credits.journal_id and j.status = 'published'
  ));

create policy journal_credits_leadership_read on journal_credits
  for select to authenticated using (is_leadership());

create policy journal_credits_leadership_write on journal_credits
  for all to authenticated using (is_leadership()) with check (is_leadership());

-- journal_corrections -- public once approved, since a correction to a
-- published record is itself part of the public record.
create policy journal_corrections_public_read on journal_corrections
  for select to anon, authenticated using (approved_at is not null);

create policy journal_corrections_leadership_read on journal_corrections
  for select to authenticated using (is_leadership());

create policy journal_corrections_leadership_insert on journal_corrections
  for insert to authenticated with check (is_leadership());

create policy journal_corrections_update on journal_corrections
  for update to authenticated
  using (is_leadership()) with check (is_leadership());

-- =============================================================================
-- Site
-- =============================================================================

-- notifications -- strictly personal.
create policy notifications_self_read on notifications
  for select to authenticated using (recipient_id = auth.uid());

-- Marking as read. Notifications carry no other mutable field.
create policy notifications_self_update on notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy notifications_leadership_insert on notifications
  for insert to authenticated with check (is_leadership());

-- resources
create policy resources_public_read on resources
  for select to anon, authenticated using (is_published);

create policy resources_leadership_read on resources
  for select to authenticated using (is_leadership());

create policy resources_admin_write on resources
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

-- announcements
-- The date window is evaluated in the policy itself, so an expired announcement
-- disappears on its end date with no scheduled job involved.
create policy announcements_public_read on announcements
  for select to anon, authenticated
  using (
    is_visible
    and starts_on <= current_date
    and (ends_on is null or ends_on >= current_date)
  );

create policy announcements_leadership_read on announcements
  for select to authenticated using (is_leadership());

create policy announcements_admin_write on announcements
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

-- site_content -- readable by everyone; it is the public copy of the site.
create policy site_content_public_read on site_content
  for select to anon, authenticated using (true);

create policy site_content_admin_write on site_content
  for all to authenticated using (is_school_admin()) with check (is_school_admin());

-- activity_log
-- Read is School Administration only, per specification. Writes arrive through
-- SECURITY DEFINER routines and the service-role client; client roles have the
-- privilege revoked outright above.
create policy activity_log_admin_read on activity_log
  for select to authenticated using (is_school_admin());
