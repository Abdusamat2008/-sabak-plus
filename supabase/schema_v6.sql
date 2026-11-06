-- ============================================================================
-- SABAK+ · schema_v6.sql (версия 0.8) — запускать ПОСЛЕ schema_v2 … v5. Можно запускать повторно.
--   1. Причины низких оценок + дата оценки + план урока (тема и ДЗ из журнала)
--   2. Валюта «Алтын»: кошелёк, магазин, запросы на «отпроситься», переводы, начисления
--   3. Новости школы (изолированы между школами) + канал «От SABAK+»
--   4. «Үн» — мини-соцсеть школы: профили с @username, посты, лайки, комментарии, анонимный режим, модерация
--   5. Ключи школ: сервер помнит ключ до первого использования, проверка «ключ не существует»
-- Все новые данные закрыты RLS без политик: доступ только через функции, которые сами проверяют школу и роль.
-- ============================================================================

-- ---------- 0. Общие помощники -----------------------------------------------------
create or replace function public._my_sid() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where profile_id = auth.uid() limit 1 $$;
revoke execute on function public._my_sid() from public, anon;
grant execute on function public._my_sid() to authenticated;

-- ---------- 1. Оценки: причина, комментарий, дата ----------------------------------
alter table public.grades add column if not exists reason text;
alter table public.grades add column if not exists note text;
alter table public.grades drop constraint if exists grades_reason_chk;
alter table public.grades add constraint grades_reason_chk check (reason is null or reason in
  ('no_hw','discipline','unprepared','weak_answer','test_fail','cheating','no_supplies','not_submitted','other'));

create or replace function public.trg_grade_rules() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' then return new; end if;   -- демо-данные
  if new.value <= 2 and new.reason is null then raise exception 'reason_required'; end if;
  if new.reason = 'other' and coalesce(length(trim(new.note)), 0) < 3 then raise exception 'note_required'; end if;
  if new.value >= 4 then new.reason := null; end if;
  if tg_op = 'INSERT' then
    if new.date > current_date then raise exception 'future_date'; end if;
    if new.date < current_date - 45 then raise exception 'date_too_old'; end if;
  end if;
  new.note := nullif(left(trim(coalesce(new.note, '')), 300), '');
  return new;
end $$;
drop trigger if exists grade_rules on public.grades;
create trigger grade_rules before insert or update on public.grades for each row execute function public.trg_grade_rules();

-- План урока: тема и домашнее задание из журнала
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  date date not null,
  topic text not null check (length(topic) between 2 and 200),
  homework_id uuid references public.homework(id) on delete set null,
  by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id, date)
);
alter table public.lesson_notes enable row level security;
drop policy if exists ln_read on public.lesson_notes;
create policy ln_read on public.lesson_notes for select to authenticated using (
  school_id = public.my_school() and (public.is_admin() or public.teaches_class(class_id)
    or exists (select 1 from public.students s where s.class_id = lesson_notes.class_id and public.can_see_student(s.id))));
grant select on public.lesson_notes to authenticated;

create or replace function public.lesson_set(p_class uuid, p_subj text, p_date date, p_topic text, p_hw text default null, p_due date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school(); hw uuid; ok boolean;
begin
  if sc is null or not is_staff() then return _err('forbidden'); end if;
  if not exists (select 1 from classes where id = p_class and school_id = sc) then return _err('not_found'); end if;
  ok := is_admin() or exists (select 1 from teacher_assignments where teacher_id = auth.uid() and class_id = p_class and subject_id = p_subj);
  if not ok then return _err('forbidden'); end if;
  if p_date is null or p_date > current_date + 7 or p_date < current_date - 45 then return _err('bad_date'); end if;
  if coalesce(length(trim(p_topic)), 0) < 2 then return _err('topic_short'); end if;
  if coalesce(trim(p_hw), '') <> '' then
    if p_due is null or p_due < p_date then return _err('bad_due'); end if;
    select id into hw from homework where class_id = p_class and subject_id = p_subj and title = trim(p_hw) and due_date = p_due limit 1;
    if hw is null then insert into homework (school_id, class_id, subject_id, title, due_date, by) values (sc, p_class, p_subj, left(trim(p_hw), 300), p_due, auth.uid()) returning id into hw; end if;
  end if;
  insert into lesson_notes (school_id, class_id, subject_id, date, topic, homework_id, by)
  values (sc, p_class, p_subj, p_date, left(trim(p_topic), 200), hw, auth.uid())
  on conflict (class_id, subject_id, date) do update set topic = excluded.topic, homework_id = coalesce(excluded.homework_id, lesson_notes.homework_id), by = excluded.by;
  return jsonb_build_object('ok', true, 'homework_id', hw);
end $$;
revoke execute on function public.lesson_set(uuid, text, date, text, text, date) from public, anon;
grant execute on function public.lesson_set(uuid, text, date, text, text, date) to authenticated;

-- ---------- 2. Валюта «Алтын» ------------------------------------------------------
create table if not exists public.coin_items (
  school_id uuid not null references public.schools(id) on delete cascade,
  id text not null,
  ru text not null, ky text, emoji text, descr text,
  price int not null check (price between 1 and 5000),
  kind text not null check (kind in ('skip_lesson','skip_day','hw_pass','retake','extra_time','perk','cosmetic')),
  approver text not null default 'teacher' check (approver in ('teacher','homeroom','admin','auto')),
  needs_reason boolean not null default false,
  limit_n int not null default 0,
  limit_days int not null default 30,
  enabled boolean not null default true,
  sort int not null default 100,
  primary key (school_id, id)
);
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  delta int not null,
  kind text not null,
  ref uuid,
  note text,
  by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists coin_ledger_ref on public.coin_ledger (student_id, kind, ref) where ref is not null;
create index if not exists coin_ledger_student on public.coin_ledger (student_id, created_at desc);
create table if not exists public.coin_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  item_id text not null,
  kind text not null,
  subject_id text,
  for_date date,
  reason text,
  cost int not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists coin_requests_school on public.coin_requests (school_id, status, created_at desc);
alter table public.coin_items enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.coin_requests enable row level security;

create or replace function public._coin_seed(p_school uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into coin_items (school_id, id, ru, ky, emoji, descr, price, kind, approver, needs_reason, limit_n, limit_days, sort) values
   (p_school, 'skip_lesson', 'Отпроситься с урока', 'Сабактан уруксат алуу', '🚪', 'Один урок по выбранному предмету. Нужна причина; решает учитель предмета. Если откажут — алтыны вернутся.', 40, 'skip_lesson', 'teacher', true, 2, 7, 10),
   (p_school, 'skip_day', 'Отпроситься с учебного дня', 'Окуу күнүнөн уруксат алуу', '🏠', 'Весь учебный день. Только при уважительной причине; решает классный руководитель или администрация.', 150, 'skip_day', 'homeroom', true, 1, 90, 20),
   (p_school, 'hw_pass', 'Пропуск домашнего задания', 'Үй ишин өткөрүп жиберүү', '📘', 'Одно домашнее задание без оценки «2» за несделанное.', 25, 'hw_pass', 'teacher', false, 2, 14, 30),
   (p_school, 'retake', 'Пересдача оценки', 'Бааны кайра тапшыруу', '🔁', 'Шанс переписать работу, за которую получена «2» или «3». Укажите, какую.', 60, 'retake', 'teacher', true, 1, 30, 40),
   (p_school, 'extra_time', '+10 минут на контрольной', '+10 мүнөт', '⏱️', 'Дополнительное время на выбранной контрольной.', 30, 'extra_time', 'teacher', false, 1, 14, 50),
   (p_school, 'perk_music', 'Музыка на перемене', 'Танафыста музыка', '🎧', 'Выбрать плейлист на одну перемену (по согласованию с классным руководителем).', 20, 'perk', 'homeroom', false, 1, 14, 60),
   (p_school, 'perk_seat', 'Выбрать место на уроке', 'Сабакта орун тандоо', '🪑', 'Пересесть на выбранное место на неделю.', 15, 'perk', 'teacher', false, 1, 14, 70),
   (p_school, 'cosmetic_themes', 'Набор тем профиля «Үн»', 'Үн профили темалары', '🎨', 'Открывает премиум-темы и обложки профиля в школьной ленте «Үн». Применяется сразу.', 50, 'cosmetic', 'auto', false, 1, 36500, 80)
  on conflict (school_id, id) do nothing;
end $$;
revoke execute on function public._coin_seed(uuid) from public, anon, authenticated;
create or replace function public.trg_school_coin_seed() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public._coin_seed(new.id); return new; end $$;
drop trigger if exists school_coin_seed on public.schools;
create trigger school_coin_seed after insert on public.schools for each row execute function public.trg_school_coin_seed();
do $$ declare s record; begin for s in select id from public.schools loop perform public._coin_seed(s.id); end loop; end $$;

create or replace function public.coin_balance(p_sid uuid) returns int language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(sum(delta), 0))::int from public.coin_ledger where student_id = p_sid $$;
revoke execute on function public.coin_balance(uuid) from public, anon, authenticated;

-- Проводка. Заработок за день ограничен (40), в минус баланс не уходит.
create or replace function public._coin_add(p_sid uuid, p_delta int, p_kind text, p_ref uuid, p_note text, p_by uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare sc uuid; bal int; d int := p_delta; earned int;
begin
  select school_id into sc from students where id = p_sid; if sc is null then return 0; end if;
  bal := coin_balance(p_sid);
  if d > 0 and p_kind in ('grade','hw','ach') then
    select coalesce(sum(delta), 0) into earned from coin_ledger where student_id = p_sid and kind in ('grade','hw','ach') and delta > 0 and created_at >= date_trunc('day', now());
    d := least(d, greatest(0, 40 - earned));
  end if;
  if d < 0 and p_kind in ('grade','revert') then d := -least(-d, bal); end if;
  if d = 0 then return 0; end if;
  insert into coin_ledger (school_id, student_id, delta, kind, ref, note, by) values (sc, p_sid, d, p_kind, p_ref, left(p_note, 160), p_by) on conflict do nothing;
  return d;
end $$;
revoke execute on function public._coin_add(uuid, int, text, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_coin_grade() returns trigger language plpgsql security definer set search_path = public as $$
declare d int; sn text; r record;
begin
  if tg_op = 'DELETE' then
    for r in select delta from coin_ledger where student_id = old.student_id and kind = 'grade' and ref = old.id loop
      perform _coin_add(old.student_id, -r.delta, 'revert', old.id, 'Оценка отменена');
    end loop;
    return old;
  end if;
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' then return new; end if;
  d := case new.value when 5 then 4 when 4 then 2 when 2 then -2 else 0 end;
  if new.type = 'test' and d > 0 then d := d * 2; end if;
  if d <> 0 then
    select ru into sn from subjects where id = new.subject_id;
    perform _coin_add(new.student_id, d, 'grade', new.id, 'Оценка ' || new.value || ' · ' || coalesce(sn, ''));
  end if;
  return new;
end $$;
drop trigger if exists coin_grade on public.grades;
create trigger coin_grade after insert or delete on public.grades for each row execute function public.trg_coin_grade();

create or replace function public.trg_coin_hw() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' then return new; end if;
  perform _coin_add(new.student_id, 1, 'hw', new.homework_id, 'Домашнее задание выполнено');
  return new;
end $$;
drop trigger if exists coin_hw on public.homework_done;
create trigger coin_hw after insert on public.homework_done for each row execute function public.trg_coin_hw();

create or replace function public.trg_coin_ach() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('sabak.no_ach', true), '') = '1' then return new; end if;
  perform _coin_add(new.student_id, 25, 'ach', md5(new.student_id::text || new.ach_id)::uuid, 'Достижение: ' || new.ach_id);
  return new;
end $$;
drop trigger if exists coin_ach on public.student_achievements;
create trigger coin_ach after insert on public.student_achievements for each row execute function public.trg_coin_ach();

-- Кошелёк ученика (родитель видит кошелёк ребёнка: p_sid)
create or replace function public.coin_state(p_sid uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid; sc uuid := my_school(); r text := my_role();
begin
  if sc is null then return _err('auth'); end if;
  if r = 'student' then sid := _my_sid();
  elsif r = 'parent' then if p_sid is null or not is_parent_of(p_sid) then return _err('forbidden'); end if; sid := p_sid;
  else return _err('forbidden'); end if;
  if sid is null then return _err('no_student'); end if;
  perform _coin_seed(sc);
  return jsonb_build_object('ok', true, 'sid', sid, 'balance', coin_balance(sid),
    'earned', (select coalesce(sum(delta), 0) from coin_ledger where student_id = sid and delta > 0 and kind <> 'refund' and kind <> 'transfer_in'),
    'spent', (select coalesce(-sum(delta), 0) from coin_ledger where student_id = sid and kind = 'spend'),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'delta', l.delta, 'kind', l.kind, 'note', l.note, 'at', l.created_at) order by l.created_at desc)
        from (select * from coin_ledger where student_id = sid order by created_at desc limit 60) l), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'ru', i.ru, 'ky', i.ky, 'emoji', i.emoji, 'descr', i.descr, 'price', i.price, 'kind', i.kind,
        'needs_reason', i.needs_reason, 'limit_n', i.limit_n, 'limit_days', i.limit_days, 'approver', i.approver,
        'used', (select count(*) from coin_requests q where q.student_id = sid and q.item_id = i.id and q.status in ('pending','approved') and q.created_at > now() - make_interval(days => i.limit_days)))
        order by i.sort) from coin_items i where i.school_id = sc and i.enabled), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'item_id', q.item_id, 'item', i.ru, 'emoji', i.emoji, 'kind', q.kind, 'subject', q.subject_id, 'for_date', q.for_date,
        'reason', q.reason, 'cost', q.cost, 'status', q.status, 'note', q.decision_note, 'at', q.created_at, 'decided', q.decided_at) order by q.created_at desc)
        from (select * from coin_requests where student_id = sid order by created_at desc limit 40) q left join coin_items i on i.school_id = q.school_id and i.id = q.item_id), '[]'::jsonb),
    'unlocked', coalesce((select jsonb_agg(distinct q.item_id) from coin_requests q where q.student_id = sid and q.kind = 'cosmetic' and q.status = 'approved'), '[]'::jsonb));
