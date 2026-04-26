begin;

alter table public.questions
  add column if not exists interaction_mode text not null default 'mcq';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_interaction_mode_check'
  ) then
    alter table public.questions
      add constraint questions_interaction_mode_check
      check (interaction_mode in ('mcq', 'text', 'speech', 'hybrid'));
  end if;
end $$;

update public.questions
set interaction_mode = case
  when question_type_id in ('reading_fluency_test', 'reading_chunking_strategy', 'identify_written_words_from_audio')
    then 'speech'
  when question_type_id in ('summarize_text')
    then 'text'
  else 'mcq'
end
where interaction_mode is null or interaction_mode = 'mcq';

commit;
