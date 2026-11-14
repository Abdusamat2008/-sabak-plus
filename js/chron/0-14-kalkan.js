// 0.14 КАЛКАН: щит из слоёв, демо офлайн-очереди, проверки текста, резервной копии, календаря и согласия (вымышленные данные).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const NS = 'http://www.w3.org/2000/svg', g = $('#layers'), L = [];
  for (let i = 0; i < 5; i++) { const s = 1 - i * .16, d = `M0 ${-100 * s} C ${60 * s} ${-90 * s} ${80 * s} ${-70 * s} ${80 * s} ${-30 * s} C ${80 * s} ${50 * s} ${40 * s} ${90 * s} 0 ${110 * s} C ${-40 * s} ${90 * s} ${-80 * s} ${50 * s} ${-80 * s} ${-30 * s} C ${-80 * s} ${-70 * s} ${-60 * s} ${-90 * s} 0 ${-100 * s}Z`; const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); if (i % 2 === 0) p.setAttribute('class', 'fill'); p.setAttribute('pathLength', 1); p.style.strokeDasharray = 1; p.style.strokeDashoffset = 1; g.appendChild(p); L.push(p); }
  C.pin($('#hero'), p => { set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .15))); L.forEach((l, i) => { const k = .12 + i * .13; l.style.strokeDashoffset = (1 - C.ease.out(seg(p, k, k + .22))).toFixed(3); l.style.opacity = .35 + .65 * seg(p, k, k + .22); }); set($('.sub'), '--sb', seg(p, .78, .93)); }, 1);
  C.pin($('#finale'), p => { set($('#orn'), '--op', p); set($('#orn'), '--oa', C.ease.out(seg(p, .1, .5))); set($('#quote'), '--qo', seg(p, .5, .75)); }, 1);
  /* очередь */
  const q = [], nq = $('#nq'), net = $('#net'), nm = $('#nmsg');
  const row = (t, c) => { const li = document.createElement('li'); li.className = c; const s = document.createElement('span'); s.textContent = t; li.appendChild(s); return li; };
  function nrender() { nq.innerHTML = ''; q.forEach(i => nq.appendChild(row(i.t, i.s))); $('#nlab').textContent = net.checked ? 'Интернет есть' : 'Интернета нет (виртуально)'; }
  $('#npost').onclick = () => { const t = $('#nt').value.trim(); if (!t) { nm.textContent = 'Введите заголовок.'; return; } q.push({ t, s: net.checked ? 'sent' : 'sealed' }); $('#nt').value = ''; nm.textContent = net.checked ? 'Отправлено сразу.' : 'Нет связи: новость запечатана на устройстве и уйдёт сама.'; nrender(); };
  net.onchange = () => { if (net.checked) { const n = q.filter(i => i.s === 'sealed').length; q.forEach(i => { i.s = 'sent'; }); if (n) nm.textContent = 'Связь восстановлена: отправлено ' + n + '.'; } else nm.textContent = 'Интернет отключён.'; nrender(); }; nrender();
  /* проверка текста: безопасный разбор, разметка не вставляется в страницу */
  const mk = $('#mk'), mres = $('#mres');
  $('#bad').onclick = () => { mk.value = 'Привет <script>alert(1)</script> <img src=x onerror=alert(1)>'; mres.textContent = ''; };
  $('#chk').onclick = () => { const v = mk.value, risky = /<\s*(script|iframe|object|embed|style)|on\w+\s*=|javascript:/i.test(v); mres.className = 'res ' + (risky ? 'no' : 'ok'); mres.textContent = risky ? 'Отклонено: в тексте опасная разметка. Новость не будет сохранена.' : 'Текст принят.'; };
  /* копия */
  $('#bk').onclick = () => { const p = $('#pack'), m = $('#bmsg'); p.classList.remove('done'); p.classList.add('go'); m.textContent = 'Собираем копию…'; $('#bk').disabled = true; setTimeout(() => { p.classList.remove('go'); p.classList.add('done'); m.textContent = 'Копия собрана (демо). Настоящие копии делаются по расписанию.'; $('#bk').disabled = false; }, C.reduced ? 50 : 1400); };
  /* календарь */
  const cal = $('#cal'), cres = $('#cres'); const cd = () => { cres.className = 'res ' + (cal.checked ? 'ok' : 'no'); cres.textContent = cal.checked ? 'Календарь заполнен.' : 'Внимание: календарь учебного года не заполнен. Оценки по четвертям будут ограничены.'; }; cal.onchange = cd; cd();
  /* согласие */
  const c1 = $('#c1'), c2 = $('#c2'), cb = $('#cbtn'), cm = $('#cmsg'); const cc = () => { cb.disabled = !(c1.checked && c2.checked); cm.textContent = cb.disabled ? 'Отметьте оба пункта, чтобы войти.' : 'Можно входить.'; }; c1.onchange = c2.onchange = cc; cb.onclick = () => { cm.textContent = 'Это демо: вход не выполняется.'; }; cc();
}
