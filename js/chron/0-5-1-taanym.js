// 0.5.1 ТААНЫМ: телефон оживает, текст по словам, счётчики опроса, модель публичного сайта, калькулятор, открывающийся сайт.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const esc = C.esc;
  /* экраны телефона: оценки / достижение / итог */
  const screens = () => `
    <div class="scr s0"><small>Алгебра · 8Б · ДЕМО</small><h4>Оценки</h4>
      <div class="row"><span>Айбек К.</span><i>5</i></div><div class="row"><span>Мээрим Т.</span><i>4</i></div><div class="row"><span>Эмир Б.</span><i class="f">5</i></div><div class="row"><span>Айдана С.</span><i>5</i></div></div>
    <div class="scr s1"><small>Достижения</small><h4>30 дней без Н</h4>
      <div class="trophy"><svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm-3 1h3v3a3 3 0 0 1-3-3Zm16 0h-3v3a3 3 0 0 0 3-3ZM11 14h2v3h3v2H8v-2h3v-3Z"/></svg></div><span class="pill">Награда получена</span></div>
    <div class="scr s2"><small>Итог</small><h4>Итоговая оценка</h4><div class="big2">5</div><div class="fm">(5 + 4 + 5×2) ÷ 4 = 4,75</div><span class="pill">Контрольная ×2</span></div>`;
  $$('.glass').forEach(g => { g.innerHTML = screens(); });
  const showScr = (root, i, f = 1) => $$(`${root} .scr`).forEach((s, k) => { const o = k === i ? 1 : 0; s.style.opacity = o; s.style.transform = `translateY(${(1 - o) * 14}px)`; });

  /* hero */
  const R = [...document.querySelectorAll('.ripples i')];
  C.pin($('#hero'), p => {
    set($('.mega'), '--t', C.ease.out(seg(p, 0, .18))); set($('.mega'), '--t2', seg(p, .5, .9)); set($('.mega'), '--g', seg(p, .2, .7));
    set($('#hp'), '--up', C.ease.out(seg(p, .08, .5)));
    R.forEach((r, i) => { const k = seg(p, .3 + i * .1, .85 + i * .05); set(r, '--rk', .3 + k * 3.6); set(r, '--ro', k <= 0 ? 0 : (1 - k) * .9); });
    set($('.tagline'), '--tg', seg(p, .55, .75)); set($('.hint'), '--hn', p);
    showScr('#hp', p < .6 ? 0 : p < .8 ? 2 : 1);
  }, 1);

  /* телефон оживает */
  const steps = $$('.astep');
  C.pin($('#alive'), p => {
    const idx = p < .34 ? 0 : p < .67 ? 1 : 2;
    steps.forEach((s, i) => set(s, '--so', i === idx ? 1 : 0)); showScr('#ap', idx === 0 ? 0 : idx === 1 ? 1 : 2);
    set($('#ap'), '--a', p);
  }, 0);
  C.reduced && (steps.forEach(s => set(s, '--so', 1)), showScr('#ap', 0));

  /* текст по словам */
  const phrase = 'Дневник, который можно открыть, попробовать и понять за минуту — прямо на главной странице.';
  $('#wtext').innerHTML = phrase.split(' ').map((w, i) => `<span class="${/дневник|минуту/i.test(w) ? 'blue' : ''}">${esc(w)}</span>`).join(' ');
  const ws = [...$('#wtext').children];
  C.pin($('#words'), p => ws.forEach((w, i) => set(w, '--w', seg(p, .1 + (i / ws.length) * .6, .22 + (i / ws.length) * .6))), 1);

  /* счётчики опроса */
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const n = +e.target.dataset.n, num = e.target.querySelector('.num'), suf = e.target.dataset.suf || '', ring = +e.target.dataset.ring; C.count(num, n, 1400, v => Math.round(v) + suf); set(e.target.querySelector('.v'), '--rv', 0); const v = e.target.querySelector('.v'); v.style.transition = C.reduced ? 'none' : 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)'; requestAnimationFrame(() => v.style.setProperty('--rv', ring)); }), { threshold: .4 });
  $$('.stat').forEach(s => io.observe(s));

  /* демо: вкладки */
  $$('.seg [role=tab]').forEach(b => b.onclick = () => { $$('.seg [role=tab]').forEach(x => x.setAttribute('aria-selected', x === b)); $$('.pane').forEach(p => { p.hidden = p.dataset.p !== b.dataset.t; }); });
  /* демо: модель сайта */
  const PAGES = {
    how: ['Как работает дневник', 'Учитель ставит оценку несколькими касаниями, итог считается сам, а ученик и родитель видят понятный результат.'],
    try: ['Попробуйте сами', 'Кнопка демо ведёт сразу в демонстрационный режим дневника — без регистрации.'],
    schools: ['Для школ', 'Школа может оставить заявку на подключение: на странице есть инструкция и форма.'],
  };
  const mb = $('#mbody'), draw = k => { const [t, d] = PAGES[k]; mb.innerHTML = `<h3>${esc(t)}</h3><p>${esc(d)}</p>${k === 'try' ? '<button type="button" class="pri" id="openDemo">Открыть демо</button>' : ''}`; $$('.mnav [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === k)); $('#url').textContent = 'sabak-plus.vercel.app' + (k === 'how' ? '' : '/#' + k); const od = $('#openDemo'); if (od) od.onclick = () => { $('#vhome').hidden = true; $('#vapp').hidden = false; $('#url').textContent = 'sabak-plus.vercel.app/app?demo=1'; }; };
  $$('.mnav [data-m]').forEach(b => b.onclick = () => draw(b.dataset.m)); draw('how');
  $('#toHome').onclick = () => { $('#vapp').hidden = true; $('#vhome').hidden = false; draw('try'); };
  const names = [['Айбек К.', 5], ['Мээрим Т.', 4], ['Эмир Б.', 3]]; const sg = names.map(n => n[1]);
  const w = (g, i) => 1, avg = () => sg.reduce((a, b) => a + b, 0) / sg.length;
  function renderStu() { $('#stu').innerHTML = names.map((n, i) => `<li><span>${esc(n[0])}</span><div class="gs">${[2, 3, 4, 5].map(g => `<button type="button" data-i="${i}" data-g="${g}" aria-pressed="${sg[i] === g}" aria-label="${esc(n[0])}: ${g}">${g}</button>`).join('')}</div></li>`).join(''); const a = avg(); $('#amean').textContent = `Средняя оценка класса: ${a.toFixed(2).replace('.', ',')}`; }
  $('#stu').onclick = e => { const b = e.target.closest('button'); if (!b) return; sg[+b.dataset.i] = +b.dataset.g; renderStu(); }; renderStu();
  /* ссылка в соцсетях */
  $$('.toggle button').forEach(b => b.onclick = () => { $$('.toggle button').forEach(x => x.classList.toggle('on', x === b)); $('#ogcard').className = 'ogcard ' + b.dataset.card; });
  /* поиск */
  $('#rtog').onchange = e => $('#rich').classList.toggle('off', !e.target.checked);

  /* калькулятор: контрольная ×2, округление от x,5 вверх */
  const st = { g: [{ v: 5, t: false }, { v: 4, t: false }, { v: 5, t: true }] }, hist = [];
  const wt = g => (g.t ? 2 : 1), half = x => Math.floor(x + .5 + 1e-9), fm = x => x.toFixed(2).replace('.', ',');
  const need = target => { let sw = 0, s = 0; st.g.forEach(g => { sw += wt(g); s += wt(g) * g.v; }); for (let n = 0; n <= 20; n++) if (half((s + 5 * n) / (sw + n)) >= target) return n; return null; };
  function calc() {
    $('#glist').innerHTML = st.g.map((g, i) => `<li class="${g.t ? 't' : ''}">${g.v}${g.t ? '<small>×2</small>' : ''}<button type="button" data-rm="${i}" aria-label="Убрать оценку ${g.v}">✕</button></li>`).join('');
    if (!st.g.length) { $('#fml').textContent = 'Добавьте оценку'; $('#avg').textContent = '—'; $('#fin').textContent = '—'; $('#need').textContent = ''; set($('#gv'), 'stroke-dashoffset', 100); return; }
    let sw = 0, s = 0; st.g.forEach(g => { sw += wt(g); s += wt(g) * g.v; }); const a = s / sw, f = half(a);
    $('#fml').textContent = `(${st.g.map(g => g.t ? g.v + '×2' : g.v).join(' + ')}) ÷ ${sw} = ${fm(a)}`; $('#avg').textContent = fm(a); $('#fin').textContent = f; $('#gv').style.strokeDashoffset = 100 - (f / 5) * 100;
    const t = f + 1, n = f >= 5 ? 0 : need(t); $('#need').textContent = f >= 5 ? 'Максимальный итог — пять!' : n == null ? `До итога «${t}» нужно больше 20 пятёрок.` : `До итога «${t}» нужно ещё ${n} ${n === 1 ? 'пятёрка' : n >= 2 && n <= 4 ? 'пятёрки' : 'пятёрок'}.`;
  }
  $('.cbtns').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; hist.push(JSON.stringify(st.g)); st.g.push({ v: +b.dataset.g, t: $('#istest').checked }); if (st.g.length > 14) st.g.shift(); calc(); });
  $('#glist').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; hist.push(JSON.stringify(st.g)); st.g.splice(+b.dataset.rm, 1); calc(); });
  $('#undo').onclick = () => { if (hist.length) { st.g = JSON.parse(hist.pop()); calc(); } };
  $('#reset').onclick = () => { hist.push(JSON.stringify(st.g)); st.g = [{ v: 5, t: false }, { v: 4, t: false }, { v: 5, t: true }]; calc(); };
  calc();

  /* финал: сайт раскрывается на весь экран, проявляется логотип */
  C.pin($('#finale'), p => { set($('#win'), '--wo', C.ease.inOut(seg(p, .05, .55))); set($('.sig text'), '--so2', seg(p, .5, .7)); set($('#quote'), '--qo', seg(p, .7, .88)); }, 1);
}
