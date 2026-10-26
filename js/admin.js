// Администрация: аналитика школы/класса, мониторинг педагогов, доступ и приглашения (цепочка доверия), классы, журнал аудита, экспорт
import * as S from './store.js';
import * as AN from './analytics.js';
import * as EX from './export.js';
import { esc, ui, toast, head, avatar, dtFmt, copyText, ROLE_RU, downloadBlob } from './common.js';
import { fmt1, fmt2, todayISO, dmy } from './calc.js';

const rerender = () => window.__render && window.__render();
const tabs = (cur, items) => `<nav class="subtabs" aria-label="Разделы">${items.map(([h, n]) => `<a href="#/${h}" class="${cur === h ? 'on' : ''}">${n}</a>`).join('')}</nav>`;
export const ADMIN_TABS = [['admin', 'Обзор'], ['admin/teachers', 'Педагоги'], ['admin/students', 'Ученики'], ['admin/access', 'Доступ и роли'], ['admin/mail', 'Обращения'], ['admin/audit', 'Журнал']];
const pctF = x => x == null ? '—' : Math.round(x * 100) + '%';
const kpi = (l, v, sub = '', cls = '') => `<div class="kpi ${cls}"><small>${l}</small><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
const concl = list => `<ul class="concl">${list.map(c => `<li class="${c.level}"><i aria-hidden="true">${c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : 'i'}</i><span>${esc(c.text)}</span></li>`).join('')}</ul>`;

// ---------- отчёты ----------
export function buildReport(kind, cls) {
  const school = S.state().school ? S.state().school.name : 'Школа', d = new Date().toLocaleDateString('ru-RU');
  if (kind === 'teachers') {
    const T = AN.teachers(), sc = AN.scope({});
    return { title: 'Мониторинг педагогического состава', subtitle: `${school} · ${d}`, sections: [
      { t: 'h', text: 'Выводы' }, { t: 'bul', items: T.flatMap(t => t.flags.map(f => `${t.name}: ${f.text}`)).concat(T.length ? [`Средний балл по школе: ${fmt2(sc.avg)}.`] : ['Данных нет.']) },
      { t: 'chart', svg: AN.svgBars(T.filter(t => t.mean != null).map(t => ({ label: t.name.split(' ')[0], value: +t.mean.toFixed(2), color: '#2352D8' })), { title: 'Средний выставленный балл', max: 5 }) },
      { t: 'table', name: 'Педагоги', header: ['Учитель', 'Предметы', 'Классы', 'Оценок всего', 'За 14 дней', 'Последняя запись', 'Заполнение журнала, % (10 дн.)', 'Средний балл', '% «5»', '% «2»', 'Замечания'],
        rows: T.map(t => [t.name, t.subjects.map(s => S.subj(s).ru).join(', '), t.classes.join(', '), t.n, t.recent, t.last || '—', Math.round(t.fill * 100), t.mean == null ? '' : +t.mean.toFixed(2), t.p5 ?? '', t.p2 ?? '', t.flags.map(f => f.text).join('; ')]) }] };
  }
  const a = AN.scope({ cls: cls || null }), label = cls ? `класс ${cls}` : 'вся школа';
  const att = AN.attendanceRate;
  return { title: `Аналитика успеваемости — ${label}`, subtitle: `${school} · ${d}`, sections: [
    { t: 'h', text: 'Выводы' }, { t: 'bul', items: AN.conclusions(a).map(c => c.text) },
    { t: 'table', name: 'Ключевые показатели', header: ['Показатель', 'Значение'], rows: [['Учеников', a.nStudents], ['Средний балл', a.avg == null ? '' : +a.avg.toFixed(2)], ['Медиана', a.median == null ? '' : +a.median.toFixed(2)], ['Стандартное отклонение', +a.sd.toFixed(2)], ['Абсолютная успеваемость, %', a.success ?? ''], ['Качество знаний, %', a.quality ?? ''], ['СОУ, %', a.sou == null ? '' : +a.sou.toFixed(1)], ['Посещаемость за 14 дней, %', a.att == null ? '' : Math.round(a.att * 100)], ['Корреляция посещаемость↔оценки (r)', a.corr == null ? '' : +a.corr.toFixed(2)], ['Тренд, балла в неделю', a.trend == null ? '' : +a.trend.toFixed(3)]] },
    { t: 'chart', svg: AN.svgBars(AN.distBars(a), { title: 'Распределение итоговых оценок (ученик × предмет)' }) },
    { t: 'chart', svg: AN.svgBars(a.bySubject.map(x => ({ label: x.name, value: +x.avg.toFixed(2), color: '#1F9D6B' })), { title: 'Средний балл по предметам', max: 5 }) },
    { t: 'chart', svg: AN.svgLine(a.weeks.map(w => ({ label: w.label, value: w.avg })), { title: 'Средний балл по неделям' }) },
    { t: 'chart', svg: AN.svgScatter(a.perStudent.filter(p => p.avg != null && p.att != null).map(p => ({ x: p.att, y: p.avg })), { title: 'Посещаемость и успеваемость', r: a.corr }) },
    { t: 'table', name: 'Предметы', header: ['Предмет', 'Итоговых оценок', 'Средний балл', 'Качество знаний, %', 'Успеваемость, %', 'СОУ, %'], rows: a.bySubject.map(x => [x.name, x.n, +x.avg.toFixed(2), x.quality, x.success, +x.sou.toFixed(1)]) },
    { t: 'table', name: 'Ученики', header: ['ФИО', 'Класс', 'Средний балл', 'Посещаемость 14 дн., %', 'Есть «2» по предмету', 'Фото', 'Документы дела (обязательные)'], rows: a.perStudent.map(p => { const stu = S.student(p.id), dd = S.state().docs[p.id] || {}; const have = ['application', 'birth_cert', 'parent_id', 'reg_cert', 'med_026', 'med_063', 'photo_3x4', 'consent_pd', 'contract'].filter(k => dd[k] && dd[k].status === 'have').length; return [p.name, p.cls, p.avg == null ? '' : +p.avg.toFixed(2), p.att == null ? '' : Math.round(p.att * 100), p.hasTwo ? 'да' : 'нет', stu && stu.photo && stu.photo.ok ? 'есть' : 'нет', `${have} из 9`]; }) },
  ] };
}
const exportBar = (kind, cls) => `<div class="exbar"><span>Скачать отчёт:</span><button class="btn sm" data-act="export-xlsx" data-kind="${kind}" data-cls="${cls || ''}">Excel</button><button class="btn sm" data-act="export-docx" data-kind="${kind}" data-cls="${cls || ''}">Word</button><button class="btn sm" data-act="export-pdf" data-kind="${kind}" data-cls="${cls || ''}">PDF</button></div>`;

// ---------- Обзор ----------
export function overview() {
  const st = S.state(), cls = ui.acls || '', a = AN.scope({ cls: cls || null });
  const sel = `<label class="inl">Показать <select data-act="acls"><option value="">Вся школа</option>${st.classes.map(c => `<option ${c.name === cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
  const byCls = st.classes.map(c => { const x = AN.scope({ cls: c.name }); return { label: c.name, value: x.avg == null ? 0 : +x.avg.toFixed(2), color: '#2352D8' }; });
  const pts = a.perStudent.filter(p => p.avg != null && p.att != null).map(p => ({ x: p.att, y: p.avg }));
  const sName = st.school ? st.school.name : '';
  return `${head('Обзор школы', cls ? `класс ${cls}` : sName, `Аналитика считается автоматически по журналам, посещаемости и «делам»`, sel)}${tabs('admin', ADMIN_TABS)}
  ${!a.N && S.isLive() && S.isDirector() ? `<div class="banner"><div><b>В школе пока нет данных</b><p>Загрузите демо-класс с оценками, чтобы показать аналитику, или добавьте классы и учеников вручную (раздел «Доступ и роли»).</p></div><button class="btn blue" data-act="seed-demo">Загрузить демо-данные</button></div>` : ''}
  <div class="kpis">${kpi('Средний балл', fmt2(a.avg), `медиана ${fmt2(a.median)} · σ ${fmt2(a.sd)}`)}${kpi('Качество знаний', a.quality == null ? '—' : fmt1(a.quality) + '%', 'доля «4» и «5»')}${kpi('Успеваемость', a.success == null ? '—' : fmt1(a.success) + '%', 'без «2» по итогу')}${kpi('СОУ', a.sou == null ? '—' : fmt1(a.sou) + '%', 'степень обученности')}${kpi('Посещаемость', pctF(a.att), '14 учебных дней')}${kpi('Группа внимания', a.risk.length, `из ${a.nStudents}`, a.risk.length ? 'alert' : '')}</div>
  <section class="card"><h2 class="tp">Что показывает анализ</h2>${concl(AN.conclusions(a))}${exportBar(cls ? 'class' : 'school', cls)}</section>
  <div class="grid2">
    <section class="card chart"><h2 class="tp">Распределение итоговых оценок</h2>${AN.svgBars(AN.distBars(a))}</section>
    <section class="card chart"><h2 class="tp">Предметы: средний балл</h2>${AN.svgBars(a.bySubject.map(x => ({ label: x.name, value: +x.avg.toFixed(2), color: '#1F9D6B' })), { max: 5 })}</section>
    <section class="card chart"><h2 class="tp">Динамика по неделям</h2>${AN.svgLine(a.weeks.map(w => ({ label: w.label, value: w.avg })))}</section>
    <section class="card chart"><h2 class="tp">Посещаемость ↔ оценки</h2>${AN.svgScatter(pts, { r: a.corr })}</section>
    ${!cls && byCls.length > 1 ? `<section class="card chart"><h2 class="tp">Классы: средний балл</h2>${AN.svgBars(byCls, { max: 5 })}</section>` : ''}
    <section class="card"><h2 class="tp">Группа внимания (${a.risk.length})</h2>${a.risk.map(p => `<div class="row"><div class="rl">${avatar(S.student(p.id), 34)}<div><b>${esc(p.name)}</b><small>${esc(p.cls)} · средний ${fmt2(p.avg)}${p.att != null ? ' · посещаемость ' + Math.round(p.att * 100) + '%' : ''}${p.hasTwo ? ' · есть «2»' : ''}</small></div></div><a class="btn sm ghost" href="#/dossier/${p.id}">Дело</a></div>`).join('') || '<p class="muted">Нет учеников, требующих внимания.</p>'}</section>
  </div>`;
}

// ---------- Педагоги ----------
export function teachersPage() {
  const T = AN.teachers();
  return `${head('Педагоги', '', 'Мониторинг заполнения журналов и «строгости» оценивания — только для администрации', exportBar('teachers'))}${tabs('admin/teachers', ADMIN_TABS)}
  <section class="card chart"><h2 class="tp">Средний выставленный балл</h2>${AN.svgBars(T.filter(t => t.mean != null).map(t => ({ label: t.name.split(' ')[0], value: +t.mean.toFixed(2), color: '#2352D8' })), { max: 5 })}</section>
  <div class="tgrid">${T.map(t => `<div class="card tcard ${t.flags.length ? 'flag' : ''}"><div class="tc-h"><b>${esc(t.name)}</b><small>${t.subjects.map(s => esc(S.subj(s).ru)).join(', ') || 'предметы не назначены'} · ${esc(t.classes.join(', ')) || 'нет классов'}${t.homeroom ? ' · кл. рук. ' + esc(t.homeroom) : ''}</small></div>
    <div class="tc-k"><div><small>Оценок за 14 дн.</small><b>${t.recent}</b></div><div><small>Заполнение (10 дн.)</small><b>${Math.round(t.fill * 100)}%</b></div><div><small>Средний балл</small><b>${t.mean == null ? '—' : fmt2(t.mean)}</b></div><div><small>«5» / «2»</small><b>${t.p5 ?? '—'} / ${t.p2 ?? '—'}%</b></div></div>
    <div class="bar"><i style="width:${Math.round(t.fill * 100)}%"></i></div>
    ${t.flags.map(f => `<div class="flagline ${f.k}">⚠ ${esc(f.text)}</div>`).join('') || '<div class="flagline ok">✓ Замечаний нет</div>'}
    <small class="muted">Последняя запись: ${t.last ? dmy(t.last) : '—'}</small></div>`).join('') || '<p class="muted">Педагогов пока нет.</p>'}</div>`;
}

// ---------- Доступ и роли ----------
const MATRIX = [
  ['Видеть журналы и оценки', ['вся школа', 'вся школа', 'свои классы', 'свои классы', 'ребёнок', 'свои']],
  ['Ставить оценки и посещаемость', ['—', '—', 'свои предметы', 'свои предметы', '—', '—']],
  ['Читать «дело» ученика', ['✓', '✓', 'свой класс', '—', 'ребёнок', '✕']],
  ['Редактировать «дело»', ['—', '—', 'свой класс', '—', 'ребёнок', '✕']],
  ['Загружать фото профиля', ['—', '—', 'свой класс', '—', 'ребёнок', 'своё']],
  ['Предупреждать о фото', ['✓', '✓', 'свой класс', '—', '—', '—']],
  ['Аналитика и экспорт', ['вся школа', 'вся школа', 'свои классы', 'свои классы', '—', '—']],
  ['Мониторинг педагогов', ['✓', '✓', '—', '—', '—', '—']],
  ['Выдавать приглашения', ['завуч, учитель, родитель, ученик', 'учитель, родитель, ученик', 'родитель и ученик своего класса', '—', '—', '—']],
  ['Подтверждать сотрудников', ['завуч и учителей', 'учителей', '—', '—', '—', '—']],
  ['Читать анонимную почту', ['✓', '✓', '—', '—', '—', '—']],
];
export function accessPage() {
  const st = S.state(), u = S.me(), dir = S.isDirector();
  const manage = t => (u.level === 'director' && (t.role === 'deputy' || t.role === 'teacher')) || (u.level === 'deputy' && t.role === 'teacher');
  const staff = [...st.staff].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || a.role.localeCompare(b.role));
  const subjIds = S.SUBJECTS.map(s => s.id);
  return `${head('Доступ и роли', '', 'Цепочка доверия: в систему попадают только по ключу школы и приглашениям — каждый шаг записывается в журнал', '')}${tabs('admin/access', ADMIN_TABS)}
  <section class="card trust"><h2 class="tp">Как подключается администрация</h2><ol class="chain">
    <li><b>Ключ-печать.</b> Оператор SABAK+ выдаёт школе одноразовый ключ <code>SABAK-XXXX-XXXX-XXXX</code> (в базе хранится только его хэш).</li>
    <li><b>Директор основывает школу</b> по ключу. Ключ сгорает после первого использования.</li>
    <li><b>Приглашения сверху вниз.</b> Директор → завуч и учителя; завуч → учителя; классный руководитель → родители и ученики <i>своего</i> класса. Код живёт 3–14 дней, одноразовый, можно привязать к последним цифрам телефона.</li>
    <li><b>Подтверждение человеком.</b> Учитель или завуч по коду попадает в статус «ожидает» — доступ к журналам открывает директор/завуч вручную.</li>
    <li><b>Защита от перебора и след.</b> 5 неверных кодов — пауза 15 минут; любое действие записывается в журнал аудита; доступ можно закрыть в один клик.</li></ol></section>
  ${S.isLive() && st.school ? `<section class="card"><h2 class="tp">Ваша школа</h2><p><b>${esc(st.school.name)}</b> · код школы <code>${esc(st.school.code)}</code> ${S.isDirector() ? `</p><div class="btns"><button class="btn sm ghost" data-act="seed-demo">Загрузить демо-данные</button><button class="btn sm ghost" data-act="clear-demo">Удалить демо-данные</button></div>` : '</p>'}</section>` : ''}
  <div class="grid2">
   <section class="card"><h2 class="tp">Новое приглашение сотруднику</h2>
    <form data-form="invite" class="invform">
      <label class="fld"><span>Роль</span><select name="role">${dir ? '<option value="deputy">Завуч (администрация)</option>' : ''}<option value="teacher">Учитель</option></select></label>
      <label class="fld"><span>Последние цифры телефона приглашаемого <small>(необязательно, защита)</small></span><input name="tail" inputmode="numeric" pattern="[0-9]{3,6}" placeholder="например 4521"></label>
      <button class="btn blue" type="submit">Создать код</button></form>
    ${ui.codeBox ? `<div class="codebox"><div><small>${esc(ui.codeBox.what)}</small><b>${esc(ui.codeBox.code)}</b></div><button class="btn light" data-act="copy" data-v="${esc(ui.codeBox.code)}">Скопировать</button></div>` : ''}
    <h3 class="sm-h">Активные приглашения</h3>
    ${st.invites.filter(i => !i.revoked && i.uses < i.max && i.expires > Date.now() && (i.role === 'teacher' || i.role === 'deputy')).map(i => `<div class="row"><div><b class="mono">${esc(i.code)}</b><small>${ROLE_RU[i.role]}${i.tail ? ' · телефон …' + esc(i.tail) : ''} · до ${new Date(i.expires).toLocaleDateString('ru-RU')}</small></div><button class="ibtn sm" data-act="inv-revoke" data-id="${i.id}">Отозвать</button></div>`).join('') || '<p class="muted">Нет активных приглашений.</p>'}</section>
   <section class="card"><h2 class="tp">Классы</h2>
    <form data-form="class" class="recform"><input name="name" required maxlength="6" placeholder="Новый класс, например 7В"><button class="btn" type="submit">+ Класс</button></form>
    ${st.classes.map(c => `<div class="row"><div><b>${esc(c.name)}</b><small>${S.studentsOf(c.name).length} учеников</small></div><label class="inl">Классный рук.<select data-act="homeroom" data-cls="${esc(c.name)}"><option value="">—</option>${st.staff.filter(s => s.role === 'teacher' && s.status === 'active').map(s => `<option value="${s.id}" ${s.homeroom === c.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label></div>`).join('') || '<p class="muted">Классов пока нет.</p>'}</section>
  </div>
  <section class="card"><h2 class="tp">Сотрудники</h2>
   ${staff.map(t => `<div class="staff ${t.status}"><div class="sf-h"><div><b>${esc(t.name)}</b><small>${ROLE_RU[t.role]} · ${t.status === 'pending' ? '<span class="pill warn">ожидает подтверждения</span>' : t.status === 'blocked' ? '<span class="pill bad">доступ закрыт</span>' : '<span class="pill ok">активен</span>'}${t.phone ? ' · ' + esc(t.phone) : ''}</small></div>
     <div class="btns">${manage(t) && t.status === 'pending' ? `<button class="btn sm blue" data-act="staff-ok" data-id="${t.id}">Подтвердить</button><button class="btn sm ghost" data-act="staff-no" data-id="${t.id}">Отклонить</button>` : ''}${manage(t) && t.status === 'active' ? `<button class="btn sm ghost" data-act="staff-no" data-id="${t.id}">Закрыть доступ</button>` : ''}${manage(t) && t.status === 'blocked' ? `<button class="btn sm ghost" data-act="staff-ok" data-id="${t.id}">Вернуть доступ</button>` : ''}</div></div>
     ${t.role === 'teacher' && t.status === 'active' ? `<div class="assign">${st.classes.map(c => `<div class="as-row"><span class="as-c">${esc(c.name)}</span>${subjIds.map(sid => `<button class="tag sm ${t.classes.includes(c.name) && t.subjects.includes(sid) && isAssigned(t, c.name, sid) ? 'on' : ''}" data-act="assign" data-t="${t.id}" data-cls="${esc(c.name)}" data-s="${sid}">${esc(S.subj(sid).ru)}</button>`).join('')}</div>`).join('')}<small class="muted">Нажмите предмет, чтобы назначить или снять его у учителя в этом классе.</small></div>` : ''}</div>`).join('')}</section>
  <section class="card"><h2 class="tp">Иерархия ролей и права</h2><div class="mx-wrap"><table class="matrix"><thead><tr><th>Возможность</th>${['Директор', 'Завуч', 'Классный рук.', 'Учитель-предметник', 'Родитель', 'Ученик'].map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${MATRIX.map(r => `<tr><th>${r[0]}</th>${r[1].map(v => `<td class="${v === '—' || v === '✕' ? 'no' : 'yes'}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted src">Эти права действуют не только в интерфейсе: они закреплены правилами базы данных (RLS), поэтому обойти их через браузер нельзя.</p></section>`;
}
function isAssigned(t, cls, sid) { const st = S.state(); return !!(st.assignMap ? st.assignMap[`${t.id}|${cls}|${sid}`] : t.classes.includes(cls) && t.subjects.includes(sid)); }

export function mailPage() {
  const st = S.state(), risk = AN.scope({}).risk;
  return `${head('Обращения', '', 'Анонимные сообщения: автор не сохраняется', '')}${tabs('admin/mail', ADMIN_TABS)}
  <div class="grid2"><section class="card"><h2 class="tp">Анонимная почта (${st.mail.filter(m => !m.read).length} новых)</h2>
   ${st.mail.map(m => `<div class="mail ${m.read ? 'read' : ''}"><div class="mh"><span class="tag on">${esc(m.cat)}</span><small>${new Date(m.ts).toLocaleString('ru-RU')}</small></div><p>${esc(m.text)}</p>${m.read ? '' : `<button class="ibtn sm" data-act="mailread" data-id="${m.id}">Отметить прочитанным</button>`}</div>`).join('') || '<p class="muted">Сообщений пока нет.</p>'}</section>
   <section class="card"><h2 class="tp">Ученики, которым нужно внимание (${risk.length})</h2>${risk.map(p => `<div class="row"><div class="rl">${avatar(S.student(p.id), 34)}<div><b>${esc(p.name)}</b><small>${esc(p.cls)} · ${fmt2(p.avg)}</small></div></div></div>`).join('') || '<p class="muted">Таких нет.</p>'}</section></div>`;
}
export function auditPage() {
  const a = S.state().audit;
  return `${head('Журнал аудита', '', 'Кто и что сделал с доступом и данными школы', '')}${tabs('admin/audit', ADMIN_TABS)}<div class="card">${a.map(x => `<div class="row"><div><b>${esc(x.text)}</b><small>${esc(x.who)} · ${esc(x.action)}</small></div><div class="big sm">${dtFmt(x.ts)}</div></div>`).join('') || '<p class="muted">Записей пока нет.</p>'}</div>`;
}

// ---------- действия ----------
async function doExport(kind, cls, fmt) {
  const rep = buildReport(kind, cls), base = `sabak_${kind}${cls ? '_' + cls : ''}_${todayISO()}`;
  try {
    if (fmt === 'pdf') { EX.printReport(rep); return; }
    toast('Готовим файл…');
    if (fmt === 'xlsx') downloadBlob(await EX.toXlsx(rep), base + '.xlsx'); else downloadBlob(await EX.toDocx(rep), base + '.docx');
    toast('Файл готов', 'ok');
  } catch (e) { toast(e.message, 'warn'); }
}
export async function act(name, el) {
  const guard = async fn => { try { await fn(); } catch (e) { toast(e.message, 'warn'); } };
  switch (name) {
    case 'export-xlsx': case 'export-docx': case 'export-pdf': await doExport(el.dataset.kind, el.dataset.cls, name.slice(7)); return true;
    case 'staff-ok': await guard(async () => { await S.setStaffStatus(el.dataset.id, 'active'); toast('Доступ подтверждён', 'ok'); }); return true;
    case 'staff-no': await guard(async () => { await S.setStaffStatus(el.dataset.id, 'blocked'); toast('Доступ закрыт', 'ok'); }); return true;
    case 'assign': await guard(async () => { const t = S.state().staff.find(x => x.id === el.dataset.t), on = !el.classList.contains('on'); await S.assign(el.dataset.t, el.dataset.cls, el.dataset.s, on); }); return true;
    case 'inv-revoke': await guard(async () => { await S.revokeInvite(el.dataset.id); toast('Приглашение отозвано', 'ok'); }); return true;
    case 'seed-demo': await guard(async () => { toast('Загружаем демо-данные…'); const r = await S.seedDemoLive(); toast(`Готово: учеников ${r.students}`, 'ok'); }); return true;
    case 'clear-demo': if (confirm('Удалить демо-учеников и все их оценки?')) await guard(async () => { await S.clearDemoLive(); toast('Демо-данные удалены', 'ok'); }); return true;
  }
  return false;
}
export function onChange(el) {
  if (el.dataset.act === 'acls') { ui.acls = el.value; rerender(); return true; }
  if (el.dataset.act === 'homeroom') { S.setHomeroom(el.dataset.cls, el.value || null).then(() => toast('Классный руководитель назначен', 'ok')).catch(e => toast(e.message, 'warn')); return true; }
  return false;
}
export function submit(form, fd) {
  if (form.dataset.form === 'invite') { S.createInvite({ role: fd.get('role'), tail: String(fd.get('tail') || '').trim() || null }).then(iv => { ui.codeBox = { code: iv.code, what: `Приглашение: ${ROLE_RU[fd.get('role')]}` }; rerender(); }).catch(e => toast(e.message, 'warn')); return true; }
  if (form.dataset.form === 'class') { S.createClass(String(fd.get('name'))).then(() => toast('Класс добавлен', 'ok')).catch(e => toast(e.message, 'warn')); return true; }
  return false;
}
