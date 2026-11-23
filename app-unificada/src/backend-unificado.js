// Enrutador de la app unificada. En la copia que arma construir.mjs, ESTE archivo ocupa el lugar de js/firebase.js (el único
// módulo por el que el resto de la app habla con la TV y con Firebase) y el firebase.js de la Pro queda como
// js/firebase-pro.js, SIN tocar. Cada función de la Pro se decide aquí A MANO:
//
//   NUBE       sigue yendo a Firebase, igual que en la Pro (cuentas, galería, canciones, administrador…).
//   POR TV     depende de qué TV está en uso: una TV Pro habla con Firebase (firebase-pro.js); una TV Lite, por Bluetooth (lite-tv.js).
//   POR ID     recibe el id de una TV: si es "lite:…" se resuelve en el celular y NUNCA llega a Firebase (leer
//              dispositivos/lite:…/dueno daría "sin permiso" y la TV desaparecería de la lista).
//
// La parte Bluetooth (js/lite-tv.js, con el núcleo de Capacitor y el plugin) se carga SOLO cuando se usa una TV Lite: con una
// TV Pro no corre ni una línea nueva (el núcleo de Capacitor, por ejemplo, reescribe partes de window.Capacitor).
//
// construir.mjs comprueba que aquí esté exactamente cada nombre que exporta el firebase.js de la Pro (ni uno menos): si la
// Pro agrega una función nueva, la compilación falla en vez de dejar pasar a Firebase un id de TV Lite.
// Se permiten nombres extra solo si empiezan con "unificada".

import * as pro from './firebase-pro.js';
import { esIdLite, listarTVLite, anadirTVLite, quitarTVLite } from './registro-lite.js';

// ---------- NUBE: igual que la Pro ----------
export {
  db, describirErrorAuth, escucharSesion, usuarioActual, iniciarSesion, crearCuenta, iniciarSesionConGoogle,
  iniciarSesionConGoogleNativo, proveedorDeLaCuenta, eliminarMiCuenta, recuperarContrasena, esAdministrador,
  VERSION_DESVINCULADA, normalizarCodigo, reclamarDispositivo, MAXIMO_MIEMBROS,
  MAXIMO_APODO, borrarInvitacion, listarCanciones, guardarCancionCatalogo, borrarCancionCatalogo,
  listarMusicales, leerMusical, claveMusicalValida,
  guardarMusicalCatalogo, borrarMusicalCatalogo, CANTIDAD_ALARMAS, DIAS_ALARMA_DEFECTO, normalizarAlarma,
  AJUSTES_DEFECTO, normalizarAjustes
} from './firebase-pro.js';

// ---------- Con una TV Lite y SIN cuenta ----------
// La primera pantalla pregunta "¿Qué TV tienes?" (js/anadir-lite.js) y guarda la respuesta en el celular. Con "TV Lite" no se pide
// cuenta: la app entra con una sesión anónima e invisible (Firebase Authentication > Anónimo, lo activa el dueño), que basta para
// leer lo predeterminado de la nube (biblioteca/ y musicales/: las reglas piden solo "con sesión"). Lo que la persona guarda va a la
// galería del CELULAR (las reglas solo dejan guardar en la nube a cuentas con correo verificado).
const CLAVE_TIPO = 'tvretro.tipoApp'; // 'pro' | 'lite'
export function unificadaSinCuenta() {
  try { return localStorage.getItem(CLAVE_TIPO) === 'lite'; } catch (e) { return false; }
}
// Las TV Lite se recuerdan por cuenta; sin cuenta, en una lista del celular (la sesión anónima cambia si se vuelve a entrar).
const claveCuenta = (uid) => (unificadaSinCuenta() ? 'local' : uid);

// El SDK de autenticación (la misma copia que usa firebase-pro.js): construir.mjs pone aquí su dirección.
const SDK_AUTH = '__SDK_AUTH__';

