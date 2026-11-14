// 0.2 КӨЧМӨ: телефон вращается среди гор, сайт перетекает в приложение, симуляция установки на главный экран.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  C.pin($('#hero'), p => {
    const hero = $('.stage'); set(hero, '--p2', p);
    set($('.mega'), '--t', C.ease.out(seg(p, 0, .2)));
    set($('#ph'), '--ry', 200 - C.ease.inOut(seg(p, .08, .7)) * 200 + (p > .85 ? (p - .85) * 40 : 0)); set($('#ph'), '--rx', 10 - seg(p, .5, .9) * 10); set($('#ph'), '--sc', .8 + C.ease.out(seg(p, .1, .7)) * .35);
    set($('.sub'), '--sb', seg(p, .7, .88)); set($('.hint'), '--hn', p);
  }, 1);
  const caps = [['Так сайт выглядит на компьютере.', 'Компьютердеги көрүнүшү.'], ['Страница перетекает в узкий экран.', 'Барак тар экранга өтөт.'], ['И становится приложением.', 'Жана колдонмого айланат.']];
  C.pin($('#morph'), p => { const m = C.ease.inOut(seg(p, .15, .8)); set($('#morph'), '--mo', m); $('#mscr').style.setProperty('--mo', m.toFixed(3)); const w0 = Math.min(innerWidth * .88, 640); $('#mscr').style.width = C.lerp(w0, Math.min(250, w0), m) + 'px'; $('.blobs').style.setProperty('--mo', m.toFixed(3)); const i = m < .25 ? 0 : m < .8 ? 1 : 2; $('#mcap').textContent = C.say(caps[i][0], caps[i][1]); }, 1);
  C.onLang(() => { const m = parseFloat($('#mscr').style.getPropertyValue('--mo') || 0), i = m < .25 ? 0 : m < .8 ? 1 : 2; $('#mcap').textContent = C.say(caps[i][0], caps[i][1]); });

  /* симуляция установки */
  const st = { n: 0, off: false, opened: new Set(['home']) };
  const steps = $$('#isteps li'), note = $('#inote');
  const notes = ['Нажмите на подсвеченные три точки.', 'Выберите «На главный экран».', 'Подтвердите название: нажмите «Добавить».', 'Иконка появилась на главном экране. Откройте её.', 'Приложение открыто. Попробуйте отключить интернет.'];
  function view(id) { ['br', 'home', 'app'].forEach(k => { $('#s-' + k).hidden = k !== id; }); }
  function ui() { steps.forEach((s, i) => { s.classList.toggle('on', i === st.n); s.classList.toggle('done', i < st.n); }); note.textContent = notes[Math.min(st.n, 4)]; $('#b-ic').hidden = st.n < 3; }
  function reset() { st.n = 0; $('#off').checked = false; st.off = false; $('#sheet').hidden = true; $('#dlg').hidden = true; $('#offb').hidden = true; $('#nopg').hidden = true; view('br'); ui(); }
  $('#b-menu').onclick = () => { if (st.n === 0) { $('#sheet').hidden = false; st.n = 1; ui(); } };
  $('#b-add').onclick = () => { $('#sheet').hidden = true; $('#dlg').hidden = false; st.n = 2; ui(); };
  $('#b-ok').onclick = () => { $('#dlg').hidden = true; view('home'); st.n = 3; ui(); };
  $('#b-ic').onclick = () => { view('app'); st.n = 4; ui(); $('#isteps li:last-child').classList.add('done'); };
  $('#off').onchange = e => { st.off = e.target.checked; $('#offb').hidden = !st.off; $('#nopg').hidden = true; };
  $('#newp').onclick = () => { $('#nopg').hidden = !st.off; };
  $('#ireset').onclick = reset; reset();

  /* финал */
  C.pin($('#finale'), p => { set($('#moon'), '--mv', C.ease.inOut(seg(p, .05, .6))); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
}