end $$;
revoke execute on function public.coin_state(uuid) from public, anon;
grant execute on function public.coin_state(uuid) to authenticated;

create or replace function public.coin_request(p_item text, p_subj text default null, p_date date default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _my_sid(); sc uuid := my_school(); it coin_items%rowtype; used int; rid uuid := gen_random_uuid();
begin
  if my_role() <> 'student' or sid is null then return _err('forbidden'); end if;
  select * into it from coin_items where school_id = sc and id = p_item and enabled;
  if not found then return _err('no_item'); end if;
  if it.needs_reason and coalesce(length(trim(p_reason)), 0) < 10 then return _err('reason_short'); end if;
  if it.kind = 'skip_lesson' and coalesce(p_subj, '') = '' then return _err('subject_required'); end if;
  if it.kind in ('skip_lesson','skip_day','extra_time') then
    if p_date is null then return _err('date_required'); end if;
    if p_date < current_date or p_date > current_date + 14 then return _err('date_range'); end if;
    if it.kind in ('skip_lesson','skip_day') and extract(isodow from p_date) > 5 then return _err('weekend'); end if;
  end if;
  if it.kind in ('skip_lesson','skip_day') and exists (select 1 from coin_requests where student_id = sid and for_date = p_date and kind = 'skip_day' and status in ('pending','approved')) then return _err('duplicate'); end if;
  if it.kind = 'skip_day' and exists (select 1 from coin_requests where student_id = sid and for_date = p_date and kind = 'skip_lesson' and status in ('pending','approved')) then return _err('duplicate'); end if;
  select count(*) into used from coin_requests where student_id = sid and item_id = it.id and status in ('pending','approved') and created_at > now() - make_interval(days => it.limit_days);
  if it.limit_n > 0 and used >= it.limit_n then return _err('limit'); end if;
  if coin_balance(sid) < it.price then return _err('no_funds'); end if;
  insert into coin_requests (id, school_id, student_id, item_id, kind, subject_id, for_date, reason, cost, status, decided_at)
  values (rid, sc, sid, it.id, it.kind, nullif(p_subj, ''), p_date, nullif(left(trim(coalesce(p_reason, '')), 400), ''), it.price,
          case when it.approver = 'auto' then 'approved' else 'pending' end, case when it.approver = 'auto' then now() end);
  perform _coin_add(sid, -it.price, 'spend', rid, it.ru);
  return jsonb_build_object('ok', true, 'id', rid, 'status', case when it.approver = 'auto' then 'approved' else 'pending' end, 'balance', coin_balance(sid));
end $$;
revoke execute on function public.coin_request(text, text, date, text) from public, anon;
grant execute on function public.coin_request(text, text, date, text) to authenticated;

create or replace function public.coin_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare q coin_requests%rowtype; sid uuid := _my_sid();
begin
  select * into q from coin_requests where id = p_id and student_id = sid;
  if not found then return _err('not_found'); end if;
  if q.status <> 'pending' then return _err('not_pending'); end if;
  update coin_requests set status = 'cancelled', decided_at = now() where id = p_id;
  perform _coin_add(sid, q.cost, 'refund', q.id, 'Возврат: запрос отменён');
  return jsonb_build_object('ok', true, 'balance', coin_balance(sid));
end $$;
revoke execute on function public.coin_cancel(uuid) from public, anon;
grant execute on function public.coin_cancel(uuid) to authenticated;

-- Кто решает запрос: администрация — любой; «teacher» — учитель предмета (для уроков) или учитель класса; «homeroom» — классный руководитель
create or replace function public._can_decide(p_req uuid) returns boolean language plpgsql stable security definer set search_path = public as $$
declare q coin_requests%rowtype; it coin_items%rowtype; cid uuid;
begin
  select * into q from coin_requests where id = p_req; if not found or q.school_id <> my_school() then return false; end if;
  if is_admin() then return true; end if;
  if my_role() <> 'teacher' then return false; end if;
  select * into it from coin_items where school_id = q.school_id and id = q.item_id;
  cid := student_class(q.student_id);
  if it.approver = 'admin' or it.approver = 'auto' then return false; end if;
  if it.approver = 'homeroom' then return is_homeroom_class(cid); end if;
  if q.kind = 'skip_lesson' and q.subject_id is not null then
    return exists (select 1 from teacher_assignments where teacher_id = auth.uid() and class_id = cid and subject_id = q.subject_id) or is_homeroom_class(cid);
  end if;
  return teaches_class(cid);
end $$;
revoke execute on function public._can_decide(uuid) from public, anon;
grant execute on function public._can_decide(uuid) to authenticated;

create or replace function public.coin_staff(p_status text default 'pending') returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school();
begin
  if sc is null or not is_staff() then return _err('forbidden'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(row order by (row->>'at') desc) from (
    select jsonb_build_object('id', q.id, 'student', s.full_name, 'sid', s.id, 'cls', c.name, 'item', i.ru, 'emoji', i.emoji, 'kind', q.kind, 'subject', q.subject_id, 'for_date', q.for_date,
        'reason', q.reason, 'cost', q.cost, 'status', q.status, 'note', q.decision_note, 'at', q.created_at, 'decided', q.decided_at,
        'avg', (select round(avg(g.value)::numeric, 2) from grades g where g.student_id = s.id and g.date > current_date - 30 and (q.subject_id is null or g.subject_id = q.subject_id)),
        'abs30', (select count(*) from attendance a where a.student_id = s.id and a.status = 'n' and a.date > current_date - 30),
        'balance', coin_balance(s.id)) as row
    from coin_requests q join students s on s.id = q.student_id left join classes c on c.id = s.class_id left join coin_items i on i.school_id = q.school_id and i.id = q.item_id
    where q.school_id = sc and (p_status = 'all' or q.status = p_status) and q.kind <> 'cosmetic' and _can_decide(q.id)
    order by q.created_at desc limit 120) t), '[]'::jsonb));
