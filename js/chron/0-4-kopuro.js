// 0.4 КӨПҮРӨ: мост между двумя языками, код по цифрам, два слоя интерфейса, кошкар-муйуз → мост, демо-переключатель языка.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], root = document.documentElement;
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  root.style.setProperty('--hornbg', C.hornTile('#ffb596', .1, 90));
  $$('path.deck,.pyl,.hp,.hdeck,#fbp,#fbc').forEach(p => p.setAttribute('pathLength', 1));

  /* ---- Hero: слова слетаются к мосту, мост строится, слова идут по настилу ---- */
  const KY = ['Мектеп', 'Билим', 'Күндөлүк', 'Окуучу', 'Мугалим', 'Баа', 'Сабак', 'Достук', 'Китеп', 'Тил'];
  const RU = ['Школа', 'Знания', 'Дневник', 'Ученик', 'Учитель', 'Оценка', 'Урок', 'Дружба', 'Книга', 'Язык'];
  const fill = (host, list, seed) => { host.innerHTML = list.map((w, i) => `<b style="left:${6 + ((i * 37 + seed) % 70)}%;top:${16 + ((i * 23 + seed * 3) % 62)}%;--r:${((i * 7 + seed) % 9) - 4}deg" data-i="${i}">${w}</b>`).join(''); return [...host.children]; };
  const wk = fill($('#wky'), KY, 3), wr = fill($('#wru'), RU, 8);
  const word = 'КӨПҮРӨ', ltrs = $('.ltrs'); ltrs.innerHTML = [...word].map((ch, i) => `<i style="--sx:${i < 3 ? -1 : 1}">${ch}</i>`).join('');
  const L = [...ltrs.children];
  const cab = $('#cables'); let cs = ''; for (let i = 0; i < 9; i++) { const x1 = 420 - i * 40, x2 = 780 + i * 40; cs += `<path class="cab" pathLength="1" d="M420 70L${x1} 300" stroke="#ff9a6b"/><path class="cab" pathLength="1" d="M780 70L${x2} 300" stroke="#8fc0f0"/>`; } cab.innerHTML = cs;
  const cables = [...cab.children];
  const carry = $('#carry'); const NS = 'http://www.w3.org/2000/svg';
  const car = KY.slice(0, 5).flatMap((w, i) => [[w, 'k'], [RU[i], 'r']]).map(([t, s], i) => { const e = document.createElementNS(NS, 'text'); e.textContent = t; e.setAttribute('y', 282); e.setAttribute('fill', s === 'k' ? '#ffd0b8' : '#cfe6fb'); e.setAttribute('font-family', 'Inter,sans-serif'); e.setAttribute('font-weight', 700); e.setAttribute('font-size', 24); e.setAttribute('text-anchor', 'middle'); carry.appendChild(e); return { e, i, s }; });
  C.pin($('#hero'), p => {
    L.forEach((l, i) => set(l, '--k', C.ease.out(seg(p, i * .02, .2 + i * .02))));
    set($('.sub'), '--sub', seg(p, .18, .3));
    const words = [...wk, ...wr]; words.forEach((w, i) => set(w, '--wo', C.ease.out(seg(p, .02 + (i % 10) * .012, .14 + (i % 10) * .012)) * (.9 - seg(p, .6, .8) * .9)));
    $('#wky').style.setProperty('--m', seg(p, .2, .7)); $('#wru').style.setProperty('--m', seg(p, .2, .7));
    const x = C.ease.inOut(seg(p, .28, .5)); $$('.pyl').forEach(e => set(e, '--x', x));
    const d = C.ease.inOut(seg(p, .4, .65)); $$('.deck').forEach(e => set(e, '--x', d));
    cables.forEach((c, i) => set(c, '--x', seg(p, .55 + (i % 9) * .012, .72 + (i % 9) * .012)));
    const t = seg(p, .6, 1);
    car.forEach(w => { const u = (t * 1.3 - w.i * .06 + (w.s === 'k' ? 0 : .03)); const k = C.clamp(u); w.e.setAttribute('x', 80 + k * 1040); w.e.setAttribute('opacity', k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI)); });
    set($('.hint'), '--m', p);
  }, 1);

  /* ---- Код: цифра за цифрой ---- */
  const CODE = '482061', dg = $$('#digits i'); dg.forEach((i, k) => { i.innerHTML = `<span>${CODE[k]}</span>`; });
  C.pin($('#code'), p => {
    const n = dg.map((d, i) => { const v = C.ease.out(seg(p, .08 + i * .1, .2 + i * .1)); set(d.firstChild, '--d', v); d.classList.toggle('cur', v > 0 && v < 1); return v; });
    const left = Math.round(60 - 60 * seg(p, .05, .9)); set($('#rfg'), '--v', 1 - seg(p, .05, .9)); $('#rnum').textContent = left;
    set($('#cok'), '--o', seg(p, .8, .9));
    $('#ccap').textContent = p < .12 ? C.say('Код приходит на почту: шесть цифр.', 'Код почтаңызга келет: алты сан.') : p < .8 ? C.say('Цифры вводятся по одной. Повторно отправить код можно раз в 60 секунд.', 'Сандар бирден терилет. Кодду 60 секундада бир жолу кайра жөнөтүүгө болот.') : C.say('Почта подтверждена.', 'Почта ырасталды.');
  }, 1);

  /* ---- Два слоя: шов едет слева направо ---- */
  const lc = $('#lcard');
  C.pin($('#layers'), p => {
    const s = 100 - 100 * C.ease.inOut(seg(p, .12, .88)); lc.style.setProperty('--s', s.toFixed(1));
    $('#lcap').textContent = s > 66 ? C.say('Тот же экран на кыргызском.', 'Ушул эле экран кыргызча.') : s > 33 ? C.say('Слои переключаются в одной линии.', 'Катмарлар бир сызык боюнча алмашат.') : C.say('И на русском.', 'Жана орусча.');
  }, 0);

  /* ---- Кошкар-муйуз → мост ---- */
  const HD = 'M200 193C140 193 66 168 52 108C42 62 92 34 128 56C158 76 140 118 112 108';
  $('#hl').setAttribute('d', HD); $('#hr').setAttribute('d', HD); $('#hl').setAttribute('pathLength', 1); $('#hr').setAttribute('pathLength', 1);
  const posts = $('#hposts'); posts.innerHTML = [60, 100, 140, 200, 260, 300, 340].map(x => `<line x1="${x}" y1="193" x2="${x}" y2="${x < 200 ? 150 - (200 - x) * .15 : 150 - (x - 200) * .15}"/>`).join('');
  C.pin($('#horn'), p => {
    const d = C.ease.inOut(seg(p, .08, .5)); set($('#hl'), '--d', d); set($('#hr'), '--d', d);
    set($('#hdeck'), '--e', C.ease.out(seg(p, .45, .75))); set(posts, '--po', seg(p, .7, .9)); $('#horn .hcap').style.setProperty('--t', seg(p, .4, .85));
  }, 1);

  /* ---- Финал ---- */
  C.pin($('#finale'), p => {
    const st = $('#finale .fstage'); set(st, '--j', C.ease.inOut(seg(p, .05, .5))); set($('#finale .fbr'), '--b', C.ease.out(seg(p, .4, .75)));
    const q = $('#quote'); ['o1', 'o2', 'o3', 'o4'].forEach((k, i) => set(q, '--' + k, C.ease.out(seg(p, .55 + i * .08, .7 + i * .08))));
  }, 1);

  /* ---- Демо: переключатель языка, подтверждение почты, добавление ученика (без сети, вымышленные данные) ---- */
  const T = {
    t_confirm: ['Подтверждение почты', 'Почтаны ырастоо'], t_diary: ['Дневник', 'Күндөлүк'],
    c_title: ['Подтверждение почты', 'Почтаны ырастоо'], c_lead: ['Нажмите кнопку, и мы «отправим» шестизначный код.', 'Баскычты басыңыз: алты сандуу код «жөнөтүлөт».'],
    send: ['Отправить код', 'Кодду жөнөтүү'], skip: ['Перемотать таймер (демо)', 'Таймерди ылдамдатуу (демо)'], verify: ['Подтвердить', 'Ырастоо'],
    d_title: ['Дневник', 'Күндөлүк'], d_name: ['Имя ученика', 'Окуучунун аты'], d_add: ['Добавить ученика', 'Окуучуну кошуу'],
  };
  const dev = $('#dev'); let dl = 'ru', code = '', left = 0, timer = 0, sent = false;
  const S = (ru, ky) => (dl === 'ky' ? ky : ru);
  function paint() {
    $$('#dev [data-t]').forEach(el => { const v = T[el.dataset.t]; if (v) el.textContent = v[dl === 'ky' ? 1 : 0]; });
    dev.classList.toggle('ky', dl === 'ky'); $('#dRu').setAttribute('aria-pressed', dl === 'ru'); $('#dKy').setAttribute('aria-pressed', dl === 'ky');
    $('#dev .em'); tick(); renderStu();
  }
  $('#dRu').onclick = () => { dl = 'ru'; paint(); }; $('#dKy').onclick = () => { dl = 'ky'; paint(); };
  $('#dMark').onchange = e => dev.classList.toggle('mark', e.target.checked);
  $$('.dtabs [role=tab]').forEach(b => b.onclick = () => { $$('.dtabs [role=tab]').forEach(x => x.setAttribute('aria-selected', x === b)); $('#paneC').hidden = b.id !== 'tabC'; $('#paneD').hidden = b.id !== 'tabD'; });
  const msg = (t, c) => { const m = $('#msg'); m.textContent = t; m.className = 'msg ' + (c || ''); };
  function tick() { const t = $('#timer'); if (!sent) { t.textContent = ''; return; } t.textContent = left > 0 ? S(`Повторная отправка через ${left} с`, `Кайра жөнөтүү ${left} с кийин`) : S('Код можно отправить снова', 'Кодду кайра жөнөтсө болот'); $('#send').disabled = left > 0; $('#skip').hidden = left <= 0 ? true : false; }
  $('#send').onclick = () => { code = String(100000 + Math.floor(Math.random() * 900000)); sent = true; left = 60; const h = $('#hintcode'); h.hidden = false; h.textContent = S('Демо-код: ', 'Демо-код: ') + code; msg(''); clearInterval(timer); timer = setInterval(() => { left = Math.max(0, left - 1); tick(); if (!left) clearInterval(timer); }, 1000); tick(); $('#in6 input').focus(); };
  $('#skip').onclick = () => { left = 0; clearInterval(timer); tick(); };
  const ins = $$('#in6 input'); ins.forEach((i, k) => { i.oninput = () => { i.value = i.value.replace(/\D/g, ''); if (i.value && ins[k + 1]) ins[k + 1].focus(); }; i.onkeydown = e => { if (e.key === 'Backspace' && !i.value && ins[k - 1]) ins[k - 1].focus(); }; });
  $('#verify').onclick = () => { const v = ins.map(i => i.value).join(''); if (!sent) return msg(S('Сначала нажмите «Отправить код».', 'Адегенде «Кодду жөнөтүү» баскычын басыңыз.'), 'bad'); if (v.length < 6) return msg(S('Введите все шесть цифр.', 'Алты санды тең киргизиңиз.'), 'bad'); v === code ? msg(S('Готово: почта подтверждена (демо).', 'Даяр: почта ырасталды (демо).'), 'good') : msg(S('Код не подошёл. Попробуйте ещё раз.', 'Код туура келген жок. Дагы аракет кылыңыз.'), 'bad'); };
  $('#gl').innerHTML = `<li><span>Математика</span><i>5</i></li><li><span>${'Литература'}</span><i>4</i></li>`;
  const stu = ['Айбек', 'Мээрим']; let fresh = '';
  function renderStu() { $('#stu').innerHTML = stu.map(n => `<li class="${n === fresh ? 'fresh' : ''}">${n.replace(/[<>&]/g, '')}</li>`).join(''); $('#gl').innerHTML = `<li><span>${S('Математика', 'Математика')}</span><i>5</i></li><li><span>${S('Литература', 'Адабият')}</span><i>4</i></li>`; }
  $('#addf').onsubmit = e => { e.preventDefault(); const v = $('#nm').value.trim(); if (!v) return; fresh = v; stu.push(v); $('#nm').value = ''; renderStu(); };
  C.onLang(() => { paint(); });
  paint();
}
