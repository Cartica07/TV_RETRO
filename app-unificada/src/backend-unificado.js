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
  iniciarSesionConGoogleNativo, proveedorDeLaCuenta, eliminarMiCuenta, cerrarSesion, recuperarContrasena, esAdministrador,
  leerPreprocesada, leerCuadrosAnimacion, VERSION_DESVINCULADA, normalizarCodigo, reclamarDispositivo, MAXIMO_MIEMBROS,
  MAXIMO_APODO, borrarInvitacion, suscribirImagenes, suscribirAnimaciones, listarCanciones, guardarCancionCatalogo,
  listarImagenes, guardarImagenCatalogo, borrarImagenCatalogo, borrarCancionCatalogo, listarAnimaciones,
  guardarAnimacionCatalogo, borrarAnimacionCatalogo, listarMusicales, leerMusical, claveMusicalValida,
  guardarMusicalCatalogo, borrarMusicalCatalogo, CANTIDAD_ALARMAS, DIAS_ALARMA_DEFECTO, normalizarAlarma,
  AJUSTES_DEFECTO, normalizarAjustes
} from './firebase-pro.js';

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
  try { document.body.classList.toggle('tv-lite', tvLite); } catch (e) { /* sin pantalla */ }
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
  const propias = listarTVLite(uid);
  const r = await pro.listarMisDispositivos(uid);
  if (r.exito) return { exito: true, dispositivos: [...r.dispositivos, ...propias] };
  // Sin conexión a la nube, una TV Lite ya añadida se puede seguir usando.
  if (propias.length) return { exito: true, dispositivos: propias };
  return r;
}

export async function rolEnTV(uid, id) {
  return esIdLite(id) ? { exito: true, rol: 'dueno' } : pro.rolEnTV(uid, id);
}

export async function quitarTVDeMiLista(uid, id) {
  if (!esIdLite(id)) return pro.quitarTVDeMiLista(uid, id);
  quitarTVLite(uid, id);
  return { exito: true };
}

export async function desvincularDispositivo(uid, id) {
  if (!esIdLite(id)) return pro.desvincularDispositivo(uid, id);
  quitarTVLite(uid, id);
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
  tvLitePendiente = anadirTVLite(uid, bleId);
  return tvLitePendiente;
}
