// Вход и регистрация (настоящие аккаунты Supabase). Регистрация закрыта «цепочкой доверия»: без ключа школы или приглашения
// аккаунт получить нельзя — это и есть защита от «случайных людей» в администрации и в журнале.
import * as S from './store.js';
import * as API from './api.js';
import { esc, ui, toast, go } from './common.js';

const A = () => (ui.auth = ui.auth || { mode: 'login', step: 1, role: null, code: '', peek: null, d: {}, busy: false, err: '', info: '' });
const ERR = { bad_key: 'Ключ школы неверный или уже использован. Ключ выдаёт оператор SABAK+ один раз для каждой школы.', bad_code: 'Код приглашения не найден, отозван или не подходит.', expired: 'Срок действия приглашения истёк — попросите новый.', used: 'Это приглашение уже использовано.', phone_mismatch: 'Телефон не совпадает с тем, к которому привязано приглашение.', too_many: 'Слишком много неудачных попыток. Подождите 15 минут.', already: 'У этого аккаунта уже есть профиль — просто войдите.', fields: 'Заполните обязательные поля.', auth: 'Нужно войти.' };
export const errText = e => ERR[e] || e || 'Ошибка';
const ROLES = [
  ['director', '🏫', 'Директор школы', 'Основать школу по ключу SABAK+'],
  ['teacher', '📘', 'Учитель или завуч', 'Есть код-приглашение от администрации'],
  ['parent', '👪', 'Родитель', 'Код от классного руководителя'],
  ['student', '🎓', 'Ученик', 'Код от классного руководителя'],
];
const field = (name, label, o = {}) => `<label class="fld ${o.cls || ''}"><span>${label}${o.req ? ' <i>*</i>' : ''}</span><input name="${name}" type="${o.type || 'text'}" ${o.req ? 'required' : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.auto ? `autocomplete="${o.auto}"` : ''} ${o.min ? `minlength="${o.min}"` : ''} ${o.attrs || ''} value="${esc(A().d[name] ?? '')}"></label>`;

function brand() {
  return `<aside class="auth-side"><div class="tape">NEXUS · LOGOS HACKATHON 2026</div><h1>SABAK<span>+</span></h1>
    <p class="lead">Электронный дневник нового поколения</p>
    <ul class="auth-points"><li><b>Прозрачные оценки</b><span>ученик видит, как получена каждая</span></li><li><b>Работает без интернета</b><span>данные не теряются, синхронизация автоматическая</span></li><li><b>Закрытая школа</b><span>войти можно только по приглашению администрации</span></li></ul></aside>`;
}

export function authView() {
  const a = A(), user = S.me();
  if (user && user.needsProfile) return shell(profileStep(true));
  if (user && user.status === 'pending') return shell(pendingView(user));
  if (user && user.status === 'blocked') return shell(`<div class="auth-card"><h2>Доступ закрыт</h2><p>Администрация школы закрыла доступ для этого аккаунта. Обратитесь к директору.</p><button class="btn ghost" data-act="logout">Выйти</button></div>`);
  if (a.mode === 'recover-set') return shell(`<form class="auth-card" data-form="newpass"><h2>Новый пароль</h2>${field('password', 'Новый пароль', { type: 'password', req: true, min: 8, auto: 'new-password' })}<button class="btn blue wide" type="submit">Сохранить пароль</button>${msg(a)}</form>`);
  if (!API.configured()) return shell(`<div class="auth-card"><h2>Supabase не настроен</h2><p>Заполните URL и anon-ключ в <code>js/config.js</code>. Пока доступен демо-режим.</p><button class="btn blue wide" data-act="auth-demo">Открыть демо</button></div>`);
  if (a.mode === 'login') return shell(loginForm(a));
  if (a.mode === 'recover') return shell(`<form class="auth-card" data-form="recover"><h2>Восстановление пароля</h2><p class="muted">Укажите почту — отправим ссылку для нового пароля.</p>${field('email', 'Почта', { type: 'email', req: true, auto: 'email' })}<button class="btn blue wide" type="submit">Отправить ссылку</button>${msg(a)}<p class="alt"><button type="button" class="link" data-act="auth-mode" data-v="login">← Назад ко входу</button></p></form>`);
  return shell(regView(a));
}
const msg = a => `${a.err ? `<p class="errmsg" role="alert">${esc(a.err)}</p>` : ''}${a.info ? `<p class="okmsg">${esc(a.info)}</p>` : ''}`;
const shell = inner => `<div class="auth"><div class="auth-top"><button class="ibtn" data-act="lang" aria-label="Язык">${S.state().prefs.lang === 'ru' ? 'КЫ' : 'RU'}</button></div><div class="auth-grid">${brand()}<div class="auth-main">${inner}<p class="alt foot"><button type="button" class="linkbtn" data-act="privacy">Политика данных</button></p></div></div></div>`;

