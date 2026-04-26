-- RLS policies for lesson schema tables
-- Apply after schema migration 20260425230500_lesson_schema.sql

begin;

-- Enable RLS
alter table public.skill_categories enable row level security;
alter table public.question_types enable row level security;
alter table public.question_type_skill_categories enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_passages enable row level security;
alter table public.questions enable row level security;
alter table public.user_lesson_attempts enable row level security;
alter table public.user_question_attempts enable row level security;
alter table public.user_skill_mastery enable row level security;

-- Clear existing policies if re-running.
drop policy if exists "read active skill categories" on public.skill_categories;
drop policy if exists "read active question types" on public.question_types;
drop policy if exists "read question type mappings" on public.question_type_skill_categories;
drop policy if exists "read published lessons" on public.lessons;
drop policy if exists "read published passages" on public.lesson_passages;
drop policy if exists "read published questions" on public.questions;
drop policy if exists "read own lesson attempts" on public.user_lesson_attempts;
drop policy if exists "insert own lesson attempts" on public.user_lesson_attempts;
drop policy if exists "update own lesson attempts" on public.user_lesson_attempts;
drop policy if exists "read own question attempts" on public.user_question_attempts;
drop policy if exists "insert own question attempts" on public.user_question_attempts;
drop policy if exists "read own skill mastery" on public.user_skill_mastery;
drop policy if exists "insert own skill mastery" on public.user_skill_mastery;
drop policy if exists "update own skill mastery" on public.user_skill_mastery;

-- Content tables: read-only from client; writes should use service role/admin tooling.
create policy "read active skill categories"
  on public.skill_categories
  for select
  to authenticated
  using (is_active = true);

create policy "read active question types"
  on public.question_types
  for select
  to authenticated
  using (is_active = true);

create policy "read question type mappings"
  on public.question_type_skill_categories
  for select
  to authenticated
  using (true);

create policy "read published lessons"
  on public.lessons
  for select
  to authenticated
  using (is_active = true and is_published = true);

create policy "read published passages"
  on public.lesson_passages
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.lessons l
      where l.id = lesson_passages.lesson_id
        and l.is_active = true
        and l.is_published = true
    )
  );

create policy "read published questions"
  on public.questions
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.lessons l
      where l.id = questions.lesson_id
        and l.is_active = true
        and l.is_published = true
    )
  );

-- User attempt tables: each user can only read/write their own rows.
create policy "read own lesson attempts"
  on public.user_lesson_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own lesson attempts"
  on public.user_lesson_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own lesson attempts"
  on public.user_lesson_attempts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "read own question attempts"
  on public.user_question_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own question attempts"
  on public.user_question_attempts
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_lesson_attempts ula
      where ula.id = user_question_attempts.lesson_attempt_id
        and ula.user_id = auth.uid()
    )
  );

create policy "read own skill mastery"
  on public.user_skill_mastery
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own skill mastery"
  on public.user_skill_mastery
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own skill mastery"
  on public.user_skill_mastery
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
