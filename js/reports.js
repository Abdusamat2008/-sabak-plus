// Подробные отчёты по предметам, годам и четвертям; табель ученика (четверти и прошлые годы); ввод оцифрованных прошлых лет; карточка оценки.
import * as S from './store.js';
import * as V from './v9data.js';
import * as T from './termcal.js';
import * as X_ from './export.js';
import { wavg, roundHalfUp, fmt2, dmy } from './calc.js';
import { esc, ui, head, toast, sjName } from './common.js';

const rerender = () => window.__render && window.__render();
const cache = {};
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка' }; rerender(); });
  return 'loading';
}
export const refresh = () => { Object.keys(cache).forEach(k => delete cache[k]); };
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
const TYPE_RU = { hw: 'ДЗ', act: 'Активность', ind: 'Самостоятельная', test: 'Контрольная', talk: 'Доклад', essay: 'Реферат' };
const asG = g => ({ value: g[0], type: g[1], date: g[2], topic: g[3] });
const stat = rows => {
  const fins = rows.map(r => { const a = wavg(r.g.map(asG)); return a == null ? null : roundHalfUp(a); }).filter(x => x != null);
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0 }; fins.forEach(f => { dist[f] = (dist[f] || 0) + 1; });
  const n = fins.length, all = rows.flatMap(r => r.g.map(asG)), avg = all.length ? wavg(all) : null;
  return { n, dist, grades: all.length, avg, pass: n ? Math.round((dist[5] + dist[4] + dist[3]) / n * 100) : null, quality: n ? Math.round((dist[5] + dist[4]) / n * 100) : null, students: new Set(rows.map(r => r.sid)).size };
};

