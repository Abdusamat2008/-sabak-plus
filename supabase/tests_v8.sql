-- Сценарные тесты schema_v8 (после tests_v6/v7 на той же базе; в Supabase НЕ выполнять)
\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
select public._year_label_of(public._today()) as ylab, substr(public._year_label_of(public._today()),1,4)::int as y, public._today() as td \gset
\echo ===== setup: оценки в Q1 до появления календаря (ограничений нет)
reset role;
set session_replication_role = replica;
insert into grades(school_id,student_id,subject_id,value,type,by,date) select school_id,'10000000-0000-0000-0000-000000000001','math',5,'test','00000000-0000-0000-0000-000000000002',make_date(:y,9,20) from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,date) select school_id,'10000000-0000-0000-0000-000000000001','math',3,'hw','00000000-0000-0000-0000-000000000002',make_date(:y,9,22) from profiles where id='00000000-0000-0000-0000-000000000002';
set session_replication_role = origin;
set role authenticated;
\echo ===== C1. календарь: права и проверки
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-09-01","ends":"2026-10-25"}]')->>'error' as director_expect_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.calendar_set('2026/2028','[]')->>'error' as bad_year;
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-09-01","ends":"2026-10-25"},{"kind":"quarter","num":2,"starts":"2026-10-20","ends":"2026-12-27"}]')->>'error' as overlap;
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-09-01","ends":"2026-10-25"},{"kind":"quarter","num":1,"starts":"2026-11-02","ends":"2026-12-27"}]')->>'error' as dup;
select public.calendar_set(:'ylab','[{"kind":"quarter","num":2,"starts":"2026-09-01","ends":"2026-10-25"},{"kind":"quarter","num":1,"starts":"2026-11-02","ends":"2026-12-27"}]')->>'error' as order_err;
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-12-01","ends":"2026-10-25"}]')->>'error' as range_err;
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-06-01","ends":"2026-10-25"}]')->>'error' as outside_year;
select public.calendar_set(:'ylab','[
 {"kind":"quarter","num":1,"starts":"2026-09-01","ends":"2026-10-25"},{"kind":"break","num":1,"starts":"2026-10-26","ends":"2026-11-01"},
 {"kind":"quarter","num":2,"starts":"2026-11-02","ends":"2026-12-27"},{"kind":"break","num":2,"starts":"2026-12-28","ends":"2027-01-11"},
 {"kind":"quarter","num":3,"starts":"2027-01-12","ends":"2027-03-21"},{"kind":"break","num":3,"starts":"2027-03-22","ends":"2027-03-31"},
 {"kind":"quarter","num":4,"starts":"2027-04-01","ends":"2027-05-25"}]','Приказ МОН КР (тест)')->>'ok' as calendar_set_expect_true;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select c->'current'->>'num' as current_quarter_expect_2, c->'current'->>'kind' as kind, jsonb_array_length(c->'terms') as terms_expect_7, c->'next'->>'num' as next_q from public.calendar_get() c;
