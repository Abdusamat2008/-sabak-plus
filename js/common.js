// Общие помощники интерфейса
import * as S from './store.js';
import { getLang } from './i18n.js';
import { TYPES, dmy } from './calc.js';

export const $toast = () => document.getElementById('toast');
export const ui = { cls: '9А', subj: 'math', type: 'hw', sheet: null, cloud: {}, lastSave: null, newCode: null, mailOk: false, menu: false, photo: null, modal: null, tab: {}, busy: null };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const L = () => getLang();
export const sjName = id => { const s = S.subj(id); return s ? (L() === 'ky' ? s.ky : s.ru) : id; };
export const typeName = id => TYPES[id] ? (L() === 'ky' ? TYPES[id].ky : TYPES[id].ru) : id;
export const hhmm = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const dtFmt = ts => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const first = n => String(n || '').split(' ')[0];
export const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c; };
export const route = () => (location.hash || '').replace(/^#\/?/, '');
export const go = r => { location.hash = '#/' + r; };
export const chip = g => `<span class="g g${g.value}" title="${esc(typeName(g.type))} · ${dmy(g.date)}">${g.value}</span>`;

export function toast(msg, kind = '') {
  const host = $toast(); if (!host) return;
  const el = document.createElement('div'); el.className = 'toast-item ' + kind; el.textContent = msg; host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3700);
}
export function head(l1, l2, sub, right = '') { return `<div class="hd"><div><h1>${esc(l1)}${l2 ? `<br><span>${esc(l2)}</span>` : ''}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right ? `<div class="hd-r">${right}</div>` : ''}</div>`; }

// Аватар: фото профиля или инициалы (цвет — по имени). Заглушка демо-фото рисуется силуэтом.
const PAL = ['#2352D8', '#1F9D6B', '#C7761A', '#8A3FD1', '#D6443F', '#0F8B9E', '#6B7B1E'];
export function avatar(st, size = 40, cls = '') {
  if (!st) return '';
  const src = S.photoSrc(st), hue = PAL[[...st.name].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
  const ini = st.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (src) return `<img class="av ${cls}" src="${src}" width="${size}" height="${size}" alt="Фото: ${esc(st.name)}" loading="lazy">`;
  if (st.photo && st.photo.ph) return `<span class="av ph ${cls}" style="width:${size}px;height:${size}px;background:${hue}" aria-label="Фото: ${esc(st.name)}"><svg viewBox="0 0 40 40" width="${size * .7}" height="${size * .7}" aria-hidden="true"><circle cx="20" cy="15" r="7" fill="#fff" opacity=".9"/><path d="M5 38c1-9 7-13 15-13s14 4 15 13z" fill="#fff" opacity=".9"/></svg></span>`;
  return `<span class="av ini ${cls}" style="width:${size}px;height:${size}px;font-size:${size * .38}px;border-color:${hue};color:${hue}" aria-label="Нет фото: ${esc(st.name)}">${esc(ini)}</span>`;
}
export const ROLE_RU = { director: 'Директор', deputy: 'Завуч', teacher: 'Учитель', parent: 'Родитель', student: 'Ученик', admin: 'Администрация' };
export const downloadBlob = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
export const copyText = async t => { try { await navigator.clipboard.writeText(t); return true; } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); return true; } };
