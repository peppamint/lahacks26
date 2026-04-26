-- Lesson content + question analytics schema
-- Designed for flexibility: lookup tables, mapping tables, soft-delete via is_active.

begin;

-- 1) Skill categories (stable IDs + editable labels)
create table if not exists public.skill_categories (
  id text primary key,
  label text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Question types (lookup table instead of enum for future flexibility)
create table if not exists public.question_types (
  id text primary key,
  label text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Question type -> skill category many-to-many mapping
create table if not exists public.question_type_skill_categories (
  question_type_id text not null references public.question_types(id) on delete restrict,
  skill_category_id text not null references public.skill_categories(id) on delete restrict,
  weight numeric(4,2) not null default 1.00 check (weight > 0),
  created_at timestamptz not null default now(),
  primary key (question_type_id, skill_category_id)
);

-- 4) Lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  lesson_type text not null check (lesson_type in ('micro', 'macro')),
  min_reading_level text not null,
  max_reading_level text not null,
  base_difficulty numeric(4,2) not null default 0.50 check (base_difficulty >= 0 and base_difficulty <= 1),
  is_published boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) Passages within lessons
create table if not exists public.lesson_passages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  passage_order int not null check (passage_order > 0),
  title text,
  content text not null,
  difficulty numeric(4,2) not null default 0.50 check (difficulty >= 0 and difficulty <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, passage_order)
);

-- 6) Question bank
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  passage_id uuid references public.lesson_passages(id) on delete set null,
  question_order int not null default 1 check (question_order > 0),
  question_type_id text not null references public.question_types(id) on delete restrict,
  prompt text not null,
  choices jsonb,
  answer_key jsonb not null,
  explanation text,
  difficulty numeric(4,2) not null default 0.50 check (difficulty >= 0 and difficulty <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7) User lesson attempts (one row per session)
create table if not exists public.user_lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  assigned_difficulty numeric(4,2) not null check (assigned_difficulty >= 0 and assigned_difficulty <= 1),
  overall_score numeric(5,2) check (overall_score >= 0 and overall_score <= 100),
  reading_level_at_attempt text not null,
  created_at timestamptz not null default now()
);

-- 8) User question attempts (immutable event-like log)
create table if not exists public.user_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_attempt_id uuid not null references public.user_lesson_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  response jsonb,
  is_correct boolean,
  score numeric(5,2) check (score >= 0 and score <= 100),
  response_time_ms int check (response_time_ms is null or response_time_ms >= 0),
  attempted_at timestamptz not null default now()
);

-- 9) Rolling mastery by skill category
create table if not exists public.user_skill_mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_category_id text not null references public.skill_categories(id) on delete restrict,
  mastery_score numeric(5,2) not null default 0 check (mastery_score >= 0 and mastery_score <= 100),
  confidence numeric(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  last_updated_at timestamptz not null default now(),
  primary key (user_id, skill_category_id)
);

-- Useful indexes
create index if not exists idx_lessons_active_published on public.lessons(is_active, is_published);
create index if not exists idx_questions_lesson on public.questions(lesson_id);
create index if not exists idx_questions_passage on public.questions(passage_id);
create index if not exists idx_uqa_user_time on public.user_question_attempts(user_id, attempted_at desc);
create index if not exists idx_ula_user_time on public.user_lesson_attempts(user_id, started_at desc);
create index if not exists idx_qtsc_skill on public.question_type_skill_categories(skill_category_id);

-- Seed skill categories
insert into public.skill_categories (id, label, description)
values
  ('active_self_regulation', 'Active Self-Regulation', 'Planning, monitoring, and purpose-driven reading strategies.'),
  ('word_recognition', 'Word Recognition', 'Decoding and identifying words from print and audio cues.'),
  ('language_comprehension', 'Language Comprehension', 'Understanding sentence-level and discourse-level meaning.'),
  ('bridging_processes', 'Bridging Processes', 'Connecting vocabulary and fluency to integrated understanding.')
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  updated_at = now();

-- Seed question types
insert into public.question_types (id, label, description)
values
  ('predict_content_from_headings', 'Predict Content from Headings', 'Predict upcoming text using titles/headings.'),
  ('summarize_text', 'Summarize Text', 'Summarize key information from a passage.'),
  ('identify_main_idea', 'Identify Main Idea', 'Determine the central idea of a passage.'),
  ('identify_authors_purpose', 'Identify Author''s Purpose', 'Determine why the author wrote the text.'),
  ('identify_intended_audience', 'Identify Intended Audience', 'Identify who the text is written for.'),
  ('reading_chunking_strategy', 'Reading Using Chunking Strategy', 'Read by chunking text into meaningful units.'),
  ('break_words_into_syllables', 'Break Words into Syllables', 'Split words into syllables for decoding.'),
  ('identify_written_words_from_audio', 'Identify Written Words in an Audio Passage', 'Match spoken words to written form.'),
  ('identify_figurative_language_meaning', 'Identify Meaning of Figurative Language', 'Interpret figurative expressions in context.'),
  ('identify_intertextual_relationships', 'Identify Intertextual Relationships', 'Identify relations like cause/effect and contrast.'),
  ('identify_vocabulary_meaning', 'Identify Vocabulary and Meanings', 'Determine word meanings in context.'),
  ('reading_fluency_test', 'Reading Fluency Test', 'Assess pacing, accuracy, and flow of oral reading.')
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  updated_at = now();

-- Seed type -> category mappings
insert into public.question_type_skill_categories (question_type_id, skill_category_id, weight)
values
  ('predict_content_from_headings', 'active_self_regulation', 1.00),
  ('summarize_text', 'active_self_regulation', 1.00),
  ('identify_main_idea', 'active_self_regulation', 1.00),
  ('identify_authors_purpose', 'active_self_regulation', 1.00),
  ('identify_intended_audience', 'active_self_regulation', 1.00),
  ('reading_chunking_strategy', 'active_self_regulation', 0.50),
  ('reading_chunking_strategy', 'language_comprehension', 0.50),
  ('break_words_into_syllables', 'word_recognition', 1.00),
  ('identify_written_words_from_audio', 'word_recognition', 1.00),
  ('identify_figurative_language_meaning', 'language_comprehension', 1.00),
  ('identify_intertextual_relationships', 'language_comprehension', 1.00),
  ('identify_vocabulary_meaning', 'bridging_processes', 1.00),
  ('reading_fluency_test', 'bridging_processes', 1.00)
on conflict (question_type_id, skill_category_id) do update set
  weight = excluded.weight;

commit;