\echo ===== G1. оценки: открытая четверть / каникулы / закрытая
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into grades(school_id,student_id,subject_id,value,type,by,topic,comment) select school_id,'10000000-0000-0000-0000-000000000001','math',4,'act','00000000-0000-0000-0000-000000000002','Дроби','Хорошо объяснил' from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,date) select school_id,'10000000-0000-0000-0000-000000000001','math',4,'act','00000000-0000-0000-0000-000000000002',make_date(:y,10,28) from profiles where id='00000000-0000-0000-0000-000000000002';
insert into grades(school_id,student_id,subject_id,value,type,by,date) select school_id,'10000000-0000-0000-0000-000000000001','math',4,'act','00000000-0000-0000-0000-000000000002',make_date(:y,10,10) from profiles where id='00000000-0000-0000-0000-000000000002';
update grades set value = 4 where date = make_date(:y,9,22);
delete from grades where date = make_date(:y,9,22);
select count(*) as q1_grades_still_2_expect_2 from grades where date between make_date(:y,9,1) and make_date(:y,10,25);
\echo ===== L1. журнал изменений
update grades set value = 5, comment = 'Исправлено' where topic = 'Дроби';
select g->'grade'->>'topic' as topic, g->'grade'->>'value' as value_expect_5, g->'grade'->>'teacher' as teacher, jsonb_array_length(g->'log') as log_entries_expect_2, g->'log'->1->>'action' as last_action from public.grade_detail((select id from grades where topic='Дроби')) g;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.grade_detail((select id from (select id from grades where topic='Дроби') z))->>'error' as other_school_expect_forbidden;
\echo ===== A1. архив четвертей (term_tick)
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.term_tick() as tick1;
select public.term_tick() as tick2_expect_empty;
reset role;
select quarter, subject_id, n, avg, final, student_name from quarter_archive order by 1,2;
select count(*) as runs_expect_1 from quarter_runs;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.calendar_set(:'ylab','[{"kind":"quarter","num":1,"starts":"2026-09-02","ends":"2026-10-25"},{"kind":"quarter","num":2,"starts":"2026-11-02","ends":"2026-12-27"}]')->>'error' as change_archived_quarter_expect_archived;
\echo ===== H1. табель и прошлые годы
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select jsonb_array_length(public.student_history('10000000-0000-0000-0000-000000000001')->'rows') as own_rows_expect_1;
select public.student_history('10000000-0000-0000-0000-000000000002')->>'error' as classmate_expect_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select jsonb_array_length(public.student_history('10000000-0000-0000-0000-000000000001')->'rows') as parent_rows_expect_1;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.past_grade_set('10000000-0000-0000-0000-000000000001','2024/2025',1,'math',4)->>'ok' as past_ok;
select public.past_grade_set('10000000-0000-0000-0000-000000000001','2024/2025',5,'math',5)->>'ok' as past_year_ok;
select public.past_grade_set('10000000-0000-0000-0000-000000000001',:'ylab',1,'math',4)->>'error' as current_year_expect_not_past;
select public.past_grade_set('10000000-0000-0000-0000-000000000003','2024/2025',1,'math',4)->>'error' as other_school_expect_forbidden;
select public.past_grade_set('10000000-0000-0000-0000-000000000001','2024/2025',1,'math',7)->>'error' as bad_value;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select x->>'year' as year, x->>'quarter' as q, x->>'final' as final, x->>'src' as src from jsonb_array_elements(public.student_history('10000000-0000-0000-0000-000000000001')->'rows') x;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.past_grade_set('10000000-0000-0000-0000-000000000001','2024/2025',2,'math',4)->>'error' as student_cannot_expect_forbidden;
\echo ===== R1. отчёты
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select r->>'src' as src, jsonb_array_length(r->'rows') as rows_q1_expect_1, r->'rows'->0->>'name' as nm, jsonb_array_length(r->'rows'->0->'g') as grades_expect_2 from public.report_rows(:'ylab',1,null,'math') r;
select jsonb_array_length(public.report_rows(:'ylab',2,null,null)->'rows') as q2_rows_expect_1;
select jsonb_array_length(public.report_rows(:'ylab',0,null,null)->'rows') as year_rows_expect_1;
select public.report_rows(:'ylab',4,null,null)->>'error' as no_term_q4_ok_if_defined_else_error;
select public.report_rows('2030/2031',3,null,null)->>'error' as no_term_expect_no_term;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.report_rows(:'ylab',1,null,null)->>'error' as student_expect_forbidden;
\echo ===== I1. удостоверение
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select i->'school'->>'name' as school, i->'student'->>'class' as cls, i->'student'->>'number' as num, jsonb_array_length(i->'parents') as parents_expect_1, i->'homeroom'->>'name' as homeroom from public.id_card('10000000-0000-0000-0000-000000000001') i;
select public.id_card('10000000-0000-0000-0000-000000000002')->>'error' as classmate_expect_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select public.id_card('10000000-0000-0000-0000-000000000001')->>'ok' as parent_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.id_card('10000000-0000-0000-0000-000000000001')->>'error' as other_school_expect_forbidden;
\echo ===== N1. новости с форматированием
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.news_post('Собрание школы','<h2>Важно</h2><p><b>Завтра</b> в 10:00</p>','news','all',false,null,null,'html')->>'ok' as html_news_ok;
select public.news_post('Плохой формат','тест','news','all',false,null,null,'xml')->>'error' as bad_fmt;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select n->>'fmt' as fmt, n->>'author_role' as role, n->>'author' as author from jsonb_array_elements(public.news_list()->'rows') n where n->>'title' = 'Собрание школы';
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.news_edit((select (n->>'id')::uuid from jsonb_array_elements(public.news_list()->'rows') n where n->>'title'='Собрание школы'),'Собрание школы (обновлено)','<p>Перенесли на 11:00</p>','html')->>'ok' as edit_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.news_edit((select (n->>'id')::uuid from jsonb_array_elements(public.news_list()->'rows') n limit 1),'Взлом','<p>x</p>','html')->>'error' as student_edit_expect_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.super_news_post('Каникулы утверждены','<p>Осенние каникулы с <b>26 октября</b></p>',false,'html')->>'ok' as super_html_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select n->>'author_role' as role, n->>'fmt' as fmt from jsonb_array_elements(public.news_list()->'rows') n where n->>'title' like 'Каникулы%';
