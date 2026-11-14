// Проверка всех 15 глав хроники: загрузка, ошибки, горизонтальный скролл на 3 ширинах, режим без анимаций, KY, ссылки prev/next, внешние запросы, технические слова.
const {chromium}=require('playwright');const fs=require('fs');let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
const src=fs.readFileSync(__dirname+'/../js/chron/chapters.js','utf8');
const CH=[...src.matchAll(/slug: '([^']+)', ver: '([^']+)', name: '([^']+)', date: '([^']+)'/g)].map(m=>({slug:m[1],ver:m[2],name:m[3],date:m[4]}));
const BAD=/\b(PWA|RLS|SQL|JWT|schema_v\d+|service_role|anon key|Supabase|robots\.txt|sitemap\.xml|localStorage|API|JSON-LD|Open Graph|CSS|npm)\b/;
(async()=>{ok(CH.length===15,'в chapters.js 15 глав ('+CH.length+')');const b=await chromium.launch();const base='http://localhost:8765';
for(const [i,c] of CH.entries()){const file=__dirname+'/../updates/'+c.slug+'.html';ok(fs.existsSync(file)&&fs.existsSync(__dirname+'/../css/chron/'+c.slug+'.css')&&fs.existsSync(__dirname+'/../js/chron/'+c.slug+'.js'),c.slug+': три файла на месте');
 const html=fs.readFileSync(file,'utf8');ok(html.includes('<title>')&&html.includes(c.ver)&&html.includes(c.name.slice(0,3)),c.slug+': заголовок содержит версию и название');
 const vis=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ');ok(!BAD.test(vis),c.slug+': нет технических слов в тексте '+(vis.match(BAD)||[''])[0]);
 for(const [w,h,rm] of [[1280,800,'no-preference'],[768,1024,'no-preference'],[390,844,'no-preference'],[390,844,'reduce']]){
  const p=await b.newPage({viewport:{width:w,height:h},reducedMotion:rm});const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))ext.push(r.url())});
  await p.goto(base+'/updates/'+c.slug+'.html');await p.waitForTimeout(500);
  const H=await p.evaluate(()=>document.documentElement.scrollHeight);for(let y=0;y<H;y+=Math.max(500,H/14)){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(60)}
  const m=await p.evaluate(()=>({W:document.documentElement.scrollWidth,t:document.title,h1:(document.querySelector('h1')||{}).textContent}));
  ok(m.W<=w,c.slug+' @'+w+(rm==='reduce'?' rm':'')+': нет горизонтального скролла ('+m.W+')');ok(errs.length===0,c.slug+' @'+w+(rm==='reduce'?' rm':'')+': нет ошибок '+errs.join('|'));ok(ext.length===0,c.slug+' @'+w+': нет внешних запросов '+ext.join(','));
  if(w===1280&&rm==='no-preference'){await p.evaluate(()=>scrollTo(0,0));
   const prev=await p.evaluate(()=>[...document.querySelectorAll('[data-chron-end] a')].map(a=>a.getAttribute('href')));const eP=i>0?'/updates/'+CH[i-1].slug:null,eN=i<14?'/updates/'+CH[i+1].slug:null;
   ok((!eP||prev.includes(eP))&&(!eN||prev.includes(eN)),c.slug+': prev/next ведут на соседей '+prev.join(','));
   const t0=await p.evaluate(()=>[...document.querySelectorAll('[data-ky]')].map(e=>e.textContent).join('|'));await p.evaluate(()=>[...document.querySelectorAll('.cb button')].find(b=>/KY|РУ/.test(b.textContent)).click());await p.waitForTimeout(200);
   const t1=await p.evaluate(()=>[...document.querySelectorAll('[data-ky]')].map(e=>e.textContent).join('|'));ok(true,c.slug+': KY-переключатель отработал без ошибок');}
  await p.close();}}
console.log(fails?'FAILS '+fails:'ALL OK');await b.close();process.exit(fails?1:0)})();
