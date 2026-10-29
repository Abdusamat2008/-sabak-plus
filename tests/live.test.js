const { chromium } = require('playwright'); const crypto=require('crypto'); const { Client } = require('pg');
const SECRET='test-secret-test-secret-test-secret-123', PGR='http://localhost:3001';
const b64=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
const jwt=(sub)=>{const h=b64({alg:'HS256',typ:'JWT'}),p=b64({sub,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});return h+'.'+p+'.'+crypto.createHmac('sha256',SECRET).update(h+'.'+p).digest('base64url');};
const CONFIRM=!!process.env.CONFIRM; const users=new Map(), files=new Map(); let db;
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range,content-type'};
async function mock(route){
  const req=route.request(), u=new URL(req.url()), p=u.pathname;
  if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:CORS});
  const json=(status,obj)=>route.fulfill({status,headers:{...CORS,'content-type':'application/json'},body:JSON.stringify(obj)});
  if(p.startsWith('/auth/v1/')){
    const body=req.postDataJSON?.()||{};
    const tok=(usr)=>({access_token:jwt(usr.id),refresh_token:'r-'+usr.id,expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:usr.id,email:usr.email}});
    if(p.endsWith('/signup')){ if(users.has(body.email)) return json(422,{msg:'User already registered'}); if((body.password||'').length<8) return json(422,{msg:'Password should be at least 8 characters'}); const usr={id:crypto.randomUUID(),email:body.email,password:body.password}; users.set(body.email,usr); usr.confirmed=!CONFIRM; await db.query('insert into auth.users(id,email) values($1,$2)',[usr.id,usr.email]); return CONFIRM?json(200,{id:usr.id,email:usr.email}):json(200,tok(usr)); }
    if(p.endsWith('/verify')){ const usr=users.get(body.email); if(!usr||body.token!=='123456') return json(403,{msg:'Token has expired or is invalid'}); usr.confirmed=true; return json(200,tok(usr)); }
    if(p.endsWith('/resend')){ globalThis.resent=(globalThis.resent||0)+1; return json(200,{}); }
    if(p.endsWith('/token')){ const g=u.searchParams.get('grant_type'); if(g==='password'){ const usr=users.get(body.email); if(!usr||usr.password!==body.password) return json(400,{error_description:'Invalid login credentials'}); if(!usr.confirmed) return json(400,{msg:'Email not confirmed'}); return json(200,tok(usr)); } if(g==='refresh_token'){ const usr=[...users.values()].find(x=>'r-'+x.id===body.refresh_token); return usr?json(200,tok(usr)):json(400,{msg:'bad refresh'}); } }
    if(p.endsWith('/logout')) return route.fulfill({status:204,headers:CORS});
    return json(404,{msg:'nf'});
  }
  if(p.startsWith('/rest/v1/')){
    const h={}; for(const [k,v] of Object.entries(req.headers())) if(['authorization','prefer','range','range-unit','content-type'].includes(k)) h[k]=v;
    if(h.authorization&&h.authorization.includes('cN7cCFjJI6RX0cnlhuJn3')) delete h.authorization; /* локально подпись anon-ключа не проверить */
    const r=await fetch(PGR+p.slice(8)+u.search,{method:req.method(),headers:h,body:['GET','HEAD'].includes(req.method())?undefined:req.postData()});
    const buf=Buffer.from(await r.arrayBuffer()); const hh={...CORS}; r.headers.forEach((v,k)=>{ if(['content-type','content-range'].includes(k)) hh[k]=v; });
    return route.fulfill({status:r.status,headers:hh,body:buf});
  }
  if(p.startsWith('/storage/v1/object/')){
    if(req.method()==='POST'){ files.set(p.replace('/storage/v1/object/',''),req.postDataBuffer()); return json(200,{Key:p}); }
    const k=p.replace('/storage/v1/object/authenticated/',''); const f=files.get(k); return f?route.fulfill({status:200,headers:{...CORS,'content-type':'image/jpeg'},body:f}):json(404,{message:'nf'});
  }
  return route.fulfill({status:404,headers:CORS,body:'{}'});
}
const errs=[],ok=[]; const chk=(c,m)=>{(c?ok:errs).push((c?'OK   ':'FAIL ')+m);};
(async()=>{
db=new Client({host:'127.0.0.1',port:5544,user:'postgres',database:'t2'}); await db.connect();
const key=(await db.query("select public.create_school_key('test') k")).rows[0].k;
const b=await chromium.launch();
const mk=async(name)=>{ const ctx=await b.newContext({viewport:{width:1280,height:850}}); await ctx.route('**/*.supabase.co/**',mock); const pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(name+' PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push(name+' CONSOLE '+m.text())}); pg.on('dialog',d=>d.accept()); await pg.goto('http://localhost:8765/'); await pg.waitForSelector('.auth'); return {ctx,pg}; };
const fill=async(pg,o)=>{ for(const [k,v] of Object.entries(o)){ const el=await pg.$(`[name=${k}]`); if(!el) throw new Error('no field '+k); const tag=await el.evaluate(e=>e.tagName); if(tag==='SELECT') await pg.selectOption(`[name=${k}]`,v); else await pg.fill(`[name=${k}]`,v);} };
async function otp(pg,first){ if(!CONFIRM) return; await pg.waitForSelector('form[data-form=verify]',{timeout:8000}); if(first){ await pg.fill('[name=otp]','000000'); await pg.click('form[data-form=verify] button[type=submit]'); await pg.waitForSelector('.errmsg',{timeout:8000}); chk((await pg.$eval('.errmsg',e=>e.innerText)).includes('Код неверный'),'wrong otp rejected'); } await pg.fill('[name=otp]','123456'); await pg.click('form[data-form=verify] button[type=submit]'); }
async function register(pg,role,code,prof,email){
  await pg.click('[data-act=auth-mode][data-v=register]'); await pg.click(`[data-act=auth-role][data-v=${role}]`);
  await pg.fill('[name=code]',code); await pg.click('form[data-form=regcode] button[type=submit]');
  await pg.waitForSelector('form[data-form=regprofile]',{timeout:8000});
  await fill(pg,prof); await pg.click('form[data-form=regprofile] button[type=submit]'); await pg.waitForSelector('form[data-form=regaccount]');
  await fill(pg,{email,password:'Passw0rd!',password2:'Passw0rd!'}); await pg.check('[name=consent]'); await pg.click('form[data-form=regaccount] button[type=submit]'); await otp(pg,false);
}
// ===== директор =====
const D=await mk('dir'); const dp=D.pg;
// bad key first
await dp.click('[data-act=auth-mode][data-v=register]'); await dp.click('[data-act=auth-role][data-v=director]'); await dp.fill('[name=code]','SABAK-AAAA-BBBB-CCCC'); await dp.click('form[data-form=regcode] button[type=submit]'); await dp.waitForSelector('form[data-form=regprofile]');
await fill(dp,{last:'Бекова',first:'Нурзат',mid:'Айтматовна',birth:'1980-05-05',gender:'f',phone:'+996700111222',school:'Школа №12',city:'Бишкек'}); await dp.click('form[data-form=regprofile] button[type=submit]'); await fill(dp,{email:'dir@x.kg',password:'Passw0rd!',password2:'Passw0rd!'}); await dp.check('[name=consent]'); await dp.click('form[data-form=regaccount] button[type=submit]'); await otp(dp,true);
await dp.waitForSelector('.errmsg',{timeout:10000}); chk((await dp.$eval('.errmsg',e=>e.innerText)).includes('Ключ школы неверный'),'bad school key rejected');
// профиль не создан: теперь вход и завершение регистрации с верным ключом
await dp.screenshot({path:'tests/out/60_bad_key.png'});
await dp.goto('http://localhost:8765/'); await dp.waitForSelector('.auth');
await dp.waitForSelector('form[data-form=regprofile]',{timeout:10000}); chk(true,'needsProfile screen after bad key');
await dp.selectOption('[name=role]','director'); await fill(dp,{code:key,last:'Бекова',first:'Нурзат',phone:'+996700111222',school:'Школа №12',city:'Бишкек',birth:'1980-05-05'}); await dp.click('form[data-form=regprofile] button[type=submit]');
await dp.waitForSelector('.top',{timeout:15000}); chk((await dp.$eval('.usr-b',e=>e.innerText)).includes('Директор'),'director registered & logged in');
await dp.screenshot({path:'tests/out/61_live_empty.png'});
await dp.click('[data-act=seed-demo]'); await dp.waitForSelector('.kpis .kpi b',{timeout:20000}); await dp.waitForFunction(()=>window.__sabak.S.state().students.length===16,null,{timeout:20000}); chk(true,'demo data seeded; students=16');
await dp.waitForTimeout(500); await dp.screenshot({path:'tests/out/62_live_overview.png',fullPage:true});
chk((await dp.$$eval('.kpi b',e=>e.map(x=>x.innerText)))[0]!=='—','analytics computed from live data');
// приглашение учителю
await dp.evaluate(()=>location.hash='#/admin/access'); await dp.waitForSelector('form[data-form=invite]'); await dp.selectOption('[name=role]','teacher'); await dp.fill('[name=tail]','4521'); await dp.click('form[data-form=invite] button[type=submit]'); await dp.waitForSelector('.codebox b');
const tcode=await dp.$eval('.codebox b',e=>e.innerText); chk(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(tcode),'teacher invite code '+tcode);
// ===== учитель =====
const T=await mk('teacher'); const tp=T.pg;
await tp.click('[data-act=auth-mode][data-v=register]'); await tp.click('[data-act=auth-role][data-v=teacher]'); await tp.fill('[name=code]',tcode); await tp.click('form[data-form=regcode] button[type=submit]'); await tp.waitForTimeout(1500); await tp.waitForSelector('form[data-form=regprofile]');
await fill(tp,{last:'Эсенова',first:'Гульнара',phone:'+996 555 004521',birth:'1985-01-01'}); await tp.click('form[data-form=regprofile] button[type=submit]'); await fill(tp,{email:'t1@x.kg',password:'Passw0rd!',password2:'Passw0rd!'}); await tp.check('[name=consent]'); await tp.click('form[data-form=regaccount] button[type=submit]'); await otp(tp,false);
await tp.waitForSelector('.pend',{timeout:15000}); chk(true,'teacher is pending after redeem'); await tp.screenshot({path:'tests/out/63_pending.png'});
// директор подтверждает
await dp.reload(); await dp.waitForSelector('.top'); await dp.evaluate(()=>location.hash='#/admin/access'); await dp.waitForSelector('.staff.pending',{timeout:15000});
await dp.click('[data-act=staff-ok]'); await dp.waitForSelector('.assign',{timeout:15000}); chk(true,'director approved teacher');
// назначаем 9А: математика
await dp.click('.assign .as-row:nth-child(1) [data-act=assign][data-s=math]'); await dp.waitForFunction(()=>{const t=window.__sabak.S.state().staff.find(s=>s.role==='teacher');return t&&t.subjects.includes('math')},null,{timeout:15000});
await dp.selectOption('[data-act=homeroom][data-cls="9А"]',{index:1}); await dp.waitForFunction(()=>window.__sabak.S.state().classes.find(c=>c.name==='9А').homeroom,null,{timeout:15000}); chk(true,'assigned math in 9А and homeroom');
await tp.click('[data-act=auth-refresh]'); await tp.waitForSelector('.jrow',{timeout:20000}); chk(true,'teacher journal visible after approval'); await tp.screenshot({path:'tests/out/64_teacher_live.png'});
// выставляем оценку
const before=(await db.query("select count(*)::int c from grades")).rows[0].c;
await tp.click('.jrow:nth-child(1) .gb.g5'); await tp.waitForFunction(()=>window.__sabak.S.pending()===0,null,{timeout:15000});
const after=(await db.query("select count(*)::int c from grades")).rows[0].c; chk(after===before+1,'grade written to DB through queue');
await tp.click('.jrow:nth-child(2) .ab.n'); await tp.waitForFunction(()=>window.__sabak.S.pending()===0,null,{timeout:15000});
chk((await db.query("select count(*)::int c from attendance where status='n' and \"by\" is not null")).rows[0].c===1,'attendance upsert written');
await tp.click('[data-act=undo]'); await tp.waitForFunction(()=>window.__sabak.S.pending()===0,null,{timeout:15000}); chk((await db.query("select count(*)::int c from attendance where status='n' and \"by\" is not null")).rows[0].c===0,'undo attendance deleted in DB');
// новый ученик + код
await tp.fill('form[data-form=student] input[name=name]','Новый Ученик'); await tp.click('form[data-form=student] button[type=submit]'); await tp.waitForSelector('.okmsg b',{timeout:15000}); const scode=await tp.$eval('.okmsg b',e=>e.innerText); chk(/^[A-Z0-9]{4}-/.test(scode),'student added with invite code '+scode);
// код родителя через страницу учеников
await tp.evaluate(()=>location.hash='#/teacher/students'); await tp.waitForSelector('.stgrid'); await tp.waitForTimeout(2500); await tp.click('.stc:has-text("Новый Ученик") [data-act=inv-parent]'); await tp.waitForSelector('.codebox b'); const pcode=await tp.$eval('.codebox b',e=>e.innerText);
// ===== родитель =====
const P=await mk('parent'); const pp=P.pg;
await pp.click('[data-act=auth-mode][data-v=register]'); await pp.click('[data-act=auth-role][data-v=parent]'); await pp.fill('[name=code]',pcode); await pp.click('form[data-form=regcode] button[type=submit]'); await pp.waitForSelector('.peek.ok,form[data-form=regprofile]');
await fill(pp,{last:'Родитель',first:'Тест',phone:'+996700000001',relation:'mother'}); await pp.click('form[data-form=regprofile] button[type=submit]'); await fill(pp,{email:'p@x.kg',password:'Passw0rd!',password2:'Passw0rd!'}); await pp.check('[name=consent]'); await pp.click('form[data-form=regaccount] button[type=submit]'); await otp(pp,false);
await pp.waitForSelector('.top',{timeout:15000}); chk(true,'parent registered by code'); await pp.waitForSelector('.dos-head,.hd',{timeout:5000});
await pp.evaluate(()=>location.hash='#/parent/dossier'); await pp.waitForSelector('.dos-head',{timeout:15000}); chk((await pp.$eval('.acc',e=>e.innerText)).includes('Можно редактировать'),'parent edits dossier (live)');
await pp.fill('#dos-char','Живая характеристика'); await pp.click('[data-act=dos-save-char]'); await pp.waitForFunction(()=>window.__sabak.S.pending()===0,null,{timeout:15000});
chk((await db.query("select characteristic from dossiers")).rows.some(r=>r.characteristic==='Живая характеристика'),'dossier stored in DB');
// фото: родитель грузит с подменой проверки
await pp.evaluate(()=>{window.__faceStub=async f=>{const c=document.createElement('canvas');c.width=48;c.height=64;c.getContext('2d').fillRect(0,0,48,64);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg'));return {ok:true,checks:[],meta:{verified:true,faces:1},failed:[],blob};}});
// учитель предупреждает о фото
await tp.click('.stc:has-text("Новый Ученик") [data-act=warn-one]'); await tp.waitForTimeout(800);
chk((await db.query("select count(*)::int c from notifications where kind='photo_warning'")).rows[0].c>=1,'photo warning notification stored');
await pp.evaluate(()=>location.hash='#/parent'); await pp.reload(); await pp.waitForSelector('.top'); await pp.waitForSelector('.banner [data-act=photo-open]',{timeout:15000}); chk(true,'parent sees photo warning banner (live)');
await pp.evaluate(()=>{ window.__faceStub=async f=>{const c=document.createElement('canvas');c.width=48;c.height=64;const x=c.getContext('2d');x.fillStyle='#bbb';x.fillRect(0,0,48,64);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg'));return {ok:true,checks:[{id:'one',label:'Одно лицо в кадре',ok:true,detail:'найдено 1'}],meta:{verified:true,faces:1},failed:[],blob};}; });
await pp.click('.banner [data-act=photo-open]'); await pp.waitForSelector('[data-photo]',{state:'attached'}); await pp.setInputFiles('[data-photo]:not([capture])',{name:'a.jpg',mimeType:'image/jpeg',buffer:Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64')});
await pp.waitForSelector('[data-act=photo-save]'); await pp.click('[data-act=photo-save]'); await pp.waitForSelector('.modal',{state:'detached',timeout:15000});
chk((await db.query("select count(*)::int c from students where photo_path is not null")).rows[0].c===1,'photo path saved via RPC');
// ===== ученик =====
const St=await mk('student'); const sp=St.pg;
await sp.click('[data-act=auth-mode][data-v=register]'); await sp.click('[data-act=auth-role][data-v=student]'); await sp.fill('[name=code]',scode); await sp.click('form[data-form=regcode] button[type=submit]'); await sp.waitForSelector('form[data-form=regprofile]');
await fill(sp,{last:'Ученик',first:'Новый',birth:'2010-03-03'}); await sp.click('form[data-form=regprofile] button[type=submit]'); await fill(sp,{email:'s@x.kg',password:'Passw0rd!',password2:'Passw0rd!'}); await sp.check('[name=consent]'); await sp.click('form[data-form=regaccount] button[type=submit]'); await otp(sp,false);
await sp.waitForSelector('.top',{timeout:15000}); chk(true,'student registered');
await sp.evaluate(()=>location.hash='#/dossier/'+window.__sabak.S.me().id); await sp.waitForSelector('.lock',{timeout:10000}); chk(true,'student blocked from dossier');
const cnt=await sp.evaluate(()=>window.__sabak.S.state().students.length); chk(cnt===1,'student sees only himself ('+cnt+')');
// reuse of one-time code
const X=await mk('evil'); await X.pg.click('[data-act=auth-mode][data-v=register]'); await X.pg.click('[data-act=auth-role][data-v=student]'); await X.pg.fill('[name=code]',scode); await X.pg.click('form[data-form=regcode] button[type=submit]'); await X.pg.waitForSelector('.errmsg',{timeout:10000}); chk(true,'used code rejected on peek');
// выход/вход
await sp.click('[data-act=menu]'); await sp.click('[data-act=logout]'); await sp.waitForSelector('.auth'); if(await sp.$('[data-act=auth-mode][data-v=login]')) await sp.click('[data-act=auth-mode][data-v=login]'); await sp.fill('[name=email]','s@x.kg'); await sp.fill('[name=password]','bad'); await sp.click('form[data-form=login] button[type=submit]'); await sp.waitForSelector('.errmsg'); chk((await sp.$eval('.errmsg',e=>e.innerText)).includes('Неверная почта'),'bad password message');
console.log(ok.join('\n')); console.log(errs.length?errs.join('\n'):'NO ERRORS'); await db.end(); await b.close();})().catch(e=>{console.log(ok.join('\n'));console.log('FATAL',e.message.split('\n').slice(0,25).join('\n'),'\n',errs.join('\n'));process.exit(1)});
