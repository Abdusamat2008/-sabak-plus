-- =====================================================================================
-- SABAK+ v0.5 — миграция. Запускать ПОСЛЕ schema_v2.sql (один раз; повторный запуск безопасен).
-- Добавляет: предметы школы, движок достижений (триггеры), запрос документа классному
-- руководителю, расписание с версиями, одобрением директора и комментариями учителей.
-- =====================================================================================

-- ---------- 1. Предметы конкретной школы -------------------------------------------
alter table public.subjects add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.subjects add column if not exists emoji text;
create table if not exists public.subject_hidden (            -- школа «скрыла» стандартный предмет, которого у неё нет
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  primary key (school_id, subject_id)
);
alter table public.subject_hidden enable row level security;
alter table public.notifications add column if not exists ref text;     -- ссылка на объект (id версии расписания, код документа)

drop policy if exists subjects_read on public.subjects;
drop policy if exists subjects_add on public.subjects;
drop policy if exists subjects_upd on public.subjects;
drop policy if exists subjects_del on public.subjects;
create policy subjects_read on public.subjects for select to anon, authenticated using (school_id is null or school_id = public.my_school());
create policy subjects_add on public.subjects for insert to authenticated
  with check (school_id = public.my_school() and public.is_admin() and id like 's\_%');
create policy subjects_upd on public.subjects for update to authenticated
  using (school_id = public.my_school() and public.is_admin()) with check (school_id = public.my_school() and public.is_admin());
create policy subjects_del on public.subjects for delete to authenticated using (school_id = public.my_school() and public.is_admin());
drop policy if exists sh_read on public.subject_hidden;
drop policy if exists sh_add on public.subject_hidden;
drop policy if exists sh_del on public.subject_hidden;
create policy sh_read on public.subject_hidden for select to authenticated using (school_id = public.my_school());
create policy sh_add on public.subject_hidden for insert to authenticated with check (school_id = public.my_school() and public.is_admin());
create policy sh_del on public.subject_hidden for delete to authenticated using (school_id = public.my_school() and public.is_admin());
grant insert, delete on public.subjects to authenticated;
grant update (ru, ky, emoji) on public.subjects to authenticated;
grant select, insert, delete on public.subject_hidden to authenticated;

-- ---------- 2. Достижения: правила считает сервер -----------------------------------
create table if not exists public.student_achievements (
  student_id uuid not null references public.students(id) on delete cascade,
  ach_id text not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (student_id, ach_id)
);
alter table public.student_achievements enable row level security;
drop policy if exists sa_read on public.student_achievements;
create policy sa_read on public.student_achievements for select to authenticated using (public.can_see_student(student_id));
grant select on public.student_achievements to authenticated;       -- записывает только сервер (security definer)

create or replace function public._ach_meta(p_id text, out nm text, out ds text) language sql immutable as $$
  select v.n, v.d from (values
    ('first5','Первая пятёрка','Получить первую «5» в учебном году'),
    ('test5','Пятёрка за контрольную','Получить «5» за контрольную работу'),
    ('five10','Десять пятёрок','Набрать 10 оценок «5»'),
    ('fire7','Неделя огня','7 дней подряд только «5»'),
    ('fire30','Огонь: 30 дней подряд','30 дней подряд только «5»'),
    ('excel','Отличник предмета','Не менее 5 оценок по предмету и среднее от 4,8'),
    ('stable4','Ровно на «4» и выше','Итог не ниже «4» по всем предметам (от 3 предметов)'),
    ('climb','Рывок вперёд','Последние оценки по предмету выше предыдущих на 0,9 и больше'),
    ('att10','10 дней без «Н»','10 отмеченных учебных дней подряд без пропусков'),
    ('att30','30 дней без «Н»','30 отмеченных учебных дней подряд без пропусков — железная посещаемость'),
    ('punct20','Ни минуты опоздания','20 дней подряд без пропусков и опозданий'),
    ('hw10','10 заданий сделано','Отметить выполненными 10 домашних заданий'),
    ('hwclean','Ни одного долга','Выполнено 5 заданий и нет просроченных')
  ) v(id, n, d) where v.id = p_id $$;

