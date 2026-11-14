// 0.2 КӨЧМӨ: окно браузера «жидко» превращается в телефон и вращается в 3D; симуляции установки и офлайна
export default function init({ $, $$, scene, clamp, lerp, ease, tr }) {
  const hero = $('#h2'), m = $('.morph'), W = () => Math.min(innerWidth * .72, 900), Hh = () => Math.min(innerHeight * .46, 420);
  scene(hero, p => {
    const k = ease(clamp(p / .5)), pw = Math.min(250, innerWidth * .62), ph = Math.min(460, innerHeight * .52);
    m.style.setProperty('--mw', lerp(W(), pw, k) + 'px'); m.style.setProperty('--mh', lerp(Hh(), ph, k) + 'px');
    m.style.setProperty('--mt', lerp(52, 68, k) + '%'); m.style.setProperty('--mr', lerp(16, 38, k) + 'px'); m.style.setProperty('--pm', k); m.style.setProperty('--mb', k);
    const r = ease(clamp((p - .5) / .5)); m.style.setProperty('--ry', (Math.sin(r * Math.PI * 2) * 28 + (1 - r) * 0 - 0) + 'deg'); m.style.setProperty('--rx', (Math.cos(r * Math.PI) * -6 + 6) + 'deg');
  });
  // установка
  const sh = $('#stSheet'), br = $('#stBrowser'), hm = $('#stHome'), steps = [$('#s1'), $('#s2'), $('#s3')];
  const set = n => steps.forEach((s, i) => { s.classList.toggle('on', i === n); s.classList.toggle('ok', i < n); });
  const reset = () => { br.hidden = false; sh.hidden = true; hm.hidden = true; set(0); };
  $('#shareb').onclick = () => { sh.hidden = false; set(1); };
  $('#canb').onclick = () => { sh.hidden = true; set(0); };
  $('#addb').onclick = () => { sh.hidden = true; br.hidden = true; hm.hidden = false; const n = $('#newapp'); n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; set(3); steps.forEach(s => s.classList.add('ok')); };
  $('#instr').onclick = reset; reset();
  // офлайн
  const P = ['Оценки', 'Расписание', 'Новости', 'Достижения', 'Профиль'], cached = new Set(); let off = false;
  const draw = () => { $('#pgsl').innerHTML = P.map(n => `<li><button type="button" data-n="${n}" class="${cached.has(n) ? 'cached' : off ? 'miss' : ''}"><b>${n}</b><span class="st">${cached.has(n) ? (off ? 'Открыта без интернета' : 'Сохранена в памяти') : off ? 'Нет в памяти: нужен интернет' : 'Ещё не открывали'}</span></button></li>`).join(''); };
  $('#pgsl').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (off && !cached.has(b.dataset.n)) { $('#offn').textContent = 'Эту страницу не открывали при интернете — без сети она недоступна.'; return; } cached.add(b.dataset.n); $('#offn').textContent = off ? 'Открыто без интернета — страница взята из памяти.' : 'Страница сохранена в памяти приложения.'; draw(); };
  $('#netb').onclick = e => { off = !off; e.target.setAttribute('aria-pressed', off); e.target.textContent = 'Интернет: ' + (off ? 'выключен' : 'включён'); draw(); };
  draw();
}
