const drawers = ['2025–2026', '2024–2025', '2023–2024', '2022–2023'].map((y, i) => `<div class="dr" style="--i:${i}"><div class="df"><span class="lab">${y}</span><i class="knob"></i></div><div class="dc"><span>Оценки</span><span>Посещаемость</span><span>Дело</span></div></div>`).join('');
export default {
  hero: `<div class="tall" id="h7" style="--h:320vh;--hm:260vh"><div class="stick"><div class="vig"></div>
  <div class="ht"><p class="eyebrow">SABAK+ · 0.6</p><h1 class="mega" aria-label="МУРАС">МУРАС</h1><p class="subt" data-ky="Билим унутулбайт. Тарых сакталат">Знания не забываются</p></div>
  <div class="cab" aria-hidden="true"><div class="body">${drawers}</div></div><p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'archive', title: 'Навигация по архиву', lead: 'Учебный год → класс → ученик → документы. Данные ниже вымышленные (DEMO).', html: `<div class="demo"><span class="tag">DEMO-данные</span><nav class="crumbs" id="cr" aria-label="Путь"></nav><div class="shelf" id="sh" role="list"></div><div class="docs" id="dc" hidden></div>
      <div class="rules"><b>Как наполняется архив</b><ul><li>С 1 июня по 31 августа год сохраняется сам при входе директора.</li><li>Есть и ручная кнопка «Завершить учебный год» с необязательной очисткой журнала.</li><li>Директор видит только свою школу; технический администратор — списки школ и архивы, но ничего не меняет.</li></ul><div class="row"><button class="btn" id="endy" type="button">Завершить учебный год (демо)</button><span class="note" id="endn" role="status"></span></div></div>
      <p class="note">Ещё в этой версии: страница подключения школы с инструкцией и заявкой через WhatsApp, а также история обновлений с видеопримерами.</p></div>` },
  ],
  finale: `<div class="lampf" aria-hidden="true"></div>`,
};
