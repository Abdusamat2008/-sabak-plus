// Новости школы: у каждой школы своя лента, школы друг друга не видят. Новости платформы SABAK+ видны всем.
import * as S from './store.js';
import * as V from './v8data.js';
import { esc, ui, head, toast, dtFmt } from './common.js';
import { dmy, todayISO } from './calc.js';
import * as E from './editor.js';

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
ERR.long = 'Текст слишком длинный (до 20 000 знаков разметки)'; ERR.fmt = 'Неверный формат текста'; ERR.not_found = 'Новость уже удалена';
const need = r => { if (!r || !r.ok) throw new Error(ERR[r && r.error] || (r && r.error) || 'Ошибка'); return r; };
const X = () => (ui.news = ui.news || { open: false, filter: 'all', src: 'all', read: null, edit: null, draft: null });
const ROLE = { director: 'Директор', deputy: 'Завуч', teacher: 'Учитель', admin: 'Администрация', super: 'SABAK+', superadmin: 'SABAK+' };
const roleOf = n => n.platform ? 'SABAK+' : ROLE[n.author_role] || 'Школа';
const srcKey = n => n.platform ? 'platform' : (n.author_role === 'admin' ? 'director' : n.author_role) || 'director';
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
  const rows = R.rows.filter(n => (x.src === 'all' || srcKey(n) === x.src) && (x.filter === 'all' || (x.filter === 'unread' ? !n.read : n.kind === x.filter || (x.filter === 'event' && n.event_date))));
  const srcs = ['platform', 'director', 'deputy', 'teacher'].filter(k => R.rows.some(n => srcKey(n) === k));
  const unseen = R.rows.filter(n => !n.read);
  if (unseen.length && !x.marking) { x.marking = true; setTimeout(() => V.call('news_read', {}).then(() => { x.marking = false; }), 2500); }   // «прочитано» ставим мягко, через пару секунд
  const flt = [['all', 'Все'], ['unread', `Новые${unseen.length ? ' · ' + unseen.length : ''}`], ['event', 'События'], ['alert', 'Важное']].map(([k, n]) => `<button class="tag ${x.filter === k ? 'on' : ''}" data-act="news-filter" data-v="${k}">${n}</button>`).join('');
  const SRC = { all: 'Все источники', platform: 'SABAK+', director: 'Директор', deputy: 'Завуч', teacher: 'Учителя' };
  const srcBar = srcs.length > 1 ? `<div class="ctl src-bar" role="group" aria-label="Источник новостей">${['all', ...srcs].map(k => `<button class="tag ${x.src === k ? 'on' : ''}" data-act="news-src" data-v="${k}">${SRC[k]}</button>`).join('')}</div>` : '';
  const target = x.read && R.rows.find(n => n.id === x.read);
  return `${head('Новости', u.school || '', 'Новости платформы, директора, завуча и учителей вашей школы')}
  <div class="ctl">${flt}${R.can_post ? `<button class="btn blue" data-act="news-compose">${x.open ? 'Закрыть' : '+ Новость'}</button>` : ''}</div>${srcBar}
  ${(x.open || x.edit) && R.can_post ? composer(u, R) : ''}
  <div class="newsl">${rows.map((n, i) => card(n, R.can_post, i)).join('') || '<div class="card"><p class="muted">Пока нет новостей.</p></div>'}</div>${target ? reader(target, R) : ''}`;
}
function card(n, staff, i) {
  const [ic, nm] = KIND[n.platform ? 'platform' : n.kind] || KIND.news;
  const ev = n.event_date ? `<span class="evd"><b>${new Date(n.event_date).getUTCDate()}</b><small>${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][new Date(n.event_date).getUTCMonth()]}</small></span>` : `<span class="nic" aria-hidden="true">${ic}</span>`;
  return `<article class="ncard ${n.kind} ${n.platform ? 'plat' : ''} ${n.read ? '' : 'new'}" style="animation-delay:${Math.min(i, 8) * 40}ms">${ev}
    <div class="nb"><div class="nt"><span class="nk">${nm}</span>${n.pinned ? '<span class="pin">📌 закреплено</span>' : ''}${n.platform ? '' : `<span class="na">${esc(audName(n.audience))}</span>`}${n.read ? '' : '<span class="nnew">новое</span>'}</div>
    <h3><button class="nlink" data-act="news-open" data-id="${n.id}">${esc(n.title)}</button></h3><p class="npv">${esc(E.preview(n.body, n.fmt))}</p>
    <div class="nmore"><button class="linkb" data-act="news-open" data-id="${n.id}">Читать полностью</button></div>
    <small class="muted"><span class="rolechip r-${srcKey(n)}">${esc(roleOf(n))}</span> ${esc(n.author || '')} · ${ago(n.at)}${n.event_date ? ` · ${dmy(n.event_date)}` : ''}${n.reads != null ? ` · прочитали: ${n.reads}` : ''}</small></div>
    ${staff && !n.platform && (n.mine || S.state().session.role === 'admin') ? `<div class="nact">${S.state().session.role === 'admin' ? `<button class="ibtn sm" data-act="news-pin" data-id="${n.id}" data-v="${n.pinned ? 0 : 1}">${n.pinned ? 'Открепить' : 'Закрепить'}</button>` : ''}<button class="ibtn sm" data-act="news-del" data-id="${n.id}">Удалить</button></div>` : ''}</article>`;
}
const D0 = () => ({ title: '', html: '', kind: 'news', aud: 'all', event: '', pin: false });
function reader(n, R) {
  const [ic, nm] = KIND[n.platform ? 'platform' : n.kind] || KIND.news, u = S.state().session;
  const canEdit = n.platform ? u.role === 'super' : (u.role === 'admin' || n.mine);
  return `<div class="modal-bg" data-act="news-close"></div><article class="modal news-read" role="dialog" aria-modal="true" aria-label="${esc(n.title)}"><button class="ibtn close" data-act="news-close" aria-label="Закрыть">✕</button>
  <div class="nt"><span class="nk">${ic} ${nm}</span>${n.pinned ? '<span class="pin">📌 закреплено</span>' : ''}${n.platform ? '' : `<span class="na">${esc(audName(n.audience))}</span>`}<span class="rolechip r-${srcKey(n)}">${esc(roleOf(n))}</span></div>
  <h2 class="nr-t">${esc(n.title)}</h2><p class="muted nr-m">${esc(n.author || '')} · ${esc(dtFmt(n.at))}${n.edited ? ' · изменено' : ''}${n.event_date ? ` · событие ${dmy(n.event_date)}` : ''}${n.reads != null ? ` · прочитали: ${n.reads}` : ''}</p>
  <div class="news-body">${E.render(n.body, n.fmt)}</div>
  <div class="nav-row">${canEdit ? `<button class="btn ghost" data-act="news-edit" data-id="${n.id}">Изменить</button>` : ''}<button class="btn blue" data-act="news-close">Закрыть</button></div></article>`;
}
function composer(u, R) {
  const x = X(), teacher = u.role === 'teacher', cls = S.state().classes.filter(c => !teacher || (u.classes || []).includes(c.name));
  const editing = x.edit && R && R.rows.find(n => n.id === x.edit);
  const d = x.draft || (x.draft = editing ? { ...D0(), title: editing.title, html: editing.fmt === 'html' ? editing.body : E.escHtml(editing.body).replace(/\n/g, '<br>'), kind: editing.kind, aud: editing.audience } : D0());
  const aud = teacher ? '' : Object.entries(AUD).map(([k, v]) => `<option value="${k}" ${d.aud === k ? 'selected' : ''}>${v}</option>`).join('');
  return `<section class="card compose news-compose"><h3>${editing ? 'Изменить новость' : 'Новая новость'}</h3><form data-form="news-post">
    <label class="fld"><span>Заголовок</span><input name="title" maxlength="90" required minlength="3" value="${esc(d.title)}" data-nd="title"></label>
    <div class="fld"><span>Текст</span>${E.area(d.html)}</div>
    ${editing ? '' : `<div class="inline"><label class="fld"><span>Тип</span><select name="kind" data-nd="kind"><option value="news">📰 Новость</option><option value="event" ${d.kind === 'event' ? 'selected' : ''}>📅 Событие</option><option value="alert" ${d.kind === 'alert' ? 'selected' : ''}>⚠️ Важно</option><option value="holiday" ${d.kind === 'holiday' ? 'selected' : ''}>🎉 Праздник</option></select></label>
    <label class="fld"><span>Кому</span><select name="aud" data-nd="aud">${aud}${cls.map(c => `<option value="class:${c.id}" ${d.aud === 'class:' + c.id ? 'selected' : ''}>Класс ${esc(c.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>Дата события</span><input type="date" name="event" min="${todayISO()}" value="${esc(d.event)}" data-nd="event"></label>
    ${teacher ? '' : `<label class="chk"><input type="checkbox" name="pin" ${d.pin ? 'checked' : ''} data-nd="pin"> закрепить</label>`}</div>`}
    <p class="muted">${teacher ? 'Учитель пишет только своим классам.' : 'Новость увидят только в вашей школе.'}</p>
    <div class="btns">${editing ? '<button type="button" class="btn ghost" data-act="news-compose-x">Отмена</button>' : ''}<button class="btn blue" type="submit">${editing ? 'Сохранить' : 'Опубликовать'}</button></div></form></section>`;
}
export function superPage() {
  const x = X(), d = x.sdraft || (x.sdraft = { title: '', html: '' });
  return `${head('Новости сети', 'SABAK+', 'Видны во всех школах платформы')}
  <div class="ctl"><a class="btn ghost" href="#/super">← Центр управления</a></div>
  <section class="card compose news-compose"><h3>Объявление платформы</h3><p class="muted">Появится в ленте новостей каждой школы с пометкой «SABAK+». Оформляйте текст как нужно: заголовки, цвета, списки, ссылки.</p>
  <form data-form="news-super"><label class="fld"><span>Заголовок</span><input name="title" maxlength="90" required minlength="3" value="${esc(d.title)}" data-nd="stitle"></label><div class="fld"><span>Текст</span>${E.area(d.html)}</div>
  <label class="chk"><input type="checkbox" name="pin"> закрепить</label> <button class="btn blue" type="submit">Опубликовать для всех школ</button></form></section>`;
}
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
export async function act(a, el) {
  const x = X();
  switch (a) {
    case 'news-filter': x.filter = el.dataset.v; rerender(); return true;
    case 'news-src': x.src = el.dataset.v; rerender(); return true;
    case 'news-compose': x.open = !x.open; x.edit = null; x.draft = null; rerender(); return true;
    case 'news-compose-x': x.open = false; x.edit = null; x.draft = null; rerender(); return true;
    case 'news-open': x.read = el.dataset.id; { const n = cache.list && cache.list.rows && cache.list.rows.find(z => z.id === x.read); if (n && !n.read) { n.read = true; V.call('news_read', { p_id: n.id }); } } rerender(); return true;
    case 'news-close': x.read = null; rerender(); return true;
    case 'news-edit': x.edit = el.dataset.id; x.read = null; x.open = false; x.draft = null; rerender(); setTimeout(() => { const c = document.querySelector('.news-compose'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); return true;
    case 'news-pin': await guard(async () => { need(await V.call('news_set', { p_id: el.dataset.id, p_pinned: el.dataset.v === '1' })); fresh(); rerender(); }); return true;
    case 'news-del': await guard(async () => { if (!confirm('Удалить новость?')) return; need(await V.call('news_set', { p_id: el.dataset.id, p_delete: true })); fresh(); rerender(); }); return true;
  }
  return false;
}
// совместимость: если сервер ещё без schema_v8, публикуем обычным текстом, чтобы новость всё равно вышла
async function callFmt(name, args, html) {
  let r = await V.call(name, { ...args, p_body: html, p_fmt: 'html' });
  if (r && r.error === 'not_deployed') { toast('Сервер без schema_v8: опубликовано без форматирования', 'warn'); const { p_fmt, ...rest } = args; r = await V.call(name, { ...rest, p_body: E.toText(html) }); }
  return r;
}
export function onInput(el) {
  const x = X();
  if (el.id === 'ed-body') { const key = x.sdraft && location.hash.includes('/news') && S.state().session.role === 'super' ? 'sdraft' : 'draft'; if (!x[key]) x[key] = { title: '', html: '' }; x[key].html = el.innerHTML; E.count(); return true; }
  const k = el.dataset && el.dataset.nd; if (!k) return false;
  if (k === 'stitle') { (x.sdraft = x.sdraft || { title: '', html: '' }).title = el.value; return true; }
  const d = x.draft || (x.draft = D0()); d[k] = el.type === 'checkbox' ? el.checked : el.value; return true;
}
export async function submit(f, fd) {
  const k = f.dataset.form, v = n => String(fd.get(n) || '').trim(), x = X();
  if (k === 'news-post') { await guard(async () => {
    const html = E.value(); if (E.toText(html).length < 3) throw new Error(ERR.short);
    if (x.edit) { need(await V.call('news_edit', { p_id: x.edit, p_title: v('title'), p_body: html, p_fmt: 'html' })); x.edit = null; x.draft = null; fresh(); toast('Изменения сохранены', 'ok'); rerender(); return; }
    need(await callFmt('news_post', { p_title: v('title'), p_kind: v('kind'), p_audience: v('aud'), p_pinned: !!fd.get('pin'), p_event: v('event') || null, p_days: null }, html)); fresh(); x.open = false; x.draft = null; toast('Опубликовано', 'ok'); rerender(); }); return true; }
  if (k === 'news-super') { await guard(async () => {
    const html = E.value(); if (E.toText(html).length < 3) throw new Error(ERR.short);
    need(await callFmt('super_news_post', { p_title: v('title'), p_pinned: !!fd.get('pin') }, html)); x.sdraft = null; fresh(); toast('Опубликовано во всех школах', 'ok'); rerender(); }); return true; }
  return false;
}
export const refresh = fresh;
// панель форматирования: команды и палитры цветов
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ed]'), pop = e.target.closest('[data-ed-pop]');
  if (pop) { const w = pop.closest('.ed-pop'); const open = w.classList.contains('open'); document.querySelectorAll('.ed-pop.open').forEach(z => z.classList.remove('open')); if (!open) w.classList.add('open'); return; }
  if (b) { document.querySelectorAll('.ed-pop.open').forEach(z => z.classList.remove('open')); E.exec(b.dataset.ed, b.dataset.v); const a = document.querySelector('.ed-area'); if (a) a.dispatchEvent(new Event('input', { bubbles: true })); return; }
  if (!e.target.closest('.ed-pop')) document.querySelectorAll('.ed-pop.open').forEach(z => z.classList.remove('open'));
});
document.addEventListener('change', e => { const s = e.target.closest('[data-ed-size]'); if (s && s.value) { E.exec('fontSize', s.value); s.value = ''; const a = document.querySelector('.ed-area'); if (a) a.dispatchEvent(new Event('input', { bubbles: true })); } });
window.addEventListener('hashchange', () => { const x = X(); x.read = null; });
