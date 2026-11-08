// Данные v0.8: алтыны, новости школы, «Үн». live — функции Supabase (schema_v6.sql); demo — тот же формат ответов из localStorage.
import * as S from './store.js';
import * as API from './api.js';

const KEY = 'sabak.v8.demo', live = () => S.isLive();
const nowIso = () => new Date().toISOString();
const dayOff = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const ago = m => new Date(Date.now() - m * 60000).toISOString();
let seq = 1; const nid = () => 'v8-' + Date.now().toString(36) + (seq++) + Math.floor(Math.random() * 999);
const err = error => ({ ok: false, error });
const sess = () => S.state().session || {};

const ITEMS = [
  ['skip_lesson', 'Отпроситься с урока', 'Сабактан уруксат алуу', '🚪', 'Один урок по выбранному предмету. Нужна причина; решает учитель предмета. Если откажут — алтыны вернутся.', 40, 'skip_lesson', 'teacher', true, 1, 14],
  ['skip_day', 'Отпроситься с учебного дня', 'Окуу күнүнөн уруксат алуу', '🏠', 'Весь учебный день. Только при уважительной причине; решает классный руководитель или администрация.', 150, 'skip_day', 'homeroom', true, 1, 30],
  ['hw_pass', 'Пропуск домашнего задания', 'Үй ишин өткөрүп жиберүү', '📘', 'Одно домашнее задание без оценки «2» за несделанное.', 25, 'hw_pass', 'teacher', false, 2, 14],
  ['retake', 'Пересдача оценки', 'Бааны кайра тапшыруу', '🔁', 'Шанс переписать работу, за которую получена «2» или «3». Укажите, какую.', 60, 'retake', 'teacher', true, 1, 30],
  ['extra_time', '+10 минут на контрольной', '+10 мүнөт', '⏱️', 'Дополнительное время на выбранной контрольной.', 30, 'extra_time', 'teacher', false, 1, 14],
  ['perk_music', 'Музыка на перемене', 'Танафыста музыка', '🎧', 'Выбрать плейлист на одну перемену (по согласованию с классным руководителем).', 20, 'perk', 'homeroom', false, 1, 14],
  ['perk_seat', 'Выбрать место на уроке', 'Сабакта орун тандоо', '🪑', 'Пересесть на выбранное место на неделю.', 15, 'perk', 'teacher', false, 1, 14],
  ['cosmetic_themes', 'Набор тем профиля «Үн»', 'Үн профили темалары', '🎨', 'Открывает премиум-темы и обложки профиля в школьной ленте «Үн». Применяется сразу.', 50, 'cosmetic', 'auto', false, 1, 36500],
].map(([id, ru, ky, emoji, descr, price, kind, approver, needs_reason, limit_n, limit_days]) => ({ id, ru, ky, emoji, descr, price, kind, approver, needs_reason, limit_n, limit_days, enabled: true }));

const ANIMALS = ['🐆 Анонимный барс', '🦊 Анонимная лиса', '🐺 Анонимный волк', '🦉 Анонимная сова', '🐻 Анонимный медведь', '🦅 Анонимный орёл', '🐘 Анонимный слон', '🐬 Анонимный дельфин', '🦌 Анонимный олень', '🐧 Анонимный пингвин', '🐙 Анонимный осьминог', '🦁 Анонимный лев'];

