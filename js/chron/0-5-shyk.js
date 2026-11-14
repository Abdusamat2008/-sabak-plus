// 0.5 ШЫК: звезда раскрывается лепестками, достижения, демо доступности и расписания.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  function build(el) { for (let i = 0; i < 8; i++) { const n = document.createElement('i'); n.style.setProperty('--a', i * 45); n.style.setProperty('--d', 40 + (i % 2) * 30); n.style.setProperty('--s', 1 - (i % 2) * .25); el.appendChild(n); } }
  build($('#star')); build($('#star2'));
  $$('#orbit i').forEach((n, k) => n.style.setProperty('--k', k));
  C.pin($('#hero'), p => {
    const st = $('.stage'); set(st, '--p', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .25)));
    const sp = Math.sin(seg(p, .1, .6) * Math.PI) ; set($('#star'), '--sp', sp * 2); set($('#star'), '--r', p * 160);
    set($('#orbit'), '--p', p); set($('#orbit'), '--oo', seg(p, .5, .75)); set($('#orbit'), '--or', C.ease.out(seg(p, .5, .85))); set(st, '--hn', p);
  }, 1);
  C.pin($('#finale'), p => { set($('#star2'), '--sp', Math.sin(seg(p, .05, .6) * Math.PI) * 1.5); set($('#star2'), '--r', p * 120); set($('#quote'), '--qo', seg(p, .5, .75)); }, 1);
  /* доступность */
  const sm = $('#sample');
  $$('.tb').forEach(b => b.onclick = () => { $$('.tb').forEach(x => x.classList.toggle('on', x === b)); sm.dataset.t = b.dataset.t; });
  $('#sz').oninput = e => { sm.style.setProperty('--z', e.target.value / 100); $('#szv').textContent = e.target.value + '%'; };
  $('#dys').onchange = e => sm.classList.toggle('dys', e.target.checked);
  /* медали */
  const md = $('#medals'); const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { md.style.setProperty('--g', 1); io.disconnect(); } }), { threshold: .4 }); io.observe(md); if (C.reduced) md.style.setProperty('--g', 1);
  /* расписание */
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'], lessons = ['Алгебра', 'Геометрия', 'Адабият', 'Тарых', 'Физика', 'Музыка'], tt = $('#tt'), bank = $('#bank'); let sel = null; const cells = [];
  tt.appendChild(document.createElement('div'));
  days.forEach(d => { const h = document.createElement('div'); h.className = 'h'; h.textContent = d; tt.appendChild(h); });
  for (let r = 1; r <= 3; r++) { const t = document.createElement('div'); t.className = 't'; t.textContent = r; tt.appendChild(t); for (let c = 0; c < 5; c++) { const x = document.createElement('div'); x.className = 'c'; x.setAttribute('role', 'gridcell'); x.dataset.k = r + '-' + c; tt.appendChild(x); cells.push(x); } }
  const msg = $('#tmsg'), say = t => { msg.textContent = t; };
  function place(cell, name) { cell.textContent = name; cell.classList.add('f'); }
  function drop(cell, name) { if (!cell) return; if (cell.classList.contains('f')) { cell.classList.add('bad'); setTimeout(() => cell.classList.remove('bad'), 350); say('Клетка занята'); return; } const row = cell.dataset.k.split('-')[0], same = cells.some(c => c !== cell && c.classList.contains('f') && c.dataset.k.split('-')[0] === row && c.dataset.k.split('-')[1] === cell.dataset.k.split('-')[1] && c.textContent === name); if (same) { say('Этот урок уже стоит в этот день'); return; } place(cell, name); say('Урок поставлен'); }
  lessons.forEach(n => { const l = document.createElement('div'); l.className = 'les'; l.textContent = n; l.tabIndex = 0; bank.appendChild(l);
    l.onclick = () => { $$('.les').forEach(x => x.classList.remove('sel')); if (sel === n) { sel = null; return; } sel = n; l.classList.add('sel'); say('Выберите клетку'); };
    l.onpointerdown = e => { if (e.pointerType === 'mouse' && e.button) return; const g = l.cloneNode(true); g.classList.add('drag'); let moved = 0; const mv = ev => { moved++; g.style.left = ev.clientX - 30 + 'px'; g.style.top = ev.clientY - 20 + 'px'; document.body.appendChild(g); cells.forEach(c => { const r = c.getBoundingClientRect(); c.classList.toggle('over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom); }); }; const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); g.remove(); const tgt = cells.find(c => c.classList.contains('over')); cells.forEach(c => c.classList.remove('over')); if (moved > 3) { drop(tgt, n); l.dataset.drag = 1; setTimeout(() => delete l.dataset.drag, 50); } }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
  });
  cells.forEach(c => c.onclick = () => { if (c.classList.contains('f')) { c.textContent = ''; c.classList.remove('f'); say('Урок убран'); } else if (sel) { drop(c, sel); } else say('Сначала выберите урок'); });
  $('#tclr').onclick = () => { cells.forEach(c => { c.textContent = ''; c.classList.remove('f'); }); say('Расписание очищено'); };
  $('#tsave').onclick = () => say('Версия ' + (cells.filter(c => c.classList.contains('f')).length) + ' уроков сохранена только на этой странице (демо)');
}
