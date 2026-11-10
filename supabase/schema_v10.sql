-- SABAK+ v0.13: регистрация ученика по ключу без ввода ФИО. Выполнять после schema_v9.sql. Можно запускать повторно.
-- Ключ ученика хранится в таблице invites вместе со ссылкой на запись ученика (ФИО, класс), пока им не воспользуются.
--  * peek_invite показывает, для кого выдан ключ (ФИО ученика), чтобы он подтвердил «это я»;
--  * redeem_invite для ученика берёт ФИО, дату рождения и пол из записи школы;
--  * create_invite: у ученика один действующий ключ (новый отзывает старый), срок по умолчанию 180 дней.

create or replace function public.peek_invite(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.invites%rowtype; sn text; cn text; stu public.students%rowtype;
begin
  select * into i from public.invites where code = upper(trim(p_code));
  if not found or i.revoked or i.expires_at < now() or i.uses >= i.max_uses then return jsonb_build_object('ok', false); end if;
  select name into sn from public.schools where id = i.school_id;
  select name into cn from public.classes where id = i.class_id;
  if i.student_id is not null then select * into stu from public.students where id = i.student_id; end if;
  return jsonb_build_object('ok', true, 'role', i.role, 'school', sn, 'class', cn, 'need_phone', i.bind_tail is not null,
    'student_name', stu.full_name, 'known_birth', stu.birth_date is not null);
end $$;
grant execute on function public.peek_invite(text) to anon, authenticated;

create or replace function public.redeem_invite(
  p_code text, p_full_name text, p_birth date, p_gender text, p_phone text, p_lang text, p_extra jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.invites%rowtype; st text; digits text; stu public.students%rowtype; v_name text; v_birth date := p_birth; v_gender text := p_gender;
begin
  if auth.uid() is null then return public._err('auth'); end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return public._err('already'); end if;
  if public._too_many() then return public._err('too_many'); end if;
  select * into i from public.invites where code = upper(trim(p_code)) for update;
  if not found or i.revoked then return public._fail('bad_code'); end if;
  if i.expires_at < now() then return public._fail('expired'); end if;
  if i.uses >= i.max_uses then return public._fail('used'); end if;
  if i.bind_tail is not null then
    digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    if right(digits, length(i.bind_tail)) <> i.bind_tail then return public._fail('phone_mismatch'); end if;
  end if;
  if i.role in ('student','parent') then
    select * into stu from public.students where id = i.student_id;
    if not found then return public._fail('bad_code'); end if;
    if i.role = 'student' and stu.profile_id is not null then return public._fail('used'); end if;
  end if;
  -- ученик: ФИО (и дата рождения/пол, если школа их внесла) берутся из записи, на которую выдан ключ; вводить их не нужно
  if i.role = 'student' then
    v_name := stu.full_name; v_birth := coalesce(stu.birth_date, p_birth); v_gender := coalesce(stu.gender, p_gender);
  else
    v_name := trim(coalesce(p_full_name, ''));
    if v_name = '' then return public._err('fields'); end if;
  end if;
  -- сотрудники попадают в статус «ожидает подтверждения»: директор/завуч подтверждает вручную
  st := case when i.role in ('deputy','teacher') then 'pending' else 'active' end;
  insert into public.profiles (id, school_id, role, status, full_name, birth_date, gender, phone, lang, extra, invited_by)
  values (auth.uid(), i.school_id, i.role, st, v_name, v_birth, v_gender, p_phone, coalesce(p_lang, 'ru'), coalesce(p_extra, '{}'), i.created_by);
  if i.role = 'student' then
    update public.students set profile_id = auth.uid() where id = i.student_id;
  elsif i.role = 'parent' then
    insert into public.parent_students (parent_id, student_id, school_id, relation)
    values (auth.uid(), i.student_id, i.school_id, coalesce(p_extra ->> 'relation', 'parent'));
  end if;
  update public.invites set uses = uses + 1 where id = i.id;
  insert into public.invite_attempts (user_id, ok) values (auth.uid(), true);
  insert into public.audit_log (school_id, actor, action, details)
  values (i.school_id, auth.uid(), 'invite.redeemed', jsonb_build_object('role', i.role, 'by_invite', i.id, 'invited_by', i.created_by));
  if i.role = 'student' then
    update public.students set birth_date = coalesce(birth_date, v_birth), gender = coalesce(gender, v_gender) where id = i.student_id;
  end if;
  return jsonb_build_object('ok', true, 'role', i.role, 'status', st, 'school_id', i.school_id);
end $$;

create or replace function public.create_invite(
  p_role text, p_class uuid default null, p_student uuid default null, p_bind_tail text default null,
  p_days int default null, p_max int default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := public.my_role(); sc uuid := public.my_school(); ok boolean := false; v_code text; d int; m int; cid uuid := p_class;
begin
  if sc is null then return public._err('forbidden'); end if;
  if p_role not in ('deputy','teacher','parent','student') then return public._err('bad_role'); end if;
  if p_bind_tail is not null and p_bind_tail !~ '^[0-9]{3,6}$' then return public._err('bad_tail'); end if;
  if p_role = 'deputy' then ok := (me = 'director');
  elsif p_role = 'teacher' then ok := (me in ('director','deputy'));
  else
    if p_student is null or public.student_school(p_student) <> sc then return public._err('bad_student'); end if;
    cid := public.student_class(p_student);
    ok := (me in ('director','deputy')) or (me = 'teacher' and public.is_homeroom_of(p_student));
  end if;
  if not ok then return public._err('forbidden'); end if;
  d := coalesce(p_days, case when p_role in ('deputy','teacher') then 3 when p_role = 'student' then 180 else 14 end);
  m := coalesce(p_max,  case when p_role = 'parent' then 2 else 1 end);
  if p_role = 'student' then   -- у ученика одновременно один действующий ключ: новый отзывает прежний неиспользованный
    update public.invites set revoked = true where student_id = p_student and role = 'student' and not revoked and uses < max_uses;
  end if;
  loop
    v_code := public._rand_code(4) || '-' || public._rand_code(4) || '-' || public._rand_code(4);
    exit when not exists (select 1 from public.invites i2 where i2.code = v_code);
  end loop;
  insert into public.invites (school_id, code, role, class_id, student_id, bind_tail, note, created_by, expires_at, max_uses)
  values (sc, v_code, p_role, cid, p_student, p_bind_tail, p_note, auth.uid(), now() + make_interval(days => d), m);
  perform public.log_audit('invite.created', jsonb_build_object('role', p_role, 'student', p_student, 'class', cid));
  return jsonb_build_object('ok', true, 'code', v_code, 'expires_in_days', d, 'student_name', (select full_name from public.students where id = p_student));
end $$;
