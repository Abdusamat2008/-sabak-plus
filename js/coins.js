// «Алтын» — внутренняя валюта школы: ученик зарабатывает за учёбу и тратит на отпрашивание, пересдачу, привилегии и темы профиля.
import * as S from './store.js';
import * as V from './v8data.js';
import { esc, ui, head, toast, plural, sjName, dtFmt } from './common.js';
import { dmy, todayISO, addDays } from './calc.js';

const rerender = () => window.__render && window.__render();
const cache = {};
const fresh = k => { if (k) delete cache[k]; else Object.keys(cache).forEach(x => delete cache[x]); };
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
const wait = r => r === 'loading' ? '<div class="card"><p class="muted" role="status">Загружаем…</p></div>' : (r && r.err) ? `<div class="card"><p>⚠️ ${esc(r.err)}</p></div>` : null;
export const COIN_ERR = {
  no_funds: 'Не хватает алтынов', reason_short: 'Опишите причину подробнее (не короче 10 символов)', subject_required: 'Выберите предмет', date_required: 'Выберите дату', date_range: 'Дата — от сегодня до 14 дней вперёд',
  weekend: 'На выходные отпрашиваться не нужно', duplicate: 'На эту дату уже есть заявка', limit: 'Лимит по этой услуге исчерпан — попробуйте позже', no_item: 'Услуга недоступна', forbidden: 'Нет доступа', not_pending: 'Заявка уже рассмотрена',
  note_required: 'При отказе напишите причину — ученик её увидит', amount: 'Сумма вне допустимых пределов', no_user: 'Такой @username в вашей школе не найден', self: 'Нельзя переводить самому себе', need_profile: 'Сначала создайте профиль в «Үн» — перевод идёт по @username',
  banned: 'Профиль временно ограничен модератором', price: 'Цена от 1 до 1000', name: 'Слишком короткое название', not_deployed: 'Сервер ещё не обновлён: выполните schema_v6.sql в Supabase', network: 'Нет связи', teacher_class_only: 'Можно награждать только учеников своих классов',
};
const E = r => COIN_ERR[r && r.error] || (r && r.error) || 'Ошибка';
const need = r => { if (!r || !r.ok) throw new Error(E(r)); return r; };
const X = () => (ui.coin = ui.coin || { item: null, tab: 'pending', form: {} });
const st$ = { pending: ['ждёт решения', 'wait'], approved: ['одобрено', 'ok'], rejected: ['отказано', 'bad'], cancelled: ['отменено', ''] };
const stp = s => `<span class="cstat ${st$[s][1]}">${st$[s][0]}</span>`;
const KIND = { skip_lesson: 'Урок', skip_day: 'День', hw_pass: 'ДЗ', retake: 'Пересдача', extra_time: '+10 мин', perk: 'Привилегия', cosmetic: 'Профиль' };

const coin = (n, cls = '') => `<img class="altyn ${cls}" src="/img/altyn.svg" alt="" aria-hidden="true" width="20" height="20">`;
const money = n => `<b class="amt">${n}</b> ${coin(n)}`;
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const SX = () => (ui.mb = ui.mb || { tab: 'home', hide: lsGet('sabak.mb.hide', false), flt: 'all', cat: 'all', sheet: null, tr: { to: '', amount: 5, note: '', step: 'form' }, receipt: null, goalEdit: false });
const DAYN = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const dayKey = iso => new Date(iso).toLocaleDateString('sv');
const dayLabel = iso => { const d = dayKey(iso), t = new Date().toLocaleDateString('sv'), y = new Date(Date.now() - 864e5).toLocaleDateString('sv'); return d === t ? 'Сегодня' : d === y ? 'Вчера' : new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };
const timeOf = iso => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const OPK = { transfer_out: ['Перевод', 'send'], transfer_in: ['Перевод', 'recv'], purchase: ['Платёж', 'pay'], refund: ['Возврат', 'recv'], award: ['Награда', 'earn'], grade: ['Оценка', 'earn'], homework: ['Домашка', 'earn'], achievement: ['Достижение', 'earn'] };
const opIcon = l => { const t = (OPK[l.kind] || [0, l.delta > 0 ? 'earn' : 'pay'])[1]; return `<span class="op-i ${t}" aria-hidden="true">${({ send: '↗', recv: '↙', pay: '−', earn: '+' })[t]}</span>`; };
const opTitle = l => l.note || (OPK[l.kind] || ['Операция'])[0];
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

