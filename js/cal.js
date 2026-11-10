// Календарь учебного года: четверти и каникулы. Суперадмин вносит даты по приказу министерства, остальные только смотрят.
import * as S from './store.js';
import * as V from './v9data.js';
import * as T from './termcal.js';
import { esc, ui, head, toast } from './common.js';

const rerender = () => window.__render && window.__render();
const cache = {};
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка' }; rerender(); });
  return 'loading';
}
export const refresh = () => { Object.keys(cache).forEach(k => delete cache[k]); };
const X = () => (ui.cal = ui.cal || { year: null, edit: false, draft: null, busy: false });
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
const isSuper = () => (S.state().session || {}).role === 'super';

const SLOTS = [['quarter', 1], ['break', 1], ['quarter', 2], ['break', 2], ['quarter', 3], ['break', 3], ['quarter', 4]];
const slotKey = ([k, n]) => k + n;

/** Полоска «сегодня» над страницей: система сама знает, какой день и какая четверть */
export function strip() {
  if (!T.cache.loaded) return '';
  const n = T.now(), role = (S.state().session || {}).role;
  const base = role === 'super' ? 'super' : role === 'deputy' ? 'admin' : role;
  let txt;
  if (!n.term) txt = n.next ? `До ${T.termName(n.next).toLowerCase()} ${n.toNext} дн.` : (role === 'super' || role === 'director' ? 'Календарь учебного года не заполнен: оценки пока не ограничены по четвертям' : 'Календарь года ещё не заполнен');
  else if (n.term.kind === 'quarter') txt = `${T.termName(n.term)} · день ${n.day} из ${n.total}`;
  else txt = `${T.termName(n.term)} · осталось ${n.left + 1} дн.`;
  return `<a class="dayline ${!n.term && !n.next ? 'nocal' : ''} ${n.term && n.term.kind === 'break' ? 'brk' : ''}" href="#/${base}/calendar" aria-label="Календарь года"><span class="dl-d">${esc(T.weekdayRu(n.today))}, ${esc(T.dateRu(n.today))}</span><span class="dl-t">${esc(txt)}</span><span class="dl-y">${esc(n.year)} уч. год</span></a>`;
}

function timeline(terms, today) {
  if (!terms.length) return '';
  const a = terms[0].starts, b = terms[terms.length - 1].ends, total = Math.max(1, T.diffDays(a, b) + 1);
  const seg = terms.map(t => { const d = T.diffDays(t.starts, t.ends) + 1, st = t.status || (today < t.starts ? 'upcoming' : today <= t.ends ? 'open' : 'closed');
    return `<div class="tl-seg ${t.kind} ${st}" style="flex:${d}" title="${esc(T.termName(t))}: ${esc(T.dayRu(t.starts))} — ${esc(T.dayRu(t.ends))}"><b>${t.kind === 'quarter' ? t.num : ''}</b></div>`; }).join('');
  const pos = today >= a && today <= b ? Math.round(T.diffDays(a, today) / total * 1000) / 10 : null;
  return `<div class="tl" role="img" aria-label="Шкала учебного года">${seg}${pos != null ? `<i class="tl-now" style="left:${pos}%"><span>сегодня</span></i>` : ''}</div>`;
}
const STAT = { open: 'идёт', closed: 'завершена', upcoming: 'впереди' };
function termRow(t, today) {
  const st = t.status || (today < t.starts ? 'upcoming' : today <= t.ends ? 'open' : 'closed'), days = T.diffDays(t.starts, t.ends) + 1;
  const note = t.kind === 'quarter' ? (st === 'closed' ? 'Оценки закрыты и сохранены в архиве' : st === 'open' ? `Осталось ${T.diffDays(today, t.ends)} дн. Оценки можно ставить` : `Начнётся через ${T.diffDays(today, t.starts)} дн.`) : (st === 'open' ? 'Занятий нет, оценки не ставятся' : st === 'upcoming' ? `Начнутся через ${T.diffDays(today, t.starts)} дн.` : 'Прошли');
  return `<div class="tm ${t.kind} ${st}"><span class="tm-n">${t.kind === 'quarter' ? t.num : '☼'}</span><div class="tm-b"><b>${esc(T.termName(t))}</b><small>${esc(T.dayRu(t.starts))} — ${esc(T.dayRu(t.ends))} · ${days} дн.</small><small>${esc(note)}</small></div><span class="tm-s ${st}">${t.kind === 'break' && st === 'open' ? 'сейчас' : STAT[st]}</span></div>`;
}