end $$;
revoke execute on function public.coin_staff(text) from public, anon;
grant execute on function public.coin_staff(text) to authenticated;

create or replace function public.coin_decide(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q coin_requests%rowtype;
begin
  if not is_staff() then return _err('forbidden'); end if;
  if not _can_decide(p_id) then return _err('forbidden'); end if;
  select * into q from coin_requests where id = p_id for update;
  if q.status <> 'pending' then return _err('not_pending'); end if;
  if not p_approve and coalesce(length(trim(p_note)), 0) < 3 then return _err('note_required'); end if;
  update coin_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(left(trim(coalesce(p_note, '')), 300), '') where id = p_id;
  if not p_approve then perform _coin_add(q.student_id, q.cost, 'refund', q.id, 'Возврат: запрос отклонён'); end if;
  perform log_audit('coin.' || case when p_approve then 'approved' else 'rejected' end, jsonb_build_object('request', p_id, 'kind', q.kind, 'student', q.student_id));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.coin_decide(uuid, boolean, text) from public, anon;
grant execute on function public.coin_decide(uuid, boolean, text) to authenticated;

-- Поощрение от учителя (≤ 20 за раз, ≤ 100 в день на одного учителя) и «праздник класса» от администрации
create or replace function public.coin_award(p_sid uuid, p_amount int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare given int;
begin
  if not is_staff() or student_school(p_sid) is distinct from my_school() then return _err('forbidden'); end if;
  if not (is_admin() or teaches_class(student_class(p_sid))) then return _err('forbidden'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 20 then return _err('amount'); end if;
  if coalesce(length(trim(p_note)), 0) < 3 then return _err('note_required'); end if;
  select coalesce(sum(delta), 0) into given from coin_ledger where by = auth.uid() and kind = 'award' and created_at >= date_trunc('day', now());
  if given + p_amount > 100 then return _err('day_limit'); end if;
  perform _coin_add(p_sid, p_amount, 'award', null, 'Поощрение: ' || trim(p_note), auth.uid());
  return jsonb_build_object('ok', true, 'balance', coin_balance(p_sid));
end $$;
revoke execute on function public.coin_award(uuid, int, text) from public, anon;
grant execute on function public.coin_award(uuid, int, text) to authenticated;

create or replace function public.coin_award_class(p_class uuid, p_amount int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; n int := 0;
begin
  if not is_admin() or not exists (select 1 from classes where id = p_class and school_id = my_school()) then return _err('forbidden'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 10 then return _err('amount'); end if;
  if coalesce(length(trim(p_note)), 0) < 3 then return _err('note_required'); end if;
  for s in select id from students where class_id = p_class loop perform _coin_add(s.id, p_amount, 'award', null, 'Класс: ' || trim(p_note), auth.uid()); n := n + 1; end loop;
  perform log_audit('coin.class_award', jsonb_build_object('class', p_class, 'amount', p_amount, 'n', n));
  return jsonb_build_object('ok', true, 'n', n);
end $$;
revoke execute on function public.coin_award_class(uuid, int, text) from public, anon;
grant execute on function public.coin_award_class(uuid, int, text) to authenticated;

-- Администрация: цены и каталог школы
create or replace function public.coin_admin() returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school();
begin
  if not is_admin() then return _err('forbidden'); end if;
  perform _coin_seed(sc);
  return jsonb_build_object('ok', true,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'ru', i.ru, 'emoji', i.emoji, 'descr', i.descr, 'price', i.price, 'kind', i.kind, 'approver', i.approver, 'limit_n', i.limit_n, 'limit_days', i.limit_days, 'enabled', i.enabled) order by i.sort) from coin_items i where i.school_id = sc), '[]'::jsonb),
    'stats', jsonb_build_object('circulation', (select coalesce(sum(greatest(b, 0)), 0) from (select sum(delta) b from coin_ledger where school_id = sc group by student_id) x),
      'spent_30d', (select coalesce(-sum(delta), 0) from coin_ledger where school_id = sc and kind = 'spend' and created_at > now() - interval '30 days'),
      'pending', (select count(*) from coin_requests where school_id = sc and status = 'pending' and kind <> 'cosmetic')));
end $$;
revoke execute on function public.coin_admin() from public, anon;
grant execute on function public.coin_admin() to authenticated;

create or replace function public.coin_item_set(p_id text, p_price int, p_enabled boolean, p_limit_n int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return _err('forbidden'); end if;
  if p_price is null or p_price < 1 or p_price > 5000 then return _err('price'); end if;
  update coin_items set price = p_price, enabled = coalesce(p_enabled, enabled), limit_n = coalesce(p_limit_n, limit_n) where school_id = my_school() and id = p_id;
  if not found then return _err('not_found'); end if;
  perform log_audit('coin.item_set', jsonb_build_object('item', p_id, 'price', p_price, 'enabled', p_enabled));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.coin_item_set(text, int, boolean, int) from public, anon;
grant execute on function public.coin_item_set(text, int, boolean, int) to authenticated;

create or replace function public.coin_item_add(p_ru text, p_emoji text, p_price int, p_descr text default null, p_approver text default 'teacher') returns jsonb
language plpgsql security definer set search_path = public as $$
declare iid text := 'perk_' || substr(md5(random()::text), 1, 8);
begin
  if not is_admin() then return _err('forbidden'); end if;
  if coalesce(length(trim(p_ru)), 0) < 3 or length(p_ru) > 80 then return _err('name'); end if;
  if p_price is null or p_price < 1 or p_price > 5000 then return _err('price'); end if;
  if p_approver not in ('teacher','homeroom','admin') then return _err('approver'); end if;
  insert into coin_items (school_id, id, ru, emoji, descr, price, kind, approver, limit_n, limit_days, sort)
  values (my_school(), iid, trim(p_ru), left(coalesce(nullif(trim(p_emoji), ''), '🎁'), 8), left(p_descr, 200), p_price, 'perk', p_approver, 1, 14, 200);
  perform log_audit('coin.item_added', jsonb_build_object('item', iid, 'name', p_ru));
  return jsonb_build_object('ok', true, 'id', iid);
end $$;
revoke execute on function public.coin_item_add(text, text, int, text, text) from public, anon;
grant execute on function public.coin_item_add(text, text, int, text, text) to authenticated;


-- Перевод алтынов другому ученику своей школы по @username (лимит 30 за раз и 60 в день; нужен профиль «Үн»)
create or replace function public.coin_transfer(p_username text, p_amount int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := _my_sid(); sc uuid := my_school(); to_uid uuid; to_sid uuid; me_name text; to_name text; sent int;
begin
  if my_role() <> 'student' or sid is null then return _err('forbidden'); end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  select username into me_name from thread_profiles where user_id = auth.uid();
  if me_name is null then return _err('need_profile'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 30 then return _err('amount'); end if;
  select user_id, username into to_uid, to_name from thread_profiles where lower(username) = lower(trim(coalesce(p_username, ''))) and school_id = sc;
  if to_uid is null then return _err('no_user'); end if;
  if to_uid = auth.uid() then return _err('self'); end if;
  select id into to_sid from students where profile_id = to_uid;
  if to_sid is null then return _err('no_user'); end if;
  select coalesce(-sum(delta), 0) into sent from coin_ledger where student_id = sid and kind = 'transfer_out' and created_at >= date_trunc('day', now());
  if sent + p_amount > 60 then return _err('day_limit'); end if;
  if coin_balance(sid) < p_amount then return _err('no_funds'); end if;
  perform _coin_add(sid, -p_amount, 'transfer_out', null, '→ @' || to_name || coalesce(' · ' || left(trim(p_note), 60), ''));
  perform _coin_add(to_sid, p_amount, 'transfer_in', null, '← @' || me_name || coalesce(' · ' || left(trim(p_note), 60), ''));
  return jsonb_build_object('ok', true, 'balance', coin_balance(sid));
end $$;
revoke execute on function public.coin_transfer(text, int, text) from public, anon;
grant execute on function public.coin_transfer(text, int, text) to authenticated;

-- ---------- 3. Новости школы -------------------------------------------------------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,        -- null = канал платформы «От SABAK+»
  author_id uuid, author_name text, author_role text,
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) between 3 and 4000),
  kind text not null default 'news' check (kind in ('news','alert','event','holiday','platform')),
  audience text not null default 'all',
  pinned boolean not null default false,
  event_date date,
  expires_at timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists news_school on public.news (school_id, created_at desc);
create table if not exists public.news_reads (news_id uuid not null references public.news(id) on delete cascade, user_id uuid not null, at timestamptz not null default now(), primary key (news_id, user_id));
alter table public.news enable row level security;
alter table public.news_reads enable row level security;

create or replace function public._news_vis(n public.news) returns boolean language plpgsql stable security definer set search_path = public as $$
declare r text := my_role(); sc uuid := my_school(); cid uuid;
begin
  if n.deleted or (n.expires_at is not null and n.expires_at < now()) then return false; end if;
  if n.school_id is null then return true; end if;                      -- платформа: видят все школы
  if sc is null or n.school_id <> sc then return false; end if;
  if n.audience = 'all' then return true; end if;
  if r in ('director','deputy') then return true; end if;
  if n.audience = 'staff' then return r = 'teacher'; end if;
  if n.audience = 'students' then return r in ('student','teacher'); end if;
  if n.audience = 'parents' then return r in ('parent','teacher'); end if;
  if n.audience like 'class:%' then
    cid := safe_uuid(substr(n.audience, 7));
    if r = 'teacher' then return teaches_class(cid); end if;
    if r = 'student' then return exists (select 1 from students where profile_id = auth.uid() and class_id = cid); end if;
    if r = 'parent' then return exists (select 1 from parent_students ps join students s on s.id = ps.student_id where ps.parent_id = auth.uid() and s.class_id = cid); end if;
  end if;
  return false;
end $$;
revoke execute on function public._news_vis(public.news) from public, anon;
grant execute on function public._news_vis(public.news) to authenticated;

create or replace function public.news_list() returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school(); r text := my_role(); out jsonb;
begin
  if auth.uid() is null then return _err('auth'); end if;
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc, x->>'at' desc), '[]'::jsonb) into out from (
    select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'kind', n.kind, 'audience', n.audience, 'pinned', n.pinned, 'event_date', n.event_date,
      'author', n.author_name, 'author_role', n.author_role, 'at', n.created_at, 'platform', n.school_id is null,
      'read', exists (select 1 from news_reads nr where nr.news_id = n.id and nr.user_id = auth.uid()),
      'mine', n.author_id = auth.uid(),
      'reads', case when is_staff() and n.school_id is not null then (select count(*) from news_reads nr where nr.news_id = n.id) end) as x
    from news n where (n.school_id = sc or n.school_id is null) and _news_vis(n) order by n.pinned desc, n.created_at desc limit 80) t;
  return jsonb_build_object('ok', true, 'rows', out, 'can_post', is_staff());
