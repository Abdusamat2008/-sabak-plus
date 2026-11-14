import { horn, tile, mark } from '../orn.mjs';
const word = 'БАШТАЛЫШ'.split('').map((l, i) => `<span class="lt" style="--i:${i}">${l}</span>`).join('');
const lines = [30, 62, 94, 126, 158, 190].map((y, i) => `<path class="ink" style="--k:${i}" d="M20 ${y} q 20 -8 40 0 t 40 0 t 40 0 t 40 0" />`).join('');
export default {
  hero: `${tile('o1')}<div class="tall" id="h1" style="--h:320vh;--hm:260vh"><div class="stick">
  <div class="wmk" style="color:var(--acc2)">${mark('o1')}</div><div class="glow"></div>
  <div class="head"><p class="eyebrow">SABAK+ · 0.1</p><h1 class="mega" aria-label="БАШТАЛЫШ">${word}</h1><p class="subt" data-ky="Баары бир идеядан башталат">Всё начинается с одной идеи</p></div>
  <div class="nb" aria-hidden="true">
    <div class="back"></div>
    <div class="pgs">
      <div class="pg p3"><svg viewBox="0 0 200 220" class="sk">${lines}</svg></div>
      <div class="pg p2"><div class="ui"><b>9А · Математика</b><div class="uic"><i>5</i><i>4</i><i class="t">5</i></div><div class="uib"><span>Сохранено ✓</span><span>↶ Отменить</span></div></div></div>
      <div class="pg p1"><div class="ui l"><b>Итог</b><div class="big">4</div><small>Контрольная ×2</small></div></div>
    </div>
    <div class="cover"><div class="cin"><span class="cl">SABAK<b>+</b></span><i>тетрадь · 0.1</i>${horn('chorn', 2.5)}</div><div class="cback"></div></div>
  </div>
  <p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p>
</div></div>`,
  scenes: [
    { id: 'journal', cls: '', title: 'Журнал в несколько касаний', lead: 'Выберите основание оценки, коснитесь ученика и оценки — запись появится чернилами. Всё сохраняется само, а последнее действие можно отменить.', html: `<div class="demo"><span class="tag">Демо</span>
      <div class="jbar"><div class="chips" role="radiogroup" aria-label="Основание оценки" id="reasons"></div><div class="jact"><span class="saved" id="saved" role="status" aria-live="polite">Сохранено ✓</span><button class="btn ghost" id="undo" type="button" disabled>↶ Отменить</button></div></div>
      <div class="sheet"><ul class="rows" id="rows"></ul></div>
      <p class="note">Это учебная демонстрация: данные никуда не отправляются. Оценки в самом журнале выставляет только учитель.</p></div>` },
    { id: 'calc', title: 'Итоговая оценка: контрольная ×2', lead: 'Нажимайте на оценки, чтобы менять их, и смотрите, как контрольная влияет на итог. Ниже — сколько пятёрок нужно до следующей итоговой оценки.', html: `<div class="demo"><span class="tag">Калькулятор</span><div class="calc"><div class="cg" id="cg" aria-label="Оценки"></div>
      <div class="cres"><div class="fin"><small>Итог</small><b id="cfin">—</b></div><div class="av"><small>Среднее с весами</small><b id="cavg">—</b></div></div>
      <div class="formula" id="cform" aria-live="polite"></div><p class="need" id="cneed" aria-live="polite"></p>
      <div class="cbtn"><button class="btn ghost" id="cadd" type="button">+ ещё оценка</button><button class="btn ghost" id="ctest" type="button">Сделать последнюю контрольной ×2</button><button class="btn ghost" id="creset" type="button">Сбросить</button></div></div>
      <p class="note">Правило: контрольная считается с весом ×2, остальное — ×1; итог — среднее, округлённое от x,5 вверх.</p></div>` },
    { id: 'extra', title: 'Ещё три страницы тетради', lead: 'Подсказка, доброе слово и анонимный голос — то, что делает журнал человечнее.', html: `<div class="pages3">
      <article class="pgc"><h3>Подсказка ИИ</h3><p id="aiq" class="q">Оценки Айбека за две недели: 5, 4, 3, 3.</p><p id="aia" class="a" hidden>Динамика идёт вниз. Возможно, стоит спросить, что стало сложнее, и повторить тему.</p><div class="row"><button class="btn" id="aibtn" type="button">Получить подсказку</button></div><p class="note">ИИ только советует. Оценку выставляет учитель — всегда сам.</p></article>
      <article class="pgc"><h3>Аффирмация дня</h3><p class="aff" id="aff">Я учусь каждый день — и этого достаточно.</p><div class="row"><button class="btn ghost" id="affb" type="button">Другая</button></div><p class="note">Примеры фраз для демонстрации.</p></article>
      <article class="pgc"><h3>Анонимная почта администрации</h3><label class="sr" for="am">Сообщение</label><textarea id="am" rows="3" maxlength="200" placeholder="Напишите сообщение…"></textarea><div class="row"><button class="btn" id="amb" type="button">Отправить анонимно</button></div><p class="note" id="amn" role="status">Автор не сохраняется — администрация видит только текст. (Демо: ничего не отправляется.)</p></article></div>` },
  ],
  finale: `<div class="fin-sheet" aria-hidden="true"><svg viewBox="0 0 400 120"><path class="ink2" d="M10 70 C 60 20, 100 120, 150 60 S 230 20, 280 70 S 360 100, 390 50"/></svg></div>`,
};
