// Движок хроник SABAK+: прогресс прокрутки, сцены, появление, слова, язык, переходы. Без внешних библиотек.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const H = document.documentElement, store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lite = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 2;
const rm = () => H.classList.contains('rm');
function applyMotion() { const off = store.get('chron.motion') === 'off' || mq.matches; H.classList.toggle('rm', off); const b = $('[data-motion]'); if (b) { b.setAttribute('aria-pressed', String(!off)); b.textContent = (off ? '◻ ' : '◼ ') + tr(off ? 'Анимации: выкл' : 'Анимации: вкл', off ? 'Анимация: өчүк' : 'Анимация: күйүк'); } }
let lang = store.get('chron.lang') === 'ky' ? 'ky' : 'ru';
const tr = (ru, ky) => lang === 'ky' ? ky : ru;
function applyLang() {
  H.lang = lang; $$('[data-ky]').forEach(e => { if (e.dataset.ru === undefined) e.dataset.ru = e.innerHTML; e.innerHTML = lang === 'ky' ? e.dataset.ky : e.dataset.ru; });
  const t = $('title'); if (t && t.dataset.ky) { if (!t.dataset.ru) t.dataset.ru = t.textContent; t.textContent = lang === 'ky' ? t.dataset.ky : t.dataset.ru; }
  const b = $('[data-lang]'); if (b) b.textContent = lang === 'ky' ? 'РУ' : 'КЫ'; $$('[data-split][data-ky]').forEach(e => { delete e.dataset.done; split(e); e.classList.add('in'); }); applyMotion(); document.dispatchEvent(new CustomEvent('chron:lang', { detail: lang }));
}
// ---- цикл анимации: работает только пока элемент виден ----
const loops = new Map(); let raf = 0, last = 0;
const vis = new IntersectionObserver(es => es.forEach(e => { const l = loops.get(e.target); if (l) { l.on = e.isIntersecting; kick(); } }), { rootMargin: '80px' });
function frame(t) { raf = 0; const dt = Math.min(64, t - last || 16); last = t; let any = false; loops.forEach(l => { if (l.on) { any = true; l.fn(dt, t / 1000); } }); if (any && !document.hidden) raf = requestAnimationFrame(frame); }
function kick() { if (!raf && !rm() && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
document.addEventListener('visibilitychange', kick);
function loop(el, fn) { if (rm()) { fn(16, 0, true); return () => {}; } loops.set(el, { fn, on: false }); vis.observe(el); return () => { loops.delete(el); vis.unobserve(el); }; }
// ---- сцены, привязанные к прокрутке ----
const scenes = []; let sTick = 0;
function scene(el, cb) { const s = { el, cb, last: -1, on: false }; scenes.push(s); sio.observe(el); if (rm()) cb(1, el); else { s.on = true; run(s); } return s; }
const sio = new IntersectionObserver(es => es.forEach(e => { const s = scenes.find(x => x.el === e.target); if (s) { s.on = e.isIntersecting; if (s.on) run(s); } }), { rootMargin: '30% 0px' });
function prog(el) { const r = el.getBoundingClientRect(), vh = innerHeight, tallEl = el.classList.contains('tall'); return tallEl ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh + r.height)); }
function run(s) { const p = rm() ? 1 : prog(s.el); if (Math.abs(p - s.last) > .0004) { s.last = p; s.el.style.setProperty('--p', p.toFixed(4)); s.cb(p, s.el); } }
function onScroll() { if (sTick) return; sTick = requestAnimationFrame(() => { sTick = 0; const m = document.documentElement.scrollHeight - innerHeight; H.style.setProperty('--sp', m > 0 ? (scrollY / m).toFixed(4) : 0); if (!rm()) scenes.forEach(s => s.on && run(s)); }); }
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', () => { scenes.forEach(s => s.last = -1); onScroll(); });
// ---- появление и слова ----
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
function split(el) { if (el.dataset.done) return; el.dataset.done = 1; const walk = n => { [...n.childNodes].forEach(c => { if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) f.append(' '); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; f.append(s); } }); c.replaceWith(f); } else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c); }); }; walk(el); $$('.w', el).forEach((w, i) => w.style.setProperty('--i', i)); }
function counters(root = document) { $$('[data-count]', root).forEach(el => { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), d = 1400, t0 = performance.now(); const st = t => { const k = rm() ? 1 : clamp((t - t0) / d); el.textContent = (to * ease(k)).toFixed(dec).replace('.', ','); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); } }, { threshold: .5 }); io.observe(el); }); }
// ---- канвас с ограничением плотности ----
function fit(c, max = 2) { const x = c.getContext('2d'); const f = () => { const d = Math.min(devicePixelRatio || 1, lite ? 1.5 : max), r = c.getBoundingClientRect(); c.width = Math.max(1, r.width * d); c.height = Math.max(1, r.height * d); x.setTransform(d, 0, 0, d, 0, 0); c.w = r.width; c.h = r.height; }; f(); new ResizeObserver(f).observe(c); return x; }
const cssv = n => getComputedStyle(document.body).getPropertyValue(n).trim();
// ---- переходы между главами ----
function transitions() {
  const x = $('#xt'); if (!x) return;
  if (x.classList.contains('nt')) requestAnimationFrame(() => requestAnimationFrame(() => { x.classList.remove('nt'); x.classList.remove('cov'); }));
  addEventListener('pageshow', e => { if (e.persisted) x.classList.remove('cov', 'run'); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-xt]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (rm()) return; e.preventDefault();
    x.className = 'xt-' + a.dataset.xt + ' run'; x.style.setProperty('--xt', a.dataset.xtc || '#000'); void x.offsetWidth; x.classList.add('cov');
    store.set('chron.x', '1'); try { sessionStorage.setItem('chron.xt', '1'); } catch {}
    setTimeout(() => { location.href = a.href; }, 760);
  });
  const pre = e => { const a = e.target.closest && e.target.closest('a[data-xt]'); if (a && !a.dataset.pf) { a.dataset.pf = 1; const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l); } };
  document.addEventListener('pointerover', pre); document.addEventListener('touchstart', pre, { passive: true });
}
// ---- «показать» из списка функций ----
function links() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a.see'); if (!a) return; const t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return; e.preventDefault();
    t.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'center' }); t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse'); setTimeout(() => t.classList.remove('pulse'), 1500);
  });
}
export const ctx = { $, $$, clamp, lerp, ease, lite, rm, loop, scene, split, counters, fit, cssv, tr, lang: () => lang, store };
async function boot() {
  applyMotion(); applyLang();
  $('[data-lang]')?.addEventListener('click', () => { lang = lang === 'ky' ? 'ru' : 'ky'; store.set('chron.lang', lang); applyLang(); });
  $('[data-motion]')?.addEventListener('click', () => { store.set('chron.motion', rm() ? 'on' : 'off'); applyMotion(); location.reload(); });
  mq.addEventListener?.('change', applyMotion);
  H.classList.add('js'); $$('.rv').forEach(e => rio.observe(e)); $$('[data-split]').forEach(e => { split(e); rio.observe(e); }); counters(); transitions(); links(); onScroll();
  const cur = $('.rail a[aria-current]'); if (cur) cur.scrollIntoView?.({ block: 'nearest' });
  const id = document.body.dataset.ch;
  try { const m = await import(`/js/chron/c${id}.js`); await m.default(ctx); } catch (e) { console.error('chapter init failed', e); }
  applyLang(); onScroll();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
