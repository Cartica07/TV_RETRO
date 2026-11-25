/**firebase
 * Firebase Integration
 * Maneja la carga y almacenamiento de configuración en Firebase Realtime Database
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getDatabase, ref, get, set, update, remove, onValue, runTransaction } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithCredential, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { FORMATO_COMPRIMIDO, FORMATO_MUSICAL, puedeComprimir, comprimirCuadros, descomprimirCuadros } from './compresion.js';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyACebxW1oTWpBWfinBUJwmynxHxQmtRMDo",
  authDomain: "lorenita-6ad1e.firebaseapp.com",
  databaseURL: "https://lorenita-6ad1e-default-rtdb.firebaseio.com",
  projectId: "lorenita-6ad1e",
  storageBucket: "lorenita-6ad1e.firebasestorage.app",
  messagingSenderId: "426829616333",
  appId: "1:426829616333:web:f1f5ce42ebf0e0aea04584"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
const auth = getAuth(app);
// Los correos de Firebase (verificar correo, restablecer contraseña) salen en español.
auth.languageCode = 'es';

/**
 * Explica en pocas palabras por qué falló una operación de Firebase
 * (recibe el Error o su mensaje), para mostrarlo en la interfaz.
 */
export function describirError(error) {
  const texto = String((error && error.message) || error || '');
  if (/PERMISSION_DENIED|permission/i.test(texto)) return 'sin permiso';
  if (/offline|network|conexi/i.test(texto)) return 'sin conexión a internet';
  return texto || 'error desconocido';
}

// ===================================================
// Cuentas (Firebase Auth, correo y contraseña)
// ===================================================
// Las funciones devuelven { exito: true, ... } o { exito: false, error } con el
// texto ya listo para mostrar al cliente (con "tú", nada técnico).

/**
 * Traduce un error de Firebase Auth a un mensaje claro para el cliente.
 */
export function describirErrorAuth(error) {
  const codigo = String((error && error.code) || '');
  switch (codigo) {
    case 'auth/invalid-email': return 'Ese correo no es válido.';
    case 'auth/missing-email': return 'Escribe tu correo.';
    case 'auth/missing-password': return 'Escribe tu contraseña.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials': return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use': return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    case 'auth/network-request-failed': return 'No hay conexión a internet.';
    case 'auth/user-disabled': return 'Esta cuenta está desactivada.';
    case 'auth/requires-recent-login': return 'Por seguridad, vuelve a confirmar que eres tú e inténtalo de nuevo.';
    case 'auth/popup-blocked': return 'El navegador bloqueó la ventana de Google. Permítela e inténtalo de nuevo.';
    case 'auth/operation-not-allowed': return 'Entrar con Google todavía no está disponible.';
    case 'auth/unauthorized-domain': return 'Entrar con Google no está habilitado en esta dirección.';
    case 'auth/account-exists-with-different-credential': return 'Ese correo ya tiene una cuenta con otra forma de entrar. Entra con tu correo y contraseña.';
    default: return 'No se pudo completar. Vuelve a intentarlo.';
  }
}

/**
 * Avisa cada vez que cambia la sesión: callback(usuario | null) con
 * { uid, email, emailVerified }. Se llama una vez al empezar, cuando Firebase
 * ya recuperó la sesión guardada. Devuelve la función para dejar de escuchar.
 */
export function escucharSesion(callback) {
  return onAuthStateChanged(auth, (u) => {
    callback(u ? { uid: u.uid, email: u.email, emailVerified: !!u.emailVerified } : null);
  });
}

/** Usuario con sesión iniciada ahora mismo, o null. */
export function usuarioActual() {
  const u = auth.currentUser;
  return u ? { uid: u.uid, email: u.email, emailVerified: !!u.emailVerified } : null;
}

export async function iniciarSesion(email, password) {
  try {
    await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    return { exito: true };
  } catch (error) {
    return { exito: false, error: describirErrorAuth(error) };
  }
}

/**
 * Crea la cuenta (y deja la sesión iniciada). Manda el correo de verificación
 * sin esperar ni fallar si no se puede: la cuenta ya quedó creada.
 */
export async function crearCuenta(email, password) {
  try {
    const r = await createUserWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    let correoEnviado = true;
    try { await sendEmailVerification(r.user); } catch (e) { correoEnviado = false; }
    return { exito: true, correoEnviado };
  } catch (error) {
    return { exito: false, error: describirErrorAuth(error) };
  }
}

/**
 * Entra (o crea la cuenta) con Google, en una ventana emergente. La cuenta de Google ya trae el
 * correo verificado. Si la persona cierra la ventana no es un error: devuelve { exito: false, cancelado: true }.
 */
export async function iniciarSesionConGoogle() {
  try {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, proveedor);
    return { exito: true };
  } catch (error) {
    const codigo = String((error && error.code) || '');
    if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') return { exito: false, cancelado: true };
    console.error('[TV RETRO] Entrar con Google:', codigo || error);
    return { exito: false, error: describirErrorAuth(error) };
  }
}

/**
 * Entrar con Google DENTRO DE LA APK: la ventana emergente no sirve en el WebView, así que la
 * cuenta se elige con el selector nativo de Android (plugin FirebaseAuthentication, sin sesión
 * nativa) y el idToken que devuelve se pasa al SDK web, que es el que maneja toda la sesión.
 * `plugin` es el plugin nativo (window.Capacitor.Plugins.FirebaseAuthentication).
 */
export async function iniciarSesionConGoogleNativo(plugin) {
  try {
    const r = await plugin.signInWithGoogle();
    const idToken = r && r.credential && r.credential.idToken;
    if (!idToken) throw new Error('Google no devolvió el idToken');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return { exito: true };
  } catch (error) {
    const texto = String((error && (error.code || error.message)) || error || '');
    // Cerrar el selector no es un error (el plugin lo informa como "canceled" / "cancelled").
    if (/cancel/i.test(texto)) return { exito: false, cancelado: true };
    console.error('[TV RETRO] Entrar con Google (app):', texto);
    return { exito: false, error: describirErrorAuth(error) };
  }
}

/** Con qué entra la cuenta con sesión: 'password' (correo y contraseña), 'google.com' u otro, o null. */
export function proveedorDeLaCuenta() {
  const u = auth.currentUser;
  if (!u) return null;
  const ids = (u.providerData || []).map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('google.com')) return 'google.com';
  return ids[0] || null;
}

/**
 * Borra la cuenta de la persona con sesión y TODO lo suyo (baja desde la app, la exigen Google Play
 * y la ley de datos personales):
 *   1) confirma que es ella (contraseña, o Google otra vez: Firebase pide un inicio de sesión reciente);
 *   2) suelta sus TV: las que son suyas quedan sin dueño (la TV muestra un código nuevo y se quita a quienes
 *      la compartían) y de las compartidas conmigo sale;
 *   3) borra usuarios/{uid} entero: imágenes, GIF, contadores y lista de TV;
 *   4) borra la cuenta de Firebase Authentication.
 * Se puede repetir si se corta a la mitad (cada paso tolera que ya esté hecho). El rol de administrador
 * (administradores/{uid}) no se toca desde acá. Devuelve { exito } o { exito: false, error } / { cancelado }.
 *   opciones.password: la contraseña (cuentas de correo)
 *   opciones.plugin:   plugin nativo FirebaseAuthentication (cuentas de Google dentro de la APK)
 */
