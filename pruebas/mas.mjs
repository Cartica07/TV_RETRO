// Pestaña "Más": menú de opciones; cada opción (Galería, Juegos) en su propia pantalla con título y
// volver. "Jugar" manda la orden a la TV.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 5, contadorVersion: 5, pantalla: pant } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }
});
async function abrirApp({ app = false } = {}) {
  const r = await abrir(semilla(), { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true;
      if (s.app) globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio = (globalThis.__salio || 0) + 1; } } } };
    }, { auth: { usuarios: USUARIOS, actual: 'ana@correo.com' }, app });
  } });
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
  return r;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const entrarMas = async (p) => { await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(250); };
const abrirOpcion = async (p, op) => { await p.click(`#grupoMas button[data-mas="${op}"]`); await p.waitForTimeout(250); };
const pantalla = (p) => p.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota);
const estadoVistas = (p) => p.evaluate(() => {
  const v = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
  return { menu: v('#seccionMasSelector'), cabecera: v('#cabeceraMas'), titulo: document.getElementById('tituloMas').textContent, juegos: v('#seccionJuegos'), galeria: v('#seccionGaleria'), herramientas: v('#seccionGaleriaFinal'), enviar: v('.barra-accion'), invertir: v('#filaInvertido') };
});

const escenarios = {
  async 'Más abre en el menú, solo con las opciones'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina);
    const e = await estadoVistas(pagina);
    const opciones = await pagina.$$eval('#grupoMas button[data-mas]', (bs) => bs.map((b) => b.textContent.trim()));
    const nav = await txt(pagina, '#grupoTipo button[data-valor="galeria"] span');
    await navegador.close();
    return informe('Más: solo el menú (Galería, Juegos, Alarma, Config), sin cabecera, sin Enviar ni Invertir', e.menu && !e.cabecera && !e.juegos && !e.galeria && !e.herramientas && !e.enviar && !e.invertir && opciones.join('|') === 'Galería|Juegos|Alarma|Config' && nav === 'Más', JSON.stringify({ e, opciones, nav }));
  },
  async 'Juegos: pantalla propia con título y solo los juegos'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    const e = await estadoVistas(pagina);
    const filas = await pagina.locator('.fila-juego').count();
    await navegador.close();
    return informe('Juegos: título "Juegos", 5 juegos, sin el menú ni la Galería ni Enviar', !e.menu && e.cabecera && e.titulo === 'Juegos' && e.juegos && !e.galeria && !e.herramientas && !e.enviar && filas === 5, JSON.stringify({ e, filas }));
  },
  async 'Galería: pantalla propia con título, herramientas y Enviar'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'galeria');
    const e = await estadoVistas(pagina);
    await navegador.close();
    return informe('Galería: título "Galería", grillas y herramientas, Enviar e Invertir visibles, sin el menú ni Juegos', !e.menu && e.cabecera && e.titulo === 'Galería' && e.galeria && e.herramientas && e.enviar && e.invertir && !e.juegos, JSON.stringify(e));
  },
  async 'volver y tocar Más llevan al menú'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(200);
    const trasVolver = await estadoVistas(pagina);
    await abrirOpcion(pagina, 'galeria');
    await pagina.click('#grupoTipo button[data-valor="texto"]'); await pagina.waitForTimeout(200);
    const enTexto = await vis(pagina, '.barra-accion');
    await entrarMas(pagina);
    const trasNav = await estadoVistas(pagina);
    await navegador.close();
    return informe('"volver" vuelve al menú; salir a Texto y tocar Más otra vez abre el menú', trasVolver.menu && !trasVolver.juegos && enTexto && trasNav.menu && !trasNav.galeria, JSON.stringify({ trasVolver, enTexto, trasNav }));
  },
  async 'Atrás de Android dentro de una opción vuelve al menú'() {
    const { navegador, pagina } = await abrirApp({ app: true }); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const e = await estadoVistas(pagina);
    const salio = await pagina.evaluate(() => globalThis.__salio || 0);
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const salioMenu = await pagina.evaluate(() => globalThis.__salio || 0);
    await navegador.close();
    return informe('APK: Atrás en Juegos vuelve al menú (sin salir); en el menú sí sale', e.menu && !e.juegos && salio === 0 && salioMenu === 1, JSON.stringify({ e, salio, salioMenu }));
  },
  async 'Jugar manda la orden a la TV'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    const antes = await pantalla(pagina);
    await pagina.click('button[data-juego="snake"]'); await pagina.waitForTimeout(800);
    const d = await pantalla(pagina);
    const estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('Jugar Snake: pantalla.tipo "juego", juego.id "snake", versión nueva y "Enviado"',
      d.pantalla.tipo === 'juego' && d.pantalla.juego && d.pantalla.juego.id === 'snake' && d.version > antes.version && d.archivo == null && /Enviado/.test(estado), JSON.stringify({ tipo: d.pantalla.tipo, juego: d.pantalla.juego, v0: antes.version, v1: d.version, estado }));
  },
  async 'doble toque en Jugar manda una sola orden'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    const antes = (await pantalla(pagina)).version;
    await pagina.evaluate(() => { const b = document.querySelector('button[data-juego="flappy"]'); b.click(); b.click(); b.click(); });
    await pagina.waitForTimeout(900);
    const d = await pantalla(pagina);
    await navegador.close();
    return informe('tres toques seguidos en Jugar: una sola versión nueva', d.version === antes + 1 && d.pantalla.juego.id === 'flappy', JSON.stringify({ antes, ahora: d.version, id: d.pantalla.juego && d.pantalla.juego.id }));
  },
  async 'tras una orden de juego el panel abre normal (como Texto)'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    await pagina.click('button[data-juego="jump"]'); await pagina.waitForTimeout(800);
    const errores = []; pagina.on('pageerror', (e) => errores.push(e.message));
    await pagina.reload(); await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
    await pagina.waitForTimeout(500);
    const texto = await vis(pagina, '#seccionTexto'), activo = await pagina.evaluate(() => (document.querySelector('#grupoTipo button.activo') || {}).dataset?.valor);
    const estado = await txt(pagina, '#estadoTexto');
    await navegador.close();
    return informe('recargar tras Jugar: abre en Texto, sin errores', texto && activo === 'texto' && errores.length === 0 && !/error|No se pudo/i.test(estado), JSON.stringify({ texto, activo, errores, estado }));
  },
  async 'si el envío falla: Jugar avisa y no se queda colgado'() {
    const { navegador, pagina } = await abrirApp(); await entrarMas(pagina); await abrirOpcion(pagina, 'juegos');
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['dispositivos/tv1/oled_remota'] = true; });
    await pagina.click('button[data-juego="breakout"]'); await pagina.waitForTimeout(800);
    const estado = await txt(pagina, '#estadoTexto');
    const habilitado = await pagina.evaluate(() => !document.querySelector('button[data-juego="breakout"]').disabled);
    await navegador.close();
    return informe('si el envío falla: mensaje claro y el botón vuelve a servir', /No se pudo enviar|conexión/i.test(estado) && habilitado, JSON.stringify({ estado, habilitado }));
  },
  async 'el campo Nombre no se autocompleta'() {
    const { navegador, pagina } = await abrirApp();
    const r = await pagina.$$eval('#nombreGaleria, #nombreGaleriaDibujo, #nombreGaleriaNueva', (es) => es.map((e) => e.getAttribute('autocomplete')));
    await navegador.close();
    return informe('los tres campos "Nombre" llevan autocomplete="off"', r.length === 3 && r.every((x) => x === 'off'), JSON.stringify(r));
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.includes(n)) continue;
  total++;
  try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 240)); }
}
cerrarServidor();
console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
