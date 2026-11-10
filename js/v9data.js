// Данные v0.11: календарь четвертей, архив, табель, отчёты, удостоверение. live — функции Supabase (schema_v8.sql); demo — тот же формат ответов из localStorage.
import * as S from './store.js';
import * as API from './api.js';
import * as RC from './rcache.js';
import * as T from './termcal.js';

const KEY = 'sabak.v9.demo', live = () => S.isLive();
const err = error => ({ ok: false, error });
const sess = () => S.state().session || {};
const isSuper = () => sess().role === 'super' || sess().level === 'superadmin';
const isStaff = () => ['teacher', 'admin', 'deputy', 'director'].includes(sess().role);
const WV = { test: 2 };
const w = t => WV[t] || 1;
const fin = gs => { let sw = 0, s = 0; gs.forEach(g => { sw += w(g[1]); s += w(g[1]) * g[0]; }); return sw ? { avg: Math.round(s / sw * 100) / 100, final: Math.floor(s / sw + 0.5 + 1e-9) } : { avg: null, final: null }; };

let mem = null;
function seed() {
  const cur = T.yearLabel(), prev = T.prevYear(cur), prev2 = T.prevYear(prev);
  const terms = [...T.defaultTerms(prev2), ...T.defaultTerms(prev), ...T.defaultTerms(cur)].map(t => ({ ...t, decree: t.year === cur ? 'Образец дат (демо). Реальные даты задаёт приказ министерства' : 'Демо' }));
  // оцифрованные прошлые годы: у Айданы заполнено, у остальных нет — так видно оба состояния
  const subs = ['math', 'rus', 'kyr', 'eng', 'hist', 'phys', 'bio', 'inf'], h = (a, b) => ((a.charCodeAt(0) * 7 + b * 13) % 5);
  const past = { s1: {} };
  [[prev, [1, 2, 3, 4, 5]], [prev2, [3, 4, 5]]].forEach(([y, qs]) => { past.s1[y] = {}; qs.forEach(q => { past.s1[y][q] = {}; subs.forEach(s => { const base = [4, 5, 4, 3, 5][h(s, q)]; past.s1[y][q][s] = Math.max(3, Math.min(5, base - (s === 'math' && q < 3 ? 1 : 0))); }); }); });
  return { v: 1, terms, qa: [], runs: [], past, gnotes: {} };
}
function D() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
  if (!mem || mem.v !== 1) mem = seed();
  save(); return mem;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} }
export function resetDemo() { mem = null; try { localStorage.removeItem(KEY); } catch {} }
export const demoTerms = () => D().terms;