function seed() {
  return {
    v: 3,
    coins: { items: ITEMS, ledger: {}, requests: [] },
    news: [
      { id: nid(), title: 'Добро пожаловать в SABAK+', body: 'Здесь администрация и учителя публикуют новости только вашей школы. Другие школы их не видят.', kind: 'news', audience: 'all', pinned: true, event_date: null, author: 'Администрация школы', author_role: 'director', at: ago(60 * 20), platform: false, readers: [] },
      { id: nid(), title: 'Родительское собрание', body: 'Собрание 5–9 классов пройдёт в актовом зале. Начало в 18:00, вход со двора.', kind: 'event', audience: 'parents', pinned: false, event_date: dayOff(5), author: 'Администрация школы', author_role: 'director', at: ago(60 * 30), platform: false, readers: [] },
      { id: nid(), title: 'Олимпиада по математике', body: 'Школьный этап олимпиады: запись у учителя математики до пятницы. Победители получают алтыны.', kind: 'event', audience: 'students', pinned: false, event_date: dayOff(9), author: 'Учитель математики', author_role: 'teacher', at: ago(60 * 8), platform: false, readers: [] },
      { id: nid(), title: 'SABAK+ 0.8: алтыны, новости и «Үн»', body: 'Новое от оператора платформы: внутренняя валюта, школьные новости, анонимная и открытая лента «Үн» только для вашей школы.', kind: 'news', audience: 'all', pinned: false, event_date: null, author: 'SABAK+', author_role: 'super', at: ago(60 * 3), platform: true, readers: [] },
    ],
    th: {
      enabled: true, reveal: false, profiles: {}, banned: {}, words: ['дурак', 'идиот'],
      posts: [
        { id: 'p1', uid: 'seed1', anon: false, official: false, alias: null, body: 'Кто идёт на школьный турнир по волейболу в пятницу? Нужны болельщики 📣 #волейбол #школа', at: ago(180), likes: [], rx: { x1: '🔥', x2: '🔥', x3: '👍', x4: '🎉' }, hidden: false, reports: [], media: null },
        { id: 'p2', uid: 'seed2', anon: true, official: false, alias: ANIMALS[0], body: 'Честно: в столовой на третьем этаже всегда холодно, и никто ничего не делает. Можно поднять вопрос? #честно #столовая', at: ago(95), likes: [], rx: { x1: '👍', x2: '👍', x4: '😢', x5: '❤️' }, hidden: false, reports: [], media: null },
        { id: 'p4', uid: 'seed1', anon: false, official: false, alias: null, body: 'Какой кружок открыть после уроков? #опрос #школа', at: ago(25), likes: ['x1'], hidden: false, reports: [], media: null, poll: { opts: ['Робототехника', 'Шахматы', 'Театр', 'Футзал'], votes: { x1: 0, x2: 0, x3: 3, x4: 1, x5: 0 } } },
        { id: 'p3', uid: 'seed3', anon: false, official: true, alias: null, body: 'Принято. Администрация проверит отопление в столовой на этой неделе и напишет в новостях.', at: ago(40), likes: ['x1'], hidden: false, reports: [], media: null },
      ],
      comments: [
        { id: 'c1', post: 'p2', uid: 'seed4', anon: true, alias: ANIMALS[3], parent: null, body: 'Поддерживаю, у нас в классе тоже сквозняк.', at: ago(80), likes: [], hidden: false },
      ],
    },
  };
}
let mem = null;
function D() { if (mem) return mem; try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.v === 3) { mem = r; return mem; } } catch {} mem = seed(); save(); return mem; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} };
export const resetDemo = () => { mem = null; try { localStorage.removeItem(KEY); } catch {} };

