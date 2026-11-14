import { horn } from '../orn.mjs';
export default {
  hero: `<div class="tall" id="h10" style="--h:300vh;--hm:240vh"><div class="stick"><canvas id="wv" aria-hidden="true"></canvas>
  <div class="ht"><p class="eyebrow">SABAK+ · 0.9 · Үн 2.0</p><h1 class="mega" aria-label="ҮН">ҮН</h1><p class="subt"><span data-ky="Ар бир үн маанилүү">Ар бир үн маанилүү</span> <em data-ky="— каждый голос важен">— каждый голос важен</em></p></div>
  <div class="paperf" aria-hidden="true"><i>Вопрос</i><i>Идея</i><i>Честно</i></div><p class="hint" aria-hidden="true"><span data-ky="жылдырыңыз">листайте</span> ↓</p></div></div>`,
  scenes: [
    { id: 'board', title: 'Кобальтовая доска «Үн»', lead: 'Ищите, фильтруйте по тегам и разделам, сохраняйте в закладки, пишите посты — черновик сохраняется сам.', html: `<div class="demo bd"><span class="tag">Прототип</span><div class="bdbar"><div class="eq" aria-hidden="true">${'<i></i>'.repeat(9)}</div><label class="sr" for="sq">Поиск</label><input id="sq" type="search" placeholder="Поиск по словам, тегам и людям"></div>
      <div class="daily"><small>Тема дня</small><b>Какой урок вы запомнили больше всего и почему?</b></div>
      <div class="tabs9" id="tb9" role="tablist"></div><div class="tags9" id="tg9" aria-label="Популярные темы"></div>
      <div class="comp9"><label class="sr" for="nt">Новый пост</label><textarea id="nt" rows="2" maxlength="140" placeholder="Что хотите сказать? Можно #тегами"></textarea><div class="row"><span class="kinds" id="kd"></span><span class="grow"></span><svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle id="rg" cx="18" cy="18" r="15"/></svg><span id="rc" class="rc">140</span><button class="btn" id="np" type="button">Опубликовать</button></div><p class="note" id="dn" role="status"></p></div>
      <div class="board" id="bo"></div><p class="note">Анонимные публикации — тёмные листки с сиреневым свечением, официальные — шафрановые. Класс ученика по-прежнему не отображается.</p></div>` },
    { id: 'echo', title: 'Эхо вместо лайков', lead: 'Нажмите на кнопку — от неё расходятся круги, как звук. Эхо доступно постам и комментариям.', html: `<div class="demo ech"><span class="tag">Эхо</span><canvas id="ec" aria-hidden="true"></canvas><div class="ecc"><p>Пост: «Давайте проведём вечер настольных игр!»</p><button class="echo" id="eb" type="button" aria-pressed="false"><span>◉</span> Эхо <b id="en">12</b></button><p class="cm9">↳ Комментарий: «Я за!» <button class="echo sm" id="eb2" type="button" aria-pressed="false">◉ <b id="en2">3</b></button></p></div></div>` },
    { id: 'poll', title: 'Опросы с анонимным голосом', lead: 'До 5 вариантов, один голос на человека, результаты видны сразу, а кто как голосовал — нет.', html: `<div class="demo pl"><span class="tag">Опрос</span><h3>Что добавить на школьный праздник?</h3><div class="opts9" id="po"></div><p class="note" id="pn9" role="status">Выберите вариант — голос только один.</p></div>` },
  ],
  finale: `<div class="fwave" aria-hidden="true">${horn('hw', 2)}<i></i><i></i><i></i></div>`,
};