export function page() {
  const x = X(), lb = x.year || T.yearLabel();
  const R = load('cal:' + lb, async () => V.need(await V.call('calendar_get', { p_year: lb })));
  const n = T.now();
  if (R === 'loading') return head('Календарь года', '', 'Загружаем…') + '<div class="card"><p class="muted">…</p></div>';
  if (R.err) return head('Календарь года', '', '') + `<div class="card"><p>⚠️ ${esc(R.err)}</p></div>`;
  const today = R.today, years = [...new Set([...R.years, T.yearLabel(today), T.nextYear(T.yearLabel(today))])].sort().reverse();
  const cur = R.current, nx = R.next;
  const todayCard = `<section class="card cal-today"><div class="ct-date"><span>${esc(T.weekdayRu(today))}</span><b>${esc(T.dateRu(today))}</b></div><div class="ct-state">${
    cur ? `<b>${esc(T.termName(cur))}</b><small>${cur.kind === 'quarter' ? `День ${T.diffDays(cur.starts, today) + 1} из ${T.diffDays(cur.starts, cur.ends) + 1}. Оценки можно ставить до ${esc(T.dayRu(cur.ends))}` : `Занятий нет. Учёба возобновится ${esc(T.dayRu(T.addD(cur.ends, 1)))}`}</small>`
    : `<b>${nx ? 'Занятий нет' : 'Календарь не заполнен'}</b><small>${nx ? `Следующий период: ${esc(T.termName(nx))}, с ${esc(T.dayRu(nx.starts))}` : 'Даты четвертей добавит оператор SABAK+ после приказа министерства'}</small>`}</div></section>`;
  const yearSel = `<label class="cal-year">Учебный год <select data-act="cal-year">${years.map(y => `<option ${y === lb ? 'selected' : ''}>${y}</option>`).join('')}</select></label>`;
  const body = R.terms.length ? `${timeline(R.terms, today)}<div class="tm-list">${R.terms.map(t => termRow(t, today)).join('')}<div class="tm summer"><span class="tm-n">☼</span><div class="tm-b"><b>Летние каникулы</b><small>после окончания 4-й четверти</small></div></div></div>${R.terms[0].decree ? `<p class="muted cal-decree">Основание: ${esc(R.terms[0].decree)}</p>` : ''}`
    : `<div class="card"><p class="muted">Для ${esc(lb)} учебного года даты ещё не внесены. Как только выйдет приказ министерства, оператор SABAK+ добавит их, и система сама начнёт открывать и закрывать четверти.</p></div>`;
  const how = `<section class="card cal-how"><h2 class="tp">Как это работает</h2><ul class="plain"><li>Система сама знает сегодняшнюю дату и текущую четверть.</li><li>Оценки ставятся только в открытую четверть. В каникулы журнал закрыт.</li><li>После конца четверти ещё 3 дня можно исправить ошибки. Потом система архивирует оценки каждого класса и ученика.</li><li>Архив нельзя изменить. Из него строятся табель ученика и отчёты по предметам.</li></ul></section>`;
  const edit = isSuper() ? editor(lb, R) : '';
  return `${head('Календарь года', '', 'Четверти и школьные каникулы по приказу министерства')}${todayCard}${yearSel}${x.edit ? '' : body}${edit}${x.edit ? '' : how}`;
}

