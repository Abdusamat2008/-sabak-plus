// Центр управления платформой (суперадмин): обзор, школы, директора, входящие, ключи, рассылка, люди, журнал, система.
import * as S from './store.js';
import * as D from './superdata.js';
import * as Archive from './archive.js';
import { esc, ui, head, toast, plural, downloadBlob, copyText } from './common.js';

const rerender = () => window.__render && window.__render();
const live = () => S.isLive();
const cache = {};
const fresh = k => { if (k) Object.keys(cache).filter(x => x === k || x.startsWith(k + ':')).forEach(x => delete cache[x]); else Object.keys(cache).forEach(x => delete cache[x]); };
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
const wait = r => r === 'loading' ? '<div class="card"><p class="muted" role="status">Загружаем…</p></div>' : (r && r.err) ? `<div class="card"><p>⚠️ ${esc(r.err)}</p></div>` : null;
const X = () => (ui.sup = ui.sup || { q: '', st: 'all', sort: 'new', tab: 'tickets', city: '', key: null, uq: '', aud: { school: '', action: '' } });
const need = r => { if (!r || !r.ok) throw new Error(({ forbidden: 'Нет доступа', not_found: 'Не найдено', empty: 'Заполните поля', bad_name: 'Слишком короткое название' })[r && r.error] || (r && r.error) || 'Ошибка'); return r; };

// ---------- форматирование ----------
const dmy = s => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return s; } };
const dt = s => { if (!s) return '—'; try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };
const ago = s => { if (!s) return 'никогда'; const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); if (m < 2) return 'только что'; if (m < 60) return m + ' мин назад'; const h = Math.round(m / 60); if (h < 36) return h + ' ч назад'; const d = Math.round(h / 24); return d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад'; };
const num = n => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));
const pct = n => (n == null ? '—' : n + '%');
const digits = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '996' + d.slice(1); return d; };
const wa = (p, text = '') => `https://wa.me/${digits(p)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
const ROLE = { director: 'Директор', deputy: 'Завуч', teacher: 'Учитель', parent: 'Родитель', student: 'Ученик', superadmin: 'Суперадмин' };
const ACT = { 'super.school_suspended': 'Школа приостановлена', 'super.school_active': 'Школа возобновлена', 'super.school_renamed': 'Школа переименована', 'super.announce': 'Рассылка', 'super.key_issued': 'Выпущен ключ школы', 'super.cleanup': 'Очистка служебных данных', 'super.archive_all': 'Архив всех школ', 'super.user_blocked': 'Пользователь заблокирован', 'super.user_active': 'Пользователь разблокирован', 'archive.closed': 'Учебный год сохранён в архив', 'invite.created': 'Создано приглашение', 'invite.redeemed': 'Принято приглашение', 'schedule.published': 'Расписание опубликовано', 'class.created': 'Создан класс' };
const actName = a => ACT[a] || a;
const kpi = (l, v, sub = '', cls = '') => `<div class="kpi ${cls}"><small>${l}</small><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
const pill = (t, cls = '') => `<span class="pillx ${cls}">${esc(t)}</span>`;
const stPill = s => s.status === 'suspended' ? pill('Приостановлена', '') : pill('Работает', 'ok');
function bars(series, h = 70) {
  const max = Math.max(1, ...series.map(x => x[1])), w = 100 / series.length;
  return `<svg class="sbars" viewBox="0 0 100 ${h}" preserveAspectRatio="none" role="img" aria-label="График за 30 дней">${series.map((x, i) => { const bh = Math.round(x[1] / max * (h - 6)); return `<rect x="${(i * w + w * .14).toFixed(2)}" y="${h - bh}" width="${(w * .72).toFixed(2)}" height="${bh}" rx=".6"><title>${esc(String(x[0]).slice(5))}: ${x[1]}</title></rect>`; }).join('')}</svg>`;
}
const hbar = (label, v, max, extra = '') => `<div class="hb"><span>${esc(label)}</span><i><u style="width:${max ? Math.max(2, Math.round(v / max * 100)) : 0}%"></u></i><em>${extra || num(v)}</em></div>`;
const contacts = p => `<div class="cbtns">${p && p.phone ? `<a class="btn sm wa" href="${wa(p.phone)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">Позвонить</a>` : ''}${p && p.email ? `<a class="btn sm" href="mailto:${esc(p.email)}">Email</a>` : ''}</div>`;
export const TABS = [['super', 'Обзор'], ['super/schools', 'Школы'], ['super/directors', 'Директора'], ['super/inbox', 'Входящие'], ['super/keys', 'Ключи'], ['super/broadcast', 'Рассылка'], ['super/users', 'Люди'], ['super/audit', 'Журнал'], ['super/system', 'Система']];
const tabs = cur => `<nav class="subtabs" aria-label="Разделы">${TABS.map(([h, n]) => `<a href="#/${h}" class="${cur === h ? 'on' : ''}">${n}</a>`).join('')}</nav>`;

// ---------- данные ----------
const schoolsList = () => load('schools', async () => need(await D.call('super_schools')).schools);
const schoolCard = id => load('school:' + id, async () => need(await D.call('super_school', { p_id: id })).school);
const dashboard = () => load('dash', async () => need(await D.call('super_dashboard')).data);
const nameOf = (list, id) => { const s = Array.isArray(list) && list.find(x => x.id === id); return s ? s.name : 'Школа'; };

// ---------- страницы ----------
export function page(parts) {
  const [a, b, c, ...rest] = parts;
  if (!a) return dashboardPage();
  if (a === 'schools') return schoolsPage();
  if (a === 's') return schoolPage(b, c || 'overview', rest);
  if (a === 'directors') return directorsPage();
  if (a === 'inbox') return inboxPage();
  if (a === 'keys') return keysPage();
  if (a === 'broadcast') return broadcastPage();
  if (a === 'users') return usersPage();
  if (a === 'audit') return auditPage();
  if (a === 'system') return systemPage();
  return dashboardPage();
}

