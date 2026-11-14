// 0.10 АЛТЫН: монета превращается в карточку счёта; демо счёта (вымышленные данные, внутришкольная валюта).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  C.pin($('#hero'), p => { set($('.stage'), '--p', p); set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .2))); set($('#coinw'), '--ry', p * 720); set($('#coinw'), '--m', C.ease.inOut(seg(p, .55, .8))); $('#accb').textContent = fmt(1250 * C.ease.out(seg(p, .72, .95))); set($('.sub'), '--sb', seg(p, .8, .95)); }, 1);
  C.pin($('#finale'), p => { set($('#burst'), '--bp', C.ease.out(seg(p, .05, .6))); set($('#quote'), '--qo', seg(p, .5, .75)); }, 1);
  set($('#coinw'), '--ry', 0);
  /* демо */
  const st = { bal: 1250, goal: 120, hide: false, f: 'all', h: [['Сегодня', 'Награда за «5»', 10], ['Сегодня', 'Домашнее задание в срок', 5], ['Вчера', 'Перевод: Айдай', -30], ['Вчера', 'Награда от учителя', 25]] };
  const GOAL = 400, wk = [20, 45, 30, 60, 35, 80, 55];
  $('#wk').innerHTML = ''; ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((d, i) => { const e = document.createElement('i'); e.dataset.d = d; e.style.setProperty('--h', wk[i]); $('#wk').appendChild(e); });
  const panel = $('#panel'); let open = null;
  function show() { $('#bal').textContent = st.hide ? '••••' : fmt(st.bal); $('#bal').classList.toggle('hid', st.hide); $('#eye').textContent = st.hide ? 'Показать' : 'Скрыть'; $('#eye').setAttribute('aria-pressed', st.hide);
    const g = Math.min(100, st.goal / GOAL * 100); $('#gfill').style.width = g + '%'; $('#gtxt').textContent = fmt(st.goal) + ' из ' + GOAL + ' А' + (st.goal >= GOAL ? ' · цель достигнута' : '');
    const ul = $('#hist'); ul.innerHTML = ''; let last = ''; st.h.filter(r => st.f === 'all' || (st.f === 'in' ? r[2] > 0 : r[2] < 0)).forEach(r => { if (r[0] !== last) { const h = document.createElement('li'); h.className = 'dh'; h.textContent = r[0]; ul.appendChild(h); last = r[0]; } const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span'); li.className = 'r'; a.textContent = r[1]; b.className = r[2] > 0 ? 'p' : 'm'; b.textContent = (r[2] > 0 ? '+' : '−') + Math.abs(r[2]) + ' А'; li.append(a, b); ul.appendChild(li); }); }
  $('#eye').onclick = () => { st.hide = !st.hide; show(); };
  $$('#flt button').forEach(b => b.onclick = () => { st.f = b.dataset.f; $$('#flt button').forEach(x => x.classList.toggle('on', x === b)); show(); });
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
  function form(kind) {
    panel.hidden = false; panel.innerHTML = ''; $$('.qa').forEach(b => b.classList.toggle('on', b.dataset.a === kind));
    const title = { send: 'Перевод другу', goal: 'Пополнить цель', pay: 'Платёж по категории' }[kind]; panel.appendChild(el('h3', 0, title)); let who = 'Айдай', cat = 'Привилегии';
    if (kind === 'send') { const r = el('div', 'rcp'); ['Айдай', 'Тимур', 'Мээрим'].forEach((n, i) => { const b = el('button', i ? '' : 'on', n); b.type = 'button'; b.onclick = () => { who = n; $$('.rcp button').forEach(x => x.classList.toggle('on', x === b)); }; r.appendChild(b); }); panel.append(el('p', 'small', 'Недавние получатели'), r); }
    if (kind === 'pay') { const s = el('select'); ['Привилегии', 'Премиум-темы', 'Школьный магазин (демо)'].forEach(o => s.appendChild(el('option', 0, o))); s.onchange = () => cat = s.value; s.setAttribute('aria-label', 'Категория'); panel.appendChild(s); }
    const inp = el('input'); inp.type = 'number'; inp.min = 1; inp.placeholder = 'Сумма в алтынах'; inp.setAttribute('aria-label', 'Сумма'); const err = el('p', 'err'), go = el('button', 'bt', kind === 'pay' ? 'Подтвердить платёж' : 'Подтвердить'); go.type = 'button';
    go.onclick = () => { const v = Math.floor(+inp.value); if (!(v > 0)) { err.textContent = 'Введите сумму больше нуля'; return; } if (v > st.bal) { err.textContent = 'Недостаточно алтынов на счёте'; return; } st.bal -= v; if (kind === 'goal') st.goal = Math.min(GOAL, st.goal + v); st.h.unshift(['Сегодня', kind === 'send' ? 'Перевод: ' + who : kind === 'goal' ? 'В цель накопления' : 'Платёж: ' + cat, -v]); show(); panel.innerHTML = ''; panel.appendChild(el('h3', 0, kind === 'goal' ? 'Готово' : 'Квитанция'));
      const rc = el('div', 'rec'); [['Операция', kind === 'send' ? 'Перевод' : kind === 'goal' ? 'Пополнение цели' : 'Платёж'], ['Кому', kind === 'send' ? who : kind === 'goal' ? 'Цель накопления' : cat], ['Сумма', v + ' А'], ['Остаток', fmt(st.bal) + ' А'], ['Это демо', 'внутришкольная валюта, не деньги']].forEach(([a, b]) => rc.appendChild(el('span', 0, a + ': ' + b))); panel.appendChild(rc); const cl = el('button', 'bt ghost', 'Закрыть'); cl.type = 'button'; cl.onclick = () => { panel.hidden = true; $$('.qa').forEach(b => b.classList.remove('on')); }; panel.appendChild(cl); };
    panel.append(inp, err, go);
  }
  $$('.qa').forEach(b => b.onclick = () => form(b.dataset.a)); show();
}
