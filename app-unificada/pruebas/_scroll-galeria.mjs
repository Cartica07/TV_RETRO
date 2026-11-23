// Diagnóstico (no es una prueba del banco): ¿se puede bajar en la Galería? Compara la app unificada (con TV Pro y con TV Lite sin
// cuenta). Uso: node pruebas/_scroll-galeria.mjs
import { abrir, cerrar, pant, esperarPanel } from './banco-unificado.mjs';

const muchas = {};
const indice = {};
for (let i = 0; i < 30; i++) { muchas['img' + i] = { datos: '00', ancho: 128, alto: 64, meta: {} }; indice['img' + i] = { datos: '00', ancho: 128, alto: 64 }; }
const semilla = {
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  biblioteca: { imagenes: muchas, imagenes_indice: indice },
};

async function medir(nombre, opciones) {
  const { navegador, pagina } = await abrir(semilla, opciones);
  if (opciones.esperarPanel !== false) await esperarPanel(pagina);
  if (opciones.preparar) await opciones.preparar(pagina);
  await pagina.click('#grupoTipo button[data-valor="galeria"]');
  await pagina.waitForTimeout(400);
  await pagina.click('[data-mas="galeria"]');
  await pagina.waitForTimeout(1500);
  const r = await pagina.evaluate(() => {
    const doc = document.scrollingElement;
    const antes = doc.scrollTop;
    window.scrollTo(0, 99999);
    const despues = doc.scrollTop;
    const main = document.querySelector('main.controles');
    const cs = getComputedStyle(main);
    const cuerpo = getComputedStyle(document.body);
    return {
      alto: doc.scrollHeight, ventana: innerHeight, bajo: despues - antes,
      main: { overflowY: cs.overflowY, alto: main.scrollHeight, visible: main.clientHeight, inert: main.inert },
      body: { overflowY: cuerpo.overflowY, clases: document.body.className },
      fijos: [...document.querySelectorAll('.pantalla-login')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id),
    };
  });
  console.log(nombre, JSON.stringify(r));
  await navegador.close();
}

await medir('UNIFICADA con TV Pro:', {});
await medir('UNIFICADA con TV Lite sin cuenta:', {
  logueado: false, esperar: false, esperarPanel: false,
  antes: (p) => p.addInitScript(() => {
    if (!localStorage.getItem('tvretro.tipoApp')) {
      localStorage.setItem('tvretro.tipoApp', 'lite');
      localStorage.setItem('tvretro.tvlite.local', JSON.stringify(['tv-simulada']));
    }
  }),
  preparar: async (p) => { await esperarPanel(p); await p.waitForTimeout(800); },
});
cerrar();