function mbCard(R, parent) {
  const x = SX();
  return `<section class="mb-card" aria-label="Счёт Алтын"><div class="mb-top"><span class="mb-name">Алтын · счёт ученика</span><button class="mb-eye" data-act="mb-hide" aria-pressed="${x.hide}" aria-label="${x.hide ? 'Показать баланс' : 'Скрыть баланс'}">${x.hide ? '👁‍🗨 Показать' : '🙈 Скрыть'}</button></div>
    <div class="mb-bal-row"><img class="mb-coin" src="/img/altyn.svg" alt="" width="64" height="64"><div><small>${parent ? 'Баланс ребёнка' : 'Доступно'}</small><div class="mb-bal" aria-live="polite">${x.hide ? '•••' : R.balance}<span> алт.</span></div></div></div>
    <div class="mb-sub"><span>Заработано <b>${x.hide ? '••' : R.earned}</b></span><span>Потрачено <b>${x.hide ? '••' : R.spent}</b></span></div></section>`;
}
function quick(parent) {
  const q = [['pay', '🛍', 'Платежи'], ['send', '↗', 'Перевод'], ['hist', '🧾', 'История'], ['goal', '🎯', 'Цель']].filter(a => !(parent && a[0] === 'send'));
  return `<nav class="mb-quick" aria-label="Быстрые действия">${q.map(([k, i, n]) => `<button data-act="mb-go" data-v="${k}"><span class="qi" aria-hidden="true">${i}</span>${n}</button>`).join('')}</nav>`;
}
function opRow(l) { return `<button class="op" data-act="mb-receipt" data-id="${esc(l.id || l.at)}">${opIcon(l)}<span class="op-t"><b>${esc(opTitle(l))}</b><small>${timeOf(l.at)}</small></span><b class="op-a ${l.delta > 0 ? 'plus' : 'minus'}">${signed(l.delta)}</b></button>`; }
function grouped(list) {
  const g = {}; list.forEach(l => (g[dayKey(l.at)] = g[dayKey(l.at)] || []).push(l));
  return Object.keys(g).sort().reverse().map(k => `<div class="op-day"><h4>${dayLabel(g[k][0].at)}<span>${signed(g[k].reduce((a, l) => a + l.delta, 0))}</span></h4>${g[k].map(opRow).join('')}</div>`).join('');
}
function weekBars(R) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5)), keys = days.map(d => d.toLocaleDateString('sv'));
  const inc = keys.map(k => R.ledger.filter(l => dayKey(l.at) === k && l.delta > 0).reduce((a, l) => a + l.delta, 0)), out = keys.map(k => R.ledger.filter(l => dayKey(l.at) === k && l.delta < 0).reduce((a, l) => a - l.delta, 0));
  const mx = Math.max(10, ...inc, ...out);
  return `<div class="wk" role="img" aria-label="Доходы и расходы за 7 дней">${days.map((d, i) => `<div class="wk-c"><div class="wk-b"><i class="in" style="height:${inc[i] / mx * 100}%"></i><i class="out" style="height:${out[i] / mx * 100}%"></i></div><small>${DAYN[d.getDay()]}</small></div>`).join('')}</div><p class="wk-l"><span class="in">■</span> пришло ${inc.reduce((a, b) => a + b, 0)} <span class="out">■</span> ушло ${out.reduce((a, b) => a + b, 0)}</p>`;
}
const goalKey = sid => 'sabak.mb.goal.' + sid;
function goalCard(R, sid, parent) {
  const g = lsGet(goalKey(sid), null), x = SX();
  if (x.goalEdit && !parent) return `<section class="mb-sec" id="mb-goal"><h3>Цель накопления</h3><form data-form="mb-goal" class="mb-form"><label class="fld"><span>На что копим</span><input name="name" maxlength="40" value="${esc(g ? g.name : '')}" placeholder="Например: пересдача по физике" required></label><label class="fld"><span>Сколько нужно</span><input name="target" type="number" min="1" max="1000" value="${g ? g.target : 50}" required></label><div class="nav-row"><button type="button" class="btn ghost" data-act="mb-goal-x">Отмена</button><button class="btn blue" type="submit">Сохранить</button></div></form></section>`;
  if (!g) return `<section class="mb-sec" id="mb-goal"><h3>Цель накопления</h3><p class="muted">Поставьте цель, и приложение покажет, сколько осталось.</p>${parent ? '' : '<button class="btn blue sm" data-act="mb-goal-edit">Поставить цель</button>'}</section>`;
  const p = Math.min(100, Math.round(R.balance * 100 / g.target));
  return `<section class="mb-sec" id="mb-goal"><h3>Цель: ${esc(g.name)}</h3><div class="mb-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${g.target}" aria-valuenow="${Math.min(R.balance, g.target)}"><i style="width:${p}%"></i></div><p class="muted">${R.balance >= g.target ? 'Цель достигнута! Можно тратить.' : `${R.balance} из ${g.target} · осталось ${g.target - R.balance}`}</p>${parent ? '' : '<div class="cbtns"><button class="btn ghost sm" data-act="mb-goal-edit">Изменить</button><button class="btn ghost sm" data-act="mb-goal-del">Убрать</button></div>'}</section>`;
}
const CATS = [['all', 'Все'], ['skip', 'Отпроситься'], ['study', 'Учёба'], ['profile', 'Профиль'], ['perk', 'Привилегии']];
const catOf = it => ({ skip_lesson: 'skip', skip_day: 'skip', extra_time: 'study', hw_pass: 'study', retake: 'study', cosmetic: 'profile', perk: 'perk' })[it.kind] || 'perk';
function payTab(R, parent) {
  const x = SX(), list = R.items.filter(it => x.cat === 'all' || catOf(it) === x.cat);
  const tiles = list.map(it => {
    const left = it.limit_n > 0 ? it.limit_n - it.used : null, owned = it.kind === 'cosmetic' && R.unlocked.includes(it.id), short = it.price > R.balance, lim = left !== null && left <= 0;
    return `<button class="pay ${owned ? 'owned' : ''}" data-act="coin-open" data-id="${it.id}" ${parent || owned || lim ? 'disabled' : ''}><span class="pe-i" aria-hidden="true">${esc(it.emoji)}</span><b>${esc(it.ru)}</b><small>${owned ? 'Открыто' : lim ? 'Лимит исчерпан' : short ? `Не хватает ${it.price - R.balance}` : it.approver === 'auto' ? 'Сразу' : 'Нужно одобрение'}</small><span class="pp">${owned ? '✓' : money(it.price)}</span></button>`;
  }).join('');
  return `<div class="chips" role="tablist" aria-label="Категории">${CATS.map(([k, n]) => `<button role="tab" aria-selected="${x.cat === k}" class="${x.cat === k ? 'on' : ''}" data-act="mb-cat" data-v="${k}">${n}</button>`).join('')}</div><div class="pay-grid">${tiles || '<p class="muted">В этой категории пока ничего нет.</p>'}</div>`;
}
const recents = () => lsGet('sabak.mb.recent', []);
function sendTab(R) {
  const x = SX(), t = x.tr, rec = recents();
  if (t.step === 'done') return `<section class="mb-receipt ok"><div class="ok-i" aria-hidden="true">✓</div><h3>Перевод выполнен</h3><div class="big">${t.amount} ${coin()}</div><dl><dt>Кому</dt><dd>@${esc(t.to)}</dd>${t.note ? `<dt>Комментарий</dt><dd>${esc(t.note)}</dd>` : ''}<dt>Остаток</dt><dd>${t.left} алт.</dd><dt>Время</dt><dd>${new Date().toLocaleString('ru-RU')}</dd></dl><div class="nav-row"><button class="btn ghost" data-act="mb-tr-new">Ещё перевод</button><button class="btn blue" data-act="mb-go" data-v="home">Готово</button></div></section>`;
  if (t.step === 'confirm') return `<section class="mb-receipt"><h3>Проверьте перевод</h3><div class="big">${t.amount} ${coin()}</div><dl><dt>Кому</dt><dd>@${esc(t.to)}</dd>${t.note ? `<dt>Комментарий</dt><dd>${esc(t.note)}</dd>` : ''}<dt>Комиссия</dt><dd>0</dd><dt>Остаток после</dt><dd>${R.balance - t.amount} алт.</dd></dl><div class="nav-row"><button class="btn ghost" data-act="mb-tr-back">Изменить</button><button class="btn blue" data-act="mb-tr-send">Подтвердить</button></div></section>`;
  return `<section class="mb-sec"><h3>Кому перевести</h3>${rec.length ? `<div class="recent" aria-label="Недавние получатели">${rec.map(u => `<button data-act="mb-tr-pick" data-v="${esc(u)}"><span class="rav" aria-hidden="true">${esc(u[0].toUpperCase())}</span>@${esc(u)}</button>`).join('')}</div>` : ''}
    <form data-form="mb-tr" class="mb-form"><label class="fld"><span>@username из «Үн»</span><input name="to" value="${esc(t.to)}" placeholder="например, aidana_k" autocomplete="off" autocapitalize="none" required></label>
    <div class="fld"><span>Сколько алтынов</span><div class="amts">${[1, 5, 10, 20, 30].map(n => `<button type="button" class="${t.amount === n ? 'on' : ''}" data-act="mb-amt" data-v="${n}" ${n > R.balance ? 'disabled' : ''}>${n}</button>`).join('')}</div><input name="amount" type="number" min="1" max="30" value="${t.amount}" required></div>
    <label class="fld"><span>Комментарий (необязательно)</span><input name="note" maxlength="60" value="${esc(t.note)}" placeholder="За помощь с геометрией"></label>
    <p class="muted">Лимит — 30 алтынов за раз. Переводы работают только внутри вашей школы, без комиссии.</p><button class="btn blue wide" type="submit">Далее</button></form></section>`;
}
function histTab(R) {
  const x = SX(), list = R.ledger.filter(l => x.flt === 'all' || (x.flt === 'in' ? l.delta > 0 : l.delta < 0));
  return `<div class="chips" role="tablist" aria-label="Фильтр операций">${[['all', 'Все'], ['in', 'Доходы'], ['out', 'Расходы']].map(([k, n]) => `<button role="tab" aria-selected="${x.flt === k}" class="${x.flt === k ? 'on' : ''}" data-act="mb-flt" data-v="${k}">${n}</button>`).join('')}</div>${grouped(list) || '<p class="muted">Операций нет.</p>'}`;
}
function homeTab(R, sid, parent) {
  const pend = R.requests.slice(0, 5);
  return `${pend.length ? `<section class="mb-sec"><h3>Заявки</h3>${pend.map(r => `<div class="op static"><span class="op-i pay" aria-hidden="true">${r.status === 'approved' ? '✓' : r.status === 'pending' ? '⏳' : '×'}</span><span class="op-t"><b>${esc(r.emoji || '')} ${esc(r.item || r.kind)}</b><small>${r.for_date ? dmy(r.for_date) + ' · ' : ''}${r.cost} алт.${r.note ? ' · ответ: ' + esc(r.note) : ''}</small></span>${stp(r.status)}${parent || r.status !== 'pending' ? '' : `<button class="ibtn sm" data-act="coin-cancel" data-id="${r.id}">Отозвать</button>`}</div>`).join('')}</section>` : ''}
  <section class="mb-sec"><div class="sec-h"><h3>Последние операции</h3><button class="linkb" data-act="mb-go" data-v="hist">Все</button></div>${R.ledger.slice(0, 5).map(opRow).join('') || '<p class="muted">Пока пусто. Получайте «5» и «4», сдавайте ДЗ вовремя.</p>'}</section>
  <section class="mb-sec"><h3>Неделя</h3>${weekBars(R)}</section>${goalCard(R, sid, parent)}
  <p class="how"><b>Как зарабатывать:</b> оценки «5» и «4», домашние задания в срок, достижения, награды учителя. Не больше 40 алтынов в день.</p>`;
}
function receiptModal(R) {
  const l = SX().receipt && R.ledger.find(z => String(z.id || z.at) === SX().receipt); if (!l) return '';
  return `<div class="modal-bg" data-act="mb-receipt-x"></div><div class="modal mb-sheet" role="dialog" aria-modal="true" aria-label="Квитанция"><button class="ibtn close" data-act="mb-receipt-x" aria-label="Закрыть">✕</button><div class="mb-receipt"><div class="ok-i" aria-hidden="true">${l.delta > 0 ? '↙' : '↗'}</div><h3>${esc(opTitle(l))}</h3><div class="big ${l.delta > 0 ? 'plus' : 'minus'}">${signed(l.delta)} ${coin()}</div><dl><dt>Тип</dt><dd>${(OPK[l.kind] || ['Операция'])[0]}</dd><dt>Дата</dt><dd>${new Date(l.at).toLocaleString('ru-RU')}</dd><dt>Статус</dt><dd>Проведена</dd></dl></div></div>`;
}

