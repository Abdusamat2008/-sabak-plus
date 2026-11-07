-- ============================================================================
-- SABAK+ · schema_v7.sql (версия 0.9, «Үн 2.0») — запускать ПОСЛЕ schema_v6. Можно запускать повторно.
--   Опросы в «Үн»: до 5 вариантов, один голос на человека, голоса анонимны (кто как голосовал — не хранится наружу).
-- ============================================================================
alter table public.thread_posts add column if not exists poll jsonb;
create table if not exists public.thread_votes (
  post_id uuid not null references public.thread_posts(id) on delete cascade,
  user_id uuid not null,
  opt int not null check (opt between 0 and 4),
  primary key (post_id, user_id)
);
alter table public.thread_votes enable row level security;

create or replace function public._th_poll(p_post uuid, p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('opts', p.poll,
    'counts', (select jsonb_agg(coalesce((select count(*) from thread_votes v where v.post_id = p.id and v.opt = i), 0) order by i) from generate_series(0, jsonb_array_length(p.poll) - 1) i),
    'mine', (select opt from thread_votes where post_id = p.id and user_id = p_uid))
  from thread_posts p where p.id = p_post and p.poll is not null $$;
revoke execute on function public._th_poll(uuid, uuid) from public, anon, authenticated;

drop function if exists public.th_post(text, boolean, text, text);
create or replace function public.th_post(p_body text, p_anon boolean default false, p_media text default null, p_kind text default null, p_poll text[] default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); pid uuid := gen_random_uuid(); r text := my_role(); e text; off boolean := r in ('director','deputy'); pj jsonb; o text; n int := 0;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if coalesce(length(trim(p_body)), 0) < 1 or length(p_body) > 600 then return _err('body'); end if;
  if off then p_anon := false; end if;
  if not p_anon and not off and not exists (select 1 from thread_profiles where user_id = auth.uid()) then return _err('need_profile'); end if;
  e := _th_clean(p_body, sc); if e is not null then return _err(e); end if;
  if (select count(*) from thread_posts where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 8 then return _err('rate'); end if;
  if p_media is not null then
    if p_media not like sc::text || '/p/' || auth.uid()::text || '%' or p_kind not in ('image','video') then return _err('media'); end if;
  end if;
  if p_poll is not null then
    foreach o in array p_poll loop
      o := trim(coalesce(o, '')); n := n + 1;
      if length(o) < 1 or length(o) > 40 then return _err('poll'); end if;
      e := _th_clean(o, sc); if e is not null then return _err(e); end if;
    end loop;
    if n < 2 or n > 5 then return _err('poll'); end if;
    select jsonb_agg(trim(x)) into pj from unnest(p_poll) x;
  end if;
  insert into thread_posts (id, school_id, author_id, anon, official, alias, body, media_path, media_kind, poll)
  values (pid, sc, auth.uid(), p_anon, off, case when p_anon then _th_alias(auth.uid(), pid) end, trim(p_body), p_media, case when p_media is not null then p_kind end, pj);
  return jsonb_build_object('ok', true, 'id', pid);
end $$;
revoke execute on function public.th_post(text, boolean, text, text, text[]) from public, anon;
grant execute on function public.th_post(text, boolean, text, text, text[]) to authenticated;

create or replace function public.th_vote(p_post uuid, p_opt int) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); pl jsonb;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  select poll into pl from thread_posts where id = p_post and school_id = sc and not deleted and not hidden;
  if pl is null then return _err('not_found'); end if;
  if p_opt is null or p_opt < 0 or p_opt >= jsonb_array_length(pl) then return _err('poll'); end if;
  insert into thread_votes (post_id, user_id, opt) values (p_post, auth.uid(), p_opt) on conflict do nothing;
  return jsonb_build_object('ok', true, 'poll', _th_poll(p_post, auth.uid()));
end $$;
revoke execute on function public.th_vote(uuid, int) from public, anon;
grant execute on function public.th_vote(uuid, int) to authenticated;

create or replace function public.th_feed(p_sort text default 'new', p_before timestamptz default null, p_limit int default 30, p_username text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); m boolean := is_admin(); uid uuid := auth.uid(); target uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if p_username is not null then select user_id into target from thread_profiles where lower(username) = lower(p_username) and school_id = sc; end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', p.id, 'body', case when p.deleted then '' else p.body end, 'poll', case when p.poll is null then null else _th_poll(p.id, uid) end,
        'media', p.media_path, 'media_kind', p.media_kind, 'at', p.created_at,
        'author', _th_card(p.author_id, p.anon, p.alias, p.official), 'likes', p.likes_n, 'comments', p.comments_n,
        'liked', exists (select 1 from thread_likes l where l.user_id = uid and l.kind = 'p' and l.ref_id = p.id),
        'mine', p.author_id = uid, 'hidden', p.hidden, 'reports', case when m then p.reports_n end) as x
    from thread_posts p
    where p.school_id = sc and not p.deleted and (m or not p.hidden or p.author_id = uid)
      and (p_username is null or (p.author_id = target and not p.anon and not p.official))
      and (p_before is null or p.created_at < p_before)
    order by case when p_sort = 'top' then (p.likes_n * 2 + p.comments_n * 3 + case when p.created_at > now() - interval '2 days' then 6 else 0 end) end desc nulls last, p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 50))) t), '[]'::jsonb));
end $$;
revoke execute on function public.th_feed(text, timestamptz, int, text) from public, anon;
grant execute on function public.th_feed(text, timestamptz, int, text) to authenticated;
