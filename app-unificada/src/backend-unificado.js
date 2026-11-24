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
  iniciarSesionConGoogleNativo, proveedorDeLaCuenta, eliminarMiCuenta, recuperarContrasena,
  VERSION_DESVINCULADA, normalizarCodigo, reclamarDispositivo, MAXIMO_MIEMBROS,
  MAXIMO_APODO, borrarInvitacion, listarCanciones, guardarCancionCatalogo, borrarCancionCatalogo,
  leerMusical, claveMusicalValida,
  guardarMusicalCatalogo, borrarMusicalCatalogo, CANTIDAD_ALARMAS, DIAS_ALARMA_DEFECTO, normalizarAlarma,
  AJUSTES_DEFECTO
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

// ---------- SIN INTERNET ----------
// Una TV Lite va por Bluetooth: sin internet se sigue usando (solo falta lo que viene de la nube: la galería predeterminada y las
// canciones). Por eso, con una TV Lite, lo que espera a la nube al arrancar no se espera (una lectura de Firebase sin red puede
// quedarse colgada y el panel tardaría en abrirse o diría que "la conexión está lenta"). Con una TV Pro todo sigue igual que en la Pro.
const sinInternet = () => { try { return navigator.onLine === false; } catch (e) { return false; } };
const conTVLite = () => { try { return document.body.classList.contains('tv-lite'); } catch (e) { return false; } };

/** Igual que la Pro; sin cuenta (sesión anónima) no hay administrador, y con una TV Lite sin internet no se espera a la nube. */
export async function esAdministrador() {
  return unificadaSinCuenta() || (conTVLite() && sinInternet()) ? false : pro.esAdministrador();
}

/** Igual que la Pro; con una TV Lite y sin internet devuelve enseguida "no se pudo leer" (null), como la Pro cuando falla. */
export async function listarMusicales() {
  return conTVLite() && sinInternet() ? null : pro.listarMusicales();
}

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
    if (/operation-not-allowed|admin-restricted-operation/.test(codigo)) return { exito: false, error: 'Por ahora no se puede usar Pepito Lite. Inténtalo más tarde.' };
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

// ---------- Lectura de la nube para la actualización de una TV Lite (firmware/lite/<modelo>/…, docs/plan-ota-lite.md) ----------
// La misma copia del SDK de base de datos que usa firebase-pro.js (construir.mjs pone aquí su dirección) y la misma base (pro.db).
const SDK_DB = '__SDK_DB__';
const ESPERA_NUBE_MS = 30000;
async function leerNube(ruta) {
  const m = await import(SDK_DB);
  let reloj = null;
  const tope = new Promise((_, rechazar) => { reloj = setTimeout(() => rechazar(new Error('La conexión está lenta')), ESPERA_NUBE_MS); });
  try {
    const foto = await Promise.race([m.get(m.ref(pro.db, ruta)), tope]);
    return foto.exists() ? foto.val() : null;
  } finally {
    clearTimeout(reloj);
  }
}

