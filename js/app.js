import * as S from './store.js';
import { t, setLang, getLang, AFFIRMATIONS } from './i18n.js';
import * as Ky from './ky.js';
import * as Privacy from './privacy.js';
import { TYPES, RULES_RU, wavg, finalGrade, fmt1, fmt2, dmy, todayISO, addDays, fiveStreak, sortGrades, mean, trend, isWeekend, gradesNeeded, whatIfTest } from './calc.js';
import { advise, studentReport, subjectReport, isAtRisk, anonymousSummary, achievements } from './ai.js';
import * as Tour from './tour.js';
import * as A11y from './a11y.js';
import * as Net from './net.js';
import * as API from './api.js';
import { esc, ui, L, sjName, typeName, hhmm, first, plural, route, go, chip, toast, head, avatar, ROLE_RU, downloadBlob } from './common.js';
import * as Auth from './auth.js';
import * as People from './people.js';
import * as Admin from './admin.js';
import * as Sched from './schedui.js';

const $app = document.getElementById('app');
const dayFmt = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return d; } };
function spark(vals, w = 180, h = 44) {
  if (vals.length < 2) return '';
  const min = 1.5, max = 5.5, step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - ((v - min) / (max - min)) * h]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="динамика оценок"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="currentColor"/>`).join('')}</svg>`;
}

