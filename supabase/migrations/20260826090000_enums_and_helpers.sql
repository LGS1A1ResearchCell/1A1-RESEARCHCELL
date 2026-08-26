-- =============================================================================
-- 1A1 Research Cell — enumerated types and shared helpers
-- =============================================================================
-- Enums are used where the set of values is fixed by policy and a wrong value
-- would be a bug (roles, statuses, decisions). Where the school may reasonably
-- invent new values later without a code change -- journal credit titles,
-- research areas -- plain text is used instead.
-- =============================================================================

-- Permission levels. Exactly three, as specified. "Team Leader" is deliberately
-- absent: it is a per-project role recorded on research_authors, not a
-- privilege level.
create type app_role as enum (
  'student',
  'leadership',      -- Head / Deputy Head of Research
  'school_admin'
);

-- Class sections within the 1-A-1 branch.
create type class_section as enum ('A1', 'A2');

-- What kind of person a record describes. Faculty and external contributors
-- appear in journal credits but never hold accounts.
create type person_kind as enum ('student', 'faculty', 'external');

-- Account lifecycle. 'pending' is the state a new sign-up enters and is the
-- reason a student cannot act before administration review.
create type account_status as enum (
  'pending',
  'active',
  'suspended',
  'alumni'
);

-- Research classification, matching the taxonomy already used in Journal I.
create type research_type as enum ('primary', 'secondary', 'independent');

-- Individual vs team is a separate axis from research_type: Journal I contains
-- both a primary *team* paper and independent *individual* papers.
create type authorship_mode as enum ('individual', 'team');

create type project_status as enum (
  'draft',
  'awaiting_author_confirmation',
  'submitted',
  'under_review',
  'revision_required',
  'approved',            -- eligible for inclusion in a journal
  'published'            -- included in a journal that administration published
);

-- Per-project authorship role. The team leader is the student who initiated the
-- submission and is the only author who may modify it.
create type author_role as enum ('sole_author', 'team_leader', 'co_author');

create type confirmation_status as enum ('pending', 'confirmed', 'declined');

-- Review outcomes. There is deliberately no rejection option.
create type review_decision as enum ('revision_required', 'approved');

create type journal_status as enum (
  'draft',
  'pending_admin_approval',
  'published'
);

create type leadership_role as enum (
  'head_of_research',
  'deputy_head_of_research'
);

create type authorship_change as enum ('added', 'removed');

create type site_content_format as enum ('text', 'markdown', 'html');

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function set_updated_at is
  'Trigger function that stamps updated_at on any row being modified.';