// ---------- алтыны (демо) ----------
const ledger = sid => { const c = D().coins; return c.ledger[sid] || (c.ledger[sid] = [{ id: nid(), delta: 90, kind: 'start', note: 'Стартовый подарок', at: ago(60 * 24 * 3) }]); };
const balance = sid => ledger(sid).reduce((s, l) => s + l.delta, 0);
function earnFromGrades(sid) {            // оценки «5» и «4» в демо дают алтыны один раз
  const L = ledger(sid), have = new Set(L.map(l => l.ref).filter(Boolean));
  for (const g of S.state().grades.filter(x => x.sid === sid && x.value >= 4)) {
    if (have.has(g.id)) continue;
    L.push({ id: nid(), delta: g.value === 5 ? 8 : 4, kind: 'grade', ref: g.id, note: `Оценка «${g.value}»`, at: g.date + 'T09:00:00Z' });
  }
}
function coinState(args) {
  const u = sess(); const sid = u.role === 'parent' ? args.p_sid || u.child : u.id;
  if (!sid) return err('no_student');
  earnFromGrades(sid);
  const c = D().coins, L = ledger(sid).slice().sort((a, b) => b.at.localeCompare(a.at));
  const reqs = c.requests.filter(r => r.sid === sid).sort((a, b) => b.at.localeCompare(a.at));
  return {
    ok: true, sid, balance: balance(sid),
    earned: L.filter(l => l.delta > 0 && l.kind !== 'refund' && l.kind !== 'transfer_in').reduce((s, l) => s + l.delta, 0),
    spent: -L.filter(l => l.kind === 'spend').reduce((s, l) => s + l.delta, 0),
    ledger: L.slice(0, 60), items: c.items.filter(i => i.enabled).map(i => ({ ...i, used: reqs.filter(r => r.item_id === i.id && ['pending', 'approved'].includes(r.status) && Date.now() - Date.parse(r.at) < i.limit_days * 864e5).length })),
    requests: reqs.slice(0, 40).map(r => ({ ...r, item: (c.items.find(i => i.id === r.item_id) || {}).ru, emoji: (c.items.find(i => i.id === r.item_id) || {}).emoji })),
    unlocked: reqs.filter(r => r.kind === 'cosmetic' && r.status === 'approved').map(r => r.item_id),
  };
}
function coinRequest(a) {
  const u = sess(); if (u.role !== 'student') return err('forbidden');
  const c = D().coins, it = c.items.find(i => i.id === a.p_item && i.enabled); if (!it) return err('no_item');
  const reason = (a.p_reason || '').trim();
  if (it.needs_reason && reason.length < 10) return err('reason_short');
  if (it.kind === 'skip_lesson' && !a.p_subj) return err('subject_required');
  if (['skip_lesson', 'skip_day', 'extra_time'].includes(it.kind)) {
    if (!a.p_date) return err('date_required');
    if (a.p_date < dayOff(0) || a.p_date > dayOff(14)) return err('date_range');
    if (['skip_lesson', 'skip_day'].includes(it.kind) && [0, 6].includes(new Date(a.p_date).getUTCDay())) return err('weekend');
  }
  const mine = c.requests.filter(r => r.sid === u.id);
  if (['skip_lesson', 'skip_day'].includes(it.kind) && mine.some(r => r.for_date === a.p_date && ['skip_day', 'skip_lesson'].includes(r.kind) && ['pending', 'approved'].includes(r.status) && (it.kind === 'skip_day' || r.kind === 'skip_day'))) return err('duplicate');
  const used = mine.filter(r => r.item_id === it.id && ['pending', 'approved'].includes(r.status) && Date.now() - Date.parse(r.at) < it.limit_days * 864e5).length;
  if (it.limit_n > 0 && used >= it.limit_n) return err('limit');
  earnFromGrades(u.id);
  if (balance(u.id) < it.price) return err('no_funds');
  const id = nid(), auto = it.approver === 'auto';
  c.requests.push({ id, sid: u.id, student: u.name, item_id: it.id, kind: it.kind, subject: a.p_subj || null, for_date: a.p_date || null, reason: reason || null, cost: it.price, status: auto ? 'approved' : 'pending', note: null, at: nowIso(), decided: auto ? nowIso() : null });
  ledger(u.id).push({ id: nid(), delta: -it.price, kind: 'spend', ref: id, note: it.ru, at: nowIso() });
  save(); return { ok: true, id, status: auto ? 'approved' : 'pending', balance: balance(u.id) };
}
function coinCancel(a) {
  const c = D().coins, r = c.requests.find(x => x.id === a.p_id && x.sid === sess().id); if (!r) return err('not_found');
  if (r.status !== 'pending') return err('not_pending');
  r.status = 'cancelled'; ledger(r.sid).push({ id: nid(), delta: r.cost, kind: 'refund', ref: r.id, note: 'Возврат: заявка отменена', at: nowIso() }); save();
  return { ok: true, balance: balance(r.sid) };
}
function coinStaff(a) {
  const u = sess(); if (!['teacher', 'admin', 'deputy', 'director'].includes(u.role)) return err('forbidden');
  const c = D().coins, st = S.state(), p = a.p_status || 'pending';
  const rows = c.requests.filter(r => r.kind !== 'cosmetic' && (p === 'all' || r.status === p)).map(r => {
    const s = st.students.find(x => x.id === r.sid) || {}, gs = st.grades.filter(g => g.sid === r.sid && (!r.subject || g.subj === r.subject));
    return { ...r, student: s.name || r.student, cls: s.cls || '', item: (c.items.find(i => i.id === r.item_id) || {}).ru, emoji: (c.items.find(i => i.id === r.item_id) || {}).emoji, avg: gs.length ? +(gs.reduce((x, g) => x + g.value, 0) / gs.length).toFixed(2) : null, abs30: 0, balance: balance(r.sid) };
  }).sort((x, y) => y.at.localeCompare(x.at));
  return { ok: true, rows };
}
function coinDecide(a) {
  const c = D().coins, r = c.requests.find(x => x.id === a.p_id); if (!r) return err('not_found'); if (r.status !== 'pending') return err('not_pending');
  if (!a.p_approve && !(a.p_note || '').trim()) return err('note_required');
  r.status = a.p_approve ? 'approved' : 'rejected'; r.note = a.p_note || null; r.decided = nowIso();
  if (!a.p_approve) ledger(r.sid).push({ id: nid(), delta: r.cost, kind: 'refund', ref: r.id, note: 'Возврат: отказано', at: nowIso() });
  save(); return { ok: true };
}
function coinAward(a) {
  if (!a.p_amount || a.p_amount < 1 || a.p_amount > 50) return err('amount');
  ledger(a.p_sid).push({ id: nid(), delta: a.p_amount, kind: 'award', note: a.p_note || 'Награда от учителя', at: nowIso() }); save(); return { ok: true, balance: balance(a.p_sid) };
}
function coinAwardClass(a) {
  if (!a.p_amount || a.p_amount < 1 || a.p_amount > 20) return err('amount');
  const st = S.state(); let n = 0; const cl = st.classes.find(c => c.id === a.p_class), cname = cl ? cl.name : String(a.p_class || '');
  for (const s of st.students.filter(x => x.cls === cname)) { ledger(s.id).push({ id: nid(), delta: a.p_amount, kind: 'award', note: a.p_note || 'Награда классу', at: nowIso() }); n++; }
  save(); return { ok: true, n };
}
function coinAdmin() {
  const c = D().coins, st = S.state(); st.students.forEach(s => ledger(s.id));
  return { ok: true, items: c.items, stats: { circulation: st.students.reduce((x, s) => x + Math.max(0, balance(s.id)), 0), spent_30d: Object.values(c.ledger).flat().filter(l => l.kind === 'spend').reduce((x, l) => x - l.delta, 0), pending: c.requests.filter(r => r.status === 'pending' && r.kind !== 'cosmetic').length } };
}
function coinItemSet(a) { const it = D().coins.items.find(i => i.id === a.p_id); if (!it) return err('no_item'); if (a.p_price != null) { if (a.p_price < 0 || a.p_price > 1000) return err('price'); it.price = a.p_price; } if (a.p_enabled != null) it.enabled = a.p_enabled; if (a.p_limit_n != null) it.limit_n = a.p_limit_n; save(); return { ok: true }; }
function coinItemAdd(a) {
  if (!a.p_ru || a.p_ru.trim().length < 3) return err('name'); if (a.p_price < 1 || a.p_price > 1000) return err('price');
  const id = 'c_' + nid(); D().coins.items.push({ id, ru: a.p_ru.trim(), ky: a.p_ru.trim(), emoji: a.p_emoji || '🎁', descr: a.p_descr || '', price: a.p_price, kind: 'perk', approver: a.p_approver || 'teacher', needs_reason: false, limit_n: 1, limit_days: 14, enabled: true });
  save(); return { ok: true, id };
}
function coinTransfer(a) {
  const u = sess(), th = D().th, me = th.profiles[u.id]; if (u.role !== 'student') return err('forbidden'); if (!me) return err('need_profile');
  if (!a.p_amount || a.p_amount < 1 || a.p_amount > 30) return err('amount');
  const to = Object.entries(th.profiles).find(([, p]) => p.username.toLowerCase() === String(a.p_username || '').trim().toLowerCase());
  if (!to) return err('no_user'); if (to[0] === u.id) return err('self');
  if (balance(u.id) < a.p_amount) return err('no_funds');
  ledger(u.id).push({ id: nid(), delta: -a.p_amount, kind: 'transfer_out', note: 'Перевод @' + to[1].username, at: nowIso() });
  ledger(to[0]).push({ id: nid(), delta: a.p_amount, kind: 'transfer_in', note: 'Перевод от @' + me.username, at: nowIso() });
  save(); return { ok: true, balance: balance(u.id) };
}