-- Единственное место, где выдаются достижения. Правила совпадают с js/achv.js.
create or replace function public.evaluate_achievements(p_student uuid, p_notify boolean default true) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  sc uuid; cls uuid; sname text; r record; a text;
  fives int := 0; test5 int := 0; fstreak int := 0; nsub int := 0; all4 boolean := true; excel int := 0; climb numeric := 0;
  k int; tr numeric; att1 int := 0; att2 int := 0; hwd int := 0; hwo int := 0;
  ids text[] := '{}'; fresh text[] := '{}'; meta record; rc uuid;
begin
  select school_id, class_id, full_name into sc, cls, sname from public.students where id = p_student;
  if sc is null then return '{}'; end if;
  select count(*) filter (where value = 5), count(*) filter (where value = 5 and type = 'test') into fives, test5 from public.grades where student_id = p_student;
  for r in select date, min(value) mn from public.grades where student_id = p_student group by date order by date desc loop
    if r.mn = 5 then fstreak := fstreak + 1; else exit; end if;
  end loop;
  for r in select subject_id, array_agg(value order by date, id::text collate "C") v, count(*)::int n,
                  sum(case when type = 'test' then 2 else 1 end * value)::numeric / sum(case when type = 'test' then 2 else 1 end) av
           from public.grades where student_id = p_student group by subject_id loop
    nsub := nsub + 1;
    if floor(r.av + 0.5 + 1e-9) < 4 then all4 := false; end if;
    if r.n >= 5 and r.av >= 4.8 then excel := greatest(excel, r.n); end if;
    if r.n >= 5 then
      k := least(3, r.n / 2);
      tr := (select avg(x) from unnest(r.v[r.n - k + 1 : r.n]) x) - (select avg(x) from unnest(r.v[r.n - 2 * k + 1 : r.n - k]) x);
      climb := greatest(climb, tr);
    end if;
  end loop;
  for r in select status from public.attendance where student_id = p_student order by date desc loop
    if r.status = 'n' then exit; end if; att1 := att1 + 1;
  end loop;
  for r in select status from public.attendance where student_id = p_student order by date desc loop
    if r.status in ('n', 'l') then exit; end if; att2 := att2 + 1;
  end loop;
  select count(*) into hwd from public.homework_done d join public.homework h on h.id = d.homework_id where d.student_id = p_student and h.class_id = cls;
  select count(*) into hwo from public.homework h where h.class_id = cls and h.due_date < current_date
     and not exists (select 1 from public.homework_done d where d.homework_id = h.id and d.student_id = p_student);

  if fives >= 1 then ids := array_append(ids, 'first5'); end if;
  if test5 >= 1 then ids := array_append(ids, 'test5'); end if;
  if fives >= 10 then ids := array_append(ids, 'five10'); end if;
  if fstreak >= 7 then ids := array_append(ids, 'fire7'); end if;
  if fstreak >= 30 then ids := array_append(ids, 'fire30'); end if;
  if excel >= 5 then ids := array_append(ids, 'excel'); end if;
  if nsub >= 3 and all4 then ids := array_append(ids, 'stable4'); end if;
  if climb >= 0.9 - 1e-9 then ids := array_append(ids, 'climb'); end if;
  if att1 >= 10 then ids := array_append(ids, 'att10'); end if;
  if att1 >= 30 then ids := array_append(ids, 'att30'); end if;
  if att2 >= 20 then ids := array_append(ids, 'punct20'); end if;
  if hwd >= 10 then ids := array_append(ids, 'hw10'); end if;
  if hwd >= 5 and hwo = 0 then ids := array_append(ids, 'hwclean'); end if;

  foreach a in array ids loop
    insert into public.student_achievements (student_id, ach_id, school_id) values (p_student, a, sc) on conflict do nothing;
    if found then fresh := array_append(fresh, a); end if;
  end loop;

  if p_notify and array_length(fresh, 1) > 0 then
    foreach a in array fresh loop
      select * into meta from public._ach_meta(a);
      for rc in select profile_id from public.students where id = p_student and profile_id is not null
                union select parent_id from public.parent_students where student_id = p_student loop
        insert into public.notifications (school_id, to_user, student_id, kind, title, body, ref)
        values (sc, rc, p_student, 'achievement', '🏆 Достижение: ' || meta.nm, sname || ': ' || meta.ds || '.', a);
      end loop;
    end loop;
  end if;
  return fresh;
