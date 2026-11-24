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
function barras(nivel) { // el de hoy (pantalla.cpp, dibujarIconoSenal)
  const m = nuevo(15, 9);
  if (nivel === 0) { linea(m, 0, 0, 8, 8); linea(m, 0, 8, 8, 0); return m; }
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
const variantesWifi = (f) => ({ n4: f(4), n3: f(3), n2: f(2), n1: f(1), sin: f(0) });

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