function dashboardPage() {
  const d = dashboard(), w = wait(d), L = schoolsList();
  const now = Archive.endedLabel() || Archive.yearLabelOf();
  if (w) return head('Центр управления', 'SABAK+', 'Вся платформа в одном месте') + tabs('super') + w;
  const att = [];
  if (d.inactive.length) att.push(`<li class="warn"><i>!</i><span><b>${d.inactive.length} ${plural(d.inactive.length, 'школа', 'школы', 'школ')}</b> без оценок больше 14 дней: ${d.inactive.slice(0, 3).map(s => `<a href="#/super/s/${s.id}">${esc(s.name)}</a>`).join(', ')}${d.inactive.length > 3 ? '…' : ''}</span></li>`);
  if (d.tickets_open) att.push(`<li class="warn"><i>✉</i><span><a href="#/super/inbox"><b>${d.tickets_open}</b> ${plural(d.tickets_open, 'открытое обращение', 'открытых обращения', 'открытых обращений')}</a> от директоров ждёт ответа</span></li>`);
  if (d.requests_new) att.push(`<li class="warn"><i>＋</i><span><a href="#/super/inbox"><b>${d.requests_new}</b> ${plural(d.requests_new, 'новая заявка', 'новые заявки', 'новых заявок')}</a> на подключение школ</span></li>`);
  if (d.pending) att.push(`<li class="info"><i>i</i><span>${d.pending} ${plural(d.pending, 'сотрудник ждёт', 'сотрудника ждут', 'сотрудников ждут')} подтверждения директором</span></li>`);
  if (d.suspended) att.push(`<li class="info"><i>⏸</i><span>Приостановлено школ: ${d.suspended}</span></li>`);
  if (!att.length) att.push('<li class="ok"><i>✓</i><span>Всё спокойно: срочных дел нет</span></li>');
  const maxRole = Math.max(...Object.values(d.roles));
  return `${head('Центр управления', 'SABAK+', 'Вся платформа в одном месте')}${tabs('super')}
  <div class="kpis">${kpi('Школ', d.schools, d.suspended ? `приостановлено: ${d.suspended}` : 'все работают')}${kpi('Учеников', num(d.students))}${kpi('Учителей', num(d.teachers))}${kpi('Родителей', num(d.parents))}
    ${kpi('Оценок за 7 дней', num(d.grades_7d), `всего ${num(d.grades)}`)}${kpi('Обращения', d.tickets_open, 'ждут ответа', d.tickets_open ? 'alert' : '')}${kpi('Заявки', d.requests_new, 'новых', d.requests_new ? 'alert' : '')}${kpi('База данных', d.db_mb + ' МБ', `ключей свободно: ${d.keys_free}`)}</div>
  <div class="card"><h3>Требует внимания</h3><ul class="concl">${att.join('')}</ul></div>
  <div class="grid2">
    <div class="card"><h3>Оценки за 30 дней, все школы</h3>${bars(d.grades_by_day)}<p class="muted">Всего за период: ${num(d.grades_by_day.reduce((n, x) => n + x[1], 0))}</p></div>
    <div class="card"><h3>Новые аккаунты по неделям</h3>${bars(d.signups_by_week)}<p class="muted">Последние ${d.signups_by_week.length} недель</p></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Кто пользуется платформой</h3>${Object.entries(d.roles).filter(([r]) => r !== 'superadmin').sort((x, y) => y[1] - x[1]).map(([r, n]) => hbar(ROLE[r] || r, n, maxRole)).join('')}</div>
    <div class="card"><h3>Самые активные школы (оценок за 30 дней)</h3>${d.top.map(t => hbar(t.name, t.n, d.top[0] ? d.top[0].n : 1)).join('') || '<p class="muted">Пока пусто</p>'}</div>
  </div>
  <div class="card"><h3>Быстрые действия</h3><div class="cbtns">
    <a class="btn blue" href="#/super/keys">🔑 Выпустить ключ школы</a><a class="btn" href="#/super/broadcast">📣 Написать всем директорам</a>
    <button class="btn" data-act="sup-archive-all" data-label="${esc(now)}">🗄 Архив ${esc(now)} во всех школах</button><a class="btn" href="#/super/system">🧹 Очистить служебные данные</a>
    <button class="btn" data-act="sup-export-schools">⬇ Школы в CSV</button></div></div>`;
}

