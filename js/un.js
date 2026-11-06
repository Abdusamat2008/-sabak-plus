// «Үн» («Голос») — мини-соцсеть школы. Изолирована по школам: ученик видит только свою ленту.
// Вход через профиль SABAK+ (свой @username, тема, обложка) или анонимно (псевдоним-зверь, автор скрыт даже от одноклассников).
import * as S from './store.js';
import * as V from './v8data.js';
import { esc, ui, head, toast } from './common.js';
import { route, go } from './common.js';

const rerender = () => window.__render && window.__render();
const cache = {}, fns = {};
// fresh(k): не сбрасываем на «Загружаем…», а тихо перезапрашиваем — старое остаётся на экране, пока не придёт новое
const fresh = k => {
  Object.keys(cache).filter(x => !k || x === k || x.startsWith(k + ':')).forEach(x => {
    if (x === 'me' || !fns[x] || cache[x] === 'loading') { delete cache[x]; return; }
    Promise.resolve().then(fns[x]).then(v => { cache[x] = v; rerender(); }).catch(() => {});
  });
};
function load(key, fn) {
  if (key in cache) return cache[key];
  fns[key] = fn; cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
export const UN_ERR = {
  links: 'Ссылки в «Үн» запрещены — так мы защищаем всех от мошенников', phone: 'Номера телефонов публиковать нельзя', blocked_word: 'В тексте есть запрещённое слово — перефразируйте', body: 'Напишите от 1 до 600 символов', rate: 'Слишком часто. Передохните минуту ☕',
  banned: 'Модератор временно ограничил ваши публикации', need_profile: 'Для этого нужен профиль SABAK+ — или публикуйте анонимно', username_format: '@username: латиницей, 5–32 символа, начинается с буквы, можно цифры и «_»', username_reserved: 'Это имя зарезервировано', username_taken: 'Этот @username уже занят',
  rename_cooldown: '@username можно менять раз в 7 дней', locked_theme: 'Премиум-темы открываются в магазине «Алтын»', name: 'Имя — от 2 до 32 символов', bio: 'О себе — до 140 символов', students_only: 'Профиль создают ученики', forbidden: 'Нет доступа', no_access: 'Для вашей роли «Үн» недоступен', disabled: 'Школа отключила «Үн»',
  media: 'Файл не подходит', not_found: 'Уже удалено', not_deployed: 'Сервер ещё не обновлён: выполните schema_v6.sql в Supabase', network: 'Нет связи', reveal_off: 'Раскрытие авторов выключено в настройках школы', word: 'Слово — от 3 до 40 символов', days: 'Выберите срок',
};
const need = r => { if (!r || !r.ok) throw new Error(UN_ERR[r && r.error] || (r && r.error) || 'Ошибка'); return r; };
const X = () => (ui.un = ui.un || { sort: 'new', anon: null, draft: '', media: null, cdraft: {}, open: {}, form: null, edit: false, mode: null, posting: false });
export const THEMES = {
  ocean: ['Океан', 'linear-gradient(135deg,#2352D8,#6E8DFF)'], sun: ['Солнце', 'linear-gradient(135deg,#F5A623,#F76B1C)'], mint: ['Мята', 'linear-gradient(135deg,#1F9D6B,#7BE0B1)'], rose: ['Роза', 'linear-gradient(135deg,#D6443F,#FF9BB0)'],
  'x-aurora': ['Аврора ✦', 'linear-gradient(135deg,#0F2027,#2C5364 40%,#43E8A6 100%)'], 'x-neon': ['Неон ✦', 'linear-gradient(135deg,#1a0033,#7b2ff7 55%,#00e5ff)'], 'x-sunset': ['Закат ✦', 'linear-gradient(135deg,#ff512f,#dd2476 55%,#6a11cb)'], 'x-galaxy': ['Галактика ✦', 'radial-gradient(circle at 30% 20%,#7f5af0,transparent 50%),linear-gradient(135deg,#050816,#1b1f4b)'],
};
const bg = t => (THEMES[t] || THEMES.ocean)[1];
const EMOJI = ['🙂', '😎', '🦊', '🐺', '🦉', '🐼', '🦄', '🌵', '⚡', '🔥', '🎧', '🎨', '📚', '⚽', '🚀', '🌙'];
const ACC = ['#2352D8', '#1F9D6B', '#E8A317', '#D6443F', '#8A3FD1', '#0F8B9E', '#E23E8B', '#0B0B0B'];
const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'сейчас' : m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн'; };
const me = () => { const r = cache.me; return r && r.ok ? r : null; };
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };

