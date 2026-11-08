-- SABAK+ schema v8: календарь четвертей и каникул, подробный журнал, архив четвертей, табель и прошлые годы,
-- отчёты, удостоверение ученика, новости с форматированием. Выполнять в Supabase SQL Editor ПОСЛЕ schema_v7.sql. Можно запускать повторно.

-- 1) Календарь: четверти и каникулы задаёт только суперадмин (по приказу министерства). Общий для всех школ.
create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  year_label text not null check (year_label ~ '^\d{4}/\d{4}$'),
  kind text not null check (kind in ('quarter','break')),
  num smallint not null check (num between 1 and 4),
  starts date not null,
  ends date not null,
  decree text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends >= starts),
  unique (year_label, kind, num)
);
alter table public.academic_terms enable row level security;

create or replace function public._today() returns date language sql stable as $$ select (now() at time zone 'Asia/Bishkek')::date $$;
create or replace function public._year_label_of(d date) returns text language sql immutable as $$
  select case when extract(month from d) >= 9 then extract(year from d)::int || '/' || (extract(year from d)::int + 1)
              else (extract(year from d)::int - 1) || '/' || extract(year from d)::int end $$;

-- Состояние даты: free (календаря на этот год нет — ограничений нет) | open | grace (3 дня после конца четверти) | closed | break | upcoming
create or replace function public._term_state(d date) returns text language plpgsql stable security definer set search_path = public as $$
declare lb text := public._year_label_of(d); t academic_terms%rowtype; td date := public._today();
begin
  if not exists (select 1 from academic_terms where year_label = lb and kind = 'quarter') then return 'free'; end if;
  select * into t from academic_terms where year_label = lb and kind = 'quarter' and d between starts and ends;
  if not found then return 'break'; end if;
  if td < t.starts then return 'upcoming'; end if;
  if td <= t.ends then return 'open'; end if;
  if td <= t.ends + 3 then return 'grace'; end if;
  return 'closed';
end $$;
revoke execute on function public._term_state(date) from public, anon;

create or replace function public.calendar_get(p_year text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare td date := public._today(); lb text := coalesce(p_year, public._year_label_of(td)); cur record; nxt record;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if lb !~ '^\d{4}/\d{4}$' then return public._err('bad_year'); end if;
  select * into cur from academic_terms where year_label = public._year_label_of(td) and td between starts and ends limit 1;
  select * into nxt from academic_terms where starts > td order by starts limit 1;
  return jsonb_build_object('ok', true, 'today', td, 'year', public._year_label_of(td), 'label', lb,
    'years', (select coalesce(jsonb_agg(y order by y desc), '[]'::jsonb) from (select distinct year_label y from academic_terms) z),
    'terms', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'num', num, 'starts', starts, 'ends', ends, 'decree', decree,
        'status', case when td < starts then 'upcoming' when td <= ends then 'open' else 'closed' end) order by starts), '[]'::jsonb)
      from academic_terms where year_label = lb),
    'current', case when cur.id is null then null else jsonb_build_object('kind', cur.kind, 'num', cur.num, 'starts', cur.starts, 'ends', cur.ends) end,
    'next', case when nxt.id is null then null else jsonb_build_object('kind', nxt.kind, 'num', nxt.num, 'starts', nxt.starts, 'ends', nxt.ends, 'year', nxt.year_label) end);
end $$;
revoke execute on function public.calendar_get(text) from public, anon;
grant execute on function public.calendar_get(text) to authenticated;

