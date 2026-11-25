// Dibujante de caras de reloj (receta R1, docs/receta-r1.md). Dibuja una receta en una pantalla de 128×64 puntos igual que
// cara.cpp de las TV (Pepito Pro y Pepito Lite): mismas tablas (cara-datos.js, generadas junto con iconos_cara.h), mismas
// reglas de posición (sección 3b) y los mismos trazos que Adafruit GFX (líneas, círculos, rectángulos redondeados, letras).
// La prueba de que coinciden: el CRC32 de la pantalla (crcPantalla) es el mismo que escribe la TV con su prueba por el monitor
// serie (TVRETRO_PROBAR_CARAS).
//
// En la COPIA de la app (www/js/) vive junto a fonts.js y fuentesTexto.js de la Pro, que no se tocan.

import { TABLA_FUENTE } from './fonts.js';
import { datosFuente } from './fuentesTexto.js';
import { ICONOS, AGUJAS, DIAS, DIAS_CORTOS, MESES_CORTOS, LATIN1_A_CP437, BYTES_FILA, FILAS_ICONO } from './cara-datos.js';

export const ANCHO = 128;
export const ALTO = 64;
export const MAX_BYTES = 2048;
export const MAX_ELEMENTOS = 24;
const BYTES_FONDO = 1024;
const FUENTES = ['clasica', 'sans', 'sansb', 'serif', 'serifi'];

export const TIPO = Object.freeze({
  HORA: 1, AMPM: 2, FECHA: 3, DIA: 4, AGUJAS: 5, ESTADO: 6, CAMPANA: 7, TEXTO: 8, RECTANGULO: 9, LINEA: 10,
  PROXIMA_ALARMA: 11, CLIMA: 12, CUENTA: 13, BATERIA: 14,
});
const CON_LETRA = new Set([TIPO.HORA, TIPO.AMPM, TIPO.FECHA, TIPO.DIA, TIPO.TEXTO, TIPO.PROXIMA_ALARMA, TIPO.CLIMA, TIPO.CUENTA]);

// ---------------------------------------------------------------------------------------------------------------------
// La receta
// ---------------------------------------------------------------------------------------------------------------------
/** Lee la receta. Devuelve { fondo: Uint8Array|null, elementos: [{ tipo, d: Uint8Array }] } o null si está dañada. */
export function leerReceta(r) {
  if (!r || r.length < 5 || r.length > MAX_BYTES || r[0] !== 0x52 || r[1] !== 0x31) return null;
  let o = 4;
  let fondo = null;
  if (r[3] & 1) {
    if (r.length < o + BYTES_FONDO + 1) return null;
    fondo = r.subarray(o, o + BYTES_FONDO);
    o += BYTES_FONDO;
  }
  if (o >= r.length) return null;
  const n = r[o++];
  if (n > MAX_ELEMENTOS) return null;
  const elementos = [];
  for (let i = 0; i < n; i++) {
    if (o + 2 > r.length) return null;
    const tipo = r[o], largo = r[o + 1];
    o += 2;
    if (o + largo > r.length) return null;
    elementos.push({ tipo, d: r.subarray(o, o + largo) });
    o += largo;
  }
  return { fondo, elementos };
}

export const recetaValida = (r) => leerReceta(r) !== null;

/** Arma una receta a partir de { fondo?: Uint8Array(1024), elementos: [{ tipo, datos: number[] }] } (para el editor y las pruebas). */
export function armarReceta({ fondo = null, elementos = [] }) {
  const partes = [0x52, 0x31, 1, fondo ? 1 : 0];
  if (fondo) partes.push(...fondo);
  partes.push(elementos.length);
  for (const e of elementos) partes.push(e.tipo, e.datos.length, ...e.datos);
  return Uint8Array.from(partes);
}

