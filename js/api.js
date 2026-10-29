// Тонкий клиент Supabase на fetch: вход (GoTrue), таблицы (PostgREST), функции (RPC), файлы (Storage).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export const configured = () => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_KEY.length > 40;
const SKEY = 'sabak.auth.v1';
let sess = null;
try { sess = JSON.parse(localStorage.getItem(SKEY)); } catch {}
const saveSess = s => { sess = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch {} };
export const session = () => sess;
export const userId = () => sess && sess.user && sess.user.id;

export class ApiError extends Error { constructor(msg, status, body) { super(msg); this.status = status; this.body = body; this.network = status === 0; } }

const RU = [[/invalid login credentials/i, 'Неверная почта или пароль'], [/already registered|already been registered/i, 'Эта почта уже зарегистрирована — войдите'], [/password should be at least/i, 'Пароль слишком короткий (минимум 8 символов)'],
  [/email not confirmed/i, 'Почта не подтверждена — введите код из письма'], [/token has expired|otp.*expired|invalid.*(token|otp)|token.*invalid/i, 'Код неверный или просрочен. Запросите новый'], [/rate limit|too many|after \d+ seconds/i, 'Слишком часто. Подождите минуту и повторите'], [/invalid email|unable to validate email|is invalid/i, 'Некорректная почта'], [/rate limit|too many/i, 'Слишком много попыток, подождите минуту'],
  [/signup.*disabled|signups not allowed/i, 'Регистрация отключена в настройках Supabase'], [/row-level security/i, 'Недостаточно прав для этого действия']];
const human = m => { for (const [re, t] of RU) if (re.test(m || '')) return t; return m || 'Ошибка запроса'; };

async function call(path, { method = 'GET', body, headers = {}, auth = true, raw = false, retry = true } = {}) {
  if (auth) await ensureFresh();
  const h = { apikey: SUPABASE_KEY, ...headers };
  h.Authorization = 'Bearer ' + (auth && sess ? sess.access_token : SUPABASE_KEY);
  if (body !== undefined && !(body instanceof Blob)) h['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(SUPABASE_URL + path, { method, headers: h, body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body) }); }
  catch (e) { throw new ApiError('Нет связи с сервером', 0); }
  if (res.status === 401 && auth && retry && sess) { try { await refresh(); } catch { throw new ApiError('Сессия истекла — войдите снова', 401); } return call(path, { method, body, headers, auth, raw, retry: false }); }
  if (raw) { if (!res.ok) throw new ApiError('Файл недоступен', res.status); return res; }
  const txt = await res.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!res.ok) { const m = j && (j.message || j.msg || j.error_description || j.error) || res.statusText; throw new ApiError(human(m), res.status, j); }
  return j;
}

// ---- авторизация ----
async function ensureFresh() { if (sess && sess.expires_at && sess.expires_at * 1000 - Date.now() < 60000) { try { await refresh(); } catch (e) { if (e.status === 0) return; throw e; } } }
let refreshing = null;
export function refresh() {
  if (!sess) return Promise.reject(new ApiError('Нет сессии', 401));
  if (!refreshing) refreshing = call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token }, auth: false })
    .then(r => { saveSess(norm(r)); }).finally(() => { refreshing = null; });
  return refreshing;
}
const norm = r => ({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: { id: r.user.id, email: r.user.email } });
export async function signIn(email, password) { const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }); saveSess(norm(r)); return sess; }
export async function signUp(email, password, data = {}) {
  const r = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data }, auth: false });
  if (r && r.access_token) { saveSess(norm(r)); return { session: sess }; }
  return { needConfirm: true };
}
// подтверждение почты 6-значным кодом из письма (в шаблоне Supabase стоит {{ .Token }})
export async function verifyEmail(email, token) {
  const r = await call('/auth/v1/verify', { method: 'POST', body: { type: 'signup', email, token: String(token).replace(/\D/g, '') }, auth: false });
  if (!r || !r.access_token) throw new ApiError('Код не подошёл', 400);
  saveSess(norm(r)); return sess;
}
export const resendCode = email => call('/auth/v1/resend', { method: 'POST', body: { type: 'signup', email }, auth: false });
export async function signOut() { try { if (sess) await call('/auth/v1/logout', { method: 'POST' }); } catch {} saveSess(null); }

// ---- данные ----
export const rest = (method, table, { query = '', body, prefer } = {}) =>
  call(`/rest/v1/${table}${query ? '?' + query : ''}`, { method, body, headers: prefer ? { Prefer: prefer } : {} });
export const select = (table, query = '') => rest('GET', table, { query });
export async function selectAll(table, query = '') {   // постранично: Supabase отдаёт максимум 1000 строк за запрос
  const out = [], step = 1000;
  for (let from = 0; ; from += step) {
    const page = await call(`/rest/v1/${table}?${query}`, { headers: { Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items' } });
    out.push(...page); if (page.length < step) break;
  }
  return out;
}
export const rpc = (name, args = {}, anon = false) => call(`/rest/v1/rpc/${name}`, { method: 'POST', body: args, auth: !anon });

// ---- файлы ----
export const upload = (bucket, path, blob) => call(`/storage/v1/object/${bucket}/${path}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' } });
export async function download(bucket, path) { const r = await call(`/storage/v1/object/authenticated/${bucket}/${path}`, { raw: true }); return r.blob(); }
export const removeFile = (bucket, path) => call(`/storage/v1/object/${bucket}/${path}`, { method: 'DELETE' });

// ---- Edge Functions ----
export const fn = (name, body, headers = {}) => call(`/functions/v1/${name}`, { method: 'POST', body, headers });

// ---- восстановление пароля ----
export const recover = email => call('/auth/v1/recover', { method: 'POST', body: { email }, auth: false });
export function sessionFromHash(hash) {            // ссылка из письма: #access_token=...&refresh_token=...&type=recovery
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.get('access_token')) return null;
  let uid = null; try { uid = JSON.parse(atob(p.get('access_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch {}
  saveSess({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600), user: { id: uid, email: '' } });
  return p.get('type');
}
export const updatePassword = password => call('/auth/v1/user', { method: 'PUT', body: { password } });
