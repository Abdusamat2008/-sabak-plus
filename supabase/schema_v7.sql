-- ============================================================================
-- SABAK+ · schema_v7.sql (версия 0.9, «Үн 2.0») — запускать ПОСЛЕ schema_v6. Можно запускать повторно.
--   Опросы в «Үн»: до 5 вариантов, один голос на человека, голоса анонимны.
--   Реакции-эмодзи (как в Telegram), репосты и цитаты, правка своего поста в течение 15 минут.
-- ============================================================================
alter table public.thread_posts add column if not exists poll jsonb;
create table if not exists public.thread_votes (
  post_id uuid not null references public.thread_posts(id) on delete cascade,
  user_id uuid not null,
  opt int not null check (opt between 0 and 4),
  primary key (post_id, user_id)
);
alter table public.thread_votes enable row level security;

alter table public.thread_posts add column if not exists repost_of uuid references public.thread_posts(id) on delete set null;
alter table public.thread_posts add column if not exists edited_at timestamptz;
alter table public.thread_likes add column if not exists emoji text not null default '❤️';

create or replace function public._th_react(p_kind text, p_ref uuid, p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('counts', coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*) n from thread_likes where kind = p_kind and ref_id = p_ref group by emoji) q), '{}'::jsonb),
    'mine', (select emoji from thread_likes where kind = p_kind and ref_id = p_ref and user_id = p_uid)) $$;
revoke execute on function public._th_react(text, uuid, uuid) from public, anon, authenticated;

