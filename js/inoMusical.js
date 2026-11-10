/**inoMusical
 * Ejecuta un .ino de canción (los que genera el simulador de CancionesMiniTV
 * para el ESP8266) con una pantalla SSD1306 y un buzzer VIRTUALES, y graba lo
 * que pasa: cada nota (cuándo y qué frecuencia) y cada imagen que se manda a
 * la pantalla (cuándo y los 128×64 puntos exactos).
 *
 * Esa grabación es lo que reproduce la TV: así suena y se ve igual que si se
 * le grabara el .ino, sin importar la versión del simulador que lo generó
 * (intros con pausa, letra con fuentes propias, GIF, finales que repiten o
 * que se quedan en la última imagen...).
 *
 * Es un intérprete de la parte de C que usan esas canciones: structs,
 * arreglos (también PROGMEM), punteros, cadenas, funciones, if/for/while,
 * operadores de C con enteros, y la parte de Adafruit_GFX / SSD1306 que usan
 * (texto con la fuente clásica o con GFXfont, drawBitmap, fillRect...).
 * El tiempo es virtual: delay() y millis() no esperan de verdad.
 *
 * Uso: grabarIno(textoDelIno) -> { notas, cuadros, duracion, repetir }
 *   notas:   [{ t, f }]  f = Hz desde el instante t (0 = silencio)
 *   cuadros: [{ t, bitmap }]  bitmap = Uint8Array(1024), 1 bit por punto,
 *            filas de 16 bytes, MSB a la izquierda (mismo formato que imagen.datos)
 *   duracion: ms de una vuelta (incluye la pausa final antes de repetir)
 *   repetir: true si el .ino vuelve a empezar solo; false si toca una vez y
 *            se queda en la última imagen
 */

import { TABLA_FUENTE } from './fonts.js';

const ANCHO = 128;
const ALTO = 64;

// Cuánto tiempo virtual se espera sin notas ni cambios de pantalla antes de
// dar por terminada la canción (ej. "while (true) delay(1000);").
const ESPERA_QUIETO_MS = 15000;
// Tope de seguridad: una canción no dura más que esto.
const DURACION_MAXIMA_MS = 30 * 60 * 1000;
// Tope de pasos del intérprete (evita colgar la página con un .ino raro).
const PASOS_MAXIMOS = 400_000_000;

class ErrorIno extends Error {}
class Parar { constructor(motivo) { this.motivo = motivo; } }
class Retorno { constructor(valor) { this.valor = valor; } }
const ROMPER = { romper: true };
const SEGUIR = { seguir: true };

// ===================================================================
// Léxico
// ===================================================================

function quitarComentarios(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const cierre = c;
      out += c; i++;
      while (i < n && src[i] !== cierre) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i++];
      }
      out += src[i] || ''; i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    out += c; i++;
  }
  return out;
}

// Bytes de una cadena de C: el texto del archivo está en UTF-8 (como lo
// compila el IDE de Arduino) y se respetan los escapes \n \t \\ \" \xNN \NNN.
function bytesDeCadena(cuerpo) {
  const bytes = [];
  const enc = new TextEncoder();
  let i = 0;
  while (i < cuerpo.length) {
    const c = cuerpo[i];
    if (c !== '\\') {
      const cp = cuerpo.codePointAt(i);
      const ch = String.fromCodePoint(cp);
      for (const b of enc.encode(ch)) bytes.push(b);
      i += ch.length;
      continue;
    }
    const s = cuerpo[i + 1];
    i += 2;
    if (s === 'n') bytes.push(10);
    else if (s === 't') bytes.push(9);
    else if (s === 'r') bytes.push(13);
    else if (s === '0' || (s >= '1' && s <= '7')) {
      let oct = s;
      while (oct.length < 3 && /[0-7]/.test(cuerpo[i] || '')) oct += cuerpo[i++];
      bytes.push(parseInt(oct, 8) & 0xFF);
    } else if (s === 'x') {
      let hex = '';
      while (/[0-9a-fA-F]/.test(cuerpo[i] || '')) hex += cuerpo[i++];
      bytes.push(parseInt(hex || '0', 16) & 0xFF);
    } else if (s === 'a') bytes.push(7);
    else if (s === 'b') bytes.push(8);
    else if (s === 'f') bytes.push(12);
    else if (s === 'v') bytes.push(11);
    else if (s !== undefined) bytes.push(s.charCodeAt(0) & 0xFF);
  }
  return bytes;
}

const OPERADORES = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::'];

function tokenizar(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '#') { // directiva: hasta fin de línea (con continuación \)
      let linea = '';
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\' && src[i + 1] === '\n') { i += 2; continue; }
        linea += src[i++];
      }
      toks.push({ t: 'dir', v: linea });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      let esFlot = false;
      if (c === '0' && /[xX]/.test(src[i + 1])) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
      } else {
        while (j < n && /[0-9.eE]/.test(src[j])) {
          if (/[.eE]/.test(src[j])) esFlot = true;
          if (/[eE]/.test(src[j]) && /[+-]/.test(src[j + 1])) j++;
          j++;
        }
      }
      const texto = src.slice(i, j);
      while (j < n && /[uUlLfF]/.test(src[j])) { if (/[fF]/.test(src[j])) esFlot = true; j++; }
      let v;
      if (/^0[xX]/.test(texto)) v = parseInt(texto, 16);
      else if (!esFlot && /^0[0-7]+$/.test(texto)) v = parseInt(texto, 8);
      else v = Number(texto);
      toks.push({ t: 'num', v, flot: esFlot });
      i = j;
      continue;
    }
    if (c === '"') {
      let j = i + 1, cuerpo = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') { cuerpo += src[j] + src[j + 1]; j += 2; continue; }
        cuerpo += src[j++];
      }
      toks.push({ t: 'str', v: bytesDeCadena(cuerpo) });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1, cuerpo = '';
      while (j < n && src[j] !== "'") {
        if (src[j] === '\\') { cuerpo += src[j] + src[j + 1]; j += 2; continue; }
        cuerpo += src[j++];
      }
      const b = bytesDeCadena(cuerpo);
      toks.push({ t: 'num', v: b.length ? b[0] : 0, flot: false });
      i = j + 1;
      continue;
    }
    const op = OPERADORES.find(o => src.startsWith(o, i));
    if (op) { toks.push({ t: 'op', v: op }); i += op.length; continue; }
    toks.push({ t: 'op', v: c });
    i++;
  }
  return toks;
}

// #define NOMBRE valor (solo macros sin parámetros): se reemplazan en los tokens.
function aplicarDefines(toks) {
  const macros = new Map();
  const salida = [];
  for (const tk of toks) {
    if (tk.t === 'dir') {
      const m = tk.v.match(/^#\s*define\s+([A-Za-z_]\w*)(?!\()\s*(.*)$/);
      if (m) macros.set(m[1], aplicarDefines(tokenizar(m[2])));
      continue; // #include, #ifdef... se ignoran
    }
    if (tk.t === 'id' && macros.has(tk.v)) { salida.push(...macros.get(tk.v)); continue; }
    salida.push(tk);
  }
  return salida;
}

// ===================================================================
// Tipos
// ===================================================================

const TIPOS_BASE = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned',
  'bool', 'boolean', 'byte', 'word', 'size_t', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t',
  'uint64_t', 'int64_t', 'GFXfont', 'GFXglyph', 'String', 'Adafruit_SSD1306']);