create or replace function public.calendar_set(p_year text, p_items jsonb, p_decree text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare y int; it jsonb; k text; n int; s date; e date; prev date := null; r record; cnt int := 0; qn int[] := '{}'; bn int[] := '{}';
begin
  if not public.is_super() then return public._err('forbidden'); end if;
  if p_year is null or p_year !~ '^\d{4}/\d{4}$' then return public._err('bad_year'); end if;
  y := substr(p_year, 1, 4)::int;
  if substr(p_year, 6, 4)::int <> y + 1 then return public._err('bad_year'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 8 then return public._err('items'); end if;
  create temp table if not exists _tm (kind text, num int, starts date, ends date) on commit drop;
  delete from _tm;
  for it in select * from jsonb_array_elements(p_items) loop
    k := it->>'kind'; n := (it->>'num')::int; s := (it->>'starts')::date; e := (it->>'ends')::date;
    if k not in ('quarter','break') or n is null or n not between 1 and 4 or s is null or e is null then return public._err('items'); end if;
    if e < s then return public._err('range'); end if;
    if s < make_date(y, 8, 1) or e > make_date(y + 1, 8, 31) then return public._err('outside_year'); end if;
    if k = 'quarter' then if n = any(qn) then return public._err('dup'); end if; qn := qn || n; else if n = any(bn) then return public._err('dup'); end if; bn := bn || n; end if;
    insert into _tm values (k, n, s, e);
  end loop;
  for r in select * from _tm order by starts loop
    if prev is not null and r.starts <= prev then return public._err('overlap'); end if;
    prev := r.ends;
  end loop;
  if exists (select 1 from _tm a join _tm b on a.kind = 'quarter' and b.kind = 'quarter' and a.num < b.num and a.starts > b.starts) then return public._err('order'); end if;
  -- четверть, по которой уже сделан архив, менять нельзя
  if exists (select 1 from quarter_runs qr where qr.year_label = p_year and not exists (
       select 1 from _tm t2 where t2.kind = 'quarter' and t2.num = qr.quarter and (t2.starts, t2.ends) = (select starts, ends from academic_terms where year_label = p_year and kind = 'quarter' and num = qr.quarter))) then
    return public._err('archived'); end if;
  delete from academic_terms where year_label = p_year;
  insert into academic_terms (year_label, kind, num, starts, ends, decree, created_by) select p_year, kind, num, starts, ends, nullif(trim(p_decree), ''), auth.uid() from _tm;
  get diagnostics cnt = row_count;
  perform public._slog(null, 'super.calendar', jsonb_build_object('year', p_year, 'items', cnt, 'decree', p_decree));
  return jsonb_build_object('ok', true, 'items', cnt);
end $$;
revoke execute on function public.calendar_set(text, jsonb, text) from public, anon;
grant execute on function public.calendar_set(text, jsonb, text) to authenticated;

-- 2) Подробный журнал: тема урока, комментарий, история правок
alter table public.grades add column if not exists topic text;
alter table public.grades add column if not exists comment text;
alter table public.grades add column if not exists updated_at timestamptz;
alter table public.grades add column if not exists updated_by uuid;
alter table public.grades drop constraint if exists grades_topic_len;
alter table public.grades add constraint grades_topic_len check (topic is null or length(topic) <= 120);
alter table public.grades drop constraint if exists grades_comment_len;
alter table public.grades add constraint grades_comment_len check (comment is null or length(comment) <= 300);

create table if not exists public.grade_log (
  id bigserial primary key,
  grade_id uuid not null,
  school_id uuid,
  student_id uuid,
  subject_id text,
  actor uuid,
  action text not null,
  old jsonb,
  new jsonb,
  at timestamptz not null default now()
);
create index if not exists grade_log_grade on public.grade_log(grade_id, at);
alter table public.grade_log enable row level security;

create or replace function public._grade_log_t() returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op = 'INSERT' then null else jsonb_build_object('value', old.value, 'type', old.type, 'date', old.date, 'topic', old.topic, 'comment', old.comment, 'reason', old.reason) end;
        n jsonb := case when tg_op = 'DELETE' then null else jsonb_build_object('value', new.value, 'type', new.type, 'date', new.date, 'topic', new.topic, 'comment', new.comment, 'reason', new.reason) end;
begin
  if tg_op = 'UPDATE' and o = n then return new; end if;
  insert into grade_log (grade_id, school_id, student_id, subject_id, actor, action, old, new)
  values (coalesce(new.id, old.id), coalesce(new.school_id, old.school_id), coalesce(new.student_id, old.student_id), coalesce(new.subject_id, old.subject_id), auth.uid(), lower(tg_op), o, n);
  if tg_op = 'UPDATE' then new.updated_at := now(); new.updated_by := auth.uid(); end if;
  return coalesce(new, old);
end $$;
drop trigger if exists grades_log_after on public.grades;
create trigger grades_log_after after insert or update or delete on public.grades for each row execute function public._grade_log_t();

create or replace function public._grade_stamp_t() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists grades_stamp_before on public.grades;
create trigger grades_stamp_before before update on public.grades for each row execute function public._grade_stamp_t();

-- Оценки можно ставить и менять только в открытой четверти (+3 дня после её конца на исправления).
-- Если календаря на год нет, ограничений нет — старое поведение сохраняется.
create or replace function public._grade_term_t() returns trigger language plpgsql security definer set search_path = public as $$
declare st text; d date;
begin
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' or coalesce(current_setting('sabak.term_override', true), '') = '1' then return coalesce(new, old); end if;
  foreach d in array (case when tg_op = 'INSERT' then array[new.date] when tg_op = 'DELETE' then array[old.date] else array[old.date, new.date] end) loop
    st := public._term_state(d);
    if st = 'break' then raise exception 'term_break' using hint = 'В каникулы оценки не ставятся'; end if;
    if st = 'closed' then raise exception 'term_closed' using hint = 'Четверть закрыта, оценки архивированы'; end if;
  end loop;
  return coalesce(new, old);
end $$;
drop trigger if exists grades_term_guard on public.grades;
create trigger grades_term_guard before insert or update or delete on public.grades for each row execute function public._grade_term_t();

create or replace function public.grade_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g grades%rowtype;
begin
  select * into g from grades where id = p_id; if not found then return public._err('not_found'); end if;
  if not public.can_see_student(g.student_id) then return public._err('forbidden'); end if;
  return jsonb_build_object('ok', true,
    'grade', jsonb_build_object('id', g.id, 'value', g.value, 'type', g.type, 'date', g.date, 'topic', g.topic, 'comment', g.comment, 'reason', g.reason, 'note', g.note,
       'teacher', (select full_name from profiles where id = g."by"), 'created', g.created_at, 'updated', g.updated_at),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('action', l.action, 'at', l.at, 'who', (select full_name from profiles where id = l.actor), 'old', l.old, 'new', l.new) order by l.at), '[]'::jsonb) from grade_log l where l.grade_id = g.id));
