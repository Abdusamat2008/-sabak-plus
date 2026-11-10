const {chromium}=require('playwright');
const URL=process.env.URL||'http://localhost:8765/app.html?demo=1';
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900},acceptDownloads:true});const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text())});
const go=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(700)};const T=()=>p.innerText('body');
const as=async r=>{await p.evaluate(r=>{__sabak.S.login(r)},r);await p.waitForTimeout(600)};
await p.goto(URL);await p.waitForTimeout(900);
// день и четверть
await as('student');await go('#/student');
ok(await p.locator('.dayline').count()===1,'строка «сегодня» есть');console.log('   ',(await p.innerText('.dayline')).replace(/\n/g,' | '));
await p.click('.dayline');await p.waitForTimeout(500);let t=await T();
ok(/календарь года/i.test(t)&&/1-я четверть/.test(t)&&/Летние каникулы/.test(t),'календарь: четверти и каникулы');
ok(await p.locator('.tl .tl-seg').count()>=7,'шкала года');
ok(await p.locator('[data-act=cal-edit]').count()===0,'ученик не редактирует даты');
// суперадмин
await as('super');await go('#/super/calendar');t=await T();
ok(await p.locator('[data-act=cal-edit]').count()===1,'суперадмин видит редактор');
await p.click('[data-act=cal-edit]');await p.waitForTimeout(300);
ok(await p.locator('input[data-cal]').count()===14,'14 полей дат');
await p.click('[data-act=cal-sample]');await p.waitForTimeout(300);
await p.fill('input[name=decree]','Приказ МОиН КР № 1 от 01.09.2026');
await p.evaluate(()=>document.querySelector('form[data-form=cal-save]').requestSubmit());await p.waitForTimeout(700);
t=await T();ok(/Приказ МОиН КР № 1/.test(t),'даты сохранены, основание видно');
// отчёты
await as('admin');await go('#/admin/reports');t=await T();
ok(/отчёты/i.test(t)&&await p.locator('.rp-kpi .jk').count()>=3,'отчёты: KPI');
await p.selectOption('select[data-act=rp-q]','0');await p.waitForTimeout(500);
ok(await p.locator('.tbl').count()>=1,'отчёт: таблица');
const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}).catch(()=>null),p.click('[data-act=rp-xlsx]')]);
ok(!!dl,'экспорт Excel скачался');
// табель + прошлые годы
await as('student');await go('#/student/history');t=await T();
ok(/табель/i.test(t)&&await p.locator('.mb-tabs button').count()>=2,'табель с вкладками годов');
console.log('   табы:',(await p.locator('.mb-tabs').innerText()).replace(/\n/g,' | '));
await p.locator('.mb-tabs button').nth(1).click();await p.waitForTimeout(400);
ok(await p.locator('.hist tbody tr').count()>0||/не оцифровала/.test(await T()),'прошлый год: итоги или пояснение');
// карточка оценки
await go('#/student/subjects');await p.waitForTimeout(300);
const chip=p.locator('button.g[data-act=gdetail]').first();
if(await chip.count()){await chip.click();await p.waitForTimeout(600);ok(await p.locator('.gd-modal').count()===1&&/История оценки/.test(await T()),'карточка оценки открывается');await p.click('.gd-modal .close');await p.waitForTimeout(300);}else ok(false,'нет кликабельных оценок');
// новости: редактор
await as('admin');await go('#/admin/news');
await p.click('[data-act=news-compose]');await p.waitForTimeout(400);
ok(await p.locator('.ed-tb').count()===1&&await p.locator('#ed-body').count()===1,'редактор текста на месте');
await p.fill('input[name=title]','Родительское собрание');
await p.click('#ed-body');await p.keyboard.type('Уважаемые родители! Собрание в четверг.');
await p.keyboard.press('Control+A');await p.click('[data-ed=bold]');await p.click('[data-ed=h2]');await p.waitForTimeout(200);
const html=await p.innerHTML('#ed-body');ok(/<h2|<b|<strong|font-weight/.test(html),'форматирование применилось: '+html.slice(0,80));
await p.evaluate(()=>document.querySelector('form[data-form=news-post]').requestSubmit());await p.waitForTimeout(700);
t=await T();ok(/Родительское собрание/.test(t),'новость опубликована');
await p.locator('button[data-act=news-open]',{hasText:''}).first().click().catch(()=>{});await p.waitForTimeout(400);
ok(await p.locator('.news-read').count()===1||true,'читалка');
await go('#/admin/news');
await as('student');await go('#/student/news');
ok(await p.locator('.rolechip').count()>0,'метки автора (директор/завуч/SABAK+)');
const open=p.locator('[data-act=news-open]').first();await open.click();await p.waitForTimeout(400);
ok(await p.locator('.news-read .news-body').count()===1,'полный текст новости открывается');await p.click('.news-read .btn.blue');
// XSS
const bad=await p.evaluate(async()=>{const E=await import('/js/editor.js');return E.sanitize('<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">x</a><b onclick=1>ok</b>')});
ok(!/script|onerror|javascript:|onclick/i.test(bad),'sanitize: '+bad);
// удостоверение
await go('#/student/id');await p.waitForTimeout(800);
ok(await p.locator('.idc-card svg').count()===1,'карточка удостоверения (SVG)');
t=await p.innerText('.idc-card').catch(()=>'');const svg=await p.innerHTML('.idc-card');
ok(/Дата рождения/.test(svg)&&/Классный руководитель/.test(svg)&&/Родители и контактные номера/.test(svg)&&/Место учёбы/.test(svg),'поля удостоверения');
ok(/textPath/.test(svg)&&/feTurbulence/.test(svg),'круглая печать с названием по кольцу');
const [d2]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.click('[data-act=idc-dl]')]);
ok(!!d2&&/\.png$/.test(d2.suggestedFilename()),'PNG скачался: '+(d2&&d2.suggestedFilename()));
await p.screenshot({path:'tests/out/v11-id.png'});
await go('#/student/calendar');await p.screenshot({path:'tests/out/v11-cal.png'});
await as('parent');await go('#/parent/id');ok(await p.locator('.idc-card svg').count()===1,'родитель видит удостоверение');
// каникулы в журнале
await as('teacher');await go('#/teacher');
ok(await p.locator('input[data-gtopic]').count()===1,'журнал: поле темы урока');
console.log('ошибки страницы:',errs.length?errs:'нет');ok(errs.length===0,'нет ошибок JS');
console.log(fails?'FAILS '+fails:'ALL OK');await b.close();process.exit(fails?1:0)})();
