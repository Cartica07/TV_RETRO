// Reemplazo de js/firebase.js de la app Pro para la app Lite. La app Pro habla SOLO con este módulo para todo lo
// que sale de la pantalla (enviar a la TV, galería, alarma, ajustes…). Aquí los mismos nombres hacen otra cosa:
//   - lo que iba a la TV por Firebase va por Bluetooth (ble.js);
//   - la Galería (imágenes y GIF) se guarda en el celular (almacen.js, IndexedDB), más la biblioteca
//     predeterminada que viene dentro de la app;
//   - las canciones vienen dentro de la app (canciones/) y la TV guarda en su memoria las que se usan;
//   - cuentas, Mi TV, compartir, actualizar y restablecer no existen (devuelven "no disponible").
// El build (construir.mjs) cambia `./firebase.js` por este archivo SIN tocar el código de la Pro. Si la Pro
// empieza a importar un nombre nuevo de firebase.js y falta aquí, la compilación falla (no falla en silencio).

import * as ble from './ble.js';
import * as almacen from './almacen.js';
import { comprimirCuadros, descomprimirCuadros, puedeComprimir, FORMATO_COMPRIMIDO, FORMATO_MUSICAL } from '../../js/compresion.js';
import { LIMITE_GIF_TV_BYTES } from './gif-lite.js';

// ===================================================
// Utilidades
// ===================================================
export function describirError(error) {
  const texto = String((error && error.message) || error || '');
  // Los textos de ErrorTV son frases completas; la Pro les agrega su propio punto final ("No se pudo enviar: … ."): se quita el nuestro.
  if (error instanceof ble.ErrorTV) return texto.replace(/[.\s]+$/, '');
  if (/PERMISSION_DENIED|permission/i.test(texto)) return 'sin permiso';
  if (/offline|network|conexi/i.test(texto)) return 'sin conexión con la TV';
  return texto || 'error desconocido';
}

const NO_DISPONIBLE = { exito: false, error: 'Esto no está disponible en TV RETRO Lite.' };

