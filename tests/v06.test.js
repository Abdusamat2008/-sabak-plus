const {chromium}=require('playwright');
const URL=process.env.URL||'http://localhost:8765/app.html?demo=1';
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',x=>errs.push(x.message));p.on('dialog',d=>d.accept());
await p.goto(URL);await p.waitForTimeout(700);
await p.click('text=АДМИНИСТРАЦИЯ');await p.waitForTimeout(500);
await p.evaluate(()=>location.hash='#/admin/archive');await p.waitForTimeout(600);
let t=await p.innerText('body');ok(/2024\/2025/.test(t)&&/2023\/2024/.test(t),'director sees own school archive years');ok(!/Гимназия №5/.test(t),'director does not see other schools');
await p.screenshot({path:'tests/out/arch-1.png'});
await p.click('a.yr:has-text("2024/2025")');await p.waitForTimeout(500);t=await p.innerText('body');ok(/Класс/.test(t)&&/8А/.test(t)&&/8Б/.test(t),'classes list');
await p.click('a.yr:has-text("8А")');await p.waitForTimeout(500);t=await p.innerText('body');ok(/Учебный год 2024\/2025/.test(t),'class view labelled "Учебный год"');
await p.click('.row >> nth=0');await p.waitForTimeout(500);t=await p.innerText('body');ok(/Дневник за год/.test(t)&&/Личное дело/.test(t)&&/Посещаемость/.test(t),'student diary + dossier');
await p.screenshot({path:'tests/out/arch-2.png',fullPage:false});
await p.click('details.subj >> nth=0 >> summary');await p.waitForTimeout(300);ok(await p.isVisible('details.subj[open] table'),'subject grades expand (что и за что)');
// закрыть год
await p.evaluate(()=>location.hash='#/admin/archive');await p.waitForTimeout(500);
await p.fill('input[name=label]','2025/2026');await p.click('button:has-text("Сохранить в архив")');await p.waitForTimeout(900);t=await p.innerText('body');ok(/2025\/2026/.test(t)&&/Сохранён вручную/.test(t),'closing year adds it to archive');
await p.fill('input[name=label]','2025/2026');await p.click('button:has-text("Сохранить в архив")');await p.waitForTimeout(600);ok(/уже в архиве/.test(await p.innerText('#toast')),'duplicate year refused');
await p.fill('input[name=label]','2025-26');await p.click('button:has-text("Сохранить в архив")');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.querySelector('input[name=label]').checkValidity()),'bad label refused');
// суперадмин
await p.click('.usr-b');await p.selectOption('select.roleSel','super');await p.waitForTimeout(700);t=await p.innerText('body');
ok(/школы платформы/i.test(t)&&/Гимназия №5/i.test(t)&&/Алатоо/i.test(t),'superadmin sees all schools');
await p.screenshot({path:'tests/out/arch-3.png'});
await p.click('a.yr:has-text("Гимназия №5")');await p.waitForTimeout(500);await p.click('a.yr:has-text("2024/2025")');await p.waitForTimeout(500);await p.click('a.yr:has-text("10А")');await p.waitForTimeout(500);await p.click('.row >> nth=0');await p.waitForTimeout(500);
ok(/Дневник за год/.test(await p.innerText('body')),'superadmin opens other school student diary');
ok(await p.evaluate(()=>!/Закрыть год|Завершить учебный год/.test(document.body.innerText)),'superadmin has no close-year form');
// родитель не видит архив
await p.click('.usr-b');await p.selectOption('select.roleSel','parent');await p.waitForTimeout(500);await p.evaluate(()=>location.hash='#/admin/archive');await p.waitForTimeout(500);
ok(!/Архив/.test((await p.innerText('main, #app')).slice(0,300))||!/2024\/2025/.test(await p.innerText('body')),'parent cannot open archive');
ok(errs.length===0,'no page errors '+errs.join(';'));
console.log(fails?'FAILED':'ALL v0.6 ARCHIVE CHECKS PASSED');await b.close();process.exit(fails?1:0)})();
