-- SABAK+ v0.14: защита, резервные копии, согласие. Выполнять после schema_v10.sql. Можно запускать повторно.
--  1) news: сервер отклоняет опасную разметку, даже если её прислали в обход приложения;
--  2) school_export: выгрузка всех данных школы кусками (резервная копия для директора, работает и на бесплатном тарифе);
--  3) consents: журнал согласия с политикой конфиденциальности.

-- 1) опасная разметка в новостях
create or replace function public._bad_html() returns trigger language plpgsql as $$
begin
  if new.fmt = 'html' and new.body ~* '(<\s*/?\s*(script|iframe|object|embed|svg|math|style|link|meta|form|input|button|img|video|audio|base)\b|\mon[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text/html|expression\s*\()' then
    raise exception 'Недопустимая разметка в тексте новости' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists news_bad_html on public.news;
create trigger news_bad_html before insert or update of body, fmt on public.news for each row execute function public._bad_html();

-- 2) выгрузка данных школы. Часть за частью, чтобы не упираться в лимиты размера ответа.
create or replace function public.school_export(p_part text, p_offset int default 0, p_limit int default 20000, p_school uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sc uuid; rows jsonb; n int; lim int := least(greatest(coalesce(p_limit, 20000), 1), 50000); off int := greatest(coalesce(p_offset, 0), 0);
begin
  if public.is_super() then sc := p_school;
  elsif public.my_role() = 'director' then sc := public.my_school();
  else return public._err('forbidden'); end if;
  if sc is null then return public._err('fields'); end if;
  if p_part = 'school' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select id, name, city, code, created_at from public.schools where id = sc) t;
  elsif p_part = 'people' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select id, role, status, full_name, birth_date, gender, phone, created_at from public.profiles where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'classes' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.classes where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'students' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.students where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'assignments' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.teacher_assignments where school_id = sc order by teacher_id, class_id offset off limit lim) t;
  elsif p_part = 'grades' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.grades where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'attendance' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.attendance where school_id = sc order by student_id, date offset off limit lim) t;
  elsif p_part = 'homework' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.homework where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'archive' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.quarter_archive where school_id = sc order by id offset off limit lim) t;
  elsif p_part = 'past' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.past_grades where school_id = sc order by student_id offset off limit lim) t;
  elsif p_part = 'news' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]') into rows from (select * from public.news where school_id = sc and not deleted order by created_at offset off limit lim) t;
  else return public._err('fields'); end if;
  n := jsonb_array_length(rows);
  perform public.log_audit('school.export', jsonb_build_object('part', p_part, 'n', n));
  return jsonb_build_object('ok', true, 'part', p_part, 'rows', rows, 'n', n, 'next', case when n = lim then off + lim else null end);
end $$;
revoke execute on function public.school_export(text, int, int, uuid) from public, anon;
grant execute on function public.school_export(text, int, int, uuid) to authenticated;

-- 3) согласие с политикой
create table if not exists public.consents (user_id uuid not null references auth.users(id) on delete cascade, version text not null, accepted_at timestamptz not null default now(), primary key (user_id, version));
alter table public.consents enable row level security;
create or replace function public.consent_status(p_version text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'accepted', exists (select 1 from public.consents where user_id = auth.uid() and version = p_version)) $$;
create or replace function public.consent_accept(p_version text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return public._err('forbidden'); end if;
  insert into public.consents(user_id, version) values (auth.uid(), left(p_version, 20)) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.consent_status(text), public.consent_accept(text) from public, anon;
grant execute on function public.consent_status(text), public.consent_accept(text) to authenticated;