const CALIFICADORES = new Set(['const', 'static', 'volatile', 'PROGMEM', 'inline', 'extern', 'register', 'constexpr']);

// Convierte un valor al tipo entero de C (con desborde como en C).
function ajustarEntero(v, tipo) {
  if (typeof v !== 'number') return v;
  if (!tipo || tipo.ptr || tipo.flot) return v;
  if (!Number.isFinite(v)) return v;
  v = Math.trunc(v);
  switch (tipo.bits) {
    case 1: return v ? 1 : 0;
    case 8: return tipo.sin ? (v & 0xFF) : ((v << 24) >> 24);
    case 16: return tipo.sin ? (v & 0xFFFF) : ((v << 16) >> 16);
    case 32: return tipo.sin ? (v >>> 0) : (v | 0);
    default: return v;
  }
}

function tipoDesdeNombres(nombres, estructuras) {
  const t = { bits: 32, sin: false, flot: false, ptr: 0, struct: null };
  const ns = nombres.filter(x => !CALIFICADORES.has(x));
  const tiene = (x) => ns.includes(x);
  if (tiene('unsigned')) t.sin = true;
  if (tiene('float') || tiene('double')) { t.flot = true; t.bits = 64; }
  else if (tiene('char') || tiene('uint8_t') || tiene('int8_t') || tiene('byte')) { t.bits = 8; if (tiene('uint8_t') || tiene('byte')) t.sin = true; if (tiene('char') && !tiene('signed')) t.sin = true; }
  else if (tiene('short') || tiene('uint16_t') || tiene('int16_t') || tiene('word')) { t.bits = 16; if (tiene('uint16_t') || tiene('word')) t.sin = true; }
  else if (tiene('bool') || tiene('boolean')) { t.bits = 1; t.sin = true; }
  else if (tiene('uint32_t') || tiene('size_t')) { t.bits = 32; t.sin = true; }
  else if (tiene('uint64_t') || tiene('int64_t')) { t.bits = 64; t.sin = tiene('uint64_t'); }
  const st = ns.find(x => estructuras.has(x));
  if (st) t.struct = st;
  if (tiene('void')) t.vacio = true;
  return t;
}

// Tamaño en bytes (solo para sizeof(arreglo) / sizeof(arreglo[0])).
function tamanoDe(v) {
  if (Array.isArray(v)) return v.length * (v.length ? tamanoDe(v[0]) : 4);
  if (v && v.__struct) return Object.keys(v).filter(k => k !== '__struct').reduce((s, k) => s + tamanoDe(v[k]), 0);
  return 4;
}

// ===================================================================
// Punteros y referencias
// ===================================================================

class Puntero {
  constructor(arr, idx = 0) { this.arr = arr; this.idx = idx; }
  leer(k = 0) { return this.arr[this.idx + k]; }
  escribir(k, v) { this.arr[this.idx + k] = v; }
  mas(k) { return new Puntero(this.arr, this.idx + k); }
}
class RefCampo { // &obj.campo
  constructor(obj, clave) { this.obj = obj; this.clave = clave; }
  leer(k = 0) { if (k) throw new ErrorIno('puntero a campo con índice'); return this.obj[this.clave]; }
  escribir(k, v) { this.obj[this.clave] = v; }
  mas() { throw new ErrorIno('aritmética sobre puntero a campo'); }
}
const esPuntero = (v) => v instanceof Puntero || v instanceof RefCampo;
const aValor = (v) => (Array.isArray(v) ? new Puntero(v, 0) : v); // un arreglo usado como valor es un puntero

function verdadero(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  return true; // punteros, objetos
}

// ===================================================================
// Pantalla virtual (Adafruit_GFX + SSD1306)
// ===================================================================