// ---------- календарь ----------
function calGet(a = {}) {
  const td = T.today(), lb = a.p_year || T.yearLabel(td), d = D();
  const years = [...new Set(d.terms.map(t => t.year))].sort().reverse();
  const terms = d.terms.filter(t => t.year === lb).sort((x, y) => x.starts.localeCompare(y.starts)).map(t => ({ ...t, status: td < t.starts ? 'upcoming' : td <= t.ends ? 'open' : 'closed' }));
  const all = [...d.terms].sort((x, y) => x.starts.localeCompare(y.starts));
  const cur = all.find(t => td >= t.starts && td <= t.ends) || null, nxt = all.find(t => t.starts > td) || null;
  return { ok: true, today: td, year: T.yearLabel(td), label: lb, years, terms, current: cur, next: nxt, all: d.terms };
}
function calSet(a) {
  if (!isSuper()) return err('forbidden');
  const lb = a.p_year; if (!/^\d{4}\/\d{4}$/.test(lb || '') || Number(lb.slice(5)) !== Number(lb.slice(0, 4)) + 1) return err('bad_year');
  const items = a.p_items; if (!Array.isArray(items) || !items.length || items.length > 8) return err('items');
  const y = Number(lb.slice(0, 4)), seenQ = new Set(), seenB = new Set();
  for (const it of items) {
    if (!['quarter', 'break'].includes(it.kind) || !(it.num >= 1 && it.num <= 4) || !it.starts || !it.ends) return err('items');
    if (it.ends < it.starts) return err('range');
    if (it.starts < `${y}-08-01` || it.ends > `${y + 1}-08-31`) return err('outside_year');
    const set = it.kind === 'quarter' ? seenQ : seenB; if (set.has(it.num)) return err('dup'); set.add(it.num);
  }
  const sorted = [...items].sort((p, q) => p.starts.localeCompare(q.starts));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].starts <= sorted[i - 1].ends) return err('overlap');
  const qs = items.filter(i => i.kind === 'quarter'); for (const p of qs) for (const q of qs) if (p.num < q.num && p.starts > q.starts) return err('order');
  const d = D();
  for (const r of d.runs.filter(r => r.year === lb)) { const old = d.terms.find(t => t.year === lb && t.kind === 'quarter' && t.num === r.q), nw = qs.find(i => i.num === r.q); if (!nw || !old || old.starts !== nw.starts || old.ends !== nw.ends) return err('archived'); }
  d.terms = d.terms.filter(t => t.year !== lb).concat(items.map(i => ({ year: lb, kind: i.kind, num: i.num, starts: i.starts, ends: i.ends, decree: (a.p_decree || '').trim() || null })));
  save(); T.setTerms(d.terms); return { ok: true, items: items.length };
}
// архив четверти: итоги по каждому ученику и предмету
function tick() {
  const d = D(), st = S.state(), td = T.today(), done = [];
  d.terms.filter(t => t.kind === 'quarter' && t.ends < td).sort((a, b) => a.starts.localeCompare(b.starts)).forEach(t => {
    if (d.runs.some(r => r.year === t.year && r.q === t.num)) return;
    const by = {};
    st.grades.filter(g => g.date >= t.starts && g.date <= t.ends).forEach(g => { (by[g.sid + '|' + g.subj] = by[g.sid + '|' + g.subj] || []).push([g.value, g.type, g.date, g.topic || null]); });
    let rows = 0;
    Object.entries(by).forEach(([k, gs]) => { const [sid, subj] = k.split('|'), s = st.students.find(x => x.id === sid), f = fin(gs); d.qa.push({ year: t.year, q: t.num, sid, name: s ? s.name : '—', cls: s ? s.cls : '', subj, g: gs.sort((a, b) => a[2].localeCompare(b[2])), n: gs.length, avg: f.avg, final: f.final }); rows++; });
    d.runs.push({ year: t.year, q: t.num, at: new Date().toISOString(), rows }); done.push({ year: t.year, quarter: t.num, rows });
  });
  if (done.length) save();
  return { ok: true, archived: done };
}
function history(a) {
  const d = D(), rows = [];
  d.qa.filter(x => x.sid === a.p_sid).forEach(x => rows.push({ year: x.year, quarter: x.q, subject: x.subj, final: x.final, avg: x.avg, n: x.n, src: 'archive' }));
  Object.entries(d.past[a.p_sid] || {}).forEach(([y, qs]) => Object.entries(qs).forEach(([q, ss]) => Object.entries(ss).forEach(([sj, v]) => { if (!rows.some(r => r.year === y && r.quarter === Number(q) && r.subject === sj)) rows.push({ year: y, quarter: Number(q), subject: sj, final: v, avg: null, n: null, src: 'manual' }); })));
  rows.sort((p, q) => q.year.localeCompare(p.year) || p.quarter - q.quarter);
  return { ok: true, rows };
}
function pastSet(a) {
  const u = sess(), st = S.state(), s = st.students.find(x => x.id === a.p_sid);
  if (!s || !isStaff()) return err('forbidden');
  if (u.role === 'teacher' && !((u.classes || []).includes(s.cls))) return err('forbidden');
  if (!/^\d{4}\/\d{4}$/.test(a.p_year || '')) return err('bad_year');
  if (Number(a.p_year.slice(0, 4)) >= Number(T.yearLabel().slice(0, 4))) return err('not_past');
  if (!(a.p_quarter >= 1 && a.p_quarter <= 5)) return err('quarter');
  const d = D();
  if (a.p_quarter <= 4 && d.qa.some(x => x.sid === a.p_sid && x.year === a.p_year && x.q === a.p_quarter && x.subj === a.p_subject)) return err('archived');
  const m = ((d.past[a.p_sid] = d.past[a.p_sid] || {})[a.p_year] = d.past[a.p_sid][a.p_year] || {});
  if (a.p_value == null) { if (m[a.p_quarter]) delete m[a.p_quarter][a.p_subject]; save(); return { ok: true }; }
  if (!(a.p_value >= 2 && a.p_value <= 5)) return err('value');
  (m[a.p_quarter] = m[a.p_quarter] || {})[a.p_subject] = a.p_value; save(); return { ok: true };
}
function report(a) {
  const u = sess(), st = S.state(); if (!isStaff()) return err('forbidden');
  const year = a.p_year, q = a.p_quarter || 0, rg = T.rangeOf(year, q);
  if (q && (!rg || !T.hasCalendar(year))) return err('no_term');
  const cls = a.p_class ? (st.classes.find(c => c.id === a.p_class) || {}).name : null;
  const own = n => u.role !== 'teacher' || (u.classes || []).includes(n);
  const [d1, d2] = rg;
  const by = {};
  st.grades.filter(g => g.date >= d1 && g.date <= d2 && (!a.p_subject || g.subj === a.p_subject)).forEach(g => {
    const s = st.students.find(x => x.id === g.sid); if (!s || (cls && s.cls !== cls) || !own(s.cls)) return;
    (by[g.sid + '|' + g.subj] = by[g.sid + '|' + g.subj] || { sid: g.sid, name: s.name, cls: s.cls, subject: g.subj, g: [] }).g.push([g.value, g.type, g.date, g.topic || null]);
  });
  let rows = Object.values(by), src = 'live';
  rows.forEach(r => { r.g.sort((x, y) => x[2].localeCompare(y[2])); let p = 0, n = 0, l = 0; Object.entries(st.att).forEach(([dt, m]) => { if (dt >= d1 && dt <= d2 && m[r.sid]) { if (m[r.sid] === 'p') p++; else if (m[r.sid] === 'n') n++; else l++; } }); r.a = { p, n, l }; });
  if (!rows.length) {
    src = 'archive'; const m = {};
    D().qa.filter(x => x.year === year && (!q || x.q === q) && (!a.p_subject || x.subj === a.p_subject) && (!cls || x.cls === cls) && own(x.cls)).forEach(x => { const r = (m[x.sid + '|' + x.subj] = m[x.sid + '|' + x.subj] || { sid: x.sid, name: x.name, cls: x.cls, subject: x.subj, g: [], a: null }); r.g.push(...x.g); });
    rows = Object.values(m);
  }
  rows.sort((p, r) => (p.cls + p.name + p.subject).localeCompare(r.cls + r.name + r.subject));
  return { ok: true, src, from: d1, to: d2, rows };
}
function idCard(a) {
  const st = S.state(), s = st.students.find(x => x.id === a.p_sid); if (!s) return err('forbidden');
  const u = sess(); if (u.role === 'student' && u.id !== s.id) return err('forbidden'); if (u.role === 'parent' && !(u.children || [u.child]).includes(s.id)) return err('forbidden');
  const c = st.classes.find(x => x.name === s.cls) || {}, hr = st.staff.find(x => x.id === c.homeroom);
  const sur = (s.name || '').split(' ')[0];
  const parents = s.id === 's1' ? [{ name: 'Төлөбаева Назгүл', phone: '+996 555 123 456', rel: 'Мать' }, { name: 'Төлөбаев Эмил', phone: '+996 700 765 432', rel: 'Отец' }]
    : [{ name: sur.replace(/а$/, 'ов') + ' (родитель)', phone: '+996 55' + (5 + (s.name.length % 4)) + ' ' + String(100 + s.name.length * 17).slice(0, 3) + ' ' + String(200 + s.name.charCodeAt(1) % 700).slice(0, 3), rel: 'Родитель' }];
  return { ok: true, school: { name: st.school.name.replace(' (демо)', ''), city: st.school.city, code: st.school.code },
    student: { id: s.id, name: s.name, birth: s.birth || (s.id === 's1' ? '2010-03-14' : `201${(s.name.length % 2)}-0${1 + (s.name.length % 9)}-1${s.name.length % 9}`), gender: null, class: s.cls, grade: c.grade, photo_path: null, number: 'ID-' + (s.id + s.name).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).toUpperCase().padStart(8, '0').slice(0, 8) },
    homeroom: hr ? { name: hr.name, phone: hr.phone } : null, parents, year: T.yearLabel() };
}
function gradeDetail(a) {
  const st = S.state(), g = st.grades.find(x => x.id === a.p_id); if (!g) return err('not_found');
  const tch = st.staff.find(x => x.id === g.by), notes = D().gnotes[g.id] || [];
  const snap = x => ({ value: x.value, type: x.type, date: x.date, topic: x.topic || null, comment: x.comment || null, reason: x.reason || null });
  return { ok: true, grade: { id: g.id, value: g.value, type: g.type, date: g.date, topic: g.topic || null, comment: g.comment || null, reason: g.reason || null, note: g.note || null, teacher: tch ? tch.name : 'Учитель', created: g.ts || g.date + 'T09:00:00', updated: notes.length ? notes[notes.length - 1].at : null },
    log: [{ action: 'insert', at: g.ts || g.date + 'T09:00:00', who: tch ? tch.name : 'Учитель', old: null, new: snap({ ...g, topic: notes.length ? notes[0].old.topic : g.topic, comment: notes.length ? notes[0].old.comment : g.comment }) }, ...notes.map(n => ({ action: 'update', at: n.at, who: n.who, old: n.old, new: n.new }))] };
}
function gradeNote(a) {
  const st = S.state(), g = st.grades.find(x => x.id === a.p_id); if (!g) return err('not_found');
  if (sess().role !== 'teacher' || g.by !== sess().id) return err('forbidden');
  if (String(a.p_topic || '').length > 120 || String(a.p_comment || '').length > 300) return err('long');
  const old = { value: g.value, type: g.type, date: g.date, topic: g.topic || null, comment: g.comment || null, reason: g.reason || null };
  g.topic = (a.p_topic || '').trim() || null; g.comment = (a.p_comment || '').trim() || null;
  (D().gnotes[g.id] = D().gnotes[g.id] || []).push({ at: new Date().toISOString(), who: sess().name || 'Учитель', old, new: { ...old, topic: g.topic, comment: g.comment } });
  save(); S.touch(); return { ok: true };
}

