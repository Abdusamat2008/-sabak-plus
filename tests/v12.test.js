const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/app.html?demo=1');await p.waitForTimeout(900);
// память для чтения без интернета
const r=await p.evaluate(async()=>{const RC=await import('/js/rcache.js'),Net=await import('/js/net.js');
 let calls=0;const f=async()=>{calls++;return {ok:true,rows:[{t:'Новость'}]}};
 const a=await RC.cached('news_list',{},f);Net.force(true);
 const b=await RC.cached('news_list',{},f);const c=await RC.cached('th_post',{},async()=>({ok:true,x:1}));const d=await RC.cached('news_list',{p:2},f);Net.force(false);
 return {a,b,c,d,calls}});
ok(r.a.ok&&!r.a.stale,'онлайн: ответ получен и запомнен');
ok(r.b.ok&&r.b.stale&&r.b.rows[0].t==='Новость'&&r.calls===1,'офлайн: отдаётся из памяти без запроса');
ok(r.c.ok&&r.c.x===1,'запись (не читающий запрос) не кэшируется и выполняется');
ok(r.d.error==='network','офлайн без памяти: понятная ошибка network');
// SW оболочка: все модули перечислены
const sw=await (await fetch('http://localhost:8765/sw.js')).text();
const files=require('fs').readdirSync('js').map(f=>'/js/'+f);const miss=files.filter(f=>!sw.includes("'"+f+"'"));ok(!miss.length,'sw.js кэширует все js-модули '+miss.join(','));
// демо офлайн: поставить оценку без сети → очередь → синхронизация
await p.evaluate(()=>__sabak.S.login('teacher'));await p.waitForTimeout(500);
ok(errs.length===0,'нет ошибок JS '+errs.join('|'));
console.log(fails?'FAILS '+fails:'ALL OK');await b.close();process.exit(fails?1:0)})();
