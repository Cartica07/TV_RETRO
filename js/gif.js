/**gif
 * GIF animado -> animación de TV RETRO.
 *
 * Decodificador portado de CancionesMiniTV (simulador.html:
 * decodificarGif / lzwDescomprimir / leerGifBuffer / construirGif). Cada
 * cuadro se acomoda a 128×64 con las mismas opciones de geometría que las
 * imágenes (escala, fondo, giro, volteo) y se binariza con el mismo
 * umbral/difuminado. El resultado tiene el formato que ya usan el
 * catálogo /animaciones y oled_remota/pantalla/animacion:
 *   { ancho: 128, alto: 64, cuadros: [{ datos: Base64 1bpp, dur: ms }, ...] }
 */

import {
  acomodarEnDestino,
  grisesDeCanvas,
  grisABitmapAtkinson,
  grisABitmapUmbral,
  codificarBase64
} from './imageProcessor.js';

const ANCHO = 128;
const ALTO = 64;

/*
 * Límites de peso para que la animación entre en la memoria de un ESP32
 * común (ESP32-WROOM-32, sin PSRAM):
 *  - De ~520 KB de SRAM, con WiFi + HTTPS (TLS) quedan del orden de
 *    100-250 KB libres, pero el bloque CONTIGUO más grande suele ser
 *    bastante menor (la memoria está repartida en regiones y se fragmenta).
 *  - El ESP descarga oled_remota.json completo en cada chequeo. Si el
 *    firmware lo lee entero (getString) y después lo interpreta con
 *    ArduinoJson, necesita aprox. el doble del tamaño del JSON, y la
 *    primera copia en un solo bloque contiguo. Hay reportes de fallas con
 *    buffers de más de ~64 KB en ESP32.
 *  - Cada cuadro de 128×64 ocupa ~1,4 KB en el JSON (1024 bytes en Base64
 *    + nombres de campos).
 * Por eso: hasta ~28 KB (unos 20 cuadros) es seguro; hasta ~56 KB (unos
 * 40 cuadros) puede andar según cuánta memoria libre tenga el firmware;
 * más de eso es muy probable que no entre.
 */
export const PESO_RECOMENDADO_BYTES = 28 * 1024;
export const PESO_MAXIMO_BYTES = 56 * 1024;

/**
 * Estima cuánto pesa una animación dentro de oled_remota.json y la
 * clasifica: 'ok' | 'pesado' | 'muy-pesado'.
 * @returns {{bytes: number, kb: number, cuadros: number, nivel: string, mensaje: string}}
 */
export function evaluarPesoAnimacion(cuadros) {
  const lista = cuadros || [];
  // {"datos":"…","dur":123}, + coma: ~22 bytes de estructura por cuadro
  const bytes = lista.reduce((s, c) => s + (c.datos ? c.datos.length : 0) + 22, 0);
  const kb = Math.round(bytes / 1024);
  const n = lista.length;
  if (bytes > PESO_MAXIMO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'muy-pesado',
      mensaje: `GIF muy pesado/largo: ${n} cuadros · ${kb} KB. Es muy probable que no entre en la memoria del ESP32 (máximo recomendado ~${Math.round(PESO_MAXIMO_BYTES / 1024)} KB). Usá un GIF más corto.` };
  }
  if (bytes > PESO_RECOMENDADO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'pesado',
      mensaje: `GIF pesado: ${n} cuadros · ${kb} KB. Puede fallar si el ESP32 tiene poca memoria libre (seguro hasta ~${Math.round(PESO_RECOMENDADO_BYTES / 1024)} KB).` };
  }
  return { bytes, kb, cuadros: n, nivel: 'ok', mensaje: '' };
}

/**
 * Límites para animaciones COMPRIMIDAS (formato "z1", js/compresion.js).
 * El firmware ya no la baja entera a la RAM: la escribe en su memoria
 * flash a medida que llega (LittleFS, 256 KB). Ahí conviven por un
 * momento la animación anterior y la nueva, más la canción, así que:
 * hasta ~64 KB comprimidos es seguro; hasta ~110 KB entra justo; más,
 * probablemente no entra.
 */
export const PESO_COMPRIMIDO_RECOMENDADO_BYTES = 64 * 1024;
export const PESO_COMPRIMIDO_MAXIMO_BYTES = 110 * 1024;

/**
 * Clasifica una animación según su tamaño comprimido:
 * 'ok' | 'pesado' | 'muy-pesado' (mismo formato que evaluarPesoAnimacion).
 */