end $$;
revoke execute on function public.grade_detail(uuid) from public, anon;
grant execute on function public.grade_detail(uuid) to authenticated;

create or replace function public.grade_note_set(p_id uuid, p_topic text, p_comment text) returns jsonb language plpgsql security definer set search_path = public as $$
declare g grades%rowtype;
begin
  select * into g from grades where id = p_id; if not found then return public._err('not_found'); end if;
  if g."by" is distinct from auth.uid() then return public._err('forbidden'); end if;
  if length(coalesce(p_topic, '')) > 120 or length(coalesce(p_comment, '')) > 300 then return public._err('long'); end if;
  begin
    update grades set topic = nullif(trim(p_topic), ''), comment = nullif(trim(p_comment), '') where id = p_id;
  exception when others then
    if sqlerrm in ('term_closed', 'term_break') then return public._err(sqlerrm); end if; raise;
  end;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.grade_note_set(uuid, text, text) from public, anon;
grant execute on function public.grade_note_set(uuid, text, text) to authenticated;

-- 3) Архив четвертей: по окончании четверти система сохраняет итоги каждого класса и ученика по каждому предмету
create table if not exists public.quarter_archive (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  year_label text not null,
  quarter smallint not null check (quarter between 1 and 4),
  class_id uuid,
  class_name text,
  student_id uuid,
  student_name text not null,
  subject_id text not null,
  grades jsonb not null default '[]'::jsonb,          -- [[значение, тип, дата, тема]]
  n int not null default 0,
  avg numeric(4,2),
  final smallint,
  att jsonb,
  closed_at timestamptz not null default now(),
  unique (school_id, year_label, quarter, student_id, subject_id)
);
create index if not exists quarter_archive_student on public.quarter_archive(student_id, year_label);
alter table public.quarter_archive enable row level security;
create table if not exists public.quarter_runs (
  school_id uuid not null references public.schools(id) on delete cascade,
  year_label text not null,
  quarter smallint not null,
  at timestamptz not null default now(),
  stats jsonb,
  primary key (school_id, year_label, quarter)
);
alter table public.quarter_runs enable row level security;

