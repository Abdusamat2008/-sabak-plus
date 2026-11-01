// Аудит мобильной вёрстки: горизонтальный скролл, мелкие кнопки, скриншоты
const {chromium}=require('playwright');
const SZ=[[360,740],[390,844]];
const BASE='http://localhost:8765';
(async()=>{const b=await chromium.launch();let bad=0;
const audit=async(p,name)=>{const r=await p.evaluate(()=>{const W=innerWidth,out=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>W+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.subtabs,.tabs,[class*=scroll],.nav nav,.tapes,.bnav,.hscroll,.screens,.stage,.hero-phone,.float,.phone,.story-glow,.glow,pre,.tbl-wrap,.sgrid,.palette,table'))out.push((e.className||e.tagName)+':'+Math.round(r.right));});
 const small=[...document.querySelectorAll('button,a.btn,.btn,input:not([type=hidden]),select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&r.height<36&&!e.closest('.nav,.hd2')}).slice(0,4).map(e=>(e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().height));
 return{ow:document.documentElement.scrollWidth-W,out:out.slice(0,4),small}});
 if(r.ow>1||r.out.length){bad++;console.log('OVERFLOW',name,JSON.stringify(r))}else console.log('ok',name,r.small.length?'small:'+r.small.join(','):'');};
for(const [w,h] of SZ){const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(const u of ['/index.html','/connect.html','/updates.html']){await p.goto(BASE+u);await p.waitForTimeout(1500);await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0)});await p.waitForTimeout(500);await audit(p,`${w} ${u}`);if(w===360)await p.screenshot({path:`tests/out/m-${u.slice(1,-5)}.png`})}
 // приложение: вход / регистрация
 await p.goto(BASE+'/app.html');await p.waitForTimeout(900);await audit(p,`${w} app-entry`);if(w===360)await p.screenshot({path:'tests/out/m-entry.png'});
 await p.goto(BASE+'/app.html?demo=1');await p.waitForTimeout(900);
 const roles=[['УЧЕНИК',['#/student','#/student/subjects','#/student/schedule','#/student/hw','#/student/ach','#/student/mail']],['РОДИТЕЛЬ',['#/parent','#/parent/schedule']],['УЧИТЕЛЬ',['#/teacher','#/teacher/class','#/teacher/schedule','#/teacher/students','#/teacher/log']],['АДМИНИСТРАЦИЯ',['#/admin','#/admin/schedule','#/admin/teachers','#/admin/students','#/admin/access','#/admin/mail','#/admin/archive','#/admin/audit']]];
 for(const [r,routes] of roles){ if(r!=='УЧЕНИК'){await p.click('.usr-b');await p.selectOption('select.roleSel',{label:{'РОДИТЕЛЬ':'Родитель','УЧИТЕЛЬ':'Учитель','АДМИНИСТРАЦИЯ':'Директор'}[r]});await p.waitForTimeout(500)} else {await p.click('text=УЧЕНИК');await p.waitForTimeout(600)}
  for(const h of routes){await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(500);await audit(p,`${w} ${r} ${h}`);if(w===360&&['#/student','#/teacher','#/admin','#/teacher/class','#/admin/schedule'].includes(h))await p.screenshot({path:`tests/out/m-${r}-${h.replace(/\W/g,'')}.png`})}}
 await p.click('.ibtn[data-act=a11y]');await p.waitForTimeout(500);await audit(p,`${w} a11y panel`);
 console.log('errs',errs);await ctx.close()}
console.log(bad?'BAD='+bad:'MOBILE OK');await b.close()})();