export function evaluarPesoComprimido(bytesComprimidos, cantidadCuadros) {
  const bytes = Number(bytesComprimidos) || 0;
  const kb = Math.round(bytes / 1024);
  const n = cantidadCuadros || 0;
  if (bytes > PESO_COMPRIMIDO_MAXIMO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'muy-pesado',
      mensaje: `GIF muy pesado: ${n} cuadros · ${kb} KB comprimido. Es muy probable que no entre en la memoria de la TV (máximo ~${Math.round(PESO_COMPRIMIDO_MAXIMO_BYTES / 1024)} KB). Usá un GIF más corto.` };
  }
  if (bytes > PESO_COMPRIMIDO_RECOMENDADO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'pesado',
      mensaje: `GIF pesado: ${n} cuadros · ${kb} KB comprimido. Puede no entrar si la TV tiene además una canción guardada (seguro hasta ~${Math.round(PESO_COMPRIMIDO_RECOMENDADO_BYTES / 1024)} KB).` };
  }
  return { bytes, kb, cuadros: n, nivel: 'ok', mensaje: '' };
}

/** true si los primeros bytes son la firma de un GIF. */
export function esGif(buffer) {
  const d = new Uint8Array(buffer, 0, Math.min(6, buffer.byteLength));
  const cab = String.fromCharCode(...d);
  return cab === 'GIF87a' || cab === 'GIF89a';
}

/**
 * Recorre los cuadros del GIF ya compuestos (respeta transparencia,
 * entrelazado y "disposal"), llamando porCuadro(rgba, delayMs, i, W, H).
 */
export function decodificarGif(buffer, porCuadro) {
  const d = new Uint8Array(buffer); let p = 0;
  const leer16 = () => { const v = d[p] | (d[p + 1] << 8); p += 2; return v; };
  const cab = String.fromCharCode(d[0], d[1], d[2], d[3], d[4], d[5]);
  if (cab !== 'GIF87a' && cab !== 'GIF89a') throw new Error('el archivo no es un GIF');
  p = 6;
  const W = leer16(), H = leer16(), banderas = d[p++]; p += 2; // color de fondo + relación de aspecto: no se usan
  if (!W || !H) throw new Error('GIF con tamaño 0');
  let paletaGlobal = null;
  if (banderas & 0x80) { const n = 2 << (banderas & 7); paletaGlobal = d.subarray(p, p + n * 3); p += n * 3; }
  const lienzo = new Uint8ClampedArray(W * H * 4);   // transparente al inicio
  let guardado = null, anterior = null, gce = null, n = 0;
  const saltarSub = () => { while (p < d.length) { const t = d[p++]; if (t === 0) break; p += t; } };

  while (p < d.length) {
    const b = d[p++];
    if (b === 0x3B) break;                              // fin del archivo
    if (b === 0x21) {                                   // extensión
      const etiqueta = d[p++];
      if (etiqueta === 0xF9) {                          // control gráfico: duración, transparencia, disposal
        const tam = d[p++], pf = d[p];
        gce = { disposal: (pf >> 2) & 7, transp: (pf & 1) ? d[p + 3] : -1, delay: (d[p + 1] | (d[p + 2] << 8)) * 10 };
        p += tam; p++;                                  // + terminador
      } else saltarSub();
      continue;
    }
    if (b !== 0x2C) continue;                           // byte raro: se ignora
    const fx = leer16(), fy = leer16(), fw = leer16(), fh = leer16(), fl = d[p++];
    let paleta = paletaGlobal;
    if (fl & 0x80) { const nn = 2 << (fl & 7); paleta = d.subarray(p, p + nn * 3); p += nn * 3; }
    if (!paleta) throw new Error('GIF sin paleta de colores');
    const entrelazado = !!(fl & 0x40), minCod = d[p++];
    const trozos = []; let total = 0;
    while (p < d.length) { const t = d[p++]; if (t === 0) break; trozos.push(d.subarray(p, p + t)); total += t; p += t; }
    const datos = new Uint8Array(total); let o = 0; trozos.forEach(t => { datos.set(t, o); o += t.length; });
    const indices = lzwDescomprimir(minCod, datos, fw * fh);

    // disposal del cuadro anterior
    if (anterior) {
      if (anterior.disposal === 2) {
        for (let y = 0; y < anterior.h; y++) for (let x = 0; x < anterior.w; x++) {
          const X = anterior.x + x, Y = anterior.y + y;
          if (X < W && Y < H) lienzo.fill(0, (Y * W + X) * 4, (Y * W + X) * 4 + 4);
        }
      } else if (anterior.disposal === 3 && guardado) lienzo.set(guardado);
    }
    const disposal = gce ? gce.disposal : 0;
    guardado = disposal === 3 ? lienzo.slice() : null;

    let filas = null;
    if (entrelazado) {
      filas = new Int32Array(fh); let i = 0;
      [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([ini, paso]) => { for (let y = ini; y < fh; y += paso) filas[i++] = y; });
    }
    const transp = gce ? gce.transp : -1;
    for (let i = 0; i < fh; i++) {
      const y = fy + (filas ? filas[i] : i); if (y >= H) continue;
      for (let x = 0; x < fw; x++) {
        const X = fx + x; if (X >= W) continue;
        const idx = indices[i * fw + x];
        if (idx === transp) continue;
        const dst = (y * W + X) * 4, src = idx * 3;
        lienzo[dst] = paleta[src]; lienzo[dst + 1] = paleta[src + 1]; lienzo[dst + 2] = paleta[src + 2]; lienzo[dst + 3] = 255;
      }
    }
    let delay = gce ? gce.delay : 100;
    if (delay <= 10) delay = 100;                       // igual que los navegadores: 0 o 1 centésima = 100 ms
    porCuadro(lienzo, delay, n++, W, H);
    anterior = { disposal, x: fx, y: fy, w: fw, h: fh };
    gce = null;
  }
  if (n === 0) throw new Error('el GIF no tiene cuadros');
  return { ancho: W, alto: H, cuadros: n };
}

