// 0.7 БАГЫТ: карта школ строится из узлов, графики растут из 3D-сетки, макет центра управления (DEMO, вымышленные данные).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], NS = 'http://www.w3.org/2000/svg', esc = C.esc;
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const el = (tag, at = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent && parent.appendChild(e); return e; };

  /* ---- карта ---- */
  const map = $('#map'); [120, 230, 340, 440].forEach(r => el('circle', { class: 'ring', cx: 500, cy: 500, r }, map));
  const N = 14, nodes = [];
  for (let i = 0; i < N; i++) { const ring = i < 4 ? 0 : i < 9 ? 1 : 2, R = [150, 270, 390][ring], per = [4, 5, 5][ring], k = ring === 0 ? i : ring === 1 ? i - 4 : i - 9, a = (k / per) * Math.PI * 2 + ring * .6 + i * .05;
    const x = 500 + Math.cos(a) * R, y = 500 + Math.sin(a) * R * .96; const lk = el('line', { class: 'lk', x1: 500, y1: 500, x2: x, y2: y, pathLength: 1 }, map);
    const nd = el('circle', { class: 'nd' + (i === 5 || i === 11 ? ' hot' : ''), cx: x, cy: y, r: 11 }, map); const tx = el('text', { x: x + 16, y: y + 5 }, map); tx.textContent = 'ШК-' + String(i + 1).padStart(2, '0');
    const pl = el('circle', { class: 'pulse', r: 3.5, cx: x, cy: y }, map); nodes.push({ x, y, lk, nd, tx, pl, i }); }
  el('circle', { class: 'core', cx: 500, cy: 500, r: 34 }, map); el('path', { d: 'M500 484l-18 10v18c0 14 10 22 18 26 8-4 18-12 18-26v-18z', fill: 'none', stroke: '#38e1c6', 'stroke-width': 2.5 }, map);
  C.pin($('#hero'), p => {
    nodes.forEach((n, i) => { const k = seg(p, .06 + i * .03, .2 + i * .03); n.nd.setAttribute('r', (11 * C.ease.out(k)).toFixed(1)); n.tx.style.opacity = k; n.lk.style.strokeDashoffset = 1 - C.ease.out(seg(p, .1 + i * .03, .3 + i * .03)); });
    $('#hcount').textContent = nodes.filter((n, i) => p > .1 + i * .03).length;
    set($('#mega'), '--sc', C.ease.inOut(seg(p, .02, .3))); set($('.sub'), '--sb', seg(p, .28, .4)); set($('.hint'), '--m', p);
    const zi = seg(p, .72, .95), t = nodes[2]; set($('#map3d'), '--cam', C.ease.inOut(seg(p, .4, .7))); set(map, '--cam', C.ease.inOut(seg(p, .4, .7)) * (1 - zi * .0)); set(map, '--tx', ((500 - t.x) / 10) * zi); set(map, '--ty', ((500 - t.y) / 10) * zi);
    set(map, '--cam', C.ease.inOut(seg(p, .35, .7)) + zi * .6);
  }, 1);
  C.loop($('#hero'), (dt, t) => { if (C.reduced) return; nodes.forEach((n, i) => { const k = (t * .35 + i * .13) % 1; n.pl.setAttribute('cx', 500 + (n.x - 500) * k); n.pl.setAttribute('cy', 500 + (n.y - 500) * k); n.pl.setAttribute('opacity', Math.sin(k * Math.PI) * .9); }); });

  /* ---- графики ---- */
  const g = $('#gsvg'), X0 = 70, W = 660, BASE = 440, H = 340; const act = [52, 61, 58, 74, 69, 83, 90], reg = [8, 12, 9, 15, 18, 16, 24];
  for (let i = 0; i <= 7; i++) el('line', { x1: X0 + i * W / 7, y1: BASE, x2: X0 + i * W / 7 + 40, y2: BASE - H, stroke: '#38e1c622' }, g);
  for (let j = 0; j <= 4; j++) el('line', { x1: X0, y1: BASE - j * H / 4, x2: X0 + W + 40, y2: BASE - j * H / 4 - 0, stroke: '#38e1c622', transform: `translate(${j * 10} 0)` }, g);
  const bars = act.map((v, i) => { const gp = el('g', {}, g); const f = el('rect', { fill: '#38e1c6' }, gp), s = el('polygon', { fill: '#1aa892' }, gp), t = el('polygon', { fill: '#7ff0dc' }, gp); const d = el('text', { 'font-size': 13, 'font-family': 'ui-monospace,monospace', fill: '#9fc9c3', 'text-anchor': 'middle', y: BASE + 24, x: X0 + i * W / 7 + 28 }, gp); d.textContent = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]; return { f, s, t, v, i }; });
  const line = el('polyline', { fill: 'none', stroke: '#ffb454', 'stroke-width': 3.5, 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }, g); const dots = reg.map(() => el('circle', { r: 5, fill: '#ffb454' }, g));
  const drawG = k => { bars.forEach(b => { const kk = C.ease.out(C.clamp(k * 1.6 - b.i * .1)), h = (b.v / 100) * H * kk, x = X0 + b.i * W / 7 + 6, y = BASE - h, w = 44, d = 14; b.f.setAttribute('x', x); b.f.setAttribute('y', y); b.f.setAttribute('width', w); b.f.setAttribute('height', Math.max(0, h)); b.s.setAttribute('points', `${x + w},${y} ${x + w + d},${y - 9} ${x + w + d},${BASE - 9} ${x + w},${BASE}`); b.t.setAttribute('points', `${x},${y} ${x + d},${y - 9} ${x + w + d},${y - 9} ${x + w},${y}`); });
    const pts = reg.map((v, i) => [X0 + i * W / 7 + 28, BASE - 26 - (v / 30) * H * .8]); line.setAttribute('points', pts.map(p => p.join(',')).join(' ')); line.style.strokeDashoffset = 1 - C.clamp(k * 1.4 - .2);
    dots.forEach((d, i) => { d.setAttribute('cx', pts[i][0]); d.setAttribute('cy', pts[i][1]); d.setAttribute('opacity', C.clamp(k * 1.4 - .2 - i / 7 * .8 + .1)); }); };
  const vals = [[48, 'Школ'], 8420, 560, 63900]; const tiles = ['#t1', '#t2', '#t3', '#t4'], tv = [48, 12840, 960, 214300];
  C.pin($('#g3'), p => { const k = seg(p, .05, .75); drawG(k); set($('#g3'), '--g', k); set($('.gchart'), '--g', k); tiles.forEach((s, i) => { $(s).textContent = Math.round(tv[i] * C.ease.out(k)).toLocaleString('ru-RU'); }); set($('.gscan'), '--gs', seg(p, .02, .8)); set($('.gscan'), '--gso', p > .02 && p < .8 ? 1 : 0); }, 1);
  drawG(C.reduced ? 1 : 0);

  /* ---- макет центра управления ---- */
  const SC = [['Демо-школа №1', 'г. Пример', 480, 24, 4.4, 96, 'on', 2], ['Демо-лицей «Алатоо»', 'г. Пример', 720, 41, 4.1, 94, 'on', 0], ['Демо-гимназия «Ак-Таш»', 'с. Образец', 310, 19, 4.6, 97, 'on', 1], ['Демо-школа №7', 'г. Образец', 530, 28, 3.9, 91, 'on', 0], ['Демо-школа «Жаңы»', 'г. Пример', 150, 11, 4.2, 93, 'on', 3], ['Демо-школа №12', 'с. Образец', 260, 15, 4.0, 90, 'on', 0]];
  const S = SC.map((r, i) => ({ id: i, name: r[0], city: r[1], students: r[2], teachers: r[3], avg: r[4], att: r[5], on: r[6] === 'on', days: [0, 2, 1, 16, 0, 15][i], note: '', dir: ['Айгүл Ж.', 'Нурлан Б.', 'Бермет К.', 'Тимур А.', 'Салтанат Э.', 'Эрлан М.'][i], key: null }));
  const APP = [{ id: 1, school: 'Демо-школа «Булак»', who: 'вымышленный директор', st: 'new' }, { id: 2, school: 'Демо-лицей «Тоо»', who: 'вымышленный директор', st: 'new' }];
  const REQ = [{ id: 1, from: 'Демо-школа №7', text: 'Не приходит приглашение учителю', open: true }, { id: 2, from: 'Демо-школа №12', text: 'Как архивировать год?', open: true }];
  const LOG = [['09:12', 'Вход', 'Центр управления (демо)']]; let sel = 0, tab = 'ov';
  const toastEl = $('#toast'); let tt = 0; const toast = m => { toastEl.textContent = m; set(toastEl, '--to', 1); clearTimeout(tt); tt = setTimeout(() => set(toastEl, '--to', 0), 2200); };
  const log = (a, d) => { LOG.unshift([new Date().toTimeString().slice(0, 5), a, d]); };
  const attention = () => S.filter(s => s.days >= 14).length + REQ.filter(r => r.open).length + APP.filter(a => a.st === 'new').length;
  const bars7 = [52, 61, 58, 74, 69, 83, 90];
  const P = {
    ov: () => `<div class="kp"><div><small>Школы</small><b>${S.length}</b></div><div><small>Ученики</small><b>${S.reduce((a, s) => a + s.students, 0)}</b></div><div><small>Учителя</small><b>${S.reduce((a, s) => a + s.teachers, 0)}</b></div><div><small>Оценки · 7 дней</small><b>${(bars7.reduce((a, b) => a + b, 0) * 13).toLocaleString('ru-RU')}</b></div></div>
      <p class="dm-h">Активность за 7 дней</p><div class="bars">${bars7.map(v => `<i style="height:${v}%"><em>${v}</em></i>`).join('')}</div>
      <p class="dm-h">Самые активные школы</p><ol class="lst">${[...S].sort((a, b) => b.students - a.students).slice(0, 3).map(s => `<li><span class="nm">${esc(s.name)}</span><small>${s.students} учеников</small></li>`).join('')}</ol>
      <p class="dm-h">Приватность</p><p class="story" style="margin:0">Центр видит сводные числа и архив для чтения. Персональных оценок детей здесь нет.</p>`,
    sc: () => `<div class="sg"><div class="sl">${S.map(s => `<button type="button" class="sc" data-s="${s.id}" aria-pressed="${s.id === sel}"><span class="st ${s.on ? 'on' : 'off'}">${s.on ? 'РАБОТАЕТ' : 'ПРИОСТАНОВЛЕНА'}</span><b>${esc(s.name)}</b><br><small>${esc(s.city)}</small></button>`).join('')}</div>${card()}</div>`,
    at: () => `<p class="dm-h">Школы без оценок 14 и более дней</p><ul class="lst">${S.filter(s => s.days >= 14).map(s => `<li><span class="nm">${esc(s.name)}</span><small>${s.days} дн. без оценок</small></li>`).join('') || '<li><small>Нет</small></li>'}</ul>
      <p class="dm-h">Обращения без ответа</p><ul class="lst">${REQ.filter(r => r.open).map(r => `<li><span><b>${esc(r.from)}</b><br><small>${esc(r.text)}</small></span><button type="button" class="bt" data-reply="${r.id}">Ответить</button></li>`).join('') || '<li><small>Нет</small></li>'}</ul>
      <p class="dm-h">Новые заявки на подключение</p><ul class="lst">${APP.filter(a => a.st === 'new').map(a => `<li><span><b>${esc(a.school)}</b><br><small>${esc(a.who)}</small></span><button type="button" class="bt" data-app="${a.id}">Выдать ключ</button></li>`).join('') || '<li><small>Нет</small></li>'}</ul>`,
    no: () => `<form id="nf"><p class="dm-h">Уведомление школам</p><label>Кому <select id="nto"><option value="all">Всем школам</option>${S.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><textarea id="ntx" maxlength="200" placeholder="Текст уведомления (демо)"></textarea><div class="acts"><button class="bt" type="submit">Отправить</button></div></form>`,
    lg: () => `<label>Фильтр <select id="lf"><option value="">Все события</option><option>Вход</option><option>Ключ</option><option>Школа</option><option>Уведомление</option><option>Обращение</option></select></label><ul class="lst" id="ll"></ul>`,
  };
  function card() { const s = S[sel]; return `<div class="card"><h3>${esc(s.name)}</h3><small>${esc(s.city)} · директор: ${esc(s.dir)} (вымышленный)</small><dl><dt>Ученики</dt><dd>${s.students}</dd><dt>Учителя</dt><dd>${s.teachers}</dd><dt>Средний балл</dt><dd>${s.avg.toString().replace('.', ',')}</dd><dt>Посещаемость</dt><dd>${s.att}%</dd><dt>Статус</dt><dd>${s.on ? 'Работает' : 'Приостановлена'}</dd>${s.note ? `<dt>Заметка</dt><dd>${esc(s.note)}</dd>` : ''}</dl>
    ${s.key ? `<div class="key">${esc(s.key)}</div><p class="story">Ключ «выдан» (демо). Ничего не отправлено.</p>` : ''}
    <div class="acts"><button type="button" data-act="toggle">${s.on ? 'Приостановить' : 'Возобновить'}</button><button type="button" data-act="key">Выдать ключ</button><button type="button" data-act="rename">Переименовать</button><button type="button" data-act="note">Заметка</button></div></div>`; }
  const view = $('#view');
  function show(t, scan = true) { tab = t; $$('#tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); $$('.pane').forEach(p => { p.hidden = p.id !== 'p-' + t; }); $('#p-' + t).innerHTML = P[t](); $('#atb').textContent = attention(); if (t === 'lg') llist(); if (scan && !C.reduced) { const s = $('#scan'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); } }
  const llist = () => { const f = $('#lf').value; $('#ll').innerHTML = LOG.filter(r => !f || r[1] === f).map(r => `<li><span><b>${esc(r[1])}</b> · ${esc(r[2])}</span><small>${r[0]}</small></li>`).join(''); $('#lf').onchange = llist; };
  $('#tabs').onclick = e => { const b = e.target.closest('[role=tab]'); if (b) show(b.dataset.tab); };
  view.addEventListener('click', e => {
    const sc = e.target.closest('[data-s]'); if (sc) { sel = +sc.dataset.s; show('sc', false); return; }
    const a = e.target.closest('[data-act]'); if (a) { const s = S[sel];
      if (a.dataset.act === 'toggle') { const reason = s.on ? prompt('Причина приостановки (демо):', 'Нарушение условий') : 'ok'; if (reason === null || reason === '') return; s.on = !s.on; log('Школа', `${s.name}: ${s.on ? 'возобновлена' : 'приостановлена — ' + esc(reason)}`); toast(s.on ? 'Школа возобновлена (демо)' : 'Школа приостановлена (демо)'); }
      if (a.dataset.act === 'key') { s.key = 'SBK-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); log('Ключ', `${s.name}: выдан ключ (демо)`); toast('Ключ создан (демо)'); }
      if (a.dataset.act === 'rename') { const n = prompt('Новое название (демо):', s.name); if (n) { log('Школа', `${s.name} → ${n.slice(0, 40)}`); s.name = n.slice(0, 40); } }
      if (a.dataset.act === 'note') { const n = prompt('Внутренняя заметка (демо):', s.note); if (n !== null) { s.note = n.slice(0, 80); log('Школа', `${s.name}: заметка обновлена`); } }
      show('sc', false); return; }
    const r = e.target.closest('[data-reply]'); if (r) { const q = REQ.find(x => x.id === +r.dataset.reply); q.open = false; log('Обращение', `Ответ: ${q.from}`); toast('Ответ отправлен (демо)'); show('at', false); return; }
    const ap = e.target.closest('[data-app]'); if (ap) { const q = APP.find(x => x.id === +ap.dataset.app); q.st = 'done'; log('Ключ', `Заявка «${q.school}»: ключ выдан (демо)`); toast('Ключ выдан, WhatsApp не открывается: это демо'); show('at', false); }
  });
  view.addEventListener('submit', e => { if (e.target.id !== 'nf') return; e.preventDefault(); const t = $('#ntx').value.trim(); if (!t) return toast('Введите текст'); const to = $('#nto').value === 'all' ? 'всем школам' : S[+$('#nto').value].name; log('Уведомление', `${to}: ${t.slice(0, 40)}`); toast('Уведомление отправлено (демо)'); $('#ntx').value = ''; });
  show('ov', false);

  /* ---- финал: радар ---- */
  const bl = $('#blips'); for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 40 + (i * 37) % 140; el('circle', { cx: 200 + Math.cos(a) * r, cy: 200 + Math.sin(a) * r, r: 3.5, fill: '#38e1c6' }, bl); }
  C.pin($('#finale'), p => { set($('.radar'), '--fr', seg(p, 0, .5)); set($('#sweep'), '--sw', p * 1080); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
}
