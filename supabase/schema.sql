-- SABAK+ · этап 2: схема для Supabase (Postgres). В MVP НЕ подключена — приложение пока хранит демо-данные в браузере.
-- Как использовать: Supabase → SQL Editor → вставить этот файл → Run. Затем заменить js/store.js вызовами supabase-js.

create table schools   (id uuid primary key default gen_random_uuid(), name text not null);
create table classes   (id uuid primary key default gen_random_uuid(), school_id uuid references schools on delete cascade, title text not null);          -- '9А'
create table subjects  (id text primary key, name_ru text not null, name_ky text not null);
create table profiles  (id uuid primary key references auth.users on delete cascade, school_id uuid references schools, full_name text not null,
                        role text not null check (role in ('student','parent','teacher','admin')), class_id uuid references classes, lang text default 'ru');
create table parent_child (parent_id uuid references profiles, child_id uuid references profiles, primary key (parent_id, child_id));
create table teacher_assignments (teacher_id uuid references profiles, class_id uuid references classes, subject_id text references subjects, primary key (teacher_id, class_id, subject_id));

create table grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles, subject_id text not null references subjects,
  value smallint not null check (value between 2 and 5),
  kind text not null check (kind in ('hw','act','ind','test','talk','essay')),   -- за что оценка
  given_on date not null default current_date, given_by uuid references profiles,
  created_at timestamptz default now()
);
create table attendance (student_id uuid references profiles, day date, status text check (status in ('p','n','l')), marked_by uuid references profiles, primary key (student_id, day));
create table homework   (id uuid primary key default gen_random_uuid(), class_id uuid references classes, subject_id text references subjects, title text not null, due_on date not null);
create table homework_done (homework_id uuid references homework on delete cascade, student_id uuid references profiles, primary key (homework_id, student_id));
create table anonymous_messages (id uuid primary key default gen_random_uuid(), school_id uuid references schools, category text, body text not null check (char_length(body) between 5 and 2000), is_read boolean default false, created_at timestamptz default now()); -- автор НЕ хранится
create table audit_log (id bigint generated always as identity primary key, actor uuid references profiles, action text, details text, created_at timestamptz default now());   -- «кто и когда изменил»

-- Права доступа по строкам (Row Level Security): ученик видит только своё, родитель — своих детей, учитель — свои классы.
alter table grades enable row level security;
create policy "student reads own"  on grades for select using (student_id = auth.uid());
create policy "parent reads child" on grades for select using (exists (select 1 from parent_child pc where pc.parent_id = auth.uid() and pc.child_id = grades.student_id));
create policy "teacher reads/writes assigned" on grades for all using (
  exists (select 1 from profiles s join teacher_assignments ta on ta.class_id = s.class_id and ta.subject_id = grades.subject_id
          where s.id = grades.student_id and ta.teacher_id = auth.uid()));
alter table anonymous_messages enable row level security;
create policy "anyone inserts" on anonymous_messages for insert with check (true);
create policy "admin reads"   on anonymous_messages for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- Остальные таблицы защищаются аналогично.
