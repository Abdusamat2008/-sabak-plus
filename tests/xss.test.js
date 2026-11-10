// Проверка редактора новостей: опасная разметка не должна проходить очистку и ничего не выполняется при показе.
const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m)}};
const V=[
 '<script>window.__pwned=1</script>','<img src=x onerror="window.__pwned=1">','<svg onload="window.__pwned=1"><circle/></svg>','<a href="javascript:window.__pwned=1">x</a>','<a href=" jav&#x09;ascript:window.__pwned=1">x</a>',
 '<a href="JaVaScRiPt:window.__pwned=1">x</a>','<a href="data:text/html,<script>window.__pwned=1</script>">x</a>','<iframe src="javascript:window.__pwned=1"></iframe>','<iframe srcdoc="<script>parent.__pwned=1</script>"></iframe>',
 '<object data="javascript:window.__pwned=1"></object>','<embed src="javascript:window.__pwned=1">','<math><mtext><table><mglyph><style><img src=x onerror=window.__pwned=1>','<form action="javascript:window.__pwned=1"><button>x</button></form>',
 '<b onclick="window.__pwned=1">x</b>','<p style="background:url(javascript:window.__pwned=1)">x</p>','<p style="color:red;position:fixed;top:0;left:0;width:100vw;height:100vh">overlay</p>','<div style="behavior:url(x)">x</div>',
 '<style>body{display:none}</style>','<link rel=stylesheet href=//evil.example/x.css>','<meta http-equiv=refresh content="0;url=javascript:window.__pwned=1">','<base href="//evil.example/">','<input autofocus onfocus="window.__pwned=1">',
 '<details open ontoggle="window.__pwned=1">x</details>','<video src=x onerror="window.__pwned=1"></video>','<audio src=x onerror="window.__pwned=1"></audio>','<body onload="window.__pwned=1">','<marquee onstart="window.__pwned=1">x</marquee>',
 '<a href="https://ok.example" onclick="window.__pwned=1" target="_self">x</a>','<font color="red" onmouseover="window.__pwned=1">x</font>','<span style="font-size:99999px">x</span>','<textarea><script>window.__pwned=1</script></textarea>',
 '<noscript><p title="</noscript><img src=x onerror=window.__pwned=1>">','<template><script>window.__pwned=1</script></template>','<svg><script>window.__pwned=1</script></svg>','&lt;script&gt;window.__pwned=1&lt;/script&gt;','<scr<script>ipt>window.__pwned=1</scr</script>ipt>',
 '<a href="//evil.example">x</a>','<a href="\\\\evil.example">x</a>','<p style="color:expression(window.__pwned=1)">x</p>','<div id="x" class="admin" data-act="news-del" data-id="1">x</div>','<button data-act="news-del" data-id="1">x</button>'
];
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('http://localhost:8765/app.html?demo=1');await p.waitForTimeout(700);
for(const v of V){const r=await p.evaluate(async v=>{const E=await import('/js/editor.js');const out=E.sanitize(v);const box=document.createElement('div');box.innerHTML=E.render(v,'html');document.body.appendChild(box);await new Promise(r=>setTimeout(r,60));
  const allowed=new Set(['P','BR','B','STRONG','I','EM','U','S','STRIKE','H2','H3','UL','OL','LI','BLOCKQUOTE','HR','A','SPAN','DIV','MARK']);const bad=[];
  box.querySelectorAll('*').forEach(e=>{if(!allowed.has(e.tagName))bad.push('tag:'+e.tagName);[...e.attributes].forEach(a=>{if(!['href','target','rel','style'].includes(a.name))bad.push('attr:'+a.name);if(a.name==='href'&&!/^(https?:|mailto:|tel:)/i.test(a.value))bad.push('href:'+a.value);if(a.name==='style'&&/url\(|expression|position|behavior|width|height|top|left/i.test(a.value))bad.push('style:'+a.value)})});
  const res={bad,pwned:!!window.__pwned,out};box.remove();return res},v);
 ok(!r.pwned,'выполнился код: '+v);ok(!r.bad.length,v+' => '+r.bad.join(',')+' | '+r.out);}
console.log(fails?'FAILS '+fails:'XSS: ALL '+V.length+' OK');await b.close();process.exit(fails?1:0)})();
