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

const coin = (n, cls = '') => `<span class="altyn ${cls}" aria-hidden="true"><i></i></span>`;
const money = n => `<b class="amt">${n}</b> ${coin(n)}`;

// ---------- ученик / родитель ----------
export function studentPage() {
  const u = S.state().session, parent = u.role === 'parent', sid = parent ? u.child : u.id;
  const R = load('state:' + sid, async () => need(await V.call('coin_state', parent ? { p_sid: sid } : {}))), w = wait(R);
  if (w) return head('Алтын', '', 'Внутренняя валюта школы') + w;
  const x = X();
  const items = R.items.map(it => {
    const left = it.limit_n > 0 ? it.limit_n - it.used : null, disabled = parent || it.price > R.balance || (left !== null && left <= 0);
    const owned = it.kind === 'cosmetic' && R.unlocked.includes(it.id);
    return `<article class="shopc ${owned ? 'owned' : ''}"><div class="se" aria-hidden="true">${esc(it.emoji)}</div><div class="sb"><h3>${esc(it.ru)}</h3><p>${esc(it.descr || '')}</p>
      <small class="muted">${KIND[it.kind] || ''}${left !== null ? ` · осталось ${Math.max(0, left)} из ${it.limit_n} за ${it.limit_days >= 365 ? 'всё время' : it.limit_days + ' дн.'}` : ''}${it.approver === 'auto' ? ' · сразу' : it.approver === 'homeroom' ? ' · решает классный руководитель' : ' · решает учитель'}</small></div>
      <div class="sf">${owned ? '<span class="cstat ok">открыто</span>' : `<span class="price">${money(it.price)}</span>${parent ? '' : `<button class="btn ${disabled ? '' : 'blue'} sm" data-act="coin-open" data-id="${it.id}" ${disabled ? 'disabled' : ''}>${it.price > R.balance ? 'Не хватает' : left !== null && left <= 0 ? 'Лимит' : it.approver === 'auto' ? 'Открыть' : 'Запросить'}</button>`}`}</div></article>`;
  }).join('');
  const reqs = R.requests.map(r => `<div class="row"><div><b>${esc(r.emoji || '')} ${esc(r.item || r.kind)}</b>${r.subject ? ` · ${esc(sjName(r.subject))}` : ''}${r.for_date ? ` · ${dmy(r.for_date)}` : ''}<small class="muted">${dtFmt(r.at)} · ${r.cost} алт.${r.reason ? ` · «${esc(r.reason)}»` : ''}${r.note ? ` · ответ: ${esc(r.note)}` : ''}</small></div><div class="cbtns">${stp(r.status)}${!parent && r.status === 'pending' ? `<button class="ibtn sm" data-act="coin-cancel" data-id="${r.id}">Отозвать</button>` : ''}</div></div>`).join('');
  const led = R.ledger.slice(0, 14).map(l => `<div class="row lg"><div><b>${esc(l.note || l.kind)}</b><small class="muted">${dtFmt(l.at)}</small></div><b class="${l.delta > 0 ? 'plus' : 'minus'}">${l.delta > 0 ? '+' : ''}${l.delta}</b></div>`).join('');
  const it = x.item && R.items.find(i => i.id === x.item);
  return `${head('Алтын', '', 'Зарабатывайте за учёбу, тратьте с умом')}
  <section class="card dark purse"><div class="pc"><div class="bigcoin" aria-hidden="true"><i></i></div><div><small>${parent ? 'Баланс ребёнка' : 'Ваш баланс'}</small><div class="bal" id="bal" aria-live="polite">${R.balance}</div><small>заработано ${R.earned} · потрачено ${R.spent}</small></div></div>
    <p class="how"><b>Как зарабатывать:</b> оценки «5» и «4», домашние задания в срок, достижения, награды учителя. Не больше 40 алтынов в день — чтобы не гнаться за числом, а учиться.</p></section>
  <h2 class="sec">Магазин</h2><div class="shop">${items}</div>
  ${!parent ? transferCard() : ''}
  <div class="grid2"><section class="card"><h3>Заявки</h3>${reqs || '<p class="muted">Заявок пока нет.</p>'}</section><section class="card"><h3>История</h3>${led || '<p class="muted">Пока пусто.</p>'}</section></div>
  ${it ? buyModal(it, R) : ''}`;
}
function transferCard() {
  return `<section class="card"><h3>Перевести другу</h3><p class="muted">До 30 алтынов за раз, по @username из «Үн» — только внутри вашей школы.</p>
    <form data-form="coin-transfer" class="inline"><label class="fld"><span>@username</span><input name="to" placeholder="например, aidana_k" autocomplete="off" required></label><label class="fld"><span>Сколько</span><input name="amount" type="number" min="1" max="30" value="5" required></label><button class="btn blue" type="submit">Перевести</button></form></section>`;
}
function buyModal(it, R) {
  const needDate = ['skip_lesson', 'skip_day', 'extra_time'].includes(it.kind), f = X().form;
  const today = todayISO();
  return `<div class="modal-bg" data-act="coin-close"></div><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(it.ru)}"><button class="ibtn close" data-act="coin-close" aria-label="Закрыть">✕</button>
  <h2>${esc(it.emoji)} ${esc(it.ru)}</h2><p>${esc(it.descr || '')}</p><p class="price lg">${money(it.price)} <small class="muted">у вас ${R.balance}</small></p>
  <form data-form="coin-buy" data-item="${it.id}">
    ${it.kind === 'skip_lesson' || it.kind === 'extra_time' || it.kind === 'retake' ? `<label class="fld"><span>Предмет</span><select name="subj" required><option value="">— выберите —</option>${studentSubjects().map(s => `<option value="${s}" ${f.subj === s ? 'selected' : ''}>${esc(sjName(s))}</option>`).join('')}</select></label>` : ''}
    ${needDate ? `<label class="fld"><span>На какую дату</span><input type="date" name="date" min="${today}" max="${addDays(today, 14)}" value="${esc(f.date || '')}" required></label>` : ''}
    ${it.needs_reason ? `<label class="fld"><span>Причина (честно и по делу)</span><textarea name="reason" rows="3" minlength="10" maxlength="400" placeholder="Например: запись к врачу в 11:30, справка будет" required>${esc(f.reason || '')}</textarea></label>` : ''}
    <p class="muted">${it.approver === 'auto' ? 'Применится сразу.' : 'Решение примет педагог. Если откажут — алтыны вернутся автоматически.'}</p>
    <div class="nav-row"><button type="button" class="btn ghost" data-act="coin-close">Отмена</button><button class="btn blue" type="submit">${it.approver === 'auto' ? 'Открыть' : 'Отправить заявку'} · ${it.price}</button></div></form></div>`;
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
