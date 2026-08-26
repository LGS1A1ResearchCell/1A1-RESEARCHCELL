-- =============================================================================
-- Seed data
-- =============================================================================
-- Reference data and editable copy only. No accounts, no personal data.
--
-- Official wording has not been supplied by the school, so every content value
-- below is an explicit, visibly-marked placeholder. Nothing here invents
-- Research Cell policy, guidelines or a tagline.
--
-- The Journal I historical backfill (its papers, authors and masthead) is a
-- separate seed, added in the journals phase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Academic years
-- -----------------------------------------------------------------------------
insert into academic_years (label, starts_on, ends_on, is_current) values
  ('2025-26', '2025-08-01', '2026-07-31', true),
  ('2026-27', '2026-08-01', '2027-07-31', false)
on conflict (label) do nothing;

-- -----------------------------------------------------------------------------
-- Subjects
-- -----------------------------------------------------------------------------
-- Drawn from what Journal I actually contains, rather than from an assumption
-- about the Research Cell's scope. Journal I spans environmental science,
-- biomedical AI, public health, neuroscience, international law and cultural
-- anthropology -- so the list is not restricted to scientific subjects, and the
-- schema does not encode such a restriction anywhere.
--
-- Extend this list from the admin interface as new fields appear.
insert into subjects (name, slug, display_order) values
  ('Biology',                  'biology',                  10),
  ('Chemistry',                'chemistry',                20),
  ('Physics',                  'physics',                  30),
  ('Environmental Science',    'environmental-science',    40),
  ('Computer Science',         'computer-science',         50),
  ('Medicine and Health',      'medicine-and-health',      60),
  ('Psychology',               'psychology',               70),
  ('Economics',                'economics',                80),
  ('Law and Governance',       'law-and-governance',       90),
  ('Sociology and Anthropology', 'sociology-and-anthropology', 100),
  ('History',                  'history',                  110),
  ('Literature and Languages', 'literature-and-languages', 120)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Site content
-- -----------------------------------------------------------------------------
-- The tagline is stored here specifically because it is undecided. Whether the
-- Research Cell describes itself as scientific or broader is a live question
-- for the school, and this row is how that answer changes later without a code
-- change or a redeployment.
insert into site_content (key, label, value, format, description) values
  ('site.tagline',
   'Site tagline',
   '[PLACEHOLDER - awaiting school decision]',
   'text',
   'Shown beneath the Research Cell name. Deliberately not hard-coded: whether the Research Cell is described as scientific or as spanning all disciplines is still under discussion.'),

  ('home.hero_heading',
   'Homepage heading',
   '1A1 Research Cell',
   'text',
   'Main heading on the homepage.'),

  ('home.introduction',
   'Homepage introduction',
   '[PLACEHOLDER - awaiting approved wording] An introduction to the 1A1 Research Cell, its purpose and its work.',
   'markdown',
   'Introductory paragraph on the homepage.'),

  ('about.body',
   'About page text',
   '[PLACEHOLDER - awaiting approved wording] About the 1A1 Research Cell at Lahore Grammar School 1-A-1.',
   'markdown',
   'Main body of the About page.'),

  ('about.mission',
   'Mission statement',
   '[PLACEHOLDER - awaiting approved wording]',
   'markdown',
   'Mission statement. Subject to the same open question as the tagline.'),

  ('resources.introduction',
   'Resources page introduction',
   '[PLACEHOLDER - awaiting approved wording]',
   'markdown',
   'Introductory text on the Resources page.'),

  ('contact.email',
   'Contact email address',
   '[PLACEHOLDER - awaiting school email address]',
   'text',
   'Public contact address. No personal address is used; this is set once the school provides an official one.'),

  ('footer.note',
   'Footer note',
   'The 1A1 Research Cell is a student research body of Lahore Grammar School, 1-A-1 branch, Lahore.',
   'text',
   'Short line shown in the site footer.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Resource placeholders
-- -----------------------------------------------------------------------------
-- Structure only. Each row is unpublished and carries placeholder text, so the
-- Resources section can be built and reviewed without inventing guidelines the
-- Research Cell has not written.
insert into resources (category, title, slug, description, body, display_order, is_published) values
  ('guide', 'Research Guide', 'research-guide',
   '[PLACEHOLDER] How to plan and carry out research in the Research Cell.',
   '[PLACEHOLDER - awaiting official Research Cell guidance]', 10, false),

  ('guide', 'Submission Guidelines', 'submission-guidelines',
   '[PLACEHOLDER] What to prepare before submitting a paper.',
   '[PLACEHOLDER - awaiting official Research Cell guidance]', 20, false),

  ('template', 'Paper Template', 'paper-template',
   '[PLACEHOLDER] Formatting template for submissions.',
   '[PLACEHOLDER - awaiting official template]', 30, false),

  ('citation', 'Citation and Referencing', 'citation-and-referencing',
   '[PLACEHOLDER] Referencing guidance. The required citation style is not yet decided.',
   '[PLACEHOLDER - awaiting decision on citation style]', 40, false),

  ('external', 'Useful Research Resources', 'useful-research-resources',
   '[PLACEHOLDER] External databases and reading.',
   '[PLACEHOLDER - awaiting curation]', 50, false),

  ('document', 'Research Cell Documents', 'research-cell-documents',
   '[PLACEHOLDER] Official documents of the Research Cell.',
   '[PLACEHOLDER - awaiting documents]', 60, false),

  ('faq', 'Research FAQ', 'research-faq',
   '[PLACEHOLDER] Frequently asked questions.',
   '[PLACEHOLDER - awaiting content]', 70, false)
on conflict (slug) do nothing;
