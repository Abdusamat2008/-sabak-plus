// 0.9 ҮН: звуковая волна, демо «листков» с Эхо, опросами, тегами и поиском (вымышленные данные).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const N = 36; ['#wave', '#wave2'].forEach(s => { const w = $(s); for (let i = 0; i < N; i++) w.appendChild(document.createElement('i')); });
  const bars = $$('#wave i'), bars2 = $$('#wave2 i');
  const paint = (arr, ph, amp) => arr.forEach((b, i) => { const x = i / N; b.style.setProperty('--h', (6 + amp * (Math.sin(x * 9 - ph) * .5 + .5) * 80 * Math.sin(x * Math.PI)).toFixed(1)); });
  paint(bars, 0, 1); paint(bars2, 0, 1);
  C.pin($('#hero'), p => { set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .2))); paint(bars, p * 14, .3 + C.ease.out(seg(p, 0, .5)) * .7); set($('.sub'), '--sb', seg(p, .72, .9)); }, 1);
  C.pin($('#finale'), p => { paint(bars2, p * 18, 1 - seg(p, .5, .9) * .5); set($('#quote'), '--qo', seg(p, .5, .75)); }, 1);
  /* демо */
  const POSTS = [
    { id: 1, t: 'Идея', off: 0, an: 0, who: 'Айдай', h: 'Школьный радиоэфир на переменах', tx: 'Предлагаю включать музыку и объявления на большой перемене.', tags: ['идея', 'школа'], e: 12 },
    { id: 2, t: 'Вопрос', off: 0, an: 0, who: 'Тимур', h: 'Какая тема дня?', tx: 'Сегодняшняя тема дня: «Что вы читаете сейчас?»', tags: ['темадня'], e: 7, poll: { o: ['Роман', 'Научпоп', 'Комиксы', 'Ничего'], v: [5, 2, 3, 1] } },
    { id: 3, t: 'Честно', off: 0, an: 1, who: 'Аноним · Лиса', h: 'Устаю от домашки', tx: 'Хочется, чтобы домашние задания распределяли равномернее.', tags: ['честно', 'учёба'], e: 21 },
    { id: 4, t: 'Идея', off: 1, an: 0, who: 'Администрация', h: 'Неделя науки', tx: 'В следующую неделю пройдут открытые уроки и выставка проектов.', tags: ['школа', 'события'], e: 30 },
    { id: 5, t: 'Фото', off: 0, an: 0, who: 'Мээрим', h: 'Кружок рисования', tx: 'Наши работы в школьном коридоре.', tags: ['фото', 'кружок'], e: 9 }];
  const st = { tab: 'Лента', tag: null, q: '', e: new Set(), bm: new Set(), voted: {} };
  const TABS = ['Лента', 'Популярное', 'Честно', 'Фото', 'Сохранённое'];
  const tabs = $('#tabs'); TABS.forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => { st.tab = t; draw(); }; tabs.appendChild(b); });
  const tg = $('#tags'); ['идея', 'школа', 'темадня', 'честно', 'учёба', 'события', 'фото', 'кружок'].forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = '#' + t; b.onclick = () => { st.tag = st.tag === t ? null : t; draw(); }; b.dataset.t = t; tg.appendChild(b); });
  $('#q').oninput = e => { st.q = e.target.value.toLowerCase().trim(); draw(); };
  function draw() {
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.textContent === st.tab)); $$('#tags button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tag));
    let l = POSTS.filter(p => (st.tab === 'Честно' ? p.t === 'Честно' : st.tab === 'Фото' ? p.t === 'Фото' : st.tab === 'Сохранённое' ? st.bm.has(p.id) : true) && (!st.tag || p.tags.includes(st.tag)) && (!st.q || (p.h + ' ' + p.tx + ' ' + p.who + ' ' + p.tags.join(' ')).toLowerCase().includes(st.q)));
    if (st.tab === 'Популярное') l = l.slice().sort((a, b) => (b.e + st.e.has(b.id)) - (a.e + st.e.has(a.id)));
    const d = $('#deck'); d.innerHTML = ''; if (!l.length) { const n = document.createElement('p'); n.className = 'none'; n.textContent = st.tab === 'Сохранённое' ? 'Здесь появятся сохранённые публикации. Нажмите закладку на листке.' : 'Ничего не найдено. Измените запрос или выберите другой тег.'; d.appendChild(n); return; }
    l.forEach((p, i) => { const s = document.createElement('article'); s.className = 'sheet' + (p.an ? ' an' : p.off ? ' off' : ''); s.style.setProperty('--r', ((i % 3) - 1) * 1.2 + 'deg');
      const sm = document.createElement('small'), h = document.createElement('h3'), tx = document.createElement('p'); sm.textContent = p.t + ' · ' + p.who + (p.off ? ' · официально' : ''); h.textContent = p.h; tx.textContent = p.tx; s.append(sm, h, tx);
      if (p.poll) { const pl = document.createElement('div'); pl.className = 'pl'; const tot = p.poll.v.reduce((a, b) => a + b, 0) + (st.voted[p.id] != null ? 1 : 0); p.poll.o.forEach((o, k) => { const b = document.createElement('button'); b.type = 'button'; const v = p.poll.v[k] + (st.voted[p.id] === k ? 1 : 0); const w = st.voted[p.id] != null ? Math.round(v / tot * 100) : 0; b.innerHTML = '<i></i><span><em></em><b></b></span>'; b.querySelector('em').textContent = o; b.querySelector('b').textContent = st.voted[p.id] != null ? w + '%' : ''; b.style.setProperty('--w', w); b.disabled = st.voted[p.id] != null; if (st.voted[p.id] === k) b.classList.add('mine'); b.onclick = () => { st.voted[p.id] = k; draw(); }; pl.appendChild(b); }); s.appendChild(pl); const pn = document.createElement('small'); pn.textContent = 'Голосование анонимное, один голос на человека (демо).'; s.appendChild(pn); }
      const a = document.createElement('div'); a.className = 'act'; const e = document.createElement('button'); e.type = 'button'; e.className = 'echo' + (st.e.has(p.id) ? ' on' : ''); e.textContent = 'Эхо ' + (p.e + (st.e.has(p.id) ? 1 : 0)); e.onclick = () => { if (st.e.has(p.id)) st.e.delete(p.id); else { st.e.add(p.id); if (!C.reduced) for (let k = 0; k < 3; k++) { const r = document.createElement('i'); r.className = 'ring'; r.style.animationDelay = k * .18 + 's'; e.appendChild(r); setTimeout(() => r.remove(), 1400); } } e.classList.toggle('on', st.e.has(p.id)); e.firstChild.textContent = 'Эхо ' + (p.e + (st.e.has(p.id) ? 1 : 0)); };
      const bm = document.createElement('button'); bm.type = 'button'; bm.className = 'bm'; bm.setAttribute('aria-label', 'Сохранить'); bm.textContent = st.bm.has(p.id) ? '★' : '☆'; bm.onclick = () => { st.bm.has(p.id) ? st.bm.delete(p.id) : st.bm.add(p.id); bm.textContent = st.bm.has(p.id) ? '★' : '☆'; if (st.tab === 'Сохранённое') draw(); };
      a.append(e, bm); s.appendChild(a); d.appendChild(s); });
  }
  draw();
}
