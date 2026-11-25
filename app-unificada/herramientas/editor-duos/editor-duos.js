// Editor de dúos (herramienta del dueño; docs/plan-duos.md, solo Pepito Pro). Lee los GIF con el mismo lector y los mismos
// ajustes que la app (js/gif.js, js/imageProcessor.js, sin tocarlos), arma el dúo con duo.js (la lógica pura, probada en Node)
// y lo codifica en m1 (js/compresion.js). La vista previa sale del paquete ya armado: lo mismo que reciben las TV.
// construir.mjs lo copia a www/ junto a la app (no va en la APK).
import { decodificarGif, comprobarTamanoArchivo, esGif } from './gif.js';
import { acomodarEnDestino, grisesDeCanvas, grisABitmapAtkinson, grisABitmapUmbral } from './imageProcessor.js';
import { codificarMusical, decodificarMusical } from './compresion.js';
import * as D from './duo.js';
import {
  escucharSesion, iniciarSesion, listarMusicales, leerMusical, listarMisDispositivos, usarCuenta, enviarEstado,
  esAdministrador, unificadaListarDuos, unificadaGuardarDuoCatalogo, unificadaBorrarDuoCatalogo,
} from './firebase.js';
import { dibujarOLED } from './renderer.js';

const $ = (id) => document.getElementById(id);
const valor = (id) => $(id).value;
const numero = (id, def, min, max) => {
  const n = Number($(id).value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const marcado = (id) => $(id).checked;

// ---------------------------------------------------------------------------------------------------------------------
// GIF: cada uno se lee una vez por geometría (lo caro) y se binariza cada vez que cambian los ajustes (lo barato).
// ---------------------------------------------------------------------------------------------------------------------
const gifs = { tiempo: null, escena: null, g1: null, g2: null }; // { buffer, nombre }
// UNA sola lectura guardada por GIF y uso ("hueco" -> { clave, valor }): si cambia algo se reemplaza. Antes cada ajuste guardaba
// otra lectura completa sin borrar las anteriores y, con un GIF largo, se llenaba la memoria (2026-11-24, revisión del asesor).
const lecturas = new Map();
function deCache(hueco, clave, crear) {
  const e = lecturas.get(hueco);
  if (e && e.clave === clave) return e.valor;
  const valor = crear();
  lecturas.set(hueco, { clave, valor });
  return valor;
}
window.__editorDuos = { lecturasGuardadas: () => lecturas.size }; // para las pruebas

// ---- Ajustes de imagen (tarjeta 2). En el modo "un GIF para cada Pepito" cada GIF puede tener los suyos (pedido 2026-11-24):
// se guardan aquí y los campos de la tarjeta muestran los del GIF que se está editando.
const CAMPOS_IMAGEN = ['pixelar', 'umbral', 'invertir', 'escala', 'fondo', 'rotar', 'volteoH', 'volteoV',
  'recorteIzq', 'recorteArriba', 'recorteDer', 'recorteAbajo'];
const ajustes = { general: null, g1: null, g2: null };
let editando = 'general';
function leerAjustesDePantalla() {
  const a = {};
  for (const id of CAMPOS_IMAGEN) a[id] = $(id).type === 'checkbox' ? $(id).checked : $(id).value;
  return a;
}
function ponerAjustesEnPantalla(a) {
  for (const id of CAMPOS_IMAGEN) { if ($(id).type === 'checkbox') $(id).checked = !!a[id]; else $(id).value = a[id]; }
}
const separados = () => valor('modo') === 'dos' && marcado('ajustesSeparados');
const ajustesDe = (id) => (separados() && (id === 'g1' || id === 'g2') && ajustes[id]) || ajustes.general;
const limitar = (v, def, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

const geometria = (a) => ({
  escala: a.escala,
  fondo: a.fondo,
  rotar: Number(a.rotar),
  volteoH: !!a.volteoH,
  volteoV: !!a.volteoV,
});
const recorte = (a) => ({
  izq: limitar(a.recorteIzq, 0, 0, 45), arriba: limitar(a.recorteArriba, 0, 0, 45),
  der: limitar(a.recorteDer, 0, 0, 45), abajo: limitar(a.recorteAbajo, 0, 0, 45),
});

function leer(id, ancho) {
  const gif = gifs[id];
  if (!gif) return null;
  const a = ajustesDe(id);
  const clave = JSON.stringify(geometria(a)) + '|' + JSON.stringify(recorte(a));
  return deCache(id + '|' + ancho, clave, () => leerSinCache(gif, ancho, a));
}

function leerSinCache(gif, ancho, a) {
  const origen = document.createElement('canvas');
  const recortado = document.createElement('canvas');
  const destino = document.createElement('canvas');
  destino.width = ancho;
  destino.height = D.ALTO;
  const r = recorte(a);
  const g = geometria(a);
  const grises = [];
  const delays = [];
  let octx = null;
  decodificarGif(gif.buffer, (rgba, delay, i, W, H) => {
    if (!octx || origen.width !== W || origen.height !== H) {
      origen.width = W;
      origen.height = H;
      octx = origen.getContext('2d', { willReadFrequently: true });
    }
    octx.putImageData(new ImageData(rgba, W, H), 0, 0);
    // Recorte del GIF original (porcentaje de cada borde) antes de acomodarlo.
    const sx = Math.round((W * r.izq) / 100), sy = Math.round((H * r.arriba) / 100);
    const sw = Math.max(1, W - sx - Math.round((W * r.der) / 100)), sh = Math.max(1, H - sy - Math.round((H * r.abajo) / 100));
    recortado.width = sw;
    recortado.height = sh;
    recortado.getContext('2d').drawImage(origen, sx, sy, sw, sh, 0, 0, sw, sh);
    acomodarEnDestino(recortado, sw, sh, g, destino);
    grises.push(grisesDeCanvas(destino));
    delays.push(delay);
  });
  return { grises, delays };
}

// ---- Partir en dos MITADES movibles (pedido del dueño, 2026-11-24) ----
// El GIF (recortado, girado y volteado) se acomoda como si fuera una escena de 256×64 (con el Encuadre elegido) y se corta en
// "corte" % de su ancho. Cada mitad se dibuja en SU pantalla de 128×64: con ↔ y ↕ en 0 quedan pegadas al borde donde se
// juntan los Pepitos (igual que una escena continua); con otros valores cada una se corre dentro de su pantalla.
const mover = () => ({
  izqX: numero('movIzqX', 0, -128, 128), izqY: numero('movIzqY', 0, -64, 64),
  derX: numero('movDerX', 0, -128, 128), derY: numero('movDerY', 0, -64, 64),
});

function orientar(fuente, sw, sh, g, lienzo) {
  const giro = g.rotar === 90 || g.rotar === 270;
  lienzo.width = giro ? sh : sw;
  lienzo.height = giro ? sw : sh;
  const ctx = lienzo.getContext('2d');
  ctx.save();
  ctx.translate(lienzo.width / 2, lienzo.height / 2);
  ctx.scale(g.volteoH ? -1 : 1, g.volteoV ? -1 : 1);
  ctx.rotate((g.rotar * Math.PI) / 180);
  ctx.drawImage(fuente, -sw / 2, -sh / 2);
  ctx.restore();
}

// Lo caro (leer el GIF, recortar, girar y escalarlo al tamaño de la escena) se guarda UNA vez por GIF y geometría; cortar y
// mover las mitades solo recompone la escena desde ahí.
function leerEscalado() {
  const gif = gifs.escena;
  if (!gif) return null;
  const a = ajustesDe('escena');
  const g = geometria(a);
  return deCache('escena|escalado', JSON.stringify(g) + '|' + JSON.stringify(recorte(a)), () => leerEscaladoSinCache(gif, g, recorte(a)));
}

function leerEscaladoSinCache(gif, g, r) {
  const origen = document.createElement('canvas');
  const recortado = document.createElement('canvas');
  const orientado = document.createElement('canvas');
  const cuadros = [], delays = [];
  let medidas = null;
  let octx = null;
  decodificarGif(gif.buffer, (rgba, delay, i, W, H) => {
    if (!octx || origen.width !== W || origen.height !== H) {
      origen.width = W;
      origen.height = H;
      octx = origen.getContext('2d', { willReadFrequently: true });
    }
    octx.putImageData(new ImageData(rgba, W, H), 0, 0);
    const sx = Math.round((W * r.izq) / 100), sy = Math.round((H * r.arriba) / 100);
    const sw = Math.max(1, W - sx - Math.round((W * r.der) / 100)), sh = Math.max(1, H - sy - Math.round((H * r.abajo) / 100));
    recortado.width = sw;
    recortado.height = sh;
    recortado.getContext('2d').drawImage(origen, sx, sy, sw, sh, 0, 0, sw, sh);
    orientar(recortado, sw, sh, g, orientado);
    const rw = orientado.width, rh = orientado.height;
    // Tamaño dentro de la escena de 256×64, como acomodarEnDestino (Ajustar, Llenar, Estirar u Original).
    const ANCHO_ESCENA = 2 * D.ANCHO;
    let fw, fh;
    if (g.escala === 'estirar') { fw = ANCHO_ESCENA; fh = D.ALTO; }
    else if (g.escala === 'original') { fw = rw; fh = rh; }
    else if ((g.escala === 'llenar') === (rw / rh > ANCHO_ESCENA / D.ALTO)) { fh = D.ALTO; fw = Math.max(1, Math.round((D.ALTO * rw) / rh)); }
    else { fw = ANCHO_ESCENA; fh = Math.max(1, Math.round((ANCHO_ESCENA * rh) / rw)); }
    medidas = { fw, fh, x0: Math.round((ANCHO_ESCENA - fw) / 2), y0: Math.round((D.ALTO - fh) / 2) };
    // El cuadro ya escalado al tamaño de la escena (lo que se guarda).
    const escalado = document.createElement('canvas');
    escalado.width = fw;
    escalado.height = fh;
    const ectx = escalado.getContext('2d');
    ectx.imageSmoothingEnabled = g.escala !== 'original';
    ectx.imageSmoothingQuality = 'high';
    ectx.drawImage(orientado, 0, 0, rw, rh, 0, 0, fw, fh);
    cuadros.push(escalado);
    delays.push(delay);
  });
  return { cuadros, delays, ...medidas, fondo: g.fondo };
}

// Escena de 256×64 con cada mitad recortada a SU pantalla y corrida lo pedido; se pixela entera (sin costura cuando están
// juntas) y después se parte. Devuelve { izq: [bitmap], der: [bitmap], delays }.
function mitades() {
  const e = leerEscalado();
  if (!e) return null;
  const corte = numero('corteMitades', 50, 10, 90);
  const m = mover();
  const escena = document.createElement('canvas');
  escena.width = 2 * D.ANCHO;
  escena.height = D.ALTO;
  const ctx = escena.getContext('2d', { willReadFrequently: true });
  const cortePx = Math.max(1, Math.min(e.fw - 1, Math.round((e.fw * corte) / 100)));
  // El hueco entre las pantallas: esos puntos del GIF quedan "detrás del plástico" (no se ven en ninguna).
  const hueco = huecoPx();
  const desdeDer = Math.min(e.fw, cortePx + hueco);
  $('huecoTexto').textContent = hueco ? `mm (≈ ${hueco} puntos de pantalla)` : 'mm (0 = como si se tocaran)';
  const izq = [], der = [];
  for (const cuadro of e.cuadros) {
    ctx.fillStyle = e.fondo === 'blanco' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, escena.width, D.ALTO);
    for (const [desde, ancho, x, y, recorteX] of [
      // En 0 la mitad izquierda termina justo en el borde donde se juntan (x 128) y la derecha empieza ahí, sea cual sea el corte.
      [0, cortePx, D.ANCHO - cortePx + m.izqX, e.y0 + m.izqY, 0],
      [desdeDer, e.fw - desdeDer, D.ANCHO + m.derX, e.y0 + m.derY, D.ANCHO],
    ]) {
      if (ancho <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(recorteX, 0, D.ANCHO, D.ALTO); // cada mitad solo se ve en su pantalla
      ctx.clip();
      ctx.drawImage(cuadro, desde, 0, ancho, e.fh, x, y, ancho, e.fh);
      ctx.restore();
    }
    const partes = D.partirEscena(binarizar(grisesDeCanvas(escena), 2 * D.ANCHO, ajustesDe('escena')));
    izq.push(partes.izq);
    der.push(partes.der);
  }
  return { izq, der, delays: e.delays };
}

// Texto encima (2026-11-24): se dibuja con dibujarOLED de la app (las mismas letras que la TV) en una pantalla de 128×64 y se
// toma como máscara de 1024 bytes. null si no hay texto.
function mascaraTexto() {
  const texto = valor('textoEncima').trim();
  if (!texto) return null;
  const lienzo = document.createElement('canvas');
  lienzo.width = D.ANCHO;
  lienzo.height = D.ALTO;
  dibujarOLED(lienzo, {
    tipo: 'texto', texto, tamano: numero('textoTamano', 1, 1, 5), fuente: valor('textoFuente'), alineacion: 'izquierda', alineacionV: 'arriba',
    modoTexto: 'ajustar', manual: true, x: numero('textoX', 0, 0, 127), y: numero('textoY', 0, 0, 63), invertido: false, direccion: 'h',
  });
  const d = lienzo.getContext('2d').getImageData(0, 0, D.ANCHO, D.ALTO).data;
  const m = new Uint8Array(D.BYTES_PANTALLA);
  for (let y = 0; y < D.ALTO; y++) for (let x = 0; x < D.ANCHO; x++) if (d[(y * D.ANCHO + x) * 4 + 2] > 128) m[y * 16 + (x >> 3)] |= 0x80 >> (x & 7);
  return m;
}

function binarizar(gris, ancho, a) {
  const umbral = limitar(a.umbral, 127, 1, 254);
  const bm = a.pixelar ? grisABitmapAtkinson(gris, ancho, D.ALTO, umbral) : grisABitmapUmbral(gris, ancho, D.ALTO, umbral);
  return a.invertir ? D.invertir(bm) : bm;
}

// GIF de una TV (128×64) -> cuadros [{dur, bitmap}] ya con vueltas y velocidad.
// Recortar el principio y el final de un GIF (pedido 2026-11-24): "Usar desde el cuadro … hasta el …" (los virales suelen tener
// entrada y salida). sufijo = el de los campos (Tiempo, Escena, 1, 2). Muestra cuántos cuadros tiene.
function rangoDeCuadros(sufijo, total) {
  $('total' + sufijo).textContent = `(de ${total})`;
  const desde = numero('desde' + sufijo, 1, 1, total);
  const hasta = Math.max(desde, numero('hasta' + sufijo, total, 1, total));
  return [desde - 1, hasta];
}

function cuadrosDeGif(id, vueltasId, velocidadId, sufijo) {
  const leido = leer(id, D.ANCHO);
  if (!leido) return null;
  const [a, b] = rangoDeCuadros(sufijo, leido.grises.length);
  const crudos = leido.grises.slice(a, b).map((gris, i) => ({ dur: leido.delays[a + i], bitmap: binarizar(gris, D.ANCHO, ajustesDe(id)) }));
  return D.prepararCuadros(D.ordenar(crudos, valor('orden' + sufijo)), { vueltas: numero(vueltasId, 1, 1, 20), velocidad: numero(velocidadId, 100, 10, 400) / 100 });
}

// El hueco entre las pantallas, en puntos: la pantalla de 0,96" mide ~21,74 mm de ancho para sus 128 puntos.
const huecoPx = () => Math.round((numero('huecoMm', 0, 0, 60) * D.ANCHO) / 21.74);

// ---------------------------------------------------------------------------------------------------------------------
// Armar el dúo
// ---------------------------------------------------------------------------------------------------------------------
let ultimo = null; // { duo, paquete, mitades: { izq, der } } (mitades = lo decodificado del paquete)
let turno = 0;

function pistasYSonidoInicio() {
  if (valor('modo') === 'tiempo') {
    // Un GIF partido en el TIEMPO: lo de antes del corte en un Pepito y, apenas termina, el resto en el otro.
    const todo = cuadrosDeGif('tiempo', 'vueltasTiempo', 'velocidadTiempo', 'Tiempo');
    if (!todo) return null;
    const tvPrimera = valor('tvTiempo');
    const tvSegunda = tvPrimera === 'der' ? 'izq' : 'der';
    const total = D.duracionDe(todo);
    const n = todo.length;
    if (n < 2) {
      $('corteTiempoTexto').textContent = 'El GIF tiene un solo cuadro: va entero en el primero.';
      return { pistas: [{ tv: tvPrimera, inicio: 0, cuadros: todo }], inicioDe: () => 0 };
    }
    // El corte es DESPUÉS de un cuadro (no a ciegas en un porcentaje). Al cargar un GIF nuevo empieza en la mitad.
    const barra = $('corteTiempo');
    barra.max = String(n - 1);
    if (barra.dataset.nuevo) { barra.value = String(Math.max(1, Math.floor(n / 2))); delete barra.dataset.nuevo; }
    const k = numero('corteTiempo', Math.floor(n / 2), 1, n - 1);
    const corteMs = D.duracionDe(todo.slice(0, k));
    const pausa = numero('pausaTiempo', 0, 0, 5000);
    const { primera, segunda } = D.partirEnTiempo(todo, corteMs);
    $('corteTiempoTexto').textContent = `después del cuadro ${k} de ${n} (${corteMs} de ${total} ms)`;
    const pistas = [{ tv: tvPrimera, inicio: 0, cuadros: primera }, { tv: tvSegunda, inicio: corteMs + pausa, cuadros: segunda }];
    return { pistas, inicioDe: (tv) => (tv === tvPrimera ? 0 : corteMs + pausa) };
  }
  if (valor('modo') === 'escena') {
    // Un GIF partido en dos MITADES, cada una en su pantalla y movible.
    const leido = mitades();
    if (!leido) return null;
    $('corteMitadesTexto').textContent = `${numero('corteMitades', 50, 10, 90)} %`;
    const [a, b] = rangoDeCuadros('Escena', leido.izq.length);
    const izq = leido.izq.slice(a, b).map((bitmap, i) => ({ dur: leido.delays[a + i], bitmap }));
    const der = leido.der.slice(a, b).map((bitmap, i) => ({ dur: leido.delays[a + i], bitmap }));
    const op = { vueltas: numero('vueltasEscena', 1, 1, 20), velocidad: numero('velocidadEscena', 100, 10, 400) / 100 };
    return {
      pistas: [{ tv: 'izq', inicio: 0, cuadros: D.prepararCuadros(D.ordenar(izq, valor('ordenEscena')), op) }, { tv: 'der', inicio: 0, cuadros: D.prepararCuadros(D.ordenar(der, valor('ordenEscena')), op) }],
      inicioDe: () => 0,
    };
  }
  const tv1 = valor('tv1');
  const tv2 = tv1 === 'der' ? 'izq' : 'der';
  const c1 = cuadrosDeGif('g1', 'vueltas1', 'velocidad1', '1');
  const c2 = cuadrosDeGif('g2', 'vueltas2', 'velocidad2', '2');
  if (!c1 && !c2) return null;
  const inicio2 = valor('inicio2') === 'ms' ? numero('inicioMs', 0, 0, 15000) : (c1 ? D.duracionDe(c1) : 0);
  const pistas = [];
  if (c1) pistas.push({ tv: tv1, inicio: 0, cuadros: c1 });
  if (c2) pistas.push({ tv: tv2, inicio: inicio2, cuadros: c2 });
  return { pistas, inicioDe: (tv) => (pistas.find((p) => p.tv === tv) || { inicio: 0 }).inicio };
}

async function armar() {
  const t = ++turno;
  aviso('');
  let base;
  try {
    base = pistasYSonidoInicio();
  } catch (e) {
    console.error('[duos] no se pudo leer el GIF:', e);
    mostrarDatos('No se pudo leer ese GIF: ' + (e && e.message ? e.message : 'archivo dañado') + '.', true);
    return;
  }
  if (!base) {
    ultimo = null;
    habilitar(false);
    dibujarVacio();
    mostrarDatos('Carga un GIF para empezar.');
    return;
  }
  const claveSonido = valor('sonido');
  const tvSonido = valor('sonidoTv');
  const inicioSonido = valor('sonidoInicio') === 'ms' ? numero('sonidoMs', 0, 0, 15000) : base.inicioDe(tvSonido);
  let notasSonido = null;
  if (claveSonido.startsWith('cancion:')) {
    // Un tramo de una canción del catálogo (pedido del dueño, 2026-11-24): desde el segundo elegido y lo que dure la animación
    // (desde que empieza el sonido) o los segundos elegidos.
    const c = await cancion(claveSonido.slice('cancion:'.length));
    if (t !== turno) return;
    if (c) {
      const finAnimacion = Math.max(0, ...base.pistas.map((p) => p.inicio + D.duracionDe(p.cuadros)));
      const dura = valor('cancionCuanto') === 'segundos' ? numero('cancionSegundos', 3, 0.2, 15) * 1000 : Math.max(200, finAnimacion - inicioSonido);
      notasSonido = D.tramoDeCancion(c.notas, c.duracion, numero('cancionDesde', 0, 0, 600) * 1000, dura);
      $('cancionLargo').textContent = `(la canción dura ${(c.duracion / 1000).toFixed(1)} s)`;
    } else {
      $('cancionLargo').textContent = '(no se pudo leer la canción)';
    }
  } else if (claveSonido) {
    notasSonido = D.SONIDOS[claveSonido].notas;
  }
  const sonido = notasSonido && notasSonido.length ? { tv: tvSonido, inicio: inicioSonido, notas: notasSonido } : null;
  const duo = D.armarDuo({ pistas: base.pistas, espera: { izq: valor('espera'), der: valor('espera') }, alTerminar: valor('alTerminar'), sonido });
  const mascara = mascaraTexto();
  if (mascara) {
    const tvTexto = valor('textoTv');
    const hasta = numero('textoHasta', 0, 0, 15000) || duo.duracion;
    duo[tvTexto].cuadros = D.superponer(duo[tvTexto].cuadros, duo.duracion, mascara, numero('textoDesde', 0, 0, 15000), hasta, valor('textoColor') === 'apagar');
  }
  const nombre = valor('nombre').trim() || 'Dúo';
  const portadaMs = $('portadaMs').value === '' ? undefined : numero('portadaMs', 0, 0, 15000);
  const paquete = await D.empaquetarDuo(duo, { nombre, clave: D.claveDe(nombre), codificarMusical, portadaMs });
  const mitades = { izq: await decodificarMusical(paquete.izq.datos), der: await decodificarMusical(paquete.der.datos) };
  if (t !== turno) return; // cambió algo mientras se armaba
  ultimo = { duo, paquete, mitades };
  parar();
  dibujarEn(0);
  habilitar(true);
  const kb = (b) => (b / 1024).toFixed(1) + ' KB';
  const avisos = [];
  if (duo.duracion > D.LIMITES.duracionMaxima) avisos.push(`dura más de ${D.LIMITES.duracionMaxima / 1000} s`);
  for (const tv of ['izq', 'der']) {
    if (paquete[tv].bytes > D.LIMITES.recomendadoMitad) avisos.push(`la mitad ${tv === 'izq' ? 'izquierda' : 'derecha'} pesa más de ${kb(D.LIMITES.recomendadoMitad)}`);
  }
  const paraFirmware = paquete.izq.bytes <= D.LIMITES.pruebaMitad && paquete.der.bytes <= D.LIMITES.pruebaMitad;
  mostrarDatos([
    `Duración: ${(duo.duracion / 1000).toFixed(2)} s · portada a los ${paquete.portada.t} ms`,
    `Izquierda: ${kb(paquete.izq.bytes)}, ${paquete.izq.imagenes} imágenes, ${duo.izq.cuadros.length} cambios${duo.izq.notas.length ? ', con sonido' : ''}`,
    `Derecha:   ${kb(paquete.der.bytes)}, ${paquete.der.imagenes} imágenes, ${duo.der.cuadros.length} cambios${duo.der.notas.length ? ', con sonido' : ''}`,
    paraFirmware ? 'Cabe como dúo de prueba del firmware.' : `Para el dúo de prueba del firmware conviene menos de ${kb(D.LIMITES.pruebaMitad)} por mitad.`,
    ...avisos.map((a) => 'Ojo: ' + a + ' (límite propuesto).'),
  ].join('\n'), avisos.length > 0);
}

let espera = null;
function programar() {
  clearTimeout(espera);
  espera = setTimeout(() => { armar().catch(fallo); }, 150);
}

// ---------------------------------------------------------------------------------------------------------------------
// Vista previa: dos pantallas, cada una con su mitad DECODIFICADA; el sonido de la mitad que lo lleva (WebAudio)
// ---------------------------------------------------------------------------------------------------------------------
const lienzos = { izq: $('vistaIzq'), der: $('vistaDer') };
const visto = { izq: null, der: null };

function pintar(canvas, bitmap) {
  const ctx = canvas.getContext('2d');
  const esc = canvas.width / D.ANCHO;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4DD2FF';
  for (let y = 0; y < D.ALTO; y++) {
    for (let x = 0; x < D.ANCHO; x++) {
      if (bitmap[y * 16 + (x >> 3)] & (0x80 >> (x & 7))) ctx.fillRect(x * esc, y * esc, esc, esc);
    }
  }
}

function dibujarVacio() {
  for (const tv of ['izq', 'der']) { pintar(lienzos[tv], D.negro()); visto[tv] = null; }
}

function cuadroEn(cuadros, t) {
  let c = cuadros[0];
  for (const x of cuadros) { if (x.t <= t) c = x; else break; }
  return c;
}

function dibujarEn(t) {
  if (!ultimo) return;
  const numeros = {};
  for (const tv of ['izq', 'der']) {
    const lista = ultimo.mitades[tv].cuadros;
    const c = cuadroEn(lista, t);
    numeros[tv] = `${lista.indexOf(c) + 1}/${lista.length}`;
    if (c && c !== visto[tv]) { pintar(lienzos[tv], c.bitmap); visto[tv] = c; }
  }
  // La barra de tiempo (pedido 2026-11-24): dónde va y qué imagen muestra cada Pepito en ese momento.
  $('barraTiempo').value = String(Math.round(t));
  $('barraTexto').textContent = `${Math.round(t)} ms · izquierdo ${numeros.izq} · derecho ${numeros.der}`;
}

let animacion = null; // { inicio, raf, audio }
function reproducir() {
  if (!ultimo) return;
  parar();
  const inicio = performance.now();
  let audio = null;
  if (marcado('conSonido')) {
    const tv = ultimo.mitades.izq.notas.length ? 'izq' : ultimo.mitades.der.notas.length ? 'der' : null;
    if (tv) {
      try {
        audio = new AudioContext();
        const ganancia = audio.createGain();
        ganancia.gain.value = 0.04;
        ganancia.connect(audio.destination);
        const notas = ultimo.mitades[tv].notas;
        notas.forEach((n, i) => {
          if (!n.f) return;
          const fin = i + 1 < notas.length ? notas[i + 1].t : ultimo.duo.duracion;
          const osc = audio.createOscillator();
          osc.type = 'square';
          osc.frequency.value = n.f;
          osc.connect(ganancia);
          osc.start(audio.currentTime + n.t / 1000);
          osc.stop(audio.currentTime + fin / 1000);
        });
      } catch (e) { console.warn('[duos] sin sonido en la vista previa:', e); }
    }
  }
  const paso = () => {
    const t = performance.now() - inicio;
    dibujarEn(Math.min(t, ultimo.duo.duracion));
    if (t < ultimo.duo.duracion) animacion.raf = requestAnimationFrame(paso);
    else parar(true);
  };
  animacion = { inicio, audio, raf: requestAnimationFrame(paso) };
  $('botonParar').disabled = false;
}

function parar(seQuedaAlFinal = false) {
  if (animacion) {
    cancelAnimationFrame(animacion.raf);
    if (animacion.audio) animacion.audio.close().catch(() => {});
    animacion = null;
  }
  $('botonParar').disabled = true;
  if (!seQuedaAlFinal && ultimo) { visto.izq = visto.der = null; dibujarEn(0); }
}

// ---------------------------------------------------------------------------------------------------------------------
// Descargas
// ---------------------------------------------------------------------------------------------------------------------
function descargar(nombre, texto, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------------------------------------------------
function aviso(texto, mal = false) {
  $('aviso').textContent = texto || '';
  $('aviso').classList.toggle('mal', !!mal);
}
function mostrarDatos(texto, mal = false) {
  $('datos').textContent = texto;
  $('datos').classList.toggle('mal', !!mal);
}
function habilitar(si) {
  for (const id of ['botonReproducir', 'botonPaquete', 'botonCabecera', 'barraTiempo', 'botonProbar']) $(id).disabled = !si;
  $('botonSubir').disabled = !si || !soyAdmin;
  if (si && ultimo) $('barraTiempo').max = String(ultimo.duo.duracion);
  if (!si) $('barraTexto').textContent = '';
}
function fallo(e) {
  console.error('[duos] error:', e);
  aviso('Algo salió mal. Vuelve a intentarlo.', true);
}

// ---------------------------------------------------------------------------------------------------------------------
// Tu cuenta y tus canciones (pedido 2026-11-24): el catálogo de canciones (musicales/) se lee con la sesión iniciada.
// ---------------------------------------------------------------------------------------------------------------------
const canciones = new Map(); // clave -> { notas, duracion } (decodificada una vez)
async function cancion(clave) {
  if (canciones.has(clave)) return canciones.get(clave);
  try {
    const datos = await leerMusical(clave);
    if (!datos) return null;
    const m = await decodificarMusical(datos);
    const c = { notas: m.notas, duracion: m.duracion };
    canciones.set(clave, c);
    return c;
  } catch (e) {
    console.warn('[duos] no se pudo leer la canción:', e);
    return null;
  }
}

async function cargarCanciones() {
  const lista = await listarMusicales();
  const sel = $('sonido');
  const elegido = sel.value;
  const viejo = sel.querySelector('optgroup');
  if (viejo) viejo.remove();
  if (!lista || !Object.keys(lista).length) return;
  const grupo = document.createElement('optgroup');
  grupo.label = 'Tus canciones';
  Object.entries(lista)
    .map(([clave, m]) => ({ clave, nombre: (m && m.nombre) || clave }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .forEach((c) => grupo.append(new Option(c.nombre, 'cancion:' + c.clave)));
  sel.append(grupo);
  if ([...sel.options].some((o) => o.value === elegido)) sel.value = elegido;
  actualizarPaneles();
}

// Probar en mi Pepito (2026-11-24): manda una mitad del dúo a la Pepito Pro de la cuenta como una canción con letra SIN clave del
// catálogo (la forma anterior: el m1 va en oled_remota/archivo; la v11 la sigue aceptando). Nada nuevo en Firebase. Dos toques:
// el primero pide confirmar.
let sesionUid = null;
let confirmarProbar = false;
async function probarEnMiPepito() {
  if (!ultimo) return;
  if (!sesionUid) { aviso('Entra con tu cuenta (arriba) para probar en tu Pepito.', true); return; }
  if (!confirmarProbar) {
    confirmarProbar = true;
    aviso('Toca otra vez "Enviar a mi Pepito" para mandar esa mitad (se verá como una canción con letra).');
    setTimeout(() => { confirmarProbar = false; }, 8000);
    return;
  }
  confirmarProbar = false;
  const lista = await listarMisDispositivos(sesionUid);
  const id = lista && lista.exito ? lista.dispositivos.find((d) => !String(d).startsWith('lite:')) : null;
  if (!id) { aviso('No encontré un Pepito Pro en tu cuenta.', true); return; }
  usarCuenta(sesionUid, id);
  const tv = valor('probarMitad');
  aviso('Enviando a tu Pepito…');
  const r = await enviarEstado({
    tipo: 'musical', texto: '', tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar',
    fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h',
    musicalNombre: (ultimo.paquete.nombre || 'Dúo') + (tv === 'izq' ? ' (izquierda)' : ' (derecha)'), musicalRepeticiones: 1,
    musicalDatos: ultimo.paquete[tv].datos,
  });
  aviso(r && r.exito ? 'Listo: mira tu Pepito.' : (r && r.error) ? `No se pudo enviar: ${r.error}.` : 'No se pudo enviar.', !(r && r.exito));
}

function iniciarCuenta() {
  $('formEntrar').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('estadoCuenta').textContent = 'Entrando…';
    const r = await iniciarSesion($('correo').value.trim(), $('clave').value);
    $('clave').value = '';
    if (!r || !r.exito) $('estadoCuenta').textContent = (r && r.error) || 'No se pudo entrar.';
  });
  escucharSesion((usuario) => {
    sesionUid = usuario ? usuario.uid : null;
    $('formEntrar').hidden = !!usuario;
    soyAdmin = false;
    $('botonSubir').disabled = true;
    if (usuario) {
      $('estadoCuenta').textContent = `Sesión iniciada: ${usuario.email}. Tus canciones están en la lista de sonidos.`;
      cargarCanciones().catch((e) => console.warn('[duos] no se pudo leer el catálogo de canciones:', e));
      usarCuenta(usuario.uid, ''); // esAdministrador mira la cuenta en uso (igual que el editor de caras)
      esAdministrador().then((si) => {
        soyAdmin = !!si;
        $('botonSubir').disabled = !ultimo || !soyAdmin;
        if (soyAdmin) refrescarCatalogo().catch(fallo);
        else $('listaCatalogo').innerHTML = '<li class="nota">Solo una cuenta de administrador puede subir al catálogo.</li>';
      }).catch(fallo);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Catálogo de la nube (2026-11-24, aprobado por el dueño: duos/indice|datos; solo un administrador escribe). Subir el dúo
// armado (o un .duo.json abierto) y ver o borrar lo que ya hay. Subir y borrar piden un segundo toque.
// ---------------------------------------------------------------------------------------------------------------------
let soyAdmin = false;
let catalogo = [];
let confirmarSubir = '';
let confirmarBorrar = '';

function dibujarPortada(canvas, b64) {
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 64);
  if (!b64) return;
  const bytes = D.deBase64(b64);
  if (bytes.length !== 2048) return;
  ctx.fillStyle = '#4DD2FF';
  for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) if (bytes[y * 32 + (x >> 3)] & (0x80 >> (x & 7))) ctx.fillRect(x, y, 1, 1);
}

async function refrescarCatalogo() {
  catalogo = await unificadaListarDuos();
  const lista = $('listaCatalogo');
  lista.innerHTML = '';
  if (!catalogo.length) {
    lista.innerHTML = '<li class="nota">Todavía no hay dúos en el catálogo.</li>';
    return;
  }
  for (const d of catalogo) {
    const li = document.createElement('li');
    li.dataset.clave = d.clave;
    const c = document.createElement('canvas');
    dibujarPortada(c, d.portada);
    const texto = document.createElement('span');
    texto.textContent = `${d.orden}. ${d.nombre} (${(d.duracion / 1000).toFixed(1)} s)`;
    const borrar = document.createElement('button');
    borrar.type = 'button';
    borrar.textContent = 'Borrar';
    borrar.addEventListener('click', () => { borrarDelCatalogo(d.clave, d.nombre).catch(fallo); });
    li.append(c, texto, borrar);
    lista.append(li);
  }
}

async function subirAlCatalogo() {
  if (!ultimo || !soyAdmin) return;
  const p = ultimo.paquete;
  const nombre = String(p.nombre || '').trim();
  if (!nombre) { aviso('Ponle un nombre al dúo antes de subirlo.', true); return; }
  const clave = D.claveDe(nombre);
  if (confirmarSubir !== clave) {
    confirmarSubir = clave;
    const yaEsta = catalogo.some((d) => d.clave === clave);
    aviso(yaEsta ? `Ya hay un dúo "${nombre}" en el catálogo. Toca otra vez "Subir al catálogo" para reemplazarlo.`
      : `Toca otra vez "Subir al catálogo" para subir "${nombre}" (lo verán todas las Pepito Pro).`);
    setTimeout(() => { if (confirmarSubir === clave) confirmarSubir = ''; }, 8000);
    return;
  }
  confirmarSubir = '';
  const orden = Math.max(0, Math.min(999, Math.round(Number($('ordenCatalogo').value) || 0)));
  aviso('Subiendo…');
  const r = await unificadaGuardarDuoCatalogo(clave, {
    nombre, orden, duracion: p.duracion, portada: D.portadaEscena(p), izq: p.izq.datos, der: p.der.datos,
  });
  if (!r || !r.exito) { aviso((r && r.error) || 'No se pudo subir.', true); return; }
  aviso(`Listo: "${nombre}" está en el catálogo.`);
  await refrescarCatalogo();
}

async function borrarDelCatalogo(clave, nombre) {
  if (confirmarBorrar !== clave) {
    confirmarBorrar = clave;
    aviso(`Toca otra vez "Borrar" para quitar "${nombre}" del catálogo.`);
    setTimeout(() => { if (confirmarBorrar === clave) confirmarBorrar = ''; }, 8000);
    return;
  }
  confirmarBorrar = '';
  const r = await unificadaBorrarDuoCatalogo(clave);
  if (!r || !r.exito) { aviso((r && r.error) || 'No se pudo borrar.', true); return; }
  aviso(`Listo: "${nombre}" ya no está en el catálogo.`);
  await refrescarCatalogo();
}

// ---------------------------------------------------------------------------------------------------------------------
// Proyectos (pedido 2026-11-24): guardar los GIF y todos los ajustes para seguir otro día; abrir un dúo ya hecho para verlo.
// ---------------------------------------------------------------------------------------------------------------------
const SIN_GUARDAR = ['barraTiempo', 'conSonido', 'archivoAbrir', 'correo', 'clave']; // el correo y la contraseña NUNCA se guardan
const camposDelProyecto = () => [...document.querySelectorAll('input, select')].filter((el) => el.id && el.type !== 'file' && !SIN_GUARDAR.includes(el.id));

function guardarProyecto() {
  ajustes[editando] = leerAjustesDePantalla();
  const controles = {};
  for (const el of camposDelProyecto()) controles[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  const archivos = {};
  for (const [id, g] of Object.entries(gifs)) if (g) archivos[id] = { nombre: g.nombre, datos: D.aBase64(new Uint8Array(g.buffer)) };
  const proyecto = { formato: 'duo-proyecto', version: 1, controles, ajustes, editando, gifs: archivos };
  descargar(`${D.claveDe(valor('nombre') || 'duo')}.proyecto-duo.json`, JSON.stringify(proyecto), 'application/json');
  aviso('Proyecto guardado.');
}

async function abrirArchivo(input) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;
  input.value = '';
  let j;
  try { j = JSON.parse(await archivo.text()); } catch (e) { aviso('Ese archivo no es un proyecto ni un dúo.', true); return; }
  if (j && j.formato === 'duo-proyecto') {
    for (const id of Object.keys(gifs)) gifs[id] = null;
    for (const [id, g] of Object.entries(j.gifs || {})) if (id in gifs && g && g.datos) gifs[id] = { nombre: g.nombre || id, buffer: D.deBase64(g.datos).buffer };
    lecturas.clear();
    for (const [id, v] of Object.entries(j.controles || {})) {
      const el = $(id);
      if (!el || el.type === 'file') continue;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    }
    for (const k of ['general', 'g1', 'g2']) ajustes[k] = (j.ajustes && j.ajustes[k]) || null;
    if (!ajustes.general) ajustes.general = leerAjustesDePantalla();
    editando = ajustes[j.editando] ? j.editando : 'general';
    ponerAjustesEnPantalla(ajustes[editando]);
    actualizarPaneles();
    programar();
    aviso('Proyecto abierto.');
    return;
  }
  if (j && j.formato === 'duo1' && j.izq && j.der) {
    // Un dúo ya armado: solo para ver (y volver a bajar). Al cambiar cualquier ajuste se vuelve a lo que se está editando.
    turno++;
    const mitadesDuo = { izq: await decodificarMusical(j.izq.datos), der: await decodificarMusical(j.der.datos) };
    const duo = { duracion: j.duracion, izq: { cuadros: mitadesDuo.izq.cuadros, notas: mitadesDuo.izq.notas }, der: { cuadros: mitadesDuo.der.cuadros, notas: mitadesDuo.der.notas } };
    ultimo = { duo, paquete: j, mitades: mitadesDuo };
    $('nombre').value = j.nombre || '';
    parar();
    visto.izq = visto.der = null;
    dibujarEn(0);
    habilitar(true);
    mostrarDatos(`Dúo abierto (solo para ver): ${j.nombre || j.clave}\nDuración: ${(j.duracion / 1000).toFixed(2)} s\nIzquierda: ${(j.izq.bytes / 1024).toFixed(1)} KB · Derecha: ${(j.der.bytes / 1024).toFixed(1)} KB`);
    aviso('Dúo abierto.');
    return;
  }
  aviso('Ese archivo no es un proyecto ni un dúo.', true);
}

function actualizarPaneles() {
  const modo = valor('modo');
  $('filaSeparados').hidden = modo !== 'dos';
  $('campoDeQue').hidden = !separados();
  // Fuera del modo de dos GIF (o sin ajustes separados) se editan los ajustes generales.
  if (!separados() && editando !== 'general') { editando = 'general'; ponerAjustesEnPantalla(ajustes.general); }
  $('panelTiempo').hidden = modo !== 'tiempo';
  $('panelEscena').hidden = modo !== 'escena';
  $('panelDos').hidden = modo !== 'dos';
  $('panelEspera').hidden = modo === 'escena'; // con las mitades, los dos Pepitos animan a la vez: no hay espera
  $('tv2texto').textContent = valor('tv1') === 'der' ? '(en el Pepito de la izquierda)' : '(en el Pepito de la derecha)';
  $('campoInicioMs').hidden = valor('inicio2') !== 'ms';
  $('campoSonidoMs').hidden = valor('sonidoInicio') !== 'ms';
  $('panelCancion').hidden = !valor('sonido').startsWith('cancion:');
  $('campoCancionSegundos').hidden = valor('cancionCuanto') !== 'segundos';
}

async function tomarArchivo(input, id) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;
  try {
    comprobarTamanoArchivo(archivo);
    const buffer = await archivo.arrayBuffer();
    if (!esGif(buffer)) { aviso('Ese archivo no es un GIF.', true); return; }
    gifs[id] = { buffer, nombre: archivo.name };
    if (id === 'tiempo') $('corteTiempo').dataset.nuevo = '1'; // el corte empieza en la mitad del GIF nuevo
    for (const k of [...lecturas.keys()]) if (k.startsWith(id + '|')) lecturas.delete(k);
    if (!valor('nombre').trim()) $('nombre').value = archivo.name.replace(/\.gif$/i, '').slice(0, 30);
    programar();
  } catch (e) {
    aviso(e && e.name === 'ArchivoDemasiadoGrande' ? e.message : 'No se pudo leer ese archivo.', true);
  }
}

function iniciar() {
  const sel = $('sonido');
  sel.append(new Option('Sin sonido', ''));
  for (const [clave, s] of Object.entries(D.SONIDOS)) sel.append(new Option(s.nombre, clave));
  sel.value = 'corazon';

  $('gifTiempo').addEventListener('change', (e) => tomarArchivo(e.target, 'tiempo'));
  $('gifEscena').addEventListener('change', (e) => tomarArchivo(e.target, 'escena'));
  $('botonJuntar').addEventListener('click', () => {
    for (const id of ['movIzqX', 'movIzqY', 'movDerX', 'movDerY']) $(id).value = '0';
    programar();
  });
  $('gif1').addEventListener('change', (e) => tomarArchivo(e.target, 'g1'));
  $('gif2').addEventListener('change', (e) => tomarArchivo(e.target, 'g2'));
  // Ajustes de imagen: los de la tarjeta se guardan en los del GIF que se está editando (o en los generales).
  ajustes.general = leerAjustesDePantalla();
  const guardarAjustes = (el) => { if (el && CAMPOS_IMAGEN.includes(el.id)) ajustes[editando] = leerAjustesDePantalla(); };
  $('ajustesSeparados').addEventListener('change', (e) => {
    if (e.target.checked) {
      ajustes.g1 = Object.assign({}, ajustes.general);
      ajustes.g2 = Object.assign({}, ajustes.general);
      editando = valor('ajustesDeQue');
    } else {
      editando = 'general';
    }
    ponerAjustesEnPantalla(ajustes[editando]);
  });
  $('ajustesDeQue').addEventListener('change', (e) => {
    editando = e.target.value;
    ponerAjustesEnPantalla(ajustes[editando] || ajustes.general);
  });
  $('botonGuardarProyecto').addEventListener('click', guardarProyecto);
  $('botonProbar').addEventListener('click', () => { probarEnMiPepito().catch(fallo); });
  $('botonSubir').addEventListener('click', () => { subirAlCatalogo().catch(fallo); });
  $('botonPortadaAqui').addEventListener('click', () => { $('portadaMs').value = $('barraTiempo').value; programar(); });
  iniciarCuenta();
  $('archivoAbrir').addEventListener('change', (e) => { abrirArchivo(e.target).catch(fallo); });

  // No cambian el dúo: no se vuelve a armar (ni se borra el aviso) al tocarlos.
  const soloVista = (el) => el && ['barraTiempo', 'conSonido', 'probarMitad', 'correo', 'clave', 'ordenCatalogo'].includes(el.id);
  document.addEventListener('change', (e) => {
    if (!e.target || e.target.type === 'file' || soloVista(e.target)) return;
    guardarAjustes(e.target);
    actualizarPaneles();
    programar();
  });
  document.addEventListener('input', (e) => {
    if (soloVista(e.target)) return;
    guardarAjustes(e.target);
    if (e.target && (e.target.type === 'range' || e.target.type === 'number' || e.target.id === 'nombre' || e.target.id === 'textoEncima')) programar();
  });
  $('botonReproducir').addEventListener('click', reproducir);
  $('botonParar').addEventListener('click', () => parar());
  // Mover la barra detiene la reproducción y muestra ese momento (no vuelve a armar el dúo).
  $('barraTiempo').addEventListener('input', (e) => {
    e.stopPropagation();
    parar(true);
    dibujarEn(Number(e.target.value) || 0);
  });
  $('botonPaquete').addEventListener('click', () => {
    if (!ultimo) return;
    descargar(`${ultimo.paquete.clave}.duo.json`, JSON.stringify(ultimo.paquete, null, 1), 'application/json');
    aviso('Dúo descargado.');
  });
  $('botonCabecera').addEventListener('click', () => {
    if (!ultimo) return;
    descargar('duo_prueba.h', D.cabeceraC(ultimo.duo, ultimo.paquete), 'text/plain');
    aviso('Cabecera descargada: va en la carpeta del firmware como duo_prueba.h.');
  });
  window.addEventListener('error', (e) => fallo(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => fallo(e.reason));
  actualizarPaneles();
  dibujarVacio();
}

iniciar();