end $$;
revoke execute on function public.evaluate_achievements(uuid, boolean) from public, anon, authenticated;

create or replace function public.trg_ach_student() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' then return null; end if;
  begin perform public.evaluate_achievements(new.student_id); exception when others then null; end;   -- сбой достижений не должен ломать выставление оценки
  return null;
end $$;
drop trigger if exists ach_grades on public.grades;
drop trigger if exists ach_att on public.attendance;
drop trigger if exists ach_hw on public.homework_done;
create trigger ach_grades after insert or update on public.grades for each row execute function public.trg_ach_student();
create trigger ach_att after insert or update on public.attendance for each row execute function public.trg_ach_student();
create trigger ach_hw after insert on public.homework_done for each row execute function public.trg_ach_student();
alter function public.seed_demo_school() set "sabak.no_ach" = '1';      -- при загрузке демо-данных не шлём лавину уведомлений

-- Клиент может попросить проверку (например, при входе ученика): результат всё равно считает сервер.
create or replace function public.check_achievements(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public.my_school() is null or not public.can_see_student(p_student) then return public._err('forbidden'); end if;
  return jsonb_build_object('ok', true, 'new', to_jsonb(public.evaluate_achievements(p_student)));
end $$;

-- ---------- 3. Запрос недостающего документа классному руководителю ------------------
create or replace function public.request_documents(p_student uuid, p_docs text[], p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); stu public.students%rowtype; hr uuid; hrn text; lst text;
begin
  if sc is null or not public.is_admin() then return public._err('forbidden'); end if;
  select * into stu from public.students where id = p_student and school_id = sc;
  if not found then return public._err('not_found'); end if;
  select c.homeroom_id into hr from public.classes c where c.id = stu.class_id;
  if hr is null then return public._err('no_homeroom'); end if;
  if p_docs is null or array_length(p_docs, 1) is null then return public._err('empty'); end if;
  lst := left(array_to_string(p_docs, ', '), 600);
  insert into public.notifications (school_id, to_user, student_id, kind, title, body, ref, created_by)
  values (sc, hr, p_student, 'doc_request', 'Нет документов: ' || stu.full_name,
          'Администрация просит получить от семьи: ' || lst || '.' || coalesce(' Комментарий: ' || nullif(left(trim(p_note), 500), ''), ''), p_student::text, auth.uid());
  select full_name into hrn from public.profiles where id = hr;
  perform public.log_audit('doc.request', jsonb_build_object('student', p_student, 'docs', p_docs));
  return jsonb_build_object('ok', true, 'to', hrn);
end $$;

-- ---------- 4. Расписание ------------------------------------------------------------
create table if not exists public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','archived')),
  is_active boolean not null default false,
  data jsonb not null default '{"lessons":[]}'::jsonb,
  base_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text
);
create unique index if not exists schedule_one_active on public.schedule_versions(school_id) where is_active;
create table if not exists public.schedule_comments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author uuid references public.profiles(id) on delete set null,
  author_name text,
  text text not null check (char_length(text) between 3 and 2000),
  version_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.schedule_versions enable row level security;
