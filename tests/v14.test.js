const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/app.html?demo=1');await p.waitForTimeout(900);
await p.evaluate(()=>__sabak.S.login('teacher'));await p.waitForTimeout(500);
await p.click('[data-act=menu]');await p.click('a[href="#/profile"]');await p.waitForTimeout(500);
const t=await p.innerText('main');ok(/Профиль создан на почте/.test(t),'профиль показывает строку про почту');ok(/Сменить пароль/.test(t),'блок смены пароля есть');
ok(errs.length===0,'нет ошибок JS '+errs.join(';'));
console.log(fails?'FAILS':'ALL OK');await b.close();process.exit(fails?1:0)})();
