/**renderer
 * OLED Renderer
 * Dibuja pixel-perfect el bitmap real de Adafruit_GFX (glcdfont.c),
 * el mismo que usa texto.cpp en el firmware ESP32-S3 (y pantalla.cpp
 * en el ESP8266 original). Nada de fuentes del
 * sistema ni escalas manuales: cada punto que ves acá es el mismo
 * punto que se prende en la OLED física.
 */

import {
  fontMetrics,
  calcularAltoTexto,
  dividirEnLineas,
  calcularTamanoReducido,
  recortarTexto,
  calcularX,
  calcularAnchoTexto,
  dibujarTextoBitmap
} from './fonts.js';

import { dibujarPreviewImagen } from './imageProcessor.js';
import { esFuenteVariable, dibujarTextoFuente, medirBloqueFuente } from './fuentesTexto.js';

const ANCHO = 128;
const ALTO = 64;
// Color de los puntos encendidos: el cian de la OLED real (#4dd2ff).
const ACENTO_OLED = '#4dd2ff';
const NEGRO = '#000000';

/**
 * Posición Y según alineación vertical, espejo de calcularY() en
 * pantalla.cpp: "arriba" pega el contenido al borde superior;
 * cualquier otro valor (incluido "centro" o vacío) centra, que es
 * el comportamiento de siempre.
 */
function calcularY(alturaContenido, alineacionV) {
  const y = (alineacionV === 'arriba') ? 0 : Math.round((ALTO - alturaContenido) / 2);
  return Math.max(0, y);
}

/**
 * Posición manual (config.manual + config.x/config.y): esquina superior
 * izquierda del bloque de texto, limitada para que el bloque entero quede
 * dentro de la pantalla (igual que los sliders X/Y de CancionesMiniTV).
 */
export function limitarPosicion(valor, tamanoBloque, maximo) {
  const v = Math.round(Number(valor) || 0);
  return Math.max(0, Math.min(v, maximo - tamanoBloque));
}

/**
 * Scroll vertical (config.modoTexto = 'scroll' + config.direccion = 'v'):
 * el texto se arma en líneas como en Ajustar y, si el bloque es más alto
 * que la pantalla, sube (ver iniciarScrollVertical en main.js).
 */
export function esScrollVertical(estado) {
  return estado.modoTexto === 'scroll' && estado.direccion === 'v';
}

/**
 * Mide el bloque de texto tal como se dibuja (fuente clásica o variable):
 * { ancho, alto, xAuto, yAuto }. xAuto/yAuto son la esquina superior
 * izquierda que tendría con la alineación automática; se usan para que el
 * texto no salte al pasar a modo manual.
 */
export function medirBloqueTexto(estado) {
  if (esFuenteVariable(estado.fuente)) return medirBloqueFuente(estado);
  const tamano = estado.tamano;
  if (estado.modoTexto === 'scroll' && !esScrollVertical(estado)) {
    const alto = fontMetrics[tamano].height;
    return { ancho: calcularAnchoTexto(estado.texto, tamano), alto, xAuto: 0, yAuto: calcularY(alto, estado.alineacionV) };
  }
  const lineas = dividirEnLineas(estado.texto, tamano, ANCHO);
  const ancho = Math.max(0, ...lineas.map(l => calcularAnchoTexto(l, tamano)));
  const alto = calcularAltoTexto(lineas, tamano);
  const xAuto = Math.min(...lineas.map(l => calcularX(l, tamano, estado.alineacion, ANCHO)));
  return { ancho, alto, xAuto, yAuto: calcularY(alto, estado.alineacionV) };
}

/**
 * Dibuja la pantalla OLED completa basada en el estado actual
 */
export function dibujarOLED(canvas, estado, scrollX = null) {
  const ctx = canvas.getContext('2d');

  const fondo = estado.invertido ? ACENTO_OLED : NEGRO;
  const frente = estado.invertido ? NEGRO : ACENTO_OLED;

  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = frente;

  // V1.6: Si tipo es "imagen", renderizar bitmap monocromático
  if (estado.tipo === 'imagen' && estado.imagenData) {
    dibujarPreviewImagen(canvas, estado.imagenData, estado.imagenAncho, estado.imagenAlto, frente);
    return;
  }

  // Fuente de ancho variable (FreeSans / FreeSerif): config.fuente.
  if (esFuenteVariable(estado.fuente)) {
    dibujarTextoFuente(ctx, estado, frente, scrollX);
    return;
  }

  // Modos de texto (comportamiento V1.5 e inferiores)
  if (estado.modoTexto === 'ajustar') {
    renderizarAjustar(ctx, estado, frente);
  } else if (estado.modoTexto === 'reducir') {
    renderizarReducir(ctx, estado, frente);
  } else if (estado.modoTexto === 'recortar') {
    renderizarRecortar(ctx, estado, frente);
  } else if (esScrollVertical(estado)) {
    // Vertical: mismas líneas que Ajustar, desplazadas hacia arriba
    // (scrollX trae el desplazamiento en píxeles).
    renderizarAjustar(ctx, estado, frente, scrollX);
  } else if (estado.modoTexto === 'scroll') {
    renderizarScroll(ctx, estado, frente, scrollX);
  }
}