// ---------- новости (демо) ----------
const visNews = (n, u) => n.platform || n.audience === 'all' || (n.audience === 'staff' && ['teacher', 'admin', 'deputy', 'director'].includes(u.role)) || (n.audience === 'students' && (u.role === 'student' || ['teacher', 'admin', 'deputy', 'director'].includes(u.role))) || (n.audience === 'parents' && (u.role === 'parent' || ['admin', 'deputy', 'director', 'teacher'].includes(u.role))) || n.audience.startsWith('class:') || ['admin', 'deputy', 'director'].includes(u.role);
function newsList() {
  const u = sess(), staff = ['teacher', 'admin', 'deputy', 'director'].includes(u.role);
  const rows = D().news.filter(n => visNews(n, u)).map(n => ({ ...n, read: n.readers.includes(u.id), mine: n.author_id === u.id, reads: staff && !n.platform ? n.readers.length : null }))
    .sort((a, b) => (b.pinned - a.pinned) || b.at.localeCompare(a.at));
  return { ok: true, rows, can_post: staff };
}
function newsPost(a) {
  const u = sess(); if (!['teacher', 'admin', 'deputy', 'director'].includes(u.role)) return err('forbidden');
  if ((a.p_title || '').trim().length < 3) return err('short'); if ((a.p_body || '').trim().length < 3) return err('short');
  if (u.role === 'teacher' && !String(a.p_audience).startsWith('class:')) return err('teacher_class_only'); if (u.role === 'teacher' && a.p_pinned) return err('forbidden');
  D().news.unshift({ id: nid(), title: a.p_title.trim(), body: a.p_body.trim(), kind: a.p_kind || 'news', audience: a.p_audience || 'all', pinned: !!a.p_pinned, event_date: a.p_event || null, fmt: a.p_fmt === 'html' ? 'html' : 'text', author: u.name || 'Педагог', author_role: u.role === 'admin' ? (u.level === 'deputy' ? 'deputy' : 'director') : u.role, author_id: u.id, at: nowIso(), platform: false, readers: [] });
  save(); return { ok: true };
}
function newsSet(a) {
  const n = D().news.find(x => x.id === a.p_id); if (!n || n.platform) return err('not_found');
  if (a.p_delete) D().news = D().news.filter(x => x !== n); else if (a.p_pinned != null) n.pinned = a.p_pinned; save(); return { ok: true };
}
function newsEdit(a) {
  const u = sess(), n = D().news.find(x => x.id === a.p_id); if (!n) return err('not_found');
  const ok = n.platform ? (u.role === 'super') : (u.role === 'admin' || n.author_id === u.id); if (!ok) return err('forbidden');
  if ((a.p_title || '').trim().length < 3 || (a.p_body || '').trim().length < 3) return err('short');
  n.title = a.p_title.trim(); n.body = a.p_body.trim(); n.fmt = a.p_fmt === 'text' ? 'text' : 'html'; n.edited = nowIso(); save(); return { ok: true };
}
function newsRead(a) { const u = sess(); D().news.forEach(n => { if ((!a.p_id || n.id === a.p_id) && !n.readers.includes(u.id)) n.readers.push(u.id); }); save(); return { ok: true }; }

