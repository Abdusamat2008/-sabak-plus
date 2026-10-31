// Шаг ввода кода: кнопка «Отправить ещё раз» должна отправлять запрос, а код из 8 цифр — приниматься формой.
const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:420,height:800}}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
const calls=[]; await ctx.route('**/*.supabase.co/**',async r=>{ const u=new URL(r.request().url()); calls.push(u.pathname+' '+(r.request().postData()||'')); const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
  if(r.request().method()==='OPTIONS') return r.fulfill({status:204,headers:H});
  if(u.pathname.endsWith('/verify')) return r.fulfill({status:403,headers:H,body:JSON.stringify({msg:'Token has expired or is invalid'})});
  return r.fulfill({status:200,headers:H,body:'{}'}); });
await pg.goto('http://localhost:8765/app.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForSelector('.auth');
await pg.evaluate(()=>{ const a=window.__sabak.ui.auth; a.mode='register'; a.role='director'; a.step=5; a.pendEmail='a@b.kg'; a.resendAt=Date.now()+1500; window.__render(); });
const dis1=await pg.$eval('[data-act=auth-resend]',e=>e.disabled); await pg.waitForTimeout(2300);
const dis2=await pg.$eval('[data-act=auth-resend]',e=>e.disabled); console.log('disabled at start/after wait:',dis1,dis2,'(ждём true,false)');
await pg.click('[data-act=auth-resend]'); await pg.waitForSelector('.okmsg'); console.log('resend request sent:',calls.some(c=>c.includes('/auth/v1/resend')), '| info:', (await pg.$eval('.okmsg',e=>e.innerText)).slice(0,50));
await pg.fill('[name=otp]','12345678'); await pg.click('form[data-form=verify] button[type=submit]'); await pg.waitForSelector('.errmsg'); console.log('8-digit code posted to /verify:',calls.some(c=>c.includes('/auth/v1/verify')&&c.includes('12345678')),'| err:',await pg.$eval('.errmsg',e=>e.innerText));
console.log('errs',errs); await b.close(); })();
