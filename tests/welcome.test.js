// Мастер первого знакомства: заставка → пошаговая инструкция → установка → экскурсия. Скриншоты в tests/out/welcome_*.png
// Запуск: ROLE=student|teacher|parent|admin  VW=390 VH=844 node tests/welcome.test.js
const { chromium } = require('playwright');
const ROLE = process.env.ROLE || 'student', VW = +(process.env.VW || 1280), VH = +(process.env.VH || 800), OUT = 'tests/out/', TAG = `${ROLE}_${VW}`;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: VW < 800, isMobile: VW < 800 }); const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await pg.goto('http://localhost:8765/app.html?demo=1&welcome=1'); await pg.waitForSelector('[data-act=login]');
  await pg.click(`[data-act=login][data-role=${ROLE}]`); await pg.waitForSelector('.wz-splash');
  await pg.waitForTimeout(2500); await pg.screenshot({ path: `${OUT}welcome_${TAG}_s1.png` });
  await pg.waitForTimeout(3000); await pg.screenshot({ path: `${OUT}welcome_${TAG}_s2.png` });
  await pg.waitForSelector('.wz-win', { timeout: 8000 });
  let i = 0; const overflow = [];
  for (;;) {
    await pg.waitForTimeout(450); await pg.screenshot({ path: `${OUT}welcome_${TAG}_p${String(i++).padStart(2, '0')}.png` });
    const ov = await pg.evaluate(() => { const m = document.querySelector('.wz-main'), w = document.querySelector('.wz-win'); return { x: m.scrollWidth - m.clientWidth, win: w.scrollWidth - w.clientWidth, doc: document.documentElement.scrollWidth - innerWidth }; });
    if (ov.x > 1 || ov.win > 1 || ov.doc > 1) overflow.push(`page ${i - 1}: ${JSON.stringify(ov)}`);
    const id = await pg.$eval('.wz-pg', e => e.dataset.id);
    if (id === 'done') break;
    if (id === 'install') await pg.waitForSelector('#wz-next:not([disabled])', { timeout: 12000 });
    await pg.click('#wz-next');
  }
  await pg.click('[data-wz=tour]'); await pg.waitForSelector('.wzt-tip'); await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}welcome_${TAG}_tour1.png` });
  await pg.click('[data-tour=next]'); await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}welcome_${TAG}_tour2.png` });
  for (let k = 0; k < 6 && await pg.$('#wz-tour'); k++) await pg.click('[data-tour=next]');
  if (overflow.length) errs.push('HORIZONTAL OVERFLOW: ' + overflow.join('; '));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();
