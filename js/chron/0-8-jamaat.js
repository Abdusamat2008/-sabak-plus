// 0.8 ЖАМААТ: листки на доске летят в глубину, демо ленты и валюты «Алтын» (вымышленные данные).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  const notes = $$('.note');
  C.pin($('#hero'), p => {
    set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .2)));
    notes.forEach((n, i) => { const k = i * .08 + .05; set(n, '--e', C.ease.out(seg(p, k, k + .25))); set(n, '--p', seg(p, .4, 1)); });
    set($('.sub'), '--sb', seg(p, .75, .92));
  }, 1);
  $$('#ring i').forEach((n, k) => n.style.setProperty('--k', k));
  C.pin($('#finale'), p => { set($('#ring'), '--rr', C.ease.out(seg(p, .05, .6))); $$('#ring i').forEach(n => n.style.setProperty('--p', p.toFixed(3))); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
  /* демо: лента */
  const names = ['Лиса', 'Волк', 'Барс', 'Сова'], posts = $('#posts'), ta = $('#ptxt');
  const seed = [['Мектеп кеңеши', 'Завтра сокращённые уроки. Просьба не опаздывать.', 0, 'Директор · официально'], ['Айдай', 'Кто хочет в школьную газету?', 0, 'Ученица'], ['Аноним · Сова', 'Спасибо учителю, который объяснил тему ещё раз.', 1, '']];
  function addPost(name, text, anon, role, first) { const a = document.createElement('article'); a.className = 'post' + (anon ? ' an' : ''); const b = document.createElement('b'), p = document.createElement('p'), l = document.createElement('button'); b.textContent = name + (role ? ' · ' + role.replace(/^.*· /, '') : ''); p.textContent = text; let n = 0; l.type = 'button'; l.textContent = '♥ 0'; l.onclick = () => { n = n ? 0 : 1; l.textContent = '♥ ' + n; l.classList.toggle('on', !!n); }; a.append(b, p, l); first ? posts.prepend(a) : posts.append(a); }
  seed.forEach(s => addPost(s[0], s[1], s[2], s[3]));
  ta.oninput = () => { $('#pcnt').textContent = ta.value.length + '/140'; };
  $('#ppost').onclick = () => { const t = ta.value.trim(); if (!t) { ta.focus(); return; } const an = $('#anon').checked; addPost(an ? 'Аноним · ' + names[Math.floor(Math.random() * names.length)] : 'Вы (демо)', t, an, '', true); ta.value = ''; $('#pcnt').textContent = '0/140'; };
  /* демо: Алтын */
  const st = { bal: 120, earned: 0, reqs: [] }, LIM = 40, msg = t => { $('#wmsg').textContent = t; };
  const priv = [['Пропуск домашнего задания', 30], ['Пересдача', 40], ['+10 минут на контрольной', 25], ['Премиум-тема профиля', 20]];
  const pc = $('#priv');
  priv.forEach(([n, c]) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span></span><b></b>'; b.firstChild.textContent = n; b.lastChild.textContent = c + ' А'; b.onclick = () => { if (st.bal < c) { msg('Не хватает алтынов'); return; } st.bal -= c; st.reqs.push({ n, c, s: 'wait' }); msg('Заявка отправлена учителю'); draw(); }; b._c = c; pc.appendChild(b); });
  $('#earn').onclick = () => { const add = Math.min(10, LIM - st.earned); if (add <= 0) { msg('Дневной лимит 40 алтынов достигнут'); return; } st.earned += add; st.bal += add; msg('+' + add + ' алтынов за оценку «5»'); draw(); };
  function draw() { $('#bal').textContent = st.bal; $('#earned').textContent = st.earned; $$('#priv button').forEach(b => b.disabled = st.bal < b._c); $('#earn').disabled = st.earned >= LIM;
    const ul = $('#reqs'); ul.innerHTML = ''; if (!st.reqs.length) { const li = document.createElement('li'); li.textContent = 'Пока нет заявок'; ul.appendChild(li); }
    st.reqs.forEach(r => { const li = document.createElement('li'), s = document.createElement('span'); s.textContent = r.n + ' · ' + r.c + ' А'; li.appendChild(s);
      if (r.s === 'wait') { const ok = document.createElement('button'), no = document.createElement('button'); ok.type = no.type = 'button'; ok.textContent = 'Учитель: одобрить'; no.textContent = 'Отказать'; ok.onclick = () => { r.s = 'ok'; msg('Заявка одобрена'); draw(); }; no.onclick = () => { r.s = 'no'; st.bal += r.c; msg('Отказ: алтыны возвращены'); draw(); }; li.append(ok, no); } else { const t = document.createElement('span'); t.className = r.s; t.textContent = r.s === 'ok' ? 'Одобрено' : 'Отказано, алтыны возвращены'; li.appendChild(t); } ul.appendChild(li); }); }
  draw();
}
