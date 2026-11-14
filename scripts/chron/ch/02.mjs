const ridge = (y, d) => `<svg class="mt" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" /></svg>`;
export default {
  hero: `<div class="tall" id="h2" style="--h:320vh;--hm:260vh"><div class="stick">
  <div class="sky"></div><div class="sun"></div>
  <div class="mts m1">${ridge(0, 'M0 300V190L90 120L170 190L260 90L360 200L470 110L560 210L680 80L790 200L890 120L1000 220L1100 140L1200 200V300Z')}</div>
  <div class="mts m2">${ridge(0, 'M0 300V220L120 160L220 230L340 150L450 240L580 170L700 250L830 160L950 240L1070 180L1200 240V300Z')}</div>
  <div class="mts m3">${ridge(0, 'M0 300V250L140 210L260 255L400 200L540 258L690 215L820 262L980 210L1100 255L1200 230V300Z')}</div>
  <h1 class="mega" aria-label="КӨЧМӨ">КӨЧМӨ</h1><p class="subt"><span data-ky="Билим ар дайым жаныңда">Билим ар дайым жаныңда</span> <em data-ky="— знания всегда рядом">— знания всегда рядом</em></p>
  <div class="morph" aria-hidden="true"><div class="mbar"><i></i><i></i><i></i><span>sabak-plus.vercel.app</span></div>
    <div class="mscr"><b class="mlogo">SABAK<i>+</i></b><div class="mrow"><span>Математика</span><span class="g">5</span></div><div class="mrow"><span>Кыргыз тили</span><span class="g">4</span></div><div class="mrow"><span>История</span><span class="g">5</span></div><div class="mrow dim"><span>Расписание</span><span>→</span></div></div>
    <div class="mfoot"><img src="/icons/icon-192.png" width="36" height="36" alt="" loading="lazy"></div></div>
  <p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'install', title: 'Установка на главный экран', lead: 'Нажмите «Установить» и посмотрите, как значок SABAK+ появляется на экране телефона.', html: `<div class="demo"><span class="tag">Симуляция</span><div class="inst"><div class="ph"><div class="ph-in" id="phin"><div class="ph-top"><span>9:41</span><span>●●●</span></div>
      <div id="stBrowser" class="br"><div class="addr">sabak-plus.vercel.app</div><div class="pagebody"><b>SABAK+</b><p>Электронный дневник</p></div><button class="btn" id="shareb" type="button">Поделиться ⬆</button></div>
      <div id="stSheet" class="sheet" hidden><p>Добавить на главный экран</p><button class="btn" id="addb" type="button">Добавить</button><button class="btn ghost" id="canb" type="button">Отмена</button></div>
      <div id="stHome" class="home" hidden><div class="apps"><span class="a1"></span><span class="a2"></span><span class="a3"></span><span class="a4"></span><span class="a5"></span><span class="a6"></span><span class="a7"></span><span class="newapp" id="newapp"><img src="/icons/icon-192.png" alt="SABAK+" width="48" height="48"><small>SABAK+</small></span></div></div></div></div>
      <div class="inst-t"><ol class="steps"><li id="s1" class="on">Откройте сайт в браузере телефона</li><li id="s2">Нажмите «Поделиться» и выберите «На экран Домой»</li><li id="s3">Значок SABAK+ появится на главном экране</li></ol><button class="btn ghost" id="instr" type="button">Начать заново</button><p class="note">Это визуальная симуляция: на ваше устройство ничего не устанавливается. Чтобы установить настоящее приложение, откройте sabak-plus.vercel.app на телефоне и используйте меню браузера.</p></div></div></div>` },
    { id: 'phone', title: 'Открытые страницы работают без интернета', lead: 'Откройте несколько разделов, затем выключите сеть — открытые останутся доступными.', html: `<div class="demo"><span class="tag">Симуляция</span><div class="offl"><div class="net"><button class="btn" id="netb" type="button" aria-pressed="false">Интернет: включён</button></div><ul class="pgsl" id="pgsl"></ul><p class="note" id="offn" role="status">Нажмите на раздел, чтобы открыть его — он сохранится в памяти приложения.</p></div>
      <div class="pub"><b>Проект опубликован в интернете</b><span>Доступен по обычной ссылке — без магазина приложений.</span></div></div>` },
  ],
  finale: `<svg class="fmt" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 300V190L90 120L170 190L260 90L360 200L470 110L560 210L680 80L790 200L890 120L1000 220L1100 140L1200 200V300Z"/></svg>`,
};
