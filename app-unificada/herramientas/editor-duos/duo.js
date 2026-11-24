// Dúos (docs/plan-duos.md; solo Pepito Pro): la lógica PURA del editor de dúos, sin pantalla. La usan el editor
// (editor-duos.js) y las pruebas en Node (pruebas/duo.mjs). Del mismo código sale el dúo de prueba del firmware.
//
// Un dúo son DOS grabaciones m1 (docs/formatos-datos.md, sección 4), una por TV, con la MISMA duración: la TV de la
// izquierda (la que detecta) y la de la derecha. Cada Pepito guarda las dos mitades de cada dúo, porque que una TV quede a la
// izquierda o a la derecha depende de cómo las pongan, no de la TV. La salida es simultánea: lo único que las mantiene
// alineadas es que las dos líneas de tiempo midan lo mismo.

export const ANCHO = 128;
export const ALTO = 64;
export const BYTES_PANTALLA = 1024; // 128×64 a 1 bit por punto, 16 bytes por fila
export const MIN_CUADRO_MS = 40; // un cuadro más corto no se alcanza a dibujar en todas las placas
export const MAX_CUADRO_MS = 65535;

// Límites PROPUESTOS (sin decidir con el dueño): avisan, no bloquean.
export const LIMITES = Object.freeze({
  recomendadoMitad: 40 * 1024, // cada mitad comprimida
  pruebaMitad: 20 * 1024, // para el dúo de prueba que va dentro del firmware (pesa en cada actualización)
  duracionMaxima: 15000,
});

// Sonidos cortos para elegir en el editor: [[Hz, ms], ...] (0 Hz = silencio).
export const SONIDOS = Object.freeze({
  corazon: { nombre: 'Corazón (dos latidos)', notas: [[1319, 120], [0, 80], [1760, 180]] },
  alegre: { nombre: 'Alegre (sube)', notas: [[1047, 110], [1319, 110], [1568, 110], [2093, 220]] },
  tada: { nombre: 'Tadá', notas: [[1568, 90], [0, 40], [2093, 320]] },
  campanita: { nombre: 'Campanita', notas: [[2637, 90], [0, 60], [2637, 90], [0, 60], [3136, 200]] },
  beso: { nombre: 'Beso', notas: [[2349, 60], [0, 40], [2794, 120]] },
});

export function negro() {
  return new Uint8Array(BYTES_PANTALLA);
}

/** Copia del bitmap con todos los puntos al revés (el formato m1 no tiene "invertido": se hornea en la imagen). */
export function invertir(bitmap) {
  const o = new Uint8Array(bitmap.length);
  for (let i = 0; i < bitmap.length; i++) o[i] = ~bitmap[i] & 0xFF;
  return o;
}

/**
 * Parte una escena de 256×64 (32 bytes por fila) en las dos pantallas: los bytes 0..15 de cada fila son la TV de la
 * IZQUIERDA (x 0..127) y los 16..31 la de la DERECHA (x 128..255), como quedan físicamente.
 */
export function partirEscena(escena) {
  if (!escena || escena.length !== 2 * BYTES_PANTALLA) throw new Error('La escena debe medir 256×64 (2048 bytes)');
  const izq = new Uint8Array(BYTES_PANTALLA);
  const der = new Uint8Array(BYTES_PANTALLA);
  for (let y = 0; y < ALTO; y++) {
    izq.set(escena.subarray(y * 32, y * 32 + 16), y * 16);
    der.set(escena.subarray(y * 32 + 16, y * 32 + 32), y * 16);
  }
  return { izq, der };
}

const igual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const limitar = (ms) => Math.min(MAX_CUADRO_MS, Math.max(MIN_CUADRO_MS, Math.round(ms)));

/**
 * Cuadros de un GIF ya binarizados [{dur, bitmap}] → repetidos "vueltas" veces, a "velocidad" (1 = normal, 2 = el doble de
 * rápido), con cada cuadro de al menos MIN_CUADRO_MS y los consecutivos iguales unidos (suman su duración).
 */
