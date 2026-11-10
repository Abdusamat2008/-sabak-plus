// Резервная копия данных школы: директор скачивает один zip с оценками, посещаемостью, учениками и т. д. (JSON).
// Нужна и на бесплатном тарифе Supabase, где автоматических копий нет. Делайте её раз в неделю и хранить в двух местах.
import * as S from './store.js';
import * as V from './v9data.js';
import * as API from './api.js';
import { esc, ui, toast, downloadBlob } from './common.js';

const PARTS = [['school', 'Школа'], ['people', 'Сотрудники и аккаунты'], ['classes', 'Классы'], ['students', 'Ученики'], ['assignments', 'Назначения учителей'], ['grades', 'Оценки'], ['attendance', 'Посещаемость'], ['homework', 'Домашние задания'], ['archive', 'Архив четвертей'], ['past', 'Итоги прошлых лет'], ['news', 'Новости']];
const rerender = () => window.__render && window.__render();
let zipLib = null;
async function zip() {
  if (zipLib) return zipLib;
  if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/vendor/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить модуль архива')); document.head.appendChild(s); });
  return (zipLib = window.JSZip);
}
export function section() {
  const u = S.state().session; if (!u || u.level !== 'director') return '';
  const bk = ui.bk || {};
  return `<section class="card backup"><h3>Резервная копия школы</h3>
  <p class="muted">Один архив со всеми данными школы: ученики, оценки, посещаемость, домашние задания, архив четвертей, новости. Скачайте его, чтобы данные не пропали при сбое сервера. Рекомендуем раз в неделю и перед концом четверти. Храните копию в двух местах (например, компьютер директора и внешний диск). Архив содержит персональные данные учеников: не пересылайте его по мессенджерам.</p>
  <div class="btns"><button class="btn blue" data-act="backup-run" ${bk.busy ? 'disabled' : ''}>${bk.busy ? 'Готовим…' : 'Скачать резервную копию'}</button></div>
  ${bk.text ? `<p class="muted" role="status">${esc(bk.text)}</p>` : ''}${bk.last ? `<p class="muted">Последняя копия на этом устройстве: ${esc(bk.last)}</p>` : ''}</section>`;
}
export async function act(a) {
  if (a !== 'backup-run') return false;
  const bk = ui.bk = ui.bk || {}; if (bk.busy) return true;
  bk.busy = true; bk.text = 'Начинаем…'; rerender();
  try {
    const Z = await zip(), z = new Z(), meta = { exported_at: new Date().toISOString(), app: 'SABAK+', mode: S.isLive() ? 'live' : 'demo' };
    if (S.isLive()) {
      for (const [part, ru] of PARTS) {
        const all = []; let off = 0;
        for (let i = 0; i < 200; i++) {
          bk.text = `${ru}: ${all.length}…`; rerender();
          const r = await V.call('school_export', { p_part: part, p_offset: off, p_limit: 20000 });
          if (!r || !r.ok) { if (r && r.error === 'not_deployed') throw new Error('Сервер ещё без schema_v11: выгрузка недоступна'); if (r && r.error === 'network') throw new Error('Нет связи. Повторите, когда сеть появится.'); throw new Error('Не удалось выгрузить: ' + ru); }
          all.push(...r.rows); if (r.next == null) break; off = r.next;
        }
        z.file(`${part}.json`, JSON.stringify(all)); meta[part] = all.length;
      }
    } else { const st = S.state(); ['students', 'classes', 'grades', 'att', 'homework'].forEach(k => { z.file(`${k}.json`, JSON.stringify(st[k] || [])); meta[k] = (st[k] || []).length; }); }
    z.file('README.txt', 'Резервная копия SABAK+. Каждый файл — таблица в формате JSON. Содержит персональные данные: храните в защищённом месте.\nДата выгрузки: ' + meta.exported_at + '\n' + JSON.stringify(meta, null, 1));
    const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const stamp = new Date().toISOString().slice(0, 10); downloadBlob(blob, `sabak-backup-${stamp}.zip`);
    bk.text = 'Готово: файл сохранён.'; bk.last = new Date().toLocaleString('ru-RU'); toast('Резервная копия скачана', 'ok');
  } catch (e) { bk.text = e.message || 'Ошибка'; toast(bk.text, 'warn'); }
  finally { bk.busy = false; rerender(); }
  return true;
}