// ---------- La parte Bluetooth, bajo demanda ----------
let cargaLite = null;
function cargarLite() {
  if (!cargaLite) {
    cargaLite = import('./lite-tv.js').then((m) => {
      // Las canciones que se mandan a una TV Lite salen del catálogo de la nube; su actualización, de firmware/lite/… (leerNube).
      m.configurar({ leerMusical: pro.leerMusical, leerNube });
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
// El último estado del panel (lo que se ve en la TV): una cara de reloj para una TV Pro se manda con la orden "ajustes", y
// enviarEstado de la Pro arma esa orden a partir del estado (texto, configuración…).
let ultimoEstado = null;
const ORDENES = ['alarma', 'ajustes', 'actualizar', 'restablecer', 'juego'];
export async function cargarEstado(...a) {
  const r = await (tvLite ? cargarLite().then((m) => m.cargarEstado(...a)) : pro.cargarEstado(...a));
  if (r && r.exito !== false) ultimoEstado = r;
  return r;
}
export const leerMostrada = porTV('leerMostrada');
export const cargarAlarma = porTV('cargarAlarma');
export const guardarAlarma = porTV('guardarAlarma');
// ---------- Apagado automático de la pantalla (2026-11-23, Pepito Pro y Pepito Lite) ----------
// Más > Config > Ajustes: lista "Apagar pantalla" (#ajusteApagado, HTML en construir.mjs). mas.js de la Pro no la conoce: aquí se
// muestra al leer los ajustes y se agrega al guardarlos. Valores: minutos sin usar el botón (0 = nunca); si falta, 5.
const APAGADOS = [0, 5, 10, 20];
const APAGADO_DEFECTO = 5;
const normalizarApagado = (v) => (APAGADOS.includes(Number(v)) ? Number(v) : APAGADO_DEFECTO);
const listaApagado = () => { try { return document.getElementById('ajusteApagado'); } catch (e) { return null; } };
// Al ELEGIR "Nunca" la línea de estado de arriba muestra su aviso (el mismo texto que la ventanita muestra debajo de "Nunca").
function avisarSiNunca() {
  const lista = listaApagado();
  if (!lista || lista.value !== '0') return;
  const opcion = lista.options[lista.selectedIndex];
  const estado = (() => { try { return document.getElementById('estadoTexto'); } catch (e) { return null; } })();
  if (estado && opcion && opcion.dataset.nota) estado.textContent = opcion.dataset.nota;
}
try { document.addEventListener('change', (e) => { if (e.target && e.target.id === 'ajusteApagado') avisarSiNunca(); }); } catch (e) { /* sin pantalla */ }

export function normalizarAjustes(datos) {
  const n = pro.normalizarAjustes(datos);
  if (datos && typeof datos === 'object' && datos.apagado !== undefined) n.apagado = normalizarApagado(datos.apagado);
  return n;
}

// Ciudad para el clima (2026-11-24): vive en dispositivos/{id}/ajustes.ciudad de un Pepito Pro. La pantalla de Ajustes de la Pro no
// la conoce: al guardar desde allí se agrega la última que se leyó, para no borrarla.
let ciudadConocida = null;

export async function cargarAjustes(...a) {
  const r = await (tvLite ? cargarLite().then((m) => m.cargarAjustes(...a)) : pro.cargarAjustes(...a));
  if (!tvLite && r && r.exito) ciudadConocida = (r.ajustes && r.ajustes.ciudad) || null;
  const lista = listaApagado();
  if (lista && r && r.exito) lista.value = String(normalizarApagado(r.ajustes && r.ajustes.apagado));
  return r;
}

export async function guardarAjustes(datos, ...resto) {
  const lista = listaApagado();
  const conApagado = lista ? Object.assign({}, datos, { apagado: normalizarApagado(lista.value) }) : datos;
  if (tvLite) return (await cargarLite()).guardarAjustes(conApagado, ...resto);
  if (ciudadConocida && !(datos && datos.ciudad)) conApagado.ciudad = ciudadConocida;
  const r = await pro.guardarAjustes(conApagado, ...resto);
  // Mientras las reglas publicadas de Firebase no incluyan "apagado", rechazan todo el nodo: se guarda lo demás sin él (la TV
  // usa 5 minutos) y lo de la pantalla se guardará cuando el dueño publique las reglas nuevas.
  if (!r.exito && conApagado !== datos && /permiso|permission/i.test(String(r.error || ''))) {
    console.warn('[Pepito] Las reglas de Firebase aún no aceptan "apagado": los ajustes se guardan sin él.');
    const sinApagado = Object.assign({}, conApagado);
    delete sinApagado.apagado;
    delete sinApagado.ciudad; // lo mismo con la ciudad (2026-11-24)
    return pro.guardarAjustes(sinApagado, ...resto);
  }
  return r;
}
export const cargarSistema = porTV('cargarSistema');
export async function enviarEstado(estado, ...resto) {
  if (estado && !ORDENES.includes(estado.tipo)) ultimoEstado = estado;
  return tvLite ? (await cargarLite()).enviarEstado(estado, ...resto) : pro.enviarEstado(estado, ...resto);
}

// ---------- Caras de reloj (2026-11-24, docs/plan-caras-de-reloj.md; las usa js/caras.js) ----------
// El catálogo (relojes/) viene de la nube para las dos TV. La cara elegida: TV Pro -> dispositivos/{id}/reloj = { clave, datos }
// + la orden "ajustes" (la TV la lee con sus ajustes); TV Lite -> por Bluetooth (lite-tv.js).
const ESTADO_MINIMO = { tipo: 'texto', texto: '', tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
const deBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const aBase64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Las caras del catálogo: [{ clave, nombre }] en el orden que les dio el dueño, o null si no se pudo leer (sin internet). */
export async function unificadaListarCaras() {
  const v = await leerNube('relojes/indice');
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v)
    .filter(([, c]) => c && typeof c.nombre === 'string')
    .map(([clave, c]) => ({ clave, nombre: c.nombre, orden: Number(c.orden) || 0 }))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

/** La receta de una cara del catálogo (Uint8Array) o null. */
export async function unificadaLeerCara(clave) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(clave))) return null;
  const b64 = await leerNube(`relojes/datos/${clave}`);
  return typeof b64 === 'string' ? deBase64(b64) : null;
}

/** La clave de la cara que tiene la TV en uso ('' = Cara 1). */
export async function unificadaCaraActual() {
  if (tvLite) return (await cargarLite()).caraActual();
  const id = pro.dispositivoActual();
  if (!id) return '';
  const v = await leerNube(`dispositivos/${id}/reloj/clave`);
  return typeof v === 'string' ? v : '';
}

/** ¿La TV en uso puede cambiar de cara? true / false (hay que actualizarla) / null (no se sabe: sin conexión). */
export async function unificadaPuedeCaras() {
  if (tvLite) return (await cargarLite()).puedeCaras();
  const s = await pro.cargarSistema();
  if (!s || !s.exito) return null;
  return !!(s.firmware && s.firmware.build >= 11); // Pepito Pro v11: la primera con caras
}

/** Editor del dueño: guarda una cara en el catálogo (relojes/datos y relojes/indice; las reglas solo dejan a un administrador). */
export async function unificadaGuardarCaraCatalogo(clave, nombre, orden, receta) {
  try {
    const m = await import(SDK_DB);
    await m.update(m.ref(pro.db), {
      [`relojes/datos/${clave}`]: aBase64(receta),
      [`relojes/indice/${clave}`]: { nombre, orden, fecha: Date.now() },
    });
    return { exito: true };
  } catch (error) {
    console.error('[Pepito] No se pudo guardar la cara en el catálogo:', error);
    return { exito: false, error: 'No se pudo guardar: ' + pro.describirError(error) + '.' };
  }
}

/** Editor del dueño: borra una cara del catálogo (las TV que ya la tienen la conservan: es una copia). */
export async function unificadaBorrarCaraCatalogo(clave) {
  try {
    const m = await import(SDK_DB);
    await m.update(m.ref(pro.db), { [`relojes/datos/${clave}`]: null, [`relojes/indice/${clave}`]: null });
    return { exito: true };
  } catch (error) {
    console.error('[Pepito] No se pudo borrar la cara del catálogo:', error);
    return { exito: false, error: 'No se pudo borrar: ' + pro.describirError(error) + '.' };
  }
}

/** La ciudad para el clima del Pepito Pro en uso: { nombre, lat, lon } o null. */
export async function unificadaCiudad() {
  if (tvLite) return null;
  const r = await pro.cargarAjustes();
  if (!r || !r.exito) return null;
  ciudadConocida = (r.ajustes && r.ajustes.ciudad) || null;
  return ciudadConocida;
}

/** Guarda la ciudad (o null = sin clima) con los demás ajustes y le avisa a la TV (orden "ajustes"). */
export async function unificadaGuardarCiudad(ciudad) {
  if (tvLite) return { exito: false, error: 'Esto no está disponible en un Pepito Lite' };
  const r = await pro.cargarAjustes();
  if (!r || !r.exito) return { exito: false, error: (r && r.error) || 'No se pudo leer los ajustes' };
  const datos = Object.assign({}, r.ajustes);
  if (ciudad) datos.ciudad = { nombre: String(ciudad.nombre).slice(0, 60), lat: Number(ciudad.lat), lon: Number(ciudad.lon) };
  else delete datos.ciudad;
  const res = await pro.guardarAjustes(datos, Object.assign({}, ultimoEstado || ESTADO_MINIMO));
  if (res && res.exito) ciudadConocida = datos.ciudad || null;
  return res;
}

/** Busca ciudades por nombre (buscador gratuito de Open-Meteo, sin clave): [{ nombre, lat, lon }] o null si no hubo respuesta. */
export async function unificadaBuscarCiudad(texto) {
  const t = String(texto || '').trim();
  if (t.length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(t)}&count=8&language=es&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    return (j.results || []).map((c) => ({
      nombre: [c.name, c.admin1, c.country].filter((x, i, l) => x && l.indexOf(x) === i).join(', ').slice(0, 60),
      lat: Math.round(Number(c.latitude) * 10000) / 10000,
      lon: Math.round(Number(c.longitude) * 10000) / 10000,
    })).filter((c) => c.nombre && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  } catch (e) {
    console.warn('[Pepito] No se pudo buscar la ciudad:', e && e.message);
    return null;
  }
}

/** Copia la cara a la TV en uso (clave '' = Cara 1). { exito } o { exito: false, error }. */
export async function unificadaElegirCara(clave, receta) {
  if (tvLite) return (await cargarLite()).elegirCara(clave, receta);
  const id = pro.dispositivoActual();
  if (!id) return { exito: false, error: 'No hay ningún Pepito elegido' };
  try {
    const m = await import(SDK_DB);
    const ruta = m.ref(pro.db, `dispositivos/${id}/reloj`);
    if (clave) await m.set(ruta, { clave, datos: aBase64(receta) });
    else await m.remove(ruta);
  } catch (error) {
    console.error('[Pepito] No se pudo guardar la cara:', error);
    return { exito: false, error: pro.describirError(error) };
  }
  return pro.enviarEstado(Object.assign({}, ultimoEstado || ESTADO_MINIMO, { tipo: 'ajustes' }));
}

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
const NO_SE_COMPARTE = { exito: false, error: 'Un Pepito Lite no se comparte.' };

/** Ids de las TV de la cuenta: las de la nube (Pro) y las TV Lite que añadió en este celular. */
// En la Pro, cuentas.js avisa "sin internet" ANTES de pedir la lista; en la unificada lo decide esta función (construir.mjs quita
// esa línea de la COPIA de cuentas.js) para que una TV Lite ya añadida se pueda usar sin internet. Mismo texto que la Pro.
const AVISO_SIN_INTERNET = 'Sin conexión a internet. Conéctate y pulsa Reintentar.';
export async function listarMisDispositivos(uid) {
  const propias = listarTVLite(claveCuenta(uid));
  let resultado;
  if (unificadaSinCuenta()) {
    // Sin cuenta (sesión anónima) no puede haber una TV Pro: no se pregunta a la nube.
    resultado = { exito: true, dispositivos: propias };
  } else if (sinInternet()) {
    resultado = propias.length ? { exito: true, dispositivos: propias } : { exito: false, error: AVISO_SIN_INTERNET };
  } else {
    const r = await pro.listarMisDispositivos(uid);
    resultado = r;
    if (r.exito) resultado = { exito: true, dispositivos: [...r.dispositivos, ...propias] };
    // Sin conexión a la nube, una TV Lite ya añadida se puede seguir usando.
    else if (propias.length) resultado = { exito: true, dispositivos: propias };
  }
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
  if (!esIdLite(id)) {
    // H-34 con las caras de reloj (2026-11-24): la cara elegida también se borra, como la alarma y los ajustes. Va ANTES (después
    // ya no se es dueño); si no se puede (reglas viejas, sin señal), se desvincula igual.
    try {
      const m = await import(SDK_DB);
      await Promise.race([m.remove(m.ref(pro.db, `dispositivos/${id}/reloj`)), new Promise((r) => setTimeout(r, 5000))]);
    } catch (e) {
      console.warn('[Pepito] No se pudo borrar la cara de reloj al desvincular:', e && e.message);
    }
    return pro.desvincularDispositivo(uid, id);
  }
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
