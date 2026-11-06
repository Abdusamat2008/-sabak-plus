-- Сценарные тесты schema_v6 (запуск на пустой базе после schema_v2 … v6; в Supabase НЕ выполнять).
\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
insert into auth.users(id,email) select ('00000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid, 'u'||n||'@x' from generate_series(1,9) n;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000099','super@x');
select public.create_school_key('Школа А') as ka \gset
select public.create_school_key('Школа Б') as kb \gset
select public.create_school_key('Свободная') as kf \gset
\echo ===== K1. peek_school_key (до регистрации, анонимно)
set role anon;
select public.peek_school_key('SABAK-NOPE-NOPE-NOPE')->>'state' as missing_expect_missing, public.peek_school_key(lower(:'kf'))->>'state' as free_expect_free, public.peek_school_key(:'kf')->>'note' as note;
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.register_director('SABAK-NOPE-NOPE-NOPE','Х','Б','Д',null,'m','+996700111222','ru')->>'error' as nonexistent_expect_bad_key;
select public.register_director(:'ka','Школа А','Бишкек','Директор А',null,'m','+996700111222','ru')->>'ok' as dirA;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.register_director(:'kb','Школа Б','Ош','Директор Б',null,'m','+996700111333','ru')->>'ok' as dirB;
select pg_temp.as_user('00000000-0000-0000-0000-000000000008');
select public.register_director(:'ka','Школа Ё','Ош','Директор Ё',null,'m','+996700111444','ru')->>'error' as used_expect_key_used;
reset role;
select public.peek_school_key(:'ka')->>'state' as peek_used, (select key_plain is null from school_keys where note='Школа А') as plain_cleared, (select key_plain is not null from school_keys where note='Свободная') as plain_kept_for_free;
insert into profiles(id,role,status,full_name) values ('00000000-0000-0000-0000-000000000099','superadmin','active','Супер');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select (select count(*) from jsonb_array_elements(public.super_keys()->'keys') k where k->>'key' is not null) as keys_visible_expect_1, (select k->>'key' = :'kf' from jsonb_array_elements(public.super_keys()->'keys') k where k->>'key' is not null) as same_key;
reset role;
-- класс, учитель, ученики, родитель
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000002', school_id,'teacher','active','Учитель А' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000003', school_id,'student','active','Ученик А1' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000004', school_id,'student','active','Ученик А2' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000005', school_id,'student','active','Ученик Б1' from profiles where id='00000000-0000-0000-0000-000000000007';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000006', school_id,'parent','active','Родитель А1' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-000000000009', school_id,'teacher','active','Учитель чужой' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into classes(id,school_id,name,grade,homeroom_id) select 'c0000000-0000-0000-0000-00000000000a', school_id,'9А',9,'00000000-0000-0000-0000-000000000002' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into classes(id,school_id,name,grade) select 'c0000000-0000-0000-0000-00000000000b', school_id,'5А',5 from profiles where id='00000000-0000-0000-0000-000000000007';
insert into students(id,school_id,class_id,profile_id,full_name) values
 ('10000000-0000-0000-0000-000000000001',(select school_id from profiles where id='00000000-0000-0000-0000-000000000001'),'c0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000003','Ученик А1'),
 ('10000000-0000-0000-0000-000000000002',(select school_id from profiles where id='00000000-0000-0000-0000-000000000001'),'c0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000004','Ученик А2'),
 ('10000000-0000-0000-0000-000000000003',(select school_id from profiles where id='00000000-0000-0000-0000-000000000007'),'c0000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000005','Ученик Б1');