export function prepararCuadros(cuadros, { vueltas = 1, velocidad = 1 } = {}) {
  const v = Math.max(1, Math.min(20, Math.round(vueltas)));
  const vel = velocidad > 0 ? velocidad : 1;
  const salida = [];
  for (let k = 0; k < v; k++) {
    for (const c of cuadros) {
      const dur = limitar(c.dur / vel);
      const ultimo = salida[salida.length - 1];
      if (ultimo && igual(ultimo.bitmap, c.bitmap)) ultimo.dur = limitar(ultimo.dur + dur);
      else salida.push({ dur, bitmap: c.bitmap });
    }
  }
  return salida;
}

export const duracionDe = (cuadros) => cuadros.reduce((s, c) => s + c.dur, 0);

/**
 * Parte un GIF en el TIEMPO (pedido del dueño, 2026-11-24): lo de antes de "corte" ms va en un Pepito y lo de después en el
 * otro, que lo sigue apenas termina el primero. Un cuadro que cruza el corte se parte en dos (cada parte con su duración).
 * Devuelve { primera: [{dur, bitmap}], segunda: [...] }; ninguna queda vacía mientras haya al menos dos cuadros o duración.
 */
export function partirEnTiempo(cuadros, corte) {
  const total = duracionDe(cuadros);
  const c = Math.min(Math.max(Math.round(corte), MIN_CUADRO_MS), Math.max(MIN_CUADRO_MS, total - MIN_CUADRO_MS));
  const primera = [], segunda = [];
  let t = 0;
  for (const q of cuadros) {
    const fin = t + q.dur;
    if (fin <= c) primera.push({ dur: q.dur, bitmap: q.bitmap });
    else if (t >= c) segunda.push({ dur: q.dur, bitmap: q.bitmap });
    else {
      primera.push({ dur: c - t, bitmap: q.bitmap });
      segunda.push({ dur: fin - c, bitmap: q.bitmap });
    }
    t = fin;
  }
  return { primera, segunda };
}

/** [[Hz, ms], ...] → [{t, f}, ...] empezando en "inicio" y terminando en silencio. */
export function notasDesde(lista, inicio = 0) {
  const notas = [];
  let t = Math.max(0, Math.round(inicio));
  for (const [f, ms] of lista) {
    notas.push({ t, f: Math.max(0, Math.round(f)) });
    t += Math.max(1, Math.round(ms));
  }
  if (notas.length) notas.push({ t, f: 0 });
  return notas;
}

/**
 * Arma las dos mitades.
 *   pistas:     [{ tv: 'izq' | 'der', inicio: ms, cuadros: [{dur, bitmap}] }]  (a lo sumo una por TV)
 *   espera:     { izq, der }: 'negro' | 'primero'  (qué muestra cada TV antes de que empiece su pista)
 *   alTerminar: 'ultimo' | 'negro'                 (qué queda cuando termina su pista y la otra sigue)
 *   sonido:     null | { tv: 'izq' | 'der', inicio: ms, notas: [[Hz, ms], ...] }
 * Devuelve { duracion, izq: { cuadros: [{t, bitmap}], notas: [{t, f}] }, der: { ... } } con la MISMA duración en las dos.
 */
export function armarDuo({ pistas = [], espera = {}, alTerminar = 'ultimo', sonido = null } = {}) {
  const porTv = { izq: null, der: null };
  for (const p of pistas) {
    if (p.tv !== 'izq' && p.tv !== 'der') throw new Error('Cada pista va en el lado "izq" o "der"');
    if (porTv[p.tv]) throw new Error('Solo una pista por lado');
    if (!p.cuadros || !p.cuadros.length) continue;
    p.cuadros.forEach((c) => { if (!c.bitmap || c.bitmap.length !== BYTES_PANTALLA) throw new Error('Cada cuadro mide 1024 bytes'); });
    porTv[p.tv] = { inicio: Math.max(0, Math.round(p.inicio || 0)), cuadros: p.cuadros };
  }
  let duracion = 0;
  for (const tv of ['izq', 'der']) {
    const p = porTv[tv];
    if (p) duracion = Math.max(duracion, p.inicio + duracionDe(p.cuadros));
  }
  let notasSonido = [];
  if (sonido && sonido.notas && sonido.notas.length) {
    notasSonido = notasDesde(sonido.notas, sonido.inicio || 0);
    duracion = Math.max(duracion, notasSonido[notasSonido.length - 1].t);
  }
  duracion = Math.max(duracion, MIN_CUADRO_MS);

  const mitad = (tv) => {
    const p = porTv[tv];
    const cuadros = [];
    if (!p) {
      cuadros.push({ t: 0, bitmap: negro() });
    } else {
      if (p.inicio > 0) cuadros.push({ t: 0, bitmap: (espera[tv] === 'primero') ? p.cuadros[0].bitmap : negro() });
      let t = p.inicio;
      for (const c of p.cuadros) {
        cuadros.push({ t, bitmap: c.bitmap });
        t += c.dur;
      }
      if (t < duracion && alTerminar === 'negro') cuadros.push({ t, bitmap: negro() });
    }
    // Cuadros seguidos iguales: uno solo (no cambia lo que se ve).
    const unidos = cuadros.filter((c, i) => i === 0 || !igual(c.bitmap, cuadros[i - 1].bitmap));
    return { cuadros: unidos, notas: sonido && sonido.tv === tv ? notasSonido : [] };
  };
  return { duracion, izq: mitad('izq'), der: mitad('der') };
}