create or replace function public._quarter_archive_do(p_school uuid, p_year text, p_q int) returns jsonb language plpgsql security definer set search_path = public as $$
declare t academic_terms%rowtype; cnt int;
begin
  select * into t from academic_terms where year_label = p_year and kind = 'quarter' and num = p_q;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_term'); end if;
  if exists (select 1 from quarter_runs where school_id = p_school and year_label = p_year and quarter = p_q) then return jsonb_build_object('ok', true, 'skipped', 'exists'); end if;
  insert into quarter_archive (school_id, year_label, quarter, class_id, class_name, student_id, student_name, subject_id, grades, n, avg, final)
  select p_school, p_year, p_q, s.class_id, c.name, s.id, s.full_name, g.subject_id,
         jsonb_agg(jsonb_build_array(g.value, g.type, g.date, g.topic) order by g.date, g.created_at), count(*),
         round(sum(g.value * (case when g.type = 'test' then 2 else 1 end))::numeric / sum(case when g.type = 'test' then 2 else 1 end), 2),
         floor(sum(g.value * (case when g.type = 'test' then 2 else 1 end))::numeric / sum(case when g.type = 'test' then 2 else 1 end) + 0.5 + 1e-9)::smallint
  from grades g join students s on s.id = g.student_id left join classes c on c.id = s.class_id
  where g.school_id = p_school and g.date between t.starts and t.ends
  group by s.class_id, c.name, s.id, s.full_name, g.subject_id
  on conflict do nothing;
  get diagnostics cnt = row_count;
  update quarter_archive q set att = (select jsonb_build_object('p', count(*) filter (where a.status = 'p'), 'n', count(*) filter (where a.status = 'n'), 'l', count(*) filter (where a.status = 'l'))
      from attendance a where a.student_id = q.student_id and a.date between t.starts and t.ends)
    where q.school_id = p_school and q.year_label = p_year and q.quarter = p_q;
  insert into quarter_runs (school_id, year_label, quarter, stats) values (p_school, p_year, p_q, jsonb_build_object('rows', cnt));
  insert into audit_log (school_id, actor, action, details) values (p_school, auth.uid(), 'quarter.archived', jsonb_build_object('year', p_year, 'quarter', p_q, 'rows', cnt));
  return jsonb_build_object('ok', true, 'rows', cnt);
end $$;
revoke execute on function public._quarter_archive_do(uuid, text, int) from public, anon, authenticated;

-- Вызывается приложением при заходе любого пользователя школы; делает архив всех завершившихся четвертей своей школы (один раз).
create or replace function public.term_tick() returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); t record; done jsonb := '[]'::jsonb; r jsonb;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if sc is null then return jsonb_build_object('ok', true, 'archived', done); end if;
  for t in select * from academic_terms where kind = 'quarter' and ends < public._today() and not exists (
      select 1 from quarter_runs qr where qr.school_id = sc and qr.year_label = academic_terms.year_label and qr.quarter = academic_terms.num) order by starts loop
    r := public._quarter_archive_do(sc, t.year_label, t.num);
    done := done || jsonb_build_array(jsonb_build_object('year', t.year_label, 'quarter', t.num, 'rows', r->'rows'));
  end loop;
  return jsonb_build_object('ok', true, 'archived', done);
