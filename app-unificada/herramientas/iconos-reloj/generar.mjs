// Íconos de las caras de reloj (2026-11-24): genera la página para que el dueño elija los estilos (iconos-reloj.html, se publica
// aparte) e iconos.json. Los dibujos que se elijan pasan tal cual al dibujante de la app y de las dos TV. node generar.mjs [--ver]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { TABLA_FUENTE } = await import(pathToFileURL(path.join(aqui, '..', '..', '..', 'js', 'fonts.js')).href);

// ---- utilidades de dibujo (mismas reglas que Adafruit GFX) ----
const nuevo = (w, h) => Array.from({ length: h }, () => Array(w).fill(0));
const P = (m, x, y, v = 1) => { if (y >= 0 && y < m.length && x >= 0 && x < m[0].length) m[y][x] = v; };
function linea(m, x0, y0, x1, y1, v = 1) { // Adafruit_GFX::writeLine
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
  if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
  const dx = x1 - x0, dy = Math.abs(y1 - y0); let err = Math.floor(dx / 2); const ys = y0 < y1 ? 1 : -1;
  for (; x0 <= x1; x0++) { if (steep) P(m, y0, x0, v); else P(m, x0, y0, v); err -= dy; if (err < 0) { y0 += ys; err += dx; } }
}
const rect = (m, x, y, w, h, v = 1) => { for (let i = 0; i < w; i++) { P(m, x + i, y, v); P(m, x + i, y + h - 1, v); } for (let j = 0; j < h; j++) { P(m, x, y + j, v); P(m, x + w - 1, y + j, v); } };
const lleno = (m, x, y, w, h, v = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(m, x + i, y + j, v); };
function circulo(m, x0, y0, r, relleno) { // Adafruit drawCircle / fillCircle
  if (relleno) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) P(m, x0 + x, y0 + y); return; }
  let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
  P(m, x0, y0 + r); P(m, x0, y0 - r); P(m, x0 + r, y0); P(m, x0 - r, y0);
  while (x < y) { if (f >= 0) { y--; ddy += 2; f += ddy; } x++; ddx += 2; f += ddx;
    for (const [a, b] of [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]]) P(m, x0 + a, y0 + b); }
}
const deTexto = (filas) => filas.map((f) => [...f].map((c) => (c === '#' ? 1 : 0)));
const aTexto = (m) => m.map((f) => f.map((v) => (v ? '#' : '.')).join(''));
const punteado = (m) => m.map((f, y) => f.map((v, x) => (v && (x + y) % 2 === 0 ? 1 : 0)));
const unir = (...ms) => ms[0].map((f, y) => f.map((_, x) => (ms.some((m) => m[y][x]) ? 1 : 0)));