// ---------- ученик / родитель ----------
export function studentPage() {
  const u = S.state().session, parent = u.role === 'parent', sid = parent ? u.child : u.id;
  const R = load('state:' + sid, async () => need(await V.call('coin_state', parent ? { p_sid: sid } : {}))), w = wait(R);
  if (w) return head('Алтын', '', 'Счёт школьной валюты') + w;
  const x = SX(), it = X().item && R.items.find(i => i.id === X().item);
  const tabs = [['home', 'Главная'], ['pay', 'Платежи'], ...(parent ? [] : [['send', 'Переводы']]), ['hist', 'История']];
  const body = x.tab === 'pay' ? payTab(R, parent) : x.tab === 'send' ? sendTab(R) : x.tab === 'hist' ? histTab(R) : homeTab(R, sid, parent);
  return `<div class="mb">${head('Алтын', '', 'Зарабатывайте за учёбу, тратьте с умом')}${mbCard(R, parent)}${quick(parent)}
    <div class="mb-tabs" role="tablist" aria-label="Разделы">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${x.tab === k}" class="${x.tab === k ? 'on' : ''}" data-act="mb-go" data-v="${k}">${n}</button>`).join('')}</div><div class="mb-body">${body}</div></div>${it ? buyModal(it, R) : ''}${receiptModal(R)}`;
}
function buyModal(it, R) {
  const needDate = ['skip_lesson', 'skip_day', 'extra_time'].includes(it.kind), f = X().form;
  const today = todayISO();
  return `<div class="modal-bg" data-act="coin-close"></div><div class="modal mb-sheet" role="dialog" aria-modal="true" aria-label="${esc(it.ru)}"><button class="ibtn close" data-act="coin-close" aria-label="Закрыть">✕</button>
  <div class="sheet-h"><span class="pe-i lg" aria-hidden="true">${esc(it.emoji)}</span><div><h2>${esc(it.ru)}</h2><p class="muted">${esc(it.descr || '')}</p></div></div>
  <dl class="sum"><dt>Стоимость</dt><dd>${money(it.price)}</dd><dt>Баланс</dt><dd>${R.balance}</dd><dt>Останется</dt><dd><b>${R.balance - it.price}</b></dd></dl>
  <form data-form="coin-buy" data-item="${it.id}">
    ${it.kind === 'skip_lesson' || it.kind === 'extra_time' || it.kind === 'retake' ? `<label class="fld"><span>Предмет</span><select name="subj" required><option value="">— выберите —</option>${studentSubjects().map(s => `<option value="${s}" ${f.subj === s ? 'selected' : ''}>${esc(sjName(s))}</option>`).join('')}</select></label>` : ''}
    ${needDate ? `<label class="fld"><span>На какую дату</span><input type="date" name="date" min="${today}" max="${addDays(today, 14)}" value="${esc(f.date || '')}" required></label>` : ''}
    ${it.needs_reason ? `<label class="fld"><span>Причина (честно и по делу)</span><textarea name="reason" rows="3" minlength="10" maxlength="400" placeholder="Например: запись к врачу в 11:30, справка будет" required>${esc(f.reason || '')}</textarea></label>` : ''}
    <p class="muted">${it.approver === 'auto' ? 'Применится сразу.' : 'Решение примет педагог. Если откажут, алтыны вернутся автоматически.'}</p>
    <div class="nav-row"><button type="button" class="btn ghost" data-act="coin-close">Отмена</button><button class="btn blue" type="submit">${it.approver === 'auto' ? 'Оплатить' : 'Отправить заявку'} · ${it.price}</button></div></form></div>`;
}
function studentSubjects() { return S.SUBJECTS.map(x => x.id); }

// ---------- педагоги ----------
export function staffPage() {
  const x = X(), R = load('staff:' + x.tab, async () => need(await V.call('coin_staff', { p_status: x.tab }))), w = wait(R);
  const u = S.state().session, tabs = [['pending', 'Ждут решения'], ['approved', 'Одобрено'], ['rejected', 'Отказано'], ['all', 'Все']].map(([k, n]) => `<button class="tag ${x.tab === k ? 'on' : ''}" data-act="coin-tab" data-v="${k}">${n}</button>`).join('');
  const rows = w ? w : R.rows.map(r => `<article class="card req"><div class="rq-h"><div><b>${esc(r.emoji || '')} ${esc(r.item || r.kind)}</b> ${stp(r.status)}<br><span class="muted">${esc(r.student)}${r.cls ? ' · ' + esc(r.cls) : ''}${r.subject ? ' · ' + esc(sjName(r.subject)) : ''}${r.for_date ? ' · на ' + dmy(r.for_date) : ''}</span></div><div class="rq-m"><small>средний балл</small><b>${r.avg ?? '—'}</b></div><div class="rq-m"><small>Н за 30 дн.</small><b>${r.abs30}</b></div><div class="rq-m"><small>цена</small><b>${r.cost}</b></div></div>
    ${r.reason ? `<p class="quote">«${esc(r.reason)}»</p>` : ''}${r.note ? `<p class="muted">Ответ: ${esc(r.note)}</p>` : ''}
    ${r.status === 'pending' ? `<form data-form="coin-decide" data-id="${r.id}" class="inline"><input name="note" placeholder="Комментарий (при отказе обязателен)" maxlength="200" aria-label="Комментарий"><button class="btn blue sm" name="ok" value="1" type="submit">Одобрить</button><button class="btn sm" name="ok" value="0" type="submit">Отказать</button></form>` : ''}</article>`).join('') || '<div class="card"><p class="muted">Здесь пусто.</p></div>';
  const stud = S.state().students, cls = ui.cls, list = u.role === 'teacher' ? S.studentsOf(cls) : stud;
  return `${head('Заявки и награды', '', 'Алтыны школы')}<div class="ctl">${tabs}</div>${rows}
  <section class="card"><h3>Наградить алтынами</h3><p class="muted">За активность, помощь, победу в олимпиаде. До 50 за раз ученику, до 20 — всему классу.</p>
    <form data-form="coin-award" class="inline"><label class="fld"><span>Ученик</span><select name="sid">${u.role === 'teacher' ? `<option value="class">Весь класс ${esc(cls)}</option>` : ''}${list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label class="fld"><span>Алтынов</span><input name="amount" type="number" min="1" max="50" value="5" required></label><label class="fld grow"><span>За что</span><input name="note" maxlength="80" placeholder="Помог одноклассникам с задачей" required></label><button class="btn blue" type="submit">Выдать</button></form></section>`;
}
export function adminPage() {
  const R = load('admin', async () => need(await V.call('coin_admin'))), w = wait(R); if (w) return head('Алтыны школы', '', '') + w;
  const rows = R.items.map(i => `<form class="row ci" data-form="coin-item" data-id="${i.id}"><div><b>${esc(i.emoji)} ${esc(i.ru)}</b><small class="muted">${KIND[i.kind] || ''} · ${i.approver === 'auto' ? 'сразу' : i.approver === 'homeroom' ? 'классрук' : 'учитель'} · лимит ${i.limit_n || '∞'}</small></div>
    <div class="cbtns"><label class="fld sm"><span>Цена</span><input name="price" type="number" min="1" max="1000" value="${i.price}"></label><label class="chk"><input type="checkbox" name="enabled" ${i.enabled ? 'checked' : ''}> включено</label><button class="btn sm" type="submit">Сохранить</button></div></form>`).join('');
  return `${head('Алтыны школы', '', 'Магазин и обращение')}
  <div class="kpis"><div class="card kp"><small>В обращении</small><b>${R.stats.circulation}</b></div><div class="card kp"><small>Потрачено за 30 дней</small><b>${R.stats.spent_30d}</b></div><div class="card kp ${R.stats.pending ? 'alert' : ''}"><small>Заявок ждёт</small><b>${R.stats.pending}</b></div></div>
  <section class="card"><h3>Услуги</h3><p class="muted">Поставьте цену, отключите лишнее. Цена влияет только на новые заявки.</p>${rows}</section>
  <section class="card"><h3>Своя награда</h3><p class="muted">Например: «Выбор фильма на классный час», «Помощник учителя на день».</p>
    <form data-form="coin-newitem" class="inline"><label class="fld"><span>Эмодзи</span><input name="emoji" value="🎁" maxlength="4" size="3"></label><label class="fld grow"><span>Название</span><input name="ru" maxlength="60" required minlength="3"></label><label class="fld"><span>Цена</span><input name="price" type="number" min="1" max="1000" value="30" required></label><label class="fld"><span>Решает</span><select name="approver"><option value="teacher">учитель</option><option value="homeroom">классный руководитель</option><option value="auto">сразу</option></select></label><label class="fld grow"><span>Описание</span><input name="descr" maxlength="200"></label><button class="btn blue" type="submit">Добавить</button></form></section>`;
}

// ---------- действия ----------
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
export async function act(a, el) {
  const x = X();
  switch (a) {
    case 'coin-open': x.item = el.dataset.id; x.form = {}; rerender(); return true;
    case 'coin-close': x.item = null; rerender(); return true;
    case 'mb-hide': { const m = SX(); m.hide = !m.hide; lsSet('sabak.mb.hide', m.hide); rerender(); return true; }
    case 'mb-go': { const m = SX(); m.tab = el.dataset.v === 'goal' ? 'home' : el.dataset.v; if (m.tab !== 'send') m.tr = { to: '', amount: 5, note: '', step: 'form' }; m.goalEdit = el.dataset.v === 'goal' && !lsGet(goalKey(S.state().session.id), null); rerender(); if (el.dataset.v === 'goal') setTimeout(() => { const g = document.getElementById('mb-goal'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); else window.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
    case 'mb-cat': SX().cat = el.dataset.v; rerender(); return true;
    case 'mb-flt': SX().flt = el.dataset.v; rerender(); return true;
    case 'mb-receipt': SX().receipt = el.dataset.id; rerender(); return true;
    case 'mb-receipt-x': SX().receipt = null; rerender(); return true;
    case 'mb-amt': SX().tr.amount = Number(el.dataset.v); rerender(); return true;
    case 'mb-tr-pick': SX().tr.to = el.dataset.v; rerender(); return true;
    case 'mb-tr-back': SX().tr.step = 'form'; rerender(); return true;
    case 'mb-tr-new': SX().tr = { to: '', amount: 5, note: '', step: 'form' }; rerender(); return true;
    case 'mb-tr-send': await guard(async () => { const t = SX().tr; const r = need(await V.call('coin_transfer', { p_username: t.to, p_amount: t.amount, p_note: t.note || null })); t.step = 'done'; t.left = r.balance; lsSet('sabak.mb.recent', [t.to, ...recents().filter(u => u !== t.to)].slice(0, 5)); fresh(); rerender(); }); return true;
    case 'mb-goal-edit': SX().goalEdit = true; rerender(); return true;
    case 'mb-goal-x': SX().goalEdit = false; rerender(); return true;
    case 'mb-goal-del': lsSet(goalKey(S.state().session.id), null); rerender(); return true;
    case 'coin-tab': x.tab = el.dataset.v; rerender(); return true;
    case 'coin-cancel': await guard(async () => { need(await V.call('coin_cancel', { p_id: el.dataset.id })); fresh(); toast('Заявка отозвана, алтыны вернулись', 'ok'); rerender(); }); return true;
  }
  return false;
}
export async function submit(f, fd) {
  const k = f.dataset.form, v = n => String(fd.get(n) || '').trim();
  if (k === 'coin-buy') { await guard(async () => {
    const r = need(await V.call('coin_request', { p_item: f.dataset.item, p_subj: v('subj') || null, p_date: v('date') || null, p_reason: v('reason') || null }));
    X().item = null; fresh(); toast(r.status === 'approved' ? 'Готово! Применено сразу ✨' : 'Заявка отправлена педагогу', 'ok'); rerender(); }); return true; }
  if (k === 'mb-tr') { const t = SX().tr; t.to = v('to').replace(/^@/, ''); t.amount = Number(v('amount')); t.note = v('note');
    if (!t.to) return toast('Укажите @username', 'warn'), true; if (!(t.amount >= 1 && t.amount <= 30)) return toast(COIN_ERR.amount, 'warn'), true; t.step = 'confirm'; rerender(); return true; }
  if (k === 'mb-goal') { lsSet(goalKey(S.state().session.id), { name: v('name'), target: Math.max(1, Math.min(1000, Number(v('target')))) }); SX().goalEdit = false; rerender(); return true; }
  if (k === 'coin-transfer') { await guard(async () => { const to = v('to').replace(/^@/, ''); need(await V.call('coin_transfer', { p_username: to, p_amount: Number(v('amount')), p_note: null })); fresh(); toast('Перевод отправлен ✓', 'ok'); rerender(); }); return true; }
  if (k === 'coin-decide') { await guard(async () => { const approve = window.__coinBtn === '1'; need(await V.call('coin_decide', { p_id: f.dataset.id, p_approve: approve, p_note: v('note') || null })); fresh(); toast(approve ? 'Одобрено' : 'Отказ отправлен ученику', 'ok'); rerender(); }); return true; }
  if (k === 'coin-award') { await guard(async () => {
    const sid = v('sid'), amount = Number(v('amount')), note = v('note');
    if (sid === 'class') { const c = S.state().classes.find(c => c.name === ui.cls); need(await V.call('coin_award_class', { p_class: c && c.id, p_amount: amount, p_note: note })); }
    else need(await V.call('coin_award', { p_sid: sid, p_amount: amount, p_note: note }));
    toast('Алтыны выданы 🪙', 'ok'); f.reset(); }); return true; }
  if (k === 'coin-item') { await guard(async () => { need(await V.call('coin_item_set', { p_id: f.dataset.id, p_price: Number(v('price')), p_enabled: !!fd.get('enabled'), p_limit_n: null })); fresh('admin'); toast('Сохранено', 'ok'); }); return true; }
  if (k === 'coin-newitem') { await guard(async () => { need(await V.call('coin_item_add', { p_ru: v('ru'), p_emoji: v('emoji') || '🎁', p_price: Number(v('price')), p_descr: v('descr') || null, p_approver: v('approver') })); fresh('admin'); toast('Награда добавлена', 'ok'); rerender(); }); return true; }
  return false;
}
// кнопки «Одобрить/Отказать» — запоминаем, какая нажата (FormData не знает submitter в старых браузерах)
document.addEventListener('click', e => { const b = e.target.closest('form[data-form="coin-decide"] button[name="ok"]'); if (b) window.__coinBtn = b.value; }, true);
export { fresh as refresh };