/** Descompresor LZW de GIF (devuelve índices de paleta). */
export function lzwDescomprimir(minCod, datos, npix) {
  const clear = 1 << minCod, eoi = clear + 1;
  let tam = minCod + 1, mask = (1 << tam) - 1, sig = eoi + 1;
  const prefijo = new Uint16Array(4096), sufijo = new Uint8Array(4096), pila = new Uint8Array(4097);
  const out = new Uint8Array(npix);
  let op = 0, bits = 0, nbits = 0, ip = 0, viejo = -1, primero = 0;
  while (op < npix) {
    while (nbits < tam) { if (ip >= datos.length) return out; bits |= datos[ip++] << nbits; nbits += 8; }
    let codigo = bits & mask; bits >>= tam; nbits -= tam;
    if (codigo === clear) { tam = minCod + 1; mask = (1 << tam) - 1; sig = eoi + 1; viejo = -1; continue; }
    if (codigo === eoi) break;
    if (viejo === -1) { out[op++] = codigo; viejo = codigo; primero = codigo; continue; }
    const entrante = codigo; let sp = 0;
    if (codigo >= sig) { pila[sp++] = primero; codigo = viejo; }      // caso KwKwK
    while (codigo >= clear) { pila[sp++] = sufijo[codigo]; codigo = prefijo[codigo]; }
    primero = codigo; pila[sp++] = primero;
    if (sig < 4096) {
      prefijo[sig] = viejo; sufijo[sig] = primero; sig++;
      if ((sig & mask) === 0 && sig < 4096) { tam++; mask = (1 << tam) - 1; }
    }
    viejo = entrante;
    while (sp > 0 && op < npix) out[op++] = pila[--sp];
  }
  return out;
}

/**
 * Lee un GIF y deja cada cuadro ya acomodado a 128×64 en escala de grises
 * (todavía sin binarizar). Hay que volver a llamarla solo si cambia la
 * geometría; para cambiar umbral o difuminado alcanza con
 * construirCuadrosGif.
 * @returns {{grises: Uint8Array[], delays: number[], anchoOriginal: number, altoOriginal: number}}
 */
export function leerGif(buffer, opcionesGeometria) {
  const origen = document.createElement('canvas');
  const dest = document.createElement('canvas');
  dest.width = ANCHO; dest.height = ALTO;
  let octx = null;
  const grises = [], delays = [];
  const info = decodificarGif(buffer, (rgba, delay, i, W, H) => {
    if (!octx || origen.width !== W || origen.height !== H) {
      origen.width = W; origen.height = H;
      octx = origen.getContext('2d', { willReadFrequently: true });
    }
    octx.putImageData(new ImageData(rgba, W, H), 0, 0);
    acomodarEnDestino(origen, W, H, opcionesGeometria, dest);
    grises.push(grisesDeCanvas(dest));
    delays.push(delay);
  });
  return { grises, delays, anchoOriginal: info.ancho, altoOriginal: info.alto };
}

/**
 * Binariza los cuadros de leerGif con umbral + difuminado y los deja en
 * el formato de animación. Junta cuadros consecutivos idénticos sumando
 * su duración (menos datos para Firebase y el ESP, misma animación).
 * @returns {{ancho: number, alto: number, cuadros: {datos: string, dur: number}[]}}
 */
export function construirCuadrosGif(leido, umbral = 127, dithering = false) {
  const cuadros = [];
  leido.grises.forEach((gris, i) => {
    const bm = dithering
      ? grisABitmapAtkinson(gris, ANCHO, ALTO, umbral)
      : grisABitmapUmbral(gris, ANCHO, ALTO, umbral);
    const datos = codificarBase64(bm);
    const dur = Math.min(65535, Math.max(20, Math.round(leido.delays[i])));
    const ultimo = cuadros[cuadros.length - 1];
    if (ultimo && ultimo.datos === datos) ultimo.dur = Math.min(65535, ultimo.dur + dur);
    else cuadros.push({ datos, dur });
  });
  return { ancho: ANCHO, alto: ALTO, cuadros };
}