class PantallaVirtual {
  constructor(alGrabar) {
    this.buf = new Uint8Array(ANCHO * ALTO);
    this.cursorX = 0; this.cursorY = 0;
    this.tamX = 1; this.tamY = 1;
    this.color = 1; this.fondo = 1;
    this.ajuste = true; // Adafruit_GFX arranca con wrap = true
    this.cp437 = false;
    this.fuente = null; // GFXfont (objeto) o null = clásica
    this.invertida = false;
    this.alGrabar = alGrabar;
  }
  punto(x, y, c) {
    if (x < 0 || y < 0 || x >= ANCHO || y >= ALTO) return;
    const i = y * ANCHO + x;
    if (c === 2) this.buf[i] ^= 1;
    else this.buf[i] = c ? 1 : 0;
  }
  rectangulo(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.punto(xx, yy, c);
  }
  bitmap(x, y, p, w, h, c, bg) {
    const anchoBytes = (w + 7) >> 3;
    let b = 0;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (i & 7) b = (b << 1) & 0xFF; else b = p.leer(j * anchoBytes + (i >> 3)) & 0xFF;
        if (b & 0x80) this.punto(x + i, y + j, c);
        else if (bg !== undefined) this.punto(x + i, y + j, bg);
      }
    }
  }
  caracter(x, y, c, color, bg, sx, sy) {
    if (!this.fuente) {
      if (x >= ANCHO || y >= ALTO || x + 6 * sx - 1 < 0 || y + 8 * sy - 1 < 0) return;
      if (!this.cp437 && c >= 176) c++;
      c &= 0xFF;
      for (let i = 0; i < 5; i++) {
        let linea = TABLA_FUENTE[c * 5 + i] || 0;
        for (let j = 0; j < 8; j++, linea >>= 1) {
          if (linea & 1) {
            if (sx === 1 && sy === 1) this.punto(x + i, y + j, color);
            else this.rectangulo(x + i * sx, y + j * sy, sx, sy, color);
          } else if (bg !== color) {
            if (sx === 1 && sy === 1) this.punto(x + i, y + j, bg);
            else this.rectangulo(x + i * sx, y + j * sy, sx, sy, bg);
          }
        }
      }
      if (bg !== color) {
        if (sx === 1 && sy === 1) this.rectangulo(x + 5, y, 1, 8, bg);
        else this.rectangulo(x + 5 * sx, y, sx, 8 * sy, bg);
      }
      return;
    }
    const f = this.fuente;
    const g = f.glyph.leer(c - f.first);
    const bmp = f.bitmap;
    let bo = g.bitmapOffset;
    const w = g.width, h = g.height, xo = g.xOffset, yo = g.yOffset;
    let bits = 0, bit = 0;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (!(bit++ & 7)) bits = bmp.leer(bo++) & 0xFF;
        if (bits & 0x80) {
          if (sx === 1 && sy === 1) this.punto(x + xo + xx, y + yo + yy, color);
          else this.rectangulo(x + (xo + xx) * sx, y + (yo + yy) * sy, sx, sy, color);
        }
        bits = (bits << 1) & 0xFF;
      }
    }
  }
  escribir(c) {
    c &= 0xFF;
    if (!this.fuente) {
      if (c === 10) { this.cursorX = 0; this.cursorY += this.tamY * 8; }
      else if (c !== 13) {
        if (this.ajuste && this.cursorX + this.tamX * 6 > ANCHO) { this.cursorX = 0; this.cursorY += this.tamY * 8; }
        this.caracter(this.cursorX, this.cursorY, c, this.color, this.fondo, this.tamX, this.tamY);
        this.cursorX += this.tamX * 6;
      }
      return;
    }
    const f = this.fuente;
    if (c === 10) { this.cursorX = 0; this.cursorY += this.tamY * f.yAdvance; return; }
    if (c === 13) return;
    if (c >= f.first && c <= f.last) {
      const g = f.glyph.leer(c - f.first);
      if (g.width > 0 && g.height > 0) {
        if (this.ajuste && this.cursorX + this.tamX * (g.xOffset + g.width) > ANCHO) {
          this.cursorX = 0; this.cursorY += this.tamY * f.yAdvance;
        }
        this.caracter(this.cursorX, this.cursorY, c, this.color, this.fondo, this.tamX, this.tamY);
      }
      this.cursorX += g.xAdvance * this.tamX;
    }
  }
  imprimir(v, conSalto) {
    if (esPuntero(v)) {
      for (let k = 0; ; k++) { const b = v.leer(k); if (!b) break; this.escribir(b); }
    } else if (typeof v === 'number') {
      for (const ch of String(Number.isInteger(v) ? v : v.toFixed(2))) this.escribir(ch.charCodeAt(0));
    }
    if (conSalto) { this.escribir(13); this.escribir(10); }
  }
  // Lo que se ve en la OLED ahora: 1 bit por punto, filas de 16 bytes, MSB a la izquierda.
  foto() {
    const out = new Uint8Array(ANCHO * ALTO / 8);
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        let v = this.buf[y * ANCHO + x];
        if (this.invertida) v ^= 1;
        if (v) out[y * 16 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    return out;
  }
  metodo(nombre, args) {
    const n = (i, d = 0) => (args[i] === undefined ? d : Number(args[i]));
    switch (nombre) {
      case 'begin': return 1;
      case 'clearDisplay': this.buf.fill(0); return;
      case 'display': this.alGrabar(); return;
      case 'invertDisplay': this.invertida = !!n(0); this.alGrabar(); return;
      case 'drawPixel': this.punto(n(0), n(1), n(2)); return;
      case 'fillRect': this.rectangulo(n(0), n(1), n(2), n(3), n(4)); return;
      case 'fillScreen': this.buf.fill(n(0) ? 1 : 0); return;
      case 'drawRect': {
        const [x, y, w, h, c] = [n(0), n(1), n(2), n(3), n(4)];
        this.rectangulo(x, y, w, 1, c); this.rectangulo(x, y + h - 1, w, 1, c);
        this.rectangulo(x, y, 1, h, c); this.rectangulo(x + w - 1, y, 1, h, c);
        return;
      }
      case 'drawFastHLine': this.rectangulo(n(0), n(1), n(2), 1, n(3)); return;
      case 'drawFastVLine': this.rectangulo(n(0), n(1), 1, n(2), n(3)); return;
      case 'drawLine': this.linea(n(0), n(1), n(2), n(3), n(4)); return;
      case 'drawBitmap': this.bitmap(n(0), n(1), aValor(args[2]), n(3), n(4), n(5), args.length > 6 ? n(6) : undefined); return;
      case 'setTextSize': this.tamX = Math.max(1, n(0)); this.tamY = Math.max(1, args.length > 1 ? n(1) : n(0)); return;
      case 'setTextColor': this.color = n(0); this.fondo = args.length > 1 ? n(1) : n(0); return;
      case 'setCursor': this.cursorX = n(0); this.cursorY = n(1); return;
      case 'setTextWrap': this.ajuste = !!n(0); return;
      case 'cp437': this.cp437 = args.length ? !!n(0) : true; return;
      case 'setFont': {
        const p = args[0];
        const f = p && esPuntero(p) ? p.leer() : (p && p.__struct ? p : null);
        if (f && !this.fuente) this.cursorY += 6;       // como Adafruit_GFX::setFont
        else if (!f && this.fuente) this.cursorY -= 6;
        this.fuente = f || null;
        return;
      }
      case 'write': {
        if (esPuntero(args[0])) this.imprimir(args[0], false);
        else this.escribir(n(0));
        return 1;
      }
      case 'print': this.imprimir(args[0], false); return;
      case 'println': this.imprimir(args[0], true); return;
      case 'getCursorX': return this.cursorX;
      case 'getCursorY': return this.cursorY;
      case 'width': return ANCHO;
      case 'height': return ALTO;
      case 'ssd1306_command': case 'dim': case 'startscrollright': case 'stopscroll':
        return;
      default:
        throw new ErrorIno(`display.${nombre}() no está soportado`);
    }
  }
  linea(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.punto(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

// ===================================================================
// Parser: tokens -> árbol
// ===================================================================

class Parser {
  constructor(toks) {
    this.toks = toks; this.i = 0;
    // Structs que trae Adafruit_GFX.
    this.estructuras = new Map([
      ['GFXglyph', ['bitmapOffset', 'width', 'height', 'xAdvance', 'xOffset', 'yOffset']],
      ['GFXfont', ['bitmap', 'glyph', 'first', 'last', 'yAdvance']]
    ]);
    this.camposTipo = new Map(); // struct -> [{nombre, dims}]
  }
  ver(k = 0) { return this.toks[this.i + k]; }
  es(v, k = 0) { const t = this.ver(k); return t && (t.t === 'op' || t.t === 'id') && t.v === v; }
  tomar(v) {
    const t = this.toks[this.i];
    if (v !== undefined && !(t && t.v === v)) throw new ErrorIno(`se esperaba "${v}" y vino "${t ? (t.t === 'str' ? 'cadena' : t.v) : 'fin'}"`);
    this.i++;
    return t;
  }
  id() { const t = this.tomar(); if (t.t !== 'id') throw new ErrorIno(`se esperaba un nombre y vino "${t.v}"`); return t.v; }

  esNombreTipo(t) {
    return t && t.t === 'id' && (TIPOS_BASE.has(t.v) || CALIFICADORES.has(t.v) || this.estructuras.has(t.v) || t.v === 'struct');
  }

  // Lee "const unsigned long", "const uint8_t* const*", "Escena&"... -> {nombres, ptr, ref}
  tipo() {
    const nombres = [];
    while (this.esNombreTipo(this.ver())) {
      const v = this.tomar().v;
      if (v === 'struct') continue;
      nombres.push(v);
    }
    let ptr = 0, ref = false;
    for (;;) {
      if (this.es('*')) { this.tomar(); ptr++; continue; }
      if (this.es('&')) { this.tomar(); ref = true; continue; }
      if (this.ver() && this.ver().t === 'id' && CALIFICADORES.has(this.ver().v)) { this.tomar(); continue; }
      break;
    }
    const t = tipoDesdeNombres(nombres, this.estructuras);
    t.ptr = ptr; t.ref = ref;
    return t;
  }

  programa() {
    const decl = [];
    while (this.i < this.toks.length) {
      if (this.es(';')) { this.tomar(); continue; }
      if (this.es('struct') && this.ver(1).t === 'id' && this.es('{', 2)) { this.structDef(); continue; }
      if (this.es('typedef')) { while (!this.es(';')) this.tomar(); this.tomar(); continue; }
      const tipo = this.tipo();
      if (tipo.ptr === 0 && !this.ver()) break;
      const nombre = this.id();
      if (this.es('(')) {
        // ¿función o "Adafruit_SSD1306 display(...)"?
        const j = this.i;
        const params = this.intentarParametros();
        if (params && this.es('{')) { decl.push({ k: 'func', nombre, tipo, params, cuerpo: this.bloque() }); continue; }
        if (params && this.es(';')) { this.tomar(); continue; } // prototipo
        this.i = j;
        this.tomar('(');
        const args = this.argumentos();
        decl.push({ k: 'obj', nombre, tipo, args });
        this.tomar(';');
        continue;
      }
      decl.push(...this.declaradores(tipo, nombre, true));
    }
    return decl;
  }

  structDef() {
    this.tomar('struct');
    const nombre = this.id();
    this.tomar('{');
    const campos = [];
    this.estructuras.set(nombre, campos);
    const info = [];
    while (!this.es('}')) {
      const tipo = this.tipo();
      for (;;) {
        let p = 0;
        while (this.es('*')) { this.tomar(); p++; }
        const cn = this.id();
        const dims = [];
        while (this.es('[')) { this.tomar('['); dims.push(this.expresion()); this.tomar(']'); }
        campos.push(cn);
        info.push({ nombre: cn, tipo: { ...tipo, ptr: tipo.ptr + p }, dims });
        if (this.es(',')) { this.tomar(','); continue; }
        break;
      }
      this.tomar(';');
    }
    this.tomar('}');
    this.tomar(';');
    this.camposTipo.set(nombre, info);
  }

  intentarParametros() {
    const j = this.i;
    try {
      this.tomar('(');
      const params = [];
      if (this.es('void') && this.es(')', 1)) { this.tomar(); }
      while (!this.es(')')) {
        if (!this.esNombreTipo(this.ver())) { this.i = j; return null; }
        const tipo = this.tipo();
        const nombre = this.ver() && this.ver().t === 'id' ? this.id() : '';
        const dims = [];
        while (this.es('[')) { this.tomar('['); if (!this.es(']')) this.expresion(); this.tomar(']'); dims.push(null); }
        if (dims.length) tipo.ptr++;
        params.push({ nombre, tipo });
        if (this.es(',')) this.tomar(',');
      }
      this.tomar(')');
      return params;
    } catch (e) {
      this.i = j;
      return null;
    }
  }

  // nombre ya leído: [dims] [= init] {, otro} ;
  declaradores(tipo, primero, global) {
    const out = [];
    let nombre = primero;
    let tipoActual = tipo;
    for (;;) {
      const dims = [];
      while (this.es('[')) { this.tomar('['); dims.push(this.es(']') ? null : this.expresion()); this.tomar(']'); }
      while (this.ver() && this.ver().t === 'id' && CALIFICADORES.has(this.ver().v)) this.tomar();
      let init = null;
      if (this.es('=')) { this.tomar('='); init = this.es('{') ? this.listaInit() : this.asignacion(); }
      out.push({ k: 'var', nombre, tipo: tipoActual, dims, init, global });
      if (this.es(',')) {
        this.tomar(',');
        let p = 0;
        while (this.es('*')) { this.tomar(); p++; }
        tipoActual = { ...tipo, ptr: tipo.ptr - (tipo.ptrDecl || 0) + p };
        nombre = this.id();
        continue;
      }
      break;
    }
    this.tomar(';');
    return out;
  }

  listaInit() {
    this.tomar('{');
    const elems = [];
    while (!this.es('}')) {
      elems.push(this.es('{') ? this.listaInit() : this.asignacion());
      if (this.es(',')) this.tomar(',');
    }
    this.tomar('}');
    return { k: 'lista', elems };
  }

  bloque() {
    this.tomar('{');
    const s = [];
    while (!this.es('}')) s.push(this.sentencia());
    this.tomar('}');
    return { k: 'bloque', s };
  }

  sentencia() {
    const t = this.ver();
    if (this.es('{')) return this.bloque();
    if (this.es(';')) { this.tomar(); return { k: 'nada' }; }
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': {
          this.tomar(); this.tomar('('); const c = this.expresionComa(); this.tomar(')');
          const si = this.sentencia();
          let no = null;
          if (this.es('else')) { this.tomar(); no = this.sentencia(); }
          return { k: 'if', c, si, no };
        }
        case 'while': {
          this.tomar(); this.tomar('('); const c = this.expresionComa(); this.tomar(')');
          return { k: 'while', c, cuerpo: this.sentencia() };
        }
        case 'do': {
          this.tomar(); const cuerpo = this.sentencia(); this.tomar('while'); this.tomar('(');
          const c = this.expresionComa(); this.tomar(')'); this.tomar(';');
          return { k: 'do', c, cuerpo };
        }
        case 'for': {
          this.tomar(); this.tomar('(');
          let ini = null;
          if (!this.es(';')) {
            if (this.esNombreTipo(this.ver())) { const tp = this.tipo(); ini = { k: 'decl', vars: this.declaradores(tp, this.id(), false) }; }
            else { ini = { k: 'expr', e: this.expresionComa() }; this.tomar(';'); }
          } else this.tomar(';');
          const c = this.es(';') ? null : this.expresionComa();
          this.tomar(';');
          const paso = this.es(')') ? null : this.expresionComa();
          this.tomar(')');
          return { k: 'for', ini, c, paso, cuerpo: this.sentencia() };
        }
        case 'return': {
          this.tomar();
          const e = this.es(';') ? null : this.expresionComa();
          this.tomar(';');
          return { k: 'return', e };
        }
        case 'break': this.tomar(); this.tomar(';'); return { k: 'break' };
        case 'continue': this.tomar(); this.tomar(';'); return { k: 'continue' };
        default:
          if (this.esNombreTipo(t) && !(this.ver(1) && this.ver(1).v === '(' && !CALIFICADORES.has(t.v) && !TIPOS_BASE.has(t.v))) {
            const tp = this.tipo();
            return { k: 'decl', vars: this.declaradores(tp, this.id(), false) };
          }
      }
    }
    const e = this.expresionComa();
    this.tomar(';');
    return { k: 'expr', e };
  }

  // ---- expresiones (precedencia de C) ----
  expresionComa() {
    let e = this.asignacion();
    while (this.es(',')) { this.tomar(); e = { k: 'coma', a: e, b: this.asignacion() }; }
    return e;
  }
  expresion() { return this.condicional(); }
  asignacion() {
    const izq = this.condicional();
    const t = this.ver();
    if (t && t.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(t.v)) {
      this.tomar();
      return { k: 'asig', op: t.v, izq, der: this.asignacion() };
    }
    return izq;
  }
  condicional() {
    const c = this.binario(0);
    if (this.es('?')) {
      this.tomar(); const a = this.expresionComa(); this.tomar(':'); const b = this.condicional();
      return { k: 'tern', c, a, b };
    }
    return c;
  }
  binario(nivel) {
    const NIVELES = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    if (nivel >= NIVELES.length) return this.unario();
    let e = this.binario(nivel + 1);
    for (;;) {
      const t = this.ver();
      if (t && t.t === 'op' && NIVELES[nivel].includes(t.v)) {
        this.tomar();
        e = { k: 'bin', op: t.v, a: e, b: this.binario(nivel + 1) };
      } else return e;
    }
  }
  unario() {
    const t = this.ver();
    if (t.t === 'op') {
      if (['!', '~', '-', '+', '*', '&'].includes(t.v)) { this.tomar(); return { k: 'un', op: t.v, a: this.unario() }; }
      if (t.v === '++' || t.v === '--') { this.tomar(); return { k: 'pre', op: t.v, a: this.unario() }; }
      if (t.v === '(' && this.esNombreTipo(this.ver(1))) {
        // (tipo) expr
        const j = this.i;
        this.tomar('(');
        const tipo = this.tipo();
        if (this.es(')')) { this.tomar(')'); return { k: 'cast', tipo, a: this.unario() }; }
        this.i = j;
      }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      this.tomar();
      if (this.es('(') && this.esNombreTipo(this.ver(1))) { this.tomar('('); const tipo = this.tipo(); this.tomar(')'); return { k: 'sizeofT', tipo }; }
      return { k: 'sizeof', a: this.unario() };
    }
    return this.postfijo();
  }
  postfijo() {
    let e = this.primario();
    for (;;) {
      if (this.es('[')) { this.tomar(); const i = this.expresionComa(); this.tomar(']'); e = { k: 'idx', a: e, i }; continue; }
      if (this.es('(')) { this.tomar(); const args = this.argumentos(); e = { k: 'call', f: e, args }; continue; }
      if (this.es('.')) { this.tomar(); e = { k: 'campo', a: e, c: this.id() }; continue; }
      if (this.es('->')) { this.tomar(); e = { k: 'flecha', a: e, c: this.id() }; continue; }
      if (this.es('++') || this.es('--')) { e = { k: 'post', op: this.tomar().v, a: e }; continue; }
      return e;
    }
  }
  argumentos() {
    const args = [];
    while (!this.es(')')) {
      args.push(this.asignacion());
      if (this.es(',')) this.tomar(',');
    }
    this.tomar(')');
    return args;
  }
  primario() {
    const t = this.tomar();
    if (t.t === 'num') return { k: 'num', v: t.v, flot: t.flot };
    if (t.t === 'str') {
      // cadenas seguidas se juntan ("a" "b")
      let bytes = t.v.slice();
      while (this.ver() && this.ver().t === 'str') bytes = bytes.concat(this.tomar().v);
      return { k: 'str', v: bytes };
    }
    if (t.t === 'id') {
      if (this.es('::')) { this.tomar(); return { k: 'id', v: t.v + '::' + this.id() }; }
      return { k: 'id', v: t.v };
    }
    if (t.v === '(') { const e = this.expresionComa(); this.tomar(')'); return e; }
    throw new ErrorIno(`símbolo inesperado "${t.v}"`);
  }
}

