// Tutorial guiado (js/tutorial.js; plan en docs/plan-tutorial.md). Cuentas con base falsa y Capacitor simulado.
// Uso: node tutorial.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';
import { PASOS } from '../js/tutorial.js';

const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const semilla = () => ({ dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } });

// A diferencia del resto del banco (banco.mjs lo da por visto), aquí el tutorial SÍ se abre: __conTutorial lo activa.
async function abrirApp({ ancho = 390, alto = 844, logueado = true } = {}) {
  const r = await abrir(semilla(), {
    ruta: '/index.html', esperar: false, ancho, alto,
    antes: async (p) => {
      await p.addInitScript((s) => {
        globalThis.__conTutorial = true; globalThis.__semillaAuth = s; globalThis.__persistirDb = true; globalThis.__salio = 0;
        globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: {
          addListener: (ev, cb) => { if (ev === 'backButton') globalThis.__atras = cb; return Promise.resolve({ remove() {} }); },
          exitApp: () => { globalThis.__salio++; }
        } } };
      }, { usuarios: USUARIOS, actual: logueado ? 'ana@correo.com' : null });
    }
  });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForTimeout(500);
  return r;
}

const abierto = (p) => p.evaluate(() => !document.getElementById('tutorial').hidden);
const esperarTutorial = (p) => p.waitForFunction(() => !document.getElementById('tutorial').hidden, null, { timeout: 8000 });
const esperarPanel = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
const textoPaso = (p) => p.evaluate(() => document.getElementById('tutorialTexto').textContent);
const esperar = (p, ms = 320) => p.waitForTimeout(ms); // más que la espera entre toques de tutorial.js
const siguiente = async (p) => { await p.click('#tutorialSiguiente'); await esperar(p); };
const guardado = (p) => p.evaluate(() => { try { return localStorage.getItem('tvretro.tutorial.uid-ana'); } catch (e) { return 'sin-almacenamiento'; } });
const rect = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);

