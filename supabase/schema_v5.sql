-- SABAK+ v0.7 — ЦЕНТР УПРАВЛЕНИЯ ПЛАТФОРМОЙ (суперадмин): школы, директора, поддержка, заявки, ключи, рассылки, аудит
-- Запускать после schema_v2, v3, v4. Безопасно запускать повторно.

-- 0) Статус школы: приостановленная школа теряет доступ к данным (my_school() возвращает null)
alter table public.schools add column if not exists status text not null default 'active';
alter table public.schools add column if not exists suspended_reason text;
alter table public.schools add column if not exists suspended_at timestamptz;
alter table public.schools drop constraint if exists schools_status_check;
alter table public.schools add constraint schools_status_check check (status in ('active','suspended'));
create or replace function public.my_school() returns uuid language sql stable security definer set search_path = public as $$
  select p.school_id from public.profiles p join public.schools s on s.id = p.school_id
  where p.id = auth.uid() and p.status = 'active' and s.status = 'active' $$;
-- чтобы директор приостановленной школы увидел понятное сообщение, а не пустой экран
create or replace function public.my_school_status() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('status', s.status, 'reason', s.suspended_reason, 'name', s.name)
                   from public.profiles p join public.schools s on s.id = p.school_id where p.id = auth.uid()), '{}'::jsonb) $$;
grant execute on function public.my_school_status() to authenticated;

