-- =============================================================================
-- person_kind gains 'alumni'
-- =============================================================================
-- A permanent contributor may be a former student of the school. 'external' is
-- documented as meaning a contributor from outside the school entirely, so
-- using it for an alumna would be wrong on its own terms and would make her
-- permanently indistinguishable from a genuine outside contributor.
--
-- This is deliberately a migration of its own. PostgreSQL will not let a new
-- enum value be *used* in the same transaction that adds it, and the CLI
-- applies each migration file in one transaction -- so adding the value and
-- inserting a row that uses it must be two files. The next migration is what
-- uses it.
-- =============================================================================

alter type public.person_kind add value if not exists 'alumni';

comment on type public.person_kind is
  'What kind of person a record describes. Faculty and external contributors appear in journal credits but never held accounts; alumni are former students of the school. None of these values implies membership of the Research Cell, which is what people.status records.';
