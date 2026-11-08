/**
 * Adafruit GFX Font - Fuente EXACTA (glcdfont.c)
 *
 * v2: la versión anterior de este archivo NO usaba el bitmap real
 * de la OLED, sino una fuente del sistema ('Courier New') escalada
 * con ESCALA_FUENTE + AJUSTE_VERTICAL para que "se pareciera" al
 * resultado real. Eso nunca puede calzar pixel a pixel: una fuente
 * vectorial no tiene la misma proporción ni densidad que una fuente
 * bitmap de puntos.
 *
 * Esta versión usa la tabla de bits REAL de glcdfont.c (la que trae
 * Adafruit_GFX y que tu pantalla.cpp usa por defecto al llamar
 * display.setTextSize(tamano) sin display.setFont()). Cada glyph es
 * una grilla de 5x7 puntos; no se "mide" texto, se dibuja bit a bit,
 * así que el ancho/alto es un cálculo exacto, no una aproximación.
 *
 * Geometría (igual que Adafruit_GFX con tamaño = 1):
 *   - 5 columnas de tinta + 1 columna de espacio entre letras  → avance X = 6
 *   - 7 filas de tinta + 1 fila de espacio entre líneas        → avance Y = 8
 *   - con textSize(N) todo se escala x N
 *
 * Importante sobre el margen inferior más grande que viste en la
 * pantalla real: NO es un bug. Es así en el propio dispositivo: la
 * fila 8 (de espaciado) es parte de la celda de cada línea pero no
 * tiene tinta, así que cuando se centra un bloque de texto usando la
 * altura completa de la celda (8*tamaño por línea, como hace
 * Adafruit_GFX con el cursor), la última línea deja ese espacio de
 * más abajo del todo. Acá se replica exactamente ese comportamiento.
 */

