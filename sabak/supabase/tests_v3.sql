\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','dir@x'),('00000000-0000-0000-0000-000000000002','t1@x'),('00000000-0000-0000-0000-000000000003','par@x'),
 ('00000000-0000-0000-0000-000000000004','stu@x'),('00000000-0000-0000-0000-000000000005','dep@x'),('00000000-0000-0000-0000-000000000006','t2@x'),
 ('00000000-0000-0000-0000-000000000007','dir2@x');
select public.create_school_key('t') as k \gset
select public.create_school_key('t2') as k2 \gset
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.register_director(:'k','Школа 12','Бишкек','Директор',null,'m','+996700111222','ru') ->> 'ok' as dir_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.register_director(:'k2','Школа Б','Ош','Директор Б',null,'m','+996700111333','ru') ->> 'ok' as dir2_ok;
reset role;
-- фикстуры (суперпользователь): завуч, 2 учителя, ученик с аккаунтом, родитель
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000005', school_id,'deputy','active','Завуч З' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000002', school_id,'teacher','active','Учитель Один' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000006', school_id,'teacher','active','Учитель Два' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000004', school_id,'student','active','Уч Ученик' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000003', school_id,'parent','active','Родитель Р' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into classes(school_id,name,grade,homeroom_id) select school_id,'9А',9,'00000000-0000-0000-0000-000000000002' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into classes(school_id,name,grade) select school_id,'9Б',9 from profiles where id='00000000-0000-0000-0000-000000000001';
insert into students(id,school_id,class_id,full_name,profile_id) select '10000000-0000-0000-0000-000000000001', c.school_id, c.id,'Ученик А','00000000-0000-0000-0000-000000000004' from classes c where name='9А';
insert into students(id,school_id,class_id,full_name) select '10000000-0000-0000-0000-000000000002', c.school_id, c.id,'Ученик Б' from classes c where name='9Б';
insert into teacher_assignments(teacher_id,class_id,subject_id,school_id) select '00000000-0000-0000-0000-000000000002', id,'math',school_id from classes where name='9А';
insert into parent_students(parent_id,student_id,school_id) select '00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',school_id from classes where name='9А';
\echo ===== A. attendance 30 days -> att10 + att30 + notifications
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into attendance(student_id,date,school_id,status,by) select '10000000-0000-0000-0000-000000000001', current_date - i, my_school(), 'p', auth.uid() from generate_series(0,29) i;
select ach_id from student_achievements order by ach_id;
select kind, to_user::text like '%0004' as to_student, to_user::text like '%0003' as to_parent, title from notifications where kind='achievement' order by title, to_user;
\echo -- student sees own only
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select count(*) as student_sees_ach from student_achievements;
select count(*) as student_sees_notifs from notifications where kind='achievement';
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select count(*) as other_teacher_sees_ach_expect_0_or_n from student_achievements;
\echo -- B. absence breaks streak, achievements remain, no duplicate notifications
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into attendance(student_id,date,school_id,status,by) select '10000000-0000-0000-0000-000000000001', current_date+1, my_school(), 'n', auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select count(*) as ach_after_n_expect_2 from student_achievements;
select count(*) as notifs_expect_4 from notifications where kind='achievement';
\echo -- C. grades
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into grades(school_id,student_id,subject_id,value,type,date,by) select my_school(),'10000000-0000-0000-0000-000000000001','math',5,(array['hw','test','act','ind','hw'])[i+1],current_date - i, auth.uid() from generate_series(0,4) i;
select ach_id from student_achievements order by ach_id;
\echo -- D. request_documents
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.request_documents('10000000-0000-0000-0000-000000000001', array['Свидетельство о рождении','Мед. справка 063'], 'до пятницы') as ok_admin;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.request_documents('10000000-0000-0000-0000-000000000001', array['x']) as teacher_forbidden;
select title, left(body,90) as body from notifications where kind='doc_request';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.request_documents('10000000-0000-0000-0000-000000000002', array['Справка']) as no_homeroom;
select public.request_documents('10000000-0000-0000-0000-000000000001', array[]::text[]) as empty;
\echo -- E. subjects
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into subjects(id,ru,ky,school_id,emoji) values ('s_geo','География','География', my_school(),'🌍') returning id;
insert into subjects(id,ru,ky,school_id) values ('geo2','Плохой id','x', my_school());
insert into subjects(id,ru,ky,school_id) select 's_evil','Чужая','x', school_id from profiles where id='00000000-0000-0000-0000-000000000007';
insert into subject_hidden(school_id,subject_id) select my_school(),'bio' returning subject_id;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into subjects(id,ru,ky,school_id) values ('s_t','Учитель добавил','x', my_school());
select count(*) as teacher_sees_subjects from subjects;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select count(*) as other_school_sees_s_geo from subjects where id='s_geo';
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
reset role; insert into grades(school_id,student_id,subject_id,value,type) select school_id,'10000000-0000-0000-0000-000000000001','s_geo',4,'hw' from classes limit 1; set role authenticated;
delete from subjects where id='s_geo';
\echo -- F. schedule
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.schedule_save('20000000-0000-0000-0000-000000000001','Черновик завуча','{"lessons":[{"c":"x","d":1,"n":1,"s":"math"}]}'::jsonb) as dep_save;
select public.schedule_save(null,'x','{"lessons":[]}'::jsonb) as short_title;
select public.schedule_save(null,'Плохие данные','{"nolessons":1}'::jsonb) as bad_data;
select public.schedule_submit('20000000-0000-0000-0000-000000000001') as dep_submit;
select count(*) as dep_sees_own from schedule_versions;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select count(*) as teacher_sees_pending_expect_0 from schedule_versions;
select public.schedule_save(null,'Учитель пишет','{"lessons":[]}'::jsonb) as teacher_save_forbidden;
select public.schedule_decide('20000000-0000-0000-0000-000000000001', true) as teacher_decide_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.schedule_decide('20000000-0000-0000-0000-000000000001', true) as dep_decide_forbidden;
select public.schedule_publish('20000000-0000-0000-0000-000000000001') as dep_publish_forbidden;
select public.schedule_save('20000000-0000-0000-0000-000000000001','Правка','{"lessons":[]}'::jsonb) as locked_when_pending;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select title, kind from notifications where kind='schedule_pending';
select public.schedule_decide('20000000-0000-0000-0000-000000000001', false, '') as reject_needs_note;
select public.schedule_decide('20000000-0000-0000-0000-000000000001', false, 'Нет физкультуры в сетке') as rejected;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select title, left(body,60) from notifications where kind='schedule_rejected';
select status, decision_note from schedule_versions;
select public.schedule_save('20000000-0000-0000-0000-000000000001','Черновик завуча v2','{"lessons":[{"c":"x","d":1,"n":1,"s":"math"},{"c":"x","d":1,"n":2,"s":"rus"}]}'::jsonb) as resave_after_reject;
select public.schedule_submit('20000000-0000-0000-0000-000000000001') as resubmit;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.schedule_decide('20000000-0000-0000-0000-000000000001', true, 'Хорошо') as approved;
select title, is_active, status from schedule_versions;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select count(*) as teacher_sees_active from schedule_versions;
select count(*) as teacher_new_notifs from notifications where kind='schedule_new';
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select count(*) as student_sees_active from schedule_versions;
select count(*) as student_new_notifs from notifications where kind='schedule_new';
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select count(*) as dep_approved_notif from notifications where kind='schedule_approved';
select count(*) as dep_own_new_notif_expect_0 from notifications where kind='schedule_new';
select public.schedule_save('20000000-0000-0000-0000-000000000001','Ломаю','{"lessons":[]}'::jsonb) as locked_active;
\echo -- director publishes own, previous archived, one active
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.schedule_save('20000000-0000-0000-0000-000000000002','Директор: v3','{"lessons":[{"c":"x","d":2,"n":1,"s":"eng"}]}'::jsonb) as dir_save;
select public.schedule_publish('20000000-0000-0000-0000-000000000002') as dir_publish;
select title, is_active, status from schedule_versions order by created_at;
select count(*) as active_count from schedule_versions where is_active;
select public.schedule_delete('20000000-0000-0000-0000-000000000002') as delete_active_locked;
\echo -- comments
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.schedule_comment('Предлагаю убрать 7-й урок в пятницу') as teacher_comment;
select public.schedule_comment('ab') as too_short;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.schedule_comment('ученик пишет') as student_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select count(*) as dep_sees_comment from schedule_comments;
select count(*) as dep_comment_notif from notifications where kind='schedule_comment';
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select count(*) as other_teacher_sees_comment_expect_0 from schedule_comments;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select count(*) as other_school_sees_versions_expect_0 from schedule_versions;
