const { chromium } = require('playwright'); const fs=require('fs');
const OUT='dl'; fs.mkdirSync(OUT,{recursive:true});
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:850},acceptDownloads:true}); const pg=await ctx.newPage();
const errs=[],ok=[]; const chk=(c,m)=>{ (c?ok:errs).push((c?'OK  ':'FAIL ')+m); };
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE '+m.text())});
pg.on('dialog',d=>d.accept());
await pg.goto('http://localhost:8765/'); await pg.waitForSelector('.auth'); await pg.click('[data-act=auth-demo]');
const login=async r=>{ if(await pg.$('.top')){ await pg.click('[data-act=menu]'); await pg.click('[data-act=logout]'); await pg.waitForSelector('.auth'); await pg.click('[data-act=auth-demo]'); } await pg.click(`[data-act=login][data-role=${r}]`); await pg.waitForSelector('.top'); };
// --- admin: warn about photo
await login('admin'); await pg.evaluate(()=>location.hash='#/admin/students'); await pg.waitForSelector('.stgrid');
chk(await pg.$$eval('.stc',e=>e.length)===10,'admin students list (9А) 10 cards');
await pg.click('[data-act=warn-one][data-sid=s1]'); await pg.waitForTimeout(200);
// --- parent: sees banner, uploads bad photo then good
await login('parent'); await pg.waitForSelector('.banner');
chk((await pg.$eval('.banner',e=>e.innerText)).includes('Нужно фото'),'parent sees photo banner');
await pg.click('.banner [data-act=photo-open]'); await pg.waitForSelector('.modal');
await pg.screenshot({path:'tests/out/40_photo_modal.png'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
await pg.setInputFiles('[data-photo]:not([capture])',{name:'x.png',mimeType:'image/png',buffer:png}); await pg.waitForSelector('.verdict',{timeout:60000});
chk((await pg.$eval('.verdict',e=>e.innerText)).toLowerCase().includes('не принято'),'bad photo rejected');
chk(!(await pg.$('[data-act=photo-save]')),'no save button for bad photo');
await pg.screenshot({path:'tests/out/41_photo_bad.png'});
// real engine on group image -> rejected
await pg.click('[data-act=photo-again]');
await pg.setInputFiles('[data-photo]:not([capture])','tests/img/sample3.jpg'); await pg.waitForSelector('.verdict',{timeout:90000});
chk((await pg.$eval('.checks',e=>e.innerText)).includes('найдено 3'),'group photo rejected: 3 faces');
// stub positive
await pg.evaluate(()=>{ window.__faceStub=async f=>{const c=document.createElement('canvas');c.width=48;c.height=64;const x=c.getContext('2d');x.fillStyle='#bbb';x.fillRect(0,0,48,64);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg'));return {ok:true,checks:[{id:'one',label:'Одно лицо в кадре',ok:true,detail:'найдено 1'}],meta:{verified:true,faces:1},failed:[],blob};}; });
await pg.click('[data-act=photo-again]'); await pg.setInputFiles('[data-photo]:not([capture])',{name:'y.png',mimeType:'image/png',buffer:png}); await pg.waitForSelector('[data-act=photo-save]');
await pg.click('[data-act=photo-save]'); await pg.waitForSelector('.modal',{state:'detached'});
chk(await pg.evaluate(()=>window.__sabak.S.student('s1').photo&&window.__sabak.S.student('s1').photo.ok),'photo saved in state');
chk(!(await pg.$('.banner.warn [data-act=photo-open]')),'banner gone after photo');
// --- parent dossier edit
await pg.click('.nav a[href="#/parent/dossier"]'); await pg.waitForSelector('.dos-head');
chk((await pg.$eval('.acc',e=>e.innerText)).includes('Можно редактировать'),'parent can edit dossier');
await pg.fill('#dos-char','Тестовая характеристика'); await pg.click('[data-act=dos-save-char]');
await pg.selectOption('[data-doc=med_063][data-f=status]','have');
await pg.waitForTimeout(200);
chk(await pg.evaluate(()=>window.__sabak.S.state().dossier.s1.characteristic==='Тестовая характеристика'&&window.__sabak.S.state().docs.s1.med_063.status==='have'),'dossier saved');
await pg.screenshot({path:'tests/out/42_dossier_parent.png',fullPage:true});
// --- student: no access
await login('student'); await pg.evaluate(()=>location.hash='#/dossier/s1'); await pg.waitForSelector('.lock'); chk((await pg.$eval('.lock',e=>e.innerText)).includes('Нет доступа'),'student no dossier access');
// --- admin: read-only dossier
await login('admin'); await pg.evaluate(()=>location.hash='#/dossier/s1'); await pg.waitForSelector('.dos-head'); chk((await pg.$eval('.acc',e=>e.innerText)).includes('Только чтение'),'admin read-only dossier'); chk(await pg.$('#dos-char[disabled]')!==null,'textarea disabled for admin');
// --- teacher non-homeroom (9Б) cannot read dossier of 9А kid? t1 is homeroom 9А -> can; check 9Б kid no
await login('teacher'); await pg.evaluate(()=>location.hash='#/dossier/s11'); await pg.waitForSelector('.lock'); chk(true,'teacher no access to other class dossier');
// --- exports
await login('admin'); await pg.evaluate(()=>location.hash='#/admin'); await pg.waitForSelector('.exbar');
for(const [k,ext] of [['xlsx','xlsx'],['docx','docx']]){ const [d]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click(`.exbar [data-act=export-${k}]`)]); await d.saveAs(`${OUT}/school.${ext}`); chk(true,'download '+d.suggestedFilename()); }
await pg.evaluate(()=>location.hash='#/admin/teachers'); await pg.waitForSelector('.exbar');
{ const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('.exbar [data-act=export-xlsx]')]); await d.saveAs(`${OUT}/teachers.xlsx`); }
{ const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('.exbar [data-act=export-docx]')]); await d.saveAs(`${OUT}/teachers.docx`); }
await pg.screenshot({path:'tests/out/43_teachers.png',fullPage:true});
// --- auto offline/online
await login('teacher'); await pg.evaluate(()=>location.hash='#/teacher'); await pg.waitForSelector('.jrow');
await ctx.setOffline(true); await pg.evaluate(()=>window.dispatchEvent(new Event('offline'))); await pg.waitForSelector('.net.off',{timeout:5000}); chk(true,'offline detected automatically');
await pg.click('.gb.g5[data-sid=s2]'); await pg.waitForTimeout(200);
chk(await pg.evaluate(()=>window.__sabak.S.pending())>0,'grade queued offline');
await pg.screenshot({path:'tests/out/44_offline.png'});
await ctx.setOffline(false); await pg.evaluate(()=>window.dispatchEvent(new Event('online')));
await pg.waitForFunction(()=>window.__sabak.S.pending()===0,null,{timeout:15000}); chk(true,'auto-sync after reconnect');
chk(!(await pg.$('.savebar')),'no fixed savebar'); chk(!!(await pg.$('.savetool')),'savetool in header');
// mobile
await pg.setViewportSize({width:390,height:844}); await pg.waitForTimeout(300); await pg.screenshot({path:'tests/out/50_mobile_teacher.png'});
await login('admin'); await pg.screenshot({path:'tests/out/51_mobile_admin.png'});
console.log(ok.join('\n')); console.log(errs.length?errs.join('\n'):'NO ERRORS'); await b.close();})();
