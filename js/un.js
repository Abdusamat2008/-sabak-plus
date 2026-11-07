// «Үн» («Голос») — мини-соцсеть школы. Изолирована по школам: ученик видит только свою ленту.
// Вход через профиль SABAK+ (свой @username, тема, обложка) или анонимно (псевдоним-зверь, автор скрыт даже от одноклассников).
// Версия 2.0: «бумажки» на кобальтовой доске, эхо вместо лайков, опросы, теги и тренды, тема дня, закладки, поиск.
import * as S from './store.js';
import * as V from './v8data.js';
import { esc, ui, head, toast } from './common.js';

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
  links: 'Ссылки в «Үн» запрещены — так мы защищаем всех от мошенников', phone: 'Номера телефонов публиковать нельзя', blocked_word: 'В тексте есть запрещённое слово — перефразируйте', body: 'Напишите от 1 до 600 символов', rate: 'Слишком часто. Передохните минуту',
  banned: 'Модератор временно ограничил ваши публикации', need_profile: 'Для этого нужен профиль SABAK+ — или публикуйте анонимно', username_format: '@username: латиницей, 5–32 символа, начинается с буквы, можно цифры и «_»', username_reserved: 'Это имя зарезервировано', username_taken: 'Этот @username уже занят',
  rename_cooldown: '@username можно менять раз в 7 дней', locked_theme: 'Премиум-темы открываются в магазине «Алтын»', name: 'Имя — от 2 до 32 символов', bio: 'О себе — до 140 символов', students_only: 'Профиль создают ученики', forbidden: 'Нет доступа', no_access: 'Для вашей роли «Үн» недоступен', disabled: 'Школа отключила «Үн»',
  media: 'Файл не подходит', not_found: 'Уже удалено', not_deployed: 'Сервер ещё не обновлён: выполните schema_v6.sql и schema_v7.sql в Supabase', network: 'Нет связи', reveal_off: 'Раскрытие авторов выключено в настройках школы', word: 'Слово — от 3 до 40 символов', days: 'Выберите срок',
  poll: 'В опросе нужно от 2 до 5 вариантов, каждый до 40 символов',
};
const need = r => { if (!r || !r.ok) throw new Error(UN_ERR[r && r.error] || (r && r.error) || 'Ошибка'); return r; };
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const X = () => (ui.un = ui.un || { sort: 'new', tab: 'new', anon: null, draft: lsGet('sabak.un.draft', ''), media: null, cdraft: {}, open: {}, form: null, edit: false, mode: null, posting: false, poll: null, q: '', tag: null, saved: lsGet('sabak.un.saved', []), seen: new Set(), booted: false });

export const THEMES = {
  ocean: ['Океан', 'linear-gradient(135deg,#1E2FD0,#6E8DFF)'], sun: ['Солнце', 'linear-gradient(135deg,#F5A623,#F76B1C)'], mint: ['Мята', 'linear-gradient(135deg,#0E8F63,#7BE0B1)'], rose: ['Роза', 'linear-gradient(135deg,#D6443F,#FF9BB0)'],
  'x-aurora': ['Аврора ✦', 'linear-gradient(135deg,#0F2027,#2C5364 40%,#43E8A6 100%)'], 'x-neon': ['Неон ✦', 'linear-gradient(135deg,#1a0033,#7b2ff7 55%,#00e5ff)'], 'x-sunset': ['Закат ✦', 'linear-gradient(135deg,#ff512f,#dd2476 55%,#6a11cb)'], 'x-galaxy': ['Галактика ✦', 'radial-gradient(circle at 30% 20%,#7f5af0,transparent 50%),linear-gradient(135deg,#050816,#1b1f4b)'],
};
const bg = t => (THEMES[t] || THEMES.ocean)[1];
const EMOJI = ['🙂', '😎', '🦊', '🐺', '🦉', '🐼', '🦄', '🌵', '⚡', '🔥', '🎧', '🎨', '📚', '⚽', '🚀', '🌙'];
const ACC = ['#1E2FD0', '#0E8F63', '#E8A317', '#E5372B', '#8A3FD1', '#0F8B9E', '#E23E8B', '#14110F'];
const PROMPTS = ['Что бы вы поменяли в школьном расписании?', 'Лучший урок этой недели — какой и почему?', 'Какую книгу из программы вы бы вычеркнули, а какую добавили?', 'Чему вас не учат в школе, а надо?', 'Как вы справляетесь с домашкой, когда её очень много?', 'Какой кружок или секция нужны нашей школе?', 'Что в школьной столовой надо улучшить в первую очередь?', 'Кто из учителей объясняет так, что всё понятно? Скажите спасибо.', 'Как сделать перемены интереснее?', 'Что вам помогает не бояться контрольных?', 'Какой школьный праздник вы бы придумали?', 'Что вы хотите сказать выпускникам?', 'Где в школе вам спокойно, а где тревожно?', 'Чем вы гордитесь в нашей школе?'];
const KINDS = { вопрос: ['❓', 'Вопрос', 'q'], идея: ['💡', 'Идея', 'i'], честно: ['🎭', 'Честно', 'h'], опрос: ['📊', 'Опрос', 'p'], тема_дня: ['🌅', 'Тема дня', 't'] };
const TAGRE = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{2,30})/gu;
const dayPrompt = () => PROMPTS[Math.floor(Date.now() / 864e5) % PROMPTS.length];
const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'сейчас' : m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн'; };
const me = () => { const r = cache.me; return r && r.ok ? r : null; };
const guard = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Ошибка', 'warn'); } };
const base = () => (S.state().session.role === 'student' ? 'student' : 'admin');
const tagsOf = body => [...new Set([...String(body).matchAll(TAGRE)].map(m => m[2].toLowerCase()))];
const richText = body => esc(body).replace(/\n/g, '<br>').replace(TAGRE, (m, pre, t) => `${pre}<button class="tg" data-act="un-tag" data-v="${t.toLowerCase()}">#${t}</button>`).replace(/(^|[\s>])@([a-zA-Z][a-zA-Z0-9_]{4,31})/g, (m, pre, u) => `${pre}<a class="uname" href="#/${base()}/un/@${u}">@${u}</a>`);

