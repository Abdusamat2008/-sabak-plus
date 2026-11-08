// Электронное удостоверение ученика: карточка целиком рисуется как один SVG (фото, данные, круглая печать школы).
// У каждой школы своя печать: название школы по кольцу, галочка в центре, наклон/кольца/оттенок чернил зависят от кода школы.
import * as S from './store.js';
import * as V from './v9data.js';
import { esc, ui, head, toast, downloadBlob } from './common.js';
import { dateRu } from './termcal.js';

const rerender = () => window.__render && window.__render();
const cache = {};
const X = () => (ui.idc = ui.idc || { sid: null });
function load(key, fn) {
  if (key in cache) return cache[key];
  cache[key] = 'loading';
  Promise.resolve().then(fn).then(v => { cache[key] = v; rerender(); }).catch(e => { cache[key] = { err: e.message || 'Ошибка загрузки' }; rerender(); });
  return 'loading';
}
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed, i) => { let h = (seed + i * 374761393) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wrap = (t, n) => { const w = String(t || '').split(/\s+/), out = []; let cur = ''; w.forEach(x => { if ((cur + ' ' + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); }); if (cur) out.push(cur); return out; };

/** Печать школы: возвращает SVG-группу. cx, cy — центр, r — радиус */
export function seal(school, cx, cy, r = 62, uid = 's') {
  const seed = hash(school.code || school.name), name = String(school.name || 'Школа').toUpperCase(), city = String(school.city || '').toUpperCase();
  const rot = Math.round((rnd(seed, 1) - .5) * 44), hue = 214 + Math.round(rnd(seed, 2) * 34), ink = `hsl(${hue} 72% 34%)`;
  const style = Math.floor(rnd(seed, 3) * 3);                          // 0 — два кольца, 1 — кольцо и пунктир, 2 — кольцо и «зубчики»
  const ro = r, ri = r * 0.64, rt = r * 0.8, rb = r * 0.8 + 6;
  const fs = Math.max(6.2, Math.min(10.5, (rt * Math.PI * 1.45) / (name.length * 0.7)));
  const bottom = `${city ? city + ' · ' : ''}${(school.code || '').toUpperCase()}`.trim();
  const ticks = style === 2 ? Array.from({ length: 48 }, (_, i) => { const a = i * 7.5 * Math.PI / 180; return `<line x1="${(cx + (ro - 1) * Math.sin(a)).toFixed(1)}" y1="${(cy - (ro - 1) * Math.cos(a)).toFixed(1)}" x2="${(cx + (ro - 5) * Math.sin(a)).toFixed(1)}" y2="${(cy - (ro - 5) * Math.cos(a)).toFixed(1)}"/>`; }).join('') : '';
  const rings = style === 1 ? `<circle cx="${cx}" cy="${cy}" r="${ro}" fill="none" stroke-width="2.4"/><circle cx="${cx}" cy="${cy}" r="${ro - 5}" fill="none" stroke-width="1.2" stroke-dasharray="2 3"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${ro}" fill="none" stroke-width="2.6"/><circle cx="${cx}" cy="${cy}" r="${ro - (style === 2 ? 6 : 4.5)}" fill="none" stroke-width="1.1"/>`;
  return `<defs>
    <filter id="rough-${uid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed % 97}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${(seed >> 3) % 89}" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15" result="mask"/><feComposite in="d" in2="mask" operator="in"/></filter>
    <path id="top-${uid}" d="M ${cx - rt} ${cy} A ${rt} ${rt} 0 1 1 ${cx + rt} ${cy}"/><path id="bot-${uid}" d="M ${cx - rb} ${cy} A ${rb} ${rb} 0 0 0 ${cx + rb} ${cy}"/></defs>
  <g class="seal" transform="rotate(${rot} ${cx} ${cy})" filter="url(#rough-${uid})" style="mix-blend-mode:multiply" opacity=".88" stroke="${ink}" fill="${ink}">
    ${rings}${ticks}
    <circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke-width="1.3"/>
    <text font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${fs.toFixed(1)}" letter-spacing=".6" stroke="none" text-anchor="middle"><textPath href="#top-${uid}" startOffset="50%">${esc(name)}</textPath></text>
    <text font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="6.6" letter-spacing="1.2" stroke="none" text-anchor="middle"><textPath href="#bot-${uid}" startOffset="50%">${esc(bottom)}</textPath></text>
    <circle cx="${cx - rt - 1}" cy="${cy}" r="1.8" stroke="none"/><circle cx="${cx + rt + 1}" cy="${cy}" r="1.8" stroke="none"/>
    <path d="M ${cx - ri * 0.52} ${cy + 1} L ${cx - ri * 0.12} ${cy + ri * 0.42} L ${cx + ri * 0.58} ${cy - ri * 0.42}" fill="none" stroke-width="${(r * 0.12).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${cx}" y="${cy + ri * 0.86}" font-family="Georgia,serif" font-size="5.6" letter-spacing="1" text-anchor="middle" stroke="none">SABAK+</text>
  </g>`;
}

const SIL = '<g fill="#b8c0cc"><circle cx="75" cy="78" r="30"/><path d="M15 200c0-40 28-62 60-62s60 22 60 62z"/></g>';
/** Вся карточка как SVG-строка. photo — data URI или null */
export function cardSvg(c, photo) {
  const st = c.student, sc = c.school, W = 660, H = 420, uid = 'c' + hash(st.id);
  const hr = c.homeroom, parents = (c.parents || []).slice(0, 2);
  const row = (y, k, v, big) => `<text x="236" y="${y}" font-size="10.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">${esc(k)}</text><text x="236" y="${y + 16}" font-size="${big ? 15 : 13.5}" font-weight="600" fill="#161b26" font-family="system-ui,Arial,sans-serif">${esc(v)}</text>`;
  const nm = wrap(sc.name, 40).slice(0, 2);
  const pr = parents.length ? parents.map((p, i) => `<text x="236" y="${338 + i * 17}" font-size="11.5" fill="#161b26" font-family="system-ui,Arial,sans-serif"><tspan font-weight="600">${esc(p.rel || 'Родитель')}:</tspan> ${esc(p.name)}, ${esc(p.phone || 'номер не указан')}</text>`).join('') : '<text x="236" y="338" font-size="11.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Контакты родителей пока не добавлены</text>';
  const guil = Array.from({ length: 26 }, (_, i) => `<path d="M0 ${60 + i * 14} Q ${W / 4} ${40 + i * 14 + (i % 2) * 16} ${W / 2} ${60 + i * 14} T ${W} ${60 + i * 14}" />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Удостоверение ученика ${esc(st.name)}, ${esc(sc.name)}">
  <defs><linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf8ef"/><stop offset="1" stop-color="#eef2f6"/></linearGradient>
  <linearGradient id="band-${uid}" x1="0" x2="1"><stop offset="0" stop-color="#1f4fd0"/><stop offset="1" stop-color="#2f6ae8"/></linearGradient>
  <clipPath id="ph-${uid}"><rect x="30" y="92" width="168" height="224" rx="6"/></clipPath><clipPath id="card-${uid}"><rect width="${W}" height="${H}" rx="22"/></clipPath></defs>
  <g clip-path="url(#card-${uid})"><rect width="${W}" height="${H}" fill="url(#bg-${uid})"/>
  <g fill="none" stroke="#2f6ae8" stroke-opacity=".08" stroke-width="1">${guil}</g>
  <rect width="${W}" height="70" fill="url(#band-${uid})"/>
  <circle cx="40" cy="35" r="16" fill="#fff" fill-opacity=".18"/><path d="M32 36l6 6 11-13" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="68" y="31" font-size="15" font-weight="700" fill="#fff" font-family="system-ui,Arial,sans-serif" letter-spacing=".5">УДОСТОВЕРЕНИЕ УЧЕНИКА</text>
  <text x="68" y="50" font-size="10.5" fill="#fff" fill-opacity=".85" font-family="system-ui,Arial,sans-serif">Электронный документ школы · SABAK+</text>
  <text x="${W - 26}" y="31" font-size="11" fill="#fff" text-anchor="end" font-family="system-ui,Arial,sans-serif">${esc(c.year)} уч. год</text>
  <text x="${W - 26}" y="50" font-size="11" font-weight="700" fill="#fff" text-anchor="end" font-family="ui-monospace,Consolas,monospace">${esc(st.number)}</text>
  <rect x="26" y="88" width="176" height="232" rx="9" fill="#fff" stroke="#c9d1dc"/>
  <g clip-path="url(#ph-${uid})"><rect x="30" y="92" width="168" height="224" fill="#e6eaf0"/>${photo ? `<image href="${photo}" xlink:href="${photo}" x="30" y="92" width="168" height="224" preserveAspectRatio="xMidYMid slice"/>` : `<g transform="translate(39 104)">${SIL}</g>`}</g>
  ${photo ? '' : '<text x="114" y="108" font-size="9" fill="#6a7385" text-anchor="middle" font-family="system-ui,Arial,sans-serif">фото из личного дела</text>'}
  <text x="236" y="100" font-size="10.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Фамилия, имя, отчество</text>
  <text x="236" y="123" font-size="21" font-weight="700" fill="#10131c" font-family="Georgia,'Times New Roman',serif">${esc(st.name)}</text>
  ${row(146, 'Место учёбы', nm[0], false).replace('</text></text>', '</text>')}${nm[1] ? `<text x="236" y="178" font-size="13.5" font-weight="600" fill="#161b26" font-family="system-ui,Arial,sans-serif">${esc(nm[1])}</text>` : ''}
  ${row(nm[1] ? 196 : 190, 'Дата рождения', st.birth ? dateRu(st.birth) : 'не указана', false)}
  <text x="400" y="${nm[1] ? 196 : 190}" font-size="10.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Класс</text><text x="400" y="${(nm[1] ? 196 : 190) + 16}" font-size="13.5" font-weight="600" fill="#161b26" font-family="system-ui,Arial,sans-serif">${esc(st.class || '—')}</text>
  ${row(nm[1] ? 238 : 232, 'Классный руководитель', hr ? hr.name : 'не назначен', false)}${hr && hr.phone ? `<text x="236" y="${(nm[1] ? 238 : 232) + 32}" font-size="11" fill="#4a5366" font-family="system-ui,Arial,sans-serif">${esc(hr.phone)}</text>` : ''}
  <text x="236" y="322" font-size="10.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Родители и контактные номера</text>${pr}
  <line x1="26" y1="356" x2="${W - 26}" y2="356" stroke="#c9d1dc"/>
  <text x="26" y="378" font-size="9.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Выдано электронным дневником школы через SABAK+. Это школьное удостоверение, не государственный документ.</text>
  <text x="26" y="394" font-size="9.5" fill="#6a7385" font-family="system-ui,Arial,sans-serif">Печать школы: ${esc(sc.name)}${sc.city ? ', ' + esc(sc.city) : ''}</text>
  ${seal(sc, 166, 282, 70, uid)}
  </g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="#b9c3d2"/></svg>`;
}

const toData = async src => { if (!src || src.startsWith('data:')) return src; const r = await fetch(src); const b = await r.blob(); return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }); };
export async function toPng(svg, scale = 2) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Не удалось нарисовать удостоверение')); i.src = url; });
    const cv = document.createElement('canvas'); cv.width = 660 * scale; cv.height = 420 * scale; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise(ok => cv.toBlob(ok, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

const translit = t => { const m = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', ө: 'o', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ң: 'n' }; return String(t).toLowerCase().split('').map(ch => m[ch] ?? ch).join('').replace(/[^a-z0-9]/g, ''); };
/** Фото берётся из личного дела ученика (то же формальное фото профиля), отдельно его загружать не нужно */
const demoPortrait = name => { const ini = String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 224"><rect width="168" height="224" fill="#dfe6ef"/><circle cx="84" cy="92" r="38" fill="#b7c3d4"/><path d="M14 224c0-52 32-80 70-80s70 28 70 80z" fill="#b7c3d4"/><text x="84" y="104" font-size="30" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">${ini}</text></svg>`); };
export function dossierPhoto(c, stu) {
  const own = S.photoSrc(stu); if (own) return own;
  if (stu && stu.photo && stu.photo.ph) return demoPortrait(stu.name);
  const path = c && c.student && c.student.photo_path;
  return path ? S.photoSrc({ photo: { ok: true, path } }) : null;
}
function mine() {
  const u = S.state().session; if (!u) return [];
  if (u.role === 'student') return [u.id];
  if (u.role === 'parent') return u.children || (u.child ? [u.child] : []);
  return [];
}
export function page() {
  const ids = mine(), x = X();
  if (!ids.length) return `${head('Удостоверение', 'ученика', '')}<div class="card empty"><p>Удостоверение доступно ученикам и родителям.</p></div>`;
  const sid = ids.includes(x.sid) ? x.sid : ids[0];
  const sel = ids.length > 1 ? `<div class="ctl"><label class="fld"><span>Ученик</span><select data-idc="sid">${ids.map(i => { const s = S.state().students.find(z => z.id === i); return `<option value="${esc(i)}" ${i === sid ? 'selected' : ''}>${esc(s ? s.name : i)}</option>`; }).join('')}</select></label></div>` : '';
  const c = load('id:' + sid, async () => { const r = await V.call('id_card', { p_sid: sid }); if (!r || !r.ok) throw new Error(r && r.error === 'not_deployed' ? 'Сервер ещё без schema_v8: удостоверение недоступно' : 'Не удалось получить данные удостоверения'); return r; });
  if (c === 'loading') return `${head('Удостоверение', 'ученика', 'Электронный документ')}${sel}<div class="card"><p class="muted">Загружаем…</p></div>`;
  if (c.err) return `${head('Удостоверение', 'ученика', '')}${sel}<div class="card empty"><p>${esc(c.err)}</p></div>`;
  const stu = S.state().students.find(z => z.id === sid), photo = dossierPhoto(c, stu);
  return `${head('Удостоверение', 'ученика', 'Электронный документ вашей школы')}${sel}
  <section class="idc-wrap"><div class="idc-card" id="idc-card">${cardSvg(c, photo)}</div>
  <div class="btns"><button class="btn blue" data-act="idc-dl" data-sid="${esc(sid)}">Скачать на устройство (PNG)</button></div>
  <p class="muted idc-note">${photo ? 'Фото взято из личного дела ученика, загружать его отдельно не нужно.' : 'В личном деле пока нет фото. Оно появится на удостоверении само, когда школа добавит его в дело.'} Печать у каждой школы своя: название школы стоит по кольцу. Удостоверение показывает данные электронного дневника.</p></section>`;
}
export function onChange(el) { if (el.dataset && el.dataset.idc === 'sid') { X().sid = el.value; rerender(); return true; } return false; }
export async function act(a, el) {
  if (a !== 'idc-dl') return false;
  try {
    const sid = el.dataset.sid, c = cache['id:' + sid]; if (!c || c === 'loading' || c.err) return true;
    const stu = S.state().students.find(z => z.id === sid), photo = await toData(dossierPhoto(c, stu));
    const png = await toPng(cardSvg(c, photo), 2);
    downloadBlob(png, `udostoverenie-${translit((c.student.name || 'uchenik').split(' ')[0]) || 'uchenik'}.png`);
    toast('Удостоверение сохранено', 'ok');
  } catch (e) { toast(e.message || 'Не удалось скачать', 'err'); }
  return true;
}
export const refresh = () => Object.keys(cache).forEach(k => delete cache[k]);