// ===================================================================
// Intérprete
// ===================================================================

class Ambito {
  constructor(padre) { this.vars = new Map(); this.padre = padre; }
  buscar(n) {
    for (let a = this; a; a = a.padre) if (a.vars.has(n)) return a.vars.get(n);
    return null;
  }
}

const CONSTANTES = {
  WHITE: 1, BLACK: 0, INVERSE: 2, SSD1306_WHITE: 1, SSD1306_BLACK: 0, SSD1306_INVERSE: 2,
  SSD1306_SWITCHCAPVCC: 2, SSD1306_EXTERNALVCC: 1, SSD1306_SETDISPLAYCLOCKDIV: 0xD5,
  SSD1306_DISPLAYOFF: 0xAE, SSD1306_DISPLAYON: 0xAF, SSD1306_SETCONTRAST: 0x81,
  HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, LED_BUILTIN: 2,
  NULL: 0, nullptr: 0, true: 1, false: 0,
  D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15
};

class Interprete {
  constructor(decl, estructuras, camposTipo) {
    this.estructuras = estructuras;
    this.camposTipo = camposTipo;
    this.funciones = new Map();
    this.global = new Ambito(null);
    this.ahora = 0;
    this.pasos = 0;
    this.notas = [];
    this.cuadros = [];
    this.ultimoEvento = 0;
    this.alEvento = null;
    this.pantalla = new PantallaVirtual(() => this.grabarPantalla());
    this.decl = decl;
    for (const d of decl) if (d.k === 'func') this.funciones.set(d.nombre, d);
  }