// Tabla de 256 caracteres x 5 bytes (una columna por byte, bit 0 = fila superior).
// Extraída de glcdfont.c (adafruit/Adafruit-GFX-Library, licencia BSD) -
// es la MISMA tabla que compila tu firmware por defecto.
export const TABLA_FUENTE = new Uint8Array([
0,0,0,0,0,62,91,79,91,62,62,107,79,107,62,28,62,124,62,28,
24,60,126,60,24,28,87,125,87,28,28,94,127,94,28,0,24,60,24,0,
255,231,195,231,255,0,24,36,24,0,255,231,219,231,255,48,72,58,6,14,
38,41,121,41,38,64,127,5,5,7,64,127,5,37,63,90,60,231,60,90,
127,62,28,28,8,8,28,28,62,127,20,34,127,34,20,95,95,0,95,95,
6,9,127,1,127,0,102,137,149,106,96,96,96,96,96,148,162,255,162,148,
8,4,126,4,8,16,32,126,32,16,8,8,42,28,8,8,28,42,8,8,
30,16,16,16,16,12,30,12,30,12,48,56,62,56,48,6,14,62,14,6,
0,0,0,0,0,0,0,95,0,0,0,7,0,7,0,20,127,20,127,20,
36,42,127,42,18,35,19,8,100,98,54,73,86,32,80,0,8,7,3,0,
0,28,34,65,0,0,65,34,28,0,42,28,127,28,42,8,8,62,8,8,
0,128,112,48,0,8,8,8,8,8,0,0,96,96,0,32,16,8,4,2,
62,81,73,69,62,0,66,127,64,0,114,73,73,73,70,33,65,73,77,51,
24,20,18,127,16,39,69,69,69,57,60,74,73,73,49,65,33,17,9,7,
54,73,73,73,54,70,73,73,41,30,0,0,20,0,0,0,64,52,0,0,
0,8,20,34,65,20,20,20,20,20,0,65,34,20,8,2,1,89,9,6,
62,65,93,89,78,124,18,17,18,124,127,73,73,73,54,62,65,65,65,34,
127,65,65,65,62,127,73,73,73,65,127,9,9,9,1,62,65,65,81,115,
127,8,8,8,127,0,65,127,65,0,32,64,65,63,1,127,8,20,34,65,
127,64,64,64,64,127,2,28,2,127,127,4,8,16,127,62,65,65,65,62,
127,9,9,9,6,62,65,81,33,94,127,9,25,41,70,38,73,73,73,50,
3,1,127,1,3,63,64,64,64,63,31,32,64,32,31,63,64,56,64,63,
99,20,8,20,99,3,4,120,4,3,97,89,73,77,67,0,127,65,65,65,
2,4,8,16,32,0,65,65,65,127,4,2,1,2,4,64,64,64,64,64,
0,3,7,8,0,32,84,84,120,64,127,40,68,68,56,56,68,68,68,40,
56,68,68,40,127,56,84,84,84,24,0,8,126,9,2,24,164,164,156,120,
127,8,4,4,120,0,68,125,64,0,32,64,64,61,0,127,16,40,68,0,
0,65,127,64,0,124,4,120,4,120,124,8,4,4,120,56,68,68,68,56,
252,24,36,36,24,24,36,36,24,252,124,8,4,4,8,72,84,84,84,36,
4,4,63,68,36,60,64,64,32,124,28,32,64,32,28,60,64,48,64,60,
68,40,16,40,68,76,144,144,144,124,68,100,84,76,68,0,8,54,65,0,
0,0,119,0,0,0,65,54,8,0,2,1,2,4,2,60,38,35,38,60,
30,161,161,97,18,58,64,64,32,122,56,84,84,85,89,33,85,85,121,65,
34,84,84,120,66,33,85,84,120,64,32,84,85,121,64,12,30,82,114,18,
57,85,85,85,89,57,84,84,84,89,57,85,84,84,88,0,0,69,124,65,
0,2,69,125,66,0,1,69,124,64,125,18,17,18,125,240,40,37,40,240,
124,84,85,69,0,32,84,84,124,84,124,10,9,127,73,50,73,73,73,50,
58,68,68,68,58,50,74,72,72,48,58,65,65,33,122,58,66,64,32,120,
0,157,160,160,125,61,66,66,66,61,61,64,64,64,61,60,36,255,36,36,
72,126,73,67,102,43,47,252,47,43,255,9,41,246,32,192,136,126,9,3,
32,84,84,121,65,0,0,68,125,65,48,72,72,74,50,56,64,64,34,122,
0,122,10,10,114,125,13,25,49,125,38,41,41,47,40,38,41,41,41,38,
48,72,77,64,32,56,8,8,8,8,8,8,8,8,56,47,16,200,172,186,
47,16,40,52,250,0,0,123,0,0,8,20,42,20,34,34,20,42,20,8,
85,0,85,0,85,170,85,170,85,170,255,85,255,85,255,0,0,0,255,0,
16,16,16,255,0,20,20,20,255,0,16,16,255,0,255,16,16,240,16,240,
20,20,20,252,0,20,20,247,0,255,0,0,255,0,255,20,20,244,4,252,
20,20,23,16,31,16,16,31,16,31,20,20,20,31,0,16,16,16,240,0,
0,0,0,31,16,16,16,16,31,16,16,16,16,240,16,0,0,0,255,16,
16,16,16,16,16,16,16,16,255,16,0,0,0,255,20,0,0,255,0,255,
0,0,31,16,23,0,0,252,4,244,20,20,23,16,23,20,20,244,4,244,
0,0,255,0,247,20,20,20,20,20,20,20,247,0,247,20,20,20,23,20,
16,16,31,16,31,20,20,20,244,20,16,16,240,16,240,0,0,31,16,31,
0,0,0,31,20,0,0,0,252,20,0,0,240,16,240,16,16,255,16,255,
20,20,20,255,20,16,16,16,31,0,0,0,0,240,16,255,255,255,255,255,
240,240,240,240,240,255,255,255,0,0,0,0,0,255,255,15,15,15,15,15,
56,68,68,56,68,252,74,74,74,52,126,2,2,6,6,2,126,2,126,2,
99,85,73,65,99,56,68,68,60,4,64,126,32,30,32,6,2,126,2,2,
153,165,231,165,153,28,42,73,42,28,76,114,1,114,76,48,74,77,77,48,
48,72,120,72,48,188,98,90,70,61,62,73,73,73,0,126,1,1,1,126,
42,42,42,42,42,68,68,95,68,68,64,81,74,68,64,64,68,74,81,64,
0,0,255,1,3,224,128,255,0,0,8,8,107,107,8,54,18,54,36,54,
6,15,9,15,6,0,0,24,24,0,0,0,16,16,0,48,64,255,1,1,
0,31,1,1,30,0,25,29,23,18,0,60,60,60,60,0,0,0,0,0]);

const ANCHO_GLYPH = 5;   // columnas de tinta
const ALTO_GLYPH = 7;    // filas de tinta
const AVANCE_X = 6;      // ancho + 1 columna de espacio entre letras
const AVANCE_Y = 8;      // alto + 1 fila de espacio entre líneas