end $$;
revoke execute on function public.term_tick() from public, anon;
grant execute on function public.term_tick() to authenticated;

create or replace function public.term_tick_all() returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; t record; n int := 0;
begin
  if not public.is_super() then return public._err('forbidden'); end if;
  for s in select id from schools loop
    for t in select * from academic_terms where kind = 'quarter' and ends < public._today() and not exists (
        select 1 from quarter_runs qr where qr.school_id = s.id and qr.year_label = academic_terms.year_label and qr.quarter = academic_terms.num) loop
      perform public._quarter_archive_do(s.id, t.year_label, t.num); n := n + 1;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'archived', n);
end $$;
revoke execute on function public.term_tick_all() from public, anon;
grant execute on function public.term_tick_all() to authenticated;

-- 4) Прошлые годы, оцифрованные школой вручную (итоги четвертей и года: quarter 1–4, 5 = годовая)
create table if not exists public.past_grades (
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  year_label text not null check (year_label ~ '^\d{4}/\d{4}$'),
  quarter smallint not null check (quarter between 1 and 5),
  subject_id text not null,
  value smallint not null check (value between 2 and 5),
  entered_by uuid,
  at timestamptz not null default now(),
  primary key (student_id, year_label, quarter, subject_id)
);
alter table public.past_grades enable row level security;

