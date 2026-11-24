// Editor de dúos (herramienta del dueño; docs/plan-duos.md, solo Pepito Pro). Lee los GIF con el mismo lector y los mismos
// ajustes que la app (js/gif.js, js/imageProcessor.js, sin tocarlos), arma el dúo con duo.js (la lógica pura, probada en Node)
// y lo codifica en m1 (js/compresion.js). La vista previa sale del paquete ya armado: lo mismo que reciben las TV.
// construir.mjs lo copia a www/ junto a la app (no va en la APK).
import { decodificarGif, comprobarTamanoArchivo, esGif } from './gif.js';
import { acomodarEnDestino, grisesDeCanvas, grisABitmapAtkinson, grisABitmapUmbral } from './imageProcessor.js';
import { codificarMusical, decodificarMusical } from './compresion.js';
import * as D from './duo.js';

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
const gifs = { escena: null, g1: null, g2: null }; // { buffer, nombre }
const lecturas = new Map(); // clave -> { grises: Uint8Array[], delays: number[] }

const geometria = () => ({
  escala: valor('escala'),
  fondo: valor('fondo'),
  rotar: Number(valor('rotar')),
  volteoH: marcado('volteoH'),
  volteoV: marcado('volteoV'),
});
const recorte = () => ({
  izq: numero('recorteIzq', 0, 0, 45), arriba: numero('recorteArriba', 0, 0, 45),
  der: numero('recorteDer', 0, 0, 45), abajo: numero('recorteAbajo', 0, 0, 45),
});

function leer(id, ancho) {
  const gif = gifs[id];
  if (!gif) return null;
  const clave = id + '|' + ancho + '|' + JSON.stringify(geometria()) + '|' + JSON.stringify(recorte());
  if (lecturas.has(clave)) return lecturas.get(clave);
  const origen = document.createElement('canvas');
  const recortado = document.createElement('canvas');
  const destino = document.createElement('canvas');
  destino.width = ancho;
  destino.height = D.ALTO;
  const r = recorte();
  const g = geometria();
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
  const leido = { grises, delays };
  lecturas.set(clave, leido);
  return leido;
}

function binarizar(gris, ancho) {
  const umbral = numero('umbral', 127, 1, 254);
  const bm = marcado('pixelar') ? grisABitmapAtkinson(gris, ancho, D.ALTO, umbral) : grisABitmapUmbral(gris, ancho, D.ALTO, umbral);
  return marcado('invertir') ? D.invertir(bm) : bm;
}

// GIF de una TV (128×64) -> cuadros [{dur, bitmap}] ya con vueltas y velocidad.
function cuadrosDeGif(id, vueltasId, velocidadId) {
  const leido = leer(id, D.ANCHO);
  if (!leido) return null;
  const crudos = leido.grises.map((gris, i) => ({ dur: leido.delays[i], bitmap: binarizar(gris, D.ANCHO) }));
  return D.prepararCuadros(crudos, { vueltas: numero(vueltasId, 1, 1, 20), velocidad: numero(velocidadId, 100, 10, 400) / 100 });
}

// ---------------------------------------------------------------------------------------------------------------------
// Armar el dúo
// ---------------------------------------------------------------------------------------------------------------------
let ultimo = null; // { duo, paquete, mitades: { izq, der } } (mitades = lo decodificado del paquete)
let turno = 0;

function pistasYSonidoInicio() {
  if (valor('modo') === 'escena') {
    const leido = leer('escena', 2 * D.ANCHO);
    if (!leido) return null;
    const izq = [], der = [];
    leido.grises.forEach((gris, i) => {
      const partes = D.partirEscena(binarizar(gris, 2 * D.ANCHO));
      izq.push({ dur: leido.delays[i], bitmap: partes.izq });
      der.push({ dur: leido.delays[i], bitmap: partes.der });
    });
    const op = { vueltas: numero('vueltasEscena', 1, 1, 20), velocidad: numero('velocidadEscena', 100, 10, 400) / 100 };
    return {
      pistas: [{ tv: 'izq', inicio: 0, cuadros: D.prepararCuadros(izq, op) }, { tv: 'der', inicio: 0, cuadros: D.prepararCuadros(der, op) }],
      inicioDe: () => 0,
    };
  }
  const tv1 = valor('tv1');
  const tv2 = tv1 === 'der' ? 'izq' : 'der';
  const c1 = cuadrosDeGif('g1', 'vueltas1', 'velocidad1');
  const c2 = cuadrosDeGif('g2', 'vueltas2', 'velocidad2');
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
  const sonido = claveSonido
    ? { tv: tvSonido, inicio: valor('sonidoInicio') === 'ms' ? numero('sonidoMs', 0, 0, 15000) : base.inicioDe(tvSonido), notas: D.SONIDOS[claveSonido].notas }
    : null;
  const duo = D.armarDuo({ pistas: base.pistas, espera: { izq: valor('espera'), der: valor('espera') }, alTerminar: valor('alTerminar'), sonido });
  const nombre = valor('nombre').trim() || 'Dúo';
  const paquete = await D.empaquetarDuo(duo, { nombre, clave: D.claveDe(nombre), codificarMusical });
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
    `Duración: ${(duo.duracion / 1000).toFixed(2)} s`,
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
  for (const tv of ['izq', 'der']) {
    const c = cuadroEn(ultimo.mitades[tv].cuadros, t);
    if (c && c !== visto[tv]) { pintar(lienzos[tv], c.bitmap); visto[tv] = c; }
  }
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
  for (const id of ['botonReproducir', 'botonPaquete', 'botonCabecera']) $(id).disabled = !si;
}
function fallo(e) {
  console.error('[duos] error:', e);
  aviso('Algo salió mal. Vuelve a intentarlo.', true);
}

function actualizarPaneles() {
  const escena = valor('modo') === 'escena';
  $('panelEscena').hidden = !escena;
  $('panelDos').hidden = escena;
  $('tv2texto').textContent = valor('tv1') === 'der' ? '(en el Pepito de la izquierda)' : '(en el Pepito de la derecha)';
  $('campoInicioMs').hidden = valor('inicio2') !== 'ms';
  $('campoSonidoMs').hidden = valor('sonidoInicio') !== 'ms';
}

async function tomarArchivo(input, id) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;
  try {
    comprobarTamanoArchivo(archivo);
    const buffer = await archivo.arrayBuffer();
    if (!esGif(buffer)) { aviso('Ese archivo no es un GIF.', true); return; }
    gifs[id] = { buffer, nombre: archivo.name };
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

  $('gifEscena').addEventListener('change', (e) => tomarArchivo(e.target, 'escena'));
  $('gif1').addEventListener('change', (e) => tomarArchivo(e.target, 'g1'));
  $('gif2').addEventListener('change', (e) => tomarArchivo(e.target, 'g2'));
  document.addEventListener('change', (e) => {
    if (!e.target || e.target.type === 'file') return;
    actualizarPaneles();
    programar();
  });
  document.addEventListener('input', (e) => {
    if (e.target && (e.target.type === 'range' || e.target.type === 'number' || e.target.id === 'nombre')) programar();
  });
  $('botonReproducir').addEventListener('click', reproducir);
  $('botonParar').addEventListener('click', () => parar());
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
