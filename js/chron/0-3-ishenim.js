// 0.3 ИШЕНИМ: сеть узлов, цепочка доверия, щит из частиц, дело ученика, аналитика, демо цепочки доверия.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const NS = 'http://www.w3.org/2000/svg', mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  /* сеть: 4 роли в углах, кольцо малых узлов, линии растут к центру */
  const svg = $('#csvg'), roles = [[-290, -150], [290, -150], [-290, 150], [290, 150]], ring = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; ring.push([Math.cos(a) * 190, Math.sin(a) * 120]); }
  const lines = [];
  ring.forEach((r, i) => { const l = mk('line', { x1: 0, y1: 0, x2: r[0], y2: r[1] }); svg.appendChild(l); lines.push({ l, to: r, k: .15 + i / 14 * .4 }); });
  roles.forEach(r => { const l = mk('line', { x1: 0, y1: 0, x2: r[0], y2: r[1], class: 'm' }); svg.appendChild(l); lines.push({ l, to: r, k: .5 }); });
  ring.forEach((r, i) => { const c = mk('circle', { cx: r[0], cy: r[1], r: 4 }); c.style.opacity = 0; svg.appendChild(c); lines.at(i).c = c; });
  const set2 = (o, p) => { const q = C.ease.out(seg(p, o.k, o.k + .22)); o.l.setAttribute('x2', o.to[0] * q); o.l.setAttribute('y2', o.to[1] * q); if (o.c) o.c.style.opacity = q; };
  lines.forEach(o => set2(o, 0));
  C.pin($('#hero'), p => {
    set($('.stage'), '--p', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .25)));
    set($('#cons'), '--ry', -18 + p * 36); set($('#cons'), '--rx', 24 - p * 12); set($('#cons'), '--cs', .5 + C.ease.out(seg(p, 0, .3)) * .5);
    set($('#cons'), '--ro', seg(p, .55, .8)); lines.forEach(o => set2(o, p)); set($('.hint'), '--hn', p);
  }, 1);
  /* роли */
  const info = [['Ученик', 'Видит свои оценки, расписание и достижения.', 'Окуучу өзүнүн бааларын, сабак тартибин жана жетишкендиктерин көрөт.'], ['Родитель', 'Видит данные только своих детей.', 'Ата-эне өз балдарынын гана маалыматын көрөт.'], ['Учитель', 'Работает с теми классами и предметами, которые ему назначены.', 'Мугалим өзүнө дайындалган класстар жана предметтер менен иштейт.'], ['Администрация', 'Управляет школой и видит аналитику.', 'Администрация мектепти башкарат жана аналитиканы көрөт.']];
  const show = i => { $$('.rb').forEach((b, j) => b.classList.toggle('on', j === i)); $('#rinfo').textContent = C.say(info[i][1], info[i][2]); $('#rinfo').dataset.i = i; };
  $$('.rb').forEach((b, i) => { b.onmouseenter = b.onfocus = b.onclick = () => show(i); }); show(0);
  C.onLang(() => show(+$('#rinfo').dataset.i || 0));
  /* цепочка доверия при прокрутке */
  const caps = ['Ключ школы подтверждает, что школа настоящая.', 'Директор получает управление школой.', 'Директор раздаёт одноразовые приглашения.', 'Каждый приглашённый подтверждает себя.', 'Все важные действия записываются в журнал аудита.'];
  C.pin($('#chain'), p => { const n = Math.min(4, Math.floor(seg(p, .05, .9) * 5)); $$('#clinks li').forEach((l, i) => l.classList.toggle('on', i <= n)); set($('#clinks'), '--cp', seg(p, .08, .9)); $('#ccap').textContent = caps[n]; }, 1);
  /* щит из треугольников: каждый — из своей стороны */
  const sh = $('#shsvg'), tri = [];
  const rows = 6, cols = 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const w = 120 * (1 - Math.pow(r / rows, 2) * .75), x = (c / (cols - 1) - .5) * w, y = -100 + r * 36, s = 16 * (w / 120) + 6;
    const t = mk('polygon', { points: `${x},${y - s} ${x + s},${y + s} ${x - s},${y + s}` }); sh.appendChild(t); tri.push({ t, a: Math.random() * 6.28, d: 160 + Math.random() * 120 });
  }
  const lock = mk('path', { class: 'lock', d: 'M-14 -4 v-10 a14 14 0 0 1 28 0 v10 M-20 -4 h40 v34 h-40z' }); lock.setAttribute('transform', 'translate(0 10)'); sh.appendChild(lock);
  C.pin($('#shield'), p => { const k = C.ease.out(seg(p, .1, .7)); tri.forEach(o => { o.t.style.transform = `translate(${Math.cos(o.a) * o.d * (1 - k)}px,${Math.sin(o.a) * o.d * (1 - k)}px) rotate(${(1 - k) * 200}deg)`; o.t.style.opacity = .2 + k * .8; }); lock.style.setProperty('--lk', seg(p, .65, .85)); lock.style.opacity = seg(p, .65, .85); }, 1);
  /* дело ученика */
  C.pin($('#dossier'), p => set($('#dwrap'), '--dc', C.ease.inOut(seg(p, .15, .75))), 1);
  /* аналитика */
  const ch = $('#chart'); const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { ch.style.setProperty('--g', 1); io.disconnect(); } }), { threshold: .4 }); io.observe(ch);
  if (C.reduced) ch.style.setProperty('--g', 1);
  /* демо цепочки доверия */
  const T = [['Ключ школы', 'Школа получает одноразовый ключ. Без него регистрация школы невозможна.', 'Мектеп бир жолку ачкыч алат.'], ['Директор', 'По ключу регистрируется директор. Он становится главным в своей школе.', 'Ачкыч менен директор катталат.'], ['Одноразовые приглашения', 'Директор создаёт приглашения. Каждое работает один раз.', 'Директор чакыруу түзөт. Ар бири бир жолу иштейт.'], ['Подтверждение', 'Приглашённый заходит по приглашению и подтверждает себя.', 'Чакырылган адам өзүн ырастайт.'], ['Журнал аудита', 'Важные действия остаются в журнале: кто, что и когда сделал.', 'Маанилүү иштер журналда сакталат.']];
  let cur = 0; const ds = $('#dsteps'), dp = $('#dpanel');
  T.forEach((t, i) => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.onclick = () => { if (i <= cur) { cur = Math.min(i + 1, 5); render(i); } }; li.appendChild(b); ds.appendChild(li); });
  let viewed = 0;
  function render(v) { viewed = v; $$('#dsteps button').forEach((b, i) => { b.textContent = (i + 1) + '. ' + C.say(T[i][0], T[i][0]); b.classList.toggle('on', i === v); b.classList.toggle('done', i < cur && i !== v); b.disabled = i > cur; }); const t = T[v]; dp.innerHTML = ''; const h = document.createElement('b'), p = document.createElement('p'); h.textContent = t[0]; p.textContent = C.say(t[1], t[2]); dp.append(h, p); }
  $('#dnext').onclick = () => { if (cur < 4) { cur++; render(cur); } else { cur = 5; render(4); } };
  $('#dreset').onclick = () => { cur = 0; render(0); };
  render(0); C.onLang(() => render(viewed));
  /* финал */
  C.pin($('#finale'), p => { set($('.fstage'), '--fp', C.ease.inOut(seg(p, .05, .6))); $('.fg').style.setProperty('--fp', C.ease.inOut(seg(p, .05, .6)).toFixed(3)); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
}
