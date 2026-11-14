// Мастер первого знакомства: заставка → текстовый экран → установка. Скриншоты в tests/out/welcome_*.png
const { chromium } = require('playwright');
const ROLE = process.env.ROLE || 'student', OUT = 'tests/out/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await pg.goto('http://localhost:8765/app.html?demo=1&welcome=1'); await pg.waitForSelector('[data-act=login]');
  await pg.click(`[data-act=login][data-role=${ROLE}]`); await pg.waitForSelector('#welcome');
  for (const t of [1200, 2600, 4200, 5600]) { await pg.waitForTimeout(t === 1200 ? 1200 : 1400); await pg.screenshot({ path: `${OUT}welcome_${ROLE}_s${t}.png` }); }
  await pg.waitForSelector('.wz-text', { timeout: 6000 }); await pg.waitForSelector('#wzt-go:not([disabled])'); await pg.screenshot({ path: `${OUT}welcome_${ROLE}_text.png` });
  await pg.keyboard.press('Enter'); await pg.waitForSelector('.wz-win');
  let i = 0;
  for (;;) {
    await pg.waitForTimeout(450); await pg.screenshot({ path: `${OUT}welcome_${ROLE}_p${String(i++).padStart(2, '0')}.png` });
    const id = await pg.$eval('.wz-pg', e => e.dataset.id);
    if (id === 'done') break;
    if (id === 'install') await pg.waitForSelector('#wz-next:not([disabled])', { timeout: 12000 });
    await pg.click('#wz-next');
  }
  await pg.click('#wz-next'); await pg.waitForSelector('#welcome', { state: 'detached' });
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();