// ---------------------------------------------------------------------------------------------------------------------
// Pantalla y trazos (los de Adafruit GFX)
// ---------------------------------------------------------------------------------------------------------------------
function P(p, x, y, c) { if (x >= 0 && x < ANCHO && y >= 0 && y < ALTO) p[y * ANCHO + x] = c; }
function lineaV(p, x, y, h, c) { for (let i = 0; i < h; i++) P(p, x, y + i, c); }
function lineaH(p, x, y, w, c) { for (let i = 0; i < w; i++) P(p, x + i, y, c); }
function relleno(p, x, y, w, h, c) { for (let j = 0; j < h; j++) lineaH(p, x, y + j, w, c); }
function rectangulo(p, x, y, w, h, c) { lineaH(p, x, y, w, c); lineaH(p, x, y + h - 1, w, c); lineaV(p, x, y, h, c); lineaV(p, x + w - 1, y, h, c); }

function linea(p, x0, y0, x1, y1, c) { // Adafruit_GFX::writeLine
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
  if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
  const dx = x1 - x0, dy = Math.abs(y1 - y0);
  let err = Math.trunc(dx / 2);
  const ystep = y0 < y1 ? 1 : -1;
  for (; x0 <= x1; x0++) {
    if (steep) P(p, y0, x0, c); else P(p, x0, y0, c);
    err -= dy;
    if (err < 0) { y0 += ystep; err += dx; }
  }
}

function circulo(p, x0, y0, r, c) { // drawCircle
  let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
  P(p, x0, y0 + r, c); P(p, x0, y0 - r, c); P(p, x0 + r, y0, c); P(p, x0 - r, y0, c);
  while (x < y) {
    if (f >= 0) { y--; ddy += 2; f += ddy; }
    x++; ddx += 2; f += ddx;
    P(p, x0 + x, y0 + y, c); P(p, x0 - x, y0 + y, c); P(p, x0 + x, y0 - y, c); P(p, x0 - x, y0 - y, c);
    P(p, x0 + y, y0 + x, c); P(p, x0 - y, y0 + x, c); P(p, x0 + y, y0 - x, c); P(p, x0 - y, y0 - x, c);
  }
}

function esquina(p, x0, y0, r, esq, c) { // drawCircleHelper
  let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
  while (x < y) {
    if (f >= 0) { y--; ddy += 2; f += ddy; }
    x++; ddx += 2; f += ddx;
    if (esq & 4) { P(p, x0 + x, y0 + y, c); P(p, x0 + y, y0 + x, c); }
    if (esq & 2) { P(p, x0 + x, y0 - y, c); P(p, x0 + y, y0 - x, c); }
    if (esq & 8) { P(p, x0 - y, y0 + x, c); P(p, x0 - x, y0 + y, c); }
    if (esq & 1) { P(p, x0 - y, y0 - x, c); P(p, x0 - x, y0 - y, c); }
  }
}

function esquinaLlena(p, x0, y0, r, esq, delta, c) { // fillCircleHelper
  let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r, px = x, py = y;
  delta++;
  while (x < y) {
    if (f >= 0) { y--; ddy += 2; f += ddy; }
    x++; ddx += 2; f += ddx;
    if (x < y + 1) {
      if (esq & 1) lineaV(p, x0 + x, y0 - y, 2 * y + delta, c);
      if (esq & 2) lineaV(p, x0 - x, y0 - y, 2 * y + delta, c);
    }
    if (y !== py) {
      if (esq & 1) lineaV(p, x0 + py, y0 - px, 2 * px + delta, c);
      if (esq & 2) lineaV(p, x0 - py, y0 - px, 2 * px + delta, c);
      py = y;
    }
    px = x;
  }
}

