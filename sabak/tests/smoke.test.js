const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:850}}); const pg=await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/'); await pg.waitForSelector('.auth');
await pg.screenshot({path:'tests/out/01_login.png'});
await pg.click('[data-act=auth-mode][data-v=register]'); await pg.screenshot({path:'tests/out/02_reg1.png'});
await pg.click('[data-act=auth-role][data-v=parent]'); await pg.screenshot({path:'tests/out/03_reg2.png'});
await pg.click('[data-act=auth-back]'); await pg.click('[data-act=auth-mode][data-v=login]');
await pg.click('[data-act=auth-demo]'); await pg.waitForSelector('.role-card');
await pg.screenshot({path:'tests/out/04_demo.png'});
for (const role of ['student','parent','teacher','admin']) {
  await pg.click(`[data-act=login][data-role=${role}]`); await pg.waitForSelector('.top');
  await pg.waitForTimeout(300); await pg.screenshot({path:`tests/out/10_${role}.png`});
  const links=await pg.$$eval('.nav a',as=>as.map(a=>a.getAttribute('href')));
  for(const h of links){ await pg.evaluate(h=>{location.hash=h},h); await pg.waitForTimeout(150); const txt=await pg.$eval('#main',e=>e.innerText.length); if(txt<30) errs.push('EMPTY '+role+' '+h); await pg.screenshot({path:`tests/out/20_${role}_${h.replace(/[#\/]/g,'_')}.png`}); }
  await pg.click('[data-act=menu]'); await pg.screenshot({path:`tests/out/30_menu_${role}.png`}); await pg.click('[data-act=logout]'); await pg.waitForSelector('.auth'); await pg.click('[data-act=auth-demo]'); await pg.waitForSelector('.role-card');
}
console.log(errs.length?errs.join('\n'):'NO ERRORS'); await b.close();})();