// ---- Wi-Fi ----
function barras(nivel, sinWifi = nivel === 0) { // el de hoy (pantalla.cpp, dibujarIconoSenal)
  const m = nuevo(15, 9);
  if (sinWifi) { linea(m, 0, 0, 8, 8); linea(m, 0, 8, 8, 0); return m; }
  for (let i = 0; i < 4; i++) { const h = (8 * (i + 1)) / 4, x = i * 4, y = 8 - h; (i < nivel ? lleno : rect)(m, x, y, 3, h); }
  return m;
}
// Abanico (el de los celulares): capas de abajo hacia arriba.
const AB = {
  punto: deTexto(['.........', '.........', '.........', '.........', '.........', '.........', '....#....', '...###...']),
  a1: deTexto(['.........', '.........', '.........', '.........', '...###...', '..#...#..', '.........', '.........']),
  a2: deTexto(['.........', '.........', '..#####..', '.#.....#.', '.........', '.........', '.........', '.........']),
  a3: deTexto(['..#####..', '##.....##', '.........', '.........', '.........', '.........', '.........', '.........']),
};
function abanico(nivel) {
  const capas = [AB.punto, AB.a1, AB.a2, AB.a3];
  // La onda que falta no se dibuja (el dueño: los puntitos parecían restos). Sin Wi-Fi: el dibujo completo cruzado por una raya.
  if (nivel === 0) { const m = unir(...capas); linea(m, 1, 7, 9, -1, 0); linea(m, 0, 7, 8, -1); return m; } // raya con un borde negro al lado
  return unir(...capas.map((c, i) => (i < nivel ? c : nuevo(c[0].length, c.length))));
}
// Ondas ")))": una antena con ondas a la derecha.
const ON = {
  antena: deTexto(['..........', '..........', '..........', '##........', '##........', '##........', '..........', '..........', '..........']),
  o1: deTexto(['..........', '..........', '...#......', '....#.....', '....#.....', '....#.....', '...#......', '..........', '..........']),
  o2: deTexto(['..........', '.....#....', '......#...', '.......#..', '.......#..', '.......#..', '......#...', '.....#....', '..........']),
  o3: deTexto(['.......#..', '........#.', '.........#', '.........#', '.........#', '.........#', '.........#', '........#.', '.......#..']),
};
function ondas(nivel) {
  const capas = [ON.antena, ON.o1, ON.o2, ON.o3];
  if (nivel === 0) { const m = unir(...capas); linea(m, 1, 8, 10, -1, 0); linea(m, 0, 8, 9, -1); return m; }
  return unir(...capas.map((c, i) => (i < nivel ? c : nuevo(c[0].length, c.length))));
}
// n0 = conectado pero sin barras (las de hoy: todas huecas; abanico y ondas: como n1). sin = sin Wi-Fi.
const variantesWifi = (f) => ({ n4: f(4), n3: f(3), n2: f(2), n1: f(1), n0: f === barras ? barras(0, false) : f(1), sin: f(0) });

// ---- Mensaje ----
function sobre() { const m = nuevo(11, 8); rect(m, 0, 0, 11, 8); linea(m, 0, 0, 5, 5); linea(m, 10, 0, 5, 5); return m; } // el de hoy
function sobreLleno() { const m = nuevo(11, 8); lleno(m, 0, 0, 11, 8); linea(m, 1, 1, 5, 5, 0); linea(m, 9, 1, 5, 5, 0); return m; }
const burbuja = () => deTexto(['.#########.', '#.........#', '#.#..#..#.#', '#.........#', '.#.#######.', '.##........', '.#.........']);

// ---- Conexión (Pro) ----
function circuloCon(ok) { const m = nuevo(7, 7); circulo(m, 3, 3, 3, ok); return m; } // el de hoy
const NUBE = ['....###....', '..##...#...', '.#.....###.', '#.........#', '#.........#', '.#########.'];
function nube(ok) { const m = deTexto(NUBE); if (ok) { for (const f of m) { const a = f.indexOf(1), b = f.lastIndexOf(1); for (let x = a; x <= b; x++) f[x] = 1; } } return m; }

// ---- Campana ----
const campana = () => deTexto(['....#....', '...###...', '..#####..', '..#####..', '..#####..', '.#######.', '#########', '.........', '....#....']);
const despertador = () => deTexto(['##.....##', '#.#####.#', '.#..#..#.', '#...#...#', '#...###.#', '#.......#', '.#.....#.', '..#####..', '.#.....#.']);
const campanaHueca = () => deTexto(['....#....', '...#.#...', '..#...#..', '..#...#..', '..#...#..', '.#.....#.', '#########', '.........', '....#....']);

