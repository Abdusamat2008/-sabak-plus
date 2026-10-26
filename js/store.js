// Хранилище MVP: localStorage + журнал изменений + откат + очередь синхронизации (offline-first).
// Этап 2: заменить на Supabase (см. README и supabase/schema.sql) — интерфейс функций останется тем же.
import { schoolDaysBack, todayISO, addDays, sortGrades } from './calc.js';
import * as API from './api.js';
import * as Net from './net.js';
import { DOC_TYPES } from './docs.js';

// Два режима: demo (всё в браузере, для показа жюри) и live (Supabase). Данные в обоих хранятся в одной форме,
// поэтому все экраны работают одинаково; в live-режиме изменения дополнительно уходят на сервер (с очередью при обрыве связи).
const MODE_KEY = 'sabak.mode', PREF_KEY = 'sabak.prefs';
export const getMode = () => { try { return localStorage.getItem(MODE_KEY) || 'demo'; } catch { return 'demo'; } };
export function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch {} }
let MODE = getMode();
export const isLive = () => MODE === 'live';
const KEYS = { demo: 'sabak.mvp.v1', live: 'sabak.live.v1' };
const VERSION = 5, LVERSION = 1;
let S = null;
const subs = new Set();
export const on = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(f => f());
const gid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

export const SUBJECTS = [
  { id: 'math', ru: 'Математика', ky: 'Математика' },
  { id: 'rus',  ru: 'Русский язык', ky: 'Орус тили' },
  { id: 'kyr',  ru: 'Кыргыз тили', ky: 'Кыргыз тили' },
  { id: 'hist', ru: 'История', ky: 'Тарых' },
  { id: 'eng',  ru: 'Английский', ky: 'Англис тили' },
  { id: 'phys', ru: 'Физика', ky: 'Физика' },
  { id: 'inf',  ru: 'Информатика', ky: 'Информатика' },
  { id: 'bio',  ru: 'Биология', ky: 'Биология' },
];
export const subj = id => SUBJECTS.find(s => s.id === id);

export const USERS = {
  student: { id: 's1', name: 'Айдана Төлөбаева', role: 'student' },
  parent:  { id: 'p1', name: 'Родитель Айданы', role: 'parent', child: 's1', children: ['s1'] },
  teacher: { id: 't1', name: 'Гульнара Эсеновна', role: 'teacher', subjects: ['math', 'inf'], classes: ['9А', '9Б'], homeroom: '9А' },
  admin:   { id: 'a1', name: 'Бекова Нурзат Айтматовна', role: 'admin', level: 'director' },
};

