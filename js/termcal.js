// Календарь учебного года: четверти и каникулы. Даты задаёт суперадмин (по приказу министерства образования).
// Модуль без зависимостей: хранит кэш календаря и отвечает на вопрос «что сегодня — четверть или каникулы?».
export const cache = { terms: [], loaded: false, loading: false, deployed: false, today: null, ticked: false };

const pad = n => String(n).padStart(2, '0');
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoOf(new Date());
export const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
export const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
/** Учебный год по дате: с 1 сентября «2026/2027» */
export const yearLabel = (iso = today()) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`; };
export const prevYear = l => { const y = Number(l.slice(0, 4)); return `${y - 1}/${y}`; };
export const nextYear = l => { const y = Number(l.slice(0, 4)); return `${y + 1}/${y + 2}`; };

export const KIND_RU = { quarter: n => `${n}-я четверть`, break: n => ['Осенние каникулы', 'Зимние каникулы', 'Весенние каникулы', 'Летние каникулы'][n - 1] || 'Каникулы' };
export const termName = t => KIND_RU[t.kind](t.num);

export function setTerms(items) { cache.terms = (items || []).map(t => ({ year: t.year, kind: t.kind, num: t.num, starts: t.starts, ends: t.ends, decree: t.decree || null })); cache.loaded = true; }
export const termsOf = year => cache.terms.filter(t => t.year === year).sort((a, b) => a.starts.localeCompare(b.starts));
export const hasCalendar = year => cache.terms.some(t => t.year === year && t.kind === 'quarter');

/** Образец для суперадмина и демо: типичное деление года (реальные даты задаёт приказ). */
export function defaultTerms(label) {
  const y = Number(label.slice(0, 4));
  const T = (kind, num, a, b) => ({ year: label, kind, num, starts: a, ends: b });
  return [T('quarter', 1, `${y}-09-01`, `${y}-10-25`), T('break', 1, `${y}-10-26`, `${y}-11-01`), T('quarter', 2, `${y}-11-02`, `${y}-12-27`), T('break', 2, `${y}-12-28`, `${y + 1}-01-11`),
    T('quarter', 3, `${y + 1}-01-12`, `${y + 1}-03-21`), T('break', 3, `${y + 1}-03-22`, `${y + 1}-03-31`), T('quarter', 4, `${y + 1}-04-01`, `${y + 1}-05-25`)];
}

/** Что с датой: free — календаря нет, ограничений нет; open; grace (3 дня после конца четверти — можно править); closed; break; upcoming */
export function stateOf(iso, tod = today()) {
  const lb = yearLabel(iso);
  if (!hasCalendar(lb)) return 'free';
  const t = termsOf(lb).find(x => x.kind === 'quarter' && iso >= x.starts && iso <= x.ends);
  if (!t) return 'break';
  if (tod < t.starts) return 'upcoming';
  if (tod <= t.ends) return 'open';
  if (tod <= addD(t.ends, 3)) return 'grace';
  return 'closed';
}
export const GUARD_MSG = { break: 'Сейчас каникулы: в эту дату оценки не ставятся', closed: 'Четверть закрыта, оценки уже в архиве. Изменить их нельзя' };
/** Бросает понятную ошибку, если оценку на эту дату поставить нельзя */
export function assertOpen(iso) { const s = stateOf(iso); if (GUARD_MSG[s]) throw new Error(GUARD_MSG[s]); return s; }
export const isBreak = iso => stateOf(iso) === 'break';

/** Где мы сейчас: { term, kind:'quarter'|'break'|null, day, total, left, next } */
export function now(tod = today()) {
  const lb = yearLabel(tod), list = termsOf(lb).concat(termsOf(nextYear(lb))).concat(termsOf(prevYear(lb)));
  const sorted = list.sort((a, b) => a.starts.localeCompare(b.starts));
  const cur = sorted.find(t => tod >= t.starts && tod <= t.ends) || null;
  const next = sorted.find(t => t.starts > tod) || null;
  return { today: tod, year: lb, term: cur, next, day: cur ? diffDays(cur.starts, tod) + 1 : null, total: cur ? diffDays(cur.starts, cur.ends) + 1 : null, left: cur ? diffDays(tod, cur.ends) : null, toNext: next ? diffDays(tod, next.starts) : null };
}
/** Четверть по дате (1–4) или null */
export function quarterOf(iso) { const t = termsOf(yearLabel(iso)).find(x => x.kind === 'quarter' && iso >= x.starts && iso <= x.ends); return t ? t.num : null; }
export function rangeOf(year, q) { if (!q) { const y = Number(year.slice(0, 4)); return [`${y}-09-01`, `${y + 1}-08-31`]; } const t = termsOf(year).find(x => x.kind === 'quarter' && x.num === q); return t ? [t.starts, t.ends] : null; }

export const dateRu = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');
export const dayRu = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
export const weekdayRu = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long' });

/** Для демо-данных: каникулы по образцу дат (до загрузки календаря) */
export const inDefaultBreak = iso => { const lb = yearLabel(iso); return !defaultTerms(lb).some(t => t.kind === 'quarter' && iso >= t.starts && iso <= t.ends) && iso >= `${lb.slice(0, 4)}-09-01` && iso <= `${Number(lb.slice(0, 4)) + 1}-05-25`; };
