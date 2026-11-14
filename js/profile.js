// Профиль: данные аккаунта, почта, смена пароля (с проверкой текущего пароля).
import * as S from './store.js';
import * as API from './api.js';
import { esc, ui, head, toast, ROLE_RU } from './common.js';
import { t } from './i18n.js';

const rerender = () => window.__render && window.__render();
const X = () => (ui.prof = ui.prof || { busy: false, err: '', ok: false });
const roleName = u => (u.level ? ROLE_RU[u.level] : t('role_' + u.role));

export function page() {
  const st = S.state(), u = st.session, x = X(), live = S.isLive();
  const mail = u.email || (live && API.session() && API.session().user.email) || '';
  const row = (k, v) => `<div class="pf-r"><span>${esc(k)}</span><b>${v}</b></div>`;
  const pass = live ? `<section class="card pf-pass"><h3>Сменить пароль</h3>
    <p class="muted">Пароль нужен для входа по почте. Введите текущий пароль и придумайте новый: не короче 8 символов.</p>
    <form data-form="pf-pass" autocomplete="off">
      <label class="fld"><span>Текущий пароль</span><input type="password" name="old" autocomplete="current-password" required></label>
      <label class="fld"><span>Новый пароль</span><input type="password" name="p1" autocomplete="new-password" minlength="8" required></label>
      <label class="fld"><span>Повторите новый пароль</span><input type="password" name="p2" autocomplete="new-password" minlength="8" required></label>
      ${x.err ? `<p class="pf-err" role="alert">${esc(x.err)}</p>` : ''}${x.ok ? '<p class="pf-ok" role="status">Пароль изменён. Другие устройства войдут по новому паролю.</p>' : ''}
      <button class="btn blue" type="submit" ${x.busy ? 'disabled' : ''}>${x.busy ? 'Сохраняем…' : 'Изменить пароль'}</button>
    </form></section>`
    : `<section class="card pf-pass"><h3>Сменить пароль</h3><p class="muted">В демонстрационном режиме пароля нет. В настоящем аккаунте здесь можно сменить пароль.</p></section>`;
  return `${head('Мой', 'профиль', 'Данные аккаунта')}
  <section class="card pf-card"><h3>Аккаунт</h3>
    ${row('Имя', esc(u.name || '—'))}
    ${row('Роль', esc(roleName(u)))}
    ${st.school ? row('Школа', esc(st.school.name)) : ''}
    ${row('Профиль создан на почте', mail ? esc(mail) : (live ? '—' : 'демо-режим (почты нет)'))}
    ${u.phone ? row('Телефон', esc(u.phone)) : ''}
    <p class="muted pf-note">Почта привязана к аккаунту и используется для входа и восстановления пароля. Чтобы сменить почту, обратитесь к администрации школы.</p>
  </section>${pass}`;
}

export async function submit(f, fd) {
  if (f.dataset.form !== 'pf-pass') return false;
  const x = X(), old = String(fd.get('old') || ''), p1 = String(fd.get('p1') || ''), p2 = String(fd.get('p2') || '');
  x.ok = false; x.err = '';
  if (p1.length < 8) x.err = 'Новый пароль короче 8 символов';
  else if (p1 !== p2) x.err = 'Новые пароли не совпадают';
  else if (p1 === old) x.err = 'Новый пароль совпадает со старым';
  if (x.err) { rerender(); return true; }
  const mail = S.state().session.email || (API.session() && API.session().user.email);
  x.busy = true; rerender();
  try { await API.signIn(mail, old); } catch { x.busy = false; x.err = 'Текущий пароль неверный'; rerender(); return true; }
  try { await API.updatePassword(p1); x.ok = true; toast('Пароль изменён', 'ok'); } catch (e) { x.err = e.message || 'Не удалось изменить пароль'; }
  x.busy = false; rerender(); return true;
}
export const act = () => false;
