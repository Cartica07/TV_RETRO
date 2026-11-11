/**firebase
 * Firebase Integration
 * Maneja la carga y almacenamiento de configuración en Firebase Realtime Database
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getDatabase, ref, get, set, update, remove, onValue, runTransaction } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
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
// animaciones JUNTAS (config/limites/total lo cambia un administrador; usuarios/{uid}/cuotas/extra
// suma más). Las de la biblioteca predeterminada (biblioteca/) NO cuentan. Un administrador no
// tiene límite. Lo hacen cumplir las reglas de Firebase: el contador usuarios/{uid}/cuotas/usados
// se actualiza EN LA MISMA escritura que crea o borra el elemento, con cuotas/ultimo = "i:clave"
// (imagen) o "a:clave" (animación). Ver docs/formatos-datos.md sección 6.
const LIMITE_BASE_POR_DEFECTO = 25;
const LARGO_MAXIMO_CLAVE = 80;

const mensajeLimite = (limite) => `llegaste al límite de ${limite} elementos guardados (imágenes y GIF juntos); borra alguno para guardar otro`;
const esPermisoDenegado = (err) => /PERMISSION_DENIED|permission/i.test(String((err && err.message) || err || ''));

async function leerCuota() {
  const uid = contexto.uid;
  const [admin, usados, base, extra] = await Promise.all([
    get(ref(db, `administradores/${uid}`)),
    get(ref(db, `usuarios/${uid}/cuotas/usados`)),
    get(ref(db, 'config/limites/total')),
    get(ref(db, `usuarios/${uid}/cuotas/extra`))
  ]);
  const numero = (s, defecto) => (s.exists() && Number.isFinite(Number(s.val())) ? Number(s.val()) : defecto);
  return {
    admin: admin.val() === true,
    usados: numero(usados, 0),
    limite: numero(base, LIMITE_BASE_POR_DEFECTO) + numero(extra, 0)
  };
}

/**
 * Guarda un elemento en el catálogo de la cuenta ('imagenes' | 'animaciones').
 * Reemplazar uno que ya existe no cambia el contador; uno nuevo lo suma (si cabe).
 */
