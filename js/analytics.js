// Математический анализ успеваемости: показатели, корреляция, тренд, выбросы, мониторинг педагогов, выводы и графики (SVG).
// Все выводы объяснимы: рядом всегда показываются числа, на которых они основаны.
import * as S from './store.js';
import { wavg, finalGrade, todayISO, addDays, schoolDaysBack, mean, fmt1, fmt2 } from './calc.js';

export const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const stdev = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1)); };
export function pearson(xs, ys) {
  const n = xs.length; if (n < 5) return null;
  const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
export function slope(ys) { const n = ys.length; if (n < 3) return null; const xs = ys.map((_, i) => i), mx = mean(xs), my = mean(ys); let a = 0, b = 0; for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; } return b ? a / b : null; }
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
const ATT_DAYS = 14;

export function attendanceRate(sid, days = ATT_DAYS) {
  const st = S.state(); let p = 0, n = 0;
  schoolDaysBack(days).forEach(d => { const v = st.att[d] && st.att[d][sid]; if (v === 'n') n++; else if (v) p++; });
  return p + n ? p / (p + n) : null;
}

// Основной расчёт. scope: { cls } — класс (или null = вся школа)
export function scope({ cls = null } = {}) {
  const st = S.state();
  const students = st.students.filter(s => !cls || s.cls === cls);
  const finals = [];                         // итоговые оценки ученик×предмет
  const perStudent = students.map(s => {
    const subs = S.SUBJECTS.map(sj => { const gs = S.gradesOf(s.id, sj.id); return gs.length ? { subj: sj.id, avg: wavg(gs), fin: finalGrade(gs), n: gs.length } : null; }).filter(Boolean);
    subs.forEach(x => finals.push({ sid: s.id, subj: x.subj, fin: x.fin, avg: x.avg }));
    const avg = subs.length ? mean(subs.map(x => x.avg)) : null;
    return { id: s.id, name: s.name, cls: s.cls, avg, subs, att: attendanceRate(s.id), hasTwo: subs.some(x => x.fin === 2) };
  });
  const N = finals.length, cnt = v => finals.filter(f => f.fin === v).length, [n2, n3, n4, n5] = [2, 3, 4, 5].map(cnt);
  const withAvg = perStudent.filter(p => p.avg != null);
  const avgs = withAvg.map(p => p.avg);
  const sou = N ? (100 * n5 + 64 * n4 + 36 * n3 + 16 * n2) / N : null;
  const pairs = withAvg.filter(p => p.att != null);
  const r = pearson(pairs.map(p => p.att), pairs.map(p => p.avg));
  const mu = mean(avgs), sd = stdev(avgs);
  const outliers = sd > 0 ? withAvg.filter(p => (p.avg - mu) / sd <= -1.5).map(p => ({ ...p, z: (p.avg - mu) / sd })) : [];
  // недельная динамика среднего балла (последние 6 недель)
  const today = todayISO(), weeks = [];
  const ids = new Set(students.map(s => s.id));
  for (let w = 5; w >= 0; w--) {
    const from = addDays(today, -(w + 1) * 7 + 1), to = addDays(today, -w * 7);
    const vals = st.grades.filter(g => ids.has(g.sid) && g.date >= from && g.date <= to).map(g => g.value);
    weeks.push({ label: `${to.slice(8)}.${to.slice(5, 7)}`, avg: vals.length ? mean(vals) : null, n: vals.length });
  }
  const trendSlope = slope(weeks.filter(w => w.avg != null).map(w => w.avg));
  const bySubject = S.SUBJECTS.map(sj => {
    const f = finals.filter(x => x.subj === sj.id), n = f.length, c = v => f.filter(x => x.fin === v).length;
    return { id: sj.id, name: sj.ru, n, avg: n ? mean(f.map(x => x.avg)) : null, quality: pct(c(5) + c(4), n), success: pct(n - c(2), n), sou: n ? (100 * c(5) + 64 * c(4) + 36 * c(3) + 16 * c(2)) / n : null };
  }).filter(x => x.n);
  const attAll = pairs.map(p => p.att);
  return {
    cls, nStudents: students.length, N, dist: { 2: n2, 3: n3, 4: n4, 5: n5 },
    avg: mu, median: median(avgs), sd, min: avgs.length ? Math.min(...avgs) : null, max: avgs.length ? Math.max(...avgs) : null,
    quality: pct(n4 + n5, N), success: pct(N - n2, N), sou, att: attAll.length ? mean(attAll) : null, corr: r, outliers, weeks, trend: trendSlope, bySubject, perStudent,
    risk: perStudent.filter(p => p.hasTwo || (p.avg != null && p.avg < 3.2) || (p.att != null && p.att < 0.8)),
    photoOk: students.filter(s => s.photo && s.photo.ok).length,
    docsRate: (() => { let have = 0, tot = 0; students.forEach(s => { const d = st.docs[s.id] || {}; ['application', 'birth_cert', 'parent_id', 'reg_cert', 'med_026', 'med_063', 'photo_3x4', 'consent_pd', 'contract'].forEach(k => { tot++; if (d[k] && d[k].status === 'have') have++; }); }); return tot ? have / tot : null; })(),
  };
}

