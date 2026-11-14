// «Мой профиль»: на какую почту создан аккаунт и смена пароля. Открывается из меню пользователя.
import { getLang } from './i18n.js';
import * as API from './api.js';
import * as S from './store.js';
import { ROLE_RU } from './common.js';

const T = {
  ru: { title: 'Мой профиль', name: 'Имя', role: 'Роль', school: 'Школа', mail: 'Аккаунт создан на почте', mailHint: 'На эту почту приходят коды подтверждения и письма для восстановления пароля. Её видите только вы.',
    demo: 'Демо-режим: аккаунта и пароля нет, всё хранится только в вашем браузере. Войдите в настоящий аккаунт, чтобы управлять паролем.', pwd: 'Смена пароля',
    cur: 'Текущий пароль', nw: 'Новый пароль (не короче 8 символов)', rep: 'Повторите новый пароль', save: 'Сменить пароль', close: 'Закрыть',
    ok: 'Пароль изменён. Он действует сразу, при следующем входе используйте новый.', e_short: 'Новый пароль слишком короткий — нужно не менее 8 символов', e_same: 'Новый пароль совпадает с текущим', e_rep: 'Пароли не совпадают',
    e_cur: 'Текущий пароль указан неверно', e_nomail: 'Не удалось определить почту аккаунта. Выйдите и войдите снова', tip: 'Совет: используйте пароль, которого нет в других сервисах. Двухфакторного входа пока нет, поэтому пароль — главная защита аккаунта.', busy: 'Сохраняем…' },
  ky: { title: 'Менин профилим', name: 'Аты-жөнү', role: 'Ролу', school: 'Мектеп', mail: 'Аккаунт ушул почтага түзүлгөн', mailHint: 'Ушул почтага ырастоо коддору жана сырсөздү калыбына келтирүү каттары келет. Аны сиз гана көрөсүз.',
    demo: 'Демо режим: аккаунт да, сырсөз да жок, баары браузериңизде гана сакталат. Сырсөздү башкаруу үчүн чыныгы аккаунтка кириңиз.', pwd: 'Сырсөздү өзгөртүү',
    cur: 'Азыркы сырсөз', nw: 'Жаңы сырсөз (кеминде 8 белги)', rep: 'Жаңы сырсөздү кайталаңыз', save: 'Сырсөздү өзгөртүү', close: 'Жабуу',
    ok: 'Сырсөз өзгөрдү. Ал дароо иштейт, кийинки жолу жаңысы менен кириңиз.', e_short: 'Жаңы сырсөз өтө кыска — кеминде 8 белги керек', e_same: 'Жаңы сырсөз азыркысы менен бирдей', e_rep: 'Сырсөздөр дал келген жок',
    e_cur: 'Азыркы сырсөз туура эмес', e_nomail: 'Аккаунттун почтасын аныктоо мүмкүн болгон жок. Чыгып, кайра кириңиз', tip: 'Кеңеш: башка сервистерде жок сырсөз колдонуңуз. Эки баскычтуу кирүү азырынча жок, андыктан сырсөз — аккаунттун негизги коргоосу.', busy: 'Сакталууда…' },
};
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tt = () => T[getLang() === 'ky' ? 'ky' : 'ru'];

export function close() { const d = document.getElementById('account'); if (d) d.remove(); }
export function open() {
  close(); const L = tt(), st = S.state(), u = st.session || {}, live = S.isLive();
  const ses = API.session(), mail = (u.email || (ses && ses.user && ses.user.email) || '').trim();
  const role = u.level ? ROLE_RU[u.level] : (ROLE_RU[u.role] || u.role || '');
  const d = document.createElement('div'); d.id = 'account'; d.className = 'modal-bg'; d.setAttribute('data-notr', '1');
  d.innerHTML = `<div class="modal priv" role="dialog" aria-modal="true" aria-label="${e(L.title)}"><h2>${e(L.title)}</h2>
  <dl class="acc-dl"><dt>${e(L.name)}</dt><dd>${e(u.name || '—')}</dd><dt>${e(L.role)}</dt><dd>${e(role || '—')}</dd>${st.school ? `<dt>${e(L.school)}</dt><dd>${e(st.school.name)}</dd>` : ''}
  ${live ? `<dt>${e(L.mail)}</dt><dd class="acc-mail"><b>${e(mail || '—')}</b><small>${e(L.mailHint)}</small></dd>` : ''}</dl>
  ${live ? `<h3>${e(L.pwd)}</h3><form id="acc-form" autocomplete="off" novalidate>
    <label class="fld"><span>${e(L.cur)}</span><input type="password" name="cur" autocomplete="current-password" required></label>
    <label class="fld"><span>${e(L.nw)}</span><input type="password" name="nw" autocomplete="new-password" minlength="8" required></label>
    <label class="fld"><span>${e(L.rep)}</span><input type="password" name="rep" autocomplete="new-password" minlength="8" required></label>
    <p class="muted">${e(L.tip)}</p><p id="acc-msg" role="status" aria-live="polite"></p>
    <div class="btns"><button class="btn blue" type="submit" id="acc-save">${e(L.save)}</button><button class="btn ghost" type="button" data-acc-close>${e(L.close)}</button></div></form>`
  : `<p class="muted">${e(L.demo)}</p><div class="btns"><button class="btn blue" type="button" data-acc-close>${e(L.close)}</button></div>`}</div>`;
  d.addEventListener('click', ev => { if (ev.target === d || ev.target.closest('[data-acc-close]')) close(); });
  const f = d.querySelector('#acc-form');
  if (f) f.addEventListener('submit', async ev => {
    ev.preventDefault(); const L2 = tt(), msg = d.querySelector('#acc-msg'), btn = d.querySelector('#acc-save'), v = Object.fromEntries(new FormData(f));
    const say = (t, ok) => { msg.textContent = t; msg.style.color = ok ? 'var(--green,#1F9D6B)' : 'var(--red,#D6443F)'; };
    if (!v.nw || v.nw.length < 8) return say(L2.e_short);
    if (v.nw !== v.rep) return say(L2.e_rep);
    if (v.nw === v.cur) return say(L2.e_same);
    if (!mail) return say(L2.e_nomail);
    btn.disabled = true; say(L2.busy, true);
    try {
      try { await API.signIn(mail, v.cur); } catch (er) { if (er && er.network) throw er; return say(L2.e_cur); }   // проверка текущего пароля
      await API.updatePassword(v.nw);
      f.reset(); say(L2.ok, true);
    } catch (er) { say(er.message || 'Error'); } finally { btn.disabled = false; }
  });
  document.body.appendChild(d); const i = d.querySelector('input,button'); if (i) i.focus();
}
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
