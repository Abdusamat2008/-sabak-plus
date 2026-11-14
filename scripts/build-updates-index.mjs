// Собирает updates.html (оглавление хроники) из js/chron/chapters.js. Запуск: node scripts/build-updates-index.mjs
import fs from 'node:fs';
import { CHAPTERS } from '../js/chron/chapters.js';
const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let head = fs.readFileSync(new URL('./_upd_head.html', import.meta.url), 'utf8'), tail = fs.readFileSync(new URL('./_upd_tail.html', import.meta.url), 'utf8');
const cards = CHAPTERS.map((c, i) => `<li class="chp rv" style="--a:${c.accent};--b:${c.bg};--k:${c.ink}"><a href="/updates/${c.slug}"><span class="n">${e(c.ver)}</span><b>${e(c.name)}</b><span class="t">${e(c.ru)}</span><time>${e(c.date)}</time></a></li>`).join('\n');
const main = `<main id="main"><section class="pg"><div class="wrap">
  <p class="eyebrow rv">Хроника</p>
  <h1 class="mega rv d1">Пятнадцать <span class="grad">глав</span> SABAK+</h1>
  <p class="lead rv d2">От первого прототипа журнала до щита данных. Каждая версия рассказана отдельной страницей: листайте, пробуйте и смотрите, что изменилось и зачем.</p>
  <ol class="chlist">${cards}</ol>
</div></section></main>`;
fs.writeFileSync(new URL('../updates.html', import.meta.url), head + main + tail);
console.log('updates.html:', CHAPTERS.length, 'глав');
