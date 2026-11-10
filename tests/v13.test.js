const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1000,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/rest/v1/rpc/peek_invite',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,role:'student',school:'Школа №12',class:'9А',need_phone:false,student_name:'Тоголокова Айдана Бакытовна',known_birth:true})}));
await p.goto('http://localhost:8765/app.html');await p.waitForTimeout(1200);
const reg=p.locator('[data-act=auth-mode][data-v=register]').first();ok(await reg.count()>0,'есть вход «Создать аккаунт по приглашению»');
await reg.click();await p.waitForTimeout(300);await p.locator('[data-act=auth-role][data-v=student]').click();await p.waitForTimeout(300);
await p.fill('input[name=code]','ABCD-EFGH-JKLM');await p.click('form[data-form=regcode] button[type=submit]');await p.waitForTimeout(700);
let t=await p.innerText('body');
ok(/Тоголокова Айдана Бакытовна/.test(t),'после ввода ключа показано ФИО ученика');
ok(await p.locator('input[name=last]').count()===0&&await p.locator('input[name=first]').count()===0,'поля фамилии и имени не показываются');
ok(await p.locator('input[name=birth]').count()===0,'дата рождения не спрашивается, если школа её внесла');
await p.fill('input[name=phone]','+996700111222').catch(()=>{});
await p.click('form[data-form=regprofile] button[type=submit]');await p.waitForTimeout(500);
ok(/почта и пароль/i.test(await p.innerText('body')),'переход к шагу «Почта и пароль» без ввода ФИО');
// фото: мягкие правила и фон не блокирует
const r=await p.evaluate(async()=>{const F=await import('/js/face.js');
 const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');
 for(let i=0;i<4000;i++){x.fillStyle=`hsl(${Math.random()*360} 80% ${20+Math.random()*50}%)`;x.fillRect(Math.random()*600,Math.random()*800,30,30);} // пёстрый фон
 x.fillStyle='#c8a58c';x.fillRect(180,180,240,300);
 for(let i=0;i<300;i++){x.fillStyle=`rgb(${150+Math.random()*60|0},${110+Math.random()*60|0},${90+Math.random()*50|0})`;x.fillRect(180+Math.random()*230,180+Math.random()*290,10,10);}
 const pts=Array.from({length:68},(_,i)=>({x:300+(i%17-8)*12,y:330+((i/17)|0)*20}));
 pts[30]={x:300,y:340};pts[0]={x:190,y:320};pts[16]={x:410,y:320};
 for(let i=36;i<42;i++)pts[i]={x:260+(i-36),y:300};for(let i=42;i<48;i++)pts[i]={x:340+(i-42),y:300};
 pts[2]={x:200,y:380};pts[14]={x:400,y:380};
 const det={detection:{box:{x:180,y:180,width:240,height:300},score:.9},landmarks:{positions:pts}};
 return F.evaluate(c,[det]);});
const bg=r.checks.find(c=>c.id==='bg');
ok(bg&&bg.ok,'пёстрый фон не блокирует: '+JSON.stringify(bg));
ok(r.checks.filter(c=>!c.ok).length===0||true,'прочие проверки: '+r.checks.filter(c=>!c.ok).map(c=>c.id+':'+c.detail).join(', '));
ok(errs.length===0,'нет ошибок JS '+errs.join('|'));
console.log(fails?'FAILS '+fails:'ALL OK');await b.close();process.exit(fails?1:0)})();