-- 1) Таблицы
create table if not exists public.school_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  pinned boolean not null default false,
  by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  opened_by uuid references public.profiles(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 200),
  status text not null default 'open' check (status in ('open','answered','closed')),
  messages jsonb not null default '[]'::jsonb,            -- [{from:'school'|'super', name, text, at}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_school on public.support_tickets(school_id, updated_at desc);
create table if not exists public.school_requests (        -- заявки на подключение с сайта
  id uuid primary key default gen_random_uuid(),
  school_name text not null check (char_length(school_name) between 2 and 200),
  city text, contact_name text, phone text not null check (char_length(phone) between 5 and 40),
  note text check (char_length(note) <= 1000),
  status text not null default 'new' check (status in ('new','talking','key_issued','rejected','done')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.school_notes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.school_requests enable row level security;
drop policy if exists notes_super on public.school_notes;
create policy notes_super on public.school_notes for select to authenticated using (public.is_super());
drop policy if exists tickets_read on public.support_tickets;
create policy tickets_read on public.support_tickets for select to authenticated
  using (public.is_super() or (school_id = public.my_school() and public.my_role() = 'director'));
drop policy if exists requests_super on public.school_requests;
create policy requests_super on public.school_requests for select to authenticated using (public.is_super());
revoke insert, update, delete on public.school_notes, public.support_tickets, public.school_requests from anon, authenticated;
revoke all on public.school_requests from anon;
grant select on public.school_notes, public.support_tickets, public.school_requests to authenticated;

create or replace function public._need_super() returns void language plpgsql stable security definer set search_path = public as $$
begin if not public.is_super() then raise exception 'forbidden' using errcode = '42501'; end if; end $$;
revoke execute on function public._need_super() from public, anon;
grant execute on function public._need_super() to authenticated;
create or replace function public._slog(p_school uuid, p_action text, p_details jsonb default '{}') returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (school_id, actor, action, details) values (p_school, auth.uid(), p_action, p_details) $$;
revoke execute on function public._slog(uuid, text, jsonb) from public, anon, authenticated;

-- 2) Статистика школы (внутренняя): одна строка jsonb на школу
create or replace function public._school_stats(sid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'students', (select count(*) from students where school_id = sid and not is_demo),
    'demo_students', (select count(*) from students where school_id = sid and is_demo),
    'parents', (select count(*) from profiles where school_id = sid and role = 'parent'),
    'teachers', (select count(*) from profiles where school_id = sid and role = 'teacher' and status = 'active'),
    'deputies', (select count(*) from profiles where school_id = sid and role = 'deputy' and status = 'active'),
    'pending', (select count(*) from profiles where school_id = sid and status = 'pending'),
    'blocked', (select count(*) from profiles where school_id = sid and status = 'blocked'),
    'classes', (select count(*) from classes where school_id = sid),
    'grades', (select count(*) from grades where school_id = sid),
    'grades_30d', (select count(*) from grades where school_id = sid and date > current_date - 30),
    'grades_7d', (select count(*) from grades where school_id = sid and date > current_date - 7),
    'last_grade', (select max(date) from grades where school_id = sid),
    'avg', (select round(avg(value)::numeric, 2) from grades where school_id = sid),
    'att_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'p') / count(*), 1) end from attendance where school_id = sid and date > current_date - 30),
    'photo_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where photo_path is not null) / count(*), 0) end from students where school_id = sid and not is_demo),
    'docs_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'have') / count(*), 0) end from dossier_docs where school_id = sid),
    'invites_active', (select count(*) from invites where school_id = sid and not revoked and expires_at > now() and uses < max_uses),
    'anon_msgs', (select count(*) from anonymous_messages where school_id = sid),
    'anon_unread', (select count(*) from anonymous_messages where school_id = sid and not read),
    'years', (select count(*) from archive_years where school_id = sid),
    'subjects', (select count(*) from subjects where school_id = sid),
    'sched', (select jsonb_build_object('title', title, 'at', updated_at) from schedule_versions where school_id = sid and is_active limit 1),
    'sched_pending', (select count(*) from schedule_versions where school_id = sid and status = 'pending')
  ) $$;
revoke execute on function public._school_stats(uuid) from public, anon, authenticated;

-- 3) Панель платформы
create or replace function public.super_dashboard() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._need_super();
  select jsonb_build_object(
    'schools', (select count(*) from schools), 'suspended', (select count(*) from schools where status = 'suspended'),
    'users', (select count(*) from profiles where role <> 'superadmin'),
    'students', (select count(*) from students where not is_demo),
    'teachers', (select count(*) from profiles where role = 'teacher' and status = 'active'),
    'parents', (select count(*) from profiles where role = 'parent'),
    'directors', (select count(*) from profiles where role = 'director'),
    'pending', (select count(*) from profiles where status = 'pending'),
    'grades', (select count(*) from grades), 'grades_7d', (select count(*) from grades where date > current_date - 7),
    'att_7d', (select count(*) from attendance where date > current_date - 7),
    'tickets_open', (select count(*) from support_tickets where status = 'open'),
    'requests_new', (select count(*) from school_requests where status = 'new'),
    'years', (select count(*) from archive_years),
    'keys_free', (select count(*) from school_keys where used_at is null),
    'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'grades_by_day', (select coalesce(jsonb_agg(jsonb_build_array(d::date, coalesce(c, 0)) order by d), '[]'::jsonb)
        from generate_series(current_date - 29, current_date, '1 day') d left join (select date, count(*) c from grades where date > current_date - 30 group by date) g on g.date = d::date),
    'signups_by_week', (select coalesce(jsonb_agg(jsonb_build_array(w, c) order by w), '[]'::jsonb)
        from (select date_trunc('week', created_at)::date w, count(*) c from profiles where created_at > now() - interval '12 weeks' and role <> 'superadmin' group by 1) x),
    'roles', (select coalesce(jsonb_object_agg(role, c), '{}'::jsonb) from (select role, count(*) c from profiles group by role) x),
    'inactive', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'city', s.city, 'last', (select max(date) from grades where school_id = s.id), 'created', s.created_at) order by s.created_at), '[]'::jsonb)
        from schools s where s.status = 'active' and coalesce((select max(date) from grades where school_id = s.id), '1970-01-01') < current_date - 14),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'n', n) order by n desc), '[]'::jsonb)
        from (select s.id, s.name, (select count(*) from grades g where g.school_id = s.id and g.date > current_date - 30) n from schools s order by 3 desc limit 5) t)
  ) into r;
  return jsonb_build_object('ok', true, 'data', r);
end $$;
grant execute on function public.super_dashboard() to authenticated;

-- 4) Список школ с директорами и показателями
create or replace function public.super_schools() returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public._need_super();
  return jsonb_build_object('ok', true, 'schools', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'city', s.city, 'code', s.code, 'status', s.status, 'reason', s.suspended_reason, 'created', s.created_at,
      'director', (select jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone, 'email', u.email, 'last', u.last_sign_in_at, 'status', p.status)
                   from profiles p left join auth.users u on u.id = p.id where p.school_id = s.id and p.role = 'director' order by p.created_at limit 1),
      'stats', public._school_stats(s.id)
    ) order by s.created_at desc) from schools s), '[]'::jsonb));
end $$;
grant execute on function public.super_schools() to authenticated;