// ---- Batería ----
function bateria(nivel, segmentos) {
  const m = nuevo(14, 7); rect(m, 0, 0, 12, 7); lleno(m, 12, 2, 2, 3);
  if (segmentos) for (let i = 0; i < nivel; i++) lleno(m, 2 + i * 2 + i * 0, 2, 1, 3), lleno(m, 2 + i * 2, 2, 2 - 0, 3);
  else lleno(m, 2, 2, Math.round((8 * nivel) / 4), 3);
  if (segmentos) { const m2 = nuevo(14, 7); rect(m2, 0, 0, 12, 7); lleno(m2, 12, 2, 2, 3); for (let i = 0; i < nivel; i++) lleno(m2, 2 + i * 2 + (i > 0 ? 0 : 0), 2, 1, 3); }
  return m;
}
function bateriaSegmentos(nivel) { const m = nuevo(17, 7); rect(m, 0, 0, 15, 7); lleno(m, 15, 2, 2, 3); for (let i = 0; i < nivel; i++) lleno(m, 2 + i * 3, 2, 2, 3); return m; }
function bateriaBarra(nivel) { const m = nuevo(17, 7); rect(m, 0, 0, 15, 7); lleno(m, 15, 2, 2, 3); lleno(m, 2, 2, Math.round((11 * nivel) / 4), 3); return m; }
const variantesBateria = (f) => ({ n4: f(4), n3: f(3), n2: f(2), n1: f(1) });

// ---- Clima (Pro) ----
const SOL = ['....#....', '.#.....#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#.....#.', '....#....'];
const NUBLADO = ['...........', '....###....', '..##...#...', '.#.....###.', '#.........#', '#.........#', '.#########.', '...........', '...........'];
const PARCIAL = ['#.#.#......', '.###.......', '#####......', '.###.###...', '#.#.#...#..', '...#.....##', '..#.......#', '..#.......#', '...#######.'];
const LLUVIA = ['....###....', '..##...#...', '.#.....###.', '#.........#', '.#########.', '...........', '.#..#..#...', '#..#..#....', '...........'];
const TORMENTA = ['....###....', '..##...#...', '.#.....###.', '#.........#', '.####.####.', '....#......', '...###.....', '.....#.....', '....#......'];

const est = (nombre, dibujos, muestras, normal = muestras[0], rotulos) => ({ nombre, dibujos: Object.fromEntries(Object.entries(dibujos).map(([k, v]) => [k, aTexto(v)])), muestras, normal, rotulos });

const WIFI = [
  est('Barras', variantesWifi(barras), ['n4', 'n2', 'sin'], 'n4', { n4: '4 barras', n2: '2 barras', sin: 'sin Wi-Fi' }),
  est('Abanico', variantesWifi(abanico), ['n4', 'n2', 'sin'], 'n4', { n4: 'señal llena', n2: 'señal media', sin: 'sin Wi-Fi' }),
  est('Ondas )))', variantesWifi(ondas), ['n4', 'n2', 'sin'], 'n4', { n4: 'señal llena', n2: 'señal media', sin: 'sin Wi-Fi' }),
];
const MENSAJE = [
  est('Sobre', { normal: sobre() }, ['normal']),
  est('Sobre lleno', { normal: sobreLleno() }, ['normal']),
  est('Burbuja de chat', { normal: burbuja() }, ['normal']),
];
const CONEXION = [
  est('Círculo', { ok: circuloCon(true), falla: circuloCon(false) }, ['ok', 'falla'], 'ok', { ok: 'conectado', falla: 'sin conexión' }),
  est('Nube', { ok: nube(true), falla: nube(false) }, ['ok', 'falla'], 'ok', { ok: 'conectado', falla: 'sin conexión' }),
];
const CAMPANA = [
  est('Campana', { normal: campana() }, ['normal']),
  est('Campana hueca', { normal: campanaHueca() }, ['normal']),
  est('Despertador', { normal: despertador() }, ['normal']),
];
const BATERIA = [
  est('Segmentos', variantesBateria(bateriaSegmentos), ['n4', 'n3', 'n2', 'n1'], 'n4', { n4: '100 %', n3: '75 %', n2: '50 %', n1: '25 %' }),
  est('Barra', variantesBateria(bateriaBarra), ['n4', 'n3', 'n2', 'n1'], 'n4', { n4: '100 %', n3: '75 %', n2: '50 %', n1: '25 %' }),
];
const CLIMA = [
  est('Dibujos simples', { sol: deTexto(SOL), parcial: deTexto(PARCIAL), nublado: deTexto(NUBLADO), lluvia: deTexto(LLUVIA), tormenta: deTexto(TORMENTA) },
    ['sol', 'parcial', 'nublado', 'lluvia', 'tormenta'], 'sol', { sol: 'soleado', parcial: 'parcialmente nublado', nublado: 'nublado', lluvia: 'lluvia', tormenta: 'tormenta' }),
];

