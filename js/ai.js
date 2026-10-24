// ЖАРДАМЧЫ AI (встроенный анализ). Только рекомендации: функции ничего не пишут в оценки.
// Каждый вывод объясним: показываем числа, на которых он основан.
import { wavg, finalGrade, fivesNeeded, trend, sortGrades, mean, fmt1, fmt2, dmy, RULES_RU } from './calc.js';
import { SUBJECTS, subj, gradesOf, attOf } from './store.js';

export function subjectReport(sid, sj) {
  const gs = gradesOf(sid, sj);
  const avg = wavg(gs), fin = finalGrade(gs);
  const need = fin != null && fin < 5 ? fivesNeeded(gs, fin + 1) : null;
  const tr = trend(gs);
  return { subj: sj, gs, n: gs.length, avg, fin, need, tr };
}

export function studentReport(sid) {
  const subs = SUBJECTS.map(s => subjectReport(sid, s.id)).filter(r => r.n);
  const att = attOf(sid, 10).filter(a => a.v);
  const abs = att.filter(a => a.v === 'n').length;
  const late = att.filter(a => a.v === 'l').length;
  const weak = subs.filter(r => r.avg != null && r.avg < 3.5).sort((a, b) => a.avg - b.avg);
  const dropping = subs.filter(r => r.tr != null && r.tr <= -0.9).sort((a, b) => a.tr - b.tr);
  const growing = subs.filter(r => r.tr != null && r.tr >= 0.9);
  const overall = mean(subs.filter(r => r.avg != null).map(r => r.avg));
  return { subs, abs, late, weak, dropping, growing, overall };
}

export const isAtRisk = sid => { const r = studentReport(sid); return r.weak.length > 0 || r.dropping.length > 0 || r.abs >= 3; };

// Подробный анализ по ученику и предмету (для учителя)
export function advise(sid, sj) {
  const r = subjectReport(sid, sj);
  const name = subj(sj).ru;
  const out = { facts: [], warnings: [], recs: [], explain: [] };

  if (r.n === 0) { out.warnings.push('Оценок по предмету пока нет — анализ невозможен.'); return out; }
  if (r.n < 3) out.warnings.push(`Данных мало: всего ${r.n} оцен${r.n === 1 ? 'ка' : 'ки'}. Выводы предварительные.`);

  // расчёт четвертной
  out.explain.push(`Среднее взвешенное по ${r.n} оценкам: ${fmt2(r.avg)}. ${RULES_RU}`);
  out.explain.push(`Предполагаемая четвертная оценка: «${r.fin}».`);
  if (r.need != null && r.need > 0) out.explain.push(`Чтобы итог стал «${r.fin + 1}», нужно ещё ${r.need} ${r.need === 1 ? 'пятёрка' : r.need < 5 ? 'пятёрки' : 'пятёрок'} (при текущих весах).`);
  if (r.need === null && r.fin < 5) out.explain.push(`До «${r.fin + 1}» далеко: потребуется больше 20 пятёрок.`);

  // динамика
  if (r.tr != null) {
    if (r.tr <= -0.9) out.facts.push(`Динамика отрицательная: последние оценки на ${fmt1(-r.tr)} балла ниже предыдущих.`);
    else if (r.tr >= 0.9) out.facts.push(`Динамика положительная: последние оценки на ${fmt1(r.tr)} балла выше предыдущих.`);
    else out.facts.push('Динамика стабильная.');
  }

  // типы работ: где проседает
  const byType = {};
  r.gs.forEach(g => { (byType[g.type] = byType[g.type] || []).push(g.value); });
  const tests = byType.test || [], hw = byType.hw || [];
  if (tests.length >= 2 && hw.length >= 2 && mean(hw) - mean(tests) >= 0.8) out.facts.push(`Контрольные (${fmt1(mean(tests))}) заметно слабее, чем домашние работы (${fmt1(mean(hw))}): возможна нехватка уверенности на контроле.`);
  if (tests.length >= 2 && hw.length >= 2 && mean(tests) - mean(hw) >= 0.8) out.facts.push(`Домашние работы (${fmt1(mean(hw))}) слабее контрольных (${fmt1(mean(tests))}): возможно, не хватает регулярной практики.`);

  // возможные несоответствия
  const sorted = sortGrades(r.gs);
  sorted.forEach((g, i) => {
    if (i < 3) return;
    const m = mean(sorted.slice(i - 3, i).map(x => x.value));
    if (Math.abs(g.value - m) >= 2.5) out.warnings.push(`Оценка «${g.value}» (${dmy(g.date)}) сильно отличается от предыдущих (≈${fmt1(m)}). Проверьте, нет ли ошибки ввода.`);
  });

  // рекомендации
  if (r.fin <= 3) out.recs.push('Разобрать с учеником темы, где были «3» и «2»; предложить короткие задания на повторение 2–3 раза в неделю.');
  if (r.tr != null && r.tr <= -0.9) out.recs.push('Поговорить с учеником и родителями: что изменилось в последние недели? Предложить консультацию или дополнительное занятие.');
  if (tests.length >= 2 && mean(tests) < 3.5) out.recs.push('Перед следующей контрольной дать тренировочный вариант с разбором ошибок.');
  if (r.need === 1) out.recs.push('Одна хорошая работа переводит итог на балл выше — предложите ученику возможность исправить оценку.');
  if (!out.recs.length) out.recs.push('Поддерживать текущий темп; отметить успехи ученика.');

  const att = attOf(sid, 10).filter(a => a.v);
  const abs = att.filter(a => a.v === 'n').length;
  if (abs >= 3) out.facts.push(`Пропусков за последние 10 учебных дней: ${abs}. Это может влиять на оценки по предмету «${name}».`);
  return out;
}

// Сводка для ученика («что делать дальше»)
export function studentTodo(sid) {
  const r = studentReport(sid);
  return r;
}

// Анонимная сводка для облачного ИИ (без ФИО)
export function anonymousSummary(sid, sj) {
  const r = subjectReport(sid, sj);
  return {
    subject: subj(sj).ru,
    grades: sortGrades(r.gs).map(g => ({ value: g.value, type: g.type, date: g.date })),
    weightedAverage: r.avg != null ? Number(r.avg.toFixed(2)) : null,
    proposedQuarterGrade: r.fin,
    fivesNeededForNextGrade: r.need,
    trend: r.tr != null ? Number(r.tr.toFixed(2)) : null,
  };
}
