// 0.13 АЧКЫЧ: ключ вращается и входит в замок, замок раскрывается и показывает профиль; демо ключа и проверки фото
export default function init({ $, $$, scene, clamp, lerp, ease }) {
  const hero = $('#h14'), ky = $('#ky'), lk = $('#lk');
  scene(hero, p => { const W = $('.scene14').clientWidth, lx = lk.offsetLeft, kw = ky.offsetWidth, spin = ease(clamp(p / .45)), ins = ease(clamp((p - .4) / .3)), op = ease(clamp((p - .75) / .2));
    ky.style.setProperty('--ky', spin * 720 + 'deg'); ky.style.setProperty('--kr', Math.sin(spin * 3.14) * 18 + 'deg'); ky.style.setProperty('--kt', lerp(W * .04 - 0, lx - kw * .72, ins) + 'px'); ky.style.opacity = 1 - op * .95; lk.style.setProperty('--lo', op); });
  const S = ['Демо Ученик 1', 'Демо Ученик 2', 'Демо Ученик 3'], keys = {}, act = {}; $('#ks').innerHTML = S.map(s => `<option>${s}</option>`).join('');
  const gen = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = n => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join(''); return r(4) + '-' + r(4); };
  const hist = [], show = () => { const s = $('#ks').value; $('#kc').innerHTML = (hist.filter(h => h.s === s)).map(h => `<div class="kk ${h.rev ? 'rev' : ''}"><b>${h.k}</b><div class="row"><small>${h.rev ? 'отозван' : 'действует до ' + h.till}</small>${h.rev ? '' : `<button class="btn ghost" type="button" data-c="${h.k}">Копировать</button>`}</div></div>`).join('') || '<p class="note">Ключа пока нет.</p>'; };
  $('#kg').onclick = () => { const s = $('#ks').value; hist.forEach(h => { if (h.s === s && !h.rev) { h.rev = true; delete keys[h.k]; } }); const k = gen(), d = new Date(Date.now() + 180 * 864e5); const till = d.toLocaleDateString('ru-RU'); keys[k] = s; hist.unshift({ s, k, till }); show(); };
  $('#ks').onchange = show; $('#kc').onclick = async e => { const b = e.target.closest('[data-c]'); if (b) { try { await navigator.clipboard.writeText(b.dataset.c); b.textContent = 'Скопировано ✓'; } catch { b.textContent = 'Не удалось'; } } }; show();
  const fmtK = v => { const c = v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8); return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; }; $('#ki').oninput = e => e.target.value = fmtK(e.target.value);
  $('#kv').onclick = () => { const k = $('#ki').value.trim().toUpperCase(), n = keys[k], r = $('#kr'); if (!n) { r.innerHTML = '<b class="nok">Ключ не найден или уже отозван</b><small>Проверьте ключ или попросите учителя выдать новый.</small>'; return; } r.innerHTML = `<b class="okk">Ключ выдан для: ${n}</b><small>${$('#kb').checked ? 'Дата рождения и пол взяты из школьной записи.' : 'Дату рождения и пол нужно указать вручную.'}</small>`; };
  // фото
  const g = id => +$(id).value, mesh = $('#mesh');
  const chk = () => { const s = g('#fs'), t = g('#ft'), y = g('#fy'), l = g('#fl'), r = g('#fr'), z = +$('#fz').value, L = []; const add = (c, m) => L.push([c, m]);
    add(z < 300 ? 'f' : 'o', z < 300 ? 'Снимок меньше 300×300 — нужен побольше' : 'Размер снимка подходит (от 300×300)');
    add(s < 15 || s > 95 ? 'f' : s < 30 || s > 85 ? 'w' : 'o', s < 30 ? 'Лицо слишком мелкое' : s > 85 ? 'Лицо слишком крупное' : 'Размер лица хороший');
    add(Math.abs(t) > 40 ? 'f' : Math.abs(t) > 25 ? 'w' : 'o', Math.abs(t) > 25 ? 'Голова сильно наклонена' : 'Наклон в норме'); add(Math.abs(y) > 50 ? 'f' : Math.abs(y) > 30 ? 'w' : 'o', Math.abs(y) > 30 ? 'Голова повёрнута в сторону' : 'Поворот в норме');
    add(l < 12 ? 'f' : l < 30 || l > 92 ? 'w' : 'o', l < 30 ? 'Темновато' : l > 92 ? 'Слишком ярко' : 'Освещение хорошее'); add(r < 10 ? 'f' : r < 30 ? 'w' : 'o', r < 30 ? 'Снимок не очень резкий' : 'Резкость хорошая');
    add($('#fb').value !== '#9fb4c8' ? 'w' : 'o', $('#fb').value !== '#9fb4c8' ? 'Фон неподходящий — это только предупреждение, фото можно принять' : 'Фон спокойный');
    const bad = L.some(x => x[0] === 'f'); $('#vr').innerHTML = L.map(x => `<li class="${x[0] === 'o' ? '' : x[0]}">${x[1]}</li>`).join('') + `<li class="${bad ? 'f' : 'o'}" style="font-weight:700">${bad ? 'Нужно переснять' : 'Фото можно принять'}</li>`;
    $('#face').setAttribute('transform', `translate(${y * .5} 0) rotate(${t * .6} 100 100) scale(${.5 + s / 100})`); $('#face').style.filter = `brightness(${.4 + l / 100}) blur(${(100 - r) / 40}px)`; $('#bgr').setAttribute('fill', $('#fb').value);
    const cx = 100 + y * .5, M = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; M.push(`<circle cx="${cx + Math.cos(a) * 38 * (.5 + s / 100)}" cy="${95 + Math.sin(a) * 48 * (.5 + s / 100)}" r="1.8"/>`); } mesh.innerHTML = M.join(''); };
  ['#fs', '#ft', '#fy', '#fl', '#fr', '#fb', '#fz'].forEach(i => $(i).oninput = chk); chk();
}