function filterSchools(list) {
  const x = X(), q = x.q.trim().toLowerCase();
  let r = list.filter(s => (x.st === 'all' || s.status === x.st || (x.st === 'attention' && needsAttention(s))) && (!q || (s.name + ' ' + (s.city || '') + ' ' + s.code + ' ' + ((s.director || {}).name || '')).toLowerCase().includes(q)));
  const by = { new: (a, b) => new Date(b.created) - new Date(a.created), name: (a, b) => a.name.localeCompare(b.name), students: (a, b) => b.stats.students - a.stats.students, act: (a, b) => b.stats.grades_30d - a.stats.grades_30d };
  return r.sort(by[x.sort] || by.new);
}
const needsAttention = s => s.status === 'active' && (!s.stats.last_grade || (Date.now() - new Date(s.stats.last_grade).getTime()) > 14 * 864e5 || s.stats.pending > 0);
function schoolRow(s) {
  const d = s.director || {};
  return `<a class="card sch" href="#/super/s/${s.id}"><div class="sch-h"><b>${esc(s.name)}</b>${stPill(s)}</div>
    <small class="muted">${esc(s.city || '')} · код ${esc(s.code)} · с ${dmy(s.created)}</small>
    <div class="sch-m"><span><b>${num(s.stats.students)}</b> уч.</span><span><b>${s.stats.teachers}</b> учит.</span><span><b>${num(s.stats.grades_30d)}</b> оц./30д</span><span>ср. <b>${s.stats.avg ?? '—'}</b></span><span>посещ. <b>${pct(s.stats.att_pct)}</b></span></div>
    <small>Директор: <b>${esc(d.name || '—')}</b>${d.phone ? ' · ' + esc(d.phone) : ''}</small>
    <small class="muted">Последние оценки: ${s.stats.last_grade ? ago(s.stats.last_grade) : 'ещё не было'}${s.stats.pending ? ` · <b style="color:var(--g2,#a3231c)">ждут подтверждения: ${s.stats.pending}</b>` : ''}</small></a>`;
}
function schoolsPage() {
  const L = schoolsList(), w = wait(L), x = X();
  const filters = [['all', 'Все'], ['active', 'Работают'], ['suspended', 'Приостановлены'], ['attention', 'Требуют внимания']];
  return `${head('Школы', '', 'Все школы платформы: поиск, фильтры, карточка до мелочей', `<button class="btn" data-act="sup-export-schools">⬇ CSV</button>`)}${tabs('super/schools')}
  <div class="card"><div class="frow2"><label class="fld"><span>Поиск</span><input id="schQ" type="search" placeholder="Название, город, код или директор" value="${esc(x.q)}" autocomplete="off"></label>
    <label class="fld"><span>Сортировка</span><select data-sup="sort">${[['new', 'Сначала новые'], ['name', 'По названию'], ['students', 'По числу учеников'], ['act', 'По активности']].map(([v, n]) => `<option value="${v}" ${x.sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <div class="tabs noprint">${filters.map(([v, n]) => `<button class="tag ${x.st === v ? 'on' : ''}" data-act="sup-filter" data-v="${v}">${n}</button>`).join('')}</div></div>
  ${w || `<div id="schList" class="archgrid">${renderList(L)}</div>`}`;
}
const renderList = L => { const r = filterSchools(L); return r.length ? r.map(schoolRow).join('') : '<div class="card"><p class="muted">Ничего не найдено.</p></div>'; };

const STAB = [['overview', 'Обзор'], ['people', 'Люди'], ['classes', 'Классы'], ['archive', 'Архив'], ['support', 'Обращения'], ['notes', 'Заметки'], ['log', 'Журнал'], ['actions', 'Управление']];
function schoolPage(id, tab, rest) {
  const c = schoolCard(id), w = wait(c);
  if (w) return `<nav class="crumbs"><a href="#/super/schools">Школы</a></nav>${w}`;
  const base = `super/s/${id}`, st = c.stats, d = c.staff.find(u => u.role === 'director');
  const tabsHtml = `<nav class="subtabs" aria-label="Разделы школы">${STAB.map(([k, n]) => `<a href="#/${base}/${k}" class="${tab === k ? 'on' : ''}">${n}</a>`).join('')}</nav>`;
  const top = `<nav class="crumbs"><a href="#/super/schools">Школы</a><i>›</i><span>${esc(c.name)}</span></nav>${head(c.name, c.city || '', `Код школы: <b>${esc(c.code)}</b> · подключена ${dmy(c.created)} ${c.status === 'suspended' ? '· <b>приостановлена</b>' + (c.reason ? ': ' + esc(c.reason) : '') : ''}`)}${tabsHtml}`;
  let body = '';
  if (tab === 'overview') {
    const maxD = Math.max(1, ...Object.values(c.grade_dist || {}).map(Number));
    body = `${d ? `<div class="card"><h3>Директор</h3><div class="row"><div><b>${esc(d.name)}</b><small class="muted">${esc(d.phone || 'телефон не указан')} · ${esc(d.email || 'почта скрыта')}<br>Последний вход: ${ago(d.last)}</small></div></div>${contacts(d)}</div>` : '<div class="card"><p>Директор не найден.</p></div>'}
    <div class="kpis">${kpi('Учеников', num(st.students), st.demo_students ? `+ демо: ${st.demo_students}` : '')}${kpi('Родителей', num(st.parents))}${kpi('Учителей', st.teachers, `завучей: ${st.deputies}`)}${kpi('Классов', st.classes)}
      ${kpi('Оценок всего', num(st.grades), `за 30 дней: ${num(st.grades_30d)}`)}${kpi('Средний балл', st.avg ?? '—')}${kpi('Посещаемость', pct(st.att_pct), 'за 30 дней')}${kpi('Фото ученикам', pct(st.photo_pct), 'загружено')}
      ${kpi('Документы в «делах»', pct(st.docs_pct), 'собрано')}${kpi('Приглашений активно', st.invites_active)}${kpi('Анонимных обращений', st.anon_msgs, `новых: ${st.anon_unread}`)}${kpi('Предметов', st.subjects)}
      ${kpi('Лет в архиве', st.years)}${kpi('Ждут подтверждения', st.pending, '', st.pending ? 'alert' : '')}${kpi('Заблокировано', st.blocked)}${kpi('Последняя оценка', st.last_grade ? ago(st.last_grade) : '—')}</div>
    <div class="card"><h3>Расписание</h3><p>${st.sched ? `Действует: <b>${esc(st.sched.title)}</b> (обновлено ${dmy(st.sched.at)})` : 'Утверждённого расписания пока нет.'}${st.sched_pending ? ` · <b>ждёт одобрения директора: ${st.sched_pending}</b>` : ''}</p></div>
    <div class="grid2"><div class="card"><h3>Оценки за 30 дней</h3>${bars(c.by_day)}</div>
    <div class="card"><h3>Распределение оценок</h3>${[5, 4, 3, 2].map(v => hbar('Оценка ' + v, Number((c.grade_dist || {})[v] || 0), maxD)).join('')}</div></div>
    <div class="card"><h3>Приглашения</h3><div class="chips2">${pill('активных: ' + c.invites.active, 'ok')}${pill('использовано: ' + c.invites.used)}${pill('истекло: ' + c.invites.expired)}${pill('отозвано: ' + c.invites.revoked)}</div></div>`;
  } else if (tab === 'people') {
    body = `<div class="card"><h3>Сотрудники (${c.staff.length})</h3><div class="dtable">${c.staff.map(u => `<div class="row ppl"><div><b>${esc(u.name)}</b> ${pill(ROLE[u.role] || u.role)} ${u.status === 'pending' ? pill('ждёт подтверждения') : u.status === 'blocked' ? pill('заблокирован') : ''}
      <small class="muted">${esc(u.phone || '—')} · ${esc(u.email || 'почта не показана')} · вход: ${ago(u.last)} · с ${dmy(u.created)}</small></div>
      <div class="cbtns">${u.phone ? `<a class="btn sm wa" href="${wa(u.phone)}" target="_blank" rel="noopener">WA</a>` : ''}${u.role !== 'director' || u.status === 'blocked' ? `<button class="btn sm" data-act="sup-user" data-id="${u.id}" data-to="${u.status === 'blocked' ? 'active' : 'blocked'}">${u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</button>` : `<button class="btn sm" data-act="sup-user" data-id="${u.id}" data-to="blocked">Заблокировать</button>`}</div></div>`).join('')}</div>
      <p class="muted">Ученики и родители здесь не показываются поимённо: суперадмин видит только сводки. Просмотр личных данных детей — только у школы и родителей.</p></div>`;
  } else if (tab === 'classes') {
    body = `<div class="card"><h3>Классы (${c.classes.length})</h3><table class="tbl"><thead><tr><th>Класс</th><th>Язык</th><th>Кл. руководитель</th><th>Учеников</th><th>Ср. балл</th></tr></thead><tbody>${c.classes.map(k => `<tr><td><b>${esc(k.name)}</b></td><td>${k.lang === 'ky' ? 'кыргызский' : 'русский'}</td><td>${esc(k.homeroom || '—')}</td><td>${k.students}</td><td>${k.avg ?? '—'}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (tab === 'archive') {
    body = Archive.schoolArchive(`${base}/archive`, id, c.name, rest, [['super/schools', 'Школы'], [base, c.name], [`${base}/archive`, 'Архив']]);
  } else if (tab === 'support') {
    body = `<div class="card"><h3>Обращения директора</h3>${c.tickets.length ? c.tickets.map(t => `<a class="row" href="#/super/inbox"><div><b>${esc(t.subject)}</b><small class="muted">${dt(t.at)}</small></div>${pill(({ open: 'ждёт ответа', answered: 'отвечено', closed: 'закрыто' })[t.status], t.status === 'open' ? '' : 'ok')}</a>`).join('') : '<p class="muted">Обращений не было.</p>'}</div>`;
  } else if (tab === 'notes') {
    body = `<div class="card"><h3>Заметки о школе (видны только суперадмину)</h3><form data-form="sup-note" class="inline"><input type="hidden" name="school" value="${id}"><label class="fld"><span>Новая заметка</span><textarea name="text" rows="3" required maxlength="2000" placeholder="Договорённости, особенности, что обещали..."></textarea></label><label class="chk"><input type="checkbox" name="pinned"> Закрепить сверху</label><button class="btn blue" type="submit">Добавить</button></form></div>
      ${c.notes.map(n => `<div class="card note">${n.pinned ? '📌 ' : ''}${esc(n.text)}<small class="muted"> — ${esc(n.by || '')}, ${dt(n.at)}</small><div class="cbtns"><button class="btn sm" data-act="sup-note-del" data-id="${n.id}">Удалить</button></div></div>`).join('') || '<p class="muted">Заметок пока нет.</p>'}`;
  } else if (tab === 'log') {
    body = `<div class="card"><h3>Последние действия в школе</h3>${auditRows(c.audit.map(a => ({ ...a, school: c.name })), false)}</div>`;
  } else if (tab === 'actions') {
    body = `<div class="card"><h3>Название и город</h3><form data-form="sup-rename" class="inline"><input type="hidden" name="id" value="${id}"><label class="fld"><span>Название</span><input name="name" value="${esc(c.name)}" required></label><label class="fld"><span>Город</span><input name="city" value="${esc(c.city || '')}"></label><button class="btn" type="submit">Сохранить</button></form></div>
    <div class="card"><h3>Написать директору (колокольчик в приложении)</h3><form data-form="sup-announce" class="inline"><input type="hidden" name="school" value="${id}"><label class="fld"><span>Тема</span><input name="title" required minlength="3"></label><label class="fld"><span>Сообщение</span><textarea name="body" rows="3" required minlength="3"></textarea></label><button class="btn blue" type="submit">Отправить</button></form></div>
    <div class="card"><h3>${c.status === 'suspended' ? 'Школа приостановлена' : 'Приостановить доступ'}</h3>
      <p class="muted">Приостановленная школа не видит свои данные (директор увидит сообщение с причиной). Данные не удаляются. Доступ можно вернуть в любой момент.</p>
      ${c.status === 'suspended' ? `<button class="btn blue" data-act="sup-school-status" data-id="${id}" data-to="active">Возобновить доступ</button>` : `<form data-form="sup-suspend" class="inline"><input type="hidden" name="id" value="${id}"><label class="fld"><span>Причина (увидит директор)</span><input name="reason" placeholder="Например: техническое обслуживание" maxlength="200"></label><button class="btn" type="submit">⏸ Приостановить</button></form>`}</div>
    <div class="card"><h3>Выгрузка</h3><div class="cbtns"><button class="btn" data-act="sup-export-school" data-id="${id}">⬇ Карточка школы (JSON)</button></div></div>`;
  }
  return top + body;
}

function directorsPage() {
  const L = schoolsList(), w = wait(L);
  if (w) return head('Директора', '', 'Связь с каждым руководителем школы') + tabs('super/directors') + w;
  return `${head('Директора', '', 'Связь с каждым руководителем школы: WhatsApp, звонок, почта, сообщение в приложении', `<button class="btn" data-act="sup-export-directors">⬇ CSV</button>`)}${tabs('super/directors')}
  <div class="archgrid">${L.map(s => { const d = s.director || {}; return `<div class="card dir"><b>${esc(d.name || 'Директор не назначен')}</b><small class="muted">${esc(s.name)} · ${esc(s.city || '')}</small>
    <small>${esc(d.phone || '—')}<br>${esc(d.email || 'почта скрыта')}<br>Последний вход: <b>${ago(d.last)}</b></small>${contacts(d)}
    <div class="cbtns"><a class="btn sm" href="#/super/s/${s.id}">Карточка школы</a><a class="btn sm" href="#/super/s/${s.id}/actions">Написать в приложении</a></div></div>`; }).join('')}</div>`;
}

function inboxPage() {
  const x = X(), L = schoolsList();
  const T = load('tickets', () => D.tickets()), R = load('requests', () => D.requests());
  const tk = Array.isArray(T) ? T.filter(t => t.status !== 'closed').length : 0, rq = Array.isArray(R) ? R.filter(r => r.status === 'new').length : 0;
  let body;
  if (x.tab === 'tickets') {
    const w = wait(T); body = w || (T.length ? T.map(t => ticketCard(t, t.school || nameOf(L, t.school_id), 'super')).join('') : '<div class="card"><p class="muted">Обращений пока нет.</p></div>');
  } else {
    const w = wait(R); body = w || (R.length ? R.map(requestCard).join('') : '<div class="card"><p class="muted">Заявок пока нет. Они приходят с формы на странице «Подключить школу».</p></div>');
  }
  return `${head('Входящие', '', 'Обращения директоров и заявки на подключение')}${tabs('super/inbox')}
  <div class="tabs noprint"><button class="tag ${x.tab === 'tickets' ? 'on' : ''}" data-act="sup-tab" data-v="tickets">Обращения ${tk ? `<b class="cnt2">${tk}</b>` : ''}</button><button class="tag ${x.tab === 'requests' ? 'on' : ''}" data-act="sup-tab" data-v="requests">Заявки ${rq ? `<b class="cnt2">${rq}</b>` : ''}</button></div>${body}`;
}
export function ticketCard(t, schoolName, side) {
  const open = t.status !== 'closed', st = { open: ['ждёт ответа', ''], answered: ['отвечено', 'ok'], closed: ['закрыто', 'ok'] }[t.status] || ['', ''];
  return `<div class="card tkt"><div class="sch-h"><b>${esc(t.subject)}</b>${pill(st[0], st[1])}</div><small class="muted">${esc(schoolName || '')} · обновлено ${dt(t.updated_at || t.updated)}</small>
    <div class="thread">${(t.messages || []).map(m => `<div class="msg ${m.from === 'super' ? 'me' : ''}"><small><b>${esc(m.name || (m.from === 'super' ? 'Поддержка' : 'Школа'))}</b> · ${dt(m.at)}</small><p>${esc(m.text)}</p></div>`).join('')}</div>
    ${open ? `<form data-form="sup-reply" class="inline" data-side="${side}"><input type="hidden" name="id" value="${t.id}"><label class="fld"><span>${side === 'super' ? 'Ответ директору' : 'Ваше сообщение'}</span><textarea name="text" rows="2" required></textarea></label><div class="cbtns"><button class="btn blue" type="submit">Отправить</button>${side === 'super' ? `<button class="btn" type="button" data-act="sup-ticket-close" data-id="${t.id}">Закрыть обращение</button>` : ''}</div></form>` : ''}</div>`;
}
function requestCard(r) {
  const stl = { new: 'новая', talking: 'в переписке', key_issued: 'ключ выдан', rejected: 'отклонена', done: 'подключена' };
  const msg = `Здравствуйте, ${r.contact_name || ''}! Это SABAK+. По вашей заявке на подключение школы «${r.school_name}».`;
  return `<div class="card req"><div class="sch-h"><b>${esc(r.school_name)}</b>${pill(stl[r.status], r.status === 'new' ? '' : 'ok')}</div><small class="muted">${esc(r.city || '')} · ${dt(r.created_at)}</small>
    <p><b>${esc(r.contact_name || 'Без имени')}</b> · ${esc(r.phone)}</p>${r.note ? `<p class="muted">${esc(r.note)}</p>` : ''}${r.admin_note ? `<p>📝 ${esc(r.admin_note)}</p>` : ''}
    <div class="cbtns"><a class="btn sm wa" href="${wa(r.phone, msg)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ''))}">Позвонить</a>
      <button class="btn sm blue" data-act="sup-req-key" data-id="${r.id}" data-name="${esc(r.school_name)}" data-phone="${esc(r.phone)}">🔑 Выдать ключ</button></div>
    <div class="tabs noprint">${Object.entries(stl).map(([k, n]) => `<button class="tag ${r.status === k ? 'on' : ''}" data-act="sup-req" data-id="${r.id}" data-v="${k}">${n}</button>`).join('')}</div>
    <form data-form="sup-req-note" class="inline" style="margin-top:8px"><input type="hidden" name="id" value="${r.id}"><input type="hidden" name="status" value="${r.status}"><label class="fld"><span>Заметка</span><input name="note" value="${esc(r.admin_note || '')}" maxlength="300"></label><button class="btn sm" type="submit">Сохранить заметку</button></form></div>`;
}

function keysPage() {
  const K = load('keys', async () => need(await D.call('super_keys')).keys), w = wait(K), x = X();
  const box = x.key ? `<div class="card keybox" role="status"><h3>Новый ключ — покажем один раз</h3><p class="muted">Скопируйте и передайте директору. Повторно показать ключ нельзя: в базе хранится только его хэш.</p><div class="keyv">${esc(x.key.key)}</div>
    <div class="cbtns"><button class="btn blue" data-act="sup-copy" data-v="${esc(x.key.key)}">Копировать</button>${x.key.phone ? `<a class="btn wa" target="_blank" rel="noopener" href="${wa(x.key.phone, `Здравствуйте! Ваш ключ для основания школы в SABAK+: ${x.key.key}\nОткройте sabak-plus.vercel.app/app → «Создать аккаунт» → «Директор школы» и введите ключ. Ключ одноразовый.`)}">Отправить в WhatsApp</a>` : ''}<button class="btn" data-act="sup-key-hide">Скрыть</button></div></div>` : '';
  return `${head('Ключи школ', '', 'Одноразовые ключи, по которым директор основывает школу')}${tabs('super/keys')}${box}
  <div class="card"><h3>Выпустить ключ</h3><form data-form="sup-key" class="inline"><label class="fld"><span>Для какой школы (заметка)</span><input name="note" placeholder="Например: Школа №7, Джалал-Абад" maxlength="120"></label><button class="btn blue" type="submit">🔑 Выпустить</button></form></div>
  ${w || `<div class="card"><h3>Все ключи (${K.length})</h3>${K.map(k => `<div class="row"><div><b>${esc(k.note || 'без заметки')}</b><small class="muted">выпущен ${dmy(k.created)}${k.used ? ` · использован ${dmy(k.used)}${k.school ? ' → ' + esc(k.school) : ''}` : ''}</small></div><div class="cbtns">${k.used ? pill('использован', 'ok') : `${pill('свободен')}<button class="btn sm" data-act="sup-key-revoke" data-id="${k.id}">Отозвать</button>`}</div></div>`).join('') || '<p class="muted">Ключей нет.</p>'}</div>`}`;
}

function broadcastPage() {
  const L = schoolsList(), A = load('announces', async () => (live() ? need(await D.call('super_audit', { p_action: 'super.announce', p_limit: 30 })).rows : D.announces()));
  return `${head('Рассылка', '', 'Сообщение директорам: придёт колокольчиком в их приложении')}${tabs('super/broadcast')}
  <div class="card"><form data-form="sup-announce" class="inline"><label class="fld"><span>Кому</span><select name="school"><option value="">Всем директорам</option>${Array.isArray(L) ? L.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') : ''}</select></label>
    <label class="fld"><span>Тема</span><input name="title" required minlength="3" maxlength="120" placeholder="Например: Вышла версия 0.7"></label><label class="fld"><span>Сообщение</span><textarea name="body" rows="4" required minlength="3" maxlength="1000"></textarea></label><button class="btn blue" type="submit">📣 Отправить</button></form></div>
  <div class="card"><h3>История рассылок</h3>${wait(A) || (A.length ? A.map(a => `<div class="row"><div><b>${esc((a.details || {}).title || '')}</b><small class="muted">${dt(a.at)} · ${a.school ? esc(a.school) : 'всем директорам'} · получателей: ${(a.details || {}).to ?? '—'}</small></div></div>`).join('') : '<p class="muted">Рассылок ещё не было.</p>')}</div>`;
}

function usersPage() {
  const x = X(), U = x.uq.trim().length >= 2 ? load('u:' + x.uq.trim(), async () => need(await D.call('super_find_user', { p_q: x.uq.trim() })).users) : null;
  return `${head('Люди', '', 'Поиск сотрудника или родителя по имени, телефону или почте по всей платформе')}${tabs('super/users')}
  <div class="card"><form data-form="sup-find" class="inline"><label class="fld"><span>Что искать</span><input name="q" value="${esc(x.uq)}" placeholder="Имя, телефон или почта (от 2 символов)" autocomplete="off"></label><button class="btn blue" type="submit">Найти</button></form></div>
  ${U ? (wait(U) || `<div class="card"><h3>Найдено: ${U.length}</h3>${U.map(u => `<div class="row ppl"><div><b>${esc(u.name)}</b> ${pill(ROLE[u.role] || u.role)} ${u.status === 'blocked' ? pill('заблокирован') : u.status === 'pending' ? pill('ждёт подтверждения') : ''}<small class="muted">${esc(u.phone || '—')} · ${esc(u.email || '—')} · вход: ${ago(u.last)}<br>${u.school_id ? `<a href="#/super/s/${u.school_id}">${esc(u.school || 'школа')}</a>` : ''}</small></div>
    <div class="cbtns">${u.phone ? `<a class="btn sm wa" href="${wa(u.phone)}" target="_blank" rel="noopener">WA</a>` : ''}<button class="btn sm" data-act="sup-user" data-id="${u.id}" data-to="${u.status === 'blocked' ? 'active' : 'blocked'}">${u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</button></div></div>`).join('') || '<p class="muted">Никого не найдено.</p>'}</div>`) : ''}`;
}

const auditRows = (rows, withSchool = true) => rows.length ? `<div class="dtable">${rows.map(a => `<div class="row"><div><b>${esc(actName(a.action))}</b>${withSchool && a.school ? ` · <a href="#/super/s/${a.school_id || ''}">${esc(a.school)}</a>` : ''}<small class="muted">${dt(a.at)} · ${esc(a.who || 'система')}${a.details && Object.keys(a.details).length ? ' · ' + esc(Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(', ')) : ''}</small></div></div>`).join('')}</div>` : '<p class="muted">Записей нет.</p>';
function auditPage() {
  const x = X(), L = schoolsList(), key = `a:${x.aud.school}:${x.aud.action}`;
  const R = load(key, async () => need(await D.call('super_audit', { p_school: x.aud.school || null, p_action: x.aud.action || null, p_limit: 150 })).rows);
  return `${head('Журнал платформы', '', 'Все действия во всех школах и ваши действия суперадмина')}${tabs('super/audit')}
  <div class="card"><div class="frow2"><label class="fld"><span>Школа</span><select data-sup="aud-school"><option value="">Все школы</option>${Array.isArray(L) ? L.map(s => `<option value="${s.id}" ${x.aud.school === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') : ''}</select></label>
    <label class="fld"><span>Тип</span><select data-sup="aud-action">${[['', 'Всё'], ['super.', 'Действия суперадмина'], ['invite.', 'Приглашения'], ['archive.', 'Архив'], ['schedule.', 'Расписание']].map(([v, n]) => `<option value="${v}" ${x.aud.action === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div></div>
  <div class="card">${wait(R) || auditRows(R)}</div>`;
}

function systemPage() {
  const Y = load('system', async () => need(await D.call('super_system'))), w = wait(Y);
  const now = Archive.endedLabel() || Archive.yearLabelOf();
  if (w) return head('Система', '', 'Состояние базы и обслуживание') + tabs('super/system') + w;
  const max = Math.max(1, ...Object.values(Y.tables));
  const NAMES = { grades: 'Оценки', attendance: 'Посещаемость', students: 'Ученики', profiles: 'Профили', notifications: 'Уведомления', audit_log: 'Журнал аудита', invites: 'Приглашения', invite_attempts: 'Попытки ввода кодов', archive_years: 'Годы в архиве', support_tickets: 'Обращения' };
  return `${head('Система', '', 'Состояние базы и обслуживание')}${tabs('super/system')}
  <div class="kpis">${kpi('Размер базы', Y.db_mb + ' МБ')}${kpi('Неверных кодов за 24 ч', Y.failed_codes_24h)}${kpi('Заблокировано на 15 мин', Y.locked_now)}${kpi('Режим', live() ? 'Live' : 'Демо')}</div>
  <div class="card"><h3>Размер таблиц (строк)</h3>${Object.entries(Y.tables).sort((a, b) => b[1] - a[1]).map(([k, n]) => hbar(NAMES[k] || k, n, max)).join('')}</div>
  <div class="card"><h3>Очистка служебных данных</h3><p class="muted">Можно удалить: ${Y.cleanable.attempts} старых попыток ввода кодов (старше 7 дней), ${Y.cleanable.invites} просроченных приглашений (старше 30 дней), ${Y.cleanable.notifs} прочитанных уведомлений (старше 90 дней). Оценки, архив и аккаунты не затрагиваются.</p><button class="btn" data-act="sup-cleanup">🧹 Очистить</button></div>
  <div class="card"><h3>Архив учебного года во всех школах</h3><p class="muted">Сохранит выбранный год в архив каждой школы, где его ещё нет. Журнал не очищается.</p><form data-form="sup-archive-all" class="inline"><label class="fld"><span>Учебный год</span><input name="label" value="${esc(now)}" pattern="\\d{4}/\\d{4}" required></label><button class="btn" type="submit">🗄 Сохранить в архив</button></form></div>`;
}

// ---------- действия ----------
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
const csv = rows => '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
export async function act(name, el) {
  if (!name.startsWith('sup-')) return false;
  const x = X();
  switch (name) {
    case 'sup-filter': x.st = el.dataset.v; rerender(); return true;
    case 'sup-tab': x.tab = el.dataset.v; rerender(); return true;
    case 'sup-copy': await copyText(el.dataset.v); toast('Скопировано', 'ok'); return true;
    case 'sup-key-hide': x.key = null; rerender(); return true;
    case 'sup-school-status': await guard(async () => { need(await D.call('super_set_school_status', { p_id: el.dataset.id, p_status: el.dataset.to, p_reason: null })); fresh(); toast(el.dataset.to === 'active' ? 'Доступ возвращён' : 'Школа приостановлена', 'ok'); rerender(); }); return true;
    case 'sup-user': await guard(async () => { if (el.dataset.to === 'blocked' && !confirm('Заблокировать этого пользователя? Он не сможет войти, данные сохранятся.')) return; need(await D.call('super_user_status', { p_user: el.dataset.id, p_status: el.dataset.to })); fresh(); toast(el.dataset.to === 'blocked' ? 'Заблокирован' : 'Разблокирован', 'ok'); rerender(); }); return true;
    case 'sup-note-del': await guard(async () => { need(await D.call('super_note_delete', { p_id: el.dataset.id })); fresh(); rerender(); }); return true;
    case 'sup-ticket-close': await guard(async () => { need(await D.call('support_close', { p_id: el.dataset.id })); fresh('tickets'); fresh('schools'); toast('Обращение закрыто', 'ok'); rerender(); }); return true;
    case 'sup-req': await guard(async () => { need(await D.call('super_request_set', { p_id: el.dataset.id, p_status: el.dataset.v })); fresh('requests'); rerender(); }); return true;
    case 'sup-req-key': await guard(async () => { const r = need(await D.call('super_issue_key', { p_note: el.dataset.name })); x.key = { key: r.key, phone: el.dataset.phone }; await D.call('super_request_set', { p_id: el.dataset.id, p_status: 'key_issued' }); fresh('requests'); fresh('keys'); location.hash = '#/super/keys'; rerender(); }); return true;
    case 'sup-key-revoke': await guard(async () => { if (!confirm('Отозвать этот ключ?')) return; need(await D.call('super_key_revoke', { p_id: el.dataset.id })); fresh('keys'); rerender(); }); return true;
    case 'sup-cleanup': await guard(async () => { const r = need(await D.call('super_cleanup')); fresh('system'); toast(`Удалено: попыток ${r.attempts}, приглашений ${r.invites}, уведомлений ${r.notifs}`, 'ok'); rerender(); }); return true;
    case 'sup-archive-all': await guard(async () => { if (!confirm(`Сохранить учебный год ${el.dataset.label} в архив всех школ?`)) return; const r = need(await D.call('super_archive_all', { p_label: el.dataset.label })); Archive.refresh(); fresh(); toast(`Сохранено в ${r.archived} школах, пропущено ${r.skipped}`, 'ok'); rerender(); }); return true;
    case 'sup-export-schools': await guard(async () => { const L = need(await D.call('super_schools')).schools; downloadBlob(new Blob([csv([['Школа', 'Город', 'Код', 'Статус', 'Директор', 'Телефон', 'Почта', 'Учеников', 'Учителей', 'Классов', 'Оценок за 30 дней', 'Средний балл', 'Посещаемость %', 'Подключена'], ...L.map(s => [s.name, s.city, s.code, s.status === 'active' ? 'работает' : 'приостановлена', (s.director || {}).name, (s.director || {}).phone, (s.director || {}).email, s.stats.students, s.stats.teachers, s.stats.classes, s.stats.grades_30d, s.stats.avg, s.stats.att_pct, dmy(s.created)])])], { type: 'text/csv;charset=utf-8' }), 'sabak-schools.csv'); }); return true;
    case 'sup-export-directors': await guard(async () => { const L = need(await D.call('super_schools')).schools; downloadBlob(new Blob([csv([['Директор', 'Школа', 'Город', 'Телефон', 'Почта', 'Последний вход'], ...L.map(s => [(s.director || {}).name, s.name, s.city, (s.director || {}).phone, (s.director || {}).email, dt((s.director || {}).last)])])], { type: 'text/csv;charset=utf-8' }), 'sabak-directors.csv'); }); return true;
    case 'sup-export-school': await guard(async () => { const c = need(await D.call('super_school', { p_id: el.dataset.id })).school; downloadBlob(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' }), `sabak-${c.code}.json`); }); return true;
  }
  return false;
}
export function onChange(el) {
  const k = el.dataset && el.dataset.sup; if (!k) return false; const x = X();
  if (k === 'sort') x.sort = el.value; else if (k === 'aud-school') x.aud.school = el.value; else if (k === 'aud-action') x.aud.action = el.value; else return false;
  rerender(); return true;
}
// поиск по списку школ без потери фокуса
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'schQ') { X().q = e.target.value; const L = cache.schools; const box = document.getElementById('schList'); if (box && Array.isArray(L)) box.innerHTML = renderList(L); }
});
export function submit(form, fd) {
  const f = form.dataset.form; if (!f || !f.startsWith('sup-')) return false;
  const v = k => String(fd.get(k) || '').trim(), x = X();
  guard(async () => {
    if (f === 'sup-note') { need(await D.call('super_note_add', { p_school: v('school'), p_text: v('text'), p_pinned: fd.get('pinned') === 'on' })); fresh('school:' + v('school')); toast('Заметка добавлена', 'ok'); }
    else if (f === 'sup-rename') { need(await D.call('super_rename_school', { p_id: v('id'), p_name: v('name'), p_city: v('city') })); fresh(); toast('Сохранено', 'ok'); }
    else if (f === 'sup-suspend') { if (!confirm('Приостановить доступ школы?')) return; need(await D.call('super_set_school_status', { p_id: v('id'), p_status: 'suspended', p_reason: v('reason') })); fresh(); toast('Школа приостановлена', 'ok'); }
    else if (f === 'sup-announce') { const r = need(await D.call('super_announce', { p_title: v('title'), p_body: v('body'), p_school: v('school') || null })); fresh('announces'); form.reset(); toast(`Отправлено директорам: ${r.sent}`, 'ok'); }
    else if (f === 'sup-reply') { need(await D.replyAs(form.dataset.side === 'super' ? 'super' : 'school', v('id'), v('text'))); fresh('tickets'); fresh('mytickets'); toast('Отправлено', 'ok'); }
    else if (f === 'sup-req-note') { need(await D.call('super_request_set', { p_id: v('id'), p_status: v('status'), p_note: v('note') })); fresh('requests'); toast('Заметка сохранена', 'ok'); }
    else if (f === 'sup-key') { const r = need(await D.call('super_issue_key', { p_note: v('note') })); x.key = { key: r.key }; fresh('keys'); }
    else if (f === 'sup-find') { x.uq = v('q'); }
    else if (f === 'sup-archive-all') { const lb = v('label'); if (!confirm(`Сохранить учебный год ${lb} в архив всех школ?`)) return; const r = need(await D.call('super_archive_all', { p_label: lb })); Archive.refresh(); fresh(); toast(`Сохранено в ${r.archived} школах, пропущено ${r.skipped}`, 'ok'); }
    rerender();
  });
  return true;
}

// ---------- сторона директора: «Поддержка» ----------
export function supportPage() {
  const T = load('mytickets', () => D.myTickets()), w = wait(T);
  return `${head('Поддержка', 'SABAK+', 'Связь с техническим администратором платформы')}
  <div class="card"><h3>Новое обращение</h3><form data-form="dir-ticket" class="inline"><label class="fld"><span>Тема</span><input name="subject" required minlength="3" maxlength="200" placeholder="Например: не приходит код на почту"></label><label class="fld"><span>Опишите вопрос</span><textarea name="text" rows="4" required minlength="3"></textarea></label><button class="btn blue" type="submit">Отправить</button></form>
  <p class="muted">Срочно? Напишите в WhatsApp: <a href="https://wa.me/996709250243" target="_blank" rel="noopener">+996 709 250 243</a></p></div>
  ${w || (T.length ? T.map(t => ticketCard(t, '', 'school')).join('') : '<p class="muted">Обращений пока нет.</p>')}`;
}
export function dirSubmit(form, fd) {
  if (form.dataset.form !== 'dir-ticket') return false;
  guard(async () => { need(await D.call('support_open', { p_subject: String(fd.get('subject') || '').trim(), p_text: String(fd.get('text') || '').trim() })); fresh('mytickets'); form.reset(); toast('Отправлено. Ответ придёт в уведомления', 'ok'); rerender(); });
  return true;
}
export const reset = () => { fresh(); D.resetDemo(); Archive.resetDemo(); };
