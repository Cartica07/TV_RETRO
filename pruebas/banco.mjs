// Banco de pruebas: sirve el panel desde la copia local del repo y lo abre
// en Chrome (Playwright) con Firebase reemplazado por falso/*.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FALSO = fileURLToPath(new URL('./falso', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

let servidor = null;
export async function iniciarServidor(puerto = 8765) {
  if (servidor) return `http://127.0.0.1:${puerto}`;
  servidor = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const archivo = path.join(REPO, url === '/' ? 'index.html' : url);
    if (!archivo.startsWith(REPO) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
  await new Promise((r) => servidor.listen(puerto, '127.0.0.1', r));
  return `http://127.0.0.1:${puerto}`;
}
// Navegadores abiertos por abrir(): si un escenario falla antes de cerrar el suyo, el proceso de Node se quedaba
// esperando para siempre (varias suites no llaman a process.exit). cerrarServidor() los cierra y deja un tope.
const navegadoresAbiertos = new Set();
export function cerrarServidor() {
  if (servidor) servidor.close();
  servidor = null;
  for (const n of navegadoresAbiertos) n.close().catch(() => {});
  navegadoresAbiertos.clear();
  // Tope: pase lo que pase, el proceso termina (con el código que la suite haya dejado) a los 15 s.
  setTimeout(() => process.exit(process.exitCode || 0), 15000).unref();
}

// Un clic que termina en location.reload() (desvincular, salir de una TV, baja de cuenta) destruye la página: una
// consulta justo en ese momento fallaba con "Execution context was destroyed". Se espera la carga y se repite.
const REINTENTOS_RECARGA = 8;
function tolerarRecargas(pagina) {
  const original = pagina.evaluate.bind(pagina);
  pagina.evaluate = async (...args) => {
    for (let i = 0; ; i++) {
      try { return await original(...args); } catch (e) {
        if (i >= REINTENTOS_RECARGA || !/Execution context was destroyed|most likely because of a navigation/i.test(String(e && e.message))) throw e;
        await pagina.waitForLoadState('load').catch(() => {});
        await pagina.waitForTimeout(250).catch(() => {});
      }
    }
  };
}

/**
 * Abre el panel con la base sembrada. Devuelve { navegador, pagina, errores }.
 * errores: errores de consola y de página (las pruebas esperan que quede vacío).
 */
export async function abrir(semilla = {}, { ancho = 390, alto = 844, antes = null, esperar = true, retrasos = null, ruta = '/index.html?sincuentas=1' } = {}) {
  const base = await iniciarServidor();
  const navegador = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
  navegadoresAbiertos.add(navegador);
  navegador.on('disconnected', () => navegadoresAbiertos.delete(navegador));
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const pagina = await contexto.newPage();
  tolerarRecargas(pagina);
  const errores = [];
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
  pagina.on('pageerror', (e) => errores.push('página: ' + e.message));

  await pagina.route('https://www.gstatic.com/firebasejs/**', (ruta) => {
    const nombre = ruta.request().url().split('/').pop();
    ruta.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(FALSO, nombre), 'utf8') });
  });
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (ruta) => ruta.fulfill({ contentType: 'text/css', body: '' }));
  await pagina.route(/favicon\.ico$/, (ruta) => ruta.fulfill({ status: 204, body: '' }));

  await pagina.addInitScript((s) => { globalThis.__semilla = s; }, semilla);
  if (retrasos) await pagina.addInitScript((r) => { globalThis.__retrasosIniciales = r; }, retrasos);
  if (antes) await antes(pagina);
  await pagina.goto(base + ruta);
  if (!esperar) return { navegador, pagina, errores };
  // Espera a que termine la carga inicial (el estado deja de decir "Cargando…").
  await pagina.waitForFunction(() => !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
  return { navegador, pagina, errores };
}

/** Lee los píxeles del canvas #oled (128×64) como colores "r,g,b" únicos y el mapa encendido. */
export async function leerOled(pagina, selector = '#oled') {
  return pagina.evaluate((sel) => {
    const c = document.querySelector(sel);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colores = new Set();
    let encendidos = 0;
    for (let i = 0; i < d.length; i += 4) {
      colores.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      if (d[i + 1] > 100) encendidos++;
    }
    return { colores: [...colores], encendidos };
  }, selector);
}

export function informe(nombre, ok, detalle = '') {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  return ok;
}