/**
 * Modo 'ajustar': divide en líneas y centra verticalmente el bloque.
 * El bloque se mide con la altura de CELDA (8*tamaño por línea), no
 * solo la tinta -- así el margen inferior queda igual de "grande" que
 * en la pantalla real (ver nota en fonts.js).
 */
function renderizarAjustar(ctx, estado, colorFrente, desplazamientoY = null) {
  const tamano = estado.tamano;
  const lineas = dividirEnLineas(estado.texto, tamano, ANCHO);
  const metrics = fontMetrics[tamano];

  const alturaBloque = calcularAltoTexto(lineas, tamano);
  // Scroll vertical con un bloque más alto que la pantalla: el bloque
  // arranca arriba (y = 0) y sube según el desplazamiento.
  const subiendo = esScrollVertical(estado) && alturaBloque > ALTO;
  const ySubiendo = -Math.round(Number(desplazamientoY) || 0);

  // Posición manual: el bloque va en (x, y), con las líneas alineadas a
  // la izquierda dentro del bloque.
  if (estado.manual) {
    const anchoBloque = Math.max(0, ...lineas.map(l => calcularAnchoTexto(l, tamano)));
    const x0 = limitarPosicion(estado.x, anchoBloque, ANCHO);
    const y0 = subiendo ? ySubiendo : limitarPosicion(estado.y, alturaBloque, ALTO);
    lineas.forEach((linea, i) => {
      dibujarTextoBitmap(ctx, linea, tamano, x0, y0 + i * metrics.lineHeight, colorFrente);
    });
    return;
  }

  const y = subiendo ? ySubiendo : calcularY(alturaBloque, estado.alineacionV);

  dibujarLineas(ctx, lineas, tamano, estado.alineacion, y, colorFrente);
}

/** Modo 'reducir': encuentra el tamaño más grande que entra. */
function renderizarReducir(ctx, estado, colorFrente) {
  const tamanoOptimo = calcularTamanoReducido(estado.texto, estado.tamano, ANCHO);
  const metrics = fontMetrics[tamanoOptimo];

  const x = calcularX(estado.texto, tamanoOptimo, estado.alineacion, ANCHO);
  const y = calcularY(metrics.height, estado.alineacionV);

  dibujarTextoBitmap(ctx, estado.texto, tamanoOptimo, x, y, colorFrente);
}

/** Modo 'recortar': corta con "..." si no entra. */
function renderizarRecortar(ctx, estado, colorFrente) {
  const tamano = estado.tamano;
  const textoRecortado = recortarTexto(estado.texto, tamano, ANCHO);
  const metrics = fontMetrics[tamano];

  const x = calcularX(textoRecortado, tamano, estado.alineacion, ANCHO);
  const y = calcularY(metrics.height, estado.alineacionV);

  dibujarTextoBitmap(ctx, textoRecortado, tamano, x, y, colorFrente);
}

/** Modo 'scroll': una línea que se desliza horizontalmente. */
function renderizarScroll(ctx, estado, colorFrente, scrollX) {
  const tamano = estado.tamano;
  const metrics = fontMetrics[tamano];

  // El desplazamiento llega con decimales (velocidad × tiempo): se redondea
  // a un píxel entero, como en la OLED. Con decimales el canvas pintaba
  // píxeles a medio encender y la vista previa dejaba de ser exacta.
  const x = typeof scrollX === 'number' ? Math.round(scrollX) : ANCHO;
  // En modo manual el scroll respeta la Y elegida (la X la maneja el scroll).
  const y = estado.manual
    ? limitarPosicion(estado.y, metrics.height, ALTO)
    : calcularY(metrics.height, estado.alineacionV);

  dibujarTextoBitmap(ctx, estado.texto, tamano, x, y, colorFrente);
}

/** Dibuja un bloque de líneas alineadas. */
function dibujarLineas(ctx, lineas, tamano, alineacion, startY, colorFrente) {
  const metrics = fontMetrics[tamano];

  lineas.forEach((linea, i) => {
    const x = calcularX(linea, tamano, alineacion, ANCHO);
    const y = startY + i * metrics.lineHeight;
    dibujarTextoBitmap(ctx, linea, tamano, x, y, colorFrente);
  });
}