export const SUBJ_TEACHER = { math: 't1', inf: 't1', rus: 't2', kyr: 't2', hist: 't2', eng: 't3', phys: 't3', bio: 't3' };
const NAMES_9A = ['Айдана Төлөбаева', 'Бекзат Керимов', 'Эмир Сыдыков', 'Нурзат Асанова', 'Данияр Жумабеков', 'Мээрим Осмонова', 'Адиль Рысбеков', 'Салтанат Бакирова', 'Тилек Мамытов', 'Алина Эркинова'];
const NAMES_9B = ['Урмат Исаков', 'Жылдыз Абдыева', 'Темирлан Кадыров', 'Ару Нурматова', 'Касым Токтогулов', 'Элина Садыкова'];

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function seed() {
  const R = rng(2026);
  const today = todayISO();
  const students = [];
  NAMES_9A.forEach((n, i) => students.push({ id: 's' + (i + 1), name: n, cls: '9А', code: 'A' + (1000 + i * 37) }));
  NAMES_9B.forEach((n, i) => students.push({ id: 's' + (11 + i), name: n, cls: '9Б', code: 'B' + (2000 + i * 41) }));

  // профиль: base — уровень, tr — динамика (+ растёт, − падает)
  const prof = { s1: { b: 4.1, tr: 0 }, s2: { b: 4.6, tr: .3 }, s3: { b: 3.4, tr: -.9 }, s4: { b: 4.8, tr: .1 }, s5: { b: 2.9, tr: -.4 }, s6: { b: 4.2, tr: .5 }, s7: { b: 5, tr: 0 }, s8: { b: 3.8, tr: .2 }, s9: { b: 3.2, tr: .6 }, s10: { b: 4.4, tr: -.2 }, s11: { b: 3.9, tr: 0 }, s12: { b: 4.5, tr: .2 }, s13: { b: 3.1, tr: -.5 }, s14: { b: 4.7, tr: 0 }, s15: { b: 3.5, tr: .4 }, s16: { b: 4.0, tr: -.1 } };
  const typeCycle = ['hw', 'act', 'ind', 'test', 'hw', 'talk', 'ind', 'test', 'act', 'hw'];
  const days = schoolDaysBack(34).reverse(); // от старых к новым
  const grades = []; let gid = 1;
  const add = (sid, sj, value, type, date, by = SUBJ_TEACHER[sj]) => grades.push({ id: 'g' + (gid++), sid, subj: sj, value, type, date, by });

  students.forEach(st => {
    const p = prof[st.id] || { b: 4, tr: 0 };
    SUBJECTS.forEach((sj, si) => {
      if (st.id === 's1' && (sj.id === 'math' || sj.id === 'hist' || sj.id === 'phys')) return; // ручные
      const n = 6 + Math.floor(R() * 4);
      const pickDays = days.filter((_, k) => (k + si + st.id.length) % 3 !== 0).slice(-n);
      pickDays.forEach((d, k) => {
        const frac = pickDays.length > 1 ? k / (pickDays.length - 1) : 0;
        let v = p.b + p.tr * (frac - 0.5) * 2 + (R() - 0.5) * 1.6;
        v = Math.max(2, Math.min(5, Math.round(v)));
        if (st.id === 's7') v = 5;
        add(st.id, sj.id, v, typeCycle[(k + si) % typeCycle.length], d);
      });
    });
  });
  // Айдана: ручные данные (как в презентации: 3,6 → «до 4 не хватает 0,4»)
  const hand = (sj, arr) => { const d = days.slice(-arr.length * 2).filter((_, k) => k % 2 === 1); arr.forEach(([v, t], k) => add('s1', sj, v, t, d[k])); };
  hand('math', [[4, 'hw'], [3, 'ind'], [4, 'act'], [3, 'test'], [4, 'hw'], [3, 'ind'], [4, 'act'], [3, 'test'], [4, 'hw'], [3, 'ind']]);
  hand('hist', [[5, 'hw'], [4, 'act'], [4, 'test'], [4, 'hw'], [3, 'ind'], [3, 'hw'], [2, 'test']]);
  hand('phys', [[5, 'hw'], [5, 'ind'], [4, 'test'], [5, 'act'], [5, 'hw'], [5, 'ind']]);
  // у Эмира (s3) резкое падение по математике — для сигнала родителю/учителю
  // Данияр (s5) — серия «5» для достижения 30 дней не нужна; у Алины (s7: Адиль) — серия 12 дней
  // серия «5» у s7 (Адиль): последние 12 учебных дней по 5
  const streakDays = schoolDaysBack(12);
  streakDays.forEach(d => add('s7', 'math', 5, 'act', d));

  // посещаемость: последние 10 учебных дней
  const att = {};
  schoolDaysBack(10).forEach((d, k) => {
    att[d] = {};
    students.forEach(st => {
      if (k === 0) return; // сегодня — отмечает учитель
      let v = 'p';
      const r = R();
      if (st.id === 's5' && k % 2 === 0) v = 'n';
      else if (st.id === 's1' && k === 4) v = 'n';
      else if (r > 0.97) v = 'n';
      else if (r > 0.94) v = 'l';
      att[d][st.id] = v;
    });
  });

  // домашние задания (due — смещение в днях от сегодня)
  const homework = [
    { id: 'h1', cls: '9А', subj: 'hist', title: 'Параграф 12, вопросы 1–5', due: -2 },
    { id: 'h2', cls: '9А', subj: 'math', title: 'Задачи № 215–220', due: -1 },
    { id: 'h3', cls: '9А', subj: 'eng', title: 'Unit 4: Writing, 120 слов', due: 1 },
    { id: 'h4', cls: '9А', subj: 'phys', title: 'Подготовка к контрольной: гл. 3', due: 1 },
    { id: 'h5', cls: '9А', subj: 'bio', title: 'Таблица «Клетка», стр. 48', due: 2 },
    { id: 'h6', cls: '9А', subj: 'kyr', title: 'Эссе «Менин айылым»', due: 3 },
    { id: 'h7', cls: '9А', subj: 'rus', title: 'Упражнения 134–136', due: 0 },
    { id: 'h8', cls: '9А', subj: 'inf', title: 'Практика: таблицы в Excel', due: 4 },
  ];
  const hwDone = {}; // hwDone[hid][sid] = true
  homework.forEach(h => { hwDone[h.id] = {}; students.filter(s => s.cls === h.cls).forEach(s => { if (h.due >= 0 ? R() > 0.6 : R() > 0.2) hwDone[h.id][s.id] = true; }); });
  ['h1', 'h2'].forEach(h => { delete hwDone[h].s1; });
  ['h3', 'h4', 'h5', 'h6', 'h7', 'h8'].forEach(h => { hwDone[h].s1 = h === 'h7' || h === 'h4'; });

  const events = [{ id: 'e1', cls: '9А', subj: 'phys', kind: 'Контрольная', due: 1 }];

  const classes = [{ id: 'c1', name: '9А', homeroom: 't1', grade: 9 }, { id: 'c2', name: '9Б', homeroom: 't2', grade: 9 }];
  students.forEach((st, i) => { st.clsId = st.cls === '9А' ? 'c1' : 'c2'; st.photo = i % 16 < 9 && st.id !== 's1' ? { ok: true, ph: true, ts: Date.now() - 86400000 * (i + 1) } : null; });
  const staff = [
    { id: 'a1', name: 'Бекова Нурзат Айтматовна', role: 'director', status: 'active', phone: '+996 700 123 456', classes: [], subjects: [], homeroom: null, created: Date.now() - 86400000 * 90 },
    { id: 'a2', name: 'Асанов Тимур Бакытович', role: 'deputy', status: 'active', phone: '+996 555 222 333', classes: [], subjects: [], homeroom: null, created: Date.now() - 86400000 * 60 },
    { id: 't1', name: 'Гульнара Эсеновна', role: 'teacher', status: 'active', phone: '+996 700 555 111', classes: ['9А', '9Б'], subjects: ['math', 'inf'], homeroom: '9А', created: Date.now() - 86400000 * 50 },
    { id: 't2', name: 'Нурлан Абдыкадыров', role: 'teacher', status: 'active', phone: '+996 777 444 222', classes: ['9А', '9Б'], subjects: ['rus', 'kyr', 'hist'], homeroom: '9Б', created: Date.now() - 86400000 * 45 },
    { id: 't3', name: 'Айжан Токтомамбетова', role: 'teacher', status: 'active', phone: '+996 555 909 080', classes: ['9А', '9Б'], subjects: ['eng', 'phys', 'bio'], homeroom: null, created: Date.now() - 86400000 * 30 },
    { id: 't4', name: 'Эрмек Жанболотов', role: 'teacher', status: 'pending', phone: '+996 700 321 654', classes: [], subjects: [], homeroom: null, created: Date.now() - 3600000 * 6 },
  ];
  const docs = {}, dossier = {}, records = {};
  students.forEach(st => { docs[st.id] = {}; DOC_TYPES.filter(d => d.req === 'all').forEach(d => { docs[st.id][d.id] = { status: R() > 0.28 ? 'have' : 'missing' }; }); });
  ['application', 'birth_cert', 'parent_id', 'reg_cert', 'med_026', 'med_063', 'photo_3x4', 'consent_pd', 'contract'].forEach(d => { docs.s1[d] = { status: d === 'med_063' ? 'missing' : 'have', number: d === 'birth_cert' ? 'I-ЖМ 123456' : '' }; });
  dossier.s1 = { characteristic: 'Дисциплинированная, любознательная. Сильна в точных науках, при поддержке растёт по гуманитарным предметам. Участвует в олимпиадах по информатике.', address: 'г. Бишкек, мкр. Асанбай, д. 12, кв. 34', pin: '', health: 'I (основная)', family: 'Полная семья. Мать — Төлөбаева Н., отец — Төлөбаев Э.', updated: Date.now() - 86400000 * 3 };
  records.s1 = [{ id: 'r1', kind: 'award', text: 'Грамота за 2 место в школьной олимпиаде по информатике', date: addDays(today, -40) }, { id: 'r2', kind: 'club', text: 'Кружок робототехники', date: addDays(today, -80) }];
  const notifs = [{ id: 'n1', to: 'parent', sid: 's1', kind: 'photo_warning', title: 'Фото профиля: Айдана Төлөбаева', body: 'Фото профиля не загружено. Требования к фото: официальное фото (как на документы), светлый однотонный фон, одно лицо анфас, хороший свет, без тёмных очков.', ts: Date.now() - 3600000 * 3, read: false },
    { id: 'n2', to: 'student', sid: 's1', kind: 'photo_warning', title: 'Фото профиля: Айдана Төлөбаева', body: 'Фото профиля не загружено. Загрузите официальное фото на светлом фоне.', ts: Date.now() - 3600000 * 3, read: false }];
  const invites = [{ id: 'iv1', code: 'K7QD-3MHB-X9TP', role: 'teacher', cls: null, sid: null, tail: '4521', expires: Date.now() + 86400000 * 2, uses: 0, max: 1, revoked: false, by: 'Директор' }];
  const audit = [{ id: 'au1', ts: Date.now() - 3600000 * 6, who: 'Эрмек Жанболотов', action: 'invite.redeemed', text: 'Принято приглашение «учитель» — ожидает подтверждения' }, { id: 'au2', ts: Date.now() - 86400000, who: 'Бекова Н.А.', action: 'invite.created', text: 'Создано приглашение: учитель (код привязан к телефону)' }];
  return {
    v: VERSION, school: { name: 'Школа №12 (демо)', code: 'SCH-DEMO1', city: 'Бишкек' }, classes, staff, docs, dossier, records, notifs, invites, audit,
    students, grades, att, homework, hwDone, events, ach: {}, log: [], undo: [], queue: [],
    mail: [
      { id: 'm1', ts: Date.now() - 86400000, cat: 'Проблема с оценкой', text: '(демо) В четверти вместо 5 стоит 4, а учитель не может быстро исправить — система не даёт поменять. Что делать?', read: false },
      { id: 'm2', ts: Date.now() - 3600000 * 5, cat: 'Жалоба', text: '(демо) Дневник не открывается на телефоне, когда в школе плохой интернет.', read: false },
    ],
    session: null, prefs: { lang: 'ru', scale: 1, contrast: false },
    nextId: 1000,
  };
}

