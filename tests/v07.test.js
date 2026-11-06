const {chromium}=require('playwright');
const URL=process.env.URL||'http://localhost:8765/app.html?demo=1';
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});const errs=[];p.on('pageerror',x=>errs.push(x.message));p.on('dialog',d=>d.accept());
const go=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(700)};const T=()=>p.innerText('body');
await p.goto(URL);await p.waitForTimeout(700);
// директор открывает обращение
await p.click('text=АДМИНИСТРАЦИЯ');await p.waitForTimeout(400);await go('#/admin/support');
ok(/Новое обращение/i.test(await T()),'director support page');
await p.fill('input[name=subject]','Не работает печать расписания');await p.fill('textarea[name=text]','Подскажите, как распечатать расписание класса?');await p.click('button:has-text("Отправить")');await p.waitForTimeout(800);
ok(/Не работает печать расписания/.test(await T()),'director ticket created');
// суперадмин
await p.click('.usr-b');await p.selectOption('select.roleSel','super');await p.waitForTimeout(700);
let t=await T();ok(/центр управления/i.test(t)&&/Требует внимания/i.test(t),'dashboard');ok(/открытое обращение|открытых обращени/.test(t),'dashboard shows open tickets');
await go('#/super/schools');t=await T();ok(/Школа №12/.test(t)&&/Ош/.test(t)&&/Нарын/.test(t),'schools list (5 schools)');
await p.fill('#schQ','ош');await p.waitForTimeout(300);ok(await p.locator('a.sch').count()===1,'search filters list live (1 school)');
await p.fill('#schQ','');await p.waitForTimeout(200);
await p.click('button:has-text("Приостановлены")');await p.waitForTimeout(400);ok(await p.locator('a.sch').count()===0,'filter suspended -> 0');await p.click('button:has-text("Все")');await p.waitForTimeout(300);
// карточка школы
await p.click('a.sch:has-text("Школа-лицей")');await p.waitForTimeout(800);t=await T();
ok(/Мусаев Айбек/.test(t)&&/Посещаемость/i.test(t)&&/Распределение оценок/i.test(t),'school card overview (director, KPIs, charts)');
ok(await p.locator('a.btn.wa').count()>0,'WhatsApp contact button');
await p.click('.subtabs a:has-text("Люди")');await p.waitForTimeout(500);ok(/Сотрудники/.test(await T()),'people tab');
await p.click('.subtabs a:has-text("Классы")');await p.waitForTimeout(500);ok(/Кл\. руководитель/i.test(await T()),'classes tab');
await p.click('.subtabs a:has-text("Заметки")');await p.waitForTimeout(500);await p.fill('textarea[name=text]','Звонить по вторникам');await p.click('button:has-text("Добавить")');await p.waitForTimeout(700);ok(/Звонить по вторникам/.test(await T()),'note added');
await p.click('.subtabs a:has-text("Управление")');await p.waitForTimeout(500);
await p.fill('form[data-form=sup-suspend] input[name=reason]','Тест приостановки');await p.click('button:has-text("Приостановить")');await p.waitForTimeout(800);t=await T();ok(/приостановлена/i.test(t)&&/Тест приостановки/.test(t),'school suspended with reason');
await p.click('button:has-text("Возобновить")');await p.waitForTimeout(700);ok(!/приостановлена: /i.test(await T()),'school resumed');
// директора
await go('#/super/directors');t=await T();ok(/Кадырова Асель/.test(t)&&/Исаков Бакыт/.test(t),'directors directory');
// входящие
await go('#/super/inbox');t=await T();ok(/Не работает печать расписания/.test(t)&&/Не приходит код/.test(t),'inbox: tickets incl. new from director');
await p.fill('.tkt:has-text("Не работает печать") textarea[name=text]','Откройте «Расписание» → «Печать»');await p.click('.tkt:has-text("Не работает печать") button:has-text("Отправить")');await p.waitForTimeout(800);ok(/Откройте «Расписание»/.test(await T()),'super replied');
await p.click('button:has-text("Заявки")');await p.waitForTimeout(500);t=await T();ok(/Школа №7/.test(t)&&/Ак-Жол/.test(t),'inbox: school requests');
await p.click('.req:has-text("Школа №7") button:has-text("Выдать ключ")');await p.waitForTimeout(900);t=await T();ok(/SABAK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(t)&&/Новый ключ/i.test(t),'key issued from request (shown once)');
await p.click('button:has-text("Скрыть")');await p.waitForTimeout(300);ok(!/Новый ключ/i.test(await T()),'key hidden after dismiss');
// рассылка
await go('#/super/broadcast');await p.fill('input[name=title]','Версия 0.7');await p.fill('textarea[name=body]','Появился центр управления');await p.click('button:has-text("Отправить")');await p.waitForTimeout(800);ok(/Версия 0\.7/.test(await T()),'broadcast history');
// люди
await go('#/super/users');await p.fill('input[name=q]','Жанболотов');await p.click('button:has-text("Найти")');await p.waitForTimeout(800);ok(/Эрмек Жанболотов/.test(await T()),'user search');
// журнал, система
await go('#/super/audit');ok(/Рассылка|Школа приостановлена|Выпущен ключ/.test(await T()),'audit shows super actions');
await go('#/super/system');t=await T();ok(/Размер базы/i.test(t)&&/Очистка служебных данных/i.test(t),'system page');await p.click('button:has-text("Очистить")');await p.waitForTimeout(600);ok(/Удалено/.test(await p.innerText('#toast')),'cleanup toast');
// директор получает ответ?  (демо: уведомления не моделируются) — проверим, что директор не видит центр управления
await p.click('.usr-b');await p.selectOption('select.roleSel','admin');await p.waitForTimeout(600);await go('#/super/schools');ok(!/Школы платформы|Гимназия №5/.test(await T()),'director cannot open super pages');
ok(errs.length===0,'no page errors '+errs.join(';'));
console.log(fails?'FAILED':'ALL v0.7 SUPER CHECKS PASSED');await b.close();process.exit(fails?1:0)})();