const av = (a, size = 40) => {
  if (a.official) return `<span class="uav off" style="width:${size}px;height:${size}px;font-size:${size * .5}px">🏫</span>`;
  if (a.anon) return `<span class="uav anon" style="width:${size}px;height:${size}px;font-size:${size * .5}px">${esc((a.alias || '🎭').split(' ')[0])}</span>`;
  return `<span class="uav" style="width:${size}px;height:${size}px;font-size:${size * .5}px;background:${bg(a.theme)};box-shadow:0 0 0 2px #fff,0 0 0 4px ${esc(a.accent || '#2352D8')}">${esc(a.emoji || '🙂')}</span>`;
};
const who = a => a.official ? '<b>Администрация школы</b> <span class="badge">официально</span>' : a.anon ? `<b>${esc((a.alias || 'Аноним').split(' ').slice(1).join(' ') || 'Аноним')}</b> <span class="badge anon">аноним</span>` : `<b>${esc(a.name)}</b>${a.username ? ` <a class="uname" href="#/${base()}/un/@${esc(a.username)}">@${esc(a.username)}</a>` : ''}`;
const base = () => { const r = S.state().session; return r.role === 'student' ? 'student' : 'admin'; };

// ---------- страницы ----------
export function page(sub) {
  const M = load('me', async () => need(await V.call('th_me')));
  const sess = S.state().session;
  if (M === 'loading') return head('Үн', '', 'Голос вашей школы') + '<div class="card"><p class="muted" role="status">Загружаем…</p></div>';
  if (M.err) return head('Үн', '', '') + `<div class="card"><p>⚠️ ${esc(M.err)}</p></div>`;
  if (!M.enabled) return head('Үн', '', '') + '<div class="card"><p>Администрация школы отключила «Үн». Следите за новостями.</p></div>';
  if (sub[0] === 'mod' && sess.role === 'admin') return modPage();
  if (sub[0] && sub[0].startsWith('@')) return profilePage(sub[0].slice(1), M);
  const x = X();
  if (sess.role === 'student' && !M.profile && !x.mode) return gate();
  return feedPage(M);
}
function gate() {
  return `${head('Үн', 'Голос вашей школы', 'Здесь — только ученики и администрация вашей школы')}
  <section class="un-gate"><div class="gate-orb" aria-hidden="true"></div>
    <h2>Как вы хотите войти?</h2><p class="muted">Ваша школа — отдельное пространство. Другие школы не видят ни постов, ни людей.</p>
    <div class="gate-cards"><button class="gc" data-act="un-gate" data-v="profile"><span class="gi">🪪</span><b>Через SABAK+</b><small>Свой профиль, @username, обложка, тема. Пишите от своего имени.</small></button>
    <button class="gc anon" data-act="un-gate" data-v="anon"><span class="gi">🎭</span><b>Анонимно</b><small>Псевдоним-зверь. Говорите честно о том, что происходит в школе. Автор скрыт даже от одноклассников.</small></button></div>
    <p class="muted fine">Класс нигде не показывается. Оскорбления и травля запрещены; модераторы убирают жалобы, а при нарушении — ограничивают профиль.</p></section>`;
}
function feedPage(M) {
  const x = X(), sess = S.state().session, student = sess.role === 'student';
  const R = load('feed:' + x.sort, async () => need(await V.call('th_feed', { p_sort: x.sort, p_before: null, p_limit: 30, p_username: null }))), prof = M.profile;
  const modLink = sess.role === 'admin' ? `<a class="btn ghost" href="#/admin/un/mod">🛡 Модерация</a>` : '';
  const top = `<div class="un-top"><div class="un-tabs" role="tablist">${[['new', 'Новое'], ['top', 'Популярное']].map(([k, n]) => `<button role="tab" aria-selected="${x.sort === k}" class="${x.sort === k ? 'on' : ''}" data-act="un-sort" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="cbtns">${modLink}${student ? (prof ? `<a class="me-chip" href="#/student/un/@${esc(prof.username)}">${av({ ...prof }, 30)}<span>@${esc(prof.username)}</span></a>` : `<button class="btn blue sm" data-act="un-gate" data-v="profile">Создать профиль</button>`) : ''}</div></div>`;
  const posts = R === 'loading' ? '<div class="un-skel"></div><div class="un-skel"></div>' : R.err ? `<p>⚠️ ${esc(R.err)}</p>` : R.rows.map((p, i) => postCard(p, M, i)).join('') || '<div class="card"><p class="muted">Пока тихо. Станьте первым — напишите что-нибудь.</p></div>';
  return `<div class="un"><div class="un-hero"><div><h1>Үн</h1><p>Голос вашей школы · только для своих</p></div><div class="un-orb" aria-hidden="true"></div></div>${top}${M.banned ? `<div class="card warn">Модератор ограничил публикации до ${new Date(M.banned).toLocaleDateString('ru-RU')}.</div>` : composer(M)}
  <div class="un-feed">${posts}</div>${M.edit || x.edit ? '' : ''}</div>${x.edit ? editModal(M) : ''}`;
}
function composer(M) {
  const x = X(), sess = S.state().session, student = sess.role === 'student', anon = student ? (x.anon === null ? !M.profile : x.anon) : false;
  const left = 600 - x.draft.length;
  return `<form class="un-compose ${anon ? 'is-anon' : ''}" data-form="un-post"><div class="uc-row">${anon ? av({ anon: true, alias: '🎭' }, 40) : M.profile ? av(M.profile, 40) : av({ official: true }, 40)}
    <textarea name="body" id="un-body" rows="2" maxlength="600" placeholder="${anon ? 'Скажите честно — вас не узнают…' : 'Что у вас нового?'}" aria-label="Новый пост">${esc(x.draft)}</textarea></div>
    ${x.media ? `<div class="uc-media">${x.media.startsWith('data:image') || /\.(jpg|png|webp)$/.test(x.media) ? `<img src="${x.mediaPreview || ''}" alt="">` : '🎬 видео прикреплено'}<button type="button" class="ibtn sm" data-act="un-media-x">✕</button></div>` : ''}
    <div class="uc-bar"><div class="cbtns"><label class="ibtn" title="Прикрепить фото${V ? '' : ''}">📷<input type="file" id="un-file" accept="image/jpeg,image/png,image/webp${S.isLive() ? ',video/mp4,video/webm' : ''}" hidden></label>
      ${student ? `<button type="button" class="tgl ${anon ? 'on' : ''}" role="switch" aria-checked="${anon}" data-act="un-anon">🎭 Анонимно</button>` : ''}</div>
      <div class="cbtns"><small class="cnt ${left < 40 ? 'low' : ''}" id="un-cnt">${left}</small><button class="btn blue" type="submit" ${x.posting ? 'disabled' : ''}>${x.posting ? '…' : 'Опубликовать'}</button></div></div></form>`;
}
function postCard(p, M, i) {
  const x = X(), open = x.open[p.id], src = p.media ? V.mediaSrc(p.media, rerender) : '';
  const mod = M.mod;
  const media = p.media ? (p.media_kind === 'video' ? `<video class="pm" controls preload="metadata" src="${src}"></video>` : src ? `<img class="pm" src="${src}" alt="Изображение к посту" loading="lazy">` : '<div class="pm ph">…</div>') : '';
  return `<article class="upost ${p.hidden ? 'hid' : ''} ${p.author.official ? 'off' : ''}" style="animation-delay:${Math.min(i, 8) * 45}ms">
    ${p.author.official ? '' : p.author.anon ? '' : `<i class="stripe" style="background:${bg(p.author.theme)}"></i>`}
    <header>${av(p.author)}<div class="ah"><div>${who(p.author)}</div><small class="muted">${ago(p.at)}${p.hidden ? ' · скрыто жалобами' : ''}</small></div>
      <div class="pmenu">${p.mine || mod ? `<button class="ibtn sm" data-act="un-del" data-k="p" data-id="${p.id}" aria-label="Удалить">🗑</button>` : `<button class="ibtn sm" data-act="un-report" data-k="p" data-id="${p.id}" aria-label="Пожаловаться" title="Пожаловаться">⚑</button>`}</div></header>
    <p class="pb">${esc(p.body).replace(/\n/g, '<br>')}</p>${media}
    <footer><button class="lk ${p.liked ? 'on' : ''}" data-act="un-like" data-k="p" data-id="${p.id}" aria-pressed="${p.liked}" aria-label="Нравится"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.800-8 11-8 11z"/></svg><b>${p.likes}</b></button>
      <button class="cm ${open ? 'on' : ''}" data-act="un-cm" data-id="${p.id}" aria-expanded="${!!open}">💬 <b>${p.comments}</b></button>${mod && p.reports ? `<span class="badge warn">жалоб: ${p.reports}</span>` : ''}</footer>
    ${open ? commentsBox(p, M) : ''}</article>`;
}
function commentsBox(p, M) {
  const x = X(), C = load('c:' + p.id, async () => need(await V.call('th_comments', { p_post: p.id }))), student = S.state().session.role === 'student';
  const anon = student ? (x.anon === null ? !M.profile : x.anon) : false, d = x.cdraft[p.id] || '';
  const list = C === 'loading' ? '<p class="muted">…</p>' : C.err ? `<p>⚠️ ${esc(C.err)}</p>` : C.rows.map(c => `<div class="ucm ${c.hidden ? 'hid' : ''}">${av(c.author, 28)}<div class="cb"><div>${who(c.author)} ${c.op ? '<span class="badge">автор поста</span>' : ''} <small class="muted">${ago(c.at)}</small></div><p>${esc(c.body)}</p>
    <div class="cbar"><button class="lk sm ${c.liked ? 'on' : ''}" data-act="un-like" data-k="c" data-id="${c.id}" aria-pressed="${c.liked}"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.800-8 11-8 11z"/></svg><b>${c.likes}</b></button>${c.mine || M.mod ? `<button class="linkb" data-act="un-del" data-k="c" data-id="${c.id}">удалить</button>` : `<button class="linkb" data-act="un-report" data-k="c" data-id="${c.id}">пожаловаться</button>`}</div></div></div>`).join('') || '<p class="muted">Комментариев пока нет.</p>';
  return `<div class="ucms">${list}${M.banned ? '' : `<form class="ucf" data-form="un-comment" data-post="${p.id}"><input name="body" maxlength="400" value="${esc(d)}" data-cd="${p.id}" placeholder="${anon ? 'Комментарий анонимно…' : 'Ваш комментарий…'}" aria-label="Комментарий" autocomplete="off"><button class="btn blue sm" type="submit">↑</button></form>${student ? `<label class="chk sm"><input type="checkbox" data-act="un-anon" ${anon ? 'checked' : ''}> анонимно</label>` : ''}`}</div>`;
}