  // ---------- grabación ----------
  evento() {
    this.ultimoEvento = this.ahora;
    if (this.alEvento) this.alEvento();
  }
  grabarPantalla() {
    const foto = this.pantalla.foto();
    const ultimo = this.cuadros[this.cuadros.length - 1];
    if (ultimo && iguales(ultimo.bitmap, foto)) return;
    if (ultimo && ultimo.t === this.ahora) ultimo.bitmap = foto; // dos display() en el mismo ms: vale el último
    else this.cuadros.push({ t: this.ahora, bitmap: foto });
    this.evento();
  }
  grabarTono(f) {
    const ultima = this.notas[this.notas.length - 1];
    if (ultima && ultima.f === f) return;
    if (ultima && ultima.t === this.ahora) ultima.f = f;
    else this.notas.push({ t: this.ahora, f });
    this.evento();
  }
  avanzar(ms) {
    if (ms > 0) this.ahora += ms;
    if (this.ahora - this.ultimoEvento > ESPERA_QUIETO_MS) throw new Parar('quieto');
    if (this.ahora > DURACION_MAXIMA_MS) throw new Parar('muy-larga');
  }

  // ---------- preparación ----------
  iniciar() {
    for (const d of this.decl) {
      if (d.k === 'func') this.funciones.set(d.nombre, d);
      else if (d.k === 'obj') this.global.vars.set(d.nombre, { v: d.tipo.struct === null && d.nombre === 'display' ? 'display' : d.nombre, tipo: d.tipo });
      else if (d.k === 'var') this.declarar(d, this.global);
    }
  }