// ===================== ОТЧЁТЫ (педагоги и администрация) =====================
const RX = () => (ui.rp = ui.rp || { year: null, q: null, cls: '', subj: '', view: 'students' });
export function reportsPage() {
  const x = RX(), st = S.state(), u = st.session, cur = T.yearLabel();
  const years = [...new Set([...T.cache.terms.map(t => t.year), cur, T.prevYear(cur)])].sort().reverse();
  const year = x.year || cur; if (x.q == null) x.q = T.quarterOf(T.today()) || 0;
  const classes = u.role === 'teacher' ? st.classes.filter(c => (u.classes || []).includes(c.name)) : st.classes;
  const subjects = u.role === 'teacher' ? st.subjects.filter(s => (u.subjects || []).includes(s.id)) : st.subjects;
  const key = ['rep', year, x.q, x.cls, x.subj].join('|');
  const R = load(key, async () => V.need(await V.call('report_rows', { p_year: year, p_quarter: x.q, p_class: x.cls || null, p_subject: x.subj || null })));
  const qOpts = [[0, 'Весь год'], ...[1, 2, 3, 4].map(q => [q, `${q}-я четверть`])];
  const filters = `<div class="ctl rp-ctl">
    <label>Учебный год<select data-act="rp-year">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <label>Период<select data-act="rp-q">${qOpts.map(([v, n]) => `<option value="${v}" ${Number(x.q) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Класс<select data-act="rp-cls"><option value="">Все классы</option>${classes.map(c => `<option value="${c.id}" ${x.cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Предмет<select data-act="rp-subj"><option value="">Все предметы</option>${subjects.map(s => `<option value="${s.id}" ${x.subj === s.id ? 'selected' : ''}>${esc(sjName(s.id))}</option>`).join('')}</select></label></div>`;
  const top = head('Отчёты', '', 'Любой предмет, класс, четверть и учебный год');
  if (R === 'loading') return `${top}${filters}<div class="card"><p class="muted">Считаем…</p></div>`;
  if (R.err) return `${top}${filters}<div class="card"><p>⚠️ ${esc(R.err)}</p></div>`;
  const rows = R.rows, s = stat(rows);
  if (!rows.length) return `${top}${filters}<div class="card"><p class="muted">За выбранный период оценок нет. Проверьте год, четверть и предмет. Прошлые годы появляются здесь после архивации четвертей.</p></div>`;
  const kp = (l, v, c = '') => `<div class="jk ${c}"><b>${v}</b><small>${l}</small></div>`;
  const dist = [5, 4, 3, 2].map(v => `<div class="dist"><span class="g g${v}">${v}</span><div class="db"><i style="width:${s.n ? s.dist[v] / s.n * 100 : 0}%"></i></div><b>${s.dist[v]}</b></div>`).join('');
  const per = x.view === 'subjects' ? bySubject(rows) : byStudent(rows);
  const tabs = `<div class="mb-tabs rp-tabs" role="tablist">${[['students', 'По ученикам'], ['subjects', 'По предметам'], ['grades', 'Все оценки']].map(([k, n]) => `<button role="tab" aria-selected="${x.view === k}" class="${x.view === k ? 'on' : ''}" data-act="rp-view" data-v="${k}">${n}</button>`).join('')}</div>`;
  const body = x.view === 'grades' ? allGrades(rows) : per;
  return `${top}${filters}<div class="jstrip rp-kpi">${kp('учеников', s.students)}${kp('оценок', s.grades)}${kp('средний балл', fmt2(s.avg))}${kp('успеваемость', s.pass != null ? s.pass + '%' : '—')}${kp('качество знаний', s.quality != null ? s.quality + '%' : '—')}</div>
  <div class="grid2"><section class="card"><h2 class="tp">Итоговые оценки</h2>${dist}<p class="muted rp-note">Успеваемость: доля итогов «3» и выше. Качество знаний: доля «4» и «5». ${R.src === 'archive' ? 'Данные из архива четверти.' : 'Данные журнала.'}</p></section>
  <section class="card"><h2 class="tp">Выгрузить отчёт</h2><p class="muted">Период: ${esc(T.dateRu(R.from))} — ${esc(T.dateRu(R.to))}</p><div class="btns"><button class="btn" data-act="rp-xlsx">⬇ Excel</button><button class="btn" data-act="rp-docx">Word</button><button class="btn" data-act="rp-pdf">PDF (печать)</button></div></section></div>
  ${tabs}<section class="card rp-tbl">${body}</section>`;
}
function byStudent(rows) {
  const m = {}; rows.forEach(r => { (m[r.sid] = m[r.sid] || { name: r.name, cls: r.cls, rs: [] }).rs.push(r); });
  return `<div class="tblw"><table class="tbl"><thead><tr><th>Класс</th><th>Ученик</th><th>Предметы: итог (средний)</th><th>Средний балл</th><th>Н</th></tr></thead><tbody>${Object.values(m).map(o => {
    const all = o.rs.flatMap(r => r.g.map(asG)), avg = wavg(all), nn = o.rs.reduce((a, r) => a + (r.a ? r.a.n : 0), 0), has = o.rs.some(r => r.a);
    return `<tr><td>${esc(o.cls || '')}</td><td>${esc(o.name)}</td><td>${o.rs.map(r => { const a = wavg(r.g.map(asG)); return `<span class="rp-sj">${esc(sjName(r.subject))} <span class="g g${roundHalfUp(a)}">${roundHalfUp(a)}</span><small>${fmt2(a)}</small></span>`; }).join('')}</td><td><b>${fmt2(avg)}</b></td><td>${has ? nn : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function bySubject(rows) {
  const m = {}; rows.forEach(r => { (m[r.subject] = m[r.subject] || []).push(r); });
  return `<div class="tblw"><table class="tbl"><thead><tr><th>Предмет</th><th>Учеников</th><th>Оценок</th><th>Средний балл</th><th>5</th><th>4</th><th>3</th><th>2</th><th>Успеваемость</th><th>Качество</th></tr></thead><tbody>${Object.entries(m).map(([sj, rs]) => { const s = stat(rs); return `<tr><td><b>${esc(sjName(sj))}</b></td><td>${s.students}</td><td>${s.grades}</td><td>${fmt2(s.avg)}</td><td>${s.dist[5]}</td><td>${s.dist[4]}</td><td>${s.dist[3]}</td><td>${s.dist[2]}</td><td>${s.pass}%</td><td>${s.quality}%</td></tr>`; }).join('')}</tbody></table></div>`;
}
function allGrades(rows) {
  const flat = rows.flatMap(r => r.g.map(g => ({ r, g }))).sort((a, b) => b.g[2].localeCompare(a.g[2]) || a.r.name.localeCompare(b.r.name)).slice(0, 400);
  return `<div class="tblw"><table class="tbl"><thead><tr><th>Дата</th><th>Класс</th><th>Ученик</th><th>Предмет</th><th>Вид</th><th>Оценка</th><th>Тема урока</th></tr></thead><tbody>${flat.map(({ r, g }) => `<tr><td>${dmy(g[2])}</td><td>${esc(r.cls || '')}</td><td>${esc(r.name)}</td><td>${esc(sjName(r.subject))}</td><td>${esc(TYPE_RU[g[1]] || g[1])}</td><td><span class="g g${g[0]}">${g[0]}</span></td><td>${esc(g[3] || '')}</td></tr>`).join('')}</tbody></table></div>${rows.reduce((a, r) => a + r.g.length, 0) > 400 ? '<p class="muted">Показаны последние 400 оценок. В Excel выгружаются все.</p>' : ''}`;
}
function reportDoc(R) {
  const x = RX(), st = S.state(), year = x.year || T.yearLabel(), rows = R.rows, s = stat(rows);
  const cls = x.cls ? (st.classes.find(c => c.id === x.cls) || {}).name : 'все классы', per = Number(x.q) ? `${x.q}-я четверть` : 'весь год';
  const m = {}; rows.forEach(r => { (m[r.subject] = m[r.subject] || []).push(r); });
  return { title: `Отчёт по успеваемости, ${year}, ${per}`, subtitle: `${st.school.name} · ${cls}${x.subj ? ' · ' + sjName(x.subj) : ''} · ${T.dateRu(R.from)} — ${T.dateRu(R.to)}`, sections: [
    { t: 'h', text: 'Итоги' }, { t: 'bul', items: [`Учеников: ${s.students}. Оценок: ${s.grades}. Средний балл: ${fmt2(s.avg)}`, `Успеваемость: ${s.pass}%. Качество знаний: ${s.quality}%`, `Итоговые «5»: ${s.dist[5]}, «4»: ${s.dist[4]}, «3»: ${s.dist[3]}, «2»: ${s.dist[2]}`] },
    { t: 'table', name: 'По предметам', header: ['Предмет', 'Учеников', 'Оценок', 'Средний балл', '5', '4', '3', '2', 'Успеваемость %', 'Качество %'], rows: Object.entries(m).map(([sj, rs]) => { const z = stat(rs); return [sjName(sj), z.students, z.grades, Number(fmt2(z.avg).replace(',', '.')), z.dist[5], z.dist[4], z.dist[3], z.dist[2], z.pass, z.quality]; }) },
    { t: 'table', name: 'По ученикам', header: ['Класс', 'Ученик', 'Предмет', 'Оценок', 'Средний балл', 'Итог', 'Пропусков (Н)'], rows: rows.map(r => { const a = wavg(r.g.map(asG)); return [r.cls || '', r.name, sjName(r.subject), r.g.length, Number(fmt2(a).replace(',', '.')), roundHalfUp(a), r.a ? r.a.n : '']; }) },
    { t: 'table', name: 'Все оценки', header: ['Дата', 'Класс', 'Ученик', 'Предмет', 'Вид', 'Оценка', 'Тема урока'], rows: rows.flatMap(r => r.g.map(g => [g[2], r.cls || '', r.name, sjName(r.subject), TYPE_RU[g[1]] || g[1], g[0], g[3] || ''])).sort((a, b) => a[0].localeCompare(b[0])) }] };
}

// ===================== ТАБЕЛЬ УЧЕНИКА =====================
const HX = () => (ui.hist = ui.hist || { year: null });
export function historyPage(sid) {
  const st = S.state(), cur = T.yearLabel(), s = S.student(sid);
  const H = load('hist:' + sid + ':' + (S.isLive() ? 'l' : 'd'), async () => V.need(await V.call('student_history', { p_sid: sid })));
  const top = head('Табель', s ? s.name : '', 'Итоги по четвертям и учебным годам');
  if (H === 'loading') return `${top}<div class="card"><p class="muted">Загружаем…</p></div>`;
  if (H.err) return `${top}<div class="card"><p>⚠️ ${esc(H.err)}</p></div>`;
  // текущий год: четверти из архива или по журналу (пока четверть идёт)
  const years = {}; const put = (y, q, sj, f, src) => { ((years[y] = years[y] || {})[sj] = years[y][sj] || {})[q] = { f, src }; };
  H.rows.forEach(r => put(r.year, r.quarter, r.subject, r.final, r.src));
  [1, 2, 3, 4].forEach(q => { const rg = T.rangeOf(cur, q); if (!rg || T.today() < rg[0]) return;
    const bySj = {}; S.state().grades.filter(g => g.sid === sid && g.date >= rg[0] && g.date <= rg[1]).forEach(g => (bySj[g.subj] = bySj[g.subj] || []).push(g));
    Object.entries(bySj).forEach(([sj, gs]) => { if (!(years[cur] && years[cur][sj] && years[cur][sj][q])) put(cur, q, sj, roundHalfUp(wavg(gs)), T.today() <= rg[1] ? 'live' : 'journal'); }); });
  const labels = Object.keys(years).sort().reverse(); if (!labels.includes(cur)) labels.unshift(cur);
  const x = HX(), year = x.year && labels.includes(x.year) ? x.year : labels[0];
  const tabs = `<div class="mb-tabs" role="tablist" aria-label="Учебные годы">${labels.map(y => `<button role="tab" aria-selected="${y === year}" class="${y === year ? 'on' : ''}" data-act="hist-year" data-v="${y}">${y}${y === cur ? ' · сейчас' : ''}</button>`).join('')}</div>`;
  const Y = years[year] || {}, sjs = Object.keys(Y).sort((a, b) => sjName(a).localeCompare(sjName(b), 'ru'));
  let body;
  if (!sjs.length) body = year === cur ? '<p class="muted">В этом году итогов пока нет. Они появятся, когда будут оценки за четверть.</p>' : '<p class="muted">Итоги этого года школа ещё не оцифровала.</p>';
  else {
    const cell = (c, q) => c ? `<td class="hc"><span class="g g${c.f} ${c.src === 'live' ? 'live' : ''}" title="${c.src === 'archive' ? 'Архив четверти' : c.src === 'manual' ? 'Внесено школой' : c.src === 'live' ? 'Четверть идёт, оценка может измениться' : 'По журналу'}">${c.f}</span>${c.src === 'live' ? '<small>идёт</small>' : ''}</td>` : '<td class="hc muted">—</td>';
    body = `<div class="tblw"><table class="tbl hist"><thead><tr><th>Предмет</th><th>1 чт.</th><th>2 чт.</th><th>3 чт.</th><th>4 чт.</th><th>Год</th></tr></thead><tbody>${sjs.map(sj => {
      const q = Y[sj], fs = [1, 2, 3, 4].map(n => q[n] && q[n].src !== 'live' ? q[n].f : null).filter(v => v != null), yr = q[5] ? q[5].f : (fs.length === 4 ? roundHalfUp(fs.reduce((a, b) => a + b, 0) / 4) : null);
      return `<tr><td><b>${esc(sjName(sj))}</b></td>${[1, 2, 3, 4].map(n => cell(q[n], n)).join('')}${yr != null ? `<td class="hc"><span class="g g${yr}"><b>${yr}</b></span></td>` : '<td class="hc muted">—</td>'}</tr>`; }).join('')}</tbody></table></div>
      <p class="muted">Итог четверти — среднее с весом контрольных ×2, округлённое от x,5 вверх. «Год» считается, когда закрыты все четыре четверти.</p>`;
  }
  const note = labels.length <= 1 ? `<section class="card"><h2 class="tp">Прошлые годы</h2><p class="muted">Здесь появятся итоги предыдущих лет, когда учителя и администрация школы их оцифруют. Итоги текущего года система сохраняет сама: после конца каждой четверти оценки попадают в архив.</p></section>` : '';
  return `${top}${tabs}<section class="card">${body}<div class="btns"><button class="btn ghost" data-act="hist-print">Печать</button></div></section>${note}`;
}

// ===================== ПРОШЛЫЕ ГОДЫ (ввод) =====================
const PX = () => (ui.past = ui.past || { cls: '', sid: '', year: null });
export function pastPage() {
  const x = PX(), st = S.state(), u = st.session, cur = T.yearLabel();
  const classes = u.role === 'teacher' ? st.classes.filter(c => (u.classes || []).includes(c.name)) : st.classes;
  if (!x.cls || !classes.some(c => c.id === x.cls)) x.cls = classes[0] ? classes[0].id : '';
  const cname = (classes.find(c => c.id === x.cls) || {}).name, studs = st.students.filter(s => s.cls === cname).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (!studs.some(s => s.id === x.sid)) x.sid = studs[0] ? studs[0].id : '';
  const years = Array.from({ length: 6 }, (_, i) => { let y = cur; for (let k = 0; k <= i; k++) y = T.prevYear(y); return y; });
  const year = x.year && years.includes(x.year) ? x.year : years[0];
  const top = head('Прошлые годы', '', 'Оцифровка итогов предыдущих лет. Их увидят ученик и родители в разделе «Табель»');
  const sel = `<div class="ctl"><label>Класс<select data-act="past-cls">${classes.map(c => `<option value="${c.id}" ${c.id === x.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Ученик<select data-act="past-sid">${studs.map(s => `<option value="${s.id}" ${s.id === x.sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <label>Учебный год<select data-act="past-year">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>`;
  if (!x.sid) return `${top}${sel}<div class="card"><p class="muted">В классе нет учеников.</p></div>`;
  const H = load('past:' + x.sid + ':' + (S.isLive() ? 'l' : 'd'), async () => V.need(await V.call('student_history', { p_sid: x.sid })));
  if (H === 'loading') return `${top}${sel}<div class="card"><p class="muted">Загружаем…</p></div>`;
  if (H.err) return `${top}${sel}<div class="card"><p>⚠️ ${esc(H.err)}</p></div>`;
  const get = (q, sj) => H.rows.find(r => r.year === year && r.quarter === q && r.subject === sj);
  const subs = u.role === 'teacher' ? st.subjects.filter(s => (u.subjects || []).includes(s.id)) : st.subjects;
  const opts = v => ['', 5, 4, 3, 2].map(o => `<option value="${o}" ${String(v ?? '') === String(o) ? 'selected' : ''}>${o === '' ? '—' : o}</option>`).join('');
  const rows = subs.map(s => `<tr><td><b>${esc(sjName(s.id))}</b></td>${[1, 2, 3, 4, 5].map(q => { const r = get(q, s.id); return r && r.src === 'archive' ? `<td class="hc"><span class="g g${r.final}" title="Архив системы, изменить нельзя">${r.final}</span> 🔒</td>` : `<td class="hc"><select data-act="past-set" data-q="${q}" data-sj="${s.id}" aria-label="${esc(sjName(s.id))}, ${q === 5 ? 'год' : q + ' четверть'}">${opts(r && r.final)}</select></td>`; }).join('')}</tr>`).join('');
  return `${top}${sel}<section class="card"><div class="tblw"><table class="tbl hist"><thead><tr><th>Предмет</th><th>1 чт.</th><th>2 чт.</th><th>3 чт.</th><th>4 чт.</th><th>Год</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">Каждое изменение сохраняется сразу и записывается в журнал действий. Учитель вносит свои предметы, классный руководитель и администрация всё.</p></section>`;
}

// ===================== КАРТОЧКА ОЦЕНКИ =====================
export function modal() {
  const g = ui.gd; if (!g) return '';
  const R = load('gd:' + g.id, async () => V.need(await V.call('grade_detail', { p_id: g.id })));
  const wrap = inner => `<div class="modal-bg" data-act="gd-close"></div><div class="modal gd-modal" role="dialog" aria-modal="true" aria-label="Карточка оценки"><button class="ibtn close" data-act="gd-close" aria-label="Закрыть">✕</button>${inner}</div>`;
  if (R === 'loading') return wrap('<h2>Оценка</h2><p class="muted">Загружаем…</p>');
  if (R.err) return wrap(`<h2>Оценка</h2><p>⚠️ ${esc(R.err)}</p>`);
  const d = R.grade, me = S.state().session, mine = me.role === 'teacher' && S.state().grades.some(z => z.id === d.id && z.by === me.id);
  const subj = (S.state().grades.find(z => z.id === d.id) || {}).subj;
  const fmtT = iso => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const ACT = { insert: 'Поставлена', update: 'Изменена', delete: 'Удалена' };
  const diff = (o, n) => o && n ? ['value', 'type', 'date', 'topic', 'comment'].filter(k => String(o[k] ?? '') !== String(n[k] ?? '')).map(k => `${({ value: 'оценка', type: 'вид', date: 'дата', topic: 'тема', comment: 'комментарий' })[k]}: ${esc(String(o[k] ?? '—'))} → ${esc(String(n[k] ?? '—'))}`).join('; ') : '';
  return wrap(`<div class="gd-top"><span class="g g${d.value} lg">${d.value}</span><div><h2>${subj ? esc(sjName(subj)) : 'Оценка'}</h2><p class="muted">${esc(TYPE_RU[d.type] || d.type)} · ${esc(T.dateRu(d.date))}</p></div></div>
  <dl class="sum"><dt>Тема урока</dt><dd>${esc(d.topic || 'не указана')}</dd><dt>Комментарий</dt><dd>${esc(d.comment || '—')}</dd><dt>Учитель</dt><dd>${esc(d.teacher || '—')}</dd>${d.reason ? `<dt>Причина</dt><dd>${esc(d.reason)}${d.note ? ': ' + esc(d.note) : ''}</dd>` : ''}</dl>
  ${mine ? `<form data-form="gd-note" class="mb-form"><label class="fld"><span>Тема урока</span><input name="topic" maxlength="120" value="${esc(d.topic || '')}"></label><label class="fld"><span>Комментарий для ученика и родителей</span><input name="comment" maxlength="300" value="${esc(d.comment || '')}"></label><button class="btn blue" type="submit">Сохранить</button></form>` : ''}
  <h3 class="gd-h">История оценки</h3><ol class="gd-log">${R.log.map(l => `<li><b>${ACT[l.action] || l.action}</b> · ${esc(fmtT(l.at))}<small>${esc(l.who || 'система')}${l.action === 'update' ? ' · ' + diff(l.old, l.new) : ''}</small></li>`).join('')}</ol>`);
}

// ===================== действия =====================
export function onChange(el) {
  const a = el.dataset && el.dataset.act; if (!a) return false;
  if (a === 'rp-year') { RX().year = el.value; rerender(); return true; }
  if (a === 'rp-q') { RX().q = Number(el.value); rerender(); return true; }
  if (a === 'rp-cls') { RX().cls = el.value; rerender(); return true; }
  if (a === 'rp-subj') { RX().subj = el.value; rerender(); return true; }
  if (a === 'past-cls') { PX().cls = el.value; PX().sid = ''; rerender(); return true; }
  if (a === 'past-sid') { PX().sid = el.value; rerender(); return true; }
  if (a === 'past-year') { PX().year = el.value; rerender(); return true; }
  if (a === 'past-set') { const x = PX(); guard(async () => { V.need(await V.call('past_grade_set', { p_sid: x.sid, p_year: x.year || '', p_quarter: Number(el.dataset.q), p_subject: el.dataset.sj, p_value: el.value ? Number(el.value) : null })); delete cache['past:' + x.sid + ':' + (S.isLive() ? 'l' : 'd')]; delete cache['hist:' + x.sid + ':' + (S.isLive() ? 'l' : 'd')]; toast('Сохранено', 'ok'); rerender(); }).then(() => { delete cache['past:' + x.sid + ':' + (S.isLive() ? 'l' : 'd')]; rerender(); }); return true; }
  return false;
}
export async function act(a, el) {
  if (a === 'rp-view') { RX().view = el.dataset.v; rerender(); return true; }
  if (a === 'hist-year') { HX().year = el.dataset.v; rerender(); return true; }
  if (a === 'hist-print') { window.print(); return true; }
  if (a === 'gdetail') { ui.gd = { id: el.dataset.id }; rerender(); return true; }
  if (a === 'gd-close') { delete cache['gd:' + (ui.gd && ui.gd.id)]; ui.gd = null; rerender(); return true; }
  if (a === 'rp-xlsx' || a === 'rp-docx' || a === 'rp-pdf') {
    const x = RX(), year = x.year || T.yearLabel(), key = ['rep', year, x.q, x.cls, x.subj].join('|'), R = cache[key];
    if (!R || R === 'loading' || R.err) return true;
    await guard(async () => { const doc = reportDoc(R), nm = `otchet-${year.replace('/', '-')}-${x.q || 'god'}`;
      if (a === 'rp-pdf') X_.printReport(doc); else if (a === 'rp-xlsx') X_.download(await X_.toXlsx(doc), nm + '.xlsx'); else X_.download(await X_.toDocx(doc), nm + '.docx'); });
    return true;
  }
  return false;
}
export async function submit(f, fd) {
  if (f.dataset.form !== 'gd-note') return false;
  await guard(async () => { V.need(await V.call('grade_note_set', { p_id: ui.gd.id, p_topic: String(fd.get('topic') || ''), p_comment: String(fd.get('comment') || '') }));
    const g = S.state().grades.find(z => z.id === ui.gd.id); if (g) { g.topic = String(fd.get('topic') || '').trim() || null; g.comment = String(fd.get('comment') || '').trim() || null; }
    delete cache['gd:' + ui.gd.id]; toast('Сохранено', 'ok'); rerender(); });
  return true;
}
