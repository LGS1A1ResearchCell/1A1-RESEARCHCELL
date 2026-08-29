-- =============================================================================
-- Phase 3 — profiles, visibility and leadership history
-- =============================================================================
-- One decision governs this file: publishing a student's profile is School
-- Administration's call and nobody else's.
--
-- That was not previously enforced. people_self_update allows a student to
-- update their own row, and Row Level Security controls rows rather than
-- columns -- so is_public was self-editable by omission, never by decision. A
-- student could publish their own name and photograph with no adult involved.
-- The guard below closes that.
--
-- The same guard protects the identity fields. A student manages how they are
-- presented -- their photograph, how it is cropped, their quote. They do not
-- manage who they are: name, class and year joined are recorded when the
-- account is approved and are administration's to correct.
-- =============================================================================


-- =============================================================================
-- Column guard on people
-- =============================================================================

create or replace function public.guard_people_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Migrations, seeds and the service-role client, which already bypass RLS.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_school_admin() then
    return new;
  end if;

  -- Publication of a child's name and photograph is a safeguarding decision.
  if new.is_public is distinct from old.is_public then
    raise exception
      'Only School Administration may change whether a profile is publicly visible.'
      using errcode = '42501';
  end if;

  -- Identity, as opposed to presentation. Set at approval from the registration
  -- the student submitted, and corrected only by administration.
  if new.full_name     is distinct from old.full_name
     or new.slug          is distinct from old.slug
     or new.kind          is distinct from old.kind
     or new.class_section is distinct from old.class_section
     or new.year_joined   is distinct from old.year_joined then
    raise exception
      'Your name, class and year joined are set by school administration and cannot be changed here.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger people_guard_columns
  before update on public.people
  for each row execute function public.guard_people_columns();

comment on function public.guard_people_columns is
  'Row Level Security decides which rows may be written, not which columns. This restricts a student editing their own people row to presentation only -- photograph, crop position and quote -- leaving visibility and identity to School Administration.';


-- =============================================================================
-- set_profile_visibility
-- =============================================================================
-- The one route by which a profile becomes public. Granted to service_role
-- alone and called from a server action that has already confirmed, through the
-- caller's own session, that they are School Administration.
--
-- Every change is logged, because "who published this child's photograph, and
-- when" is exactly the question a school needs to be able to answer.

create or replace function public.set_profile_visibility(
  p_person_id uuid,
  p_is_public boolean,
  p_actor_id  uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_value boolean;
  v_name    text;
begin
  select is_public, full_name into old_value, v_name
  from public.people where id = p_person_id;

  if not found then
    raise exception 'Person not found.' using errcode = 'P0002';
  end if;

  if old_value is not distinct from p_is_public then
    return;
  end if;

  update public.people set is_public = p_is_public where id = p_person_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'profile.visibility_changed', 'person', p_person_id,
          jsonb_build_object('from', old_value, 'to', p_is_public, 'name', v_name));
end;
$$;

revoke all on function public.set_profile_visibility(uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.set_profile_visibility(uuid, boolean, uuid)
  to service_role;


-- =============================================================================
-- Leadership
-- =============================================================================
-- Head and Deputy Head of Research are annual appointments. Assigning one is
-- already restricted to School Administration by leadership_admin_write; this
-- function exists so the change is audited, which a client role cannot do.
--
-- Previous years are never touched: a new appointment is a new row for a new
-- academic year, and the history stays queryable.

create or replace function public.assign_leadership(
  p_person_id        uuid,
  p_role             public.leadership_role,
  p_academic_year_id uuid,
  p_actor_id         uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_previous  uuid;
  v_year      text;
begin
  select label into v_year from public.academic_years where id = p_academic_year_id;
  if v_year is null then
    raise exception 'Academic year not found.' using errcode = 'P0002';
  end if;

  -- One holder per role per year. Replacing the holder is a correction, so the
  -- previous person is recorded in the audit entry rather than silently lost.
  select person_id into v_previous
  from public.leadership
  where academic_year_id = p_academic_year_id and role = p_role;

  insert into public.leadership (person_id, role, academic_year_id, appointed_by)
  values (p_person_id, p_role, p_academic_year_id, p_actor_id)
  on conflict (academic_year_id, role)
  do update set person_id = excluded.person_id, appointed_by = excluded.appointed_by
  returning id into v_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'leadership.assigned', 'leadership', v_id,
          jsonb_build_object('role', p_role, 'academic_year', v_year,
                             'person_id', p_person_id, 'replaced', v_previous));

  return v_id;
end;
$$;

revoke all on function public.assign_leadership(uuid, public.leadership_role, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_leadership(uuid, public.leadership_role, uuid, uuid)
  to service_role;


-- =============================================================================
-- Public directory view
-- =============================================================================
-- The public People pages need each person with their published work attached.
-- Expressed as a view so the join lives in one place rather than being rebuilt
-- in every page that needs it.
--
-- security_invoker means the view is evaluated with the caller's own rights, so
-- people_public_read still applies and an anonymous visitor sees only public
-- profiles. Without it a view would run as its owner and quietly bypass RLS.

create or replace view public.public_researchers
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
  pe.photo_path,
  pe.photo_focal_x,
  pe.photo_focal_y,
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
  'Public People directory. security_invoker keeps Row Level Security in force, so this exposes exactly the rows people_public_read already allows.';

grant select on public.public_researchers to anon, authenticated;
