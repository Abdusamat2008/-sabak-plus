export default {
  hero: `<div class="tall" id="h6" style="--h:300vh;--hm:240vh"><div class="stick"><div class="glowl"></div>
  <div class="curt l" aria-hidden="true"></div><div class="curt r" aria-hidden="true"></div>
  <h1 class="mega" data-split aria-label="ТААНЫМ">ТААНЫМ</h1>
  <div class="ph6" aria-hidden="true"><div class="isl"></div><div class="scrs"><div class="sc on"><small>SABAK+</small><b>Привет, Айбек!</b><p>Неделя идёт хорошо</p></div><div class="sc"><small>Оценки</small><b>Математика</b><span class="gg">5</span><span class="gg">4</span><span class="gg">5</span></div><div class="sc"><small>Достижения</small><b>30 дней без «Н»</b><p>🏅</p></div><div class="sc"><small>Расписание</small><b>Сегодня 5 уроков</b><p>Алгебра · Физика</p></div></div></div>
  <p class="subt" data-ky="Эми бизди баары көрө алат">Теперь нас может увидеть каждый</p><p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'site', title: 'Публичный сайт: что увидит мир', lead: 'Четыре вкладки — четыре стороны публичного лица SABAK+.', html: `<div class="demo"><span class="tag">Макет сайта</span><div class="bw"><div class="bwbar"><i></i><i></i><i></i><span>sabak-plus.vercel.app</span></div><div class="bwtabs" role="tablist" id="bt"></div><div class="bwbody" id="bb" role="tabpanel"></div></div>
      <p class="note">Приложение теперь живёт по адресу «/app», а главный адрес занимает сайт. Кнопка «Демо» ведёт сразу в демонстрационный режим. Из публичных текстов убраны упоминания хакатона.</p></div>` },
    { id: 'calc', title: 'Калькулятор оценки на главной', lead: 'Добавляйте оценки и переключайте тип работы: итог пересчитывается сразу.', html: `<div class="demo"><span class="tag">Калькулятор</span><div class="kc"><div class="ktype" role="group" aria-label="Тип работы"><button class="btn" data-t="1" aria-pressed="true" type="button">Обычная работа</button><button class="btn ghost" data-t="2" aria-pressed="false" type="button">Контрольная ×2</button></div><div class="kg" id="kg"></div><div class="kbtn" id="kbtn"></div><div class="kres"><div><small>Итог</small><b id="kfin">—</b></div><div><small>Среднее</small><b id="kavg">—</b></div></div><p id="kneed" class="need" aria-live="polite">Поставьте первую оценку</p><button class="btn ghost" id="kreset" type="button">Сбросить</button></div></div>` },
  ],
  finale: `<div class="fweb" aria-hidden="true"><i></i><i></i><i></i></div>`,
};