const escenarios = {
  async 'sale la primera vez y no después de recargar'() {
    const { navegador, pagina, errores } = await abrirApp();
    await esperarTutorial(pagina);
    const primero = await textoPaso(pagina);
    const foco = await rect(pagina, '#tutorialFoco'); const objetivo = await rect(pagina, '.dispositivo');
    const encima = Math.abs(foco.x - (objetivo.x - 6)) <= 2 && Math.abs(foco.y - (objetivo.y - 6)) <= 2 && Math.abs(foco.w - (objetivo.w + 12)) <= 2;
    await pagina.click('#tutorialSaltar'); await esperar(pagina);
    await pagina.reload(); await esperarPanel(pagina); await esperar(pagina, 900);
    const trasRecargar = await abierto(pagina);
    await navegador.close();
    return informe('el tutorial sale la primera vez (resaltando el estado de la TV) y no vuelve tras recargar',
      primero === PASOS[0].texto && encima && !trasRecargar && errores.length === 0, JSON.stringify({ primero, encima, trasRecargar, errores }));
  },

  async 'recorre los 8 pasos con sus frases y termina'() {
    const { navegador, pagina, errores } = await abrirApp();
    await esperarTutorial(pagina);
    const vistos = []; const sinFoco = []; const saltarVisible = [];
    for (let i = 0; i < PASOS.length; i++) {
      vistos.push(await textoPaso(pagina));
      sinFoco.push(await pagina.evaluate(() => document.getElementById('tutorial').classList.contains('sin-foco')));
      saltarVisible.push(await pagina.evaluate(() => !document.getElementById('tutorialSaltar').hidden));
      if (i < PASOS.length - 1) await siguiente(pagina);
    }
    const botonFinal = await pagina.textContent('#tutorialSiguiente');
    await siguiente(pagina);
    const cerrado = !(await abierto(pagina)); const visto = await guardado(pagina);
    await navegador.close();
    const frasesOk = PASOS.every((p, i) => vistos[i] === p.texto);
    const sinFocoSoloAlFinal = sinFoco.every((v, i) => v === (i === PASOS.length - 1));
    const saltarOk = saltarVisible.every((v, i) => v === (i < PASOS.length - 1));
    return informe('los 8 pasos muestran su frase, el último no resalta nada ni ofrece Saltar, cierra y lo recuerda',
      frasesOk && sinFocoSoloAlFinal && saltarOk && botonFinal === 'Cerrar' && cerrado && visto === '1' && errores.length === 0,
      JSON.stringify({ frasesOk, sinFocoSoloAlFinal, saltarOk, botonFinal, cerrado, visto, errores }));
  },

  async 'Saltar cuenta como visto'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina);
    await pagina.click('#tutorialSaltar'); await esperar(pagina);
    const cerrado = !(await abierto(pagina)); const visto = await guardado(pagina);
    await navegador.close();
    return informe('Saltar cierra el tutorial y lo deja como visto', cerrado && visto === '1', JSON.stringify({ cerrado, visto }));
  },

  async 'Ver tutorial lo repite desde Config > Ayuda'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina); await pagina.click('#tutorialSaltar'); await esperar(pagina);
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await esperar(pagina, 200);
    await pagina.click('#grupoMas button[data-mas="config"]'); await esperar(pagina, 200);
    await pagina.click('#grupoConfig button[data-config="ayuda"]'); await esperar(pagina, 200);
    await pagina.click('#botonVerTutorial'); await esperar(pagina, 400);
    const sale = await abierto(pagina);
    const primero = await textoPaso(pagina);
    const enTexto = await pagina.evaluate(() => { const s = document.getElementById('seccionTexto'); return !!s && !s.hidden && getComputedStyle(s).display !== 'none'; });
    await navegador.close();
    return informe('"Ver tutorial" abre el tutorial desde el principio y pasa a Texto (donde se ve Enviar)', sale && primero === PASOS[0].texto && enTexto, JSON.stringify({ sale, primero, enTexto }));
  },

  async 'Atrás de Android lo cierra y la app sigue abierta'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina);
    await pagina.evaluate(() => globalThis.__atras()); await esperar(pagina, 200);
    const cerrado = !(await abierto(pagina)); const salio1 = await pagina.evaluate(() => globalThis.__salio); const visto = await guardado(pagina);
    await pagina.evaluate(() => globalThis.__atras()); await esperar(pagina, 200);
    const salio2 = await pagina.evaluate(() => globalThis.__salio);
    await navegador.close();
    return informe('Atrás cierra el tutorial (cuenta como visto) sin salir de la app; el siguiente Atrás sí sale',
      cerrado && salio1 === 0 && visto === '1' && salio2 === 1, JSON.stringify({ cerrado, salio1, visto, salio2 }));
  },

  async 'sin scroll, dentro de la pantalla y sin errores en los dos tamaños'() {
    const fallos = [];
    for (const [ancho, alto] of [[390, 844], [360, 740]]) {
      const { navegador, pagina, errores } = await abrirApp({ ancho, alto });
      await esperarTutorial(pagina);
      for (let i = 0; i < PASOS.length; i++) {
        const m = await pagina.evaluate(() => {
          const t = document.getElementById('tutorialTarjeta').getBoundingClientRect();
          const d = document.documentElement;
          return { sobraV: d.scrollHeight - innerHeight, sobraH: d.scrollWidth - innerWidth, dentro: t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= innerHeight, y: scrollY };
        });
        if (m.sobraV > 0 || m.sobraH > 0 || !m.dentro || m.y !== 0) fallos.push({ ancho, paso: i + 1, m });
        if (i < PASOS.length - 1) await siguiente(pagina);
      }
      if (errores.length) fallos.push({ ancho, errores });
      await navegador.close();
    }
    return informe('con el tutorial abierto no hay scroll, la tarjeta cabe en pantalla y no hay errores (390×844 y 360×740)', fallos.length === 0, JSON.stringify(fallos));
  },

  async 'toques repetidos en Siguiente no saltan pasos'() {
    const { navegador, pagina, errores } = await abrirApp();
    await esperarTutorial(pagina);
    await pagina.dblclick('#tutorialSiguiente'); await esperar(pagina);
    const tras = await textoPaso(pagina);
    // ráfaga de seis toques seguidos: como mucho avanza un paso más
    for (let i = 0; i < 6; i++) await pagina.click('#tutorialSiguiente', { delay: 0 });
    await esperar(pagina, 400);
    const trasRafaga = await textoPaso(pagina);
    const i2 = PASOS.findIndex((p) => p.texto === trasRafaga);
    await navegador.close();
    return informe('un doble toque cuenta como uno y una ráfaga no se come los pasos ni rompe nada',
      tras === PASOS[1].texto && i2 >= 2 && i2 <= 3 && errores.length === 0, JSON.stringify({ tras, trasRafaga, i2, errores }));
  },

  async 'un paso cuyo objetivo no se ve se salta'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina);
    await siguiente(pagina); // paso 2 (Texto)
    await pagina.evaluate(() => { document.querySelector('.barra-accion').hidden = true; });
    await siguiente(pagina);
    const texto = await textoPaso(pagina);
    await navegador.close();
    return informe('si Enviar no se ve, el paso 3 se salta y sigue con el de Imagen', texto === PASOS[3].texto, texto);
  },

  async 'Escape cierra y Tab no sale de la tarjeta'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina);
    const dentro = [];
    for (let i = 0; i < 5; i++) { await pagina.keyboard.press('Tab'); dentro.push(await pagina.evaluate(() => !!document.activeElement.closest('#tutorialTarjeta'))); }
    await pagina.keyboard.press('Escape'); await esperar(pagina, 200);
    const cerrado = !(await abierto(pagina)); const visto = await guardado(pagina);
    await navegador.close();
    return informe('con Tab el foco se queda dentro de la tarjeta y Escape equivale a Saltar',
      dentro.every(Boolean) && cerrado && visto === '1', JSON.stringify({ dentro, cerrado, visto }));
  },

  async 'la capa tapa la app: no se puede tocar Enviar'() {
    const { navegador, pagina } = await abrirApp();
    await esperarTutorial(pagina);
    await siguiente(pagina); await siguiente(pagina); // en el paso de Enviar
    const tapado = await pagina.evaluate(() => {
      const r = document.getElementById('enviar').getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!e && !!e.closest('#tutorial');
    });
    const escrituras = await pagina.evaluate(() => (globalThis.__fakeDb && globalThis.__fakeDb.escrituras ? globalThis.__fakeDb.escrituras.length : -1));
    await pagina.mouse.click(195, 790); await esperar(pagina, 400); // toque donde está Enviar
    const escriturasDespues = await pagina.evaluate(() => (globalThis.__fakeDb && globalThis.__fakeDb.escrituras ? globalThis.__fakeDb.escrituras.length : -1));
    const sigue = await abierto(pagina);
    await navegador.close();
    return informe('con el tutorial abierto un toque sobre Enviar no envía nada ni cierra el tutorial', tapado && escrituras === escriturasDespues && sigue, JSON.stringify({ tapado, escrituras, escriturasDespues, sigue }));
  },

  async 'no sale con el inicio de sesión a la vista'() {
    const { navegador, pagina } = await abrirApp({ logueado: false });
    await esperar(pagina, 1200);
    const login = await pagina.evaluate(() => !document.getElementById('pantallaLogin').hidden);
    const sale = await abierto(pagina);
    await navegador.close();
    return informe('con el login a la vista el tutorial no se abre', login && !sale, JSON.stringify({ login, sale }));
  }
};

const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) { if (pedidos.length && !pedidos.includes(n)) continue; total++; try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 200)); } }
cerrarServidor(); console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