create or replace function public.past_grade_set(p_sid uuid, p_year text, p_quarter int, p_subject text, p_value int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school();
begin
  if sc is null or public.student_school(p_sid) is distinct from sc then return public._err('forbidden'); end if;
  if not (public.is_admin() or public.is_homeroom_of(p_sid) or public.teaches(p_sid, p_subject)) then return public._err('forbidden'); end if;
  if p_year is null or p_year !~ '^\d{4}/\d{4}$' then return public._err('bad_year'); end if;
  if substr(p_year, 1, 4)::int >= substr(public._year_label_of(public._today()), 1, 4)::int then return public._err('not_past'); end if;
  if p_quarter not between 1 and 5 then return public._err('quarter'); end if;
  if not exists (select 1 from subjects where id = p_subject) then return public._err('subject'); end if;
  if p_quarter <= 4 and exists (select 1 from quarter_archive where student_id = p_sid and year_label = p_year and quarter = p_quarter and subject_id = p_subject) then return public._err('archived'); end if;
  if p_value is null then delete from past_grades where student_id = p_sid and year_label = p_year and quarter = p_quarter and subject_id = p_subject; return jsonb_build_object('ok', true); end if;
  if p_value not between 2 and 5 then return public._err('value'); end if;
  insert into past_grades (school_id, student_id, year_label, quarter, subject_id, value, entered_by) values (sc, p_sid, p_year, p_quarter, p_subject, p_value, auth.uid())
  on conflict (student_id, year_label, quarter, subject_id) do update set value = excluded.value, entered_by = excluded.entered_by, at = now();
  perform public.log_audit('past_grade.set', jsonb_build_object('student', p_sid, 'year', p_year, 'quarter', p_quarter, 'subject', p_subject, 'value', p_value));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.past_grade_set(uuid, text, int, text, int) from public, anon;
grant execute on function public.past_grade_set(uuid, text, int, text, int) to authenticated;

-- Табель: итоги по четвертям и годам (архив системы + то, что оцифровала школа)
create or replace function public.student_history(p_sid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_see_student(p_sid) then return public._err('forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', (
    select coalesce(jsonb_agg(x order by x->>'year' desc, (x->>'quarter')::int), '[]'::jsonb) from (
      select jsonb_build_object('year', year_label, 'quarter', quarter, 'subject', subject_id, 'final', final, 'avg', avg, 'n', n, 'src', 'archive') x
        from quarter_archive where student_id = p_sid
      union all
      select jsonb_build_object('year', pg.year_label, 'quarter', pg.quarter, 'subject', pg.subject_id, 'final', pg.value, 'avg', null, 'n', null, 'src', 'manual')
        from past_grades pg where pg.student_id = p_sid
         and not exists (select 1 from quarter_archive qa where qa.student_id = pg.student_id and qa.year_label = pg.year_label and qa.quarter = pg.quarter and qa.subject_id = pg.subject_id)) t));
end $$;
revoke execute on function public.student_history(uuid) from public, anon;
grant execute on function public.student_history(uuid) to authenticated;

-- 5) Отчёты: год → четверть → класс → предмет. Для текущего года — по журналу, для архивных — по архиву четвертей.
create or replace function public.report_rows(p_year text, p_quarter int default 0, p_class uuid default null, p_subject text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sc uuid := public.my_school(); d1 date; d2 date; y int; t academic_terms%rowtype; live jsonb; res jsonb; src text := 'live';
begin
  if sc is null or not public.is_staff() then return public._err('forbidden'); end if;
  if p_year is null or p_year !~ '^\d{4}/\d{4}$' then return public._err('bad_year'); end if;
  y := substr(p_year, 1, 4)::int;
  if coalesce(p_quarter, 0) = 0 then d1 := make_date(y, 9, 1); d2 := make_date(y + 1, 8, 31);
  else
    select * into t from academic_terms where year_label = p_year and kind = 'quarter' and num = p_quarter;
    if not found then return public._err('no_term'); end if;
    d1 := t.starts; d2 := t.ends;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('sid', q.sid, 'name', q.nm, 'cls', q.cn, 'subject', q.sj, 'g', q.gr, 'a', q.att) order by q.cn, q.nm, q.sj), '[]'::jsonb) into live from (
    select s.id sid, s.full_name nm, c.name cn, g.subject_id sj,
           jsonb_agg(jsonb_build_array(g.value, g.type, g.date, g.topic) order by g.date, g.created_at) gr,
           (select jsonb_build_object('p', count(*) filter (where a.status = 'p'), 'n', count(*) filter (where a.status = 'n'), 'l', count(*) filter (where a.status = 'l')) from attendance a where a.student_id = s.id and a.date between d1 and d2) att
    from grades g join students s on s.id = g.student_id left join classes c on c.id = s.class_id
    where g.school_id = sc and g.date between d1 and d2 and (p_class is null or s.class_id = p_class) and (p_subject is null or g.subject_id = p_subject)
      and (public.is_admin() or public.teaches_class(s.class_id))
    group by s.id, s.full_name, c.name, g.subject_id) q;
  if jsonb_array_length(live) > 0 then res := live;
  else
    src := 'archive';
    select coalesce(jsonb_agg(jsonb_build_object('sid', q.sid, 'name', q.nm, 'cls', q.cn, 'subject', q.sj, 'g', q.gr, 'a', q.att) order by q.cn, q.nm, q.sj), '[]'::jsonb) into res from (
      select qa.student_id sid, qa.student_name nm, qa.class_name cn, qa.subject_id sj,
             (select jsonb_agg(e order by e->>2) from quarter_archive z, jsonb_array_elements(z.grades) e where z.student_id = qa.student_id and z.subject_id = qa.subject_id and z.year_label = p_year and (coalesce(p_quarter, 0) = 0 or z.quarter = p_quarter) and z.school_id = sc) gr,
             null::jsonb att
      from quarter_archive qa
      where qa.school_id = sc and qa.year_label = p_year and (coalesce(p_quarter, 0) = 0 or qa.quarter = p_quarter) and (p_class is null or qa.class_id = p_class) and (p_subject is null or qa.subject_id = p_subject)
        and (public.is_admin() or public.teaches_class(qa.class_id))
      group by qa.student_id, qa.student_name, qa.class_name, qa.subject_id) q;
  end if;
  return jsonb_build_object('ok', true, 'src', src, 'from', d1, 'to', d2, 'rows', res);
