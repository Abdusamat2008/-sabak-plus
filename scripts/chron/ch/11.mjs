import { horn } from '../orn.mjs';
const edge = Array.from({ length: 14 }, (_, i) => `<i style="--z:${-i}px"></i>`).join('');
export default {
  hero: `<div class="tall" id="h11" style="--h:320vh;--hm:260vh"><div class="stick"><div class="spot"></div>
  <div class="ht"><p class="eyebrow">SABAK+ · 0.10</p><h1 class="mega" aria-label="АЛТЫН">АЛТЫН</h1><p class="subt"><span data-ky="Ар бир аракеттин өз баасы бар">Ар бир аракеттин өз баасы бар</span> <em data-ky="— каждое действие имеет свою ценность">— каждое действие имеет свою ценность</em></p></div>
  <div class="coinw" id="cw" aria-hidden="true"><div class="coin" id="cn">${edge}<div class="face f">${horn('chn', 2.4)}<b>АЛТЫН</b></div></div><div class="acct" id="ac"><small>Счёт</small><b id="acb">0</b><span>алтын</span><div class="acl"><i></i><i></i><i></i></div></div></div>
  <p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'account', title: 'Счёт «Алтына» — как в мобильном банке', lead: 'Скрывайте баланс, переводите, платите по категориям, копите на цель. Данные демонстрационные.', html: `<div class="demo bk"><span class="tag">DEMO-данные</span>
      <div class="bcard"><div class="bt"><small>Счёт ученика</small><button class="eye" id="eye" type="button" aria-pressed="false" aria-label="Скрыть баланс">👁</button></div><div class="bbal"><b id="bb">0</b> <span class="coinic" aria-hidden="true"></span></div><small id="bcap">демо-счёт</small>
      <div class="qa"><button type="button" data-go="tr">⇄ Перевод</button><button type="button" data-go="pay">▣ Платёж</button><button type="button" data-go="goal">◎ Цель</button></div></div>
      <div class="bpan" id="bp"></div>
      <div class="split"><div><h3 class="s3">История по дням</h3><div class="flt" id="fl"></div><ul class="hist" id="hs"></ul></div><div><h3 class="s3">Неделя</h3><div class="wk" id="wk"></div></div></div>
      <p class="note"><b>«Алтын» — внутренний учебный балл школы.</b> Это не настоящие деньги и не банковский продукт: его нельзя купить, вывести или обменять на деньги. Интерфейс лишь напоминает банковское приложение для удобства.</p></div>` },
    { id: 'themes', title: 'Темы и реакции «Үн»', lead: 'Выберите тему оформления, поставьте реакцию — смайлики разлетаются частицами.', html: `<div class="demo thm"><span class="tag">Прототип</span><div class="tsw" id="ts" role="group" aria-label="Тема"></div><div class="tcard" id="tc"><b>@aibek</b><p>Сегодня получилось сдать реферат раньше срока!</p><div class="rx" id="rx"></div><div class="acts9"><button type="button" id="rp">↻ Репост</button><button type="button" id="rq">❝ Цитата</button><button type="button" id="rc2">⧉ Копировать</button><button type="button" id="re">✎ Править (15 мин)</button></div><p class="note" id="tn" role="status"></p></div><canvas id="pc" aria-hidden="true"></canvas></div>` },
  ],
  finale: `<div class="fcoins" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`,
};
