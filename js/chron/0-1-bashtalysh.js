// 0.1 БАШТАЛЫШ: тетрадь раскрывается, страницы переворачиваются, чернила пишут, калькулятор считает по тем же правилам, что и приложение.
export default function (C) {
  const $ = s => document.querySelector(s), root = document.documentElement;
  root.style.setProperty('--hornbg', C.hornTile('#8a6a30', .09, 96));
  // заголовок по буквам
  const word = 'БАШТАЛЫШ', ltrs = $('.ltrs'); ltrs.innerHTML = [...word].map((ch, i) => `<i data-i="${i}">${ch}</i>`).join('');
  const L = [...ltrs.children], hw = $('#hw'), len = hw.getTotalLength(); $('.hand').style.setProperty('--len', Math.ceil(len));
  const set = (el, k, v) => el.style.setProperty(k, v.toFixed(3)), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const hero = $('#hero'), nb = $('#nb'), cells = [...document.querySelectorAll('.cells i')];
  C.pin(hero, p => {
    L.forEach((l, i) => set(l, '--k', C.ease.out(seg(p, i * .018, .18 + i * .018))));
    set($('.sub'), '--sub', seg(p, .16, .3));
    set(nb, '--open', C.ease.inOut(seg(p, .12, .6)));
    set($('.hand'), '--ink', seg(p, .58, .78));
    cells.forEach((c, i) => set(c, '--c', C.ease.out(seg(p, .68 + i * .04, .78 + i * .04))));
    set($('#uig'), '--o', seg(p, .64, .72)); set($('#uiu'), '--o', seg(p, .82, .9)); set($('#uis'), '--o', seg(p, .88, .96));
  }, 1);
  // страницы перелистываются в перспективе
  const leaves = [...document.querySelectorAll('.leaf')];
  C.pin($('#flip'), p => {
    // листаются первые две страницы; третья остаётся открытой для чтения
    leaves.forEach((lf, i) => { const f = i < 2 ? C.ease.inOut(seg(p, .1 + i * .36, .42 + i * .36)) : 0; set(lf, '--f', f); lf.style.zIndex = f > .5 ? 10 + i : 10 - i; });
    set($('#deck'), '--sh', 18 * seg(p, .05, .8));
  }, 1);
  // в режиме без анимации — все три страницы видны подряд, поэтому pin уже вызвал финальное состояние (f=1): вернём плоский вид
  if (C.reduced) leaves.forEach(l => l.style.removeProperty('--f'));
  // «галочки чернилами» при появлении пунктов — через .cr.in (ядро), здесь ничего не нужно
  // финал: чистая страница заполняется надписью
  C.pin($('#finale'), p => { set($('.sig'), '--w', C.ease.inOut(seg(p, .1, .6))); set($('.sig'), '--fill', seg(p, .55, .75)); set($('#quote'), '--qo', seg(p, .72, .9)); }, 1);
  const sig = $('.sig'); C.pin($('#finale'), p => { sig.style.setProperty('--w', C.ease.inOut(seg(p, .1, .6))); sig.style.setProperty('--fill', seg(p, .55, .75)); }, 1);
  // калькулятор: те же правила, что в дневнике — контрольная ×2, итог округляется от x,5 вверх
  const st = { g: [{ v: 5, t: false }, { v: 4, t: false }, { v: 5, t: true }] }, hist = [];
  const w = g => (g.t ? 2 : 1), half = x => Math.floor(x + .5 + 1e-9), fm = x => x.toFixed(2).replace('.', ',');
  const need = (target) => { let sw = 0, s = 0; st.g.forEach(g => { sw += w(g); s += w(g) * g.v; }); for (let n = 0; n <= 20; n++) if (half((s + 5 * n) / (sw + n)) >= target) return n; return null; };
  function draw() {
    const gl = $('#glist'); gl.innerHTML = st.g.map((g, i) => `<li class="${g.t ? 't' : ''}">${g.v}${g.t ? '<small>×2</small>' : ''}<button type="button" data-rm="${i}" aria-label="Убрать оценку ${g.v}">✕</button></li>`).join('');
    if (!st.g.length) { $('#fml').textContent = 'Добавьте оценку'; $('#avg').textContent = '—'; $('#fin').textContent = '—'; $('#need').textContent = ''; return; }
    let sw = 0, s = 0; st.g.forEach(g => { sw += w(g); s += w(g) * g.v; });
    const top = st.g.map(g => (g.t ? `<u>${g.v}×2</u>` : g.v)).join(' + ');
    $('#fml').innerHTML = `(${top}) ÷ ${sw} = ${fm(s / sw)}`;
    const a = s / sw, f = half(a); $('#avg').textContent = fm(a); $('#fin').textContent = f;
    const target = f + 1, n = f >= 5 ? 0 : need(target);
    $('#need').textContent = f >= 5 ? 'Максимальный итог — пять!' : n == null ? `До итога «${target}» далеко: нужно больше 20 пятёрок.` : `До итога «${target}» нужно ещё ${n} ${n === 1 ? 'пятёрка' : n >= 2 && n <= 4 ? 'пятёрки' : 'пятёрок'}.`;
  }
  document.querySelector('.cbtns').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; hist.push(JSON.stringify(st.g)); st.g.push({ v: +b.dataset.g, t: $('#istest').checked }); if (st.g.length > 14) st.g.shift(); draw(); });
  $('#glist').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; hist.push(JSON.stringify(st.g)); st.g.splice(+b.dataset.rm, 1); draw(); });
  $('#undo').onclick = () => { if (hist.length) { st.g = JSON.parse(hist.pop()); draw(); } };
  $('#reset').onclick = () => { hist.push(JSON.stringify(st.g)); st.g = [{ v: 5, t: false }, { v: 4, t: false }, { v: 5, t: true }]; draw(); };
  draw();
}
