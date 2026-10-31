// Интерфейс расписания: конструктор (директор/завуч), просмотр учителя и «бумажный дневник» для ученика и родителя.
import * as S from './store.js';
import * as Sch from './sched.js';
import { esc, ui, sjName, toast, head, first, route, go, dtFmt } from './common.js';
import { todayISO, dmy } from './calc.js';

const X = () => (ui.sch = ui.sch || { tab: 'versions', vid: null, cls: null, pick: null, cell: null, reject: null, view: null });
const rerender = () => window.__render && window.__render();
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || String(e), 'warn'); } };
const STATUS = { draft: ['Черновик', ''], pending: ['На одобрении', 'warn'], approved: ['Действует', 'ok'], rejected: ['Не принято', 'bad'], archived: ['Архив', ''] };
const badge = v => { const [t, k] = STATUS[v.active ? 'approved' : v.status] || ['', '']; return `<span class="sbadge ${k}">${t}</span>`; };
const nameOf = (id, kind) => (kind === 't' ? S.staffName(id) : id);
const classes = () => S.state().classes.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
const cname = id => (S.state().classes.find(c => c.id === id) || { name: '?' }).name;
const teachers = () => S.state().staff.filter(t => t.role === 'teacher' && t.status === 'active');
const suggestTeacher = (cid, subj) => { const t = teachers().find(t => (t.classes || []).includes(cname(cid)) && (t.subjects || []).includes(subj)); return t ? t.id : null; };
const wdOf = d => new Date(d + 'T12:00:00').getDay() || 7;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const emojiOf = id => (S.subj(id) || {}).e || '📘';

// ===================== «Бумажный дневник» (ученик, родитель) =====================
export function diary(cid, { sid = null, title = 'Расписание уроков', print = true } = {}) {
  const v = S.schedActive();
  if (!v) return `<div class="card lock"><div class="big-ic">🗓️</div><h2>Расписание ещё не опубликовано</h2><p>Директор или завуч готовят его. Как только расписание будет утверждено, оно появится здесь, и вы получите уведомление.</p></div>`;
  const c = S.state().classes.find(x => x.id === cid); if (!c) return '';
  const D = v.data, today = wdOf(todayISO()), isSchoolDay = new Date().getDay() !== 0;
  const hw = sid ? S.hwFor(sid).filter(h => !h.done && h.dueDate >= todayISO()) : [];
  const days = Sch.DAYS.filter(([d]) => Sch.shiftOf(D, cid, d) || D.lessons.some(l => l.c === cid && l.d === d));
  const dayHtml = ([d, full]) => {
    const list = Sch.dayLessons(D, cid, d), sh = Sch.shiftOf(D, cid, d), shift = (D.shifts || []).find(x => x.id === sh);
    const isToday = d === today && isSchoolDay;
    return `<section class="dr-day ${isToday ? 'today' : ''}" aria-label="${full}">
      <header><span class="dr-dn">${full}</span>${shift ? `<span class="dr-sh">${esc(shift.name)}</span>` : ''}${isToday ? '<span class="dr-st">сегодня</span>' : ''}</header>
      <ol>${list.map(l => {
        const tm = l.time, live = isToday && tm && nowMin() >= Sch.t2m(tm.s) && nowMin() < Sch.t2m(tm.e), h = hw.find(x => x.subj === l.s);
        return `<li class="${live ? 'now' : ''}"><span class="dr-n">${l.n}</span><span class="dr-tm">${tm ? tm.s + '–' + tm.e : ''}</span><span class="dr-sj">${emojiOf(l.s)} ${esc(sjName(l.s))}${live ? ' <em>идёт сейчас</em>' : ''}${h ? `<small class="dr-hw">✎ ДЗ: ${esc(h.title)} · до ${dmy(h.dueDate)}</small>` : ''}</span><span class="dr-rm">${l.r ? 'каб. ' + esc(l.r) : ''}${l.t ? `<small>${esc(first(S.staffName(l.t)))}</small>` : ''}</span></li>`;
      }).join('') || '<li class="empty">Занятий нет</li>'}</ol></section>`;
  };
  return `<div class="diary" data-notr="0">
    <div class="dr-top"><div><small>ДНЕВНИК</small><h2>${esc(title)}</h2></div><div class="dr-cls">${esc(c.name)} класс<small>действует с ${dmy(new Date(v.decidedAt || v.updated).toISOString().slice(0, 10))}</small></div></div>
    <div class="dr-spread"><span class="dr-spiral" aria-hidden="true"></span>${days.map(dayHtml).join('')}</div>
    ${print ? '<p class="noprint dr-foot"><button class="btn ghost sm" data-act="sch-print">🖨 Печать</button></p>' : ''}
  </div>`;
}
export function studentPage(sid) {
  const st = S.student(sid), c = S.state().classes.find(x => x.name === (st && st.cls));
  return `${head('Расписание', '', st ? `${esc(st.cls)} · обновляется автоматически` : '')}${c ? diary(c.id, { sid }) : ''}`;
}