end $$;
revoke execute on function public.news_list() from public, anon;
grant execute on function public.news_list() to authenticated;

create or replace function public.news_post(p_title text, p_body text, p_kind text default 'news', p_audience text default 'all', p_pinned boolean default false, p_event date default null, p_days int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school(); cid uuid; nm text; nid uuid := gen_random_uuid();
begin
  if sc is null or not is_staff() then return _err('forbidden'); end if;
  if p_kind not in ('news','alert','event','holiday') then return _err('kind'); end if;
  if coalesce(length(trim(p_title)), 0) < 3 or coalesce(length(trim(p_body)), 0) < 3 then return _err('short'); end if;
  if p_audience not in ('all','staff','students','parents') then
    if p_audience like 'class:%' then
      cid := safe_uuid(substr(p_audience, 7));
      if not exists (select 1 from classes where id = cid and school_id = sc) then return _err('audience'); end if;
    else return _err('audience'); end if;
  end if;
  if my_role() = 'teacher' then
    if cid is null or not teaches_class(cid) then return _err('teacher_class_only'); end if;
    if p_pinned then p_pinned := false; end if;
    if (select count(*) from news where author_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then return _err('rate'); end if;
  end if;
  select full_name into nm from profiles where id = auth.uid();
  insert into news (id, school_id, author_id, author_name, author_role, title, body, kind, audience, pinned, event_date, expires_at)
  values (nid, sc, auth.uid(), nm, my_role(), trim(p_title), trim(p_body), p_kind, p_audience, coalesce(p_pinned, false), p_event, case when p_days is not null and p_days between 1 and 365 then now() + make_interval(days => p_days) end);
  perform log_audit('news.posted', jsonb_build_object('news', nid, 'audience', p_audience));
  return jsonb_build_object('ok', true, 'id', nid);
end $$;
revoke execute on function public.news_post(text, text, text, text, boolean, date, int) from public, anon;
grant execute on function public.news_post(text, text, text, text, boolean, date, int) to authenticated;

create or replace function public.news_set(p_id uuid, p_pinned boolean default null, p_delete boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n news%rowtype;
begin
  select * into n from news where id = p_id; if not found then return _err('not_found'); end if;
  if n.school_id is null then
    if my_role() <> 'superadmin' then return _err('forbidden'); end if;
  else
    if n.school_id <> my_school() or not (is_admin() or n.author_id = auth.uid()) then return _err('forbidden'); end if;
    if p_pinned is not null and not is_admin() then return _err('forbidden'); end if;
  end if;
  update news set pinned = coalesce(p_pinned, pinned), deleted = deleted or coalesce(p_delete, false) where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.news_set(uuid, boolean, boolean) from public, anon;
grant execute on function public.news_set(uuid, boolean, boolean) to authenticated;

create or replace function public.news_read(p_id uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare n news%rowtype;
begin
  if auth.uid() is null then return _err('auth'); end if;
  for n in select * from news where (p_id is null or id = p_id) and (school_id = my_school() or school_id is null) loop
    if _news_vis(n) then insert into news_reads (news_id, user_id) values (n.id, auth.uid()) on conflict do nothing; end if;
  end loop;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.news_read(uuid) from public, anon;
grant execute on function public.news_read(uuid) to authenticated;

create or replace function public.super_news_post(p_title text, p_body text, p_pinned boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nid uuid := gen_random_uuid();
begin
  perform public._need_super();
  if coalesce(length(trim(p_title)), 0) < 3 or coalesce(length(trim(p_body)), 0) < 3 then return _err('short'); end if;
  insert into news (id, school_id, author_id, author_name, author_role, title, body, kind, audience, pinned)
  values (nid, null, auth.uid(), 'SABAK+', 'superadmin', trim(p_title), trim(p_body), 'platform', 'all', coalesce(p_pinned, false));
  perform public._slog(null, 'super.news', jsonb_build_object('title', p_title));
  return jsonb_build_object('ok', true, 'id', nid);
end $$;
revoke execute on function public.super_news_post(text, text, boolean) from public, anon;
grant execute on function public.super_news_post(text, text, boolean) to authenticated;

-- ---------- 4. «Үн» — мини-соцсеть школы -------------------------------------------
alter table public.schools add column if not exists threads_enabled boolean not null default true;
alter table public.schools add column if not exists threads_reveal boolean not null default false;   -- может ли директор раскрыть автора при серьёзном нарушении

create table if not exists public.thread_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text,
  emoji text not null default '🙂',
  theme text not null default 'ocean',
  accent text not null default '#2352D8',
  cover_path text,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists thread_profiles_uname on public.thread_profiles (lower(username));
create table if not exists public.thread_usernames (            -- реестр ВСЕХ когда-либо занятых имён: повтор невозможен
  name_lc text primary key,
  user_id uuid not null,
  active boolean not null default true,
  released_at timestamptz
);
create table if not exists public.thread_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null,                                       -- закрыт: наружу не отдаётся никогда
  anon boolean not null default false,
  official boolean not null default false,
  alias text,
  body text not null,
  media_path text, media_kind text check (media_kind in ('image','video')),
  likes_n int not null default 0, comments_n int not null default 0, reports_n int not null default 0,
  hidden boolean not null default false, hidden_reason text,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists thread_posts_school on public.thread_posts (school_id, created_at desc);
create table if not exists public.thread_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.thread_posts(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null,
  anon boolean not null default false, official boolean not null default false, alias text,
  parent_id uuid references public.thread_comments(id) on delete cascade,
  body text not null,
  likes_n int not null default 0, reports_n int not null default 0,
  hidden boolean not null default false, deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists thread_comments_post on public.thread_comments (post_id, created_at);
create table if not exists public.thread_likes (user_id uuid not null, kind text not null check (kind in ('p','c')), ref_id uuid not null, primary key (user_id, kind, ref_id));
create table if not exists public.thread_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null, kind text not null check (kind in ('p','c')), ref_id uuid not null, reporter_id uuid not null, reason text not null,
  created_at timestamptz not null default now(), unique (reporter_id, kind, ref_id)
);
create table if not exists public.thread_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, school_id uuid not null, until timestamptz not null, reason text, ref_kind text, ref_id uuid, by uuid, created_at timestamptz not null default now()
);
create table if not exists public.thread_blocklist (id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id) on delete cascade, word text not null);
create unique index if not exists thread_blocklist_w on public.thread_blocklist (coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(word));
do $$ begin
  insert into public.thread_blocklist (school_id, word) values (null, 'дурак'), (null, 'идиот'), (null, 'дебил'), (null, 'тупой'), (null, 'урод'), (null, 'лох'), (null, 'убью'), (null, 'сдохни'), (null, 'ненавижу тебя')
  on conflict do nothing;
end $$;
alter table public.thread_profiles enable row level security;
alter table public.thread_usernames enable row level security;
alter table public.thread_posts enable row level security;
alter table public.thread_comments enable row level security;
alter table public.thread_likes enable row level security;
alter table public.thread_reports enable row level security;
alter table public.thread_bans enable row level security;
alter table public.thread_blocklist enable row level security;

-- Проверка текста: ссылки, телефоны и стоп-слова не допускаются (защита детей от контактов извне)
create or replace function public._th_clean(p_text text, p_school uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare t text := lower(coalesce(p_text, ''));
begin
  if t ~ '(https?://|www\.|t\.me/|wa\.me/|[a-z0-9-]+\.(com|kg|ru|net|org|me|io|ly|tk|xyz|info)(/|\s|$))' then return 'links'; end if;
  if t ~ '\d[\d\s\-()]{7,}\d' then return 'phone'; end if;
  if exists (select 1 from thread_blocklist b where (b.school_id is null or b.school_id = p_school) and t like '%' || lower(b.word) || '%') then return 'blocked_word'; end if;
  return null;
end $$;
revoke execute on function public._th_clean(text, uuid) from public, anon, authenticated;

create or replace function public._th_alias(p_user uuid, p_seed uuid) returns text language sql immutable as $$
  select (array['🐆 Анонимный барс','🦊 Анонимная лиса','🐺 Анонимный волк','🦉 Анонимная сова','🐻 Анонимный медведь','🦅 Анонимный орёл','🐎 Анонимный конь','🐑 Анонимный баран','🦌 Анонимный олень','🐫 Анонимный верблюд','🐿️ Анонимная белка','🐯 Анонимный тигр'])
         [1 + (('x' || substr(md5(p_user::text || p_seed::text), 1, 6))::bit(24)::int % 12)] $$;
revoke execute on function public._th_alias(uuid, uuid) from public, anon, authenticated;


-- Псевдоним в обсуждении: один человек — один зверь внутри поста; разным людям — разные
create or replace function public._th_pick_alias(p_post uuid, p_user uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare a text[] := array['🐆 Анонимный барс','🦊 Анонимная лиса','🐺 Анонимный волк','🦉 Анонимная сова','🐻 Анонимный медведь','🦅 Анонимный орёл','🐎 Анонимный конь','🐑 Анонимный баран','🦌 Анонимный олень','🐫 Анонимный верблюд','🐿️ Анонимная белка','🐯 Анонимный тигр'];
  used text[]; i int; base int; al text; pa_author uuid; pa_alias text; pa_anon boolean;
begin
  select author_id, alias, anon into pa_author, pa_alias, pa_anon from thread_posts where id = p_post;
  if pa_anon and pa_author = p_user then return pa_alias; end if;
  select alias into al from thread_comments where post_id = p_post and author_id = p_user and anon limit 1;
  if al is not null then return al; end if;
  select coalesce(array_agg(distinct x), '{}') into used from (select alias x from thread_comments where post_id = p_post and anon and alias is not null union select pa_alias where pa_alias is not null) q;
  base := ('x' || substr(md5(p_user::text || p_post::text), 1, 6))::bit(24)::int % 12;
  for i in 0..11 loop
    if not (a[((base + i) % 12) + 1] = any(used)) then return a[((base + i) % 12) + 1]; end if;
  end loop;
  return a[base + 1] || ' #' || (coalesce(array_length(used, 1), 0) - 10);
end $$;
revoke execute on function public._th_pick_alias(uuid, uuid) from public, anon, authenticated;

-- Контекст: ученики и администрация имеют доступ; учителя и родители — нет (чтобы ученики говорили честно)
create or replace function public._th_ctx() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sc uuid := my_school(); r text := my_role(); en boolean;
begin
  if sc is null then return _err('auth'); end if;
  if r not in ('student','director','deputy') then return _err('no_access'); end if;
  select threads_enabled into en from schools where id = sc;
  if not coalesce(en, true) then return _err('disabled'); end if;
  if r = 'student' and _my_sid() is null then return _err('no_student'); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public._th_ctx() from public, anon, authenticated;

create or replace function public._th_banned(p_user uuid) returns timestamptz language sql stable security definer set search_path = public as $$
  select max(until) from thread_bans where user_id = p_user and until > now() $$;
revoke execute on function public._th_banned(uuid) from public, anon, authenticated;

create or replace function public._th_card(p_user uuid, p_anon boolean, p_alias text, p_official boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when p_official then jsonb_build_object('official', true, 'name', 'Администрация школы', 'emoji', '🏫')
    when p_anon then jsonb_build_object('anon', true, 'alias', p_alias)
    else coalesce((select jsonb_build_object('username', username, 'name', display_name, 'emoji', emoji, 'theme', theme, 'accent', accent) from thread_profiles where user_id = p_user),
                  jsonb_build_object('username', null, 'name', 'Ученик', 'emoji', '🙂', 'theme', 'ocean', 'accent', '#2352D8')) end $$;
revoke execute on function public._th_card(uuid, boolean, text, boolean) from public, anon, authenticated;

create or replace function public._th_uname_ok(p_name text, p_me uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare n text := lower(trim(coalesce(p_name, ''))); u thread_usernames%rowtype;
begin
  if n !~ '^[a-z][a-z0-9_]{4,31}$' or n like '%\_\_%' or n like '%\_' then return 'format'; end if;
  if n in ('admin','administrator','sabak','sabakplus','support','moderator','director','teacher','school','official','system','help','root','bot') or n like 'sabak%' then return 'reserved'; end if;
  select * into u from thread_usernames where name_lc = n;
  if not found then return null; end if;
  if u.user_id = p_me then return null; end if;
  if not u.active and u.released_at < now() - interval '90 days' then return null; end if;
  return 'taken';
end $$;
revoke execute on function public._th_uname_ok(text, uuid) from public, anon, authenticated;

create or replace function public.th_username_check(p_name text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c jsonb := _th_ctx(); e text;
begin
  if not (c->>'ok')::boolean then return c; end if;
  e := _th_uname_ok(p_name, auth.uid());
  return jsonb_build_object('ok', true, 'available', e is null, 'reason', e);
end $$;
revoke execute on function public.th_username_check(text) from public, anon;
grant execute on function public.th_username_check(text) to authenticated;

create or replace function public.th_me() returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); p thread_profiles%rowtype; sid uuid := _my_sid();
begin
  if not (c->>'ok')::boolean then
    if c->>'error' = 'disabled' then return jsonb_build_object('ok', true, 'enabled', false, 'role', my_role()); end if;
    return c;
  end if;
  select * into p from thread_profiles where user_id = auth.uid();
  return jsonb_build_object('ok', true, 'enabled', true, 'role', my_role(), 'mod', is_admin(),
    'reveal', (select threads_reveal from schools where id = sc),
    'banned', _th_banned(auth.uid()),
    'profile', case when found then jsonb_build_object('username', p.username, 'name', p.display_name, 'bio', p.bio, 'emoji', p.emoji, 'theme', p.theme, 'accent', p.accent, 'cover', p.cover_path, 'can_rename', p.username_changed_at is null or p.username_changed_at < now() - interval '7 days') end,
    'unlocked', exists (select 1 from coin_requests where student_id = sid and kind = 'cosmetic' and status = 'approved'));
end $$;
revoke execute on function public.th_me() from public, anon;
grant execute on function public.th_me() to authenticated;

create or replace function public.th_profile_save(p_username text, p_name text, p_bio text, p_emoji text, p_theme text, p_accent text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); n text := lower(trim(coalesce(p_username, ''))); old thread_profiles%rowtype; e text; sid uuid := _my_sid(); prem boolean;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if my_role() <> 'student' then return _err('students_only'); end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if coalesce(length(trim(p_name)), 0) < 2 or length(trim(p_name)) > 32 then return _err('name'); end if;
  if length(coalesce(p_bio, '')) > 140 then return _err('bio'); end if;
  if p_accent !~ '^#[0-9a-fA-F]{6}$' then return _err('accent'); end if;
  if p_theme !~ '^(x-)?[a-z0-9]{2,12}$' then return _err('theme'); end if;
  if length(coalesce(p_emoji, '')) < 1 or length(p_emoji) > 16 then return _err('emoji'); end if;
  prem := p_theme like 'x-%';
  if prem and not exists (select 1 from coin_requests where student_id = sid and kind = 'cosmetic' and status = 'approved') then return _err('locked_theme'); end if;
  e := _th_clean(coalesce(p_name, '') || ' ' || coalesce(p_bio, ''), sc); if e is not null then return _err(e); end if;
  select * into old from thread_profiles where user_id = auth.uid();
  if not found then
    e := _th_uname_ok(n, auth.uid()); if e is not null then return _err('username_' || e); end if;
    insert into thread_usernames (name_lc, user_id, active) values (n, auth.uid(), true)
      on conflict (name_lc) do update set user_id = auth.uid(), active = true, released_at = null;
    insert into thread_profiles (user_id, school_id, username, display_name, bio, emoji, theme, accent, username_changed_at)
    values (auth.uid(), sc, n, trim(p_name), nullif(trim(coalesce(p_bio, '')), ''), p_emoji, p_theme, p_accent, now());
  else
    if lower(old.username) <> n then
      if old.username_changed_at is not null and old.username_changed_at > now() - interval '7 days' then return _err('rename_cooldown'); end if;
      e := _th_uname_ok(n, auth.uid()); if e is not null then return _err('username_' || e); end if;
      update thread_usernames set active = false, released_at = now() where name_lc = lower(old.username);
      insert into thread_usernames (name_lc, user_id, active) values (n, auth.uid(), true)
        on conflict (name_lc) do update set user_id = auth.uid(), active = true, released_at = null;
      update thread_profiles set username = n, username_changed_at = now() where user_id = auth.uid();
    end if;
    update thread_profiles set display_name = trim(p_name), bio = nullif(trim(coalesce(p_bio, '')), ''), emoji = p_emoji, theme = p_theme, accent = p_accent, updated_at = now() where user_id = auth.uid();
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_profile_save(text, text, text, text, text, text) from public, anon;
grant execute on function public.th_profile_save(text, text, text, text, text, text) to authenticated;

create or replace function public.th_cover_set(p_path text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx();
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_path is not null and p_path not like my_school()::text || '/cover/' || auth.uid()::text || '%' then return _err('bad_path'); end if;
  update thread_profiles set cover_path = p_path, updated_at = now() where user_id = auth.uid();
  if not found then return _err('need_profile'); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_cover_set(text) from public, anon;
grant execute on function public.th_cover_set(text) to authenticated;

-- Лента
create or replace function public.th_feed(p_sort text default 'new', p_before timestamptz default null, p_limit int default 30, p_username text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); m boolean := is_admin(); uid uuid := auth.uid(); target uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_username is not null then select user_id into target from thread_profiles where lower(username) = lower(p_username) and school_id = sc; end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', p.id, 'body', case when p.deleted then '' else p.body end, 'media', p.media_path, 'media_kind', p.media_kind, 'at', p.created_at,
        'author', _th_card(p.author_id, p.anon, p.alias, p.official), 'likes', p.likes_n, 'comments', p.comments_n,
        'liked', exists (select 1 from thread_likes l where l.user_id = uid and l.kind = 'p' and l.ref_id = p.id),
        'mine', p.author_id = uid, 'hidden', p.hidden, 'reports', case when m then p.reports_n end) as x
    from thread_posts p
    where p.school_id = sc and not p.deleted and (m or not p.hidden or p.author_id = uid)
      and (p_username is null or (p.author_id = target and not p.anon and not p.official))
      and (p_before is null or p.created_at < p_before)
    order by case when p_sort = 'top' then (p.likes_n * 2 + p.comments_n * 3 + case when p.created_at > now() - interval '2 days' then 6 else 0 end) end desc nulls last, p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 50))) t), '[]'::jsonb));
end $$;
revoke execute on function public.th_feed(text, timestamptz, int, text) from public, anon;
grant execute on function public.th_feed(text, timestamptz, int, text) to authenticated;

create or replace function public.th_profile_get(p_username text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); p thread_profiles%rowtype;
begin
  if not (c->>'ok')::boolean then return c; end if;
  select * into p from thread_profiles where lower(username) = lower(trim(p_username)) and school_id = sc;
  if not found then return _err('not_found'); end if;
  return jsonb_build_object('ok', true, 'profile', jsonb_build_object('username', p.username, 'name', p.display_name, 'bio', p.bio, 'emoji', p.emoji, 'theme', p.theme, 'accent', p.accent, 'cover', p.cover_path, 'since', p.created_at, 'mine', p.user_id = auth.uid()),
    'posts', (select count(*) from thread_posts where author_id = p.user_id and not anon and not official and not deleted and not hidden),
    'likes', (select coalesce(sum(likes_n), 0) from thread_posts where author_id = p.user_id and not anon and not official and not deleted and not hidden));
end $$;
revoke execute on function public.th_profile_get(text) from public, anon;
grant execute on function public.th_profile_get(text) to authenticated;

create or replace function public.th_post(p_body text, p_anon boolean default false, p_media text default null, p_kind text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); pid uuid := gen_random_uuid(); r text := my_role(); e text; off boolean := r in ('director','deputy');
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if coalesce(length(trim(p_body)), 0) < 1 or length(p_body) > 600 then return _err('body'); end if;
  if off then p_anon := false; end if;
  if not p_anon and not off and not exists (select 1 from thread_profiles where user_id = auth.uid()) then return _err('need_profile'); end if;
  e := _th_clean(p_body, sc); if e is not null then return _err(e); end if;
  if (select count(*) from thread_posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 8 then return _err('rate'); end if;
  if p_media is not null then
    if p_media not like sc::text || '/p/' || auth.uid()::text || '%' or p_kind not in ('image','video') then return _err('media'); end if;
  end if;
  insert into thread_posts (id, school_id, author_id, anon, official, alias, body, media_path, media_kind)
  values (pid, sc, auth.uid(), p_anon, off, case when p_anon then _th_alias(auth.uid(), pid) end, trim(p_body), p_media, case when p_media is not null then p_kind end);
  return jsonb_build_object('ok', true, 'id', pid);
end $$;
revoke execute on function public.th_post(text, boolean, text, text) from public, anon;
grant execute on function public.th_post(text, boolean, text, text) to authenticated;

create or replace function public.th_like(p_kind text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); had boolean; n int;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_kind = 'p' then
    if not exists (select 1 from thread_posts where id = p_id and school_id = sc and not deleted) then return _err('not_found'); end if;
  elsif p_kind = 'c' then
    if not exists (select 1 from thread_comments where id = p_id and school_id = sc and not deleted) then return _err('not_found'); end if;
  else return _err('kind'); end if;
  delete from thread_likes where user_id = auth.uid() and kind = p_kind and ref_id = p_id; had := found;
  if not had then insert into thread_likes (user_id, kind, ref_id) values (auth.uid(), p_kind, p_id); end if;
  if p_kind = 'p' then update thread_posts set likes_n = (select count(*) from thread_likes where kind = 'p' and ref_id = p_id) where id = p_id returning likes_n into n;
  else update thread_comments set likes_n = (select count(*) from thread_likes where kind = 'c' and ref_id = p_id) where id = p_id returning likes_n into n; end if;
  return jsonb_build_object('ok', true, 'liked', not had, 'n', n);
end $$;
revoke execute on function public.th_like(text, uuid) from public, anon;
grant execute on function public.th_like(text, uuid) to authenticated;

create or replace function public.th_comments(p_post uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); m boolean := is_admin(); uid uuid := auth.uid(); opid uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  select author_id into opid from thread_posts where id = p_post and school_id = sc and not deleted;
  if opid is null then return _err('not_found'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(x order by x->>'at') from (
    select jsonb_build_object('id', k.id, 'parent', k.parent_id, 'body', k.body, 'at', k.created_at, 'author', _th_card(k.author_id, k.anon, k.alias, k.official),
      'op', k.author_id = opid, 'likes', k.likes_n, 'liked', exists (select 1 from thread_likes l where l.user_id = uid and l.kind = 'c' and l.ref_id = k.id),
      'mine', k.author_id = uid, 'hidden', k.hidden) as x
    from thread_comments k where k.post_id = p_post and not k.deleted and (m or not k.hidden or k.author_id = uid) order by k.created_at limit 200) t), '[]'::jsonb));
