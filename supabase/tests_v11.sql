-- Проверка v11: серверный фильтр разметки, выгрузка школы, согласие.
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select (public.school_export('students') ->> 'ok') as director_students_ok, jsonb_array_length(public.school_export('grades', 0, 5)->'rows') as grades_page, (public.school_export('grades', 0, 2)->>'next') as next_expect_2;
select public.school_export('nope') ->> 'error' as bad_part_expect_fields;
select public.school_export('people') -> 'rows' -> 0 ? 'full_name' as has_names;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.school_export('students') ->> 'error' as teacher_forbidden;
select pg_temp.as_user('00000000-0000-0000-0000-000000000099');
select public.school_export('school') ->> 'error' as super_without_school_expect_fields;
select jsonb_array_length(public.school_export('classes', 0, 100, '88a8d7e9-a217-4f35-a23f-b0c3e02b6389')->'rows') > 0 as super_with_school_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
\echo --- опасная разметка (ожидаем ошибки)
select public.news_post('Тест 1', '<p>ok</p><script>alert(1)</script>', 'news', 'all', false, null, null, 'html');
select public.news_post('Тест 2', '<b onclick=alert(1)>x</b>', 'news', 'all', false, null, null, 'html');
select public.news_post('Тест 3', '<a href="javascript:alert(1)">x</a>', 'news', 'all', false, null, null, 'html');
select (public.news_post('Тест 4', '<p>Обычный <b>текст</b> про on-line и onboarding</p>', 'news', 'all', false, null, null, 'html') ->> 'ok') as clean_html_ok;
\echo --- согласие
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.consent_status('2026-11') ->> 'accepted' as before_expect_false;
select public.consent_accept('2026-11') ->> 'ok';
select public.consent_status('2026-11') ->> 'accepted' as after_expect_true;