const DEMO = { term_tick_all: () => ({ ok: true, archived: tick().archived.length }), calendar_get: calGet, calendar_set: calSet, term_tick: tick, student_history: history, past_grade_set: pastSet, report_rows: report, id_card: idCard, grade_detail: gradeDetail, grade_note_set: gradeNote };

export async function call(name, args = {}) {
  if (live()) {
    try { return await RC.queued(name, args, () => RC.cached(name, args, async () => { try { return await API.rpc(name, args); } catch (e) { if (e.network) return { ok: false, error: 'network' }; throw e; } }), S.enqueueRpc); } catch (e) { if (e.network) return { ok: false, error: 'network' }; if (/Could not find the function|PGRST202|404/.test(e.message + (e.body ? JSON.stringify(e.body) : ''))) return { ok: false, error: 'not_deployed' }; throw e; }
  }
  const f = DEMO[name]; if (!f) return err('not_found');
  return JSON.parse(JSON.stringify(await f(args)));
}

export const ERR = {
  forbidden: 'Нет доступа', bad_year: 'Учебный год вида 2026/2027', items: 'Заполните даты четвертей и каникул', range: 'Дата окончания раньше даты начала', outside_year: 'Даты должны быть между 1 августа и 31 августа следующего года',
  dup: 'Одна и та же четверть указана дважды', overlap: 'Периоды пересекаются: проверьте даты', order: 'Четверти должны идти по порядку', archived: 'По этой четверти уже сделан архив, её даты менять нельзя',
  no_term: 'Для этого периода в календаре нет дат четверти', not_past: 'Прошлые годы вносят только за завершившиеся учебные годы', quarter: 'Неверная четверть', subject: 'Нет такого предмета', value: 'Оценка от 2 до 5', long: 'Слишком длинный текст',
  not_deployed: 'Сервер ещё не обновлён: выполните schema_v8.sql в Supabase', network: 'Нет связи', not_found: 'Не найдено',
};
export const need = r => { if (!r || !r.ok) throw new Error(ERR[r && r.error] || (r && r.error) || 'Ошибка'); return r; };