/** Entra sin cuenta (sesión anónima). Devuelve { exito } o { exito: false, error } con un texto para la persona. */
export async function unificadaEntrarSinCuenta() {
  try {
    const m = await import(SDK_AUTH);
    await m.signInAnonymously(m.getAuth());
    return { exito: true };
  } catch (error) {
    console.error('[TV RETRO] No se pudo entrar sin cuenta:', error);
    const codigo = String((error && error.code) || '');
    // Textos PROPUESTOS (docs/lite-textos-propuestos.md): los aprueba el dueño.
    if (/operation-not-allowed|admin-restricted-operation/.test(codigo)) return { exito: false, error: 'Por ahora no se puede usar la TV Lite. Inténtalo más tarde.' };
    if (/network-request-failed/.test(codigo) || navigator.onLine === false) return { exito: false, error: 'Sin conexión a internet. Conéctate y vuelve a intentarlo.' };
    return { exito: false, error: 'Algo salió mal. Vuelve a intentarlo.' };
  }
}

/** Cierra la sesión y olvida la respuesta de "¿Qué TV tienes?" (así se vuelve a preguntar). */
export async function cerrarSesion(...a) {
  try { localStorage.removeItem(CLAVE_TIPO); } catch (e) { /* sin almacenamiento */ }
  return pro.cerrarSesion(...a);
}

// ---------- Galería: de la nube y, sin cuenta, también la del celular ----------
// Une la lista de la nube (lo predeterminado y, con cuenta, lo propio) con la del celular (sin cuenta). Lo del celular gana.
function mezclar(tipo, suscribirNube, callback, alError) {
  let nube = {};
  let local = {};
  let cancelada = false;
  let bajaLocal = null;
  const emitir = () => callback(Object.assign({}, nube, local));
  const bajaNube = suscribirNube((v) => { nube = v || {}; emitir(); }, alError);
  cargarLite().then((m) => { if (!cancelada) bajaLocal = m.galeria.suscribir(tipo, (v) => { local = v || {}; emitir(); }); });
  return () => { cancelada = true; if (bajaNube) bajaNube(); if (bajaLocal) bajaLocal(); };
}

export function suscribirImagenes(callback, alError) {
  return unificadaSinCuenta() ? mezclar('imagenes', pro.suscribirImagenes, callback, alError) : pro.suscribirImagenes(callback, alError);
}
export function suscribirAnimaciones(callback, alError) {
  return unificadaSinCuenta() ? mezclar('animaciones', pro.suscribirAnimaciones, callback, alError) : pro.suscribirAnimaciones(callback, alError);
}

export async function listarImagenes(...a) {
  const nube = await pro.listarImagenes(...a);
  if (!unificadaSinCuenta()) return nube;
  return Object.assign({}, nube || {}, await (await cargarLite()).galeria.listarTodo('imagenes'));
}
export async function listarAnimaciones(opciones = {}) {
  const nube = await pro.listarAnimaciones(opciones);
  if (!unificadaSinCuenta() || (opciones && opciones.predeterminada)) return nube;
  return Object.assign({}, nube || {}, await (await cargarLite()).galeria.listarTodo('animaciones'));
}

export async function guardarImagenCatalogo(nombre, datos, ancho, alto, preprocesada = null, meta = {}, opciones = {}) {
  if (!unificadaSinCuenta() || (opciones && opciones.predeterminada)) return pro.guardarImagenCatalogo(nombre, datos, ancho, alto, preprocesada, meta, opciones);
  const payload = { datos, ancho, alto, meta };
  if (preprocesada) payload.preprocesada = preprocesada;
  return (await cargarLite()).galeria.guardar('imagenes', nombre, payload);
}
export async function guardarAnimacionCatalogo(nombre, ancho, alto, cuadros, meta = {}, opciones = {}) {
  if (!unificadaSinCuenta() || (opciones && opciones.predeterminada)) return pro.guardarAnimacionCatalogo(nombre, ancho, alto, cuadros, meta, opciones);
  return (await cargarLite()).galeria.guardar('animaciones', nombre, { ancho, alto, cuadros, meta });
}

// Sin cuenta, lo que está en el celular se borra del celular; lo demás (predeterminado) sigue el camino de la Pro.
export async function borrarImagenCatalogo(nombre, opciones = {}) {
  if (unificadaSinCuenta() && !(opciones && opciones.predeterminada)) {
    const g = (await cargarLite()).galeria;
    if (await g.tiene('imagenes', nombre)) return g.borrar('imagenes', nombre);
  }
  return pro.borrarImagenCatalogo(nombre, opciones);
}
export async function borrarAnimacionCatalogo(nombre, opciones = {}) {
  if (unificadaSinCuenta() && !(opciones && opciones.predeterminada)) {
    const g = (await cargarLite()).galeria;
    if (await g.tiene('animaciones', nombre)) return g.borrar('animaciones', nombre);
  }
  return pro.borrarAnimacionCatalogo(nombre, opciones);
}