  valorInicial(tipo, dims) {
    if (dims && dims.length) {
      const n = dims[0] === null ? 0 : this.numero(this.evaluar(dims[0], this.global));
      return Array.from({ length: n }, () => this.valorInicial(tipo, dims.slice(1)));
    }
    if (tipo.struct && !tipo.ptr) return this.structVacio(tipo.struct);
    return tipo.ptr ? 0 : 0;
  }
  structVacio(nombre) {
    const o = { __struct: nombre };
    const info = this.camposTipo.get(nombre);
    const campos = this.estructuras.get(nombre);
    campos.forEach((c, i) => {
      const inf = info ? info[i] : null;
      o[c] = inf ? this.valorInicial(inf.tipo, inf.dims) : 0;
    });
    return o;
  }

  // Valor de una lista {...} para un tipo / dimensiones.
  desdeLista(lista, tipo, dims, amb) {
    if (dims && dims.length) {
      const elems = lista.k === 'lista' ? lista.elems : null;
      if (!elems) {
        // char arr[] = "texto"
        if (lista.k === 'str') return lista.v.concat([0]);
        throw new ErrorIno('inicialización de arreglo inválida');
      }
      const n = dims[0] === null ? elems.length : this.numero(this.evaluar(dims[0], amb));
      const out = [];
      for (let i = 0; i < n; i++) {
        const el = elems[i];
        out.push(el === undefined ? this.valorInicial(tipo, dims.slice(1)) : this.desdeLista(el, tipo, dims.slice(1), amb));
      }
      return out;
    }
    if (tipo.struct && !tipo.ptr) {
      if (lista.k !== 'lista') return this.evaluar(lista, amb);
      const o = this.structVacio(tipo.struct);
      const campos = this.estructuras.get(tipo.struct);
      const info = this.camposTipo.get(tipo.struct);
      lista.elems.forEach((el, i) => {
        const c = campos[i];
        if (c === undefined) return;
        const inf = info ? info[i] : { tipo: { bits: 32 }, dims: [] };
        o[c] = (el.k === 'lista' || (inf.dims && inf.dims.length))
          ? this.desdeLista(el, inf.tipo, inf.dims, amb)
          : this.convertir(this.evaluar(el, amb), inf.tipo);
      });
      return o;
    }
    if (lista.k === 'lista') return lista.elems.length ? this.convertir(this.evaluar(lista.elems[0], amb), tipo) : 0;
    return this.convertir(this.evaluar(lista, amb), tipo);
  }

  // Campos de GFXfont / GFXglyph (structs de la librería, sin info de tipos).
  convertir(v, tipo) {
    if (Array.isArray(v)) return new Puntero(v, 0);
    if (tipo && !tipo.ptr && typeof v === 'number') return ajustarEntero(v, tipo);
    return v;
  }

  declarar(d, amb) {
    let valor;
    if (d.init) valor = this.desdeLista(d.init, d.tipo, d.dims, amb);
    else valor = this.valorInicial(d.tipo, d.dims);
    if (d.dims.length === 0 && d.tipo.struct && !d.tipo.ptr && valor && valor.__struct === undefined && d.init && d.init.k !== 'lista') {
      // Escena e = otra; (copia)
      valor = typeof valor === 'object' ? { ...valor } : valor;
    }
    amb.vars.set(d.nombre, { v: valor, tipo: d.tipo, arreglo: d.dims.length > 0 });
  }

  // ---------- ejecución ----------
  llamar(nombre, args) {
    const f = this.funciones.get(nombre);
    if (!f) return this.incorporada(nombre, args);
    const amb = new Ambito(this.global);
    f.params.forEach((p, i) => {
      let v = args[i];
      if (!p.tipo.ref && !p.tipo.ptr && typeof v === 'number') v = ajustarEntero(v, p.tipo);
      amb.vars.set(p.nombre, { v, tipo: p.tipo });
    });
    try {
      this.ejecutar(f.cuerpo, amb);
    } catch (e) {
      if (e instanceof Retorno) return e.valor;
      throw e;
    }
    return undefined;
  }

  incorporada(nombre, args) {
    const n = (i) => this.numero(args[i]);
    switch (nombre) {
      case 'millis': return this.ahora >>> 0;
      case 'micros': return (this.ahora * 1000) >>> 0;
      case 'delay': this.avanzar(n(0)); return;
      case 'delayMicroseconds': return;
      case 'yield': return;
      case 'tone': {
        this.grabarTono(n(1) > 0 ? n(1) : 0);
        if (args.length > 2 && n(2) > 0) this.tonosProgramados.push({ t: this.ahora + n(2), f: 0 });
        return;
      }
      case 'noTone': this.grabarTono(0); return;
      case 'pinMode': case 'digitalWrite': case 'analogWrite': case 'randomSeed': return;
      case 'digitalRead': return 1;
      case 'analogRead': return 0;
      case 'pgm_read_byte': case 'pgm_read_byte_near': return this.deref(args[0]) & 0xFF;
      case 'pgm_read_word': case 'pgm_read_word_near': return this.deref(args[0]) & 0xFFFF;
      case 'pgm_read_dword': return this.deref(args[0]) >>> 0;
      case 'pgm_read_ptr': case 'pgm_read_pointer': return this.deref(args[0]);
      case 'abs': return Math.abs(n(0));
      case 'min': return Math.min(n(0), n(1));
      case 'max': return Math.max(n(0), n(1));
      case 'constrain': return Math.min(Math.max(n(0), n(1)), n(2));
      case 'map': return Math.trunc((n(0) - n(1)) * (n(4) - n(3)) / (n(2) - n(1)) + n(3));
      case 'strlen': { let k = 0; while (args[0].leer(k)) k++; return k; }
      case 'random': return 0;
      default: throw new ErrorIno(`función desconocida: ${nombre}()`);
    }
  }

  numero(v) {
    if (typeof v === 'number') return v;
    if (v === undefined || v === null) return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    throw new ErrorIno('se esperaba un número');
  }

  deref(p) {
    if (esPuntero(p)) return p.leer(0);
    if (Array.isArray(p)) return p[0];
    if (typeof p === 'number' && p === 0) throw new ErrorIno('puntero nulo');
    return p;
  }

  contar() {
    if (++this.pasos > PASOS_MAXIMOS) throw new ErrorIno('el .ino tarda demasiado en ejecutarse');
  }

  ejecutar(s, amb) {
    this.contar();
    switch (s.k) {
      case 'bloque': {
        const a = new Ambito(amb);
        for (const x of s.s) {
          const r = this.ejecutar(x, a);
          if (r) return r;
        }
        return null;
      }
      case 'nada': return null;
      case 'expr': this.evaluar(s.e, amb); return null;
      case 'decl': for (const d of s.vars) this.declarar(d, amb); return null;
      case 'if':
        if (verdadero(this.evaluar(s.c, amb))) return this.ejecutar(s.si, amb);
        return s.no ? this.ejecutar(s.no, amb) : null;
      case 'while':
        while (verdadero(this.evaluar(s.c, amb))) {
          const r = this.ejecutar(s.cuerpo, amb);
          if (r === ROMPER) break;
          if (r && r !== SEGUIR) return r;
        }
        return null;
      case 'do':
        do {
          const r = this.ejecutar(s.cuerpo, amb);
          if (r === ROMPER) break;
          if (r && r !== SEGUIR) return r;
        } while (verdadero(this.evaluar(s.c, amb)));
        return null;
      case 'for': {
        const a = new Ambito(amb);
        if (s.ini) this.ejecutar(s.ini, a);
        while (!s.c || verdadero(this.evaluar(s.c, a))) {
          const r = this.ejecutar(s.cuerpo, a);
          if (r === ROMPER) break;
          if (r && r !== SEGUIR) return r;
          if (s.paso) this.evaluar(s.paso, a);
        }
        return null;
      }
      case 'return': throw new Retorno(s.e ? this.evaluar(s.e, amb) : undefined);
      case 'break': return ROMPER;
      case 'continue': return SEGUIR;
      default: throw new ErrorIno('sentencia desconocida: ' + s.k);
    }
  }

