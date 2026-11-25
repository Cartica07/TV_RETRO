// Galería EN EL CELULAR para quien usa la app con una TV Lite y sin cuenta (sesión anónima). Las reglas de Firebase solo dejan
// guardar en la nube a cuentas con correo verificado; por eso sus imágenes y GIF propios quedan aquí (IndexedDB, almacen.js de la
// app Lite) y se pierden si borra la app o cambia de celular. Lo predeterminado (biblioteca/) sigue viniendo de la nube.
// Adaptado de app-lite/src/backend-lite.js (sin la biblioteca incluida en la app). Mismas formas que la Pro:
//   imagen    -> { datos, ancho, alto, meta, editable, parcial: true }
//   animación -> { ancho, alto, cantidad, meta, cuadros: [{ datos: miniatura, dur: 0 }], parcial: true }
import * as almacen from '../../app-lite/src/almacen.js';

// No hay nube que cobrar, pero cada GIF tarda en llegar a la TV por Bluetooth y la memoria del celular no es infinita.
export const LIMITE_IMAGENES = 100;
export const LIMITE_GIF = 30;

const indices = { imagenes: null, animaciones: null }; // lista liviana en memoria: { clave: entrada }
const escuchas = { imagenes: new Set(), animaciones: new Set() };

function limpiarClave(nombre) {
  return String(nombre ?? '').replace(/[.$#[\]/]/g, '_').trim();
}

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

function entradaDeIndice(tipo, v) {
  return tipo === 'imagenes'
    ? { datos: v.datos, ancho: v.ancho, alto: v.alto, meta: v.meta || {}, editable: !!v.editable, parcial: true }
    : { ancho: v.ancho, alto: v.alto, cantidad: v.cantidad, meta: v.meta || {}, cuadros: [{ datos: v.miniatura, dur: 0 }], parcial: true };
}

async function cargarIndice(tipo) {
  if (indices[tipo]) return indices[tipo];
  const lista = {};
  for (const [clave, payload] of await almacen.todo(tipo)) lista[clave] = construirIndice(tipo, payload);
  indices[tipo] = lista;
  return lista;
}

async function catalogo(tipo) {
  const lista = await cargarIndice(tipo);
  const salida = {};
  for (const [clave, v] of Object.entries(lista)) salida[clave] = entradaDeIndice(tipo, v);
  return salida;
}

async function avisar(tipo) {
  if (!escuchas[tipo].size) return;
  const c = await catalogo(tipo);
  for (const f of escuchas[tipo]) { try { f(c); } catch (e) { console.error(e); } }
}

/** Escucha la lista liviana de lo guardado en el celular ({ clave: entrada }). Devuelve la función para dejar de escuchar. */
export function suscribir(tipo, callback) {
  escuchas[tipo].add(callback);
  catalogo(tipo).then(callback, (e) => console.error('[TV RETRO] No se pudo leer la galería del celular:', e));
  return () => escuchas[tipo].delete(callback);
}

/** true si esa clave está guardada en el celular. */
export async function tiene(tipo, clave) {
  return Object.prototype.hasOwnProperty.call(await cargarIndice(tipo), clave);
}

/** El elemento completo (imagen con su copia editable, o GIF con todos sus cuadros). null si no está. */
export async function leer(tipo, clave) {
  return (await almacen.leer(tipo, clave)) || null;
}

/** Todo lo guardado en el celular de ese tipo, completo ({ clave: elemento }). */
export async function listarTodo(tipo) {
  const salida = {};
  for (const clave of Object.keys(await cargarIndice(tipo))) salida[clave] = await leer(tipo, clave);
  return salida;
}

export async function guardar(tipo, nombre, payload) {
  const clave = limpiarClave(nombre);
  if (!clave) return { exito: false, error: 'falta el nombre' };
  const indice = await cargarIndice(tipo);
  if (!Object.prototype.hasOwnProperty.call(indice, clave)) {
    if (tipo === 'animaciones' && Object.keys(indice).length + 1 > LIMITE_GIF) {
      return { exito: false, error: `llegaste al límite de ${LIMITE_GIF} GIF guardados; borra alguno para poder guardar otro` };
    }
    if (tipo === 'imagenes' && Object.keys(indice).length + 1 > LIMITE_IMAGENES) {
      return { exito: false, error: `llegaste al límite de ${LIMITE_IMAGENES} imágenes guardadas; borra alguna para poder guardar otra` };
    }
  }
  await almacen.guardar(tipo, clave, payload);
  indice[clave] = construirIndice(tipo, payload);
  avisar(tipo);
  return { exito: true, key: clave };
}

export async function borrar(tipo, clave) {
  const indice = await cargarIndice(tipo);
  await almacen.borrar(tipo, clave);
  delete indice[clave];
  avisar(tipo);
  return { exito: true };
}
