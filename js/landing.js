(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
document.documentElement.classList.add('js');
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

/* ---- экраны телефона ---- */
const G=(a)=>a.map(n=>`<span class="g g${n}">${n}</span>`).join('');
const SCREENS=[
`<h4>Журнал · 9А</h4><div class="t">Математика</div><div class="card"><div class="row"><b>Алия К.</b><span class="pillx ok">стабильно</span></div><div class="gs" style="margin-top:8px">${G([5,5,4,5])}</div></div><div class="card"><div class="row"><b>Бекзат М.</b><span class="pillx">Н</span></div><div class="gs" style="margin-top:8px">${G([3,4])}</div></div><div class="card"><b>Айдана С.</b><div class="gs" style="margin-top:8px">${G([5,5,5,5,5])}</div></div><div class="toast">Сохранено · Отменить</div>`,
`<h4>Четверть</h4><div class="t">Как считается оценка</div><div class="card"><div class="row"><span>Домашние ×1</span><div class="gs">${G([5,4])}</div></div><div class="row" style="margin-top:6px"><span>Контрольная ×2</span><div class="gs">${G([5])}</div></div></div><div class="card blue"><div class="row"><span>Среднее</span><b style="font-size:1.4rem">4,75</b></div><div class="row"><span>Четвертная</span><b style="font-size:1.4rem">5</b></div></div><div class="card"><small>Ещё 2 пятёрки — и оценка станет «5» уверенно</small><div class="bar" style="margin-top:8px"><i style="width:80%"></i></div></div>`,
`<h4>Жардамчы AI</h4><div class="t">Совет, а не приговор</div><div class="card blue">Алгебра немного просела за 3 недели. Попробуйте повторить тему «Дроби» — это займёт 20 минут.</div><div class="card">⚠️ Оценка «2» у ученика со средним 4,8 — проверьте, нет ли ошибки ввода.</div><div class="card">💪 Алия вышла из просадки — отметьте успех!</div><small style="color:#666;margin-top:auto">Оценки ставит только учитель.</small>`,
`<h4>Мой дневник</h4><div class="t">Понедельник</div><div class="lines"><div><small>8:00</small>Алгебра <small>к.12</small></div><div><small>8:50</small>Литература</div><div><small>9:40</small>Физика <small>к.21</small></div><div><small>10:40</small>История</div><div><small>11:30</small>Англ. язык</div><div><small>12:20</small>Физкультура</div></div><div class="card" style="box-shadow:none"><small>Д/з</small><br>Алгебра · №124–128</div>`,
`<h4>Достижения</h4><div class="t">30 дней без «Н»</div><div class="card blue" style="text-align:center"><div style="font-size:3rem">🔥</div><b>Железная дисциплина</b><br><small>Новое достижение!</small></div><div class="card"><div class="row"><span>Прогресс «Огонь из пятёрок»</span><b>5/7</b></div><div class="bar" style="margin-top:6px"><i style="width:71%"></i></div></div><div class="toast">🔔 Родителям отправлено</div>`,
`<h4>Связь</h4><div class="t">Оффлайн</div><div class="card" style="background:#fdeceb;border-color:#a3231c;box-shadow:3px 3px 0 #a3231c">📡 Нет сети — изменения сохранены на устройстве</div><div class="card">В очереди: 3 оценки</div><div class="big" style="font:700 3rem var(--head);color:#2352D8;text-align:center;margin-top:10px" id="qn">3</div><div class="card blue" style="margin-top:auto">✓ Связь вернулась — отправлено</div>`
];
function mount(root){const s=$('.screens',root);s.innerHTML=SCREENS.map((h,i)=>`<div class="scr" data-i="${i}">${h}</div>`).join('');return s}
const heroS=mount($('#heroPhone')),storyS=mount($('#storyPhone'));
let heroI=0;const show=(s,i)=>$$('.scr',s).forEach((e,k)=>e.classList.toggle('on',k===i));
show(heroS,0);show(storyS,0);
if(!RM)setInterval(()=>{if(scrollY<innerHeight*1.2){heroI=(heroI+1)%SCREENS.length;show(heroS,heroI)}},3200);

/* ---- загрузка ---- */
requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.classList.add('loaded')));
document.documentElement.classList.contains('loaded');
addEventListener('load',()=>document.body.classList.add('loaded'));
document.documentElement.addEventListener('x',()=>{});
const setLoaded=()=>{document.body.classList.add('loaded')};setTimeout(setLoaded,50);

/* ---- reveal ---- */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15,rootMargin:'0px 0px -6% 0px'});
$$('.rv').forEach(e=>io.observe(e));

/* ---- слова ---- */
const wordEls=$$('[data-words]').map(p=>{const t=p.textContent.trim().split(/\s+/);p.setAttribute('aria-label',p.textContent.trim());p.innerHTML=t.map(w=>`<span class="w" aria-hidden="true">${w}</span>`).join(' ');return{p,w:$$('.w',p)}});

/* ---- счётчики и бары ---- */
const fmt=(n)=>Math.round(n);
const cio=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;cio.unobserve(e.target);const el=e.target,to=+el.dataset.count,suf=el.dataset.suf||'';if(RM){el.textContent=to+suf;return}const t0=performance.now(),D=1800;(function f(t){const k=clamp((t-t0)/D),v=1-Math.pow(1-k,4);el.textContent=fmt(to*v)+suf;if(k<1)requestAnimationFrame(f)})(t0)}),{threshold:.6});
$$('[data-count]').forEach(e=>{if(RM){e.textContent=e.dataset.count+(e.dataset.suf||'')}else cio.observe(e)});
const bio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){$$('.bar',e.target).forEach((b,i)=>setTimeout(()=>{$('u',b).style.width=b.dataset.v+'%'},i*120));bio.unobserve(e.target)}}),{threshold:.3});
const bars=$('#bars');if(bars)bio.observe(bars);

