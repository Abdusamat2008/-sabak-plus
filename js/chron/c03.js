// 0.3 ИШЕНИМ: узлы пользователей соединяются в сеть вокруг символа школы (псевдо-3D на canvas)
export default function init({ $, $$, scene, loop, fit, clamp, ease, lite }) {
  const COL = ['#8ab4ff', '#ffd479', '#7ee0c0', '#ff9bd0'];
  const mk = n => { const a = []; for (let i = 0; i < n; i++) { const r = 1.1 + Math.random() * 1.2, t = Math.random() * 6.283, z = (Math.random() - .5) * 1.6; a.push({ x: Math.cos(t) * r, y: (Math.random() - .5) * 1.6, z: Math.sin(t) * r + z * 0, g: i % 4, d: Math.random() }); } return a; };
  const N = mk(lite ? 36 : 70), hubs = [0, 1, 2, 3].map(i => ({ x: Math.cos(i * 1.5708 + .6) * .8, y: Math.sin(i * 1.5708 + .6) * .5, z: Math.sin(i * 1.5708 + .6) * .8, g: i }));
  const draw = (cv, ctx, p, t) => {
    const w = cv.w, h = cv.h, cx = w * (w > 800 ? .66 : .5), cy = h * (w > 800 ? .52 : .62), S = Math.min(w, h) * (w > 800 ? .3 : .24), a = t * .15 + p * 2.2;
    ctx.clearRect(0, 0, w, h); const P = o => { const c = Math.cos(a), s = Math.sin(a), x = o.x * c - o.z * s, z = o.x * s + o.z * c, f = 3 / (3 + z); return { x: cx + x * S * f, y: cy + o.y * S * f, f }; };
    const hp = hubs.map(P), np = N.map(P), form = ease(clamp(p / .7));
    ctx.lineWidth = 1; N.forEach((o, i) => { const k = clamp((form * 1.4 - o.d * .9) * 2); if (k <= 0) return; const q = np[i], H = hp[o.g]; ctx.strokeStyle = COL[o.g]; ctx.globalAlpha = .35 * k; ctx.beginPath(); ctx.moveTo(H.x, H.y); ctx.lineTo(H.x + (q.x - H.x) * k, H.y + (q.y - H.y) * k); ctx.stroke(); });
    ctx.strokeStyle = '#cfd8e8'; ctx.globalAlpha = .5 * clamp(form * 2 - .4); hp.forEach((q, i) => { const r = hp[(i + 1) % 4]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(r.x, r.y); ctx.stroke(); });
    ctx.globalAlpha = 1; N.forEach((o, i) => { const q = np[i], k = clamp((form * 1.4 - o.d * .9) * 2); ctx.fillStyle = COL[o.g]; ctx.shadowColor = COL[o.g]; ctx.shadowBlur = 8 * q.f; ctx.globalAlpha = .25 + .75 * k; ctx.beginPath(); ctx.arc(q.x, q.y, 2.2 * q.f * (.5 + k), 0, 6.283); ctx.fill(); });
    ctx.globalAlpha = 1; hp.forEach(q => { ctx.fillStyle = COL[hp.indexOf(q)]; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(q.x, q.y, 7 * q.f, 0, 6.283); ctx.fill(); });
    ctx.shadowBlur = 0; // символ школы: фронтон со ступенями
    const u = S * .22 * (.6 + .4 * form); ctx.strokeStyle = '#eaf0ff'; ctx.fillStyle = '#0f2250'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - u, cy + u * .5); ctx.lineTo(cx - u, cy - u * .2); ctx.lineTo(cx, cy - u * .9); ctx.lineTo(cx + u, cy - u * .2); ctx.lineTo(cx + u, cy + u * .5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#eaf0ff'; ctx.fillRect(cx - u * .18, cy, u * .36, u * .5);
    ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(cx, cy, u * 1.7 * (.8 + .2 * Math.sin(t * 2)), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  };
  const cv = $('#net'), c1 = fit(cv); let p = 0; scene($('#h3'), q => { p = q; }); loop(cv, (dt, t, st) => draw(cv, c1, st ? 1 : p, t));
  const cv2 = $('#net2'), c2 = fit(cv2); loop(cv2, (dt, t, st) => draw(cv2, c2, 1, t));
  // цепочка
  const S = [['Ключ школы', 'Выдаёт оператор платформы. Без ключа школу не подключить.'], ['Директор', 'Вводит ключ и становится первым человеком в школе.'], ['Одноразовые приглашения', 'Директор создаёт приглашения сверху вниз: каждое работает один раз.'], ['Подтверждение', 'Директор или завуч подтверждает каждого, кто вошёл по приглашению.'], ['Журнал действий', 'Все важные действия записываются: кто, что и когда сделал.']];
  let k = 0; const cn = $('#cn');
  cn.innerHTML = S.map((s, i) => `<g class="cnode" data-i="${i}" transform="translate(${70 + i * 190} 70)"><circle r="24"/><text class="n" y="7">${i + 1}</text><text y="62">${s[0].length > 14 ? s[0].split(' ').map((w, j) => `<tspan x="0" dy="${j ? 14 : 0}">${w}</tspan>`).join('') : s[0]}</text></g>`).join('');
  const upd = () => { $$('.cnode', cn).forEach((g, i) => { g.classList.toggle('on', i <= k); g.classList.toggle('cur', i === k); }); $('#clp').parentNode.style.setProperty('--cp', k / 4); $('#ct').textContent = `${k + 1}. ${S[k][0]}`; $('#cd').textContent = S[k][1]; $('#cprev').disabled = !k; $('#cnext').disabled = k === 4; };
  $('#cprev').onclick = () => { k = Math.max(0, k - 1); upd(); }; $('#cnext').onclick = () => { k = Math.min(4, k + 1); upd(); }; cn.onclick = e => { const g = e.target.closest('.cnode'); if (g) { k = +g.dataset.i; upd(); } }; upd();
  // роли
  const R = [['Ученик', '#8ab4ff', ['Видит свои оценки, задания и расписание', 'Получает уведомления о достижениях', 'К «делу» ученика доступа нет']], ['Родитель', '#ffd479', ['Видит данные своих детей', 'Может править «дело» ребёнка', 'Загружает фото профиля с согласия родителя']], ['Учитель', '#7ee0c0', ['Видит только свои классы и предметы', 'Выставляет оценки и ведёт журнал', 'Классный руководитель дополнительно ведёт «дело» своего класса']], ['Администрация', '#ff9bd0', ['Директор и завуч видят всю свою школу', 'Читают «дело» ученика', 'Подтверждают людей, смотрят аналитику и журнал действий']]];
  const rb = $('#rb'), ri = $('#ri'); rb.innerHTML = R.map((r, i) => `<button class="rbtn" role="tab" style="--c:${r[1]}" data-i="${i}" aria-selected="${i === 0}"><i></i>${r[0]}</button>`).join('');
  const sel = i => { $$('.rbtn', rb).forEach((b, j) => b.setAttribute('aria-selected', j === i)); ri.innerHTML = `<h3 style="color:${R[i][1]}">${R[i][0]}</h3><ul>${R[i][2].map(x => `<li>${x}</li>`).join('')}</ul>`; };
  rb.onclick = e => { const b = e.target.closest('.rbtn'); if (b) sel(+b.dataset.i); }; rb.onmouseover = e => { const b = e.target.closest('.rbtn'); if (b) sel(+b.dataset.i); }; sel(0);
  const G = ['Код школы или приглашения', 'ФИО и данные', 'Почта и пароль', 'Готово'], rg = $('#rg'); let gs = 0;
  const gd = () => { rg.innerHTML = G.map((g, i) => `<li><button type="button" data-i="${i}" ${i === gs ? 'aria-current="step"' : ''}>${i + 1}. ${g}</button></li>`).join(''); $('#rgn').textContent = ['Шаг 1: введите код, который выдала школа.', 'Шаг 2: укажите, кто вы.', 'Шаг 3: почта и пароль для входа.', 'Всё готово — можно входить.'][gs]; };
  rg.onclick = e => { const b = e.target.closest('button'); if (b) { gs = +b.dataset.i; gd(); } }; gd();
  const B = [['Успеваемость', .92], ['Качество знаний', .64], ['СОУ', .58], ['Тренд за четверть', .75]]; const bars = $('#bars');
  bars.innerHTML = B.map(b => `<div class="bar"><span>${b[0]}</span><i style="--v:0"></i><b>${Math.round(b[1] * 100)}%</b></div>`).join('');
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { $$('.bar i', bars).forEach((i, j) => i.style.setProperty('--v', B[j][1])); io.disconnect(); } }, { threshold: .4 }); io.observe(bars);
}