export async function eliminarMiCuenta({ password = '', plugin = null } = {}) {
  const u = auth.currentUser;
  if (!u) return { exito: false, error: 'No hay una sesión iniciada.' };
  const uid = u.uid;

  // 1) Confirmar la identidad
  try {
    const proveedor = proveedorDeLaCuenta();
    if (proveedor === 'password') {
      if (!password) return { exito: false, error: 'Escribe tu contraseña para confirmar.' };
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
    } else if (proveedor === 'google.com') {
      if (plugin) {
        const r = await plugin.signInWithGoogle();
        const idToken = r && r.credential && r.credential.idToken;
        if (!idToken) throw new Error('Google no devolvió el idToken');
        await reauthenticateWithCredential(u, GoogleAuthProvider.credential(idToken));
      } else {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      }
    } else {
      return { exito: false, error: 'No se puede confirmar este tipo de cuenta desde la app.' };
    }
  } catch (error) {
    const codigo = String((error && error.code) || '');
    const texto = String((error && (error.code || error.message)) || '');
    if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request' || /cancel/i.test(texto)) return { exito: false, cancelado: true };
    if (codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential' || codigo === 'auth/invalid-login-credentials') return { exito: false, error: 'La contraseña no es correcta.' };
    console.error('[TV RETRO] Confirmar la baja de la cuenta:', codigo || error);
    return { exito: false, error: describirErrorAuth(error) };
  }

  // 2) Soltar las TV
  const lista = await listarMisDispositivos(uid);
  if (!lista.exito) return lista;
  for (const id of lista.dispositivos) {
    const rol = await rolEnTV(uid, id);
    if (!rol.exito) return rol;
    let r = { exito: true };
    if (rol.rol === 'dueno') r = await desvincularDispositivo(uid, id);
    else if (rol.rol === 'miembro') r = await salirDeTV(uid, id);
    if (!r.exito) return r;
  }

  // 3) Todo lo guardado
  try {
    const borrado = await esperarHasta(remove(ref(db, `usuarios/${uid}`)), ESPERA_MAXIMA_ENVIO_MS);
    if (borrado === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
  } catch (error) {
    console.error('Error al borrar los datos de la cuenta:', error);
    return { exito: false, error: 'No se pudieron borrar tus datos: ' + describirError(error) + '.' };
  }

  // 4) La cuenta
  try {
    await deleteUser(u);
  } catch (error) {
    console.error('[TV RETRO] Borrar la cuenta:', error && error.code);
    return { exito: false, error: describirErrorAuth(error) };
  }
  return { exito: true };
}

export async function cerrarSesion() {
  try {
    await signOut(auth);
    return { exito: true };
  } catch (error) {
    return { exito: false, error: describirErrorAuth(error) };
  }
}

export async function recuperarContrasena(email) {
  try {
    await sendPasswordResetEmail(auth, String(email || '').trim());
    return { exito: true };
  } catch (error) {
    return { exito: false, error: describirErrorAuth(error) };
  }
}

// ===================================================
// Rutas: modo viejo (sin cuentas) y modo cuentas
// ===================================================
// Modo viejo (hasta migrar, paso 7): oled_remota/…, imagenes/…, animaciones/….
// Modo cuentas (usarCuenta): dispositivos/{id}/oled_remota/… y usuarios/{uid}/imagenes|animaciones/…
// El resto (musicales, canciones) no cambia. Ver docs/formatos-datos.md sección 6.
let contexto = null; // null = modo viejo; { uid, dispositivo } = modo cuentas

/** Pasa a modo cuentas: de acá en adelante todo va a la TV y al catálogo de este usuario. */
export function usarCuenta(uid, dispositivo) {
  contexto = { uid, dispositivo };
}

const rutaOled = (sub = '') => (contexto ? `dispositivos/${contexto.dispositivo}/oled_remota` : 'oled_remota') + (sub ? '/' + sub : '');
const rutaCatalogo = (nombre) => (contexto ? `usuarios/${contexto.uid}/${nombre}` : nombre);

// ===================================================
// Límite de elementos por cuenta (modo cuentas)
// ===================================================
// Cada cuenta puede guardar hasta LIMITE_BASE_POR_DEFECTO elementos entre imágenes y
// animaciones JUNTAS, y de ellos como máximo LIMITE_GIF_POR_DEFECTO animaciones (GIF).
// config/limites/{total, animaciones} los cambia un administrador; usuarios/{uid}/cuotas/{extra,
// extraAnimaciones} suman más. Las de la biblioteca predeterminada (biblioteca/) NO cuentan. Un
// administrador no tiene límite. Lo hacen cumplir las reglas de Firebase: los contadores
// usuarios/{uid}/cuotas/usados (total) y /gifs (solo animaciones) se actualizan EN LA MISMA
// escritura que crea o borra el elemento, con cuotas/ultimo = "i:clave" (imagen) o "a:clave"
// (animación). Ver docs/formatos-datos.md sección 6.
const LIMITE_BASE_POR_DEFECTO = 25;
const LIMITE_GIF_POR_DEFECTO = 10;
const LARGO_MAXIMO_CLAVE = 80;

const mensajeLimiteGif = (limite) => `llegaste al límite de ${limite} GIF (animaciones) guardados; borra alguno para guardar otro`;
const mensajeLimite = (limite) => `llegaste al límite de ${limite} elementos guardados (imágenes y GIF juntos); borra alguno para guardar otro`;
const esPermisoDenegado = (err) => /PERMISSION_DENIED|permission/i.test(String((err && err.message) || err || ''));

async function leerCuota() {
  const uid = contexto.uid;
  const [admin, usados, gifs, base, baseGif, extra, extraGif] = await Promise.all([
    get(ref(db, `administradores/${uid}`)),
    get(ref(db, `usuarios/${uid}/cuotas/usados`)),
    get(ref(db, `usuarios/${uid}/cuotas/gifs`)),
    get(ref(db, 'config/limites/total')),
    get(ref(db, 'config/limites/animaciones')),
    get(ref(db, `usuarios/${uid}/cuotas/extra`)),
    get(ref(db, `usuarios/${uid}/cuotas/extraAnimaciones`))
  ]);
  const numero = (s, defecto) => (s.exists() && Number.isFinite(Number(s.val())) ? Number(s.val()) : defecto);
  return {
    admin: admin.val() === true,
    usados: numero(usados, 0),
    gifs: numero(gifs, 0),
    limite: numero(base, LIMITE_BASE_POR_DEFECTO) + numero(extra, 0),
    limiteGif: numero(baseGif, LIMITE_GIF_POR_DEFECTO) + numero(extraGif, 0)
  };
}

/** true si la cuenta con sesión es administradora (no tiene límite y puede borrar las predeterminadas). */
export async function esAdministrador() {
  if (!contexto) return false;
  try {
    // Con tope: si la conexión no responde, el arranque no se queda esperando (se asume "no administrador").
    const snap = await esperarHasta(get(ref(db, `administradores/${contexto.uid}`)), ESPERA_MAXIMA_ENVIO_MS);
    return snap !== ESPERA_LENTA && snap.val() === true;
  } catch (error) {
    return false;
  }
}

// Guardar en el catálogo exige tener el correo verificado (lo exigen las reglas de Firebase;
// un administrador queda exento). La cuenta de Google ya viene verificada.
let enlaceDeVerificacionReenviado = false;

/**
 * Comprueba que la cuenta tenga el correo verificado. Mira el dato que lleva la sesión (el que
 * leen las reglas); si no está, vuelve a consultar a Firebase por si la persona ya pulsó el enlace
 * en otra pestaña, y si aún no, le reenvía el enlace (una vez por sesión). Sin conexión no bloquea:
 * que decidan las reglas. Devuelve { ok: true } o { ok: false, reenviado }.
 */
async function comprobarCorreoVerificado() {
  const u = auth.currentUser;
  if (!u) return { ok: true };
  try {
    if ((await u.getIdTokenResult()).claims.email_verified === true) return { ok: true };
    await u.reload();
    if (u.emailVerified) {
      await u.getIdToken(true); // para que las reglas vean el cambio
      return { ok: true };
    }
  } catch (error) {
    return { ok: true };
  }
  let reenviado = false;
  if (!enlaceDeVerificacionReenviado) {
    try {
      await sendEmailVerification(u);
      enlaceDeVerificacionReenviado = true;
      reenviado = true;
    } catch (error) { /* si no se puede reenviar, el aviso sigue valiendo */ }
  }
  return { ok: false, reenviado };
}

// ===================================================
// Listas livianas de la Galería (auditoría 2026-11-15, H-12)
// ===================================================
// Antes la Galería bajaba los catálogos ENTEROS (con el PNG editable de cada imagen y todos los cuadros de
// cada animación) solo para pintar miniaturas: ~420 KB con la biblioteca predeterminada, y hasta decenas de MB
// con los GIF de una cuenta. Ahora cada catálogo tiene al lado una lista liviana, imagenes_indice /
// animaciones_indice (misma clave), que se escribe EN LA MISMA ESCRITURA que el elemento:
//   imagen    -> { datos, ancho, alto, meta, editable }       (sin la preprocesada; editable = tiene copia editable)
//   animación -> { ancho, alto, cantidad, miniatura, meta }  (miniatura = el primer cuadro; sin el resto)
// La Galería escucha solo la lista. Lo pesado se pide al elegir (leerPreprocesada / leerCuadrosAnimacion).
// Si una lista está vacía se lee el catálogo completo (elementos anteriores a este cambio) y se rellena la lista.
// Solo en modo cuentas; el modo viejo (?sincuentas=1) sigue como antes.
const rutaIndice = (tipo) => rutaCatalogo(tipo + '_indice');

/** Primer cuadro de una animación guardada (los cuadros vuelven como arreglo, o como objeto si faltan índices). */
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

/** La entrada de la lista liviana para un elemento ya armado (payload de guardarEnCatalogo o lo leído del catálogo). */
function construirIndice(tipo, p) {
  const meta = p.meta && typeof p.meta === 'object' ? JSON.parse(JSON.stringify(p.meta)) : null;
  if (tipo === 'imagenes') {
    const i = { datos: String(p.datos || ''), ancho: Number(p.ancho) || 0, alto: Number(p.alto) || 0 };
    if (meta && Object.keys(meta).length) i.meta = meta;
    if (p.preprocesada) i.editable = true;
    return i;
  }
  const primero = primerCuadro(p.cuadros);
  const i = { ancho: Number(p.ancho) || 0, alto: Number(p.alto) || 0, cantidad: contarCuadros(p.cuadros), miniatura: String((primero && primero.datos) || '') };
  if (meta && Object.keys(meta).length) i.meta = meta;
  return i;
}

/** De la lista liviana a lo que usa la Galería (parcial: true = falta lo pesado, se pide al elegir). */
function entradasDesdeIndice(tipo, lista) {
  const salida = {};
  for (const [clave, v] of Object.entries(lista || {})) {
    if (!v) continue;
    if (tipo === 'imagenes') {
      salida[clave] = { datos: v.datos, ancho: v.ancho, alto: v.alto, meta: v.meta || {}, editable: !!v.editable, parcial: true };
    } else {
      salida[clave] = { ancho: v.ancho, alto: v.alto, cantidad: v.cantidad, meta: v.meta || {}, cuadros: [{ datos: v.miniatura, dur: 0 }], parcial: true };
    }
  }
  return salida;
}

/**
 * Escucha una fuente (la cuenta o la biblioteca) por su lista liviana. Si la lista está vacía lee el catálogo
 * completo UNA vez (elementos anteriores a la lista) y, si "rellenar" lo permite, escribe la lista: desde ahí la
 * misma escucha pasa sola a la lista liviana.
 */
function suscribirFuenteIndexada(tipo, rutaItems, rutaLista, rellenar, callback, alError) {
  let cancelado = false;
  const baja = onValue(ref(db, rutaLista), async (snap) => {
    if (snap.exists()) {
      callback(entradasDesdeIndice(tipo, snap.val()));
      return;
    }
    try {
      const completo = await get(ref(db, rutaItems));
      if (cancelado) return;
      const valor = completo.exists() ? completo.val() : {};
      callback(valor);
      if (completo.exists() && rellenar) rellenar(valor);
    } catch (err) {
      console.error('Error al leer ' + rutaItems + ':', err);
      if (!cancelado && alError) alError(err);
    }
  }, (err) => {
    console.error('Error al escuchar ' + rutaLista + ':', err);
    if (alError) alError(err);
  });
  return () => { cancelado = true; baja(); };
}

/** Escribe la lista liviana de elementos anteriores a ella (mejor esfuerzo: sin permiso o sin red no pasa nada). */
function rellenarLista(tipo, rutaLista, valor) {
  const cambios = {};
  for (const [clave, v] of Object.entries(valor || {})) {
    if (v && typeof v === 'object') cambios[`${rutaLista}/${clave}`] = construirIndice(tipo, v);
  }
  if (Object.keys(cambios).length === 0) return;
  update(ref(db), cambios).catch((err) => console.warn('[TV RETRO] No se pudo rellenar la lista de la Galería:', err && err.code));
}

/** Pide solo la copia editable (PNG) de una imagen del catálogo. null si no hay o no se pudo leer. */
export async function leerPreprocesada(clave, { predeterminada = false } = {}) {
  try {
    const base = predeterminada ? 'biblioteca/imagenes' : rutaCatalogo('imagenes');
    const snap = await esperarHasta(get(ref(db, `${base}/${clave}/preprocesada`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA || !snap.exists()) return null;
    return String(snap.val());
  } catch (error) {
    console.error('Error al leer la copia editable:', error);
    return null;
  }
}

/** Pide los cuadros completos de una animación del catálogo (arreglo u objeto, como vengan). null si no se pudo. */
export async function leerCuadrosAnimacion(clave, { predeterminada = false } = {}) {
  try {
    const base = predeterminada ? 'biblioteca/animaciones' : rutaCatalogo('animaciones');
    const snap = await esperarHasta(get(ref(db, `${base}/${clave}/cuadros`)), ESPERA_MAXIMA_ENVIO_MS * 2);
    if (snap === ESPERA_LENTA || !snap.exists()) return null;
    return snap.val();
  } catch (error) {
    console.error('Error al leer los cuadros de la animación:', error);
    return null;
  }
}

/**
 * Guarda un elemento en el catálogo de la cuenta ('imagenes' | 'animaciones').
 * Reemplazar uno que ya existe no cambia el contador; uno nuevo lo suma (si cabe).
 */
async function guardarEnCatalogo(tipo, safeKey, payload, { predeterminada = false } = {}) {
  if (predeterminada) {
    // Biblioteca predeterminada (biblioteca/, la ven todas las cuentas): solo un administrador, sin contadores ni
    // límites. El elemento y su lista liviana van en la misma escritura (H-12), como en el catálogo de la cuenta.
    if (!contexto) return { exito: false, error: 'la biblioteca predeterminada solo existe con cuentas' };
    if (safeKey.length > LARGO_MAXIMO_CLAVE) return { exito: false, error: `el nombre es demasiado largo (máximo ${LARGO_MAXIMO_CLAVE} caracteres)` };
    if (!(await esAdministrador())) return { exito: false, error: 'solo un administrador puede guardar en la biblioteca predeterminada' };
    const lento = await conTope(update(ref(db), {
      [`biblioteca/${tipo}/${safeKey}`]: payload,
      [`biblioteca/${tipo}_indice/${safeKey}`]: construirIndice(tipo, payload)
    }), { exito: true, key: safeKey });
    return lento || { exito: true, key: safeKey };
  }
  const base = rutaCatalogo(tipo);
  if (!contexto) {
    const lento = await conTope(set(ref(db, `${base}/${safeKey}`), payload), { exito: true, key: safeKey });
    return lento || { exito: true, key: safeKey };
  }
  if (safeKey.length > LARGO_MAXIMO_CLAVE) return { exito: false, error: `el nombre es demasiado largo (máximo ${LARGO_MAXIMO_CLAVE} caracteres)` };

  const correo = await comprobarCorreoVerificado();
  if (!correo.ok && !(await esAdministrador())) {
    return { exito: false, error: 'primero confirma tu correo (' + (correo.reenviado ? 'te enviamos el enlace ahora' : 'ya te enviamos el enlace') + '; mira también en spam) y vuelve a intentarlo' };
  }

  const refItem = ref(db, `${base}/${safeKey}`);
  const prefijo = tipo === 'imagenes' ? 'i' : 'a';
  for (let intento = 0; intento < 2; intento++) {
    if ((await get(refItem)).exists()) {
      // Reemplazar no cambia el contador; la lista liviana se actualiza en la misma escritura (H-12).
      const lento = await conTope(update(ref(db), {
        [`${base}/${safeKey}`]: payload,
        [`${rutaIndice(tipo)}/${safeKey}`]: construirIndice(tipo, payload)
      }), { exito: true, key: safeKey });
      return lento || { exito: true, key: safeKey };
    }
    const cuota = await leerCuota();
    const esGif = tipo === 'animaciones';
    if (!cuota.admin) {
      if (esGif && cuota.gifs + 1 > cuota.limiteGif) return { exito: false, error: mensajeLimiteGif(cuota.limiteGif) };
      if (cuota.usados + 1 > cuota.limite) return { exito: false, error: mensajeLimite(cuota.limite) };
    }
    const cambios = {
      [`${base}/${safeKey}`]: payload,
      [`usuarios/${contexto.uid}/cuotas/usados`]: cuota.usados + 1,
      [`usuarios/${contexto.uid}/cuotas/ultimo`]: `${prefijo}:${safeKey}`
    };
    if (esGif) cambios[`usuarios/${contexto.uid}/cuotas/gifs`] = cuota.gifs + 1;
    // Lista liviana (H-12): el elemento nuevo y, si la cuenta tiene elementos anteriores a la lista (y esta sigue
    // vacía), también esos: si no, al haber ya una lista los demás desaparecerían de la Galería.
    cambios[`${rutaIndice(tipo)}/${safeKey}`] = construirIndice(tipo, payload);
    const hayAnteriores = esGif ? cuota.gifs > 0 : cuota.usados - cuota.gifs > 0;
    if (hayAnteriores && !(await get(ref(db, rutaIndice(tipo)))).exists()) {
      const todos = await get(ref(db, base));
      if (todos.exists()) {
        for (const [clave, v] of Object.entries(todos.val())) {
          if (v && typeof v === 'object' && clave !== safeKey) cambios[`${rutaIndice(tipo)}/${clave}`] = construirIndice(tipo, v);
        }
      }
    }
    try {
      const lento = await conTope(update(ref(db), cambios), { exito: true, key: safeKey });
      return lento || { exito: true, key: safeKey };
    } catch (err) {
      // Otro dispositivo cambió el contador al mismo tiempo: se vuelve a leer y se reintenta una vez.
      if (intento === 0 && esPermisoDenegado(err)) continue;
      throw err;
    }
  }
  return { exito: false, error: 'sin permiso' };
}

/**
 * Borra un elemento del catálogo de la cuenta y le resta 1 al contador (en la misma escritura; si es
 * una animación, también al de GIF). Con { predeterminada: true } borra de la biblioteca
 * predeterminada (solo un administrador; no hay contadores).
 */
async function borrarDeCatalogo(tipo, nombre, { predeterminada = false } = {}) {
  if (predeterminada) {
    // Se borra también de la lista liviana (H-12).
    const lento = await conTope(update(ref(db), { [`biblioteca/${tipo}/${nombre}`]: null, [`biblioteca/${tipo}_indice/${nombre}`]: null }));
    return lento || { exito: true };
  }
  const base = rutaCatalogo(tipo);
  const refItem = ref(db, `${base}/${nombre}`);
  if (!contexto) {
    const lento = await conTope(remove(refItem));
    return lento || { exito: true };
  }
  const prefijo = tipo === 'imagenes' ? 'i' : 'a';
  for (let intento = 0; intento < 2; intento++) {
    if (!(await get(refItem)).exists()) return { exito: true }; // ya no estaba
    const esGif = tipo === 'animaciones';
    const [usadosSnap, gifsSnap] = await Promise.all([
      get(ref(db, `usuarios/${contexto.uid}/cuotas/usados`)),
      get(ref(db, `usuarios/${contexto.uid}/cuotas/gifs`))
    ]);
    const usados = usadosSnap.exists() ? Number(usadosSnap.val()) || 0 : 0;
    const gifs = gifsSnap.exists() ? Number(gifsSnap.val()) || 0 : 0;
    try {
      let escritura;
      if (usados > 0 && (!esGif || gifs > 0)) {
        const cambios = {
          [`${base}/${nombre}`]: null,
          [`usuarios/${contexto.uid}/cuotas/usados`]: usados - 1,
          [`usuarios/${contexto.uid}/cuotas/ultimo`]: `${prefijo}:${nombre}`,
          [`${rutaIndice(tipo)}/${nombre}`]: null // lista liviana (H-12)
        };
        if (esGif) cambios[`usuarios/${contexto.uid}/cuotas/gifs`] = gifs - 1;
        escritura = update(ref(db), cambios);
      } else {
        // sin contador (cosa de administrador): se borra a secas
        escritura = update(ref(db), { [`${base}/${nombre}`]: null, [`${rutaIndice(tipo)}/${nombre}`]: null });
      }
      const lento = await conTope(escritura);
      return lento || { exito: true };
    } catch (err) {
      if (intento === 0 && esPermisoDenegado(err)) continue;
      throw err;
    }
  }
  return { exito: false, error: 'sin permiso' };
}

// ===================================================
// Dispositivos: vincular una TV con el código que muestra su pantalla
// ===================================================
const CODIGO_TV = /^[A-HJ-NP-Z2-9]{6}$/;

/** Valor de oled_remota/version que significa "esta TV fue desvinculada" (la TV escucha esa ruta). Una versión real nunca es negativa. */
export const VERSION_DESVINCULADA = -2;

/** Deja solo letras y números, en mayúsculas ("k7m-2qx" -> "K7M2QX"). */
export function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Ids de las TV vinculadas a este usuario: { exito, dispositivos: [id…] }. */
export async function listarMisDispositivos(uid) {
  try {
    const snap = await esperarHasta(get(ref(db, `usuarios/${uid}/dispositivos`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true, dispositivos: snap.exists() ? Object.keys(snap.val()).sort() : [] };
  } catch (error) {
    console.error('Error al listar las TV:', error);
    return { exito: false, error: 'No se pudo leer tu lista de TV: ' + describirError(error) + '.' };
  }
}

/**
 * Vincula la TV que mostró este código. 1) lee el código (solo se puede leer
 * conociéndolo) para saber qué TV es; 2) se pone como dueño con el código;
 * 3) la agrega a su lista. Las reglas de Firebase comprueban que el código no
 * haya vencido (10 minutos) y que la TV no tenga dueño.
 */
export async function reclamarDispositivo(uid, codigoTexto) {
  const codigo = normalizarCodigo(codigoTexto);
  if (codigo.length !== 6) return { exito: false, error: 'Escribe los 6 caracteres del código que muestra tu TV.' };
  if (!CODIGO_TV.test(codigo)) return { exito: false, error: 'Ese código no es válido. Revisa que no confundas 0 con O ni 1 con I.' };
  try {
    const snap = await esperarHasta(get(ref(db, `emparejamiento/${codigo}`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    const id = snap.exists() ? snap.val().id : null;
    if (!id) return { exito: false, error: 'Ese código no existe o ya venció. Revisa el código que muestra tu TV (se renueva solo).' };

    // Camino directo: dueño, código y lista de la cuenta en UNA sola escritura, así no puede
    // quedar una TV con dueño que no aparece en la lista de nadie (la app se cierra, se corta
    // la señal…). Necesita las reglas con la lista validada contra el estado posterior; si
    // todavía no están publicadas (o el código venció) responde "sin permiso" y se sigue con
    // el camino de dos pasos de abajo, que además explica el motivo.
    try {
      const unico = await esperarHasta(update(ref(db), {
        [`dispositivos/${id}/dueno`]: uid,
        [`dispositivos/${id}/codigoUsado`]: codigo,
        [`usuarios/${uid}/dispositivos/${id}`]: true
      }), ESPERA_MAXIMA_ENVIO_MS);
      if (unico === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
      return { exito: true, id };
    } catch (error) {
      if (!esPermisoDenegado(error)) throw error;
    }

    try {
      const paso = await esperarHasta(update(ref(db, `dispositivos/${id}`), { dueno: uid, codigoUsado: codigo }), ESPERA_MAXIMA_ENVIO_MS);
      if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    } catch (error) {
      if (/PERMISSION_DENIED|permission/i.test(String((error && error.message) || error))) {
        return { exito: false, error: 'No se pudo vincular: el código venció o esa TV ya tiene dueño. Pide uno nuevo en la TV.' };
      }
      throw error;
    }

    const lista = await esperarHasta(set(ref(db, `usuarios/${uid}/dispositivos/${id}`), true), ESPERA_MAXIMA_ENVIO_MS);
    if (lista === ESPERA_LENTA) return { exito: false, error: 'La TV quedó vinculada, pero la conexión está lenta. Vuelve a abrir la app.' };
    return { exito: true, id };
  } catch (error) {
    console.error('Error al vincular la TV:', error);
    return { exito: false, error: 'No se pudo vincular: ' + describirError(error) + '.' };
  }
}

/**
 * Desvincula la TV: deja de tener dueño, se quita a las personas con quienes
 * estaba compartida y sale de la lista. Deja `oled_remota/version = -2` (VERSION_DESVINCULADA):
 * la TV escucha esa ruta y, al verlo, muestra un código nuevo al instante.
 */
export async function desvincularDispositivo(uid, id) {
  try {
    const paso = await actualizarConRespaldoDeApodos({
      [`dispositivos/${id}/dueno`]: null,
      [`dispositivos/${id}/codigoUsado`]: null,
      [`dispositivos/${id}/miembros`]: null,
      [`dispositivos/${id}/apodos`]: null,
      [`dispositivos/${id}/oled_remota/version`]: VERSION_DESVINCULADA,
      // Auditoría 2026-11-15 (H-34): se limpia también lo que la TV guardaba del dueño anterior (último
      // contenido, GIF o musical, alarmas y ajustes). Si no, quien reciba la TV vería su último mensaje
      // y heredaría sus alarmas. Son nodos que ya existen: no cambia el contrato de datos.
      [`dispositivos/${id}/oled_remota/pantalla`]: null,
      [`dispositivos/${id}/oled_remota/archivo`]: null,
      [`dispositivos/${id}/alarma`]: null,
      [`dispositivos/${id}/ajustes`]: null,
      // La cara de reloj elegida (2026-11-24; la pone la app Pepito): tampoco debe heredarla quien reciba la TV.
      [`dispositivos/${id}/reloj`]: null,
      [`usuarios/${uid}/dispositivos/${id}`]: null
    });
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true };
  } catch (error) {
    console.error('Error al desvincular la TV:', error);
    return { exito: false, error: 'No se pudo desvincular: ' + describirError(error) + '.' };
  }
}

// ===================================================
// Compartir una TV: el dueño invita a otras cuentas (miembros)
// ===================================================
// Un miembro puede enviar contenido a la TV; solo el dueño la desvincula, invita
// y quita a otros. Se invita con un código de 6 caracteres de un solo uso que vence
// a los 10 minutos (`invitaciones/{codigo}`); el invitado lo escribe en Mi TV.
export const MAXIMO_MIEMBROS = 5;
const VIGENCIA_INVITACION_MS = 10 * 60 * 1000;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 caracteres: sin 0, O, 1, I

function codigoAleatorio() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
}

/**
 * Qué es esta cuenta para esa TV: { exito, rol: 'dueno' | 'miembro' | null }.
 * null = ya no tiene acceso (la desvincularon o la quitaron).
 */
export async function rolEnTV(uid, id) {
  try {
    const snap = await esperarHasta(get(ref(db, `dispositivos/${id}/dueno`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    if (!snap.exists()) return { exito: true, rol: null };
    return { exito: true, rol: snap.val() === uid ? 'dueno' : 'miembro' };
  } catch (error) {
    if (esPermisoDenegado(error)) return { exito: true, rol: null };
    console.error('Error al leer el rol en la TV:', error);
    return { exito: false, error: 'No se pudo leer tu TV: ' + describirError(error) + '.' };
  }
}

/** Quita una TV de la lista de esta cuenta (por ejemplo, si ya no tiene acceso). */
export async function quitarTVDeMiLista(uid, id) {
  try {
    const paso = await esperarHasta(remove(ref(db, `usuarios/${uid}/dispositivos/${id}`)), ESPERA_MAXIMA_ENVIO_MS);
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true };
  } catch (error) {
    console.error('Error al quitar la TV de la lista:', error);
    return { exito: false, error: 'No se pudo quitar la TV: ' + describirError(error) + '.' };
  }
}

/**
 * Los apodos (dispositivos/{id}/apodos) necesitan las reglas publicadas. Con las anteriores esa ruta no tiene
 * regla y rechazaría TODA la escritura: si pasa, se repite sin ella, para que quitar, salir y desvincular
 * nunca fallen por eso. Devuelve lo mismo que esperarHasta (ESPERA_LENTA si tardó demasiado).
 */
async function actualizarConRespaldoDeApodos(cambios) {
  try {
    return await esperarHasta(update(ref(db), cambios), ESPERA_MAXIMA_ENVIO_MS);
  } catch (error) {
    if (!esPermisoDenegado(error)) throw error;
    const sinApodos = {};
    for (const [ruta, valor] of Object.entries(cambios)) {
      if (!/\/apodos(\/|$)/.test(ruta)) sinApodos[ruta] = valor;
    }
    return await esperarHasta(update(ref(db), sinApodos), ESPERA_MAXIMA_ENVIO_MS);
  }
}

/** Quién más tiene acceso a la TV: { exito, miembros: [uid…], apodos: { uid: nombre } } (lo lee el dueño o un miembro). */
export async function listarMiembros(id) {
  try {
    const snap = await esperarHasta(get(ref(db, `dispositivos/${id}/miembros`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    // Los nombres son un extra: si no se pueden leer, se muestra "Persona N" y listo.
    let apodos = {};
    try {
      const nombres = await esperarHasta(get(ref(db, `dispositivos/${id}/apodos`)), ESPERA_MAXIMA_ENVIO_MS);
      if (nombres !== ESPERA_LENTA && nombres.exists() && typeof nombres.val() === 'object') apodos = nombres.val();
    } catch (error) {
      console.warn('[TV RETRO] No se pudieron leer los nombres de las personas:', error);
    }
    return { exito: true, miembros: snap.exists() ? Object.keys(snap.val()).sort() : [], apodos };
  } catch (error) {
    console.error('Error al listar las personas con acceso:', error);
    return { exito: false, error: 'No se pudo leer quién tiene acceso: ' + describirError(error) + '.' };
  }
}

/**
 * El dueño crea un código de invitación para su TV: { exito, codigo, venceEn }
 * (venceEn en ms desde época, aproximado con el reloj de este equipo).
 */
export async function crearInvitacion(id) {
  try {
    const actuales = await listarMiembros(id);
    if (!actuales.exito) return actuales;
    if (actuales.miembros.length >= MAXIMO_MIEMBROS) {
      return { exito: false, error: 'Esta TV ya tiene ' + MAXIMO_MIEMBROS + ' personas con acceso. Quita a alguien para invitar a otra.' };
    }
    for (let intento = 0; intento < 5; intento++) {
      const codigo = codigoAleatorio();
      try {
        const paso = await esperarHasta(set(ref(db, `invitaciones/${codigo}`), { id, creado: { '.sv': 'timestamp' } }), ESPERA_MAXIMA_ENVIO_MS);
        if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
        return { exito: true, codigo, venceEn: Date.now() + VIGENCIA_INVITACION_MS };
      } catch (error) {
        // Código ya vigente (casi imposible): se prueba con otro.
        if (!esPermisoDenegado(error)) throw error;
      }
    }
    return { exito: false, error: 'No se pudo crear el código. Vuelve a intentarlo.' };
  } catch (error) {
    console.error('Error al crear la invitación:', error);
    return { exito: false, error: 'No se pudo crear el código: ' + describirError(error) + '.' };
  }
}

/**
 * Borra una invitación (el dueño puede borrar las de sus TV). Se usa para limpiar las que vencieron sin
 * usarse (auditoría 2026-11-15, H-24). Es de mejor esfuerzo: si ya no existe o no se puede, no pasa nada.
 */
export async function borrarInvitacion(codigoTexto) {
  const codigo = normalizarCodigo(codigoTexto);
  if (!CODIGO_TV.test(codigo)) return { exito: false };
  try {
    await esperarHasta(remove(ref(db, `invitaciones/${codigo}`)), ESPERA_MAXIMA_ENVIO_MS);
    return { exito: true };
  } catch (error) {
    return { exito: false };
  }
}

/** El dueño quita a una persona de su TV. */
export async function quitarMiembro(id, uidMiembro) {
  try {
    const paso = await actualizarConRespaldoDeApodos({
      [`dispositivos/${id}/miembros/${uidMiembro}`]: null,
      [`dispositivos/${id}/apodos/${uidMiembro}`]: null
    });
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true };
  } catch (error) {
    console.error('Error al quitar a una persona:', error);
    return { exito: false, error: 'No se pudo quitar el acceso: ' + describirError(error) + '.' };
  }
}

/** Largo máximo del nombre de una persona (igual que las reglas). */
export const MAXIMO_APODO = 20;

/**
 * El dueño le pone nombre a una persona con acceso a su TV. Vacío = vuelve a "Persona N".
 * Devuelve { exito, nombre } con el nombre ya limpio.
 */
export async function guardarApodoMiembro(id, uidMiembro, nombre) {
  const limpio = String(nombre || '').replace(/\s+/g, ' ').trim();
  if (limpio.length > MAXIMO_APODO) return { exito: false, error: `Usa ${MAXIMO_APODO} letras o menos.` };
  try {
    const ruta = ref(db, `dispositivos/${id}/apodos/${uidMiembro}`);
    const paso = await esperarHasta(limpio ? set(ruta, limpio) : remove(ruta), ESPERA_MAXIMA_ENVIO_MS);
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true, nombre: limpio };
  } catch (error) {
    console.error('Error al guardar el nombre de una persona:', error);
    return { exito: false, error: 'No se pudo guardar el nombre: ' + describirError(error) + '.' };
  }
}

/** Un miembro deja de tener acceso a la TV (la TV sigue siendo de su dueño). */
export async function salirDeTV(uid, id) {
  try {
    const paso = await actualizarConRespaldoDeApodos({
      [`dispositivos/${id}/miembros/${uid}`]: null,
      [`dispositivos/${id}/apodos/${uid}`]: null,
      [`usuarios/${uid}/dispositivos/${id}`]: null
    });
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true };
  } catch (error) {
    console.error('Error al salir de la TV:', error);
    return { exito: false, error: 'No se pudo salir de la TV: ' + describirError(error) + '.' };
  }
}

/** Entra a una TV compartida con el código de invitación: { exito, id }. */
async function unirseATV(uid, codigo) {
  const snap = await esperarHasta(get(ref(db, `invitaciones/${codigo}`)), ESPERA_MAXIMA_ENVIO_MS);
  if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
  const id = snap.exists() ? snap.val().id : null;
  if (!id) return { exito: false, error: 'Ese código no existe, ya se usó o venció. Revisa que esté bien escrito o pide uno nuevo.' };

  const rol = await rolEnTV(uid, id);
  if (!rol.exito) return rol;
  if (rol.rol === 'dueno') return { exito: false, error: 'Esa TV ya es tuya.' };
  if (rol.rol === 'miembro') return { exito: false, error: 'Ya tienes acceso a esa TV.' };

  // Camino directo: entrar, gastar la invitación y apuntar la TV en la lista de la cuenta en una
  // sola escritura (ver reclamarDispositivo). Si las reglas nuevas aún no están publicadas
  // responde "sin permiso" y se sigue con el camino de dos pasos de abajo.
  try {
    const unico = await esperarHasta(update(ref(db), {
      [`dispositivos/${id}/miembros/${uid}`]: codigo,
      [`invitaciones/${codigo}`]: null,
      [`usuarios/${uid}/dispositivos/${id}`]: true
    }), ESPERA_MAXIMA_ENVIO_MS);
    if (unico === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true, id };
  } catch (error) {
    if (!esPermisoDenegado(error)) throw error;
  }

  try {
    // Se entra y se gasta la invitación en el mismo paso: así solo sirve una vez.
    const paso = await esperarHasta(update(ref(db), {
      [`dispositivos/${id}/miembros/${uid}`]: codigo,
      [`invitaciones/${codigo}`]: null
    }), ESPERA_MAXIMA_ENVIO_MS);
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
  } catch (error) {
    if (esPermisoDenegado(error)) return { exito: false, error: 'No se pudo entrar: el código venció, ya se usó o esa TV ya no está compartida.' };
    throw error;
  }
  const lista = await esperarHasta(set(ref(db, `usuarios/${uid}/dispositivos/${id}`), true), ESPERA_MAXIMA_ENVIO_MS);
  if (lista === ESPERA_LENTA) return { exito: false, error: 'Ya tienes acceso a la TV, pero la conexión está lenta. Vuelve a abrir la app.' };
  return { exito: true, id };
}

/**
 * Lo que se escribe en Mi TV: sirve el código que muestra una TV nueva (la vincula
 * como dueño) o el código de invitación de alguien que comparte su TV (entra como
 * miembro). Devuelve { exito, id } o { exito: false, error }.
 */
export async function usarCodigoTV(uid, codigoTexto) {
  const codigo = normalizarCodigo(codigoTexto);
  if (codigo.length !== 6) return { exito: false, error: 'Escribe los 6 caracteres del código.' };
  if (!CODIGO_TV.test(codigo)) return { exito: false, error: 'Ese código no es válido. Revisa que no confundas 0 con O ni 1 con I.' };
  try {
    const snap = await esperarHasta(get(ref(db, `emparejamiento/${codigo}`)), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    if (snap.exists()) return await reclamarDispositivo(uid, codigo);
    return await unirseATV(uid, codigo);
  } catch (error) {
    console.error('Error al usar el código:', error);
    return { exito: false, error: 'No se pudo usar el código: ' + describirError(error) + '.' };
  }
}

/**
 * Convierte un nombre en una clave válida de Firebase: cambia por "_" los
 * caracteres que Firebase no admite en una clave (. $ # [ ] /) y quita
 * los espacios del principio y del final. Puede quedar vacía: quien la
 * use tiene que comprobarlo (una clave vacía apuntaría al catálogo entero).
 * La usan guardarCancionCatalogo, guardarImagenCatalogo,
 * guardarAnimacionCatalogo y claveSegura (antes cada una la repetía).
 */
function limpiarClave(nombre) {
  return String(nombre ?? '').replace(/[.$#[\]/]/g, '_').trim();
}

// Tiempo máximo de espera de un envío. Sin señal, Firebase no da error:
// guarda la escritura y la manda cuando vuelve la conexión, y la promesa
// queda esperando (el botón Enviar quedaba bloqueado para siempre).
const ESPERA_MAXIMA_ENVIO_MS = 15000;
const ESPERA_LENTA = Symbol('lenta');
const esperarHasta = (promesa, ms) => Promise.race([promesa, new Promise((r) => setTimeout(() => r(ESPERA_LENTA), ms))]);

/**
 * Espera una escritura (guardar o borrar) como mucho ESPERA_MAXIMA_ENVIO_MS.
 * Devuelve null si terminó a tiempo (quien llama sigue como siempre) o, si
 * no, un resultado { exito: false, pendiente: true, escritura } donde
 * "escritura" es una promesa que termina con { exito, ... } cuando por fin
 * se complete (Firebase la manda sola al volver la señal). Así nadie se
 * queda mirando "Guardando…" sin saber qué pasa.
 */
async function conTope(escritura, resultadoOk = { exito: true }) {
  if (await esperarHasta(escritura, ESPERA_MAXIMA_ENVIO_MS) !== ESPERA_LENTA) return null;
  return {
    exito: false,
    pendiente: true,
    error: 'la conexión está lenta',
    escritura: escritura.then(() => resultadoOk, (err) => ({ exito: false, error: err.message }))
  };
}

/**
 * Lee oled_remota/pantalla y oled_remota/version y, solo si lo último
 * enviado es un GIF z1, también oled_remota/archivo. Las tres cosas tienen
 * que ser del mismo envío: si alguien envía algo (otra pestaña, otro
 * dispositivo) mientras se leen, no coinciden y se vuelve a leer, hasta 3
 * veces (igual que hace el firmware al descargar). Devuelve archivo = null
 * si no se pudo conseguir uno coherente.
 */
async function leerPantallaYArchivo() {
  const INTENTOS = 3;
  let ultimo = null;
  for (let intento = 0; intento < INTENTOS; intento++) {
    const [snapPantalla, snapVersion] = await Promise.all([
      get(ref(db, rutaOled('pantalla'))),
      get(ref(db, rutaOled('version')))
    ]);
    ultimo = { snapPantalla, snapVersion, archivo: null };
    const animacion = (snapPantalla.val() || {}).animacion || {};
    if (!(animacion.formato === FORMATO_COMPRIMIDO && puedeComprimir())) return ultimo;

    const version = Number(snapVersion.val());
    const archivo = (await get(ref(db, rutaOled('archivo')))).val();
    const versionDespues = Number((await get(ref(db, rutaOled('version')))).val());
    if (archivo && typeof archivo.datos === 'string' && Number(archivo.version) === version && versionDespues === version) {
      ultimo.archivo = archivo;
      return ultimo;
    }
  }
  return ultimo;
}

/**
 * Carga el estado actual desde Firebase
 * Retorna un objeto con la configuración actual o null si hay error
 *
 * Se leen por separado oled_remota/pantalla y oled_remota/version, y NO
 * oled_remota entero: ahí vive "archivo" (el GIF comprimido o la
 * grabación de un musical, hasta ~120 KB) y casi nunca hace falta. Solo se
 * baja si lo último enviado fue un GIF z1, para mostrar su vista previa.
 * (Un musical se vuelve a leer de su catálogo, musicales/datos.)
 */
export async function cargarEstado() {
  try {
    const { snapPantalla, snapVersion, archivo } = await leerPantallaYArchivo();

    if (snapPantalla.exists() || snapVersion.exists()) {
      const pantalla = snapPantalla.val() || {};
      const datos = { version: snapVersion.val() };
      const config = pantalla.config || {};
      const imagen = pantalla.imagen || {};
      const cancion = pantalla.cancion || {};
      const animacion = pantalla.animacion || {};

      // Animación comprimida (formato "z1"): los cuadros están en
      // oled_remota/archivo; se descomprimen para la vista previa.
      let cuadrosAnimacion = Array.isArray(animacion.cuadros) ? animacion.cuadros : [];
      if (animacion.formato === FORMATO_COMPRIMIDO && puedeComprimir()) {
        if (archivo) {
          try {
            cuadrosAnimacion = await descomprimirCuadros(archivo.datos);
          } catch (err) {
            console.error('No se pudo descomprimir la animación:', err);
          }
        } else {
          console.warn('[TV RETRO] No se pudo leer el archivo de la animación de la versión actual: sin vista previa.');
        }
      }

      return {
        // "juego", "alarma", "ajustes", "actualizar" y "restablecer" son órdenes para la TV, no contenido: el panel las muestra como
        // Texto (las dos últimas se agregaron el 2026-11-24: con ellas el panel abría sin ninguna pestaña).
        tipo: (['juego', 'alarma', 'ajustes', 'actualizar', 'restablecer'].includes(pantalla.tipo) ? 'texto' : pantalla.tipo) || 'texto',
        texto: (typeof pantalla.texto === 'string') ? pantalla.texto : 'Bienvenido',
        // H-51 (auditoría 2026-11-15): las reglas dejan que un miembro guarde un tamaño de 0 a 100; la vista previa
        // solo conoce 1..5 (fontMetrics[100] no existe y rompía el panel del dueño).
        tamano: Math.min(5, Math.max(1, Math.round(Number(config.tamano)) || 2)),
        alineacion: config.alineacion || 'centro',
        alineacionV: config.alineacionV || 'centro',
        invertido: !!config.invertido,
        modoTexto: config.modoTexto || 'ajustar',
        // Campo agregado en el rediseño: estilo de letra. Si no está
        // (datos viejos o enviados antes de esta opción) queda vacío y el
        // panel usa su estilo por defecto (ver FUENTE_DEFECTO en main.js).
        fuente: (typeof config.fuente === 'string') ? config.fuente : '',
        // Posición manual (agregada en el rediseño): si manual es true, el
        // bloque de texto va con su esquina superior izquierda en (x, y).
        manual: !!config.manual,
        x: Number(config.x) || 0,
        y: Number(config.y) || 0,
        // Dirección del scroll (agregada en el rediseño): 'h' (de siempre) o 'v'.
        direccion: config.direccion === 'v' ? 'v' : 'h',
        imagenData: imagen.datos || '',
        imagenAncho: Number(imagen.ancho) || 0,
        imagenAlto: Number(imagen.alto) || 0,
        cancionNombre: (typeof cancion.nombre === 'string') ? cancion.nombre : '',
        cancionRepeticiones: Number(cancion.repeticiones) || 1,
        // NOTA: no traemos las notas completas aquí porque pueden ser grandes;
        // la web gestionará un catálogo independiente en /canciones (ver más abajo).
        // Mismo criterio para los cuadros de animación: si vinieran, podrían
        // pesar bastante -- pero por ahora el firmware ni siquiera manda
        // tipo="animacion", así que esto es más que nada defensivo/a futuro.
        animacionNombre: (typeof animacion.nombre === 'string') ? animacion.nombre : '',
        animacionAncho: Number(animacion.ancho) || 0,
        animacionAlto: Number(animacion.alto) || 0,
        animacionCuadros: cuadrosAnimacion,
        // Musical (canción con letra): clave del catálogo musicales/.
        musicalNombre: (pantalla.musical && typeof pantalla.musical.nombre === 'string') ? pantalla.musical.nombre : '',
        musicalRepeticiones: (pantalla.musical && Number(pantalla.musical.repeticiones)) || 1,
        version: Number(datos.version) || 0,
        exito: true
      };
    } else {
      // No hay datos aún, retornar estado por defecto
      return {
        tipo: 'texto',
        texto: 'Bienvenido',
        tamano: 2,
        alineacion: 'centro',
        alineacionV: 'centro',
        invertido: false,
        modoTexto: 'ajustar',
        fuente: '',
        manual: false,
        x: 0,
        y: 0,
        direccion: 'h',
        imagenData: '',
        imagenAncho: 0,
        imagenAlto: 0,
        cancionNombre: '',
        cancionRepeticiones: 1,
        version: 0,
        exito: true,
        vacio: true
      };
    }
  } catch (err) {
    console.error('Error al cargar estado de Firebase:', err);
    return {
      exito: false,
      error: err.message
    };
  }
}

/**
 * Se suscribe a oled_remota/lastSeen (heartbeat que escribe la TV cada
 * 10 s desde la tarea de red del firmware ESP32-S3, red.cpp / latido()).
 *
 * A diferencia de cargarEstado(), esto NO es un get() de una sola vez:
 * usa onValue(), que deja una escucha en tiempo real. Así, si el
 * dispositivo se reconecta y vuelve a escribir, la web se entera al
 * toque sin tener que hacer polling manual del valor en sí (el polling
 * que sí hace falta es para notar cuando el valor se puso VIEJO, y de
 * eso se encarga quien llama a esta función, no Firebase).
 *
 * callback recibe el timestamp (número, ms desde época) o null si el
 * dispositivo nunca escribió nada todavía (recién configurado, o que
 * todavía no mandó su primer latido).
 *
 * Devuelve la función para cancelar la suscripción (unsubscribe).
 */
export function suscribirLastSeen(callback) {
  return onValue(ref(db, rutaOled('lastSeen')), (snap) => {
    callback(snap.exists() ? Number(snap.val()) : null);
  }, (err) => {
    console.error('Error al suscribirse a lastSeen:', err);
    callback(null);
  });
}

/**
 * Acuse de recibo (auditoría 2026-11-15, H-06): última versión que la TV dice haber aplicado
 * (oled_remota/mostrada, la escribe el firmware). callback(null) si la TV no informa (firmware anterior).
 * Devuelve la función para cancelar la escucha.
 */
export function suscribirMostrada(callback) {
  return onValue(ref(db, rutaOled('mostrada')), (snap) => {
    const v = snap.exists() ? Number(snap.val()) : null;
    callback(Number.isFinite(v) ? v : null);
  }, () => callback(null));
}

/** Lectura directa (sin escucha) de oled_remota/mostrada: respaldo del acuse si la escucha no entrega. null si no hay o no se pudo leer. */
export async function leerMostrada() {
  try {
    const snap = await esperarHasta(get(ref(db, rutaOled('mostrada'))), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA || !snap.exists()) return null;
    const v = Number(snap.val());
    return Number.isFinite(v) ? v : null;
  } catch (error) {
    return null;
  }
}

/**
 * Escucha en tiempo real un catálogo completo (imagenes/ o animaciones/).
 * Se baja entero la primera vez y después Firebase solo manda lo que
 * cambia (lo que se guarda o borra desde este panel u otro dispositivo),
 * en vez de bajar todo cada vez que se entra a la Galería. callback recibe
 * el objeto del catálogo ({} si está vacío); alError se llama si no se
 * pudo leer (sin permiso o sin conexión) y la escucha termina.
 * Devuelve la función para cancelarla.
 */
function suscribirCatalogo(ruta, callback, alError) {
  return onValue(ref(db, ruta), (snap) => {
    callback(snap.exists() ? snap.val() : {});
  }, (err) => {
    console.error('Error al escuchar ' + ruta + ':', err);
    if (alError) alError(err);
  });
}

/**
 * Catálogo de la cuenta + biblioteca predeterminada (biblioteca/, la misma para todas las cuentas
 * y que no cuenta en el límite). Las predeterminadas llegan marcadas con predeterminada: true (no
 * se pueden borrar); si una de la cuenta tiene el mismo nombre, gana la de la cuenta. Si la
 * biblioteca no se puede leer, se sigue con lo de la cuenta. Solo en modo cuentas.
 */
function suscribirCatalogoConBiblioteca(tipo, callback, alError) {
  if (!contexto) return suscribirCatalogo(tipo, callback, alError);

  let propio = null;
  let predeterminadas = null;
  const emitir = () => {
    if (propio === null || predeterminadas === null) return;
    const mezcla = {};
    for (const [clave, valor] of Object.entries(predeterminadas)) mezcla[clave] = Object.assign({}, valor, { predeterminada: true });
    for (const [clave, valor] of Object.entries(propio)) mezcla[clave] = valor;
    callback(mezcla);
  };
  // H-12: cada fuente se escucha por su lista liviana (ver suscribirFuenteIndexada). La cuenta rellena su lista
  // sola; la biblioteca solo la rellena un administrador (las reglas no dejan a nadie más).
  const cancelarPropio = suscribirFuenteIndexada(tipo, rutaCatalogo(tipo), rutaIndice(tipo),
    (valor) => rellenarLista(tipo, rutaIndice(tipo), valor),
    (obj) => { propio = obj; emitir(); }, alError);
  const cancelarBiblioteca = suscribirFuenteIndexada(tipo, `biblioteca/${tipo}`, `biblioteca/${tipo}_indice`,
    async (valor) => { if (await esAdministrador()) rellenarLista(tipo, `biblioteca/${tipo}_indice`, valor); },
    (obj) => { predeterminadas = obj; emitir(); }, () => { predeterminadas = {}; emitir(); });
  return () => { cancelarPropio(); cancelarBiblioteca(); };
}

export function suscribirImagenes(callback, alError) {
  return suscribirCatalogoConBiblioteca('imagenes', callback, alError);
}

export function suscribirAnimaciones(callback, alError) {
  return suscribirCatalogoConBiblioteca('animaciones', callback, alError);
}

/**
 * Lista las canciones disponibles en el catálogo (/canciones)
 *
 * NOTA IMPORTANTE: este catálogo vive en una ruta HERMANA de
 * "oled_remota", NO adentro. Dos motivos:
 *   1) El ESP8266 original pedía "oled_remota.json" completo cada 10 s:
 *      si el catálogo estuviera adentro, se bajaría todas las canciones
 *      guardadas aunque nunca las use. (El ESP32-S3 baja solo version,
 *      pantalla y archivo, pero la ESP8266 sigue funcionando aparte.)
 *   2) Un set() sobre "oled_remota" REEMPLAZA todo ese nodo y borraría un
 *      catálogo que fuera hijo suyo. enviarEstado() hoy usa update(), pero
 *      al ser hermano el catálogo queda a salvo de cualquier set().
 *
 * Retorna un objeto { nombre: { notas: [...], meta: {...} }, ... }
 * ({} si está vacío, null si no se pudo leer).
 */
export async function listarCanciones() {
  try {
    const snap = await get(ref(db, 'canciones'));
    if (!snap.exists()) return {};
    return snap.val();
  } catch (err) {
    console.error('Error al listar canciones:', err);
    return null;
  }
}

/**
 * Guarda una canción en el catálogo (/canciones/<nombre>)
 * notas: array de arrays [freq, durMs]
 */
export async function guardarCancionCatalogo(nombre, notas, meta = {}) {
  try {
    const safeKey = limpiarClave(nombre);
    if (!safeKey) return { exito: false, error: 'falta el nombre' };
    await set(ref(db, `canciones/${safeKey}`), {
      notas: notas,
      meta: meta
    });
    return { exito: true, key: safeKey };
  } catch (err) {
    console.error('Error al guardar canción en catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Lista las imágenes disponibles en el catálogo (/imagenes)
 *
 * Mismo criterio que listarCanciones(): vive en una ruta HERMANA de
 * "oled_remota", no adentro, por las mismas dos razones (el ESP8266
 * original no debería bajarse el catálogo entero cada 10 s, y un set()
 * sobre "oled_remota" no debe poder borrarlo).
 *
 * Retorna un objeto { nombre: { datos, ancho, alto, meta: {...} }, ... }
 * ({} si está vacío, null si no se pudo leer: así no se confunde un error
 * de red o de permisos con una galería vacía).
 */
export async function listarImagenes() {
  try {
    const snap = await get(ref(db, rutaCatalogo('imagenes')));
    if (!snap.exists()) return {};
    return snap.val();
  } catch (err) {
    console.error('Error al listar imágenes:', err);
    return null;
  }
}

/**
 * Guarda una imagen procesada en el catálogo (/imagenes/<nombre>)
 * datos: string Base64 del bitmap 1bpp (mismo formato que imagenData)
 * preprocesada: dataURL PNG de la versión 128×64 ya redimensionada pero
 *   SIN binarizar (ver imageProcessor.js). Guardarla es lo que permite
 *   después volver a cambiar el umbral o el dithering de una imagen que
 *   ya está en el catálogo, sin tener que volver a subir el archivo
 *   original. Es opcional: si no se manda, la imagen queda "fija"
 *   (comportamiento de versiones anteriores del catálogo).
 */
export async function guardarImagenCatalogo(nombre, datos, ancho, alto, preprocesada = null, meta = {}, opciones = {}) {
  try {
    const safeKey = limpiarClave(nombre);
    if (!safeKey) return { exito: false, error: 'falta el nombre' };
    const payload = {
      datos: datos,
      ancho: ancho,
      alto: alto,
      meta: meta
    };
    if (preprocesada) payload.preprocesada = preprocesada;
    return await guardarEnCatalogo('imagenes', safeKey, payload, opciones);
  } catch (err) {
    console.error('Error al guardar imagen en catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Borra una imagen del catálogo (/imagenes/<nombre>)
 */
export async function borrarImagenCatalogo(nombre, opciones = {}) {
  try {
    return await borrarDeCatalogo('imagenes', nombre, opciones);
  } catch (err) {
    console.error('Error al borrar imagen del catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Borra una canción del catálogo (/canciones/<nombre>)
 */
export async function borrarCancionCatalogo(nombre) {
  try {
    await remove(ref(db, `canciones/${nombre}`));
    return { exito: true };
  } catch (err) {
    console.error('Error al borrar canción del catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Catálogo de animaciones (/animaciones/<nombre>), ruta hermana de
 * "oled_remota" -- mismo criterio que imágenes y canciones.
 *
 * Cada cuadro pesa bastante más que una imagen suelta (varios cuadros
 * de 128×64 en vez de uno), así que este catálogo es el que más
 * conviene cargar bajo demanda (recién al entrar a la sección
 * Galería), no de entrada al abrir la página.
 *
 * Retorna un objeto { nombre: { ancho, alto, cuadros: [{datos, dur}, ...], meta: {...} }, ... }
 * ({} si está vacío, null si no se pudo leer).
 */
export async function listarAnimaciones({ predeterminada = false } = {}) {
  try {
    const snap = await get(ref(db, predeterminada ? 'biblioteca/animaciones' : rutaCatalogo('animaciones')));
    if (!snap.exists()) return {};
    return snap.val();
  } catch (err) {
    console.error('Error al listar animaciones:', err);
    return null;
  }
}

/**
 * Guarda una animación en el catálogo (/animaciones/<nombre>).
 * cuadros: array de { datos: base64 1bpp (mismo formato que imagenData
 *   / imagenAncho×imagenAlto), dur: milisegundos que dura ese cuadro }.
 */
export async function guardarAnimacionCatalogo(nombre, ancho, alto, cuadros, meta = {}, opciones = {}) {
  try {
    const safeKey = limpiarClave(nombre);
    if (!safeKey) return { exito: false, error: 'falta el nombre' };
    const payload = { ancho, alto, cuadros, meta };
    return await guardarEnCatalogo('animaciones', safeKey, payload, opciones);
  } catch (err) {
    console.error('Error al guardar animación en catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Borra una animación del catálogo (/animaciones/<nombre>)
 */
export async function borrarAnimacionCatalogo(nombre, opciones = {}) {
  try {
    return await borrarDeCatalogo('animaciones', nombre, opciones);
  } catch (err) {
    console.error('Error al borrar animación del catálogo:', err);
    return { exito: false, error: err.message };
  }
}

// ===================================================
// Musicales: canciones con letra, imágenes y GIF importadas de .ino
// (catálogo musicales/, aprobado por el dueño). Dos partes, para que la
// lista cargue rápido:
//   musicales/indice/<clave> = { nombre, archivo, duracion, repetir, imagenes, bytes, fecha, origen }
//   musicales/datos/<clave>  = grabación en formato m1 (Base64, ver compresion.js)
// ===================================================

function claveSegura(nombre) {
  return limpiarClave(nombre) || 'cancion';
}

/** Lista liviana del catálogo: { clave: meta, ... } ({} si está vacío, null si no se pudo leer). */
export async function listarMusicales() {
  try {
    const snap = await get(ref(db, 'musicales/indice'));
    return snap.exists() ? snap.val() : {};
  } catch (err) {
    console.error('Error al listar musicales:', err);
    return null;
  }
}

/**
 * Grabación (Base64 m1) de un musical, o null si no existe. Si no se pudo
 * leer (red, permisos), lanza un Error que explica el motivo.
 */
export async function leerMusical(clave) {
  try {
    const snap = await get(ref(db, `musicales/datos/${clave}`));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error('Error al leer el musical:', err);
    throw new Error(describirError(err));
  }
}

/**
 * true si es una clave de musicales/ que se puede mandar por referencia (H-22): texto de 1 a 150 caracteres sin / . $ # [ ]
 * (las mismas condiciones que exigen las reglas en pantalla.musical.clave).
 */
export function claveMusicalValida(clave) {
  return typeof clave === 'string' && clave.length >= 1 && clave.length <= 150 && !/[/.$#[\]]/.test(clave);
}

/** Guarda (o reemplaza, si la clave ya existe) un musical. */
export async function guardarMusicalCatalogo(nombre, datos, meta = {}) {
  try {
    const clave = claveSegura(nombre);
    const lento = await conTope(update(ref(db, 'musicales'), {
      [`indice/${clave}`]: meta,
      [`datos/${clave}`]: datos
    }), { exito: true, clave });
    if (lento) return lento;
    return { exito: true, clave };
  } catch (err) {
    console.error('Error al guardar el musical:', err);
    return { exito: false, error: err.message };
  }
}

/** Borra un musical del catálogo (índice y datos). */
export async function borrarMusicalCatalogo(clave) {
  try {
    const lento = await conTope(update(ref(db, 'musicales'), { [`indice/${clave}`]: null, [`datos/${clave}`]: null }));
    if (lento) return lento;
    return { exito: true };
  } catch (err) {
    console.error('Error al borrar el musical:', err);
    return { exito: false, error: err.message };
  }
}

// ===================================================
// Alarma (Más > Alarma)
// ===================================================
// dispositivos/{id}/alarma = { tono: "<clave de musicales/> o ''", alarmas: { "0": {activa, hora,
// minuto, dias}, "1": ..., "2": ... } }. dias = máscara de bits (bit 0 = domingo ... bit 6 = sábado).
// La TV la guarda y suena sin celular; el panel solo la configura (ver docs/formatos-datos.md).
export const CANTIDAD_ALARMAS = 3;
export const DIAS_ALARMA_DEFECTO = 62; // lunes a viernes

const rutaAlarma = () => (contexto ? `dispositivos/${contexto.dispositivo}/alarma` : 'alarma');

const entero = (v, min, max, defecto) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : defecto;
};

/** Deja una alarma con valores válidos (sea lo que sea lo que haya en Firebase). */
function normalizarAlarmaUna(a) {
  const x = a && typeof a === 'object' ? a : {};
  return {
    activa: x.activa === true,
    hora: entero(x.hora, 0, 23, 7),
    minuto: entero(x.minuto, 0, 59, 0),
    dias: entero(x.dias, 0, 127, DIAS_ALARMA_DEFECTO)
  };
}

export function normalizarAlarma(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const lista = d.alarmas && typeof d.alarmas === 'object' ? d.alarmas : {};
  return {
    tono: typeof d.tono === 'string' ? d.tono.slice(0, 100) : '',
    alarmas: Array.from({ length: CANTIDAD_ALARMAS }, (_, i) => normalizarAlarmaUna(lista[i] ?? lista[String(i)]))
  };
}

/** Lee la alarma de la TV. { exito, alarma } (con valores por defecto si aún no hay) o { exito: false, error }. */
export async function cargarAlarma() {
  try {
    const snap = await esperarHasta(get(ref(db, rutaAlarma())), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta.' };
    return { exito: true, alarma: normalizarAlarma(snap.exists() ? snap.val() : null) };
  } catch (error) {
    console.error('Error al leer la alarma:', error);
    return { exito: false, error: describirError(error) };
  }
}

/**
 * Guarda la alarma y le avisa a la TV (orden tipo "alarma" por el mismo canal de siempre; la TV vuelve
 * a leer dispositivos/{id}/alarma). Devuelve lo mismo que enviarEstado().
 */
export async function guardarAlarma(datos, estado) {
  const alarma = normalizarAlarma(datos);
  try {
    const lento = await conTope(set(ref(db, rutaAlarma()), {
      tono: alarma.tono,
      alarmas: Object.fromEntries(alarma.alarmas.map((a, i) => [String(i), a]))
    }));
    if (lento) return seguirConOrden(lento, estado, 'alarma');
  } catch (error) {
    console.error('Error al guardar la alarma:', error);
    return { exito: false, error: describirError(error) };
  }
  return await enviarEstado(Object.assign({}, estado, { tipo: 'alarma' }));
}

/**
 * La escritura de la alarma o de los ajustes quedó esperando por falta de señal (conTope). Antes se
 * esperaba aquí sin avisar y el botón quedaba "Guardando…" sin decir nada (auditoría 2026-11-15, H-37).
 * Ahora se devuelve ya un resultado "pendiente" (como enviarEstado) cuya promesa "escritura" termina
 * cuando la escritura por fin se hace Y la orden a la TV también.
 */
function seguirConOrden(lento, estado, tipo) {
  return {
    exito: false,
    pendiente: true,
    error: lento.error,
    escritura: lento.escritura.then(async (final) => {
      if (!final.exito) return { exito: false, error: final.error };
      const r = await enviarEstado(Object.assign({}, estado, { tipo }));
      return r.pendiente && r.escritura ? await r.escritura : r;
    })
  };
}

// ===================================================
// Sistema de la TV (Más > Config > Sistema): actualizar el firmware y restablecer (H-19, aprobado 2026-11-17)
// ===================================================
// - firmware/estable = { build, tamano, sha256, firma, url? }: lo publica un administrador (el panel solo lee el número).
// - dispositivos/{id}/firmware = { build, estado, fecha }: lo escribe solo la TV (qué versión lleva y cómo salió el último intento).
// - Órdenes: pantalla.tipo = "actualizar" | "restablecer" (enviarEstado); solo el dueño.

/** El id de la TV con la que se está trabajando (null en el modo viejo, sin cuentas). */
export function dispositivoActual() {
  return contexto ? contexto.dispositivo : null;
}

function normalizarFirmwareTV(valor) {
  if (!valor || typeof valor !== 'object') return null;
  const build = Number(valor.build);
  if (!Number.isFinite(build)) return null;
  const fecha = Number(valor.fecha);
  return { build, estado: String(valor.estado || ''), fecha: Number.isFinite(fecha) ? fecha : null };
}

/**
 * Lo que necesita la pantalla Sistema: { exito, esDueno, firmware: {build, estado, fecha} | null, manifiestoBuild: n | null }.
 * firmware = null si la TV no informa su versión (firmware anterior). manifiestoBuild = la versión publicada.
 */
export async function cargarSistema() {
  if (!contexto) return { exito: true, esDueno: false, firmware: null, manifiestoBuild: null };
  try {
    const rol = await rolEnTV(contexto.uid, contexto.dispositivo);
    if (!rol.exito) return { exito: false, error: rol.error };
    const [fw, man] = await Promise.all([
      esperarHasta(get(ref(db, `dispositivos/${contexto.dispositivo}/firmware`)), ESPERA_MAXIMA_ENVIO_MS),
      esperarHasta(get(ref(db, 'firmware/estable/build')), ESPERA_MAXIMA_ENVIO_MS)
    ]);
    if (fw === ESPERA_LENTA || man === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    const publicada = man.exists() ? Number(man.val()) : null;
    return {
      exito: true,
      esDueno: rol.rol === 'dueno',
      firmware: fw.exists() ? normalizarFirmwareTV(fw.val()) : null,
      manifiestoBuild: Number.isFinite(publicada) ? publicada : null
    };
  } catch (error) {
    console.error('Error al leer el estado del sistema de la TV:', error);
    return { exito: false, error: 'No se pudo leer el estado de la TV: ' + describirError(error) + '.' };
  }
}

/** Escucha lo que informa la TV de su firmware (durante una actualización). callback(null) si no informa. Devuelve cómo cancelar. */
export function suscribirFirmwareTV(callback) {
  if (!contexto) { callback(null); return () => {}; }
  return onValue(ref(db, `dispositivos/${contexto.dispositivo}/firmware`), (snap) => {
    callback(snap.exists() ? normalizarFirmwareTV(snap.val()) : null);
  }, () => callback(null));
}

// ===================================================
// Ajustes de la TV (Más > Config > Ajustes de la TV)
// ===================================================
// dispositivos/{id}/ajustes = { brillo: 1..3, volumen: 0..3, zona: minutos respecto de la hora
// universal (ej. -300 = Colombia) }. La TV los guarda; el panel solo los configura.
export const AJUSTES_DEFECTO = { brillo: 3, volumen: 3, zona: -300 };

const rutaAjustes = () => (contexto ? `dispositivos/${contexto.dispositivo}/ajustes` : 'ajustes');

export function normalizarAjustes(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return {
    brillo: entero(d.brillo, 1, 3, AJUSTES_DEFECTO.brillo),
    volumen: entero(d.volumen, 0, 3, AJUSTES_DEFECTO.volumen),
    zona: entero(d.zona, -720, 840, AJUSTES_DEFECTO.zona),
    // Campos que pone la app Pepito (apagado automático, 2026-11-23; ciudad para el clima, 2026-11-24). Este panel no los
    // muestra, pero los conserva al guardar (antes los borraba). Solo si vienen y tienen sentido.
    ...(d.apagado !== undefined ? { apagado: [0, 5, 10, 20].includes(Number(d.apagado)) ? Number(d.apagado) : 5 } : {}),
    ...(d.ciudad && typeof d.ciudad === 'object' && typeof d.ciudad.nombre === 'string' && Math.abs(Number(d.ciudad.lat)) <= 90 && Math.abs(Number(d.ciudad.lon)) <= 180
      ? { ciudad: { nombre: d.ciudad.nombre.slice(0, 60), lat: Number(d.ciudad.lat), lon: Number(d.ciudad.lon) } } : {}),
    // Dúos de Pepito Pro (2026-11-24): activados y favorito. Tampoco se muestran aquí; se conservan.
    ...(typeof d.duos === 'boolean' ? { duos: d.duos } : {}),
    ...(typeof d.duoFavorito === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(d.duoFavorito) ? { duoFavorito: d.duoFavorito } : {})
  };
}

/** Lee los ajustes de la TV. { exito, ajustes } (con valores por defecto si aún no hay) o { exito: false, error }. */
export async function cargarAjustes() {
  try {
    const snap = await esperarHasta(get(ref(db, rutaAjustes())), ESPERA_MAXIMA_ENVIO_MS);
    if (snap === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta.' };
    return { exito: true, ajustes: normalizarAjustes(snap.exists() ? snap.val() : null) };
  } catch (error) {
    console.error('Error al leer los ajustes de la TV:', error);
    return { exito: false, error: describirError(error) };
  }
}

/** Los ajustes que muestra la pantalla Ajustes de la TV de este panel. */
const AJUSTES_DE_LA_PANTALLA = ['brillo', 'volumen', 'zona'];

/**
 * Guarda los ajustes y le avisa a la TV (orden tipo "ajustes"; la TV vuelve a leer
 * dispositivos/{id}/ajustes). Devuelve lo mismo que enviarEstado().
 */
export async function guardarAjustes(datos, estado, propios = AJUSTES_DE_LA_PANTALLA) {
  // 2026-11-24: lo que esta pantalla no maneja (la ciudad y el apagado que pone la app Pepito) se toma de lo guardado JUSTO
  // ahora, no de lo que se leyó al abrir: otro celular pudo cambiarlo mientras tanto y antes se perdía. "propios" = los campos
  // que vienen de "datos" (si alguno falta en "datos", se borra). Si no se puede leer a tiempo, se guarda "datos" como antes.
  let base = datos;
  try {
    const snap = await esperarHasta(get(ref(db, rutaAjustes())), ESPERA_MAXIMA_ENVIO_MS);
    if (snap !== ESPERA_LENTA && snap.exists() && snap.val() && typeof snap.val() === 'object') {
      base = Object.assign({}, snap.val());
      for (const k of propios) {
        if (datos && datos[k] !== undefined && datos[k] !== null) base[k] = datos[k];
        else delete base[k];
      }
    }
  } catch (error) {
    console.warn('[TV RETRO] No se pudieron releer los ajustes antes de guardar:', error);
  }
  const ajustes = normalizarAjustes(base);
  try {
    const lento = await conTope(set(ref(db, rutaAjustes()), ajustes));
    if (lento) return seguirConOrden(lento, estado, 'ajustes');
  } catch (error) {
    console.error('Error al guardar los ajustes de la TV:', error);
    return { exito: false, error: describirError(error) };
  }
  return await enviarEstado(Object.assign({}, estado, { tipo: 'ajustes' }));
}

/**
 * Envía la configuración actualizada a Firebase
 */
export async function enviarEstado(estado) {
  try {
    const snapVersion = await esperarHasta(get(ref(db, rutaOled('version'))), ESPERA_MAXIMA_ENVIO_MS);
    if (snapVersion === ESPERA_LENTA) return { exito: false, error: 'sin conexión a internet' };
    const versionLeida = snapVersion.exists() ? (Number(snapVersion.val()) || 0) : 0;
    // El número definitivo se reserva justo antes de escribir (ver abajo).
    let nuevaVersion = versionLeida + 1;

    // El texto y su configuración se guardan SIEMPRE, sin importar qué
    // tipo esté activo ahora. Antes solo se guardaban cuando tipo ===
    // "texto" -- al mandar una imagen o canción, set() reemplazaba
    // todo el nodo "pantalla" y el texto desaparecía de Firebase. La
    // próxima vez que se volvía a la sección Texto (o se recargaba la
    // página), no había nada que restaurar y caía al default "Hola
    // Mundo". Guardándolo siempre, el último texto enviado persiste
    // hasta que se envíe uno nuevo, sin importar cuántas imágenes,
    // canciones o dibujos se manden en el medio.
    // oled_remota/archivo: solo para animaciones comprimidas (ver abajo).
    let archivo = null;

    const pantallaPayload = {
      texto: estado.texto,
      config: {
        tamano: estado.tamano,
        alineacion: estado.alineacion,
        alineacionV: estado.alineacionV,
        invertido: estado.invertido,
        modoTexto: estado.modoTexto,
        // Nuevo (no reemplaza a ningún campo): "clasica" | "sans" | "sansb"
        // | "serif" | "serifi". tamano (1..5) se interpreta según la fuente
        // (clásica: setTextSize; las demás: 6/10/12/16/18 pt).
        fuente: estado.fuente || 'sans',
        // Nuevos: posición manual. Con manual = false el firmware usa
        // alineacion/alineacionV como siempre.
        manual: !!estado.manual,
        x: Math.round(Number(estado.x) || 0),
        y: Math.round(Number(estado.y) || 0),
        // Nuevo: dirección del scroll ('h' | 'v'). modoTexto sigue siendo
        // 'scroll': un firmware que no conozca este campo hace el horizontal.
        direccion: estado.direccion === 'v' ? 'v' : 'h'
      }
    };

    if (estado.tipo === 'imagen') {
      pantallaPayload.tipo = 'imagen';
      pantallaPayload.imagen = {
        ancho: estado.imagenAncho,
        alto: estado.imagenAlto,
        datos: estado.imagenData
      };
    } else if (estado.tipo === 'cancion') {
      pantallaPayload.tipo = 'cancion';
      pantallaPayload.cancion = {
        nombre: estado.cancion || '',
        repeticiones: Number(estado.cancionRepeticiones || 1),
        notas: estado.cancionNotas || []
      };
    } else if (estado.tipo === 'musical') {
      // Canción "con letra" (formato m1).
      pantallaPayload.tipo = 'musical';
      pantallaPayload.musical = {
        nombre: estado.musicalNombre || '',
        repeticiones: Number(estado.musicalRepeticiones || 1),
        formato: FORMATO_MUSICAL
      };
      if (claveMusicalValida(estado.musicalClave)) {
        // H-22 (aprobado por el dueño, 2026-11-16): POR REFERENCIA. Se manda solo la clave del catálogo y la TV baja la
        // grabación de musicales/datos/<clave> (como ya hace con el tono de la alarma): ya no se re-sube entera (~100 KB)
        // en cada envío. oled_remota/archivo queda null. Requiere el firmware nuevo y las reglas con pantalla.musical.clave.
        pantallaPayload.musical.clave = estado.musicalClave;
      } else {
        // Forma anterior (sin clave válida): la grabación va en oled_remota/archivo, igual que las animaciones comprimidas.
        archivo = { version: nuevaVersion, datos: estado.musicalDatos || '' };
      }
    } else if (estado.tipo === 'alarma') {
      // Orden "vuelve a leer la alarma" (Más > Alarma). No lleva datos: viven en dispositivos/{id}/alarma.
      pantallaPayload.tipo = 'alarma';
    } else if (estado.tipo === 'ajustes') {
      // Orden "vuelve a leer los ajustes" (Más > Config). Los datos viven en dispositivos/{id}/ajustes.
      pantallaPayload.tipo = 'ajustes';
    } else if (estado.tipo === 'actualizar' || estado.tipo === 'restablecer') {
      // H-19 (aprobado 2026-11-17): órdenes "instala la versión nueva del firmware" y "restablece la TV" (Config > Sistema).
      // Sin datos propios. Las reglas solo dejan mandarlas al DUEÑO, y la TV no las obedece al encender.
      pantallaPayload.tipo = estado.tipo;
    } else if (estado.tipo === 'juego') {
      // Orden "abre este juego" (Más > Juegos). No es contenido: la TV lo toma como
      // un comando y sigue mostrando lo que tenía. Un firmware que no lo conozca lo ignora.
      pantallaPayload.tipo = 'juego';
      pantallaPayload.juego = { id: String(estado.juegoId || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) };
    } else if (estado.tipo === 'animacion') {
      pantallaPayload.tipo = 'animacion';
      if (puedeComprimir()) {
        // Formato "z1": los cuadros van comprimidos (sin pérdida) en
        // oled_remota/archivo, con la misma versión que el envío; en
        // pantalla queda solo la descripción. Ver js/compresion.js.
        const z = await comprimirCuadros(estado.animacionCuadros || []);
        pantallaPayload.animacion = {
          nombre: estado.animacion || '',
          ancho: estado.animacionAncho,
          alto: estado.animacionAlto,
          formato: FORMATO_COMPRIMIDO,
          cantidad: z.cantidad
        };
        archivo = { version: nuevaVersion, datos: z.datos };
      } else {
        pantallaPayload.animacion = {
          nombre: estado.animacion || '',
          ancho: estado.animacionAncho,
          alto: estado.animacionAlto,
          // [{ datos: base64 1bpp (mismo formato que imagen.datos), dur: ms }, ...]
          // Formato leído por animacion.h/.cpp (animacion_beginSave/appendCuadro)
          // en el firmware -- ver ese módulo para el detalle del guardado en LittleFS.
          cuadros: estado.animacionCuadros || []
        };
      }
    } else {
      // Texto por defecto. Ya no se manda la imagen anterior (unos 1,4 KB
      // de más en cada envío): el firmware solo lee "imagen" con tipo
      // "imagen". Decisión del dueño, 2026-11-10.
      pantallaPayload.tipo = 'texto';
    }

    // update() (no set()): reemplaza version y pantalla completos, pero no
    // borra oled_remota/lastSeen (heartbeat que escribe el ESP).
    // archivo: la animación comprimida, o null para borrar la anterior
    // (se escribe en el mismo update, así nunca queda de otra versión).
    //
    // El número de versión se reserva antes con una transacción sobre
    // oled_remota/contadorVersion (la TV no lo lee). Así dos envíos casi
    // simultáneos nunca salen con el mismo número: antes los dos leían
    // "version" y escribían el mismo valor, y la TV ignoraba el segundo.
    // "version" en sí se sigue escribiendo solo en este update(), junto
    // con pantalla y archivo: la TV escucha "version" y no puede verla
    // cambiar antes de que esté el contenido. Si el contador no existe (o
    // quedó atrás de "version"), arranca desde "version".
    // Reserva y escritura van encadenadas: con la red lenta, las dos
    // siguen solas cuando vuelve la señal.
    const escritura = (async () => {
      const reserva = await runTransaction(ref(db, rutaOled('contadorVersion')),
        (actual) => Math.max(Number(actual) || 0, versionLeida) + 1);
      if (!reserva.committed) throw new Error('no se pudo reservar el número de envío');
      nuevaVersion = Number(reserva.snapshot.val());
      if (archivo) archivo.version = nuevaVersion;
      await update(ref(db, rutaOled()), { version: nuevaVersion, pantalla: pantallaPayload, archivo });
    })();
    if (await esperarHasta(escritura, ESPERA_MAXIMA_ENVIO_MS) === ESPERA_LENTA) {
      // Firebase la manda sola cuando vuelva la señal. "escritura" avisa
      // cuándo terminó (o si falló), para actualizar el mensaje.
      return {
        exito: false,
        pendiente: true,
        version: nuevaVersion,
        error: 'la conexión está lenta',
        // nuevaVersion ya es la reservada cuando termina la escritura.
        escritura: escritura.then(
          () => ({ exito: true, version: nuevaVersion }),
          (err) => ({ exito: false, error: err.message })
        )
      };
    }

    return {
      exito: true,
      version: nuevaVersion
    };
  } catch (err) {
    console.error('Error al enviar estado a Firebase:', err);
    return {
      exito: false,
      error: err.message
    };
  }
}
