// 0.6 МУРАС: архивный шкаф, ящики, демо навигации год → класс → ученик, дело ученика, закрытие архива.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  C.pin($('#hero'), p => {
    set($('.stage'), '--p', C.ease.out(seg(p, 0, .9))); set($('.mega'), '--t', C.ease.out(seg(p, 0, .2))); set($('.stage'), '--hn', p);
    $$('.dw').forEach((d, i) => { const k = i / 9 * .5 + .2; set(d, '--o', C.ease.out(seg(p, k, k + .2)) * (1 - seg(p, .85, 1) * .0)); });
    set($('.sub'), '--sb', seg(p, .72, .9));
  }, 1);
  /* демо архива */
  const data = { '2024/25': { '7 «А»': ['Айдай К.', 'Бекзат М.'], '8 «Б»': ['Айбек Т.', 'Мээрим С.', 'Эмир Ж.'] }, '2025/26': { '8 «А»': ['Нурай А.', 'Тимур Б.'], '9 «Б»': ['Айбек Т.', 'Данияр Ш.'] } };
  const st = { y: null, c: null, s: null }, shelf = $('#shelf'), docs = $('#docs'), crumbs = $('#crumbs');
  const btn = (t, sub, f) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'fo'; b.textContent = t; if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); } b.onclick = f; return b; };
  function flash() { if (C.reduced) return; const f = $('#film'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  function render() {
    shelf.innerHTML = ''; docs.innerHTML = ''; crumbs.innerHTML = '';
    const add = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = f; crumbs.appendChild(b); };
    add('Архив', () => { st.y = st.c = st.s = null; flash(); render(); });
    if (st.y) { crumbs.appendChild(Object.assign(document.createElement('span'), { textContent: '›' })); add('Год ' + st.y, () => { st.c = st.s = null; render(); }); }
    if (st.c) { crumbs.appendChild(Object.assign(document.createElement('span'), { textContent: '›' })); add('Класс ' + st.c, () => { st.s = null; render(); }); }
    if (st.s) { crumbs.appendChild(Object.assign(document.createElement('span'), { textContent: '›' })); add(st.s, () => { }); }
    if (!st.y) Object.keys(data).forEach(y => shelf.appendChild(btn(y, 'учебный год', () => { st.y = y; flash(); render(); })));
    else if (!st.c) Object.keys(data[st.y]).forEach(c => shelf.appendChild(btn(c, data[st.y][c].length + ' ученика(ов)', () => { st.c = c; render(); })));
    else if (!st.s) data[st.y][st.c].forEach(s => shelf.appendChild(btn(s, 'открыть дело', () => { st.s = s; render(); })));
    else [['Характеристика', 'Краткое описание ученика за год. Только чтение.'], ['Документы', 'Справки и заявления, прикреплённые к делу.'], ['Награды', 'Достижения за этот учебный год.'], ['Оценки', 'Оценки с типом работы: контрольная, классная, домашняя.'], ['Посещаемость', 'Пропуски и опоздания за год.']].forEach(([h, t]) => { const d = document.createElement('div'); d.className = 'dc'; const b = document.createElement('b'), p = document.createElement('p'); b.textContent = h; p.textContent = t; d.append(b, p); docs.appendChild(d); });
  }
  render();
  C.pin($('#folder'), p => set($('#fw'), '--k', C.ease.inOut(seg(p, .15, .75))), 1);
  C.pin($('#finale'), p => { set($('.fstage'), '--dc', C.ease.inOut(seg(p, .1, .65))); set($('.fstage'), '--sl', 1); set($('#quote'), '--qo', seg(p, .6, .82)); }, 1);
  set($('.fstage'), '--dc', 0); set($('.fstage'), '--sl', 1);
}
