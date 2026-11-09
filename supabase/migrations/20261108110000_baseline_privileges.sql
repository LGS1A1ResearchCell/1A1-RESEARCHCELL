-- =============================================================================
-- Baseline client privileges
-- =============================================================================
-- The chain declares policies but almost no table privileges. Default
-- privileges for objects created by `postgres` -- the role migrations run as --
-- grant anon and authenticated MAINTAIN and nothing else, so on a project
-- built from this repository `authenticated` cannot read `people` at all and
-- every security_invoker view fails for want of base-table SELECT. Verified
-- against the Research Cell Testing project on 2026-11-08: as `anon`,
-- `select from current_people` fails with 42501 on `people`, and
-- `select from published_research` fails with 42501 on `research_projects`,
-- while `published_paper_authors` (security_invoker = false, owner rights)
-- returns its rows.
--
-- Two roles only. `anon` is the public website; `authenticated` is the one CMS
-- administrator. There is no student-account system, so `authenticated` must
-- not be read as a student role. service_role, auth.users and the storage
-- schema are not touched.
--
-- Row Level Security still decides which rows. A privilege here decides only
-- which relations and columns a role may reach at all.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schema reachability
-- -----------------------------------------------------------------------------
-- Already true via PUBLIC (measured: both roles hold USAGE, neither holds
-- CREATE). Stated so the migration is self-sufficient on a fresh project.

grant usage on schema public to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Start from nothing
-- -----------------------------------------------------------------------------
-- Every ACL entry in this schema was granted by `postgres`, which is the role
-- this migration runs as, so this revoke reaches all of them. A REVOKE only
-- removes grants made by the revoking role, so that was checked before this
-- statement was written: all 70 entries across 24 tables and 11 views have
-- grantor `postgres`, and pg_attribute.attacl is null everywhere, so there are
-- no column-level grants to survive.
--
-- Today it removes MAINTAIN from 35 objects and SELECT from the thirteen
-- objects granted by earlier migrations; sections 3 to 5 re-grant SELECT
-- explicitly.
--
-- MAINTAIN is a PostgreSQL 17 privilege (VACUUM, ANALYZE, CLUSTER, REINDEX,
-- LOCK TABLE) that did not exist when phase 1 took back TRUNCATE, TRIGGER and
-- REFERENCES, so it was never revoked. No REST client can use it; it goes
-- because nothing needs it.

revoke all on all tables in schema public from anon, authenticated;

-- Future objects created by `postgres` must not inherit anything either. This
-- supersedes the narrower default-privilege revoke in
-- 20260827100000_phase1_fixes.sql, which took back only TRUNCATE, TRIGGER and
-- REFERENCES.
--
-- KNOWN LIMITATION, recorded deliberately. pg_default_acl also holds a row
-- owned by `supabase_admin` granting ALL on tables to anon and authenticated.
-- It applies only to objects created BY supabase_admin, which nothing in this
-- repository does -- dashboard SQL also runs as `postgres`. It cannot be closed
-- from a migration, because ALTER DEFAULT PRIVILEGES requires membership in
-- the target role and `postgres` is not a member of `supabase_admin`.
-- Escalating the migration role to reach it would be a worse trade than
-- leaving it documented here.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which is how the nine
-- helpers in section 7 became anonymously callable: their pg_proc.proacl is
-- null, the built-in default. A pg_default_acl row for functions owned by
-- `postgres` already exists and carries no PUBLIC entry, so this statement is
-- very likely already satisfied. It is stated because it is idempotent, and
-- because relying on an unexplained platform row would not be a decision.
alter default privileges in schema public
  revoke execute on functions from public;


-- -----------------------------------------------------------------------------
-- 3. What the public website reads
-- -----------------------------------------------------------------------------
-- Thirteen tables. Nine of the eleven views are security_invoker, so the caller
-- needs privileges on the view's base relations, not just on the view. That is
-- why `subjects`, `academic_years` and `research_projects` appear here although
-- no public page queries them directly:
--
--   current_leadership        -> leadership_positions, people, academic_years
--   past_leadership           -> leadership_history, people
--   current_people            -> people, leadership_positions
--   past_people               -> people
--   published_research        -> research_projects, subjects, academic_years
--   published_journal_papers  -> journal_papers, journals, research_projects,
--                                subjects
--   published_paper_authors   -> none (security_invoker = false)
--   published_research_authors-> none (security_invoker = false)
--
-- Every one of these thirteen tables already carries an `anon` SELECT policy,
-- so Row Level Security, not the grant, decides which rows are returned.

