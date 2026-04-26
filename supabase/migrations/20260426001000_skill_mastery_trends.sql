begin;

create table if not exists public.user_skill_mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_attempt_id uuid references public.user_lesson_attempts(id) on delete set null,
  skill_category_id text not null references public.skill_categories(id) on delete restrict,
  lesson_score numeric(5,2) not null check (lesson_score >= 0 and lesson_score <= 100),
  previous_mastery_score numeric(5,2) not null check (previous_mastery_score >= 0 and previous_mastery_score <= 100),
  new_mastery_score numeric(5,2) not null check (new_mastery_score >= 0 and new_mastery_score <= 100),
  previous_confidence numeric(5,2) not null check (previous_confidence >= 0 and previous_confidence <= 100),
  new_confidence numeric(5,2) not null check (new_confidence >= 0 and new_confidence <= 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_usme_user_skill_time
  on public.user_skill_mastery_events(user_id, skill_category_id, created_at desc);

alter table public.user_skill_mastery_events enable row level security;

drop policy if exists "read own skill mastery events" on public.user_skill_mastery_events;
drop policy if exists "insert own skill mastery events" on public.user_skill_mastery_events;

create policy "read own skill mastery events"
  on public.user_skill_mastery_events
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own skill mastery events"
  on public.user_skill_mastery_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

commit;