function limpiarClave(nombre) {
  return String(nombre ?? '').replace(/[.$#[\]/]/g, '_').trim();
}

function base64ABytes(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function bytesABase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Límites de la Galería del celular. No hay nube que cobrar, pero cada GIF tarda en llegar a la TV
// (Bluetooth: ~22 KB/s con el plugin) y la memoria del celular no es infinita.
export const LIMITE_IMAGENES = 100;
export const LIMITE_GIF = 30;

// ===================================================
// Conexión con la TV (lastSeen / mostrada de la Pro)
// ===================================================
// La Pro mostraba "en línea" mientras llegaba el latido de la TV por Firebase. Aquí es el Bluetooth:
// se avisa "ahora" mientras haya conexión y null (desconectado) al perderla.
const escuchasLastSeen = new Set();
const escuchasMostrada = new Set();
let ultimaVersionMostrada = null;
let temporizadorLatido = null;
let temporizadorReconexion = null;

function emitirLastSeen(valor) {
  for (const f of escuchasLastSeen) { try { f(valor); } catch (e) { console.error(e); } }
}

function iniciarLatido() {
  if (temporizadorLatido) return;
  ble.alCambiarConexion((conectado) => {
    emitirLastSeen(conectado ? Date.now() : null);
  });
  temporizadorLatido = setInterval(() => { if (ble.estaConectado()) emitirLastSeen(Date.now()); }, 10000);
  // Al abrir la app se intenta reconectar con la última TV, y se sigue intentando con calma mientras la app esté a la vista.
  const intentar = () => {
    if (ble.estaConectado() || !ble.hayTVGuardada() || document.visibilityState === 'hidden') return;
    ble.reconectar().catch(() => {});
  };
  intentar();
  temporizadorReconexion = setInterval(intentar, 30000);
}

export function suscribirLastSeen(callback) {
  escuchasLastSeen.add(callback);
  iniciarLatido();
  callback(ble.estaConectado() ? Date.now() : null);
  return () => escuchasLastSeen.delete(callback);
}

export function suscribirMostrada(callback) {
  escuchasMostrada.add(callback);
  callback(ultimaVersionMostrada);
  return () => escuchasMostrada.delete(callback);
}

export async function leerMostrada() {
  return ultimaVersionMostrada;
}

function marcarMostrada(version) {
  ultimaVersionMostrada = version;
  for (const f of escuchasMostrada) { try { f(version); } catch (e) { console.error(e); } }
}

/** Muestra el avance de un envío largo (un GIF o una canción) en la línea de estado: "Enviando… 45 %". p va de 0 a 1. */
function avanceEnvio(p) {
  try {
    const el = document.getElementById('estadoTexto');
    // Solo mientras la pantalla diga "Enviando…" (si la persona hizo otra cosa o ya terminó, no se pisa).
    if (el && /^Enviando/.test(el.textContent)) el.textContent = `Enviando… ${Math.round(p * 100)} %`;
  } catch (e) { /* sin pantalla */ }
}

async function asegurarConexion() {
  if (ble.estaConectado()) return;
  if (await ble.reconectar()) return;
  await ble.buscar(); // muestra la lista de TV cercanas (se llega aquí desde un toque del usuario)
}

// ===================================================
// Canciones (vienen dentro de la app)
// ===================================================
let catalogoCanciones = null; // { clave: { id, nombre, archivo, bytes, duracion } }

async function cargarCatalogoCanciones() {
  if (catalogoCanciones) return catalogoCanciones;
  catalogoCanciones = {};
  try {
    const r = await fetch('canciones/indice.json');
    if (r.ok) for (const c of await r.json()) catalogoCanciones[c.clave] = c;
  } catch (e) {
    console.warn('[TV RETRO Lite] No se pudo leer el catálogo de canciones:', e);
  }
  return catalogoCanciones;
}

async function bytesDeCancion(clave) {
  const c = (await cargarCatalogoCanciones())[clave];
  if (!c) throw new ble.ErrorTV('Esa canción no existe.');
  const r = await fetch(`canciones/${c.archivo}`);
  if (!r.ok) throw new ble.ErrorTV('No se pudo leer la canción.');
  return new Uint8Array(await r.arrayBuffer());
}

/** Lista liviana de canciones con la forma que espera la Pro: { clave: { nombre, archivo, duracion, repetir, imagenes, bytes, … } }. */
export async function listarMusicales() {
  const cat = await cargarCatalogoCanciones();
  const lista = {};
  for (const [clave, c] of Object.entries(cat)) {
    lista[clave] = { nombre: c.nombre, archivo: c.archivo, duracion: c.duracion, repetir: false, imagenes: 0, bytes: c.bytes, origen: 'app' };
  }
  return lista;
}

/** Grabación (Base64 m1) de una canción, o null si no existe. */
export async function leerMusical(clave) {
  try {
    return bytesABase64(await bytesDeCancion(clave));
  } catch (e) {
    return null;
  }
}

export async function guardarMusicalCatalogo() { return NO_DISPONIBLE; }
export async function borrarMusicalCatalogo() { return NO_DISPONIBLE; }
export function claveMusicalValida(clave) {
  return typeof clave === 'string' && clave.length >= 1 && clave.length <= 150 && !/[/.$#[\]]/.test(clave);
}

// Catálogo viejo de canciones de solo ritmo: ya no existe.
export async function listarCanciones() { return {}; }
export async function guardarCancionCatalogo() { return NO_DISPONIBLE; }
export async function borrarCancionCatalogo() { return NO_DISPONIBLE; }

/** Se asegura de que la TV tenga la canción (se la manda si falta) y devuelve su id. */
async function asegurarCancionEnTV(clave) {
  const cat = await cargarCatalogoCanciones();
  const c = cat[clave];
  if (!c) throw new ble.ErrorTV('Esa canción no existe.');
  const guardadas = await ble.listar();
  if (!guardadas.has(c.id)) {
    const datos = await bytesDeCancion(clave);
    const r = await ble.enviarArchivo(datos, { id: c.id, alProgreso: avanceEnvio });
    if (!r.ok) throw new ble.ErrorTV('La canción no llegó bien. Vuelve a intentarlo.');
  }
  return c.id;
}

/** Id (16 bits) de una canción del catálogo, o 0 si no hay (para la alarma). */
async function idDeCancion(clave) {
  const c = clave ? (await cargarCatalogoCanciones())[clave] : null;
  return c ? c.id : 0;
}

// ===================================================
// Galería en el celular (imágenes y GIF) + biblioteca que viene con la app
// ===================================================
// Mismas formas que la Pro (modo con cuentas): la Galería escucha una LISTA liviana y pide lo pesado al elegir.
//   imagen    -> { datos, ancho, alto, meta, editable, parcial: true }
//   animación -> { ancho, alto, cantidad, meta, cuadros: [{ datos: miniatura, dur: 0 }], parcial: true }
const indices = { imagenes: null, animaciones: null }; // lista liviana en memoria: { clave: entrada }
const predeterminadas = { imagenes: {}, animaciones: {} }; // biblioteca de la app (se carga al primer uso)
let predeterminadasListas = null;
const escuchasCatalogo = { imagenes: new Set(), animaciones: new Set() };

function primerCuadro(cuadros) {
  if (!cuadros) return null;
  if (Array.isArray(cuadros)) return cuadros[0] || null;
  const claves = Object.keys(cuadros).sort((a, b) => Number(a) - Number(b));
  return claves.length ? cuadros[claves[0]] : null;
}

function contarCuadros(cuadros) {
  if (!cuadros) return 0;
  return Array.isArray(cuadros) ? cuadros.length : Object.keys(cuadros).length;
}

function construirIndice(tipo, p) {
  const meta = p.meta && typeof p.meta === 'object' ? JSON.parse(JSON.stringify(p.meta)) : null;
  if (tipo === 'imagenes') {
    const i = { datos: String(p.datos || ''), ancho: Number(p.ancho) || 0, alto: Number(p.alto) || 0, editable: !!p.preprocesada };
    if (meta && Object.keys(meta).length) i.meta = meta;
    return i;
  }
  const primero = primerCuadro(p.cuadros);
  const i = { ancho: Number(p.ancho) || 0, alto: Number(p.alto) || 0, cantidad: contarCuadros(p.cuadros), miniatura: String((primero && primero.datos) || '') };
  if (meta && Object.keys(meta).length) i.meta = meta;
  return i;
}

function entradaDeIndice(tipo, v, predeterminada) {
  const e = tipo === 'imagenes'
    ? { datos: v.datos, ancho: v.ancho, alto: v.alto, meta: v.meta || {}, editable: !!v.editable, parcial: true }
    : { ancho: v.ancho, alto: v.alto, cantidad: v.cantidad, meta: v.meta || {}, cuadros: [{ datos: v.miniatura, dur: 0 }], parcial: true };
  if (predeterminada) e.predeterminada = true;
  return e;
}

async function cargarIndice(tipo) {
  if (indices[tipo]) return indices[tipo];
  const lista = {};
  for (const [clave, payload] of await almacen.todo(tipo)) lista[clave] = construirIndice(tipo, payload);
  indices[tipo] = lista;
  return lista;
}

async function cargarPredeterminadas() {
  if (predeterminadasListas) return predeterminadasListas;
  predeterminadasListas = (async () => {
    for (const tipo of ['imagenes', 'animaciones']) {
      try {
        const r = await fetch(`predeterminadas/${tipo}_indice.json`);
        if (r.ok) predeterminadas[tipo] = await r.json();
      } catch (e) { /* sin biblioteca incluida */ }
    }
  })();
  return predeterminadasListas;
}

async function armarCatalogo(tipo) {
  await cargarPredeterminadas();
  const propio = await cargarIndice(tipo);
  const mezcla = {};
  for (const [clave, v] of Object.entries(predeterminadas[tipo])) mezcla[clave] = entradaDeIndice(tipo, v, true);
  for (const [clave, v] of Object.entries(propio)) mezcla[clave] = entradaDeIndice(tipo, v, false); // la propia gana
  return mezcla;
}

async function avisarCatalogo(tipo) {
  if (!escuchasCatalogo[tipo].size) return;
  const c = await armarCatalogo(tipo);
  for (const f of escuchasCatalogo[tipo]) { try { f(c); } catch (e) { console.error(e); } }
}

function suscribirCatalogo(tipo, callback, alError) {
  escuchasCatalogo[tipo].add(callback);
  armarCatalogo(tipo).then(callback, (e) => { if (alError) alError(e); });
  return () => escuchasCatalogo[tipo].delete(callback);
}

export function suscribirImagenes(callback, alError) { return suscribirCatalogo('imagenes', callback, alError); }
export function suscribirAnimaciones(callback, alError) { return suscribirCatalogo('animaciones', callback, alError); }

async function leerTodoLoGuardado(tipo, predeterminada) {
  await cargarPredeterminadas();
  const lista = predeterminada ? predeterminadas[tipo] : await cargarIndice(tipo);
  const salida = {};
  for (const clave of Object.keys(lista)) salida[clave] = await leerElemento(tipo, clave, predeterminada);
  return salida;
}

/** El elemento completo (imagen con su PNG editable, o GIF con todos sus cuadros). null si no existe. */
async function leerElemento(tipo, clave, predeterminada) {
  if (!predeterminada) {
    const v = await almacen.leer(tipo, clave);
    if (v) return v;
  }
  await cargarPredeterminadas();
  const e = predeterminadas[tipo][clave];
  if (!e || !e.archivo) return null;
  try {
    const r = await fetch('predeterminadas/' + e.archivo);
    if (r.ok) return await r.json();
  } catch (err) { /* no está */ }
  return null;
}

export async function listarImagenes() { return await leerTodoLoGuardado('imagenes', false); }
export async function listarAnimaciones({ predeterminada = false } = {}) { return await leerTodoLoGuardado('animaciones', predeterminada); }

export async function leerPreprocesada(clave, { predeterminada = false } = {}) {
  const v = await leerElemento('imagenes', clave, predeterminada);
  return v && v.preprocesada ? String(v.preprocesada) : null;
}

export async function leerCuadrosAnimacion(clave, { predeterminada = false } = {}) {
  const v = await leerElemento('animaciones', clave, predeterminada);
  return v ? v.cuadros || null : null;
}

async function guardarEnCatalogo(tipo, clave, payload) {
  if (!clave) return { exito: false, error: 'falta el nombre' };
  const indice = await cargarIndice(tipo);
  const existe = Object.prototype.hasOwnProperty.call(indice, clave);
  if (!existe) {
    const total = Object.keys(indices.imagenes || (await cargarIndice('imagenes'))).length + Object.keys(indices.animaciones || (await cargarIndice('animaciones'))).length;
    if (tipo === 'animaciones' && Object.keys(indice).length + 1 > LIMITE_GIF) {
      return { exito: false, error: `llegaste al límite de ${LIMITE_GIF} GIF (animaciones) guardados; borra alguno para guardar otro` };
    }
    if (total + 1 > LIMITE_IMAGENES + LIMITE_GIF) {
      return { exito: false, error: `llegaste al límite de elementos guardados en el celular; borra alguno para guardar otro` };
    }
    if (tipo === 'imagenes' && Object.keys(indice).length + 1 > LIMITE_IMAGENES) {
      return { exito: false, error: `llegaste al límite de ${LIMITE_IMAGENES} imágenes guardadas; borra alguna para guardar otra` };
    }
  }
  await almacen.guardar(tipo, clave, payload);
  indice[clave] = construirIndice(tipo, payload);
  avisarCatalogo(tipo);
  return { exito: true, key: clave };
}

async function borrarDeCatalogo(tipo, clave) {
  const indice = await cargarIndice(tipo);
  await almacen.borrar(tipo, clave);
  delete indice[clave];
  avisarCatalogo(tipo);
  return { exito: true };
}

export async function guardarImagenCatalogo(nombre, datos, ancho, alto, preprocesada = null, meta = {}, opciones = {}) {
  try {
    if (opciones && opciones.predeterminada) return { exito: false, error: 'la biblioteca predeterminada viene con la app' };
    const payload = { datos, ancho, alto, meta };
    if (preprocesada) payload.preprocesada = preprocesada;
    return await guardarEnCatalogo('imagenes', limpiarClave(nombre), payload);
  } catch (err) {
    console.error('Error al guardar la imagen:', err);
    return { exito: false, error: describirError(err) };
  }
}

export async function guardarAnimacionCatalogo(nombre, ancho, alto, cuadros, meta = {}, opciones = {}) {
  try {
    if (opciones && opciones.predeterminada) return { exito: false, error: 'la biblioteca predeterminada viene con la app' };
    return await guardarEnCatalogo('animaciones', limpiarClave(nombre), { ancho, alto, cuadros, meta });
  } catch (err) {
    console.error('Error al guardar la animación:', err);
    return { exito: false, error: describirError(err) };
  }
}

export async function borrarImagenCatalogo(nombre, opciones = {}) {
  try {
    if (opciones && opciones.predeterminada) return { exito: false, error: 'la biblioteca predeterminada viene con la app' };
    return await borrarDeCatalogo('imagenes', nombre);
  } catch (err) {
    console.error('Error al borrar la imagen:', err);
    return { exito: false, error: describirError(err) };
  }
}

export async function borrarAnimacionCatalogo(nombre, opciones = {}) {
  try {
    if (opciones && opciones.predeterminada) return { exito: false, error: 'la biblioteca predeterminada viene con la app' };
    return await borrarDeCatalogo('animaciones', nombre);
  } catch (err) {
    console.error('Error al borrar la animación:', err);
    return { exito: false, error: describirError(err) };
  }
}

// ===================================================
// Último contenido enviado (para que la app se abra donde se quedó)
// ===================================================
const ESTADO_VACIO = {
  tipo: 'texto', texto: 'Bienvenido', tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar',
  fuente: '', manual: false, x: 0, y: 0, direccion: 'h', imagenData: '', imagenAncho: 0, imagenAlto: 0,
  cancionNombre: '', cancionRepeticiones: 1, version: 0, exito: true, vacio: true,
};

export async function cargarEstado() {
  try {
    const guardado = await almacen.leer('meta', 'ultimo');
    if (!guardado || !guardado.pantalla) return Object.assign({}, ESTADO_VACIO);
    const pantalla = guardado.pantalla;
    const config = pantalla.config || {};
    const imagen = pantalla.imagen || {};
    const animacion = pantalla.animacion || {};
    const cancion = pantalla.cancion || {};
    let cuadrosAnimacion = [];
    if (animacion.formato === FORMATO_COMPRIMIDO && guardado.archivo && puedeComprimir()) {
      try {
        cuadrosAnimacion = await descomprimirCuadros(guardado.archivo);
      } catch (err) {
        console.error('No se pudo descomprimir la animación:', err);
      }
    }
    return {
      tipo: (['alarma', 'ajustes'].includes(pantalla.tipo) ? 'texto' : pantalla.tipo) || 'texto',
      texto: typeof pantalla.texto === 'string' ? pantalla.texto : 'Bienvenido',
      tamano: Math.min(5, Math.max(1, Math.round(Number(config.tamano)) || 2)),
      alineacion: config.alineacion || 'centro',
      alineacionV: config.alineacionV || 'centro',
      invertido: !!config.invertido,
      modoTexto: config.modoTexto || 'ajustar',
      fuente: typeof config.fuente === 'string' ? config.fuente : '',
      manual: !!config.manual,
      x: Number(config.x) || 0,
      y: Number(config.y) || 0,
      direccion: config.direccion === 'v' ? 'v' : 'h',
      imagenData: imagen.datos || '',
      imagenAncho: Number(imagen.ancho) || 0,
      imagenAlto: Number(imagen.alto) || 0,
      cancionNombre: typeof cancion.nombre === 'string' ? cancion.nombre : '',
      cancionRepeticiones: Number(cancion.repeticiones) || 1,
      animacionNombre: typeof animacion.nombre === 'string' ? animacion.nombre : '',
      animacionAncho: Number(animacion.ancho) || 0,
      animacionAlto: Number(animacion.alto) || 0,
      animacionCuadros: cuadrosAnimacion,
      musicalNombre: pantalla.musical && typeof pantalla.musical.nombre === 'string' ? pantalla.musical.nombre : '',
      musicalRepeticiones: (pantalla.musical && Number(pantalla.musical.repeticiones)) || 1,
      version: Number(guardado.version) || 0,
      exito: true,
    };
  } catch (err) {
    console.error('Error al leer lo último que se envió:', err);
    return { exito: false, error: describirError(err) };
  }
}

let contadorVersion = null;
async function reservarVersion() {
  if (contadorVersion === null) contadorVersion = Number(await almacen.leer('meta', 'version')) || 0;
  contadorVersion += 1;
  await almacen.guardar('meta', 'version', contadorVersion);
  return contadorVersion;
}

// ===================================================
// Enviar a la TV
// ===================================================
/** Arma la misma "pantalla" que la Pro escribía en Firebase (formato en docs/formatos-datos.md sección 2). */
async function armarPantalla(estado) {
  const pantalla = {
    texto: estado.texto,
    config: {
      tamano: estado.tamano,
      alineacion: estado.alineacion,
      alineacionV: estado.alineacionV,
      invertido: estado.invertido,
      modoTexto: estado.modoTexto,
      fuente: estado.fuente || 'sans',
      manual: !!estado.manual,
      x: Math.round(Number(estado.x) || 0),
      y: Math.round(Number(estado.y) || 0),
      direccion: estado.direccion === 'v' ? 'v' : 'h',
    },
  };
  let archivo = null; // bytes del GIF comprimido (z1)

  if (estado.tipo === 'imagen') {
    pantalla.tipo = 'imagen';
    pantalla.imagen = { ancho: estado.imagenAncho, alto: estado.imagenAlto, datos: estado.imagenData };
  } else if (estado.tipo === 'animacion') {
    if (!puedeComprimir()) throw new ble.ErrorTV('Este celular no puede enviar GIF.');
    pantalla.tipo = 'animacion';
    const z = await comprimirCuadros(estado.animacionCuadros || []);
    // La TV guarda ~1,4 MB y por Bluetooth un GIF muy grande tardaría minutos: se rechaza antes de empezar.
    if (z.bytes > LIMITE_GIF_TV_BYTES) throw new ble.ErrorTV('Ese GIF es demasiado pesado para la TV. Prueba con uno más corto.');
    pantalla.animacion = {
      nombre: estado.animacion || '', ancho: estado.animacionAncho, alto: estado.animacionAlto,
      formato: FORMATO_COMPRIMIDO, cantidad: z.cantidad,
    };
    archivo = base64ABytes(z.datos);
  } else {
    pantalla.tipo = 'texto';
  }
  return { pantalla, archivo };
}

export async function enviarEstado(estado) {
  try {
    // Alarma y ajustes se guardan por su propio camino (guardarAlarma / guardarAjustes): las órdenes "tipo alarma/ajustes" no existen aquí.
    if (estado.tipo === 'alarma' || estado.tipo === 'ajustes') return { exito: true, version: await reservarVersion() };
    if (['actualizar', 'restablecer', 'juego'].includes(estado.tipo)) return { exito: false, error: NO_DISPONIBLE.error };

    await asegurarConexion();
    const version = await reservarVersion();

    if (estado.tipo === 'musical' || estado.tipo === 'cancion') {
      const clave = estado.tipo === 'musical' ? estado.musicalClave : estado.cancion;
      const repeticiones = Number(estado.tipo === 'musical' ? estado.musicalRepeticiones : estado.cancionRepeticiones) || 1;
      await ble.exclusivo(async () => {
        const id = await asegurarCancionEnTV(clave);
        await ble.tocar(id, repeticiones, estado.tipo === 'musical');
      });
      // Se recuerda como "canción" para que la app se abra en Canciones (con letra o sin ella).
      const pantalla = estado.tipo === 'musical'
        ? { tipo: 'musical', texto: estado.texto, config: {}, musical: { nombre: estado.musicalNombre || clave, repeticiones, formato: FORMATO_MUSICAL, clave } }
        : { tipo: 'cancion', texto: estado.texto, config: {}, cancion: { nombre: estado.cancion || clave, repeticiones } };
      await almacen.guardar('meta', 'ultimo', { version, pantalla, archivo: null });
      marcarMostrada(version);
      return { exito: true, version };
    }

    const { pantalla, archivo } = await armarPantalla(estado);
    await ble.exclusivo(() => ble.enviarContenido(pantalla, archivo, avanceEnvio));
    await almacen.guardar('meta', 'ultimo', { version, pantalla, archivo: archivo ? bytesABase64(archivo) : null });
    marcarMostrada(version);
    return { exito: true, version };
  } catch (err) {
    if (!(err instanceof ble.ErrorTV)) console.error('Error al enviar a la TV:', err);
    return { exito: false, error: describirError(err) };
  }
}

// ===================================================
// Alarma y ajustes de la TV (los guarda la TV; el celular recuerda lo que mandó)
// ===================================================
export const CANTIDAD_ALARMAS = 3;
export const DIAS_ALARMA_DEFECTO = 62; // lunes a viernes
export const AJUSTES_DEFECTO = { brillo: 3, volumen: 3, zona: -300 };

const entero = (v, min, max, defecto) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : defecto;
};

function normalizarAlarmaUna(a) {
  const x = a && typeof a === 'object' ? a : {};
  return {
    activa: x.activa === true,
    hora: entero(x.hora, 0, 23, 7),
    minuto: entero(x.minuto, 0, 59, 0),
    dias: entero(x.dias, 0, 127, DIAS_ALARMA_DEFECTO),
  };
}

export function normalizarAlarma(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const lista = d.alarmas && typeof d.alarmas === 'object' ? d.alarmas : {};
  return {
    tono: typeof d.tono === 'string' ? d.tono.slice(0, 100) : '',
    alarmas: Array.from({ length: CANTIDAD_ALARMAS }, (_, i) => normalizarAlarmaUna(lista[i] ?? lista[String(i)])),
  };
}

export function normalizarAjustes(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return {
    brillo: entero(d.brillo, 1, 3, AJUSTES_DEFECTO.brillo),
    volumen: entero(d.volumen, 0, 3, AJUSTES_DEFECTO.volumen),
    zona: entero(d.zona, -720, 840, AJUSTES_DEFECTO.zona),
  };
}

export async function cargarAlarma() {
  try {
    return { exito: true, alarma: normalizarAlarma(await almacen.leer('meta', 'alarma')) };
  } catch (error) {
    return { exito: false, error: describirError(error) };
  }
}

export async function cargarAjustes() {
  try {
    return { exito: true, ajustes: normalizarAjustes(await almacen.leer('meta', 'ajustes')) };
  } catch (error) {
    return { exito: false, error: describirError(error) };
  }
}

/** Guarda la alarma en la TV (y, si la canción de la alarma no está en la TV, se la manda) y en el celular. */
export async function guardarAlarma(datos, estado) {
  const alarma = normalizarAlarma(datos);
  try {
    await asegurarConexion();
    await ble.exclusivo(async () => {
      let tonoId = 0;
      if (alarma.tono) tonoId = await asegurarCancionEnTV(alarma.tono);
      await ble.guardarAlarmasEnTV({ tonoId, alarmas: alarma.alarmas });
    });
    await almacen.guardar('meta', 'alarma', alarma);
    return { exito: true, version: await reservarVersion() };
  } catch (error) {
    if (!(error instanceof ble.ErrorTV)) console.error('Error al guardar la alarma:', error);
    return { exito: false, error: describirError(error) };
  }
}

export async function guardarAjustes(datos, estado) {
  const ajustes = normalizarAjustes(datos);
  try {
    await asegurarConexion();
    await ble.exclusivo(() => ble.guardarAjustesEnTV(ajustes));
    await almacen.guardar('meta', 'ajustes', ajustes);
    return { exito: true, version: await reservarVersion() };
  } catch (error) {
    if (!(error instanceof ble.ErrorTV)) console.error('Error al guardar los ajustes de la TV:', error);
    return { exito: false, error: describirError(error) };
  }
}

// ===================================================
// Sistema de la TV (actualizar / restablecer): no disponible en la Lite
// ===================================================
export function dispositivoActual() { return null; }
export async function cargarSistema() { return { exito: true, esDueno: false, firmware: null, manifiestoBuild: null }; }
export function suscribirFirmwareTV(callback) { callback(null); return () => {}; }

// ===================================================
// Cuentas, Mi TV, compartir: la Lite no tiene cuentas (todo esto queda sin efecto)
// ===================================================
export const VERSION_DESVINCULADA = -2;
export const MAXIMO_MIEMBROS = 5;
export const MAXIMO_APODO = 20;
export function usarCuenta() {}
export function escucharSesion(callback) { callback(null); return () => {}; }
export function usuarioActual() { return null; }
export function describirErrorAuth(error) { return describirError(error); }
export async function iniciarSesion() { return NO_DISPONIBLE; }
export async function crearCuenta() { return NO_DISPONIBLE; }
export async function iniciarSesionConGoogle() { return NO_DISPONIBLE; }
export async function iniciarSesionConGoogleNativo() { return NO_DISPONIBLE; }
export function proveedorDeLaCuenta() { return null; }
export async function eliminarMiCuenta() { return NO_DISPONIBLE; }
export async function cerrarSesion() { return NO_DISPONIBLE; }
export async function recuperarContrasena() { return NO_DISPONIBLE; }
export async function esAdministrador() { return false; }
export function normalizarCodigo(texto) { return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export async function listarMisDispositivos() { return { exito: true, dispositivos: [] }; }
export async function reclamarDispositivo() { return NO_DISPONIBLE; }
export async function desvincularDispositivo() { return NO_DISPONIBLE; }
export async function rolEnTV() { return { exito: true, rol: 'dueno' }; }
export async function quitarTVDeMiLista() { return NO_DISPONIBLE; }
export async function listarMiembros() { return { exito: true, miembros: [] }; }
export async function crearInvitacion() { return NO_DISPONIBLE; }
export async function borrarInvitacion() { return NO_DISPONIBLE; }
export async function quitarMiembro() { return NO_DISPONIBLE; }
export async function guardarApodoMiembro() { return NO_DISPONIBLE; }
export async function salirDeTV() { return NO_DISPONIBLE; }
export async function usarCodigoTV() { return NO_DISPONIBLE; }