function emptyLive() {
  return { v: LVERSION, school: null, classes: [], staff: [], docs: {}, dossier: {}, records: {}, notifs: [], invites: [], audit: [], students: [], grades: [], att: {}, homework: [], hwDone: {}, events: [], ach: {}, log: [], undo: [], queue: [], mail: [], session: null, prefs: { lang: 'ru', scale: 1, contrast: false }, nextId: 1 };
}


function readPrefs() { try { return Object.assign({ lang: 'ru', scale: 1, contrast: false }, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch { return { lang: 'ru', scale: 1, contrast: false }; } }
export function load() {
  MODE = getMode();
  try { S = JSON.parse(localStorage.getItem(KEYS[MODE])); } catch { S = null; }
  if (MODE === 'demo') { if (!S || S.v !== VERSION) { S = seed(); } }
  else if (!S || S.v !== LVERSION) S = emptyLive();
  S.prefs = readPrefs();
  save(); return S;
}
function save() { try { localStorage.setItem(KEYS[MODE], JSON.stringify(S)); } catch (e) { console.warn('storage', e); } }
export const state = () => S;
export function resetDemo() { S = seed(); S.prefs = readPrefs(); save(); emit(); }
export function switchMode(m) { setMode(m); load(); emit(); }

const uid = p => p + (S.nextId++);
const nowTs = () => Date.now();
const who = () => (S.session ? (S.session.name || S.session.role) : 'система');
export const me = () => S.session;
export const isAdminLevel = () => S.session && S.session.role === 'admin';
export const isDirector = () => S.session && S.session.role === 'admin' && S.session.level === 'director';
export const netOk = () => Net.isOnline();

// ---- очередь: в demo — имитация, в live — настоящие запросы (по порядку; при обрыве ждём связь) ----
function logAndQueue(action, text, op) {
  const ts = nowTs();
  S.log.unshift({ id: uid('l'), ts, who: who(), action, text });
  S.log = S.log.slice(0, 200);
  S.queue.push({ id: uid('q'), ts, action, text, synced: false, op: isLive() ? op : undefined });
}
export const pending = () => S.queue.filter(q => !q.synced).length;
export const failed = () => S.failed || [];
let flushing = false;
export async function flushQueue() {
  const n = pending(); if (!n) return 0;
  if (!isLive()) { S.queue.forEach(q => { q.synced = true; }); S.queue = S.queue.slice(-50); save(); emit(); return n; }
  if (flushing || !Net.isOnline()) return 0;
  flushing = true; let done = 0;
  try {
    for (const q of S.queue.filter(x => !x.synced)) {
      if (!q.op) { q.synced = true; continue; }
      try {
        if (q.op.rpc) await API.rpc(q.op.rpc, q.op.args);
        else await API.rest(q.op.m, q.op.t, { query: q.op.q || '', body: q.op.b, prefer: q.op.prefer });
        q.synced = true; done++;
      } catch (e) {
        if (e.network || e.status >= 500) break;          // нет связи/сервер недоступен — повторим позже
        q.synced = true; q.error = e.message;            // отказ сервера (права, дубликат): фиксируем и идём дальше
        (S.failed = S.failed || []).unshift({ ts: nowTs(), text: q.text, error: e.message }); S.failed = S.failed.slice(0, 20);
      }
    }
  } finally { flushing = false; S.queue = S.queue.filter(q => !q.synced).concat(S.queue.filter(q => q.synced).slice(-30)); save(); emit(); }
  return done;
}
export const isOffline = () => !Net.isOnline();

// ---- сессия ----
export function login(role) { S.session = { ...USERS[role], level: role === 'admin' ? 'director' : undefined }; save(); emit(); }
export function logout() { if (isLive()) { API.signOut(); S.session = null; S.students = []; S.grades = []; save(); } else { S.session = null; save(); } emit(); }
export function setPrefs(p) { Object.assign(S.prefs, p); try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch {} emit(); }

// ---- оценки, посещаемость, ученики ----
export function addGrade({ sid, subj: sj, value, type }) {
  const g = { id: isLive() ? gid() : uid('g'), sid, subj: sj, value, type, date: todayISO(), by: S.session ? S.session.id : 't1' };
  S.grades.push(g);
  S.undo.push({ kind: 'delGrade', id: g.id });
  const st = S.students.find(s => s.id === sid);
  logAndQueue('grade', `Оценка «${value}» · ${st ? st.name : sid} · ${subj(sj).ru}`, { m: 'POST', t: 'grades', b: { id: g.id, school_id: S.school && S.school.id, student_id: sid, subject_id: sj, value, type, date: g.date, by: g.by } });
  save(); emit(); return g;
}
export function setAttendance(sid, date, status) {
  S.att[date] = S.att[date] || {};
  const prev = S.att[date][sid] || null;
  S.att[date][sid] = status;
  S.undo.push({ kind: 'att', sid, date, prev });
  const st = S.students.find(s => s.id === sid);
  logAndQueue('attendance', `Посещаемость: ${st ? st.name : sid} — ${{ p: 'присутствует', n: 'отсутствует', l: 'опоздал(а)' }[status]}`,
    { m: 'POST', t: 'attendance', prefer: 'resolution=merge-duplicates', q: 'on_conflict=student_id,date', b: { student_id: sid, date, school_id: S.school && S.school.id, status, by: S.session && S.session.id } });
  save(); emit();
}
const codeGen = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = n => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join(''); return `${r(4)}-${r(4)}-${r(4)}`; };
export async function addStudent(name, cls) {
  const c = S.classes.find(x => x.name === cls);
  if (!isLive()) {
    const id = uid('s'), code = (cls === '9А' ? 'A' : 'B') + (3000 + Math.floor(Math.random() * 900));
    S.students.push({ id, name, cls, clsId: c && c.id, code, photo: null });
    S.undo.push({ kind: 'delStudent', id });
    logAndQueue('student', `Добавлен ученик: ${name} (${cls}), код входа ${code}`);
    save(); emit(); return { id, code };
  }
  const id = gid();
  S.students.push({ id, name, cls, clsId: c && c.id, code: null, photo: null });
  S.undo.push({ kind: 'delStudent', id });
  logAndQueue('student', `Добавлен ученик: ${name} (${cls})`, { m: 'POST', t: 'students', b: { id, school_id: S.school.id, class_id: c && c.id, full_name: name, created_by: S.session.id } });
  save(); emit();
  if (Net.isOnline()) { await flushQueue(); try { const r = await API.rpc('create_invite', { p_role: 'student', p_student: id }); if (r.ok) { S.students.find(x => x.id === id).code = r.code; save(); emit(); return { id, code: r.code }; } } catch {} }
  return { id, code: null };
}
export function undoLast() {
  const u = S.undo.pop(); if (!u) return null;
  if (u.kind === 'delGrade') {
    const g = S.grades.find(x => x.id === u.id); S.grades = S.grades.filter(x => x.id !== u.id);
    logAndQueue('undo', `Отмена: оценка «${g ? g.value : ''}» удалена`, { m: 'DELETE', t: 'grades', q: 'id=eq.' + u.id });
  } else if (u.kind === 'att') {
    if (u.prev) S.att[u.date][u.sid] = u.prev; else delete S.att[u.date][u.sid];
    logAndQueue('undo', 'Отмена отметки посещаемости', u.prev
      ? { m: 'POST', t: 'attendance', prefer: 'resolution=merge-duplicates', q: 'on_conflict=student_id,date', b: { student_id: u.sid, date: u.date, school_id: S.school && S.school.id, status: u.prev, by: S.session && S.session.id } }
      : { m: 'DELETE', t: 'attendance', q: `student_id=eq.${u.sid}&date=eq.${u.date}` });
  } else if (u.kind === 'delStudent') {
    S.students = S.students.filter(x => x.id !== u.id);
    logAndQueue('undo', 'Отмена: ученик удалён', { m: 'DELETE', t: 'students', q: 'id=eq.' + u.id });
  }
  save(); emit(); return u;
}
export function toggleHw(hid, sid) {
  S.hwDone[hid] = S.hwDone[hid] || {};
  const was = !!S.hwDone[hid][sid];
  if (was) delete S.hwDone[hid][sid]; else S.hwDone[hid][sid] = true;
  if (isLive()) logAndQueue('hw', 'Отметка о ДЗ', was ? { m: 'DELETE', t: 'homework_done', q: `homework_id=eq.${hid}&student_id=eq.${sid}` } : { m: 'POST', t: 'homework_done', b: { homework_id: hid, student_id: sid, school_id: S.school.id } });
  save(); emit();
}
export function sendMail(cat, text) {
  if (isLive()) { logAndQueue('mail', 'Анонимное сообщение', { m: 'POST', t: 'anonymous_messages', b: { school_id: S.school.id, cat, text } }); save(); emit(); return; }
  S.mail.unshift({ id: uid('m'), ts: nowTs(), cat, text, read: false }); // автор не сохраняется — анонимно
  save(); emit();
}
export function markMailRead(id) { const m = S.mail.find(x => x.id === id); if (m) { m.read = true; if (isLive()) logAndQueue('mail', 'Сообщение прочитано', { m: 'PATCH', t: 'anonymous_messages', q: 'id=eq.' + id, b: { read: true } }); save(); emit(); } }

// ---- выборки ----
export const studentsOf = cls => S.students.filter(s => s.cls === cls);
export const gradesOf = (sid, sj) => sortGrades(S.grades.filter(g => g.sid === sid && (!sj || g.subj === sj)));
export const hwFor = sid => { const st = S.students.find(s => s.id === sid); return S.homework.filter(h => h.cls === (st && st.cls)).map(h => ({ ...h, dueDate: h.dueDate || addDays(todayISO(), h.due), done: !!(S.hwDone[h.id] && S.hwDone[h.id][sid]) })); };
export const attOf = (sid, n = 10) => schoolDaysBack(n).map(d => ({ date: d, v: (S.att[d] && S.att[d][sid]) || null }));
export const student = sid => S.students.find(s => s.id === sid);
export const staffName = id => { const x = S.staff.find(s => s.id === id); return x ? x.name : '—'; };

export function claimAchievements(sid, okIds) {
  S.ach[sid] = S.ach[sid] || null;
  const known = S.ach[sid];
  S.ach[sid] = okIds;
  save();
  if (known === null) return [];
  return okIds.filter(id => !known.includes(id));
}

// ---- права (должны совпадать с RLS в базе: там они действительно применяются) ----
export const can = {
  readDossier: sid => { const u = S.session; if (!u) return false; if (u.role === 'admin') return true; if (u.role === 'parent') return (u.children || [u.child]).includes(sid); if (u.role === 'teacher') return isHomeroomOf(sid); return false; },
  editDossier: sid => { const u = S.session; if (!u) return false; if (u.role === 'parent') return (u.children || [u.child]).includes(sid); if (u.role === 'teacher') return isHomeroomOf(sid); return false; },
  editPhoto: sid => { const u = S.session; if (!u) return false; if (u.role === 'student') return u.id === sid || (student(sid) && student(sid).accId === u.id); if (u.role === 'parent') return (u.children || [u.child]).includes(sid); if (u.role === 'teacher') return isHomeroomOf(sid); return false; },
  warnPhoto: sid => { const u = S.session; return !!u && (u.role === 'admin' || (u.role === 'teacher' && isHomeroomOf(sid))); },
};
export function isHomeroomOf(sid) { const u = S.session, st = student(sid); return !!(u && st && u.homeroom && st.cls === u.homeroom); }

// ---- фото ----
const blobToData = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const photoUrls = {};            // path -> objectURL (live)
export function photoSrc(st) {
  if (!st || !st.photo || !st.photo.ok) return null;
  if (st.photo.data) return st.photo.data;
  if (!st.photo.path) return null;
  if (photoUrls[st.photo.path]) return photoUrls[st.photo.path];
  if (photoUrls[st.photo.path] === undefined && Net.isOnline() && isLive()) {
    photoUrls[st.photo.path] = null;
    API.download('avatars', st.photo.path).then(b => { photoUrls[st.photo.path] = URL.createObjectURL(b); emit(); }).catch(() => { delete photoUrls[st.photo.path]; });
  }
  return null;
}
export async function setPhoto(sid, blob, meta) {
  const st = student(sid); if (!st) throw new Error('Ученик не найден');
  if (!meta || !meta.verified) throw new Error('Фото не прошло проверку');
  if (!isLive()) {
    st.photo = { ok: true, data: await blobToData(blob), ts: nowTs(), meta };
    S.notifs.forEach(n => { if (n.sid === sid && n.kind === 'photo_warning') n.read = true; });
    logAndQueue('photo', `Фото профиля: ${st.name}`); save(); emit(); return;
  }
  if (!Net.isOnline()) throw new Error('Для загрузки фото нужен интернет');
  const path = `${S.school.id}/${sid}/avatar.jpg`;
  await API.upload('avatars', path, blob);
  const r = await API.rpc('set_student_photo', { p_student: sid, p_path: path, p_meta: meta });
  if (!r.ok) throw new Error({ forbidden: 'Нет прав менять это фото', not_verified: 'Фото не прошло проверку', bad_path: 'Неверный путь' }[r.error] || r.error);
  delete photoUrls[path]; st.photo = { ok: true, path, ts: nowTs(), meta };
  S.notifs.forEach(n => { if (n.sid === sid && n.kind === 'photo_warning') n.read = true; });
  save(); emit();
}
export async function warnPhoto(sid, reason) {
  const st = student(sid);
  if (!isLive()) { ['student', 'parent'].forEach(to => S.notifs.unshift({ id: uid('n'), to, sid, kind: 'photo_warning', title: 'Фото профиля: ' + st.name, body: (reason || (st.photo ? 'Текущее фото не соответствует требованиям.' : 'Фото профиля не загружено.')) + ' Требования: официальное фото на светлом однотонном фоне, одно лицо анфас, хороший свет, без тёмных очков.', ts: nowTs(), read: false })); logAndQueue('photo', `Предупреждение о фото: ${st.name}`); save(); emit(); return { sent: 2 }; }
  if (!Net.isOnline()) throw new Error('Нужен интернет');
  const r = await API.rpc('send_photo_warning', { p_student: sid, p_reason: reason || null });
  if (!r.ok) throw new Error(r.error === 'forbidden' ? 'Нет прав' : r.error);
  return r;
}
export async function warnPhotoClass(cls) {
  const c = S.classes.find(x => x.name === cls);
  const need = S.students.filter(s => s.cls === cls && !(s.photo && s.photo.ok));
  if (!isLive()) { for (const s of need) await warnPhoto(s.id); return { students: need.length, sent: need.length * 2 }; }
  if (!Net.isOnline()) throw new Error('Нужен интернет');
  const r = await API.rpc('send_photo_warnings_class', { p_class: c.id });
  if (!r.ok) throw new Error(r.error === 'forbidden' ? 'Нет прав' : r.error);
  return r;
}
export const myNotifs = () => { const u = S.session; if (!u) return []; return S.notifs.filter(n => isLive() || n.to === u.role || n.to === 'all'); };
export function readNotif(id) { const n = S.notifs.find(x => x.id === id); if (n && !n.read) { n.read = true; if (isLive()) logAndQueue('notif', 'Прочитано', { m: 'PATCH', t: 'notifications', q: 'id=eq.' + id, b: { read: true } }); save(); emit(); } }
export function readAllNotifs() { myNotifs().forEach(n => readNotif(n.id)); }

// ---- «дело» ----
export async function loadDossier(sid) {
  if (!isLive() || !Net.isOnline()) return;
  const [d, docs, recs] = await Promise.all([API.select('dossiers', `student_id=eq.${sid}`), API.select('dossier_docs', `student_id=eq.${sid}`), API.select('dossier_records', `student_id=eq.${sid}&order=date.desc`)]);
  if (d[0]) S.dossier[sid] = { characteristic: d[0].characteristic || '', address: d[0].address || '', pin: d[0].pin || '', health: d[0].health_group || '', family: d[0].family || '', updated: Date.parse(d[0].updated_at) };
  S.docs[sid] = S.docs[sid] || {};
  docs.forEach(x => { S.docs[sid][x.doc_type] = { status: x.status, number: x.number || '', date: x.issued || '', note: x.note || '', file: x.file_path || '' }; });
  S.records[sid] = recs.map(r => ({ id: r.id, kind: r.kind, text: r.text, date: r.date }));
  save(); emit();
}
export function saveDossier(sid, p) {
  S.dossier[sid] = { ...(S.dossier[sid] || {}), ...p, updated: nowTs() };
  logAndQueue('dossier', `Дело обновлено: ${student(sid).name}`, { m: 'POST', t: 'dossiers', prefer: 'resolution=merge-duplicates', q: 'on_conflict=student_id',
    b: { student_id: sid, school_id: S.school && S.school.id, characteristic: p.characteristic ?? S.dossier[sid].characteristic ?? '', address: S.dossier[sid].address || '', pin: S.dossier[sid].pin || '', health_group: S.dossier[sid].health || '', family: S.dossier[sid].family || '', updated_by: S.session.id, updated_at: new Date().toISOString() } });
  save(); emit();
}
export function setDoc(sid, type, p) {
  S.docs[sid] = S.docs[sid] || {};
  const cur = S.docs[sid][type] = { ...(S.docs[sid][type] || { status: 'missing' }), ...p };
  logAndQueue('dossier', `Документ «${type}»: ${student(sid).name}`, { m: 'POST', t: 'dossier_docs', prefer: 'resolution=merge-duplicates', q: 'on_conflict=student_id,doc_type',
    b: { student_id: sid, doc_type: type, school_id: S.school && S.school.id, status: cur.status, number: cur.number || null, issued: cur.date || null, note: cur.note || null, file_path: cur.file || null, updated_by: S.session.id, updated_at: new Date().toISOString() } });
  save(); emit();
}
export async function uploadDocFile(sid, type, file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл больше 5 МБ');
  if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) throw new Error('Допустимы PDF, JPG, PNG, WebP');
  if (!isLive()) { setDoc(sid, type, { status: 'have', file: 'demo:' + file.name }); return; }
  if (!Net.isOnline()) throw new Error('Для загрузки скана нужен интернет');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${S.school.id}/${sid}/${type}.${ext}`;
  await API.upload('dossiers', path, file);
  setDoc(sid, type, { status: 'have', file: path }); await flushQueue();
}
export async function openDocFile(sid, type) {
  const d = S.docs[sid] && S.docs[sid][type]; if (!d || !d.file) return null;
  if (d.file.startsWith('demo:')) return null;
  const b = await API.download('dossiers', d.file); return URL.createObjectURL(b);
}
export function addRecord(sid, rec) {
  const r = { id: isLive() ? gid() : uid('r'), ...rec }; (S.records[sid] = S.records[sid] || []).unshift(r);
  logAndQueue('dossier', `Запись в деле: ${student(sid).name}`, { m: 'POST', t: 'dossier_records', b: { id: r.id, student_id: sid, school_id: S.school && S.school.id, kind: r.kind, text: r.text, date: r.date, by: S.session.id } });
  save(); emit();
}
export function delRecord(sid, id) { S.records[sid] = (S.records[sid] || []).filter(r => r.id !== id); logAndQueue('dossier', 'Запись удалена', { m: 'DELETE', t: 'dossier_records', q: 'id=eq.' + id }); save(); emit(); }

// ---- персонал, приглашения, классы (цепочка доверия) ----
async function online() { if (!Net.isOnline()) throw new Error('Для этого действия нужен интернет'); }
export async function createInvite({ role, cls, sid, tail, days }) {
  const c = S.classes.find(x => x.name === cls);
  if (!isLive()) {
    const iv = { id: uid('iv'), code: codeGen(), role, cls: cls || (sid && student(sid).cls) || null, sid: sid || null, tail: tail || null, expires: nowTs() + 86400000 * (days || (role === 'teacher' || role === 'deputy' ? 3 : 14)), uses: 0, max: role === 'parent' ? 2 : 1, revoked: false, by: who() };
    S.invites.unshift(iv); S.audit.unshift({ id: uid('au'), ts: nowTs(), who: who(), action: 'invite.created', text: `Создано приглашение: ${role}${tail ? ' (код привязан к телефону)' : ''}` }); save(); emit(); return iv;
  }
  await online();
  const r = await API.rpc('create_invite', { p_role: role, p_class: c ? c.id : null, p_student: sid || null, p_bind_tail: tail || null, p_days: days || null });
  if (!r.ok) throw new Error({ forbidden: 'У вашей роли нет права выдавать такие приглашения', bad_tail: 'Цифры телефона: от 3 до 6', bad_student: 'Ученик не найден' }[r.error] || r.error);
  await hydrate(); return S.invites.find(i => i.code === r.code) || { code: r.code };
}
export async function revokeInvite(id) {
  if (!isLive()) { const i = S.invites.find(x => x.id === id); if (i) i.revoked = true; save(); emit(); return; }
  await online(); await API.rest('PATCH', 'invites', { query: 'id=eq.' + id, body: { revoked: true } }); await hydrate();
}
export async function setStaffStatus(id, status) {
  if (!isLive()) { const s = S.staff.find(x => x.id === id); if (s) s.status = status; S.audit.unshift({ id: uid('au'), ts: nowTs(), who: who(), action: 'profile.' + status, text: `${s ? s.name : id}: ${status === 'active' ? 'доступ подтверждён' : 'доступ закрыт'}` }); save(); emit(); return; }
  await online(); const r = await API.rpc('set_profile_status', { p_user: id, p_status: status });
  if (!r.ok) throw new Error(r.error === 'forbidden' ? 'Недостаточно прав для этого изменения' : r.error); await hydrate();
}
export async function assign(teacherId, cls, subjId, on) {
  const c = S.classes.find(x => x.name === cls);
  if (!isLive()) { const s = S.staff.find(x => x.id === teacherId); if (!s) return; const key = cls; if (on) { if (!s.classes.includes(key)) s.classes.push(key); if (!s.subjects.includes(subjId)) s.subjects.push(subjId); } else s.subjects = s.subjects.filter(x => x !== subjId); save(); emit(); return; }
  await online();
  if (on) await API.rest('POST', 'teacher_assignments', { body: { teacher_id: teacherId, class_id: c.id, subject_id: subjId, school_id: S.school.id }, prefer: 'resolution=ignore-duplicates' });
  else await API.rest('DELETE', 'teacher_assignments', { query: `teacher_id=eq.${teacherId}&class_id=eq.${c.id}&subject_id=eq.${subjId}` });
  await hydrate();
}
export async function setHomeroom(cls, teacherId) {
  const c = S.classes.find(x => x.name === cls);
  if (!isLive()) { S.staff.forEach(s => { if (s.homeroom === cls) s.homeroom = null; }); const t = S.staff.find(x => x.id === teacherId); if (t) t.homeroom = cls; c.homeroom = teacherId || null; save(); emit(); return; }
  await online(); await API.rest('PATCH', 'classes', { query: 'id=eq.' + c.id, body: { homeroom_id: teacherId || null } }); await hydrate();
}
export async function createClass(name) {
  name = name.trim(); if (!name) throw new Error('Введите название класса, например 7В');
  if (S.classes.some(c => c.name === name)) throw new Error('Такой класс уже есть');
  const grade = parseInt(name, 10) || null;
  if (!isLive()) { S.classes.push({ id: uid('c'), name, homeroom: null, grade }); save(); emit(); return; }
  await online(); await API.rest('POST', 'classes', { body: { school_id: S.school.id, name, grade } }); await hydrate();
}
export async function seedDemoLive() { await online(); const r = await API.rpc('seed_demo_school'); if (!r.ok) throw new Error(r.error === 'not_empty' ? 'В школе уже есть ученики' : r.error === 'forbidden' ? 'Только директор' : r.error); await hydrate(); return r; }
export async function clearDemoLive() { await online(); const r = await API.rpc('clear_demo_school'); if (!r.ok) throw new Error(r.error); await hydrate(); return r; }

// ---- вход / регистрация (live) ----
const UIROLE = { director: 'admin', deputy: 'admin', teacher: 'teacher', parent: 'parent', student: 'student' };
export async function liveSignIn(email, password) { await API.signIn(email, password); setMode('live'); load(); await hydrate(); }
export async function liveSignUp(email, password, profileCall) {
  const r = await API.signUp(email, password);
  if (r.needConfirm) return { needConfirm: true };
  setMode('live'); load();
  const res = await profileCall();           // RPC redeem_invite / register_director
  if (!res.ok) { return { ok: false, error: res.error }; }
  await hydrate(); return { ok: true, res };
}
export async function completeProfile(profileCall) { const res = await profileCall(); if (res.ok) await hydrate(); return res; }
export const peekInvite = code => API.rpc('peek_invite', { p_code: code }, true);
export const rpcRaw = (n, a) => API.rpc(n, a);

// ---- загрузка данных (live) ----
const ymd = d => (d || '').slice(0, 10);
export async function hydrate() {
  if (!isLive() || !API.userId()) return;
  const uidv = API.userId();
  if (pending() && Net.isOnline()) await flushQueue();
  const [prof] = await API.select('profiles', `id=eq.${uidv}&select=*`);
  if (!prof) { S.session = { id: uidv, role: null, needsProfile: true, name: '' }; save(); emit(); return; }
  const base = { id: uidv, name: prof.full_name, role: UIROLE[prof.role], level: prof.role, status: prof.status, phone: prof.phone, lang: prof.lang, email: API.session() && API.session().user.email };
  if (prof.status !== 'active') { S.session = base; save(); emit(); return; }
  const adm = base.role === 'admin', today = todayISO();
  const q = (t, query = '') => API.selectAll(t, query);
  const jobs = {
    school: API.select('schools', `id=eq.${prof.school_id}`), classes: q('classes', 'select=*&order=name'), students: q('students', 'select=*&order=full_name'),
    grades: q('grades', 'select=id,student_id,subject_id,value,type,date,by&order=date'), att: q('attendance', `select=student_id,date,status&date=gte.${addDays(today, -60)}`),
    hw: q('homework', 'select=*'), hwd: q('homework_done', 'select=*'), notifs: API.select('notifications', 'select=*&order=created_at.desc&limit=100'),
    ta: base.role === 'student' || base.role === 'parent' ? Promise.resolve([]) : q('teacher_assignments', 'select=*'),
    staff: base.role === 'student' || base.role === 'parent' ? Promise.resolve([]) : API.select('profiles', 'select=id,full_name,role,status,phone,created_at&role=in.(director,deputy,teacher)'),
    ps: base.role === 'parent' ? API.select('parent_students', `parent_id=eq.${uidv}`) : Promise.resolve([]),
    inv: base.role === 'student' || base.role === 'parent' ? Promise.resolve([]) : API.select('invites', 'select=*&order=created_at.desc&limit=200'),
    audit: adm ? API.select('audit_log', 'select=*&order=at.desc&limit=100') : Promise.resolve([]),
    mail: adm ? API.select('anonymous_messages', 'select=*&order=created_at.desc&limit=100') : Promise.resolve([]),
  };
  const keys = Object.keys(jobs), vals = await Promise.all(keys.map(k => jobs[k])), R = Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
  const school = R.school[0]; S.school = { id: school.id, name: school.name, code: school.code, city: school.city };
  const cname = Object.fromEntries(R.classes.map(c => [c.id, c.name]));
  S.classes = R.classes.map(c => ({ id: c.id, name: c.name, homeroom: c.homeroom_id, grade: c.grade }));
  S.students = R.students.map(s => ({ id: s.id, name: s.full_name, cls: cname[s.class_id] || '—', clsId: s.class_id, accId: s.profile_id, code: null, birth: s.birth_date, gender: s.gender, demo: s.is_demo,
    photo: s.photo_path && s.photo_meta && s.photo_meta.verified ? { ok: true, path: s.photo_path, ts: Date.parse(s.photo_at), meta: s.photo_meta } : null }));
  S.grades = R.grades.map(g => ({ id: g.id, sid: g.student_id, subj: g.subject_id, value: g.value, type: g.type, date: g.date, by: g.by }));
  S.att = {}; R.att.forEach(a => { (S.att[a.date] = S.att[a.date] || {})[a.student_id] = a.status; });
  S.homework = R.hw.map(h => ({ id: h.id, cls: cname[h.class_id], subj: h.subject_id, title: h.title, dueDate: h.due_date }));
  S.hwDone = {}; R.hwd.forEach(x => { (S.hwDone[x.homework_id] = S.hwDone[x.homework_id] || {})[x.student_id] = true; });
  S.notifs = R.notifs.map(n => ({ id: n.id, sid: n.student_id, kind: n.kind, title: n.title, body: n.body, ts: Date.parse(n.created_at), read: n.read }));
  S.staff = R.staff.map(p => { const asg = R.ta.filter(a => a.teacher_id === p.id); const home = S.classes.find(c => c.homeroom === p.id);
    return { id: p.id, name: p.full_name, role: p.role, status: p.status, phone: p.phone, created: Date.parse(p.created_at), classes: [...new Set([...asg.map(a => cname[a.class_id]), ...(home ? [home.name] : [])])], subjects: [...new Set(asg.map(a => a.subject_id))], homeroom: home ? home.name : null }; });
  S.invites = R.inv.map(i => ({ id: i.id, code: i.code, role: i.role, cls: cname[i.class_id] || null, sid: i.student_id, tail: i.bind_tail, expires: Date.parse(i.expires_at), uses: i.uses, max: i.max_uses, revoked: i.revoked, by: (R.staff.find(p => p.id === i.created_by) || {}).full_name || '' }));
  const ACT = { 'school.created': 'Школа основана', 'invite.created': 'Создано приглашение', 'invite.redeemed': 'Приглашение принято', 'profile.active': 'Доступ подтверждён', 'profile.blocked': 'Доступ закрыт', 'photo.warning': 'Предупреждение о фото', 'photo.set': 'Фото загружено', 'demo.seeded': 'Загружены демо-данные', 'demo.cleared': 'Демо-данные удалены' };
  const nm = id => (R.staff.find(p => p.id === id) || {}).full_name || 'участник';
  S.audit = R.audit.map(a => ({ id: a.id, ts: Date.parse(a.at), who: nm(a.actor), action: a.action, text: ACT[a.action] || a.action }));
  S.mail = R.mail.map(m => ({ id: m.id, ts: Date.parse(m.created_at), cat: m.cat, text: m.text, read: m.read }));
  const mine = S.staff.find(x => x.id === uidv);
  S.session = { ...base, school: S.school.name, classes: mine ? mine.classes : [], subjects: mine ? mine.subjects : [], homeroom: mine ? mine.homeroom : null };
  if (base.role === 'student') { const st = S.students.find(s => s.accId === uidv); S.session.sid = st && st.id; S.session.id = st ? st.id : uidv; S.session.userId = uidv; S.session.cls = st && st.cls; }
  if (base.role === 'parent') { const kids = R.ps.map(p => p.student_id).filter(id => S.students.some(s => s.id === id)); S.session.children = kids; S.session.child = S.session.child && kids.includes(S.session.child) ? S.session.child : kids[0]; }
  save(); emit();
}
export function setChild(id) { if (S.session && S.session.children && S.session.children.includes(id)) { S.session.child = id; save(); emit(); } }
export async function restoreLive() { if (isLive() && API.userId()) { try { await hydrate(); } catch (e) { if (!e.network && e.status === 401) { API.signOut(); S.session = null; save(); emit(); } } } }
