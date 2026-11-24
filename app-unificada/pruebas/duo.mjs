// Lógica del editor de dúos (herramientas/editor-duos/duo.js), sin navegador: partir la escena, armar las dos mitades,
// codificarlas en m1 (js/compresion.js de la Pro) y la cabecera C del dúo de prueba. node pruebas/duo.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const D = await import(pathToFileURL(path.join(aqui, '..', 'herramientas', 'editor-duos', 'duo.js')).href);
const { codificarMusical, decodificarMusical } = await import(pathToFileURL(path.join(aqui, '..', '..', 'js', 'compresion.js')).href);

let fallas = 0;
const informe = (nombre, ok, detalle = '') => { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`); };
const lleno = (v) => new Uint8Array(1024).fill(v);
const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---- Partir la escena: la mitad izquierda son los bytes 0..15 de cada fila, la derecha los 16..31 ----
{
  const escena = new Uint8Array(2048);
  for (let y = 0; y < 64; y++) for (let k = 0; k < 32; k++) escena[y * 32 + k] = k < 16 ? (y & 0xFF) : (0x80 | k);
  const { izq, der } = D.partirEscena(escena);
  let bien = izq.length === 1024 && der.length === 1024;
  for (let y = 0; y < 64 && bien; y++) for (let k = 0; k < 16; k++) {
    if (izq[y * 16 + k] !== (y & 0xFF) || der[y * 16 + k] !== (0x80 | (k + 16))) { bien = false; break; }
  }
  informe('partir la escena: izquierda = x 0..127, derecha = x 128..255, 1024 bytes cada una', bien);
  // La costura: un punto en x = 127 queda en la izquierda (último bit) y uno en x = 128 en la derecha (primer bit).
  const e2 = new Uint8Array(2048);
  e2[0 * 32 + 15] = 0x01; // x = 127, y = 0
  e2[1 * 32 + 16] = 0x80; // x = 128, y = 1
  const p2 = D.partirEscena(e2);
  informe('la costura: x 127 es el último punto de la izquierda y x 128 el primero de la derecha', p2.izq[15] === 0x01 && p2.der[16] === 0x80 && p2.izq.reduce((s, v) => s + v, 0) === 1 && p2.der.reduce((s, v) => s + v, 0) === 0x80);
  let error = '';
  try { D.partirEscena(new Uint8Array(1024)); } catch (e) { error = e.message; }
  informe('una escena que no mide 256×64 se rechaza', /256×64/.test(error));
}

// ---- Invertir ----
informe('invertir da la vuelta a todos los puntos', igual(D.invertir(lleno(0x0F)), lleno(0xF0)));

// ---- Preparar cuadros: mínimo 40 ms, iguales seguidos unidos, vueltas y velocidad ----
{
  const a = lleno(1), b = lleno(2);
  const p = D.prepararCuadros([{ dur: 10, bitmap: a }, { dur: 100, bitmap: a }, { dur: 30, bitmap: b }]);
  informe('cuadros: mínimo 40 ms y los iguales seguidos se unen', p.length === 2 && p[0].dur === 140 && p[1].dur === 40, JSON.stringify(p.map((c) => c.dur)));
  const v = D.prepararCuadros([{ dur: 100, bitmap: a }, { dur: 100, bitmap: b }], { vueltas: 3, velocidad: 2 });
  informe('3 vueltas al doble de velocidad', v.length === 6 && v.every((c) => c.dur === 50), JSON.stringify(v.map((c) => c.dur)));
}

const comprobarMitades = (duo, nombre) => {
  const ok = ['izq', 'der'].every((tv) => {
    const c = duo[tv].cuadros;
    return c.length > 0 && c[0].t === 0 && c.every((x) => x.bitmap.length === 1024) && c.every((x, i) => i === 0 || x.t > c[i - 1].t) && c[c.length - 1].t < duo.duracion;
  });
  informe(`${nombre}: las dos mitades empiezan en 0, cuadros de 1024 bytes y tiempos que siempre avanzan`, ok);
};

// ---- Escena ancha: las dos pistas a la vez ----
{
  const escenas = [0x11, 0x22, 0x33].map((v) => { const e = new Uint8Array(2048); e.fill(v, 0, 1024); e.fill(v + 1, 1024); return e; });
  const partes = escenas.map((e) => D.partirEscena(e));
  const cuadros = (tv) => D.prepararCuadros(partes.map((p) => ({ dur: 200, bitmap: p[tv] })));
  const duo = D.armarDuo({
    pistas: [{ tv: 'izq', inicio: 0, cuadros: cuadros('izq') }, { tv: 'der', inicio: 0, cuadros: cuadros('der') }],
    sonido: { tv: 'izq', inicio: 100, notas: D.SONIDOS.corazon.notas },
  });
  comprobarMitades(duo, 'escena ancha');
  informe('escena ancha: dura lo de la animación (600 ms)', duo.duracion === 600, String(duo.duracion));
  informe('escena ancha: el sonido solo en la izquierda, desde los 100 ms', duo.izq.notas.length === 4 && duo.izq.notas[0].t === 100 && duo.der.notas.length === 0 && duo.izq.notas[3].f === 0);
}

// ---- Dos GIF: el primero en la derecha, el segundo en la izquierda cuando termina ----
{
  const a = lleno(0xAA), b = lleno(0xBB), c = lleno(0xCC);
  const duo = D.armarDuo({
    pistas: [{ tv: 'der', inicio: 0, cuadros: [{ dur: 500, bitmap: a }, { dur: 500, bitmap: b }] }, { tv: 'izq', inicio: 1000, cuadros: [{ dur: 300, bitmap: c }] }],
    espera: { izq: 'negro', der: 'negro' },
    alTerminar: 'negro',
  });
  comprobarMitades(duo, 'dos GIF');
  informe('dos GIF: dura 1300 ms (el segundo empieza a los 1000 y dura 300)', duo.duracion === 1300, String(duo.duracion));
  informe('dos GIF: la izquierda espera en negro y su GIF empieza a los 1000 ms', duo.izq.cuadros.length === 2 && igual(duo.izq.cuadros[0].bitmap, D.negro()) && duo.izq.cuadros[1].t === 1000 && igual(duo.izq.cuadros[1].bitmap, c));
  informe('dos GIF: la derecha se apaga (negro) al terminar su GIF', duo.der.cuadros.length === 3 && duo.der.cuadros[2].t === 1000 && igual(duo.der.cuadros[2].bitmap, D.negro()));
  const conPrimero = D.armarDuo({ pistas: [{ tv: 'izq', inicio: 400, cuadros: [{ dur: 100, bitmap: c }] }], espera: { izq: 'primero' } });
  informe('esperar mostrando el primer cuadro: se une con el primer cuadro (una sola imagen desde el principio)', conPrimero.izq.cuadros.length === 1 && igual(conPrimero.izq.cuadros[0].bitmap, c));
  informe('una TV sin pista queda en negro todo el dúo', conPrimero.der.cuadros.length === 1 && igual(conPrimero.der.cuadros[0].bitmap, D.negro()));
}

// ---- El paquete (m1) y su vuelta: lo que reciben las TV es lo que se armó ----
{
  const a = lleno(0x0F), b = lleno(0xF0);
  const duo = D.armarDuo({
    pistas: [{ tv: 'der', inicio: 0, cuadros: [{ dur: 400, bitmap: a }] }, { tv: 'izq', inicio: 400, cuadros: [{ dur: 400, bitmap: b }] }],
    sonido: { tv: 'izq', inicio: 400, notas: D.SONIDOS.tada.notas },
  });
  const paquete = await D.empaquetarDuo(duo, { nombre: 'Prueba de dúo', clave: D.claveDe('Prueba de dúo'), codificarMusical });
  informe('paquete: formato duo1, las dos mitades y el sonido en la izquierda', paquete.formato === 'duo1' && paquete.clave === 'prueba_de_duo' && paquete.sonido === 'izq' && paquete.izq.bytes > 0 && paquete.der.bytes > 0, JSON.stringify({ clave: paquete.clave, izq: paquete.izq.bytes, der: paquete.der.bytes }));
  const izq = await decodificarMusical(paquete.izq.datos);
  const der = await decodificarMusical(paquete.der.datos);
  informe('las dos mitades decodificadas duran lo mismo y no se repiten', izq.duracion === der.duracion && izq.duracion === duo.duracion && !izq.repetir && !der.repetir, `${izq.duracion} / ${der.duracion}`);
  informe('lo decodificado es lo que se armó (cuadros y notas)', izq.cuadros.length === duo.izq.cuadros.length && izq.cuadros.every((c, i) => c.t === duo.izq.cuadros[i].t && igual(c.bitmap, duo.izq.cuadros[i].bitmap)) && der.notas.length === 0 && izq.notas.length === duo.izq.notas.length);
  const h = D.cabeceraC(duo, paquete);
  informe('cabecera C: m1 de las dos mitades para la Pro y las imágenes sin comprimir para el ESP8266', /DUO_PRUEBA_IZQ_M1\[\d+\]/.test(h) && /DUO_PRUEBA_DER_M1\[\d+\]/.test(h) && /DUO_PRUEBA_IMAGENES\[3\]\[1024\]/.test(h) && /#if defined\(ESP8266\)/.test(h), `imágenes únicas: ${(h.match(/DUO_PRUEBA_IMAGENES\[(\d+)\]/) || [])[1]}`);
}

// ---- Claves ----
informe('clave: sin tildes ni espacios', D.claveDe('¡Gatitos Bailando!') === 'gatitos_bailando' && D.claveDe('') === 'duo');

console.log(fallas === 0 ? 'todo bien' : `${fallas} con problemas`);
process.exit(fallas ? 1 : 0);
