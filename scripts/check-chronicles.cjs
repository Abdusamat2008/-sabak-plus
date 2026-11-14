// Проверка всех глав: ошибки консоли, битые запросы, горизонтальная прокрутка, клики по всем кнопкам, reduced-motion.
// Запуск: node scripts/serve.mjs & ; NODE_PATH=$(npm root -g) node scripts/check-chronicles.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:8765';
const slugs = require('fs').readFileSync('scripts/chron/data.mjs', 'utf8').match(/slug:'([^']+)'/g).map(s => s.slice(6, -1));
(async () => {
  const b = await chromium.launch(); let bad = 0; const log = (...a) => console.log(...a);
  for (const mode of [['desktop', { width: 1280, height: 800 }, false], ['mobile', { width: 390, height: 844 }, false], ['reduced', { width: 1280, height: 800 }, true]]) {
    const [name, vp, rm] = mode; const ctx = await b.newContext({ viewport: vp, reducedMotion: rm ? 'reduce' : 'no-preference', isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    for (const path of ['/updates', ...slugs.map(s => '/updates/' + s)]) {
      const pg = await ctx.newPage(); const errs = [], fails = [];
      pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text())); pg.on('response', r => r.status() >= 400 && fails.push(r.status() + ' ' + r.url()));
      const t0 = Date.now(); await pg.goto(B + path, { waitUntil: 'load' }); await pg.waitForTimeout(500);
      const H = await pg.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < H; y += vp.height * .8) { await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(40); }
      const info = await pg.evaluate(() => ({ ox: document.documentElement.scrollWidth > innerWidth + 1, h1: !!document.querySelector('h1'), links: [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]).filter((v, i, a) => a.indexOf(v) === i), rm: document.documentElement.classList.contains('rm') }));
      // клик по всем доступным кнопкам в демо и сценах
      const n = await pg.evaluate(async () => { let c = 0; for (const el of document.querySelectorAll('.sc button:not([disabled]), .demo button:not([disabled]), .pages3 button')) { if (el.closest('.cbar')) continue; try { el.click(); c++; } catch (e) { } } return c; });
      await pg.waitForTimeout(300);
      const load = Date.now() - t0;
      const problems = []; if (errs.length) problems.push('ERR ' + errs.slice(0, 3).join(' | ')); if (fails.length) problems.push('HTTP ' + fails.slice(0, 3).join(' | ')); if (info.ox) problems.push('overflow-x'); if (!info.h1) problems.push('no h1'); if (rm && !info.rm) problems.push('rm class not set');
      for (const l of info.links) { const r = await pg.request.get(B + l); if (r.status() >= 400) problems.push('bad link ' + l); }
      log((problems.length ? '✗' : '✓'), name, path, `clicks:${n}`, `${load}ms`, problems.join(' ; ')); if (problems.length) bad++;
      await pg.close();
    }
    await ctx.close();
  }
  await b.close(); log(bad ? `\nПроблем: ${bad}` : '\nВсе проверки пройдены'); process.exit(bad ? 1 : 0);
})();