// ---------- профиль ----------
function profilePage(name, M) {
  const R = load('prof:' + name, async () => need(await V.call('th_profile_get', { p_username: name })));
  const F = load('pf:' + name, async () => need(await V.call('th_feed', { p_sort: 'new', p_limit: 30, p_username: name })));
  const back = `<a class="btn ghost" href="#/${base()}/un">← К ленте</a>`;
  if (R === 'loading') return head('Профиль', '', '') + '<div class="card"><p class="muted">Загружаем…</p></div>';
  if (R.err) return head('Профиль', '', '') + `<div class="card"><p>⚠️ ${esc(R.err)}</p>${back}</div>`;
  const p = R.profile, cover = p.cover ? V.mediaSrc(p.cover, rerender) : '';
  const posts = F === 'loading' ? '<div class="un-skel"></div>' : F.err ? '' : F.rows.map((q, i) => postCard(q, M, i)).join('') || '<div class="card"><p class="muted">Публикаций пока нет.</p></div>';
  return `<div class="un"><div class="un-prof"><div class="cover" style="background:${cover ? `center/cover url(${cover})` : bg(p.theme)}"><div class="cover-shine"></div></div>
    <div class="pinfo">${av(p, 84)}<div class="pt"><h1>${esc(p.name)}</h1><p class="uname">@${esc(p.username)}</p>${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}<small class="muted">В «Үн» с ${new Date(p.since).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</small></div>
      <div class="cbtns">${p.mine ? '<button class="btn blue" data-act="un-edit">Изменить профиль</button>' : ''}${back}</div></div></div>
    <div class="un-feed">${posts}</div></div>${X().edit ? editModal(M) : ''}`;
}
function editModal(M) {
  const x = X(), p = x.form || (x.form = { ...(M.profile || { username: '', name: '', bio: '', emoji: '🙂', theme: 'ocean', accent: '#2352D8' }) });
  const creating = !M.profile, unlocked = M.unlocked;
  const themes = Object.entries(THEMES).map(([k, [n, g]]) => { const lock = k.startsWith('x-') && !unlocked; return `<button type="button" class="thm ${p.theme === k ? 'on' : ''} ${lock ? 'lock' : ''}" style="background:${g}" data-act="un-theme" data-v="${k}" aria-pressed="${p.theme === k}" title="${n}"><span>${lock ? '🔒' : ''}${n}</span></button>`; }).join('');
  const canRen = creating || M.profile.can_rename;
  return `<div class="modal-bg" data-act="un-edit-x"></div><div class="modal un-edit" role="dialog" aria-modal="true" aria-label="Профиль"><button class="ibtn close" data-act="un-edit-x" aria-label="Закрыть">✕</button>
  <h2>${creating ? 'Создайте профиль' : 'Ваш профиль'}</h2>
  <div class="pv" style="background:${p.coverPreview ? `center/cover url(${p.coverPreview})` : bg(p.theme)}">${av({ ...p }, 64)}<div><b>${esc(p.name || 'Имя')}</b><br><small>@${esc(p.username || 'username')}</small></div></div>
  <p class="muted">Ваш класс нигде не показывается. Имя и @username видят все в вашей школе.</p>
  <form data-form="un-profile">
    <label class="fld"><span>@username (как в Telegram)</span><input name="username" value="${esc(p.username)}" ${canRen ? '' : 'readonly'} minlength="5" maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" required data-pf="username"><small id="un-uname-msg" class="muted">${canRen ? 'Латиница, цифры, «_». Уникален во всей SABAK+.' : 'Менять можно раз в 7 дней.'}</small></label>
    <label class="fld"><span>Имя в «Үн» (необязательно настоящее)</span><input name="name" value="${esc(p.name)}" minlength="2" maxlength="32" required data-pf="name"></label>
    <label class="fld"><span>О себе</span><input name="bio" value="${esc(p.bio || '')}" maxlength="140" data-pf="bio"></label>
    <div class="fld"><span>Эмодзи-аватар</span><div class="emo">${EMOJI.map(e => `<button type="button" class="${p.emoji === e ? 'on' : ''}" data-act="un-emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
    <div class="fld"><span>Тема профиля (видна всем)</span><div class="thms">${themes}</div>${unlocked ? '' : '<small class="muted">✦ Премиум-темы открываются в магазине «Алтын» (набор «Темы профиля»).</small>'}</div>
    <div class="fld"><span>Цвет акцента</span><div class="acc">${ACC.map(c => `<button type="button" class="${p.accent === c ? 'on' : ''}" style="background:${c}" data-act="un-accent" data-v="${c}" aria-label="${c}"></button>`).join('')}<input type="color" value="${esc(p.accent)}" data-pf="accent" aria-label="Свой цвет"></div></div>
    ${creating ? '' : `<div class="fld"><span>Обложка</span><label class="btn ghost sm">Загрузить фото<input type="file" id="un-cover" accept="image/jpeg,image/png,image/webp" hidden></label></div>`}
    <div class="nav-row"><button type="button" class="btn ghost" data-act="un-edit-x">Отмена</button><button class="btn blue" type="submit">${creating ? 'Создать профиль' : 'Сохранить'}</button></div></form></div>`;
}

// ---------- модерация (администрация) ----------
function modPage() {
  const Q = load('mod', async () => need(await V.call('th_mod_queue'))), Z = load('set', async () => need(await V.call('th_settings', {})));
  const back = `<a class="btn ghost" href="#/admin/un">← К ленте</a>`;
  if (Q === 'loading' || Z === 'loading') return head('Модерация «Үн»', '', '') + '<div class="card"><p class="muted">Загружаем…</p></div>';
  if (Q.err || Z.err) return head('Модерация «Үн»', '', '') + `<div class="card"><p>⚠️ ${esc(Q.err || Z.err)}</p></div>`;
  const dir = S.state().session.level === 'director' || S.state().session.level === 'superadmin';
  const rows = Q.rows.map(r => `<article class="card mq"><div class="rq-h"><div><b>${r.kind === 'p' ? 'Пост' : 'Комментарий'}</b> ${r.hidden ? '<span class="cstat bad">скрыт</span>' : ''} <span class="badge warn">жалоб: ${r.reports}</span><br><small class="muted">${r.author.anon ? esc(r.author.alias) : r.author.official ? 'Администрация' : '@' + esc(r.author.username || '—')} · ${ago(r.at)}</small></div></div><p class="quote">${esc(r.body)}</p>
    <div class="cbtns"><button class="btn sm" data-act="un-mod" data-k="${r.kind}" data-id="${r.id}" data-v="restore">Оставить</button><button class="btn sm blue" data-act="un-mod" data-k="${r.kind}" data-id="${r.id}" data-v="delete">Удалить</button><button class="btn sm" data-act="un-ban" data-k="${r.kind}" data-id="${r.id}">Удалить и ограничить автора…</button>${Z.reveal ? `<button class="ibtn sm" data-act="un-reveal" data-k="${r.kind}" data-id="${r.id}">Раскрыть автора</button>` : ''}</div></article>`).join('') || '<div class="card"><p class="muted">Жалоб нет. Тихо и спокойно 🌿</p></div>';
  const bans = Q.bans.map(b => `<div class="row"><div><b>Ограничение до ${new Date(b.until).toLocaleDateString('ru-RU')}</b><small class="muted">${esc(b.reason || 'без причины')}</small></div><button class="ibtn sm" data-act="un-unban" data-id="${b.id}">Снять</button></div>`).join('');
  return `${head('Модерация «Үн»', '', 'Жалобы, ограничения, настройки школы')}<div class="ctl">${back}</div>
  <div class="kpis"><div class="card kp"><small>Постов за 7 дней</small><b>${Z.stats.posts_7d}</b></div><div class="card kp"><small>Из них анонимных</small><b>${Z.stats.anon_7d}</b></div><div class="card kp"><small>Профилей</small><b>${Z.stats.profiles}</b></div><div class="card kp ${Z.stats.reported ? 'alert' : ''}"><small>С жалобами</small><b>${Z.stats.reported}</b></div></div>
  ${rows}${bans ? `<section class="card"><h3>Действующие ограничения</h3>${bans}</section>` : ''}
  <section class="card"><h3>Настройки</h3>${dir ? `<label class="chk"><input type="checkbox" data-act="un-set-enabled" ${Z.enabled ? 'checked' : ''}> «Үн» включён в школе</label><br><label class="chk"><input type="checkbox" data-act="un-set-reveal" ${Z.reveal ? 'checked' : ''}> разрешить директору раскрывать автора анонимного поста (с записью в журнал; по умолчанию выключено)</label>` : '<p class="muted">Включение и раскрытие меняет только директор.</p>'}
    <h4 style="margin-top:14px">Запрещённые слова</h4><div class="words">${Z.words.map(w => `<button class="tag" data-act="un-word-del" data-v="${esc(w)}" title="Убрать">${esc(w)} ✕</button>`).join('') || '<small class="muted">нет</small>'}</div>
    <form data-form="un-word" class="inline"><label class="fld grow"><span>Добавить слово</span><input name="w" minlength="3" maxlength="40"></label><button class="btn" type="submit">Добавить</button></form></section>`;
}

// ---------- действия ----------
export function onInput(el) {
  const x = X();
  if (el.id === 'un-body') { x.draft = el.value; const c = document.getElementById('un-cnt'); if (c) { c.textContent = 600 - el.value.length; c.classList.toggle('low', 600 - el.value.length < 40); } return true; }
  if (el.dataset && el.dataset.cd) { x.cdraft[el.dataset.cd] = el.value; return true; }
  if (el.dataset && el.dataset.pf && x.form) {
    x.form[el.dataset.pf] = el.value;
    if (el.dataset.pf === 'username') {
      clearTimeout(x.t); const msg = document.getElementById('un-uname-msg'), n = el.value.trim().toLowerCase();
      if (msg && n.length >= 5) x.t = setTimeout(async () => { const r = await V.call('th_username_check', { p_name: n }); if (!msg.isConnected) return; msg.textContent = r.ok ? (r.available ? '✓ свободно' : ({ format: 'Только латиница, цифры и «_», начинается с буквы', reserved: 'Имя зарезервировано', taken: 'Уже занято' })[r.reason] || 'Занято') : (UN_ERR[r.error] || ''); msg.className = r.ok && r.available ? 'ok' : 'bad'; }, 350);
    }
    return true;
  }
  return false;
}
export async function onChange(el) {
  const x = X();
  if (el.id === 'un-file' && el.files[0]) { await guard(async () => { x.posting = true; const f = el.files[0]; const path = await V.uploadMedia(f, 'p'); x.media = path; x.mediaKind = f.type.startsWith('video') ? 'video' : 'image'; x.mediaPreview = f.type.startsWith('video') ? '' : URL.createObjectURL(f); x.posting = false; rerender(); }); x.posting = false; return true; }
  if (el.id === 'un-cover' && el.files[0]) { await guard(async () => { const path = await V.uploadMedia(el.files[0], 'cover'); need(await V.call('th_cover_set', { p_path: path })); fresh(); x.form = x.form || {}; x.form.coverPreview = URL.createObjectURL(el.files[0]); toast('Обложка обновлена 🎨', 'ok'); rerender(); }); return true; }
  if (el.dataset && el.dataset.act === 'un-set-enabled') { await guard(async () => { need(await V.call('th_settings', { p_enabled: el.checked })); fresh('set'); fresh('me'); rerender(); }); return true; }
  if (el.dataset && el.dataset.act === 'un-set-reveal') { await guard(async () => { if (el.checked && !confirm('Включить раскрытие авторов? Каждое раскрытие записывается в журнал школы.')) { rerender(); return; } need(await V.call('th_settings', { p_reveal: el.checked })); fresh('set'); fresh('me'); rerender(); }); return true; }
  if (el.dataset && el.dataset.pf === 'accent') { x.form.accent = el.value; rerender(); return true; }
  return false;
}
export async function act(a, el) {
  const x = X(), M = me();
  switch (a) {
    case 'un-gate': x.mode = el.dataset.v; if (el.dataset.v === 'profile') { x.edit = true; x.form = null; } else x.anon = true; rerender(); return true;
    case 'un-sort': x.sort = el.dataset.v; rerender(); return true;
    case 'un-anon': x.anon = !(x.anon === null ? !(M && M.profile) : x.anon); rerender(); return true;
    case 'un-media-x': x.media = null; x.mediaPreview = null; rerender(); return true;
    case 'un-edit': x.edit = true; x.form = null; rerender(); return true;
    case 'un-edit-x': x.edit = false; x.form = null; if (M && !M.profile && x.mode === 'profile') x.mode = null; rerender(); return true;
    case 'un-theme': { if (el.dataset.v.startsWith('x-') && !(M && M.unlocked)) { toast('Премиум-тема открывается в магазине «Алтын» 🎨', 'warn'); return true; } x.form.theme = el.dataset.v; rerender(); return true; }
    case 'un-emoji': x.form.emoji = el.dataset.v; rerender(); return true;
    case 'un-accent': x.form.accent = el.dataset.v; rerender(); return true;
    case 'un-cm': x.open[el.dataset.id] = !x.open[el.dataset.id]; rerender(); return true;
    case 'un-like': {
      const btn = el, was = btn.classList.contains('on'); btn.classList.toggle('on'); btn.classList.add('pop'); const nEl = btn.querySelector('b'); nEl.textContent = Number(nEl.textContent) + (was ? -1 : 1);
      try { const r = need(await V.call('th_like', { p_kind: el.dataset.k, p_id: el.dataset.id })); nEl.textContent = r.n; btn.classList.toggle('on', r.liked); } catch (e) { toast(e.message, 'warn'); fresh(); rerender(); }
      setTimeout(() => btn.classList.remove('pop'), 500); fresh('feed'); fresh('pf'); return true;
    }
    case 'un-report': await guard(async () => { const why = prompt('Что не так? (оскорбление, угроза, травля, спам…)'); if (!why) return; need(await V.call('th_report', { p_kind: el.dataset.k, p_id: el.dataset.id, p_reason: why.slice(0, 200) })); toast('Спасибо, модератор проверит', 'ok'); }); return true;
    case 'un-del': await guard(async () => { if (!confirm('Удалить?')) return; need(await V.call('th_delete', { p_kind: el.dataset.k, p_id: el.dataset.id })); fresh(); rerender(); }); return true;
    case 'un-mod': await guard(async () => { need(await V.call('th_mod_decide', { p_kind: el.dataset.k, p_id: el.dataset.id, p_action: el.dataset.v })); fresh(); rerender(); }); return true;
    case 'un-ban': await guard(async () => { const d = Number(prompt('На сколько дней ограничить автора? (1, 3, 7 или 30)', '3')); if (!d) return; const why = prompt('Причина (увидит только администрация):', 'нарушение правил') || ''; need(await V.call('th_ban', { p_kind: el.dataset.k, p_id: el.dataset.id, p_days: d, p_reason: why })); need(await V.call('th_mod_decide', { p_kind: el.dataset.k, p_id: el.dataset.id, p_action: 'delete' })); fresh(); toast('Автор ограничен, материал удалён', 'ok'); rerender(); }); return true;
    case 'un-unban': await guard(async () => { need(await V.call('th_unban', { p_id: el.dataset.id })); fresh(); rerender(); }); return true;
    case 'un-reveal': await guard(async () => { const why = prompt('Причина раскрытия (запишется в журнал):'); if (!why || why.length < 5) return; const r = need(await V.call('th_reveal', { p_kind: el.dataset.k, p_id: el.dataset.id, p_reason: why })); alert('Автор: ' + (r.name || '—') + (r.cls ? ' · ' + r.cls : '')); }); return true;
    case 'un-word-del': await guard(async () => { need(await V.call('th_settings', { p_del: el.dataset.v })); fresh('set'); rerender(); }); return true;
  }
  return false;
}
export async function submit(f, fd) {
  const k = f.dataset.form, x = X(), v = n => String(fd.get(n) || '').trim(), M = me();
  if (k === 'un-post') { await guard(async () => {
    const student = S.state().session.role === 'student', anon = student ? (x.anon === null ? !(M && M.profile) : x.anon) : false;
    x.posting = true; rerender();
    try { need(await V.call('th_post', { p_body: v('body'), p_anon: anon, p_media: x.media, p_kind: x.media ? (x.mediaKind || 'image') : null })); x.draft = ''; x.media = null; x.mediaPreview = null; fresh(); toast(anon ? 'Опубликовано анонимно 🎭' : 'Опубликовано ✨', 'ok'); }
    finally { x.posting = false; rerender(); } }); return true; }
  if (k === 'un-comment') { await guard(async () => {
    const student = S.state().session.role === 'student', anon = student ? (x.anon === null ? !(M && M.profile) : x.anon) : false;
    need(await V.call('th_comment', { p_post: f.dataset.post, p_body: v('body'), p_anon: anon, p_parent: null })); x.cdraft[f.dataset.post] = ''; fresh('c:' + f.dataset.post); fresh('feed'); fresh('pf'); rerender(); }); return true; }
  if (k === 'un-profile') { await guard(async () => {
    const creating = !(M && M.profile), p = x.form || {};
    need(await V.call('th_profile_save', { p_username: v('username'), p_name: v('name'), p_bio: v('bio'), p_emoji: p.emoji || '🙂', p_theme: p.theme || 'ocean', p_accent: p.accent || '#2352D8' }));
    x.edit = false; x.form = null; x.mode = 'profile'; x.anon = false; fresh(); toast(creating ? 'Профиль создан 🎉' : 'Профиль сохранён', 'ok'); rerender(); }); return true; }
  if (k === 'un-word') { await guard(async () => { need(await V.call('th_settings', { p_add: v('w') })); fresh('set'); rerender(); }); return true; }
  return false;
}
export const refresh = fresh;
