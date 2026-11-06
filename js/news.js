// Новости школы: у каждой школы своя лента, школы друг друга не видят. Новости платформы SABAK+ видны всем.
import * as S from './store.js';
import * as V from './v8data.js';
import { esc, ui, head, toast, dtFmt } from './common.js';
import { dmy, todayISO } from './calc.js';

const rerender = () => window.__render && window.__render();
const cache = {};
const fresh = () => Object.keys(cache).forEach(x => delete cache[x]);
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
const ERR = { short: 'Заголовок и текст — не короче 3 символов', forbidden: 'Нет доступа', teacher_class_only: 'Учитель публикует новости только для своих классов — выберите класс', audience: 'Неверная аудитория', rate: 'Слишком много новостей за сутки', kind: 'Неверный тип', not_deployed: 'Сервер ещё не обновлён: выполните schema_v6.sql в Supabase', network: 'Нет связи' };
const need = r => { if (!r || !r.ok) throw new Error(ERR[r && r.error] || (r && r.error) || 'Ошибка'); return r; };
const X = () => (ui.news = ui.news || { open: false, filter: 'all' });
const KIND = { news: ['📰', 'Новость'], alert: ['⚠️', 'Важно'], event: ['📅', 'Событие'], holiday: ['🎉', 'Праздник'], platform: ['✨', 'SABAK+'] };
const AUD = { all: 'Все', staff: 'Педагоги', students: 'Ученики', parents: 'Родители' };
const audName = a => AUD[a] || (a.startsWith('class:') ? 'Класс' : a);
const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : dtFmt(iso); };