function rectRedondo(p, x, y, w, h, r, c) { // drawRoundRect
  const max = Math.trunc((w < h ? w : h) / 2);
  if (r > max) r = max;
  lineaH(p, x + r, y, w - 2 * r, c); lineaH(p, x + r, y + h - 1, w - 2 * r, c);
  lineaV(p, x, y + r, h - 2 * r, c); lineaV(p, x + w - 1, y + r, h - 2 * r, c);
  esquina(p, x + r, y + r, r, 1, c); esquina(p, x + w - r - 1, y + r, r, 2, c);
  esquina(p, x + w - r - 1, y + h - r - 1, r, 4, c); esquina(p, x + r, y + h - r - 1, r, 8, c);
}

function rectRedondoLleno(p, x, y, w, h, r, c) { // fillRoundRect
  const max = Math.trunc((w < h ? w : h) / 2);
  if (r > max) r = max;
  relleno(p, x + r, y, w - 2 * r, h, c);
  esquinaLlena(p, x + w - r - 1, y + r, r, 1, h - 2 * r - 1, c);
  esquinaLlena(p, x + r, y + r, r, 2, h - 2 * r - 1, c);
}

function bitmap(p, x, y, bytes, w, h, c) { // drawBitmap con filas de BYTES_FILA bytes (solo los puntos encendidos)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bytes[j * BYTES_FILA + (i >> 3)] & (0x80 >> (i & 7))) P(p, x + i, y + j, c);
}

// ---------------------------------------------------------------------------------------------------------------------
// Letras: el mismo camino que el Texto (UTF-8 -> Latin-1; la clásica en orden CP437)
// ---------------------------------------------------------------------------------------------------------------------
function aLatin1(texto) {
  const out = [];
  for (const ch of texto) { const c = ch.codePointAt(0); out.push(c > 0xFF || c === 0 ? 63 : c); }
  return out;
}

function medirTexto(codigos, fuente, tamano) {
  if (fuente === 'clasica') return { ancho: 6 * tamano * codigos.length, izq: 0 }; // la caja de Adafruit (sección 3b)
  const d = datosFuente(fuente, tamano);
  let x = 0, izq = Infinity, der = -Infinity;
  for (const c of codigos) {
    const g = d.g.get(c) || d.g.get(63);
    if (g.w > 0 && g.h > 0) { izq = Math.min(izq, x + g.xo); der = Math.max(der, x + g.xo + g.w); }
    x += g.adv;
  }
  if (izq === Infinity) return { ancho: 0, izq: 0 };
  return { ancho: der - izq, izq };
}

function letraClasica(p, x, y, codigo, t, c) { // drawChar de la fuente clásica (con cp437(true): sin el corrimiento de 176)
  for (let i = 0; i < 5; i++) {
    let col = TABLA_FUENTE[codigo * 5 + i];
    for (let j = 0; j < 8; j++, col >>= 1) {
      if (col & 1) { if (t === 1) P(p, x + i, y + j, c); else relleno(p, x + i * t, y + j * t, t, t, c); }
    }
  }
}

function letraGfx(p, d, x, base, g, c) { // drawChar de una GFXfont (tamaño 1)
  let bo = g.off, bits = 0, bit = 0;
  for (let yy = 0; yy < g.h; yy++) {
    for (let xx = 0; xx < g.w; xx++) {
      if (!(bit++ & 7)) bits = d.b[bo++];
      if (bits & 0x80) P(p, x + g.xo + xx, base + g.yo + yy, c);
      bits = (bits << 1) & 0xFF;
    }
  }
}

function x0Alineado(x, ancho, alin) {
  if (alin === 1) return Math.floor((2 * x - ancho) / 2);
  if (alin === 2) return x - ancho;
  return x;
}