grant select on
  public.academic_years,
  public.announcements,
  public.founding_contributors,
  public.journal_corrections,
  public.journal_credits,
  public.journal_papers,
  public.journals,
  public.leadership_history,
  public.leadership_positions,
  public.research_projects,
  public.resources,
  public.site_content,
  public.subjects
to anon;

-- `people` is granted by column, not by table. people_public_read admits every
-- person who has a status, so a table-wide grant would expose class_section,
-- year_joined, kind and quote through /rest/v1/people to anyone holding the
-- publishable key -- which, on a school site carrying the names of minors, is
-- not a privilege the public pages need.
--
-- These six columns are exactly what current_people, past_people,
-- current_leadership, past_leadership and the
-- founding_contributors -> people(full_name) embed reference.
--
-- Safe because `anon` is a member of no role (verified in pg_auth_members), so
-- it cannot pick up the table-wide grant given to `authenticated` in section 4.
--
-- CONSEQUENCE, accepted: public_researchers selects slug, kind, class_section,
-- year_joined and quote, so that view stays unreachable for `anon`. No page
-- uses it.
grant select (
  id,
  full_name,
  status,
  leadership_title,
  academic_year_text,
  moved_to_past_at
) on public.people to anon;

grant select on
  public.current_leadership,
  public.current_people,
  public.past_leadership,
  public.past_people,
  public.published_journal_papers,
  public.published_paper_authors,
  public.published_research,
  public.published_research_authors
to anon;


-- -----------------------------------------------------------------------------
-- 4. What the CMS reads
-- -----------------------------------------------------------------------------
-- Table-wide SELECT on `people`: the CMS edits every column, so a column list
-- would have to name all of them.
--
-- account_requests, activity_log, research_authorship_changes, reviews and
-- research_versions are included although no page reads them today. They are
-- the preserved historical record -- the account request, the audit log, the
-- authorship provenance, the review history -- and their policies already
-- restrict them to School Administration. Withholding SELECT would leave them
-- unreadable by anything but the service role.

grant select on
  public.academic_years,
  public.account_requests,
  public.activity_log,
  public.announcements,
  public.founding_contributors,
  public.journal_corrections,
  public.journal_credits,
  public.journal_papers,
  public.journals,
  public.leadership_history,
  public.leadership_positions,
  public.people,
  public.profiles,
  public.research_authors,
  public.research_authorship_changes,
  public.research_projects,
  public.research_versions,
  public.resources,
  public.reviews,
  public.site_content,
  public.subjects,
  public.user_roles
to authenticated;

-- `notifications` and `research_supporting_files` are deliberately absent. Both
-- belong to the retired student-account system: notifications are written only
-- by SECURITY DEFINER triggers and read by nothing, and no code path touches
-- supporting files. Add SELECT in a later migration if either returns; nothing
-- is dropped here.

-- public_researchers is included because it currently has NO grant at all:
-- 20260827130000_phase3_profiles.sql granted it, then
-- 20260923100000_session1_simplify.sql dropped and recreated the view without
-- re-granting. This line restores a privilege lost in Session 1.
grant select on
  public.activity_log_readable,
  public.current_leadership,
  public.current_people,
  public.past_leadership,
  public.past_people,
  public.public_researchers,
  public.published_journal_papers,
  public.published_paper_authors,
  public.published_research,
  public.published_research_authors,
  public.research_review_history
to authenticated;


-- -----------------------------------------------------------------------------
-- 5. What the CMS writes
-- -----------------------------------------------------------------------------
-- Ten tables, each granted exactly the operations the server actions use.
-- Stated one relation at a time so the operation set per table is reviewable.
--
--   No DELETE on journals            -- no action deletes a journal.
--                                       journals_admin_delete stays exactly as
--                                       written, simply unreachable.
--   No UPDATE on journal_credits     -- a credit is added or removed.
--   No UPDATE on research_authors    -- an authorship is added or removed.
--   No DELETE on research_projects   -- no action deletes a paper.
--   No INSERT or DELETE on resources
--   or site_content                  -- their rows are seeded, then edited.

grant insert, update, delete on public.announcements        to authenticated;
grant insert, update, delete on public.journal_papers       to authenticated;
grant insert, update, delete on public.people               to authenticated;
grant insert, update         on public.journals             to authenticated;
grant insert, update         on public.journal_corrections  to authenticated;
grant insert, update         on public.research_projects    to authenticated;
grant insert, delete         on public.journal_credits      to authenticated;
grant insert, delete         on public.research_authors     to authenticated;
grant update                 on public.resources            to authenticated;
grant update                 on public.site_content         to authenticated;