if (process.argv.includes('--ver')) {
  for (const [nom, lista] of Object.entries({ WIFI, MENSAJE, CONEXION, CAMPANA, BATERIA, CLIMA })) for (const e of lista) for (const v of e.muestras) {
    console.log(`${nom} / ${e.nombre} / ${v}`); console.log(e.dibujos[v].join('\n')); console.log();
  }
}

const fuente = JSON.stringify(Array.from(TABLA_FUENTE.slice(32 * 5, 127 * 5)));
let html = fs.readFileSync(path.join(aqui, 'plantilla.html'), 'utf8');
const rep = (k, v) => { if (!html.includes(k)) throw new Error('falta ' + k); html = html.replace(k, v); };
rep('__FUENTE__', fuente);
rep('__WIFI__', JSON.stringify(WIFI)); rep('__MENSAJE__', JSON.stringify(MENSAJE)); rep('__CONEXION__', JSON.stringify(CONEXION));
rep('__CAMPANA__', JSON.stringify(CAMPANA)); rep('__BATERIA__', JSON.stringify(BATERIA)); rep('__CLIMA__', JSON.stringify(CLIMA));
fs.writeFileSync(path.join(aqui, 'iconos-reloj.html'), html);
fs.writeFileSync(path.join(aqui, 'iconos.json'), JSON.stringify({ WIFI, MENSAJE, CONEXION, CAMPANA, BATERIA, CLIMA }, null, 1));
console.log('listo:', path.join(aqui, 'iconos-reloj.html'));

// =====================================================================================================================
// Tablas para el dibujante de caras (docs/receta-r1.md, sección 3b): UNA sola fuente para la app y las dos TV.
//   - app-unificada/src/cara-datos.js        (lo usa src/cara.js)
//   - OLED_Remota/iconos_cara.h y OLED_Lite/iconos_cara.h  (copias exactas; las usa cara.cpp)
// Cada ícono es un dibujo de 10 filas de alto con su posición vertical incluida, ancho fijo por estilo (así el reloj de hoy
// sale exacto), empaquetado como drawBitmap de Adafruit (por filas, ceil(ancho/8) bytes por fila, el bit alto a la izquierda).
// =====================================================================================================================
const FILAS = 10;
const MARCO = { // por estilo: [ancho, fila donde empieza el dibujo]
  wifi: [[15, 1], [9, 1], [10, 1]],
  conexion: [[7, 2], [11, 2]],
  mensaje: [[11, 1], [11, 1], [11, 1]],
  campana: [[9, 1], [9, 1], [9, 1]],
  bateria: [[17, 2], [17, 2]],
  clima: [[11, 1]],
};
const VARIANTES = {
  wifi: ['sin', 'n0', 'n1', 'n2', 'n3', 'n4'],
  conexion: ['falla', 'ok'],
  mensaje: ['normal'],
  campana: ['normal'],
  bateria: ['n1', 'n2', 'n3', 'n4'],
  clima: ['sol', 'parcial', 'nublado', 'lluvia', 'tormenta'],
};
const CATEGORIAS = { wifi: WIFI, conexion: CONEXION, mensaje: MENSAJE, campana: CAMPANA, bateria: BATERIA, clima: CLIMA };
const MAX_ESTILOS = 3, MAX_VARIANTES = 6, BYTES_FILA = 3; // 17 puntos de ancho como máximo

