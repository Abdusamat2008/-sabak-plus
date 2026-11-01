-- SABAK+ v0.6 — АРХИВ учебных лет + роль СУПЕРАДМИНА (технический администратор платформы)
-- Запускать после schema_v2.sql и schema_v3.sql. Скрипт безопасно запускать повторно.

-- 1) Роль superadmin (без школы)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('director','deputy','teacher','parent','student','superadmin'));
create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'superadmin', false) $$;

-- Суперадмин видит список школ (но не данные журналов — только архив и сводку)
drop policy if exists schools_super_read on public.schools;
create policy schools_super_read on public.schools for select to authenticated using (public.is_super());

-- 2) Архив: учебный год -> классы -> ученики (снимок хранится как jsonb и больше не меняется)
create table if not exists public.archive_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,                                  -- «2025/2026»
  closed_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id) on delete set null,
  auto boolean not null default false,
  cleared boolean not null default false,               -- очищен ли журнал после архивации
  stats jsonb not null default '{}'::jsonb,
  unique (school_id, label)
);
create table if not exists public.archive_classes (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.archive_years(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  grade int,
  homeroom text,
  students jsonb not null default '[]'::jsonb           -- [{n,b,g:[[subj,val,type,date]],a:{p,n,l},ad:[[date,status]],d:{...},docs:[...],rec:[...]}]
);
create index if not exists archive_classes_year on public.archive_classes(year_id);

alter table public.archive_years enable row level security;
alter table public.archive_classes enable row level security;
drop policy if exists arch_y_read on public.archive_years;
drop policy if exists arch_c_read on public.archive_classes;
-- директор/завуч — только архив своей школы; суперадмин — всех школ
create policy arch_y_read on public.archive_years for select to authenticated
  using (public.is_super() or (school_id = public.my_school() and public.is_admin()));
create policy arch_c_read on public.archive_classes for select to authenticated
  using (public.is_super() or (school_id = public.my_school() and public.is_admin()));
-- писать напрямую нельзя никому: только функции ниже
revoke insert, update, delete on public.archive_years, public.archive_classes from anon, authenticated;
grant select on public.archive_years, public.archive_classes to authenticated;

-- 3) Внутренняя функция: сделать снимок школы за учебный год
create or replace function public._archive_do(p_school uuid, p_label text, p_clear boolean, p_by uuid, p_auto boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare y int; d1 date; d2 date; yid uuid; c record; cnt_s int := 0; cnt_c int := 0; cnt_g int := 0; arr jsonb;
begin
  if p_label !~ '^\d{4}/\d{4}$' then return jsonb_build_object('ok', false, 'error', 'bad_label'); end if;
  y := substr(p_label, 1, 4)::int;
  if substr(p_label, 6, 4)::int <> y + 1 then return jsonb_build_object('ok', false, 'error', 'bad_label'); end if;
  d1 := make_date(y, 9, 1); d2 := make_date(y + 1, 8, 31);
  if exists (select 1 from archive_years where school_id = p_school and label = p_label) then
    return jsonb_build_object('ok', false, 'error', 'exists'); end if;
  insert into archive_years (school_id, label, closed_by, auto, cleared) values (p_school, p_label, p_by, p_auto, p_clear) returning id into yid;
  for c in select cl.id, cl.name, cl.grade, (select full_name from profiles where id = cl.homeroom_id) as hr
           from classes cl where cl.school_id = p_school order by cl.grade nulls last, cl.name loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'n', s.full_name, 'b', s.birth_date,
      'g', (select coalesce(jsonb_agg(jsonb_build_array(g.subject_id, g.value, g.type, g.date) order by g.date), '[]'::jsonb) from grades g where g.student_id = s.id and g.date between d1 and d2),
      'a', (select jsonb_build_object('p', count(*) filter (where a.status = 'p'), 'n', count(*) filter (where a.status = 'n'), 'l', count(*) filter (where a.status = 'l')) from attendance a where a.student_id = s.id and a.date between d1 and d2),
      'ad', (select coalesce(jsonb_agg(jsonb_build_array(a.date, a.status) order by a.date), '[]'::jsonb) from attendance a where a.student_id = s.id and a.status <> 'p' and a.date between d1 and d2),
      'd', (select jsonb_build_object('characteristic', dd.characteristic, 'address', dd.address, 'health', dd.health_group, 'family', dd.family) from dossiers dd where dd.student_id = s.id),
      'docs', (select coalesce(jsonb_agg(jsonb_build_object('t', x.doc_type, 's', x.status, 'num', x.number, 'iss', x.issued)), '[]'::jsonb) from dossier_docs x where x.student_id = s.id),
      'rec', (select coalesce(jsonb_agg(jsonb_build_object('k', r.kind, 't', r.text, 'd', r.date) order by r.date), '[]'::jsonb) from dossier_records r where r.student_id = s.id)
    ) order by s.full_name), '[]'::jsonb) into arr from students s where s.class_id = c.id;
    insert into archive_classes (year_id, school_id, class_name, grade, homeroom, students) values (yid, p_school, c.name, c.grade, c.hr, arr);
    cnt_c := cnt_c + 1; cnt_s := cnt_s + jsonb_array_length(arr);
  end loop;
  select count(*) into cnt_g from grades where school_id = p_school and date between d1 and d2;
  update archive_years set stats = jsonb_build_object('classes', cnt_c, 'students', cnt_s, 'grades', cnt_g) where id = yid;
  if p_clear then
    perform set_config('sabak.no_ach', '1', true);
    delete from grades where school_id = p_school and date between d1 and d2;
    delete from attendance where school_id = p_school and date between d1 and d2;
  end if;
  insert into audit_log (school_id, actor, action, details) values (p_school, p_by, 'archive.closed', jsonb_build_object('year', p_label, 'cleared', p_clear, 'auto', p_auto));
  return jsonb_build_object('ok', true, 'id', yid, 'label', p_label, 'classes', cnt_c, 'students', cnt_s, 'grades', cnt_g);
