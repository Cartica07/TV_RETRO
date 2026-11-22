// Avisos de peso del GIF con los números de la Lite (Bluetooth, ~22 KB/s) y rechazo de un GIF que no cabe en la TV.
import { abrir, cerrar, informe } from './banco-lite.mjs';
import { crearGif } from './gif-minimo.mjs';

const { pagina, errores, tv } = await abrir();

// Cuadros de ruido: no se comprimen, así cada cuadro pesa ~1 KB comprimido y el peso del GIF = su cantidad de cuadros.
function ruido(cuadros) {
  let x = 123456789;
  const lista = [];
  for (let k = 0; k < cuadros; k++) {
    const px = new Uint8Array(128 * 64);
    for (let i = 0; i < px.length; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; px[i] = x & 1; }
    lista.push(px);
  }
  return lista;
}

const aviso = () => pagina.evaluate(() => { const e = document.getElementById('avisoGaleria'); return { texto: (e.textContent || '').trim(), visible: getComputedStyle(e).display !== 'none', error: e.classList.contains('error'), adv: e.classList.contains('advertencia') }; });
const subir = async (cuadros) => {
  await pagina.click('#grupoTipo button[data-valor="imagen"]');
  await pagina.setInputFiles('#cargadorImagen', { name: 'g.gif', mimeType: 'image/gif', buffer: crearGif(ruido(cuadros), { retardoCs: 5 }) });
  await pagina.waitForTimeout(2500 + cuadros * 6);
};

await subir(40);
let a = await aviso();
informe('un GIF de ~40 KB no lleva aviso de peso', !a.visible || !/pesado/i.test(a.texto), JSON.stringify(a));

await subir(150);
a = await aviso();
informe('un GIF de ~150 KB avisa "pesado" (amarillo)', a.visible && /GIF pesado/.test(a.texto) && !/muy pesado/.test(a.texto), JSON.stringify(a));

await subir(320);
a = await aviso();
informe('un GIF de ~320 KB avisa "muy pesado" (rojo)', a.visible && /muy pesado/.test(a.texto), JSON.stringify(a));

// Un GIF que no cabe en la TV no se envía, y se explica con palabras simples.
await subir(700);
await pagina.click('#enviar');
await pagina.waitForFunction(() => /demasiado pesado|camino|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 30000 });
const estado = await pagina.textContent('#estadoTexto');
const e = await tv();
informe('un GIF de más de 600 KB se rechaza antes de enviarlo', /demasiado pesado para la TV/.test(estado) && e.contenidos === 0, estado);

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
