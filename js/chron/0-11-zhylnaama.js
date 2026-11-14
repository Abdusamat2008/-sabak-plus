// 0.11 ЖЫЛСАНАК: календарь перелистывается и становится шкалой года; демо правил по дням и печать на удостоверении.
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const pgs = $$('.pg');
  C.pin($('#hero'), p => { set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .15))); set($('#cal'), '--p', C.ease.out(seg(p, 0, .25))); pgs.forEach((g, i) => set(g, '--f', C.ease.inOut(seg(p, .2 + i * .1, .35 + i * .1)))); set($('#cal'), '--s', C.ease.inOut(seg(p, .72, .88))); set($('#scale'), '--s', C.ease.inOut(seg(p, .72, .9))); }, 1);
  C.pin($('#finale'), p => { set($('#tl'), '--tw', C.ease.inOut(seg(p, .05, .5))); set($('#bseal'), '--bo', C.ease.out(seg(p, .45, .65))); set($('#quote'), '--qo', seg(p, .6, .8)); }, 1);
  /* демо: вымышленный месяц; даты и четверти условные */
  const Q = [['1 четверть', 'q', 'Идёт четверть: оценки ставить можно.', 'ok'], ['Конец четверти', 'c', 'Первые три дня после конца четверти доступны исправления.', 'cor'], ['Каникулы', 'v', 'Каникулы: оценки ставить нельзя.', 'no'], ['Закрытая четверть', 'x', 'Четверть закрыта и сохранена в архив: изменить нельзя.', 'no']];
  const qs = $('#qs'), days = $('#days'), vd = $('#verdict'); let cur = 0, selDay = null;
  Q.forEach((q, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q[0]; b.onclick = () => { cur = i; selDay = null; draw(); }; qs.appendChild(b); });
  function draw() {
    $$('#qs button').forEach((b, i) => { b.classList.toggle('on', i === cur); b.classList.toggle('vac', Q[i][3] === 'no'); });
    days.innerHTML = ''; ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(d => { const h = document.createElement('div'); h.className = 'h'; h.textContent = d; days.appendChild(h); });
    for (let d = 1; d <= 28; d++) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = d; const wk = (d - 1) % 7 >= 5; let cls = Q[cur][3], t = Q[cur][2];
      if (cur === 0 && wk) { cls = 'no'; t = 'Выходной: уроков нет.'; } if (cur === 1) { if (d <= 3) { cls = 'cor'; t = 'Исправление оценок ещё возможно (' + d + '-й день из трёх).'; } else { cls = 'no'; t = 'Срок исправлений прошёл: архив четверти зафиксирован.'; } }
      b.className = cls + (selDay === d ? ' sel' : ''); b.onclick = () => { selDay = d; vd.textContent = 'День ' + d + ': ' + t; $$('#days button').forEach(x => x.classList.toggle('sel', x === b)); }; days.appendChild(b);
    }
    vd.textContent = selDay ? vd.textContent : Q[cur][2];
  }
  draw();
  const seal = $('#seal'); $('#stamp').onclick = () => { seal.classList.remove('on'); void seal.getBoundingClientRect(); seal.classList.add('on'); }; $('#unstamp').onclick = () => seal.classList.remove('on');
}
