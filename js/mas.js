/**mas
 * Pestaña Más: menú (Galería, Juegos, Alarma, Config), Mi cuenta, Ajustes de la TV, Alarma y "Jugar". Salió de
 * main.js (auditoría 2026-11-15, H-13, paso 2). Se crea con crearMas({ ... }): todo lo que viene de main.js
 * (elementos, estado, turno de envío, catálogo de canciones...) entra por FUNCIONES que se leen al usarse, nunca
 * al crear el módulo (varias de esas variables se declaran más abajo en main.js).
 */

import { marcarEstado, activarLedTransmision, desactivarLedTransmision } from './ui.js';
import {
  enviarEstado,
  listarMusicales,
  cargarAlarma,
  guardarAlarma,
  normalizarAlarma,
  cargarAjustes,
  guardarAjustes,
  normalizarAjustes,
  cargarSistema,
  suscribirFirmwareTV,
  suscribirMostrada,
  desvincularDispositivo,
  dispositivoActual
} from './firebase.js';
import { sinRepetir, esperarFinal, TEXTO_GUARDADO_LENTO } from './utilidades.js';

// Títulos de la cabecera de Más cuando se está dentro de Config (los lee main.js en mostrarSeccionSegunTipo).
export const TITULOS_CONFIG = { lista: 'Config', cuenta: 'Mi cuenta', tv: 'Ajustes de la TV', sistema: 'Sistema', ayuda: 'Ayuda y contacto', legal: 'Legal' };

/**
 * leerElementos()      mapa de IDs del DOM (se asigna al arrancar).
 * estado()             estadoActual de main.js (se reasigna al cargar, por eso es función).
 * sesion()             sesionActual (null sin cuentas).
 * musicales()          catálogo de canciones; fijarMusicales(lista) lo reemplaza; nombreMusical(clave).
 * avanzarTurnoEnvio()  sube el turno de envío (antes `turnoEnvio++`); va SIEMPRE antes de mostrarResultadoEnvio.
 * mostrarResultadoEnvio(resultado, textoOk), mostrarSeccionSegunTipo(tipo), renderizar().
 * estaBloqueado()      el panel sigue inert/bloqueado (arranque): el botón Jugar no hace nada.
 */
