// Conectar con la TV nunca ocurre dos veces a la vez (el reintento en segundo plano + un toque en "Enviar"): una sola
// conexión, una sola hora enviada, y un doble pedido no deja dos receptores de avisos. Se prueba ble.js solo, en una
// página en blanco (sin la app), con la TV simulada.
import { build } from '../node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
import { abrir, cerrar, informe } from './banco-lite.mjs';

const salida = await build({
  entryPoints: [fileURLToPath(new URL('../src/ble.js', import.meta.url))],
  bundle: true, format: 'iife', globalName: 'Ble', target: 'es2020', write: false, logLevel: 'error',
});
const codigo = salida.outputFiles[0].text;

const { pagina, errores, tv } = await abrir({
  esperar: false,
  ruta: '/blank.html',
  antes: (p) => p.route('**/blank.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })),
});
await pagina.addScriptTag({ content: codigo });

// 1. Tres pedidos de conexión a la vez: una sola conexión.
await pagina.evaluate(async () => { await Promise.all([Ble.buscar(), Ble.buscar(), Ble.buscar()]); });
let e = await pagina.evaluate(() => ({ conexiones: window.__tv.conexiones, horas: window.__tv.escrituras, conectado: Ble.estaConectado() }));
informe('tres "buscar" a la vez conectan UNA sola vez', e.conexiones === 1 && e.conectado, JSON.stringify(e));

// 2. Se corta; el reintento de fondo y un "Enviar" llegan juntos: una sola reconexión.
await pagina.evaluate(() => window.__tv.desconectar());
await pagina.waitForFunction(() => !Ble.estaConectado(), null, { timeout: 5000 });
const r = await pagina.evaluate(async () => {
  const resultados = await Promise.allSettled([Ble.reconectar(), Ble.buscar(), Ble.reconectar()]);
  return { resultados: resultados.map((x) => x.status + ':' + (x.value === undefined ? '' : x.value)), conexiones: window.__tv.conexiones, conectado: Ble.estaConectado() };
});
informe('reintento de fondo + Enviar a la vez: una sola reconexión', r.conexiones === 2 && r.conectado && r.resultados.every((x) => x.startsWith('fulfilled')), JSON.stringify(r));

// 3. La hora viaja una vez por conexión y las acciones salen en orden (la cola).
const horas = await pagina.evaluate(() => window.__tv.escrituras.filter((c) => c === 0x01).length);
informe('la hora se mandó una vez por conexión (2 conexiones = 2 horas)', horas === 2, String(horas));
const orden = await pagina.evaluate(async () => {
  const salidas = [];
  await Promise.all([1, 2, 3].map((n) => Ble.exclusivo(async () => { salidas.push('i' + n); await Ble.pedirEstado(); salidas.push('f' + n); })));
  return salidas.join(',');
});
informe('tres acciones a la vez se ejecutan en fila, sin mezclarse', orden === 'i1,f1,i2,f2,i3,f3', orden);

// 4. Si la TV no se deja conectar, TODOS los que esperaban se enteran (ninguno se queda colgado).
await pagina.evaluate(() => { window.__tv.desconectar(); window.__tv.noConectar = true; });
await pagina.waitForFunction(() => !Ble.estaConectado(), null, { timeout: 5000 });
const fallo = await pagina.evaluate(async () => {
  const x = await Promise.allSettled([Ble.buscar(), Ble.buscar()]);
  return x.map((y) => y.status);
});
informe('con la TV sin responder, ningún pedido se queda esperando', fallo.length === 2 && fallo.every((s) => s === 'rejected'), JSON.stringify(fallo));

informe('sin errores en la consola', errores.filter((x) => !/GATT|Failed to load/.test(x)).length === 0, errores.join(' | '));
cerrar();