const aBase64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const deBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * El paquete del dúo (BORRADOR del formato del catálogo: nada de esto llega a Firebase hasta que el dueño lo apruebe).
 * codificarMusical es la de js/compresion.js (se recibe para que este módulo no dependa de dónde vive).
 */
export async function empaquetarDuo(duo, { nombre, clave, codificarMusical, portadaMs }) {
  const mitad = async (tv) => {
    const r = await codificarMusical({ notas: duo[tv].notas, cuadros: duo[tv].cuadros, duracion: duo.duracion, repetir: false });
    return { datos: r.datos, bytes: r.bytes, imagenes: r.imagenes };
  };
  const izq = await mitad('izq');
  const der = await mitad('der');
  // Portada (2026-11-24): lo que se ve en cada mitad en un momento elegido (por defecto, la mitad del dúo). Para la lista de
  // dúos de la app (1024 bytes por mitad, en Base64).
  const t = Math.min(duo.duracion, Math.max(0, Math.round(portadaMs === undefined || portadaMs === null ? duo.duracion / 2 : portadaMs)));
  return {
    formato: 'duo1',
    version: 1,
    clave: String(clave || ''),
    nombre: String(nombre || ''),
    duracion: duo.duracion,
    sonido: duo.izq.notas.length ? 'izq' : duo.der.notas.length ? 'der' : null,
    portada: { t, izq: aBase64(cuadroEn(duo.izq.cuadros, t).bitmap), der: aBase64(cuadroEn(duo.der.cuadros, t).bitmap) },
    izq,
    der,
  };
}

/** El cuadro que se ve en el momento t de una mitad ([{t, bitmap}] ordenada). */
export function cuadroEn(cuadros, t) {
  let c = cuadros[0];
  for (const x of cuadros) { if (x.t <= t) c = x; else break; }
  return c;
}

/**
 * Un tramo de una canción para el sonido del dúo (pedido del dueño, 2026-11-24): de las notas [{t, f}] de la canción (su m1),
 * las que suenan entre "desde" y "desde + duracion" ms, contadas desde 0 y como [[Hz, ms], ...] (lo que usa armarDuo).
 */
export function tramoDeCancion(notas, duracionCancion, desde, duracion) {
  const ini = Math.max(0, Math.round(desde));
  const fin = Math.min(Math.round(duracionCancion), ini + Math.max(1, Math.round(duracion)));
  if (fin <= ini) return [];
  const pares = [];
  for (let i = 0; i < notas.length; i++) {
    const a = Math.max(ini, notas[i].t);
    const b = Math.min(fin, i + 1 < notas.length ? notas[i + 1].t : duracionCancion);
    if (b > a) pares.push([notas[i].f, b - a]);
  }
  // Antes de la primera nota del tramo hay silencio.
  const primera = notas.findIndex((n, i) => (i + 1 < notas.length ? notas[i + 1].t : duracionCancion) > ini);
  if (primera > -1 && notas[primera].t > ini) pares.unshift([0, notas[primera].t - ini]);
  return pares;
}

