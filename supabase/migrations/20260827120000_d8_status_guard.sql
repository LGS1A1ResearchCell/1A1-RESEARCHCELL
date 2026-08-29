-- =============================================================================
-- D8 — set_account_status was blocked by its own guard
-- =============================================================================
-- guard_profile_columns refuses any change to profiles.status unless
-- is_school_admin() is true, and that requires a live session. set_account_status
-- is SECURITY DEFINER, granted to service_role alone, and is called from a server
-- action where auth.uid() is null -- so is_school_admin() returned false and the
-- guard rejected the very function written to perform the change. Suspending,
-- reactivating and marking an account alumni were all non-functional.
--
-- The fix is the same null-session exemption every guard in
-- 20260827100000_phase1_fixes.sql already carries. This one was written in Phase 1,
-- before that pattern existed, and was missed when the others were updated.
--
-- It grants nothing new. A caller holding the service-role key already bypasses
-- Row Level Security completely and could UPDATE profiles directly; the guard
-- never stood between them and this column. What actually restricts the change
-- is unchanged on both sides:
--
--   * set_account_status is granted to service_role and to nobody else, and
--   * the server action calling it first verifies, through the caller's OWN
--     RLS-backed session, that they are School Administration.
--
-- The guard continues to do its real job untouched: stopping a student who is
-- permitted to update their own profile row from editing status, email or
-- person_id within it.
-- =============================================================================

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Migrations, seeds and the service-role client. These contexts already
  -- bypass Row Level Security, so the guard adds no protection here and only
  -- blocks legitimate administrative routines.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_school_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only School Administration may change account status.'
        using errcode = '42501';
    end if;
    if new.person_id is distinct from old.person_id then
      raise exception 'A profile cannot be reassigned to a different person.'
        using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email changes must go through account administration.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