export const unread = () => { const r = cache.list; return r && r.rows ? r.rows.filter(n => !n.read).length : 0; };
export function page() {
  const R = load('list', async () => need(await V.call('news_list')));
  const u = S.state().session, x = X(), staffRole = ['teacher', 'admin'].includes(u.role);
  if (R === 'loading') return head('Новости', u.school || '', 'Только для вашей школы') + '<div class="card"><p class="muted" role="status">Загружаем…</p></div>';
  if (R.err) return head('Новости', '', '') + `<div class="card"><p>⚠️ ${esc(R.err)}</p></div>`;
  const rows = R.rows.filter(n => x.filter === 'all' || (x.filter === 'unread' ? !n.read : n.kind === x.filter || (x.filter === 'event' && n.event_date)));
  const unseen = R.rows.filter(n => !n.read);
  if (unseen.length && !x.marking) { x.marking = true; setTimeout(() => V.call('news_read', {}).then(() => { x.marking = false; }), 2500); }   // «прочитано» ставим мягко, через пару секунд
  const flt = [['all', 'Все'], ['unread', `Новые${unseen.length ? ' · ' + unseen.length : ''}`], ['event', 'События'], ['alert', 'Важное']].map(([k, n]) => `<button class="tag ${x.filter === k ? 'on' : ''}" data-act="news-filter" data-v="${k}">${n}</button>`).join('');
  return `${head('Новости', u.school || '', 'Видны только вашей школе')}
  <div class="ctl">${flt}${R.can_post ? `<button class="btn blue" data-act="news-compose">${x.open ? 'Закрыть' : '+ Новость'}</button>` : ''}</div>
  ${x.open && R.can_post ? composer(u) : ''}
  <div class="newsl">${rows.map((n, i) => card(n, R.can_post, i)).join('') || '<div class="card"><p class="muted">Пока нет новостей.</p></div>'}</div>`;
}
function card(n, staff, i) {
  const [ic, nm] = KIND[n.platform ? 'platform' : n.kind] || KIND.news;
  const ev = n.event_date ? `<span class="evd"><b>${new Date(n.event_date).getUTCDate()}</b><small>${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][new Date(n.event_date).getUTCMonth()]}</small></span>` : `<span class="nic" aria-hidden="true">${ic}</span>`;
  return `<article class="ncard ${n.kind} ${n.platform ? 'plat' : ''} ${n.read ? '' : 'new'}" style="animation-delay:${Math.min(i, 8) * 40}ms">${ev}
    <div class="nb"><div class="nt"><span class="nk">${nm}</span>${n.pinned ? '<span class="pin">📌 закреплено</span>' : ''}${n.platform ? '' : `<span class="na">${esc(audName(n.audience))}</span>`}${n.read ? '' : '<span class="nnew">новое</span>'}</div>
    <h3>${esc(n.title)}</h3><p>${esc(n.body).replace(/\n/g, '<br>')}</p>
    <small class="muted">${esc(n.author || '')} · ${ago(n.at)}${n.event_date ? ` · ${dmy(n.event_date)}` : ''}${n.reads != null ? ` · прочитали: ${n.reads}` : ''}</small></div>
    ${staff && !n.platform && (n.mine || S.state().session.role === 'admin') ? `<div class="nact">${S.state().session.role === 'admin' ? `<button class="ibtn sm" data-act="news-pin" data-id="${n.id}" data-v="${n.pinned ? 0 : 1}">${n.pinned ? 'Открепить' : 'Закрепить'}</button>` : ''}<button class="ibtn sm" data-act="news-del" data-id="${n.id}">Удалить</button></div>` : ''}</article>`;
}
function composer(u) {
  const teacher = u.role === 'teacher', cls = S.state().classes.filter(c => !teacher || (u.classes || []).includes(c.name));
  const aud = teacher ? '' : Object.entries(AUD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  return `<section class="card compose"><h3>Новая новость</h3><form data-form="news-post">
    <label class="fld"><span>Заголовок</span><input name="title" maxlength="90" required minlength="3"></label>
    <label class="fld"><span>Текст</span><textarea name="body" rows="4" maxlength="1500" required minlength="3"></textarea></label>
    <div class="inline"><label class="fld"><span>Тип</span><select name="kind"><option value="news">📰 Новость</option><option value="event">📅 Событие</option><option value="alert">⚠️ Важно</option><option value="holiday">🎉 Праздник</option></select></label>
    <label class="fld"><span>Кому</span><select name="aud">${aud}${cls.map(c => `<option value="class:${c.id}">Класс ${esc(c.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>Дата события</span><input type="date" name="event" min="${todayISO()}"></label>
    ${teacher ? '' : '<label class="chk"><input type="checkbox" name="pin"> закрепить</label>'}</div>
    <p class="muted">${teacher ? 'Учитель пишет только своим классам.' : 'Новость увидят только в вашей школе.'}</p>
    <button class="btn blue" type="submit">Опубликовать</button></form></section>`;
}
export function superPage() {
  const x = X();
  return `${head('Новости сети', 'SABAK+', 'Видны во всех школах платформы')}
  <div class="ctl"><a class="btn ghost" href="#/super">← Центр управления</a></div>
  <section class="card compose"><h3>Объявление платформы</h3><p class="muted">Появится в ленте новостей каждой школы с пометкой «SABAK+». Школьные новости остаются закрытыми — вы пишете только в общий канал.</p>
  <form data-form="news-super"><label class="fld"><span>Заголовок</span><input name="title" maxlength="90" required minlength="3"></label><label class="fld"><span>Текст</span><textarea name="body" rows="4" maxlength="1500" required minlength="3"></textarea></label>
  <label class="chk"><input type="checkbox" name="pin"> закрепить</label> <button class="btn blue" type="submit">Опубликовать для всех школ</button></form></section>`;
}
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
export async function act(a, el) {
  const x = X();
  switch (a) {
    case 'news-filter': x.filter = el.dataset.v; rerender(); return true;
    case 'news-compose': x.open = !x.open; rerender(); return true;
    case 'news-pin': await guard(async () => { need(await V.call('news_set', { p_id: el.dataset.id, p_pinned: el.dataset.v === '1' })); fresh(); rerender(); }); return true;
    case 'news-del': await guard(async () => { if (!confirm('Удалить новость?')) return; need(await V.call('news_set', { p_id: el.dataset.id, p_delete: true })); fresh(); rerender(); }); return true;
  }
  return false;
}
export async function submit(f, fd) {
  const k = f.dataset.form, v = n => String(fd.get(n) || '').trim();
  if (k === 'news-post') { await guard(async () => { need(await V.call('news_post', { p_title: v('title'), p_body: v('body'), p_kind: v('kind'), p_audience: v('aud'), p_pinned: !!fd.get('pin'), p_event: v('event') || null, p_days: null })); fresh(); X().open = false; toast('Опубликовано', 'ok'); rerender(); }); return true; }
  if (k === 'news-super') { await guard(async () => { need(await V.call('super_news_post', { p_title: v('title'), p_body: v('body'), p_pinned: !!fd.get('pin') })); toast('Опубликовано во всех школах', 'ok'); f.reset(); }); return true; }
  return false;
}
export const refresh = fresh;
