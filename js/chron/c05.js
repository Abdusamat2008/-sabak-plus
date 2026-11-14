// 0.5 ШЫК: звезда раскрывается лучами (13 = число правил достижений); демо доступности, достижений, расписания
export default function init({ $, $$, scene, clamp, ease }) {
  const hero = $('#h5'), rays = $$('#rays .ray');
  scene(hero, p => { rays.forEach((r, i) => r.style.setProperty('--o', ease(clamp((p * 1.5 - i * .035) * 2.2)).toFixed(3))); const col = ease(clamp((p - .75) / .25)); rays.forEach(r => r.style.transform = `scale(${1 - col * .15})`); });
  // доступность
  const T = [['std', 'Стандартная'], ['hc', 'Контрастная'], ['dark', 'Тёмная'], ['yb', 'Жёлтый на чёрном']], pv = $('#prev'), th = $('#themes');
  th.innerHTML = T.map((t, i) => `<button class="opt" type="button" data-t="${t[0]}" aria-pressed="${!i}">${t[1]}</button>`).join('');
  th.onclick = e => { const b = e.target.closest('.opt'); if (!b) return; pv.dataset.th = b.dataset.t; $$('.opt', th).forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('#sz').oninput = e => { pv.style.setProperty('--sz', e.target.value / 100); $('#szv').textContent = e.target.value + '%'; };
  $('#cb').onchange = e => pv.classList.toggle('cb', e.target.checked); $('#dys').onchange = e => pv.classList.toggle('dys', e.target.checked);
  $('#lite').onchange = e => { pv.style.transition = e.target.checked ? 'none' : ''; };
  $('#speak').onclick = () => { const t = pv.querySelector('p').textContent; if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; speechSynthesis.speak(u); $('#spn').textContent = 'Читаем вслух…'; } else $('#spn').textContent = 'Этот браузер не умеет озвучивать текст.'; };
  // достижения
  const A = ['30 дней без «Н»', 'Серия пятёрок', 'Лучший прогресс', 'Первая пятёрка', 'Все домашние в срок', 'Активность на уроке', 'Доклад', 'Реферат', 'Отличный табель', 'Без двоек', 'Помощь другим', 'Новые знания', 'Цель достигнута'];
  $('#medg').innerHTML = A.map((a, i) => `<button class="med" style="--i:${i}" type="button" aria-pressed="false" data-a="${a}" aria-label="${a}">${i + 1}</button>`).join('');
  $('#medg').onclick = e => { const b = e.target.closest('.med'); if (!b) return; $$('.med').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#mdesc').textContent = `Медаль «${b.dataset.a}» — один из 13 автоматических примеров правил достижений. Система выдаёт её сама.`; };
  let d = 0; const sb = $('#sbar').parentNode, upd = () => { sb.style.setProperty('--s', d / 30); $('#sday').textContent = d; if (d === 30) { $('.streak').classList.add('flash'); $('#mdesc').textContent = '🏅 30 учебных дней без «Н» — награда получена!'; } };
  $('#sadd').onclick = () => { d = Math.min(30, d + 1); upd(); }; $('#srst').onclick = () => { d = 0; $('.streak').classList.remove('flash'); upd(); }; upd();
  // расписание
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'], bells = [['1', '8:00'], ['2', '8:50'], ['3', '9:50'], ['4', '10:40']], sub = ['Алгебра', 'Кыргыз тили', 'История', 'Физика', 'Литература', 'Биология', 'Информатика', 'Англ. язык'];
  const mkS = (n) => { const g = {}; let k = 0; days.forEach((_, c) => bells.forEach((_, r) => { if ((c + r + n) % 2 === 0 || r === 0) g[c + '-' + r] = sub[(k++ + n * 3) % sub.length]; })); return g; };
  const S = { '1a': mkS(0), '2a': mkS(2), '1b': mkS(1), '2b': mkS(3) }; let sh = '1', ver = 'a', sel = null; const sg = $('#sg');
  const draw = () => { const g = S[sh + ver]; sg.innerHTML = '<div class="gh"></div>' + days.map(x => `<div class="gh">${x}</div>`).join('') + bells.map((b, r) => `<div class="rg"><b>${b[0]}</b>${(sh === '2' ? '1' + b[1] : b[1])}</div>` + days.map((_, c) => { const k = c + '-' + r, v = g[k]; return `<div class="cell" data-k="${k}">${v ? `<button class="les ${sel === k ? 'sel' : ''}" draggable="true" data-k="${k}" type="button">${v}<i data-c="${k}" title="Комментарий" role="button" tabindex="0">💬</i></button>` : ''}</div>`; }).join('')).join(''); };
  const move = (a, b) => { const g = S[sh + ver]; if (a === b) return; const t = g[b]; g[b] = g[a]; t ? g[a] = t : delete g[a]; sel = null; $('#sn').textContent = ver === 'b' ? 'Версия B перестроена: отправьте на согласование.' : 'Урок перенесён.'; draw(); };
  sg.onclick = e => { const c = e.target.closest('i[data-c]'); if (c) { $('#cm').hidden = false; $('#cmt').textContent = `«${S[sh + ver][c.dataset.c]}»: здесь после третьего урока нужен перерыв — предлагаю поменять местами.`; e.stopPropagation(); return; } const l = e.target.closest('.les'), cell = e.target.closest('.cell'); if (l && sel !== l.dataset.k) { sel = l.dataset.k; draw(); } else if (cell && sel) move(sel, cell.dataset.k); else if (l) { sel = null; draw(); } };
  let drag = null; sg.ondragstart = e => { const l = e.target.closest('.les'); if (l) { drag = l.dataset.k; e.dataTransfer.setData('text/plain', drag); } }; sg.ondragover = e => { const c = e.target.closest('.cell'); if (c) { e.preventDefault(); $$('.cell.over', sg).forEach(x => x.classList.remove('over')); c.classList.add('over'); } };
  sg.ondrop = e => { e.preventDefault(); const c = e.target.closest('.cell'); if (c && drag) move(drag, c.dataset.k); drag = null; };
  $('#shift').onclick = e => { const b = e.target.closest('button'); if (!b) return; sh = b.dataset.s; $$('#shift button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  $('#ver').onclick = e => { const b = e.target.closest('button'); if (!b) return; ver = b.dataset.v; $$('#ver button').forEach(x => x.classList.toggle('on', x === b)); $('#sn').textContent = ver === 'b' ? 'Версия B — на согласовании: её можно менять, действующая версия A не затрагивается.' : 'Версия A действует.'; draw(); };
  draw();
}