export async function leerPreprocesada(clave, opciones = {}) {
  if (unificadaSinCuenta() && !(opciones && opciones.predeterminada)) {
    const v = await (await cargarLite()).galeria.leer('imagenes', clave);
    if (v) return v.preprocesada ? String(v.preprocesada) : null;
  }
  return pro.leerPreprocesada(clave, opciones);
}
export async function leerCuadrosAnimacion(clave, opciones = {}) {
  if (unificadaSinCuenta() && !(opciones && opciones.predeterminada)) {
    const v = await (await cargarLite()).galeria.leer('animaciones', clave);
    if (v) return v.cuadros || null;
  }
  return pro.leerCuadrosAnimacion(clave, opciones);
}

// ---------- La parte Bluetooth, bajo demanda ----------
let cargaLite = null;
function cargarLite() {
  if (!cargaLite) {
    cargaLite = import('./lite-tv.js').then((m) => {
      m.configurar({ leerMusical: pro.leerMusical }); // las canciones que se mandan a una TV Lite salen del catálogo de la nube
      return m;
    });
  }
  return cargaLite;
}

// ---------- Qué TV está en uso ----------
let tvLite = false;
let idActivo = null;
let tvLitePendiente = null; // TV Lite recién emparejada que "Añade tu TV" está a punto de vincular (ver usarCodigoTV)

/** Pasa a usar la cuenta y la TV elegida (de aquí en adelante todo va a esa TV y al catálogo de esa cuenta). */
export function usarCuenta(uid, dispositivo) {
  tvLite = esIdLite(dispositivo);
  idActivo = dispositivo;
  try {
    document.body.classList.toggle('tv-lite', tvLite);
    document.body.classList.remove('sin-tv'); // ya hay una TV elegida: la pregunta "¿Qué TV tienes?" no vuelve a salir
  } catch (e) { /* sin pantalla */ }
  pro.usarCuenta(uid, dispositivo); // el catálogo de la cuenta (usuarios/{uid}/…) lo necesita en los dos casos
  if (tvLite) cargarLite().then((m) => m.usarTV(dispositivo)).catch((e) => console.error('[TV RETRO] No se pudo preparar la TV Lite:', e));
}

export function dispositivoActual() { return tvLite ? idActivo : pro.dispositivoActual(); }

// Los errores de la TV Lite (ErrorTV, de ble.js) son frases completas; la Pro les agrega su propio punto final: se quita el nuestro.
const esErrorTV = (error) => !!error && error.constructor && error.constructor.name === 'ErrorTV';
export function describirError(error) {
  return esErrorTV(error) ? String(error.message || '').replace(/[.\s]+$/, '') : pro.describirError(error);
}

// ---------- POR TV ----------
// Asíncronas: con una TV Lite esperan a que cargue la parte Bluetooth.
const porTV = (nombre) => (...a) => (tvLite ? cargarLite().then((m) => m[nombre](...a)) : pro[nombre](...a));
export const cargarEstado = porTV('cargarEstado');
export const leerMostrada = porTV('leerMostrada');
export const cargarAlarma = porTV('cargarAlarma');
export const guardarAlarma = porTV('guardarAlarma');
export const cargarAjustes = porTV('cargarAjustes');
export const guardarAjustes = porTV('guardarAjustes');
export const cargarSistema = porTV('cargarSistema');
export const enviarEstado = porTV('enviarEstado');

// Suscripciones (devuelven la función para dejar de escuchar): con una TV Lite se suscriben cuando cargue la parte Bluetooth.
const suscripcion = (nombre) => (...a) => {
  if (!tvLite) return pro[nombre](...a);
  let baja = null;
  let cancelada = false;
  cargarLite().then((m) => { if (!cancelada) baja = m[nombre](...a); });
  return () => { cancelada = true; if (baja) baja(); };
};
export const suscribirLastSeen = suscripcion('suscribirLastSeen');
export const suscribirMostrada = suscripcion('suscribirMostrada');
export const suscribirFirmwareTV = suscripcion('suscribirFirmwareTV');

