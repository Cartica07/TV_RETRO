/**compresion
 * Animaciones comprimidas (formato "z1") para enviar a la OLED.
 *
 * Cada cuadro (bitmap 1bpp de 128×64 = 1024 bytes) se comprime por
 * separado con deflate, SIN PÉRDIDA: al descomprimir sale el mismo
 * bitmap, bit por bit. Por separado para que el firmware pueda saltar a
 * cualquier cuadro sin descomprimir los anteriores.
 *
 * Datos binarios (todo little-endian), en Base64 dentro de
 * oled_remota/archivo/datos:
 *   por cada cuadro: [uint32 dur ms][uint16 bytes][deflate "raw" del bitmap]
 * Es el mismo registro que guarda el firmware (animacion.h), así que lo
 * escribe tal cual llega.
 *
 * Usa CompressionStream / DecompressionStream del navegador
 * ('deflate-raw'; Chrome/Edge 103+, Safari 16.4+, Firefox 113+, WebView
 * de Android actual).
 */

export const FORMATO_COMPRIMIDO = 'z1';

function base64ABytes(b64) {
  const s = atob(b64 || '');
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

function bytesABase64(bytes) {
  let s = '';
  const PASO = 0x8000; // de a pedazos: String.fromCharCode no acepta arreglos enormes
  for (let i = 0; i < bytes.length; i += PASO) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + PASO));
  }
  return btoa(s);
}