/** Clave para archivos y el catálogo: minúsculas, sin tildes, guiones bajos (como las de las caras: [A-Za-z0-9_-]{1,40}). */
export function claveDe(nombre) {
  const c = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return c || 'duo';
}

function arregloC(bytes, sangria = '    ') {
  const filas = [];
  for (let i = 0; i < bytes.length; i += 16) {
    filas.push(sangria + Array.from(bytes.subarray(i, i + 16), (b) => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ') + ',');
  }
  return filas.join('\n');
}

/**
 * Cabecera C con el dúo de prueba para el firmware (lo genera el editor; NO editar a mano):
 *   - Pepito Pro (ESP32-S3): las dos mitades en m1 tal cual (DUO_PRUEBA_IZQ_M1 / DUO_PRUEBA_DER_M1).
 *   - La placa de pruebas ESP8266 (Duos_Prueba): sin comprimir (no trae descompresor): imágenes únicas de 1024 bytes y, por
 *     mitad, la línea de tiempo [t, imagen] y las notas [t, Hz].
 * La Pro la incluye SOLO con la bandera de los dúos encendida (así una Pro sin dúos no carga estos bytes).
 */
export function cabeceraC(duo, paquete) {
  const unicas = [];
  const indiceDe = (bm) => {
    let k = unicas.findIndex((u) => igual(u, bm));
    if (k < 0) { k = unicas.length; unicas.push(bm); }
    return k;
  };
  const linea = (tv) => duo[tv].cuadros.map((c) => `{${c.t}, ${indiceDe(c.bitmap)}}`).join(', ');
  const lineaIzq = linea('izq');
  const lineaDer = linea('der');
  const notas = (tv) => duo[tv].notas.map((n) => `{${n.t}, ${n.f}}`).join(', ');
  const izqM1 = deBase64(paquete.izq.datos);
  const derM1 = deBase64(paquete.der.datos);
  return [
    `// Dúo de prueba "${paquete.nombre}" (clave ${paquete.clave}), generado por el editor de dúos. NO editar a mano.`,
    `// Duración ${duo.duracion} ms. Pro: m1 izquierda ${izqM1.length} bytes, derecha ${derM1.length} bytes. ESP8266: ${unicas.length} imágenes sin comprimir.`,
    '#pragma once',
    '#include <stdint.h>',
    '',
    `#define DUO_PRUEBA_DURACION ${duo.duracion}UL`,
    '',
    '#if defined(ESP8266)',
    '#include <pgmspace.h>',
    'struct DuoCuadro { uint32_t t; uint16_t imagen; };',
    'struct DuoNota { uint32_t t; uint16_t hz; };',
    `static const uint8_t DUO_PRUEBA_IMAGENES[${unicas.length}][1024] PROGMEM = {`,
    unicas.map((u) => '  {\n' + arregloC(u) + '\n  },').join('\n'),
    '};',
    `static const DuoCuadro DUO_PRUEBA_LINEA_IZQ[] = {${lineaIzq}};`,
    `static const DuoCuadro DUO_PRUEBA_LINEA_DER[] = {${lineaDer}};`,
    `static const uint16_t DUO_PRUEBA_N_IZQ = ${duo.izq.cuadros.length};`,
    `static const uint16_t DUO_PRUEBA_N_DER = ${duo.der.cuadros.length};`,
    `static const DuoNota DUO_PRUEBA_NOTAS_IZQ[] = {${notas('izq') || '{0, 0}'}};`,
    `static const DuoNota DUO_PRUEBA_NOTAS_DER[] = {${notas('der') || '{0, 0}'}};`,
    `static const uint16_t DUO_PRUEBA_N_NOTAS_IZQ = ${duo.izq.notas.length};`,
    `static const uint16_t DUO_PRUEBA_N_NOTAS_DER = ${duo.der.notas.length};`,
    '#else',
    `static const uint8_t DUO_PRUEBA_IZQ_M1[${izqM1.length}] = {`,
    arregloC(izqM1),
    '};',
    `static const uint8_t DUO_PRUEBA_DER_M1[${derM1.length}] = {`,
    arregloC(derM1),
    '};',
    '#endif',
    '',
  ].join('\n');
}

export { aBase64, deBase64 };