// Métricas por tamaño (se mantienen exportadas por compatibilidad,
// varios módulos las usan para calcular layout sin volver a tocar HTML/CSS).
export const fontMetrics = {
  1: { width: AVANCE_X * 1, height: AVANCE_Y * 1, charWidth: ANCHO_GLYPH * 1, lineHeight: AVANCE_Y * 1 },
  2: { width: AVANCE_X * 2, height: AVANCE_Y * 2, charWidth: ANCHO_GLYPH * 2, lineHeight: AVANCE_Y * 2 },
  3: { width: AVANCE_X * 3, height: AVANCE_Y * 3, charWidth: ANCHO_GLYPH * 3, lineHeight: AVANCE_Y * 3 },
  4: { width: AVANCE_X * 4, height: AVANCE_Y * 4, charWidth: ANCHO_GLYPH * 4, lineHeight: AVANCE_Y * 4 },
  5: { width: AVANCE_X * 5, height: AVANCE_Y * 5, charWidth: ANCHO_GLYPH * 5, lineHeight: AVANCE_Y * 5 }
};

/**
 * Ancho en píxeles físicos que ocupa un texto a un tamaño dado.
 * Igual al resultado de Adafruit_GFX::getTextBounds(): n caracteres
 * a AVANCE_X*tamano px, menos la última columna de espacio (el
 * bounding box real no incluye el espacio después del último caracter).
 */
export function calcularAnchoTexto(texto, tamano) {
  if (!texto.length) return 0;
  return texto.length * AVANCE_X * tamano - tamano;
}

/**
 * Altura en píxeles de un bloque de N líneas.
 * Usa la altura de CELDA completa (8*tamaño) por línea -- igual que
 * el avance de cursor real de Adafruit_GFX -- no solo la tinta visible
 * (7*tamaño). Por eso la última línea del bloque deja un renglón de
 * más abajo del todo: así se ve también en la OLED física.
 */
export function calcularAltoTexto(lineas, tamano) {
  if (!lineas || lineas.length === 0) return 0;
  return AVANCE_Y * tamano * lineas.length;
}

/**
 * Corta una palabra que no entra sola en el ancho disponible,
 * caracter por caracter, en tantos pedazos como haga falta.
 * Espejo de dividirPalabraLarga() en pantalla.cpp, usando
 * calcularAnchoTexto() en vez de display.getTextBounds().
 */
function dividirPalabraLarga(palabra, tamano, anchoMax) {
  const partes = [];
  let actual = '';

  for (const ch of palabra) {
    const candidata = actual + ch;
    const ancho = calcularAnchoTexto(candidata, tamano);

    if (ancho <= anchoMax || actual.length === 0) {
      actual = candidata;
    } else {
      partes.push(actual);
      actual = ch;
    }
  }

  if (actual.length > 0) partes.push(actual);
  return partes;
}

/**
 * Aplica el word-wrap sobre un solo párrafo (sin '\n' adentro).
 * Espejo de dividirParrafoEnLineas() en pantalla.cpp.
 */
function dividirParrafoEnLineas(parrafo, tamano, anchoMax) {
  if (parrafo.length === 0) {
    // Línea en blanco explícita (el usuario dejó un renglón vacío).
    return [''];
  }

  const lineas = [];
  let lineaActual = '';

  // Misma extracción de palabras que el firmware: parte por espacios
  // simples, uno a uno (equivalente a texto.split(' ')).
  const palabras = parrafo.split(' ');

  for (const palabra of palabras) {
    const anchoPalabra = calcularAnchoTexto(palabra, tamano);

    if (anchoPalabra > anchoMax) {
      // La palabra no entra sola en una línea: se corta.
      if (lineaActual.length > 0) {
        lineas.push(lineaActual);
        lineaActual = '';
      }

      const partes = dividirPalabraLarga(palabra, tamano, anchoMax);

      for (let i = 0; i < partes.length - 1; i++) lineas.push(partes[i]);

      // El último pedazo de la palabra queda abierto, por si todavía
      // entra algo más de la siguiente palabra al lado.
      lineaActual = partes.length ? partes[partes.length - 1] : '';
      continue;
    }

    const candidata = lineaActual.length === 0 ? palabra : lineaActual + ' ' + palabra;
    const anchoCandidata = calcularAnchoTexto(candidata, tamano);

    if (anchoCandidata <= anchoMax || lineaActual.length === 0) {
      lineaActual = candidata;
    } else {
      lineas.push(lineaActual);
      lineaActual = palabra;
    }
  }

  if (lineaActual.length > 0) lineas.push(lineaActual);
  return lineas;
}

/**
 * Divide un texto en líneas, igual que dividirEnLineas() en pantalla.cpp:
 * primero separa por saltos de línea explícitos ('\n', los que deja el
 * Enter en el textarea), y dentro de cada párrafo aplica word-wrap,
 * cortando caracter por caracter las palabras que no entran solas.
 */
export function dividirEnLineas(texto, tamano, anchoMax = 128) {
  const parrafos = texto.split('\n');
  let lineas = [];

  for (const parrafo of parrafos) {
    lineas = lineas.concat(dividirParrafoEnLineas(parrafo, tamano, anchoMax));
  }

  if (lineas.length === 0) lineas.push('');
  return lineas;
}

