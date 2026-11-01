// Архив учебных лет: «Учебный год → Класс → Ученик → дневник». Директор видит только свою школу, суперадмин — все.
// Live: таблицы archive_years / archive_classes (снимок делает сервер, правки задним числом невозможны). Demo: localStorage.
import * as S from './store.js';
import * as API from './api.js';
import { esc, ui, head, toast, go, plural, route, sjName, typeName } from './common.js';
import { wavg, finalGrade, fmt2, dmy, todayISO, TYPES } from './calc.js';
import { REC_KINDS, docLabel } from './docs.js';

const rerender = () => window.__render && window.__render();
const KEY = 'sabak.arch.demo';
const cache = {};                       // key -> данные | 'loading' | {err}
const fresh = () => { Object.keys(cache).forEach(k => delete cache[k]); };

// ---------- учебный год ----------
export const yearLabelOf = (d = new Date()) => { const y = d.getFullYear(), m = d.getMonth() + 1; return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`; };
export const endedLabel = (d = new Date()) => { const m = d.getMonth() + 1, y = d.getFullYear(); return m >= 6 && m <= 8 ? `${y - 1}/${y}` : null; };
const range = lb => { const y = +lb.slice(0, 4); return [`${y}-09-01`, `${y + 1}-08-31`]; };

// ---------- демо-хранилище ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NM = ['Алина Эркинова', 'Урмат Исаков', 'Жылдыз Абдыева', 'Темирлан Кадыров', 'Ару Нурматова', 'Касым Токтогулов', 'Элина Садыкова', 'Нурбек Алымкулов', 'Айгерим Сапарова', 'Бакыт Джумаев'];
const SUBJ = ['math', 'rus', 'kyr', 'hist', 'eng', 'phys', 'bio', 'inf'];
function fakeYear(sid, schoolId, label, classes, seed) {
  const R = rng(seed), [d1] = range(label), y = +label.slice(0, 4);
  const mk = (cname, grade, hr) => ({
    id: `${sid}-${label.replace("/", "-")}-${cname}`, class_name: cname, grade, homeroom: hr,
    students: NM.slice(0, 7).map((n, i) => {
      const lvl = 3 + R() * 2, g = [];
      SUBJ.forEach(sj => { const k = 7 + Math.floor(R() * 5); for (let j = 0; j < k; j++) { const m = 9 + Math.floor(j * 8 / k), dd = 5 + Math.floor(R() * 20); const v = Math.max(2, Math.min(5, Math.round(lvl + (R() - .5) * 2.2))); g.push([sj, v, ['hw', 'act', 'ind', 'test', 'talk'][Math.floor(R() * 5)], `${m > 12 ? y + 1 : y}-${String(m > 12 ? m - 12 : m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`]); } });
      const nn = Math.floor(R() * 9), ll = Math.floor(R() * 5);
      return { n: n + (cname.startsWith('9') ? '' : ' '), b: `${y - grade - 6}-0${1 + (i % 9)}-1${i % 9}`, g, a: { p: 160 - nn - ll, n: nn, l: ll }, ad: [], d: { characteristic: i === 0 ? 'Отличник. Ответственный, помогает одноклассникам, активно участвует в олимпиадах.' : 'Учится стабильно, посещает занятия, поддерживает хорошие отношения с классом.', address: 'г. Бишкек', health: 'I (основная)', family: 'Полная семья' }, docs: [{ t: 'birth_cert', s: 'have' }, { t: 'med_026', s: 'have' }, { t: 'parent_id', s: i % 4 ? 'have' : 'missing' }], rec: i === 0 ? [{ k: 'award', t: 'Грамота за 1 место в городской олимпиаде', d: `${y + 1}-03-14` }] : [] };
    }),
  });
  return { id: `y-${sid}-${label.replace("/", "-")}`, school_id: schoolId, label, closed_at: `${y + 1}-06-05T09:00:00Z`, auto: true, cleared: true, classes: classes.map(c => mk(c[0], c[1], c[2])) };
}
function demoStore() {
  try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.v === 1) return r; } catch {}
  const d = {
    v: 1, schools: [
      { id: 'demo1', name: 'Школа №12 (демо)', city: 'Бишкек', code: 'SCH-DEMO1', students: 16, staff: 4 },
      { id: 'demo2', name: 'Гимназия №5 (демо)', city: 'Ош', code: 'SCH-DEMO2', students: 412, staff: 31 },
      { id: 'demo3', name: 'Школа-лицей «Алатоо» (демо)', city: 'Каракол', code: 'SCH-DEMO3', students: 268, staff: 22 }],
    years: [
      fakeYear('d1', 'demo1', '2024/2025', [['8А', 8, 'Гульнара Эсеновна'], ['8Б', 8, 'Эрмек Жанболотов']], 11),
      fakeYear('d1', 'demo1', '2023/2024', [['7А', 7, 'Гульнара Эсеновна']], 12),
      fakeYear('d2', 'demo2', '2024/2025', [['10А', 10, 'Асель Кадырова'], ['5Б', 5, 'Нурлан Бейшенов']], 13),
      fakeYear('d3', 'demo3', '2024/2025', [['11А', 11, 'Айнура Мусаева']], 14)],
  };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
  return d;
}
const demoSave = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
export function resetDemo() { try { localStorage.removeItem(KEY); } catch {} fresh(); }

// снимок текущей демо-школы
function snapshotDemo(label) {
  const st = S.state(), [d1, d2] = range(label);
  const byCls = {};
  st.classes.forEach(c => { byCls[c.name] = { id: 'c-' + c.name, class_name: c.name, grade: c.grade, homeroom: (st.staff.find(x => x.id === c.homeroom) || {}).name || '', students: [] }; });
  st.students.forEach(s => {
    const c = byCls[s.cls]; if (!c) return;
    const g = st.grades.filter(x => x.sid === s.id && x.date >= d1 && x.date <= d2).map(x => [x.subj, x.value, x.type, x.date]);
    const a = { p: 0, n: 0, l: 0 }, ad = [];
    Object.keys(st.att).sort().forEach(dt => { const v = st.att[dt] && st.att[dt][s.id]; if (!v || dt < d1 || dt > d2) return; a[v] = (a[v] || 0) + 1; if (v !== 'p') ad.push([dt, v]); });
    const dd = st.dossier[s.id] || {}, dc = st.docs[s.id] || {};
    c.students.push({ n: s.name, b: s.birth || null, g, a, ad, d: { characteristic: dd.characteristic || '', address: dd.address || '', health: dd.health || '', family: dd.family || '' }, docs: Object.keys(dc).map(k => ({ t: k, s: dc[k].status, num: dc[k].number || '' })), rec: (st.records[s.id] || []).map(r => ({ k: r.kind, t: r.text, d: r.date })) });
  });
  return Object.values(byCls);
}

// ---------- доступ к данным ----------
const live = () => S.isLive();
function mySchoolId() { const st = S.state(); return live() ? (st.school && st.school.id) : 'demo1'; }
const isSuper = () => (S.state().session || {}).role === 'super';
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
const yearsOf = schoolId => load('y:' + schoolId, async () => live()
  ? (await API.select('archive_years', `school_id=eq.${schoolId}&select=*&order=label.desc`)).map(y => ({ ...y }))
  : demoStore().years.filter(y => y.school_id === schoolId).sort((a, b) => b.label.localeCompare(a.label)).map(y => ({ ...y, stats: { classes: y.classes.length, students: y.classes.reduce((n, c) => n + c.students.length, 0), grades: y.classes.reduce((n, c) => n + c.students.reduce((m, s) => m + s.g.length, 0), 0) } })));
const classesOf = yearId => load('c:' + yearId, async () => live()
  ? API.select('archive_classes', `year_id=eq.${yearId}&select=id,class_name,grade,homeroom,students&order=grade.asc.nullslast,class_name.asc`)
  : (demoStore().years.find(y => y.id === yearId) || { classes: [] }).classes);
const overview = () => load('ov', async () => {
  if (live()) { const r = await API.rpc('super_overview'); if (!r.ok) throw new Error('Нет доступа'); return r.schools; }
  const d = demoStore(); return d.schools.map(s => ({ ...s, years: d.years.filter(y => y.school_id === s.id).sort((a, b) => b.label.localeCompare(a.label)).map(y => ({ id: y.id, label: y.label, at: y.closed_at, auto: y.auto, stats: { classes: y.classes.length, students: y.classes.reduce((n, c) => n + c.students.length, 0) } })) }));
});

// ---------- действия ----------
export async function closeYear(label, clear, schoolId) {
  if (live()) {
    const r = await API.rpc('archive_close_year', { p_label: label, p_clear: !!clear, p_school: schoolId || null });
    if (!r.ok) throw new Error({ exists: `Год ${label} уже в архиве`, forbidden: 'Закрыть год может только директор', bad_label: 'Формат года: 2025/2026', failed: 'Не удалось создать архив' }[r.error] || r.error);
    fresh(); await S.hydrate(); return r;
  }
  const d = demoStore();
  if (d.years.some(y => y.school_id === 'demo1' && y.label === label)) throw new Error(`Год ${label} уже в архиве`);
  const classes = snapshotDemo(label);
  d.years.push({ id: `y-demo1-${label.replace("/", "-")}`, school_id: 'demo1', label, closed_at: new Date().toISOString(), auto: false, cleared: false, classes });
  demoSave(d); fresh();
  return { ok: true, classes: classes.length, students: classes.reduce((n, c) => n + c.students.length, 0) };
}
export async function autoClose() {            // при заходе директора летом — сохранить только что закончившийся год
  const lb = endedLabel(); if (!lb || !live()) return;
  try { const r = await API.rpc('archive_auto'); if (r && r.ok && r.id) { fresh(); toast(`Учебный год ${lb} сохранён в архив`, 'ok'); } } catch {}
}

// ---------- представление ----------
const stat = (n, l) => `<div class="kpi"><small>${l}</small><b>${n}</b></div>`;
const dt = s => { try { return new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s || ''; } };
const wait = r => r === 'loading' ? '<div class="card"><p class="muted" role="status">Загружаем архив…</p></div>' : (r && r.err) ? `<div class="card"><p>⚠️ ${esc(r.err)}</p></div>` : null;
const crumbs = list => `<nav class="crumbs" aria-label="Путь">${list.map(([h, n], i) => h ? `<a href="#/${h}">${esc(n)}</a>` : `<span>${esc(n)}</span>`).join('<i>›</i>')}</nav>`;

function yearsView(base, schoolId, schoolName, canClose) {
  const ys = yearsOf(schoolId), w = wait(ys); 
  const now = yearLabelOf(), have = Array.isArray(ys) && ys.some(y => y.label === now);
  const closeBox = canClose ? `<div class="card"><h3>Завершить учебный год</h3>
    <p class="muted">Все оценки, посещаемость и дела учеников за год сохранятся в архиве и больше не изменятся. Автоматически это происходит с 1 июня по 31 августа при входе директора.</p>
    <form data-form="arch-close" class="inline"><label>Учебный год <input name="label" value="${now}" pattern="\\d{4}/\\d{4}" inputmode="numeric" required></label>
    ${live() ? `<label class="chk"><input type="checkbox" name="clear"> Начать новый год: очистить журнал после архивации</label>` : '<p class="muted">В демо журнал после архивации не очищается.</p>'}
    <button class="btn blue" type="submit">Сохранить в архив</button></form></div>` : '';
  return `${head('Архив', schoolName, 'Учебный год → класс → ученик. Данные только для чтения.')}
    ${canClose ? closeBox : ''}
    ${w || (ys.length ? `<div class="archgrid">${ys.map(y => `<a class="card yr" href="#/${base}/${y.id}"><small>Учебный год</small><b>${esc(y.label)}</b>
        <span>${(y.stats && y.stats.classes) || 0} ${plural((y.stats && y.stats.classes) || 0, 'класс', 'класса', 'классов')} · ${(y.stats && y.stats.students) || 0} ${plural((y.stats && y.stats.students) || 0, 'ученик', 'ученика', 'учеников')}</span>
        <small class="muted">${y.auto ? 'Сохранён автоматически' : 'Сохранён вручную'} · ${dt(y.closed_at)}${y.cleared ? ' · журнал очищен' : ''}</small></a>`).join('')}</div>`
      : `<div class="card"><p>Архив пока пуст. Здесь появится «Учебный год ${now}» после завершения года.</p></div>`)}`;
}
function classesView(base, yearId, label, back) {
  const cs = classesOf(yearId), w = wait(cs);
  return `${crumbs([...back, [null, `Учебный год ${label}`]])}${head(`Учебный год ${label}`, 'Классы', 'Выберите класс, чтобы увидеть учеников и их дневники за этот год.')}
    ${w || `<div class="archgrid">${cs.map((c, i) => `<a class="card yr" href="#/${base}/${yearId}/${i}"><small>Класс</small><b>${esc(c.class_name)}</b><span>${c.students.length} ${plural(c.students.length, 'ученик', 'ученика', 'учеников')}</span><small class="muted">Классный руководитель: ${esc(c.homeroom || '—')}</small></a>`).join('') || '<div class="card"><p>Классов нет.</p></div>'}</div>`}`;
}
const gl = s => s.g.map(([subj, value, type, date]) => ({ subj, value, type, date }));
function classView(base, yearId, label, ci, back) {
  const cs = classesOf(yearId), w = wait(cs); const c = Array.isArray(cs) && cs[ci];
  if (w || !c) return w || '<div class="card"><p>Класс не найден.</p></div>';
  const rows = c.students.map((s, i) => { const gs = gl(s), a = wavg(gs); return `<a class="row" href="#/${base}/${yearId}/${ci}/${i}"><div><b>${esc(s.n)}</b><small class="muted">${gs.length} оценок · пропусков: ${s.a.n || 0}</small></div><span class="g g${finalGrade(gs) || 3}" aria-label="Средний балл ${fmt2(a)}">${fmt2(a)}</span></a>`; }).join('');
  return `${crumbs([...back, [`${base}/${yearId}`, `Учебный год ${label}`], [null, `Класс ${c.class_name}`]])}${head(`Класс ${c.class_name}`, `Учебный год ${label}`, `Классный руководитель: ${esc(c.homeroom || '—')}`)}
    <div class="card">${rows || '<p class="muted">Нет учеников.</p>'}</div>`;
}
function studentView(base, yearId, label, ci, si, back) {
  const cs = classesOf(yearId), w = wait(cs); const c = Array.isArray(cs) && cs[ci], s = c && c.students[si];
  if (w || !s) return w || '<div class="card"><p>Ученик не найден.</p></div>';
  const gs = gl(s), bySubj = {}; gs.forEach(g => (bySubj[g.subj] = bySubj[g.subj] || []).push(g));
  const total = (s.a.p || 0) + (s.a.n || 0) + (s.a.l || 0);
  const subjRows = Object.keys(bySubj).map(sj => { const L = bySubj[sj].sort((a, b) => a.date.localeCompare(b.date)); const f = finalGrade(L);
    return `<details class="card subj"><summary><b>${esc(sjName(sj))}</b><span class="muted">${fmt2(wavg(L))}</span><span class="g g${f}">${f}</span></summary>
      <table class="tbl"><thead><tr><th>Дата</th><th>За что</th><th>Оценка</th></tr></thead><tbody>${L.map(g => `<tr><td>${dmy(g.date)}.${g.date.slice(2, 4)}</td><td>${esc(typeName(g.type))}${TYPES[g.type] && TYPES[g.type].w > 1 ? ' (×2)' : ''}</td><td><span class="g g${g.value}">${g.value}</span></td></tr>`).join('')}</tbody></table></details>`; }).join('');
  const d = s.d || {};
  return `${crumbs([...back, [`${base}/${yearId}`, `Учебный год ${label}`], [`${base}/${yearId}/${ci}`, `Класс ${c.class_name}`], [null, s.n]])}
    ${head(s.n, `Класс ${c.class_name} · ${label}`, `Итог за год — среднее ${fmt2(wavg(gs))}`, `<button class="btn" data-act="arch-print">🖨 Печать</button>`)}
    <div class="kpis">${stat(fmt2(wavg(gs)), 'Средний балл')}${stat(gs.length, 'Оценок за год')}${stat(s.a.n || 0, 'Пропусков («Н»)')}${stat(total ? Math.round((s.a.p || 0) / total * 100) + '%' : '—', 'Посещаемость')}</div>
    <h3>Дневник за год: что и за что получено</h3>${subjRows || '<div class="card"><p class="muted">Оценок нет.</p></div>'}
    <h3>Личное дело</h3>
    <div class="card"><dl class="dl"><dt>Характеристика</dt><dd>${esc(d.characteristic || '—')}</dd><dt>Адрес</dt><dd>${esc(d.address || '—')}</dd><dt>Группа здоровья</dt><dd>${esc(d.health || '—')}</dd><dt>Семья</dt><dd>${esc(d.family || '—')}</dd></dl>
      ${(s.docs || []).length ? `<h4>Документы</h4><div class="chips2">${s.docs.map(x => `<span class="pillx ${x.s === 'have' ? 'ok' : ''}">${esc(docLabel(x.t))}: ${x.s === 'have' ? 'есть' : x.s === 'na' ? 'не требуется' : 'нет'}</span>`).join('')}</div>` : ''}
      ${(s.rec || []).length ? `<h4>Записи</h4><ul>${s.rec.map(r => `<li><b>${esc(REC_KINDS[r.k] || r.k)}</b> · ${esc(r.t)} <small class="muted">${esc(r.d || '')}</small></li>`).join('')}</ul>` : ''}</div>`;
}

// маршрутизация: parts — остаток пути после «admin/archive» либо «super/<school>»
export function adminPage(parts) {
  const base = 'admin/archive', st = S.state(), sc = st.school ? st.school.name : '';
  const [yearId, ci, si] = parts;
  const back = [['admin/archive', 'Архив']];
  if (yearId) { const ys = yearsOf(mySchoolId()); const y = Array.isArray(ys) && ys.find(x => x.id === yearId); if (!y) return wait(ys) || '<div class="card"><p>Год не найден.</p></div>';
    if (ci === undefined) return classesView(base, yearId, y.label, back);
    if (si === undefined) return classView(base, yearId, y.label, +ci, back);
    return studentView(base, yearId, y.label, +ci, +si, back); }
  return yearsView(base, mySchoolId(), sc, (st.session.level || 'director') === 'director');
}
export function superPage(parts) {
  const [schoolId, yearId, ci, si] = parts;
  if (!schoolId) {
    const ov = overview(), w = wait(ov);
    return `${head('Школы платформы', 'SABAK+', 'Технический администратор: список школ, архив и состояние данных.')}${w || `<div class="kpis">${stat(ov.length, 'Школ')}${stat(ov.reduce((n, s) => n + (+s.students || 0), 0), 'Учеников')}${stat(ov.reduce((n, s) => n + (s.years || []).length, 0), 'Учебных годов в архиве')}</div>
      <div class="archgrid">${ov.map(s => `<a class="card yr" href="#/super/${s.id}"><small>${esc(s.city || '')}</small><b>${esc(s.name)}</b><span>${s.students || 0} учеников · ${s.staff || 0} сотрудников</span><small class="muted">В архиве: ${(s.years || []).map(y => y.label).join(', ') || 'пока пусто'}</small></a>`).join('')}</div>
      <div class="card"><h3>Техническая справка</h3><p class="muted">Новые школы подключаются по одноразовому ключу (раздел «Как подключить школу» на сайте). Архивы нельзя менять или удалять из приложения — только читать.</p></div>`}`;
  }
  const ov = overview(), w = wait(ov), sch = Array.isArray(ov) && ov.find(s => s.id === schoolId);
  if (!sch) return w || '<div class="card"><p>Школа не найдена.</p></div>';
  const base = `super/${schoolId}`, back = [['super', 'Школы'], [base, sch.name]];
  if (yearId) { const y = (sch.years || []).find(x => x.id === yearId); if (!y) return '<div class="card"><p>Год не найден.</p></div>';
    if (ci === undefined) return classesView(base, yearId, y.label, back);
    if (si === undefined) return classView(base, yearId, y.label, +ci, back);
    return studentView(base, yearId, y.label, +ci, +si, back); }
  return `${crumbs([['super', 'Школы'], [null, sch.name]])}${yearsView(base, schoolId, sch.name, false)}`;
}

export async function act(name, el) {
  if (name === 'arch-print') { window.print(); return true; }
  return false;
}
export function submit(form, fd) {
  if (form.dataset.form !== 'arch-close') return false;
  const label = String(fd.get('label') || '').trim(), clear = fd.get('clear') === 'on';
  if (!/^\d{4}\/\d{4}$/.test(label) || +label.slice(5) !== +label.slice(0, 4) + 1) { toast('Формат года: 2025/2026', 'warn'); return true; }
  if (!confirm(`Сохранить учебный год ${label} в архив?${clear ? '\nЖурнал будет очищен для нового года.' : ''}`)) return true;
  closeYear(label, clear).then(r => { toast(`Сохранено: ${r.classes} кл., ${r.students} уч.`, 'ok'); rerender(); }).catch(e => toast(e.message, 'warn'));
  return true;
}