function loginForm(a) {
  return `<form class="auth-card" data-form="login" novalidate><h2>Вход</h2><p class="muted">С возвращением! Введите почту и пароль.</p>
    ${field('email', 'Почта', { type: 'email', req: true, auto: 'username', ph: 'name@gmail.com' })}
    <label class="fld"><span>Пароль <i>*</i></span><span class="pw"><input name="password" type="password" required autocomplete="current-password" minlength="6"><button type="button" class="ibtn sm" data-act="auth-showpw" aria-label="Показать пароль">👁</button></span></label>
    ${msg(a)}
    <button class="btn blue wide" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Входим…' : 'Войти'}</button>
    <p class="alt"><button type="button" class="link" data-act="auth-mode" data-v="recover">Забыли пароль?</button></p>
    <div class="or"><span>или</span></div>
    <button type="button" class="btn ghost wide" data-act="auth-mode" data-v="register">Создать аккаунт по приглашению</button>
    <button type="button" class="btn light wide demo-btn" data-act="auth-demo">▶ Посмотреть демо без регистрации</button></form>`;
}

function regView(a) {
  const steps = ['Кто вы', 'Код', 'Данные', 'Аккаунт', 'Почта'];
  const bar = `<ol class="steps">${steps.map((s, i) => `<li class="${a.step === i + 1 ? 'on' : a.step > i + 1 ? 'done' : ''}"><i>${a.step > i + 1 ? '✓' : i + 1}</i><span>${s}</span></li>`).join('')}</ol>`;
  let body = '';
  if (a.step === 1) body = `<h2>Кто вы?</h2><p class="muted">Каждая роль подключается своим способом — так в систему не попадают случайные люди.</p><div class="role-pick">${ROLES.map(([r, e, n, d]) => `<button type="button" class="rp ${a.role === r ? 'on' : ''}" data-act="auth-role" data-v="${r}"><span class="em" aria-hidden="true">${e}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div>`;
  else if (a.step === 2) body = codeStep(a);
  else if (a.step === 3) body = profileStep(false);
  else if (a.step === 4) body = accountStep(a);
  else body = verifyStep(a);
  return `<div class="auth-card wide-card">${bar}${body}<p class="alt"><button type="button" class="link" data-act="auth-mode" data-v="login">← Уже есть аккаунт? Войти</button></p></div>`;
}
function codeStep(a) {
  const dir = a.role === 'director';
  return `<form data-form="regcode"><h2>${dir ? 'Ключ школы' : 'Код приглашения'}</h2>
    <p class="muted">${dir ? 'Ключ вида <b>SABAK-XXXX-XXXX-XXXX</b> выдаёт оператор SABAK+ один раз для каждой школы. По нему создаётся школа и вы становитесь директором.' : a.role === 'teacher' ? 'Код вида <b>XXXX-XXXX-XXXX</b> выдаёт директор или завуч. Он действует 3 дня и может быть привязан к вашему телефону.' : 'Код вида <b>XXXX-XXXX-XXXX</b> выдаёт классный руководитель. Он привязан к конкретному ученику.'}</p>
    <label class="fld"><span>${dir ? 'Ключ школы' : 'Код'} <i>*</i></span><input name="code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${dir ? 'SABAK-XXXX-XXXX-XXXX' : 'XXXX-XXXX-XXXX'}" value="${esc(a.code)}"></label>
    ${a.peek ? `<div class="peek ok">✓ Код действителен: <b>${esc(a.peek.school || '')}</b> · ${({ teacher: 'учитель', deputy: 'завуч', parent: 'родитель', student: 'ученик' })[a.peek.role] || a.peek.role}${a.peek.class ? ' · класс ' + esc(a.peek.class) : ''}</div>` : ''}${msg(a)}
    <div class="nav-row"><button type="button" class="btn ghost" data-act="auth-back">← Назад</button><button class="btn blue" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Проверяем…' : 'Продолжить →'}</button></div></form>`;
}
function profileStep(standalone) {
  const a = A(), r = standalone ? (a.role || 'parent') : a.role, st = S.me();
  const roleSel = standalone ? `<p class="muted">Аккаунт <b>${esc(st.email || '')}</b> создан, но профиль не завершён. Введите код и данные ещё раз.</p>
    <label class="fld"><span>Роль <i>*</i></span><select name="role">${ROLES.map(([k, , n]) => `<option value="${k}" ${k === r ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="fld"><span>Код / ключ школы <i>*</i></span><input name="code" required autocomplete="off" value="${esc(a.code)}"></label>` : '';
  const need = a.peek && a.peek.need_phone;
  return `<form data-form="regprofile" ${standalone ? 'data-standalone="1"' : ''}><h2>${standalone ? 'Завершите регистрацию' : 'Ваши данные'}</h2>${standalone ? '' : '<p class="muted">Как в обычном школьном дневнике: данные нужны, чтобы школа знала, кто есть кто.</p>'}${roleSel}
    <div class="frow3">${field('last', 'Фамилия', { req: true, auto: 'family-name' })}${field('first', 'Имя', { req: true, auto: 'given-name' })}${field('mid', 'Отчество', { auto: 'additional-name' })}</div>
    <div class="frow3">${field('birth', 'Дата рождения', { type: 'date', req: r === 'student' || r === 'director' || r === 'teacher', attrs: 'max="' + new Date().toISOString().slice(0, 10) + '"' })}
      <label class="fld"><span>Пол</span><select name="gender"><option value="">—</option><option value="f" ${a.d.gender === 'f' ? 'selected' : ''}>Женский</option><option value="m" ${a.d.gender === 'm' ? 'selected' : ''}>Мужской</option></select></label>
      ${field('phone', 'Телефон', { type: 'tel', req: need || r !== 'student', ph: '+996 700 123 456', auto: 'tel' })}</div>
    ${need ? '<p class="hint">Телефон должен оканчиваться теми цифрами, к которым привязано приглашение — это вторая защита.</p>' : ''}
    ${r === 'director' ? `<div class="frow2">${field('school', 'Название школы', { req: true, ph: 'Школа-гимназия №12' })}${field('city', 'Город / район', { req: true, ph: 'Бишкек, Ленинский район' })}</div>` : ''}
    ${r === 'teacher' ? `<div class="frow2">${field('position', 'Должность', { ph: 'Учитель математики' })}${field('subjects_txt', 'Предметы', { ph: 'Математика, информатика' })}</div>` : ''}
    ${r === 'parent' ? `<div class="frow2"><label class="fld"><span>Кем приходитесь ученику <i>*</i></span><select name="relation" required><option value="mother">Мать</option><option value="father">Отец</option><option value="guardian">Опекун / законный представитель</option></select></label>${field('work', 'Место работы')}</div>` : ''}
    <label class="fld"><span>Язык интерфейса</span><select name="lang"><option value="ru">Русский</option><option value="ky">Кыргызча</option></select></label>
    ${msg(a)}
    <div class="nav-row">${standalone ? '<button type="button" class="btn ghost" data-act="logout">Выйти</button>' : '<button type="button" class="btn ghost" data-act="auth-back">← Назад</button>'}<button class="btn blue" type="submit">${standalone ? (a.busy ? 'Сохраняем…' : 'Завершить') : 'Продолжить →'}</button></div></form>`;
}
function accountStep(a) {
  return `<form data-form="regaccount"><h2>Почта и пароль</h2><p class="muted">Почта будет вашим логином. Пароль — от 8 символов.</p>
    ${field('email', 'Почта', { type: 'email', req: true, auto: 'email', ph: 'name@gmail.com' })}
    <div class="frow2"><label class="fld"><span>Пароль <i>*</i></span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label class="fld"><span>Повторите пароль <i>*</i></span><input name="password2" type="password" required minlength="8" autocomplete="new-password"></label></div>
    <label class="chk"><input type="checkbox" name="consent" required><span>Согласен(на) на обработку персональных данных в соответствии с Законом КР «Об информации персонального характера» и с правилами школьной системы. Данные ученика видят только его родители, классный руководитель и администрация школы.</span></label>
    ${msg(a)}
    <div class="nav-row"><button type="button" class="btn ghost" data-act="auth-back">← Назад</button><button class="btn blue" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Создаём…' : 'Создать аккаунт'}</button></div></form>`;
}
function verifyStep(a) {
  const left = Math.max(0, Math.ceil(((a.resendAt || 0) - Date.now()) / 1000));
  return `<form data-form="verify" novalidate><h2>Подтвердите почту</h2>
    <p class="muted">Мы отправили 6-значный код на <b>${esc(a.pendEmail || '')}</b>. Введите его — так мы убеждаемся, что почта ваша и к ней можно будет вернуть доступ.</p>
    <label class="fld"><span>Код из письма <i>*</i></span><input name="otp" class="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required placeholder="000000" autofocus></label>
    ${msg(a)}
    <button class="btn blue wide" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Проверяем…' : 'Подтвердить'}</button>
    <p class="alt">Нет письма? Проверьте «Спам». <button type="button" class="link" data-act="auth-resend" ${left ? 'disabled' : ''}>${left ? `Отправить ещё раз (${left} с)` : 'Отправить ещё раз'}</button></p>
    <p class="alt"><button type="button" class="link" data-act="auth-wrongmail">Указал(а) не ту почту</button></p></form>`;
}
function pendingView(u) {
  return `<div class="auth-card"><div class="pend">⏳</div><h2>Ждём подтверждения</h2><p>Здравствуйте, <b>${esc(u.name)}</b>! Аккаунт создан по приглашению, но доступ к журналам откроет директор или завуч после проверки. Это вторая ступень защиты школы.</p><p class="muted">Откройте приложение позже — страница обновится сама.</p><div class="btns"><button class="btn blue" data-act="auth-refresh">Проверить сейчас</button><button class="btn ghost" data-act="logout">Выйти</button></div></div>`;
}

// ---- действия ----
const norm = c => String(c || '').trim().toUpperCase();
const fullName = d => [d.last, d.first, d.mid].map(x => (x || '').trim()).filter(Boolean).join(' ');
function rpcFor(a) {
  const d = a.d, p = { p_full_name: fullName(d), p_birth: d.birth || null, p_gender: d.gender || null, p_phone: d.phone || null, p_lang: d.lang || 'ru' };
  if (a.role === 'director') return () => S.rpcRaw('register_director', { p_key: norm(a.code), p_school_name: d.school, p_city: d.city, ...p, p_extra: { position: 'director' } });
  return () => S.rpcRaw('redeem_invite', { p_code: norm(a.code), ...p, p_extra: { relation: d.relation, work: d.work, position: d.position, subjects: d.subjects_txt } });
}
const read = fd => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
const rerender = () => window.__render && window.__render();

export async function act(name, el) {
  const a = A();
  switch (name) {
    case 'auth-mode': a.mode = el.dataset.v; a.err = ''; a.info = ''; if (a.mode === 'register') { a.step = 1; } rerender(); return true;
    case 'auth-resend': try { await S.resendCode(a.pendEmail); a.info = 'Код отправлен ещё раз.'; a.err = ''; } catch (e) { a.err = e.message; a.info = ''; } a.resendAt = Date.now() + 60000; rerender(); setTimeout(rerender, 61000); return true;
    case 'auth-wrongmail': a.step = 4; a.err = ''; a.info = ''; rerender(); return true;
    case 'auth-demo': S.switchMode('demo'); ui.demoPick = true; location.hash = ''; rerender(); return true;
    case 'auth-role': a.role = el.dataset.v; a.err = ''; a.peek = null; a.step = 2; rerender(); return true;
    case 'auth-back': a.err = ''; a.step = Math.max(1, a.step - 1); rerender(); return true;
    case 'auth-showpw': { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; return true; }
    case 'auth-refresh': try { await S.hydrate(); } catch (e) { toast(e.message, 'warn'); } return true;
  }
  return false;
}
export async function submit(form, fd) {
  const a = A(), d = read(fd), f = form.dataset.form;
  const fail = m => { a.err = m; a.busy = false; rerender(); return true; };
  if (f === 'login') {
    a.busy = true; a.err = ''; a.d.email = d.email; rerender();
    try { await S.liveSignIn(d.email, d.password); a.busy = false; a.err = ''; const u = S.me(); location.hash = u && u.role ? '#/' + u.role : ''; rerender(); }
    catch (e) { if (/не подтверждена/.test(e.message)) { a.mode = 'register'; a.step = 5; a.pendEmail = d.email; a.verifyOnly = true; a.err = ''; a.info = 'Почта ещё не подтверждена. Введите код из письма.'; a.busy = false; try { await S.resendCode(d.email); } catch {} a.resendAt = Date.now() + 60000; rerender(); return true; } return fail(e.message); } return true;
  }
  if (f === 'recover') { a.err = ''; try { await API.recover(d.email); a.info = 'Если такая почта зарегистрирована, письмо со ссылкой отправлено.'; } catch (e) { a.err = e.message; } rerender(); return true; }
  if (f === 'newpass') { try { await API.updatePassword(d.password); a.mode = 'login'; a.info = 'Пароль изменён. Теперь войдите.'; a.err = ''; await S.logout(); } catch (e) { a.err = e.message; } rerender(); return true; }
  if (f === 'regcode') {
    a.code = norm(d.code); a.err = ''; a.peek = null;
    if (a.role === 'director') { if (!/^SABAK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(a.code)) return fail('Ключ выглядит так: SABAK-XXXX-XXXX-XXXX'); a.step = 3; rerender(); return true; }
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(a.code)) return fail('Код выглядит так: XXXX-XXXX-XXXX');
    a.busy = true; rerender();
    try {
      const r = await S.peekInvite(a.code); a.busy = false;
      if (!r || !r.ok) return fail('Код не найден, отозван, использован или просрочен.');
      const want = a.role === 'teacher' ? ['teacher', 'deputy'] : [a.role];
      if (!want.includes(r.role)) return fail(`Этот код для роли «${r.role}», а вы выбрали другую роль. Вернитесь назад и выберите верную.`);
      a.peek = r; a.step = 3; rerender();
    } catch (e) { return fail(e.message); } return true;
  }
  if (f === 'regprofile') {
    Object.assign(a.d, d);
    if (form.dataset.standalone) {
      a.role = d.role; a.code = norm(d.code); a.busy = true; a.err = ''; rerender();
      try { const r = await S.completeProfile(rpcFor(a)); a.busy = false; if (!r.ok) return fail(errText(r.error)); const u = S.me(); location.hash = u && u.role ? '#/' + u.role : ''; rerender(); }
      catch (e) { return fail(e.message); } return true;
    }
    if (!(d.last && d.first)) return fail('Введите фамилию и имя.');
    a.err = ''; a.step = 4; rerender(); return true;
  }
  if (f === 'verify') {
    if (!/^\d{6,8}$/.test((d.otp || '').replace(/\D/g, ''))) return fail('Введите код из письма (6 цифр).');
    a.busy = true; a.err = ''; rerender();
    try {
      const r = await S.liveVerify(a.pendEmail, d.otp, a.verifyOnly ? null : rpcFor(a));
      a.busy = false;
      if (!r.ok) return fail(errText(r.error) + ' Почта подтверждена — войдите и завершите регистрацию с верным кодом.');
      a.d = {}; a.code = ''; a.step = 1; a.verifyOnly = false; const u = S.me(); location.hash = u && u.role ? '#/' + u.role : ''; rerender();
    } catch (e) { return fail(e.message); } return true;
  }
  if (f === 'regaccount') {
    if (d.password !== d.password2) return fail('Пароли не совпадают.');
    if (!d.consent) return fail('Нужно согласие на обработку персональных данных.');
    a.busy = true; a.err = ''; rerender();
    try {
      const r = await S.liveSignUp(d.email, d.password, rpcFor(a));
      a.busy = false;
      if (r.needConfirm) { a.pendEmail = d.email; a.step = 5; a.err = ''; a.info = ''; a.resendAt = Date.now() + 60000; rerender(); setTimeout(rerender, 61000); return true; }
      if (!r.ok) return fail(errText(r.error) + ' Аккаунт создан — войдите и завершите регистрацию с верным кодом.');
      a.d = {}; a.code = ''; a.step = 1; const u = S.me(); location.hash = u && u.role ? '#/' + u.role : ''; rerender();
    } catch (e) { return fail(e.message); } return true;
  }
  return false;
}

export function onChange(el) {   // в форме «завершить регистрацию» смена роли меняет набор полей
  const f = el.closest && el.closest('form[data-standalone]');
  if (!f || el.name !== 'role') return false;
  const a = A(), d = read(new FormData(f)); a.code = norm(d.code); delete d.code; delete d.role; Object.assign(a.d, d); a.role = el.value; rerender(); return true;
}
