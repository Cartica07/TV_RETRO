// Entrada de la app unificada y "Añade tu TV" para una TV Lite. Solo maneja lo nuevo; el inicio de sesión, el formulario del código
// y todo lo demás siguen siendo de la Pro.
//
// 1. Primera pantalla "¿Qué TV tienes?" (#pantallaInicioTipo), una sola vez (la respuesta queda en el celular):
//    - TV Pro  -> el inicio de sesión de siempre (la Pro, sin cambios).
//    - TV Lite -> sin cuenta: entra con una sesión anónima e invisible; la clase "sin-cuenta" en <body> oculta lo de la cuenta.
//    Quien ya tenía sesión (por ejemplo, al actualizar la app) no ve la pregunta.
// 2. Una TV Lite se empareja en los ajustes de Bluetooth del celular (donde Android pide el PIN directo) y, al volver a la app, se
//    busca sola por su nombre, se añade y se vincula con el formulario de siempre (marca "LITE"; ver src/backend-unificado.js).
//    Sin cuenta y sin ninguna TV todavía, "Conecta tu TV" se abre sola.
// La parte Bluetooth (js/lite-tv.js) se carga solo cuando hace falta: con una TV Pro no corre.
import {
  usuarioActual, escucharSesion, cerrarSesion, unificadaAnadirTVLite, unificadaListarTVLite, unificadaSinCuenta, unificadaEntrarSinCuenta
} from './firebase.js';
import { PASOS } from './tutorial.js';

const q = (id) => document.getElementById(id);
const lite = () => import('./lite-tv.js');
const CLAVE_TIPO = 'tvretro.tipoApp';
const leerTipo = () => { try { return localStorage.getItem(CLAVE_TIPO) || ''; } catch (e) { return ''; } };
const guardarTipo = (t) => { try { if (t) localStorage.setItem(CLAVE_TIPO, t); else localStorage.removeItem(CLAVE_TIPO); } catch (e) { /* sin almacenamiento */ } };

// ---------------------------------------------------------------
// Tutorial guiado (js/tutorial.js de la Pro, sin tocar)
// ---------------------------------------------------------------
// La Pro recuerda lo "ya visto" por cuenta (tvretro.tutorial.<uid>); aquí basta con que se haya visto una vez en este celular.
const PREFIJO_TUTORIAL = 'tvretro.tutorial.';
function tutorialVistoEnEsteCelular() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIJO_TUTORIAL) && localStorage.getItem(k) === '1') return true;
    }
  } catch (e) { /* sin almacenamiento */ }
  return false;
}

// Con una TV Lite el paso de "Más" no puede nombrar los juegos (la TV Lite no tiene). El texto se elige al mostrarse el paso.
// Texto PROPUESTO (docs/lite-textos-propuestos.md, fila 42): lo aprueba el dueño.
const TEXTO_MAS_LITE = 'Aquí están tu galería, la alarma y los ajustes.';
{
  const paso = PASOS.find((p) => p.objetivo === '#grupoTipo button[data-valor="galeria"]');
  if (paso) {
    const textoPro = paso.texto;
    Object.defineProperty(paso, 'texto', {
      enumerable: true,
      configurable: true,
      get: () => (document.body.classList.contains('tv-lite') ? TEXTO_MAS_LITE : textoPro),
    });
  } else {
    console.warn('[TV RETRO] El tutorial de la Pro ya no tiene el paso de "Más": revisa js/anadir-lite.js de la unificada');
  }
}

