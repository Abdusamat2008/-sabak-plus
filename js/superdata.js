// Данные центра управления: live — функции Supabase (schema_v5.sql), demo — тот же формат ответов из localStorage.
import * as S from './store.js';
import * as API from './api.js';
import { demoYears } from './archive.js';

const KEY = 'sabak.super.demo', live = () => S.isLive();
const day = n => { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10); };
const iso = n => new Date(Date.now() - n * 864e5).toISOString();
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let uid = 1000; const nid = () => 'd' + (uid++) + Math.floor(Math.random() * 1e4);

const SCH = [
  ['demo1', 'Школа №12 (демо)', 'Бишкек', 'SCH-DEMO1', 'Бекова Нурзат Айтматовна', '+996 700 123 456', 'bekova@school12.kg', 90, 480, 31, 2, 1],
  ['demo2', 'Гимназия №5 (демо)', 'Ош', 'SCH-DEMO2', 'Кадырова Асель Маратовна', '+996 555 220 410', 'kadyrova@gym5.kg', 200, 412, 28, 3, 0],
  ['demo3', 'Школа-лицей «Алатоо» (демо)', 'Каракол', 'SCH-DEMO3', 'Мусаев Айбек Турсунович', '+996 709 311 877', 'musaev@alatoo.kg', 140, 268, 19, 1, 2],
  ['demo4', 'Средняя школа №3 (демо)', 'Нарын', 'SCH-DEMO4', 'Жумабекова Гулнара Сатыбалдиевна', '+996 505 700 213', 'gulnara@school3.kg', 25, 96, 9, 0, 0],
  ['demo5', 'Школа им. Ч. Айтматова (демо)', 'Талас', 'SCH-DEMO5', 'Исаков Бакыт Эшенович', '+996 770 456 009', 'isakov@aitmatov.kg', 8, 54, 6, 0, 0]];
const FN = ['Алия Сапарова', 'Эрмек Жанболотов', 'Гульнара Эсеновна', 'Айжан Токтомамбетова', 'Нурлан Бейшенов', 'Мээрим Осмонова', 'Тимур Асанов', 'Салтанат Бакирова', 'Данияр Жумабеков', 'Айгуль Касымова'];