-- leadership_positions and leadership_history carry read privileges only. The
-- CMS changes a position through the seven SECURITY DEFINER functions, which is
-- what makes the history trigger impossible to bypass. founding_contributors is
-- read-only for the same reason: founders are seeded by migration.


-- -----------------------------------------------------------------------------
-- 6. Append-only protections, re-asserted
-- -----------------------------------------------------------------------------
-- Verified: anon and authenticated currently hold no INSERT, UPDATE or DELETE
-- anywhere, so every statement here is a no-op today. They are stated anyway.
-- This migration runs after the revokes in
-- 20260826090600_rls_policies.sql, so a future careless grant -- or a careless
-- edit to section 5 -- would otherwise silently restore the ability to
-- overwrite a research version, a review, the authorship log or the audit log.
-- A revoke can only narrow, so this section cannot undo anything above it.

revoke insert, update, delete on public.activity_log                from anon, authenticated;
revoke update, delete         on public.reviews                     from anon, authenticated;
revoke update, delete         on public.research_versions           from anon, authenticated;
revoke update, delete         on public.research_authorship_changes from anon, authenticated;
revoke insert, update, delete on public.leadership_history          from anon, authenticated;
revoke insert, update, delete on public.leadership_positions        from anon, authenticated;
revoke insert, update, delete on public.founding_contributors       from anon, authenticated;

revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Function EXECUTE
-- -----------------------------------------------------------------------------
-- All nine have pg_proc.proacl = null, the built-in default, so PUBLIC -- and
-- therefore anon, authenticated and service_role -- currently holds EXECUTE.
--
-- Two must keep anonymous EXECUTE. Without is_project_public the three
-- anon-facing policies research_projects_public_read,
-- research_authors_public_read and research_versions_public_read cannot be
-- evaluated and the public research archive returns nothing; without
-- research_pdf_is_public the storage policy "published research pdfs are
-- readable" fails and no published PDF can be signed. RLS policy expressions
-- are evaluated as the querying role, which is what creates the requirement.
--
-- The other seven are named only by policies that apply to `authenticated`.
-- Nesting creates no requirement: every function in this schema that calls a
-- helper is SECURITY DEFINER, so the inner call runs as the function owner and
-- the caller's EXECUTE privilege on it is never checked.
--
-- service_role held EXECUTE on all nine through PUBLIC alone and is not a
-- superuser, so each revoke is paired with an explicit re-grant to it. Its
-- effective privileges do not change.

revoke all on function public.is_active_account()            from public;
revoke all on function public.is_leadership()                from public;
revoke all on function public.is_school_admin()              from public;
revoke all on function public.is_project_lead(uuid)          from public;
revoke all on function public.is_project_author(uuid)        from public;
revoke all on function public.is_project_public(uuid)        from public;
revoke all on function public.current_person_id()            from public;
revoke all on function public.research_pdf_is_public(text)   from public;
revoke all on function public.unconfirmed_author_count(uuid) from public;

grant execute on function public.is_project_public(uuid)      to anon, authenticated, service_role;
grant execute on function public.research_pdf_is_public(text) to anon, authenticated, service_role;

grant execute on function public.is_active_account()     to authenticated, service_role;
grant execute on function public.is_leadership()         to authenticated, service_role;
grant execute on function public.is_school_admin()       to authenticated, service_role;
grant execute on function public.is_project_lead(uuid)   to authenticated, service_role;
grant execute on function public.is_project_author(uuid) to authenticated, service_role;
grant execute on function public.current_person_id()     to authenticated, service_role;

-- Its only caller, guard_project_status, was dropped in Session 2
-- (20260923200000_session2_research.sql). The function is kept; its client
-- reachability is not.
grant execute on function public.unconfirmed_author_count(uuid) to service_role;


-- -----------------------------------------------------------------------------
-- 8. Storage -- nothing to do
-- -----------------------------------------------------------------------------
-- Measured on the Research Cell Testing project: anon and authenticated already
-- hold USAGE on schema storage and SELECT, INSERT, UPDATE and DELETE on
-- storage.objects and storage.buckets, all granted by supabase_storage_admin.
-- Nothing is missing, so nothing is granted here.
--
-- Nothing is revoked either. The grantor is supabase_storage_admin and
-- `postgres` is not a member of it, so a migration cannot alter those grants.
-- RLS is the control, and it is enabled on all ten storage tables --
-- storage.buckets has no policy at all, which denies every client write to it.
--
-- The storage POLICIES are hardened separately, in
-- 20261108130000_cms_only_storage_policies.sql.