end $$;
revoke execute on function public.th_comments(uuid) from public, anon;
grant execute on function public.th_comments(uuid) to authenticated;

create or replace function public.th_comment(p_post uuid, p_body text, p_anon boolean default false, p_parent uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); off boolean := my_role() in ('director','deputy'); e text; kid uuid := gen_random_uuid();
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if not exists (select 1 from thread_posts where id = p_post and school_id = sc and not deleted and not hidden) then return _err('not_found'); end if;
  if coalesce(length(trim(p_body)), 0) < 1 or length(p_body) > 400 then return _err('body'); end if;
  if p_parent is not null and not exists (select 1 from thread_comments where id = p_parent and post_id = p_post and not deleted) then return _err('not_found'); end if;
  if off then p_anon := false; end if;
  if not p_anon and not off and not exists (select 1 from thread_profiles where user_id = auth.uid()) then return _err('need_profile'); end if;
  e := _th_clean(p_body, sc); if e is not null then return _err(e); end if;
  if (select count(*) from thread_comments where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then return _err('rate'); end if;
  insert into thread_comments (id, post_id, school_id, author_id, anon, official, alias, parent_id, body)
  values (kid, p_post, sc, auth.uid(), p_anon, off, case when p_anon then _th_pick_alias(p_post, auth.uid()) end, p_parent, trim(p_body));
  update thread_posts set comments_n = (select count(*) from thread_comments where post_id = p_post and not deleted) where id = p_post;
  return jsonb_build_object('ok', true, 'id', kid);
end $$;
revoke execute on function public.th_comment(uuid, text, boolean, uuid) from public, anon;
grant execute on function public.th_comment(uuid, text, boolean, uuid) to authenticated;

create or replace function public.th_report(p_kind text, p_id uuid, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); n int;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_reason not in ('bullying','threat','spam','inappropriate','private','other') then return _err('reason'); end if;
  if p_kind = 'p' and not exists (select 1 from thread_posts where id = p_id and school_id = sc and author_id <> auth.uid()) then return _err('not_found'); end if;
  if p_kind = 'c' and not exists (select 1 from thread_comments where id = p_id and school_id = sc and author_id <> auth.uid()) then return _err('not_found'); end if;
  if p_kind not in ('p','c') then return _err('kind'); end if;
  insert into thread_reports (school_id, kind, ref_id, reporter_id, reason) values (sc, p_kind, p_id, auth.uid(), p_reason) on conflict do nothing;
  if not found then return jsonb_build_object('ok', true, 'dup', true); end if;
  select count(*) into n from thread_reports where kind = p_kind and ref_id = p_id;
  if p_kind = 'p' then update thread_posts set reports_n = n, hidden = hidden or n >= 3 or p_reason = 'threat', hidden_reason = case when n >= 3 or p_reason = 'threat' then 'reports' else hidden_reason end where id = p_id;
  else update thread_comments set reports_n = n, hidden = hidden or n >= 3 or p_reason = 'threat' where id = p_id; end if;
  return jsonb_build_object('ok', true, 'reports', n);
end $$;
revoke execute on function public.th_report(text, uuid, text) from public, anon;
grant execute on function public.th_report(text, uuid, text) to authenticated;

create or replace function public.th_delete(p_kind text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); au uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_kind = 'p' then select author_id into au from thread_posts where id = p_id and school_id = sc;
  else select author_id into au from thread_comments where id = p_id and school_id = sc; end if;
  if au is null then return _err('not_found'); end if;
  if au <> auth.uid() and not is_admin() then return _err('forbidden'); end if;
  if p_kind = 'p' then update thread_posts set deleted = true, body = '' where id = p_id;
  else update thread_comments set deleted = true, body = '' where id = p_id; update thread_posts set comments_n = (select count(*) from thread_comments where post_id = (select post_id from thread_comments where id = p_id) and not deleted) where id = (select post_id from thread_comments where id = p_id); end if;
  if au <> auth.uid() then perform log_audit('threads.removed', jsonb_build_object('kind', p_kind, 'ref', p_id)); end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_delete(text, uuid) from public, anon;
grant execute on function public.th_delete(text, uuid) to authenticated;

-- Модерация (администрация): очередь, решение, блокировка автора БЕЗ раскрытия личности, раскрытие (по настройке школы)
create or replace function public.th_mod_queue() returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school();
begin
  if not (c->>'ok')::boolean then return c; end if;
  if not is_admin() then return _err('forbidden'); end if;
  return jsonb_build_object('ok', true,
    'rows', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
      select jsonb_build_object('kind', 'p', 'id', p.id, 'post', p.id, 'body', p.body, 'at', p.created_at, 'author', _th_card(p.author_id, p.anon, p.alias, p.official), 'hidden', p.hidden, 'reports', p.reports_n,
        'reasons', (select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (select reason, count(*) n from thread_reports where kind = 'p' and ref_id = p.id group by reason) q)) as x
      from thread_posts p where p.school_id = sc and not p.deleted and (p.hidden or p.reports_n > 0)
      union all
      select jsonb_build_object('kind', 'c', 'id', k.id, 'post', k.post_id, 'body', k.body, 'at', k.created_at, 'author', _th_card(k.author_id, k.anon, k.alias, k.official), 'hidden', k.hidden, 'reports', k.reports_n,
        'reasons', (select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (select reason, count(*) n from thread_reports where kind = 'c' and ref_id = k.id group by reason) q))
      from thread_comments k where k.school_id = sc and not k.deleted and (k.hidden or k.reports_n > 0)) t), '[]'::jsonb),
    'bans', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'until', b.until, 'reason', b.reason, 'at', b.created_at) order by b.created_at desc) from thread_bans b where b.school_id = sc and b.until > now()), '[]'::jsonb));
