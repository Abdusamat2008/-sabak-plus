// 0.12 ЫЛДАМ: световые потоки; камера следует за одной частицей, которая превращается в данные ученика
export default function init({ $, $$, scene, loop, fit, clamp, lerp, ease, lite, rm }) {
  const cv = $('#sp'), cx = fit(cv); let P = 0; scene($('#h13'), p => { P = p; });
  const N = lite ? 50 : 110, F = Array.from({ length: N }, (_, i) => ({ y: Math.random(), s: .4 + Math.random() * 1.4, x: Math.random(), l: 30 + Math.random() * 80, hero: i === 0 }));
  loop(cv, (dt, t, st) => { const w = cv.w, h = cv.h, p = st ? 1 : P, spd = 1 + ease(clamp(p / .5)) * 5; cx.clearRect(0, 0, w, h); cx.lineCap = 'round';
    F.forEach(f => { if (!st) f.x += dt / 1000 * f.s * .12 * spd; if (f.x > 1.2) f.x = -.2; const y = (f.hero ? .52 : f.y) * h, x = f.x * w, len = f.l * spd * .5; const g = cx.createLinearGradient(x - len, y, x, y); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, f.y > .6 ? '#ff3d81' : '#00e5ff'); cx.strokeStyle = g; cx.lineWidth = f.hero ? 3 : 1.2; cx.globalAlpha = f.hero ? 1 : .5; cx.beginPath(); cx.moveTo(x - len, y); cx.lineTo(x, y); cx.stroke(); });
    const H = F[0]; if (st) H.x = .55; const hx = H.x * w, hy = .52 * h, k = ease(clamp((p - .6) / .35)); cx.globalAlpha = 1; cx.fillStyle = '#fff'; cx.shadowColor = '#00e5ff'; cx.shadowBlur = 24; cx.beginPath(); cx.arc(hx, hy, 6 + k * 3, 0, 6.283); cx.fill(); cx.shadowBlur = 0; });
  // гонка
  const go = $('#go'), ba = $('#ba'), bb = $('#bb2'); let raf; const fmt = s => s.toFixed(2).replace('.', ',') + ' с';
  go.onclick = () => { cancelAnimationFrame(raf); ba.style.width = bb.style.width = '0'; $('#rn').textContent = ''; const t0 = performance.now(), A = 4000; if (rm()) { ba.style.width = bb.style.width = '100%'; $('#ta').textContent = '19,00 с'; $('#tb').textContent = '0,03 с'; $('#rn').textContent = 'Новая загрузка — в 600 раз быстрее.'; return; }
    const st = now => { const e = now - t0, k = clamp(e / A); ba.style.width = k * 100 + '%'; $('#ta').textContent = fmt(k * 19); const kb = clamp(e / (A * 0.03 / 19)); bb.style.width = (kb * 100) + '%'; $('#tb').textContent = fmt(Math.min(.03, kb * .03)); if (k < 1) raf = requestAnimationFrame(st); else $('#rn').textContent = 'Новая загрузка завершилась почти мгновенно — примерно в 600 раз быстрее.'; }; raf = requestAnimationFrame(st); };
  // очередь
  const qb = $('#qb'), ns = $('#ns'), nt = $('#nt9'), qc = $('#qc'), qx = fit(qc), Q = [], fly = []; let on = true;
  const draw = () => { qb.innerHTML = Q.map(q => `<span class="env">${q}</span>`).join(''); ns.className = 'nstat ' + (on ? '' : 'off'); ns.textContent = on ? 'Синхронизировано' : `Нет сети · в очереди: ${Q.length}`; };
  const add = t => { if (on) { ns.textContent = 'Отправлено ✓: ' + t; ns.className = 'nstat sy'; setTimeout(draw, 1400); } else { Q.push(t); draw(); } };
  $('#ag').onclick = () => add('Оценка «5» · Айбек'); $('#aa').onclick = () => add('Отметка «Н» · Айым');
  nt.onclick = () => { on = !on; nt.setAttribute('aria-pressed', on); nt.textContent = 'Интернет: ' + (on ? 'включён' : 'выключен'); if (on && Q.length) { const r = qb.getBoundingClientRect(), c = qc.getBoundingClientRect(); Q.splice(0).forEach((q, i) => fly.push({ x: r.left - c.left + 30 + i * 40, y: r.top - c.top + 20, t: -i * .12 })); ns.className = 'nstat sy'; ns.textContent = 'Синхронизация…'; setTimeout(draw, 1200); } draw(); };
  loop(qc, dt => { qx.clearRect(0, 0, qc.w, qc.h); for (let i = fly.length - 1; i >= 0; i--) { const f = fly[i]; f.t += dt / 1000; if (f.t < 0) continue; const k = f.t / 1; if (k >= 1) { fly.splice(i, 1); continue; } qx.fillStyle = '#00e5ff'; qx.shadowColor = '#00e5ff'; qx.shadowBlur = 12; qx.beginPath(); qx.arc(f.x + k * (qc.w - f.x - 30), f.y - Math.sin(k * 3.14) * 40, 5, 0, 6.283); qx.fill(); } qx.shadowBlur = 0; }); draw();
}
