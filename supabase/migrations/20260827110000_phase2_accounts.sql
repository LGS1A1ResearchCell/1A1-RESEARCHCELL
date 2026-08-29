-- =============================================================================
-- Phase 2 — account registration and approval
-- =============================================================================
-- The registration workflow, in full:
--
--   student submits the form
--     -> an account_request is created, status 'pending'
--     -> NO auth user, NO people row, NO profile exists yet
--     -> the student therefore cannot log in, structurally, not by a check
--   School Administration reviews the queue
--     -> approve  : an auth user is created, then people + profiles + role,
--                   all in one transaction, and the request is marked approved
--     -> decline  : recorded with a reviewer and a note; nothing is deleted
--   the student sets their own password through an invite link
--     -> only then can they sign in
--
-- Two things follow from this that shape the SQL below.
--
-- First, the applicant is anonymous. The existing self-insert and self-read
-- policies on account_requests keyed off auth.uid() and are now unreachable;
-- they are replaced by a SECURITY DEFINER entry point. That is deliberately
-- preferred over granting `anon` a blanket INSERT on the table: the function is
-- a narrow, validating doorway rather than an open write endpoint, and it keeps
-- the service-role key out of the signup path entirely.
--
-- Second, approval creates identity records the applicant may never create for
-- themselves. That work happens in complete_account_approval below, which is
-- callable only by service_role, from a server action that has already
-- confirmed the caller is School Administration through their own session.
-- =============================================================================


-- =============================================================================
-- Request status
-- =============================================================================
-- account_requests previously reused account_status, which has no way to record
-- a declined request and reads oddly besides ('active' is not a state a request
-- can be in). A request has its own small lifecycle, so it gets its own type.

create type request_status as enum ('pending', 'approved', 'declined');

alter table account_requests alter column status drop default;

alter table account_requests
  alter column status type request_status
  using (case status::text
           when 'active' then 'approved'
           when 'pending' then 'pending'
           else 'pending'
         end)::request_status;

alter table account_requests alter column status set default 'pending';

comment on column account_requests.status is
  'Lifecycle of the registration request itself, distinct from the status of any account it later produces. Declined requests are retained with their reviewer and note; nothing is deleted.';


-- =============================================================================
-- One pending request per email address
-- =============================================================================
-- Previously only auth_user_id was unique, and that stays null until approval,
-- so the same person could file unlimited pending requests.
--
-- Partial, so that a declined applicant may re-apply later and an approved one
-- does not block their own historical record. Indexed on the normalised form,
-- since the submit function lowercases and trims before inserting.

create unique index account_requests_one_pending_per_email
  on account_requests (lower(email))
  where status = 'pending';


-- =============================================================================
-- Policies
-- =============================================================================
-- Both self-scoped policies are unreachable under the revised workflow: an
-- applicant has no session, so auth.uid() is null and neither can ever match.
-- Removed rather than left as dead code implying a capability that no longer
-- exists. Reading the status of one's own request is not offered at all --
-- doing so for an anonymous visitor would require an email lookup endpoint,
-- which is exactly the enumeration oracle the signup form avoids being.

drop policy account_requests_self_insert on account_requests;
drop policy account_requests_self_read on account_requests;


-- =============================================================================
-- Slug generation
-- =============================================================================
-- people.slug is unique and public-facing. Approval has to derive one, and two
-- students may legitimately share a name.