// ---------- shell ----------
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12l3 3 5-6"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.500-6s6 2 6.500 6M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500c2 .8 3.200 2.700 3.500 5.500"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/>', file: '<path d="M6 3h8l5 5v13H6zM14 3v5h5"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
};
const ico = n => `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const NAV = {
  student: [['student', 'nav_home', 'home'], ['student/subjects', 'nav_subjects', 'book'], ['student/schedule', 'nav_schedule', 'cal'], ['student/hw', 'nav_hw', 'check'], ['student/ach', 'nav_ach', 'star'], ['student/mail', 'nav_mail', 'mail']],
  teacher: [['teacher', 'nav_journal', 'book'], ['teacher/class', 'nav_class', 'chart'], ['teacher/schedule', 'nav_schedule', 'cal'], ['teacher/students', 'Ученики', 'users'], ['teacher/log', 'nav_log', 'list']],
  parent: [['parent', 'nav_week', 'home'], ['parent/subjects', 'nav_subjects', 'book'], ['parent/schedule', 'nav_schedule', 'cal'], ['parent/dossier', 'Дело', 'file']],
  admin: [['admin', 'Обзор', 'chart'], ['admin/schedule', 'Расписание', 'cal'], ['admin/teachers', 'Педагоги', 'users'], ['admin/students', 'Ученики', 'user'], ['admin/access', 'Доступ', 'shield'], ['admin/mail', 'Обращения', 'mail']],
};
const navLabel = k => (k.startsWith('nav_') ? t(k) : k);
const isActive = (href, r, role) => r === href || (href !== role && r.startsWith(href + '/')) || (href === 'admin' && r.startsWith('admin/audit')) || (href === 'parent/dossier' && r.startsWith('dossier'));

function netPill() {
  const p = S.pending(), off = S.isOffline();
  if (off) return `<span class="net off" role="status" title="${t('offline_msg')}"><i></i>${t('offline')}${p ? ` · ${p}` : ''}</span>`;
  if (p) return `<span class="net sync" role="status"><i></i>↻ ${p}</span>`;
  return `<span class="net on" role="status" title="${t('online')}"><i></i><span class="net-t">${t('online')}</span></span>`;
}

function shell(content) {
  const st = S.state(), u = st.session, r = route();
  const unread = S.myNotifs().filter(n => !n.read).length;
  const items = NAV[u.role].map(([href, key, ic]) => `<a href="#/${href}" class="${isActive(href, r, u.role) ? 'act' : ''}">${ico(ic)}<span>${navLabel(key)}</span></a>`).join('');
  const me = S.state().students.find(s => s.id === u.id);
  return `
  <header class="top">
    <a class="brand" href="#/${u.role}" aria-label="SABAK+">SABAK<b>+</b></a>
    <nav class="nav" aria-label="Навигация">${items}</nav>
    <div class="tools">
      ${netPill()}
      <button class="ibtn" data-act="a11y" aria-label="Специальные возможности" title="Специальные возможности (Alt+A)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M4 8.5l8 1.5 8-1.5M12 10v5M12 15l-3.5 6M12 15l3.5 6"/></svg></button>
      <a class="ibtn bell ${unread ? 'has-new' : ''}" href="#/notifs" aria-label="Уведомления${unread ? ': ' + unread : ''}">${ico('bell')}${unread ? `<b class="cnt">${unread}</b>` : ''}</a>
      <div class="usr">
        <button class="usr-b" data-act="menu" aria-haspopup="true" aria-expanded="${ui.menu}">${u.role === 'student' && me ? avatar(me, 32) : `<span class="av ini sm" style="width:32px;height:32px;border-color:var(--blue);color:var(--blue)">${esc((u.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span>`}<span class="usr-n"><b>${esc(first(u.name))}</b><small>${esc(u.level ? ROLE_RU[u.level] : t('role_' + u.role))}</small></span><span class="car" aria-hidden="true">▾</span></button>
        ${ui.menu ? `<div class="menu" role="menu"><div class="mh2"><b>${esc(u.name)}</b><small>${esc(u.level ? ROLE_RU[u.level] : t('role_' + u.role))}${st.school ? ' · ' + esc(st.school.name) : ''}</small></div>
          ${S.isLive() ? '' : `<label class="mi">Показать как<select class="roleSel" data-act="role" aria-label="Показать как">${[['student', 'Ученик'], ['parent', 'Родитель'], ['teacher', 'Учитель'], ['admin', 'Директор'], ['deputy', 'Завуч']].map(([x, n]) => `<option value="${x}" ${(x === u.role || (u.level === 'deputy' && x === 'deputy') && true) && !(x === 'admin' && u.level === 'deputy') ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="mi" data-act="tour">▶ Демо-сценарий</button>`}
          <button class="mi" data-act="a11y">Специальные возможности <b>Alt+A</b></button>
          <button class="mi" data-act="privacy">Политика данных</button>
          <button class="mi" data-act="lang">Язык: <b>${L() === 'ru' ? 'Русский → Кыргызча' : 'Кыргызча → Русский'}</b></button>
          ${u.role === 'admin' ? '<a class="mi" href="#/admin/audit">Журнал аудита</a>' : ''}
          <button class="mi out" data-act="logout">${t('logout')}</button></div>` : ''}
      </div>
    </div>
  </header>
  <main class="wrap" id="main">${S.isLive() && S.failed().length ? `<div class="banner warn"><div><b>Часть изменений не принята сервером</b><p>${esc(S.failed()[0].text)}: ${esc(S.failed()[0].error)}</p></div><button class="btn sm ghost" data-act="clear-failed">Понятно</button></div>` : ''}${content}</main>
  <footer class="foot">${S.isLive() ? `SABAK+ · ${esc(st.school ? st.school.name : '')}` : `<button class="link" data-act="reset">${t('reset')}</button> · <button class="link" data-act="to-live">Войти в настоящий аккаунт</button> · SABAK+ · демо-данные`}</footer>
  ${People.photoModal()}`;
}

// ---------- student ----------
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
  const tomorrow = S.lessonsOn(me.cls, todayISO());
  const aff = AFFIRMATIONS[Math.floor(Date.now() / 86400000) % AFFIRMATIONS.length];
  const streak = fiveStreak(S.gradesOf(sid));
  let next = null;
  if (overdue[0]) next = { t: `${sjName(overdue[0].subj)} · ${L() === 'ru' ? 'ДЗ не сдано' : 'үй иши тапшырылган жок'}`, d: overdue[0].title, go: 'student/hw' };
  else if (events[0]) next = { t: `${sjName(events[0].subj)} · ${events[0].kind}`, d: L() === 'ru' ? 'Повтори тему и реши пробный вариант.' : 'Теманы кайталап, сыноо вариантын чыгар.', go: 'student/hw' };
  else if (weak[0]) next = { t: sjName(weak[0].subj), d: needText(weak[0]), go: 'student/subject/' + weak[0].subj };

  return `${People.photoBanner()}${head(`${greet}, ${first(me.name)}`, '', dayFmt(todayISO()), `<button class="ibtn" data-act="photo-open" data-sid="${sid}">${avatar(me, 28)} Моё фото</button>`)}
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
      ${tomorrow.list.map(l => `<div class="row"><div><b>${sjName(l.s)}</b><small>${l.r ? 'каб. ' + esc(l.r) : ''}</small></div><div class="big sm">${l.time ? l.time.s : ''}</div></div>`).join('') || `<p class="muted">${tomorrow.none ? 'Расписание ещё не опубликовано' : 'Занятий нет'}</p>`}
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

function hwPage(sid, canToggle) {
  const hw = S.hwFor(sid).sort((a, b) => a.dueDate > b.dueDate ? 1 : -1);
  return `${head(t('hw'), '', '')}<div class="card">${hw.map(h => {
    const late = !h.done && h.dueDate < todayISO();
    return `<label class="row hwrow ${late ? 'warn' : ''} ${h.done ? 'ok' : ''}"><input type="checkbox" ${h.done ? 'checked' : ''} ${canToggle ? `data-act="hw" data-hid="${h.id}" data-sid="${sid}"` : 'disabled'}><div><b>${sjName(h.subj)}</b><small>${esc(h.title)}</small></div><div class="big sm">${late ? (L() === 'ru' ? 'просрочено · ' : '') : ''}${dmy(h.dueDate)}</div></label>`;
  }).join('')}</div>`;
}

function achPage(sid) {
  const A = achievements(sid), got = A.filter(a => a.ok), earned = (S.state().ach[sid]) || {};
  const cats = [...new Set(A.map(a => a.cat))], fresh = new Set(ui.freshAch || []);
  const demoBtn = S.isLive() ? '' : `<div class="card deco"><b>Демо для жюри</b><p class="muted">Система следит за поведением ученика сама. Нажмите — и она «увидит» 30 учебных дней без «Н», выдаст достижение и отправит уведомление ученику и родителю.</p><button class="btn blue" data-act="ach-demo" data-sid="${sid}">▶ Смоделировать 30 дней без «Н»</button></div>`;
  return `${head(t('ach_title'), '', `Получено ${got.length} из ${A.length}. Награды выдаёт система сама — по оценкам, посещаемости и заданиям`)}
  ${cats.map(c => `<h2 class="tp" style="margin:18px 0 10px">${esc(c)}</h2><div class="grid2">${A.filter(a => a.cat === c).map(a => `<div class="card ach ${a.ok ? 'got' : ''} ${fresh.has(a.id) ? 'fresh' : ''}"><div class="em">${a.e}</div><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small><div class="bar" role="progressbar" aria-valuenow="${Math.round(a.pct * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(a.n)}"><i style="width:${Math.round(a.pct * 100)}%"></i></div><small>${a.ok ? '✓ получено' + (earned[a.id] ? ' ' + dmy(new Date(earned[a.id]).toISOString().slice(0, 10)) : '') : 'Прогресс: ' + a.p}</small></div></div>`).join('')}</div>`).join('')}
  ${demoBtn}`;
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
      <div class="jn jn-av">${avatar(s, 38)}<div><b>${esc(s.name)}</b><small>${fmt1(avg)} ${gs.length ? `· ${t('final_')} «${finalGrade(gs)}»` : ''}</small></div></div>
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
  return `${head(t('journal'), `${ui.cls} · ${sjName(ui.subj)}`, '', saveTool(off, pend))}
  <div class="ctl">
    <label>${t('cls')}<select data-act="cls">${u.classes.map(c => `<option ${c === ui.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>${t('subject')}<select data-act="subj">${u.subjects.map(s => `<option value="${s}" ${s === ui.subj ? 'selected' : ''}>${sjName(s)}</option>`).join('')}</select></label>
    <button class="ibtn exp" data-act="export-xlsx" data-kind="class" data-cls="${ui.cls}">⬇ Excel</button><button class="ibtn exp" data-act="export-docx" data-kind="class" data-cls="${ui.cls}">Word</button><button class="ibtn exp" data-act="export-pdf" data-kind="class" data-cls="${ui.cls}">PDF</button>
    <form class="addst" data-form="student"><input name="name" placeholder="${t('student_name')}" required minlength="3" aria-label="${t('student_name')}"><button class="btn" type="submit">+ ${t('add_student')}</button></form>
  </div>
  ${ui.newCode ? `<p class="okmsg">✓ ${esc(ui.newCode.name)} добавлен(а)${ui.newCode.code ? ` · ${t('code_hint')}: <b>${ui.newCode.code}</b>` : ' · код появится после синхронизации (раздел «Ученики»)'}</p>` : ''}
  <div class="reason"><span>${t('reason')}:</span>${typeBtns}</div>
  <div class="jtable">${rows}</div>
  ${sheetView()}`;
}

function saveTool(off, pend) {
  const st = S.state();
  return `<div class="savetool" role="status" aria-live="polite"><span class="sv ${off ? 'off' : ''}"><i></i>${off ? `${t('offline_msg')} · ${pend}` : ui.lastSave ? `${t('saved')} · ${hhmm(ui.lastSave)}` : t('saved')}</span><button class="ibtn undo" data-act="undo" ${st.undo.length ? '' : 'disabled'}>↶ ${t('undo')}</button></div>`;
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
function kidPicker() {
  const u = S.state().session; if (!u.children || u.children.length < 2) return '';
  return `<div class="kids">${u.children.map(id => { const k = S.student(id); return `<button class="tag ${id === u.child ? 'on' : ''}" data-act="kid" data-id="${id}">${esc(first(k.name))}</button>`; }).join('')}</div>`;
}
function parentWeek() {
  const st = S.state(), sid = st.session.child, me = st.students.find(s => s.id === sid);
  const since = addDays(todayISO(), -7);
  const gs = sortGrades(S.gradesOf(sid)).filter(g => g.date > since);
  const rep = studentReport(sid);
  const att = S.attOf(sid, 5).filter(a => a.v === 'n').length;
  const overdue = S.hwFor(sid).filter(h => !h.done && h.dueDate < todayISO());
  const sig = rep.dropping[0];
  const attn = !!sig || overdue.length >= 2 || att >= 2;
  return `${People.photoBanner()}${kidPicker()}${head(t('week_title'), first(me.name), `${me.cls}`, `<a class="btn sm ghost" href="#/dossier/${sid}">Дело ученика</a><button class="btn sm ghost" data-act="photo-open" data-sid="${sid}">Фото профиля</button>`)}
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

// ---------- router ----------
const empty = (title, text) => `<div class="card lock"><div class="big-ic">🕓</div><h2>${title}</h2><p>${text}</p></div>`;
function demoPicker() {
  const roles = [['student', '🎓'], ['parent', '👪'], ['teacher', '📘'], ['admin', '🏫']];
  return `<div class="auth"><div class="auth-top"><button class="ibtn" data-act="lang">${L() === 'ru' ? 'КЫ' : 'RU'}</button></div><div class="auth-grid"><aside class="auth-side"><div class="tape">ДЕМО-РЕЖИМ</div><h1>SABAK<span>+</span></h1><p class="lead">${t('app_tag')}</p><p class="note">Данные демо хранятся только в вашем браузере. Настоящая работа школы — после входа по приглашению.</p></aside>
    <div class="auth-main"><div class="auth-card wide-card"><h2>${t('pick_role')}</h2><div class="roles">${roles.map(([r, e], i) => `<button class="role-card ${i % 2 ? 'dark' : ''}" data-act="login" data-role="${r}"><span class="em" aria-hidden="true">${e}</span><b>${t('role_' + r)}</b><small>${t('role_' + r + '_d')}</small></button>`).join('')}</div>
    <p class="tourcta"><button class="btn blue" data-act="tour">▶ Демо-сценарий для жюри (2 минуты)</button></p><p class="alt"><button class="link" data-act="demo-back">← Ко входу</button></p></div></div></div></div>`;
}
function view() {
  const st = S.state(), u = st.session, r = route();
  if (!u || u.needsProfile || (u.status && u.status !== 'active') || (ui.auth && ui.auth.mode === 'recover-set')) {
    if (!S.isLive() && ui.demoPick && !u) return demoPicker();
    return Auth.authView();
  }
  if (r === 'notifs') return People.notifsPage();
  if (r.startsWith('dossier/')) return People.dossierView(r.split('/')[1]);
  const sub = r.split('/');
  if (!r.startsWith(u.role)) { go(u.role); return ''; }
  switch (u.role) {
    case 'student': {
      const sid = u.id;
      if (S.isLive() && !S.student(sid)) return empty('Профиль ещё не привязан', 'Ваш аккаунт не связан с записью ученика. Попросите классного руководителя выдать новый код.');
      if (sub[1] === 'subjects') return subjectsList(sid, 'student');
      if (sub[1] === 'subject') return subjectDetail(sid, sub[2], 'student/subjects');
      if (sub[1] === 'schedule') return Sched.studentPage(sid);
      if (sub[1] === 'hw') return hwPage(sid, true);
      if (sub[1] === 'ach') return achPage(sid);
      if (sub[1] === 'mail') return mailPage();
      return studentHome(sid);
    }
    case 'parent': {
      if (!u.child) return empty('Ребёнок не привязан', 'К вашему аккаунту пока не привязан ученик. Используйте код родителя от классного руководителя.');
      if (sub[1] === 'dossier') { go('dossier/' + u.child); return ''; }
      if (sub[1] === 'schedule') return kidPicker() + Sched.studentPage(u.child);
      if (sub[1] === 'subjects') return kidPicker() + subjectsList(u.child, 'parent');
      if (sub[1] === 'subject') return subjectDetail(u.child, sub[2], 'parent/subjects');
      return parentWeek();
    }
    case 'teacher': {
      if (sub[1] === 'schedule') return Sched.teacherPage();
      if (!(u.classes || []).length) return empty('Классы пока не назначены', 'Администрация ещё не назначила вам классы и предметы. Как только это произойдёт, журнал появится здесь.');
      if (!u.classes.includes(ui.cls)) ui.cls = u.classes[0];
      if (!u.subjects.includes(ui.subj)) ui.subj = u.subjects[0] || ui.subj;
      if (sub[1] === 'students') return People.studentsPage();
      if (sub[1] === 'schedule') return Sched.teacherPage();
      if (sub[1] === 'class') return teacherClass();
      if (sub[1] === 'log') return logPage();
      return teacherJournal();
    }
    case 'admin': {
      if (sub[1] === 'schedule') return Sched.adminPage();
      if (sub[1] === 'teachers') return Admin.teachersPage();
      if (sub[1] === 'students') return People.studentsPage();
      if (sub[1] === 'access') return Admin.accessPage();
      if (sub[1] === 'mail') return Admin.mailPage();
      if (sub[1] === 'audit') return Admin.auditPage();
      return Admin.overview();
    }
  }
  return '';
}

const isTyping = () => { const a = document.activeElement; return !!a && $app.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'submit'].includes(a.type))); };
let lastRoute = null;
function render() {
  const st = S.state();
  setLang(st.prefs.lang);
  A11y.apply(st.prefs);
  const v = view();
  if (v === '') return;
  if (st.session && st.session.role === 'student' && st.session.status !== 'pending' && st.session.id) {
    const sid = st.session.id, ids = S.unseenAch(sid);
    if (ids.length) {
      S.markSeenAch(sid, ids); ui.freshAch = ids;
      const ach = achievements(sid);
      ids.forEach((id, i) => { const a = ach.find(x => x.id === id); if (a) setTimeout(() => toast(`🏆 ${a.e} ${a.n}`, 'ok'), 350 + i * 700); });
      setTimeout(() => A11y.confetti(S.state().prefs), 300); setTimeout(() => { ui.freshAch = []; }, 6000);
    }
  }
  const y = window.scrollY, focusId = document.activeElement && document.activeElement.id;
  const sheetScroll = document.querySelector('.sheet') ? document.querySelector('.sheet').scrollTop : 0;
  const authLike = !st.session || st.session.needsProfile || (st.session.status && st.session.status !== 'active');
  $app.innerHTML = (authLike ? v + A11y.fab() : shell(v)) + A11y.panel();
  if (lastRoute !== route()) { lastRoute = route(); A11y.enter(st.prefs); }
  document.body.classList.toggle('is-auth', authLike);
  window.scrollTo(0, y);
  const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = sheetScroll;
  if (focusId) { const f = document.getElementById(focusId); if (f) f.focus(); }
}
window.__render = render;

// ---------- sync (автоматически, без кнопок) ----------
let flushTimer = null;
function scheduleFlush() {
  clearTimeout(flushTimer);
  if (S.isOffline() || !S.pending()) return;
  flushTimer = setTimeout(async () => { const n = await S.flushQueue(); if (n) { toast(`${t('synced')}: ${n}`, 'ok'); bgHydrate(); } }, 900);
}
function bgHydrate() { if (S.isLive() && S.state().session && !S.isOffline() && !S.pending() && !isTyping() && !ui.photo) S.hydrate().catch(() => {}); }
Net.onChange(v => { toast(v ? t('online') : t('offline_msg'), v ? 'ok' : 'warn'); render(); if (v) { scheduleFlush(); bgHydrate(); } });
setInterval(() => { if (S.pending()) scheduleFlush(); }, 15000);
setInterval(bgHydrate, 60000);

// ---------- events ----------
document.addEventListener('click', async e => {
  if (ui.menu && !e.target.closest('.usr')) { ui.menu = false; render(); }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, st = S.state();
  if (['cls', 'subj', 'role', 'wi-target', 'wi-test', 'acls', 'homeroom'].includes(act) || el.tagName === 'SELECT') return; // обрабатываются на change
  if (act === 'menu') { ui.menu = !ui.menu; render(); return; }
  if (act === 'tour') { ui.menu = false; Tour.start(); return; }
  if (act === 'login') { S.login(el.dataset.role); ui.demoPick = false; go(el.dataset.role); return; }
  if (act === 'demo-back') { ui.demoPick = false; render(); return; }
  if (act === 'logout') { ui.menu = false; S.logout(); location.hash = ''; ui.demoPick = false; render(); return; }
  if (act === 'to-live') { S.switchMode('live'); location.hash = ''; render(); return; }
  if (act === 'privacy') { Privacy.open(); return; }
  if (act === 'lang') { S.setPrefs({ lang: st.prefs.lang === 'ru' ? 'ky' : 'ru' }); return; }
  if (A11y.act(act, el)) return;
  if (act === 'ach-demo') { const got = S.demoPerfectAttendance(el.dataset.sid, 30); if (!got.length) toast('Уже получено — сбросьте демо-данные в подвале, чтобы показать заново', 'warn'); return; }
  if (act === 'kid') { S.setChild(el.dataset.id); return; }
  if (act === 'clear-failed') { st.failed = []; render(); return; }
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
  if (act === 'hw') { S.toggleHw(el.dataset.hid, el.dataset.sid); scheduleFlush(); return; }
  if (act === 'mailread') { S.markMailRead(el.dataset.id); scheduleFlush(); return; }
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
  for (const m of [Auth, People, Admin, Sched]) if (await m.act(act, el)) return;
});
document.addEventListener('change', e => {
  if (People.onChange(e.target) || Auth.onChange(e.target) || Sched.onChange(e.target)) return;
  const el = e.target.closest('select[data-act]'); if (!el) return;
  if (Admin.onChange(el)) return;
  if (el.dataset.act === 'role') { S.login(el.value); ui.menu = false; go(el.value === 'deputy' ? 'admin' : el.value); return; }
  if (el.dataset.act === 'wi-target') { (ui.wi = ui.wi || {}).target = Number(el.value); render(); return; }
  if (el.dataset.act === 'wi-test') { (ui.wi = ui.wi || {}).test = Number(el.value); render(); return; }
  if (el.dataset.act === 'cls') ui.cls = el.value;
  if (el.dataset.act === 'subj') ui.subj = el.value;
  render();
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const fd = new FormData(f);
  if (f.dataset.form === 'mail') { S.sendMail(fd.get('cat'), String(fd.get('text')).trim()); ui.mailOk = true; render(); setTimeout(() => { ui.mailOk = false; }, 100); toast(t('mail_ok'), 'ok'); scheduleFlush(); return; }
  if (f.dataset.form === 'student') { const name = String(fd.get('name')).trim(); S.addStudent(name, ui.cls).then(r => { ui.newCode = { name, code: r.code }; ui.lastSave = Date.now(); render(); scheduleFlush(); }).catch(er => toast(er.message, 'warn')); return; }
  if (await Auth.submit(f, fd)) return;
  if (await Sched.submit(f, fd)) return;
  if (People.submit(f, fd)) return;
  Admin.submit(f, fd);
});
window.addEventListener('hashchange', () => { ui.sheet = ui.pendingSheet || null; ui.pendingSheet = null; ui.mailOk = false; ui.menu = false; ui.codeBox = null; render(); window.scrollTo(0, 0); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (ui.photo) { ui.photo = null; render(); } else if (ui.sheet) { ui.sheet = null; render(); } else if (ui.menu) { ui.menu = false; render(); } } });

// ---------- start ----------
S.load();
let recovering = false;
if (location.hash.includes('access_token')) {
  const type = API.sessionFromHash(location.hash); history.replaceState(null, '', location.pathname);
  if (type === 'recovery') { recovering = true; S.switchMode('live'); ui.auth = { mode: 'recover-set', step: 1, d: {}, err: '', info: '' }; }
}
if (new URLSearchParams(location.search).has('demo')) { if (!S.state().session) { S.switchMode('demo'); ui.demoPick = true; location.hash = ''; } history.replaceState(null, '', location.pathname); }
Tour.init({ S, ui, go, render, scheduleFlush, Net });
S.on(() => render());
setLang(S.state().prefs.lang); Ky.init(); Ky.apply();
render();
if (!recovering) S.restoreLive();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
window.__sabak = { S, ui, Net };
