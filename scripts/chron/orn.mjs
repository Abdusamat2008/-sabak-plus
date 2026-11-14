// Орнаменты: «кошкар-муйуз» (рога барана) и ромбовидный пояс. Простые контуры, цвет берут из currentColor.
export const HORN = 'M50 50C50 30 32 22 22 32C12 42 20 58 32 54C42 51 42 40 34 40M50 50C50 30 68 22 78 32C88 42 80 58 68 54C58 51 58 40 66 40M50 50V92M40 72H60';
export const horn = (cls = '', w = 2) => `<svg class="orn ${cls}" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${HORN}"/></svg>`;
export const tile = (id = 'ot') => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="${id}" width="64" height="64" patternUnits="userSpaceOnUse"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M32 4L60 32L32 60L4 32Z"/><path d="M32 18L46 32L32 46L18 32Z"/><path d="M0 0L8 8M64 0L56 8M0 64L8 56M64 64L56 56"/></g></pattern></defs></svg>`;
export const mark = (id = 'ot', cls = '') => `<svg class="wm ${cls}" aria-hidden="true" focusable="false" width="100%" height="100%">${`<rect width="100%" height="100%" fill="url(#${id})"/>`}</svg>`;
// Страница-орнамент в виде бордюра для SVG: возвращает <g> с рядом рогов
export const row = (n = 8, w = 100) => Array.from({ length: n }, (_, i) => `<g transform="translate(${i * w} 0)"><path d="${HORN}" transform="scale(${w / 100})"/></g>`).join('');
