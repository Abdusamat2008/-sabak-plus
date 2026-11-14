export default {
  hero: `<div class="tall" id="h8" style="--h:300vh;--hm:240vh"><div class="stick"><canvas id="cc" aria-hidden="true"></canvas><div class="gridl"></div>
  <div class="ht"><p class="eyebrow">SABAK+ · 0.7</p><h1 class="mega" aria-label="БАГЫТ">БАГЫТ</h1><p class="subt" data-ky="Бир система. Көп мектеп">Одна система. Множество школ</p></div>
  <div class="hud" aria-hidden="true"><span>Школ в сети (DEMO): <b id="hn">0</b></span><span>Статус: <b>online</b></span></div><p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'map', title: 'Центр управления платформой', lead: 'Макет с вымышленными DEMO-данными: выберите школу на карте, переключайте разделы, приостановите школу или выдайте ключ.', html: `<div class="demo cmd"><span class="tag">DEMO · вымышленные данные</span>
      <div class="ctabs" role="tablist" id="ct"></div><div class="scanl" id="sl"></div>
      <div class="cbody" id="cb"></div></div>
      <p class="note">Технический администратор не видит личные оценки детей: только сводную статистику и архив для чтения. Все названия, имена и цифры в макете придуманы.</p>` },
  ],
  finale: `<div class="fcomp" aria-hidden="true"><i></i></div>`,
};
