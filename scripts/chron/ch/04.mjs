export default {
  hero: `<div class="tall" id="h4" style="--h:300vh;--hm:240vh"><div class="stick">
  <div class="side l"><span class="lbl">Русский</span></div><div class="side r"><span class="lbl">Кыргызча</span></div>
  <svg class="bridge" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path id="bpath" class="bp" d="M0 330 C 200 130 400 130 500 130 C 600 130 800 130 1000 330"/><path id="bmorph" class="bm" d=""/><g id="bpil"></g></svg>
  <div class="words" id="words" aria-hidden="true"></div>
  <h1 class="mega" aria-label="КӨПҮРӨ">КӨПҮРӨ</h1><p class="subt" data-ky="Эки тил. Бир мектеп.">Два языка. Одна школа.</p>
  <p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'lang', title: 'Русский ⇄ Кыргызча', lead: 'Переключите язык и посмотрите, как меняется интерфейс. Фразы ниже — настоящие пары из приложения.', html: `<div class="demo"><span class="tag">Переключатель</span><div class="lsw"><button class="btn" id="lgb" type="button" aria-pressed="false">Русский → Кыргызча</button></div><div class="uil" id="uil"></div>
      <p class="note"><b>Важно:</b> кыргызский перевод пока в черновом варианте — около 500 фраз ждут вычитки носителем языка. Мы не утверждаем, что он завершён.</p><p class="note">Политика обработки данных теперь тоже на двух языках.</p></div>` },
    { id: 'code', title: 'Код из письма', lead: 'Подтверждение почты шестизначным кодом: нажмите «Отправить код», затем введите его (демо принимает любые шесть цифр).', html: `<div class="demo"><span class="tag">Демо</span><div class="codebox"><button class="btn" id="sendc" type="button">Отправить код</button><div class="digits" id="dg" aria-live="polite"></div><label class="sr" for="ci">Код</label><input id="ci" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" disabled><p class="note" id="cmsg" role="status"></p><div class="row2"><button class="btn ghost" id="resc" type="button" disabled>Повторить через 60 с</button><span class="note" id="strict">Строгий режим школы и проверка фото на сервере защищают регистрацию дополнительно.</span></div></div></div>
    <div class="demo" style="margin-top:20px"><span class="tag">Исправлено</span><div class="fixd"><b>Новый ученик больше не исчезает из списка.</b><p class="muted">Раньше только что добавленного ученика могло не оказаться в списке из-за совпадения по времени двух действий. Теперь список обновляется правильно. Для надёжности добавлен набор автоматических проверок.</p></div></div>` },
  ],
  finale: `<svg class="fb" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 200 C 200 20 400 20 500 20 C 600 20 800 20 1000 200" /></svg>`,
};