function build(c, i) {
  const R = rng(500 + i * 17), [id, name, city, code, dn, dp, de, age, students, teachers, deputies, pend] = c;
  const grades = Math.round(students * (18 + R() * 12)), by = Array.from({ length: 30 }, (_, k) => { const d = day(29 - k), wk = new Date(d).getDay(); const base = (wk === 0 || wk === 6) ? 0 : Math.round(students * (.25 + R() * .3) * (id === 'demo5' && k > 12 ? 0 : 1)); return [d, base]; });
  const last = [...by].reverse().find(x => x[1] > 0);
  const cls = ['5А', '5Б', '6А', '7А', '8А', '8Б', '9А', '9Б', '10А', '11А'].slice(0, Math.max(3, Math.min(10, Math.round(students / 45)))).map((n, k) => ({ name: n, grade: parseInt(n), lang: k % 3 === 2 ? 'ky' : 'ru', homeroom: FN[k % FN.length], students: Math.round(students / Math.max(3, Math.min(10, Math.round(students / 45))) + (R() * 4 - 2)), avg: +(3.5 + R() * 1.1).toFixed(2) }));
  const staff = [{ id: id + 'd', name: dn, role: 'director', status: 'active', phone: dp, email: de, last: iso(Math.floor(R() * 3)), created: iso(age) }];
  for (let k = 0; k < deputies; k++) staff.push({ id: id + 'v' + k, name: FN[(k + 6) % FN.length], role: 'deputy', status: 'active', phone: '+996 55' + k + ' 100 20' + k, email: 'deputy' + k + '@' + code.toLowerCase() + '.kg', last: iso(1 + k), created: iso(age - 3) });
  for (let k = 0; k < Math.min(teachers, 8); k++) staff.push({ id: id + 't' + k, name: FN[k % FN.length], role: 'teacher', status: 'active', phone: '+996 70' + k + ' 30' + k + ' 4' + k + '5', email: null, last: iso(Math.floor(R() * 9)), created: iso(age - 5) });
  for (let k = 0; k < pend; k++) staff.push({ id: id + 'p' + k, name: 'Новый педагог ' + (k + 1), role: 'teacher', status: 'pending', phone: '+996 777 000 0' + k + '1', email: null, last: null, created: iso(1) });
  const dist = { 2: Math.round(grades * .03), 3: Math.round(grades * .2), 4: Math.round(grades * .4), 5: Math.round(grades * .37) };
  const yrs = demoYears(id);
  return {
    id, name, city, code, status: 'active', reason: null, created: iso(age),
    director: { id: id + 'd', name: dn, phone: dp, email: de, last: staff[0].last, status: 'active' },
    stats: { students, demo_students: 0, parents: Math.round(students * .82), teachers, deputies, pending: pend, blocked: 0, classes: cls.length, grades, grades_30d: by.reduce((s, x) => s + x[1], 0), grades_7d: by.slice(-7).reduce((s, x) => s + x[1], 0), last_grade: last ? last[0] : null,
      avg: +(3.9 + R() * .5).toFixed(2), att_pct: +(90 + R() * 8).toFixed(1), photo_pct: Math.round(40 + R() * 55), docs_pct: Math.round(55 + R() * 40), invites_active: Math.round(R() * 12), anon_msgs: Math.round(R() * 9), anon_unread: Math.round(R() * 3), years: yrs.length, subjects: 8 + Math.round(R() * 5), sched: { title: 'Расписание на осень', at: iso(40) }, sched_pending: i === 1 ? 1 : 0 },
    staff, classes: cls, grade_dist: dist, by_day: by, invites: { active: 6, used: Math.round(students * .7), expired: 4, revoked: 1 },
    years: yrs, notes: i === 0 ? [{ id: nid(), text: 'Пилотная школа. Директор просит добавить экспорт в Excel для завуча.', pinned: true, at: iso(12), by: 'Технический администратор' }] : [],
    audit: [{ at: iso(0.2), action: 'invite.created', who: dn, details: { role: 'teacher' } }, { at: iso(1), action: 'schedule.published', who: dn, details: {} }, { at: iso(2), action: 'invite.redeemed', who: FN[1], details: { role: 'teacher' } }, { at: iso(5), action: 'class.created', who: dn, details: {} }],
  };
}
function seed() {
  const schools = SCH.map(build);
  schools[4].created = iso(8);
  schools[2].status = 'active';
  const mk = (sid, subject, msgs, status) => ({ id: nid(), school_id: sid, school: schools.find(s => s.id === sid).name, subject, status, created: iso(3), updated: iso(1), messages: msgs });
  return {
    v: 2, schools,
    tickets: [mk('demo2', 'Не приходит код подтверждения почты', [{ from: 'school', name: 'Кадырова Асель Маратовна', text: 'Здравствуйте! Учителя не получают шестизначный код на почту mail.ru. Что делать?', at: iso(2) }], 'open'),
      mk('demo3', 'Как перевести учеников в следующий класс?', [{ from: 'school', name: 'Мусаев Айбек Турсунович', text: 'Лето заканчивается, как правильно перевести 9А в 10А?', at: iso(5) }, { from: 'super', name: 'Технический администратор', text: 'Сначала закройте учебный год в разделе «Архив», потом создайте новые классы. Автоматический перевод добавим в следующей версии.', at: iso(4) }], 'answered')],
    requests: [
      { id: nid(), school_name: 'Школа №7', city: 'Джалал-Абад', contact_name: 'Мамытов Эрлан', phone: '0555123456', note: 'Директор. 620 учеников, хотим с нового года.', status: 'new', admin_note: '', created: iso(0.3) },
      { id: nid(), school_name: 'Лицей «Ак-Жол»', city: 'Бишкек', contact_name: 'Омурзакова Назгуль', phone: '0709777888', note: 'Завуч. Директор просил узнать условия.', status: 'talking', admin_note: 'Созвонились 30.10, ждём письмо', created: iso(2) }],
    keys: [{ id: nid(), note: 'Школа №12 (демо)', created: iso(90), used: iso(89), school: 'Школа №12 (демо)' }, { id: nid(), note: 'Лицей «Ак-Жол»', created: iso(1), used: null, school: null }],
    announces: [{ at: iso(6), action: 'super.announce', who: 'Технический администратор', school: null, details: { title: 'Вышла версия 0.6: архив и мобильная версия', to: 5 } }],
    audit: [],
  };
}
let mem = null;
function D() { if (mem) return mem; try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.v === 2) { mem = r; return mem; } } catch {} mem = seed(); save(); return mem; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} };
export function resetDemo() { mem = null; try { localStorage.removeItem(KEY); } catch {} }
const logd = (school, action, details = {}) => { const d = D(); d.audit.unshift({ at: new Date().toISOString(), action, school: school ? school.name : null, school_id: school ? school.id : null, who: 'Технический администратор', details }); save(); };

