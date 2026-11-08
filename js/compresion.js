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
