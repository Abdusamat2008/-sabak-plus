-- Проверка v10: ключ ученика знает ФИО; регистрация без ввода ФИО; один действующий ключ.
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
select setval(pg_get_serial_sequence('audit_log','id'), (select max(id) from audit_log)) \g /dev/null
set session_replication_role = replica;
insert into students (id, school_id, class_id, full_name, birth_date) select '30000000-0000-0000-0000-000000000001', school_id, id, 'Тестов Тест Тестович', '2011-05-05' from classes where school_id = '88a8d7e9-a217-4f35-a23f-b0c3e02b6389' limit 1;
set session_replication_role = origin;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.create_invite('student', null, '30000000-0000-0000-0000-000000000001') as key1 \gset
select :'key1'::jsonb->>'code' as code1 \gset
select :'key1'::jsonb->>'student_name' as name_in_response;
select public.create_invite('student', null, '30000000-0000-0000-0000-000000000001') as key2 \gset
select :'key2'::jsonb->>'code' as code2, (:'key2'::jsonb->>'expires_in_days') as days_expect_180 \gset
select (select count(*) from invites where student_id='30000000-0000-0000-0000-000000000001' and not revoked) as active_keys_expect_1;
select public.peek_invite(:'code1')->>'ok' as old_key_expect_false, public.peek_invite(:'code2')->>'student_name' as peek_name, public.peek_invite(:'code2')->>'known_birth' as known_birth;
-- новый аккаунт регистрируется БЕЗ фио
insert into auth.users (id) values ('40000000-0000-0000-0000-000000000001') on conflict do nothing;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select public.redeem_invite(:'code2', '', null, null, null, 'ru', '{}') as redeem_expect_ok;
select full_name as profile_name, birth_date from profiles where id='40000000-0000-0000-0000-000000000001';
select profile_id = '40000000-0000-0000-0000-000000000001' as student_linked from students where id='30000000-0000-0000-0000-000000000001';
select public.peek_invite(:'code2')->>'ok' as used_key_expect_false;
-- родитель должен вводить своё ФИО
insert into auth.users (id) values ('40000000-0000-0000-0000-000000000002') on conflict do nothing;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.create_invite('parent', null, '30000000-0000-0000-0000-000000000001')->>'code' as pcode \gset
select pg_temp.as_user('40000000-0000-0000-0000-000000000002');
select public.redeem_invite(:'pcode', '', null, null, '+996700000000', 'ru', '{"relation":"mother"}') as parent_no_name_expect_fields;
select public.redeem_invite(:'pcode', 'Тестова Мама', null, null, '+996700000000', 'ru', '{"relation":"mother"}') as parent_ok;
