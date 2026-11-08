-- SABAK+ v0.12: скорость. Выполнять после schema_v8.sql. Можно запускать повторно.
-- Что делает:
--  1) индексы для самых частых запросов;
--  2) правила чтения (RLS) считают «какие ученики мне видны» один раз на запрос, а не для каждой строки (было: 19 секунд на 150 000 оценок);
--  3) sync_stamp(): крошечный запрос «что-то изменилось?», чтобы приложение не перекачивало все данные каждую минуту.

-- 1) индексы
create index if not exists attendance_school_date on public.attendance (school_id, date);
create index if not exists parent_students_student on public.parent_students (student_id);
create index if not exists teacher_assignments_teacher on public.teacher_assignments (teacher_id, class_id);
create index if not exists classes_homeroom on public.classes (homeroom_id) where homeroom_id is not null;
create index if not exists homework_class on public.homework (school_id, class_id);
create index if not exists homework_done_student on public.homework_done (student_id);
create index if not exists grades_school_student_date on public.grades (school_id, student_id, date);

-- 2) видимые ученики: одно множество на запрос
create or replace function public.visible_student_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from public.students s
  where s.school_id = (select public.my_school())
    and ( (select public.is_admin())
          or s.class_id in (select class_id from public.teacher_assignments where teacher_id = auth.uid()
                            union select id from public.classes where homeroom_id = auth.uid())
          or s.id in (select student_id from public.parent_students where parent_id = auth.uid())
          or s.profile_id = auth.uid() ) $$;
revoke execute on function public.visible_student_ids() from public, anon;
grant execute on function public.visible_student_ids() to authenticated;

drop policy if exists students_read on public.students;
create policy students_read on public.students for select using (id in (select public.visible_student_ids()));
drop policy if exists grades_read on public.grades;
create policy grades_read on public.grades for select using (school_id = (select public.my_school()) and student_id in (select public.visible_student_ids()));
drop policy if exists att_read on public.attendance;
create policy att_read on public.attendance for select using (school_id = (select public.my_school()) and student_id in (select public.visible_student_ids()));
drop policy if exists hwd_read on public.homework_done;
create policy hwd_read on public.homework_done for select using (school_id = (select public.my_school()) and student_id in (select public.visible_student_ids()));
drop policy if exists sa_read on public.student_achievements;
create policy sa_read on public.student_achievements for select using (student_id in (select public.visible_student_ids()));

-- 3) «что-то изменилось?»: счётчик изменений на школу, обновляется один раз на запрос (не на строку)
create table if not exists public.school_sync (school_id uuid primary key references public.schools(id) on delete cascade, stamp bigint not null default 1, at timestamptz not null default now());
alter table public.school_sync enable row level security;
create or replace function public._bump_new() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.school_sync(school_id, stamp) select distinct school_id, 1 from nt where school_id is not null
  on conflict (school_id) do update set stamp = public.school_sync.stamp + 1, at = now();
  return null;
end $$;
create or replace function public._bump_old() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.school_sync(school_id, stamp) select distinct school_id, 1 from ot where school_id is not null
  on conflict (school_id) do update set stamp = public.school_sync.stamp + 1, at = now();
  return null;
end $$;
do $$ declare t text;
begin
  foreach t in array array['grades','attendance','homework','homework_done','students','classes','teacher_assignments','news','lesson_notes','student_achievements','schedule_versions'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists sync_bump_i on public.%I', t);
    execute format('drop trigger if exists sync_bump_u on public.%I', t);
    execute format('drop trigger if exists sync_bump_d on public.%I', t);
    execute format('create trigger sync_bump_i after insert on public.%I referencing new table as nt for each statement execute function public._bump_new()', t);
    execute format('create trigger sync_bump_u after update on public.%I referencing new table as nt for each statement execute function public._bump_new()', t);
    execute format('create trigger sync_bump_d after delete on public.%I referencing old table as ot for each statement execute function public._bump_old()', t);
  end loop;
end $$;

create or replace function public.sync_stamp() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    's', coalesce((select stamp from public.school_sync where school_id = (select public.my_school())), 0),
    'n', (select count(*) filter (where not read) || ':' || coalesce(extract(epoch from max(created_at))::bigint, 0) from public.notifications where to_user = auth.uid())) $$;
revoke execute on function public.sync_stamp() from public, anon;
grant execute on function public.sync_stamp() to authenticated;
analyze;
