/**conexion
 * Estado de conexión de la TV (heartbeat lastSeen) y acuse de recibo (oled_remota/mostrada). Salió de main.js
 * (auditoría 2026-11-15, H-13). Se crea con crearConexion({ leerElementos, turnoEnvio }): leerElementos devuelve
 * el mapa de IDs del DOM (se asigna al arrancar) y turnoEnvio() el contador de envíos de main.js.
 */

import { marcarConexion, marcarEstado, marcarUltimaVista } from './ui.js';
import { suscribirLastSeen, suscribirMostrada, leerMostrada } from './firebase.js';

export function crearConexion({ leerElementos, turnoEnvio }) {
  const E = () => leerElementos();

  // ---- Estado de conexión del DISPOSITIVO (heartbeat) ----
  // La TV (ESP32-S3) escribe oled_remota/lastSeen cada 10 s desde su tarea
  // de red (red.cpp, latido(); TIEMPO_ACTUALIZACION en config.cpp). Si pasó
  // mucho más que eso desde el último valor visto, asumimos que el
  // dispositivo está apagado o sin WiFi -- aunque Firebase en sí responda
  // perfecto. El umbral es más alto que el intervalo real para dar
  // margen (jitter de red, un latido que se salteó una vez, etc.).
  const UMBRAL_DESCONEXION_MS = 25000;
  const INTERVALO_CHEQUEO_CONEXION_MS = 5000;

  let ultimoLastSeen = null; // ms desde época (heartbeat), o null si nunca llegó nada

  // Texto relativo para la última señal: "hace 4 s", "hace 12 min",
  // "hace 3 h", o fecha y hora si pasó más de un día. Se recalcula cada
  // INTERVALO_CHEQUEO_CONEXION_MS junto con el estado de conexión.
  function formatearHaceCuanto(timestampMs) {
    const seg = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
    if (seg < 60) return `hace ${seg} s`;
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `hace ${horas} h`;
    const f = new Date(timestampMs);
    const dd = String(f.getDate()).padStart(2, '0');
    const mm = String(f.getMonth() + 1).padStart(2, '0');
    const hh = String(f.getHours()).padStart(2, '0');
    const mi = String(f.getMinutes()).padStart(2, '0');
    return `el ${dd}/${mm} ${hh}:${mi}`;
  }

  function evaluarConexionDispositivo() {
    if (ultimoLastSeen === null) {
      marcarConexion('desconectado', 'error', E());
      marcarUltimaVista('', E());
      return;
    }

    const antiguedad = Date.now() - ultimoLastSeen;

    if (antiguedad <= UMBRAL_DESCONEXION_MS) {
      marcarConexion('en línea', 'ok', E());
    } else {
      marcarConexion('desconectado', 'error', E());
    }
    marcarUltimaVista(formatearHaceCuanto(ultimoLastSeen), E());
  }

  // ---- Acuse de recibo (auditoría 2026-11-15, H-06) ----
  // "Enviado" solo quería decir que Firebase aceptó la escritura. La TV ahora escribe oled_remota/mostrada con la
  // versión que ya aplicó; si llega (o ya estaba) el aviso pasa a "En la TV ✅". Con la TV sin conexión se avisa
  // que lo mostrará al conectarse; con un firmware que no informa queda el aviso de siempre.
  let versionMostradaTV = null;
  let acuseEsperado = null; // { version, turno, texto, temporizador }
  const ESPERA_ACUSE_MS = 20000;

  function tvEnLinea() {
    return ultimoLastSeen !== null && Date.now() - ultimoLastSeen <= UMBRAL_DESCONEXION_MS;
  }

  function cerrarAcuse() {
    if (acuseEsperado) {
      clearTimeout(acuseEsperado.temporizador);
      acuseEsperado = null;
    }
  }

  // Solo se toca el aviso si sigue siendo el del envío (la persona pudo haber hecho otra cosa mientras tanto).
  function avisoSigueIgual(a) {
    return a.turno === turnoEnvio() && E().estadoTexto.textContent === a.texto;
  }

  function mostrarAcuseSiCorresponde() {
    const a = acuseEsperado;
    if (!a || versionMostradaTV === null || versionMostradaTV < a.version) return;
    cerrarAcuse();
    if (avisoSigueIgual(a)) {
      console.info(`[TV RETRO] Acuse: la TV confirmó la v${a.version} (mostrada = ${versionMostradaTV})`);
      marcarEstado('En la TV ✅', 'ok', E());
    } else {
      console.info(`[TV RETRO] Acuse de la v${a.version} descartado: el aviso de pantalla ya era otro`);
    }
  }

  // Probado en la TV real (2026-11-16): antes se revisaba UNA vez a los 20 s. Una TV recién apagada sigue
  // pareciendo "en línea" hasta 25 s después de su último latido, así que el aviso de "sin conexión" podía no
  // salir nunca; y pasados los 20 s se dejaba de esperar el acuse, así que al encenderla no pasaba a "En la TV".
  // Ahora se sigue revisando cada 5 s hasta que llega el acuse, la persona hace otra cosa o pasan 10 minutos.
  const REVISAR_ACUSE_MS = 5000;
  const ESPERA_ACUSE_MAXIMA_MS = 10 * 60 * 1000;

  function esperarAcuse(version) {
    cerrarAcuse();
    const inicio = Date.now();
    const a = { version, turno: turnoEnvio(), texto: E().estadoTexto.textContent, temporizador: null, avisoSinConexion: false };
    const revisar = async () => {
      if (acuseEsperado !== a) return;
      if (!avisoSigueIgual(a) || Date.now() - inicio > ESPERA_ACUSE_MAXIMA_MS) {
        console.info(`[TV RETRO] Acuse de la v${version}: se deja de esperar (${avisoSigueIgual(a) ? 'pasaron 10 minutos' : 'el aviso de pantalla cambió'})`);
        acuseEsperado = null; // la persona hizo otra cosa (o ya pasó demasiado): no se toca el aviso
        return;
      }
      // Respaldo: si la escucha de "mostrada" no entregó (por ejemplo, la conexión del celular se reinició), se lee directo.
      const leida = await leerMostrada();
      if (acuseEsperado !== a) return;
      if (leida !== null && (versionMostradaTV === null || leida > versionMostradaTV)) {
        console.info(`[TV RETRO] Acuse: la lectura directa encontró mostrada = ${leida} (la escucha tenía ${versionMostradaTV})`);
        versionMostradaTV = leida;
        mostrarAcuseSiCorresponde();
        if (acuseEsperado !== a) return;
      }
      if (!a.avisoSinConexion && !tvEnLinea()) {
        marcarEstado('La TV está sin conexión: lo mostrará cuando se conecte.', null, E());
        a.texto = E().estadoTexto.textContent; // así el acuse que llegue después lo reemplaza
        a.avisoSinConexion = true;
      }
      a.temporizador = setTimeout(revisar, REVISAR_ACUSE_MS);
    };
    console.info(`[TV RETRO] Esperando el acuse de la v${version} (mostrada actual: ${versionMostradaTV})`);
    a.temporizador = setTimeout(revisar, ESPERA_ACUSE_MS);
    acuseEsperado = a;
    mostrarAcuseSiCorresponde();
  }

  function iniciarMonitoreoConexion() {
    suscribirLastSeen((valor) => {
      ultimoLastSeen = valor;
      evaluarConexionDispositivo();
    });

    // Acuse de recibo (H-06): cuando la TV dice que ya aplicó la versión enviada, el aviso pasa a "En la TV".
    suscribirMostrada((valor) => {
      versionMostradaTV = valor;
      mostrarAcuseSiCorresponde();
    });

    // lastSeen solo cambia cuando la TV escribe -- si se apaga,
    // Firebase no dispara ningún evento nuevo (no hay nada que cambiar).
    // Este timer aparte es el que nota que "ya pasó demasiado tiempo"
    // aunque no haya llegado ningún dato nuevo.
    setInterval(evaluarConexionDispositivo, INTERVALO_CHEQUEO_CONEXION_MS);
  }

  return { iniciarMonitoreoConexion, esperarAcuse };
}