// Мониторинг педагогов
export function teachers() {
  const st = S.state(), today = todayISO(), from14 = addDays(today, -14), days10 = schoolDaysBack(10);
  const all = st.grades.map(g => g.value), gMean = mean(all), gSd = stdev(all);
  return st.staff.filter(x => x.role === 'teacher').map(t => {
    const gs = st.grades.filter(g => g.by === t.id), vals = gs.map(g => g.value);
    const last = gs.reduce((m, g) => g.date > m ? g.date : m, '');
    const idle = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : null;
    const active = new Set(gs.filter(g => days10.includes(g.date)).map(g => g.date)).size;
    const recent = gs.filter(g => g.date >= from14).length;
    const m = vals.length ? mean(vals) : null, p5 = pct(vals.filter(v => v === 5).length, vals.length), p2 = pct(vals.filter(v => v === 2).length, vals.length);
    const flags = [];
    if (t.status !== 'active') flags.push({ k: 'pending', text: 'Доступ не подтверждён' });
    else if (!gs.length) flags.push({ k: 'idle', text: 'Нет ни одной оценки' });
    else if (idle > 7) flags.push({ k: 'idle', text: `Журнал не заполнялся ${idle} дн.` });
    if (m != null && vals.length >= 15 && gSd > 0) { const z = (m - gMean) / gSd; if (z > 0.6) flags.push({ k: 'high', text: `Оценки заметно выше средних по школе (+${fmt2(m - gMean)})` }); if (z < -0.6) flags.push({ k: 'low', text: `Оценки заметно ниже средних по школе (${fmt2(m - gMean)})` }); }
    return { id: t.id, name: t.name, status: t.status, classes: t.classes, subjects: t.subjects, homeroom: t.homeroom, n: gs.length, recent, last, idle, fill: active / 10, mean: m, p5, p2, sd: vals.length > 1 ? stdev(vals) : null, flags };
  });
}