/** Dibuja un texto con y = borde de arriba; devuelve el ancho usado para alinear. */
function texto(p, s, l, x, y, c) {
  const codigos = aLatin1(s);
  const { ancho, izq } = medirTexto(codigos, l.fuente, l.tamano);
  const x0 = x0Alineado(x, ancho, l.alin);
  if (l.fuente === 'clasica') {
    codigos.forEach((cod, i) => letraClasica(p, x0 + i * 6 * l.tamano, y, cod >= 0x80 ? LATIN1_A_CP437[cod - 0x80] : cod, l.tamano, c));
  } else {
    const d = datosFuente(l.fuente, l.tamano);
    let cx = x0 - izq;
    for (const cod of codigos) {
      const g = d.g.get(cod) || d.g.get(63);
      if (g.w > 0 && g.h > 0) letraGfx(p, d, cx, y + d.asc, g, c);
      cx += g.adv;
    }
  }
  return ancho;
}

// ---------------------------------------------------------------------------------------------------------------------
// Íconos
// ---------------------------------------------------------------------------------------------------------------------
function estiloDe(cat, estilo) { const lista = ICONOS[cat]; return lista[estilo] ? estilo : 0; }
function anchoIcono(cat, estilo) { return ICONOS[cat][estiloDe(cat, estilo)].ancho; }
function icono(p, cat, estilo, variante, x, y, c) {
  const e = ICONOS[cat][estiloDe(cat, estilo)];
  bitmap(p, x, y, e.variantes[variante] || e.variantes[0], e.ancho, FILAS_ICONO, c);
}