exception when others then
  return jsonb_build_object('ok', false, 'error', 'failed', 'detail', sqlerrm);
end $$;
revoke execute on function public._archive_do(uuid, text, boolean, uuid, boolean) from public, anon, authenticated;

-- 4) Закрыть учебный год. Директор — свою школу; суперадмин — любую (p_school).
create or replace function public.archive_close_year(p_label text, p_clear boolean default false, p_school uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid;
begin
  if public.is_super() then sc := coalesce(p_school, public.my_school());
  elsif public.my_role() = 'director' then sc := public.my_school();
  else return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if sc is null then return jsonb_build_object('ok', false, 'error', 'no_school'); end if;
  return public._archive_do(sc, p_label, coalesce(p_clear, false), auth.uid(), false);
end $$;
grant execute on function public.archive_close_year(text, boolean, uuid) to authenticated;

-- 5) Автоархивация: с 1 июня по 31 августа сохраняет только что закончившийся год (журнал НЕ очищает).
--    Вызывается приложением при заходе директора, а для всех школ сразу — функцией archive_auto_all (см. pg_cron в README).
create or replace function public._year_label_ended(p_on date default current_date) returns text language sql immutable as $$
  select case when extract(month from p_on) between 6 and 8 then (extract(year from p_on)::int - 1) || '/' || extract(year from p_on)::int else null end $$;
create or replace function public.archive_auto() returns jsonb language plpgsql security definer set search_path = public as $$
declare lb text := public._year_label_ended(); r jsonb;
begin
  if public.my_role() <> 'director' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if lb is null then return jsonb_build_object('ok', true, 'skipped', 'not_season'); end if;
  r := public._archive_do(public.my_school(), lb, false, auth.uid(), true);
  if (r->>'error') = 'exists' then return jsonb_build_object('ok', true, 'skipped', 'exists'); end if;
  return r;
end $$;
grant execute on function public.archive_auto() to authenticated;

create or replace function public.archive_auto_all() returns int language plpgsql security definer set search_path = public as $$
declare lb text := public._year_label_ended(); s record; n int := 0; r jsonb;
begin
  if lb is null then return 0; end if;
  for s in select id from schools loop
    r := public._archive_do(s.id, lb, false, null, true);
    if (r->>'ok')::boolean then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.archive_auto_all() from public, anon, authenticated;
-- (для pg_cron:  select cron.schedule('sabak-archive', '0 3 1 6 *', 'select public.archive_auto_all()');)

-- 6) Сводка для суперадмина: список школ, количество людей, какие годы в архиве
create or replace function public.super_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super() then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  return jsonb_build_object('ok', true, 'schools', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'city', s.city, 'code', s.code, 'created', s.created_at,
      'students', (select count(*) from students x where x.school_id = s.id and not x.is_demo),
      'staff', (select count(*) from profiles p where p.school_id = s.id and p.role in ('director','deputy','teacher')),
      'years', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'label', a.label, 'at', a.closed_at, 'auto', a.auto, 'stats', a.stats) order by a.label desc), '[]'::jsonb) from archive_years a where a.school_id = s.id)
    ) order by s.created_at desc) from schools s), '[]'::jsonb));
end $$;
grant execute on function public.super_overview() to authenticated;

-- ЧТОБЫ СДЕЛАТЬ СЕБЯ СУПЕРАДМИНОМ: 1) зарегистрируйте обычный аккаунт (почта + пароль) в Supabase Auth (Authentication → Users → Add user)
-- 2) выполните (подставьте свою почту):
--   insert into public.profiles (id, role, full_name, status) select id, 'superadmin', 'Технический администратор', 'active' from auth.users where email = 'ВАША_ПОЧТА';
