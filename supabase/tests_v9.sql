-- Проверка v9: новые правила видят ровно тех же учеников, что и прежняя функция can_see_student; sync_stamp растёт при изменениях.
\set ON_ERROR_STOP off
create temp table res(uid uuid, role text, tbl text, old_cnt bigint, new_cnt bigint);
do $$ declare u record; o bigint; n bigint; t text;
begin
  for u in select id, role from profiles where status='active' and school_id is not null loop
    perform set_config('request.jwt.claim.sub', u.id::text, false);
    foreach t in array array['grades','attendance','students'] loop
      -- старое правило считаем напрямую (суперпользователь: RLS не мешает)
      execute case t when 'students' then 'select count(*) from students x where can_see_student(x.id)'
        else format('select count(*) from %I x where x.school_id = my_school() and can_see_student(x.student_id)', t) end into o;
      set local role authenticated;
      execute format('select count(*) from %I', t) into n;
      reset role;
      insert into res values (u.id, u.role, t, o, n);
    end loop;
  end loop;
end $$;
select role, tbl, old_cnt, new_cnt, case when old_cnt = new_cnt then 'OK' else 'РАЗНИЦА' end as verdict from res order by role, tbl;
\echo ===== sync_stamp растёт
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select (public.sync_stamp()->>'s')::bigint as before_stamp \gset
insert into attendance(student_id, school_id, date, status) select id, school_id, current_date - 100, 'p' from students where school_id = (select school_id from profiles where id='00000000-0000-0000-0000-000000000001') limit 50 on conflict do nothing;
select (public.sync_stamp()->>'s')::bigint - :before_stamp as bumps_expect_1_for_bulk_insert;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select (public.sync_stamp()->>'s')::bigint <> :before_stamp as other_school_stamp_independent_expect_true;
