// Хранилище MVP: localStorage + журнал изменений + откат + очередь синхронизации (offline-first).
// Этап 2: заменить на Supabase (см. README и supabase/schema.sql) — интерфейс функций останется тем же.
import { schoolDaysBack, todayISO, addDays, sortGrades } from './calc.js';

const KEY = 'sabak.mvp.v1';
const VERSION = 3;
let S = null;
const subs = new Set();
export const on = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(f => f());

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
  parent:  { id: 'p1', name: 'Родитель Айданы', role: 'parent', child: 's1' },
  teacher: { id: 't1', name: 'Гульнара Эсеновна', role: 'teacher', subjects: ['math', 'inf'], classes: ['9А', '9Б'] },
  admin:   { id: 'a1', name: 'Администрация школы', role: 'admin' },
};

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
  const add = (sid, sj, value, type, date, by = 't1') => grades.push({ id: 'g' + (gid++), sid, subj: sj, value, type, date, by });

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

  return {
    v: VERSION, students, grades, att, homework, hwDone, events, mail: [], log: [], undo: [], queue: [],
    session: null, prefs: { lang: 'ru', scale: 1, contrast: false, offlineDemo: false },
    nextId: 1000,
  };
}

export function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
  if (!S || S.v !== VERSION) { S = seed(); save(); }
  return S;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('storage', e); } }
export const state = () => S;
export function resetDemo() { const prefs = S.prefs; S = seed(); S.prefs = prefs; save(); emit(); }

const uid = p => p + (S.nextId++);
const nowTs = () => Date.now();
const who = () => (S.session ? (S.session.name || S.session.role) : 'система');

function logAndQueue(action, text) {
  const ts = nowTs();
  S.log.unshift({ id: uid('l'), ts, who: who(), action, text });
  S.log = S.log.slice(0, 200);
  S.queue.push({ id: uid('q'), ts, action, text, synced: false });
}

// ---- сессия ----
export function login(role) {
  const u = USERS[role]; S.session = { ...u }; save(); emit();
}
export function logout() { S.session = null; save(); emit(); }
export function setPrefs(p) { Object.assign(S.prefs, p); save(); emit(); }

// ---- оценки ----
export function addGrade({ sid, subj: sj, value, type }) {
  const g = { id: uid('g'), sid, subj: sj, value, type, date: todayISO(), by: S.session ? S.session.id : 't1' };
  S.grades.push(g);
  S.undo.push({ kind: 'delGrade', id: g.id });
  const st = S.students.find(s => s.id === sid);
  logAndQueue('grade', `Оценка «${value}» · ${st ? st.name : sid} · ${subj(sj).ru}`);
  save(); emit(); return g;
}
export function setAttendance(sid, date, status) {
  S.att[date] = S.att[date] || {};
  const prev = S.att[date][sid] || null;
  S.att[date][sid] = status;
  S.undo.push({ kind: 'att', sid, date, prev });
  const st = S.students.find(s => s.id === sid);
  logAndQueue('attendance', `Посещаемость: ${st ? st.name : sid} — ${ { p: 'присутствует', n: 'отсутствует', l: 'опоздал(а)' }[status] }`);
  save(); emit();
}
export function addStudent(name, cls) {
  const id = uid('s');
  const code = (cls === '9А' ? 'A' : 'B') + (3000 + Math.floor(Math.random() * 900));
  S.students.push({ id, name, cls, code });
  S.undo.push({ kind: 'delStudent', id });
  logAndQueue('student', `Добавлен ученик: ${name} (${cls}), код входа ${code}`);
  save(); emit(); return { id, code };
}
export function undoLast() {
  const u = S.undo.pop(); if (!u) return null;
  if (u.kind === 'delGrade') {
    const g = S.grades.find(x => x.id === u.id); S.grades = S.grades.filter(x => x.id !== u.id);
    logAndQueue('undo', `Отмена: оценка «${g ? g.value : ''}» удалена`);
  } else if (u.kind === 'att') {
    if (u.prev) S.att[u.date][u.sid] = u.prev; else delete S.att[u.date][u.sid];
    logAndQueue('undo', 'Отмена отметки посещаемости');
  } else if (u.kind === 'delStudent') {
    S.students = S.students.filter(x => x.id !== u.id);
    logAndQueue('undo', 'Отмена: ученик удалён');
  }
  save(); emit(); return u;
}
export function toggleHw(hid, sid) {
  S.hwDone[hid] = S.hwDone[hid] || {};
  if (S.hwDone[hid][sid]) delete S.hwDone[hid][sid]; else S.hwDone[hid][sid] = true;
  save(); emit();
}
export function sendMail(cat, text) {
  S.mail.unshift({ id: uid('m'), ts: nowTs(), cat, text, read: false }); // автор не сохраняется — анонимно
  save(); emit();
}
export function markMailRead(id) { const m = S.mail.find(x => x.id === id); if (m) { m.read = true; save(); emit(); } }

// ---- очередь синхронизации (демо: «сервер» подтверждает приём) ----
export const pending = () => S.queue.filter(q => !q.synced).length;
export function flushQueue() {
  const n = pending(); if (!n) return 0;
  S.queue.forEach(q => { q.synced = true; });
  S.queue = S.queue.slice(-50);
  save(); emit(); return n;
}
export const isOffline = () => S.prefs.offlineDemo || (typeof navigator !== 'undefined' && navigator.onLine === false);

// ---- выборки ----
export const studentsOf = cls => S.students.filter(s => s.cls === cls);
export const gradesOf = (sid, sj) => sortGrades(S.grades.filter(g => g.sid === sid && (!sj || g.subj === sj)));
export const hwFor = sid => { const st = S.students.find(s => s.id === sid); return S.homework.filter(h => h.cls === (st && st.cls)).map(h => ({ ...h, dueDate: addDays(todayISO(), h.due), done: !!(S.hwDone[h.id] && S.hwDone[h.id][sid]) })); };
export const attOf = (sid, n = 10) => schoolDaysBack(n).map(d => ({ date: d, v: (S.att[d] && S.att[d][sid]) || null }));
