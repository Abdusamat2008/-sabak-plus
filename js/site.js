(()=>{const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
document.documentElement.classList.add('js');
const nav=$('#nav'),bg=$('#burger');
if(bg){const set=o=>{nav.classList.toggle('open',o);bg.setAttribute('aria-expanded',o)};bg.addEventListener('click',()=>set(!nav.classList.contains('open')));$$('#menu a').forEach(a=>a.addEventListener('click',()=>set(false)));addEventListener('keydown',e=>{if(e.key==='Escape')set(false)});addEventListener('scroll',()=>set(false),{passive:true})}
const prog=$('.progress i');
const onS=()=>{const y=scrollY,m=document.documentElement.scrollHeight-innerHeight;nav&&nav.classList.toggle('s',y>20);document.documentElement.style.setProperty('--sp',m>0?(y/m).toFixed(4):0)};
addEventListener('scroll',()=>requestAnimationFrame(onS),{passive:true});onS();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -4% 0px'});
$$('.rv').forEach(e=>io.observe(e));
$$('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=b.dataset.copy;try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch{}a.remove()}const o=b.textContent;b.textContent='Скопировано ✓';b.classList.add('ok');setTimeout(()=>{b.textContent=o;b.classList.remove('ok')},1800)}));
/* видео играют, только пока видны (экономим трафик и батарею) */
const vio=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){v.preload='auto';v.play().catch(()=>{})}else v.pause()}),{threshold:.4});
$$('video[data-auto]').forEach(v=>vio.observe(v));
})();
