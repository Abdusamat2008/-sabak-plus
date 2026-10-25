import * as S from './store.js';
import { t, setLang, getLang, AFFIRMATIONS } from './i18n.js';
import { TYPES, RULES_RU, wavg, finalGrade, fmt1, fmt2, dmy, todayISO, addDays, fiveStreak, sortGrades, mean, trend, isWeekend, gradesNeeded, whatIfTest } from './calc.js';
import { advise, studentReport, subjectReport, isAtRisk, anonymousSummary, achievements } from './ai.js';
import * as Tour from './tour.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const ui = { cls: '9А', subj: 'math', type: 'hw', sheet: null, cloud: {}, lastSave: null, newCode: null, mailOk: false };

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = () => getLang();
const sjName = id => { const s = S.subj(id); return L() === 'ky' ? s.ky : s.ru; };
const typeName = id => TYPES[id] ? (L() === 'ky' ? TYPES[id].ky : TYPES[id].ru) : id;
const hhmm = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFmt = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString(L() === 'ky' ? 'ru-RU' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return d; } };
const first = n => n.split(' ')[0];
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c; };

function toast(msg, kind = '') {
  const el = document.createElement('div'); el.className = 'toast-item ' + kind; el.textContent = msg; $toast.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
}
const chip = g => `<span class="g g${g.value}" title="${esc(typeName(g.type))} · ${dmy(g.date)}">${g.value}</span>`;
function spark(vals, w = 180, h = 44) {
  if (vals.length < 2) return '';
  const min = 1.5, max = 5.5, step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - ((v - min) / (max - min)) * h]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="динамика оценок"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="currentColor"/>`).join('')}</svg>`;
}
const route = () => (location.hash || '').replace(/^#\/?/, '');
const go = r => { location.hash = '#/' + r; };

// ---------- shell ----------
const NAV = {
  student: [['student', 'nav_home', '⌂'], ['student/subjects', 'nav_subjects', '▤'], ['student/schedule', 'nav_schedule', '◷'], ['student/hw', 'nav_hw', '✎'], ['student/ach', 'nav_ach', '★'], ['student/mail', 'nav_mail', '✉']],
  teacher: [['teacher', 'nav_journal', '▤'], ['teacher/class', 'nav_class', '▥'], ['teacher/log', 'nav_log', '↻']],
  parent: [['parent', 'nav_week', '⌂'], ['parent/subjects', 'nav_subjects', '▤']],
  admin: [['admin', 'nav_admin', '✉']],
};

function statusChip() {
  const st = S.state(), p = S.pending(), off = S.isOffline();
  if (off) return `<span class="net off" role="status">● ${t('offline')}${p ? ` · ${p} ${t('queue')}` : ''}</span>`;
  if (p) return `<span class="net sync" role="status">↻ ${p} ${t('queue')}</span>`;
  return `<span class="net on" role="status">● ${t('online')}</span>`;
}

function shell(content) {
  const st = S.state(), u = st.session, r = route();
  const nav = NAV[u.role].map(([href, key, ic]) => `<a href="#/${href}" class="${r === href || (href !== u.role && r.startsWith(href)) ? 'act' : ''}"><span class="ic" aria-hidden="true">${ic}</span><span>${t(key)}</span></a>`).join('');
  return `
  <header class="top">
    <a class="brand" href="#/${u.role}" aria-label="SABAK+">SABAK<b>+</b></a>
    <div class="who"><span class="role">${t('role_' + u.role)}</span><span class="nm">${esc(u.name)}</span></div>
    <div class="tools">
      ${statusChip()}
      <button class="ibtn demo" data-act="tour">▶ Демо</button>
      <select class="roleSel" data-act="role" aria-label="Показать как">${['student', 'parent', 'teacher', 'admin'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${t('role_' + r)}</option>`).join('')}</select>
      <button class="ibtn" data-act="offline-demo" aria-pressed="${st.prefs.offlineDemo}" title="${t('offline_demo')}">${st.prefs.offlineDemo ? '⏻ ' + t('offline_demo') : '⏻'}</button>
      <button class="ibtn" data-act="scale" title="${t('font_size')}" aria-label="${t('font_size')}">Аа</button>
      <button class="ibtn" data-act="contrast" aria-pressed="${st.prefs.contrast}" title="${t('contrast')}" aria-label="${t('contrast')}"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg></button>
      <button class="ibtn" data-act="lang" title="RU / КЫ">${L() === 'ru' ? 'КЫ' : 'RU'}</button>
      <button class="ibtn" data-act="logout">${t('logout')}</button>
    </div>
  </header>
  <nav class="nav" aria-label="Навигация">${nav}</nav>
  <main class="wrap" id="main">${content}</main>
  <footer class="foot"><button class="link" data-act="reset">${t('reset')}</button> · SABAK+ MVP · NEXUS · демо-данные</footer>`;
}

function head(l1, l2, sub) { return `<div class="hd"><h1>${esc(l1)}${l2 ? `<br><span>${esc(l2)}</span>` : ''}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`; }

// ---------- login ----------
function loginView() {
  const roles = [['student', '🎓'], ['parent', '👪'], ['teacher', '📘'], ['admin', '🏫']];
  return `<div class="login">
    <div class="login-top"><button class="ibtn" data-act="lang">${L() === 'ru' ? 'КЫ' : 'RU'}</button></div>
    <div class="hero"><div class="tape">NEXUS · LOGOS HACKATHON 2026</div>
      <h1>SABAK<span>+</span></h1><p class="lead">${t('app_tag')}</p></div>
    <h2 class="pick">${t('pick_role')}</h2>
    <div class="roles">${roles.map(([r, e], i) => `<button class="role-card ${i % 2 ? 'dark' : ''}" data-act="login" data-role="${r}"><span class="em" aria-hidden="true">${e}</span><b>${t('role_' + r)}</b><small>${t('role_' + r + '_d')}</small></button>`).join('')}</div>
    <p class="tourcta"><button class="btn blue" data-act="tour">▶ Демо-сценарий для жюри (2 минуты)</button></p>
    <p class="note">${t('demo_note')}</p>
  </div>`;
}

// ---------- student ----------
const SCHEDULE = {
  1: [['08:30', 'math', '12'], ['09:25', 'rus', '12'], ['10:30', 'phys', '24'], ['11:25', 'eng', '18'], ['12:20', 'hist', '12']],
  2: [['08:30', 'kyr', '14'], ['09:25', 'math', '12'], ['10:30', 'bio', '21'], ['11:25', 'inf', '30'], ['12:20', 'rus', '12']],
  3: [['08:30', 'eng', '18'], ['09:25', 'hist', '12'], ['10:30', 'math', '12'], ['11:25', 'phys', '24'], ['12:20', 'kyr', '14']],
  4: [['08:30', 'inf', '30'], ['09:25', 'bio', '21'], ['10:30', 'rus', '12'], ['11:25', 'math', '12'], ['12:20', 'eng', '18']],
  5: [['08:30', 'phys', '24'], ['09:25', 'kyr', '14'], ['10:30', 'hist', '12'], ['11:25', 'bio', '21'], ['12:20', 'inf', '30']],
};
function lessonsFor(d) { let x = d; while (isWeekend(x)) x = addDays(x, 1); return { date: x, list: SCHEDULE[new Date(x + 'T12:00:00').getDay()] || [] }; }

function sidOfSession() { const u = S.state().session; return u.role === 'parent' ? u.child : u.id; }

function needText(r) {
  if (r.fin == null) return '';
  if (r.fin >= 5) return L() === 'ru' ? 'Максимальный итог — отлично!' : 'Эң жогорку жыйынтык!';
  if (r.need === 0) return '';
  if (r.need == null) return L() === 'ru' ? `До «${r.fin + 1}» пока далеко` : '';
  return L() === 'ru' ? `До «${r.fin + 1}»: ${r.need === 1 ? 'нужна' : 'нужно'} ещё ${r.need} ${plural(r.need, 'пятёрка', 'пятёрки', 'пятёрок')}` : `«${r.fin + 1}» үчүн дагы ${r.need} беш керек`;
}

function studentHome(sid) {
  const st = S.state(), me = st.students.find(s => s.id === sid);
  const rep = studentReport(sid), hw = S.hwFor(sid);
  const overdue = hw.filter(h => !h.done && h.dueDate < todayISO());
  const hrs = new Date().getHours();
  const greet = hrs < 12 ? t('good_morning') : hrs < 18 ? t('good_day') : t('good_evening');
  const weak = [...rep.subs].filter(r => r.fin != null && r.fin < 5 && r.need != null && r.need <= 6).sort((a, b) => a.avg - b.avg).slice(0, 3);
  const events = st.events.filter(e => e.cls === me.cls && e.due >= 0 && e.due <= 2);
  const tomorrow = lessonsFor(todayISO());
  const aff = AFFIRMATIONS[Math.floor(Date.now() / 86400000) % AFFIRMATIONS.length];
  const streak = fiveStreak(S.gradesOf(sid));
  let next = null;
  if (overdue[0]) next = { t: `${sjName(overdue[0].subj)} · ${L() === 'ru' ? 'ДЗ не сдано' : 'үй иши тапшырылган жок'}`, d: overdue[0].title, go: 'student/hw' };
  else if (events[0]) next = { t: `${sjName(events[0].subj)} · ${events[0].kind}`, d: L() === 'ru' ? 'Повтори тему и реши пробный вариант.' : 'Теманы кайталап, сыноо вариантын чыгар.', go: 'student/hw' };
  else if (weak[0]) next = { t: sjName(weak[0].subj), d: needText(weak[0]), go: 'student/subject/' + weak[0].subj };

  return `${head(`${greet}, ${first(me.name)}`, '', dayFmt(todayISO()))}
  <div class="grid2">
    <section class="card">
      <h2 class="tp">${t('today_important')}</h2>
      ${weak.map(r => `<a class="row" href="#/${S.state().session.role === 'parent' ? 'parent' : 'student'}/subject/${r.subj}"><div><b>${sjName(r.subj)}</b><small>${needText(r)}</small></div><div class="big">${fmt1(r.avg)}<small>→ «${r.fin + 1}»</small></div></a>`).join('') || `<p class="muted">${t('all_good')}</p>`}
      ${overdue.length ? `<a class="row warn" href="#/student/hw"><div><b>${t('not_done', { n: overdue.length })}</b><small>${overdue.map(h => sjName(h.subj)).join(', ')}</small></div><div class="big">!</div></a>` : ''}
      ${events.map(e => `<div class="row"><div><b>${e.kind} · ${e.due === 0 ? (L() === 'ru' ? 'сегодня' : 'бүгүн') : e.due === 1 ? (L() === 'ru' ? 'завтра' : 'эртең') : (L() === 'ru' ? 'послезавтра' : 'бүрсүгүнү')}</b><small>${sjName(e.subj)}</small></div><div class="big">⏰</div></div>`).join('')}
    </section>
    <section class="card dark">
      <h2 class="tp">${t('next_step')}</h2>
      ${next ? `<div class="next"><b>${esc(next.t)}</b><p>${esc(next.d)}</p><a class="btn blue" href="#/${next.go}">${t('what_to_do')} →</a></div>` : `<p class="muted">${t('all_good')}</p>`}
      <div class="aff"><small>${t('aff_title')}</small><p>«${esc(aff)}»</p></div>
    </section>
    <section class="card">
      <h2 class="tp">${t('schedule')} · ${tomorrow.date === todayISO() ? t('today') : dayFmt(tomorrow.date)}</h2>
      ${tomorrow.list.map(([tm, s, rm]) => `<div class="row"><div><b>${sjName(s)}</b><small>${L() === 'ru' ? 'каб.' : 'каб.'} ${rm}</small></div><div class="big sm">${tm}</div></div>`).join('')}
    </section>
    <section class="card">
      <h2 class="tp">${t('ach_title')}</h2>
      <div class="ach-mini"><div class="fire">🔥</div><div><b>${streak} / 30</b> <small>${L() === 'ru' ? 'дней подряд с пятёрками' : 'күн удаа беш менен'}</small><div class="bar"><i style="width:${Math.min(100, streak / 30 * 100)}%"></i></div></div></div>
      <a class="btn ghost" href="#/student/ach">${t('nav_ach')} →</a>
    </section>
  </div>`;
}

function subjectsList(sid, base) {
  const rep = studentReport(sid);
  return `${head(t('subjects'), '', RULES_RU)}
  <div class="grid3">${rep.subs.map(r => `<a class="card sj" href="#/${base}/subject/${r.subj}">
     <div class="sj-h"><b>${sjName(r.subj)}</b><span class="big">${fmt1(r.avg)}</span></div>
     <div class="chips">${sortGrades(r.gs).slice(-8).map(chip).join('')}</div>
     <small class="muted">${t('final_')}: «${r.fin}» ${needText(r) ? '· ' + needText(r) : ''}</small>
   </a>`).join('')}</div>`;
}

function subjectDetail(sid, sj, back) {
  const r = subjectReport(sid, sj), a = advise(sid, sj);
  const gs = sortGrades(r.gs);
  return `<a class="back" href="#/${back}">← ${t('subjects')}</a>
  ${head(sjName(sj), '', `${t('avg')}: <b>${fmt2(r.avg)}</b> · ${t('final_')}: <b>«${r.fin ?? '—'}»</b>`)}
  <div class="grid2">
    <section class="card"><h2 class="tp">${L() === 'ru' ? 'Динамика' : 'Динамика'}</h2><div class="sparkwrap">${spark(gs.map(g => g.value), 280, 70)}</div>
      <div class="chips big">${gs.map(chip).join('')}</div>
      <table class="tbl"><tbody>${[...gs].reverse().map(g => `<tr><td>${dmy(g.date)}</td><td>${typeName(g.type)}</td><td>${chip(g)}</td></tr>`).join('')}</tbody></table>
    </section>
    <section class="card dark"><h2 class="tp">${t('how_calc')}</h2>
      <ul class="plain">${a.explain.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${a.facts.length ? `<h3>${t('ai_facts')}</h3><ul class="plain">${a.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </section>
  </div>
  ${whatIf(sid, sj, r)}`;
}

function whatIf(sid, sj, r) {
  if (r.fin == null) return '';
  const targets = [3, 4, 5].filter(x => x > r.fin);
  const w = ui.wi = ui.wi || {};
  const tg = Math.max(w.target || 0, 0) && targets.includes(w.target) ? w.target : targets[0];
  const tv = w.test || 5;
  const wi = whatIfTest(r.gs, tv);
  const n5 = tg ? gradesNeeded(r.gs, tg, 5) : null, n4 = tg ? gradesNeeded(r.gs, tg, 4) : null;
  const fm = n => n == null ? (L() === 'ru' ? 'недостижимо в этой четверти' : '—') : `${n}`;
  return `<section class="card whatif"><h2 class="tp">${L() === 'ru' ? 'А что если?' : 'А эгер...'}</h2>
    <div class="wgrid">
      <div><label>${L() === 'ru' ? 'Хочу итог' : 'Жыйынтык'}<select data-act="wi-target">${targets.map(x => `<option value="${x}" ${x === tg ? 'selected' : ''}>«${x}»</option>`).join('') || '<option>«5»</option>'}</select></label>
        ${tg ? `<p class="res">${L() === 'ru' ? 'Нужно получить подряд' : 'Удаа алуу керек'}: <b>${fm(n5)}</b> ${n5 != null ? L() === 'ru' ? plural(n5, 'пятёрку', 'пятёрки', 'пятёрок') : 'беш' : ''}<br><small>${L() === 'ru' ? 'или' : 'же'} <b>${fm(n4)}</b> ${n4 != null ? L() === 'ru' ? plural(n4, 'четвёрку', 'четвёрки', 'четвёрок') : 'төрт' : ''}</small></p>` : `<p class="res">${L() === 'ru' ? 'Максимальный итог уже достигнут' : 'Эң жогорку жыйынтык'}</p>`}</div>
      <div><label>${L() === 'ru' ? 'Если следующая контрольная будет' : 'Эгер кийинки текшерүү'}<select data-act="wi-test">${[5, 4, 3, 2].map(x => `<option value="${x}" ${x === tv ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <p class="res">${L() === 'ru' ? 'Среднее станет' : 'Орточо'} <b>${fmt2(wi.avg)}</b> → ${L() === 'ru' ? 'итог' : 'жыйынтык'} <b>«${wi.fin}»</b></p></div>
    </div><small>${RULES_RU}</small></section>`;
}

function schedulePage(sid) {
  const days = [1, 2, 3, 4, 5];
  const names = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница' };
  const todayW = new Date().getDay();
  return `${head(t('schedule'), '', '')}<div class="grid3">${days.map(d => `<section class="card ${d === todayW ? 'hl' : ''}"><h2 class="tp">${names[d]}</h2>${SCHEDULE[d].map(([tm, s, rm]) => `<div class="row"><div><b>${sjName(s)}</b><small>каб. ${rm}</small></div><div class="big sm">${tm}</div></div>`).join('')}</section>`).join('')}</div>`;
}

function hwPage(sid, canToggle) {
  const hw = S.hwFor(sid).sort((a, b) => a.dueDate > b.dueDate ? 1 : -1);
  return `${head(t('hw'), '', '')}<div class="card">${hw.map(h => {
    const late = !h.done && h.dueDate < todayISO();
    return `<label class="row hwrow ${late ? 'warn' : ''} ${h.done ? 'ok' : ''}"><input type="checkbox" ${h.done ? 'checked' : ''} ${canToggle ? `data-act="hw" data-hid="${h.id}" data-sid="${sid}"` : 'disabled'}><div><b>${sjName(h.subj)}</b><small>${esc(h.title)}</small></div><div class="big sm">${late ? (L() === 'ru' ? 'просрочено · ' : '') : ''}${dmy(h.dueDate)}</div></label>`;
  }).join('')}</div>`;
}

function achPage(sid) {
  const A = achievements(sid);
  return `${head(t('ach_title'), '', L() === 'ru' ? 'Награды за действия, а не только за оценки' : '')}<div class="grid2">${A.map(a => `<div class="card ach ${a.ok ? 'got' : ''}"><div class="em">${a.e}</div><div><b>${a.n}</b><div class="bar"><i style="width:${a.ok ? 100 : Math.round((a.pct || 0) * 100)}%"></i></div><small>${a.ok ? '✓ получено' : a.p}</small></div></div>`).join('')}</div>`;
}

function mailPage() {
  return `${head(t('mail_title'), '', t('mail_hint'))}
  <form class="card form" data-form="mail">
    <label>${t('mail_cat')}<select name="cat"><option>${t('cat_complaint')}</option><option>${t('cat_grade')}</option><option>${t('cat_idea')}</option><option>${t('cat_other')}</option></select></label>
    <label>${t('mail_text')}<textarea name="text" rows="6" required minlength="5" maxlength="2000"></textarea></label>
    <button class="btn blue" type="submit">${t('mail_send')}</button>
    ${ui.mailOk ? `<p class="okmsg">✓ ${t('mail_ok')}</p>` : ''}
  </form>`;
}

// ---------- teacher ----------
function teacherJournal() {
  const st = S.state(), u = st.session;
  const students = S.studentsOf(ui.cls), today = todayISO();
  const att = st.att[today] || {};
  const typeBtns = Object.keys(TYPES).map(k => `<button class="tag ${ui.type === k ? 'on' : ''}" data-act="type" data-v="${k}">${typeName(k)}${TYPES[k].w > 1 ? ' ×2' : ''}</button>`).join('');
  const rows = students.map(s => {
    const gs = S.gradesOf(s.id, ui.subj), avg = wavg(gs), cur = att[s.id];
    return `<div class="jrow">
      <div class="jn"><b>${esc(s.name)}</b><small>${fmt1(avg)} ${gs.length ? `· ${t('final_')} «${finalGrade(gs)}»` : ''}</small></div>
      <div class="jrecent">${sortGrades(gs).slice(-5).map(chip).join('') || '<small class="muted">—</small>'}</div>
      <div class="jatt" role="group" aria-label="${t('attendance')}">
        <button class="ab p ${cur === 'p' ? 'on' : ''}" data-act="att" data-sid="${s.id}" data-v="p" aria-label="${t('present')} ${esc(s.name)}">✓</button>
        <button class="ab n ${cur === 'n' ? 'on' : ''}" data-act="att" data-sid="${s.id}" data-v="n" aria-label="${t('absent')} ${esc(s.name)}">Н</button>
        <button class="ab l ${cur === 'l' ? 'on' : ''}" data-act="att" data-sid="${s.id}" data-v="l" aria-label="${t('late')} ${esc(s.name)}">⏱</button>
      </div>
      <div class="jgr" role="group" aria-label="Оценка">${[2, 3, 4, 5].map(v => `<button class="gb g${v}" data-act="grade" data-sid="${s.id}" data-v="${v}" aria-label="Поставить ${v}: ${esc(s.name)}">${v}</button>`).join('')}</div>
      <button class="ibtn sm" data-act="sheet" data-sid="${s.id}">${t('details')}</button>
    </div>`;
  }).join('');
  const pend = S.pending(), off = S.isOffline();
  return `${head(t('journal'), `${ui.cls} · ${sjName(ui.subj)}`, '')}
  <div class="ctl">
    <label>${t('cls')}<select data-act="cls">${u.classes.map(c => `<option ${c === ui.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>${t('subject')}<select data-act="subj">${u.subjects.map(s => `<option value="${s}" ${s === ui.subj ? 'selected' : ''}>${sjName(s)}</option>`).join('')}</select></label>
    <button class="ibtn exp" data-act="export">⬇ Excel (CSV)</button>
    <form class="addst" data-form="student"><input name="name" placeholder="${t('student_name')}" required minlength="3" aria-label="${t('student_name')}"><button class="btn" type="submit">+ ${t('add_student')}</button></form>
  </div>
  ${ui.newCode ? `<p class="okmsg">✓ ${esc(ui.newCode.name)} · ${t('code_hint')}: <b>${ui.newCode.code}</b></p>` : ''}
  <div class="reason"><span>${t('reason')}:</span>${typeBtns}</div>
  <div class="jtable">${rows}</div>
  <div class="savebar" role="status"><span class="dot ${off ? 'off' : ''}"></span>
    ${off ? `${t('offline_msg')} · ${pend} ${t('queue')}` : ui.lastSave ? `${t('saved')} · ${hhmm(ui.lastSave)}` : t('saved')}
    <button class="btn light" data-act="undo" ${S.state().undo.length ? '' : 'disabled'}>↶ ${t('undo')}</button></div>
  ${sheetView()}`;
}

function sheetView() {
  if (!ui.sheet) return '';
  const st = S.state(), s = st.students.find(x => x.id === ui.sheet); if (!s) return '';
  const gs = sortGrades(S.gradesOf(s.id, ui.subj)), a = advise(s.id, ui.subj), r = subjectReport(s.id, ui.subj);
  const att = S.attOf(s.id, 10).reverse();
  const key = s.id + ui.subj;
  return `<div class="sheet-bg" data-act="close-sheet"></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.name)}">
    <button class="ibtn close" data-act="close-sheet" aria-label="Закрыть">✕</button>
    <h2>${esc(s.name)}</h2><p class="sub">${s.cls} · ${sjName(ui.subj)} · ${t('avg')} <b>${fmt2(r.avg)}</b> · ${t('final_')} <b>«${r.fin ?? '—'}»</b></p>
    <div class="sparkwrap">${spark(gs.map(g => g.value), 300, 60)}</div>
    <div class="chips big">${gs.map(chip).join('')}</div>
    <div class="attline">${att.map(x => `<i class="a ${x.v || 'x'}" title="${dmy(x.date)}"></i>`).join('')}<small>${t('attendance')} · 10 ${L() === 'ru' ? 'дн.' : 'күн'}</small></div>
    <div class="ai"><div class="ai-h"><b>${t('ai_title')}</b><span class="tape sm">AI</span></div>
      <p class="ai-note">${t('ai_note')}</p>
      <h4>${t('ai_explain')}</h4><ul class="plain">${a.explain.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${a.facts.length ? `<h4>${t('ai_facts')}</h4><ul class="plain">${a.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${a.warnings.length ? `<h4 class="w">${t('ai_warn')}</h4><ul class="plain w">${a.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h4>${t('ai_recs')}</h4><ul class="plain">${a.recs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn blue" data-act="cloud" data-sid="${s.id}">${t('ai_cloud')}</button>
      <div class="cloud" id="cloud-out">${ui.cloud[key] ? esc(ui.cloud[key]) : ''}</div>
    </div></aside>`;
}

function teacherClass() {
  const students = S.studentsOf(ui.cls), today = todayISO(), att = S.state().att[today] || {};
  const fins = students.map(s => finalGrade(S.gradesOf(s.id, ui.subj))).filter(x => x != null);
  const avgs = students.map(s => wavg(S.gradesOf(s.id, ui.subj))).filter(x => x != null);
  const dist = [2, 3, 4, 5].map(v => ({ v, n: fins.filter(f => f === v).length }));
  const maxn = Math.max(1, ...dist.map(d => d.n));
  const marked = students.filter(s => att[s.id]).length, pres = students.filter(s => att[s.id] === 'p' || att[s.id] === 'l').length;
  const risk = students.filter(s => isAtRisk(s.id));
  const u = S.state().session;
  return `${head(t('class_summary'), `${ui.cls} · ${sjName(ui.subj)}`, '')}
  <div class="ctl"><label>${t('cls')}<select data-act="cls">${u.classes.map(c => `<option ${c === ui.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label>${t('subject')}<select data-act="subj">${u.subjects.map(s => `<option value="${s}" ${s === ui.subj ? 'selected' : ''}>${sjName(s)}</option>`).join('')}</select></label></div>
  <div class="kpis"><div class="kpi"><small>${t('class_avg')}</small><b>${fmt2(mean(avgs))}</b></div>
   <div class="kpi"><small>${t('att_today')}</small><b>${marked ? Math.round(pres / marked * 100) + '%' : '—'}</b><small>${marked}/${students.length} ${L() === 'ru' ? 'отмечено' : 'белгиленди'}</small></div>
   <div class="kpi ${risk.length ? 'alert' : ''}"><small>${t('at_risk')}</small><b>${risk.length}</b></div></div>
  <div class="grid2"><section class="card"><h2 class="tp">${t('dist')}</h2>${dist.map(d => `<div class="hbar"><span class="g g${d.v}">${d.v}</span><div class="bar"><i class="c${d.v}" style="width:${d.n / maxn * 100}%"></i></div><b>${d.n}</b></div>`).join('')}</section>
  <section class="card"><h2 class="tp">${t('at_risk')}</h2>${risk.map(s => { const r = studentReport(s.id); const why = [r.weak[0] ? `${sjName(r.weak[0].subj)} ${fmt1(r.weak[0].avg)}` : '', r.dropping[0] ? `↓ ${sjName(r.dropping[0].subj)}` : '', r.abs >= 3 ? `${r.abs} ${L() === 'ru' ? 'пропуска' : 'өткөрүү'}` : ''].filter(Boolean).join(' · '); return `<div class="row"><div><b>${esc(s.name)}</b><small>${esc(why)}</small></div><button class="ibtn sm" data-act="sheet-go" data-sid="${s.id}">${t('details')}</button></div>`; }).join('') || `<p class="muted">${t('all_good')}</p>`}</section></div>
  ${sheetView()}`;
}

function logPage() {
  const log = S.state().log;
  return `${head(t('log_title'), '', '')}<div class="card">${log.map(l => `<div class="row"><div><b>${esc(l.text)}</b><small>${esc(l.who)}</small></div><div class="big sm">${hhmm(l.ts)}</div></div>`).join('') || `<p class="muted">${t('log_empty')}</p>`}</div>`;
}

// ---------- parent ----------
function parentWeek() {
  const st = S.state(), sid = st.session.child, me = st.students.find(s => s.id === sid);
  const since = addDays(todayISO(), -7);
  const gs = sortGrades(S.gradesOf(sid)).filter(g => g.date > since);
  const rep = studentReport(sid);
  const att = S.attOf(sid, 5).filter(a => a.v === 'n').length;
  const overdue = S.hwFor(sid).filter(h => !h.done && h.dueDate < todayISO());
  const sig = rep.dropping[0];
  const attn = !!sig || overdue.length >= 2 || att >= 2;
  return `${head(t('week_title'), first(me.name), `${me.cls}`)}
  <div class="status ${attn ? 'attn' : 'ok'}"><b>${attn ? '⚠ ' + t('week_attn') : '✓ ' + t('week_ok')}</b></div>
  <div class="kpis"><div class="kpi"><small>${t('new_grades')}</small><b>${gs.length}</b></div><div class="kpi ${att ? 'alert' : ''}"><small>${t('absences')}</small><b>${att}</b></div><div class="kpi ${overdue.length ? 'alert' : ''}"><small>${t('overdue')}</small><b>${overdue.length}</b></div></div>
  <div class="grid2">
   <section class="card ${sig ? 'dark' : ''}"><h2 class="tp">${t('digest')}</h2>
     ${sig ? `<div class="sig"><b>${t('sig_drop', { s: sjName(sig.subj) })}</b><p>${L() === 'ru' ? 'Последние оценки заметно ниже предыдущих. Лучше обсудить это сегодня.' : ''}</p><div class="btns"><button class="btn blue" data-act="contact">${t('contact_teacher')}</button><a class="btn light" href="#/parent/subject/${sig.subj}">${t('open_subject')}</a></div></div>` : `<p class="muted">${t('all_good')}</p>`}
     ${overdue.map(h => `<div class="row warn"><div><b>${sjName(h.subj)}</b><small>${esc(h.title)}</small></div><div class="big sm">${dmy(h.dueDate)}</div></div>`).join('')}
   </section>
   <section class="card"><h2 class="tp">${t('new_grades')}</h2>${[...gs].reverse().map(g => `<div class="row"><div><b>${sjName(g.subj)}</b><small>${typeName(g.type)} · ${dmy(g.date)}</small></div>${chip(g)}</div>`).join('') || `<p class="muted">—</p>`}</section>
  </div>`;
}

// ---------- admin ----------
function adminPage() {
  const st = S.state();
  const risk = st.students.filter(s => isAtRisk(s.id));
  return `${head(t('admin_title'), '', '')}
  <div class="grid2"><section class="card"><h2 class="tp">${t('nav_admin')} (${st.mail.filter(m => !m.read).length} ${L() === 'ru' ? 'новых' : 'жаңы'})</h2>
   ${st.mail.map(m => `<div class="mail ${m.read ? 'read' : ''}"><div class="mh"><span class="tag on">${esc(m.cat)}</span><small>${new Date(m.ts).toLocaleString('ru-RU')}</small></div><p>${esc(m.text)}</p>${m.read ? '' : `<button class="ibtn sm" data-act="mailread" data-id="${m.id}">${t('mark_read')}</button>`}</div>`).join('') || `<p class="muted">${t('admin_empty')}</p>`}</section>
   <section class="card"><h2 class="tp">${t('school_risk')} (${risk.length})</h2>${risk.map(s => `<div class="row"><div><b>${esc(s.name)}</b><small>${s.cls}</small></div></div>`).join('')}</section></div>`;
}

// ---------- router ----------
function view() {
  const st = S.state(), u = st.session, r = route();
  if (!u) return loginView();
  if (!r.startsWith(u.role)) { go(u.role); return ''; }
  const sub = r.split('/');
  switch (u.role) {
    case 'student': {
      const sid = u.id;
      if (sub[1] === 'subjects') return subjectsList(sid, 'student');
      if (sub[1] === 'subject') return subjectDetail(sid, sub[2], 'student/subjects');
      if (sub[1] === 'schedule') return schedulePage(sid);
      if (sub[1] === 'hw') return hwPage(sid, true);
      if (sub[1] === 'ach') return achPage(sid);
      if (sub[1] === 'mail') return mailPage();
      return studentHome(sid);
    }
    case 'parent': {
      if (sub[1] === 'subjects') return subjectsList(u.child, 'parent');
      if (sub[1] === 'subject') return subjectDetail(u.child, sub[2], 'parent/subjects');
      return parentWeek();
    }
    case 'teacher': {
      if (sub[1] === 'class') return teacherClass();
      if (sub[1] === 'log') return logPage();
      return teacherJournal();
    }
    case 'admin': return adminPage();
  }
  return '';
}

function render() {
  const st = S.state();
  setLang(st.prefs.lang);
  document.documentElement.style.fontSize = (st.prefs.scale * 100) + '%';
  document.body.classList.toggle('hc', !!st.prefs.contrast);
  const v = view();
  if (v === '') return;
  if (st.session && st.session.role === 'student') {
    const ach = achievements(st.session.id), ok = ach.filter(a => a.ok).map(a => a.id);
    const fresh = S.claimAchievements(st.session.id, ok);
    fresh.forEach(id => { const a = ach.find(x => x.id === id); setTimeout(() => toast(`🏆 ${a.e} ${a.n}`, 'ok'), 350); });
  }
  const y = window.scrollY;
  const sheetScroll = document.querySelector('.sheet') ? document.querySelector('.sheet').scrollTop : 0;
  $app.innerHTML = st.session ? shell(v) : v;
  window.scrollTo(0, y);
  const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = sheetScroll;
}

// ---------- экспорт ----------
function exportCsv() {
  const students = S.studentsOf(ui.cls), today = todayISO(), att = S.state().att[today] || {};
  const rows = [['ФИО', 'Класс', 'Предмет', 'Оценки (дата:значение:за что)', 'Среднее', 'Итог', 'Посещаемость сегодня']];
  students.forEach(s => {
    const gs = S.gradesOf(s.id, ui.subj);
    rows.push([s.name, s.cls, S.subj(ui.subj).ru, gs.map(g => `${dmy(g.date)}:${g.value}:${TYPES[g.type] ? TYPES[g.type].ru : g.type}`).join(' | '), gs.length ? fmt2(wavg(gs)) : '', gs.length ? finalGrade(gs) : '', { p: 'был', n: 'Н', l: 'опоздал' }[att[s.id]] || '']);
  });
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `sabak_${ui.cls}_${ui.subj}_${todayISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('CSV ✓', 'ok');
}

// ---------- sync ----------
let flushTimer = null;
function scheduleFlush() {
  clearTimeout(flushTimer);
  if (S.isOffline() || !S.pending()) return;
  flushTimer = setTimeout(() => { if (!S.isOffline()) { const n = S.flushQueue(); if (n) toast(`${t('synced')}: ${n}`, 'ok'); } }, 1100);
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, st = S.state();
  if (['cls', 'subj', 'role', 'wi-target', 'wi-test'].includes(act)) return; // обрабатываются на change
  if (act === 'tour') { Tour.start(); return; }
  if (act === 'export') { exportCsv(); return; }
  if (act === 'login') { S.login(el.dataset.role); go(el.dataset.role); return; }
  if (act === 'logout') { S.logout(); location.hash = ''; return; }
  if (act === 'lang') { S.setPrefs({ lang: st.prefs.lang === 'ru' ? 'ky' : 'ru' }); return; }
  if (act === 'scale') { S.setPrefs({ scale: st.prefs.scale >= 1.5 ? 1 : st.prefs.scale + 0.25 }); return; }
  if (act === 'contrast') { S.setPrefs({ contrast: !st.prefs.contrast }); return; }
  if (act === 'offline-demo') {
    const off = !st.prefs.offlineDemo; S.setPrefs({ offlineDemo: off });
    toast(off ? t('offline_msg') : t('online'), off ? 'warn' : 'ok'); scheduleFlush(); return;
  }
  if (act === 'reset') { if (confirm(t('reset_q'))) { S.resetDemo(); ui.sheet = null; toast('OK'); } return; }
  if (act === 'type') { ui.type = el.dataset.v; render(); return; }
  if (act === 'grade') {
    const sid = el.dataset.sid; S.addGrade({ sid, subj: ui.subj, value: Number(el.dataset.v), type: ui.type });
    ui.lastSave = Date.now(); render(); scheduleFlush(); return;
  }
  if (act === 'att') {
    const cur = (st.att[todayISO()] || {})[el.dataset.sid]; if (cur === el.dataset.v) return;
    S.setAttendance(el.dataset.sid, todayISO(), el.dataset.v); ui.lastSave = Date.now(); render(); scheduleFlush(); return;
  }
  if (act === 'undo') { if (S.undoLast()) { ui.lastSave = Date.now(); toast('↶ ' + t('undo')); scheduleFlush(); } return; }
  if (act === 'sheet') { ui.sheet = el.dataset.sid; render(); return; }
  if (act === 'sheet-go') { ui.pendingSheet = el.dataset.sid; go('teacher'); return; }
  if (act === 'close-sheet') { ui.sheet = null; render(); return; }
  if (act === 'hw') { S.toggleHw(el.dataset.hid, el.dataset.sid); return; }
  if (act === 'mailread') { S.markMailRead(el.dataset.id); return; }
  if (act === 'contact') { toast(L() === 'ru' ? 'Сообщение учителю отправлено (демо)' : 'Мугалимге билдирүү жөнөтүлдү (демо)', 'ok'); return; }
  if (act === 'cloud') {
    const out = document.getElementById('cloud-out'), key = el.dataset.sid + ui.subj;
    out.textContent = '…';
    try {
      const res = await fetch('/api/advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(anonymousSummary(el.dataset.sid, ui.subj)) });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json(); ui.cloud[key] = j.text || t('ai_cloud_off');
    } catch { ui.cloud[key] = t('ai_cloud_off'); }
    out.textContent = ui.cloud[key]; return;
  }
});
document.addEventListener('change', e => {
  const el = e.target.closest('select[data-act]'); if (!el) return;
  if (el.dataset.act === 'role') { S.login(el.value); go(el.value); return; }
  if (el.dataset.act === 'wi-target') { (ui.wi = ui.wi || {}).target = Number(el.value); render(); return; }
  if (el.dataset.act === 'wi-test') { (ui.wi = ui.wi || {}).test = Number(el.value); render(); return; }
  if (el.dataset.act === 'cls') ui.cls = el.value;
  if (el.dataset.act === 'subj') ui.subj = el.value;
  render();
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const fd = new FormData(f);
  if (f.dataset.form === 'mail') { S.sendMail(fd.get('cat'), String(fd.get('text')).trim()); ui.mailOk = true; render(); setTimeout(() => { ui.mailOk = false; }, 100); toast(t('mail_ok'), 'ok'); }
  if (f.dataset.form === 'student') { const name = String(fd.get('name')).trim(); const r = S.addStudent(name, ui.cls); ui.newCode = { name, code: r.code }; ui.lastSave = Date.now(); render(); scheduleFlush(); }
});
window.addEventListener('hashchange', () => { ui.sheet = ui.pendingSheet || null; ui.pendingSheet = null; ui.mailOk = false; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { render(); scheduleFlush(); });
window.addEventListener('offline', () => { render(); toast(t('offline_msg'), 'warn'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); } });

// ---------- start ----------
S.load();
Tour.init({ S, ui, go, render, scheduleFlush });
S.on(() => render());
setLang(S.state().prefs.lang);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
window.__sabak = { S, ui };