end $$;
revoke execute on function public.report_rows(text, int, uuid, text) from public, anon;
grant execute on function public.report_rows(text, int, uuid, text) to authenticated;

-- 6) Удостоверение ученика: сам ученик, его родители и педагоги школы
create or replace function public.id_card(p_sid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s students%rowtype; sc schools%rowtype; c classes%rowtype;
begin
  if not public.can_see_student(p_sid) then return public._err('forbidden'); end if;
  select * into s from students where id = p_sid; select * into sc from schools where id = s.school_id; select * into c from classes where id = s.class_id;
  return jsonb_build_object('ok', true,
    'school', jsonb_build_object('name', sc.name, 'city', sc.city, 'code', sc.code),
    'student', jsonb_build_object('id', s.id, 'name', s.full_name, 'birth', s.birth_date, 'gender', s.gender, 'class', c.name, 'grade', c.grade, 'photo_path', s.photo_path,
       'number', 'ID-' || upper(substr(md5(s.id::text), 1, 8))),
    'homeroom', (select jsonb_build_object('name', p.full_name, 'phone', p.phone) from profiles p where p.id = c.homeroom_id),
    'parents', (select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'phone', p.phone, 'rel', ps.relation) order by p.full_name), '[]'::jsonb)
                from parent_students ps join profiles p on p.id = ps.parent_id where ps.student_id = s.id),
    'year', public._year_label_of(public._today()));
end $$;
revoke execute on function public.id_card(uuid) from public, anon;
grant execute on function public.id_card(uuid) to authenticated;

-- 7) Новости: форматированный текст (HTML-разметка очищается при показе), редактирование, подписи авторов
alter table public.news add column if not exists fmt text not null default 'text' check (fmt in ('text','html'));
alter table public.news add column if not exists edited_at timestamptz;
alter table public.news drop constraint if exists news_body_check;
alter table public.news drop constraint if exists news_body_check2;
alter table public.news add constraint news_body_check2 check (length(body) between 3 and 20000);