// Автоматические выводы по набору показателей
export function conclusions(a, { school = false } = {}) {
  const out = [], add = (level, text) => out.push({ level, text });
  if (!a.N) { add('info', 'Данных пока недостаточно для анализа: нет оценок.'); return out; }
  add(a.success >= 95 ? 'ok' : a.success >= 85 ? 'info' : 'warn', `Абсолютная успеваемость ${fmt1(a.success)}% (доля итоговых оценок не ниже «3»); качество знаний ${fmt1(a.quality)}% (доля «4» и «5»); СОУ ${fmt1(a.sou)}% — ${a.sou >= 62 ? 'повышенный' : a.sou >= 50 ? 'оптимальный' : a.sou >= 36 ? 'допустимый' : 'низкий'} уровень обученности.`);
  if (a.median != null) add('info', `Средний балл ${fmt2(a.avg)}, медиана ${fmt2(a.median)}, разброс (σ) ${fmt2(a.sd)}.${a.sd > 0.7 ? ' Разброс большой: в группе есть и сильные, и слабые ученики — нужна дифференциация заданий.' : ' Группа ровная по уровню.'}`);
  if (a.corr != null) {
    const r = a.corr, ar = Math.abs(r), w = ar >= 0.7 ? 'сильная' : ar >= 0.4 ? 'умеренная' : ar >= 0.2 ? 'слабая' : 'отсутствует';
    add(r >= 0.4 ? 'warn' : 'info', `Связь посещаемости и успеваемости (корреляция Пирсона r = ${r.toFixed(2)}): ${w}${ar >= 0.2 ? r > 0 ? ' — чем больше пропусков, тем ниже оценки' : ' (обратная)' : ''}.${r >= 0.4 ? ' Работа с посещаемостью даст прирост оценок.' : ''}`);
  }
  if (a.trend != null) add(a.trend > 0.05 ? 'ok' : a.trend < -0.05 ? 'warn' : 'info', `Динамика за 6 недель (линейный тренд): ${a.trend > 0 ? '+' : ''}${a.trend.toFixed(2)} балла в неделю — ${a.trend > 0.05 ? 'рост' : a.trend < -0.05 ? 'снижение' : 'стабильно'}.`);
  const weakS = [...a.bySubject].filter(x => x.avg != null).sort((x, y) => x.avg - y.avg);
  if (weakS.length > 1) add('info', `Самый сильный предмет — «${weakS[weakS.length - 1].name}» (${fmt2(weakS[weakS.length - 1].avg)}), самый слабый — «${weakS[0].name}» (${fmt2(weakS[0].avg)}).`);
  if (a.outliers.length) add('warn', `Статистические выбросы вниз (z ≤ −1,5): ${a.outliers.map(o => `${o.name} (${fmt2(o.avg)})`).join(', ')}. Им нужна индивидуальная поддержка.`);
  if (a.risk.length) add('warn', `Группа внимания: ${a.risk.length} из ${a.nStudents} (двойка по предмету, средний балл ниже 3,2 или посещаемость ниже 80%).`);
  if (a.att != null && a.att < 0.9) add('warn', `Посещаемость за 14 дней ${Math.round(a.att * 100)}% — ниже ориентира 90%.`);
  if (a.nStudents) add(a.photoOk / a.nStudents >= 0.9 ? 'ok' : 'info', `Фото профилей: ${a.photoOk} из ${a.nStudents}.${a.docsRate != null ? ` Обязательные документы в «делах» собраны на ${Math.round(a.docsRate * 100)}%.` : ''}`);
  return out;
}

