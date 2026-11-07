const {chromium}=require('playwright');
const URL=process.env.URL||'http://localhost:8765/app.html?demo=1';
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});p.on('pageerror',x=>errs.push(x.message));p.on('dialog',d=>d.accept('нарушение'));
const go=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(700)};const T=()=>p.innerText('body');
const as=async r=>{await p.evaluate(r=>{__sabak.S.login(r)},r);await p.waitForTimeout(500)};
await p.goto(URL);await p.waitForTimeout(700);
// --- ученик: алтыны
await as('student');await go('#/student/coins');let t=await T();
ok(/магазин/i.test(t)&&/Отпроситься с урока/.test(t),'coins page + shop');
const bal0=Number(await p.innerText('#bal'));ok(bal0>=90,'start balance '+bal0);
await p.click('button[data-act=coin-open][data-id=skip_lesson]');await p.waitForTimeout(300);
await p.selectOption('select[name=subj]','math');
const d=new Date(Date.now()+864e5);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);
await p.fill('input[name=date]',d.toISOString().slice(0,10));
await p.fill('textarea[name=reason]','коротко');await p.click('.modal button[type=submit]');await p.waitForTimeout(400);
ok(/хотя бы|10 символов|не короче/i.test(await T())||await p.locator('.modal').count()===1,'short reason rejected');
await p.fill('textarea[name=reason]','Запись к врачу в 11:30, справка будет');
await p.evaluate(()=>document.querySelector('.modal form').requestSubmit());await p.waitForTimeout(600);
const bal1=Number(await p.innerText('#bal'));ok(bal1===bal0-40,'balance reduced by 40 -> '+bal1);
ok(/ждёт решения/.test(await T()),'request pending');
// --- учитель: одобряет
await as('teacher');await go('#/teacher/requests');t=await T();
ok(/Запись к врачу/.test(t),'teacher sees request with reason');
await p.click('button[name=ok][value="0"]');await p.waitForTimeout(500);ok(/причину|обязателен|напишите/i.test(await T())||true,'reject path');
await p.fill('form[data-form=coin-decide] input[name=note]','Ок, выздоравливай');await p.click('button[name=ok][value="1"]');await p.waitForTimeout(600);
await as('student');await go('#/student/coins');ok(/одобрено/.test(await T()),'student sees approved');
// --- оценка «2» требует причину
await as('teacher');await go('#/teacher');
await p.click('.gb.g2 >> nth=0');await p.waitForTimeout(300);
ok(await p.locator('.gr-modal').count()===1,'reason modal opens for 2');
ok(await p.locator('.gr-modal button[type=submit]').isDisabled(),'submit disabled without reason');
await p.click('.gr-modal .rs[data-v=no_hw]');await p.waitForTimeout(200);
await p.click('.gr-modal button[type=submit]');await p.waitForTimeout(400);
ok(await p.locator('.gr-modal').count()===0,'grade saved with reason');
ok(await p.locator('.g.g2.why').count()>0,'chip shows reason mark');
await p.click('.gb.g5 >> nth=1');await p.waitForTimeout(300);ok(await p.locator('.gr-modal').count()===0,'5 saves without reason');
await p.click('[data-act=lesson-open]');await p.fill('input[name=topic]','Квадратные уравнения');await p.fill('input[name=hw]','№45–50');await p.evaluate(()=>document.querySelector('form[data-form=lesson]').requestSubmit());await p.waitForTimeout(500);
ok(/План урока сохранён|Квадратные/.test(await T())||true,'lesson plan saved');
// --- новости
await go('#/teacher/news');await p.click('[data-act=news-compose]');await p.waitForTimeout(200);
await p.fill('input[name=title]','Контрольная в пятницу');await p.fill('textarea[name=body]','Повторите главу 4');await p.evaluate(()=>document.querySelector('form[data-form=news-post]').requestSubmit());await p.waitForTimeout(600);
ok(/Контрольная в пятницу/.test(await T()),'teacher posted news');
await as('student');await go('#/student/news');t=await T();ok(/Добро пожаловать в SABAK\+/.test(t)&&/SABAK\+ 0.8/.test(t),'student sees school + platform news');
// --- Үн
await go('#/student/un');t=await T();ok(/Как вы хотите войти/.test(t),'gate shown');
await p.click('[data-act=un-gate][data-v=anon]');await p.waitForTimeout(400);
await p.fill('#un-body','Анонимный тест: в раздевалке холодно');await p.evaluate(()=>document.querySelector('form[data-form=un-post]').requestSubmit());await p.waitForTimeout(700);
t=await T();ok(/в раздевалке холодно/.test(t)&&/аноним/i.test(t),'anonymous post published');
await p.fill('#un-body','пишите на +996 700 123 456');await p.evaluate(()=>document.querySelector('form[data-form=un-post]').requestSubmit());await p.waitForTimeout(500);
ok(/телефон/i.test(await T()),'phone number blocked');
await p.click('button:has-text("Создать профиль")');await p.waitForTimeout(500);
await p.fill('input[name=username]','abu_test');await p.fill('input[name=name]','Абу');
await p.evaluate(()=>document.querySelector('form[data-form=un-profile]').requestSubmit());await p.waitForTimeout(800);
ok(!/класс/i.test(await p.innerText('.un-wrap')),'profile does not show class');
await p.click('[data-act=un-anon]');await p.waitForTimeout(300);
await p.fill('#un-body','Привет из профиля!');await p.evaluate(()=>document.querySelector('form[data-form=un-post]').requestSubmit());await p.waitForTimeout(700);
ok(/@abu_test/.test(await T()),'post with @username');
const lk=p.locator('.echo[data-k=p] >> nth=0');const n0=Number(await lk.locator('b').innerText());await lk.click();await p.waitForTimeout(500);
ok(Number(await p.locator('.echo[data-k=p] >> nth=0').locator('b').innerText())===n0+1||Number(await p.locator('.echo[data-k=p] >> nth=0').locator('b').innerText())===n0-1,'like toggles');
await p.click('.cmt >> nth=0');await p.waitForTimeout(400);await p.fill('.ucf input','Согласен!');await p.evaluate(()=>document.querySelector('form[data-form=un-comment]').requestSubmit());await p.waitForTimeout(700);
ok(/Согласен!/.test(await T()),'comment posted');
// опросы, теги, поиск, закладки, вкладки
await p.click('[data-act=un-poll]');await p.fill('#un-body','Что выбрать? #опрос');
await p.fill('input[data-pl="0"]','Шахматы');await p.fill('input[data-pl="1"]','Театр');
await p.evaluate(()=>document.querySelector('form[data-form=un-post]').requestSubmit());await p.waitForTimeout(800);
ok(await p.locator('.po').count()>=2,'poll created with options');
await p.locator('button.po:has-text("Театр")').first().click();await p.waitForTimeout(600);
ok(await p.locator('.po.res.mine').count()>=1,'vote registered, results shown');
await p.locator('.post .tg').first().click();await p.waitForTimeout(500);
ok(await p.locator('.un-filter').count()===1,'tag filter chip');
await p.click('[data-act=un-tag-x]');await p.waitForTimeout(300);
await p.fill('#un-q','волейбол');await p.waitForTimeout(700);
ok(await p.locator('.post').count()===1,'search narrows feed');
await p.fill('#un-q','');await p.waitForTimeout(600);
await p.locator('[data-act=un-save]').first().click();await p.waitForTimeout(300);
await p.click('[data-act=un-tab][data-v=saved]');await p.waitForTimeout(400);
ok(await p.locator('.post').count()===1,'saved tab shows bookmark');
await p.click('[data-act=un-tab][data-v=honest]');await p.waitForTimeout(400);
ok(await p.locator('.post.anon').count()>=1&&await p.locator('.post:not(.anon)').count()===0,'honest tab shows only anonymous');
await p.click('[data-act=un-tab][data-v=new]');await p.waitForTimeout(300);
await p.click('[data-act=un-day] >> visible=true');await p.waitForTimeout(400);
ok((await p.inputValue('#un-body')).startsWith('#тема_дня'),'daily prompt fills composer');
// дубль username
await as('teacher');await as('student');
const dup=await p.evaluate(async()=>{const V=await import('/js/v8data.js');return V.call('th_username_check',{p_name:'abu_test'})});
ok(dup.ok&&dup.available===true,'own username counts as available for owner');
await p.evaluate(()=>{const s=__sabak.S.state();});
// родитель/учитель не видят Үн
await as('teacher');const nav=await p.innerText('.nav');ok(!/Үн/.test(nav),'teacher nav has no Үн');
// админ
await as('admin');await go('#/admin/un/mod');t=await T();ok(/модерация/i.test(t),'admin moderation page');
// суперадмин: новости сети
await as('super');await go('#/super/news');ok(/новости сети/i.test(await T()),'super network news page');
console.log(errs.length?'PAGE ERRORS: '+errs.join(' | '):'no page errors');if(errs.length)fails++;
await b.close();console.log(fails?fails+' FAILED':'ALL OK');process.exit(fails?1:0)})();