// ===================== Учитель =====================
export function teacherPage() {
  const u = S.state().session, v = S.schedActive(), x = X(), mine = S.schedComments().filter(c => c.by === u.id);
  if (!v) return `${head('Расписание', '', '')}<div class="card lock"><div class="big-ic">🗓️</div><h2>Расписание ещё не опубликовано</h2><p>Как только его утвердит директор, оно появится здесь.</p></div>`;
  const D = v.data, view = x.view || 'mine';
  const days = Sch.DAYS.filter(([d]) => D.lessons.some(l => l.t === u.id && l.d === d));
  const clsList = classes(); if (!x.cls || !clsList.some(c => c.id === x.cls)) x.cls = (clsList.find(c => c.name === u.homeroom) || clsList[0] || {}).id;
  const total = D.lessons.filter(l => l.t === u.id).length;
  const myHtml = days.length ? `<div class="grid3">${days.map(([d, full]) => `<section class="card ${d === wdOf(todayISO()) ? 'hl' : ''}"><h2 class="tp">${full}</h2>${Sch.teacherDay(D, u.id, d).map(l => `<div class="row"><div><b>${emojiOf(l.s)} ${esc(sjName(l.s))}</b><small>${esc(cname(l.c))} класс${l.r ? ' · каб. ' + esc(l.r) : ''}</small></div><div class="big sm">${l.time ? l.time.s : ''}<small>${l.time ? '–' + l.time.e : ''}</small></div></div>`).join('')}</section>`).join('')}</div>` : '<div class="card"><p class="muted">За вами пока не закреплено ни одного урока в действующем расписании.</p></div>';
  return `${head('Расписание', '', `«${esc(v.title)}» · ваших уроков в неделю: ${total}`)}
  <div class="tabs noprint"><button class="tag ${view === 'mine' ? 'on' : ''}" data-act="sch-view" data-v="mine">Мои уроки</button><button class="tag ${view === 'cls' ? 'on' : ''}" data-act="sch-view" data-v="cls">Расписание класса</button></div>
  ${view === 'mine' ? myHtml : `<label class="inl noprint">Класс <select data-sch="cls">${clsList.map(c => `<option value="${c.id}" ${c.id === x.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${diary(x.cls, { title: 'Расписание класса' })}`}
  <section class="card noprint" style="margin-top:16px"><h2 class="tp">Написать завучу</h2><p class="muted">Предложите улучшение или изменение расписания: что неудобно и как лучше. Сообщение увидит завуч (если завуча нет — директор), вам придёт ответ в уведомлениях, когда расписание изменят.</p>
    <form class="form" data-form="sch-comment"><label>Ваш комментарий<textarea name="text" rows="3" minlength="3" maxlength="2000" required placeholder="Например: «Прошу не ставить два урока физики подряд во вторник»"></textarea></label><button class="btn blue" type="submit">Отправить завучу</button></form>
    ${mine.length ? `<h3 class="tp" style="margin-top:16px">Ваши обращения</h3>${mine.map(c => `<div class="row"><div><b>${esc(c.text)}</b><small>${dtFmt(c.ts)}</small></div><span class="sbadge ${c.resolved ? 'ok' : ''}">${c.resolved ? 'Рассмотрено' : 'Отправлено'}</span></div>`).join('')}` : ''}</section>`;
}

// ===================== Директор / завуч =====================
const TABS = [['versions', 'Версии и одобрение'], ['subjects', '1. Предметы'], ['shifts', '2. Смены и звонки'], ['build', '3. Составление'], ['inbox', 'Комментарии']];
export function adminPage() {
  const x = X(), u = S.state().session, dir = S.schedCan.approve();
  let v = x.vid && S.schedVersion(x.vid); if (!v) { x.vid = null; }
  const inboxN = S.schedComments().filter(c => !c.resolved).length, pendN = S.schedVersions().filter(a => a.status === 'pending').length;
  const tabs = TABS.map(([k, n]) => `<button class="tag ${x.tab === k ? 'on' : ''}" data-act="sch-tab" data-tab="${k}">${n}${k === 'inbox' && inboxN ? ` <b class="cnt2">${inboxN}</b>` : ''}${k === 'versions' && dir && pendN ? ` <b class="cnt2">${pendN}</b>` : ''}</button>`).join('');
  const body = { versions, subjects, shifts, build, inbox }[x.tab] || versions;
  return `${head('Расписание', '', dir ? 'Вы директор: создаёте расписание сами и одобряете предложения завуча' : 'Вы завуч: составляйте расписание — оно заработает после одобрения директора')}
  <div class="tabs noprint" role="tablist">${tabs}</div>${x.tab !== 'versions' && x.tab !== 'subjects' && x.tab !== 'inbox' ? workBar(v) : ''}${body(v)}`;
}
function workBar(v) {
  const x = X(), list = S.schedVersions().filter(a => a.status !== 'archived' || a.active);
  return `<div class="card workbar noprint"><label class="inl">Работаем с версией <select data-sch="ver"><option value="">— выберите —</option>${list.map(a => `<option value="${a.id}" ${a.id === x.vid ? 'selected' : ''}>${esc(a.title)} · ${(STATUS[a.active ? 'approved' : a.status] || [''])[0]}</option>`).join('')}</select></label>${v ? badge(v) : ''}${v && !S.schedCan.edit(v) ? '<small class="muted">Только просмотр: версия отправлена или действует. Чтобы править — создайте копию на вкладке «Версии».</small>' : ''}${!v ? '<small class="muted">Выберите версию или создайте новую на вкладке «Версии».</small>' : ''}</div>`;
}
const needVer = tab => `<div class="card lock"><h2>Сначала выберите версию</h2><p>Расписание хранится версиями: черновик → на одобрении → действует. Откройте вкладку «Версии и одобрение» и создайте новую версию или выберите существующую.</p><button class="btn blue" data-act="sch-tab" data-tab="versions">К версиям</button></div>`;

// ---- вкладка «Версии и одобрение» ----
function versions() {
  const x = X(), u = S.state().session, dir = S.schedCan.approve(), all = S.schedVersions(), act = S.schedActive();
  const pend = all.filter(v => v.status === 'pending'), mineOrAll = all.filter(v => !v.active && v.status !== 'pending' && v.status !== 'archived');
  const arch = all.filter(v => v.status === 'archived' && !v.active);
  const flow = `<div class="flow noprint"><span class="on">1. Черновик</span><i>→</i><span class="${pend.length ? 'on' : ''}">2. На одобрении у директора</span><i>→</i><span class="${act ? 'on' : ''}">3. Действует у всех</span></div>`;
  const row = v => {
    const d = Sch.diff(act && act.id !== v.id ? act.data : null, v.data), canEdit = S.schedCan.edit(v);
    return `<div class="vrow"><div class="vmain"><b>${esc(v.title)}</b> ${badge(v)}<small>${esc(v.byName || '')} · обновлено ${dtFmt(v.updated)} · уроков: ${v.data.lessons.length}${act && act.id !== v.id && v.data.lessons.length ? ` · к действующему: +${d.add} −${d.del} ✎${d.chg}` : ''}</small>
      ${v.status === 'rejected' ? `<div class="note bad"><b>Директор не принял:</b> ${esc(v.note || '—')}</div>` : ''}
      ${v.status === 'pending' && v.id !== x.reject ? '' : ''}</div>
      <div class="vact noprint"><button class="btn sm ghost" data-act="sch-open" data-id="${v.id}" data-tab="build">${canEdit ? 'Редактировать' : 'Открыть'}</button>
      ${canEdit && !dir ? `<button class="btn sm blue" data-act="sch-submit" data-id="${v.id}">Отправить директору</button>` : ''}
      ${canEdit && dir ? `<button class="btn sm blue" data-act="sch-publish" data-id="${v.id}">Опубликовать</button>` : ''}
      ${v.status === 'pending' && dir ? `<button class="btn sm blue" data-act="sch-approve" data-id="${v.id}">Одобрить</button><button class="btn sm ghost" data-act="sch-reject" data-id="${v.id}">Отклонить…</button>` : ''}
      ${(canEdit || dir) && !v.active ? `<button class="btn sm ghost" data-act="sch-delete" data-id="${v.id}" aria-label="Удалить">🗑</button>` : ''}</div>
      ${x.reject === v.id ? `<form class="form rejectf" data-form="sch-reject"><input type="hidden" name="id" value="${v.id}"><label>Причина (её получит завуч)<textarea name="note" rows="2" minlength="3" required placeholder="Что нужно исправить"></textarea></label><div class="btns"><button class="btn blue" type="submit">Отклонить и уведомить</button><button class="btn ghost" type="button" data-act="sch-reject-cancel">Отмена</button></div></form>` : ''}</div>`;
  };
  return `${flow}
  <section class="card"><h2 class="tp">Действующее расписание</h2>${act ? `<div class="vrow"><div class="vmain"><b>${esc(act.title)}</b> ${badge(act)}<small>Утверждено ${dtFmt(act.decidedAt || act.updated)} · уроков: ${act.data.lessons.length} · смен: ${(act.data.shifts || []).length}</small></div><div class="vact noprint"><button class="btn sm ghost" data-act="sch-open" data-id="${act.id}" data-tab="build">Смотреть</button><button class="btn sm blue" data-act="sch-copy" data-id="${act.id}">Править (создаст копию)</button></div></div>` : '<p class="muted">Пока нет действующего расписания. Создайте первое — см. ниже.</p>'}</section>
  ${dir && pend.length ? `<section class="card hl"><h2 class="tp">Ждёт вашего решения (${pend.length})</h2>${pend.map(row).join('')}</section>` : ''}
  ${!dir && pend.length ? `<section class="card"><h2 class="tp">Отправлено директору</h2>${pend.filter(v => v.by === u.id).map(row).join('') || '<p class="muted">—</p>'}</section>` : ''}
  <section class="card noprint"><h2 class="tp">Новая версия</h2><form class="form frow2" data-form="sch-new"><label>Название<input name="title" required minlength="2" maxlength="120" value="Расписание на ${new Date().toLocaleDateString('ru-RU', { month: 'long' })}"></label><label>За основу<select name="from"><option value="">Пустое (с нуля)</option>${all.filter(v => v.data.lessons.length).map(v => `<option value="${v.id}" ${act && v.id === act.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}</select></label><div><button class="btn blue" type="submit">Создать</button></div></form>
    <p class="muted" style="margin-top:8px">Порядок: <b>1.</b> добавьте предметы вашей школы → <b>2.</b> настройте смены и время звонков → <b>3.</b> расставьте уроки по классам. ${dir ? '' : 'Затем отправьте директору.'}</p></section>
  <section class="card"><h2 class="tp">Черновики и отклонённые</h2>${mineOrAll.map(row).join('') || '<p class="muted">Нет.</p>'}</section>
  ${arch.length ? `<section class="card"><h2 class="tp">Архив</h2>${arch.map(row).join('')}</section>` : ''}`;
}

// ---- вкладка «Предметы» ----
const EMOJIS = ['📘', '➗', '📝', '🔬', '🌍', '🎨', '🎵', '⚽', '🛠️', '💻', '🧪', '📐', '🏛️', '🗣️', '🧬', '⚛️', '🎭', '🌱'];
function subjects() {
  const all = S.state().subjects || [], act = all.filter(s => !s.hidden), hid = all.filter(s => s.hidden);
  return `<section class="card"><h2 class="tp">Предметы вашей школы</h2><p class="muted">Школы разные: добавьте предметы, которых нет в списке (например, «Музыка», «Труд», «Родной язык»), и скройте те, что у вас не преподаются. Расписание строится только из предметов этого списка.</p>
    <div class="subjgrid">${act.map(s => `<div class="subj"><span class="em">${esc(s.e || '📘')}</span><div><b>${esc(s.ru)}</b><small>${esc(s.ky || '')}${s.custom ? ' · добавлен школой' : ''}${S.usedInSchedule(s.id) ? ' · в расписании' : ''}</small></div><div class="sa noprint">${s.custom ? `<button class="ibtn" data-act="sub-del" data-id="${s.id}" aria-label="Удалить ${esc(s.ru)}" title="Удалить">🗑</button>` : ''}<button class="ibtn" data-act="sub-hide" data-id="${s.id}" aria-label="Скрыть ${esc(s.ru)}" title="Скрыть из списка">🚫</button></div></div>`).join('')}</div>
    ${hid.length ? `<h3 class="tp" style="margin-top:14px">Скрытые</h3><div class="subjgrid">${hid.map(s => `<div class="subj off"><span class="em">${esc(s.e || '📘')}</span><div><b>${esc(s.ru)}</b></div><div class="sa"><button class="btn sm ghost" data-act="sub-show" data-id="${s.id}">Вернуть</button></div></div>`).join('')}</div>` : ''}</section>
  <section class="card noprint"><h2 class="tp">Добавить предмет</h2><form class="form frow3" data-form="sub-add"><label>Название (рус.)<input name="ru" required minlength="2" maxlength="60" placeholder="Музыка"></label><label>Название (кырг.) — по желанию<input name="ky" maxlength="60" placeholder="Музыка"></label><label>Значок<select name="e">${EMOJIS.map(e => `<option>${e}</option>`).join('')}</select></label><div><button class="btn blue" type="submit">Добавить</button></div></form></section>`;
}

// ---- вкладка «Смены и звонки» ----
function shifts(v) {
  if (!v) return needVer(); const x = X(), D = v.data, ed = S.schedCan.edit(v), cl = classes();
  const shHtml = (D.shifts || []).map(sh => {
    const b = D.bells[sh.id] || [];
    return `<section class="card shiftc"><form class="form" data-form="sch-shift"><input type="hidden" name="id" value="${sh.id}">
      <div class="frow3"><label>Название<input name="name" value="${esc(sh.name)}" maxlength="30" ${ed ? '' : 'disabled'}></label><label>Первый урок с<input type="time" name="first" value="${sh.first}" required ${ed ? '' : 'disabled'}></label><label>Уроков в смене<input type="number" name="count" min="1" max="${Sch.MAX_LESSONS}" value="${sh.count}" ${ed ? '' : 'disabled'}></label></div>
      <div class="frow3"><label>Длина урока, мин<input type="number" name="len" min="20" max="120" value="${sh.len}" ${ed ? '' : 'disabled'}></label><label>Перемена, мин<input type="number" name="brk" min="0" max="60" value="${sh.brk}" ${ed ? '' : 'disabled'}></label><label>Большая перемена после урока № / мин<span class="two"><input type="number" name="lafter" min="0" max="${Sch.MAX_LESSONS}" value="${sh.long ? sh.long.after : 0}" ${ed ? '' : 'disabled'}><input type="number" name="lmin" min="0" max="90" value="${sh.long ? sh.long.min : 0}" ${ed ? '' : 'disabled'}></span></label></div>
      ${ed ? '<div class="btns"><button class="btn blue" type="submit">Пересчитать звонки</button></div>' : ''}</form>
      <div class="bells">${b.map(z => `<div class="bell"><b>${z.n}</b><input type="time" value="${z.s}" data-sch="bell" data-sh="${sh.id}" data-n="${z.n}" data-f="s" ${ed ? '' : 'disabled'} aria-label="Урок ${z.n}: начало"><span>–</span><input type="time" value="${z.e}" data-sch="bell" data-sh="${sh.id}" data-n="${z.n}" data-f="e" ${ed ? '' : 'disabled'} aria-label="Урок ${z.n}: конец"></div>`).join('')}</div></section>`;
  }).join('');
  const matrix = `<section class="card"><h2 class="tp">Какая смена учится в какой день</h2><p class="muted">Для каждого класса выберите смену на каждый день. «—» — занятий нет. Расписание звонков берётся из смены.</p>
    <div class="sgrid-wrap"><table class="csm"><thead><tr><th>Класс</th>${Sch.DAYS.map(([, , s]) => `<th>${s}</th>`).join('')}<th>Все дни Пн–Пт</th></tr></thead><tbody>${cl.map(c => `<tr><th>${esc(c.name)}</th>${Sch.DAYS.map(([d]) => `<td><select data-sch="cs" data-c="${c.id}" data-d="${d}" ${ed ? '' : 'disabled'} aria-label="${esc(c.name)}, день ${d}"><option value="0">—</option>${(D.shifts || []).map(sh => `<option value="${sh.id}" ${Sch.shiftOf(D, c.id, d) === sh.id ? 'selected' : ''}>${sh.id}</option>`).join('')}</select></td>`).join('')}<td><select data-sch="cs-all" data-c="${c.id}" ${ed ? '' : 'disabled'}><option value="">…</option>${(D.shifts || []).map(sh => `<option value="${sh.id}">${esc(sh.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></section>`;
  return `<section class="card"><h2 class="tp">Сколько смен в школе</h2><div class="tabs">${[1, 2, 3].map(n => `<button class="tag ${(D.shifts || []).length === n ? 'on' : ''}" data-act="sch-shifts" data-n="${n}" ${ed ? '' : 'disabled'}>${n} ${n === 1 ? 'смена' : 'смены'}</button>`).join('')}</div></section>${shHtml}${matrix}
  <div class="noprint"><button class="btn blue" data-act="sch-tab" data-tab="build">Дальше: составить расписание →</button></div>`;
}

// ---- вкладка «Составление» ----
function build(v) {
  if (!v) return needVer(); const x = X(), D = v.data, ed = S.schedCan.edit(v), cl = classes();
  if (!x.cls || !cl.some(c => c.id === x.cls)) x.cls = (cl[0] || {}).id;
  const cid = x.cls, subs = S.state().subjects.filter(s => !s.hidden);
  const conf = Sch.conflicts(D, nameOf), bad = Sch.conflictKeys(conf);
  const dayCols = Sch.DAYS.filter(([d]) => Sch.shiftOf(D, cid, d));
  const maxN = Math.max(0, ...dayCols.map(([d]) => Sch.maxLessonNo(D, Sch.shiftOf(D, cid, d))));
  const cell = (d, n) => {
    const tm = Sch.timeOf(D, cid, d, n); if (!tm) return `<td class="off">·</td>`;
    const l = Sch.lessonAt(D, cid, d, n), isBad = bad.has(`${cid}|${d}|${n}`), sel = x.cell && x.cell.d === d && x.cell.n === n;
    return `<td><div class="cell ${l ? 'full' : ''} ${isBad ? 'bad' : ''} ${sel ? 'sel' : ''}" data-act="sch-cell" data-d="${d}" data-n="${n}" ${ed ? `tabindex="0" role="button" ${l ? 'draggable="true"' : ''}` : ''} aria-label="${Sch.DAYS[d - 1][1]}, урок ${n}${l ? ', ' + esc(sjName(l.s)) : ', пусто'}">
      <small class="ct">${tm.s}</small>${l ? `<b>${emojiOf(l.s)} ${esc(sjName(l.s))}</b><small>${l.r ? 'каб. ' + esc(l.r) : ''}${l.t ? ' · ' + esc(first(S.staffName(l.t))) : ''}</small>` : (ed ? '<span class="plus">＋</span>' : '')}</div></td>`;
  };
  const gridHtml = dayCols.length ? `<div class="sgrid-wrap"><table class="sgrid"><thead><tr><th>№</th>${dayCols.map(([d, full, s]) => `<th title="${full}">${s}<small>${esc(((D.shifts || []).find(z => z.id === Sch.shiftOf(D, cid, d)) || {}).name || '')}</small></th>`).join('')}</tr></thead><tbody>${Array.from({ length: maxN }, (_, i) => i + 1).map(n => `<tr><th>${n}</th>${dayCols.map(([d]) => cell(d, n)).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="card lock"><h2>У класса нет учебных дней</h2><p>Назначьте смены на вкладке «2. Смены и звонки».</p><button class="btn blue" data-act="sch-tab" data-tab="shifts">К сменам</button></div>`;
  const pal = ed ? `<div class="palette noprint" aria-label="Предметы"><small>Выберите предмет и нажимайте на клетки — или перетаскивайте его мышью. Уроки тоже можно перетаскивать между клетками (займёт место — поменяются).</small><div class="pchips">${subs.map(s => `<button class="pchip ${x.pick === s.id ? 'on' : ''}" draggable="true" data-act="sch-pick" data-id="${s.id}" aria-pressed="${x.pick === s.id}">${esc(s.e || '📘')} ${esc(s.ru)}</button>`).join('')}<button class="pchip erase ${x.pick === '__erase' ? 'on' : ''}" data-act="sch-pick" data-id="__erase" aria-pressed="${x.pick === '__erase'}">🧽 Стирать</button>${!subs.length ? '<span class="muted">Нет предметов — добавьте на вкладке «1. Предметы».</span>' : ''}</div></div>` : '';
  const editor = ed && x.cell && Sch.timeOf(D, cid, x.cell.d, x.cell.n) ? (() => { const l = Sch.lessonAt(D, cid, x.cell.d, x.cell.n) || { s: '', t: null, r: '' };
    return `<form class="card cellform noprint" data-form="sch-cell"><h3 class="tp">${Sch.DAYS[x.cell.d - 1][1]}, урок ${x.cell.n} (${Sch.timeOf(D, cid, x.cell.d, x.cell.n).s}–${Sch.timeOf(D, cid, x.cell.d, x.cell.n).e})</h3><div class="frow3"><label>Предмет<select name="s" required><option value="">— выберите —</option>${subs.map(s => `<option value="${s.id}" ${l.s === s.id ? 'selected' : ''}>${esc(s.ru)}</option>`).join('')}</select></label><label>Учитель<select name="t"><option value="">— не указан —</option>${teachers().map(t => `<option value="${t.id}" ${l.t === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label>Кабинет<input name="r" maxlength="12" value="${esc(l.r || '')}"></label></div><div class="btns"><button class="btn blue" type="submit">Сохранить</button><button class="btn ghost" type="button" data-act="sch-cell-clear">Очистить клетку</button><button class="btn ghost" type="button" data-act="sch-cell-close">Закрыть</button></div></form>`; })() : '';
  const tools = ed ? `<div class="card tools noprint"><form class="inl" data-form="sch-copyday"><b>Копировать день</b><select name="from">${Sch.DAYS.map(([d, f]) => `<option value="${d}">${f}</option>`).join('')}</select>→<select name="to">${Sch.DAYS.map(([d, f], i) => `<option value="${d}" ${i === 1 ? 'selected' : ''}>${f}</option>`).join('')}</select><button class="btn sm ghost" type="submit">Копировать</button></form>
    <form class="inl" data-form="sch-copycls"><b>Взять из класса</b><select name="from">${cl.filter(c => c.id !== cid).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm ghost" type="submit">Скопировать сюда</button></form>
    <button class="btn sm ghost" data-act="sch-clearcls">Очистить класс</button></div>` : '';
  const confHtml = conf.length ? `<section class="card warncard"><h2 class="tp">Нужно исправить (${conf.length})</h2>${conf.slice(0, 12).map(c => `<div class="row warn"><div><b>${esc(c.msg)}</b>${c.b ? `<small>${esc(cname(c.a.c))} и ${esc(cname(c.b.c))}</small>` : `<small>${esc(cname(c.a.c))}</small>`}</div></div>`).join('')}${conf.length > 12 ? `<small>…и ещё ${conf.length - 12}</small>` : ''}</section>` : (D.lessons.length ? '<div class="okline">✓ Пересечений учителей и кабинетов нет</div>' : '');
  const sum = Sch.summary(D, cl);
  const foot = `<div class="card noprint submitbar"><div><b>${esc(v.title)}</b> ${badge(v)}<small>Уроков всего: ${D.lessons.length}. ${sum.filter(s => !s.n).length ? 'Классы без уроков: ' + sum.filter(s => !s.n).map(s => esc(s.c.name)).join(', ') + '.' : 'Во всех классах есть уроки.'} ${S.state().session && S.isLive() && S.pending() ? 'Сохранение…' : 'Все изменения сохранены.'}</small></div><div class="btns">
    ${S.schedCan.edit(v) && !S.schedCan.approve() ? `<button class="btn blue" data-act="sch-submit" data-id="${v.id}" ${conf.length ? 'disabled title="Сначала исправьте пересечения"' : ''}>Отправить директору</button>` : ''}
    ${S.schedCan.edit(v) && S.schedCan.approve() ? `<button class="btn blue" data-act="sch-publish" data-id="${v.id}" ${conf.length ? 'disabled title="Сначала исправьте пересечения"' : ''}>Опубликовать</button>` : ''}
    ${v.status === 'pending' && S.schedCan.approve() ? `<button class="btn blue" data-act="sch-approve" data-id="${v.id}">Одобрить</button><button class="btn ghost" data-act="sch-reject" data-id="${v.id}">Отклонить…</button>` : ''}
    <button class="btn ghost" data-act="sch-print">🖨 Печать</button></div></div>`;
  return `<div class="buildbar noprint"><label class="inl">Класс <select data-sch="cls">${cl.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${ed ? '' : '<small class="muted">Режим просмотра</small>'}</div>
  ${pal}${gridHtml}${editor}${tools}${confHtml}${foot}${X().reject === v.id ? `<form class="card form rejectf" data-form="sch-reject"><input type="hidden" name="id" value="${v.id}"><label>Причина (её получит завуч)<textarea name="note" rows="2" minlength="3" required></textarea></label><div class="btns"><button class="btn blue" type="submit">Отклонить и уведомить</button><button class="btn ghost" type="button" data-act="sch-reject-cancel">Отмена</button></div></form>` : ''}`;
}

// ---- вкладка «Комментарии» ----
function inbox() {
  const list = S.schedComments();
  return `<section class="card"><h2 class="tp">Комментарии учителей</h2><p class="muted">Учителя предлагают улучшения расписания. Отметьте «Рассмотрено», когда учтёте.</p>${list.map(c => `<div class="row"><div><b>${esc(c.name || 'Учитель')}</b><p>${esc(c.text)}</p><small>${dtFmt(c.ts)}</small></div><button class="btn sm ${c.resolved ? 'ghost' : 'blue'} noprint" data-act="sch-resolve" data-id="${c.id}" data-on="${c.resolved ? 0 : 1}">${c.resolved ? 'Вернуть в работу' : 'Рассмотрено'}</button></div>`).join('') || '<p class="muted">Комментариев пока нет.</p>'}</section>`;
}

// ===================== события =====================
function placeSubject(v, cid, d, n, subj) {
  const D = v.data, ex = Sch.lessonAt(D, cid, d, n), room = (D.lessons.find(l => l.c === cid && l.s === subj && l.r) || {}).r || '';
  return Sch.setLesson(D, cid, d, n, ex && ex.s === subj ? { s: subj } : { s: subj, t: suggestTeacher(cid, subj), r: room });
}
const curVer = () => { const x = X(); const v = x.vid && S.schedVersion(x.vid); return v && S.schedCan.edit(v) ? v : null; };
const save = (v, data) => { if (!S.schedEdit(v.id, data)) toast('Эту версию нельзя править', 'warn'); };

export async function act(name, el) {
  const x = X(), id = el.dataset.id;
  if (!name.startsWith('sch-') && !name.startsWith('sub-')) return false;
  switch (name) {
    case 'sch-tab': x.tab = el.dataset.tab; rerender(); return true;
    case 'sch-view': x.view = el.dataset.v; rerender(); return true;
    case 'sch-open': x.vid = id; x.tab = el.dataset.tab || 'build'; x.cell = null; rerender(); return true;
    case 'sch-copy': await guard(async () => { const nid = S.schedCreate({ title: 'Правка: ' + S.schedVersion(id).title, from: id }); x.vid = nid; x.tab = 'build'; toast('Создана копия — правьте её', 'ok'); rerender(); }); return true;
    case 'sch-pick': x.pick = x.pick === id ? null : id; x.cell = null; rerender(); return true;
    case 'sch-cell': {
      const v = curVer(); if (!v) return true; const d = Number(el.dataset.d), n = Number(el.dataset.n);
      if (x.pick === '__erase') { save(v, Sch.setLesson(v.data, x.cls, d, n, null)); return true; }
      if (x.pick) { save(v, placeSubject(v, x.cls, d, n, x.pick)); return true; }
      x.cell = x.cell && x.cell.d === d && x.cell.n === n ? null : { d, n }; rerender(); return true;
    }
    case 'sch-cell-clear': { const v = curVer(); if (v && x.cell) { save(v, Sch.setLesson(v.data, x.cls, x.cell.d, x.cell.n, null)); x.cell = null; rerender(); } return true; }
    case 'sch-cell-close': x.cell = null; rerender(); return true;
    case 'sch-shifts': { const v = curVer(); if (!v) return true; const k = Number(el.dataset.n), D = Sch.clone(v.data); D.shifts = D.shifts || [];
      if (k < D.shifts.length && !confirm('Убрать смену? Классы этой смены перейдут на 1-ю смену.')) return true;
      while (D.shifts.length < k) { const i = D.shifts.length + 1; D.shifts.push({ ...Sch.defaultShift(i, i === 2 ? '13:30' : '17:30'), count: 6 }); D.bells[i] = Sch.genBells(D.shifts[i - 1]); }
      while (D.shifts.length > k) { const rm = D.shifts.pop(); delete D.bells[rm.id]; Object.values(D.cs).forEach(m => Object.keys(m).forEach(d => { if (m[d] === rm.id) m[d] = 1; })); }
      save(v, Sch.prune(D)); return true; }
    case 'sch-clearcls': { const v = curVer(); if (v && confirm('Убрать все уроки этого класса?')) { const D = Sch.clone(v.data); D.lessons = D.lessons.filter(l => l.c !== x.cls); save(v, D); } return true; }
    case 'sch-submit': await guard(async () => { await S.schedSubmit(id); toast('Отправлено директору на одобрение', 'ok'); x.tab = 'versions'; rerender(); }); return true;
    case 'sch-publish': if (confirm('Опубликовать расписание? Оно сразу заработает у всех, предыдущее уйдёт в архив.')) await guard(async () => { await S.schedPublish(id); toast('Расписание опубликовано', 'ok'); x.tab = 'versions'; rerender(); }); return true;
    case 'sch-approve': await guard(async () => { await S.schedDecide(id, true, ''); toast('Одобрено — расписание действует', 'ok'); x.tab = 'versions'; x.reject = null; rerender(); }); return true;
    case 'sch-reject': x.reject = id; rerender(); return true;
    case 'sch-reject-cancel': x.reject = null; rerender(); return true;
    case 'sch-delete': if (confirm('Удалить эту версию?')) await guard(async () => { await S.schedDelete(id); if (x.vid === id) x.vid = null; toast('Удалено', 'ok'); rerender(); }); return true;
    case 'sch-resolve': await guard(() => S.schedResolve(id, el.dataset.on === '1')); return true;
    case 'sch-print': window.print(); return true;
    case 'sub-hide': await guard(() => S.setSubjectHidden(id, true)); return true;
    case 'sub-show': await guard(() => S.setSubjectHidden(id, false)); return true;
    case 'sub-del': if (confirm('Удалить предмет из школы?')) await guard(async () => { await S.removeSubject(id); toast('Предмет удалён', 'ok'); }); return true;
  }
  return false;
}
export function onChange(el) {
  const k = el.dataset && el.dataset.sch; if (!k) return false; const x = X();
  if (k === 'cls') { x.cls = el.value; x.cell = null; rerender(); return true; }
  if (k === 'ver') { x.vid = el.value || null; x.cell = null; rerender(); return true; }
  const v = curVer(); if (!v) return true;
  if (k === 'cs') { const D = Sch.clone(v.data); (D.cs[el.dataset.c] = D.cs[el.dataset.c] || {})[el.dataset.d] = Number(el.value); save(v, Sch.prune(D)); return true; }
  if (k === 'cs-all') { if (!el.value) return true; const D = Sch.clone(v.data); D.cs[el.dataset.c] = D.cs[el.dataset.c] || {}; [1, 2, 3, 4, 5].forEach(d => { D.cs[el.dataset.c][d] = Number(el.value); }); save(v, Sch.prune(D)); return true; }
  if (k === 'bell') { if (!el.value) return true; const D = Sch.clone(v.data), b = (D.bells[el.dataset.sh] || []).find(z => z.n === Number(el.dataset.n)); if (b) { b[el.dataset.f] = el.value; save(v, D); } return true; }
  return false;
}
export async function submit(form, fd) {
  const f = form.dataset.form, x = X(); if (!f || !(f.startsWith('sch-') || f.startsWith('sub-'))) return false;
  const v = curVer();
  if (f === 'sch-new') { await guard(async () => { x.vid = S.schedCreate({ title: String(fd.get('title')), from: fd.get('from') || null }); x.tab = 'subjects'; toast('Версия создана. Шаг 1: проверьте список предметов', 'ok'); rerender(); }); return true; }
  if (f === 'sub-add') { await guard(async () => { await S.addSubject({ ru: String(fd.get('ru')), ky: String(fd.get('ky') || ''), e: String(fd.get('e')) }); toast('Предмет добавлен', 'ok'); form.reset && form.reset(); }); return true; }
  if (f === 'sch-comment') { await guard(async () => { await S.schedComment(String(fd.get('text'))); toast('Отправлено завучу', 'ok'); }); return true; }
  if (f === 'sch-reject') { await guard(async () => { await S.schedDecide(String(fd.get('id')), false, String(fd.get('note'))); x.reject = null; toast('Отклонено — завуч получил уведомление', 'ok'); rerender(); }); return true; }
  if (!v) return true;
  if (f === 'sch-shift') {
    const D = Sch.clone(v.data), sh = D.shifts.find(z => z.id === Number(fd.get('id'))); if (!sh) return true;
    Object.assign(sh, { name: String(fd.get('name') || sh.name).slice(0, 30), first: String(fd.get('first')), count: Math.max(1, Math.min(Sch.MAX_LESSONS, Number(fd.get('count')))), len: Math.max(20, Number(fd.get('len'))), brk: Math.max(0, Number(fd.get('brk'))), long: { after: Number(fd.get('lafter')) || 0, min: Number(fd.get('lmin')) || 0 } });
    D.bells[sh.id] = Sch.genBells(sh); save(v, Sch.prune(D)); toast('Звонки пересчитаны', 'ok'); return true;
  }
  if (f === 'sch-cell') { if (!x.cell) return true; const s = String(fd.get('s')); if (!s) return true; save(v, Sch.setLesson(v.data, x.cls, x.cell.d, x.cell.n, { s, t: fd.get('t') || null, r: String(fd.get('r') || '').trim() })); x.cell = null; rerender(); return true; }
  if (f === 'sch-copyday') { const a = Number(fd.get('from')), b = Number(fd.get('to')); if (a === b) { toast('Выберите разные дни', 'warn'); return true; } save(v, Sch.copyDay(v.data, x.cls, a, b)); toast('День скопирован', 'ok'); return true; }
  if (f === 'sch-copycls') { const from = fd.get('from'); if (from && confirm('Уроки этого класса будут заменены. Продолжить?')) { save(v, Sch.copyClass(v.data, from, x.cls)); toast('Скопировано', 'ok'); } return true; }
  return false;
}

// ---- перетаскивание (HTML5 drag & drop) ----
let drag = null;
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('[data-act=sch-cell][draggable=true]'), p = e.target.closest && e.target.closest('.pchip[draggable=true]');
  if (!c && !p) return; ui.dragging = true;
  drag = c ? { kind: 'cell', d: Number(c.dataset.d), n: Number(c.dataset.n) } : (p.dataset.id === '__erase' ? null : { kind: 'subj', id: p.dataset.id });
  if (!drag) { e.preventDefault(); return; }
  try { e.dataTransfer.setData('text/plain', 'sabak'); e.dataTransfer.effectAllowed = 'copyMove'; } catch {}
  (c || p).classList.add('dragging');
});
document.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('[data-act=sch-cell]'); if (t && drag && curVer()) { e.preventDefault(); document.querySelectorAll('.cell.over').forEach(z => z !== t && z.classList.remove('over')); t.classList.add('over'); } });
document.addEventListener('dragleave', e => { const t = e.target.closest && e.target.closest('[data-act=sch-cell]'); if (t) t.classList.remove('over'); });
document.addEventListener('drop', e => {
  const t = e.target.closest && e.target.closest('[data-act=sch-cell]'), v = curVer(); if (!t || !drag || !v) return; e.preventDefault();
  const x = X(), d = Number(t.dataset.d), n = Number(t.dataset.n);
  if (drag.kind === 'subj') save(v, placeSubject(v, x.cls, d, n, drag.id));
  else if (!(drag.d === d && drag.n === n)) save(v, Sch.moveLesson(v.data, { c: x.cls, d: drag.d, n: drag.n }, { c: x.cls, d, n }));
  drag = null; ui.dragging = false;
});
document.addEventListener('dragend', () => { drag = null; ui.dragging = false; document.querySelectorAll('.dragging,.over').forEach(z => z.classList.remove('dragging', 'over')); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.cell[data-act=sch-cell]')) { e.preventDefault(); e.target.click(); } });
