const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1200,height:800}}); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForSelector('.auth');
await pg.click('.auth [data-act=privacy]'); await pg.waitForSelector('#privacy .priv'); console.log('open ru', (await pg.$eval('#privacy h2',e=>e.innerText)));
await pg.keyboard.press('Escape'); console.log('closed', !(await pg.$('#privacy')));
await pg.click('[data-act=lang]'); await pg.waitForTimeout(200); await pg.click('.auth [data-act=privacy]'); console.log('open ky', await pg.$eval('#privacy h2',e=>e.innerText));
await pg.click('[data-privacy-close]'); console.log('closed2', !(await pg.$('#privacy')));
await pg.click('[data-act=auth-demo]'); await pg.waitForTimeout(200); await pg.evaluate(()=>window.__sabak.S.login('teacher')); await pg.waitForTimeout(300); await pg.click('[data-act=menu]'); await pg.click('.mi[data-act=privacy]'); console.log('menu open', !!(await pg.$('#privacy')));
await pg.screenshot({path:'tests/out/privacy.png'}); console.log('errs',errs); await b.close(); })();