/** Busca el tamaño más grande (1..tamanoMax) que entra en el ancho disponible. */
export function calcularTamanoReducido(texto, tamanoMax, anchoMax = 128) {
  for (let t = tamanoMax; t >= 1; t--) {
    if (calcularAnchoTexto(texto, t) <= anchoMax) return t;
  }
  return 1;
}

/** Recorta el texto agregando "..." si no entra en el ancho disponible. */
export function recortarTexto(texto, tamano, anchoMax = 128) {
  if (calcularAnchoTexto(texto, tamano) <= anchoMax) return texto;

  const sufijo = '...';
  for (let len = texto.length - 1; len > 0; len--) {
    const candidata = texto.slice(0, len) + sufijo;
    if (calcularAnchoTexto(candidata, tamano) <= anchoMax) return candidata;
  }
  return sufijo;
}

/** Calcula la posición X según alineación (izquierda/centro/derecha). */
export function calcularX(texto, tamano, alineacion, anchoMax = 128) {
  const w = calcularAnchoTexto(texto, tamano);
  let x = 0;
  if (alineacion === 'centro') x = (anchoMax - w) / 2;
  else if (alineacion === 'derecha') x = anchoMax - w;
  return Math.max(0, Math.round(x));
}

/**
 * Dibuja texto en el canvas replicando el bitmap real, caracter por
 * caracter, punto por punto. (x, y) es la esquina superior izquierda
 * de la celda del primer caracter (no del glyph "recortado").
 */
export function dibujarTextoBitmap(ctx, texto, tamano, x, y, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of texto) {
    let codigo = ch.codePointAt(0);
    // La tabla clásica cubre 0-255; cualquier otro caracter (emoji, etc.)
    // se dibuja como '?' para no romper el layout.
    if (codigo > 255) codigo = 63;
    // Tildes, ñ, ¿, ¡...: la tabla está en el orden CP437, no Latin-1.
    else if (codigo >= 0x80) codigo = LATIN1_A_CP437[codigo - 0x80];
    dibujarCaracterBitmap(ctx, codigo, cx, y, tamano);
    cx += AVANCE_X * tamano;
  }
}

/**
 * Latin-1 (0x80..0xFF) -> posición en TABLA_FUENTE. glcdfont sigue el
 * orden CP437 (la "á" está en 0xA0, no en 0xE1), así que sin esto las
 * tildes salían como otros símbolos. Las mayúsculas acentuadas que CP437
 * no tiene (Á, Í, Ó, Ú...) van sin tilde; lo que no tiene equivalente, '?'.
 * El firmware usa la misma tabla (texto.cpp).
 */
const LATIN1_A_CP437 = new Uint8Array([
  0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F,
  0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F,
  0x20, 0xAD, 0x9B, 0x9C, 0x3F, 0x9D, 0x3F, 0x3F, 0x3F, 0x3F, 0xA6, 0xAE, 0xAA, 0x3F, 0x3F, 0x3F,
  0xF8, 0xF1, 0xFD, 0x3F, 0x3F, 0xE6, 0x3F, 0xFA, 0x3F, 0x3F, 0xA7, 0xAF, 0xAC, 0xAB, 0x3F, 0xA8,
  0x41, 0x41, 0x41, 0x41, 0x8E, 0x8F, 0x92, 0x80, 0x45, 0x90, 0x45, 0x45, 0x49, 0x49, 0x49, 0x49,
  0x3F, 0xA5, 0x4F, 0x4F, 0x4F, 0x4F, 0x99, 0x3F, 0x4F, 0x55, 0x55, 0x55, 0x9A, 0x59, 0x3F, 0xE1,
  0x85, 0xA0, 0x83, 0x61, 0x84, 0x86, 0x91, 0x87, 0x8A, 0x82, 0x88, 0x89, 0x8D, 0xA1, 0x8C, 0x8B,
  0x3F, 0xA4, 0x95, 0xA2, 0x93, 0x6F, 0x94, 0xF6, 0x6F, 0x97, 0xA3, 0x96, 0x81, 0x79, 0x3F, 0x98
]);

function dibujarCaracterBitmap(ctx, codigo, x, y, tamano) {
  const offset = codigo * 5;
  for (let col = 0; col < ANCHO_GLYPH; col++) {
    const columna = TABLA_FUENTE[offset + col] || 0;
    for (let fila = 0; fila < ALTO_GLYPH; fila++) {
      if (columna & (1 << fila)) {
        ctx.fillRect(x + col * tamano, y + fila * tamano, tamano, tamano);
      }
    }
  }
}