export function crearMas({
  leerElementos, estado, sesion, musicales, fijarMusicales, nombreMusical,
  avanzarTurnoEnvio, mostrarResultadoEnvio, mostrarSeccionSegunTipo, renderizar, estaBloqueado
}) {
  const E = () => leerElementos();

  // ---- Más: menú (Galería, Juegos, Alarma, Config) ----
  // 'menu' | 'galeria' | 'juegos' | 'alarma' | 'config'. Al tocar "Más" abajo siempre se ve el menú.
  let masVista = 'menu';
  // Dentro de Config: 'lista' | 'cuenta' | 'tv' | 'sistema' | 'ayuda' | 'legal'.
  let configVista = 'lista';

  function cambiarMasVista(vista) {
    turnoSistema++; // Sistema: se deja de esperar el resultado de una actualización o un restablecimiento
    masVista = ['juegos', 'galeria', 'alarma', 'config'].includes(vista) ? vista : 'menu';
    configVista = 'lista';
    mostrarSeccionSegunTipo(estado().tipo);
    if (window.scrollY > 0) window.scrollTo(0, 0);
    renderizar();
    if (masVista === 'alarma') abrirAlarma();
  }

  // Un apartado de Config (o de vuelta a su lista).
  function abrirApartadoConfig(apartado) {
    turnoSistema++;
    configVista = Object.prototype.hasOwnProperty.call(TITULOS_CONFIG, apartado) ? apartado : 'lista';
    mostrarSeccionSegunTipo(estado().tipo);
    if (window.scrollY > 0) window.scrollTo(0, 0);
    if (configVista === 'cuenta') mostrarMiCuenta();
    if (configVista === 'tv') abrirAjustesTV();
    if (configVista === 'sistema') abrirSistema();
  }

  // "Volver" (y el Atrás de la APK) dentro de Más: de un apartado de Config a su lista; si no, al menú.
  function volverEnMas() {
    if (masVista === 'config' && configVista !== 'lista') abrirApartadoConfig('lista');
    else cambiarMasVista('menu');
  }

  // ---- Config > Mi cuenta ----
  function mostrarMiCuenta() {
    const correo = sesion() && sesion().email ? sesion().email : '';
    E().configCorreo.textContent = correo || 'Sin sesión';
    // Sin cuentas (solo pruebas locales) no hay nada que cerrar ni eliminar.
    E().botonConfigCerrarSesion.disabled = !sesion();
    E().botonConfigEliminarCuenta.disabled = !sesion();
    E().botonConfigMisTV.disabled = !sesion();
  }

  // ---- Config > Ajustes de la TV ----
  let ajustesDatos = normalizarAjustes(null);
  let turnoAjustes = 0;

  function marcarOpcion(grupo, valor) {
    grupo.querySelectorAll('button[data-valor]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.valor === String(valor) ? 'true' : 'false');
    });
  }

  function volcarAjustesEnPantalla() {
    marcarOpcion(E().grupoBrillo, ajustesDatos.brillo);
    marcarOpcion(E().grupoVolumen, ajustesDatos.volumen);
    const sel = E().ajusteZona;
    const valor = String(ajustesDatos.zona);
    // Una zona guardada que no está en la lista (ej. puesta desde otro lado) se muestra igual.
    if (![...sel.options].some((o) => o.value === valor)) {
      const opt = document.createElement('option');
      const total = Math.abs(ajustesDatos.zona);
      const horas = Math.floor(total / 60);
      const minutos = total % 60;
      opt.value = valor;
      opt.textContent = `UTC${ajustesDatos.zona >= 0 ? '+' : '−'}${horas}${minutos ? ':' + String(minutos).padStart(2, '0') : ''}`;
      sel.appendChild(opt);
    }
    sel.value = valor;
  }

  function leerAjustesDePantalla() {
    const elegido = (grupo, defecto) => {
      const b = grupo.querySelector('button[aria-pressed="true"]');
      return b ? Number(b.dataset.valor) : defecto;
    };
    ajustesDatos = normalizarAjustes({
      brillo: elegido(E().grupoBrillo, ajustesDatos.brillo),
      volumen: elegido(E().grupoVolumen, ajustesDatos.volumen),
      zona: Number(E().ajusteZona.value)
    });
  }

  // Auditoría 2026-11-15 (H-29): mientras los ajustes no se hayan leído bien, Guardar queda bloqueado. Antes
  // estaba habilitado con los valores por defecto a la vista, y guardar antes de que llegara la lectura (o
  // después de un fallo sin señal) escribía esos valores por defecto encima de los reales.
  let ajustesCargados = false;

  async function abrirAjustesTV() {
    const turno = ++turnoAjustes;
    ajustesCargados = false;
    E().botonGuardarAjustes.disabled = true;
    volcarAjustesEnPantalla();
    const r = await cargarAjustes();
    if (turno !== turnoAjustes || masVista !== 'config' || configVista !== 'tv') return; // se fue mientras tanto
    if (r.exito) {
      ajustesDatos = r.ajustes;
      ajustesCargados = true;
      E().botonGuardarAjustes.disabled = false;
      volcarAjustesEnPantalla();
    } else {
      marcarEstado('No se pudieron leer los ajustes de la TV. Revisa tu internet y vuelve a abrir esta pantalla.', 'error', E());
    }
  }

  async function guardarAjustesEnLaTV() {
    if (!ajustesCargados) return;
    await sinRepetir('ajustes', E().botonGuardarAjustes, async () => {
      leerAjustesDePantalla();
      avanzarTurnoEnvio();
      marcarEstado('Guardando…', null, E());
      activarLedTransmision(E());
      try {
        // esperarFinal: con la conexión lenta avisa y espera a que termine (el botón sigue ocupado, H-37).
        const r = await esperarFinal(await guardarAjustes(ajustesDatos, estado()), () => marcarEstado(TEXTO_GUARDADO_LENTO, null, E()));
        mostrarResultadoEnvio(r, 'Ajustes guardados ✅ Ya van camino a la TV.');
      } catch (err) {
        console.error('Error al guardar los ajustes:', err);
        marcarEstado('Error desconocido al guardar los ajustes.', 'error', E());
      } finally {
        desactivarLedTransmision(E());
      }
    });
  }

  // ---- Config > Sistema (H-19, aprobado 2026-11-17): actualizar y restablecer la TV ----
  // Solo el dueño. "Actualizar" aparece solo si la versión publicada es más nueva que la de la TV (sin mostrar números).
  // "Restablecer" manda la orden, espera el acuse EXACTO de esa versión (la TV solo baja la última: un acuse mayor no
  // prueba que se borró) y recién entonces hace el "desvincular" de siempre. Sin acuse no se desvincula nada.
  let sistemaDatos = null;
  let turnoSistema = 0;
  const ESPERA_ACTUALIZAR_MS = 4 * 60 * 1000;
  const ESPERA_ACUSE_RESTABLECER_MS = 25 * 1000;

  const MENSAJES_ACTUALIZAR = {
    ocupada: 'La TV está ocupada (un juego o una alarma). Inténtalo en un momento.',
    poca_memoria: 'A la TV le falta memoria ahora. Reiníciala y vuelve a intentarlo.',
    sin_manifiesto: 'No se encontró la actualización. Inténtalo más tarde.',
    no_cabe: 'No se pudo actualizar la TV. Vuelve a intentarlo más tarde.',
    reinicio: 'La TV se reinició sin terminar la actualización. Vuelve a intentarlo.'
  };
  const TEXTO_ACTUALIZAR_ERROR = 'No se pudo actualizar la TV. Vuelve a intentarlo.';

  function textoActualizar(texto) {
    E().sistemaEstadoActualizar.textContent = texto;
  }

  // Qué se ve según lo que se leyó de la TV.
  function pintarSistema() {
    const el = E();
    const d = sistemaDatos;
    el.campoSistemaActualizar.style.display = 'none';
    el.campoSistemaRestablecer.style.display = 'none';
    if (!d) return;
    if (!d.esDueno) {
      marcarEstado('Solo el dueño de la TV puede actualizarla o restablecerla.', null, el);
      return;
    }
    if (!d.firmware) {
      marcarEstado('Esta TV todavía no admite estas opciones desde la app.', null, el);
      return;
    }
    el.campoSistemaActualizar.style.display = '';
    el.campoSistemaRestablecer.style.display = '';
    const hayNueva = d.manifiestoBuild !== null && d.manifiestoBuild > d.firmware.build;
    textoActualizar(hayNueva ? 'Hay una versión nueva para tu TV.' : 'Tu TV está al día ✅');
    el.botonSistemaActualizar.style.display = hayNueva ? '' : 'none';
  }

  async function abrirSistema() {
    const turno = ++turnoSistema;
    sistemaDatos = null;
    pintarSistema();
    const r = await cargarSistema();
    if (turno !== turnoSistema || masVista !== 'config' || configVista !== 'sistema') return; // se fue mientras tanto
    if (!r.exito) {
      marcarEstado('No se pudo leer el estado de la TV. Revisa tu internet y vuelve a abrir esta pantalla.', 'error', E());
      return;
    }
    sistemaDatos = r;
    pintarSistema();
  }

  // Espera lo que informa la TV tras la orden "actualizar". Resuelve { ok } | { error: estado } | { tiempo } | { cancelado }.
  function esperarResultadoActualizar(turno, fechaAntes, versionPublicada, versionAntes) {
    return new Promise((resolver) => {
      let terminado = false;
      let baja = () => {};
      let reloj = null;
      let vistoActualizando = false; // ya empezó a bajar o a instalar: un 'ok' con la versión vieja después es un fallo
      const terminar = (resultado) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(reloj);
        baja();
        resolver(resultado);
      };
      reloj = setTimeout(() => terminar({ tiempo: true }), ESPERA_ACTUALIZAR_MS);
      baja = suscribirFirmwareTV((fw) => {
        if (turno !== turnoSistema) return terminar({ cancelado: true });
        if (!fw || fw.fecha === null || fw.fecha === fechaAntes) return; // todavía es el informe de antes
        if (fw.estado === 'actualizando') {
          vistoActualizando = true;
          textoActualizar('Actualizando… no desconectes la TV.');
        }
        else if (fw.estado === 'reiniciando') {
          vistoActualizando = true;
          textoActualizar('Reiniciando la TV…');
        }
        // Éxito solo si la versión de la TV SUBIÓ y llegó a la publicada (un "ok" con la misma versión de antes no lo es).
        else if (fw.estado === 'ok' && fw.build >= versionPublicada && fw.build > versionAntes) terminar({ ok: true, firmware: fw });
        else if (fw.estado === 'ok' && vistoActualizando) terminar({ error: 'reinicio' }); // reinició (se cayó o se revirtió) y sigue en la versión vieja
        else if (fw.estado === 'al_dia') terminar({ ok: true, firmware: fw });
        else if (fw.estado !== 'ok') terminar({ error: fw.estado });
      });
      if (terminado) baja(); // el primer informe llegó antes de que "baja" estuviera asignada
    });
  }

  async function actualizarLaTV() {
    if (!sistemaDatos || !sistemaDatos.esDueno || !sistemaDatos.firmware) return;
    await sinRepetir('sistema-actualizar', E().botonSistemaActualizar, async () => {
      const turno = turnoSistema;
      // La pantalla puede llevar mucho rato abierta: se vuelven a leer la versión publicada y la de la TV antes de mandar nada
      // (una vez dio por buena una actualización que no era, por usar la versión publicada de cuando se abrió).
      textoActualizar('Comprobando…');
      const fresco = await cargarSistema();
      if (turno !== turnoSistema) return;
      if (!fresco.exito) {
        textoActualizar('');
        marcarEstado('No se pudo leer el estado de la TV. Revisa tu internet e inténtalo de nuevo.', 'error', E());
        return;
      }
      sistemaDatos = fresco;
      pintarSistema(); // si ya no hay versión nueva dice que está al día y oculta el botón
      if (!fresco.esDueno || !fresco.firmware || fresco.manifiestoBuild === null || fresco.manifiestoBuild <= fresco.firmware.build) return;
      const fechaAntes = sistemaDatos.firmware.fecha;
      const versionAntes = sistemaDatos.firmware.build;
      const publicada = sistemaDatos.manifiestoBuild;
      avanzarTurnoEnvio();
      textoActualizar('Enviando la orden…');
      activarLedTransmision(E());
      try {
        const r = await esperarFinal(await enviarEstado(Object.assign({}, estado(), { tipo: 'actualizar' })), () => textoActualizar('La conexión está lenta: la orden saldrá cuando vuelva la señal.'));
        if (!r.exito) {
          textoActualizar('');
          marcarEstado('No se pudo enviar la orden: ' + (r.error || 'sin conexión') + '.', 'error', E());
          return;
        }
        textoActualizar('Actualizando… no desconectes la TV.');
        const fin = await esperarResultadoActualizar(turno, fechaAntes, publicada, versionAntes);
        if (fin.cancelado) return;
        if (fin.ok) {
          sistemaDatos.firmware = fin.firmware;
          pintarSistema();
          textoActualizar('La TV se actualizó ✅');
        } else if (fin.tiempo) {
          textoActualizar('');
          marcarEstado('La TV no respondió. Tiene que estar encendida y con internet.', 'error', E());
        } else {
          textoActualizar('');
          marcarEstado(MENSAJES_ACTUALIZAR[fin.error] || TEXTO_ACTUALIZAR_ERROR, "error", E());
        }
      } catch (err) {
        console.error('Error al actualizar la TV:', err);
        textoActualizar('');
        marcarEstado('Error desconocido al actualizar la TV.', 'error', E());
      } finally {
        desactivarLedTransmision(E());
      }
    });
  }

  // Espera que la TV diga que aplicó EXACTAMENTE esa versión (oled_remota/mostrada). true | false (tiempo agotado).
  function esperarAcuseExacto(version, ms) {
    return new Promise((resolver) => {
      let terminado = false;
      let baja = () => {};
      const terminar = (valor) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(reloj);
        baja();
        resolver(valor);
      };
      const reloj = setTimeout(() => terminar(false), ms);
      baja = suscribirMostrada((valor) => { if (valor === version) terminar(true); });
      if (terminado) baja();
    });
  }

  async function restablecerLaTV() {
    if (!sistemaDatos || !sistemaDatos.esDueno || !sistemaDatos.firmware || !sesion()) return;
    if (!window.confirm('¿Restablecer la TV? Se borrarán su Wi-Fi, sus alarmas, sus ajustes y su contenido, y dejará de ser tuya. Después tendrás que configurar su Wi-Fi y vincularla de nuevo.')) return;
    await sinRepetir('sistema-restablecer', E().botonSistemaRestablecer, async () => {
      avanzarTurnoEnvio();
      marcarEstado('Restableciendo la TV…', null, E());
      activarLedTransmision(E());
      try {
        const r = await esperarFinal(await enviarEstado(Object.assign({}, estado(), { tipo: 'restablecer' })), () => marcarEstado(TEXTO_GUARDADO_LENTO, null, E()));
        if (!r.exito) {
          marcarEstado('No se pudo enviar la orden: ' + (r.error || 'sin conexión') + '.', 'error', E());
          return;
        }
        // Acuse EXACTO (no "mayor o igual"): si otra persona envía algo justo después, la TV solo baja lo último y un
        // acuse mayor no prueba que se haya borrado. Sin acuse no se desvincula nada.
        const acuse = await esperarAcuseExacto(r.version, ESPERA_ACUSE_RESTABLECER_MS);
        if (!acuse) {
          marcarEstado('La TV no respondió. Tiene que estar encendida y con internet. Revisa su estado y vuelve a intentarlo.', 'error', E());
          return;
        }
        marcarEstado('La TV se restableció. Soltándola de tu cuenta…', null, E());
        const d = await desvincularDispositivo(sesion().uid, dispositivoActual());
        if (!d.exito) {
          marcarEstado('La TV se restableció, pero no se pudo soltar de tu cuenta: ' + (d.error || '') + ' Pulsa Desvincular en Mi TV.', 'error', E());
          return;
        }
        location.reload();
      } catch (err) {
        console.error('Error al restablecer la TV:', err);
        marcarEstado('Error desconocido al restablecer la TV.', 'error', E());
      } finally {
        desactivarLedTransmision(E());
      }
    });
  }

  // ---- Más > Alarma ----
  // Hasta 3 alarmas (se edita una por vez) y un solo tono (canción del catálogo). Vive en la TV; acá
  // solo se configura (firebase.js: cargarAlarma / guardarAlarma).
  let alarmaDatos = normalizarAlarma(null); // copia que se edita
  let alarmaSel = 0;
  let turnoAlarma = 0;

  const dosDigitos = (n) => String(n).padStart(2, '0');

  // Pasa la alarma elegida (y el tono) de los datos a los controles.
  function volcarAlarmaEnPantalla() {
    const el = E();
    const a = alarmaDatos.alarmas[alarmaSel];
    el.alarmaHora.value = `${dosDigitos(a.hora)}:${dosDigitos(a.minuto)}`;
    el.alarmaActiva.checked = a.activa;
    el.grupoAlarmaDias.querySelectorAll('button[data-dia]').forEach((b) => {
      b.setAttribute('aria-pressed', (a.dias >> Number(b.dataset.dia)) & 1 ? 'true' : 'false');
    });
    el.grupoAlarmaNumero.querySelectorAll('button[data-alarma]').forEach((b) => {
      const n = Number(b.dataset.alarma);
      const activo = n === alarmaSel;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-selected', activo ? 'true' : 'false');
      b.classList.toggle('alarma-activa', alarmaDatos.alarmas[n].activa);
    });
    poblarTonosAlarma();
  }

  // Pasa lo que muestran los controles a los datos. false si falta la hora.
  function leerAlarmaDePantalla() {
    const el = E();
    const a = alarmaDatos.alarmas[alarmaSel];
    const m = /^(\d{1,2}):(\d{2})/.exec(el.alarmaHora.value || '');
    const hayHora = !!m;
    if (m) {
      a.hora = Math.min(23, Number(m[1]));
      a.minuto = Math.min(59, Number(m[2]));
    }
    a.activa = el.alarmaActiva.checked;
    let dias = 0;
    el.grupoAlarmaDias.querySelectorAll('button[data-dia]').forEach((b) => {
      if (b.getAttribute('aria-pressed') === 'true') dias |= 1 << Number(b.dataset.dia);
    });
    a.dias = dias;
    alarmaDatos.tono = el.alarmaTono.value || '';
    el.grupoAlarmaNumero.querySelectorAll('button[data-alarma]').forEach((b) => {
      b.classList.toggle('alarma-activa', alarmaDatos.alarmas[Number(b.dataset.alarma)].activa);
    });
    return hayHora;
  }

  // Lista de tonos = las canciones del catálogo (musicales/). La primera opción es el sonido simple de la TV.
  function poblarTonosAlarma() {
    const sel = E().alarmaTono;
    const claves = Object.keys(musicales())
      .sort((a, b) => nombreMusical(a).localeCompare(nombreMusical(b), 'es', { sensitivity: 'base' }));
    sel.innerHTML = '';
    const simple = document.createElement('option');
    simple.value = '';
    simple.textContent = 'Sonido simple de la TV';
    sel.appendChild(simple);
    const opcion = (clave, texto) => {
      const opt = document.createElement('option');
      opt.value = clave;
      opt.textContent = texto;
      sel.appendChild(opt);
    };
    claves.forEach((clave) => opcion(clave, nombreMusical(clave)));
    // Si la canción elegida ya no está en el catálogo se conserva (la TV ya la tiene), con su clave.
    if (alarmaDatos.tono && !musicales()[alarmaDatos.tono]) opcion(alarmaDatos.tono, alarmaDatos.tono);
    sel.value = alarmaDatos.tono || '';
  }

  // Auditoría 2026-11-15 (H-29): igual que los ajustes, Guardar alarma queda bloqueado hasta leer bien las
  // alarmas de la TV (si no, guardar a tiempo de carga dejaba las 3 alarmas apagadas).
  let alarmaCargada = false;

  async function abrirAlarma() {
    const turno = ++turnoAlarma;
    alarmaSel = 0;
    alarmaCargada = false;
    E().botonGuardarAlarma.disabled = true;
    volcarAlarmaEnPantalla();
    if (!Object.keys(musicales()).length) {
      const lista = await listarMusicales();
      if (turno !== turnoAlarma || masVista !== 'alarma') return;
      if (lista) fijarMusicales(lista);
    }
    const r = await cargarAlarma();
    if (turno !== turnoAlarma || masVista !== 'alarma') return; // se fue de la pantalla mientras tanto
    if (r.exito) {
      alarmaDatos = r.alarma;
      alarmaCargada = true;
      E().botonGuardarAlarma.disabled = false;
      volcarAlarmaEnPantalla();
    } else {
      marcarEstado('No se pudo leer la alarma de la TV. Revisa tu internet y vuelve a abrir esta pantalla.', 'error', E());
    }
  }

  async function guardarAlarmaEnLaTV() {
    if (!alarmaCargada) return;
    await sinRepetir('alarma', E().botonGuardarAlarma, async () => {
      if (!leerAlarmaDePantalla()) {
        marcarEstado('Pon la hora de la alarma.', 'error', E());
        return;
      }
      const sinDias = alarmaDatos.alarmas.findIndex((a) => a.activa && a.dias === 0);
      if (sinDias >= 0) {
        marcarEstado(`Elige al menos un día para la alarma ${sinDias + 1}.`, 'error', E());
        return;
      }
      avanzarTurnoEnvio();
      marcarEstado('Guardando…', null, E());
      activarLedTransmision(E());
      try {
        const r = await esperarFinal(await guardarAlarma(alarmaDatos, estado()), () => marcarEstado(TEXTO_GUARDADO_LENTO, null, E()));
        mostrarResultadoEnvio(r, 'Alarma guardada ✅ Ya va camino a la TV.');
      } catch (err) {
        console.error('Error al guardar la alarma:', err);
        marcarEstado('Error desconocido al guardar la alarma.', 'error', E());
      } finally {
        desactivarLedTransmision(E());
      }
    });
  }

  // "Jugar": le dice a la TV que abra ese juego (tipo "juego"; no cambia lo que ya muestra).
  async function jugarEnLaTV(id, boton) {
    await sinRepetir('jugar', boton, async () => {
      avanzarTurnoEnvio();
      marcarEstado('Enviando…', null, E());
      activarLedTransmision(E());
      try {
        const resultado = await enviarEstado(Object.assign({}, estado(), { tipo: 'juego', juegoId: id }));
        mostrarResultadoEnvio(resultado);
      } catch (err) {
        console.error('Error al abrir el juego:', err);
        marcarEstado('Error desconocido al enviar.', 'error', E());
      } finally {
        desactivarLedTransmision(E());
      }
    });
  }

  // ---- Eventos ----
  // main.js solo asigna masVista al abrir (H-35: la Galería con una animación activa se fuerza ahí y en ningún otro lado) o
  // al tocar "Más" abajo (cambiarTipo): son asignaciones sueltas, sin efectos, a propósito distintas de cambiarMasVista.
  const obtenerMasVista = () => masVista;
  const obtenerConfigVista = () => configVista;
  function fijarMasVista(vista) {
    masVista = vista;
  }

  function configurarEventosMas() {
    // Más: menú de opciones, "volver" y botones "Jugar".
    if (E().grupoMas) {
      E().grupoMas.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-mas]');
        if (btn) cambiarMasVista(btn.dataset.mas);
      });
    }
    if (E().botonMasVolver) {
      E().botonMasVolver.addEventListener('click', volverEnMas);
    }
    // Config: apartados, Mi cuenta y Ajustes de la TV.
    if (E().grupoConfig) {
      E().grupoConfig.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-config]');
        if (btn) abrirApartadoConfig(btn.dataset.config);
      });
    }
    [E().grupoBrillo, E().grupoVolumen].forEach((grupo) => {
      if (!grupo) return;
      grupo.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-valor]');
        if (btn) marcarOpcion(grupo, btn.dataset.valor);
      });
    });
    if (E().botonGuardarAjustes) E().botonGuardarAjustes.addEventListener('click', guardarAjustesEnLaTV);
    if (E().botonSistemaActualizar) E().botonSistemaActualizar.addEventListener('click', actualizarLaTV);
    if (E().botonSistemaRestablecer) E().botonSistemaRestablecer.addEventListener('click', restablecerLaTV);
    // Alarma: elegir cuál (1, 2 o 3), días, interruptor y guardar.
    if (E().grupoAlarmaNumero) {
      E().grupoAlarmaNumero.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-alarma]');
        if (!btn) return;
        leerAlarmaDePantalla(); // lo que se estaba editando no se pierde al cambiar de alarma
        alarmaSel = Number(btn.dataset.alarma);
        volcarAlarmaEnPantalla();
      });
    }
    if (E().grupoAlarmaDias) {
      E().grupoAlarmaDias.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-dia]');
        if (btn) btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      });
    }
    if (E().alarmaActiva) E().alarmaActiva.addEventListener('change', leerAlarmaDePantalla);
    if (E().botonGuardarAlarma) E().botonGuardarAlarma.addEventListener('click', guardarAlarmaEnLaTV);
    if (E().seccionJuegos) {
      E().seccionJuegos.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-juego]');
        if (btn && !estaBloqueado()) jugarEnLaTV(btn.dataset.juego, btn);
      });
    }
  }

  return { obtenerMasVista, obtenerConfigVista, fijarMasVista, volverEnMas, configurarEventosMas };
}