create or replace function public.generate_person_slug(p_full_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         integer := 1;
begin
  base := regexp_replace(lower(btrim(coalesce(p_full_name, ''))), '[^a-z0-9]+', '-', 'g');
  base := btrim(base, '-');
  if base = '' then
    base := 'member';
  end if;

  candidate := base;
  while exists (select 1 from public.people pe where pe.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.generate_person_slug(text) from public, anon, authenticated;
grant execute on function public.generate_person_slug(text) to service_role;


-- =============================================================================
-- submit_account_request — the public signup doorway
-- =============================================================================
-- Returns void, always, whatever happens. A duplicate application, an address
-- that already holds an account, and a genuine new request are indistinguishable
-- to the caller. That is intentional: the form is public and the people behind
-- these addresses are schoolchildren, so it must not be usable to discover who
-- has registered.
--
-- Malformed input still raises, because that is a property of the submission
-- rather than a fact about anybody's account.

create or replace function public.submit_account_request(
  p_full_name     text,
  p_email         text,
  p_class_section public.class_section,
  p_year_joined   integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name  text;
begin
  v_email := lower(btrim(coalesce(p_email, '')));
  v_name  := btrim(coalesce(p_full_name, ''));

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;

  if p_class_section is null then
    raise exception 'Please select your class.' using errcode = '22023';
  end if;

  -- Entered manually and never inferred: a student who joined in 2025 remains a
  -- 2025 joiner regardless of when they register.
  if p_year_joined is null or p_year_joined < 2000 or p_year_joined > 2100 then
    raise exception 'Please select the year you joined the Research Cell.' using errcode = '22023';
  end if;

  -- Already applied, or already has an account: succeed silently.
  if exists (
    select 1 from public.account_requests ar
    where lower(ar.email) = v_email and ar.status = 'pending'
  ) or exists (
    select 1 from public.profiles p where lower(p.email) = v_email
  ) then
    return;
  end if;

  insert into public.account_requests
    (full_name, email, class_section, year_joined, status)
  values
    (v_name, v_email, p_class_section, p_year_joined, 'pending');

exception
  -- Two submissions racing each other: the partial unique index wins and the
  -- loser returns the same silent success as any other duplicate.
  when unique_violation then
    return;
end;
$$;

revoke all on function public.submit_account_request(text, text, public.class_section, integer)
  from public;
grant execute on function public.submit_account_request(text, text, public.class_section, integer)
  to anon, authenticated;

comment on function public.submit_account_request is
  'Public signup entry point. Returns void in every outcome so the form cannot be used to discover whether an address has registered. Creates no auth user, no person and no profile -- only a pending request for School Administration to review.';


-- =============================================================================
-- complete_account_approval — everything the approval creates, atomically
-- =============================================================================
-- Called by a server action, with the service-role client, AFTER that action has
-- verified through the caller's own RLS-backed session that they are School
-- Administration. The auth user is created first by the Auth Admin API (an HTTP
-- call, which cannot participate in this transaction) and its id passed in.
--
-- Everything else lands together or not at all: if any step fails, the approval
-- leaves no half-built identity behind.

create or replace function public.complete_account_approval(
  p_request_id   uuid,
  p_auth_user_id uuid,
  p_actor_id     uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  req       public.account_requests%rowtype;
  v_person  uuid;
  v_slug    text;
begin
  select * into req
  from public.account_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Account request not found.' using errcode = 'P0002';
  end if;

  if req.status <> 'pending' then
    raise exception 'This request has already been reviewed.' using errcode = 'P0001';
  end if;

  v_slug := public.generate_person_slug(req.full_name);

  -- The public identity record, created here and never by the student.
  -- is_public is false: appearing on the public People pages is a later,
  -- deliberate act, not a side effect of being approved.
  insert into public.people (full_name, slug, kind, class_section, year_joined, is_public)
  values (req.full_name, v_slug, 'student', req.class_section, req.year_joined, false)
  returning id into v_person;

  insert into public.profiles (id, person_id, email, status)
  values (p_auth_user_id, v_person, req.email, 'active');

  insert into public.user_roles (user_id, role, granted_by)
  values (p_auth_user_id, 'student', p_actor_id);

  update public.account_requests
     set status       = 'approved',
         reviewed_by  = p_actor_id,
         reviewed_at  = now(),
         auth_user_id = p_auth_user_id
   where id = p_request_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'account.approved', 'account_request', p_request_id,
          jsonb_build_object('person_id', v_person, 'profile_id', p_auth_user_id));

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id)
  values (p_auth_user_id, 'account.approved',
          'Your account has been approved',
          'Your Research Cell account is now active.',
          'profile', p_auth_user_id);

  return v_person;
end;
$$;

revoke all on function public.complete_account_approval(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_account_approval(uuid, uuid, uuid)
  to service_role;


-- =============================================================================
-- decline_account_request
-- =============================================================================
-- A declined request is retained in full, with its reviewer and note. School
-- Administration could perform the update through RLS directly, but the audit
-- entry cannot be written by a client role by design, so the two are kept
-- together here rather than letting a decline go unlogged.

create or replace function public.decline_account_request(
  p_request_id uuid,
  p_actor_id   uuid,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.account_requests%rowtype;
begin
  select * into req from public.account_requests where id = p_request_id for update;

  if not found then
    raise exception 'Account request not found.' using errcode = 'P0002';
  end if;

  if req.status <> 'pending' then
    raise exception 'This request has already been reviewed.' using errcode = 'P0001';
  end if;

  update public.account_requests
     set status      = 'declined',
         reviewed_by = p_actor_id,
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_request_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'account.declined', 'account_request', p_request_id,
          jsonb_build_object('had_note', p_note is not null));
end;
$$;

revoke all on function public.decline_account_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.decline_account_request(uuid, uuid, text)
  to service_role;


-- =============================================================================
-- set_account_status — suspend, reactivate, mark alumni
-- =============================================================================
-- School Administration can already change profiles.status through RLS, but as
-- with decline, the accompanying audit entry cannot be written from a client
-- role. Routing status changes through here keeps the log complete.

create or replace function public.set_account_status(
  p_profile_id uuid,
  p_status     public.account_status,
  p_actor_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.account_status;
begin
  select status into old_status from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;

  update public.profiles set status = p_status where id = p_profile_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'account.status_changed', 'profile', p_profile_id,
          jsonb_build_object('from', old_status, 'to', p_status));

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id)
  values (p_profile_id, 'account.status_changed',
          case p_status
            when 'suspended' then 'Your account has been suspended'
            when 'alumni'    then 'Your account is now an alumni account'
            when 'active'    then 'Your account has been reactivated'
            else 'Your account status has changed'
          end,
          null, 'profile', p_profile_id);
end;
$$;

revoke all on function public.set_account_status(uuid, public.account_status, uuid)
  from public, anon, authenticated;
grant execute on function public.set_account_status(uuid, public.account_status, uuid)
  to service_role;
