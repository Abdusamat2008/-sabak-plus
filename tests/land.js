const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [n,w,h] of [['d',1360,860],['m',390,800]]){
 const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2500);
 await p.screenshot({path:`tests/out/land-${n}-0.png`});
 const H=await p.evaluate(()=>document.documentElement.scrollHeight);
 let i=1;for(let y=h*0.9;y<H;y+=h*1.1){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(700);if(i<=16)await p.screenshot({path:`tests/out/land-${n}-${i}.png`});i++}
 const ow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 console.log(n,'H',H,'overflowX',ow,'errs',errs);
 if(n==='d'){await p.evaluate(()=>document.querySelector('#calc').scrollIntoView());await p.click('.gbtns [data-g="5"]');await p.click('.gbtns [data-g="4"]');await p.click('.seg [data-type=test]');await p.click('.gbtns [data-g="3"]');console.log(await p.textContent('#cAvg'),await p.textContent('#cFin'),await p.textContent('#cNeed'))}
}
await b.close()})();
