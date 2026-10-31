// Специальные возможности: контраст, размер и интервалы текста, облегчённый вид, анимации, озвучка.
// Настройки хранятся на устройстве (prefs) и применяются атрибутами на <html> — CSS в css/a11y.css.
import * as S from './store.js';
import { esc, ui } from './common.js';

export const DEFAULTS = { scale: 1, contrast: 'std', simple: false, motion: 'auto', spacing: 0, font: 'std', links: false, large: false, cb: false };
const SCALES = [1, 1.125, 1.25, 1.5, 1.75, 2];
const THEMES = [
  ['std', 'Стандартная', 'Бумажный стиль SABAK+', ['#EEEAE2', '#0B0B0B', '#2352D8']],
  ['hcl', 'Контрастная светлая', 'Чёрное на белом, толстые рамки', ['#FFFFFF', '#000000', '#0022B8']],
  ['dark', 'Тёмная', 'Светлый текст, меньше слепит', ['#16181D', '#F1F3F7', '#8DB0FF']],
  ['yb', 'Жёлтое на чёрном', 'Максимум для слабого зрения', ['#000000', '#FFE600', '#00E5FF']],
];
const PRESETS = [
  ['low', 'Слабое зрение', { contrast: 'yb', scale: 1.5, links: true, large: true, spacing: 1 }],
  ['dys', 'Дислексия', { font: 'dys', spacing: 2, simple: true, scale: 1.25 }],
  ['calm', 'Спокойный режим', { simple: true, motion: 'off', contrast: 'std' }],
  ['reset', 'Сбросить всё', { ...DEFAULTS }],
];

export function norm(p) {
  const c = p.contrast === true ? 'hcl' : (!p.contrast ? 'std' : p.contrast);
  return { ...DEFAULTS, ...p, contrast: THEMES.some(t => t[0] === c) ? c : 'std' };
}
const osReduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export function motionOff(p) { return p.motion === 'off' || (p.motion === 'auto' && osReduce()); }

export function apply(raw) {
  const p = norm(raw), h = document.documentElement;
  h.style.fontSize = (p.scale * 100) + '%';
  h.dataset.contrast = p.contrast; h.dataset.simple = p.simple ? 'on' : 'off'; h.dataset.spacing = String(p.spacing);
  h.dataset.font = p.font; h.dataset.links = p.links ? 'on' : 'off'; h.dataset.large = p.large ? 'on' : 'off'; h.dataset.cb = p.cb ? 'on' : 'off';
  h.dataset.motion = motionOff(p) ? 'reduced' : 'full';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = { std: '#0B0B0B', hcl: '#FFFFFF', dark: '#0c0d10', yb: '#000000' }[p.contrast];
}

const sw = (k, on, title, hint) => `<button class="a11y-sw" role="switch" aria-checked="${on}" data-act="a11y-tog" data-k="${k}"><span>${title}${hint ? `<small>${hint}</small>` : ''}</span><i></i></button>`;
const opt = (k, v, on, title, hint = '', extra = '') => `<button class="a11y-opt" aria-pressed="${on}" data-act="a11y-set" data-k="${k}" data-v="${v}"><b>${title}</b>${hint ? `<small>${hint}</small>` : ''}${extra}</button>`;

export function fab() { return `<button class="a11y-fab" data-act="a11y" aria-label="Специальные возможности (Alt+A)" title="Специальные возможности"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M4 8.5l8 1.5 8-1.5M12 10v5M12 15l-3.5 6M12 15l3.5 6"/></svg></button>`; }

export function panel() {
  if (!ui.a11y) return '';
  const p = norm(S.state().prefs), i = SCALES.findIndex(x => x >= p.scale - .001);
  return `<div class="a11y-bg" data-act="a11y-close"></div>
  <aside class="a11y-panel" role="dialog" aria-modal="true" aria-labelledby="a11yT" data-notr="1">
    <h2 id="a11yT">Специальные возможности <button class="ibtn" data-act="a11y-close" aria-label="Закрыть" id="a11yX">✕</button></h2>
    <p class="lead">Настройки сохраняются на этом устройстве и действуют на всех экранах, в том числе до входа. Открыть панель: Alt+A.</p>
    <h3>Быстрые профили</h3>
    <div class="a11y-grid">${PRESETS.map(([id, n]) => `<button class="a11y-opt" data-act="a11y-preset" data-id="${id}"><b>${n}</b></button>`).join('')}</div>
    <h3>Контраст и цвет</h3>
    <div class="a11y-grid">${THEMES.map(([id, n, h, c]) => opt('contrast', id, p.contrast === id, n, h, `<span class="sw-demo">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>`)).join('')}</div>
    ${sw('cb', p.cb, 'Палитра для дальтоников', 'Оценки различаются по цвету и по цифре; цвета заменены на безопасные')}
    <h3>Размер текста</h3>
    <div class="a11y-step"><button data-act="a11y-size" data-d="-1" aria-label="Меньше">А−</button><output aria-live="polite">${Math.round(p.scale * 100)}%</output><button data-act="a11y-size" data-d="1" aria-label="Больше">А+</button></div>
    <h3>Шрифт и интервалы</h3>
    <div class="a11y-grid">${opt('font', 'std', p.font === 'std', 'Обычный')}${opt('font', 'read', p.font === 'read', 'Чёткий', 'Verdana, плотнее')}${opt('font', 'dys', p.font === 'dys', 'Для дислексии', 'Читаемые формы букв')}</div>
    <div class="a11y-grid" style="margin-top:8px">${[0, 1, 2].map(n => opt('spacing', n, p.spacing === n, ['Интервалы: обычные', 'Интервалы: шире', 'Интервалы: максимум'][n])).join('')}</div>
    <h3>Облегчённый вид и управление</h3>
    ${sw('simple', p.simple, 'Облегчённый вид', 'Одна колонка, крупный текст, без декора и теней, подписи у меню')}
    ${sw('large', p.large, 'Крупные кнопки', 'Удобнее попадать пальцем и при треморе')}
    ${sw('links', p.links, 'Подчёркивать ссылки')}
    ${sw('motion', motionOff(p), 'Без анимации', p.motion === 'auto' && osReduce() ? 'Включено по настройке системы' : 'Отключает движение и конфетти')}
    <h3>Озвучка</h3>
    <div class="a11y-foot"><button class="btn blue" data-act="a11y-speak">${ui.speaking ? '■ Остановить' : '▶ Прочитать страницу вслух'}</button></div>
    <p class="lead" style="margin-top:6px">Используется голос вашего устройства.</p>
    <div class="a11y-sample"><b>Пример текста</b><br>Так будут выглядеть заголовки, текст и ссылки с выбранными настройками. <a href="#/">Ссылка</a></div>
  </aside>`;
}

