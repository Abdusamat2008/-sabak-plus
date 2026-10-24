// Расчёт оценок. Правила прозрачны и показываются пользователю.
export const TYPES = {
  hw:   { ru: 'ДЗ',              ky: 'Үй тапшырма',  w: 1 },
  act:  { ru: 'Активность',      ky: 'Активдүүлүк',  w: 1 },
  ind:  { ru: 'Самостоятельная', ky: 'Өз алдынча',   w: 1 },
  test: { ru: 'Контрольная',     ky: 'Текшерүү иши', w: 2 },
  talk: { ru: 'Доклад',          ky: 'Доклад',       w: 1 },
  essay:{ ru: 'Реферат',         ky: 'Реферат',      w: 1 },
};
export const RULES_RU = 'Контрольная учитывается с весом ×2, остальное ×1. Итог — среднее, округлённое от x,5 вверх.';

const wOf = g => (TYPES[g.type] ? TYPES[g.type].w : 1);
export const sortGrades = gs => [...gs].sort((a, b) => a.date === b.date ? (a.id > b.id ? 1 : -1) : (a.date > b.date ? 1 : -1));
export const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

export function wavg(gs) {
  let sw = 0, s = 0;
  for (const g of gs) { const w = wOf(g); sw += w; s += w * g.value; }
  return sw ? s / sw : null;
}
export const roundHalfUp = x => Math.floor(x + 0.5 + 1e-9);
export function finalGrade(gs) { const a = wavg(gs); return a == null ? null : roundHalfUp(a); }

// Сколько ещё пятёрок (вес 1) нужно, чтобы итог стал >= target. 0 — уже достаточно, null — недостижимо.
export function fivesNeeded(gs, target) {
  if (!gs.length) return null;
  let sw = 0, s = 0;
  gs.forEach(g => { const w = wOf(g); sw += w; s += w * g.value; });
  for (let n = 0; n <= 20; n++) if (roundHalfUp((s + 5 * n) / (sw + n)) >= target) return n;
  return null;
}
// Насколько среднему не хватает до порога округления target-0.5
export const gapTo = (gs, target) => { const a = wavg(gs); return a == null ? null : Math.max(0, (target - 0.5) - a); };

// Динамика: среднее последних k оценок минус среднее предыдущих k
export function trend(gs) {
  const v = sortGrades(gs).map(g => g.value);
  if (v.length < 5) return null;
  const k = Math.min(3, Math.floor(v.length / 2));
  return mean(v.slice(-k)) - mean(v.slice(-2 * k, -k));
}

export const fmt1 = x => x == null ? '—' : x.toFixed(1).replace('.', ',');
export const fmt2 = x => x == null ? '—' : x.toFixed(2).replace('.', ',');

// Серия: сколько последних дней подряд, в которые были оценки, все оценки за день — «5»
export function fiveStreak(gs) {
  const byDay = {};
  gs.forEach(g => { (byDay[g.date] = byDay[g.date] || []).push(g.value); });
  const days = Object.keys(byDay).sort().reverse();
  let n = 0;
  for (const d of days) { if (Math.min(...byDay[d]) === 5) n++; else break; }
  return n;
}

// ---- даты ----
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => iso(new Date());
export function addDays(isoStr, n) { const d = new Date(isoStr + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
export const isWeekend = isoStr => { const w = new Date(isoStr + 'T12:00:00').getDay(); return w === 0 || w === 6; };
export function schoolDaysBack(n, from = todayISO()) {
  const out = []; let d = from;
  while (isWeekend(d)) d = addDays(d, -1);
  while (out.length < n) { if (!isWeekend(d)) out.push(d); d = addDays(d, -1); }
  return out; // от новых к старым
}
export const dmy = isoStr => { const [y, m, d] = isoStr.split('-'); return `${d}.${m}`; };
