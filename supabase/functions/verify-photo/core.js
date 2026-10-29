// Серверные проверки фото. Чистая функция над пикселями — одинаково работает в Deno (Edge Function) и в Node (тесты).
// ВАЖНО: это не распознавание лица нейросетью, а независимая проверка «картинки как данных»:
// формат/размер, экспозиция, контраст, резкость и присутствие областей цвета кожи в центре кадра.
// Распознавание лица остаётся в браузере (см. README, раздел «Честные ограничения»).
export const LIMITS = { minW: 240, minH: 320, maxW: 1600, maxH: 2133, ratio: [0.70, 0.80], lum: [55, 215], contrast: 25, sharp: 14, skin: 0.06 };

export function analyse(rgba, w, h) {
  const checks = [], add = (id, label, ok, detail) => checks.push({ id, label, ok, detail });
  add('size', 'Размер кадра', w >= LIMITS.minW && h >= LIMITS.minH && w <= LIMITS.maxW && h <= LIMITS.maxH, `${w}×${h}`);
  const r = w / h; add('ratio', 'Формат 3:4 (портрет)', r >= LIMITS.ratio[0] && r <= LIMITS.ratio[1], r.toFixed(2));
  const n = w * h, Y = new Float32Array(n);
  let sum = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) { const y = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]; Y[i] = y; sum += y; }
  const mean = sum / n; let v = 0; for (let i = 0; i < n; i++) v += (Y[i] - mean) ** 2; const sd = Math.sqrt(v / n);
  add('light', 'Освещение', mean >= LIMITS.lum[0] && mean <= LIMITS.lum[1], `яркость ${mean.toFixed(0)}`);
  add('contrast', 'Контрастность', sd >= LIMITS.contrast, `σ ${sd.toFixed(0)}`);
  // резкость: дисперсия лапласиана в центральной области (там лицо)
  const x0 = Math.floor(w * 0.25), x1 = Math.ceil(w * 0.75), y0 = Math.floor(h * 0.15), y1 = Math.ceil(h * 0.7);
  let ls = 0, lq = 0, c = 0;
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const i = y * w + x, l = 4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - w] - Y[i + w]; ls += l; lq += l * l; c++;
  }
  const lv = c ? lq / c - (ls / c) ** 2 : 0;
  add('sharp', 'Резкость', lv >= LIMITS.sharp, `${lv.toFixed(0)}`);
  // цвет кожи в центре (YCbCr): грубая проверка «в кадре есть человек, а не пейзаж/документ/пустота»
  let skin = 0, tot = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = (y * w + x) * 4, R = rgba[p], G = rgba[p + 1], B = rgba[p + 2];
    const cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B, cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && R > 60) skin++; tot++;
  }
  const sf = tot ? skin / tot : 0; add('skin', 'Лицо/кожа в центре кадра', sf >= LIMITS.skin, `${(sf * 100).toFixed(0)}%`);
  return { ok: checks.every(x => x.ok), checks, failed: checks.filter(x => !x.ok).map(x => x.label) };
}