// ---------- «Үн» (демо) ----------
const THEMES_FREE = ['ocean', 'sun', 'mint', 'rose'];
const card = (uid, anon, alias, official) => official ? { official: true, name: 'Администрация школы', emoji: '🏫' } : anon ? { anon: true, alias } : (() => { const p = D().th.profiles[uid]; return p ? { username: p.username, name: p.name, emoji: p.emoji, theme: p.theme, accent: p.accent } : { username: null, name: 'Ученик', emoji: '🙂', theme: 'ocean', accent: '#2352D8' }; })();
const SEEDP = { seed1: { username: 'volley_kg', name: 'Айдана', emoji: '🏐', theme: 'sun', accent: '#E8A317' } };
const thP = () => { const th = D().th; Object.entries(SEEDP).forEach(([k, v]) => { if (!th.profiles[k]) th.profiles[k] = { ...v, bio: 'Люблю волейбол', cover: null }; }); return th.profiles; };
const clean = text => { const t = String(text).toLowerCase(); if (/(https?:\/\/|www\.|t\.me\/|wa\.me\/)/.test(t)) return 'links'; if (/\d[\d\s\-()]{7,}\d/.test(t)) return 'phone'; if (D().th.words.some(w => t.includes(w))) return 'blocked_word'; return null; };
const thOk = () => { const u = sess(); if (!['student', 'director', 'deputy', 'admin'].includes(u.role)) return err('no_access'); if (!D().th.enabled) return err('disabled'); return null; };
const isOfficial = () => ['director', 'deputy', 'admin'].includes(sess().role);
const isBanned = uid => { const b = D().th.banned[uid]; return b && Date.parse(b.until) > Date.now() ? b.until : null; };
function thMe() {
  const u = sess(), th = D().th, bad = thOk(); if (bad) return bad.error === 'disabled' ? { ok: true, enabled: false, role: u.role } : bad;
  thP(); const p = th.profiles[u.id];
  return { ok: true, enabled: true, role: u.role, mod: isOfficial(), reveal: th.reveal, banned: isBanned(u.id), profile: p ? { ...p, can_rename: !p.renamed || Date.now() - p.renamed > 7 * 864e5 } : null, unlocked: D().coins.requests.some(r => r.sid === u.id && r.kind === 'cosmetic' && r.status === 'approved') };
}
function usernameOk(n, me) {
  n = String(n || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(n) || n.includes('__') || n.endsWith('_')) return 'format';
  if (['admin', 'administrator', 'sabak', 'sabakplus', 'support', 'moderator', 'director', 'teacher', 'school', 'official', 'system', 'help', 'root', 'bot'].includes(n) || n.startsWith('sabak')) return 'reserved';
  const th = D().th; thP();
  const taken = Object.entries(th.profiles).find(([, p]) => p.username.toLowerCase() === n);
  if (taken && taken[0] !== me) return 'taken';
  if ((th.released || []).some(r => r.name === n && Date.now() - r.at < 90 * 864e5)) return 'taken';
  return null;
}
function thProfileSave(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; if (u.role !== 'student') return err('students_only'); if (isBanned(u.id)) return err('banned');
  const th = D().th; thP();
  if ((a.p_name || '').trim().length < 2 || a.p_name.trim().length > 32) return err('name'); if ((a.p_bio || '').length > 140) return err('bio');
  if (!/^#[0-9a-f]{6}$/i.test(a.p_accent)) return err('accent');
  if (String(a.p_theme).startsWith('x-') && !D().coins.requests.some(r => r.sid === u.id && r.kind === 'cosmetic' && r.status === 'approved')) return err('locked_theme');
  const c = clean(a.p_name + ' ' + (a.p_bio || '')); if (c) return err(c);
  const old = th.profiles[u.id], n = String(a.p_username).trim().toLowerCase();
  if (!old) { const e = usernameOk(n, u.id); if (e) return err('username_' + e); th.profiles[u.id] = { username: n, renamed: Date.now(), cover: null }; }
  else if (old.username.toLowerCase() !== n) {
    if (old.renamed && Date.now() - old.renamed < 7 * 864e5) return err('rename_cooldown');
    const e = usernameOk(n, u.id); if (e) return err('username_' + e);
    (th.released = th.released || []).push({ name: old.username.toLowerCase(), at: Date.now() }); old.username = n; old.renamed = Date.now();
  }
  Object.assign(th.profiles[u.id], { name: a.p_name.trim(), bio: (a.p_bio || '').trim() || null, emoji: a.p_emoji, theme: a.p_theme, accent: a.p_accent });
  save(); return { ok: true };
}
const REACTS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '👏'];
const rxOf = o => o.rx || (o.rx = Object.fromEntries((o.likes || []).map(u => [u, '❤️'])));
const reactOut = (o, u) => { const rx = rxOf(o), counts = {}; Object.values(rx).forEach(e => { counts[e] = (counts[e] || 0) + 1; }); return { counts, mine: rx[u.id] || null }; };
const repostOut = id => { const q = D().th.posts.find(x => x.id === id); return !q || q.hidden ? { gone: true } : { id: q.id, body: q.body.slice(0, 280), media: q.media, media_kind: q.media ? 'image' : null, at: q.at, author: card(q.uid, q.anon, q.alias, q.official) }; };
const pollOut = (p, u) => p.poll ? { opts: p.poll.opts, counts: p.poll.opts.map((_, i) => Object.values(p.poll.votes).filter(v => v === i).length), mine: p.poll.votes[u.id] ?? null } : null;
const postOut = (p, u, m) => ({ id: p.id, poll: pollOut(p, u), react: reactOut(p, u), repost: p.repost_of ? repostOut(p.repost_of) : null, reposts: D().th.posts.filter(q => q.repost_of === p.id).length, edited: !!p.edited, body: p.body, media: p.media, media_kind: p.media ? 'image' : null, at: p.at, author: card(p.uid, p.anon, p.alias, p.official), likes: Object.keys(rxOf(p)).length, comments: D().th.comments.filter(c => c.post === p.id).length, liked: u.id in rxOf(p), mine: p.uid === u.id, hidden: p.hidden, reports: m ? p.reports.length : null });
function thFeed(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; const m = isOfficial(), th = D().th; thP();
  const target = a.p_username ? Object.entries(th.profiles).find(([, p]) => p.username.toLowerCase() === String(a.p_username).toLowerCase()) : null;
  let rows = th.posts.filter(p => (m || !p.hidden || p.uid === u.id) && (!a.p_username || (target && p.uid === target[0] && !p.anon && !p.official)) && (!a.p_before || p.at < a.p_before));
  const score = p => p.likes.length * 2 + th.comments.filter(c => c.post === p.id).length * 3 + (Date.now() - Date.parse(p.at) < 2 * 864e5 ? 6 : 0);
  rows = rows.sort((x, y) => a.p_sort === 'top' ? score(y) - score(x) : y.at.localeCompare(x.at)).slice(0, Math.min(a.p_limit || 30, 50));
  return { ok: true, rows: rows.map(p => postOut(p, u, m)) };
}
function thProfileGet(a) {
  const th = D().th; thP(); const e = Object.entries(th.profiles).find(([, p]) => p.username.toLowerCase() === String(a.p_username).toLowerCase()); if (!e) return err('not_found');
  const [uid, p] = e; return { ok: true, profile: { username: p.username, name: p.name, bio: p.bio, emoji: p.emoji, theme: p.theme, accent: p.accent, cover: p.cover, since: p.since || nowIso(), mine: uid === sess().id, posts: th.posts.filter(x => x.uid === uid && !x.anon && !x.official && !x.hidden).length } };
}
function thPost(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; if (isBanned(u.id)) return err('banned'); const th = D().th, off = isOfficial(); thP();
  const body = (a.p_body || '').trim(); let root = null;
  if (a.p_repost) { const q = th.posts.find(x => x.id === a.p_repost && !x.hidden); if (!q) return err('not_found'); root = q.repost_of || q.id; }
  if (body.length > 600 || (!body && !root)) return err('body');
  if (!a.p_anon && !off && !th.profiles[u.id]) return err('need_profile');
  const c = body ? clean(body) : null; if (c) return err(c);
  let poll = null;
  if (a.p_poll) { const o = a.p_poll.map(x => String(x || '').trim()); if (o.length < 2 || o.length > 5 || o.some(x => !x || x.length > 40)) return err('poll'); for (const x of o) { const e2 = clean(x); if (e2) return err(e2); } poll = { opts: o, votes: {} }; }
  if (th.posts.filter(p => p.uid === u.id && Date.now() - Date.parse(p.at) < 36e5).length >= 8) return err('rate');
  const id = nid(); th.posts.unshift({ id, uid: u.id, anon: off ? false : !!a.p_anon, official: off, alias: ANIMALS[Math.floor(Math.random() * ANIMALS.length)], body, at: nowIso(), likes: [], hidden: false, reports: [], media: a.p_media || null, poll, repost_of: root });
  save(); return { ok: true, id };
}
function thLike(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; const th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  const rx = rxOf(o), had = u.id in rx; if (had) delete rx[u.id]; else rx[u.id] = '❤️'; save(); return { ok: true, liked: !had, n: Object.keys(rx).length, react: reactOut(o, u) };
}
function thReact(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; if (isBanned(u.id)) return err('banned'); if (!REACTS.includes(a.p_emoji)) return err('emoji');
  const th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  const rx = rxOf(o); if (rx[u.id] === a.p_emoji) delete rx[u.id]; else rx[u.id] = a.p_emoji; save();
  return { ok: true, n: Object.keys(rx).length, react: reactOut(o, u), liked: u.id in rx };
}
function thEdit(a) {
  const u = sess(), p = D().th.posts.find(x => x.id === a.p_id); if (!p) return err('not_found'); if (p.uid !== u.id) return err('forbidden');
  if (Date.now() - Date.parse(p.at) > 15 * 60000) return err('edit_late');
  const b = (a.p_body || '').trim(); if (b.length > 600 || (!b && !p.repost_of)) return err('body'); if (b) { const c = clean(b); if (c) return err(c); }
  p.body = b; p.edited = true; save(); return { ok: true };
}
function thVote(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; if (isBanned(u.id)) return err('banned');
  const p = D().th.posts.find(x => x.id === a.p_post); if (!p || !p.poll) return err('not_found');
  if (a.p_opt == null || a.p_opt < 0 || a.p_opt >= p.poll.opts.length) return err('poll');
  if (!(u.id in p.poll.votes)) p.poll.votes[u.id] = a.p_opt; save(); return { ok: true, poll: pollOut(p, u) };
}
function thComments(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; const th = D().th, m = isOfficial(), post = th.posts.find(p => p.id === a.p_post); if (!post) return err('not_found');
  return { ok: true, rows: th.comments.filter(c => c.post === a.p_post && (m || !c.hidden || c.uid === u.id)).sort((x, y) => x.at.localeCompare(y.at)).map(c => ({ id: c.id, parent: c.parent, body: c.body, at: c.at, author: card(c.uid, c.anon, c.alias, c.official), op: c.uid === post.uid, likes: Object.keys(rxOf(c)).length, liked: u.id in rxOf(c), react: reactOut(c, u), mine: c.uid === u.id, hidden: c.hidden })) };
}
function thComment(a) {
  const u = sess(), bad = thOk(); if (bad) return bad; if (isBanned(u.id)) return err('banned'); const th = D().th, off = isOfficial(); thP();
  const body = (a.p_body || '').trim(); if (!body || body.length > 400) return err('body');
  if (!a.p_anon && !off && !th.profiles[u.id]) return err('need_profile'); const c = clean(body); if (c) return err(c);
  const prev = th.comments.find(x => x.post === a.p_post && x.uid === u.id && x.anon);
  const used = new Set(th.comments.filter(x => x.post === a.p_post && x.anon).map(x => x.alias)), free = ANIMALS.filter(x => !used.has(x));
  const id = nid(); th.comments.push({ id, post: a.p_post, uid: u.id, anon: off ? false : !!a.p_anon, official: off, alias: prev ? prev.alias : (free[0] || ANIMALS[0]), parent: a.p_parent || null, body, at: nowIso(), likes: [], hidden: false });
  save(); return { ok: true, id };
}
function thReport(a) {
  const u = sess(), th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  const r = o.reports || (o.reports = []); if (r.includes(u.id)) return { ok: true, dup: true }; r.push(u.id); if (r.length >= 3) o.hidden = true; save(); return { ok: true, reports: r.length };
}
function thDelete(a) {
  const u = sess(), th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  if (o.uid !== u.id && !isOfficial()) return err('forbidden');
  if (a.p_kind === 'p') th.posts = th.posts.filter(x => x !== o); else th.comments = th.comments.filter(x => x !== o); save(); return { ok: true };
}
function thModQueue() {
  if (!isOfficial()) return err('forbidden'); const th = D().th;
  const rows = [...th.posts.filter(p => p.hidden || p.reports.length).map(p => ({ kind: 'p', id: p.id, post: p.id, body: p.body, at: p.at, author: card(p.uid, p.anon, p.alias, p.official), hidden: p.hidden, reports: p.reports.length })),
    ...th.comments.filter(c => c.hidden || (c.reports || []).length).map(c => ({ kind: 'c', id: c.id, post: c.post, body: c.body, at: c.at, author: card(c.uid, c.anon, c.alias, c.official), hidden: c.hidden, reports: (c.reports || []).length }))];
  return { ok: true, rows, bans: Object.entries(th.banned).filter(([, b]) => Date.parse(b.until) > Date.now()).map(([k, b]) => ({ id: k, until: b.until, reason: b.reason, at: b.at })) };
}
function thModDecide(a) {
  const th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  if (a.p_action === 'restore') { o.hidden = false; o.reports = []; } else if (a.p_action === 'delete') { if (a.p_kind === 'p') th.posts = th.posts.filter(x => x !== o); else th.comments = th.comments.filter(x => x !== o); } else return err('action');
  save(); return { ok: true };
}
function thBan(a) {
  const th = D().th, o = (a.p_kind === 'p' ? th.posts : th.comments).find(x => x.id === a.p_id); if (!o) return err('not_found');
  if (![1, 3, 7, 30].includes(a.p_days)) return err('days'); th.banned[o.uid] = { until: new Date(Date.now() + a.p_days * 864e5).toISOString(), reason: a.p_reason || '', at: nowIso() }; save(); return { ok: true };
}
function thUnban(a) { delete D().th.banned[a.p_id]; save(); return { ok: true }; }
function thReveal() { return err('reveal_off'); }
function thSettings(a) {
  const th = D().th;
  if (sess().role === 'director' || sess().role === 'admin') { if (a.p_enabled != null) th.enabled = a.p_enabled; if (a.p_reveal != null) th.reveal = a.p_reveal; }
  if ((a.p_add || '').trim()) { if (a.p_add.trim().length < 3) return err('word'); if (!th.words.includes(a.p_add.trim().toLowerCase())) th.words.push(a.p_add.trim().toLowerCase()); }
  if ((a.p_del || '').trim()) th.words = th.words.filter(w => w !== a.p_del.trim().toLowerCase());
  save(); return { ok: true, enabled: th.enabled, reveal: th.reveal, words: th.words.slice().sort(), stats: { posts_7d: th.posts.length, anon_7d: th.posts.filter(p => p.anon).length, profiles: Object.keys(thP()).length, reported: th.posts.filter(p => p.hidden || p.reports.length).length } };
}
export function superNewsPost(a) { if ((a.p_title || '').trim().length < 3) return err('short'); D().news.unshift({ id: nid(), title: a.p_title.trim(), body: a.p_body.trim(), kind: 'platform', audience: 'all', pinned: !!a.p_pinned, event_date: null, fmt: a.p_fmt === 'html' ? 'html' : 'text', author: 'SABAK+', author_role: 'super', at: nowIso(), platform: true, readers: [] }); save(); return { ok: true }; }
function lessonSet() { return { ok: true }; }

