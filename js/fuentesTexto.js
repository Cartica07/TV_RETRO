/**fuentesTexto
 * Texto con fuentes de ancho variable (FreeSans / FreeSerif) en la OLED.
 *
 * Replica cómo dibuja Adafruit_GFX con display.setFont(&fuente): el cursor
 * (x, y) es la LÍNEA BASE; cada glifo se dibuja en (x + xOffset, y + yOffset)
 * y el cursor avanza xAdvance. Basado en datosFnt/geomFnt/dibujarTextoFnt de
 * CancionesMiniTV.
 *
 * Layout (lo que el firmware tiene que hacer igual para que la OLED coincida
 * con la vista previa):
 *  - Tamaño 1..5 -> pt según PT_POR_TAMANO (6, 10, 12, 16, 18).
 *  - Ancho de un texto = de la primera a la última columna con tinta.
 *  - Ajustar: mismas reglas de corte de líneas que la fuente clásica
 *    (párrafos por '\n', palabras por ' ', palabras largas por letra).
 *    Alto del bloque = ascenso + (líneas-1) × yAdvance + descenso.
 *  - Alineación vertical: "arriba" pega la tinta arriba; si no, centra.
 *  - Alineación horizontal: según el ancho de tinta de cada línea.
 *  - Scroll: una sola línea ('\n' -> espacio) que entra por la derecha.
 *  - Caracteres que la fuente no tiene se dibujan como '?'.
 */

import { FUENTES_GFX, PT_POR_TAMANO } from './fuentesGfx.js';

const ANCHO = 128;
const ALTO = 64;

/** Estilos disponibles (además de "clasica", la 5×7 de siempre). */
export const ESTILOS_FUENTE = Object.freeze({
  clasica: 'Clásica',
  sans: 'Sans',
  sansb: 'Sans negrita',
  serif: 'Serif',
  serifi: 'Serif cursiva'
});

/** true si el estilo es una fuente de ancho variable (no la clásica). */
export function esFuenteVariable(id) {
  return !!id && id !== 'clasica' && !!FUENTES_GFX.fuentes[id];
}

