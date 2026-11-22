// "Añade tu TV" para una TV Lite (la app unificada). El código de la TV es para las TV Pro (por Wi-Fi); una TV Lite no tiene
// código en la nube: se empareja por Bluetooth desde los ajustes del celular (donde Android pide el PIN directo) y, al volver
// a la app, se busca sola la TV emparejada por su nombre.
//
// Flujo: botón "Tengo una TV Lite" -> pantalla "Conecta tu TV" (pasos) -> "Abrir Bluetooth" -> la persona empareja -> al volver
// la app encuentra la TV emparejada, la añade a la cuenta y vincula con el mismo formulario de siempre (marca "LITE").
// Este archivo solo maneja los botones nuevos: el formulario, el código y todo lo de la Pro siguen siendo de la Pro.
import { usuarioActual, unificadaAnadirTVLite } from './firebase.js';
import * as lite from './lite-tv.js';

const q = (id) => document.getElementById(id);

function iniciar() {
  const botonLite = q('botonTVLite');
  const pantalla = q('pantallaConexion');
  if (!botonLite || !pantalla) return;
  let revisando = false;

  const abierta = () => !pantalla.hidden;
  const cerrar = () => { pantalla.hidden = true; };

  async function revisar() {
    if (revisando || !abierta()) return;
    revisando = true;
    try {
      let tv = null;
      try { tv = await lite.tvVinculada(); } catch (e) { /* se sigue esperando */ }
      if (!tv) return;
      const usuario = usuarioActual();
      if (!usuario) return;
      unificadaAnadirTVLite(usuario.uid, tv.deviceId);
      cerrar();
      // Vincula con el mismo camino de siempre: el enrutador reconoce la marca "LITE" (src/backend-unificado.js).
      q('codigoTV').value = 'LITE';
      q('formTV').requestSubmit();
    } finally {
      revisando = false;
    }
  }

  botonLite.addEventListener('click', () => {
    pantalla.hidden = false;
    revisar(); // si el celular ya tiene la TV emparejada, no hay nada más que hacer
  });
  q('botonAbrirBluetooth').addEventListener('click', () => {
    lite.abrirAjustesBluetooth().catch((e) => console.warn('[TV RETRO] No se pudieron abrir los ajustes de Bluetooth', e));
  });
  q('botonConexionVolver').addEventListener('click', cerrar);

  // Una TV Lite no se comparte: en la lista de Mis TV sus filas (las últimas, después de las TV Pro) no llevan "Compartir".
  const lista = q('listaTV');
  if (lista) {
    new MutationObserver(() => {
      const usuario = usuarioActual();
      const n = usuario ? lite.listarTVLite(usuario.uid).length : 0;
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

iniciar();
