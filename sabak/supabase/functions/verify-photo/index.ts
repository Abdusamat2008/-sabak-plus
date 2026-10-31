// Supabase Edge Function: verify-photo
// Принимает JPEG (тело запроса), заголовок x-student-id. Проверяет право пользователя, анализирует картинку,
// сохраняет в бакет avatars и записывает фото в базу через set_student_photo_server (доступна только service_role).
// Деплой: supabase functions deploy verify-photo   (или через Dashboard → Edge Functions → Deploy new function)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import jpeg from 'https://esm.sh/jpeg-js@0.4.4';
import { analyse } from './core.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-student-id, x-client-meta', 'access-control-allow-methods': 'POST, OPTIONS' };
const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return out(405, { ok: false, error: 'method' });
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('authorization') || '';
  const student = req.headers.get('x-student-id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(student)) return out(400, { ok: false, error: 'student' });

  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: me } = await asUser.auth.getUser();
  if (!me?.user) return out(401, { ok: false, error: 'auth' });
  const { data: can } = await asUser.rpc('can_edit_photo_check', { p_student: student });   // право меняет фото именно этого ученика
  if (can !== true) return out(403, { ok: false, error: 'forbidden' });

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > 1_000_000) return out(413, { ok: false, error: 'too_big', message: 'Файл больше 1 МБ' });
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return out(415, { ok: false, error: 'not_jpeg', message: 'Нужен JPEG' });
  let img;
  try { img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 64 }); } catch { return out(422, { ok: false, error: 'decode', message: 'Файл повреждён' }); }
  const res = analyse(img.data, img.width, img.height);
  if (!res.ok) return out(422, { ok: false, error: 'rejected', failed: res.failed, checks: res.checks });

  let clientMeta: Record<string, unknown> = {};
  try { clientMeta = JSON.parse(req.headers.get('x-client-meta') || '{}'); } catch { /* ignore */ }
  const admin = createClient(url, service);
  const { data: sc } = await admin.from('students').select('school_id').eq('id', student).single();
  if (!sc) return out(404, { ok: false, error: 'student' });
  const path = `${sc.school_id}/${student}/avatar.jpg`;
  const up = await admin.storage.from('avatars').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (up.error) return out(500, { ok: false, error: 'upload', message: up.error.message });
  const meta = { ...clientMeta, verified: true, faces: 1, server: true, server_checks: res.checks.map((c) => ({ id: c.id, ok: c.ok })) };
  const { data: r, error } = await admin.rpc('set_student_photo_server', { p_student: student, p_path: path, p_meta: meta, p_actor: me.user.id });
  if (error || !r?.ok) return out(500, { ok: false, error: 'db', message: error?.message || r?.error });
  return out(200, { ok: true, path, checks: res.checks });
});
