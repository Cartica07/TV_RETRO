// Registro de las TV Lite de una cuenta (en el celular). Módulo SIN dependencias (ni Capacitor ni Bluetooth): el enrutador lo
// necesita siempre para listar las TV, y la parte Bluetooth (js/lite-tv.js) solo se carga cuando de verdad se usa una TV Lite,
// para que con una TV Pro no corra ni una línea nueva (el núcleo de Capacitor, por ejemplo, toca window.Capacitor).
//
// Id de una TV Lite: "lite:<dirección Bluetooth>". Las TV Pro se identifican con el id de Firebase de siempre.
export const PREFIJO = 'lite:';
export const esIdLite = (id) => typeof id === 'string' && id.startsWith(PREFIJO);
export const bleDe = (id) => String(id).slice(PREFIJO.length);
const claveRegistro = (uid) => 'tvretro.tvlite.' + uid;

function leerRegistro(uid) {
  try {
    const lista = JSON.parse(localStorage.getItem(claveRegistro(uid)) || '[]');
    return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string' && x.length > 0) : [];
  } catch (e) { return []; }
}

function escribirRegistro(uid, lista) {
  try { localStorage.setItem(claveRegistro(uid), JSON.stringify(lista)); } catch (e) { /* sin almacenamiento */ }
}

/** Ids ("lite:…") de las TV Lite de esta cuenta. */
export function listarTVLite(uid) { return leerRegistro(uid).map((b) => PREFIJO + b); }

/** Añade una TV Lite (dirección Bluetooth) a la cuenta y devuelve su id. */
export function anadirTVLite(uid, bleId) {
  const lista = leerRegistro(uid);
  if (!lista.includes(bleId)) lista.push(bleId);
  escribirRegistro(uid, lista);
  return PREFIJO + bleId;
}

/** Quita una TV Lite de la cuenta (la del celular; el vínculo de Bluetooth se quita en los ajustes del celular). */
export function quitarTVLite(uid, id) {
  escribirRegistro(uid, leerRegistro(uid).filter((b) => PREFIJO + b !== id));
}