  // Lugar asignable: { leer(), escribir(v), tipo }
  lugar(e, amb) {
    switch (e.k) {
      case 'id': {
        const b = amb.buscar(e.v);
        if (!b) throw new ErrorIno(`variable desconocida: ${e.v}`);
        return { leer: () => b.v, escribir: (v) => { b.v = (typeof v === 'number') ? ajustarEntero(v, b.tipo) : v; }, tipo: b.tipo, ref: () => new RefCampo(b, 'v') };
      }
      case 'idx': {
        const base = this.evaluar(e.a, amb);
        const i = this.numero(this.evaluar(e.i, amb));
        if (Array.isArray(base)) return { leer: () => base[i], escribir: (v) => { base[i] = v; }, ref: () => new Puntero(base, i) };
        if (base instanceof Puntero) return { leer: () => base.leer(i), escribir: (v) => base.escribir(i, v), ref: () => base.mas(i) };
        throw new ErrorIno('índice sobre algo que no es un arreglo');
      }
      case 'campo': case 'flecha': {
        let obj = this.evaluar(e.a, amb);
        if (e.k === 'flecha') obj = this.deref(obj);
        if (!obj || typeof obj !== 'object') throw new ErrorIno(`campo "${e.c}" de algo que no es un struct`);
        if (!(e.c in obj)) throw new ErrorIno(`el struct no tiene el campo "${e.c}"`);
        return { leer: () => obj[e.c], escribir: (v) => { obj[e.c] = v; }, ref: () => new RefCampo(obj, e.c) };
      }
      case 'un':
        if (e.op === '*') {
          const p = this.evaluar(e.a, amb);
          if (!esPuntero(p)) throw new ErrorIno('* sobre algo que no es un puntero');
          return { leer: () => p.leer(0), escribir: (v) => p.escribir(0, v), ref: () => p };
        }
        break;
      default: break;
    }
    throw new ErrorIno('no se puede asignar a esta expresión');
  }

  evaluar(e, amb) {
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return new Puntero(e.v.concat([0]), 0);
      case 'id': {
        const b = amb.buscar(e.v);
        if (b) return b.arreglo ? new Puntero(b.v, 0) : b.v;
        if (e.v in CONSTANTES) return CONSTANTES[e.v];
        if (this.funciones.has(e.v)) return { funcion: e.v };
        throw new ErrorIno(`nombre desconocido: ${e.v}`);
      }
      case 'idx': case 'campo': case 'flecha': {
        const v = this.lugar(e, amb).leer();
        return Array.isArray(v) ? new Puntero(v, 0) : v;
      }
      case 'call': return this.evaluarLlamada(e, amb);
      case 'coma': this.evaluar(e.a, amb); return this.evaluar(e.b, amb);
      case 'tern': return verdadero(this.evaluar(e.c, amb)) ? this.evaluar(e.a, amb) : this.evaluar(e.b, amb);
      case 'cast': {
        const v = this.evaluar(e.a, amb);
        if (e.tipo.ptr || typeof v !== 'number') return v;
        if (e.tipo.flot) return v;
        return ajustarEntero(v, e.tipo);
      }
      case 'sizeof': {
        if (e.a.k === 'id') {
          const b = amb.buscar(e.a.v);
          if (b) return tamanoDe(b.v);
        }
        const v = e.a.k === 'idx' ? this.lugar(e.a, amb).leer() : this.evaluar(e.a, amb);
        return tamanoDe(v instanceof Puntero ? v.arr : v);
      }
      case 'sizeofT': return e.tipo.ptr ? 4 : Math.max(1, (e.tipo.bits || 32) / 8);
      case 'un': {
        if (e.op === '&') {
          const l = this.lugar(e.a, amb);
          const v = l.leer();
          if (Array.isArray(v)) return new Puntero(v, 0);
          if (v && typeof v === 'object' && v.__struct) return new Puntero([v], 0);
          return l.ref();
        }
        if (e.op === '*') return this.lugar(e, amb).leer();
        const v = this.evaluar(e.a, amb);
        if (e.op === '!') return verdadero(v) ? 0 : 1;
        if (e.op === '-') return -this.numero(v);
        if (e.op === '+') return this.numero(v);
        if (e.op === '~') return ~this.numero(v);
        break;
      }
      case 'pre': case 'post': {
        const l = this.lugar(e.a, amb);
        const viejo = l.leer();
        const d = e.op === '++' ? 1 : -1;
        const nuevo = esPuntero(viejo) ? viejo.mas(d) : this.numero(viejo) + d;
        l.escribir(nuevo);
        return e.k === 'pre' ? l.leer() : viejo;
      }
      case 'asig': {
        const l = this.lugar(e.izq, amb);
        let v = this.evaluar(e.der, amb);
        if (e.op !== '=') v = this.operar(e.op.slice(0, -1), l.leer(), v);
        if (Array.isArray(v)) v = new Puntero(v, 0);
        l.escribir(v);
        return l.leer();
      }
      case 'bin': {
        if (e.op === '&&') return verdadero(this.evaluar(e.a, amb)) && verdadero(this.evaluar(e.b, amb)) ? 1 : 0;
        if (e.op === '||') return verdadero(this.evaluar(e.a, amb)) || verdadero(this.evaluar(e.b, amb)) ? 1 : 0;
        return this.operar(e.op, this.evaluar(e.a, amb), this.evaluar(e.b, amb), e);
      }
      default: break;
    }
    throw new ErrorIno('expresión desconocida: ' + e.k);
  }

  operar(op, a, b) {
    // aritmética de punteros
    if (esPuntero(a) && typeof b === 'number' && (op === '+' || op === '-')) return a.mas(op === '+' ? b : -b);
    if (esPuntero(a) && esPuntero(b)) {
      if (op === '-') return a.idx - b.idx;
      if (op === '==') return a.arr === b.arr && a.idx === b.idx ? 1 : 0;
      if (op === '!=') return a.arr === b.arr && a.idx === b.idx ? 0 : 1;
    }
    if ((op === '==' || op === '!=') && (esPuntero(a) || esPuntero(b) || (a && typeof a === 'object') || (b && typeof b === 'object'))) {
      const igual = a === b;
      return (op === '==') === igual ? 1 : 0;
    }
    const x = this.numero(a), y = this.numero(b);
    const enteros = Number.isInteger(x) && Number.isInteger(y);
    switch (op) {
      case '+': return x + y;
      case '-': return x - y;
      case '*': return x * y;
      case '/': if (y === 0) throw new ErrorIno('división por cero'); return enteros ? Math.trunc(x / y) : x / y;
      case '%': if (y === 0) throw new ErrorIno('división por cero'); return enteros ? x % y : x % y;
      // Bits: con valores sin signo (>= 0) el resultado queda sin signo, como
      // con unsigned long en C; con negativos, como int.
      case '<<': return (x >= 0) ? ((x << y) >>> 0) : (x << y);
      case '>>': return (x >= 0) ? (x >>> y) : (x >> y);
      case '&': return (x >= 0 || y >= 0) ? ((x & y) >>> 0) : (x & y);
      case '|': return (x >= 0 && y >= 0) ? ((x | y) >>> 0) : (x | y);
      case '^': return (x >= 0 && y >= 0) ? ((x ^ y) >>> 0) : (x ^ y);
      case '<': return x < y ? 1 : 0;
      case '>': return x > y ? 1 : 0;
      case '<=': return x <= y ? 1 : 0;
      case '>=': return x >= y ? 1 : 0;
      case '==': return x === y ? 1 : 0;
      case '!=': return x !== y ? 1 : 0;
      default: throw new ErrorIno('operador desconocido: ' + op);
    }
  }

  evaluarLlamada(e, amb) {
    // objeto.metodo(...)
    if (e.f.k === 'campo' && e.f.a.k === 'id') {
      const obj = e.f.a.v;
      const args = e.args.map(a => this.evaluar(a, amb));
      if (obj === 'display') return this.pantalla.metodo(e.f.c, args);
      if (['Wire', 'Serial', 'Serial1', 'SPI', 'WiFi'].includes(obj)) return 0;
      const b = amb.buscar(obj);
      if (b && b.tipo && b.tipo.struct === null && b.v === 'display') return this.pantalla.metodo(e.f.c, args);
      throw new ErrorIno(`${obj}.${e.f.c}() no está soportado`);
    }
    if (e.f.k !== 'id') throw new ErrorIno('llamada a algo que no es una función');
    const args = e.args.map(a => {
      // los parámetros por referencia (Escena& e) reciben el objeto tal cual
      const v = this.evaluar(a, amb);
      return v;
    });
    return this.llamar(e.f.v, args);
  }
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ===================================================================
// API
// ===================================================================