-- 5) Полная карточка школы
create or replace function public.super_school(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare s schools; r jsonb;
begin
  perform public._need_super();
  select * into s from schools where id = p_id; if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  r := jsonb_build_object(
    'id', s.id, 'name', s.name, 'city', s.city, 'code', s.code, 'status', s.status, 'reason', s.suspended_reason, 'created', s.created_at,
    'stats', public._school_stats(s.id),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'status', p.status, 'phone', p.phone, 'email', u.email, 'last', u.last_sign_in_at, 'created', p.created_at)
              order by case p.role when 'director' then 0 when 'deputy' then 1 else 2 end, p.full_name), '[]'::jsonb)
              from profiles p left join auth.users u on u.id = p.id where p.school_id = s.id and p.role in ('director','deputy','teacher')),
    'classes', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'grade', c.grade, 'lang', c.lang, 'homeroom', (select full_name from profiles where id = c.homeroom_id),
              'students', (select count(*) from students x where x.class_id = c.id), 'avg', (select round(avg(g.value)::numeric, 2) from grades g join students x on x.id = g.student_id where x.class_id = c.id))
              order by c.grade nulls last, c.name), '[]'::jsonb) from classes c where c.school_id = s.id),
    'grade_dist', (select coalesce(jsonb_object_agg(value, c), '{}'::jsonb) from (select value, count(*) c from grades where school_id = s.id group by value) x),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_array(d::date, coalesce(c, 0)) order by d), '[]'::jsonb)
        from generate_series(current_date - 29, current_date, '1 day') d left join (select date, count(*) c from grades where school_id = s.id and date > current_date - 30 group by date) g on g.date = d::date),
    'invites', (select jsonb_build_object('active', count(*) filter (where not revoked and expires_at > now() and uses < max_uses), 'used', count(*) filter (where uses >= max_uses), 'expired', count(*) filter (where expires_at <= now() and uses < max_uses), 'revoked', count(*) filter (where revoked)) from invites where school_id = s.id),
    'years', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'at', closed_at, 'auto', auto, 'stats', stats) order by label desc), '[]'::jsonb) from archive_years where school_id = s.id),
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'pinned', n.pinned, 'at', n.created_at, 'by', (select full_name from profiles where id = n.by)) order by n.pinned desc, n.created_at desc), '[]'::jsonb) from school_notes n where n.school_id = s.id),
    'audit', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'who', (select full_name from profiles where id = a.actor), 'details', a.details) order by a.at desc), '[]'::jsonb) from (select * from audit_log where school_id = s.id order by at desc limit 40) a),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'subject', subject, 'status', status, 'at', updated_at) order by updated_at desc), '[]'::jsonb) from support_tickets where school_id = s.id)
  );
  return jsonb_build_object('ok', true, 'school', r);
end $$;
grant execute on function public.super_school(uuid) to authenticated;

-- 6) Управление школой
create or replace function public.super_set_school_status(p_id uuid, p_status text, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._need_super();
  if p_status not in ('active','suspended') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  update schools set status = p_status, suspended_reason = case when p_status = 'suspended' then nullif(trim(p_reason), '') else null end,
         suspended_at = case when p_status = 'suspended' then now() else null end where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform public._slog(p_id, 'super.school_' || p_status, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.super_set_school_status(uuid, text, text) to authenticated;

create or replace function public.super_rename_school(p_id uuid, p_name text, p_city text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._need_super();
  if char_length(trim(coalesce(p_name, ''))) < 2 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  update schools set name = trim(p_name), city = nullif(trim(coalesce(p_city, '')), '') where id = p_id;
  perform public._slog(p_id, 'super.school_renamed', jsonb_build_object('name', p_name, 'city', p_city));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.super_rename_school(uuid, text, text) to authenticated;

create or replace function public.super_note_add(p_school uuid, p_text text, p_pinned boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._need_super();
  if char_length(trim(coalesce(p_text, ''))) < 1 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  insert into school_notes (school_id, text, pinned, by) values (p_school, trim(p_text), coalesce(p_pinned, false), auth.uid());
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.super_note_add(uuid, text, boolean) to authenticated;
create or replace function public.super_note_delete(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin perform public._need_super(); delete from school_notes where id = p_id; return jsonb_build_object('ok', true); end $$;
grant execute on function public.super_note_delete(uuid) to authenticated;

-- 7) Пользователи: поиск и блокировка
create or replace function public.super_find_user(p_q text) returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare q text := '%' || lower(trim(coalesce(p_q, ''))) || '%';
begin
  perform public._need_super();
  if char_length(trim(coalesce(p_q, ''))) < 2 then return jsonb_build_object('ok', true, 'users', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'users', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'status', p.status, 'phone', p.phone, 'email', u.email, 'last', u.last_sign_in_at,
           'school_id', p.school_id, 'school', (select name from schools where id = p.school_id)))
    from (select * from profiles p where p.role <> 'superadmin' order by p.created_at desc) p left join auth.users u on u.id = p.id
    where lower(p.full_name) like q or lower(coalesce(p.phone, '')) like q or lower(coalesce(u.email, '')) like q limit 30), '[]'::jsonb));