/** Загрузка календаря в общий кэш (один раз за сессию) и ночной архив четвертей */
// «Закрыть закончившиеся четверти» достаточно проверять раз в сутки на устройстве, а не при каждом открытии
function tickDaily() {
  const key = 'sabak.tick.' + (API.userId() || ''), today = T.today();
  try { if (localStorage.getItem(key) === today) return; } catch {}
  call('term_tick', {}).then(r => { if (r && r.ok) { try { localStorage.setItem(key, today); } catch {} } }).catch(() => {});
}
export async function boot() {
  if (T.cache.loading) return; T.cache.loading = true;
  try {
    if (!live()) { const d = D(); T.setTerms(d.terms); T.cache.deployed = true; tick(); return; }
    const c = await call('calendar_get', {});
    if (c && c.ok) { T.cache.deployed = true; const lb = c.year, items = [...c.terms.map(t => ({ ...t, year: c.label }))];
      for (const y of [T.prevYear(lb), T.nextYear(lb)]) { if (c.years.includes(y)) { const r = await call('calendar_get', { p_year: y }); if (r.ok) items.push(...r.terms.map(t => ({ ...t, year: y }))); } }
      T.setTerms(items); tickDaily(); }
    else { T.cache.deployed = false; T.setTerms([]); }
  } catch { T.cache.loaded = true; } finally { T.cache.loading = false; }
}
export function reset() { T.cache.loaded = false; T.cache.loading = false; T.cache.terms = []; }

export async function boot0() { reset(); await boot(); }
