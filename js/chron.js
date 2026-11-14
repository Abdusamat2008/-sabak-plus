// Ядро хроники SABAK+: прогресс, меню глав, переходы-«занавесы», переключатель языка, помощники прокрутки.
// Страница главы подключает: import { Chron } from '/js/chron.js'; Chron.init('<slug>');
import { CHAPTERS, bySlug, idx, href } from '/js/chron/chapters.js';

const mq = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const scrubs = [], langCbs = [];
let ticking = false, ch = null, lang = 'ru';

export const Chron = {
  CHAPTERS, clamp, esc, $, $$,
  get reduced() { return mq.matches || document.body.classList.contains('rm'); },
  lerp: (a, b, t) => a + (b - a) * t,
  ease: { out: t => 1 - Math.pow(1 - t, 3), inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), spring: t => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6) },
  lang: () => lang,
  /** Текст на выбранном языке: say('русский', 'кыргызча') */
  say: (ru, ky) => (lang === 'ky' && ky ? ky : ru),
  onLang: cb => { langCbs.push(cb); },

  /** Колбэк p∈[0,1]: 0 — элемент только входит снизу экрана, 1 — полностью ушёл вверх. В режиме без анимации вызывается один раз с p=final. */
  scrub(el, cb, final = 1) {
    if (!el) return; const s = { el, cb, mode: 'pass', final }; scrubs.push(s); if (this.reduced) cb(final, el); else schedule();
    return s;
  },
  /** Для высокой секции с липкой сценой внутри: p∈[0,1] — прогресс прокрутки внутри секции. */
  pin(section, cb, final = 1) {
    if (!section) return; const s = { el: section, cb, mode: 'pin', final }; scrubs.push(s); if (this.reduced) cb(final, section); else schedule();
    return s;
  },
  /** Цикл анимации, который работает только пока элемент виден и вкладка открыта. cb(dt, t). Возвращает stop(). */
  loop(el, cb) {
    let on = false, raf = 0, last = 0, stopped = false;
    const step = t => { if (!on || stopped) return; const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; cb(dt, t / 1000); raf = requestAnimationFrame(step); };
    const start = () => { if (!on && !stopped && !document.hidden) { on = true; last = performance.now(); raf = requestAnimationFrame(step); } };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { threshold: 0 }).observe(el);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    return () => { stopped = true; stop(); };
  },
  /** Плавное появление блоков .cr; без анимации сразу видимы. */
  reveal(root = document) {
    const els = $$('.cr', root); if (this.reduced) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(e => io.observe(e));
  },
  /** Счётчик: от 0 до n за ms. */
  count(el, n, ms = 1200, fmt = v => Math.round(v)) {
    if (this.reduced) { el.textContent = fmt(n); return; }
    const t0 = performance.now(); const f = t => { const k = clamp((t - t0) / ms); el.textContent = fmt(n * this.ease.out(k)); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f);
  },
  /** Кошкар-муйуз (бараньи рога) — одно SVG-украшение. */
  horn(size = 64, stroke = 'currentColor', w = 2.2) {
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" aria-hidden="true"><path d="M32 54C20 54 11 46 11 35 11 24 19 17 28 19c7 1.600 7 10 1 11.500-4 1-7-2-5.500-5"/><path d="M32 54C44 54 53 46 53 35 53 24 45 17 36 19c-7 1.600-7 10-1 11.500 4 1 7-2 5.500-5"/><path d="M32 54v6M28 60h8"/></svg>`;
  },
  /** Орнамент-фон: CSS url() для плитки из кошкар-муйуз. */
  hornTile(color = '#fff', opacity = .08, size = 72) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 64 64' fill='none' stroke='${color}' stroke-opacity='${opacity}' stroke-width='1.600' stroke-linecap='round'><path d='M32 54C20 54 11 46 11 35 11 24 19 17 28 19c7 1.600 7 10 1 11.500-4 1-7-2-5.500-5'/><path d='M32 54C44 54 53 46 53 35 53 24 45 17 36 19c-7 1.600-7 10-1 11.500 4 1 7-2 5.500-5'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  },

  init(slug) {
    ch = bySlug(slug); if (!ch) return; const root = document.documentElement;
    document.body.classList.add('ch'); root.style.setProperty('--ch-accent', ch.accent); root.style.setProperty('--ch-bg', ch.bg); root.style.setProperty('--ch-ink', ch.ink);
    lang = store.get('sabak.chron.lang') === 'ky' ? 'ky' : 'ru';
    document.title = `SABAK+ ${ch.ver} — ${ch.name}`;
    const main = $('main'); if (main) main.id = main.id || 'main';
    if (!$('.skip')) document.body.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main" data-ky="Мазмунга өтүү">Перейти к содержимому</a>');
    document.body.insertAdjacentHTML('beforeend', `<div class="cb-prog" aria-hidden="true"></div>
      <header class="cb"><a class="cb-logo" href="/updates" aria-label="Хроника SABAK+" data-ky-aria="SABAK+ хроникасы">SABAK<b>+</b></a><span class="cb-ver">${esc(ch.ver)} · ${esc(ch.name)}</span><span class="cb-sp"></span>
      <button type="button" id="cb-lang" aria-pressed="${lang === 'ky'}" aria-label="Кыргызча / Русский">KY</button>
      <button type="button" id="cb-rm" aria-pressed="false" data-ky="Анимация" title="Анимацияны өчүрүү">Анимации</button>
      <button type="button" id="cb-menu" aria-haspopup="dialog" data-ky="Бардык главалар">Все главы</button></header>
      <div class="cm" id="cm" role="dialog" aria-modal="true" aria-label="Главы"><button type="button" class="cm-x" id="cm-x">✕</button><h2 data-ky="SABAK+ хроникасы">Хроника SABAK+</h2><ol>${CHAPTERS.map(c => `<li><a href="${href(c)}" data-chap="${c.slug}" ${c.slug === slug ? 'aria-current="page"' : ''}><b>${esc(c.ver)} — ${esc(c.name)}</b><small>${esc(c.ru)}</small></a></li>`).join('')}</ol></div>`);
    const rm = $('#cb-rm'); if (store.get('sabak.chron.rm') === '1') { document.body.classList.add('rm'); rm.setAttribute('aria-pressed', 'true'); }
    rm.onclick = () => { const on = !document.body.classList.contains('rm'); document.body.classList.toggle('rm', on); rm.setAttribute('aria-pressed', on); store.set('sabak.chron.rm', on ? '1' : '0'); location.reload(); };
    $('#cb-lang').onclick = () => Chron.setLang(lang === 'ky' ? 'ru' : 'ky');
    const m = $('#cm'), openM = o => { m.classList.toggle('open', o); if (o) $('#cm-x').focus(); else $('#cb-menu').focus(); };
    $('#cb-menu').onclick = () => openM(true); $('#cm-x').onclick = () => openM(false); addEventListener('keydown', e => { if (e.key === 'Escape') openM(false); });
    // концовка главы
    const i = idx(slug), prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
    const end = $('[data-chron-end]') || (() => { const n = document.createElement('nav'); n.setAttribute('data-chron-end', ''); (main || document.body).after(n); return n; })();
    end.className = 'ce'; end.setAttribute('aria-label', 'Соседние главы');
    end.innerHTML = (prev ? `<a class="prev" href="${href(prev)}" data-chap="${prev.slug}"><small data-ky="← Мурунку глава">← Предыдущая глава</small><b>${esc(prev.ver)} · ${esc(prev.name)}</b></a>` : '<a class="prev" href="/updates" data-chap=""><small data-ky="← Хроника">← Вся хроника</small><b>SABAK+</b></a>')
      + (next ? `<a class="next" href="${href(next)}" data-chap="${next.slug}"><small data-ky="Кийинки глава →">Следующая глава →</small><b>${esc(next.ver)} · ${esc(next.name)}</b></a>` : '<a class="next" href="/app?demo=1"><small data-ky="Азыр →">Сегодня →</small><b data-ky="Күндөлүктү ачуу">Открыть дневник</b></a>');
    // переходы-занавесы между главами
    document.addEventListener('click', e => {
      const a = e.target.closest('a[data-chap]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const t = a.dataset.chap ? bySlug(a.dataset.chap) : null; if (Chron.reduced || !t) return;
      e.preventDefault(); const r = a.getBoundingClientRect(), w = document.createElement('div'); w.className = 'cw';
      w.style.cssText = `background:${t.bg};color:${t.ink};--wx:${r.left + r.width / 2}px;--wy:${r.top + r.height / 2}px`; w.innerHTML = `<span style="color:${t.accent}">${esc(t.name)}</span>`;
      document.body.appendChild(w); try { sessionStorage.setItem('sabak.chron.wipe', JSON.stringify({ bg: t.bg, c: t.accent, n: t.name, x: r.left + r.width / 2, y: r.top + r.height / 2 })); } catch {}
      requestAnimationFrame(() => w.classList.add('go')); setTimeout(() => { location.href = a.href; }, 560);
    });
    try { const raw = sessionStorage.getItem('sabak.chron.wipe'); if (raw && !Chron.reduced) { sessionStorage.removeItem('sabak.chron.wipe'); const d = JSON.parse(raw), w = document.createElement('div'); w.className = 'cw go'; w.style.cssText = `background:${d.bg};--wx:${d.x}px;--wy:${d.y}px`; w.innerHTML = `<span style="color:${d.c}">${esc(d.n)}</span>`; document.body.appendChild(w); requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('out'))); setTimeout(() => w.remove(), 900); } } catch {}
    Chron.setLang(lang, true);
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule); schedule();
    Chron.reveal();
  },
  setLang(l, silent) {
    lang = l === 'ky' ? 'ky' : 'ru'; if (!silent) store.set('sabak.chron.lang', lang);
    document.documentElement.lang = lang === 'ky' ? 'ky' : 'ru';
    $$('[data-ky]').forEach(el => { if (!('ru' in el.dataset)) el.dataset.ru = el.textContent; el.textContent = lang === 'ky' ? el.dataset.ky : el.dataset.ru; });
    $$('[data-ky-aria]').forEach(el => { if (!el.dataset.ruAria) el.dataset.ruAria = el.getAttribute('aria-label') || ''; el.setAttribute('aria-label', lang === 'ky' ? el.dataset.kyAria : el.dataset.ruAria); });
    const b = $('#cb-lang'); if (b) { b.setAttribute('aria-pressed', lang === 'ky'); b.textContent = lang === 'ky' ? 'РУ' : 'KY'; }
    langCbs.forEach(cb => cb(lang));
  },
};

function schedule() { if (ticking) return; ticking = true; requestAnimationFrame(update); }
function update() {
  ticking = false; const vh = innerHeight, de = document.documentElement, max = de.scrollHeight - vh;
  de.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
  if (Chron.reduced) return;
  for (const s of scrubs) {
    const r = s.el.getBoundingClientRect(); if (r.bottom < -vh || r.top > vh * 2) continue;
    const p = s.mode === 'pin' ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh + r.height));
    if (p !== s.last) { s.last = p; s.cb(p, s.el); }
  }
}
window.Chron = Chron;
