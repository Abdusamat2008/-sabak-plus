-- ============================================================================
-- SABAK+ · схема базы данных v2 (Supabase / PostgreSQL)
-- Как применить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Файл можно запускать повторно (идемпотентен): данные не удаляются.
-- Требование: Authentication → Providers → Email → ВЫКЛЮЧИТЬ «Confirm email».
-- ============================================================================

-- ---------- 0. Таблицы ------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.school_keys (          -- одноразовые «ключи-печати» для основания школы
  id uuid primary key default gen_random_uuid(),
  key_hash text unique not null,                          -- хранится только хэш
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid,
  school_id uuid
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role text not null check (role in ('director','deputy','teacher','parent','student')),
  status text not null default 'active' check (status in ('active','pending','blocked')),
  full_name text not null,
  birth_date date,
  gender text check (gender in ('m','f')),
  phone text,
  lang text not null default 'ru',
  extra jsonb not null default '{}'::jsonb,
  invited_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  grade int,
  lang text default 'ru',
  homeroom_id uuid references public.profiles(id) on delete set null,
  unique (school_id, name)
);

create table if not exists public.subjects (
  id text primary key,
  ru text not null,
  ky text not null
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  birth_date date,
  gender text check (gender in ('m','f')),
  photo_path text,
  photo_meta jsonb,
  photo_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists students_school_class on public.students(school_id, class_id);

create table if not exists public.parent_students (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  relation text,
  primary key (parent_id, student_id)
);

create table if not exists public.teacher_assignments (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (teacher_id, class_id, subject_id)
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  value smallint not null check (value between 2 and 5),
  type text not null check (type in ('hw','act','ind','test','talk','essay')),
  date date not null default current_date,
  by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists grades_student on public.grades(student_id, subject_id, date);
create index if not exists grades_school_date on public.grades(school_id, date);

create table if not exists public.attendance (
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null check (status in ('p','n','l')),
  by uuid references public.profiles(id) on delete set null,
  primary key (student_id, date)
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  title text not null,
  due_date date not null,
  by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.homework_done (
  homework_id uuid not null references public.homework(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (homework_id, student_id)
);

create table if not exists public.anonymous_messages (     -- автор НЕ сохраняется
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  cat text not null,
  text text not null check (char_length(text) between 5 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text unique not null,
  role text not null check (role in ('deputy','teacher','parent','student')),
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  bind_tail text,                                         -- последние цифры телефона приглашённого
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses int not null default 1,
  uses int not null default 0,
  revoked boolean not null default false
);

create table if not exists public.invite_attempts (
  id bigserial primary key,
  user_id uuid,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists invite_attempts_user on public.invite_attempts(user_id, at);

create table if not exists public.audit_log (
  id bigserial primary key,
  school_id uuid,
  actor uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_school on public.audit_log(school_id, at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text,
  read boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists notif_user on public.notifications(to_user, created_at desc);

create table if not exists public.dossiers (
  student_id uuid primary key references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  characteristic text,
  address text,
  pin text,
  health_group text,
  family text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.dossier_docs (
  student_id uuid not null references public.students(id) on delete cascade,
  doc_type text not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'missing' check (status in ('have','missing','na')),
  number text,
  issued date,
  note text,
  file_path text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (student_id, doc_type)
);

create table if not exists public.dossier_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  kind text not null check (kind in ('award','club','move','note')),
  text text not null,
  date date not null default current_date,
  by uuid,
  created_at timestamptz not null default now()
);

insert into public.subjects (id, ru, ky) values
  ('math','Математика','Математика'),('rus','Русский язык','Орус тили'),('kyr','Кыргыз тили','Кыргыз тили'),
  ('hist','История','Тарых'),('eng','Английский','Англис тили'),('phys','Физика','Физика'),
  ('inf','Информатика','Информатика'),('bio','Биология','Биология')
on conflict (id) do nothing;

-- ---------- 1. Вспомогательные функции для RLS (security definer) -----------
create or replace function public.safe_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

create or replace function public.my_school() returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.profiles where id = auth.uid() and status = 'active' $$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active' $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('director','deputy'), false) $$;
create or replace function public.is_director() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'director', false) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('director','deputy','teacher'), false) $$;

create or replace function public.student_class(sid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.students where id = sid $$;
create or replace function public.student_school(sid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.students where id = sid $$;
create or replace function public.is_self_student(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where id = sid and profile_id = auth.uid()) $$;
create or replace function public.is_parent_of(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parent_students where student_id = sid and parent_id = auth.uid()) $$;
create or replace function public.is_homeroom_of(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s join public.classes c on c.id = s.class_id
                 where s.id = sid and c.homeroom_id = auth.uid()) $$;
create or replace function public.is_homeroom_class(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and homeroom_id = auth.uid()) $$;
create or replace function public.teaches_class(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select cid is not null and (
    exists (select 1 from public.teacher_assignments where teacher_id = auth.uid() and class_id = cid)
    or exists (select 1 from public.classes where id = cid and homeroom_id = auth.uid())) $$;
create or replace function public.teaches(sid uuid, subj text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_assignments ta join public.students s on s.class_id = ta.class_id
                 where s.id = sid and ta.teacher_id = auth.uid() and ta.subject_id = subj) $$;

-- Видимость ученика: администрация школы; учитель класса; родитель; сам ученик
create or replace function public.can_see_student(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.student_school(sid) = public.my_school() and (
      public.is_admin() or public.teaches_class(public.student_class(sid))
      or public.is_parent_of(sid) or public.is_self_student(sid)), false) $$;

-- «Дело»: читают администрация, родители, классный руководитель; ученик — НЕТ
-- (сам ученик: is_self_student не входит ни в одну из проверок)
create or replace function public.can_edit_dossier(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.student_school(sid) = public.my_school()
    and (public.is_parent_of(sid) or public.is_homeroom_of(sid)), false) $$;
create or replace function public.can_read_dossier(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.can_edit_dossier(sid)
    or (public.student_school(sid) = public.my_school() and public.is_admin()), false) $$;
-- Фото: сам ученик, родитель, классный руководитель
create or replace function public.can_edit_photo(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.student_school(sid) = public.my_school()
    and (public.is_self_student(sid) or public.is_parent_of(sid) or public.is_homeroom_of(sid)), false) $$;

create or replace function public.log_audit(p_action text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (school_id, actor, action, details)
  values ((select school_id from public.profiles where id = auth.uid()), auth.uid(), p_action, p_details) $$;

-- ---------- 2. Включаем RLS ---------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_keys enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.parent_students enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.grades enable row level security;
alter table public.attendance enable row level security;
alter table public.homework enable row level security;
alter table public.homework_done enable row level security;
alter table public.anonymous_messages enable row level security;
alter table public.invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_docs enable row level security;
alter table public.dossier_records enable row level security;

-- Права на уровне таблиц: сначала всё закрываем, потом открываем нужное.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.schools, public.subjects, public.classes, public.students, public.parent_students,
                public.teacher_assignments, public.grades, public.attendance, public.homework, public.homework_done,
                public.invites, public.audit_log, public.notifications, public.dossiers, public.dossier_docs,
                public.dossier_records, public.profiles to authenticated;
grant select, insert, update on public.anonymous_messages to authenticated;
grant update (full_name, phone, lang, extra, birth_date, gender) on public.profiles to authenticated;
grant insert, update, delete on public.classes, public.teacher_assignments to authenticated;
grant insert on public.students to authenticated;
grant insert, update, delete on public.grades to authenticated;
grant insert, update, delete on public.attendance to authenticated;
grant insert, update, delete on public.homework to authenticated;
grant insert, delete on public.homework_done to authenticated;
grant update (revoked) on public.invites to authenticated;
grant update (read) on public.notifications to authenticated;
grant insert, update on public.dossiers, public.dossier_docs to authenticated;
grant insert, update, delete on public.dossier_records to authenticated;
grant select on public.subjects to anon;

-- ---------- 3. Политики (RLS) ---------------------------------------------------
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy subjects_read on public.subjects for select to anon, authenticated using (true);

create policy schools_read on public.schools for select to authenticated using (id = public.my_school());

create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or (school_id = public.my_school() and (public.is_admin() or role in ('director','deputy','teacher'))));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy classes_read on public.classes for select to authenticated using (school_id = public.my_school());
create policy classes_write on public.classes for insert to authenticated with check (school_id = public.my_school() and public.is_admin());
create policy classes_upd on public.classes for update to authenticated
  using (school_id = public.my_school() and public.is_admin()) with check (school_id = public.my_school() and public.is_admin());
create policy classes_del on public.classes for delete to authenticated using (school_id = public.my_school() and public.is_director());

create policy ta_read on public.teacher_assignments for select to authenticated
  using (school_id = public.my_school() and (public.is_admin() or teacher_id = auth.uid()));
create policy ta_write on public.teacher_assignments for insert to authenticated with check (school_id = public.my_school() and public.is_admin());
create policy ta_del on public.teacher_assignments for delete to authenticated using (school_id = public.my_school() and public.is_admin());

create policy students_read on public.students for select to authenticated using (public.can_see_student(id));
create policy students_add on public.students for insert to authenticated with check (
  school_id = public.my_school()
  and (public.is_admin() or (class_id is not null and public.is_homeroom_class(class_id))));

create policy ps_read on public.parent_students for select to authenticated using (
  parent_id = auth.uid() or (school_id = public.my_school() and (public.is_admin() or public.is_homeroom_of(student_id))));

create policy grades_read on public.grades for select to authenticated using (
  school_id = public.my_school() and public.can_see_student(student_id));
create policy grades_add on public.grades for insert to authenticated with check (
  school_id = public.my_school() and by = auth.uid() and public.teaches(student_id, subject_id));
create policy grades_upd on public.grades for update to authenticated
  using (by = auth.uid()) with check (by = auth.uid() and public.teaches(student_id, subject_id));
create policy grades_del on public.grades for delete to authenticated using (by = auth.uid() and school_id = public.my_school());

create policy att_read on public.attendance for select to authenticated using (
  school_id = public.my_school() and public.can_see_student(student_id));
create policy att_add on public.attendance for insert to authenticated with check (
  school_id = public.my_school() and by = auth.uid() and public.teaches_class(public.student_class(student_id)));
create policy att_upd on public.attendance for update to authenticated
  using (school_id = public.my_school() and public.teaches_class(public.student_class(student_id)))
  with check (school_id = public.my_school() and by = auth.uid() and public.teaches_class(public.student_class(student_id)));
create policy att_del on public.attendance for delete to authenticated
  using (school_id = public.my_school() and public.teaches_class(public.student_class(student_id)));

create policy hw_read on public.homework for select to authenticated using (
  school_id = public.my_school() and (public.is_admin() or public.teaches_class(class_id)
    or exists (select 1 from public.students s where s.class_id = homework.class_id and public.can_see_student(s.id))));
create policy hw_add on public.homework for insert to authenticated with check (
  school_id = public.my_school() and by = auth.uid() and public.teaches_class(class_id));
create policy hw_upd on public.homework for update to authenticated using (by = auth.uid()) with check (by = auth.uid());
create policy hw_del on public.homework for delete to authenticated using (by = auth.uid());

create policy hwd_read on public.homework_done for select to authenticated using (
  school_id = public.my_school() and public.can_see_student(student_id));
create policy hwd_add on public.homework_done for insert to authenticated with check (
  school_id = public.my_school() and (public.is_self_student(student_id) or public.is_parent_of(student_id)));
create policy hwd_del on public.homework_done for delete to authenticated using (
  school_id = public.my_school() and (public.is_self_student(student_id) or public.is_parent_of(student_id)));

-- Анонимная почта: писать может любой активный участник школы; автор не записывается; читает только администрация
create policy am_add on public.anonymous_messages for insert to authenticated with check (school_id = public.my_school());
create policy am_read on public.anonymous_messages for select to authenticated using (school_id = public.my_school() and public.is_admin());
create policy am_upd on public.anonymous_messages for update to authenticated
  using (school_id = public.my_school() and public.is_admin()) with check (school_id = public.my_school() and public.is_admin());

create policy inv_read on public.invites for select to authenticated using (
  school_id = public.my_school() and (public.is_admin() or created_by = auth.uid()));
create policy inv_revoke on public.invites for update to authenticated
  using (school_id = public.my_school() and (public.is_admin() or created_by = auth.uid()))
  with check (school_id = public.my_school());

create policy audit_read on public.audit_log for select to authenticated using (school_id = public.my_school() and public.is_admin());

create policy notif_read on public.notifications for select to authenticated using (to_user = auth.uid());
create policy notif_upd on public.notifications for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());

create policy dos_read on public.dossiers for select to authenticated using (public.can_read_dossier(student_id));
create policy dos_add on public.dossiers for insert to authenticated with check (school_id = public.my_school() and public.can_edit_dossier(student_id));
create policy dos_upd on public.dossiers for update to authenticated
  using (public.can_edit_dossier(student_id)) with check (school_id = public.my_school() and public.can_edit_dossier(student_id));

create policy dd_read on public.dossier_docs for select to authenticated using (public.can_read_dossier(student_id));
create policy dd_add on public.dossier_docs for insert to authenticated with check (school_id = public.my_school() and public.can_edit_dossier(student_id));
create policy dd_upd on public.dossier_docs for update to authenticated
  using (public.can_edit_dossier(student_id)) with check (school_id = public.my_school() and public.can_edit_dossier(student_id));

create policy dr_read on public.dossier_records for select to authenticated using (public.can_read_dossier(student_id));
create policy dr_add on public.dossier_records for insert to authenticated with check (school_id = public.my_school() and public.can_edit_dossier(student_id));
create policy dr_upd on public.dossier_records for update to authenticated
  using (public.can_edit_dossier(student_id)) with check (public.can_edit_dossier(student_id));
create policy dr_del on public.dossier_records for delete to authenticated using (public.can_edit_dossier(student_id));
-- school_keys, invite_attempts: политик нет → недоступны через API вообще (только через функции).

-- Аудит изменений «дела»
create or replace function public.trg_dossier_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (school_id, actor, action, details)
  values (new.school_id, auth.uid(), tg_table_name || ':' || lower(tg_op), jsonb_build_object('student', new.student_id));
  return new;
end $$;
drop trigger if exists dossiers_audit on public.dossiers;
create trigger dossiers_audit after insert or update on public.dossiers for each row execute function public.trg_dossier_audit();
drop trigger if exists dossier_docs_audit on public.dossier_docs;
create trigger dossier_docs_audit after insert or update on public.dossier_docs for each row execute function public.trg_dossier_audit();

-- ---------- 4. Цепочка доверия: ключи, регистрация, приглашения ---------------
create or replace function public._err(code text) returns jsonb language sql immutable as $$
  select jsonb_build_object('ok', false, 'error', code) $$;

create or replace function public._rand_code(n int) returns text language plpgsql volatile as $$
declare alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; out text := ''; i int;
begin
  for i in 1..n loop out := out || substr(alpha, 1 + floor(random() * length(alpha))::int, 1); end loop;
  return out;
end $$;

-- 4.1 Оператор SABAK+ (владелец проекта) создаёт одноразовый ключ для школы.
--     Запускать ТОЛЬКО в SQL Editor:  select public.create_school_key('Школа №12, Бишкек');
create or replace function public.create_school_key(p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare k text := 'SABAK-' || public._rand_code(4) || '-' || public._rand_code(4) || '-' || public._rand_code(4);
begin
  insert into public.school_keys (key_hash, note) values (encode(sha256(convert_to(k, 'utf8')), 'hex'), p_note);
  return k;
end $$;

-- анти-перебор: ≥5 неудач за 15 минут → пауза
create or replace function public._too_many() returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.invite_attempts where user_id = auth.uid() and ok = false and at > now() - interval '15 minutes') >= 5 $$;
create or replace function public._fail(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
begin insert into public.invite_attempts (user_id, ok) values (auth.uid(), false); return public._err(p_code); end $$;

-- 4.2 Директор основывает школу по ключу
create or replace function public.register_director(
  p_key text, p_school_name text, p_city text, p_full_name text, p_birth date, p_gender text, p_phone text, p_lang text, p_extra jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare kid uuid; sid uuid; scode text;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return public._err('already'); end if;
  if public._too_many() then return public._err('too_many'); end if;
  if coalesce(trim(p_school_name), '') = '' or coalesce(trim(p_full_name), '') = '' then return public._err('fields'); end if;
  select id into kid from public.school_keys
   where key_hash = encode(sha256(convert_to(upper(trim(p_key)), 'utf8')), 'hex') and used_at is null;
  if kid is null then return public._fail('bad_key'); end if;
  loop
    scode := 'SCH-' || public._rand_code(5);
    exit when not exists (select 1 from public.schools where code = scode);
  end loop;
  insert into public.schools (name, city, code) values (trim(p_school_name), nullif(trim(p_city), ''), scode) returning id into sid;
  insert into public.profiles (id, school_id, role, status, full_name, birth_date, gender, phone, lang, extra)
  values (auth.uid(), sid, 'director', 'active', trim(p_full_name), p_birth, p_gender, p_phone, coalesce(p_lang, 'ru'), coalesce(p_extra, '{}'));
  update public.school_keys set used_at = now(), used_by = auth.uid(), school_id = sid where id = kid;
  perform public.log_audit('school.created', jsonb_build_object('school', sid));
  return jsonb_build_object('ok', true, 'school_id', sid, 'school_code', scode, 'role', 'director');
end $$;

-- 4.3 Публичная проверка кода (до регистрации): только роль, школа, класс — без данных людей
create or replace function public.peek_invite(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.invites%rowtype; sn text; cn text;
begin
  select * into i from public.invites where code = upper(trim(p_code));
  if not found or i.revoked or i.expires_at < now() or i.uses >= i.max_uses then return jsonb_build_object('ok', false); end if;
  select name into sn from public.schools where id = i.school_id;
  select name into cn from public.classes where id = i.class_id;
  return jsonb_build_object('ok', true, 'role', i.role, 'school', sn, 'class', cn, 'need_phone', i.bind_tail is not null);
end $$;

-- 4.4 Регистрация по приглашению
create or replace function public.redeem_invite(
  p_code text, p_full_name text, p_birth date, p_gender text, p_phone text, p_lang text, p_extra jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.invites%rowtype; st text; digits text; stu public.students%rowtype;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return public._err('already'); end if;
  if public._too_many() then return public._err('too_many'); end if;
  if coalesce(trim(p_full_name), '') = '' then return public._err('fields'); end if;
  select * into i from public.invites where code = upper(trim(p_code)) for update;
  if not found or i.revoked then return public._fail('bad_code'); end if;
  if i.expires_at < now() then return public._fail('expired'); end if;
  if i.uses >= i.max_uses then return public._fail('used'); end if;
  if i.bind_tail is not null then
    digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    if right(digits, length(i.bind_tail)) <> i.bind_tail then return public._fail('phone_mismatch'); end if;
  end if;
  if i.role in ('student','parent') then
    select * into stu from public.students where id = i.student_id;
    if not found then return public._fail('bad_code'); end if;
    if i.role = 'student' and stu.profile_id is not null then return public._fail('used'); end if;
  end if;
  -- сотрудники попадают в статус «ожидает подтверждения»: директор/завуч подтверждает вручную
  st := case when i.role in ('deputy','teacher') then 'pending' else 'active' end;
  insert into public.profiles (id, school_id, role, status, full_name, birth_date, gender, phone, lang, extra, invited_by)
  values (auth.uid(), i.school_id, i.role, st, trim(p_full_name), p_birth, p_gender, p_phone, coalesce(p_lang, 'ru'), coalesce(p_extra, '{}'), i.created_by);
  if i.role = 'student' then
    update public.students set profile_id = auth.uid() where id = i.student_id;
  elsif i.role = 'parent' then
    insert into public.parent_students (parent_id, student_id, school_id, relation)
    values (auth.uid(), i.student_id, i.school_id, coalesce(p_extra ->> 'relation', 'parent'));
  end if;
  update public.invites set uses = uses + 1 where id = i.id;
  insert into public.invite_attempts (user_id, ok) values (auth.uid(), true);
  insert into public.audit_log (school_id, actor, action, details)
  values (i.school_id, auth.uid(), 'invite.redeemed', jsonb_build_object('role', i.role, 'by_invite', i.id, 'invited_by', i.created_by));
  return jsonb_build_object('ok', true, 'role', i.role, 'status', st, 'school_id', i.school_id);
end $$;

-- 4.5 Выдача приглашений (матрица прав)
--   директор → завуч, учитель, родитель, ученик; завуч → учитель, родитель, ученик;
--   классный руководитель → ТОЛЬКО ученик/родитель СВОЕГО класса.
create or replace function public.create_invite(
  p_role text, p_class uuid default null, p_student uuid default null, p_bind_tail text default null,
  p_days int default null, p_max int default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := public.my_role(); sc uuid := public.my_school(); ok boolean := false; v_code text; d int; m int; cid uuid := p_class;
begin
  if sc is null then return public._err('forbidden'); end if;
  if p_role not in ('deputy','teacher','parent','student') then return public._err('bad_role'); end if;
  if p_bind_tail is not null and p_bind_tail !~ '^[0-9]{3,6}$' then return public._err('bad_tail'); end if;
  if p_role = 'deputy' then ok := (me = 'director');
  elsif p_role = 'teacher' then ok := (me in ('director','deputy'));
  else
    if p_student is null or public.student_school(p_student) <> sc then return public._err('bad_student'); end if;
    cid := public.student_class(p_student);
    ok := (me in ('director','deputy')) or (me = 'teacher' and public.is_homeroom_of(p_student));
  end if;
  if not ok then return public._err('forbidden'); end if;
  d := coalesce(p_days, case when p_role in ('deputy','teacher') then 3 else 14 end);
  m := coalesce(p_max,  case when p_role = 'parent' then 2 else 1 end);
  loop
    v_code := public._rand_code(4) || '-' || public._rand_code(4) || '-' || public._rand_code(4);
    exit when not exists (select 1 from public.invites i2 where i2.code = v_code);
  end loop;
  insert into public.invites (school_id, code, role, class_id, student_id, bind_tail, note, created_by, expires_at, max_uses)
  values (sc, v_code, p_role, cid, p_student, p_bind_tail, p_note, auth.uid(), now() + make_interval(days => d), m);
  perform public.log_audit('invite.created', jsonb_build_object('role', p_role, 'student', p_student, 'class', cid));
  return jsonb_build_object('ok', true, 'code', v_code, 'expires_in_days', d);
end $$;

-- 4.6 Подтверждение/блокировка сотрудников
create or replace function public.set_profile_status(p_user uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := public.my_role(); t public.profiles%rowtype;
begin
  if p_status not in ('active','blocked') then return public._err('bad_status'); end if;
  select * into t from public.profiles where id = p_user and school_id = public.my_school();
  if not found then return public._err('not_found'); end if;
  if t.role = 'director' or t.id = auth.uid() then return public._err('forbidden'); end if;
  if not ((me = 'director' and t.role in ('deputy','teacher'))
       or (me = 'deputy' and t.role = 'teacher')) then return public._err('forbidden'); end if;
  update public.profiles set status = p_status where id = p_user;
  perform public.log_audit('profile.' || p_status, jsonb_build_object('user', p_user, 'role', t.role));
  return jsonb_build_object('ok', true);
end $$;

-- 4.7 Уведомления о фото (администрация и классный руководитель)
create or replace function public._criteria_text() returns text language sql immutable as $$
  select 'Требования к фото: официальное фото (как на документы), на светлом однотонном фоне, одно лицо анфас, лицо хорошо освещено и в фокусе, без головных уборов и тёмных очков, не групповое и не селфи с фильтрами.' $$;

create or replace function public.send_photo_warning(p_student uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); stu public.students%rowtype; n int := 0; rcpt uuid; ttl text;
begin
  if sc is null then return public._err('forbidden'); end if;
  select * into stu from public.students where id = p_student and school_id = sc;
  if not found then return public._err('not_found'); end if;
  if not (public.is_admin() or public.is_homeroom_of(p_student)) then return public._err('forbidden'); end if;
  ttl := 'Фото профиля: ' || stu.full_name;
  for rcpt in
    select profile_id from public.students where id = p_student and profile_id is not null
    union select parent_id from public.parent_students where student_id = p_student
  loop
    insert into public.notifications (school_id, to_user, student_id, kind, title, body, created_by)
    values (sc, rcpt, p_student, 'photo_warning', ttl,
            coalesce(nullif(trim(p_reason), ''), case when stu.photo_path is null then 'Фото профиля не загружено.' else 'Текущее фото не соответствует требованиям.' end)
            || ' ' || public._criteria_text(), auth.uid());
    n := n + 1;
  end loop;
  perform public.log_audit('photo.warning', jsonb_build_object('student', p_student, 'sent', n));
  return jsonb_build_object('ok', true, 'sent', n);
end $$;

create or replace function public.send_photo_warnings_class(p_class uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid; r jsonb; total int := 0; kids int := 0;
begin
  if not (public.is_admin() or public.is_homeroom_class(p_class)) then return public._err('forbidden'); end if;
  for sid in select id from public.students where class_id = p_class and school_id = public.my_school()
                and (photo_path is null or coalesce((photo_meta ->> 'verified')::boolean, false) = false) loop
    r := public.send_photo_warning(sid, null); kids := kids + 1; total := total + coalesce((r ->> 'sent')::int, 0);
  end loop;
  return jsonb_build_object('ok', true, 'students', kids, 'sent', total);
end $$;

-- 4.8 Фото: сервер требует отметку «проверено» (проверка лица выполняется в браузере — см. README)
create or replace function public.set_student_photo(p_student uuid, p_path text, p_meta jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_photo(p_student) then return public._err('forbidden'); end if;
  if (select photo_strict from public.schools where id = public.my_school()) then return public._err('server_required'); end if;
  if coalesce(p_meta ->> 'verified', 'false') <> 'true' or coalesce((p_meta ->> 'faces')::int, 0) <> 1 then
    return public._err('not_verified');
  end if;
  if split_part(p_path, '/', 2) <> p_student::text or split_part(p_path, '/', 1) <> public.my_school()::text then
    return public._err('bad_path');
  end if;
  update public.students set photo_path = p_path, photo_meta = p_meta, photo_at = now() where id = p_student;
  update public.notifications set read = true where student_id = p_student and kind = 'photo_warning';
  perform public.log_audit('photo.set', jsonb_build_object('student', p_student));
  return jsonb_build_object('ok', true);
end $$;

-- 4.9 Строгий режим фото: фото принимает только Edge Function verify-photo (service_role), а не любой клиент
alter table public.schools add column if not exists photo_strict boolean not null default false;

create or replace function public.can_edit_photo_check(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.can_edit_photo(p_student) $$;

create or replace function public.set_photo_strict(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_director() then return public._err('forbidden'); end if;
  update public.schools set photo_strict = p_on where id = public.my_school();
  perform public.log_audit('photo.strict', jsonb_build_object('on', p_on));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_student_photo_server(p_student uuid, p_path text, p_meta jsonb, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid;
begin
  select school_id into sc from public.students where id = p_student;
  if sc is null then return public._err('not_found'); end if;
  if split_part(p_path, '/', 1) <> sc::text or split_part(p_path, '/', 2) <> p_student::text then return public._err('bad_path'); end if;
  update public.students set photo_path = p_path, photo_meta = p_meta, photo_at = now() where id = p_student;
  update public.notifications set read = true where student_id = p_student and kind = 'photo_warning';
  insert into public.audit_log (school_id, actor, action, details) values (sc, p_actor, 'photo.set', jsonb_build_object('student', p_student, 'server', true));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_student_photo_server(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_student_photo_server(uuid, text, jsonb, uuid) to service_role;

-- ---------- 5. Демо-данные для жюри (только директор, только в пустой школе) -----
create or replace function public.seed_demo_school() returns jsonb
language plpgsql security definer set search_path = public as $$
declare sc uuid := public.my_school(); c9a uuid; c9b uuid; names text[] := array[
  'Айдана Төлөбаева','Бекзат Керимов','Эмир Сыдыков','Нурзат Асанова','Данияр Жумабеков','Мээрим Осмонова','Адиль Рысбеков','Салтанат Бакирова',
  'Тилек Мамытов','Алина Эркинова','Урмат Исаков','Жылдыз Абдыева','Темирлан Кадыров','Ару Нурматова','Касым Токтогулов','Элина Садыкова'];
  subs text[] := array['math','rus','kyr','hist','eng','phys','inf','bio']; types text[] := array['hw','act','ind','test','hw','talk','ind','test','act','hw'];
  i int; k int; j int; sid uuid; cid uuid; base numeric; tr numeric; v int; abs_p numeric; dt date; stt text;
begin
  if not public.is_director() then return public._err('forbidden'); end if;
  if exists (select 1 from public.students where school_id = sc) then return public._err('not_empty'); end if;
  perform setseed(0.37);
  insert into public.classes (school_id, name, grade, lang) values (sc, '9А', 9, 'ru') on conflict (school_id, name) do nothing;
  insert into public.classes (school_id, name, grade, lang) values (sc, '9Б', 9, 'ru') on conflict (school_id, name) do nothing;
  select id into c9a from public.classes where school_id = sc and name = '9А';
  select id into c9b from public.classes where school_id = sc and name = '9Б';
  for i in 1..array_length(names, 1) loop
    cid := case when i <= 10 then c9a else c9b end;
    insert into public.students (school_id, class_id, full_name, gender, birth_date, is_demo, created_by)
    values (sc, cid, names[i], case when i % 2 = 0 then 'm' else 'f' end, date '2010-09-01' + ((i * 17) % 300), true, auth.uid()) returning id into sid;
    base := 2.7 + ((i * 37) % 23) / 10.0;                 -- 2.7 … 4.9
    tr := (((i * 13) % 9) - 4) / 4.0 * 0.6;               -- динамика
    for j in 1..array_length(subs, 1) loop
      for k in 1..7 loop
        v := greatest(2, least(5, round(base + tr * ((k - 4) / 3.0) + (random() - 0.5) * 1.6)::int));
        insert into public.grades (school_id, student_id, subject_id, value, type, date)
        values (sc, sid, subs[j], v, types[1 + (k + j) % 10], current_date - ((8 - k) * 4 + (random() * 3)::int));
      end loop;
    end loop;
    abs_p := greatest(0.02, (4.9 - base) * 0.09);         -- слабее оценки → больше пропусков (для анализа корреляции)
    for k in 0..13 loop
      dt := current_date - k;
      continue when extract(isodow from dt) > 5;
      stt := case when random() < abs_p then 'n' when random() < 0.05 then 'l' else 'p' end;
      insert into public.attendance (student_id, date, school_id, status) values (sid, dt, sc, stt) on conflict do nothing;
    end loop;
    insert into public.dossier_docs (student_id, doc_type, school_id, status)
      select sid, d, sc, case when random() < 0.7 then 'have' else 'missing' end
      from unnest(array['application','birth_cert','parent_id','reg_cert','med_026','med_063','photo_3x4','consent_pd','contract']) d;
  end loop;
  perform public.log_audit('demo.seeded', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'students', array_length(names, 1));
end $$;

create or replace function public.clear_demo_school() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_director() then return public._err('forbidden'); end if;
  delete from public.students where school_id = public.my_school() and is_demo;
  get diagnostics n = row_count;
  perform public.log_audit('demo.cleared', jsonb_build_object('students', n));
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

-- ---------- 6. Права на функции ---------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.safe_uuid(text), public.my_school(), public.my_role(), public.is_admin(), public.is_director(), public.is_staff(),
  public.student_class(uuid), public.student_school(uuid), public.is_self_student(uuid), public.is_parent_of(uuid), public.is_homeroom_of(uuid),
  public.is_homeroom_class(uuid), public.teaches_class(uuid), public.teaches(uuid, text), public.can_see_student(uuid),
  public.can_edit_dossier(uuid), public.can_read_dossier(uuid), public.can_edit_photo(uuid) to authenticated;
grant execute on function public.peek_invite(text) to anon, authenticated;
grant execute on function public.register_director(text, text, text, text, date, text, text, text, jsonb) to authenticated;
grant execute on function public.redeem_invite(text, text, date, text, text, text, jsonb) to authenticated;
grant execute on function public.create_invite(text, uuid, uuid, text, int, int, text) to authenticated;
grant execute on function public.set_profile_status(uuid, text) to authenticated;
grant execute on function public.send_photo_warning(uuid, text) to authenticated;
grant execute on function public.send_photo_warnings_class(uuid) to authenticated;
grant execute on function public.set_student_photo(uuid, text, jsonb) to authenticated;
grant execute on function public.can_edit_photo_check(uuid) to authenticated;
grant execute on function public.set_photo_strict(boolean) to authenticated;
grant execute on function public.seed_demo_school() to authenticated;
grant execute on function public.clear_demo_school() to authenticated;
-- create_school_key — НЕ выдаётся никому: её запускает только владелец проекта в SQL Editor.

-- ---------- 7. Хранилище файлов (приватные бакеты) --------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',  'avatars',  false, 1048576, array['image/jpeg','image/png','image/webp']),
  ('dossiers', 'dossiers', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

drop policy if exists sabak_avatars_read on storage.objects;
drop policy if exists sabak_avatars_write on storage.objects;
drop policy if exists sabak_avatars_upd on storage.objects;
drop policy if exists sabak_dossiers_read on storage.objects;
drop policy if exists sabak_dossiers_write on storage.objects;
drop policy if exists sabak_dossiers_upd on storage.objects;
drop policy if exists sabak_dossiers_del on storage.objects;

-- путь файла: <school_id>/<student_id>/<имя>
create policy sabak_avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_see_student(public.safe_uuid((storage.foldername(name))[2])));
create policy sabak_avatars_write on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_edit_photo(public.safe_uuid((storage.foldername(name))[2])));
create policy sabak_avatars_upd on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_edit_photo(public.safe_uuid((storage.foldername(name))[2])));

create policy sabak_dossiers_read on storage.objects for select to authenticated using (
  bucket_id = 'dossiers' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_read_dossier(public.safe_uuid((storage.foldername(name))[2])));
create policy sabak_dossiers_write on storage.objects for insert to authenticated with check (
  bucket_id = 'dossiers' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_edit_dossier(public.safe_uuid((storage.foldername(name))[2])));
create policy sabak_dossiers_upd on storage.objects for update to authenticated using (
  bucket_id = 'dossiers' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_edit_dossier(public.safe_uuid((storage.foldername(name))[2])));
create policy sabak_dossiers_del on storage.objects for delete to authenticated using (
  bucket_id = 'dossiers' and (storage.foldername(name))[1] = public.my_school()::text
  and public.can_edit_dossier(public.safe_uuid((storage.foldername(name))[2])));

notify pgrst, 'reload schema';
-- Готово. Дальше: select public.create_school_key('Название школы');  → скопируйте выданный ключ SABAK-XXXX-XXXX-XXXX
