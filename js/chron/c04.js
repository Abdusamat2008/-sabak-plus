// 0.4 КӨПҮРӨ: слова едут по мосту; рог (кошкар-муйуз) превращается в арку; демо языка и кода
export default function init({ $, $$, scene, loop, clamp, lerp, ease, lite, tr }) {
  const hero = $('#h4'), svg = $('.bridge'), bp = $('#bpath'), words = $('#words');
  const PAIRS = [['Журнал', 'Журнал'], ['Предметы', 'Сабактар'], ['Расписание', 'Тартип'], ['Достижения', 'Жетишкендик'], ['Главная', 'Башкы бет'], ['Выйти', 'Чыгуу'], ['ДЗ', 'Үй иши'], ['Неделя', 'Жума']].slice(0, lite ? 5 : 8);
  const els = []; PAIRS.forEach((p, i) => { [['ru', p[0]], ['ky', p[1]]].forEach(([c, t], j) => { const e = document.createElement('span'); e.className = 'wd ' + c; e.textContent = t; words.appendChild(e); els.push({ e, i, side: j }); }); });
  const HORN = [10, 330, 0, 200, 220, 110, 500, 250, 780, 110, 1000, 200, 990, 330], ARCH = [0, 330, 200, 130, 400, 130, 500, 130, 600, 130, 800, 130, 1000, 330];
  const toD = a => `M${a[0]} ${a[1]} C${a[2]} ${a[3]} ${a[4]} ${a[5]} ${a[6]} ${a[7]} C${a[8]} ${a[9]} ${a[10]} ${a[11]} ${a[12]} ${a[13]}`;
  let P = 0; const place = () => { const L = bp.getTotalLength(), r = svg.getBoundingClientRect(), vb = 1000 / r.width, sc = Math.min(r.width / 1000, r.height / 400), ox = r.left + (r.width - 1000 * sc) / 2, oy = r.top + r.height - 400 * sc, base = svg.closest('.stick').getBoundingClientRect(); const pt = k => { const q = bp.getPointAtLength(k * L); return [ox + q.x * sc - base.left, oy + q.y * sc - base.top]; };
    els.forEach(o => { const k = clamp(((P * 1.3) - o.i * .09) * 1.4); if (k <= 0) { o.e.style.opacity = 0; return; } const tg = o.side ? .56 + o.i * .042 : .44 - o.i * .042, kk = o.side ? 1 - k * (1 - tg) : k * tg; const q = pt(kk), w = o.e.offsetWidth; o.e.style.opacity = Math.min(1, k * 3); o.e.style.transform = `translate(${q[0] - w / 2}px,${q[1] - 30 - (o.i % 3) * 22}px)`; }); };
  scene(hero, p => { P = p; hero.style.setProperty('--b', ease(clamp(p / .6))); $('#bmorph').setAttribute('d', toD(HORN.map((v, i) => lerp(v, ARCH[i], ease(clamp(p / .5)))))); place(); });
  addEventListener('resize', place);
  // язык
  const U = [['Главная', 'Башкы бет'], ['Предметы', 'Сабактар'], ['Расписание', 'Тартип'], ['ДЗ', 'Үй иши'], ['Достижения', 'Жетишкендик'], ['Неделя ребёнка', 'Баланын жумасы'], ['Всё в порядке: срочных дел нет.', 'Баары тартипте: шашылыш иш жок.'], ['Выйти', 'Чыгуу']]; let ky = false; const uil = $('#uil');
  const dr = anim => { if (anim) { $$('span', uil).forEach(s => s.classList.add('sw')); setTimeout(() => put(), 260); } else put(); }; const put = () => { uil.innerHTML = U.map(u => `<span>${u[+ky]}<small>${u[+!ky]}</small></span>`).join(''); };
  $('#lgb').onclick = e => { ky = !ky; e.target.setAttribute('aria-pressed', ky); e.target.textContent = ky ? 'Кыргызча → Русский' : 'Русский → Кыргызча'; dr(true); }; put();
  // код
  const dg = $('#dg'), ci = $('#ci'), msg = $('#cmsg'), res = $('#resc'); let tm, cd = 0;
  const run = () => { cd = 60; res.disabled = true; clearInterval(tm); tm = setInterval(() => { cd--; res.textContent = cd > 0 ? `Повторить через ${cd} с` : 'Отправить код повторно'; if (cd <= 0) { clearInterval(tm); res.disabled = false; } }, 1000); res.textContent = 'Повторить через 60 с'; };
  const send = () => { dg.innerHTML = ''; msg.textContent = 'Код отправлен (демо — на самом деле ничего не отправлено). Введите любые шесть цифр.'; ci.disabled = false; ci.value = ''; ci.focus({ preventScroll: true }); run(); };
  $('#sendc').onclick = send; res.onclick = send;
  ci.oninput = () => { const v = ci.value.replace(/\D/g, '').slice(0, 6); ci.value = v; dg.innerHTML = v.split('').map(d => `<span class="dgt">${d}</span>`).join(''); msg.textContent = v.length === 6 ? 'Почта подтверждена ✓ (демо)' : 'Введите шесть цифр'; };
}
