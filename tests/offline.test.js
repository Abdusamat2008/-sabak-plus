// Приложение должно открываться и работать в демо без интернета (после первого визита) — запасной план для защиты.
const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1100,height:800}}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8765/app.html'); await pg.waitForSelector('.auth'); await pg.evaluate(async()=>{ await navigator.serviceWorker.ready; });
await pg.waitForTimeout(2500);   // SW докачивает оболочку
await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('.auth',{timeout:10000}); console.log('opens offline: OK');
await pg.click('[data-act=auth-demo]'); await pg.waitForTimeout(300); await pg.evaluate(()=>window.__sabak.S.login('admin')); await pg.evaluate(()=>location.hash='#/admin'); await pg.waitForSelector('.top',{timeout:8000}); console.log('admin analytics offline: OK');
await pg.evaluate(()=>location.hash='#/admin/teachers'); await pg.waitForTimeout(400); console.log('errs',errs); await b.close(); })().catch(e=>{console.log('FATAL',e.message.split('\n')[0]);process.exit(1)});