alter table public.schedule_comments enable row level security;
drop policy if exists sv_read on public.schedule_versions;
drop policy if exists scm_read on public.schedule_comments;
-- Читать: все видят действующее; директор — всё; завуч — ещё и свои черновики/заявки.
create policy sv_read on public.schedule_versions for select to authenticated
  using (school_id = public.my_school() and (public.is_director() or created_by = auth.uid() or (is_active and status = 'approved')));
create policy scm_read on public.schedule_comments for select to authenticated
  using (school_id = public.my_school() and (public.is_admin() or author = auth.uid()));
grant select on public.schedule_versions, public.schedule_comments to authenticated;   -- запись — только через функции ниже

create or replace function public._notify_roles(p_school uuid, p_roles text[], p_kind text, p_title text, p_body text, p_ref text, p_except uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.notifications (school_id, to_user, kind, title, body, ref, created_by)
  select p_school, id, p_kind, p_title, p_body, p_ref, auth.uid() from public.profiles
  where school_id = p_school and status = 'active' and role = any(p_roles) and (p_except is null or id <> p_except);
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function public._notify_roles(uuid, text[], text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.schedule_save(p_id uuid, p_title text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); v public.schedule_versions%rowtype; nid uuid := coalesce(p_id, gen_random_uuid());
begin
  if sc is null or not public.is_admin() then return public._err('forbidden'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or coalesce(jsonb_typeof(p_data -> 'lessons'), '') <> 'array' or pg_column_size(p_data) > 400000 then return public._err('bad_data'); end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then return public._err('bad_title'); end if;
  select * into v from public.schedule_versions where id = nid;
  if found then
    if v.school_id <> sc or not (v.created_by = auth.uid() or public.is_director()) then return public._err('forbidden'); end if;
    if v.status not in ('draft', 'rejected') then return public._err('locked'); end if;     -- отправленное и утверждённое не правится
    update public.schedule_versions set title = left(trim(p_title), 120), data = p_data, status = 'draft', updated_at = now() where id = nid;
  else
    insert into public.schedule_versions (id, school_id, title, data, created_by) values (nid, sc, left(trim(p_title), 120), p_data, auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public._sched_publish(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.schedule_versions%rowtype;
begin
  select * into v from public.schedule_versions where id = p_id;
  update public.schedule_versions set is_active = false, status = 'archived' where school_id = v.school_id and is_active and id <> p_id;
  update public.schedule_versions set is_active = true, status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_note = nullif(left(trim(p_note), 500), ''), updated_at = now() where id = p_id;
  if v.created_by is not null and v.created_by <> auth.uid() then
    insert into public.notifications (school_id, to_user, kind, title, body, ref, created_by)
    values (v.school_id, v.created_by, 'schedule_approved', 'Расписание одобрено: ' || v.title, 'Директор утвердил ваше расписание — оно уже действует.' || coalesce(' Комментарий: ' || nullif(left(trim(p_note), 500), ''), ''), p_id::text, auth.uid());
  end if;
  perform public._notify_roles(v.school_id, array['director','deputy','teacher','parent','student'], 'schedule_new', 'Новое расписание: ' || v.title, 'Расписание обновлено — откройте раздел «Расписание».', p_id::text, v.created_by);
end $$;
revoke execute on function public._sched_publish(uuid, text) from public, anon, authenticated;

create or replace function public.schedule_submit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); v public.schedule_versions%rowtype; nm text;
begin
  if sc is null or not public.is_admin() then return public._err('forbidden'); end if;
  select * into v from public.schedule_versions where id = p_id and school_id = sc;
  if not found then return public._err('not_found'); end if;
  if not (v.created_by = auth.uid() or public.is_director()) then return public._err('forbidden'); end if;
  if v.status not in ('draft', 'rejected') then return public._err('locked'); end if;
  if jsonb_array_length(v.data -> 'lessons') = 0 then return public._err('empty'); end if;
  update public.schedule_versions set status = 'pending', submitted_at = now(), updated_at = now() where id = p_id;
  select full_name into nm from public.profiles where id = auth.uid();
  perform public._notify_roles(sc, array['director'], 'schedule_pending', 'Расписание ждёт одобрения', coalesce(nm, 'Завуч') || ' предлагает: «' || v.title || '».', p_id::text, auth.uid());
  perform public.log_audit('schedule.submit', jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.schedule_publish(p_id uuid) returns jsonb       -- директор публикует своё расписание сразу
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); v public.schedule_versions%rowtype;
begin
  if sc is null or not public.is_director() then return public._err('forbidden'); end if;
  select * into v from public.schedule_versions where id = p_id and school_id = sc;
  if not found then return public._err('not_found'); end if;
  if v.status in ('approved', 'archived') and v.is_active then return public._err('locked'); end if;
  if jsonb_array_length(v.data -> 'lessons') = 0 then return public._err('empty'); end if;
  perform public._sched_publish(p_id, null);
  perform public.log_audit('schedule.publish', jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.schedule_decide(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); v public.schedule_versions%rowtype;
begin
  if sc is null or not public.is_director() then return public._err('forbidden'); end if;
  select * into v from public.schedule_versions where id = p_id and school_id = sc;
  if not found then return public._err('not_found'); end if;
  if v.status <> 'pending' then return public._err('not_pending'); end if;
  if p_approve then
    perform public._sched_publish(p_id, p_note);
  else
    if char_length(trim(coalesce(p_note, ''))) < 3 then return public._err('note_required'); end if;
    update public.schedule_versions set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = left(trim(p_note), 500), updated_at = now() where id = p_id;
    if v.created_by is not null then
      insert into public.notifications (school_id, to_user, kind, title, body, ref, created_by)
      values (sc, v.created_by, 'schedule_rejected', 'Расписание не принято: ' || v.title, 'Директор не принял расписание. Причина: ' || left(trim(p_note), 500), p_id::text, auth.uid());
    end if;
  end if;
  perform public.log_audit(case when p_approve then 'schedule.approve' else 'schedule.reject' end, jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.schedule_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); v public.schedule_versions%rowtype;
begin
  if sc is null or not public.is_admin() then return public._err('forbidden'); end if;
  select * into v from public.schedule_versions where id = p_id and school_id = sc;
  if not found then return public._err('not_found'); end if;
  if v.is_active then return public._err('locked'); end if;
  if not (public.is_director() or (v.created_by = auth.uid() and v.status in ('draft', 'rejected'))) then return public._err('forbidden'); end if;
  delete from public.schedule_versions where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.schedule_comment(p_text text, p_version uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); nm text; n int;
begin
  if sc is null or public.my_role() not in ('teacher', 'deputy', 'director') then return public._err('forbidden'); end if;
  if char_length(trim(coalesce(p_text, ''))) < 3 then return public._err('too_short'); end if;
  select full_name into nm from public.profiles where id = auth.uid();
  insert into public.schedule_comments (school_id, author, author_name, text, version_id) values (sc, auth.uid(), nm, left(trim(p_text), 2000), p_version);
  n := public._notify_roles(sc, array['deputy'], 'schedule_comment', 'Комментарий к расписанию', coalesce(nm, 'Учитель') || ': ' || left(trim(p_text), 300), null, auth.uid());
  if n = 0 then perform public._notify_roles(sc, array['director'], 'schedule_comment', 'Комментарий к расписанию', coalesce(nm, 'Учитель') || ': ' || left(trim(p_text), 300), null, auth.uid()); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.schedule_comment_resolve(p_id uuid, p_on boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return public._err('forbidden'); end if;
  update public.schedule_comments set resolved = p_on where id = p_id and school_id = public.my_school();
  return jsonb_build_object('ok', true);
end $$;