function empaquetar(filas, ancho, fila0) {
  const out = new Uint8Array(BYTES_FILA * FILAS);
  filas.forEach((f, j) => {
    const y = fila0 + j;
    if (y >= FILAS) { if (f.includes('#')) throw new Error('un dibujo no entra en 10 filas'); return; }
    [...f].forEach((c, x) => {
      if (c !== '#') return;
      if (x >= ancho) throw new Error('un dibujo es más ancho que su marco');
      out[y * BYTES_FILA + (x >> 3)] |= 0x80 >> (x & 7);
    });
  });
  return out;
}
const TABLAS = {};
for (const [cat, estilos] of Object.entries(CATEGORIAS)) {
  TABLAS[cat] = estilos.map((e, i) => {
    const [ancho, fila0] = MARCO[cat][i];
    return { nombre: e.nombre, ancho, variantes: VARIANTES[cat].map((v) => empaquetar(e.dibujos[v], ancho, fila0)) };
  });
}

// Agujas: 60 posiciones, seno y coseno por 1000 en enteros (nada de trigonometría en la TV ni en la app).
const AGUJAS = Array.from({ length: 60 }, (_, m) => [Math.round(1000 * Math.sin((2 * Math.PI * m) / 60)), Math.round(-1000 * Math.cos((2 * Math.PI * m) / 60))]);
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// La tabla de tildes de la fuente clásica: se lee de js/fonts.js (la misma que texto.cpp), no se copia a mano.
const textoFonts = fs.readFileSync(path.join(aqui, '..', '..', '..', 'js', 'fonts.js'), 'utf8');
const LATIN1_A_CP437 = (textoFonts.match(/const LATIN1_A_CP437 = new Uint8Array\(\[([\s\S]*?)\]\)/) || [])[1].split(',').map((x) => parseInt(x.trim(), 16)).filter((x) => !Number.isNaN(x));
if (LATIN1_A_CP437.length !== 128) throw new Error('no se pudo leer LATIN1_A_CP437 de js/fonts.js');

const ORDEN = Object.keys(CATEGORIAS);
const aviso = 'GENERADO por app-unificada/herramientas/iconos-reloj/generar.mjs: no editar a mano.';
// ---- JS ----
let js = `// ${aviso}\n// Tablas del dibujante de caras de reloj (src/cara.js). Las TV tienen las mismas en iconos_cara.h.\n`;
js += `export const BYTES_FILA = ${BYTES_FILA};\nexport const FILAS_ICONO = ${FILAS};\n`;
js += `export const ICONOS = {\n${ORDEN.map((c) => `  ${c}: [\n${TABLAS[c].map((e) => `    { ancho: ${e.ancho}, variantes: [${e.variantes.map((v) => `[${Array.from(v).join(',')}]`).join(', ')}] }, // ${e.nombre}`).join('\n')}\n  ],`).join('\n')}\n};\n`;
js += `export const VARIANTES = ${JSON.stringify(VARIANTES)};\n`;
js += `export const AGUJAS = ${JSON.stringify(AGUJAS)};\n`;
js += `export const DIAS = ${JSON.stringify(DIAS)};\nexport const DIAS_CORTOS = ${JSON.stringify(DIAS_CORTOS)};\nexport const MESES_CORTOS = ${JSON.stringify(MESES_CORTOS)};\n`;
js += `export const LATIN1_A_CP437 = [${LATIN1_A_CP437.join(',')}];\n`;
fs.writeFileSync(path.join(aqui, '..', '..', 'src', 'cara-datos.js'), js);