function editor(lb, R) {
  const x = X();
  if (!x.edit) return `<div class="btns"><button class="btn blue" data-act="cal-edit">${R.terms.length ? 'Изменить даты' : 'Внести даты года'}</button>${S.isLive() ? '<button class="btn ghost" data-act="cal-tickall">Заархивировать завершённые четверти во всех школах</button>' : ''}</div>`;
  const d = x.draft || (x.draft = Object.fromEntries(SLOTS.map(s => { const t = R.terms.find(z => z.kind === s[0] && z.num === s[1]); return [slotKey(s), { starts: t ? t.starts : '', ends: t ? t.ends : '' }]; })));
  const rows = SLOTS.map(s => { const k = slotKey(s), nm = T.termName({ kind: s[0], num: s[1] }); return `<div class="ce-row ${s[0]}"><span class="ce-n">${esc(nm)}</span><label><span class="sr">${esc(nm)}: начало</span><input type="date" data-cal="${k}.starts" value="${esc(d[k].starts)}"></label><span aria-hidden="true">—</span><label><span class="sr">${esc(nm)}: конец</span><input type="date" data-cal="${k}.ends" value="${esc(d[k].ends)}"></label></div>`; }).join('');
  return `<section class="card cal-edit"><h2 class="tp">Даты на ${esc(lb)} учебный год</h2><p class="muted">Внесите даты из приказа. Каникулы можно вычислить автоматически: это дни между четвертями. Летние каникулы начинаются после 4-й четверти.</p>
  <form data-form="cal-save"><div class="ce-list">${rows}</div>
  <label class="fld"><span>Основание (номер и дата приказа)</span><input name="decree" maxlength="160" value="${esc(x.decree != null ? x.decree : (R.terms[0] && R.terms[0].decree) || '')}" placeholder="Приказ МОиН КР № ___ от __.__.____"></label>
  <div class="btns"><button type="button" class="btn ghost" data-act="cal-sample">Подставить образец</button><button type="button" class="btn ghost" data-act="cal-gaps">Каникулы по промежуткам</button><button type="button" class="btn ghost" data-act="cal-cancel">Отмена</button><button class="btn blue" type="submit" ${x.busy ? 'disabled' : ''}>${x.busy ? 'Сохраняем…' : 'Сохранить календарь'}</button></div></form></section>`;
}

export function onChange(el) {
  if (el.dataset && el.dataset.act === 'cal-year') { X().year = el.value; X().edit = false; X().draft = null; rerender(); return true; }
  return false;
}
export function onInput(el) {
  if (el.dataset && el.dataset.cal) { const [k, f] = el.dataset.cal.split('.'); const x = X(); if (x.draft && x.draft[k]) x.draft[k][f] = el.value; return true; }
  return false;
}
export async function act(a, el) {
  const x = X();
  if (a === 'cal-edit') { x.edit = true; x.draft = null; rerender(); return true; }
  if (a === 'cal-cancel') { x.edit = false; x.draft = null; x.decree = null; rerender(); return true; }
  if (a === 'cal-sample') { const lb = x.year || T.yearLabel(); x.draft = Object.fromEntries(T.defaultTerms(lb).map(t => [t.kind + t.num, { starts: t.starts, ends: t.ends }])); SLOTS.forEach(s => { if (!x.draft[slotKey(s)]) x.draft[slotKey(s)] = { starts: '', ends: '' }; }); rerender(); return true; }
  if (a === 'cal-gaps') {
    const d = x.draft; if (!d) return true;
    [['break1', 'quarter1', 'quarter2'], ['break2', 'quarter2', 'quarter3'], ['break3', 'quarter3', 'quarter4']].forEach(([b, p, n]) => { if (d[p].ends && d[n].starts) { const s = T.addD(d[p].ends, 1), e = T.addD(d[n].starts, -1); d[b] = s <= e ? { starts: s, ends: e } : { starts: '', ends: '' }; } });
    rerender(); toast('Каникулы вычислены по промежуткам между четвертями', 'ok'); return true;
  }
  if (a === 'cal-tickall') { await guard(async () => { const r = V.need(await V.call('term_tick_all', {})); toast(`Готово: заархивировано четвертей — ${r.archived}`, 'ok'); }); return true; }
  return false;
}
export async function submit(f, fd) {
  if (f.dataset.form !== 'cal-save') return false;
  const x = X(), lb = x.year || T.yearLabel(), d = x.draft || {};
  x.decree = String(fd.get('decree') || '').trim();
  await guard(async () => {
    const items = SLOTS.map(s => ({ kind: s[0], num: s[1], starts: d[slotKey(s)].starts, ends: d[slotKey(s)].ends })).filter(i => i.starts || i.ends);
    if (items.some(i => !i.starts || !i.ends)) throw new Error('Заполните обе даты у каждого периода или оставьте оба поля пустыми');
    x.busy = true; rerender();
    try { V.need(await V.call('calendar_set', { p_year: lb, p_items: items, p_decree: x.decree })); await V.boot0(); refresh(); x.edit = false; x.draft = null; x.decree = null; toast('Календарь сохранён. Система будет открывать и закрывать четверти по этим датам', 'ok'); }
    finally { x.busy = false; rerender(); }
  });
  return true;
}
