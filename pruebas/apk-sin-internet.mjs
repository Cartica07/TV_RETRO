import { fileURLToPath } from 'node:url';
// La copia de la APK (app-android/www) abre SIN internet, con el SDK real de Firebase y las fuentes locales.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const WWW = path.resolve(fileURLToPath(new URL('../app-android/www', import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(WWW, u === '/' ? 'index.html' : u); if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => srv.listen(8766, '127.0.0.1', r));
const nav = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const pag = await ctx.newPage();
const externas = [], errores = [];
pag.on('request', (q) => { if (!q.url().startsWith('http://127.0.0.1:8766')) externas.push(q.url()); });
pag.on('pageerror', (e) => errores.push('página: ' + e.message));
pag.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text().slice(0, 160)); });
await ctx.route('**/*', (rt) => (rt.request().url().startsWith('http://127.0.0.1:8766') ? rt.continue() : rt.abort()));
await pag.goto('http://127.0.0.1:8766/index.html');
await pag.waitForTimeout(4000);
const r = await pag.evaluate(async () => ({
  login: !document.getElementById('pantallaLogin').hidden,
  google: !document.getElementById('loginGoogle').hidden,
  fuentes: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).sort(),
  familiaTitulo: getComputedStyle(document.querySelector('.login-titulo')).fontFamily.slice(0, 40)
}));
const ok = r.login && externas.length === 0 && errores.filter((e) => e.startsWith('página:')).length === 0 && r.fuentes.length > 0;
console.log(ok ? 'OK   ' : 'FALLA', 'APK sin internet: abre, muestra el login, sin pedir nada afuera y con las fuentes locales —', JSON.stringify({ login: r.login, googleVisibleEnWeb: r.google, externas, fuentes: r.fuentes, errores }));
await nav.close(); srv.close();