export function open() { ui.a11y = true; }
export function close() { ui.a11y = false; stopSpeak(); }
export function stopSpeak() { try { speechSynthesis.cancel(); } catch {} ui.speaking = false; }
export function speak(lang) {
  if (!('speechSynthesis' in window)) return false;
  if (ui.speaking) { stopSpeak(); return true; }
  const el = document.getElementById('main'); if (!el) return false;
  const u = new SpeechSynthesisUtterance(el.innerText.replace(/\s+/g, ' ').slice(0, 4000));
  u.lang = lang === 'ky' ? 'ru-RU' : 'ru-RU'; u.onend = u.onerror = () => { ui.speaking = false; if (window.__render) window.__render(); };
  ui.speaking = true; speechSynthesis.speak(u); return true;
}

// true — событие обработано
export function act(act, el) {
  const st = S.state(), p = norm(st.prefs);
  if (act === 'a11y') { ui.a11y = !ui.a11y; ui.menu = false; window.__render(); setTimeout(() => { const x = document.getElementById('a11yX'); if (x) x.focus(); }, 30); return true; }
  if (act === 'a11y-close') { close(); window.__render(); setTimeout(() => { const b = document.querySelector('[data-act=a11y]'); if (b) b.focus(); }, 30); return true; }
  if (act === 'a11y-set') { const k = el.dataset.k, v = el.dataset.v; S.setPrefs({ [k]: k === 'spacing' ? Number(v) : v }); return true; }
  if (act === 'a11y-tog') { const k = el.dataset.k; if (k === 'motion') S.setPrefs({ motion: motionOff(p) ? 'on' : 'off' }); else S.setPrefs({ [k]: !p[k] }); return true; }
  if (act === 'a11y-size') { const i = SCALES.findIndex(x => x >= p.scale - .001), n = Math.max(0, Math.min(SCALES.length - 1, i + Number(el.dataset.d))); S.setPrefs({ scale: SCALES[n] }); return true; }
  if (act === 'a11y-preset') { const pr = PRESETS.find(x => x[0] === el.dataset.id); if (pr) S.setPrefs({ ...DEFAULTS, ...pr[2] }); return true; }
  if (act === 'a11y-speak') { speak(st.prefs.lang); window.__render(); return true; }
  return false;
}

// ---- анимации ----
export function enter(prefs) {   // вызывать при смене маршрута
  if (motionOff(norm(prefs))) return;
  document.body.dataset.enter = '1'; clearTimeout(enter.t); enter.t = setTimeout(() => { delete document.body.dataset.enter; }, 900);
  countUp();
}
export function countUp() {
  document.querySelectorAll('#main .big').forEach(el => {
    const n = el.firstChild; if (!n || n.nodeType !== 3) return;
    const m = n.nodeValue.trim().match(/^(\d+)([.,](\d+))?$/); if (!m) return;
    const end = parseFloat(n.nodeValue.replace(',', '.')), dec = m[3] ? m[3].length : 0, sep = n.nodeValue.includes(',') ? ',' : '.', t0 = performance.now(), D = 700;
    const tick = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); n.nodeValue = (end * e).toFixed(dec).replace('.', sep); if (k < 1) requestAnimationFrame(tick); else n.nodeValue = m[0]; };
    requestAnimationFrame(tick);
  });
}
export function confetti(prefs) {
  if (motionOff(norm(prefs))) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#2352D8', '#1F9D6B', '#E2A33B', '#D6443F', '#8A3FD1', '#fff'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function loop() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .38; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); g.restore(); });
    if (++f < 150) requestAnimationFrame(loop); else c.remove();
  })();
}
document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'a' || e.key === 'ф' || e.key === 'A')) { e.preventDefault(); ui.a11y = !ui.a11y; window.__render && window.__render(); } if (e.key === 'Escape' && ui.a11y) { close(); window.__render(); } });
