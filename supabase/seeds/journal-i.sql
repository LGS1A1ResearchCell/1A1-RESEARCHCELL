-- =============================================================================
-- Journal I (2025-26) — historical backfill
-- =============================================================================
-- The real contents of the first Research Cell journal, transcribed from the
-- published PDF.
--
-- NO AUTHENTICATION ACCOUNTS ARE CREATED HERE. Every person below exists only
-- as a `people` row. Authorship references people, never accounts, which is
-- precisely why this backfill is possible at all: these students published
-- before the system existed and most will never hold a login.
--
-- Deliberate omissions, so that nothing is invented:
--
--   class_section  left null. The journal labels two *teams* "A1" and "A2",
--                  which is not the same claim as each member's class. Not
--                  inferred.
--   year_joined    left null. The specification is explicit that this is
--                  entered manually and cannot be derived from a date.
--   abstract       left null. The abstracts exist in the PDF and should be
--                  imported verbatim rather than paraphrased.
--
-- is_public is set true for these people: their names are already published in
-- the journal itself, so their authorship is public record.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------
insert into people (full_name, slug, kind, is_public) values
  -- Primary Research Team
  ('Tazeen Rehman',        'tazeen-rehman',        'student', true),
  ('Meerub Farid',         'meerub-farid',         'student', true),
  ('Malalai Shams',        'malalai-shams',        'student', true),
  ('Haram Luqman',         'haram-luqman',         'student', true),
  ('Marriam Athar',        'marriam-athar',        'student', true),
  ('Swaleha Mehmood',      'swaleha-mehmood',      'student', true),
  ('Zainub Khalid',        'zainub-khalid',        'student', true),
  ('Irha Mudasser',        'irha-mudasser',        'student', true),

  -- Secondary Research Team - A2
  ('Fizza Iftikhar',       'fizza-iftikhar',       'student', true),
  ('Hareem Imran',         'hareem-imran',         'student', true),
  ('Mairah Ahmad Nadeem',  'mairah-ahmad-nadeem',  'student', true),
  ('Manaal Amjad',         'manaal-amjad',         'student', true),
  ('Zarnab Fatima',        'zarnab-fatima',        'student', true),

  -- Secondary Research Team - A1
  ('Meerab Zeeshan',       'meerab-zeeshan',       'student', true),
  ('Samra Shadab',         'samra-shadab',         'student', true),
  ('Wafiyah Awais',        'wafiyah-awais',        'student', true),
  ('Suneha Zaidi',         'suneha-zaidi',         'student', true),
  ('Sarah Bashir',         'sarah-bashir',         'student', true),
  ('Ifrah Asim',           'ifrah-asim',           'student', true),

  -- Independent authors
  ('Amanee Tauseef',       'amanee-tauseef',       'student', true),
  ('Noor Alvi',            'noor-alvi',            'student', true),
  ('Bushra Mehmood Lakho', 'bushra-mehmood-lakho', 'student', true),

  -- Credited, non-authoring
  ('Dr. Natasha Nadeem',   'natasha-nadeem',       'faculty', true),
  ('Amna Iqbal',           'amna-iqbal',           'student', true)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Founding contributors
-- -----------------------------------------------------------------------------
-- The permanent record, kept separate from annual leadership so it can never
-- be rotated out. Bushra Mehmood Lakho appears here as founder AND below as an
-- author and Editor-in-Chief; one person, three distinct records.
-- NOTE ON IDEMPOTENCY: founding_contributors has no unique constraint beyond
-- its primary key, so `on conflict do nothing` would have no arbiter and would
-- silently insert duplicates on a second run. Guarded with NOT EXISTS instead.
-- A unique constraint on (person_id, role_title) would be the better long-term
-- fix and is raised separately for approval.
insert into founding_contributors (person_id, role_title, description, year, display_order)
select p.id, v.role_title, v.description, v.year, v.display_order
from (values
  ('bushra-mehmood-lakho', 'Founder of the Research Cell',
   'Founded the 1A1 Research Cell.', 2025, 10),
  ('wafiyah-awais', 'Website Developer',
   'Creator of the 1A1 Research Cell website.', null::integer, 20)
) as v(slug, role_title, description, year, display_order)
join people p on p.slug = v.slug
where not exists (
  select 1 from founding_contributors fc
  where fc.person_id = p.id and fc.role_title = v.role_title
);

