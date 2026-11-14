// 0.1 БАШТАЛЫШ: тетрадь раскрывается при прокрутке; журнал, калькулятор, три страницы
export default function init({ $, $$, scene, clamp, ease, tr }) {
  const hero = $('#h1'), nb = $('.nb');
  scene(hero, p => {
    const c = ease(clamp(p / .35)), o = ease(clamp(p / .2));
    nb.style.setProperty('--c', c); nb.style.setProperty('--o', o);
    nb.style.setProperty('--f3', ease(clamp((p - .38) / .12))); nb.style.setProperty('--d', clamp((p - .3) / .35));
    nb.style.setProperty('--f2', ease(clamp((p - .62) / .12))); nb.style.setProperty('--u', clamp((p - .5) / .3)); nb.style.setProperty('--q', 0);
    nb.style.setProperty('--f1', ease(clamp((p - .86) / .12)));
    hero.style.setProperty('--p', p);
  });
  // --- журнал ---
  const R = [['hw', 'ДЗ'], ['act', 'Активность'], ['ind', 'Самостоятельная'], ['test', 'Контрольная'], ['talk', 'Доклад'], ['essay', 'Реферат']];
  const names = ['Айбек Тоголоков', 'Айым Султанова', 'Эрлан Жумабаев', 'Нурайым Касымова', 'Бекзат Осмонов'];
  const st = { reason: 'hw', marks: names.map(() => []), hist: [] };
  const reasons = $('#reasons'), rows = $('#rows'), saved = $('#saved'), undo = $('#undo');
  reasons.innerHTML = R.map(([k, t]) => `<button class="chip" role="radio" aria-checked="${k === 'hw'}" data-k="${k}" type="button">${t}${k === 'test' ? ' ×2' : ''}</button>`).join('');
  reasons.onclick = e => { const b = e.target.closest('.chip'); if (!b) return; st.reason = b.dataset.k; $$('.chip', reasons).forEach(x => x.setAttribute('aria-checked', x === b)); };
  const drawRows = () => rows.innerHTML = names.map((n, i) => `<li><span class="nm">${n}</span><span class="gs">${st.marks[i].map(m => `<span class="mk ${m.v === 2 ? 'two' : ''}" title="${R.find(r => r[0] === m.k)[1]}">${m.v}<small>${R.find(r => r[0] === m.k)[1].slice(0, 3)}</small></span>`).join('')}${[5, 4, 3, 2].map(v => `<button class="g" data-i="${i}" data-v="${v}" type="button" aria-label="${n}: ${v}">${v}</button>`).join('')}</span></li>`).join('');
  let tm; const flash = () => { saved.classList.add('busy'); saved.textContent = tr('Сохраняем…', 'Сакталууда…'); clearTimeout(tm); tm = setTimeout(() => { saved.classList.remove('busy'); saved.textContent = tr('Сохранено ✓', 'Сакталды ✓'); }, 700); };
  rows.onclick = e => { const b = e.target.closest('.g'); if (!b) return; const i = +b.dataset.i; st.marks[i].push({ v: +b.dataset.v, k: st.reason }); st.hist.push(i); undo.disabled = false; drawRows(); flash(); };
  undo.onclick = () => { const i = st.hist.pop(); if (i == null) return; st.marks[i].pop(); undo.disabled = !st.hist.length; drawRows(); flash(); };
  drawRows();
  // --- калькулятор (правила как в приложении: тест ×2, округление x,5 вверх) ---
  const W = { test: 2 }, wOf = g => W[g.k] || 1, round = x => Math.floor(x + .5 + 1e-9);
  let G = [{ v: 5, k: 'hw' }, { v: 4, k: 'act' }, { v: 5, k: 'ind' }, { v: 3, k: 'test' }, { v: 4, k: 'hw' }];
  const sums = () => G.reduce((a, g) => (a.sw += wOf(g), a.s += wOf(g) * g.v, a), { sw: 0, s: 0 });
  const need = t => { const { sw, s } = sums(); for (let n = 0; n <= 20; n++) if (round((s + 5 * n) / (sw + n)) >= t) return n; return null; };
  const fm = x => x.toFixed(2).replace('.', ',');
  const drawCalc = () => {
    const cg = $('#cg'), { sw, s } = sums(), avg = s / sw, fin = round(avg);
    cg.innerHTML = G.map((g, i) => `<button class="cgi ${g.k === 'test' ? 't' : ''}" data-i="${i}" type="button" aria-label="${R.find(r => r[0] === g.k)[1]}: ${g.v}. Нажмите, чтобы изменить"><b>${g.v}</b><small>${R.find(r => r[0] === g.k)[1]}${g.k === 'test' ? ' ×2' : ''}</small></button>`).join('');
    $('#cfin').textContent = fin; $('#cavg').textContent = fm(avg);
    $('#cform').innerHTML = `(${G.map(g => wOf(g) === 2 ? `<em>2×${g.v}</em>` : g.v).join(' + ')}) ÷ ${sw} = <em>${fm(avg)}</em> → ${fin}`;
    const n = fin >= 5 ? 0 : need(fin + 1);
    $('#cneed').textContent = fin >= 5 ? 'Максимальный итог — отлично!' : n == null ? `До «${fin + 1}» пока далеко` : `До «${fin + 1}» нужно ещё ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'пятёрка' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 > 20)) ? 'пятёрки' : 'пятёрок'}`;
  };
  $('#cg').onclick = e => { const b = e.target.closest('.cgi'); if (!b) return; const g = G[+b.dataset.i]; g.v = g.v <= 2 ? 5 : g.v - 1; drawCalc(); };
  $('#cadd').onclick = () => { if (G.length < 12) G.push({ v: 5, k: 'hw' }); drawCalc(); };
  $('#ctest').onclick = () => { G[G.length - 1].k = G[G.length - 1].k === 'test' ? 'hw' : 'test'; drawCalc(); };
  $('#creset').onclick = () => { G = [{ v: 5, k: 'hw' }, { v: 4, k: 'act' }, { v: 5, k: 'ind' }, { v: 3, k: 'test' }, { v: 4, k: 'hw' }]; drawCalc(); };
  drawCalc();
  // --- три страницы ---
  $('#aibtn').onclick = () => { $('#aia').hidden = false; $('#aibtn').textContent = 'Подсказка получена'; };
  const A = ['Я учусь каждый день — и этого достаточно.', 'Ошибка — это ступенька, а не стена.', 'Сегодня я стал немного сильнее, чем вчера.', 'Мне можно не знать — и можно спросить.']; let ai = 0;
  $('#affb').onclick = () => { ai = (ai + 1) % A.length; $('#aff').textContent = A[ai]; };
  $('#amb').onclick = () => { const t = $('#am'); if (!t.value.trim()) { $('#amn').textContent = 'Сначала напишите сообщение.'; return; } t.value = ''; $('#amn').textContent = 'Отправлено анонимно ✓ (демо: на самом деле ничего не отправлено).'; };
}
