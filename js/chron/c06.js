// 0.5.1 ТААНЫМ: занавес раскрывает сайт, телефон оживает при прокрутке; макет сайта и калькулятор
export default function init({ $, $$, scene, clamp, lerp, ease, counters, tr }) {
  const hero = $('#h6'), cs = $$('.sc'), cl = $('.curt.l'), cr = $('.curt.r');
  let last = -1; scene(hero, p => {
    const c = ease(clamp(p / .3)); cl.style.setProperty('--cv', c); cr.style.setProperty('--cv', c);
    hero.style.setProperty('--pp', ease(clamp((p - .1) / .5))); hero.style.setProperty('--pr', Math.sin(p * 6.283) * 14);
    const i = Math.min(3, Math.floor(clamp((p - .25) / .7) * 4)); if (i !== last) { last = i; cs.forEach((s, j) => s.classList.toggle('on', j === i)); }
  });
  const TABS = [['Главная', `<h3>Электронный дневник нового поколения</h3><p>Прозрачное оценивание, ИИ-помощник для учителя и понятный дневник для учеников и родителей.</p><p><a class="btn" href="/app?demo=1" style="margin-top:12px">Демо</a></p>`],
    ['Опрос', `<h3>Что говорят пользователи прежнего дневника</h3><div class="stats"><div class="stat"><b data-count="97">0</b><b>%</b><p>отметили хотя бы одну проблему (33 из 34)</p></div><div class="stat"><b data-count="85">0</b><b>%</b><p>сталкиваются со сбоями минимум несколько раз в месяц</p></div><div class="stat"><b data-count="68">0</b><b>%</b><p>жалуются, что оценки появляются с задержкой</p></div><div class="stat"><b data-count="37">0</b><b> из 40</b><p>готовы пользоваться дневником, который решает эти проблемы</p></div></div><p style="font-size:.8rem">Данные опроса, опубликованные на главной странице SABAK+.</p>`],
    ['В соцсетях', `<h3>Красивая карточка при отправке ссылки</h3><p>Когда ссылкой делятся в мессенджерах и соцсетях, показывается такая карточка.</p><div class="ogc"><img src="/og.png" alt="Карточка SABAK+ для соцсетей" loading="lazy" width="1200" height="630"><div><small>sabak-plus.vercel.app</small><br><b>SABAK+ — электронный дневник нового поколения</b></div></div>`],
    ['В поиске', `<h3>Сайт лучше находится в поисковиках</h3><p>Для поисковых систем добавлены описание страниц, карта сайта и пояснения о содержимом.</p><div class="serp"><small>sabak-plus.vercel.app</small><b>SABAK+ — электронный дневник нового поколения</b><span>Прозрачное оценивание, ИИ-помощник для учителя и понятный дневник для учеников и родителей.</span></div>`]];
  const bt = $('#bt'), bb = $('#bb'); bt.innerHTML = TABS.map((t, i) => `<button role="tab" type="button" data-i="${i}" aria-selected="${!i}">${t[0]}</button>`).join('');
  const show = i => { $$('button', bt).forEach((b, j) => b.setAttribute('aria-selected', j === i)); bb.innerHTML = TABS[i][1]; counters(bb); if (i === 1) $$('[data-count]', bb).forEach(e => e.style.display = 'inline'); };
  bt.onclick = e => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); }; show(0);
  // калькулятор
  let G = [], w = 1; const round = x => Math.floor(x + .5 + 1e-9);
  $('#kbtn').innerHTML = [5, 4, 3, 2].map(v => `<button type="button" data-v="${v}" aria-label="Оценка ${v}">${v}</button>`).join('');
  $$('.ktype .btn').forEach(b => b.onclick = () => { w = +b.dataset.t; $$('.ktype .btn').forEach(x => { x.setAttribute('aria-pressed', x === b); x.classList.toggle('ghost', x !== b); }); });
  const calc = () => { $('#kg').innerHTML = G.map(g => `<span class="gc ${g.w === 2 ? 'x2' : ''}">${g.v}</span>`).join(''); if (!G.length) { $('#kfin').textContent = $('#kavg').textContent = '—'; $('#kneed').textContent = 'Поставьте первую оценку'; return; } const sw = G.reduce((a, g) => a + g.w, 0), s = G.reduce((a, g) => a + g.w * g.v, 0), avg = s / sw, fin = round(avg); $('#kfin').textContent = fin; $('#kavg').textContent = avg.toFixed(2).replace('.', ',');
    let n = null; if (fin < 5) for (let i = 0; i <= 20; i++) if (round((s + 5 * i) / (sw + i)) >= fin + 1) { n = i; break; } $('#kneed').textContent = fin >= 5 ? 'Максимальный итог — отлично!' : n == null ? `До «${fin + 1}» пока далеко` : `До «${fin + 1}» нужно ещё ${n} пятёр${n === 1 ? 'ка' : (n % 10 > 1 && n % 10 < 5 && (n < 10 || n > 20)) ? 'ки' : 'ок'}`; };
  $('#kbtn').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (G.length >= 12) G.shift(); G.push({ v: +b.dataset.v, w }); calc(); }; $('#kreset').onclick = () => { G = []; calc(); }; calc();
}