insert into parent_students(parent_id,student_id,school_id) select '00000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001', school_id from profiles where id='00000000-0000-0000-0000-000000000001';
insert into teacher_assignments(teacher_id,class_id,subject_id,school_id) select '00000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000a','math', school_id from profiles where id='00000000-0000-0000-0000-000000000001';
\echo ===== G1. причина двойки обязательна, дата, заработок
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into grades(school_id,student_id,subject_id,value,type,by) select school_id,'10000000-0000-0000-0000-000000000001','math',2,'hw','00000000-0000-0000-0000-000000000002' from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,reason) select school_id,'10000000-0000-0000-0000-000000000001','math',2,'hw','00000000-0000-0000-0000-000000000002','no_hw' from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,reason) select school_id,'10000000-0000-0000-0000-000000000001','math',2,'hw','00000000-0000-0000-0000-000000000002','other' from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,date) select school_id,'10000000-0000-0000-0000-000000000001','math',5,'hw','00000000-0000-0000-0000-000000000002',current_date+3 from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,reason) select school_id,'10000000-0000-0000-0000-000000000001','math',5,'test','00000000-0000-0000-0000-000000000002','no_hw' from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by) select school_id,'10000000-0000-0000-0000-000000000001','math',4,'act','00000000-0000-0000-0000-000000000002' from profiles where id='00000000-0000-0000-0000-000000000002';
select count(*) as grades_expect_3, count(*) filter (where value=2 and reason='no_hw') as two_with_reason, count(*) filter (where value=5 and reason is null) as five_reason_cleared from grades;
reset role;
select balance_expect_12 from (select public.coin_balance('10000000-0000-0000-0000-000000000001') as balance_expect_12) x;
\echo ===== C1. кошелёк, лимиты и запросы
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_state()->>'balance' as bal, jsonb_array_length(public.coin_state()->'items') as items, jsonb_array_length(public.coin_state()->'ledger') as ledger;
select public.coin_request('skip_lesson','math',current_date+1,'Приём у врача по записи')->>'error' as no_funds;
select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
select public.coin_award('10000000-0000-0000-0000-000000000001',20,'Участие в олимпиаде')->>'error' as foreign_teacher_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.coin_award('10000000-0000-0000-0000-000000000001',20,'Участие в олимпиаде')->>'balance' as after_award_32;
select public.coin_award('10000000-0000-0000-0000-000000000001',50,'много')->>'error' as amount_limit;
select public.coin_award('10000000-0000-0000-0000-000000000001',5,'')->>'error' as note_required;
select public.coin_award('10000000-0000-0000-0000-000000000003',5,'чужая школа')->>'error' as other_school;
select public.coin_award('10000000-0000-0000-0000-000000000001',20,'Помощь в классе')->>'balance' as after_award_52;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_request('skip_lesson','math',current_date+1,'коротко')->>'error' as reason_short;
select public.coin_request('skip_lesson','math',current_date-1,'Приём у врача по записи')->>'error' as date_past;
select public.coin_request('skip_lesson',null,current_date+1,'Приём у врача по записи')->>'error' as subject_required;
select public.coin_request('skip_lesson','math',(select d from generate_series(current_date+1, current_date+7, interval '1 day') d where extract(isodow from d)=6)::date,'Приём у врача по записи')->>'error' as weekend;
select public.coin_request('skip_lesson','math',(select d from generate_series(current_date+1, current_date+7, interval '1 day') d where extract(isodow from d)=2)::date,'Приём у врача по записи') ->> 'status' as req1_pending, public.coin_state()->>'balance' as bal_after_12;
select public.coin_state()->'requests'->0->>'status' as in_list;
\echo -- teacher sees and rejects
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select jsonb_array_length(public.coin_staff('pending')->'rows') as teacher_sees_1, public.coin_staff('pending')->'rows'->0->>'student' as who, public.coin_staff('pending')->'rows'->0->>'abs30' as abs30;
select public.coin_decide((public.coin_staff('pending')->'rows'->0->>'id')::uuid, false, '')->>'error' as reject_needs_note;
select public.coin_decide((public.coin_staff('pending')->'rows'->0->>'id')::uuid, false, 'В этот день контрольная')->>'ok' as rejected;
select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
select jsonb_array_length(public.coin_staff('all')->'rows') as foreign_teacher_sees_0;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_state()->>'balance' as refunded_52, public.coin_state()->'requests'->0->>'status' as rejected_status, public.coin_state()->'requests'->0->>'note' as note;
reset role; select public._coin_add('10000000-0000-0000-0000-000000000001', 200, 'award', null, 'тест skip_day'); set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_request('skip_day',null,(select d from generate_series(current_date+1, current_date+7, interval '1 day') d where extract(isodow from d)=3)::date,'Семейное обстоятельство, поездка') ->> 'status' as skipday_pending, public.coin_state()->>'balance' as bal_after_skipday_0;
select public.coin_request('hw_pass')->>'status' as hw_pass_pending;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.coin_decide((public.coin_staff('pending')->'rows'->0->>'id')::uuid, true, null)->>'ok' as homeroom_approves_skipday;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_cancel((public.coin_state()->'requests'->0->>'id')::uuid)->>'error' as cancel_approved_error;
\echo -- родитель видит кошелёк ребёнка и не чужого
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select public.coin_state('10000000-0000-0000-0000-000000000001')->>'balance' as parent_sees, public.coin_state('10000000-0000-0000-0000-000000000002')->>'error' as parent_foreign;
select public.coin_request('hw_pass')->>'error' as parent_cannot_spend;
\echo -- удаление оценки возвращает заработок
reset role;
select public.coin_balance('10000000-0000-0000-0000-000000000001') as before_delete;
delete from grades where student_id='10000000-0000-0000-0000-000000000001' and value=5;
select public.coin_balance('10000000-0000-0000-0000-000000000001') as after_delete_clamped;
\echo -- админ: каталог
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select jsonb_array_length(public.coin_admin()->'items') as admin_items, public.coin_item_set('hw_pass',30,true,null)->>'ok' as price_set, public.coin_item_add('Выбрать тему классного часа','🎤',45,'Один раз в месяц','homeroom')->>'ok' as added;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.coin_item_set('hw_pass',1,true,null)->>'error' as teacher_cannot_set;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.coin_award_class('c0000000-0000-0000-0000-00000000000a',5,'Победа в спартакиаде')->>'n' as class_award_n, public.coin_award_class('c0000000-0000-0000-0000-00000000000b',5,'чужой класс')->>'error' as class_foreign;
reset role;
select count(*) as items_school_b from coin_items where school_id=(select school_id from profiles where id='00000000-0000-0000-0000-000000000007');
\echo ===== L1. план урока
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.lesson_set('c0000000-0000-0000-0000-00000000000a','math',current_date,'Квадратные уравнения','№ 215–220',current_date+2)->>'ok' as lesson_ok;
select public.lesson_set('c0000000-0000-0000-0000-00000000000a','math',current_date,'Квадратные уравнения (2)','№ 215–220',current_date+2)->>'ok' as lesson_upsert;
select public.lesson_set('c0000000-0000-0000-0000-00000000000a','eng',current_date,'Unit 4',null,null)->>'error' as not_my_subject;
select count(*) as topics, (select count(*) from homework) as hw_dedup_expect_1 from lesson_notes;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003'); select count(*) as student_reads_topic from lesson_notes;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005'); select count(*) as other_school_reads_0 from lesson_notes;
reset role;
\echo ===== N1. новости: школы не видят друг друга
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.news_post('Родительское собрание','Во вторник в 18:00 в актовом зале','event','all',true,current_date+5,null)->>'ok' as post_all;
select public.news_post('Только для 9А','Завтра сокращённые уроки','news','class:c0000000-0000-0000-0000-00000000000a',false,null,null)->>'ok' as post_class;
select public.news_post('Для 5А чужого класса','x1x','news','class:c0000000-0000-0000-0000-00000000000b',false,null,null)->>'error' as foreign_class_audience;
select public.news_post('Для сотрудников','Педсовет в пятницу','news','staff',false,null,null)->>'ok' as post_staff;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.news_post('Новость школы Б','Каникулы начинаются','news','all',false,null,null)->>'ok' as post_B;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.super_news_post('Вышла версия 0.8','Валюта, новости и «Үн»',true)->>'ok' as platform_post;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select jsonb_array_length(public.news_list()->'rows') as student_A_sees_3, (select string_agg(r->>'title', '|' order by r->>'title') from jsonb_array_elements(public.news_list()->'rows') r) as titles;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select jsonb_array_length(public.news_list()->'rows') as student_B_sees_2, (select string_agg(r->>'title', '|' order by r->>'title') from jsonb_array_elements(public.news_list()->'rows') r) as titles;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select (select string_agg(r->>'title', '|' order by r->>'title') from jsonb_array_elements(public.news_list()->'rows') r) as parent_A_titles;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select (select string_agg(r->>'title', '|' order by r->>'title') from jsonb_array_elements(public.news_list()->'rows') r) as teacher_A_titles;
select public.news_post('Заметка классу','Завтра проверочная','news','class:c0000000-0000-0000-0000-00000000000a',true,null,null)->>'ok' as teacher_posts_own_class;
select public.news_post('Всем','нельзя','news','all',false,null,null)->>'error' as teacher_all_forbidden;
select (select bool_or((r->>'pinned')::boolean) from jsonb_array_elements(public.news_list()->'rows') r where r->>'title'='Заметка классу') as teacher_pin_ignored_expect_false;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.news_read()->>'ok' as read_all;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select (select (r->>'reads')::int from jsonb_array_elements(public.news_list()->'rows') r where r->>'title'='Родительское собрание') as reads_by_student_expect_1;
select public.news_set((select (r->>'id')::uuid from jsonb_array_elements(public.news_list()->'rows') r where r->>'title'='Для сотрудников'), null, true)->>'ok' as deleted;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
reset role; select id as nid_a from news where title='Родительское собрание' \gset
select id as nid_p from news where title='Вышла версия 0.8' \gset
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.news_set(:'nid_a'::uuid, true, false)->>'error' as foreign_school_news_set;
select public.news_set(:'nid_p'::uuid, false, false)->>'error' as platform_news_set_forbidden;
reset role;
\echo ===== T1. Үн: профили, username, посты, анонимность, модерация
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.th_me()->>'error' as teacher_no_access;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select public.th_feed()->>'error' as parent_no_access;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_me()->'profile' is null as no_profile_yet, public.th_me()->>'mod' as mod;
select public.th_username_check('ab')->>'reason' as short, public.th_username_check('Sabak_team')->>'reason' as reserved, public.th_username_check('bad__name')->>'reason' as double_us, public.th_username_check('Aidana_9')->>'available' as free;
select public.th_profile_save('Aidana_9','Айдана','Люблю физику','🦋','sunset','#D6443F')->>'ok' as profile_created;
select public.th_profile_save('x-nope','Имя','','🦋','x-gold','#D6443F')->>'error' as locked_theme_check_expect_username_format_or_locked;
select public.th_profile_save('aidana_9','Айдана','Люблю физику','🦋','x-gold','#D6443F')->>'error' as locked_theme;
select public.th_profile_save('aidana_9','Айдана','Пиши мне 0700 123 456','🦋','sunset','#D6443F')->>'error' as phone_in_bio;
select public.th_profile_save('aidana_9','Айдана','сайт https://x.ru','🦋','sunset','#D6443F')->>'error' as link_in_bio;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_username_check('AIDANA_9')->>'reason' as taken_case_insensitive;
select public.th_post('Привет всем','false'::boolean)->>'error' as no_profile_post;
select public.th_post('Анонимно: в столовой всегда холодно',true)->>'ok' as anon_post_without_profile;
select public.th_profile_save('bekzat_k','Бекзат','','🐺','ocean','#2352D8')->>'ok' as profile2;
select public.th_post('Кто идёт на кружок робототехники?',false)->>'ok' as named_post;
select public.th_post('Пишите сюда https://t.me/abc',false)->>'error' as link_blocked;
select public.th_post('ты дурак',false)->>'error' as word_blocked;
select public.th_post('Мой номер 0555 12 34 56',false)->>'error' as phone_blocked;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_post('Спасибо за вопрос про кружок!',false)->>'ok' as post3;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select jsonb_array_length(public.th_feed('new')->'rows') as feed_A_3;
select (select r->'author' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Анонимно%') as anon_author_card;
select (select (r->'author' ? 'username') from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Анонимно%') as anon_has_username_expect_false;
select (select r->>'id' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Анонимно%') as anon_id \gset
select (select r->>'id' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Кто идёт%') as named_id \gset
select public.th_like('p', :'named_id'::uuid) as like1, public.th_like('p', :'named_id'::uuid) as like_toggle_off, public.th_like('p', :'named_id'::uuid)->>'n' as like_again_1;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_like('p', :'named_id'::uuid)->>'n' as likes_2;
select public.th_comment(:'named_id'::uuid,'Я иду!',false)->>'ok' as comment_named;
select public.th_comment(:'anon_id'::uuid,'Согласен, холодно',true)->>'ok' as comment_anon;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_comment(:'anon_id'::uuid,'Это я писал пост',true)->>'ok' as op_comment_anon;
select (select string_agg((r->>'op')||':'||coalesce(r->'author'->>'alias', r->'author'->>'username'), ' | ' order by r->>'at') from jsonb_array_elements(public.th_comments(:'anon_id'::uuid)->'rows') r) as comments_with_op_flag;
select (select count(distinct r->'author'->>'alias') from jsonb_array_elements(public.th_comments(:'anon_id'::uuid)->'rows') r) as distinct_aliases_expect_2;
select (select r->'author'->>'alias' from jsonb_array_elements(public.th_comments(:'anon_id'::uuid)->'rows') r where (r->>'op')::boolean) = (select r->'author'->>'alias' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'id'=:'anon_id') as op_alias_matches_post;
\echo -- школа Б не видит ничего из школы А
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select jsonb_array_length(public.th_feed('new')->'rows') as feed_B_0, public.th_comments(:'anon_id'::uuid)->>'error' as foreign_comments, public.th_like('p', :'named_id'::uuid)->>'error' as foreign_like, public.th_profile_get('aidana_9')->>'error' as foreign_profile, public.th_report('p', :'named_id'::uuid, 'spam')->>'error' as foreign_report;
select public.th_username_check('aidana_9')->>'reason' as username_taken_across_schools;
\echo -- профиль не раскрывает класс/ФИО
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_profile_get('aidana_9') as profile_json;
select (public.th_profile_get('aidana_9')::text ~* '9А|Ученик А1|class') as leaks_class_or_name_expect_false;
\echo -- жалобы: авто-скрытие после 3
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_report('p', :'anon_id'::uuid, 'bullying')->>'reports' as r1;
select public.th_report('p', :'anon_id'::uuid, 'bullying')->>'dup' as dup;
select public.th_report('p', (select r->>'id' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Спасибо%')::uuid, 'spam')->>'error' as own_post_report;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_report('p', :'anon_id'::uuid, 'spam')->>'error' as own_report_forbidden;
reset role;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','a1@x'),('00000000-0000-0000-0000-0000000000a2','a2@x') on conflict do nothing;
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-0000000000a1', school_id,'student','active','Ученик А3' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into profiles(id,school_id,role,status,full_name) select '00000000-0000-0000-0000-0000000000a2', school_id,'student','active','Ученик А4' from profiles where id='00000000-0000-0000-0000-000000000001';
insert into students(school_id,class_id,profile_id,full_name) select school_id,'c0000000-0000-0000-0000-00000000000a',id,full_name from profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); select public.th_report('p', :'anon_id'::uuid, 'inappropriate')->>'reports' as r2;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2'); select public.th_report('p', :'anon_id'::uuid, 'inappropriate')->>'reports' as r3;
select (select count(*) from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'id'=:'anon_id') as hidden_from_others_expect_0;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select (select (r->>'hidden')::boolean from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'id'=:'anon_id') as author_sees_own_hidden;
\echo -- модерация
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select jsonb_array_length(public.th_mod_queue()->'rows') as queue_1, public.th_mod_queue()->'rows'->0->'reasons' as reasons, public.th_mod_queue()->'rows'->0->'author' as author_card_no_identity;
select public.th_reveal('p', :'anon_id'::uuid, 'Угрозы одному из учеников класса')->>'error' as reveal_default_off;
select public.th_ban('p', :'anon_id'::uuid, 3, 'Травля')->>'ok' as banned_without_reveal;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_post('Ещё пост',false)->>'error' as banned_post, public.th_post('Анонимный ещё',true)->>'error' as banned_anon, (public.th_me()->>'banned') is not null as banned_flag;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.th_settings(null, true)->>'reveal' as reveal_on;
select public.th_reveal('p', :'anon_id'::uuid, 'коротко')->>'error' as reveal_reason_short;
select public.th_reveal('p', :'anon_id'::uuid, 'Угрозы одному из учеников класса')->>'name' as revealed_name;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_reveal('p', :'anon_id'::uuid, 'Угрозы одному из учеников класса')->>'error' as student_cannot_reveal;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.th_unban((public.th_mod_queue()->'bans'->0->>'id')::uuid)->>'ok' as unban;
select public.th_mod_decide('p', :'anon_id'::uuid, 'restore')->>'ok' as restored;
select public.th_settings(null,null,'плохоеслово',null)->'words' as words_after_add;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_post('это плохоеслово тут',false)->>'error' as school_blocklist_works;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.th_post('Уважаемые ученики! Это официальное сообщение.',true)->>'ok' as official_post;
select (select r->'author'->>'name' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Уважаемые%') as official_name;
select public.th_settings(false,null)->>'enabled' as disabled;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_me()->>'enabled' as me_enabled_false, public.th_feed()->>'error' as feed_disabled;
\echo -- переименование: кулдаун 7 дней и память имён
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select public.th_settings(true,null)->>'enabled' as enabled_again;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_profile_save('aidana_new','Айдана','','🦋','sunset','#D6443F')->>'error' as rename_cooldown;
reset role;
update thread_profiles set username_changed_at = now() - interval '8 days' where lower(username)='aidana_9';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_profile_save('aidana_new','Айдана','','🦋','sunset','#D6443F')->>'ok' as renamed;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_username_check('aidana_9')->>'reason' as old_name_reserved_90d;
reset role;
select name_lc, active, released_at is not null as released from thread_usernames order by name_lc;
update thread_usernames set released_at = now() - interval '100 days' where name_lc='aidana_9';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000004'); select public.th_username_check('aidana_9')->>'available' as free_after_90d; reset role;
\echo ===== T2. Алтын: перевод по username
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.coin_state()->>'balance' as a3_balance;
reset role;
select public._coin_add('10000000-0000-0000-0000-000000000002', 40, 'award', null, 'тест') as seeded;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.coin_transfer('aidana_new', 10, 'спасибо')->>'balance' as sender_after_transfer;
select public.coin_transfer('bekzat_k', 5)->>'error' as self_transfer;
select public.coin_transfer('nobody_here', 5)->>'error' as no_user;
select public.coin_transfer('aidana_new', 31)->>'error' as amount_limit;
select public.coin_transfer('aidana_new', 30)->>'error' as maybe_ok_or_funds;
select public.coin_transfer('aidana_new', 30)->>'error' as day_limit_or_funds;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.coin_state()->>'balance' as receiver_balance, public.coin_state()->'ledger'->0->>'note' as receiver_note;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.coin_transfer('aidana_new', 1)->>'error' as no_profile_cannot_transfer;
reset role;
