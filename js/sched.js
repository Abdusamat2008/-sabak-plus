// Расписание: чистые функции над данными версии (без обращения к состоянию приложения) — их же проверяют тесты.
// data = { shifts:[{id,name,first,len,brk,long:{after,min},count}], bells:{ '1':[{n,s,e}] }, cs:{ classId:{ '1':shiftId,… '6':0 } }, lessons:[{c,d,n,s,t,r}] }
export const DAYS = [[1, 'Понедельник', 'Пн'], [2, 'Вторник', 'Вт'], [3, 'Среда', 'Ср'], [4, 'Четверг', 'Чт'], [5, 'Пятница', 'Пт'], [6, 'Суббота', 'Сб']];
export const MAX_LESSONS = 10;
const m2t = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const t2m = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// Генератор звонков по параметрам смены: начало, длина урока, перемена, большая перемена после N-го урока
export function genBells(sh) {
  let t = t2m(sh.first), out = [];
  for (let n = 1; n <= sh.count; n++) {
    out.push({ n, s: m2t(t), e: m2t(t + sh.len) }); t += sh.len;
    t += (sh.long && sh.long.after === n) ? sh.long.min : sh.brk;
  }
  return out;
}
export const defaultShift = (id = 1, first = '08:30') => ({ id, name: `${id}-я смена`, first, len: 45, brk: 10, long: { after: 2, min: 20 }, count: 7 });
export function emptyData(classes = []) {
  const sh = defaultShift(1);
  return { shifts: [sh], bells: { 1: genBells(sh) }, cs: Object.fromEntries(classes.map(c => [c.id, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0 }])), lessons: [] };
}
export const clone = d => JSON.parse(JSON.stringify(d));
export const shiftOf = (data, cid, d) => { const v = data.cs && data.cs[cid] ? data.cs[cid][d] : 0; return v || 0; };
export const bellOf = (data, shift, n) => ((data.bells || {})[shift] || []).find(b => b.n === n) || null;
export function timeOf(data, cid, d, n) { const sh = shiftOf(data, cid, d); const b = sh ? bellOf(data, sh, n) : null; return b ? { s: b.s, e: b.e, shift: sh } : null; }
export const lessonAt = (data, cid, d, n) => data.lessons.find(l => l.c === cid && l.d === d && l.n === n) || null;
export const dayLessons = (data, cid, d) => data.lessons.filter(l => l.c === cid && l.d === d).sort((a, b) => a.n - b.n).map(l => ({ ...l, time: timeOf(data, cid, d, l.n) }));
export const teacherDay = (data, tid, d) => data.lessons.filter(l => l.t === tid && l.d === d).sort((a, b) => (timeOf(data, a.c, d, a.n) || { s: '' }).s.localeCompare((timeOf(data, b.c, d, b.n) || { s: '' }).s)).map(l => ({ ...l, time: timeOf(data, l.c, d, l.n) }));
export const lessonsCount = (data, cid) => data.lessons.filter(l => l.c === cid).length;
export const maxLessonNo = (data, shift) => ((data.bells || {})[shift] || []).length;

// Пересечения: один учитель/кабинет в одно время в разных классах (учитываются смены и время звонков), урок без звонка
export function conflicts(data, nameOf = x => x) {
  const out = [], L = data.lessons.map(l => ({ l, tm: timeOf(data, l.c, l.d, l.n) }));
  L.forEach(({ l, tm }) => { if (!tm) out.push({ type: 'nobell', a: l, msg: `Урок №${l.n} не попадает в звонки смены этого класса (${DAYS[l.d - 1][2]})` }); });
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const A = L[i], B = L[j]; if (!A.tm || !B.tm || A.l.d !== B.l.d) continue;
    const over = t2m(A.tm.s) < t2m(B.tm.e) && t2m(B.tm.s) < t2m(A.tm.e); if (!over) continue;
    if (A.l.t && A.l.t === B.l.t) out.push({ type: 'teacher', a: A.l, b: B.l, msg: `${nameOf(A.l.t, 't')} ведёт два класса одновременно (${DAYS[A.l.d - 1][2]}, ${A.tm.s})` });
    if (A.l.r && A.l.r === B.l.r && A.l.c !== B.l.c) out.push({ type: 'room', a: A.l, b: B.l, msg: `Кабинет ${A.l.r} занят дважды (${DAYS[A.l.d - 1][2]}, ${A.tm.s})` });
  }
  return out;
}
export const conflictKeys = cs => { const k = new Set(); cs.forEach(x => { [x.a, x.b].forEach(l => l && k.add(`${l.c}|${l.d}|${l.n}`)); }); return k; };

// Установить/убрать урок в ячейке (возвращает новую копию данных)
export function setLesson(data, cid, d, n, patch) {
  const x = clone(data), i = x.lessons.findIndex(l => l.c === cid && l.d === d && l.n === n);
  if (!patch) { if (i >= 0) x.lessons.splice(i, 1); return x; }
  if (i >= 0) x.lessons[i] = { ...x.lessons[i], ...patch }; else x.lessons.push({ c: cid, d, n, s: '', t: null, r: '', ...patch });
  return x;
}
export function moveLesson(data, from, to) {   // from/to = {c,d,n}; если в целевой ячейке урок есть — меняем местами
  const x = clone(data), A = x.lessons.find(l => l.c === from.c && l.d === from.d && l.n === from.n); if (!A) return x;
  const B = x.lessons.find(l => l.c === to.c && l.d === to.d && l.n === to.n);
  if (B) { B.c = from.c; B.d = from.d; B.n = from.n; }
  A.c = to.c; A.d = to.d; A.n = to.n; return x;
}
// Очистить уроки, вышедшие за пределы звонков (после уменьшения числа уроков или смены смены)
export function prune(data) {
  const x = clone(data); x.lessons = x.lessons.filter(l => timeOf(x, l.c, l.d, l.n)); return x;
}
export function copyDay(data, cid, from, to) {
  const x = clone(data); x.lessons = x.lessons.filter(l => !(l.c === cid && l.d === to));
  data.lessons.filter(l => l.c === cid && l.d === from).forEach(l => x.lessons.push({ ...l, d: to })); return prune(x);
}
export function copyClass(data, from, to) {
  const x = clone(data); x.lessons = x.lessons.filter(l => l.c !== to);
  data.lessons.filter(l => l.c === from).forEach(l => x.lessons.push({ ...l, c: to, r: '' })); x.cs[to] = clone(x.cs[from] || {}); return prune(x);
}
// Сводка для проверки перед отправкой
export function summary(data, classes) {
  return classes.map(c => ({ c, n: lessonsCount(data, c.id), days: [1, 2, 3, 4, 5, 6].filter(d => data.lessons.some(l => l.c === c.id && l.d === d)).length }));
}
// Сравнение версий: что изменилось (для директора при одобрении)
export function diff(oldD, newD) {
  const key = l => `${l.c}|${l.d}|${l.n}`, o = new Map((oldD ? oldD.lessons : []).map(l => [key(l), l])), n = new Map(newD.lessons.map(l => [key(l), l]));
  let add = 0, del = 0, chg = 0; n.forEach((l, k) => { if (!o.has(k)) add++; else { const p = o.get(k); if (p.s !== l.s || p.t !== l.t || p.r !== l.r) chg++; } }); o.forEach((l, k) => { if (!n.has(k)) del++; });
  return { add, del, chg, same: !add && !del && !chg };
}