async function pasarPor(transformador, bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(transformador);
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** true si el navegador puede comprimir (si no, se envía sin comprimir). */
export function puedeComprimir() {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

/**
 * Comprime los cuadros [{datos: base64, dur: ms}, ...].
 * @returns {Promise<{datos: string, bytes: number, cantidad: number}>}
 *   datos = Base64 del binario; bytes = tamaño del binario.
 */
export async function comprimirCuadros(cuadros) {
  const partes = [];
  let total = 0;

  for (const cuadro of cuadros || []) {
    const z = await pasarPor(new CompressionStream('deflate-raw'), base64ABytes(cuadro.datos));
    if (z.length > 0xFFFF) throw new Error('Cuadro demasiado grande para comprimir');

    const registro = new Uint8Array(6 + z.length);
    const vista = new DataView(registro.buffer);
    vista.setUint32(0, Math.max(0, Math.round(Number(cuadro.dur) || 0)), true);
    vista.setUint16(4, z.length, true);
    registro.set(z, 6);

    partes.push(registro);
    total += registro.length;
  }

  const todo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { todo.set(p, pos); pos += p.length; }

  return { datos: bytesABase64(todo), bytes: total, cantidad: partes.length };
}

/**
 * Lo inverso: del Base64 de oled_remota/archivo/datos a
 * [{datos: base64, dur: ms}, ...]. Si los datos están cortados, devuelve
 * los cuadros completos.
 */
export async function descomprimirCuadros(datosBase64) {
  const todo = base64ABytes(datosBase64);
  const vista = new DataView(todo.buffer);
  const cuadros = [];
  let pos = 0;

  while (pos + 6 <= todo.length) {
    const dur = vista.getUint32(pos, true);
    const largo = vista.getUint16(pos + 4, true);
    if (pos + 6 + largo > todo.length) break;

    const bitmap = await pasarPor(new DecompressionStream('deflate-raw'), todo.subarray(pos + 6, pos + 6 + largo));
    cuadros.push({ datos: bytesABase64(bitmap), dur });
    pos += 6 + largo;
  }

  return cuadros;
}

// ===================================================================
// Musicales (formato "m1"): canción + pantalla grabadas de un .ino
// (ver js/inoMusical.js). Binario little-endian, en Base64 dentro de
// oled_remota/archivo/datos y del catálogo musicales/:
//   "M1" [uint8 versión=1] [uint8 banderas: bit0 = repetir]
//   [uint32 duración ms]
//   [uint32 cantidad de notas]    por nota:   [uint32 t ms][uint16 Hz] (0 = silencio)
//   [uint32 cantidad de imágenes] por imagen: [uint16 bytes][deflate-raw del bitmap 1bpp 128×64]
//   [uint32 cantidad de cuadros]  por cuadro: [uint32 t ms][uint16 número de imagen]
// Cada imagen distinta se guarda una sola vez (un GIF que se repite toda la
// canción no ocupa más). t se cuenta desde el inicio de la grabación.
// Lo lee el firmware (musical.cpp).
// ===================================================================

export const FORMATO_MUSICAL = 'm1';

function unir(partes) {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const todo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { todo.set(p, pos); pos += p.length; }
  return todo;
}

/**
 * Codifica una grabación {notas, cuadros, duracion, repetir}.
 * @returns {Promise<{datos: string, bytes: number, imagenes: number}>}
 */
export async function codificarMusical(grabacion) {
  const partes = [];
  const cab = new Uint8Array(12);
  const vc = new DataView(cab.buffer);
  cab[0] = 0x4D; cab[1] = 0x31; cab[2] = 1; cab[3] = grabacion.repetir ? 1 : 0;
  vc.setUint32(4, Math.max(0, Math.round(grabacion.duracion)), true);
  vc.setUint32(8, grabacion.notas.length, true);
  partes.push(cab);

  const notas = new Uint8Array(grabacion.notas.length * 6);
  const vn = new DataView(notas.buffer);
  grabacion.notas.forEach((n, i) => {
    vn.setUint32(i * 6, Math.max(0, Math.round(n.t)), true);
    vn.setUint16(i * 6 + 4, Math.max(0, Math.min(0xFFFF, Math.round(n.f))), true);
  });
  partes.push(notas);

  // Imágenes distintas (la clave es el bitmap en Base64).
  const indice = new Map();
  const imagenes = [];
  const linea = [];
  for (const c of grabacion.cuadros) {
    const clave = bytesABase64(c.bitmap);
    let k = indice.get(clave);
    if (k === undefined) { k = imagenes.length; indice.set(clave, k); imagenes.push(c.bitmap); }
    linea.push({ t: c.t, k });
  }
  if (imagenes.length > 0xFFFF) throw new Error('Demasiadas imágenes distintas');

  const cantImg = new Uint8Array(4);
  new DataView(cantImg.buffer).setUint32(0, imagenes.length, true);
  partes.push(cantImg);
  for (const bmp of imagenes) {
    const z = await pasarPor(new CompressionStream('deflate-raw'), bmp);
    const reg = new Uint8Array(2 + z.length);
    new DataView(reg.buffer).setUint16(0, z.length, true);
    reg.set(z, 2);
    partes.push(reg);
  }

  const tl = new Uint8Array(4 + linea.length * 6);
  const vt = new DataView(tl.buffer);
  vt.setUint32(0, linea.length, true);
  linea.forEach((c, i) => {
    vt.setUint32(4 + i * 6, Math.max(0, Math.round(c.t)), true);
    vt.setUint16(4 + i * 6 + 4, c.k, true);
  });
  partes.push(tl);

  const todo = unir(partes);
  return { datos: bytesABase64(todo), bytes: todo.length, imagenes: imagenes.length };
}

/**
 * Lo inverso de codificarMusical (para la vista previa y para enviar
 * "sin letra").
 * @returns {Promise<{notas, cuadros, duracion, repetir}>}
 */
export async function decodificarMusical(datosBase64) {
  const b = base64ABytes(datosBase64);
  const v = new DataView(b.buffer);
  if (b[0] !== 0x4D || b[1] !== 0x31) throw new Error('No es un musical (formato m1)');
  const repetir = !!(b[3] & 1);
  const duracion = v.getUint32(4, true);
  const nNotas = v.getUint32(8, true);
  let pos = 12;
  const notas = [];
  for (let i = 0; i < nNotas; i++, pos += 6) notas.push({ t: v.getUint32(pos, true), f: v.getUint16(pos + 4, true) });

  const nImg = v.getUint32(pos, true);
  pos += 4;
  const imagenes = [];
  for (let i = 0; i < nImg; i++) {
    const largo = v.getUint16(pos, true);
    imagenes.push(await pasarPor(new DecompressionStream('deflate-raw'), b.subarray(pos + 2, pos + 2 + largo)));
    pos += 2 + largo;
  }

  const nCuadros = v.getUint32(pos, true);
  pos += 4;
  const cuadros = [];
  for (let i = 0; i < nCuadros; i++, pos += 6) {
    cuadros.push({ t: v.getUint32(pos, true), bitmap: imagenes[v.getUint16(pos + 4, true)] });
  }
  return { notas, cuadros, duracion, repetir };
}
