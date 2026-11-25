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
  // Juntar (para la portada del catálogo) es lo contrario de partir.
  const vuelta = D.juntarEscena(izq, der);
  informe('juntar las mitades devuelve la misma escena', igual(vuelta, escena));
  const pFalso = { portada: { izq: D.aBase64(izq), der: D.aBase64(der) } };
  const portada = D.portadaEscena(pFalso);
  informe('la portada del catálogo es la escena de 256×64 en Base64 (2732 letras)', portada.length === 2732 && igual(D.deBase64(portada), escena), String(portada.length));
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

// ---- Partir en el tiempo: la primera parte en un Pepito y la segunda en el otro, sin perder ni sumar duración ----
{
  const a = lleno(1), b = lleno(2), c = lleno(3), d = lleno(4);
  const cuadros = [{ dur: 100, bitmap: a }, { dur: 100, bitmap: b }, { dur: 100, bitmap: c }, { dur: 100, bitmap: d }];
  const p = D.partirEnTiempo(cuadros, 200);
  informe('partir en el tiempo a la mitad: dos cuadros en cada parte', p.primera.length === 2 && p.segunda.length === 2 && igual(p.primera[1].bitmap, b) && igual(p.segunda[0].bitmap, c));
  const q = D.partirEnTiempo(cuadros, 250);
  informe('un cuadro que cruza el corte se parte en dos (50 + 50 ms)', q.primera.length === 3 && q.primera[2].dur === 50 && q.segunda.length === 2 && q.segunda[0].dur === 50 && igual(q.segunda[0].bitmap, c) && D.duracionDe(q.primera) + D.duracionDe(q.segunda) === 400);
  const duo = D.armarDuo({ pistas: [{ tv: 'der', inicio: 0, cuadros: q.primera }, { tv: 'izq', inicio: D.duracionDe(q.primera), cuadros: q.segunda }] });
  informe('armado: la derecha toca la primera parte y la izquierda sigue justo al terminar', duo.duracion === 400 && duo.izq.cuadros[1].t === 250 && duo.der.cuadros.length === 3);
}

// ---- Portada y tramo de una canción ----
{
  const a = lleno(0x01), b = lleno(0x02);
  const duo = D.armarDuo({ pistas: [{ tv: 'der', inicio: 0, cuadros: [{ dur: 300, bitmap: a }, { dur: 300, bitmap: b }] }] });
  const p = await D.empaquetarDuo(duo, { nombre: 'x', clave: 'x', codificarMusical });
  informe('portada: por defecto la mitad del dúo (300 ms), con una imagen de 1024 bytes por mitad', p.portada.t === 300 && D.deBase64(p.portada.der).length === 1024 && D.deBase64(p.portada.der)[0] === 0x02 && D.deBase64(p.portada.izq)[0] === 0);
  const p2 = await D.empaquetarDuo(duo, { nombre: 'x', clave: 'x', codificarMusical, portadaMs: 100 });
  informe('portada: en el momento elegido (100 ms)', p2.portada.t === 100 && D.deBase64(p2.portada.der)[0] === 0x01);
  // Canción: 440 Hz de 0 a 1000, silencio de 1000 a 1500, 880 Hz de 1500 a 3000 (dura 3000).
  const notas = [{ t: 0, f: 440 }, { t: 1000, f: 0 }, { t: 1500, f: 880 }];
  const tramo = D.tramoDeCancion(notas, 3000, 800, 1000); // de 800 a 1800
  informe('tramo de canción: de 800 a 1800 ms = 200 ms de 440, 500 de silencio y 300 de 880', JSON.stringify(tramo) === JSON.stringify([[440, 200], [0, 500], [880, 300]]), JSON.stringify(tramo));
  const tramo2 = D.tramoDeCancion(notas, 3000, 2500, 5000); // pasa del final: se corta en 3000
  informe('tramo de canción: no pasa del final de la canción', JSON.stringify(tramo2) === JSON.stringify([[880, 500]]), JSON.stringify(tramo2));
  const tramo3 = D.tramoDeCancion([{ t: 400, f: 660 }], 1000, 0, 1000); // la canción empieza en silencio
  informe('tramo de canción: el silencio antes de la primera nota se respeta', JSON.stringify(tramo3) === JSON.stringify([[0, 400], [660, 600]]), JSON.stringify(tramo3));
}

// ---- Al revés, ida y vuelta, y texto encima ----
{
  const [a, b, c] = [lleno(1), lleno(2), lleno(3)].map((bitmap) => ({ dur: 100, bitmap }));
  informe('al revés', D.ordenar([a, b, c], 'reves').map((x) => x.bitmap[0]).join() === '3,2,1');
  informe('ida y vuelta (sin repetir los extremos)', D.ordenar([a, b, c], 'idavuelta').map((x) => x.bitmap[0]).join() === '1,2,3,2');
  const linea = [{ t: 0, bitmap: lleno(0x00) }, { t: 300, bitmap: lleno(0xF0) }];
  const mascara = lleno(0x0F);
  const s = D.superponer(linea, 600, mascara, 100, 400);
  informe('texto encima de 100 a 400 ms: la línea se parte en esos momentos y solo ahí lleva la máscara',
    JSON.stringify(s.map((x) => [x.t, x.bitmap[0]])) === JSON.stringify([[0, 0x00], [100, 0x0F], [300, 0xFF], [400, 0xF0]]), JSON.stringify(s.map((x) => [x.t, x.bitmap[0]])));
  const ap = D.superponer([{ t: 0, bitmap: lleno(0xFF) }], 200, mascara, 0, 200, true);
  informe('texto que apaga: quita los puntos de la máscara', ap.length === 1 && ap[0].bitmap[0] === 0xF0);
}

// ---- Claves ----
informe('clave: sin tildes ni espacios', D.claveDe('¡Gatitos Bailando!') === 'gatitos_bailando' && D.claveDe('') === 'duo');

console.log(fallas === 0 ? 'todo bien' : `${fallas} con problemas`);
process.exit(fallas ? 1 : 0);