// ---------- графики (SVG; шрифт Arial — чтобы одинаково рисовались и на экране, и в экспорте) ----------
const F = 'font-family="Arial,Helvetica,sans-serif"';
const C = { ink: '#0B0B0B', blue: '#2352D8', g5: '#2352D8', g4: '#1F9D6B', g3: '#E2A33B', g2: '#D6443F', mute: '#6b6b6b', grid: '#d9d5cc' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function svgBars(items, { w = 520, h = 240, max = null, unit = '', title = '' } = {}) {   // items: [{label,value,color}]
  const m = { l: 36, r: 12, t: title ? 30 : 14, b: 40 }, pw = w - m.l - m.r, ph = h - m.t - m.b, bw = pw / Math.max(1, items.length);
  const raw = Math.max(1, ...items.map(i => i.value || 0));
  let mx, ticks;
  if (max) { mx = max; ticks = max; } else { const step = [1, 2, 5, 10, 20, 25, 50, 100].find(x => raw / x <= 5) || 100; ticks = Math.ceil(raw * 1.08 / step); mx = ticks * step; }
  const stepV = mx / ticks;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${F}><rect width="${w}" height="${h}" fill="#fff"/>`;
  if (title) s += `<text x="${m.l}" y="18" font-size="13" font-weight="700" fill="${C.ink}">${esc(title)}</text>`;
  for (let i = 0; i <= ticks; i++) { const y = m.t + ph - ph * i / ticks; s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}" stroke="${C.grid}"/><text x="${m.l - 5}" y="${y + 4}" font-size="10" text-anchor="end" fill="${C.mute}">${Math.round(stepV * i * 10) / 10}</text>`; }
  items.forEach((it, i) => {
    const v = it.value || 0, bh = ph * v / mx, x = m.l + i * bw + bw * 0.18, y = m.t + ph - bh;
    s += `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${bh}" fill="${it.color || C.blue}" rx="2"/><text x="${x + bw * 0.32}" y="${y - 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${C.ink}">${it.value == null ? '—' : Math.round(v * 100) / 100}${unit}</text>`;
    const lab = String(it.label), t1 = lab.length > 9 ? lab.slice(0, 8) + '.' : lab;
    s += `<text x="${x + bw * 0.32}" y="${h - m.b + 15}" font-size="10" text-anchor="middle" fill="${C.ink}">${esc(t1)}</text>`;
  });
  return s + '</svg>';
}
export function svgLine(points, { w = 520, h = 220, title = '', min = 2, max = 5 } = {}) {    // points: [{label,value|null}]
  const m = { l: 36, r: 14, t: title ? 30 : 14, b: 30 }, pw = w - m.l - m.r, ph = h - m.t - m.b, n = points.length, X = i => m.l + (n > 1 ? pw * i / (n - 1) : pw / 2), Y = v => m.t + ph - ph * (v - min) / (max - min);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${F}><rect width="${w}" height="${h}" fill="#fff"/>`;
  if (title) s += `<text x="${m.l}" y="18" font-size="13" font-weight="700" fill="${C.ink}">${esc(title)}</text>`;
  for (let v = min; v <= max; v += 0.5) { const y = Y(v); s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}" stroke="${C.grid}"/>${Number.isInteger(v) ? `<text x="${m.l - 5}" y="${y + 4}" font-size="10" text-anchor="end" fill="${C.mute}">${v}</text>` : ''}`; }
  const pts = points.map((p, i) => p.value == null ? null : [X(i), Y(p.value), p.value]);
  const path = pts.filter(Boolean).map(p => p.slice(0, 2).join(',')).join(' ');
  if (path) s += `<polyline points="${path}" fill="none" stroke="${C.blue}" stroke-width="2.5" stroke-linejoin="round"/>`;
  pts.forEach(p => { if (p) s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${C.blue}"/><text x="${p[0]}" y="${p[1] - 9}" font-size="10" font-weight="700" text-anchor="middle" fill="${C.ink}">${p[2].toFixed(2)}</text>`; });
  points.forEach((p, i) => { s += `<text x="${X(i)}" y="${h - 10}" font-size="10" text-anchor="middle" fill="${C.mute}">${esc(p.label)}</text>`; });
  return s + '</svg>';
}
export function svgScatter(pts, { w = 520, h = 260, title = '', xl = 'Посещаемость, %', yl = 'Средний балл', r = null } = {}) {   // pts: [{x(0..1),y(2..5)}]
  const m = { l: 40, r: 14, t: title ? 30 : 14, b: 40 }, pw = w - m.l - m.r, ph = h - m.t - m.b, xs = pts.map(p => p.x), x0 = Math.min(0.5, ...xs), x1 = 1, X = x => m.l + pw * (x - x0) / (x1 - x0), Y = y => m.t + ph - ph * (y - 2) / 3;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${F}><rect width="${w}" height="${h}" fill="#fff"/>`;
  if (title) s += `<text x="${m.l}" y="18" font-size="13" font-weight="700" fill="${C.ink}">${esc(title)}${r != null ? ` · r = ${r.toFixed(2)}` : ''}</text>`;
  for (let v = 2; v <= 5; v++) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.grid}"/><text x="${m.l - 5}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="${C.mute}">${v}</text>`;
  for (let v = Math.ceil(x0 * 10) / 10; v <= 1.001; v += 0.1) s += `<text x="${X(v)}" y="${h - 22}" font-size="10" text-anchor="middle" fill="${C.mute}">${Math.round(v * 100)}</text>`;
  s += `<text x="${m.l + pw / 2}" y="${h - 6}" font-size="11" text-anchor="middle" fill="${C.ink}">${xl}</text><text x="12" y="${m.t + ph / 2}" font-size="11" text-anchor="middle" fill="${C.ink}" transform="rotate(-90 12 ${m.t + ph / 2})">${yl}</text>`;
  if (pts.length >= 5) { const xm = mean(pts.map(p => p.x)), ym = mean(pts.map(p => p.y)); let a = 0, b = 0; pts.forEach(p => { a += (p.x - xm) * (p.y - ym); b += (p.x - xm) ** 2; }); if (b) { const k = a / b, c0 = ym - k * xm; s += `<line x1="${X(x0)}" y1="${Y(c0 + k * x0)}" x2="${X(x1)}" y2="${Y(c0 + k * x1)}" stroke="${C.g2}" stroke-width="2" stroke-dasharray="6 4"/>`; } }
  pts.forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${C.blue}" fill-opacity=".75"/>`; });
  return s + '</svg>';
}
export const distBars = a => [2, 3, 4, 5].map(v => ({ label: `«${v}»`, value: a.dist[v], color: C['g' + v] }));
