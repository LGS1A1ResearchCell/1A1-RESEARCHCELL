-- =============================================================================
-- Phase 7 — site content, announcements, resources, notifications, audit log
-- =============================================================================
-- The tables for all five existed from Phase 1. Two things were missing.
--
--   1. A notification was self-editable. notifications_self_update exists so a
--      recipient can mark one read, but Row Level Security governs rows, not
--      columns -- so a student could rewrite the title, body or type of a
--      notification sent to them, including one recording a decision about
--      their own work.
--
--   2. Six of the actions the specification requires the audit log to record
--      were never written: permission changed, paper submitted, journal
--      created, journal submitted for approval, journal approved, and
--      correction recorded. Confirmed by reading every function that touches
--      activity_log before this was written.
--
-- Both are closed here. Client roles still cannot write to activity_log at all;
-- every entry below is raised by a trigger running as the table owner.
-- =============================================================================


-- =============================================================================
-- A notification can only be marked as read
-- =============================================================================

create or replace function public.guard_notification_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_school_admin() then
    return new;
  end if;

  if new.recipient_id is distinct from old.recipient_id
     or new.type        is distinct from old.type
     or new.title       is distinct from old.title
     or new.body        is distinct from old.body
     or new.entity_type is distinct from old.entity_type
     or new.entity_id   is distinct from old.entity_id
     or new.created_at  is distinct from old.created_at then
    raise exception 'A notification can only be marked as read.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger notifications_guard_columns
  before update on public.notifications
  for each row execute function public.guard_notification_columns();


-- =============================================================================
-- The audit log
-- =============================================================================
-- One helper, called only from triggers. Client roles have INSERT on
-- activity_log revoked outright, so nothing can forge an entry: an action is
-- recorded because it happened, not because someone said it did.

create or replace function public.record_activity(
  p_actor       uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on function public.record_activity(uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Permission changes
-- -----------------------------------------------------------------------------
-- Who gained or lost a role, and who did it. Only School Administration can
-- write to user_roles at all, so every entry here names an administrator.

create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_row  record;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  select pe.full_name into v_name
  from public.profiles pr
  join public.people pe on pe.id = pr.person_id
  where pr.id = v_row.user_id;

  perform public.record_activity(
    auth.uid(),
    case when tg_op = 'DELETE' then 'permission.revoked' else 'permission.granted' end,
    'profile', v_row.user_id,
    jsonb_build_object('role', v_row.role, 'name', v_name));

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger user_roles_log_grant
  after insert on public.user_roles
  for each row execute function public.log_role_change();

create trigger user_roles_log_revoke
  after delete on public.user_roles
  for each row execute function public.log_role_change();


-- -----------------------------------------------------------------------------
-- Paper submitted
-- -----------------------------------------------------------------------------
-- Review outcomes were already recorded; the submission that triggers a review
-- was not, which left a gap at the start of every paper's history.

create or replace function public.log_research_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    perform public.record_activity(
      auth.uid(), 'research.submitted', 'research_project', new.id,
      jsonb_build_object(
        'title', new.title,
        'version', (select coalesce(max(version_number), 0)
                    from public.research_versions rv where rv.project_id = new.id)));
  end if;
  return new;
end;
$$;

create trigger research_projects_log_submitted
  after update on public.research_projects
  for each row execute function public.log_research_submitted();


-- -----------------------------------------------------------------------------
-- Journal lifecycle
-- -----------------------------------------------------------------------------
-- Publication was already recorded by apply_journal_publication. Creation,
-- submission for approval, and approval were not, so the record began only at
-- the final step of a workflow that has four.

create or replace function public.log_journal_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_activity(
    auth.uid(), 'journal.created', 'journal', new.id,
    jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger journals_log_created
  after insert on public.journals
  for each row execute function public.log_journal_created();

create or replace function public.log_journal_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending_admin_approval'
     and old.status is distinct from 'pending_admin_approval' then
    perform public.record_activity(
      auth.uid(), 'journal.submitted_for_approval', 'journal', new.id,
      jsonb_build_object('title', new.title,
        'papers', (select count(*) from public.journal_papers jp where jp.journal_id = new.id)));
  end if;

  -- Approval is recorded separately from publication: they are two distinct
  -- acts even when an administrator performs them together.
  if new.approved_at is not null and old.approved_at is null then
    perform public.record_activity(
      auth.uid(), 'journal.approved', 'journal', new.id,
      jsonb_build_object('title', new.title));
  end if;

  return new;
end;
$$;

create trigger journals_log_progress
  after update on public.journals
  for each row execute function public.log_journal_progress();


-- -----------------------------------------------------------------------------
-- Corrections
-- -----------------------------------------------------------------------------

create or replace function public.log_correction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_activity(
      auth.uid(), 'journal.correction_recorded', 'journal', new.journal_id,
      jsonb_build_object('correction_id', new.id));
  elsif new.approved_at is not null and old.approved_at is null then
    perform public.record_activity(
      auth.uid(), 'journal.correction_approved', 'journal', new.journal_id,
      jsonb_build_object('correction_id', new.id));
  end if;
  return new;
end;
$$;

create trigger journal_corrections_log
  after insert or update on public.journal_corrections
  for each row execute function public.log_correction();


-- =============================================================================
-- Reading the audit log
-- =============================================================================
-- School Administration only, as the specification requires: students have no
-- access to the administrative log at all, and neither does Research Cell
-- leadership. The actor's name is resolved through the same narrow lookup used
-- for reviewer names, so the log reads as a record of people rather than of
-- account identifiers.

create or replace view public.activity_log_readable
with (security_invoker = true)
as
select
  al.id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.metadata,
  al.created_at,
  public.reviewer_display_name(al.actor_id) as actor_name
from public.activity_log al;

comment on view public.activity_log_readable is
  'The administrative audit log with actor names resolved. security_invoker keeps activity_log_admin_read in force, so this is readable by School Administration alone.';

grant select on public.activity_log_readable to authenticated;