-- -----------------------------------------------------------------------------
-- Journal
-- -----------------------------------------------------------------------------
-- approved_by is deliberately null: Journal I was approved and published before
-- this system existed, so there is no in-system approver to name. approved_at
-- is still required, because a published journal must carry an approval date.
-- This is the historical exception the journals_approved_consistently
-- constraint was relaxed for; new approvals made through the application must
-- still name their approver, which guard_journal_publication enforces.
--
-- NOTE: the date below is a placeholder. The actual approval and publication
-- dates of Journal I are not recorded in the PDF and should be corrected once
-- the school confirms them.
insert into journals (title, volume_label, slug, academic_year_id, status,
                      approved_at, published_at)
select 'Journal I', 'I', 'journal-i', ay.id, 'published',
       '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
from academic_years ay where ay.label = '2025-26'
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Papers
-- -----------------------------------------------------------------------------
insert into research_projects
  (title, slug, research_type, authorship_mode, team_name,
   subject_id, research_area, academic_year_id, status, approved_at)
select v.title, v.slug, v.research_type::research_type, v.mode::authorship_mode,
       v.team_name, s.id, v.research_area, ay.id, 'published', '2026-01-01T00:00:00Z'
from (values
  ('Textile Dye Wastewater Pollution in Lahore: Consequences on Biota and Sustainable Management of Waste-Water',
   'textile-dye-wastewater-pollution-lahore', 'primary', 'team',
   'LGS 1A1 Primary Research Team', 'environmental-science', null),

  ('Breast Cancer and AI: How Accurate is the Prediction of Detecting Developing Breast Cancer with the Help of Artificial Intelligence?',
   'breast-cancer-and-ai', 'secondary', 'team',
   'LGS 1A1 Secondary Research Team - A2', 'medicine-and-health', null),

  ('How do healthcare inequalities affect access to diagnosis and treatment for patients with Fibrodysplasia Ossificans Progressiva (FOP) in developing countries?',
   'healthcare-inequalities-fop', 'secondary', 'team',
   'LGS 1A1 Secondary Research Team - A1', 'medicine-and-health', null),

  ('Sleep and the Brain: Structure, Needs and Risks',
   'sleep-and-the-brain', 'independent', 'individual',
   null, 'biology', 'Cognitive Biology and Restorative Science'),

  ('Corporate Power and the Asymmetry of Global Legal Governance',
   'corporate-power-global-legal-governance', 'independent', 'individual',
   null, 'law-and-governance', 'Transnational Power Dynamics and Legal Order'),

  ('The Weight of Skin: Colorism and Its Impact on South Asian Teenage Boys'' Social Identity and Masculinity',
   'the-weight-of-skin-colorism', 'independent', 'individual',
   null, 'sociology-and-anthropology', 'Cultural Anthropology and Gender Studies')
) as v(title, slug, research_type, mode, team_name, subject_slug, research_area)
left join subjects s on s.slug = v.subject_slug
cross join (select id from academic_years where label = '2025-26') ay
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Authorship
-- -----------------------------------------------------------------------------
-- Team leaders are named as such in the published journal, so the role is part
-- of the historical record, not an inference. All confirmations are recorded as
-- already given: the journal is published, which is confirmation in the only
-- form that existed at the time.
insert into research_authors
  (project_id, person_id, author_role, author_order, confirmation_status, confirmed_at)
