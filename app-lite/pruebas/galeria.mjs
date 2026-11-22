// Galería EN EL CELULAR: se guardan imágenes y GIF, siguen ahí al reabrir la app, se envían a la TV y se borran.
// (No hay nube: todo vive en IndexedDB del celular.)
import { abrir, cerrar, informe } from './banco-lite.mjs';
import { crearGif, cuadroDePrueba } from './gif-minimo.mjs';

const { pagina, errores, tv } = await abrir();
const esperarEnvio = () => pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
const png = await pagina.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.fillRect(10, 10, 100, 20);
  return cv.toDataURL('image/png').split(',')[1];
});

// ---- Guardar una imagen (pestaña Imagen > Guardar en la galería) ----
await pagina.click('#grupoTipo button[data-valor="imagen"]');
await pagina.setInputFiles('#cargadorImagen', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await pagina.waitForTimeout(800);
await pagina.fill('#nombreGaleria', 'Mi foto');
await pagina.click('#botonGuardarGaleria');
await pagina.waitForTimeout(800);
const aviso = await pagina.textContent('#avisoGaleria');
informe('guardar una imagen avisa que quedó guardada', /guard/i.test(aviso || ''), aviso);

// ---- Galería: la imagen está ----
const irAGaleria = async () => {
  await pagina.click('#grupoTipo button[data-valor="galeria"]');
  await pagina.click('[data-mas="galeria"]');
  await pagina.waitForTimeout(500);
};
await irAGaleria();
let items = await pagina.$$eval('#gridGaleria .item-galeria', (x) => x.map((i) => i.dataset.clave));
informe('la Galería muestra "Mi foto"', items.includes('Mi foto'), items.join(','));

// ---- Reabrir la app: sigue ahí ----
await pagina.reload();
await pagina.waitForFunction(() => document.getElementById('estadoTexto') && !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
await irAGaleria();
items = await pagina.$$eval('#gridGaleria .item-galeria', (x) => x.map((i) => i.dataset.clave));
informe('al reabrir la app la imagen sigue guardada en el celular', items.includes('Mi foto'), items.join(','));

// ---- Enviarla a la TV desde la Galería ----
await pagina.click('#gridGaleria .item-galeria[data-clave="Mi foto"]');
await pagina.click('#enviar');
await esperarEnvio();
let c = await pagina.evaluate(() => { const x = window.__tv.contenido; return x ? { tipo: x.pantalla.tipo, n: x.pantalla.imagen.datos.length } : null; });
informe('la imagen de la Galería llega a la TV', c && c.tipo === 'imagen' && c.n === 1368, JSON.stringify(c));

// ---- Un GIF en la galería ----
await pagina.click('#grupoTipo button[data-valor="imagen"]');
await pagina.setInputFiles('#cargadorImagen', { name: 'mov.gif', mimeType: 'image/gif', buffer: crearGif([0, 1, 2].map((k) => cuadroDePrueba(k))) });
await pagina.waitForTimeout(1500);
await pagina.fill('#nombreGaleria', 'Mi GIF');
await pagina.click('#botonGuardarGaleria');
await pagina.waitForTimeout(1200);
await irAGaleria();
await pagina.click('#grupoSubvistaGaleria button[data-subvista="gif"]');
await pagina.waitForTimeout(500);
const gifs = await pagina.$$eval('#gridGifs [data-clave]', (x) => x.map((i) => i.dataset.clave));
informe('el GIF guardado aparece en la lista GIF', gifs.includes('Mi GIF'), gifs.join(','));

await pagina.click('#gridGifs [data-clave="Mi GIF"]');
await pagina.waitForTimeout(800);
await pagina.click('#enviar');
await esperarEnvio();
c = await pagina.evaluate(() => { const x = window.__tv.contenido; return { tipo: x.pantalla.tipo, cantidad: x.pantalla.animacion && x.pantalla.animacion.cantidad, archivo: x.archivo ? x.archivo.length : 0 }; });
informe('el GIF de la Galería llega a la TV como animación de 3 cuadros', c.tipo === 'animacion' && c.cantidad === 3 && c.archivo > 0, JSON.stringify(c));

// ---- Borrar ----
pagina.on('dialog', (d) => d.accept());
await pagina.click('#grupoSubvistaGaleria button[data-subvista="imagenes"]');
await pagina.waitForTimeout(300);
await pagina.click('#gridGaleria .item-galeria[data-clave="Mi foto"]');
await pagina.click('#botonBorrarGaleria');
await pagina.waitForTimeout(1200);
items = await pagina.$$eval('#gridGaleria .item-galeria', (x) => x.map((i) => i.dataset.clave));
informe('borrar la imagen la quita de la Galería', !items.includes('Mi foto'), items.join(','));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