// ---------- единая точка вызова ----------
export async function call(name, args = {}) {
  if (live()) { const r = await API.rpc(name, args); return r; }
  const d = D(), find = id => d.schools.find(s => s.id === id);
  switch (name) {
    case 'super_dashboard': {
      const sc = d.schools, sum = f => sc.reduce((n, s) => n + f(s), 0);
      const by = Array.from({ length: 30 }, (_, k) => [sc[0].by_day[k][0], sc.reduce((n, s) => n + s.by_day[k][1], 0)]);
      return { ok: true, data: { schools: sc.length, suspended: sc.filter(s => s.status === 'suspended').length, users: sum(s => s.stats.students + s.stats.parents + s.stats.teachers + s.stats.deputies + 1), students: sum(s => s.stats.students), teachers: sum(s => s.stats.teachers), parents: sum(s => s.stats.parents), directors: sc.length, pending: sum(s => s.stats.pending),
        grades: sum(s => s.stats.grades), grades_7d: sum(s => s.stats.grades_7d), att_7d: sum(s => s.stats.students * 5), tickets_open: d.tickets.filter(t => t.status === 'open').length, requests_new: d.requests.filter(r => r.status === 'new').length, years: sum(s => s.years.length), keys_free: d.keys.filter(k => !k.used).length, db_mb: 38.4,
        grades_by_day: by, signups_by_week: Array.from({ length: 8 }, (_, k) => [day(49 - k * 7), 20 + ((k * 37) % 55)]), roles: { director: sc.length, deputy: sum(s => s.stats.deputies), teacher: sum(s => s.stats.teachers), parent: sum(s => s.stats.parents), student: sum(s => s.stats.students), superadmin: 1 },
        inactive: sc.filter(s => s.status === 'active' && (!s.stats.last_grade || s.stats.last_grade < day(14))).map(s => ({ id: s.id, name: s.name, city: s.city, last: s.stats.last_grade, created: s.created })), top: [...sc].sort((a, b) => b.stats.grades_30d - a.stats.grades_30d).slice(0, 5).map(s => ({ id: s.id, name: s.name, n: s.stats.grades_30d })) } };
    }
    case 'super_schools': return { ok: true, schools: d.schools.map(s => ({ id: s.id, name: s.name, city: s.city, code: s.code, status: s.status, reason: s.reason, created: s.created, director: s.director, stats: s.stats })) };
    case 'super_school': { const s = find(args.p_id); if (!s) return { ok: false, error: 'not_found' }; s.years = demoYears(s.id); s.stats.years = s.years.length; return { ok: true, school: { ...s, tickets: d.tickets.filter(t => t.school_id === s.id).map(t => ({ id: t.id, subject: t.subject, status: t.status, at: t.updated })) } }; }
    case 'super_set_school_status': { const s = find(args.p_id); if (!s) return { ok: false, error: 'not_found' }; s.status = args.p_status; s.reason = args.p_status === 'suspended' ? (args.p_reason || null) : null; logd(s, 'super.school_' + args.p_status, { reason: args.p_reason }); save(); return { ok: true }; }
    case 'super_rename_school': { const s = find(args.p_id); if (!s) return { ok: false, error: 'not_found' }; if ((args.p_name || '').trim().length < 2) return { ok: false, error: 'bad_name' }; s.name = args.p_name.trim(); s.city = args.p_city || null; logd(s, 'super.school_renamed', { name: s.name }); save(); return { ok: true }; }
    case 'super_note_add': { const s = find(args.p_school); if (!s || !(args.p_text || '').trim()) return { ok: false, error: 'empty' }; s.notes.unshift({ id: nid(), text: args.p_text.trim(), pinned: !!args.p_pinned, at: new Date().toISOString(), by: 'Технический администратор' }); s.notes.sort((a, b) => (b.pinned - a.pinned)); save(); return { ok: true }; }
    case 'super_note_delete': d.schools.forEach(s => { s.notes = s.notes.filter(n => n.id !== args.p_id); }); save(); return { ok: true };
    case 'super_find_user': { const q = (args.p_q || '').trim().toLowerCase(); if (q.length < 2) return { ok: true, users: [] }; const out = []; d.schools.forEach(s => s.staff.forEach(u => { if ((u.name + ' ' + (u.phone || '') + ' ' + (u.email || '')).toLowerCase().includes(q)) out.push({ ...u, school_id: s.id, school: s.name }); })); return { ok: true, users: out.slice(0, 30) }; }
    case 'super_user_status': { let hit = null; d.schools.forEach(s => s.staff.forEach(u => { if (u.id === args.p_user) { u.status = args.p_status; hit = s; } })); if (!hit) return { ok: false, error: 'not_allowed' }; logd(hit, 'super.user_' + args.p_status); save(); return { ok: true }; }
    case 'super_announce': { const to = d.schools.filter(s => !args.p_school || s.id === args.p_school).length; if ((args.p_title || '').trim().length < 3 || (args.p_body || '').trim().length < 3) return { ok: false, error: 'empty' }; d.announces.unshift({ at: new Date().toISOString(), action: 'super.announce', who: 'Технический администратор', school: args.p_school ? find(args.p_school).name : null, details: { title: args.p_title, to } }); logd(args.p_school ? find(args.p_school) : null, 'super.announce', { title: args.p_title, to }); save(); return { ok: true, sent: to }; }
    case 'support_open': { const s = find('demo1'); if ((args.p_subject || '').trim().length < 3 || (args.p_text || '').trim().length < 3) return { ok: false, error: 'empty' }; d.tickets.unshift({ id: nid(), school_id: 'demo1', school: s.name, subject: args.p_subject.trim(), status: 'open', created: new Date().toISOString(), updated: new Date().toISOString(), messages: [{ from: 'school', name: s.director.name, text: args.p_text.trim(), at: new Date().toISOString() }] }); save(); return { ok: true }; }
    case 'support_reply': { const t = d.tickets.find(x => x.id === args.p_id); if (!t || !(args.p_text || '').trim()) return { ok: false, error: 'empty' }; const side = args.__side || 'super'; t.messages.push({ from: side, name: side === 'super' ? 'Технический администратор' : 'Директор', text: args.p_text.trim(), at: new Date().toISOString() }); t.status = side === 'super' ? 'answered' : 'open'; t.updated = new Date().toISOString(); save(); return { ok: true }; }
    case 'support_close': { const t = d.tickets.find(x => x.id === args.p_id); if (t) { t.status = 'closed'; t.updated = new Date().toISOString(); save(); } return { ok: true }; }
    case 'super_tickets': return { ok: true, tickets: d.tickets };
    case 'super_requests': return { ok: true, requests: d.requests };
    case 'super_request_set': { const r = d.requests.find(x => x.id === args.p_id); if (r) { r.status = args.p_status; if (args.p_note != null) r.admin_note = args.p_note; r.updated = new Date().toISOString(); save(); } return { ok: true }; }
    case 'super_issue_key': { const k = 'SABAK-' + [0, 1, 2].map(() => Math.random().toString(36).slice(2, 6).toUpperCase()).join('-'); d.keys.unshift({ id: nid(), note: args.p_note || '', created: new Date().toISOString(), used: null, school: null }); logd(null, 'super.key_issued', { note: args.p_note }); save(); return { ok: true, key: k }; }
    case 'super_keys': return { ok: true, keys: d.keys };
    case 'super_key_revoke': d.keys = d.keys.filter(k => k.id !== args.p_id || k.used); save(); return { ok: true };
    case 'super_audit': { const rows = [...d.audit, ...d.schools.flatMap(s => s.audit.map(a => ({ ...a, school: s.name, school_id: s.id })))].filter(a => (!args.p_school || a.school_id === args.p_school) && (!args.p_action || a.action.startsWith(args.p_action))).sort((a, b) => b.at.localeCompare(a.at)); return { ok: true, rows: rows.slice(0, args.p_limit || 100) }; }
    case 'super_system': return { ok: true, db_mb: 38.4, tables: { grades: d.schools.reduce((n, s) => n + s.stats.grades, 0), attendance: 84210, students: d.schools.reduce((n, s) => n + s.stats.students, 0), profiles: 2310, notifications: 5120, audit_log: 1840, invites: 960, invite_attempts: 412, archive_years: 4, support_tickets: d.tickets.length }, failed_codes_24h: 7, locked_now: 0, cleanable: { attempts: 305, invites: 41, notifs: 1200 } };
    case 'super_cleanup': logd(null, 'super.cleanup'); return { ok: true, attempts: 305, invites: 41, notifs: 1200 };
    case 'super_archive_all': logd(null, 'super.archive_all', { label: args.p_label }); return { ok: true, archived: d.schools.length, skipped: 0 };
  }
  return { ok: false, error: 'unknown' };
}
// списки, которые в live читаются таблицами через REST
export async function tickets() { return live() ? API.select('support_tickets', 'select=*&order=updated_at.desc&limit=200') : (await call('super_tickets')).tickets.map(t => ({ ...t, updated_at: t.updated, created_at: t.created })); }
export async function requests() { return live() ? API.select('school_requests', 'select=*&order=created_at.desc&limit=200') : (await call('super_requests')).requests.map(r => ({ ...r, created_at: r.created })); }
export async function myTickets() { return live() ? API.select('support_tickets', 'select=*&order=updated_at.desc&limit=50') : D().tickets.filter(t => t.school_id === 'demo1').map(t => ({ ...t, updated_at: t.updated, created_at: t.created })); }
export async function replyAs(side, id, text) { return live() ? API.rpc('support_reply', { p_id: id, p_text: text }) : call('support_reply', { p_id: id, p_text: text, __side: side }); }
export const announces = () => D().announces;