/* ---- scroll-linked ---- */
const nav=$('#nav'),prog=$('.progress i'),hero=$('#hero'),story=$('#story'),steps=$$('.step'),chain=$('#chain'),root=document.documentElement;
let curStep=-1,tick=false;
function onScroll(){tick=false;const y=scrollY,H=innerHeight,max=document.documentElement.scrollHeight-H;
 nav.classList.toggle('s',y>20);root.style.setProperty('--sp',max>0?(y/max).toFixed(4):0);
 root.style.setProperty('--hp',clamp(y/(H*.9)).toFixed(3));
 if(!RM)wordEls.forEach(({p,w})=>{const r=p.getBoundingClientRect();const k=clamp((H*.85-r.top)/(H*.6+r.height));const n=Math.round(k*w.length*1.15);w.forEach((e,i)=>e.classList.toggle('on',i<n))});
 else wordEls.forEach(({w})=>w.forEach(e=>e.classList.add('on')));
 if(story){const r=story.getBoundingClientRect();root.style.setProperty('--sr',clamp(-r.top/(r.height-H)).toFixed(3));
  let best=0,bd=1e9;steps.forEach((s,i)=>{const b=s.getBoundingClientRect(),d=Math.abs(b.top+b.height/2-H*(innerWidth>860?.5:.62));if(d<bd){bd=d;best=i}});
  steps.forEach((s,i)=>s.classList.toggle('on',i===best));
  if(best!==curStep){curStep=best;show(storyS,best)}}
 if(chain){const r=chain.getBoundingClientRect();root.style.setProperty('--cl',clamp((H*.8-r.top)/(r.height+H*.2)).toFixed(3))}
}
addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(onScroll)}},{passive:true});addEventListener('resize',onScroll);onScroll();

/* ---- калькулятор ---- */
const st={list:[],type:'hw'};const cc=$('#chips'),cAvg=$('#cAvg'),cFin=$('#cFin'),cNeed=$('#cNeed');
const round=x=>Math.floor(x+.5+1e-9);
function calc(){const L=st.list;if(!L.length){cAvg.textContent='—';cFin.textContent='—';cNeed.textContent='Поставьте первую оценку';cc.innerHTML='';return}
 const sw=L.reduce((a,o)=>a+o.g*o.w,0),w=L.reduce((a,o)=>a+o.w,0),avg=sw/w,fin=round(avg);
 cAvg.textContent=avg.toFixed(2).replace('.',',');cFin.textContent=fin;cFin.style.transform='scale(1.15)';setTimeout(()=>cFin.style.transform='',250);
 let msg;if(fin>=5)msg='Максимум! Держите уровень 💪';else{const target=fin+.5;let n=0,s=sw,ww=w;while(s/ww<target-1e-9&&n<60){s+=5;ww+=1;n++}msg=n>=60?'До следующей оценки далеко — но шанс есть':`Ещё ${n} ${n===1?'пятёрка':n<5?'пятёрки':'пятёрок'} — и будет «${fin+1}»`}
 cNeed.textContent=msg;
 const g=['','','g2','g3','g4','g5'];cc.innerHTML=L.map(o=>`<span class="c ${g[o.g]} ${o.w>1?'t':''}" style="background:${{5:'#2352D8',4:'#1F9D6B',3:'#E2A33B',2:'#D6443F'}[o.g]};${o.g===3?'color:#111':''}">${o.g}</span>`).join('')}
$$('.seg button').forEach(b=>b.addEventListener('click',()=>{$$('.seg button').forEach(x=>x.classList.toggle('on',x===b));st.type=b.dataset.type}));
$$('.gbtns button').forEach(b=>{const c={5:'#2352D8',4:'#1F9D6B',3:'#E2A33B',2:'#D6443F'}[b.dataset.g];b.style.background=c;if(b.dataset.g==='3')b.style.color='#111';
 b.addEventListener('click',()=>{if(st.list.length>=12)st.list.shift();st.list.push({g:+b.dataset.g,w:st.type==='test'?2:1});calc()})});
$('#calcReset').addEventListener('click',()=>{st.list=[];calc()});

/* ---- роли ---- */
const tabs=$$('.tabs [role=tab]'),rps=$$('.rp');
tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(x=>x.setAttribute('aria-selected',x===t));rps.forEach((p,i)=>p.classList.toggle('on',i===+t.dataset.r))}));

/* ---- тема ---- */
const dc=$('#themeDemo');$$('.themebtns [data-t]').forEach(b=>b.addEventListener('click',()=>{$$('.themebtns [data-t]').forEach(x=>x.classList.toggle('on',x===b));dc.dataset.t=b.dataset.t}));

/* ---- spotlight ---- */
$$('.spot').forEach(t=>t.addEventListener('pointermove',e=>{const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')}));

/* ---- hero parallax от мыши ---- */
const stage=$('.stage');if(stage&&!RM&&matchMedia('(pointer:fine)').matches)addEventListener('pointermove',e=>{const x=(e.clientX/innerWidth-.5),y=(e.clientY/innerHeight-.5);$$('.float',stage).forEach((f,i)=>f.style.translate=`${x*(18+i*8)}px ${y*(14+i*6)}px`)});

/* ---- плавные якоря ---- */
$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=$(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:RM?'auto':'smooth'});}}));
})();
