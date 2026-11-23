// Botón Atrás de Android (js/atras.js): con la búsqueda de canciones abierta, Atrás la cierra; sin nada de la unificada abierto,
// hace lo de la Pro (en Canciones, salir de la app). Se simula el plugin App de Capacitor en el navegador.
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina, visible } from './banco-unificado.mjs';

const semilla = {
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  musicales: { indice: { a: { nombre: 'Un mundo ideal' }, b: { nombre: 'La cucaracha' } }, datos: {} },
};

// Capacitor simulado: solo el plugin App (lo que usa el botón Atrás de la Pro).
const capacitorFalso = (p) => p.addInitScript(() => {
  const oyentes = [];
  window.__salidas = 0;
  window.__atras = () => oyentes.filter((o) => o.nombre === 'backButton').forEach((o) => o.f({ canGoBack: false }));
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      App: {
        addListener: (nombre, f) => { oyentes.push({ nombre, f }); return Promise.resolve({ remove() {} }); },
        exitApp: () => { window.__salidas++; },
      },
    },
  };
});

const { navegador, pagina, errores } = await abrir(semilla, { antes: capacitorFalso });
await esperarPanel(pagina);
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForTimeout(500);
await pagina.click('#botonBuscarCancion');
informe('preparación: la búsqueda está abierta', await visible(pagina, '#buscadorCanciones'));
await pagina.evaluate(() => window.__atras());
await pagina.waitForTimeout(200);
informe('Atrás con la búsqueda abierta: la cierra y NO sale de la app',
  !(await visible(pagina, '#buscadorCanciones')) && (await pagina.evaluate(() => window.__salidas)) === 0);
await pagina.evaluate(() => window.__atras());
informe('Atrás otra vez (sin nada abierto): lo de la Pro, salir de la app', (await pagina.evaluate(() => window.__salidas)) === 1);
informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
await navegador.close();
cerrar();