drop function if exists public.news_post(text, text, text, text, boolean, date, int);
create or replace function public.news_post(p_title text, p_body text, p_kind text default 'news', p_audience text default 'all', p_pinned boolean default false, p_event date default null, p_days int default null, p_fmt text default 'text') returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); cid uuid; nm text; nid uuid := gen_random_uuid();
begin
  if sc is null or not public.is_staff() then return public._err('forbidden'); end if;
  if p_kind not in ('news','alert','event','holiday') then return public._err('kind'); end if;
  if coalesce(p_fmt, 'text') not in ('text','html') then return public._err('fmt'); end if;
  if coalesce(length(trim(p_title)), 0) < 3 or coalesce(length(trim(p_body)), 0) < 3 then return public._err('short'); end if;
  if length(p_body) > 20000 then return public._err('long'); end if;
  if p_audience not in ('all','staff','students','parents') then
    if p_audience like 'class:%' then
      cid := public.safe_uuid(substr(p_audience, 7));
      if not exists (select 1 from classes where id = cid and school_id = sc) then return public._err('audience'); end if;
    else return public._err('audience'); end if;
  end if;
  if public.my_role() = 'teacher' then
    if cid is null or not public.teaches_class(cid) then return public._err('teacher_class_only'); end if;
    if p_pinned then p_pinned := false; end if;
    if (select count(*) from news where author_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then return public._err('rate'); end if;
  end if;
  select full_name into nm from profiles where id = auth.uid();
  insert into news (id, school_id, author_id, author_name, author_role, title, body, fmt, kind, audience, pinned, event_date, expires_at)
  values (nid, sc, auth.uid(), nm, public.my_role(), trim(p_title), trim(p_body), coalesce(p_fmt, 'text'), p_kind, p_audience, coalesce(p_pinned, false), p_event, case when p_days is not null and p_days between 1 and 365 then now() + make_interval(days => p_days) end);
  perform public.log_audit('news.posted', jsonb_build_object('news', nid, 'audience', p_audience));
  return jsonb_build_object('ok', true, 'id', nid);
end $$;
revoke execute on function public.news_post(text, text, text, text, boolean, date, int, text) from public, anon;
grant execute on function public.news_post(text, text, text, text, boolean, date, int, text) to authenticated;

drop function if exists public.super_news_post(text, text, boolean);
create or replace function public.super_news_post(p_title text, p_body text, p_pinned boolean default false, p_fmt text default 'text') returns jsonb
language plpgsql security definer set search_path = public as $$
declare nid uuid := gen_random_uuid();
begin
  if not public.is_super() then return public._err('forbidden'); end if;
  if coalesce(p_fmt, 'text') not in ('text','html') then return public._err('fmt'); end if;
  if coalesce(length(trim(p_title)), 0) < 3 or coalesce(length(trim(p_body)), 0) < 3 then return public._err('short'); end if;
  if length(p_body) > 20000 then return public._err('long'); end if;
  insert into news (id, school_id, author_id, author_name, author_role, title, body, fmt, kind, audience, pinned)
  values (nid, null, auth.uid(), 'SABAK+', 'superadmin', trim(p_title), trim(p_body), coalesce(p_fmt, 'text'), 'platform', 'all', coalesce(p_pinned, false));
  perform public._slog(null, 'super.news', jsonb_build_object('title', p_title));
  return jsonb_build_object('ok', true, 'id', nid);
end $$;
revoke execute on function public.super_news_post(text, text, boolean, text) from public, anon;
grant execute on function public.super_news_post(text, text, boolean, text) to authenticated;

create or replace function public.news_edit(p_id uuid, p_title text, p_body text, p_fmt text default 'html') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n news%rowtype;
begin
  select * into n from news where id = p_id and not deleted; if not found then return public._err('not_found'); end if;
  if n.school_id is null then if not public.is_super() then return public._err('forbidden'); end if;
  elsif n.school_id <> public.my_school() or not (public.is_admin() or n.author_id = auth.uid()) then return public._err('forbidden'); end if;
  if coalesce(length(trim(p_title)), 0) < 3 or coalesce(length(trim(p_body)), 0) < 3 then return public._err('short'); end if;
  if length(p_body) > 20000 or coalesce(p_fmt, 'html') not in ('text','html') then return public._err('long'); end if;
  update news set title = trim(p_title), body = trim(p_body), fmt = coalesce(p_fmt, 'html'), edited_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.news_edit(uuid, text, text, text) from public, anon;
grant execute on function public.news_edit(uuid, text, text, text) to authenticated;

create or replace function public.news_list() returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); out jsonb;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc, x->>'at' desc), '[]'::jsonb) into out from (
    select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'fmt', n.fmt, 'kind', n.kind, 'audience', n.audience, 'pinned', n.pinned, 'event_date', n.event_date,
      'author', n.author_name, 'author_role', n.author_role, 'at', n.created_at, 'edited', n.edited_at, 'platform', n.school_id is null,
      'read', exists (select 1 from news_reads nr where nr.news_id = n.id and nr.user_id = auth.uid()),
      'mine', n.author_id = auth.uid(),
      'reads', case when public.is_staff() and n.school_id is not null then (select count(*) from news_reads nr where nr.news_id = n.id) end) as x
    from news n where (n.school_id = sc or n.school_id is null) and public._news_vis(n) order by n.pinned desc, n.created_at desc limit 80) t;
  return jsonb_build_object('ok', true, 'rows', out, 'can_post', public.is_staff());
end $$;
revoke execute on function public.news_list() from public, anon;
grant execute on function public.news_list() to authenticated;