select rp.id, pe.id, v.role::author_role, v.ord, 'confirmed', '2026-01-01T00:00:00Z'
from (values
  -- Paper 1
  ('textile-dye-wastewater-pollution-lahore', 'tazeen-rehman',        'team_leader', 1),
  ('textile-dye-wastewater-pollution-lahore', 'meerub-farid',         'co_author',   2),
  ('textile-dye-wastewater-pollution-lahore', 'malalai-shams',        'co_author',   3),
  ('textile-dye-wastewater-pollution-lahore', 'haram-luqman',         'co_author',   4),
  ('textile-dye-wastewater-pollution-lahore', 'marriam-athar',        'co_author',   5),
  ('textile-dye-wastewater-pollution-lahore', 'swaleha-mehmood',      'co_author',   6),
  ('textile-dye-wastewater-pollution-lahore', 'zainub-khalid',        'co_author',   7),
  ('textile-dye-wastewater-pollution-lahore', 'irha-mudasser',        'co_author',   8),

  -- Paper 2
  ('breast-cancer-and-ai', 'fizza-iftikhar',      'team_leader', 1),
  ('breast-cancer-and-ai', 'hareem-imran',        'co_author',   2),
  ('breast-cancer-and-ai', 'mairah-ahmad-nadeem', 'co_author',   3),
  ('breast-cancer-and-ai', 'manaal-amjad',        'co_author',   4),
  ('breast-cancer-and-ai', 'zarnab-fatima',       'co_author',   5),

  -- Paper 3
  ('healthcare-inequalities-fop', 'meerab-zeeshan', 'team_leader', 1),
  ('healthcare-inequalities-fop', 'samra-shadab',   'co_author',   2),
  ('healthcare-inequalities-fop', 'wafiyah-awais',  'co_author',   3),
  ('healthcare-inequalities-fop', 'suneha-zaidi',   'co_author',   4),
  ('healthcare-inequalities-fop', 'sarah-bashir',   'co_author',   5),
  ('healthcare-inequalities-fop', 'ifrah-asim',     'co_author',   6),

  -- Independent papers
  ('sleep-and-the-brain',                     'amanee-tauseef',       'sole_author', 1),
  ('corporate-power-global-legal-governance', 'noor-alvi',            'sole_author', 1),
  ('the-weight-of-skin-colorism',             'bushra-mehmood-lakho', 'sole_author', 1)
) as v(project_slug, person_slug, role, ord)
join research_projects rp on rp.slug = v.project_slug
join people pe on pe.slug = v.person_slug
on conflict (project_id, person_id) do nothing;

-- -----------------------------------------------------------------------------
-- Journal contents
-- -----------------------------------------------------------------------------
insert into journal_papers (journal_id, project_id, display_order, start_page, end_page)
select j.id, rp.id, v.ord, v.start_page, v.end_page
from (values
  ('textile-dye-wastewater-pollution-lahore',  1,  1,  7),
  ('breast-cancer-and-ai',                     2,  8, 17),
  ('healthcare-inequalities-fop',              3, 18, 30),
  ('sleep-and-the-brain',                      4, 31, 34),
  ('corporate-power-global-legal-governance',  5, 35, 41),
  ('the-weight-of-skin-colorism',              6, 42, 47)
) as v(project_slug, ord, start_page, end_page)
join research_projects rp on rp.slug = v.project_slug
cross join (select id from journals where slug = 'journal-i') j
on conflict (journal_id, project_id) do nothing;

-- -----------------------------------------------------------------------------
-- Editorial masthead (page 48)
-- -----------------------------------------------------------------------------
-- Frozen to this issue. These credits are independent of the leadership table
-- and must not change when a new Head of Research is appointed.
insert into journal_credits (journal_id, person_id, credit_title, display_order)
select j.id, pe.id, v.credit_title, v.ord
from (values
  ('bushra-mehmood-lakho', 'Editor-in-Chief',   1),
  ('noor-alvi',            'Associate Editor',  2),
  ('natasha-nadeem',       'Mentor',            3),
  ('amna-iqbal',           'Graphics Designer', 4)
) as v(person_slug, credit_title, ord)
join people pe on pe.slug = v.person_slug
cross join (select id from journals where slug = 'journal-i') j
on conflict (journal_id, person_id, credit_title) do nothing;

commit;
