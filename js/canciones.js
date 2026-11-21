/**canciones
 * Canciones: catálogo (musicales/), selector, elegir y bajar una canción, importar .ino, borrar y Repeticiones.
 * Salió de main.js (auditoría 2026-11-15, H-13, paso 5). Se crea con crearCanciones({ ... }): lo que sigue viviendo en
 * main.js (estadoActual, renderizar, la vista previa del musical) entra por funciones que se leen al usarse.
 */

import {
  listarMusicales,
  leerMusical,
  guardarMusicalCatalogo,
  borrarMusicalCatalogo,
  describirError
} from './firebase.js';
import {
  puedeComprimir,
  codificarMusical,
  decodificarMusical,
  notasParaCancion
} from './compresion.js';
import { esperarFinal, TEXTO_BORRADO_LENTO, mostrarAviso } from './utilidades.js';

/**
 * leerElementos(), estado()      mapa de IDs del DOM y estadoActual (se reasigna al cargar, por eso son funciones).
 * renderizar()                   vuelve a dibujar la pantalla de arriba.
 * detenerPreviewMusical()        corta la vista previa del musical (sigue en main.js).
 */
export function crearCanciones({ leerElementos, estado, renderizar, detenerPreviewMusical }) {
  const E = () => leerElementos();

  // Canciones importadas de .ino (catálogo musicales/): clave -> meta.
  let musicalesCatalogo = {};
  // La canción elegida: { clave, datos (Base64 m1), grabacion (decodificada) }.
  let musicalCargado = null;

  // ===================================================
  // Canciones: catálogo, selección, upload, preview
  // ===================================================
  async function poblarCatalogoCanciones() {
    try {
      // Las canciones son las importadas de .ino (catálogo musicales/).
      const lista = await listarMusicales();
      if (lista === null) {
        // No se pudo leer (sin conexión, sin permiso): no es lo mismo que no
        // tener canciones, así que no se muestra "Importá canciones con +".
        if (!E().seleccionCancion.options.length) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No se pudo leer la lista';
          E().seleccionCancion.appendChild(opt);
        }
        setAvisoCancion('No se pudo leer la lista de canciones: sin conexión o sin permiso.', 'error');
        actualizarBotonBorrarMusical();
        return;
      }
      musicalesCatalogo = lista;

      // Limpiar select
      E().seleccionCancion.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = Object.keys(musicalesCatalogo).length ? '-- Selecciona --' : 'Importa canciones con +';
      E().seleccionCancion.appendChild(placeholder);

      Object.keys(musicalesCatalogo)
        .sort((a, b) => nombreMusical(a).localeCompare(nombreMusical(b), 'es', { sensitivity: 'base' }))
        .forEach(key => {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = nombreMusical(key);
          E().seleccionCancion.appendChild(opt);
        });

      // Si estadoActual.cancion ya tiene valor, seleccionarlo
      if (estado().cancion && musicalesCatalogo[estado().cancion]) {
        const clave = estado().cancion;
        E().seleccionCancion.value = clave;
        const turno = ++turnoCancion;
        cargandoMusical = true;
        try {
          const m = await cargarMusical(clave);
          // Si mientras tanto se eligió otra canción, esta ya no corresponde.
          if (turno === turnoCancion) {
            musicalCargado = m;
            estado().cancionNotas = notasParaCancion(m.grabacion);
            setAvisoCancion(describirMusical(clave, m.grabacion));
          }
        } finally {
          if (turno === turnoCancion) cargandoMusical = false;
        }
      } else {
        E().seleccionCancion.value = '';
      }
      actualizarBotonBorrarMusical();
    } catch (err) {
      console.error('Error cargando catálogo de canciones:', err);
    }
  }

  // Repeticiones: un entero de 1 a 99 (antes se podía mandar 0, negativos o
  // decimales, que el firmware no espera).
  const MAX_REPETICIONES = 99;
  function normalizarRepeticiones(valor) {
    const n = Math.trunc(Number(valor));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_REPETICIONES) : 1;
  }

  function nombreMusical(clave) {
    const meta = musicalesCatalogo[clave] || {};
    return meta.nombre || clave;
  }

  function actualizarBotonBorrarMusical() {
    if (E().botonBorrarMusical) E().botonBorrarMusical.disabled = !E().seleccionCancion.value;
  }

  // Cada vez que se elige una canción sube en 1: una carga que termina
  // cuando ya se eligió otra se descarta (si no, una canción lenta que
  // llegaba tarde reemplazaba a la elegida después).
  let turnoCancion = 0;
  // true mientras se baja la canción recién elegida (ver manejarSeleccionCancion):
  // si el cliente pulsa Enviar en ese momento se le pide esperar, en vez de
  // decirle "Elige una canción" cuando ya la eligió.
  let cargandoMusical = false;

  // Baja y decodifica la grabación de una canción del catálogo. No la deja
  // elegida: eso lo hace quien llama, si la carga sigue correspondiendo.
  // Últimas canciones bajadas (clave -> { clave, datos, grabacion, fecha }), de
  // la más vieja a la más nueva. Volver a una canción ya escuchada no la baja
  // ni la decodifica otra vez (puede pesar ~120 KB). Cada una guarda la fecha
  // de su entrada en el índice: si la canción se reimporta, la fecha cambia y
  // la copia guardada deja de valer.
  const CANCIONES_EN_MEMORIA = 4;
  const cancionesBajadas = new Map();

  function fechaDeMusical(clave) {
    const meta = musicalesCatalogo[clave];
    return meta && meta.fecha !== undefined ? meta.fecha : null;
  }

  // true si la copia en memoria sigue siendo la que está en el catálogo.
  function musicalVigente(m, clave) {
    return !!m && m.clave === clave && m.fecha === fechaDeMusical(clave);
  }

  async function cargarMusical(clave) {
    if (musicalVigente(musicalCargado, clave)) return musicalCargado;
    const guardada = cancionesBajadas.get(clave);
    if (musicalVigente(guardada, clave)) {
      cancionesBajadas.delete(clave); // pasa a ser la más reciente
      cancionesBajadas.set(clave, guardada);
      return guardada;
    }
    cancionesBajadas.delete(clave);
    const fecha = fechaDeMusical(clave); // antes de bajar: si cambia mientras tanto, no vale
    const datos = await leerMusical(clave);
    if (!datos) throw new Error('No se encontró la canción.');
    const grabacion = await decodificarMusical(datos);
    const m = { clave, datos, grabacion, fecha };
    cancionesBajadas.set(clave, m);
    while (cancionesBajadas.size > CANCIONES_EN_MEMORIA) cancionesBajadas.delete(cancionesBajadas.keys().next().value);
    return m;
  }

  // YA NO SE USA (decisión del dueño, 2026-11-10): en el ESP32-S3 todas las
  // canciones respetan Repeticiones. Se conserva por la regla de no borrar
  // funciones. true si el .ino de la canción cargada no repite loop() (eso
  // solo importa en la TV ESP8266).
  function musicalNoSeRepite() {
    return !!(musicalCargado && musicalCargado.grabacion && !musicalCargado.grabacion.repetir);
  }

  // YA NO SE USA: ocultaba la fila Repeticiones en las canciones que no
  // repiten. Ahora la fila se ve siempre.
  function actualizarFilaRepeticiones() {
    const fila = E().inputRepeticiones && E().inputRepeticiones.closest('.campo');
    if (fila) fila.hidden = musicalNoSeRepite();
  }

  function describirMusical(clave, grab) {
    const seg = Math.round(grab.duracion / 1000);
    const min = Math.floor(seg / 60), s = String(seg % 60).padStart(2, '0');
    // (grab.repetir ya no se muestra: el ESP32-S3 da siempre las vueltas de Repeticiones.)
    const fin = '';
    return `${nombreMusical(clave)} · ${min}:${s}${fin}`;
  }

  // Importa uno o varios .ino: cada uno se ejecuta (inoMusical.js), se graba
  // y se guarda en musicales/. Con el mismo nombre, reemplaza la anterior.
  async function importarCanciones(archivos) {
    const lista = [...(archivos || [])].filter(f => /\.ino$/i.test(f.name));
    if (lista.length === 0) return;
    if (!puedeComprimir()) {
      setAvisoCancion('Este navegador no es compatible. Prueba con Chrome o Edge.', 'error');
      return;
    }

    const errores = [];
    let ultimaClave = null;
    for (let i = 0; i < lista.length; i++) {
      const archivo = lista[i];
      setAvisoCancion(`Importando ${i + 1} de ${lista.length}: ${archivo.name}…`);
      // Deja que la página se actualice antes de cada canción (grabar lleva un rato).
      await new Promise(r => setTimeout(r, 30));
      try {
        const { grabarIno, nombreDelIno } = await import('./inoMusical.js');
        const texto = await archivo.text();
        const grab = grabarIno(texto);
        const m = await codificarMusical(grab);
        const nombre = nombreDelIno(texto) || archivo.name.replace(/\.ino$/i, '').replace(/\.ino$/i, '');
        const clave = archivo.name.replace(/\.ino$/i, '').replace(/\.ino$/i, '');
        const meta = {
          nombre,
          archivo: archivo.name,
          duracion: grab.duracion,
          repetir: grab.repetir,
          imagenes: m.imagenes,
          bytes: m.bytes,
          origen: 'ino',
          fecha: Date.now()
        };
        let r = await guardarMusicalCatalogo(clave, m.datos, meta);
        r = await esperarFinal(r, () => setAvisoCancion('La conexión está lenta: se importará solo cuando vuelva la señal.'));
        if (!r.exito) throw new Error('no se pudo guardar: ' + describirError(r.error));
        ultimaClave = r.clave;
      } catch (err) {
        console.error('Error importando', archivo.name, err);
        errores.push(`${archivo.name}: ${err.message}`);
      }
    }

    const bien = lista.length - errores.length;
    await poblarCatalogoCanciones();
    if (ultimaClave && lista.length === 1 && !errores.length) {
      E().seleccionCancion.value = ultimaClave;
      await manejarSeleccionCancion();
    }
    if (errores.length) setAvisoCancion(`${bien} importada(s), ${errores.length} con error: ${errores.join(' · ')}`, 'error');
    else if (lista.length > 1) setAvisoCancion(`${bien} canciones importadas.`);
  }

  async function borrarMusicalElegido() {
    const clave = E().seleccionCancion.value;
    if (!clave) return;
    if (!confirm(`¿Borrar "${nombreMusical(clave)}"?`)) return;
    let r = await borrarMusicalCatalogo(clave);
    r = await esperarFinal(r, () => setAvisoCancion(TEXTO_BORRADO_LENTO));
    if (!r.exito) {
      setAvisoCancion('No se pudo borrar: ' + describirError(r.error), 'error');
      return;
    }
    cancionesBajadas.delete(clave);
    if (musicalCargado && musicalCargado.clave === clave) musicalCargado = null;
    estado().cancion = '';
    estado().cancionNotas = [];
    detenerPreviewMusical();
    await poblarCatalogoCanciones();
    setAvisoCancion('');
  }

  function setAvisoCancion(text, tipo = null) {
    mostrarAviso(E().avisoCancion, text, tipo);
  }

  async function manejarSeleccionCancion() {
    const turno = ++turnoCancion;
    cargandoMusical = false; // una carga anterior queda abandonada
    const key = E().seleccionCancion.value;
    actualizarBotonBorrarMusical();

    // Mientras la nueva carga (o si falla), no queda elegida la anterior:
    // así "Enviar" nunca manda otra canción que la que se ve en el selector.
    if (!musicalCargado || musicalCargado.clave !== key) {
      estado().cancion = '';
      estado().cancionNotas = [];
      musicalCargado = null;
      detenerPreviewMusical();
    }

    if (!key) {
      setAvisoCancion('');
      renderizar();
      return;
    }
    if (!musicalesCatalogo[key]) {
      setAvisoCancion('No se encontró la canción en la galería.', 'error');
      return;
    }
    try {
      setAvisoCancion('Cargando…');
      cargandoMusical = true;
      const m = await cargarMusical(key);
      if (turno !== turnoCancion) return; // ya se eligió otra
      cargandoMusical = false;
      musicalCargado = m;
      estado().cancion = key;
      // Para "sin letra": las notas en el formato de las canciones de siempre.
      estado().cancionNotas = notasParaCancion(m.grabacion);
      setAvisoCancion(describirMusical(key, m.grabacion));
      renderizar();
    } catch (err) {
      if (turno !== turnoCancion) return;
      cargandoMusical = false;
      console.error('Error cargando la canción:', err);
      setAvisoCancion('No se pudo cargar la canción: ' + err.message, 'error');
    }
  }

  // Canciones nuevas: se importan desde este panel con el botón + de
  // Canciones (archivos .ino, ver importarCanciones) y se borran con el
  // tacho (borrarMusicalElegido). Van al catálogo musicales/.
  // (La carga en lote vive aparte, en carga-masiva.html.)

  // ---- Lo que main.js usa de acá ----
  // El catálogo lo lee y lo reemplaza también mas.js (tonos de la alarma), por eso va por funciones.
  const obtenerMusicales = () => musicalesCatalogo;
  function fijarMusicales(lista) {
    musicalesCatalogo = lista;
  }
  // La canción elegida y si se está bajando (Enviar y la vista previa la leen).
  const obtenerMusicalCargado = () => musicalCargado;
  const obtenerCargandoMusical = () => cargandoMusical;

  return {
    poblarCatalogoCanciones, normalizarRepeticiones, setAvisoCancion, importarCanciones, borrarMusicalElegido,
    manejarSeleccionCancion, nombreMusical, obtenerMusicales, fijarMusicales, obtenerMusicalCargado, obtenerCargandoMusical
  };
}
