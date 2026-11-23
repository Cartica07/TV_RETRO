// Banco de pruebas de la app unificada: sirve app-unificada/www (lo que arma construir.mjs) y lo abre en un navegador (Playwright,
// del banco de la Pro) con DOS cosas falsas: Firebase en memoria (pruebas/falso/ de la Pro, SIN modificarlo) y un Bluetooth que
// responde como una TV Lite (app-lite/pruebas/tv-simulada.js). No toca la base real ni ninguna TV.
// Uso: node construir.mjs && node pruebas/<prueba>.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('../../pruebas/node_modules/playwright');

export const WWW = path.resolve(fileURLToPath(new URL('../www', import.meta.url)));
const FALSO = fileURLToPath(new URL('../../pruebas/falso', import.meta.url));
const SIMULADA = fileURLToPath(new URL('../../app-lite/pruebas/tv-simulada.js', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

let servidor = null;
export async function iniciarServidor(puerto = 8767) {
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

// signInAnonymously para el Auth falso (pruebas/falso/firebase-auth.js de la Pro, que NO se modifica): usa sus mismas piezas
// (f, operacion, avisar). Respeta f.fallar, así una prueba puede simular "el acceso sin cuenta no está activado".
const ANONIMO_FALSO = `
// La sesión sobrevive a una recarga (como la anónima real): si la recordada es la anónima, su usuario tiene que existir.
if (f.actual === '(anonimo)' && !f.usuarios['(anonimo)']) f.usuarios['(anonimo)'] = { uid: 'uid-anonimo', verificado: false };
export async function signInAnonymously(auth) {
  await operacion('signInAnonymously', []);
  const clave = '(anonimo)';
  if (!f.usuarios[clave]) f.usuarios[clave] = { uid: 'uid-anonimo', verificado: false };
  f.actual = clave; avisar();
  return { user: usuarioActual() };
}
`;

export const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };

/**
 * Abre la app con la base falsa sembrada (semilla) y, por defecto, con la cuenta de Ana ya con sesión.
 * opciones: logueado, ruta, antes(pagina), esperar (false = no espera la carga), vinculados (lo que "el celular tiene emparejado").
 * Devuelve { navegador, pagina, errores }.
 */
export async function abrir(semilla = {}, { logueado = true, ruta = '/index.html', antes = null, esperar = true, vinculados = [] } = {}) {
  const base = await iniciarServidor();
  const navegador = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
  abiertos.add(navegador);
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
  pagina.on('pageerror', (e) => errores.push('página: ' + e.message));
  pagina.on('dialog', (d) => d.accept());

  await pagina.route('https://www.gstatic.com/firebasejs/**', (r) => {
    const nombre = r.request().url().split('/').pop();
    let cuerpo = fs.readFileSync(path.join(FALSO, nombre), 'utf8');
    // El Auth falso de la Pro no tiene la entrada sin cuenta (sesión anónima): se le agrega SOLO en esta copia servida.
    if (nombre === 'firebase-auth.js') cuerpo += ANONIMO_FALSO;
    r.fulfill({ contentType: 'text/javascript', body: cuerpo });
  });
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await pagina.route(/favicon\.ico$/, (r) => r.fulfill({ status: 204, body: '' }));

  await pagina.addInitScript({ path: SIMULADA });
  // El tutorial guiado taparía las pruebas: se da por visto (lo dice el arnés, no la app).
  await pagina.addInitScript(() => {
    const leer = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (typeof k === 'string' && k.startsWith('tvretro.tutorial.')) return '1';
      return leer.call(this, k);
    };
  });
  await pagina.addInitScript((s) => { globalThis.__semilla = s; }, semilla);
  await pagina.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: logueado ? 'ana@correo.com' : null });
  // "Lo que el celular tiene emparejado": el plugin de Bluetooth no lo ofrece en el navegador (ver app-lite/src/ble.js).
  await pagina.addInitScript((v) => { window.__vinculadosPrueba = () => (window.__vinculados || v); }, vinculados);
  if (antes) await antes(pagina);
  await pagina.goto(base + ruta);
  if (!esperar) return { navegador, pagina, errores };
  await pagina.waitForFunction(() => document.getElementById('estadoTexto') && !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
  return { navegador, pagina, errores };
}

export function informe(nombre, ok, detalle = '') {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

// ---- Ayudas comunes ----
export const pant = (texto) => ({ tipo: 'texto', texto, config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } });
export const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
export const esperarPanel = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
export const escrituras = (p) => p.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
export const lecturas = (p) => p.evaluate(() => globalThis.__fakeDb.lecturas);
export const estadoTV = (p) => p.evaluate(() => window.__tv.estado());
export const erroresPagina = (e) => e.filter((x) => x.startsWith('página:'));