const av = (a, size = 40) => {
  const st = `width:${size}px;height:${size}px;font-size:${size * .5}px`;
  if (a.official) return `<span class="uav off" style="${st}" aria-hidden="true">🏫</span>`;
  if (a.anon) return `<span class="uav anon" style="${st}" aria-hidden="true">${esc((a.alias || '🎭').split(' ')[0])}</span>`;
  return `<span class="uav" style="${st};background:${bg(a.theme)};--ac:${esc(a.accent || '#1E2FD0')}" aria-hidden="true">${esc(a.emoji || '🙂')}</span>`;
};
const who = a => a.official ? '<b>Администрация школы</b>' : a.anon ? `<b>${esc((a.alias || 'Аноним').split(' ').slice(1).join(' ') || 'Аноним')}</b>` : `<b>${esc(a.name)}</b>${a.username ? ` <a class="uname" href="#/${base()}/un/@${esc(a.username)}">@${esc(a.username)}</a>` : ''}`;
const hornTile = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 46 46' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M23 40V30M23 30C23 22 13 22 13 14S22 6 22 12M23 30C23 22 33 22 33 14S24 6 24 12'/%3E%3C/svg%3E\")";

// ---------- страницы ----------
export function page(sub) {
  const M = load('me', async () => need(await V.call('th_me')));
  const sess = S.state().session, x = X();
  const shellWrap = inner => `<div class="un-wrap" style="--horn:${hornTile}">${inner}</div>`;
  if (M === 'loading') return shellWrap(mast(null) + '<div class="un-skel"></div><div class="un-skel"></div>');
  if (M.err) return shellWrap(mast(null) + `<div class="slip"><p>⚠️ ${esc(M.err)}</p></div>`);
  if (!M.enabled) return shellWrap(mast(null) + '<div class="slip"><p>Администрация школы отключила «Үн». Следите за новостями.</p></div>');
  if (sub[0] === 'mod' && sess.role === 'admin') return shellWrap(mast(M) + modPage());
  if (sub[0] && sub[0].startsWith('@')) return shellWrap(mast(M) + profilePage(sub[0].slice(1), M));
  if (sess.role === 'student' && !M.profile && !x.mode) return shellWrap(mast(M) + gate());
  return shellWrap(mast(M) + feedPage(M));
}
function mast(M) {
  const sess = S.state().session, student = sess.role === 'student', prof = M && M.profile;
  const bars = Array.from({ length: 21 }, (_, i) => `<i style="--i:${i};--h:${[.3, .55, .8, .45, 1, .6, .35, .75, .5][i % 9]}"></i>`).join('');
  return `<header class="un-mast"><a class="un-logo" href="#/${base()}/un" aria-label="Үн — лента школы"><span class="un-word">Үн</span><span class="un-bars" aria-hidden="true">${bars}</span></a>
    <p class="un-tag">Голос вашей школы. Здесь только свои.</p>
    <div class="un-me">${sess.role === 'admin' ? '<a class="un-btn" href="#/admin/un/mod">Модерация</a>' : ''}${student && M ? (prof ? `<a class="un-chip" href="#/student/un/@${esc(prof.username)}">${av(prof, 28)}<span>@${esc(prof.username)}</span></a>` : `<button class="un-btn hot" data-act="un-gate" data-v="profile">Создать профиль</button>`) : ''}</div></header>`;
}
function gate() {
  return `<section class="gate"><h2>Как вы хотите войти?</h2><p class="lead">Ваша школа — отдельное пространство. Другие школы не видят ни постов, ни людей. Класс нигде не показывается.</p>
    <div class="gate-pair"><button class="gate-card paper" data-act="un-gate" data-v="profile"><span class="gi">🪪</span><b>Через SABAK+</b><span>Свой профиль: @username, тема, обложка. Пишете от своего имени.</span></button>
    <button class="gate-card mask" data-act="un-gate" data-v="anon"><span class="gi">🎭</span><b>Анонимно</b><span>Псевдоним-зверь. Говорите честно о том, что происходит в школе. Автора не знает никто, даже одноклассники.</span></button></div>
    <p class="fine">Оскорбления и травля запрещены. Модераторы убирают жалобы, нарушителей ограничивают.</p></section>`;
}
function filterRows(rows, x) {
  let r = rows;
  if (x.tab === 'honest') r = r.filter(p => p.author.anon); else if (x.tab === 'photo') r = r.filter(p => p.media); else if (x.tab === 'saved') r = r.filter(p => x.saved.includes(p.id));
  if (x.tag) r = r.filter(p => tagsOf(p.body).includes(x.tag));
  const q = x.q.trim().toLowerCase(); if (q) r = r.filter(p => p.body.toLowerCase().includes(q) || (p.author.username || '').toLowerCase().includes(q) || (p.author.name || '').toLowerCase().includes(q));
  return r;
}
function feedPage(M) {
  const x = X(), sess = S.state().session;
  const sort = x.tab === 'top' ? 'top' : 'new';
  const R = load('feed:' + sort, async () => need(await V.call('th_feed', { p_sort: sort, p_before: null, p_limit: 50, p_username: null })));
  const tabs = [['new', 'Лента'], ['top', 'Популярное'], ['honest', 'Честно'], ['photo', 'Фото'], ['saved', `Сохранённое${x.saved.length ? ' ' + x.saved.length : ''}`]].map(([k, n]) => `<button role="tab" aria-selected="${x.tab === k}" class="${x.tab === k ? 'on' : ''}" data-act="un-tab" data-v="${k}">${n}</button>`).join('');
  const ok = R !== 'loading' && !R.err, rows = ok ? filterRows(R.rows, x) : [];
  const trends = ok ? trending(R.rows) : [];
  const list = R === 'loading' ? '<div class="un-skel"></div><div class="un-skel"></div><div class="un-skel"></div>' : R.err ? `<p class="slip">⚠️ ${esc(R.err)}</p>` : rows.map(p => postCard(p, M)).join('') || emptyFeed(x);
  const html = `<div class="un-cols"><main>
    <div class="un-bar"><div class="un-tabs" role="tablist" aria-label="Разделы ленты">${tabs}</div><label class="un-search"><span class="sr">Поиск</span><input type="search" id="un-q" value="${esc(x.q)}" placeholder="Поиск по постам и людям" autocomplete="off"></label></div>
    ${x.tag ? `<div class="un-filter">Только #${esc(x.tag)} <button class="un-x" data-act="un-tag-x" aria-label="Сбросить тег">✕</button></div>` : ''}
    <div class="un-rail-m">${daySlip()}${trendChips(trends)}</div>
    ${M.banned ? `<div class="slip warn">Модератор ограничил публикации до ${new Date(M.banned).toLocaleDateString('ru-RU')}.</div>` : composer(M)}
    <div class="un-feed">${list}</div></main>
    <aside class="un-rail">${daySlip()}<section class="slip rail"><h3>О чём говорят</h3>${trends.length ? trendChips(trends, true) : '<p class="muted">Добавьте #тег к посту — он появится здесь.</p>'}</section>
      <section class="slip rail rules"><h3>Правила Үн</h3><ul><li>Без оскорблений и травли</li><li>Без ссылок и телефонов</li><li>Жалоба — кнопка ⚑ на посте</li><li>Анонимность защищена, но не даёт права обижать</li></ul></section></aside></div>`;
  if (ok) { R.rows.forEach(p => x.seen.add(p.id)); x.booted = true; }
  return html + (x.edit ? editModal(M) : '');
}
function emptyFeed(x) {
  const m = x.tab === 'saved' ? 'Сохраняйте посты кнопкой 🔖 — они появятся здесь.' : x.tab === 'honest' ? 'Анонимных постов пока нет. Скажите то, о чём все молчат.' : x.q || x.tag ? 'Ничего не нашлось. Попробуйте другое слово.' : 'Пока тихо. Напишите первым.';
  return `<div class="slip empty"><p>${m}</p></div>`;
}
function trending(rows) {
  const c = {}; rows.forEach(p => tagsOf(p.body).forEach(t => { c[t] = (c[t] || 0) + 1 + p.likes * .2; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => [t, rows.filter(p => tagsOf(p.body).includes(t)).length]);
}
const trendChips = (tr, rail) => tr.length ? `<div class="trend ${rail ? '' : 'inl'}">${tr.map(([t, n]) => `<button class="tg big ${X().tag === t ? 'on' : ''}" data-act="un-tag" data-v="${t}">#${esc(t)}<small>${n}</small></button>`).join('')}</div>` : '';
function daySlip() {
  return `<section class="slip day"><span class="day-k">Тема дня</span><p>${esc(dayPrompt())}</p><button class="un-btn" data-act="un-day">Ответить</button></section>`;
}
function composer(M) {
  const x = X(), student = S.state().session.role === 'student', anon = student ? (x.anon === null ? !M.profile : x.anon) : false, left = 600 - x.draft.length;
  const pr = x.poll ? `<div class="poll-b"><b>Опрос</b>${x.poll.map((o, i) => `<div class="pl-row"><input data-pl="${i}" value="${esc(o)}" maxlength="40" placeholder="Вариант ${i + 1}" aria-label="Вариант ${i + 1}">${x.poll.length > 2 ? `<button type="button" class="un-x" data-act="un-poll-del" data-i="${i}" aria-label="Убрать вариант">✕</button>` : ''}</div>`).join('')}${x.poll.length < 5 ? '<button type="button" class="un-btn" data-act="un-poll-add">+ вариант</button>' : ''}</div>` : '';
  const kinds = ['вопрос', 'идея', 'честно'].map(k => `<button type="button" class="kchip" data-act="un-kind" data-v="${k}">${KINDS[k][0]} ${KINDS[k][1]}</button>`).join('');
  return `<form class="slip compose ${anon ? 'is-anon' : ''}" data-form="un-post"><div class="uc-row">${anon ? av({ anon: true, alias: '🎭' }, 42) : M.profile ? av(M.profile, 42) : av({ official: true }, 42)}
    <textarea name="body" id="un-body" rows="2" maxlength="600" placeholder="${anon ? 'Скажите честно. Вас не узнают.' : 'Что у вас на уме?'}" aria-label="Новый пост">${esc(x.draft)}</textarea></div>
    ${pr}${x.media ? `<div class="uc-media">${x.mediaPreview ? `<img src="${x.mediaPreview}" alt="">` : '<span>Видео прикреплено</span>'}<button type="button" class="un-x" data-act="un-media-x" aria-label="Убрать вложение">✕</button></div>` : ''}
    <div class="uc-bar"><div class="uc-tools"><label class="tool" title="Фото"><span aria-hidden="true">📷</span><span class="sr">Прикрепить фото</span><input type="file" id="un-file" accept="image/jpeg,image/png,image/webp${S.isLive() ? ',video/mp4,video/webm' : ''}" hidden></label>
      <button type="button" class="tool ${x.poll ? 'on' : ''}" data-act="un-poll" aria-pressed="${!!x.poll}" title="Опрос"><span aria-hidden="true">📊</span><span class="sr">Опрос</span></button>
      ${student ? `<button type="button" class="tool mask ${anon ? 'on' : ''}" role="switch" aria-checked="${anon}" data-act="un-anon" title="Анонимно"><span aria-hidden="true">🎭</span> <span class="tl">Анонимно</span></button>` : ''}</div>
      <div class="uc-go"><span class="ring" id="un-ring" style="--p:${Math.min(100, x.draft.length / 6)}"><small id="un-cnt" class="${left < 40 ? 'low' : ''}">${left}</small></span><button class="un-btn hot" type="submit" ${x.posting ? 'disabled' : ''}>${x.posting ? 'Отправляем' : 'Опубликовать'}</button></div></div>
    <div class="kinds">${kinds}</div></form>`;
}
const echoSvg = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 9v6h3l4 3.500v-13L8 9zM15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/></svg>';
function pollView(p) {
  const pl = p.poll, total = pl.counts.reduce((a, b) => a + b, 0), voted = pl.mine !== null && pl.mine !== undefined;
  return `<div class="poll" role="group" aria-label="Опрос">${pl.opts.map((o, i) => { const pc = total ? Math.round(pl.counts[i] * 100 / total) : 0; return voted
    ? `<div class="po res ${pl.mine === i ? 'mine' : ''}"><i style="width:${pc}%"></i><span>${esc(o)}</span><b>${pc}%</b></div>`
    : `<button class="po" data-act="un-vote" data-id="${p.id}" data-i="${i}">${esc(o)}</button>`; }).join('')}<small class="muted">${total} ${total === 1 ? 'голос' : total < 5 && total > 1 ? 'голоса' : 'голосов'}${voted ? '' : ' · выбор нельзя изменить, голоса анонимны'}</small></div>`;
}
function postCard(p, M) {
  const x = X(), open = x.open[p.id], src = p.media ? V.mediaSrc(p.media, rerender) : '', mod = M.mod, saved = x.saved.includes(p.id);
  const fresh$ = x.booted && !x.seen.has(p.id);
  const kind = tagsOf(p.body).map(t => KINDS[t]).find(Boolean);
  const media = p.media ? (p.media_kind === 'video' ? `<video class="pm" controls preload="metadata" src="${src}"></video>` : src ? `<img class="pm" src="${src}" alt="Изображение к посту" loading="lazy">` : '<div class="pm ph"></div>') : '';
  const kcls = p.author.official ? 'off' : p.author.anon ? 'anon' : '';
  return `<article class="slip post ${kcls} ${p.hidden ? 'hid' : ''} ${fresh$ ? 'enter' : ''}" ${p.author.anon || p.author.official ? '' : `style="--ac:${esc(p.author.accent || '#1E2FD0')}"`}>
    <header>${av(p.author)}<div class="ah"><div class="an">${who(p.author)}</div><small class="muted">${ago(p.at)}${p.hidden ? ' · скрыто жалобами' : ''}</small></div>
      ${kind ? `<span class="kind k-${kind[2]}">${kind[0]} ${kind[1]}</span>` : ''}
      <div class="pmenu"><button class="ibtn sm" data-act="un-save" data-id="${p.id}" aria-pressed="${saved}" aria-label="${saved ? 'Убрать из сохранённого' : 'Сохранить'}" title="Сохранить">${saved ? '🔖' : '🏷'}</button>${p.mine || mod ? `<button class="ibtn sm" data-act="un-del" data-k="p" data-id="${p.id}" aria-label="Удалить">🗑</button>` : `<button class="ibtn sm" data-act="un-report" data-k="p" data-id="${p.id}" aria-label="Пожаловаться" title="Пожаловаться">⚑</button>`}</div></header>
    <p class="pb">${richText(p.body)}</p>${p.poll ? pollView(p) : ''}${media}
    <footer><button class="echo ${p.liked ? 'on' : ''}" data-act="un-like" data-k="p" data-id="${p.id}" aria-pressed="${p.liked}" aria-label="Эхо">${echoSvg}<b>${p.likes}</b></button>
      <button class="cmt ${open ? 'on' : ''}" data-act="un-cm" data-id="${p.id}" aria-expanded="${!!open}"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><b>${p.comments}</b></button>${mod && p.reports ? `<span class="warnb">жалоб: ${p.reports}</span>` : ''}</footer>
    ${open ? commentsBox(p, M) : ''}</article>`;
}
function commentsBox(p, M) {
  const x = X(), C = load('c:' + p.id, async () => need(await V.call('th_comments', { p_post: p.id }))), student = S.state().session.role === 'student';
  const anon = student ? (x.anon === null ? !M.profile : x.anon) : false, d = x.cdraft[p.id] || '';
  const list = C === 'loading' ? '<p class="muted">…</p>' : C.err ? `<p>⚠️ ${esc(C.err)}</p>` : C.rows.map(c => `<div class="ucm ${c.hidden ? 'hid' : ''}">${av(c.author, 28)}<div class="cb"><div>${who(c.author)}${c.op ? ' <span class="opb">автор</span>' : ''} <small class="muted">${ago(c.at)}</small></div><p>${richText(c.body)}</p>
    <div class="cbar"><button class="echo sm ${c.liked ? 'on' : ''}" data-act="un-like" data-k="c" data-id="${c.id}" aria-pressed="${c.liked}" aria-label="Эхо">${echoSvg}<b>${c.likes}</b></button>${c.mine || M.mod ? `<button class="linkb" data-act="un-del" data-k="c" data-id="${c.id}">удалить</button>` : `<button class="linkb" data-act="un-report" data-k="c" data-id="${c.id}">пожаловаться</button>`}</div></div></div>`).join('') || '<p class="muted">Комментариев пока нет. Ответьте первым.</p>';
  return `<div class="ucms">${list}${M.banned ? '' : `<form class="ucf" data-form="un-comment" data-post="${p.id}"><input name="body" maxlength="400" value="${esc(d)}" data-cd="${p.id}" placeholder="${anon ? 'Комментарий анонимно' : 'Ваш комментарий'}" aria-label="Комментарий" autocomplete="off"><button class="un-btn hot" type="submit" aria-label="Отправить">↑</button></form>${student ? `<label class="chk sm"><input type="checkbox" data-act="un-anon" ${anon ? 'checked' : ''}> анонимно</label>` : ''}`}</div>`;
}

// ---------- профиль ----------
function profilePage(name, M) {
  const R = load('prof:' + name, async () => need(await V.call('th_profile_get', { p_username: name })));
  const F = load('pf:' + name, async () => need(await V.call('th_feed', { p_sort: 'new', p_limit: 50, p_username: name })));
  const back = `<a class="un-btn" href="#/${base()}/un">← К ленте</a>`;
  if (R === 'loading') return '<div class="un-skel tall"></div>';
  if (R.err) return `<div class="slip"><p>⚠️ ${esc(R.err)}</p>${back}</div>`;
  const p = R.profile, x = X(), cover = p.cover ? V.mediaSrc(p.cover, rerender) : '';
  const rows = F === 'loading' || F.err ? [] : F.rows, pt = x.ptab || 'posts', shown = pt === 'photo' ? rows.filter(r => r.media) : rows;
  const echoes = rows.reduce((a, r) => a + r.likes, 0);
  const posts = F === 'loading' ? '<div class="un-skel"></div>' : shown.map(q => postCard(q, M)).join('') || '<div class="slip empty"><p>Здесь пока пусто.</p></div>';
  return `<section class="prof" style="--ac:${esc(p.accent)}"><div class="cover" style="background:${cover ? `center/cover url(${cover})` : bg(p.theme)}"><div class="cover-horn"></div></div>
    <div class="pbody">${av(p, 96)}<div class="pt"><h1>${esc(p.name)}</h1><p class="uname">@${esc(p.username)}</p>${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}</div>
      <div class="pstat"><div><b>${rows.length}</b><small>постов</small></div><div><b>${echoes}</b><small>эхо</small></div><div><b>${new Date(p.since).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</b><small>в Үн с</small></div></div>
      <div class="cbtns">${p.mine ? '<button class="un-btn hot" data-act="un-edit">Изменить профиль</button>' : ''}${back}</div></div></section>
    <div class="un-tabs sm" role="tablist"><button role="tab" aria-selected="${pt === 'posts'}" class="${pt === 'posts' ? 'on' : ''}" data-act="un-ptab" data-v="posts">Посты</button><button role="tab" aria-selected="${pt === 'photo'}" class="${pt === 'photo' ? 'on' : ''}" data-act="un-ptab" data-v="photo">Фото</button></div>
    <div class="un-feed prof-feed">${posts}</div>${x.edit ? editModal(M) : ''}`;
}
function editModal(M) {
  const x = X(), p = x.form || (x.form = { ...(M.profile || { username: '', name: '', bio: '', emoji: '🙂', theme: 'ocean', accent: '#1E2FD0' }) });
  const creating = !M.profile, unlocked = M.unlocked;
  const themes = Object.entries(THEMES).map(([k, [n, g]]) => { const lock = k.startsWith('x-') && !unlocked; return `<button type="button" class="thm ${p.theme === k ? 'on' : ''} ${lock ? 'lock' : ''}" style="background:${g}" data-act="un-theme" data-v="${k}" aria-pressed="${p.theme === k}" title="${n}"><span>${lock ? '🔒 ' : ''}${n}</span></button>`; }).join('');
  const canRen = creating || M.profile.can_rename;
  return `<div class="modal-bg" data-act="un-edit-x"></div><div class="modal un-edit" role="dialog" aria-modal="true" aria-label="Профиль"><button class="ibtn close" data-act="un-edit-x" aria-label="Закрыть">✕</button>
  <h2>${creating ? 'Создайте профиль' : 'Ваш профиль'}</h2>
  <div class="pv" style="background:${p.coverPreview ? `center/cover url(${p.coverPreview})` : bg(p.theme)}">${av({ ...p }, 64)}<div><b>${esc(p.name || 'Имя')}</b><br><small>@${esc(p.username || 'username')}</small></div></div>
  <p class="muted">Ваш класс нигде не показывается. Имя и @username видят все в вашей школе.</p>
  <form data-form="un-profile">
    <label class="fld"><span>@username (как в Telegram)</span><input name="username" value="${esc(p.username)}" ${canRen ? '' : 'readonly'} minlength="5" maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" required data-pf="username"><small id="un-uname-msg" class="muted">${canRen ? 'Латиница, цифры, «_». Уникален во всей SABAK+.' : 'Менять можно раз в 7 дней.'}</small></label>
    <label class="fld"><span>Имя в «Үн» (необязательно настоящее)</span><input name="name" value="${esc(p.name)}" minlength="2" maxlength="32" required data-pf="name"></label>
    <label class="fld"><span>О себе</span><input name="bio" value="${esc(p.bio || '')}" maxlength="140" data-pf="bio"></label>
    <div class="fld"><span>Эмодзи-аватар</span><div class="emo">${EMOJI.map(e => `<button type="button" class="${p.emoji === e ? 'on' : ''}" data-act="un-emoji" data-v="${e}" aria-label="${e}">${e}</button>`).join('')}</div></div>
    <div class="fld"><span>Тема профиля (видна всем)</span><div class="thms">${themes}</div>${unlocked ? '' : '<small class="muted">✦ Премиум-темы открываются в магазине «Алтын» (набор «Темы профиля»).</small>'}</div>
    <div class="fld"><span>Цвет акцента</span><div class="acc">${ACC.map(c => `<button type="button" class="${p.accent === c ? 'on' : ''}" style="background:${c}" data-act="un-accent" data-v="${c}" aria-label="${c}"></button>`).join('')}<input type="color" value="${esc(p.accent)}" data-pf="accent" aria-label="Свой цвет"></div></div>
    ${creating ? '' : `<div class="fld"><span>Обложка</span><label class="btn ghost sm">Загрузить фото<input type="file" id="un-cover" accept="image/jpeg,image/png,image/webp" hidden></label></div>`}
    <div class="nav-row"><button type="button" class="btn ghost" data-act="un-edit-x">Отмена</button><button class="btn blue" type="submit">${creating ? 'Создать профиль' : 'Сохранить'}</button></div></form></div>`;
}

// ---------- модерация (администрация) ----------
function modPage() {
  const Q = load('mod', async () => need(await V.call('th_mod_queue'))), Z = load('set', async () => need(await V.call('th_settings', {})));
  const back = '<p><a class="un-btn" href="#/admin/un">← К ленте</a></p>';
  if (Q === 'loading' || Z === 'loading') return '<div class="un-skel"></div>';
  if (Q.err || Z.err) return `<div class="slip"><p>⚠️ ${esc(Q.err || Z.err)}</p></div>`;
  const dir = S.state().session.level === 'director' || S.state().session.level === 'superadmin';
  const rows = Q.rows.map(r => `<article class="slip mq"><div class="mqh"><b>${r.kind === 'p' ? 'Пост' : 'Комментарий'}</b>${r.hidden ? ' <span class="warnb">скрыт</span>' : ''} <span class="warnb">жалоб: ${r.reports}</span><br><small class="muted">${r.author.anon ? esc(r.author.alias) : r.author.official ? 'Администрация' : '@' + esc(r.author.username || '—')}, ${ago(r.at)}</small></div><p class="quote">${esc(r.body)}</p>
    <div class="cbtns"><button class="un-btn" data-act="un-mod" data-k="${r.kind}" data-id="${r.id}" data-v="restore">Оставить</button><button class="un-btn hot" data-act="un-mod" data-k="${r.kind}" data-id="${r.id}" data-v="delete">Удалить</button><button class="un-btn" data-act="un-ban" data-k="${r.kind}" data-id="${r.id}">Удалить и ограничить автора</button>${Z.reveal ? `<button class="un-btn" data-act="un-reveal" data-k="${r.kind}" data-id="${r.id}">Раскрыть автора</button>` : ''}</div></article>`).join('') || '<div class="slip empty"><p>Жалоб нет. Тихо и спокойно.</p></div>';
  const bans = Q.bans.map(b => `<div class="brow"><div><b>Ограничение до ${new Date(b.until).toLocaleDateString('ru-RU')}</b><br><small class="muted">${esc(b.reason || 'без причины')}</small></div><button class="un-btn" data-act="un-unban" data-id="${b.id}">Снять</button></div>`).join('');
  const k = (l, v, w) => `<div class="slip kp ${w ? 'warn' : ''}"><b>${v}</b><small>${l}</small></div>`;
  return `${back}<div class="kpis">${k('постов за 7 дней', Z.stats.posts_7d)}${k('из них анонимных', Z.stats.anon_7d)}${k('профилей', Z.stats.profiles)}${k('с жалобами', Z.stats.reported, Z.stats.reported)}</div>
  ${rows}${bans ? `<section class="slip"><h3>Действующие ограничения</h3>${bans}</section>` : ''}
  <section class="slip"><h3>Настройки школы</h3>${dir ? `<label class="chk"><input type="checkbox" data-act="un-set-enabled" ${Z.enabled ? 'checked' : ''}> «Үн» включён в школе</label><br><label class="chk"><input type="checkbox" data-act="un-set-reveal" ${Z.reveal ? 'checked' : ''}> разрешить раскрывать автора анонимного поста (каждый случай записывается в журнал; по умолчанию выключено)</label>` : '<p class="muted">Включение и раскрытие меняет только директор.</p>'}
    <h4>Запрещённые слова</h4><div class="words">${Z.words.map(w => `<button class="tg big" data-act="un-word-del" data-v="${esc(w)}" title="Убрать">${esc(w)} ✕</button>`).join('') || '<small class="muted">нет</small>'}</div>
    <form data-form="un-word" class="inline"><label class="fld grow"><span>Добавить слово</span><input name="w" minlength="3" maxlength="40"></label><button class="un-btn" type="submit">Добавить</button></form></section>`;
}

// ---------- действия ----------
export function onInput(el) {
  const x = X();
  if (el.id === 'un-body') { x.draft = el.value; lsSet('sabak.un.draft', x.draft); const c = document.getElementById('un-cnt'), r = document.getElementById('un-ring'); if (c) { c.textContent = 600 - el.value.length; c.classList.toggle('low', 600 - el.value.length < 40); } if (r) r.style.setProperty('--p', Math.min(100, el.value.length / 6)); return true; }
  if (el.id === 'un-q') { x.q = el.value; clearTimeout(x.qt); x.qt = setTimeout(() => { rerender(); const i = document.getElementById('un-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); return true; }
  if (el.dataset && el.dataset.cd) { x.cdraft[el.dataset.cd] = el.value; return true; }
  if (el.dataset && el.dataset.pl !== undefined && x.poll) { x.poll[Number(el.dataset.pl)] = el.value; return true; }
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
  if (el.id === 'un-cover' && el.files[0]) { await guard(async () => { const path = await V.uploadMedia(el.files[0], 'cover'); need(await V.call('th_cover_set', { p_path: path })); fresh(); x.form = x.form || {}; x.form.coverPreview = URL.createObjectURL(el.files[0]); toast('Обложка обновлена', 'ok'); rerender(); }); return true; }
  if (el.dataset && el.dataset.act === 'un-set-enabled') { await guard(async () => { need(await V.call('th_settings', { p_enabled: el.checked })); fresh('set'); fresh('me'); rerender(); }); return true; }
  if (el.dataset && el.dataset.act === 'un-set-reveal') { await guard(async () => { if (el.checked && !confirm('Включить раскрытие авторов? Каждое раскрытие записывается в журнал школы.')) { rerender(); return; } need(await V.call('th_settings', { p_reveal: el.checked })); fresh('set'); fresh('me'); rerender(); }); return true; }
  if (el.dataset && el.dataset.pf === 'accent') { x.form.accent = el.value; rerender(); return true; }
  return false;
}
function burst(btn) {   // эхо: три расходящихся кольца
  btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 700);
}
export async function act(a, el) {
  const x = X(), M = me();
  switch (a) {
    case 'un-gate': x.mode = el.dataset.v; if (el.dataset.v === 'profile') { x.edit = true; x.form = null; } else x.anon = true; rerender(); return true;
    case 'un-tab': x.tab = el.dataset.v; rerender(); return true;
    case 'un-ptab': x.ptab = el.dataset.v; rerender(); return true;
    case 'un-tag': x.tag = x.tag === el.dataset.v ? null : el.dataset.v; x.tab = x.tab === 'saved' ? 'saved' : 'new'; if (!location.hash.endsWith('/un')) location.hash = '#/' + base() + '/un'; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); return true;
    case 'un-tag-x': x.tag = null; rerender(); return true;
    case 'un-day': x.draft = '#тема_дня ' + dayPrompt() + '\n'; lsSet('sabak.un.draft', x.draft); rerender(); setTimeout(() => { const t = document.getElementById('un-body'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 60); return true;
    case 'un-kind': { const t = '#' + el.dataset.v + ' '; if (!x.draft.includes(t.trim())) x.draft = (t + x.draft).slice(0, 600); if (el.dataset.v === 'честно') x.anon = true; lsSet('sabak.un.draft', x.draft); rerender(); setTimeout(() => { const b = document.getElementById('un-body'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 40); return true; }
    case 'un-poll': x.poll = x.poll ? null : ['', '']; if (x.poll && !x.draft.includes('#опрос')) { x.draft = (x.draft + ' #опрос').trim(); } rerender(); return true;
    case 'un-poll-add': if (x.poll.length < 5) x.poll.push(''); rerender(); return true;
    case 'un-poll-del': x.poll.splice(Number(el.dataset.i), 1); rerender(); return true;
    case 'un-vote': await guard(async () => { need(await V.call('th_vote', { p_post: el.dataset.id, p_opt: Number(el.dataset.i) })); fresh('feed'); fresh('pf'); }); return true;
    case 'un-save': { const id = el.dataset.id, i = x.saved.indexOf(id); if (i >= 0) x.saved.splice(i, 1); else x.saved.push(id); lsSet('sabak.un.saved', x.saved); toast(i >= 0 ? 'Убрано из сохранённого' : 'Сохранено', 'ok'); rerender(); return true; }
    case 'un-anon': x.anon = !(x.anon === null ? !(M && M.profile) : x.anon); rerender(); return true;
    case 'un-media-x': x.media = null; x.mediaPreview = null; rerender(); return true;
    case 'un-edit': x.edit = true; x.form = null; rerender(); return true;
    case 'un-edit-x': x.edit = false; x.form = null; if (M && !M.profile && x.mode === 'profile') x.mode = null; rerender(); return true;
    case 'un-theme': { if (el.dataset.v.startsWith('x-') && !(M && M.unlocked)) { toast('Премиум-тема открывается в магазине «Алтын»', 'warn'); return true; } x.form.theme = el.dataset.v; rerender(); return true; }
    case 'un-emoji': x.form.emoji = el.dataset.v; rerender(); return true;
    case 'un-accent': x.form.accent = el.dataset.v; rerender(); return true;
    case 'un-cm': x.open[el.dataset.id] = !x.open[el.dataset.id]; rerender(); return true;
    case 'un-like': {
      const btn = el, was = btn.classList.contains('on'); btn.classList.toggle('on'); burst(btn); const nEl = btn.querySelector('b'); nEl.textContent = Number(nEl.textContent) + (was ? -1 : 1);
      try { const r = need(await V.call('th_like', { p_kind: el.dataset.k, p_id: el.dataset.id })); nEl.textContent = r.n; btn.classList.toggle('on', r.liked); } catch (e) { toast(e.message, 'warn'); fresh(); rerender(); }
      fresh('feed'); fresh('pf'); return true;
    }
    case 'un-report': await guard(async () => { const why = prompt('Что не так? (оскорбление, угроза, травля, спам…)'); if (!why) return; need(await V.call('th_report', { p_kind: el.dataset.k, p_id: el.dataset.id, p_reason: why.slice(0, 200) })); toast('Спасибо, модератор проверит', 'ok'); }); return true;
    case 'un-del': await guard(async () => { if (!confirm('Удалить?')) return; need(await V.call('th_delete', { p_kind: el.dataset.k, p_id: el.dataset.id })); fresh(); rerender(); }); return true;
    case 'un-mod': await guard(async () => { need(await V.call('th_mod_decide', { p_kind: el.dataset.k, p_id: el.dataset.id, p_action: el.dataset.v })); fresh(); rerender(); }); return true;
    case 'un-ban': await guard(async () => { const d = Number(prompt('На сколько дней ограничить автора? (1, 3, 7 или 30)', '3')); if (!d) return; const why = prompt('Причина (увидит только администрация):', 'нарушение правил') || ''; need(await V.call('th_ban', { p_kind: el.dataset.k, p_id: el.dataset.id, p_days: d, p_reason: why })); need(await V.call('th_mod_decide', { p_kind: el.dataset.k, p_id: el.dataset.id, p_action: 'delete' })); fresh(); toast('Автор ограничен, материал удалён', 'ok'); rerender(); }); return true;
    case 'un-unban': await guard(async () => { need(await V.call('th_unban', { p_id: el.dataset.id })); fresh(); rerender(); }); return true;
    case 'un-reveal': await guard(async () => { const why = prompt('Причина раскрытия (запишется в журнал):'); if (!why || why.length < 5) return; const r = need(await V.call('th_reveal', { p_kind: el.dataset.k, p_id: el.dataset.id, p_reason: why })); alert('Автор: ' + (r.name || '—') + (r.cls ? ', ' + r.cls : '')); }); return true;
    case 'un-word-del': await guard(async () => { need(await V.call('th_settings', { p_del: el.dataset.v })); fresh('set'); rerender(); }); return true;
  }
  return false;
}
export async function submit(f, fd) {
  const k = f.dataset.form, x = X(), v = n => String(fd.get(n) || '').trim(), M = me();
  if (k === 'un-post') { await guard(async () => {
    const student = S.state().session.role === 'student', anon = student ? (x.anon === null ? !(M && M.profile) : x.anon) : false;
    const args = { p_body: v('body'), p_anon: anon, p_media: x.media, p_kind: x.media ? (x.mediaKind || 'image') : null };
    if (x.poll) { const o = x.poll.map(s => s.trim()).filter(Boolean); if (o.length < 2) throw new Error(UN_ERR.poll); args.p_poll = o; }
    x.posting = true; rerender();
    try { need(await V.call('th_post', args)); x.draft = ''; lsSet('sabak.un.draft', ''); x.media = null; x.mediaPreview = null; x.poll = null; x.tab = x.tab === 'saved' ? 'new' : x.tab; fresh(); toast(anon ? 'Опубликовано анонимно' : 'Опубликовано', 'ok'); }
    finally { x.posting = false; rerender(); } }); return true; }
  if (k === 'un-comment') { await guard(async () => {
    const student = S.state().session.role === 'student', anon = student ? (x.anon === null ? !(M && M.profile) : x.anon) : false;
    need(await V.call('th_comment', { p_post: f.dataset.post, p_body: v('body'), p_anon: anon, p_parent: null })); x.cdraft[f.dataset.post] = ''; fresh('c:' + f.dataset.post); fresh('feed'); fresh('pf'); rerender(); }); return true; }
  if (k === 'un-profile') { await guard(async () => {
    const creating = !(M && M.profile), p = x.form || {};
    need(await V.call('th_profile_save', { p_username: v('username'), p_name: v('name'), p_bio: v('bio'), p_emoji: p.emoji || '🙂', p_theme: p.theme || 'ocean', p_accent: p.accent || '#1E2FD0' }));
    x.edit = false; x.form = null; x.mode = 'profile'; x.anon = false; fresh(); toast(creating ? 'Профиль создан' : 'Профиль сохранён', 'ok'); if (creating) window.__confetti && window.__confetti(); rerender(); }); return true; }
  if (k === 'un-word') { await guard(async () => { need(await V.call('th_settings', { p_add: v('w') })); fresh('set'); rerender(); }); return true; }
  return false;
}
export const refresh = fresh;
