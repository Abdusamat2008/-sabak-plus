-- Сценарные тесты schema_v7 (после tests_v6 на той же базе; в Supabase НЕ выполнять)
\set ON_ERROR_STOP 0
\pset pager off
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
\echo ===== P1. опросы
select public.th_post('Какой урок убрать из пятницы?',false,null,null,array['Физкультура','Химия'])->>'ok' as poll_created;
select public.th_post('Один вариант',false,null,null,array['Только один'])->>'error' as one_option_expect_poll;
select public.th_post('Мат',false,null,null,array['да','ты дурак'])->>'error' as bad_word_expect_blocked_word;
select public.th_post('Шесть',false,null,null,array['1','2','3','4','5','6'])->>'error' as six_expect_poll;
select (select r->'poll' from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%') as poll_before;
select public.th_vote((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'), 1)->'poll' as after_vote_mine_1;
select public.th_vote((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'), 0)->'poll'->>'mine' as revote_stays_1;
select public.th_vote((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'), 7)->>'error' as bad_opt_expect_poll;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_vote((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'), 1)->'poll'->'counts' as counts_expect_0_2;
\echo ===== R1. реакции, репосты, правка
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.th_react('p',(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'),'🔥')->'react' as react_fire;
select public.th_react('p',(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'),'😂')->'react' as switched_to_laugh;
select public.th_react('p',(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'),'🤡')->>'error' as bad_emoji_expect_emoji;
select public.th_react('p',(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'),'😂')->'react' as toggled_off;
select public.th_post('',false,null,null,null,(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'))->>'ok' as plain_repost;
select public.th_post('Согласен!',false,null,null,null,(select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%'))->>'ok' as quote_repost;
select public.th_post('',false)->>'error' as empty_expect_body;
select r->'repost'->>'body' as reposted_body, r->>'reposts' as repost_count from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' like 'Какой урок%' or r->>'body' = 'Согласен!';
select public.th_edit((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' = 'Согласен!'),'Полностью согласен')->>'ok' as edit_ok;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.th_edit((select (r->>'id')::uuid from jsonb_array_elements(public.th_feed('new')->'rows') r where r->>'body' = 'Полностью согласен'),'взлом')->>'error' as edit_other_expect_forbidden;
\echo ===== P2. школа Б не голосует
reset role;
select id as pid from thread_posts where poll is not null limit 1 \gset
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.th_vote(:'pid', 0)->>'error' as other_school_expect_no_access_or_not_found;