// ---------------------------------------------------------------
// Primera pantalla: "¿Qué TV tienes?"
// ---------------------------------------------------------------
function iniciarPrimeraPantalla() {
  const pantalla = q('pantallaInicioTipo');
  if (!pantalla) return;
  // En el modo viejo sin cuentas (?sincuentas, solo para pruebas locales de la Pro) no hay sesión: la Pro ni siquiera la escucha,
  // y esta pantalla tampoco debe hacerlo.
  if (new URLSearchParams(location.search).has('sincuentas')) return;
  const botonPro = q('botonInicioPro');
  const botonLite = q('botonInicioLite');
  const aviso = q('inicioTipoError');
  const salir = q('botonTVSalir');
  const textoSalir = salir ? salir.textContent : '';

  // Sin cuenta: se oculta lo de la cuenta (CSS) y "Cerrar sesión" de Mis TV pasa a ser la forma de cambiar a una TV Pro.
  const marcar = () => {
    const sinCuenta = unificadaSinCuenta();
    document.body.classList.toggle('sin-cuenta', sinCuenta);
    if (salir) salir.textContent = sinCuenta ? 'Tengo un Pepito Pro' : textoSalir; // texto 40, aprobado (con Pepito)
  };
  const mostrarAviso = (texto) => { aviso.textContent = texto; aviso.hidden = !texto; };

  let entrando = false;
  async function entrarSinCuenta() {
    if (entrando) return;
    entrando = true;
    mostrarAviso('');
    botonPro.disabled = true;
    botonLite.disabled = true;
    guardarTipo('lite');
    marcar();
    const r = await unificadaEntrarSinCuenta();
    botonPro.disabled = false;
    botonLite.disabled = false;
    entrando = false;
    if (r.exito) {
      pantalla.hidden = true;
      return;
    }
    // No se pudo (sin internet, o el acceso sin cuenta no está activado en Firebase): se vuelve a la pregunta, con el motivo.
    guardarTipo('');
    marcar();
    pantalla.hidden = false;
    mostrarAviso(r.error);
  }

  botonPro.addEventListener('click', () => {
    mostrarAviso('');
    guardarTipo('pro');
    marcar();
    pantalla.hidden = true; // debajo queda el inicio de sesión de la Pro
  });
  botonLite.addEventListener('click', entrarSinCuenta);

  marcar();
  if (!leerTipo()) pantalla.hidden = false;
  escucharSesion((usuario) => {
    if (usuario) {
      // Ya hay sesión (con cuenta, o la anónima de la TV Lite): no se pregunta. Quien tenía sesión antes de esta pantalla es Pro.
      if (!leerTipo()) guardarTipo(usuario.email ? 'pro' : 'lite');
      marcar();
      pantalla.hidden = true;
      // El tutorial sale UNA vez por celular (decisión del dueño, 2026-11-23): si ya se vio con otra cuenta o con el otro tipo de
      // TV (Pro o Lite), se da por visto también para esta. Sigue disponible en Más > Config > Ayuda y contacto > Ver tutorial.
      if (tutorialVistoEnEsteCelular()) {
        try { localStorage.setItem(PREFIJO_TUTORIAL + usuario.uid, '1'); } catch (e) { /* sin almacenamiento */ }
      }
      return;
    }
    if (leerTipo() === 'lite') entrarSinCuenta(); // se eligió TV Lite pero no hay sesión (por ejemplo, se borró): entra sola
    else if (!leerTipo()) pantalla.hidden = false;
  });
}

// ---------------------------------------------------------------
// "Añade tu TV" y "Mis TV" para una TV Lite
// ---------------------------------------------------------------
function iniciarAnadirLite() {
  const botonLite = q('botonTVLite');
  const pantalla = q('pantallaConexion');
  if (!botonLite || !pantalla) return;
  let revisando = false;

  const abierta = () => !pantalla.hidden;
  const primeraVezSinCuenta = () => unificadaSinCuenta() && document.body.classList.contains('sin-tv');

  async function revisar() {
    if (revisando || !abierta()) return;
    revisando = true;
    try {
      let tv = null;
      try { tv = await (await lite()).tvVinculada(); } catch (e) { /* se sigue esperando */ }
      if (!tv) return;
      const usuario = usuarioActual();
      if (!usuario) return;
      unificadaAnadirTVLite(usuario.uid, tv.deviceId);
      pantalla.hidden = true;
      // Vincula con el mismo camino de siempre: el enrutador reconoce la marca "LITE" (src/backend-unificado.js).
      q('codigoTV').value = 'LITE';
      q('formTV').requestSubmit();
    } finally {
      revisando = false;
    }
  }

  const abrirConexion = () => {
    pantalla.hidden = false;
    revisar(); // si el celular ya tiene la TV emparejada, no hay nada más que hacer
  };
  botonLite.addEventListener('click', abrirConexion);
  q('botonAbrirBluetooth').addEventListener('click', async () => {
    try { await (await lite()).abrirAjustesBluetooth(); } catch (e) { console.warn('[TV RETRO] No se pudieron abrir los ajustes de Bluetooth', e); }
  });
  q('botonConexionVolver').addEventListener('click', () => {
    pantalla.hidden = true;
    // Sin cuenta y sin ninguna TV, detrás no hay nada que hacer: "Volver" lleva a la pregunta "¿Qué TV tienes?".
    if (primeraVezSinCuenta()) cerrarSesion().catch(() => {});
  });

  // Sin cuenta y la primera vez, "Conecta tu TV" se abre sola en cuanto aparece "Añade tu TV".
  const pantallaTV = q('pantallaTV');
  if (pantallaTV) {
    new MutationObserver(() => {
      if (!pantallaTV.hidden && primeraVezSinCuenta() && !abierta()) abrirConexion();
    }).observe(pantallaTV, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Una TV Lite no se comparte: en la lista de Mis TV sus filas (las últimas, después de las TV Pro) no llevan "Compartir".
  const lista = q('listaTV');
  if (lista) {
    new MutationObserver(() => {
      const usuario = usuarioActual();
      const n = usuario ? unificadaListarTVLite(usuario.uid).length : 0;
      if (!n) return;
      for (const fila of [...lista.querySelectorAll('.fila-tv')].slice(-n)) {
        for (const b of fila.querySelectorAll('button')) if (b.textContent.trim() === 'Compartir') b.hidden = true;
      }
    }).observe(lista, { childList: true });
  }
  // Al volver de los ajustes de Bluetooth (o de cualquier otra app) se revisa de nuevo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revisar();
  });
}

iniciarPrimeraPantalla();
iniciarAnadirLite();
