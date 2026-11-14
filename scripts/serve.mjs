// Локальный сервер с «чистыми адресами» как на Vercel (cleanUrls). Запуск: node scripts/serve.mjs [порт]
import { createServer } from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import { extname, join, normalize } from 'node:path';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const root = process.cwd(), port = +process.argv[2] || 8765;
const redirects = { '/updates/0-11-zhylnaama': '/updates/0-11-zhylsanak' };
createServer(async (q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (redirects[p]) { r.writeHead(308, { Location: redirects[p] }); return r.end(); }
  const tryf = async f => { try { const s = await stat(f); return s.isFile() ? f : null; } catch { return null; } };
  const base = normalize(join(root, p)); if (!base.startsWith(root)) { r.writeHead(403); return r.end(); }
  const f = (await tryf(base)) || (await tryf(base + '.html')) || (await tryf(join(base, 'index.html')));
  if (!f) { r.writeHead(404, { 'Content-Type': 'text/plain' }); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f));
}).listen(port, () => console.log('http://localhost:' + port));