// ---- C ----
const cTexto = (s) => '"' + [...Buffer.from(s, 'utf8')].map((b) => (b < 0x80 ? String.fromCharCode(b) : '\\' + b.toString(8).padStart(3, '0'))).join('') + '"';
let h = `// ${aviso}\n// Tablas del dibujante de caras de reloj (cara.cpp). Copia EXACTA en OLED_Remota/ y OLED_Lite/ (comprobar-copias-lite.cjs).\n`;
h += `// La app tiene las mismas en app-unificada/src/cara-datos.js. Ver docs/receta-r1.md (panel), sección 3b.\n#ifndef ICONOS_CARA_H\n#define ICONOS_CARA_H\n\n#include <Arduino.h>\n\n`;
h += `#define CARA_FILAS_ICONO ${FILAS}\n#define CARA_BYTES_FILA ${BYTES_FILA}\n#define CARA_MAX_ESTILOS ${MAX_ESTILOS}\n#define CARA_MAX_VARIANTES ${MAX_VARIANTES}\n\n`;
h += `enum CategoriaIcono : uint8_t { ${ORDEN.map((c, i) => `ICONO_${c.toUpperCase()} = ${i}`).join(', ')}, ICONO_CATEGORIAS = ${ORDEN.length} };\n\n`;
h += `// Variantes, en orden: ${ORDEN.map((c) => `${c} = ${VARIANTES[c].join('/')}`).join('; ')}\n`;
h += `static const uint8_t CARA_ESTILOS[ICONO_CATEGORIAS] = { ${ORDEN.map((c) => TABLAS[c].length).join(', ')} };\n`;
h += `static const uint8_t CARA_ANCHO_ICONO[ICONO_CATEGORIAS][CARA_MAX_ESTILOS] = {\n${ORDEN.map((c) => `    { ${Array.from({ length: MAX_ESTILOS }, (_, i) => (TABLAS[c][i] ? TABLAS[c][i].ancho : 0)).join(', ')} }, // ${c}`).join('\n')}\n};\n`;
h += `static const uint8_t CARA_ICONOS[ICONO_CATEGORIAS][CARA_MAX_ESTILOS][CARA_MAX_VARIANTES][CARA_FILAS_ICONO * CARA_BYTES_FILA] = {\n`;
h += ORDEN.map((c) => `    { // ${c}\n${Array.from({ length: MAX_ESTILOS }, (_, i) => {
  const e = TABLAS[c][i];
  const vs = Array.from({ length: MAX_VARIANTES }, (_, k) => (e && e.variantes[k] ? `{ ${Array.from(e.variantes[k]).join(', ')} }` : '{ 0 }'));
  return `        { // ${e ? e.nombre : '(sin estilo)'}\n${vs.map((v) => `            ${v},`).join('\n')}\n        },`;
}).join('\n')}\n    },`).join('\n') + '\n};\n\n';
h += `// Agujas: seno y coseno por 1000 de cada minuto (0 = las 12, en sentido del reloj).\nstatic const int16_t CARA_AGUJAS[60][2] = {\n${AGUJAS.map((a) => `    { ${a[0]}, ${a[1]} },`).join('\n')}\n};\n\n`;
h += `// Textos en UTF-8 (se convierten como los del Texto: UTF-8 -> Latin-1 -> CP437 en la clásica).\n`;
h += `static const char *const CARA_DIAS[7] = { ${DIAS.map(cTexto).join(', ')} };\n`;
h += `static const char *const CARA_DIAS_CORTOS[7] = { ${DIAS_CORTOS.map(cTexto).join(', ')} };\n`;
h += `static const char *const CARA_MESES_CORTOS[12] = { ${MESES_CORTOS.map(cTexto).join(', ')} };\n\n`;
h += `// Latin-1 (0x80..0xFF) -> posición en la fuente clásica (la misma tabla que texto.cpp y js/fonts.js).\nstatic const uint8_t CARA_LATIN1_A_CP437[128] = { ${LATIN1_A_CP437.map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ')} };\n\n#endif\n`;
const firmware = 'C:/Proyectos/TV_RETRO-firmware';
for (const carpeta of ['OLED_Remota', 'OLED_Lite']) fs.writeFileSync(path.join(firmware, carpeta, 'iconos_cara.h'), h.replace(/\n/g, '\r\n'));
console.log('tablas: src/cara-datos.js e iconos_cara.h (Pro y Lite)');