// ---------- POR ID: las TV Lite se resuelven en el celular ----------
const NO_SE_COMPARTE = { exito: false, error: 'Una TV Lite no se comparte.' };

/** Ids de las TV de la cuenta: las de la nube (Pro) y las TV Lite que añadió en este celular. */
export async function listarMisDispositivos(uid) {
  const propias = listarTVLite(claveCuenta(uid));
  const r = await pro.listarMisDispositivos(uid);
  let resultado = r;
  if (r.exito) resultado = { exito: true, dispositivos: [...r.dispositivos, ...propias] };
  // Sin conexión a la nube, una TV Lite ya añadida se puede seguir usando.
  else if (propias.length) resultado = { exito: true, dispositivos: propias };
  // Una cuenta sin ninguna TV (la primera vez): "Añade tu TV" pregunta "¿Qué TV tienes?" (clase sin-tv; ver unificada.css).
  try { document.body.classList.toggle('sin-tv', !!resultado.exito && resultado.dispositivos.length === 0); } catch (e) { /* sin pantalla */ }
  return resultado;
}

export async function rolEnTV(uid, id) {
  return esIdLite(id) ? { exito: true, rol: 'dueno' } : pro.rolEnTV(uid, id);
}

export async function quitarTVDeMiLista(uid, id) {
  if (!esIdLite(id)) return pro.quitarTVDeMiLista(uid, id);
  quitarTVLite(claveCuenta(uid), id);
  return { exito: true };
}

export async function desvincularDispositivo(uid, id) {
  if (!esIdLite(id)) return pro.desvincularDispositivo(uid, id);
  quitarTVLite(claveCuenta(uid), id);
  if (cargaLite) { // solo si ya se había cargado la parte Bluetooth (había una conexión que cerrar)
    try { const m = await cargaLite; await m.ble.desconectar(); m.ble.olvidarTV(); } catch (e) { /* ya estaba desconectada */ }
  }
  return { exito: true };
}

export async function salirDeTV(uid, id) {
  return esIdLite(id) ? desvincularDispositivo(uid, id) : pro.salirDeTV(uid, id);
}

export async function listarMiembros(id) {
  return esIdLite(id) ? { exito: true, miembros: [] } : pro.listarMiembros(id);
}

export async function crearInvitacion(id) {
  return esIdLite(id) ? NO_SE_COMPARTE : pro.crearInvitacion(id);
}

export async function quitarMiembro(id, uidMiembro) {
  return esIdLite(id) ? NO_SE_COMPARTE : pro.quitarMiembro(id, uidMiembro);
}

export async function guardarApodoMiembro(id, uidMiembro, nombre) {
  return esIdLite(id) ? NO_SE_COMPARTE : pro.guardarApodoMiembro(id, uidMiembro, nombre);
}

/**
 * Vincula una TV con el código que escribió la persona. Una TV Lite no tiene código en la nube: "Añade tu TV" la empareja
 * por Bluetooth, la registra con unificadaAnadirTVLite y envía el formulario con la marca "LITE"; aquí se reconoce.
 */
export async function usarCodigoTV(uid, codigoTexto) {
  if (tvLitePendiente && pro.normalizarCodigo(codigoTexto) === 'LITE') {
    const id = tvLitePendiente;
    tvLitePendiente = null;
    return { exito: true, id };
  }
  return pro.usarCodigoTV(uid, codigoTexto);
}

// ---------- Extras de la app unificada (los usa js/anadir-lite.js) ----------
/** Registra una TV Lite recién emparejada en esta cuenta; el próximo usarCodigoTV("LITE") la vincula. */
export function unificadaAnadirTVLite(uid, bleId) {
  tvLitePendiente = anadirTVLite(claveCuenta(uid), bleId);
  return tvLitePendiente;
}

/** Ids de las TV Lite de esta cuenta (o del celular, sin cuenta). */
export function unificadaListarTVLite(uid) { return listarTVLite(claveCuenta(uid)); }
