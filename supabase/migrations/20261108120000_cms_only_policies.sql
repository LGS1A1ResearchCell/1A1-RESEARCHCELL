-- =============================================================================
-- CMS-only write policies
-- =============================================================================
-- Six policies gave journal write access to any `leadership` account. Under the
-- CMS-only architecture the one intended authenticated user is the School
-- Administrator, so they are reissued against is_school_admin(). Sixteen others
-- belong to the retired student-account system and are removed.
--
-- All twenty-two were verified present under exactly these names and commands
-- on the Research Cell Testing project on 2026-11-08.
--
-- NOT TOUCHED, deliberately:
--
--   * the thirteen *_leadership_read policies. is_leadership() includes
--     school_admin, so the CMS reads drafts, unpublished journals, unpublished
--     resources and hidden announcements through them. journals, resources and
--     announcements have no other SELECT path for the CMS, so dropping them
--     would make unpublished content invisible in the management area. They are
--     a confidentiality concern for a dormant leadership account, not a
--     capability one, and tightening them to is_school_admin() is a separate
--     change that has not been approved.
--   * journals_admin_delete, which stays exactly as written. The privileges
--     migration grants no DELETE on journals, so the policy is simply
--     unreachable -- a conscious choice, not an oversight.
--   * the six *_author_read policies. Obsolete but harmless reads; sweeping
--     them in would enlarge the change for no security gain.
--   * every public read policy.
--   * all five helper functions. is_active_account() is called by
--     is_school_admin() itself, and is_project_lead() and current_person_id()
--     are called by the live triggers guard_authorship_confirmation and
--     guard_authorship_insert, so removing any of them would break writes that
--     currently succeed.
--   * every trigger, and every row. This migration changes no data.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Journal writes become administration's
-- -----------------------------------------------------------------------------
-- created_by = auth.uid() is preserved: createJournal sets created_by to the
-- session's user id, and the check is what ties a journal to its creator.
--
-- The guard triggers are unchanged and still decide what the administrator may
-- do to a published issue: guard_journal_publication, guard_journal_papers,
-- guard_journal_credits and guard_correction_approval all remain attached.

drop policy if exists journals_leadership_insert on public.journals;
create policy journals_leadership_insert on public.journals
  for insert to authenticated
  with check (is_school_admin() and created_by = auth.uid());

drop policy if exists journals_leadership_update on public.journals;
create policy journals_leadership_update on public.journals
  for update to authenticated
  using (is_school_admin()) with check (is_school_admin());

drop policy if exists journal_papers_leadership_write on public.journal_papers;
create policy journal_papers_leadership_write on public.journal_papers
  for all to authenticated
  using (is_school_admin()) with check (is_school_admin());

drop policy if exists journal_credits_leadership_write on public.journal_credits;
create policy journal_credits_leadership_write on public.journal_credits
  for all to authenticated
  using (is_school_admin()) with check (is_school_admin());

drop policy if exists journal_corrections_leadership_insert on public.journal_corrections;
create policy journal_corrections_leadership_insert on public.journal_corrections
  for insert to authenticated
  with check (is_school_admin());

drop policy if exists journal_corrections_update on public.journal_corrections;
create policy journal_corrections_update on public.journal_corrections
  for update to authenticated
  using (is_school_admin()) with check (is_school_admin());


-- -----------------------------------------------------------------------------
-- 2. Account-era write paths, removed
-- -----------------------------------------------------------------------------
-- Every one of these admitted a student, a project lead or a leadership
-- account. None is reachable by the CMS, which writes these tables through its
-- own is_school_admin() policies -- people_admin_write,
-- research_projects_cms_write, research_authors_cms_write -- or does not write
-- them at all.
--
-- All sixteen are defined exactly once, in
-- 20260826090600_rls_policies.sql, which is therefore the complete and only
-- rollback source for this section.

drop policy if exists research_projects_student_insert     on public.research_projects;
drop policy if exists research_projects_lead_update        on public.research_projects;
drop policy if exists research_projects_leadership_update  on public.research_projects;
drop policy if exists research_projects_lead_delete_draft  on public.research_projects;

drop policy if exists research_authors_lead_insert         on public.research_authors;
drop policy if exists research_authors_lead_delete         on public.research_authors;
drop policy if exists research_authors_update              on public.research_authors;

drop policy if exists people_self_update                   on public.people;
drop policy if exists profiles_self_update                 on public.profiles;

drop policy if exists subjects_leadership_write            on public.subjects;
drop policy if exists academic_years_leadership_insert     on public.academic_years;

drop policy if exists notifications_leadership_insert      on public.notifications;
drop policy if exists notifications_self_update            on public.notifications;

drop policy if exists reviews_leadership_insert            on public.reviews;
drop policy if exists research_versions_lead_insert        on public.research_versions;
drop policy if exists research_supporting_files_lead_write on public.research_supporting_files;
