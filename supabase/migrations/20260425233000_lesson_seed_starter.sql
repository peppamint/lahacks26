-- Starter seed dataset for server-backed lesson fetching.
-- Safe to run multiple times.

begin;

-- Lesson 1 (micro)
insert into public.lessons (
  slug,
  title,
  description,
  lesson_type,
  min_reading_level,
  max_reading_level,
  base_difficulty,
  is_published,
  is_active
)
values (
  'lesson-1',
  'Budget Basics for Daily Life',
  'Short practical reading for everyday budgeting decisions.',
  'micro',
  'grade3',
  'grade8',
  0.35,
  true,
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  lesson_type = excluded.lesson_type,
  min_reading_level = excluded.min_reading_level,
  max_reading_level = excluded.max_reading_level,
  base_difficulty = excluded.base_difficulty,
  is_published = excluded.is_published,
  is_active = excluded.is_active,
  updated_at = now();

-- Lesson 2 (macro)
insert into public.lessons (
  slug,
  title,
  description,
  lesson_type,
  min_reading_level,
  max_reading_level,
  base_difficulty,
  is_published,
  is_active
)
values (
  'lesson-2',
  'Reading for Work Schedules',
  'Multi-passage practice for reading shift messages and schedule updates.',
  'macro',
  'grade5',
  'adult',
  0.52,
  true,
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  lesson_type = excluded.lesson_type,
  min_reading_level = excluded.min_reading_level,
  max_reading_level = excluded.max_reading_level,
  base_difficulty = excluded.base_difficulty,
  is_published = excluded.is_published,
  is_active = excluded.is_active,
  updated_at = now();

-- Passages
with lesson_ids as (
  select id, slug from public.lessons where slug in ('lesson-1', 'lesson-2')
)
insert into public.lesson_passages (lesson_id, passage_order, title, content, difficulty, is_active)
values
  (
    (select id from lesson_ids where slug = 'lesson-1'),
    1,
    'Comparing Grocery Prices',
    'Kayla compares two bags of rice at the store. One bag costs six dollars for two pounds. The other costs eight dollars for three pounds. She reads the labels carefully and chooses the better value for her budget.',
    0.35,
    true
  ),
  (
    (select id from lesson_ids where slug = 'lesson-2'),
    1,
    'Schedule Update Message',
    'A manager sends a message: Team, Friday shifts start one hour earlier this week. Please arrive by 8:00 AM and check the new station assignments on the board. Reply before Thursday noon if you need a change.',
    0.50,
    true
  ),
  (
    (select id from lesson_ids where slug = 'lesson-2'),
    2,
    'Follow-up Confirmation',
    'Luis reads the message again and writes down the time, date, and station number. He texts his supervisor to confirm he can arrive early. Then he updates his phone calendar so he does not forget.',
    0.55,
    true
  )
on conflict (lesson_id, passage_order) do update
set
  title = excluded.title,
  content = excluded.content,
  difficulty = excluded.difficulty,
  is_active = excluded.is_active,
  updated_at = now();

-- Questions
with lesson_context as (
  select
    l.id as lesson_id,
    l.slug,
    p.id as passage_id,
    p.passage_order
  from public.lessons l
  join public.lesson_passages p on p.lesson_id = l.id
  where l.slug in ('lesson-1', 'lesson-2')
)
insert into public.questions (
  lesson_id,
  passage_id,
  question_order,
  question_type_id,
  interaction_mode,
  prompt,
  choices,
  answer_key,
  explanation,
  difficulty,
  is_active
)
values
  (
    (select lesson_id from lesson_context where slug = 'lesson-1' and passage_order = 1),
    (select passage_id from lesson_context where slug = 'lesson-1' and passage_order = 1),
    1,
    'identify_main_idea',
    'mcq',
    'What is the main idea of this passage?',
    '["Kayla is shopping for clothes.","Kayla compares prices to choose the best value.","Kayla forgets her budget.","Kayla buys both bags of rice."]'::jsonb,
    '{"correctIndex": 1}'::jsonb,
    'The passage focuses on comparing price and quantity to choose better value.',
    0.35,
    true
  ),
  (
    (select lesson_id from lesson_context where slug = 'lesson-2' and passage_order = 1),
    (select passage_id from lesson_context where slug = 'lesson-2' and passage_order = 1),
    1,
    'identify_authors_purpose',
    'mcq',
    'Why did the manager send this message?',
    '["To invite the team to lunch","To share a story","To communicate a schedule change and instructions","To complain about attendance"]'::jsonb,
    '{"correctIndex": 2}'::jsonb,
    'The manager is giving clear instructions about a schedule change.',
    0.50,
    true
  ),
  (
    (select lesson_id from lesson_context where slug = 'lesson-2' and passage_order = 2),
    (select passage_id from lesson_context where slug = 'lesson-2' and passage_order = 2),
    2,
    'summarize_text',
    'text',
    'Which summary best matches the follow-up passage?',
    '["Luis ignores the message.","Luis confirms details and updates his calendar.","Luis asks a coworker to skip the shift.","Luis deletes his messages."]'::jsonb,
    '{"correctIndex": 1}'::jsonb,
    'Luis reviews details, confirms availability, and records the schedule.',
    0.55,
    true
  )
on conflict do nothing;

commit;
