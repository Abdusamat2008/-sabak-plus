// Движок достижений. Достижения не выдаются вручную: система сама считает правила по оценкам,
// посещаемости и домашним заданиям. Эти же правила записаны в SQL (supabase/schema_v3.sql, evaluate_achievements),
// поэтому в живом режиме их выдаёт сервер, а здесь они нужны для демо-режима и для полос прогресса.
import { wavg, roundHalfUp, sortGrades, mean, fiveStreak } from './calc.js';

export const RULES = [
  { id: 'first5', e: '🥇', n: 'Первая пятёрка', d: 'Получить первую «5» в учебном году', goal: 1, cat: 'Учёба' },
  { id: 'test5', e: '🎯', n: 'Пятёрка за контрольную', d: 'Получить «5» за контрольную работу', goal: 1, cat: 'Учёба' },
  { id: 'five10', e: '⭐', n: 'Десять пятёрок', d: 'Набрать 10 оценок «5»', goal: 10, cat: 'Учёба' },
  { id: 'fire7', e: '🔥', n: 'Неделя огня', d: '7 дней подряд только «5»', goal: 7, cat: 'Учёба' },
  { id: 'fire30', e: '🌋', n: 'Огонь: 30 дней подряд', d: '30 дней подряд только «5»', goal: 30, cat: 'Учёба' },
  { id: 'excel', e: '🎓', n: 'Отличник предмета', d: 'Не менее 5 оценок по предмету и среднее от 4,8', goal: 5, cat: 'Учёба' },
  { id: 'stable4', e: '🌟', n: 'Ровно на «4» и выше', d: 'Итог не ниже «4» по всем предметам (от 3 предметов)', goal: 1, cat: 'Учёба' },
  { id: 'climb', e: '🚀', n: 'Рывок вперёд', d: 'Последние оценки по предмету выше предыдущих на 0,9 и больше', goal: 0.9, cat: 'Учёба' },
  { id: 'att10', e: '📅', n: '10 дней без «Н»', d: '10 отмеченных учебных дней подряд без пропусков', goal: 10, cat: 'Посещаемость' },
  { id: 'att30', e: '🏅', n: '30 дней без «Н»', d: '30 отмеченных учебных дней подряд без пропусков — железная посещаемость', goal: 30, cat: 'Посещаемость' },
  { id: 'punct20', e: '⏰', n: 'Ни минуты опоздания', d: '20 дней подряд без пропусков и опозданий', goal: 20, cat: 'Посещаемость' },
  { id: 'hw10', e: '📘', n: '10 заданий сделано', d: 'Отметить выполненными 10 домашних заданий', goal: 10, cat: 'Домашние задания' },
  { id: 'hwclean', e: '🧹', n: 'Ни одного долга', d: 'Выполнено 5 заданий и нет просроченных', goal: 5, cat: 'Домашние задания' },
];
export const ruleById = id => RULES.find(r => r.id === id);

// серия дней подряд, начиная с последнего отмеченного, пока статус не из «стоп-статусов»
function streak(att, stop) {
  const days = Object.keys(att).sort().reverse(); let n = 0;
  for (const d of days) { if (stop.includes(att[d])) break; n++; }
  return n;
}
function subjStats(grades) {
  const by = {}; grades.forEach(g => { (by[g.subj] = by[g.subj] || []).push(g); });
  return Object.entries(by).map(([s, gs]) => {
    const v = sortGrades(gs).map(g => g.value), k = Math.min(3, Math.floor(v.length / 2));
    const tr = v.length >= 5 ? mean(v.slice(-k)) - mean(v.slice(-2 * k, -k)) : null;
    return { s, n: gs.length, avg: wavg(gs), fin: roundHalfUp(wavg(gs)), tr };
  });
}

// ctx: { grades:[{subj,value,type,date,id}], att:{date:status}, hwDone:int, hwOverdue:int }
export function evaluate(ctx) {
  const gs = ctx.grades, fives = gs.filter(g => g.value === 5).length, ss = subjStats(gs);
  const cur = {
    first5: Math.min(1, fives), test5: Math.min(1, gs.filter(g => g.type === 'test' && g.value === 5).length), five10: fives,
    fire7: fiveStreak(gs), fire30: fiveStreak(gs),
    excel: Math.max(0, ...ss.filter(x => x.avg >= 4.8).map(x => x.n)),
    stable4: ss.length >= 3 && ss.every(x => x.fin >= 4) ? 1 : 0,
    climb: Math.max(0, ...ss.map(x => (x.tr == null ? 0 : x.tr))),
    att10: streak(ctx.att, ['n']), att30: streak(ctx.att, ['n']), punct20: streak(ctx.att, ['n', 'l']),
    hw10: ctx.hwDone, hwclean: ctx.hwOverdue === 0 ? ctx.hwDone : 0,
  };
  return RULES.map(r => {
    const c = cur[r.id] || 0, ok = c >= r.goal - 1e-9;
    const shown = r.id === 'climb' ? `${c.toFixed(1).replace('.', ',')}/0,9` : `${Math.min(Math.floor(c), r.goal)}/${r.goal}`;
    return { ...r, cur: c, ok, pct: Math.min(1, c / r.goal), p: shown };
  });
}
