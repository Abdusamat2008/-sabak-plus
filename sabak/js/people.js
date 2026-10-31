// Фото профиля, «дело» ученика, уведомления, список учеников класса
import * as S from './store.js';
import { esc, ui, toast, go, avatar, head, hhmm, dtFmt, copyText, ROLE_RU } from './common.js';
import { CRITERIA, checkPhoto } from './face.js';
import { DOC_TYPES, REQ_LABEL, REC_KINDS, HEALTH_GROUPS } from './docs.js';
import { todayISO, dmy } from './calc.js';

const rerender = () => window.__render && window.__render();
const gradeOf = cls => parseInt(cls, 10) || 0;

// ================= Фото =================
export function photoModal() {
  const p = ui.photo; if (!p) return '';
  const st = S.student(p.sid); if (!st) return '';
  let body = '';
  if (p.state === 'checking') body = `<div class="checking"><div class="spin"></div><b>Проверяем фото…</b><small>Анализ идёт на вашем устройстве, фото никуда не отправляется, пока вы не нажмёте «Сохранить».</small></div>`;
  else if (p.state === 'result' && p.res) {
    const r = p.res;
    body = `<div class="pv"><img src="${p.url}" alt="Выбранное фото"><div class="pv-r">
      <div class="verdict ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ Фото подходит' : '✕ Фото не принято'}</div>
      <ul class="checks">${r.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}"><i>${c.ok ? '✓' : '✕'}</i><div><b>${esc(c.label)}</b> <small>${esc(c.detail)}</small>${c.ok ? '' : `<div class="hintx">${esc(c.hint)}</div>`}</div></li>`).join('')}</ul></div></div>
      <div class="btns">${r.ok ? `<button class="btn blue" data-act="photo-save" ${p.saving ? 'disabled' : ''}>${p.saving ? 'Сохраняем…' : 'Сохранить как фото профиля'}</button>` : ''}<button class="btn ghost" data-act="photo-again">${r.ok ? 'Выбрать другое' : 'Выбрать другое фото'}</button></div>
      ${r.ok ? '' : '<p class="errmsg">Пока фото не соответствует требованиям, сохранить его нельзя. Исправьте отмеченное выше и попробуйте снова.</p>'}`;
  } else body = `<div class="crit"><b>Требования к фото</b><ul>${CRITERIA.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      ${p.err ? `<p class="errmsg" role="alert">${esc(p.err)}</p>` : ''}
      <div class="btns"><label class="btn blue filebtn">📷 Сделать снимок<input type="file" accept="image/*" capture="user" data-photo hidden></label><label class="btn ghost filebtn">🖼 Выбрать файл<input type="file" accept="image/jpeg,image/png,image/webp" data-photo hidden></label></div>`;
  return `<div class="sheet-bg" data-act="photo-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Фото профиля"><button class="ibtn close" data-act="photo-close" aria-label="Закрыть">✕</button>
    <div class="m-head">${avatar(st, 52)}<div><h2>Фото профиля</h2><p class="sub">${esc(st.name)} · ${esc(st.cls)}</p></div></div>${body}</div>`;
}
export async function onPhotoFile(input) {
  const f = input.files && input.files[0]; if (!f || !ui.photo) return;
  const p = ui.photo; p.state = 'checking'; p.err = ''; if (p.url) URL.revokeObjectURL(p.url); p.url = URL.createObjectURL(f); rerender();
  try { p.res = await checkPhoto(f); p.state = 'result'; }
  catch (e) { p.state = 'pick'; p.err = e.message || 'Не удалось проверить фото'; }
  rerender();
}

// ================= Уведомления =================
const NROUTE = { schedule_pending: () => 'admin/schedule', schedule_rejected: () => 'admin/schedule', schedule_comment: () => 'admin/schedule', schedule_approved: r => r + '/schedule', schedule_new: r => r + '/schedule', achievement: () => 'student/ach' };
function notifLink(n) {
  const u = S.me(); if (!u) return '';
  if (n.kind === 'doc_request' && n.sid) return `<div><a class="btn sm ghost" href="#/dossier/${n.sid}">Открыть дело</a></div>`;
  const f = NROUTE[n.kind]; if (!f) return '';
  if (n.kind === 'achievement' && u.role !== 'student') return '';
  return `<div><a class="btn sm ghost" href="#/${f(u.role)}">Открыть</a></div>`;
}
export function notifsPage() {
  const list = S.myNotifs().sort((a, b) => b.ts - a.ts), unread = list.filter(n => !n.read).length;
  return `${head('Уведомления', '', unread ? `Непрочитанных: ${unread}` : 'Всё прочитано', unread ? `<button class="ibtn" data-act="notif-all">Прочитать все</button>` : '')}
  <div class="card">${list.map(n => { const st = n.sid && S.student(n.sid), canFix = n.kind === 'photo_warning' && st && S.can.editPhoto(n.sid) && !(st.photo && st.photo.ok);
    return `<div class="notif ${n.read ? '' : 'new'}" data-act="notif-read" data-id="${n.id}"><span class="dot2" aria-hidden="true"></span><div><b>${n.kind === 'photo_warning' ? '⚠ ' : ''}${esc(n.title)}</b><p>${esc(n.body || '')}</p><small>${dtFmt(n.ts)}</small>${canFix ? `<div><button class="btn blue sm" data-act="photo-open" data-sid="${n.sid}">Загрузить фото</button></div>` : ''}${notifLink(n)}</div></div>`; }).join('') || '<p class="muted">Уведомлений нет.</p>'}</div>`;
}
export function photoBanner() {   // баннер на главной: «нужно фото»
  const u = S.me(); if (!u) return '';
  const need = S.myNotifs().filter(n => n.kind === 'photo_warning' && !n.read && n.sid && S.can.editPhoto(n.sid) && !(S.student(n.sid).photo && S.student(n.sid).photo.ok));
  if (!need.length) return '';
  const n = need[0];
  return `<div class="banner warn" role="alert"><div><b>⚠ Нужно фото профиля: ${esc(S.student(n.sid).name)}</b><p>${esc(n.body || '')}</p></div><button class="btn blue" data-act="photo-open" data-sid="${n.sid}">Загрузить фото</button></div>`;
}

// ================= Ученики класса =================
export function studentsPage() {
  const u = S.me(), st = S.state();
  const classes = u.role === 'admin' ? st.classes.map(c => c.name) : (u.classes || []);
  if (!classes.includes(ui.cls)) ui.cls = (u.homeroom && classes.includes(u.homeroom)) ? u.homeroom : classes[0];
  const list = S.studentsOf(ui.cls), noPhoto = list.filter(s => !(s.photo && s.photo.ok));
  const canWarn = list.length && (u.role === 'admin' || ui.cls === u.homeroom);
  const home = ui.cls === u.homeroom;
  const right = `<label class="inl">Класс <select data-act="cls">${classes.map(c => `<option ${c === ui.cls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`;
  return `${head('Ученики', ui.cls, `Фото профиля: <b>${list.length - noPhoto.length}</b> из ${list.length}${home ? ' · вы классный руководитель' : ''}`, right)}
  ${canWarn && noPhoto.length ? `<div class="banner"><div><b>${noPhoto.length} без подходящего фото</b><p>Отправьте ученикам и родителям уведомление с требованиями.</p></div><button class="btn blue" data-act="warn-class">⚠ Предупредить всех</button></div>` : ''}
  ${ui.codeBox ? `<div class="codebox"><div><small>${esc(ui.codeBox.what)}</small><b>${esc(ui.codeBox.code)}</b></div><button class="btn light" data-act="copy" data-v="${esc(ui.codeBox.code)}">Скопировать</button><small>Действует ограниченное время, использовать можно один раз (родителям — два).</small></div>` : ''}
  <div class="stgrid">${list.map(s => { const has = s.photo && s.photo.ok;
    return `<div class="stc">${avatar(s, 64)}<div class="stc-b"><b>${esc(s.name)}</b><small class="${has ? 'okc' : 'badc'}">${has ? '✓ фото принято' : '⚠ нет фото'}${s.accId ? ' · есть аккаунт' : ''}</small>
      <div class="stc-a">${S.can.readDossier(s.id) ? `<a class="btn sm ghost" href="#/dossier/${s.id}">Дело</a>` : ''}${S.can.editPhoto(s.id) ? `<button class="btn sm ghost" data-act="photo-open" data-sid="${s.id}">Фото</button>` : ''}${S.can.warnPhoto(s.id) && !has ? `<button class="btn sm" data-act="warn-one" data-sid="${s.id}">⚠ Предупредить</button>` : ''}
      ${(u.role === 'admin' || (u.role === 'teacher' && S.isHomeroomOf(s.id))) && S.isLive() ? `<button class="btn sm ghost" data-act="inv-student" data-sid="${s.id}">Код ученика</button><button class="btn sm ghost" data-act="inv-parent" data-sid="${s.id}">Код родителя</button>` : ''}</div></div></div>`; }).join('') || '<p class="muted">В классе пока нет учеников.</p>'}</div>`;
}

// ================= Дело =================
const dosOpen = {};
export function dossierView(sid) {
  const stu = S.student(sid);
  if (!stu) return `<div class="card"><p>Ученик не найден.</p><a class="btn ghost" href="#/">← Назад</a></div>`;
  if (!S.can.readDossier(sid)) return `<div class="card lock"><div class="big-ic">🔒</div><h2>Нет доступа</h2><p>«Дело» ученика открыто только для администрации школы (чтение), родителей и классного руководителя (редактирование). Ученикам и остальным учителям оно недоступно.</p><a class="btn ghost" href="#/">← На главную</a></div>`;
  if (S.isLive() && !dosOpen[sid]) { dosOpen[sid] = 1; S.loadDossier(sid).catch(() => {}); }
  const edit = S.can.editDossier(sid), d = S.state().dossier[sid] || {}, docs = S.state().docs[sid] || {}, recs = S.state().records[sid] || [];
  const grade = gradeOf(stu.cls), ro = edit ? '' : 'readonly disabled';
  const applicable = DOC_TYPES.filter(x => x.req === 'all' || (x.req === '14+' && grade >= 8) || (x.req === '10+' && grade >= 10) || x.req === 'transfer' || x.req === 'opt');
  const must = DOC_TYPES.filter(x => x.req === 'all'), have = must.filter(x => docs[x.id] && docs[x.id].status === 'have').length;
  const back = S.me().role === 'parent' ? 'parent' : S.me().role === 'teacher' ? 'teacher/students' : 'admin/students';
  return `<a class="back" href="#/${back}">← Назад</a>
  <div class="dos-head"><div class="dh-l">${avatar(stu, 84)}<div><h1 class="dh-n">${esc(stu.name)}</h1><p class="sub">${esc(stu.cls)} класс · ${stu.birth ? 'родился(ась) ' + esc(stu.birth) + ' · ' : ''}${esc(S.state().school ? S.state().school.name : '')}</p></div></div>
    <div class="acc ${edit ? 'edit' : 'read'}"><b>${edit ? '✎ Можно редактировать' : '👁 Только чтение'}</b><small>Чтение: администрация · Редактирование: родители и классный руководитель · Ученик: нет доступа</small></div></div>
  <div class="grid2">
   <section class="card"><h2 class="tp">Характеристика</h2><textarea id="dos-char" rows="6" maxlength="3000" placeholder="${edit ? 'Кратко: успехи, интересы, особенности, рекомендации…' : ''}" ${ro}>${esc(d.characteristic || '')}</textarea>
     ${edit ? '<div class="btns"><button class="btn blue" data-act="dos-save-char">Сохранить характеристику</button></div>' : ''}
     ${d.updated ? `<small class="muted">Обновлено ${dtFmt(d.updated)}</small>` : ''}</section>
   <section class="card"><h2 class="tp">Личные данные</h2>
     <label class="fld"><span>Адрес проживания</span><input data-dos="address" value="${esc(d.address || '')}" ${ro}></label>
     <label class="fld"><span>ПИН (14 цифр)</span><input data-dos="pin" inputmode="numeric" maxlength="14" pattern="[0-9]{14}" value="${esc(d.pin || '')}" ${ro}></label>
     <label class="fld"><span>Группа здоровья (физкультура)</span><select data-dos="health" ${ro}>${HEALTH_GROUPS.map(h => `<option ${h === (d.health || '') ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>
     <label class="fld"><span>Семья</span><input data-dos="family" value="${esc(d.family || '')}" ${ro} placeholder="Состав семьи, законные представители"></label></section>
  </div>
  <section class="card docs"><h2 class="tp">Документы дела</h2>
    <div class="prog"><div class="bar"><i style="width:${Math.round(have / must.length * 100)}%"></i></div><b>${have} из ${must.length}</b> <small>обязательных собрано</small></div>
    ${docRequestBox(sid, must, docs, edit)}
    <div class="dtable">${applicable.map(x => { const v = docs[x.id] || { status: 'missing' };
      return `<div class="drow ${v.status}"><div class="dn"><b>${esc(x.ru)}</b><small class="req ${x.req}">${REQ_LABEL[x.req]}</small></div>
      <select data-doc="${x.id}" data-f="status" ${ro} aria-label="Статус"><option value="missing" ${v.status === 'missing' ? 'selected' : ''}>Нет</option><option value="have" ${v.status === 'have' ? 'selected' : ''}>Есть</option><option value="na" ${v.status === 'na' ? 'selected' : ''}>Не требуется</option></select>
      <input data-doc="${x.id}" data-f="number" placeholder="№ документа" value="${esc(v.number || '')}" ${ro} aria-label="Номер">
      <input data-doc="${x.id}" data-f="date" type="date" value="${esc(v.date || '')}" ${ro} aria-label="Дата выдачи">
      <div class="dfile">${v.file ? `<button class="btn sm ghost" data-act="doc-open" data-t="${x.id}">📎 Открыть</button>` : ''}${edit ? `<label class="btn sm ghost filebtn">${v.file ? 'Заменить' : '⬆ Скан'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-docfile="${x.id}" hidden></label>` : ''}</div></div>`; }).join('')}</div>
    <p class="muted src">Перечень составлен по порядку приёма в школы Бишкека и типовому положению о ведении личных дел учащихся; точный список уточняйте в вашей школе. Сканы хранятся в закрытом хранилище и доступны только тем, кому открыто «дело».</p></section>
  <section class="card"><h2 class="tp">Записи в деле</h2>
    ${edit ? `<form class="recform" data-form="record"><select name="kind">${Object.entries(REC_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input name="text" required minlength="3" maxlength="300" placeholder="Что записать"><input name="date" type="date" value="${todayISO()}"><button class="btn blue" type="submit">Добавить</button></form>` : ''}
    ${recs.map(r => `<div class="row"><div><b>${esc(r.text)}</b><small>${esc(REC_KINDS[r.kind] || r.kind)} · ${esc(r.date)}</small></div>${edit ? `<button class="ibtn sm" data-act="rec-del" data-id="${r.id}" aria-label="Удалить запись">✕</button>` : ''}</div>`).join('') || '<p class="muted">Записей пока нет.</p>'}</section>`;
}

// ================= Действия =================
export async function act(name, el) {
  switch (name) {
    case 'photo-open': ui.photo = { sid: el.dataset.sid, state: 'pick' }; rerender(); return true;
    case 'photo-close': if (ui.photo && ui.photo.url) URL.revokeObjectURL(ui.photo.url); ui.photo = null; rerender(); return true;
    case 'photo-again': ui.photo.state = 'pick'; ui.photo.res = null; rerender(); return true;
    case 'photo-save': {
      const p = ui.photo; if (!p || !p.res || !p.res.ok) return true;
      p.saving = true; rerender();
      try { await S.setPhoto(p.sid, p.res.blob, p.res.meta); toast('Фото профиля сохранено', 'ok'); if (p.url) URL.revokeObjectURL(p.url); ui.photo = null; }
      catch (e) { p.saving = false; p.err = e.message; p.state = 'pick'; toast(e.message, 'warn'); }
      rerender(); return true;
    }
    case 'notif-read': S.readNotif(el.dataset.id); return true;
    case 'notif-all': S.readAllNotifs(); return true;
    case 'warn-one': try { const r = await S.warnPhoto(el.dataset.sid); toast(r.sent ? `Предупреждение отправлено (${r.sent})` : 'У ученика и родителей ещё нет аккаунтов — передайте код входа', r.sent ? 'ok' : 'warn'); } catch (e) { toast(e.message, 'warn'); } return true;
    case 'warn-class': try { const r = await S.warnPhotoClass(ui.cls); toast(`Предупреждено учеников: ${r.students}, сообщений: ${r.sent}`, r.sent ? 'ok' : 'warn'); } catch (e) { toast(e.message, 'warn'); } return true;
    case 'inv-student': case 'inv-parent': {
      try { const iv = await S.createInvite({ role: name === 'inv-student' ? 'student' : 'parent', sid: el.dataset.sid }); ui.codeBox = { code: iv.code, what: `${name === 'inv-student' ? 'Код ученика' : 'Код родителя'} · ${S.student(el.dataset.sid).name}` }; rerender(); }
      catch (e) { toast(e.message, 'warn'); } return true;
    }
    case 'copy': await copyText(el.dataset.v); toast('Скопировано', 'ok'); return true;
    case 'dos-save-char': { const sid = location.hash.split('/')[2]; S.saveDossier(sid, { characteristic: document.getElementById('dos-char').value }); toast('Характеристика сохранена', 'ok'); S.flushQueue(); return true; }
    case 'doc-open': { const sid = location.hash.split('/')[2]; try { const u = await S.openDocFile(sid, el.dataset.t); if (u) window.open(u, '_blank'); else toast('В демо-режиме файлы не хранятся', 'warn'); } catch (e) { toast(e.message, 'warn'); } return true; }
    case 'rec-del': S.delRecord(location.hash.split('/')[2], el.dataset.id); S.flushQueue(); return true;
  }
  return false;
}
export function onChange(el) {
  const sid = location.hash.split('/')[2];
  if (el.matches('[data-photo]')) { onPhotoFile(el); return true; }
  if (el.dataset.dos) { S.saveDossier(sid, { [el.dataset.dos]: el.value.trim() }); S.flushQueue(); toast('Сохранено', 'ok'); return true; }
  if (el.dataset.doc) { S.setDoc(sid, el.dataset.doc, { [el.dataset.f]: el.value }); S.flushQueue(); return true; }
  if (el.dataset.docfile) { const f = el.files[0]; if (f) S.uploadDocFile(sid, el.dataset.docfile, f).then(() => toast('Скан загружен', 'ok')).catch(e => toast(e.message, 'warn')); return true; }
  return false;
}
function docRequestBox(sid, must, docs, edit) {
  const u = S.me(); if (!u || u.role !== 'admin') return '';
  const miss = must.filter(x => !docs[x.id] || docs[x.id].status === 'missing'), hr = S.homeroomOf(sid);
  if (!miss.length) return '<p class="okline">✓ Все обязательные документы собраны</p>';
  return `<form class="docreq noprint" data-form="doc-request"><input type="hidden" name="sid" value="${sid}"><b>Не хватает: ${miss.map(x => esc(x.ru || x.name || x.id)).join(', ')}</b>
    <small>${hr ? 'Классный руководитель: ' + esc(hr.name) : 'Классный руководитель не назначен'}. Вы не меняете дело — вы просите классного руководителя получить документы от семьи.</small>
    <div class="inl"><input name="note" maxlength="300" placeholder="Комментарий (необязательно), например: «до пятницы»"><button class="btn blue sm" type="submit" ${hr ? '' : 'disabled'}>✉ Написать классному руководителю</button></div></form>`;
}
export function submit(form, fd) {
  if (form.dataset.form === 'doc-request') { const sid = String(fd.get('sid')), docs = S.state().docs[sid] || {};
    const miss = DOC_TYPES.filter(x => x.req === 'all' && (!docs[x.id] || docs[x.id].status === 'missing')).map(x => x.ru || x.name || x.id);
    S.requestDocuments(sid, miss, String(fd.get('note') || '').trim()).then(r => toast('Сообщение отправлено: ' + r.to, 'ok')).catch(e => toast(e.message, 'warn')); return true; }
  if (form.dataset.form === 'record') { const sid = location.hash.split('/')[2]; S.addRecord(sid, { kind: fd.get('kind'), text: String(fd.get('text')).trim(), date: fd.get('date') }); S.flushQueue(); toast('Запись добавлена', 'ok'); return true; }
  return false;
}