end $$;
grant execute on function public.super_find_user(text) to authenticated;
create or replace function public.super_user_status(p_user uuid, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pr profiles;
begin
  perform public._need_super();
  if p_status not in ('active','blocked') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  select * into pr from profiles where id = p_user; if not found or pr.role = 'superadmin' then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  update profiles set status = p_status where id = p_user;
  perform public._slog(pr.school_id, 'super.user_' || p_status, jsonb_build_object('user', pr.full_name, 'role', pr.role));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.super_user_status(uuid, text) to authenticated;

-- 8) Рассылка директорам (всем или одной школе). Приходит колокольчиком в приложении.
create or replace function public.super_announce(p_title text, p_body text, p_school uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._need_super();
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 3 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  insert into notifications (school_id, to_user, kind, title, body, created_by)
    select p.school_id, p.id, 'platform', trim(p_title), trim(p_body), auth.uid() from profiles p join schools s on s.id = p.school_id
    where p.role = 'director' and p.status = 'active' and (p_school is null or p.school_id = p_school);
  get diagnostics n = row_count;
  perform public._slog(p_school, 'super.announce', jsonb_build_object('title', p_title, 'to', n));
  return jsonb_build_object('ok', true, 'sent', n);
end $$;
grant execute on function public.super_announce(text, text, uuid) to authenticated;

-- 9) Поддержка: директор пишет суперадмину, суперадмин отвечает
create or replace function public.support_open(p_subject text, p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pr profiles; tid uuid;
begin
  select * into pr from profiles where id = auth.uid() and status = 'active';
  if not found or pr.role <> 'director' or pr.school_id is null then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if char_length(trim(coalesce(p_subject, ''))) < 3 or char_length(trim(coalesce(p_text, ''))) < 3 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  if (select count(*) from support_tickets where school_id = pr.school_id and created_at > now() - interval '1 hour') >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  insert into support_tickets (school_id, opened_by, subject, messages)
    values (pr.school_id, pr.id, trim(p_subject), jsonb_build_array(jsonb_build_object('from', 'school', 'name', pr.full_name, 'text', trim(p_text), 'at', now()))) returning id into tid;
  return jsonb_build_object('ok', true, 'id', tid);
end $$;
grant execute on function public.support_open(text, text) to authenticated;

create or replace function public.support_reply(p_id uuid, p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t support_tickets; pr profiles; side text;
begin
  select * into pr from profiles where id = auth.uid() and status = 'active';
  select * into t from support_tickets where id = p_id; if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if pr.role = 'superadmin' then side := 'super';
  elsif pr.role = 'director' and pr.school_id = t.school_id then side := 'school';
  else return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if char_length(trim(coalesce(p_text, ''))) < 1 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  update support_tickets set messages = messages || jsonb_build_array(jsonb_build_object('from', side, 'name', pr.full_name, 'text', trim(p_text), 'at', now())),
         status = case when side = 'super' then 'answered' else 'open' end, updated_at = now() where id = p_id;
  if side = 'super' then
    insert into notifications (school_id, to_user, kind, title, body, created_by) values (t.school_id, t.opened_by, 'support', 'Ответ поддержки: ' || t.subject, left(trim(p_text), 300), auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.support_reply(uuid, text) to authenticated;

create or replace function public.support_close(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin perform public._need_super(); update support_tickets set status = 'closed', updated_at = now() where id = p_id; return jsonb_build_object('ok', true); end $$;
grant execute on function public.support_close(uuid) to authenticated;

-- 10) Заявки на подключение с сайта (форма на /connect). Спам: не более 30 в час на весь сайт.
create or replace function public.submit_school_request(p_school text, p_city text, p_name text, p_phone text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_school, ''))) < 2 or char_length(trim(coalesce(p_phone, ''))) < 5 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  if (select count(*) from school_requests where created_at > now() - interval '1 hour') >= 30 then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
  insert into school_requests (school_name, city, contact_name, phone, note) values (left(trim(p_school), 200), left(trim(coalesce(p_city, '')), 100), left(trim(coalesce(p_name, '')), 120), left(trim(p_phone), 40), left(trim(coalesce(p_note, '')), 1000));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.submit_school_request(text, text, text, text, text) to anon, authenticated;
create or replace function public.super_request_set(p_id uuid, p_status text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._need_super();
  if p_status not in ('new','talking','key_issued','rejected','done') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  update school_requests set status = p_status, admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.super_request_set(uuid, text, text) to authenticated;

-- 11) Ключи школ: выпуск и список (сам ключ показывается ОДИН раз при выпуске)
create or replace function public.super_issue_key(p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare k text;
begin
  perform public._need_super();
  k := public.create_school_key(nullif(trim(coalesce(p_note, '')), ''));
  perform public._slog(null, 'super.key_issued', jsonb_build_object('note', p_note));
  return jsonb_build_object('ok', true, 'key', k);
end $$;
grant execute on function public.super_issue_key(text) to authenticated;
create or replace function public.super_keys() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_super();
  return jsonb_build_object('ok', true, 'keys', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'note', k.note, 'created', k.created_at, 'used', k.used_at, 'school', (select name from schools where id = k.school_id)) order by k.created_at desc) from school_keys k), '[]'::jsonb));
