// Редактор текста для новостей: жирный, курсив, заголовки, списки, цитаты, выравнивание, цвета, размер, ссылки.
// Всё, что хранится и показывается, проходит через sanitize(): остаются только безопасные теги и несколько стилей.
const TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'A', 'SPAN', 'DIV', 'MARK', 'FONT']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'IMG', 'VIDEO', 'AUDIO']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i;
const SIZES = new Set(['small', 'medium', 'large', 'x-large', 'xx-large']);
const ALIGN = new Set(['left', 'center', 'right', 'justify']);

function cleanStyle(style) {
  const out = [];
  String(style || '').split(';').forEach(p => {
    const i = p.indexOf(':'); if (i < 0) return;
    const k = p.slice(0, i).trim().toLowerCase(), v = p.slice(i + 1).trim().toLowerCase();
    if ((k === 'color' || k === 'background-color') && COLOR.test(v)) out.push(`${k}:${v}`);
    else if (k === 'text-align' && ALIGN.has(v)) out.push(`${k}:${v}`);
    else if (k === 'font-size' && SIZES.has(v)) out.push(`${k}:${v}`);
    else if (k === 'font-weight' && (v === 'bold' || v === '700')) out.push('font-weight:bold');
    else if (k === 'font-style' && v === 'italic') out.push('font-style:italic');
    else if (k === 'text-decoration' && /^(underline|line-through)$/.test(v)) out.push(`${k}:${v}`);
  });
  return out.join(';');
}
const SIZE_MAP = { 1: 'x-small', 2: 'small', 3: 'medium', 4: 'large', 5: 'x-large', 6: 'xx-large', 7: 'xx-large' };
function walk(src, dst, doc) {
  src.childNodes.forEach(n => {
    if (n.nodeType === 3) { dst.appendChild(doc.createTextNode(n.nodeValue)); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toUpperCase();
    if (DROP.has(tag)) return;
    if (!TAGS.has(tag)) { walk(n, dst, doc); return; }       // неизвестный тег: оставляем только содержимое
    if (tag === 'FONT') {                                      // execCommand иногда делает <font>: превращаем в span со стилем
      const sp = doc.createElement('span'), st = [];
      const c = n.getAttribute('color'); if (c && COLOR.test(c)) st.push('color:' + c);
      const z = n.getAttribute('size'); if (z && SIZE_MAP[z]) st.push('font-size:' + SIZE_MAP[z]);
      const s2 = cleanStyle(n.getAttribute('style')); if (s2) st.push(s2);
      if (st.length) sp.setAttribute('style', st.join(';')); walk(n, sp, doc); dst.appendChild(sp); return;
    }
    const el = doc.createElement(tag.toLowerCase());
    const st = cleanStyle(n.getAttribute('style')); if (st) el.setAttribute('style', st.replace(/font-size:x-small/, 'font-size:small'));
    if (tag === 'A') {
      const h = (n.getAttribute('href') || '').trim();
      if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) { el.setAttribute('href', h); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer nofollow'); }
    }
    if (tag !== 'BR' && tag !== 'HR') walk(n, el, doc);
    dst.appendChild(el);
  });
}
export function sanitize(html) {
  const doc = document.implementation.createHTMLDocument(''), src = doc.createElement('div'), out = doc.createElement('div');
  src.innerHTML = String(html || '');          // в отдельном документе: скрипты и обработчики не выполняются
  walk(src, out, doc);
  return out.innerHTML;
}
export const toText = html => { const d = document.implementation.createHTMLDocument('').createElement('div'); d.innerHTML = sanitize(html); d.querySelectorAll('p,div,li,h2,h3,blockquote,br').forEach(e => e.after(' ')); return d.textContent.replace(/\s+/g, ' ').trim(); };
export const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Показ новости: html очищаем, обычный текст экранируем */
export const render = (body, fmt) => fmt === 'html' ? sanitize(body) : escHtml(body).replace(/\n/g, '<br>');
export const preview = (body, fmt, n = 170) => { const t = fmt === 'html' ? toText(body) : String(body).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };

const COLORS = ['#14110F', '#2352D8', '#1B7F5C', '#B3261E', '#B26A00', '#6B3FA0', '#5B6472', '#FFFFFF'];
const HILITE = ['#FFF3B0', '#D6E4FF', '#D7F2E3', '#FFD9D6', '#E9DDFB', '#E5E7EB'];
const ico = d => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const BTN = [
  ['bold', 'Жирный', '<b>Ж</b>'], ['italic', 'Курсив', '<i>К</i>'], ['underline', 'Подчёркнутый', '<u>Ч</u>'], ['strikeThrough', 'Зачёркнутый', '<s>З</s>'], '|',
  ['h2', 'Крупный заголовок', '<b>H2</b>'], ['h3', 'Подзаголовок', '<b>H3</b>'], ['p', 'Обычный текст', '¶'], '|',
  ['insertUnorderedList', 'Маркированный список', ico('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>')], ['insertOrderedList', 'Нумерованный список', ico('<path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 13h2l-2 3h2"/>')], ['quote', 'Цитата', ico('<path d="M6 17c0-4 1-7 4-9M14 17c0-4 1-7 4-9"/>')], '|',
  ['justifyLeft', 'По левому краю', ico('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>')], ['justifyCenter', 'По центру', ico('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>')], ['justifyRight', 'По правому краю', ico('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>')], '|',
];
export function toolbar() {
  const b = BTN.map(x => x === '|' ? '<span class="ed-sep" aria-hidden="true"></span>' : `<button type="button" class="ed-b" data-ed="${x[0]}" title="${x[1]}" aria-label="${x[1]}">${x[2]}</button>`).join('');
  const sw = (cmd, arr, label) => `<span class="ed-pop"><button type="button" class="ed-b" data-ed-pop="${cmd}" title="${label}" aria-label="${label}" aria-haspopup="true">${cmd === 'foreColor' ? '<b class="ed-a">А</b>' : '<b class="ed-a hl">А</b>'}</button><span class="ed-sw" role="menu">${arr.map(c => `<button type="button" role="menuitem" data-ed="${cmd}" data-v="${c}" style="background:${c}" aria-label="${label} ${c}"></button>`).join('')}</span></span>`;
  const size = `<select class="ed-sel" data-ed-size aria-label="Размер текста"><option value="">Размер</option><option value="2">Мелкий</option><option value="3">Обычный</option><option value="5">Крупный</option><option value="6">Очень крупный</option></select>`;
  return `<div class="ed-tb" role="toolbar" aria-label="Форматирование текста">${b}${sw('foreColor', COLORS, 'Цвет текста')}${sw('hiliteColor', HILITE, 'Выделение цветом')}${size}<span class="ed-sep" aria-hidden="true"></span>
    <button type="button" class="ed-b" data-ed="link" title="Ссылка" aria-label="Вставить ссылку">${ico('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')}</button>
    <button type="button" class="ed-b" data-ed="insertHorizontalRule" title="Разделитель" aria-label="Разделитель">${ico('<path d="M4 12h16"/>')}</button>
    <button type="button" class="ed-b" data-ed="removeFormat" title="Убрать форматирование" aria-label="Убрать форматирование">${ico('<path d="M5 5h14M12 5v14M8 19h8M4 4l16 16"/>')}</button>
    <button type="button" class="ed-b" data-ed="undo" title="Отменить" aria-label="Отменить">${ico('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>')}</button>
    <button type="button" class="ed-b" data-ed="redo" title="Повторить" aria-label="Повторить">${ico('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2"/>')}</button></div>`;
}
export const area = (html, id = 'ed-body') => `<div class="ed"><div class="ed-hint sr">Поле для текста новости. Над ним панель форматирования</div>${toolbar()}<div id="${id}" class="ed-area news-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Текст новости" data-ph="Напишите новость. Выделите слово, чтобы сделать его жирным, цветным или крупным">${sanitize(html)}</div><div class="ed-foot"><small id="ed-cnt" class="muted"></small></div></div>`;

let saved = null;
const area_ = () => document.querySelector('.ed-area');
const sel = () => { const s = getSelection(); return s && s.rangeCount ? s.getRangeAt(0) : null; };
const inArea = r => r && area_() && area_().contains(r.commonAncestorContainer);
document.addEventListener('selectionchange', () => { const r = sel(); if (inArea(r)) saved = r.cloneRange(); });
document.addEventListener('mousedown', e => { if (e.target.closest('.ed-tb') && !e.target.closest('select, input')) e.preventDefault(); });
function restore() { const a = area_(); if (!a) return false; a.focus(); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } return true; }
export function count() { const a = area_(), c = document.getElementById('ed-cnt'); if (a && c) { const n = sanitize(a.innerHTML).length; c.textContent = `${toText(a.innerHTML).length} знаков текста · разметка ${n} из 20000`; c.style.color = n > 20000 ? 'var(--danger)' : ''; } }
export const value = () => { const a = area_(); return a ? sanitize(a.innerHTML) : ''; };
export function exec(cmd, v) {
  if (!restore()) return;
  try { document.execCommand('styleWithCSS', false, true); } catch {}
  if (cmd === 'h2' || cmd === 'h3') document.execCommand('formatBlock', false, cmd.toUpperCase());
  else if (cmd === 'p') document.execCommand('formatBlock', false, 'P');
  else if (cmd === 'quote') document.execCommand('formatBlock', false, 'BLOCKQUOTE');
  else if (cmd === 'link') { const u = prompt('Адрес ссылки (начинается с https://)', 'https://'); if (!u) return; if (!/^(https?:\/\/|mailto:|tel:)/i.test(u)) { alert('Ссылка должна начинаться с https://'); return; } document.execCommand('createLink', false, u); }
  else if (cmd === 'hiliteColor') document.execCommand('hiliteColor', false, v) || document.execCommand('backColor', false, v);
  else document.execCommand(cmd, false, v);
  count();
}
