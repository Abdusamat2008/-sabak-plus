// 0.12 ЫЛДАМ: поток частиц ускоряется, симуляция 19 с против 0,03 с, офлайн-очередь (демо).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const cv = $('#cv'), cx = cv.getContext('2d'); let W = 0, H = 0, sp = 0, dc = 0; const P = [];
  function size() { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = cv.width = r.width * d; H = cv.height = r.height * d; cx.setTransform(d, 0, 0, d, 0, 0); W = r.width; H = r.height; }
  size(); addEventListener('resize', size);
  for (let i = 0; i < 90; i++) P.push({ x: Math.random(), y: Math.random(), v: .2 + Math.random() * .8, l: 20 + Math.random() * 60 });
  function draw(dt) { cx.fillStyle = 'rgba(2,6,13,.35)'; cx.fillRect(0, 0, W, H); const k = .15 + sp * 2.4;
    P.forEach(p => { p.x += p.v * k * dt * .25; if (p.x > 1.1) { p.x = -.1; p.y = Math.random(); } const x = p.x * W, y = p.y * H, l = p.l * (.4 + sp * 3); const g = cx.createLinearGradient(x - l, y, x, y); g.addColorStop(0, 'rgba(94,224,255,0)'); g.addColorStop(1, 'rgba(184,242,255,' + (.35 + p.v * .5) + ')'); cx.strokeStyle = g; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(x - l, y); cx.lineTo(x, y); cx.stroke(); });
    const hx = W * (.1 + sp * .4), hy = H * .56; cx.fillStyle = '#fff'; cx.shadowColor = '#5ee0ff'; cx.shadowBlur = 24 * (1 - dc); cx.globalAlpha = 1 - dc; cx.beginPath(); cx.arc(hx, hy, 6, 0, 7); cx.fill(); cx.globalAlpha = 1; cx.shadowBlur = 0; }
  if (C.reduced) { cx.fillStyle = '#02060d'; cx.fillRect(0, 0, W, H); sp = .5; P.forEach(p => { p.x = Math.random(); }); draw(0); }
  else C.loop($('#hero'), dt => { draw(Math.min(dt, 50) / 16); });
  C.pin($('#hero'), p => { sp = p; dc = C.ease.inOut(seg(p, .72, .9)); set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .2))); set($('#dcard'), '--dc', dc); set($('.sub'), '--sb', seg(p, .8, .95)); if (C.reduced) draw(0); }, 1);
  /* сравнение: 19 с в симуляции идут за ~4 с, 0,03 с за мгновение */
  const go = $('#go'), tm = $('#tm'); let busy = false;
  function race() { if (busy) return; busy = true; go.disabled = true; $('#slow').style.width = '0%'; $('#fast').style.width = '0%'; const t0 = performance.now(), D = C.reduced ? 1 : 4000; $('#fast').style.transition = 'width .03s linear'; $('#fast').style.width = '100%'; (function f(t) { const k = C.clamp((t - t0) / D); $('#slow').style.width = k * 100 + '%'; tm.textContent = 'Модель «до»: ' + (19 * k).toFixed(1).replace('.', ',') + ' с · «после»: 0,03 с'; if (k < 1) requestAnimationFrame(f); else { busy = false; go.disabled = false; } })(t0); }
  go.onclick = race;
  /* офлайн */
  const q = [], sent = [], ql = $('#queue'), sl = $('#sent'), net = $('#net'), om = $('#omsg');
  function li(t, cls) { const e = document.createElement('li'); e.textContent = t; if (cls) e.className = cls; return e; }
  function render() { ql.innerHTML = ''; sl.innerHTML = ''; if (!q.length) ql.appendChild(li('Пусто')); q.forEach(t => ql.appendChild(li(t))); if (!sent.length) sl.appendChild(li('Пока ничего')); sent.forEach(t => sl.appendChild(li(t + ' ✓'))); $('#nlab').textContent = net.checked ? 'Интернет есть' : 'Интернета нет (виртуально)'; }
  function flush() { if (!q.length) return; const items = q.splice(0); om.textContent = 'Связь восстановлена: отправляем ' + items.length + ' изменений'; sent.push(...items); render(); }
  $$('.btns button').forEach(b => b.onclick = () => { const t = b.dataset.g; if (net.checked) { sent.push(t); om.textContent = 'Отправлено сразу'; } else { q.push(t); om.textContent = 'Нет связи: изменение сохранено на устройстве'; } render(); });
  net.onchange = () => { if (net.checked) flush(); else om.textContent = 'Интернет отключён. Новости, календарь, табель и «Алтын» остаются доступны.'; render(); };
  render();
  C.pin($('#finale'), p => { set($('.fstage'), '--gs', C.ease.inOut(seg(p, .1, .7))); set($('.fstage'), '--gt', p); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
}
