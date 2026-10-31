// Экспорт отчётов: Excel (.xlsx) и Word (.docx) собираются прямо в браузере (JSZip), PDF — через системную печать («Сохранить как PDF»).
// report = { title, subtitle, sections: [ {t:'h', text} | {t:'p', text} | {t:'bul', items:[]} | {t:'table', name, header:[], rows:[[]]} | {t:'chart', svg, title} ] }
let zipLib = null;
async function JSZ() {
  if (zipLib) return zipLib;
  if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/vendor/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить модуль экспорта')); document.head.appendChild(s); });
  return (zipLib = window.JSZip);
}
const X = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// ---------- XLSX ----------
export async function toXlsx(report) {
  const Z = await JSZ(), zip = new Z();
  const tables = report.sections.filter(s => s.t === 'table');
  const textLines = [report.title, report.subtitle || '', ''];
  report.sections.forEach(s => { if (s.t === 'h') textLines.push('', s.text); if (s.t === 'p') textLines.push(s.text); if (s.t === 'bul') s.items.forEach(i => textLines.push('• ' + i)); });
  const sheets = [{ name: 'Выводы', header: null, rows: textLines.map(l => [l]), widths: [120], text: true }, ...tables.map(t => ({ name: t.name, header: t.header, rows: t.rows }))];
  const safe = (n, i) => (String(n).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 28) || 'Лист') + (sheets.findIndex(x => x.name === n) < i ? ' ' + (i + 1) : '');
  const names = sheets.map((s, i) => safe(s.name, i));
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2352D8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach((sh, si) => {
    const all = sh.header ? [sh.header, ...sh.rows] : sh.rows, maxc = Math.max(1, ...all.map(r => r.length));
    const widths = sh.widths || Array.from({ length: maxc }, (_, c) => Math.min(48, Math.max(8, ...all.map(r => String(r[c] ?? '').length)) + 2));
    const rowsXml = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), hdr = sh.header && ri === 0;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (v === null || v === undefined || v === '') return '';
      return `<c r="${ref}" t="inlineStr"${hdr ? ' s="1"' : ''}><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    zip.file(`xl/worksheets/sheet${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sh.header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : ''}<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml}</sheetData></worksheet>`);
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------- DOCX ----------
export function svgToPng(svg, scale = 2) {
  return new Promise((res, rej) => {
    const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/), w = +m[1], h = +m[2];
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b.arrayBuffer().then(buf => res({ buf, w, h })), 'image/png'); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Не удалось нарисовать диаграмму')); };
    img.src = url;
  });
}
export async function toDocx(report) {
  const Z = await JSZ(), zip = new Z(); let body = '', imgN = 0; const rels = [];
  const run = (t, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
  const para = (t, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.after != null ? `<w:spacing w:after="${o.after}"/>` : ''}${o.ind ? `<w:ind w:left="${o.ind}" w:hanging="260"/>` : ''}</w:pPr>${run(t, o)}</w:p>`;
  body += para(report.title, { style: 'Title' }); if (report.subtitle) body += para(report.subtitle, { color: '666666', after: 200 });
  for (const s of report.sections) {
    if (s.t === 'h') body += para(s.text, { style: 'Heading1' });
    else if (s.t === 'p') body += para(s.text);
    else if (s.t === 'bul') s.items.forEach(i => { body += para('•  ' + i, { ind: 360 }); });
    else if (s.t === 'table') {
      const cols = s.header.length, cw = Math.floor(9000 / cols), cell = (v, hdr) => `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="2352D8"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v ?? '', { b: hdr, color: hdr ? 'FFFFFF' : null, sz: 18 })}</w:p></w:tc>`;
      if (s.name) body += para(s.name, { style: 'Heading2' });
      body += `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${s.header.map(() => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${s.header.map(h => cell(h, true)).join('')}</w:tr>${s.rows.map(r => `<w:tr>${s.header.map((_, i) => cell(r[i], false)).join('')}</w:tr>`).join('')}</w:tbl>${para('', { after: 120 })}`;
    } else if (s.t === 'chart') {
      const { buf, w, h } = await svgToPng(s.svg); imgN++; const id = 'rIdImg' + imgN; zip.file(`word/media/img${imgN}.png`, buf); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img${imgN}.png"/>`);
      const cx = 5400000, cy = Math.round(cx * h / w);
      body += `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgN}" name="chart${imgN}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="img${imgN}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
  }
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>`);
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="2352D8"/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="0B0B0B"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2352D8"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- PDF (печать → «Сохранить как PDF») ----------
export function reportHtml(report) {
  const e = X; let h = `<h1>${e(report.title)}</h1><p class="sub">${e(report.subtitle || '')}</p>`;
  report.sections.forEach(s => {
    if (s.t === 'h') h += `<h2>${e(s.text)}</h2>`;
    else if (s.t === 'p') h += `<p>${e(s.text)}</p>`;
    else if (s.t === 'bul') h += `<ul>${s.items.map(i => `<li>${e(i)}</li>`).join('')}</ul>`;
    else if (s.t === 'chart') h += `<div class="ch">${s.svg}</div>`;
    else if (s.t === 'table') h += `${s.name ? `<h3>${e(s.name)}</h3>` : ''}<table><thead><tr>${s.header.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${s.header.map((_, i) => `<td>${e(typeof r[i] === 'number' ? String(Math.round(r[i] * 100) / 100).replace('.', ',') : r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  });
  return h;
}
export function printReport(report) {
  let root = document.getElementById('printroot');
  if (!root) { root = document.createElement('div'); root.id = 'printroot'; document.body.appendChild(root); }
  root.innerHTML = reportHtml(report); document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80);
}