const DEMO = {
  coin_state: coinState, coin_request: coinRequest, coin_cancel: coinCancel, coin_staff: coinStaff, coin_decide: coinDecide, coin_award: coinAward, coin_award_class: coinAwardClass, coin_admin: coinAdmin, coin_item_set: coinItemSet, coin_item_add: coinItemAdd, coin_transfer: coinTransfer,
  news_list: newsList, news_edit: newsEdit, news_post: newsPost, news_set: newsSet, news_read: newsRead, super_news_post: superNewsPost,
  th_username_check: a => { const bad = thOk(); if (bad) return bad; const e = usernameOk(a.p_name, sess().id); return { ok: true, available: !e, reason: e }; },
  th_me: thMe, th_profile_save: thProfileSave, th_cover_set: a => { const p = D().th.profiles[sess().id]; if (!p) return err('need_profile'); p.cover = a.p_path; save(); return { ok: true }; },
  th_feed: thFeed, th_profile_get: thProfileGet, th_post: thPost, th_like: thLike, th_react: thReact, th_edit: thEdit, th_vote: thVote, th_comments: thComments, th_comment: thComment, th_report: thReport, th_delete: thDelete,
  th_mod_queue: thModQueue, th_mod_decide: thModDecide, th_ban: thBan, th_unban: thUnban, th_reveal: thReveal, th_settings: thSettings, lesson_set: lessonSet,
};