end $$;
revoke execute on function public.th_mod_queue() from public, anon;
grant execute on function public.th_mod_queue() to authenticated;

create or replace function public.th_mod_decide(p_kind text, p_id uuid, p_action text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school();
begin
  if not (c->>'ok')::boolean then return c; end if;
  if not is_admin() then return _err('forbidden'); end if;
  if p_action not in ('restore','delete') then return _err('action'); end if;
  if p_kind = 'p' then
    if not exists (select 1 from thread_posts where id = p_id and school_id = sc) then return _err('not_found'); end if;
    if p_action = 'restore' then update thread_posts set hidden = false, reports_n = 0 where id = p_id; delete from thread_reports where kind = 'p' and ref_id = p_id;
    else update thread_posts set deleted = true, body = '' where id = p_id; end if;
  elsif p_kind = 'c' then
    if not exists (select 1 from thread_comments where id = p_id and school_id = sc) then return _err('not_found'); end if;
    if p_action = 'restore' then update thread_comments set hidden = false, reports_n = 0 where id = p_id; delete from thread_reports where kind = 'c' and ref_id = p_id;
    else update thread_comments set deleted = true, body = '' where id = p_id; end if;
  else return _err('kind'); end if;
  perform log_audit('threads.' || p_action, jsonb_build_object('kind', p_kind, 'ref', p_id));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_mod_decide(text, uuid, text) from public, anon;
grant execute on function public.th_mod_decide(text, uuid, text) to authenticated;

create or replace function public.th_ban(p_kind text, p_id uuid, p_days int, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); au uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if not is_admin() then return _err('forbidden'); end if;
  if p_days is null or p_days < 1 or p_days > 365 then return _err('days'); end if;
  if p_kind = 'p' then select author_id into au from thread_posts where id = p_id and school_id = sc;
  else select author_id into au from thread_comments where id = p_id and school_id = sc; end if;
  if au is null then return _err('not_found'); end if;
  if exists (select 1 from profiles where id = au and role in ('director','deputy')) then return _err('forbidden'); end if;
  insert into thread_bans (user_id, school_id, until, reason, ref_kind, ref_id, by) values (au, sc, now() + make_interval(days => p_days), left(p_reason, 200), p_kind, p_id, auth.uid());
  perform log_audit('threads.ban', jsonb_build_object('kind', p_kind, 'ref', p_id, 'days', p_days));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_ban(text, uuid, int, text) from public, anon;
grant execute on function public.th_ban(text, uuid, int, text) to authenticated;

create or replace function public.th_unban(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return _err('forbidden'); end if;
  update thread_bans set until = now() where id = p_id and school_id = my_school();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_unban(uuid) from public, anon;
grant execute on function public.th_unban(uuid) to authenticated;

create or replace function public.th_reveal(p_kind text, p_id uuid, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school(); au uuid; rv boolean;
begin
  if not is_director() then return _err('forbidden'); end if;
  select threads_reveal into rv from schools where id = sc;
  if not coalesce(rv, false) then return _err('reveal_off'); end if;
  if coalesce(length(trim(p_reason)), 0) < 15 then return _err('reason_short'); end if;
  if p_kind = 'p' then select author_id into au from thread_posts where id = p_id and school_id = sc;
  else select author_id into au from thread_comments where id = p_id and school_id = sc; end if;
  if au is null then return _err('not_found'); end if;
  perform log_audit('threads.reveal', jsonb_build_object('kind', p_kind, 'ref', p_id, 'reason', left(p_reason, 300), 'student', (select id from students where profile_id = au limit 1)));
  return jsonb_build_object('ok', true, 'name', (select full_name from profiles where id = au),
    'class', (select c.name from students s join classes c on c.id = s.class_id where s.profile_id = au limit 1));
end $$;
revoke execute on function public.th_reveal(text, uuid, text) from public, anon;
grant execute on function public.th_reveal(text, uuid, text) to authenticated;

create or replace function public.th_settings(p_enabled boolean default null, p_reveal boolean default null, p_add text default null, p_del text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := my_school();
begin
  if not is_admin() then return _err('forbidden'); end if;
  if is_director() then
    update schools set threads_enabled = coalesce(p_enabled, threads_enabled), threads_reveal = coalesce(p_reveal, threads_reveal) where id = sc;
    if p_enabled is not null or p_reveal is not null then perform log_audit('threads.settings', jsonb_build_object('enabled', p_enabled, 'reveal', p_reveal)); end if;
  elsif p_enabled is not null or p_reveal is not null then return _err('forbidden'); end if;
  if coalesce(trim(p_add), '') <> '' then
    if length(trim(p_add)) < 3 or length(trim(p_add)) > 40 then return _err('word'); end if;
    insert into thread_blocklist (school_id, word) values (sc, lower(trim(p_add))) on conflict do nothing;
  end if;
  if coalesce(trim(p_del), '') <> '' then delete from thread_blocklist where school_id = sc and lower(word) = lower(trim(p_del)); end if;
  return jsonb_build_object('ok', true, 'enabled', (select threads_enabled from schools where id = sc), 'reveal', (select threads_reveal from schools where id = sc),
    'words', coalesce((select jsonb_agg(word order by word) from thread_blocklist where school_id = sc), '[]'::jsonb),
    'stats', jsonb_build_object('posts_7d', (select count(*) from thread_posts where school_id = sc and created_at > now() - interval '7 days' and not deleted),
      'anon_7d', (select count(*) from thread_posts where school_id = sc and created_at > now() - interval '7 days' and not deleted and anon),
      'profiles', (select count(*) from thread_profiles where school_id = sc),
      'reported', (select count(*) from thread_posts where school_id = sc and not deleted and (hidden or reports_n > 0))));
end $$;
revoke execute on function public.th_settings(boolean, boolean, text, text) from public, anon;
grant execute on function public.th_settings(boolean, boolean, text, text) to authenticated;

-- Хранилище медиа «Үн»: приватный бакет, папка = школа
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('thread-media', 'thread-media', false, 12582912, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
drop policy if exists sabak_thread_read on storage.objects;
drop policy if exists sabak_thread_write on storage.objects;
drop policy if exists sabak_thread_upd on storage.objects;
drop policy if exists sabak_thread_del on storage.objects;
create policy sabak_thread_read on storage.objects for select to authenticated using (
  bucket_id = 'thread-media' and (storage.foldername(name))[1] = public.my_school()::text and public.my_role() in ('student','director','deputy'));
create policy sabak_thread_write on storage.objects for insert to authenticated with check (
  bucket_id = 'thread-media' and (storage.foldername(name))[1] = public.my_school()::text and (storage.foldername(name))[2] in ('p','cover')
  and public.my_role() in ('student','director','deputy') and (storage.foldername(name))[3] like auth.uid()::text || '%');
create policy sabak_thread_upd on storage.objects for update to authenticated using (
  bucket_id = 'thread-media' and (storage.foldername(name))[1] = public.my_school()::text and (storage.foldername(name))[3] like auth.uid()::text || '%');
create policy sabak_thread_del on storage.objects for delete to authenticated using (
  bucket_id = 'thread-media' and (storage.foldername(name))[1] = public.my_school()::text and (storage.foldername(name))[3] like auth.uid()::text || '%');

-- ---------- 5. Ключи школ: сервер помнит ключ до первого использования -------------
alter table public.school_keys add column if not exists key_plain text;
create or replace function public.trg_school_key_used() returns trigger language plpgsql as $$
begin if new.used_at is not null then new.key_plain := null; end if; return new; end $$;
drop trigger if exists school_key_used on public.school_keys;
create trigger school_key_used before update on public.school_keys for each row execute function public.trg_school_key_used();

create or replace function public.create_school_key(p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare k text := 'SABAK-' || public._rand_code(4) || '-' || public._rand_code(4) || '-' || public._rand_code(4);
begin
  insert into public.school_keys (key_hash, note, key_plain) values (encode(sha256(convert_to(k, 'utf8')), 'hex'), p_note, k);
  return k;
end $$;

-- Публичная проверка ключа ДО регистрации: существует ли, свободен ли
create or replace function public.peek_school_key(p_key text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k public.school_keys%rowtype;
begin
  select * into k from public.school_keys where key_hash = encode(sha256(convert_to(upper(trim(coalesce(p_key, ''))), 'utf8')), 'hex');
  if not found then return jsonb_build_object('ok', true, 'state', 'missing'); end if;
  if k.used_at is not null then return jsonb_build_object('ok', true, 'state', 'used'); end if;
  return jsonb_build_object('ok', true, 'state', 'free', 'note', k.note);
end $$;
revoke execute on function public.peek_school_key(text) from public;
grant execute on function public.peek_school_key(text) to anon, authenticated;

create or replace function public.register_director(
  p_key text, p_school_name text, p_city text, p_full_name text, p_birth date, p_gender text, p_phone text, p_lang text, p_extra jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.school_keys%rowtype; sid uuid; scode text;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return public._err('already'); end if;
  if public._too_many() then return public._err('too_many'); end if;
  if coalesce(trim(p_school_name), '') = '' or coalesce(trim(p_full_name), '') = '' then return public._err('fields'); end if;
  select * into k from public.school_keys where key_hash = encode(sha256(convert_to(upper(trim(p_key)), 'utf8')), 'hex') for update;
  if not found then return public._fail('bad_key'); end if;          -- такого ключа нет в базе
  if k.used_at is not null then return public._fail('key_used'); end if;  -- ключ уже сгорел
  loop
    scode := 'SCH-' || public._rand_code(5);
    exit when not exists (select 1 from public.schools where code = scode);
  end loop;
  insert into public.schools (name, city, code) values (trim(p_school_name), nullif(trim(p_city), ''), scode) returning id into sid;
  insert into public.profiles (id, school_id, role, status, full_name, birth_date, gender, phone, lang, extra)
  values (auth.uid(), sid, 'director', 'active', trim(p_full_name), p_birth, p_gender, p_phone, coalesce(p_lang, 'ru'), coalesce(p_extra, '{}'));
  update public.school_keys set used_at = now(), used_by = auth.uid(), school_id = sid where id = k.id;
  perform public.log_audit('school.created', jsonb_build_object('school', sid));
  return jsonb_build_object('ok', true, 'school_id', sid, 'school_code', scode, 'role', 'director');
end $$;
grant execute on function public.register_director(text, text, text, text, date, text, text, text, jsonb) to authenticated;

-- Список ключей для суперадмина: свободные ключи показываются целиком (пока не использованы)
create or replace function public.super_keys() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_super();
  return jsonb_build_object('ok', true, 'keys', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'note', k.note, 'created', k.created_at, 'used', k.used_at,
    'school', (select name from schools where id = k.school_id), 'key', case when k.used_at is null then k.key_plain end) order by k.created_at desc) from school_keys k), '[]'::jsonb));
end $$;
revoke execute on function public.super_keys() from public, anon;
grant execute on function public.super_keys() to authenticated;

-- ============================================================================
-- Готово. Новое: причины оценок, «Алтын», новости, «Үн», проверка ключей.
-- ============================================================================
