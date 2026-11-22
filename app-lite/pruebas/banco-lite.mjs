// Banco de pruebas de la app Lite: sirve app-lite/www (lo que arma construir.mjs) y lo abre en un navegador
// (Playwright, del banco de la Pro) con un Bluetooth FALSO que responde como la TV (tv-simulada.js).
// Uso: node construir.mjs && node pruebas/<prueba>.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('../../pruebas/node_modules/playwright');

export const WWW = path.resolve(fileURLToPath(new URL('../www', import.meta.url)));
const SIMULADA = fileURLToPath(new URL('./tv-simulada.js', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.m1': 'application/octet-stream' };

let servidor = null;
export async function iniciarServidor(puerto = 8766) {
  if (servidor) return `http://127.0.0.1:${puerto}`;
  servidor = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const archivo = path.join(WWW, url === '/' ? 'index.html' : url);
    if (!archivo.startsWith(WWW) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
  await new Promise((r) => servidor.listen(puerto, '127.0.0.1', r));
  return `http://127.0.0.1:${puerto}`;
}

const abiertos = new Set();
export function cerrar() {
  if (servidor) servidor.close();
  servidor = null;
  for (const n of abiertos) n.close().catch(() => {});
  abiertos.clear();
  setTimeout(() => process.exit(process.exitCode || 0), 15000).unref();
}

/**
 * Abre la app Lite. Devuelve { navegador, pagina, errores, tv }: errores = errores de consola/página (deben quedar
 * vacíos); tv() = lo que "sabe" la TV simulada ahora mismo.
 * opciones: ancho/alto del celular, antes(pagina) para preparar la página, esperar (false = no espera la carga).
 */
export async function abrir({ ancho = 390, alto = 844, antes = null, esperar = true, ruta = '/index.html' } = {}) {
  const base = await iniciarServidor();
  const navegador = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
  abiertos.add(navegador);
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
  pagina.on('pageerror', (e) => errores.push('página: ' + e.message));
  await pagina.route(/favicon\.ico$/, (r) => r.fulfill({ status: 204, body: '' }));
  await pagina.addInitScript({ path: SIMULADA });
  if (antes) await antes(pagina);
  await pagina.goto(base + ruta);
  if (esperar) {
    await pagina.waitForFunction(() => document.getElementById('estadoTexto') && !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
  }
  const tv = () => pagina.evaluate(() => window.__tv.estado());
  return { navegador, pagina, errores, tv };
}

export function informe(nombre, ok, detalle = '') {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) process.exitCode = 1;
  return ok;
}
