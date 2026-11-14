// 0.13 АЧКЫЧ: ключ входит в замок и открывает профиль; демо выдачи ключа, регистрации и мягкой проверки фото (без реальных данных).
export default function (C) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const set = (el, k, v) => el && el.style.setProperty(k, typeof v === 'number' ? v.toFixed(3) : v), seg = (p, a, b) => C.clamp((p - a) / (b - a));
  C.pin($('#hero'), p => { const kw = $('#kw'); set($('.stage'), '--hn', p); set($('.mega'), '--t', C.ease.out(seg(p, 0, .15)));
    set(kw, '--kr', 360 * C.ease.inOut(seg(p, 0, .4))); set(kw, '--kz', -18 + 18 * seg(p, .3, .5)); set(kw, '--ki', C.ease.inOut(seg(p, .35, .6))); set(kw, '--ly', -30 + 30 * seg(p, 0, .5)); set(kw, '--op', C.ease.out(seg(p, .6, .78))); set(kw, '--pf', C.ease.inOut(seg(p, .72, .9))); set($('.sub'), '--sb', seg(p, .82, .95)); }, 1);
  $$('#gk i').forEach((n, k) => n.style.setProperty('--k', k));
  C.pin($('#finale'), p => { set($('#gk'), '--gr', C.ease.out(seg(p, .05, .55))); set($('#gk'), '--gp', p); set($('#quote'), '--qo', seg(p, .55, .8)); }, 1);
  /* ключи */
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', gen = () => { let s = ''; for (let i = 0; i < 8; i++) { s += A[Math.floor(Math.random() * A.length)]; if (i === 3) s += '-'; } return s; };
  const st = { key: null, old: [] }, km = $('#kmsg'), kr = $('#krow');
  const drawKey = () => { kr.innerHTML = ''; const s = document.createElement('span'); s.textContent = st.key ? 'Действующий ключ: ' + st.key : 'Действующий ключ: нет'; kr.appendChild(s); };
  $('#issue').onclick = () => { if (st.key) { st.old.push(st.key); km.textContent = 'Новый ключ выдан. Прежний ключ отозван. Срок: до использования, максимум 180 дней.'; } else km.textContent = 'Ключ выдан для Айбека Т. Срок: до использования, максимум 180 дней.'; st.key = gen(); drawKey(); };
  $('#copy').onclick = async () => { if (!st.key) { km.textContent = 'Сначала выдайте ключ.'; return; } try { await navigator.clipboard.writeText(st.key); km.textContent = 'Ключ скопирован.'; } catch { km.textContent = 'Не удалось скопировать автоматически: выделите ключ вручную.'; } };
  $('#reg').onclick = () => { const v = $('#kin').value.trim().toUpperCase(), r = $('#res'); r.className = 'res'; if (!v) { r.textContent = 'Введите ключ.'; r.classList.add('no'); return; } if (v === st.key) { r.textContent = 'Ключ выдан для: Айбек Т. · 8 «Б». Дата рождения и пол подставлены из школьной записи (демо).'; r.classList.add('ok'); } else if (st.old.includes(v)) { r.textContent = 'Этот ключ отозван: учитель выдал новый.'; r.classList.add('no'); } else { r.textContent = 'Такой ключ не найден. Проверьте ввод или попросите учителя выдать ключ.'; r.classList.add('no'); } };
  drawKey();
  /* фото */
  const P = [['Хорошее фото 600×600', { s: 500, bg: '#2a3342', fs: 52, tilt: 0 }], ['Фото 250×250', { s: 250, bg: '#2a3342', fs: 52, tilt: 0 }], ['Пёстрый фон', { s: 500, bg: 'repeating-linear-gradient(45deg,#6a3,#c63 12px,#36c 24px)', fs: 52, tilt: 0 }], ['Небольшой наклон', { s: 500, bg: '#2a3342', fs: 50, tilt: 14 }], ['Лицо слишком мелкое', { s: 500, bg: '#2a3342', fs: 18, tilt: 0 }]];
  const os = $('#opts'); P.forEach((p, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p[0]; b.onclick = () => { $$('#opts button').forEach(x => x.classList.toggle('on', x === b)); check(p[1]); }; os.appendChild(b); });
  function check(c) { const sb = $('.scanbox'), f = $('#face'); sb.style.setProperty('--bgc', c.bg); sb.style.background = c.bg.includes('gradient') ? c.bg : ''; f.style.setProperty('--fs', c.fs); f.style.setProperty('--tilt', c.tilt); const bm = $('#beam'); bm.classList.remove('go'); void bm.offsetWidth; bm.classList.add('go');
    const w = []; let bad = '';
    if (c.s < 300) bad = 'Фото слишком маленькое: минимум 300×300. Загрузите фото побольше.'; else if (c.fs < 25) w.push('Лицо слишком мелкое: подойдите ближе.');
    if (c.bg.includes('gradient')) w.push('Фон пёстрый. Это предупреждение, фото всё равно можно использовать.'); if (c.tilt > 10) w.push('Заметный наклон головы. Допустим небольшой наклон, но лучше выровнять.');
    $('#pres').textContent = bad || (w.length ? 'Фото принято с предупреждением: ' + w.join(' ') : 'Фото подходит.'); }
}