create or replace function public._th_repost(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select case when p.id is null or p.deleted or p.hidden then jsonb_build_object('gone', true)
    else jsonb_build_object('id', p.id, 'body', left(p.body, 280), 'media', p.media_path, 'media_kind', p.media_kind, 'at', p.created_at, 'author', _th_card(p.author_id, p.anon, p.alias, p.official)) end
  from (select 1) d left join thread_posts p on p.id = p_id $$;
revoke execute on function public._th_repost(uuid) from public, anon, authenticated;

create or replace function public._th_poll(p_post uuid, p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('opts', p.poll,
    'counts', (select jsonb_agg(coalesce((select count(*) from thread_votes v where v.post_id = p.id and v.opt = i), 0) order by i) from generate_series(0, jsonb_array_length(p.poll) - 1) i),
    'mine', (select opt from thread_votes where post_id = p.id and user_id = p_uid))
  from thread_posts p where p.id = p_post and p.poll is not null $$;
revoke execute on function public._th_poll(uuid, uuid) from public, anon, authenticated;

drop function if exists public.th_post(text, boolean, text, text);
drop function if exists public.th_post(text, boolean, text, text, text[]);
create or replace function public.th_post(p_body text, p_anon boolean default false, p_media text default null, p_kind text default null, p_poll text[] default null, p_repost uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); pid uuid := gen_random_uuid(); r text := my_role(); e text; off boolean := r in ('director','deputy'); pj jsonb; o text; n int := 0; root uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  p_body := coalesce(trim(p_body), '');
  if length(p_body) > 600 or (length(p_body) < 1 and p_repost is null) then return _err('body'); end if;
  if p_repost is not null then
    select coalesce(repost_of, id) into root from thread_posts where id = p_repost and school_id = sc and not deleted and not hidden;
    if root is null then return _err('not_found'); end if;
  end if;
  if off then p_anon := false; end if;
  if not p_anon and not off and not exists (select 1 from thread_profiles where user_id = auth.uid()) then return _err('need_profile'); end if;
  if length(p_body) > 0 then e := _th_clean(p_body, sc); if e is not null then return _err(e); end if; end if;
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
  insert into thread_posts (id, school_id, author_id, anon, official, alias, body, media_path, media_kind, poll, repost_of)
  values (pid, sc, auth.uid(), p_anon, off, case when p_anon then _th_alias(auth.uid(), pid) end, p_body, p_media, case when p_media is not null then p_kind end, pj, root);
  return jsonb_build_object('ok', true, 'id', pid);
end $$;
revoke execute on function public.th_post(text, boolean, text, text, text[], uuid) from public, anon;
grant execute on function public.th_post(text, boolean, text, text, text[], uuid) to authenticated;

create or replace function public.th_edit(p_id uuid, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); e text; p thread_posts;
begin
  if not (c->>'ok')::boolean then return c; end if;
  select * into p from thread_posts where id = p_id and school_id = my_school() and not deleted;
  if p.id is null then return _err('not_found'); end if;
  if p.author_id <> auth.uid() then return _err('forbidden'); end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if p.created_at < now() - interval '15 minutes' then return _err('edit_late'); end if;
  p_body := coalesce(trim(p_body), '');
  if length(p_body) > 600 or (length(p_body) < 1 and p.repost_of is null) then return _err('body'); end if;
  if length(p_body) > 0 then e := _th_clean(p_body, p.school_id); if e is not null then return _err(e); end if; end if;
  update thread_posts set body = p_body, edited_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.th_edit(uuid, text) from public, anon;
grant execute on function public.th_edit(uuid, text) to authenticated;

create or replace function public.th_react(p_kind text, p_id uuid, p_emoji text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); cur text; n int;
begin
  if not (c->>'ok')::boolean then return c; end if;
  if _th_banned(auth.uid()) is not null then return _err('banned'); end if;
  if p_emoji not in ('👍','❤️','🔥','😂','😮','😢','🎉','👏') then return _err('emoji'); end if;
  if p_kind = 'p' then
    if not exists (select 1 from thread_posts where id = p_id and school_id = sc and not deleted) then return _err('not_found'); end if;
  elsif p_kind = 'c' then
    if not exists (select 1 from thread_comments where id = p_id and school_id = sc and not deleted) then return _err('not_found'); end if;
  else return _err('kind'); end if;
  select emoji into cur from thread_likes where user_id = auth.uid() and kind = p_kind and ref_id = p_id;
  if cur = p_emoji then delete from thread_likes where user_id = auth.uid() and kind = p_kind and ref_id = p_id;
  elsif cur is null then insert into thread_likes (user_id, kind, ref_id, emoji) values (auth.uid(), p_kind, p_id, p_emoji);
  else update thread_likes set emoji = p_emoji where user_id = auth.uid() and kind = p_kind and ref_id = p_id; end if;
  select count(*) into n from thread_likes where kind = p_kind and ref_id = p_id;
  if p_kind = 'p' then update thread_posts set likes_n = n where id = p_id; else update thread_comments set likes_n = n where id = p_id; end if;
  return jsonb_build_object('ok', true, 'n', n, 'react', _th_react(p_kind, p_id, auth.uid()), 'liked', exists (select 1 from thread_likes where user_id = auth.uid() and kind = p_kind and ref_id = p_id));
end $$;
revoke execute on function public.th_react(text, uuid, text) from public, anon;
grant execute on function public.th_react(text, uuid, text) to authenticated;

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
        'react', _th_react('p', p.id, uid), 'repost', case when p.repost_of is null then null else _th_repost(p.repost_of) end,
        'reposts', (select count(*) from thread_posts q where q.repost_of = p.id and not q.deleted), 'edited', p.edited_at is not null,
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

create or replace function public.th_comments(p_post uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb := _th_ctx(); sc uuid := my_school(); m boolean := is_admin(); uid uuid := auth.uid(); opid uuid;
begin
  if not (c->>'ok')::boolean then return c; end if;
  select author_id into opid from thread_posts where id = p_post and school_id = sc and not deleted;
  if opid is null then return _err('not_found'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(x order by x->>'at') from (
    select jsonb_build_object('id', k.id, 'parent', k.parent_id, 'body', k.body, 'at', k.created_at, 'author', _th_card(k.author_id, k.anon, k.alias, k.official),
      'op', k.author_id = opid, 'likes', k.likes_n, 'liked', exists (select 1 from thread_likes l where l.user_id = uid and l.kind = 'c' and l.ref_id = k.id),
      'react', _th_react('c', k.id, uid),
      'mine', k.author_id = uid, 'hidden', k.hidden) as x
    from thread_comments k where k.post_id = p_post and not k.deleted and (m or not k.hidden or k.author_id = uid) order by k.created_at limit 200) t), '[]'::jsonb));
end $$;
revoke execute on function public.th_comments(uuid) from public, anon;
grant execute on function public.th_comments(uuid) to authenticated;