/**
 * Nombre de la canción según el comentario de la primera línea que pone el
 * simulador (// "nombre" -- generado con ...), o null.
 */
export function nombreDelIno(texto) {
  const m = String(texto || '').match(/^\s*\/\/\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Ejecuta el .ino y devuelve su grabación (ver el comentario del módulo).
 * Lanza un Error con un mensaje en español si el .ino usa algo que el
 * intérprete no entiende.
 */
export function grabarIno(texto) {
  let decl, parser;
  try {
    const fuente = String(texto || '').replace(/\r\n?/g, '\n'); // .ino de Windows (CRLF)
    const toks = aplicarDefines(tokenizar(quitarComentarios(fuente)));
    parser = new Parser(toks);
    decl = parser.programa();
  } catch (e) {
    if (e instanceof ErrorIno) throw new Error('No se pudo leer el .ino: ' + e.message);
    throw e;
  }

  const it = new Interprete(decl, parser.estructuras, parser.camposTipo);
  it.tonosProgramados = [];
  if (!it.funciones.has('loop')) throw new Error('El .ino no tiene loop()');

  let repetir = true;
  let duracion = 0;
  try {
    it.iniciar();
    if (it.funciones.has('setup')) it.llamar('setup', []);
    // La grabación empieza al terminar setup(): ese es el "cero".
    const inicio = it.ahora;
    it.ahora = 0;
    it.ultimoEvento = 0;
    it.notas = [];
    const primerCuadro = it.cuadros.length ? it.cuadros[it.cuadros.length - 1] : null;
    it.cuadros = primerCuadro ? [{ t: 0, bitmap: primerCuadro.bitmap }] : [];
    void inicio;

    // Primera vuelta de loop(): es la canción.
    try {
      it.llamar('loop', []);
      duracion = it.ahora;
    } catch (e) {
      if (!(e instanceof Parar)) throw e;
      // Se quedó quieta (ej. while(true) delay(1000);): toca una sola vez.
      repetir = false;
      duracion = it.ultimoEvento;
    }

    // Segunda vuelta: si vuelve a sonar o a dibujar, la canción se repite; si
    // no pasa nada (ej. "if (reproducido) return;"), se queda en la última imagen.
    if (repetir) {
      const fin = it.ahora;
      const notasAntes = it.notas.length, cuadrosAntes = it.cuadros.length;
      it.alEvento = () => { throw new Parar('repite'); };
      try {
        for (let vuelta = 0; vuelta < 3; vuelta++) it.llamar('loop', []);
        // loop() vuelve sin hacer nada: no repite.
        repetir = false;
      } catch (e) {
        if (!(e instanceof Parar)) throw e;
        repetir = e.motivo === 'repite';
      }
      it.notas.length = notasAntes;
      it.cuadros.length = cuadrosAntes;
      it.alEvento = null;
      duracion = fin;
    }
  } catch (e) {
    if (e instanceof ErrorIno) throw new Error('No se pudo ejecutar el .ino: ' + e.message);
    if (e instanceof Retorno) throw new Error('No se pudo ejecutar el .ino: return fuera de una función');
    throw e;
  }

  // tone(pin, f, dur): el corte programado
  const notas = it.notas.concat(it.tonosProgramados.filter(x => x.t <= duracion)).sort((a, b) => a.t - b.t);
  const sinRepetidas = [];
  for (const nt of notas) {
    const ult = sinRepetidas[sinRepetidas.length - 1];
    if (ult && ult.t === nt.t) { ult.f = nt.f; continue; }
    if (ult && ult.f === nt.f) continue;
    sinRepetidas.push({ t: nt.t, f: nt.f });
  }
  if (repetir && sinRepetidas.length && sinRepetidas[sinRepetidas.length - 1].f !== 0) sinRepetidas.push({ t: duracion, f: 0 });

  return { notas: sinRepetidas, cuadros: it.cuadros, duracion: Math.max(duracion, 1), repetir };
}

/**
 * Notas en el formato de las canciones de siempre ([[frecuencia, duración], ...])
 * para enviar la canción "sin letra".
 */
export function notasParaCancion(grabacion) {
  const out = [];
  const n = grabacion.notas;
  for (let i = 0; i < n.length; i++) {
    const fin = i + 1 < n.length ? n[i + 1].t : grabacion.duracion;
    const dur = fin - n[i].t;
    if (dur > 0) out.push([n[i].f, dur]);
  }
  if (n.length && n[0].t > 0) out.unshift([0, n[0].t]);
  return out;
}
