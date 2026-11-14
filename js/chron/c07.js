// 0.6 МУРАС: ящики архива выдвигаются при прокрутке; навигация год → класс → ученик → документы
export default function init({ $, $$, scene }) {
  scene($('#h7'), () => {});
  const D = { '2025–2026': { '9А': ['Айбек Т.', 'Айым С.'], '9Б': ['Эрлан Ж.', 'Нурайым К.'] }, '2024–2025': { '8А': ['Айбек Т.', 'Айым С.'], '8Б': ['Эрлан Ж.'] }, '2023–2024': { '7А': ['Айбек Т.', 'Айым С.', 'Бекзат О.'] } };
  const path = [], cr = $('#cr'), sh = $('#sh'), dc = $('#dc'), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const render = () => {
    const lv = path.length, T = ['Годы', ...path]; cr.innerHTML = ['Архив', ...path].map((p, i) => `<button type="button" data-i="${i}" ${i === lv ? 'aria-current="step"' : ''}>${esc(p)}</button>`).join('');
    sh.hidden = lv === 3; dc.hidden = lv < 3; if (lv === 3) { dc.innerHTML = `<div class="paper" style="--i:0"><b>Оценки с типом работы</b><table><tr><td>Математика</td><td>Контрольная</td><td>4</td></tr><tr><td>Математика</td><td>Домашняя работа</td><td>5</td></tr><tr><td>Кыргыз тили</td><td>Доклад</td><td>5</td></tr><tr><td>История</td><td>Реферат</td><td>4</td></tr></table></div><div class="paper" style="--i:1"><b>Посещаемость</b><p>Пропусков «Н» за год: 3 · Опозданий: 1</p></div><div class="paper" style="--i:2"><b>Дело ученика</b><p>Характеристика · Документы · Награды</p></div>`; return; }
    const items = lv === 0 ? Object.keys(D) : lv === 1 ? Object.keys(D[path[0]]) : D[path[0]][path[1]]; sh.innerHTML = items.map((x, i) => `<button class="fold" style="--i:${i}" type="button" data-v="${esc(x)}">${esc(x)}<small>${['учебный год', 'класс', 'ученик'][lv]}</small></button>`).join('');
  };
  sh.onclick = e => { const b = e.target.closest('.fold'); if (b) { path.push(b.dataset.v); render(); } }; cr.onclick = e => { const b = e.target.closest('button'); if (b) { path.length = +b.dataset.i; render(); } }; render();
  $('#endy').onclick = () => { $('#endn').textContent = 'Демо: учебный год «сохранён» в архив. Ничего не отправлено.'; };
}
