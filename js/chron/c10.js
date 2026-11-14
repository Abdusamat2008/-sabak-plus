// 0.9 ҮН: звуковая волна в 3D проходит по странице; доска, эхо с кругами, опрос
export default function init({ $, $$, scene, loop, fit, clamp, ease, lite, store }) {
  const cv = $('#wv'), cx = fit(cv); let P = 0; const hero = $('#h10'); scene(hero, p => { P = p; });
  const ROWS = lite ? 14 : 24, COLS = lite ? 50 : 90;
  loop(cv, (dt, t, st) => {
    const w = cv.w, h = cv.h, p = st ? .8 : P; cx.clearRect(0, 0, w, h); const amp = (.25 + ease(clamp(p / .6)) * .75) * h * .12, spread = ease(clamp(p / .4));
    for (let r = ROWS - 1; r >= 0; r--) { const z = r / ROWS, y0 = h * (.42 + z * .5), sc = .35 + z * .75; cx.beginPath();
      for (let c = 0; c <= COLS; c++) { const u = c / COLS, x = (w * .5) + (u - .5) * w * 1.1 * sc * (.6 + spread * .4), env = Math.exp(-Math.pow((u - .5) * 3, 2)) , y = y0 - Math.sin(u * 18 - t * 2.4 + r * .5) * amp * env * sc - Math.sin(u * 5 + t) * amp * .15 * sc; c ? cx.lineTo(x, y) : cx.moveTo(x, y); }
      cx.strokeStyle = `hsla(${45 + z * 230},90%,${60 + z * 10}%,${.15 + z * .6})`; cx.lineWidth = .8 + z * 1.6; cx.stroke(); }
    $$('.paperf i', hero).forEach(() => {});
  });
  // доска
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P0 = [{ a: '@ayim', t: 'Как лучше готовиться к контрольной по физике? #вопрос #физика', k: 'Вопрос', e: 14, ph: false, saved: false }, { a: 'Директор', t: 'Поздравляем победителей олимпиады! #новости', k: 'Идея', e: 31, off: true }, { a: 'Горный козёл', t: 'Честно: иногда слишком много домашки #честно #учёба', k: 'Честно', e: 22, anon: true }, { a: '@erlan', t: 'Идея: школьная радиопередача на перемене #идея #радио', k: 'Идея', e: 9 }, { a: '@nura', t: 'Фото с экскурсии на Иссык-Куль 📷 #фото', k: 'Идея', e: 18, ph: true }];
  const TABS = ['Лента', 'Популярное', 'Честно', 'Фото', 'Сохранённое'], KINDS = ['Вопрос', 'Идея', 'Честно']; let tab = 0, tag = '', q = '', kind = 'Идея', anim = true;
  $('#tb9').innerHTML = TABS.map((x, i) => `<button role="tab" type="button" data-i="${i}" aria-selected="${!i}">${x}</button>`).join(''); $('#kd').innerHTML = KINDS.map(k => `<button type="button" data-k="${k}" aria-pressed="${k === kind}">${k}</button>`).join('');
  const tags = () => { const m = {}; P0.forEach(p => (p.t.match(/#[\p{L}\d_]+/gu) || []).forEach(g => m[g] = (m[g] || 0) + 1)); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]); };
  const draw = () => { $('#tg9').innerHTML = tags().map(g => `<button type="button" data-g="${esc(g)}" aria-pressed="${g === tag}">${esc(g)}</button>`).join('');
    let L = P0.filter(p => (!tag || p.t.includes(tag)) && (!q || (p.t + p.a).toLowerCase().includes(q)) && (tab !== 2 || p.anon) && (tab !== 3 || p.ph) && (tab !== 4 || p.saved)); if (tab === 1) L = [...L].sort((a, b) => b.e - a.e);
    $('#bo').innerHTML = L.length ? L.map((p, i) => `<article class="leaf ${p.anon ? 'anon' : ''} ${p.off ? 'off' : ''}" style="--r:${((i * 7) % 5 - 2) * .6}deg"><header><b>${esc(p.a)}</b><span class="kind">${esc(p.k)}${p.anon ? ' · анонимно' : p.off ? ' · официально' : ''}</span></header><p>${esc(p.t.replace(/#[\p{L}\d_]+/gu, ''))}</p><p class="tg">${esc((p.t.match(/#[\p{L}\d_]+/gu) || []).join(' '))}</p><div class="acts"><button type="button" data-e="${P0.indexOf(p)}">◉ ${p.e}</button><button type="button" data-s="${P0.indexOf(p)}" aria-pressed="${!!p.saved}">${p.saved ? '★ В закладках' : '☆ Сохранить'}</button></div></article>`).join('') : '<p class="note">Ничего не найдено.</p>'; };
  $('#tb9').onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = +b.dataset.i; $$('#tb9 button').forEach(x => x.setAttribute('aria-selected', x === b)); draw(); };
  $('#tg9').onclick = e => { const b = e.target.closest('button'); if (!b) return; tag = tag === b.dataset.g ? '' : b.dataset.g; draw(); }; $('#sq').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#kd').onclick = e => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.k; $$('#kd button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#bo').onclick = e => { const a = e.target.closest('[data-e]'), s = e.target.closest('[data-s]'); if (a) { P0[+a.dataset.e].e++; draw(); } else if (s) { const p = P0[+s.dataset.s]; p.saved = !p.saved; draw(); } };
  const nt = $('#nt'), upd = () => { const n = nt.value.length; $('#rc').textContent = 140 - n; $('.ring').style.setProperty('--rr', n / 140); };
  try { nt.value = store.get('chron.draft9') || ''; } catch {} upd(); let tm; nt.oninput = () => { upd(); store.set('chron.draft9', nt.value); $('#dn').textContent = 'Черновик сохранён'; clearTimeout(tm); tm = setTimeout(() => $('#dn').textContent = '', 1500); };
  $('#np').onclick = () => { const t = nt.value.trim(); if (!t) { $('#dn').textContent = 'Напишите текст.'; return; } P0.unshift({ a: '@aibek', t, k: kind, e: 0, anon: kind === 'Честно' }); nt.value = ''; store.set('chron.draft9', ''); upd(); tab = 0; $$('#tb9 button').forEach((x, i) => x.setAttribute('aria-selected', !i)); draw(); $('#dn').textContent = 'Опубликовано (демо).'; };
  draw();
  // эхо
  const ec = $('#ec'), ex = fit(ec), rings = [];
  const echo = (btn, nEl) => { const on = btn.getAttribute('aria-pressed') === 'true'; btn.setAttribute('aria-pressed', !on); nEl.textContent = +nEl.textContent + (on ? -1 : 1); if (on) return; const r = btn.getBoundingClientRect(), c = ec.getBoundingClientRect(); for (let i = 0; i < 3; i++) rings.push({ x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top, t: -i * .22 }); };
  $('#eb').onclick = () => echo($('#eb'), $('#en')); $('#eb2').onclick = () => echo($('#eb2'), $('#en2'));
  loop(ec, (dt, t, st) => { ex.clearRect(0, 0, ec.w, ec.h); for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.t += dt / 1000; if (g.t < 0) continue; const k = g.t / 1.4; if (k >= 1) { rings.splice(i, 1); continue; } ex.strokeStyle = `rgba(255,183,3,${1 - k})`; ex.lineWidth = 3 * (1 - k) + 1; ex.beginPath(); ex.arc(g.x, g.y, 14 + k * 160, 0, 6.283); ex.stroke(); } });
  // опрос
  const O = [['Музыка и танцы', 18], ['Конкурс талантов', 11], ['Турнир по шахматам', 7], ['Выставка рисунков', 5], ['Квест по школе', 9]]; let voted = -1; const po = $('#po');
  const dpo = () => { const tot = O.reduce((a, o) => a + o[1], 0); po.innerHTML = O.map((o, i) => `<button class="op ${voted === i ? 'me' : ''}" type="button" data-i="${i}" ${voted >= 0 ? 'disabled' : ''}><i style="--v:${voted >= 0 ? o[1] / Math.max(...O.map(x => x[1])) : 0}"></i><span>${o[0]}</span><span>${voted >= 0 ? Math.round(o[1] / tot * 100) + '%' : ''}</span></button>`).join(''); };
  po.onclick = e => { const b = e.target.closest('.op'); if (!b || voted >= 0) return; voted = +b.dataset.i; O[voted][1]++; dpo(); requestAnimationFrame(() => { $$('.op i', po).forEach((i, k) => i.style.setProperty('--v', O[k][1] / Math.max(...O.map(x => x[1])))); }); $('#pn9').textContent = 'Голос принят. Результаты анонимны: имён не видно (демо).'; }; dpo();
}
