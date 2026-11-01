\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','dir@x'),('00000000-0000-0000-0000-000000000002','t1@x'),('00000000-0000-0000-0000-000000000007','dir2@x'),('00000000-0000-0000-0000-000000000099','super@x');
select public.create_school_key('t') as k \gset
select public.create_school_key('t2') as k2 \gset
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.register_director(:'k','Школа 12','Бишкек','Директор',null,'m','+996700111222','ru') ->> 'ok' as dir_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.register_director(:'k2','Школа Б','Ош','Директор Б',null,'m','+996700111333','ru') ->> 'ok' as dir2_ok;
reset role;
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000002', school_id,'teacher','active','Учитель' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,role,status,full_name) values ('00000000-0000-0000-0000-000000000099','superadmin','active','Супер');
insert into classes(school_id,name,grade,homeroom_id) select school_id,'9А',9,'00000000-0000-0000-0000-000000000002' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into classes(school_id,name,grade) select school_id,'5Б',5 from profiles where id='00000000-0000-0000-0000-000000000007';
insert into students(id,school_id,class_id,full_name) select '10000000-0000-0000-0000-000000000001', c.school_id, c.id,'Ученик А' from classes c where name='9А';
insert into students(id,school_id,class_id,full_name) select '10000000-0000-0000-0000-000000000002', c.school_id, c.id,'Ученик Б' from classes c where name='5Б';
insert into grades(school_id,student_id,subject_id,value,type,date) select school_id,'10000000-0000-0000-0000-000000000001','math',5,'test','2025-10-10' from classes where name='9А';
insert into grades(school_id,student_id,subject_id,value,type,date) select school_id,'10000000-0000-0000-0000-000000000001','math',4,'hw','2026-02-02' from classes where name='9А';
insert into grades(school_id,student_id,subject_id,value,type,date) select school_id,'10000000-0000-0000-0000-000000000001','math',3,'hw','2024-12-02' from classes where name='9А';
insert into attendance(student_id,date,school_id,status) select '10000000-0000-0000-0000-000000000001','2025-11-03',school_id,'n' from classes where name='9А';
insert into dossier_records(student_id,school_id,kind,text) select '10000000-0000-0000-0000-000000000001',school_id,'award','Олимпиада' from classes where name='9А';
\echo ===== teacher cannot close
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.archive_close_year('2025/2026') as teacher_close_expect_forbidden;
\echo ===== bad label
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.archive_close_year('2025-2026')->>'error' as bad_label;
\echo ===== director closes (clear)
select public.archive_close_year('2025/2026', true) as close1;
select public.archive_close_year('2025/2026')->>'error' as dup_expect_exists;
select label, stats, cleared from archive_years;
select class_name, jsonb_array_length(students) n, students->0->'g' as grades, students->0->'a' as att, students->0->'rec' as rec from archive_classes;
\echo ===== grades in range cleared, outside range kept
reset role; select count(*) as grades_left_expect_1_(2024) from grades;
\echo ===== director2 sees only own school (expect 0 rows from school 1)
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select count(*) as dir2_sees_expect_0 from archive_years; select count(*) from archive_classes;
select public.archive_close_year('2025/2026', false) ->> 'ok' as dir2_close;
select count(*) as dir2_sees_expect_1 from archive_years;
\echo ===== superadmin sees all
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select count(*) as super_sees_expect_2 from archive_years;
select jsonb_array_length(public.super_overview()->'schools') as schools_expect_2;
select public.super_overview()->'schools'->0->'years' is not null as has_years;
\echo ===== not-super cannot overview
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.super_overview()->>'error' as expect_forbidden;
\echo ===== direct write blocked
insert into archive_years(school_id,label) select school_id,'2030/2031' from profiles limit 1;
update archive_classes set class_name='x';
