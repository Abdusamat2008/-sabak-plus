// Проверка формального фото профиля в браузере (face-api, модели лежат в /vendor — ничего не уходит на сторонние серверы).
// Критерии: одно лицо анфас · лицо крупно и по центру · без сильного наклона/поворота · разрешение · свет · резкость ·
// светлый ровный фон · глаза не закрыты тёмными очками/тенью. Если хоть один критерий не выполнен — фото не принимается.

export const CRITERIA = [
  'Официальное фото как на документы: одно лицо, смотрите прямо в камеру',
  'Лицо занимает около половины кадра и находится по центру',
  'Голова не наклонена и не повёрнута в сторону',
  'Светлый однотонный фон (стена, дверь), без людей и предметов позади',
  'Хорошее равномерное освещение, фото чёткое, не размытое',
  'Без тёмных очков, масок и закрытого лица. Не селфи с фильтрами',
  'Не меньше 400×400 пикселей, файл JPG/PNG/WebP до 8 МБ',
];

let loading = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src)); document.head.appendChild(s); }); }

export function loadEngine() {
  if (loading) return loading;
  loading = (async () => {
    if (!window.faceapi) await loadScript('/vendor/face-api.js');
    const fa = window.faceapi;
    try { await fa.tf.setBackend('webgl'); } catch { try { await fa.tf.setBackend('cpu'); } catch {} }
    await fa.tf.ready();
    await fa.nets.tinyFaceDetector.loadFromUri('/vendor/models');
    await fa.nets.faceLandmark68TinyNet.loadFromUri('/vendor/models');
    return fa;
  })().catch(e => { loading = null; throw e; });
  return loading;
}

export function fileToImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Файл не похож на изображение')); };
    img.src = url;
  });
}

const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
function stats(ctx, x, y, w, h) {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y)); w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
  const d = ctx.getImageData(x, y, w, h).data; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const l = lum(d, i); s += l; s2 += l * l; n++; }
  const m = s / n; return { mean: m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)), n };
}
// дисперсия лапласиана на уменьшенном сером изображении области — классическая метрика резкости
function sharpness(ctx, x, y, w, h) {
  const S = 96, c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(ctx.canvas, Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h), 0, 0, S, S);
  const d = cx.getImageData(0, 0, S, S).data, g = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) g[i] = lum(d, i * 4);
  let s = 0, s2 = 0, n = 0;
  for (let yy = 1; yy < S - 1; yy++) for (let xx = 1; xx < S - 1; xx++) {
    const v = 4 * g[yy * S + xx] - g[yy * S + xx - 1] - g[yy * S + xx + 1] - g[(yy - 1) * S + xx] - g[(yy + 1) * S + xx];
    s += v; s2 += v * v; n++;
  }
  const m = s / n; return s2 / n - m * m;
}
const avg = pts => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });

// Основная оценка. canvas — полноразмерное изображение (уже отрисованное), dets — результаты face-api
export function evaluate(canvas, dets) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d', { willReadFrequently: true });
  const checks = [], add = (id, label, ok, detail, hint) => checks.push({ id, label, ok, detail, hint });
  const faces = dets.length;
  add('res', 'Разрешение', Math.min(W, H) >= 400, `${W}×${H}`, 'Нужно не меньше 400×400 пикселей — снимите ближе или в большем качестве.');
  add('one', 'Одно лицо в кадре', faces === 1, faces === 0 ? 'лицо не найдено' : faces === 1 ? 'найдено 1' : `найдено ${faces}`,
    faces === 0 ? 'Лицо не обнаружено (или фото слишком размыто/тёмное): смотрите прямо в камеру, откройте лицо, снимайте при хорошем свете.' : 'В кадре должно быть только одно лицо — без других людей.');
  const meta = { verified: false, faces, w: W, h: H, v: 1 };
  if (faces !== 1) { return finish(checks, meta); }

  const det = dets[0], b = det.detection.box, pts = det.landmarks.positions;
  const fw = b.width / W, fh = b.height / H, cxr = (b.x + b.width / 2) / W, cyr = (b.y + b.height / 2) / H;
  add('size', 'Размер лица в кадре', fh >= 0.28 && fh <= 0.75, `${Math.round(fh * 100)}% высоты кадра`, fh < 0.28 ? 'Лицо слишком мелкое — подойдите ближе (лицо ≈ половина кадра).' : 'Лицо слишком крупное — отойдите чуть дальше, голова и плечи должны помещаться.');
  add('center', 'Лицо по центру', Math.abs(cxr - 0.5) <= 0.16 && cyr >= 0.22 && cyr <= 0.62, `смещение ${Math.round((cxr - 0.5) * 100)}%`, 'Поместите лицо в центр кадра, чуть выше середины.');

  const leftEye = avg(pts.slice(36, 42)), rightEye = avg(pts.slice(42, 48));
  const tilt = Math.abs(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI);
  add('tilt', 'Голова не наклонена', tilt <= 12, `${tilt.toFixed(1)}°`, 'Держите голову ровно, не наклоняйте к плечу.');
  const nose = pts[30], jl = pts[0], jr = pts[16];
  const ratio = Math.abs(nose.x - jl.x) / Math.max(1, Math.abs(jr.x - nose.x));
  add('yaw', 'Лицо анфас (без поворота)', ratio > 0.55 && ratio < 1.8, `симметрия ${ratio.toFixed(2)}`, 'Смотрите прямо в камеру, не поворачивайте голову в сторону.');

  const fx = Math.max(0, b.x), fy = Math.max(0, b.y), fW = Math.min(W - fx, b.width), fH = Math.min(H - fy, b.height);
  const face = stats(ctx, fx + fW * 0.2, fy + fH * 0.2, fW * 0.6, fH * 0.6);
  add('light', 'Освещение лица', face.mean >= 75 && face.mean <= 225 && face.sd >= 18, `яркость ${Math.round(face.mean)}, контраст ${Math.round(face.sd)}`,
    face.mean < 75 ? 'Слишком темно — встаньте лицом к окну или включите свет.' : face.mean > 225 ? 'Пересвет — уберите вспышку и прямой свет.' : 'Свет плоский/неравномерный — встаньте лицом к источнику света.');
  const sh = sharpness(ctx, fx, fy, fW, fH);
  add('sharp', 'Чёткость', sh >= 55, `резкость ${Math.round(sh)}`, 'Фото размытое — держите камеру неподвижно, протрите объектив, снимайте при свете.');

  // фон: полосы слева/справа от головы и сверху
  const sideW = Math.min(b.x, W - b.x - b.width), strips = [];
  const ok = (w) => w > W * 0.04;
  if (ok(b.x)) strips.push(stats(ctx, 0, 0, Math.max(2, b.x * 0.9), H * 0.7));
  if (ok(W - b.x - b.width)) strips.push(stats(ctx, b.x + b.width + (W - b.x - b.width) * 0.1, 0, (W - b.x - b.width) * 0.9, H * 0.7));
  if (b.y > H * 0.05) strips.push(stats(ctx, 0, 0, W, Math.max(2, b.y * 0.85)));
  const bgMean = strips.length ? strips.reduce((a, s) => a + s.mean, 0) / strips.length : 0;
  const bgSd = strips.length ? Math.max(...strips.map(s => s.sd)) : 99;
  add('bg', 'Светлый однотонный фон', strips.length > 0 && bgMean >= 115 && bgSd <= 48, strips.length ? `яркость фона ${Math.round(bgMean)}, пестрота ${Math.round(bgSd)}` : 'фон не виден',
    bgMean < 115 ? 'Фон тёмный — встаньте у светлой стены.' : 'Фон пёстрый — встаньте у ровной светлой стены, без людей и предметов.');

  // глаза не должны быть сильно темнее щёк (тёмные очки / тень)
  const eyeBox = { x: Math.min(leftEye.x, rightEye.x) - fW * 0.08, y: Math.min(leftEye.y, rightEye.y) - fH * 0.05, w: Math.abs(rightEye.x - leftEye.x) + fW * 0.16, h: fH * 0.12 };
  const eyes = stats(ctx, eyeBox.x, eyeBox.y, eyeBox.w, eyeBox.h);
  const cheeks = stats(ctx, pts[2].x + fW * 0.05, nose.y, Math.max(4, pts[14].x - pts[2].x - fW * 0.1), fH * 0.14);
  const er = eyes.mean / Math.max(1, cheeks.mean);
  add('eyes', 'Глаза открыты, без тёмных очков', er >= 0.5, `отношение яркости ${er.toFixed(2)}`, 'Снимите тёмные очки и уберите волосы/тень с глаз.');

  Object.assign(meta, { box: [b.x / W, b.y / H, b.width / W, b.height / H], score: +det.detection.score.toFixed(2), tilt: +tilt.toFixed(1), sharp: Math.round(sh), light: Math.round(face.mean), bg: Math.round(bgMean) });
  return finish(checks, meta);
}
function finish(checks, meta) {
  const ok = checks.every(c => c.ok); meta.verified = ok;
  return { ok, checks, meta, failed: checks.filter(c => !c.ok) };
}

// Полный путь: файл → проверка → готовый обрезанный JPEG (3:4) для загрузки
export async function checkPhoto(file) {
  if (typeof window !== 'undefined' && window.__faceStub) return window.__faceStub(file);   // только для автотестов
  if (!file) throw new Error('Файл не выбран');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Допустимы только JPG, PNG или WebP');
  if (file.size > 8 * 1024 * 1024) throw new Error('Файл больше 8 МБ');
  const img = await fileToImage(file);
  const sc = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(img.naturalWidth * sc); canvas.height = Math.round(img.naturalHeight * sc);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
  const resNote = Math.min(img.naturalWidth, img.naturalHeight);
  const fa = await loadEngine();
  const dets = await fa.detectAllFaces(canvas, new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })).withFaceLandmarks(true);
  // разрешение оцениваем по исходнику
  const real = { ...canvas, width: canvas.width, height: canvas.height };
  const res = evaluate(canvas, dets);
  const rc = res.checks.find(c => c.id === 'res'); rc.ok = resNote >= 400; rc.detail = `${img.naturalWidth}×${img.naturalHeight}`;
  res.ok = res.checks.every(c => c.ok); res.meta.verified = res.ok; res.failed = res.checks.filter(c => !c.ok);
  if (res.ok) res.blob = await cropBlob(canvas, dets[0].detection.box);
  return res;
}

export function cropBlob(canvas, b) {
  const H = canvas.height, W = canvas.width;
  let ch = Math.min(H, b.height / 0.5), cw = ch * 0.75;
  if (cw > W) { cw = W; ch = cw / 0.75; }
  let x = b.x + b.width / 2 - cw / 2, y = b.y + b.height / 2 - ch * 0.48;
  x = Math.max(0, Math.min(W - cw, x)); y = Math.max(0, Math.min(H - ch, y));
  const out = document.createElement('canvas'); out.width = 480; out.height = 640;
  out.getContext('2d').drawImage(canvas, x, y, cw, ch, 0, 0, 480, 640);
  return new Promise(r => out.toBlob(r, 'image/jpeg', 0.86));
}