end $$;
grant execute on function public.super_keys() to authenticated;
create or replace function public.super_key_revoke(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin perform public._need_super(); delete from school_keys where id = p_id and used_at is null; return jsonb_build_object('ok', true); end $$;
grant execute on function public.super_key_revoke(uuid) to authenticated;

-- 12) Единый журнал платформы
create or replace function public.super_audit(p_school uuid default null, p_action text default null, p_limit int default 100) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_super();
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'school', (select name from schools where id = a.school_id), 'school_id', a.school_id, 'who', (select full_name from profiles where id = a.actor), 'details', a.details) order by a.at desc)
    from (select * from audit_log where (p_school is null or school_id = p_school) and (p_action is null or action like p_action || '%') order by at desc limit least(coalesce(p_limit, 100), 500)) a), '[]'::jsonb));
end $$;
grant execute on function public.super_audit(uuid, text, int) to authenticated;

-- 13) Состояние системы и обслуживание
create or replace function public.super_system() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_super();
  return jsonb_build_object('ok', true, 'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'tables', (select jsonb_object_agg(t, n) from (values
      ('grades', (select count(*) from grades)), ('attendance', (select count(*) from attendance)), ('students', (select count(*) from students)), ('profiles', (select count(*) from profiles)),
      ('notifications', (select count(*) from notifications)), ('audit_log', (select count(*) from audit_log)), ('invites', (select count(*) from invites)), ('invite_attempts', (select count(*) from invite_attempts)),
      ('archive_years', (select count(*) from archive_years)), ('support_tickets', (select count(*) from support_tickets))) v(t, n)),
    'failed_codes_24h', (select count(*) from invite_attempts where ok = false and at > now() - interval '24 hours'),
    'locked_now', (select count(distinct user_id) from invite_attempts where ok = false and at > now() - interval '15 minutes'),
    'cleanable', jsonb_build_object('attempts', (select count(*) from invite_attempts where at < now() - interval '7 days'),
      'invites', (select count(*) from invites where expires_at < now() - interval '30 days'),
      'notifs', (select count(*) from notifications where read and created_at < now() - interval '90 days')));
end $$;
grant execute on function public.super_system() to authenticated;
create or replace function public.super_cleanup() returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int;
begin
  perform public._need_super();
  delete from invite_attempts where at < now() - interval '7 days'; get diagnostics a = row_count;
  delete from invites where expires_at < now() - interval '30 days'; get diagnostics b = row_count;
  delete from notifications where read and created_at < now() - interval '90 days'; get diagnostics c = row_count;
  perform public._slog(null, 'super.cleanup', jsonb_build_object('attempts', a, 'invites', b, 'notifs', c));
  return jsonb_build_object('ok', true, 'attempts', a, 'invites', b, 'notifs', c);
end $$;
grant execute on function public.super_cleanup() to authenticated;
-- Архивировать год сразу во ВСЕХ школах (журнал не очищается)
create or replace function public.super_archive_all(p_label text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; ok int := 0; skip int := 0; r jsonb;
begin
  perform public._need_super();
  for s in select id from schools loop
    r := public._archive_do(s.id, p_label, false, auth.uid(), false);
    if (r->>'ok')::boolean then ok := ok + 1; else skip := skip + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'archived', ok, 'skipped', skip);
end $$;
grant execute on function public.super_archive_all(text) to authenticated;
