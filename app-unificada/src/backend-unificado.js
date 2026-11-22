// Enrutador de la app unificada. En la copia que arma construir.mjs, ESTE archivo ocupa el lugar de js/firebase.js (el único
// módulo por el que el resto de la app habla con la TV y con Firebase) y el firebase.js de la Pro queda como
// js/firebase-pro.js, SIN tocar. Cada función de la Pro se decide aquí A MANO:
//
//   NUBE       sigue yendo a Firebase, igual que en la Pro (cuentas, galería, canciones, administrador…).
//   POR TV     depende de qué TV está en uso: una TV Pro habla con Firebase (firebase-pro.js); una TV Lite, por Bluetooth (lite-tv.js).
//   POR ID     recibe el id de una TV: si es "lite:…" se resuelve en el celular y NUNCA llega a Firebase (leer
//              dispositivos/lite:…/dueno daría "sin permiso" y la TV desaparecería de la lista).
//
// construir.mjs comprueba que aquí esté exactamente cada nombre que exporta el firebase.js de la Pro (ni uno menos): si la
// Pro agrega una función nueva, la compilación falla en vez de dejar pasar a Firebase un id de TV Lite.
// Se permiten nombres extra solo si empiezan con "unificada".

import * as pro from './firebase-pro.js';
import * as lite from './lite-tv.js';

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

// Las canciones que se mandan a una TV Lite salen del catálogo de la nube.
lite.configurar({ leerMusical: pro.leerMusical });

// ---------- Qué TV está en uso ----------
let tvLite = false;
let idActivo = null;
let tvLitePendiente = null; // TV Lite recién emparejada que "Añade tu TV" está a punto de vincular (ver usarCodigoTV)

/** Pasa a usar la cuenta y la TV elegida (de aquí en adelante todo va a esa TV y al catálogo de esa cuenta). */
export function usarCuenta(uid, dispositivo) {
  tvLite = lite.esIdLite(dispositivo);
  idActivo = dispositivo;
  try { document.body.classList.toggle('tv-lite', tvLite); } catch (e) { /* sin pantalla */ }
  pro.usarCuenta(uid, dispositivo); // el catálogo de la cuenta (usuarios/{uid}/…) lo necesita en los dos casos
  if (tvLite) lite.usarTV(dispositivo);
}

export function dispositivoActual() { return tvLite ? idActivo : pro.dispositivoActual(); }

export function describirError(error) {
  return error instanceof lite.ErrorTV ? lite.describirErrorTV(error) : pro.describirError(error);
}

// ---------- POR TV ----------
export const cargarEstado = (...a) => (tvLite ? lite.cargarEstado(...a) : pro.cargarEstado(...a));
export const suscribirLastSeen = (...a) => (tvLite ? lite.suscribirLastSeen(...a) : pro.suscribirLastSeen(...a));
export const suscribirMostrada = (...a) => (tvLite ? lite.suscribirMostrada(...a) : pro.suscribirMostrada(...a));
export const leerMostrada = (...a) => (tvLite ? lite.leerMostrada(...a) : pro.leerMostrada(...a));
export const cargarAlarma = (...a) => (tvLite ? lite.cargarAlarma(...a) : pro.cargarAlarma(...a));
export const guardarAlarma = (...a) => (tvLite ? lite.guardarAlarma(...a) : pro.guardarAlarma(...a));
export const cargarAjustes = (...a) => (tvLite ? lite.cargarAjustes(...a) : pro.cargarAjustes(...a));
export const guardarAjustes = (...a) => (tvLite ? lite.guardarAjustes(...a) : pro.guardarAjustes(...a));
export const cargarSistema = (...a) => (tvLite ? lite.cargarSistema(...a) : pro.cargarSistema(...a));
export const suscribirFirmwareTV = (...a) => (tvLite ? lite.suscribirFirmwareTV(...a) : pro.suscribirFirmwareTV(...a));
export const enviarEstado = (...a) => (tvLite ? lite.enviarEstado(...a) : pro.enviarEstado(...a));

// ---------- POR ID: las TV Lite se resuelven en el celular ----------
const NO_SE_COMPARTE = { exito: false, error: 'Una TV Lite no se comparte.' };

/** Ids de las TV de la cuenta: las de la nube (Pro) y las TV Lite que añadió en este celular. */
export async function listarMisDispositivos(uid) {
  const propias = lite.listarTVLite(uid);
  const r = await pro.listarMisDispositivos(uid);
  if (r.exito) return { exito: true, dispositivos: [...r.dispositivos, ...propias] };
  // Sin conexión a la nube, una TV Lite ya añadida se puede seguir usando.
  if (propias.length) return { exito: true, dispositivos: propias };
  return r;
}

export async function rolEnTV(uid, id) {
  return lite.esIdLite(id) ? { exito: true, rol: 'dueno' } : pro.rolEnTV(uid, id);
}

export async function quitarTVDeMiLista(uid, id) {
  if (!lite.esIdLite(id)) return pro.quitarTVDeMiLista(uid, id);
  lite.quitarTVLite(uid, id);
  return { exito: true };
}

export async function desvincularDispositivo(uid, id) {
  if (!lite.esIdLite(id)) return pro.desvincularDispositivo(uid, id);
  lite.quitarTVLite(uid, id);
  try { await lite.ble.desconectar(); lite.ble.olvidarTV(); } catch (e) { /* ya estaba desconectada */ }
  return { exito: true };
}

export async function salirDeTV(uid, id) {
  return lite.esIdLite(id) ? desvincularDispositivo(uid, id) : pro.salirDeTV(uid, id);
}

export async function listarMiembros(id) {
  return lite.esIdLite(id) ? { exito: true, miembros: [] } : pro.listarMiembros(id);
}

export async function crearInvitacion(id) {
  return lite.esIdLite(id) ? NO_SE_COMPARTE : pro.crearInvitacion(id);
}

export async function quitarMiembro(id, uidMiembro) {
  return lite.esIdLite(id) ? NO_SE_COMPARTE : pro.quitarMiembro(id, uidMiembro);
}

export async function guardarApodoMiembro(id, uidMiembro, nombre) {
  return lite.esIdLite(id) ? NO_SE_COMPARTE : pro.guardarApodoMiembro(id, uidMiembro, nombre);
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
  tvLitePendiente = lite.anadirTVLite(uid, bleId);
  return tvLitePendiente;
}