function b64ABytes(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

const cache = new Map();

/**
 * Glifos y métricas de una fuente en un tamaño 1..5 (con caché).
 * asc/desc = cuánto sube y baja la tinta respecto de la línea base.
 */
export function datosFuente(id, tamano) {
  const pt = PT_POR_TAMANO[tamano] || PT_POR_TAMANO[1];
  const k = id + '|' + pt;
  let d = cache.get(k);
  if (!d) {
    const f = FUENTES_GFX.fuentes[id].tamanos[pt];
    const t = b64ABytes(f.t), g = new Map();
    let asc = 0, desc = 0;
    FUENTES_GFX.codigos.forEach((c, i) => {
      const o = i * 7, w = t[o + 2], h = t[o + 3];
      const xo = (t[o + 5] << 24) >> 24, yo = (t[o + 6] << 24) >> 24;
      g.set(c, { off: t[o] | (t[o + 1] << 8), w, h, adv: t[o + 4], xo, yo });
      if (w > 0 && h > 0) { if (-yo > asc) asc = -yo; if (yo + h > desc) desc = yo + h; }
    });
    d = { g, b: b64ABytes(f.b), asc, desc, y: f.y, pt };
    cache.set(k, d);
  }
  return d;
}

function glifo(d, ch) {
  return d.g.get(ch.codePointAt(0)) || d.g.get(63); // '?'
}

/** Posición de cada letra y ancho de tinta de una línea. */
export function medirLinea(d, texto) {
  let x = 0, izq = Infinity, der = -Infinity;
  const pos = [];
  for (const ch of texto) {
    const g = glifo(d, ch);
    pos.push(x);
    if (g.w > 0 && g.h > 0) { izq = Math.min(izq, x + g.xo); der = Math.max(der, x + g.xo + g.w); }
    x += g.adv;
  }
  if (izq === Infinity) { izq = 0; der = 0; }
  return { pos, izq, der, ancho: der - izq };
}

const anchoDe = (d, texto) => medirLinea(d, texto).ancho;

function dividirPalabraLarga(d, palabra, anchoMax) {
  const partes = [];
  let actual = '';
  for (const ch of palabra) {
    const candidata = actual + ch;
    if (anchoDe(d, candidata) <= anchoMax || actual.length === 0) actual = candidata;
    else { partes.push(actual); actual = ch; }
  }
  if (actual.length > 0) partes.push(actual);
  return partes;
}

function dividirParrafo(d, parrafo, anchoMax) {
  if (parrafo.length === 0) return [''];
  const lineas = [];
  let actual = '';
  for (const palabra of parrafo.split(' ')) {
    if (anchoDe(d, palabra) > anchoMax) {
      if (actual.length > 0) { lineas.push(actual); actual = ''; }
      const partes = dividirPalabraLarga(d, palabra, anchoMax);
      for (let i = 0; i < partes.length - 1; i++) lineas.push(partes[i]);
      actual = partes.length ? partes[partes.length - 1] : '';
      continue;
    }
    const candidata = actual.length === 0 ? palabra : actual + ' ' + palabra;
    if (anchoDe(d, candidata) <= anchoMax || actual.length === 0) actual = candidata;
    else { lineas.push(actual); actual = palabra; }
  }
  if (actual.length > 0) lineas.push(actual);
  return lineas;
}

/** Divide en líneas con las mismas reglas que la fuente clásica. */
export function dividirEnLineasFuente(d, texto, anchoMax = ANCHO) {
  let lineas = [];
  for (const p of texto.split('\n')) lineas = lineas.concat(dividirParrafo(d, p, anchoMax));
  if (lineas.length === 0) lineas.push('');
  return lineas;
}

/** Dibuja una línea con la tinta empezando en xTinta y la base en yBase. */
function dibujarLinea(ctx, d, texto, xTinta, yBase) {
  const m = medirLinea(d, texto);
  const x0 = Math.round(xTinta - m.izq);
  let i = 0;
  for (const ch of texto) {
    const g = glifo(d, ch), px = x0 + m.pos[i++];
    if (!(g.w > 0 && g.h > 0)) continue;
    let bo = g.off, bit = 0, cur = 0;
    for (let yy = 0; yy < g.h; yy++) {
      for (let xx = 0; xx < g.w; xx++) {
        if ((bit++ & 7) === 0) cur = d.b[bo++];
        if (cur & 0x80) ctx.fillRect(px + g.xo + xx, yBase + g.yo + yy, 1, 1);
        cur = (cur << 1) & 0xFF;
      }
    }
  }
}

function yArriba(alturaTinta, alineacionV) {
  const y = (alineacionV === 'arriba') ? 0 : Math.round((ALTO - alturaTinta) / 2);
  return Math.max(0, y);
}

function xSegunAlineacion(ancho, alineacion) {
  let x = 0;
  if (alineacion === 'centro') x = (ANCHO - ancho) / 2;
  else if (alineacion === 'derecha') x = ANCHO - ancho;
  return Math.max(0, Math.round(x));
}

/** Texto de una sola línea para el modo scroll. */
export function textoScroll(texto) {
  return String(texto || '').replace(/\n/g, ' ');
}

/** Ancho de tinta del texto en modo scroll (para saber cuándo reiniciar). */
export function anchoScrollFuente(estado) {
  const d = datosFuente(estado.fuente, estado.tamano);
  return anchoDe(d, textoScroll(estado.texto));
}

/**
 * Dibuja el texto del estado con la fuente estado.fuente. El fondo ya
 * está pintado; se usa ctx.fillStyle = colorFrente.
 */
export function dibujarTextoFuente(ctx, estado, colorFrente, scrollX = null) {
  const d = datosFuente(estado.fuente, estado.tamano);
  ctx.fillStyle = colorFrente;
  const altoLinea = d.asc + d.desc;

  if (estado.modoTexto === 'scroll') {
    const top = yArriba(altoLinea, estado.alineacionV);
    const x = typeof scrollX === 'number' ? scrollX : ANCHO;
    dibujarLinea(ctx, d, textoScroll(estado.texto), x, top + d.asc);
    return;
  }

  // Ajustar (y, por compatibilidad, cualquier otro modo).
  const lineas = dividirEnLineasFuente(d, String(estado.texto || ''));
  const alto = d.asc + (lineas.length - 1) * d.y + d.desc;
  const top = yArriba(alto, estado.alineacionV);
  lineas.forEach((linea, i) => {
    const x = xSegunAlineacion(anchoDe(d, linea), estado.alineacion);
    dibujarLinea(ctx, d, linea, x, top + d.asc + i * d.y);
  });
}