// ---------------------------------------------------------------------------------------------------------------------
// Fechas (días entre dos fechas, sin depender de la zona horaria)
// ---------------------------------------------------------------------------------------------------------------------
function diasCiviles(y, m, d) { // Howard Hinnant, days_from_civil (enteros)
  y -= m <= 2 ? 1 : 0;
  const era = Math.trunc((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.trunc((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

const dos = (n) => String(n).padStart(2, '0');
function textoHora(h, m, formato) {
  const h24 = (formato & 1) !== 0;
  let hh = h24 ? h : h % 12;
  if (!h24 && hh === 0) hh = 12;
  return ((formato & 2) ? dos(hh) : String(hh)) + ':' + dos(m);
}

// ---------------------------------------------------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------------------------------------------------
const b = (d, i, def) => (i < d.length ? d[i] : def);

function letraDe(d) {
  const f = b(d, 3, 0), t = b(d, 4, 1), a = b(d, 5, 0);
  return { fuente: FUENTES[f] || 'clasica', tamano: t < 1 ? 1 : t > 5 ? 5 : t, alin: a > 2 ? 0 : a };
}

function dibujarElemento(p, tipo, d, datos) {
  const x = b(d, 0, 0), y = b(d, 1, 0), c = b(d, 2, 0) ? 0 : 1;
  const l = CON_LETRA.has(tipo) ? letraDe(d) : null;
  const e = 6; // primer byte propio de los tipos con letra
  switch (tipo) {
    case TIPO.HORA: texto(p, textoHora(datos.hora, datos.minuto, b(d, e, 0)), l, x, y, c); break;
    case TIPO.AMPM: texto(p, datos.hora < 12 ? 'AM' : 'PM', l, x, y, c); break;
    case TIPO.FECHA: {
      const f = b(d, e, 0);
      const s = f === 1 ? `${dos(datos.dia)}/${dos(datos.mes)}`
        : f === 2 ? `${datos.dia} ${MESES_CORTOS[datos.mes - 1]}`
          : f === 3 ? `${DIAS_CORTOS[datos.diaSemana]} ${datos.dia}`
            : `${dos(datos.dia)}/${dos(datos.mes)}/${String(datos.anio).padStart(4, '0')}`;
      texto(p, s, l, x, y, c);
      break;
    }
    case TIPO.DIA: texto(p, (b(d, e, 0) === 1 ? DIAS_CORTOS : DIAS)[datos.diaSemana], l, x, y, c); break;
    case TIPO.AGUJAS: {
      const r = Math.min(31, Math.max(4, b(d, 3, 20))), marcas = b(d, 4, 0);
      circulo(p, x, y, r, c);
      const punta = (idx, largo) => {
        const [sx, sy] = AGUJAS[idx];
        const rd = (v) => (v >= 0 ? Math.trunc((v + 500) / 1000) : -Math.trunc((-v + 500) / 1000));
        return [x + rd(sx * largo), y + rd(sy * largo)];
      };
      if (marcas) for (let m = 0; m < 60; m += marcas === 1 ? 15 : 5) { const [mx, my] = punta(m, r - 2); P(p, mx, my, c); }
      const [hx, hy] = punta((datos.hora % 12) * 5 + Math.trunc(datos.minuto / 12), Math.trunc(r / 2));
      linea(p, x, y, hx, hy, c);
      const [mx, my] = punta(datos.minuto, r - 3);
      linea(p, x, y, mx, my, c);
      break;
    }
    case TIPO.ESTADO: {
      const ew = b(d, 3, 0), em = b(d, 4, 0), ec = b(d, 5, 0), sentido = b(d, 6, 1);
      const lista = [];
      if (datos.esPro) {
        lista.push(['wifi', ew, datos.wifiConectado ? 1 + Math.max(0, Math.min(4, datos.wifiBarras)) : 0]);
        lista.push(['conexion', ec, datos.conexionOk ? 1 : 0]);
      }
      if (datos.mensaje) lista.push(['mensaje', em, 0]);
      let cx = x;
      if (sentido === 1) {
        for (const [cat, est, v] of lista) { cx -= anchoIcono(cat, est); icono(p, cat, est, v, cx, y, c); cx -= 4; }
      } else {
        for (const [cat, est, v] of lista.reverse()) { icono(p, cat, est, v, cx, y, c); cx += anchoIcono(cat, est) + 4; }
      }
      break;
    }
    case TIPO.CAMPANA: if (datos.alarmaActiva) icono(p, 'campana', b(d, 3, 0), 0, x, y, c); break;
    case TIPO.TEXTO: {
      const n = Math.min(32, b(d, e, 0));
      const bytes = d.subarray(e + 1, e + 1 + n);
      texto(p, new TextDecoder().decode(bytes), l, x, y, c);
      break;
    }
    case TIPO.RECTANGULO: {
      const w = b(d, 3, 10), h = b(d, 4, 10), lleno = b(d, 5, 0), r = Math.min(8, b(d, 6, 0));
      if (w === 0 || h === 0) break;
      if (r) (lleno ? rectRedondoLleno : rectRedondo)(p, x, y, w, h, r, c);
      else (lleno ? relleno : rectangulo)(p, x, y, w, h, c);
      break;
    }
    case TIPO.LINEA: linea(p, x, y, b(d, 3, x), b(d, 4, y), c); break;
    case TIPO.PROXIMA_ALARMA: {
      if (!datos.proxAlarma) break;
      const s = textoHora(datos.proxAlarma.hora, datos.proxAlarma.minuto, 0) + (datos.proxAlarma.hora < 12 ? ' AM' : ' PM');
      conIcono(p, 'campana', b(d, e, 0), 0, s, l, x, y, c);
      break;
    }
    case TIPO.CLIMA: {
      if (!datos.clima) break;
      conIcono(p, 'clima', b(d, e, 0), datos.clima.icono, `${datos.clima.temp}°`, l, x, y, c);
      break;
    }
    case TIPO.CUENTA: {
      const anio = b(d, e, 0) | (b(d, e + 1, 0) << 8), mes = b(d, e + 2, 1), dia = b(d, e + 3, 1), f = b(d, e + 4, 0);
      const faltan = diasCiviles(anio, mes, dia) - diasCiviles(datos.anio, datos.mes, datos.dia);
      if (faltan < 0) break;
      const s = faltan === 0 ? '¡Hoy!'
        : f === 2 ? String(faltan)
          : f === 1 ? (faltan === 1 ? '1 día' : `${faltan} días`)
            : (faltan === 1 ? 'Falta 1 día' : `Faltan ${faltan} días`);
      texto(p, s, l, x, y, c);
      break;
    }
    case TIPO.BATERIA: {
      if (!datos.bateria) break;
      const est = b(d, 3, 0);
      icono(p, 'bateria', est, Math.max(1, Math.min(5, datos.bateria)) - 1, x, y, c);
      if (b(d, 4, 0)) texto(p, `${datos.bateriaPct}%`, { fuente: 'clasica', tamano: 1, alin: 0 }, x + anchoIcono('bateria', est) + 2, y + 1, c);
      break;
    }
    default: break; // tipo desconocido (de una versión más nueva): se salta
  }
}

// Ícono (con su marco de 10 filas una fila más arriba que el texto) + 2 puntos + texto; el conjunto se alinea respecto de x.
// estilo 0 en el byte de la receta = sin ícono; 1… = estilo 0… de la tabla.
function conIcono(p, cat, estiloReceta, variante, s, l, x, y, c) {
  if (!estiloReceta) { texto(p, s, l, x, y, c); return; }
  const est = estiloReceta - 1;
  const w = anchoIcono(cat, est);
  const anchoTexto = medirTexto(aLatin1(s), l.fuente, l.tamano).ancho;
  const x0 = x0Alineado(x, w + 2 + anchoTexto, l.alin);
  icono(p, cat, est, variante, x0, y - 1, c);
  texto(p, s, { ...l, alin: 0 }, x0 + w + 2, y, c);
}

// ---------------------------------------------------------------------------------------------------------------------
/**
 * Dibuja la receta. datos = { hora, minuto, dia, mes, anio, diaSemana (0 = domingo), esPro, wifiConectado, wifiBarras (0-4),
 * conexionOk, mensaje, alarmaActiva, proxAlarma: { hora, minuto } | null, clima: { temp, icono (0 sol…4 tormenta) } | null,
 * bateria (0 = sin medidor, 1-5: 20 % por nivel), bateriaPct }. Devuelve la pantalla (Uint8Array de 128×64, 1 = encendido) o null si la
 * receta está dañada (entonces se dibuja la Cara 1).
 */
export function dibujarCara(receta, datos, pantalla = new Uint8Array(ANCHO * ALTO)) {
  const r = leerReceta(receta);
  if (!r) return null;
  pantalla.fill(0);
  if (r.fondo) {
    for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) if (r.fondo[y * 16 + (x >> 3)] & (0x80 >> (x & 7))) pantalla[y * ANCHO + x] = 1;
  }
  for (const el of r.elementos) dibujarElemento(pantalla, el.tipo, el.d, datos);
  return pantalla;
}

// ---------------------------------------------------------------------------------------------------------------------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
/** CRC32 de la pantalla empaquetada por filas (16 bytes por fila, el bit alto a la izquierda): el mismo que escribe la TV. */
export function crcPantalla(pantalla) {
  let c = 0xFFFFFFFF;
  for (let y = 0; y < ALTO; y++) for (let k = 0; k < 16; k++) {
    let byte = 0;
    for (let i = 0; i < 8; i++) if (pantalla[y * ANCHO + k * 8 + i]) byte |= 0x80 >> i;
    c = TABLA_CRC[(c ^ byte) & 255] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// La Cara 1 (el reloj de hoy) escrita como receta (receta-r1.md, sección 5): íconos de estado, AM/PM, hora y fecha.
export const RECETA_CARA_1 = armarReceta({
  elementos: [
    { tipo: TIPO.ESTADO, datos: [125, 0, 0, 0, 0, 0, 1] },
    { tipo: TIPO.AMPM, datos: [2, 1, 0, 0, 1, 0] },
    { tipo: TIPO.HORA, datos: [64, 24, 0, 0, 3, 1, 0] },
    { tipo: TIPO.FECHA, datos: [64, 54, 0, 0, 1, 1, 0] },
  ],
});