async function guardarEnCatalogo(tipo, safeKey, payload) {
  const base = rutaCatalogo(tipo);
  if (!contexto) {
    const lento = await conTope(set(ref(db, `${base}/${safeKey}`), payload), { exito: true, key: safeKey });
    return lento || { exito: true, key: safeKey };
  }
  if (safeKey.length > LARGO_MAXIMO_CLAVE) return { exito: false, error: `el nombre es demasiado largo (máximo ${LARGO_MAXIMO_CLAVE} caracteres)` };

  const refItem = ref(db, `${base}/${safeKey}`);
  const prefijo = tipo === 'imagenes' ? 'i' : 'a';
  for (let intento = 0; intento < 2; intento++) {
    if ((await get(refItem)).exists()) {
      const lento = await conTope(set(refItem, payload), { exito: true, key: safeKey });
      return lento || { exito: true, key: safeKey };
    }
    const cuota = await leerCuota();
    if (!cuota.admin && cuota.usados + 1 > cuota.limite) return { exito: false, error: mensajeLimite(cuota.limite) };
    const cambios = {
      [`${base}/${safeKey}`]: payload,
      [`usuarios/${contexto.uid}/cuotas/usados`]: cuota.usados + 1,
      [`usuarios/${contexto.uid}/cuotas/ultimo`]: `${prefijo}:${safeKey}`
    };
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

/** Borra un elemento del catálogo de la cuenta y le resta 1 al contador (en la misma escritura). */
async function borrarDeCatalogo(tipo, nombre) {
  const base = rutaCatalogo(tipo);
  const refItem = ref(db, `${base}/${nombre}`);
  if (!contexto) {
    const lento = await conTope(remove(refItem));
    return lento || { exito: true };
  }
  const prefijo = tipo === 'imagenes' ? 'i' : 'a';
  for (let intento = 0; intento < 2; intento++) {
    if (!(await get(refItem)).exists()) return { exito: true }; // ya no estaba
    const usadosSnap = await get(ref(db, `usuarios/${contexto.uid}/cuotas/usados`));
    const usados = usadosSnap.exists() ? Number(usadosSnap.val()) || 0 : 0;
    try {
      const escritura = usados > 0
        ? update(ref(db), {
          [`${base}/${nombre}`]: null,
          [`usuarios/${contexto.uid}/cuotas/usados`]: usados - 1,
          [`usuarios/${contexto.uid}/cuotas/ultimo`]: `${prefijo}:${nombre}`
        })
        : remove(refItem); // sin contador (cosa de administrador): se borra a secas
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
    if (!id) return { exito: false, error: 'Ese código no existe o ya venció. Mantén pulsado el botón de tu TV para ver uno nuevo.' };

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

/** Desvincula la TV: deja de tener dueño (mostrará un código nuevo) y sale de la lista. */
export async function desvincularDispositivo(uid, id) {
  try {
    const paso = await esperarHasta(update(ref(db), {
      [`dispositivos/${id}/dueno`]: null,
      [`dispositivos/${id}/codigoUsado`]: null,
      [`usuarios/${uid}/dispositivos/${id}`]: null
    }), ESPERA_MAXIMA_ENVIO_MS);
    if (paso === ESPERA_LENTA) return { exito: false, error: 'La conexión está lenta. Vuelve a intentarlo.' };
    return { exito: true };
  } catch (error) {
    console.error('Error al desvincular la TV:', error);
    return { exito: false, error: 'No se pudo desvincular: ' + describirError(error) + '.' };
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
        tipo: pantalla.tipo || 'texto',
        texto: (typeof pantalla.texto === 'string') ? pantalla.texto : 'Hola Mundo',
        tamano: Number(config.tamano) || 2,
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
        texto: 'Hola Mundo',
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
  const cancelarPropio = suscribirCatalogo(rutaCatalogo(tipo), (obj) => { propio = obj; emitir(); }, alError);
  const cancelarBiblioteca = suscribirCatalogo(`biblioteca/${tipo}`, (obj) => { predeterminadas = obj; emitir(); }, () => { predeterminadas = {}; emitir(); });
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
export async function guardarImagenCatalogo(nombre, datos, ancho, alto, preprocesada = null, meta = {}) {
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
    return await guardarEnCatalogo('imagenes', safeKey, payload);
  } catch (err) {
    console.error('Error al guardar imagen en catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Borra una imagen del catálogo (/imagenes/<nombre>)
 */
export async function borrarImagenCatalogo(nombre) {
  try {
    return await borrarDeCatalogo('imagenes', nombre);
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
export async function listarAnimaciones() {
  try {
    const snap = await get(ref(db, rutaCatalogo('animaciones')));
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
export async function guardarAnimacionCatalogo(nombre, ancho, alto, cuadros, meta = {}) {
  try {
    const safeKey = limpiarClave(nombre);
    if (!safeKey) return { exito: false, error: 'falta el nombre' };
    const payload = { ancho, alto, cuadros, meta };
    return await guardarEnCatalogo('animaciones', safeKey, payload);
  } catch (err) {
    console.error('Error al guardar animación en catálogo:', err);
    return { exito: false, error: err.message };
  }
}

/**
 * Borra una animación del catálogo (/animaciones/<nombre>)
 */
export async function borrarAnimacionCatalogo(nombre) {
  try {
    return await borrarDeCatalogo('animaciones', nombre);
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
      // Canción "con letra": la grabación del .ino (formato m1) va en
      // oled_remota/archivo, igual que las animaciones comprimidas.
      pantallaPayload.tipo = 'musical';
      pantallaPayload.musical = {
        nombre: estado.musicalNombre || '',
        repeticiones: Number(estado.musicalRepeticiones || 1),
        formato: FORMATO_MUSICAL
      };
      archivo = { version: nuevaVersion, datos: estado.musicalDatos || '' };
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
