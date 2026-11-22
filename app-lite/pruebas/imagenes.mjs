// Dibujo, Imagen (subir un archivo) y GIF: se envían por Bluetooth con el formato de la Pro (imagen 1bpp en base64,
// GIF comprimido "z1" como archivo aparte) y la TV (simulada) los recibe completos y verificados.
import zlib from 'node:zlib';
import { abrir, cerrar, informe } from './banco-lite.mjs';
import { crearGif, cuadroDePrueba } from './gif-minimo.mjs';

const { pagina, errores, tv } = await abrir();
const esperarEnvio = () => pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });

// ---- Dibujo ----
await pagina.click('#grupoTipo button[data-valor="dibujo"]');
const lienzo = await pagina.locator('#lienzoDibujo').boundingBox();
await pagina.mouse.move(lienzo.x + 20, lienzo.y + 20);
await pagina.mouse.down();
await pagina.mouse.move(lienzo.x + lienzo.width - 20, lienzo.y + lienzo.height - 20, { steps: 8 });
await pagina.mouse.up();
await pagina.click('#enviar');
await esperarEnvio();
let c = await pagina.evaluate(() => { const x = window.__tv.contenido; return x ? { tipo: x.pantalla.tipo, ancho: x.pantalla.imagen && x.pantalla.imagen.ancho, alto: x.pantalla.imagen && x.pantalla.imagen.alto, datos: x.pantalla.imagen && x.pantalla.imagen.datos } : null; });
const bitsDibujo = c && c.datos ? [...Buffer.from(c.datos, 'base64')].reduce((s, b) => s + b.toString(2).split('1').length - 1, 0) : 0;
informe('el dibujo llega como imagen de 128x64', c && c.tipo === 'imagen' && c.ancho === 128 && c.alto === 64, JSON.stringify({ ...c, datos: c && c.datos ? c.datos.length : 0 }));
informe('el dibujo trae píxeles encendidos (el trazo)', bitsDibujo > 20, String(bitsDibujo));

// ---- Imagen: se sube un archivo PNG ----
await pagina.click('#grupoTipo button[data-valor="imagen"]');
const png = await pagina.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.fillRect(30, 10, 60, 40);
  return cv.toDataURL('image/png').split(',')[1];
});
await pagina.setInputFiles('#cargadorImagen', { name: 'prueba.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await pagina.waitForTimeout(800);
await pagina.click('#enviar');
await esperarEnvio();
c = await pagina.evaluate(() => { const x = window.__tv.contenido; return { tipo: x.pantalla.tipo, n: x.pantalla.imagen && x.pantalla.imagen.datos ? x.pantalla.imagen.datos.length : 0 }; });
informe('una imagen subida llega como imagen (1024 bytes en base64)', c.tipo === 'imagen' && c.n === 1368, JSON.stringify(c));

// ---- GIF: 5 cuadros distintos ----
const cuadros = [0, 1, 2, 3, 4].map((k) => cuadroDePrueba(k));
const gif = crearGif(cuadros, { retardoCs: 12 });
await pagina.setInputFiles('#cargadorImagen', { name: 'animado.gif', mimeType: 'image/gif', buffer: gif });
await pagina.waitForTimeout(1500);
await pagina.click('#enviar');
await esperarEnvio();
const recibido = await pagina.evaluate(() => {
  const x = window.__tv.contenido;
  return { tipo: x.pantalla.tipo, anim: x.pantalla.animacion, archivo: x.archivo ? Array.from(x.archivo) : null };
});
informe('el GIF llega como animación z1 con 5 cuadros', recibido.tipo === 'animacion' && recibido.anim && recibido.anim.formato === 'z1' && recibido.anim.cantidad === 5, JSON.stringify(recibido.anim));
// Se descomprime el archivo como lo haría el firmware: [dur u32][bytes u16][deflate-raw del bitmap 1bpp] por cuadro.
let ok = !!recibido.archivo;
let pos = 0, n = 0;
const huellas = [];
if (ok) {
  const b = Buffer.from(recibido.archivo);
  while (pos < b.length) {
    const dur = b.readUInt32LE(pos); const largo = b.readUInt16LE(pos + 4);
    const bitmap = zlib.inflateRawSync(b.subarray(pos + 6, pos + 6 + largo));
    if (bitmap.length !== 1024 || dur !== 120) ok = false;
    huellas.push(bitmap.toString('hex'));
    pos += 6 + largo; n++;
  }
}
informe('el archivo z1 se descomprime: 5 cuadros de 1024 bytes y 120 ms', ok && n === 5, `n=${n}`);
informe('los 5 cuadros son distintos entre sí', new Set(huellas).size === 5);

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
