\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','dir@x'),('00000000-0000-0000-0000-000000000007','dir2@x'),('00000000-0000-0000-0000-000000000099','super@x'),('00000000-0000-0000-0000-000000000008','dir3@x');
select public.create_school_key('t') as k \gset
select public.create_school_key('t2') as k2 \gset
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select public.register_director(:'k','Школа 12','Бишкек','Директор А',null,'m','+996700111222','ru') ->> 'ok' as d1;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007'); select public.register_director(:'k2','Школа Б','Ош','Директор Б',null,'m','+996700111333','ru') ->> 'ok' as d2;
reset role;
insert into profiles(id,role,status,full_name) values ('00000000-0000-0000-0000-000000000099','superadmin','active','Супер');
insert into classes(school_id,name,grade) select school_id,'9А',9 from profiles where id='00000000-0000-0000-0000-000000000001';
insert into students(id,school_id,class_id,full_name) select '10000000-0000-0000-0000-000000000001', c.school_id, c.id,'Ученик А' from classes c where name='9А';
insert into grades(school_id,student_id,subject_id,value,type,date) select school_id,'10000000-0000-0000-0000-000000000001','math',v,'hw',current_date-i from classes, (values (5,1),(4,2),(5,3)) t(v,i);
\echo ===== 1. не-суперадмин не может
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.super_dashboard();
select public.super_schools();
select public.super_issue_key('x');
select public.super_announce('Тест','Тест');
\echo ===== 2. суперадмин: панель, школы, карточка
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.super_dashboard()->'data'->>'schools' as schools, public.super_dashboard()->'data'->>'students' as students, public.super_dashboard()->'data'->>'grades' as grades, jsonb_array_length(public.super_dashboard()->'data'->'grades_by_day') as days, public.super_dashboard()->'data'->'roles' as roles;
select jsonb_array_length(public.super_schools()->'schools') as n, public.super_schools()->'schools'->0->'director'->>'name' as dir0, public.super_schools()->'schools'->0->'director'->>'email' as mail0;
select (public.super_school((select id from schools where name='Школа 12'))->'school'->'stats'->>'grades') as grades, public.super_school((select id from schools where name='Школа 12'))->'school'->'stats'->>'avg' as avg, jsonb_array_length(public.super_school((select id from schools where name='Школа 12'))->'school'->'staff') as staff, jsonb_array_length(public.super_school((select id from schools where name='Школа 12'))->'school'->'classes') as classes, public.super_school((select id from schools where name='Школа 12'))->'school'->'grade_dist' as dist;
select public.super_school(gen_random_uuid())->>'error' as nf;
\echo ===== 3. приостановка
select public.super_set_school_status((select id from schools where name='Школа 12'),'suspended','Неоплата')->>'ok' as susp;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select count(*) as dir_sees_students_expect_0 from students; select public.my_school_status();
select pg_temp.as_user('00000000-0000-0000-0000-000000000099'); select public.super_set_school_status((select id from schools where name='Школа 12'),'active')->>'ok' as react;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select count(*) as dir_sees_students_expect_1 from students;
\echo ===== 4. рассылка
select pg_temp.as_user('00000000-0000-0000-0000-000000000099'); select public.super_announce('Обновление 0.7','Появился архив')->>'sent' as sent_all; select public.super_announce('Только вам','Привет',(select id from schools where name='Школа Б'))->>'sent' as sent_one;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select title from notifications where kind='platform' order by title;
\echo ===== 5. поддержка
select public.support_open('Не приходит код','Ученик не получает письмо')->>'ok' as open1; select count(*) as tickets_dir1 from support_tickets;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007'); select count(*) as tickets_dir2_expect_0 from support_tickets;
select public.support_reply((select id from support_tickets limit 1),'я чужой') as other_reply;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099'); select count(*) as super_sees from support_tickets;
select public.support_reply((select id from support_tickets limit 1),'Проверьте спам')->>'ok' as reply;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select title from notifications where kind='support'; select status, jsonb_array_length(messages) m from support_tickets;
select public.support_close((select id from support_tickets limit 1));
\echo ===== 6. заявки с сайта (anon)
reset role; set role anon; select public.submit_school_request('Школа В','Нарын','Айбек','0709111222','хотим')->>'ok' as anon_ok; select public.submit_school_request('','','','1')->>'error' as bad;
select count(*) from school_requests;
reset role; set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select count(*) as super_sees_requests from school_requests; select public.super_request_set((select id from school_requests limit 1),'talking','созвонились')->>'ok' as set1;
\echo ===== 7. ключи
select public.super_issue_key('Школа В, Нарын')->>'ok' as issued; select jsonb_array_length(public.super_keys()->'keys') as keys;
\echo ===== 8. поиск и блокировка
select public.super_find_user('директор')->'users'->0->>'name' as found;
select public.super_user_status('00000000-0000-0000-0000-000000000001','blocked')->>'ok' as blocked;
select public.super_user_status('00000000-0000-0000-0000-000000000099','blocked')->>'error' as cant_block_super;
select public.super_user_status('00000000-0000-0000-0000-000000000001','active');
\echo ===== 9. заметки, аудит, система, очистка, архив всех
select public.super_note_add((select id from schools where name='Школа 12'),'Звонить по средам',true)->>'ok' as note;
select jsonb_array_length(public.super_school((select id from schools where name='Школа 12'))->'school'->'notes') as notes;
select jsonb_array_length(public.super_audit()->'rows') > 0 as audit_has, public.super_audit(null,'super.')->'rows'->0->>'action' as last_super_action;
select public.super_system()->>'db_mb' is not null as sys; select public.super_cleanup()->>'ok' as cleanup;
select public.super_archive_all('2025/2026') as arch_all;
select public.super_rename_school((select id from schools where name='Школа 12'),'Школа №12','Бишкек')->>'ok' as renamed;
\echo ===== 10. прямая запись запрещена
insert into school_requests(school_name,phone) values ('x','12345');
update schools set status='active';
