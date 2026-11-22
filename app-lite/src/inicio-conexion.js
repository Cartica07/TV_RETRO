// Pantalla "Conecta tu TV" (el HTML lo pone construir.mjs; el diseño es el de las pantallas completas de la Pro).
//
// Sale solo en el celular Android, y únicamente cuando no hay una TV emparejada: guía a emparejarla desde los ajustes
// de Bluetooth del celular (donde Android pide el PIN directo, sin la notificación que sale al emparejar desde la app).
// Al volver a la app busca sola la TV emparejada, se conecta y se cierra.
// El emparejamiento al tocar "Enviar" sigue funcionando como respaldo (ble.js).
import { Capacitor } from '@capacitor/core';
import * as ble from './ble.js';

let iniciada = false;

export function iniciarPantallaConexion() {
  if (iniciada) return;
  const pantalla = document.getElementById('pantallaConexion');
  if (!pantalla) return;
  // "?inicio=1" la fuerza en el navegador (pruebas); en el celular de verdad basta con que sea la app de Android.
  const forzada = /[?&]inicio=1/.test(location.search);
  if (!forzada && !Capacitor.isNativePlatform()) return;
  iniciada = true;

  let descartada = false; // "Ahora no": no vuelve a salir hasta que se abra la app de nuevo
  let revisando = false;

  async function revisar() {
    if (descartada || revisando) return;
    revisando = true;
    try {
      if (ble.estaConectado()) { pantalla.hidden = true; return; }
      let tv = null;
      try { tv = await ble.tvVinculada(); } catch (e) { /* se muestra la pantalla */ }
      if (tv) {
        pantalla.hidden = true;
        ble.usarTVVinculada(tv.deviceId).catch(() => {});
      } else {
        pantalla.hidden = false;
      }
    } finally {
      revisando = false;
    }
  }

  document.getElementById('botonAbrirBluetooth').addEventListener('click', () => {
    ble.abrirAjustesBluetooth().catch((e) => console.warn('[TV RETRO] No se pudieron abrir los ajustes de Bluetooth', e));
  });
  document.getElementById('botonAhoraNo').addEventListener('click', () => {
    descartada = true;
    pantalla.hidden = true;
  });
  // Al volver de los ajustes de Bluetooth (o de cualquier otra app) se revisa de nuevo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revisar();
  });

  revisar();
}
