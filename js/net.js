// Автоопределение связи: события браузера + «пульс» (реальный запрос), потому что navigator.onLine врёт
// (Wi-Fi есть, а интернета нет). Никаких ручных переключателей: система сама понимает, что связь пропала/вернулась.
let forced = null; // только для демо-сценария: имитация обрыва связи
let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
const subs = new Set();
export const isOnline = () => online;
export const onChange = fn => { subs.add(fn); return () => subs.delete(fn); };

export async function ping() {
  if (forced === 'off') return false;
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4500);
  try { await fetch('/hb?' + Date.now(), { cache: 'no-store', signal: ac.signal }); return true; }
  catch { return false; } finally { clearTimeout(tm); }
}
function set(v) { if (v !== online) { online = v; subs.forEach(f => f(v)); } }
export function force(v) { forced = v ? 'off' : null; if (v) set(false); else check(); }
export async function check() { set(await ping()); return online; }

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set(false));
  window.addEventListener('online', () => { check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  // Пульс редкий, пока всё хорошо (один запрос в минуту и только при открытой вкладке); при обрыве проверяем чаще, чтобы быстро вернуться в сеть
  const loop = () => setTimeout(async () => { if (!document.hidden || !online) await check(); loop(); }, online ? 60000 + Math.floor(Math.random() * 15000) : 7000);
  loop();
  check();
}