export async function call(name, args = {}) {
  if (live()) {
    try { return await API.rpc(name, args); } catch (e) { if (e.network) return { ok: false, error: 'network' }; if (/Could not find the function|PGRST202|404/.test(e.message + (e.body ? JSON.stringify(e.body) : ''))) return { ok: false, error: 'not_deployed' }; throw e; }
  }
  const f = DEMO[name]; if (!f) return err('not_found');
  return JSON.parse(JSON.stringify(await f(args)));
}

// ---------- медиа (фото в «Үн»): live — Storage, демо — уменьшенный dataURL ----------
export async function uploadMedia(file, kind = 'p') {
  if (!live()) {
    if (!file.type.startsWith('image/')) throw new Error('В демо можно прикреплять только фото.');
    return await shrink(file, kind === 'cover' ? 1000 : 720);
  }
  const sc = (S.state().school || {}).id, uid = API.userId(); if (!sc || !uid) throw new Error('Нет связи с сервером');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }[file.type]; if (!ext) throw new Error('Допустимы JPG, PNG, WebP, MP4, WebM');
  if (file.size > 12 * 1024 * 1024) throw new Error('Файл больше 12 МБ');
  let blob = file; if (file.type.startsWith('image/')) { const d = await shrink(file, kind === 'cover' ? 1400 : 1080); blob = await (await fetch(d)).blob(); }
  const path = `${sc}/${kind}/${uid}-${Date.now()}.${blob.type === 'image/jpeg' ? 'jpg' : ext}`;
  await API.upload('thread-media', path, blob); return path;
}
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .82)); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Не удалось прочитать изображение')); }; img.src = u;
  });
}
const mcache = {};
export function mediaSrc(path, onReady) {          // возвращает src сразу, если он есть; иначе грузит и вызывает onReady
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  if (mcache[path] && mcache[path] !== 'loading') return mcache[path];
  if (!mcache[path]) { mcache[path] = 'loading'; API.download('thread-media', path).then(b => { mcache[path] = URL.createObjectURL(b); onReady && onReady(); }).catch(() => { mcache[path] = ''; }); }
  return '';
}
