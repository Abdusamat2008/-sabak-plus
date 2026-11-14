export default {
  hero: `<div class="tall" id="h3" style="--h:300vh;--hm:240vh"><div class="stick"><canvas id="net" aria-hidden="true"></canvas>
  <div class="ht"><p class="eyebrow">SABAK+ · 0.3</p><h1 class="mega" aria-label="ИШЕНИМ">ИШЕНИМ</h1><p class="subt" data-ky="Аккаунттар, мектептер, ролдор — чыныгы система" >Аккаунты, школы, роли — настоящая система</p></div>
  <ul class="legend" aria-hidden="true"><li><i style="--c:#8ab4ff"></i>Ученик</li><li><i style="--c:#ffd479"></i>Родитель</li><li><i style="--c:#7ee0c0"></i>Учитель</li><li><i style="--c:#ff9bd0"></i>Администрация</li></ul>
  <p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'chain', title: 'Цепочка доверия', lead: 'Как человек попадает в школу: каждый шаг подтверждает предыдущий. Нажимайте «Дальше».', html: `<div class="demo"><span class="tag">Схема</span><svg class="chain" viewBox="0 0 900 150" role="img" aria-label="Цепочка доверия из пяти шагов"><path class="cl" d="M70 70H830"/><path class="clp" id="clp" d="M70 70H830"/><g id="cn"></g></svg>
      <div class="cinfo" aria-live="polite"><h3 id="ct"></h3><p id="cd"></p></div><div class="cbtns"><button class="btn ghost" id="cprev" type="button">← Назад</button><button class="btn" id="cnext" type="button">Дальше →</button></div></div>` },
    { id: 'roles', title: 'Роли и доступ', lead: 'Наведите курсор или коснитесь роли — увидите, что ей доступно. Эти правила записаны в самой базе данных.', html: `<div class="demo"><span class="tag">Роли</span><div class="rolesw"><div class="rbtns" id="rb" role="tablist" aria-label="Роль"></div><div class="rinfo" id="ri" role="tabpanel" aria-live="polite"></div></div></div>
      <div class="demo steps4" style="margin-top:22px"><span class="tag">Вход</span><h3>Регистрация в четыре шага</h3><ol class="rg" id="rg"></ol><p class="note" id="rgn"></p><p class="note">Есть и восстановление пароля: письмо со ссылкой на почту. Если связи нет, приложение копит изменения и отправит их сами, когда интернет вернётся.</p></div>
      <div class="demo an" style="margin-top:22px"><span class="tag">DEMO-данные</span><h3>Аналитика для администрации</h3><div class="bars" id="bars"></div><p class="note">Показатели — вымышленные, для примера. Настоящую аналитику (успеваемость, качество знаний, СОУ, тренды, выбросы) можно выгрузить в Excel, Word и PDF.</p></div>` },
  ],
  finale: `<canvas id="net2" aria-hidden="true" class="fnet"></canvas>`,
};
