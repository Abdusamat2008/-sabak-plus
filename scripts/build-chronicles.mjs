// Собирает 15 страниц глав /updates/<slug> и центральную страницу /updates. Запуск: node scripts/build-chronicles.mjs
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CH, UI, LABELS } from './chron/data.mjs';
const COL = { paper:'#f1ead9', dusk:'#14182c', navy:'#060d1f', lapis:'#0f1a38', gold:'#1a1408', light:'#fbfbfd', bronze:'#1b130c', command:'#05080f', felt:'#2a0f12', cobalt:'#0a1f6b', fintech:'#0a0a0c', chronicle:'#efe6d2', speed:'#03060c', steel:'#12151a', shield:'#07101a' };
const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const X = 'https://sabak-plus.vercel.app';
const ky = (ru, k) => `data-ky="${e(k)}"`; // KY-вариант хранится в атрибуте, RU — в разметке
const u = k => `<span data-ky="${e(UI.ky[k])}">${UI.ru[k]}</span>`;
const xl = c => `href="/updates/${c.slug}" data-xt="${c.xt}" data-xtc="${COL[c.theme]}"`;
const verName = c => `${c.v} — ${c.name}`;
const rail = cur => `<nav class="rail" aria-label="Все главы">${CH.map(c => `<a ${xl(c)} ${c === cur ? 'aria-current="page"' : ''}><span>${c.v} — ${c.name}</span><i class="sr">${c.v} ${c.name}</i></a>`).join('')}</nav>`;
const xtHtml = c => `<div id="xt" class="xt-${c.xt}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><script>try{if(sessionStorage.getItem('chron.xt')){var x=document.getElementById('xt');x.className+=' cov nt';x.style.setProperty('--xt','${COL[c.theme]}');sessionStorage.removeItem('chron.xt')}}catch(e){}</script>`;
const bar = (c, n) => `<a class="skip" href="#main" ${ky('', UI.ky.skip)}>${UI.ru.skip}</a><div class="prog" aria-hidden="true"></div>
<header class="cbar"><a class="logo" href="/" aria-label="SABAK+">SABAK<b>+</b></a><span class="cn">${n}</span><a class="cb allb" href="/updates" ${c ? `data-xt="slide" data-xtc="#000"` : ''}>${u('all')}</a><button class="cb" data-motion type="button" aria-pressed="true">◼ Анимации: вкл</button><button class="cb" data-lang type="button" aria-label="Русский / Кыргызча">КЫ</button></header>`;
const headCommon = (title, titleKy, desc, path, css) => `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-ky="${e(titleKy)}">${e(title)}</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${X}${path}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#000000">
<meta property="og:type" content="article"><meta property="og:site_name" content="SABAK+"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${X}${path}"><meta property="og:image" content="${X}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/css/chron.css">${css.map(h => `<link rel="stylesheet" href="${h}">`).join('')}
</head>`;
const featBlock = (c, kind) => {
  const L = c.feats.filter(f => f[0] === kind); if (!L.length) return '';
  const h = { add: 'added', chg: 'changed', fix: 'fixed' }[kind];
  return `<div class="grp rv"><h3>${u(h)} <i>${L.length}</i></h3><ol class="fl">${L.map(f => `<li id="f-${c.n}-${c.feats.indexOf(f) + 1}"><span>${e(f[1])}</span>${f[2] ? `<a class="see" href="#sc-${f[2]}" aria-label="${e(UI.ru.see)}: ${e(f[1])}"><span data-ky="${e(UI.ky.see)}">${UI.ru.see}</span> ↓</a>` : '<i></i>'}</li>`).join('')}</ol></div>`;
};
async function chapter(c, i) {
  const f = `./chron/ch/${c.n}.mjs`; if (!existsSync(new URL(f, import.meta.url))) return false;
  const m = (await import(pathToFileURL(new URL(f, import.meta.url).pathname))).default;
  const prev = CH[i - 1], next = CH[i + 1], ids = new Set(['hero', ...m.scenes.map(s => s.id)]);
  for (const ft of c.feats) if (ft[2] && !ids.has(ft[2])) throw new Error(`${c.n}: сцена «${ft[2]}» не найдена`);
  const css = ['/css/chron/' + c.n + '.css'], path = '/updates/' + c.slug;
  const html = `${headCommon(`SABAK+ ${verName(c)} — ${c.title}`, `SABAK+ ${verName(c)}`, `${c.tag}. ${c.title}. Версия ${c.v}, ${c.date}.`, path, css)}
<body class="ch t-${c.theme}" data-ch="${c.n}" data-xt="${c.xt}">
${xtHtml(c)}${bar(c, `${UI.ru.chapter} ${c.n} ${UI.ru.of} 15`)}${rail(c)}
<main id="main">
<section class="hero sc" id="sc-hero" aria-label="${e(verName(c))}">${m.hero}</section>
<section class="story pad"><div class="wrap">
  <div class="vmeta rv"><span class="vb">${e(verName(c))}</span><time>${e(c.date)}</time><span class="muted">${u('chapter')} ${c.n} ${u('of')} 15</span></div>
  <h2 class="eyebrow rv">${u('story')}</h2><p class="st" data-split ${c.storyKy ? ky('', c.storyKy) : ''}>${e(c.story)}</p>
</div></section>
${m.scenes.map(s => `<section class="sc ${s.cls || ''}" id="sc-${s.id}" aria-labelledby="h-${s.id}">${s.full ? s.html : `<div class="wrap pad"><div class="sechead rv"><p class="eyebrow">${s.eyebrow || u('demo')}</p><h2 class="h2" id="h-${s.id}">${s.title}</h2>${s.lead ? `<p class="lead">${s.lead}</p>` : ''}</div>${s.html}</div>`}</section>`).join('\n')}
<section class="feats pad"><div class="wrap narrow">${featBlock(c, 'add')}${featBlock(c, 'chg')}${featBlock(c, 'fix')}<p class="note kynote">${UI.ky.kyNote}</p></div></section>
<section class="final sc" id="sc-final" aria-label="${e(c.finalRu)}">${m.finale || ''}<div class="wrap" style="position:relative;z-index:2"><p class="fq rv" ${ky('', c.final)}>«${e(c.final)}»</p><p class="fr rv d1">${e(c.finalRu)}</p></div></section>
</main>
<nav class="pn" aria-label="Навигация между версиями">
${prev ? `<a ${xl(prev)} rel="prev"><small>← ${u('prev')}</small><b>${prev.v} — ${prev.name}</b><span>${e(prev.title)}</span></a>` : `<a href="/updates" data-xt="slide" data-xtc="#000"><small>← ${u('first')}</small><b>${u('all')}</b></a>`}
${next ? `<a ${xl(next)} rel="next"><small>${u('next')} →</small><b>${next.v} — ${next.name}</b><span>${e(next.title)}</span></a>` : `<a href="/updates" data-xt="slide" data-xtc="#000"><small>${u('end')} →</small><b>${u('all')}</b></a>`}
</nav>
<footer class="foot2"><a href="/">SABAK+</a><a href="/app?demo=1">Демо</a><a href="/connect">Подключить школу</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></footer>
<script type="module" src="/js/chron/core.js"></script>
</body>
</html>
`;
  writeFileSync(`updates/${c.slug}.html`, html); return true;
}
async function hub() {
  const css = ['/css/chron/hub.css'];
  const html = `${headCommon('Обновления SABAK+ — хроники версий', 'SABAK+ жаңыртуулары — версиялардын хроникасы', 'Пятнадцать глав истории SABAK+: от первого прототипа электронного журнала до надёжной платформы для школ Кыргызстана.', '/updates', css)}
<body class="ch hub t-command" data-ch="hub" data-xt="slide">
${bar(null, '15 / 15')}
<main id="main">
<section class="hhero"><div class="wrap"><p class="eyebrow rv">SABAK+ · Хроники</p><h1 class="mega" data-split data-ky="Версиялардын хроникасы">Хроники версий</h1><p class="lead rv d2" data-ky="Пятнадцать глав — пятнадцать характеров. Каждая версия SABAK+ рассказана как отдельная история.">Пятнадцать глав — пятнадцать характеров. Каждая версия SABAK+ рассказана как отдельная история.</p><p class="note kynote">${UI.ky.kyNote}</p></div></section>
<section class="hroad" aria-label="Все главы"><ol class="cards">${CH.map(c => `<li id="v${c.v.replace(/\./g, '-')}" style="--cb:${COL[c.theme]}" class="t-${c.theme}"><a ${xl(c)}><span class="cn">${c.n}</span><span class="cv">${c.v}</span><b class="cname" data-ky="${e(c.name)}">${c.name}</b><em data-ky="${e(c.tagKy)}">${e(c.tag)}</em><small>${e(c.date)} · ${e(c.title)}</small><span class="go">→</span></a></li>`).join('')}</ol></section>
<section class="hmore"><div class="wrap"><p class="muted">Хотите подключить свою школу? <a href="/connect">Оставьте заявку</a>. Или <a href="/app?demo=1">откройте демо</a>.</p></div></section>
</main>
<footer class="foot2"><a href="/">SABAK+</a><a href="/connect">Подключить школу</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a></footer>
<div id="xt" class="xt-slide" aria-hidden="true"><i></i></div>
<script>(function(){var m=location.hash.match(/^#v(0-\\d+(?:-\\d+)?)$/);if(m){var t=document.getElementById('v'+m[1]);if(t){var a=t.querySelector('a');if(a)location.replace(a.getAttribute('href'))}}})()</script>
<script type="module" src="/js/chron/core.js"></script>
</body>
</html>
`;
  writeFileSync('updates.html', html);
}
let built = 0; for (let i = 0; i < CH.length; i++) if (await chapter(CH[i], i)) built++;
await hub(); console.log('глав собрано:', built, '/ 15');
