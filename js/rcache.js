// Память для чтения без интернета: ответы «читающих» запросов (новости, Үн, календарь, табель, удостоверение, Алтын…)
// запоминаются на устройстве отдельно для каждого пользователя. Нет связи — показываем последнее полученное.
import * as API from './api.js';
import * as Net from './net.js';
const READ = new Set(['news_list', 'th_feed', 'th_me', 'th_settings', 'th_profile_get', 'th_comments', 'coin_state', 'calendar_get', 'student_history', 'id_card', 'report_rows', 'grade_detail', 'coin_staff']);
const CAP = 1_500_000;                      // символов на пользователя (~1,5 МБ), старые записи вытесняются
const keyName = () => 'sabak.rc.' + (API.userId() || 'anon');
const load = () => { try { return JSON.parse(localStorage.getItem(keyName()) || '{}'); } catch { return {}; } };
function store(m) {
  let s = JSON.stringify(m);
  if (s.length > CAP) { const ks = Object.keys(m).sort((a, b) => m[a].t - m[b].t); while (s.length > CAP * 0.8 && ks.length) { delete m[ks.shift()]; s = JSON.stringify(m); } }
  try { localStorage.setItem(keyName(), s); } catch { try { localStorage.removeItem(keyName()); } catch {} }
}
const k = (name, args) => name + ':' + JSON.stringify(args || {});
export const clear = () => { try { Object.keys(localStorage).filter(x => x.startsWith('sabak.rc.')).forEach(x => localStorage.removeItem(x)); } catch {} };
/** Выполнить запрос; читающие запросы запоминаем и отдаём из памяти, если связи нет */
export async function cached(name, args, doCall) {
  if (!READ.has(name)) return doCall();
  const key = k(name, args);
  if (!Net.isOnline()) { const hit = load()[key]; return hit ? { ...hit.v, stale: true, staleAt: hit.t } : { ok: false, error: 'network' }; }
  const r = await doCall();
  if (r && r.ok) { const m = load(); m[key] = { t: Date.now(), v: r }; store(m); return r; }
  if (r && r.error === 'network') { const hit = load()[key]; if (hit) return { ...hit.v, stale: true, staleAt: hit.t }; }
  return r;
}

// Записывающие запросы, которые безопасно отложить без сети (текст и реакции). Деньги («Алтын»), календарь и удаление не откладываются.
const WRITE = { news_post: 'Новость', news_edit: 'Правка новости', super_news_post: 'Новость платформы', th_post: 'Пост в «Үн»', th_comment: 'Комментарий', th_react: 'Реакция', th_vote: 'Голос в опросе', th_edit: 'Правка поста', th_report: 'Жалоба', grade_note_set: 'Тема и комментарий к оценке' };
/** Нет связи — кладём запрос в очередь устройства (она отправится сама), ученик/учитель видят «сохранено» */
export async function queued(name, args, doCall, enqueue) {
  if (!WRITE[name]) return doCall();
  const park = () => { enqueue(name, args, WRITE[name]); try { window.dispatchEvent(new CustomEvent('sabak:queued', { detail: { name } })); } catch {} return { ok: true, queued: true }; };
  if (!Net.isOnline()) return park();
  const r = await doCall();
  return r && r.error === 'network' ? park() : r;
}
