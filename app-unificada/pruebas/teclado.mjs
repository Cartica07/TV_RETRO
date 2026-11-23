// Con el teclado abierto (la pantalla se encoge) el campo en el que se escribe no puede quedar detrás de la barra fija de "Enviar a
// la TV" ni de la navegación. Prueba real del 2026-11-23: "Nombre" en la pestaña Imagen quedaba tapado.
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const semilla = { dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } };
const { navegador, pagina, errores } = await abrir(semilla);
await esperarPanel(pagina);
await pagina.click('#grupoTipo button[data-valor="imagen"]');
await pagina.waitForTimeout(400);

const medir = () => pagina.evaluate(() => {
  const campo = document.getElementById('nombreGaleria').getBoundingClientRect();
  const barra = document.querySelector('.barra-accion').getBoundingClientRect();
  return { abajoCampo: Math.round(campo.bottom), arribaBarra: Math.round(barra.top), alto: innerHeight };
});

await pagina.focus('#nombreGaleria');
// Se abre el teclado: la pantalla queda de 390×420 (como en el celular con el teclado encima).
await pagina.setViewportSize({ width: 390, height: 420 });
await pagina.waitForTimeout(1200);
const m = await medir();
informe('con el teclado abierto, "Nombre" (Imagen) queda a la vista, encima de la barra de Enviar', m.abajoCampo <= m.arribaBarra && m.abajoCampo > 0, JSON.stringify(m));
informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
await navegador.close();
cerrar();
