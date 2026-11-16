/**galeria
 * Galería: catálogos de imágenes y de animaciones/GIF (escucha en vivo, miniaturas, elegir, borrar) y "Añadir nueva".
 * Salió de main.js (auditoría 2026-11-15, H-13, paso 4). Se crea con crearGaleria({ ... }): lo que sigue viviendo en main.js
 * (el estado de la pestaña Imagen, renderizar, aplicarGif...) entra por funciones que se leen al usarse, nunca al crear el módulo.
 */

import {
  suscribirImagenes,
  suscribirAnimaciones,
  leerPreprocesada,
  leerCuadrosAnimacion,
  guardarImagenCatalogo,
  borrarImagenCatalogo,
  borrarAnimacionCatalogo,
  guardarAnimacionCatalogo,
  describirError
} from './firebase.js';
import { procesarImagen, dibujarPreviewImagen, OPCIONES_GEOMETRIA_DEFECTO } from './imageProcessor.js';
import { esGif, leerGif, comprobarTamanoArchivo } from './gif.js';
import {
  esperarFinal,
  TEXTO_GUARDADO_LENTO,
  TEXTO_BORRADO_LENTO,
  mostrarAviso
} from './utilidades.js';
import { marcarEstado } from './ui.js';

/**
 * leerElementos(), estado()              mapa de IDs del DOM y estadoActual (se reasigna al cargar, por eso son funciones).
 * obtenerEsAdmin()                       la cuenta es administradora (puede borrar las predeterminadas).
 * renderizar(), actualizarControlesEdicionImagen(), aplicarGif(), aplicarResultadoImagen(r), mostrarAvisoPesoGif(el, peso),
 * mensajeDeArchivo(e), subidaObsoleta(turno, f), enPestanaGaleria(), hayGifDe(origen)    siguen en main.js.
 * obtenerImagenFuente/fijarImagenFuente, fijarImagenOriginal, obtenerGifActual/fijarGifActual,
 * obtenerTurnoReprocesoImagen/avanzarTurnoReprocesoImagen, nuevoTurnoSubida
 *                                        estado compartido con la pestaña Imagen (que sigue en main.js).
 */
export function crearGaleria({
  leerElementos, estado, obtenerEsAdmin,
  renderizar, actualizarControlesEdicionImagen, aplicarGif, aplicarResultadoImagen, mostrarAvisoPesoGif, mensajeDeArchivo,
  subidaObsoleta, enPestanaGaleria, hayGifDe,
  obtenerImagenFuente, fijarImagenFuente, fijarImagenOriginal, obtenerGifActual, fijarGifActual,
  obtenerTurnoReprocesoImagen, avanzarTurnoReprocesoImagen, nuevoTurnoSubida
}) {
  const E = () => leerElementos();

  // Catálogo de imágenes guardadas cargado desde Firebase (/imagenes)
  let imagenesCatalogo = {};

  // Catálogo de animaciones guardadas cargado desde Firebase (/animaciones)
  let animacionesCatalogo = {};

  // Clave (nombre) de la animación actualmente seleccionada en la
  // Galería -- mismo criterio que galeriaSeleccionActual pero para el
  // segundo recuadro (Animaciones).
  let animacionSeleccionActual = null;
  let turnoAnimacion = 0; // sube con cada elección: los cuadros que llegan tarde de una elección vieja no se aplican (H-12)

  // V1.14: clave (nombre) de la imagen actualmente seleccionada en la
  // Galería -- separado de estadoActual.imagenData porque necesitamos
  // saber el NOMBRE para poder borrarla, no solo sus datos. Se limpia
  // cuando se borra, se sube una nueva, o se cambia de tipo.
  let galeriaSeleccionActual = null;

  // ===================================================
  // V1.13: Galería -- sección propia con el catálogo completo.
  // Seleccionar un item deja estadoActual.tipo="galeria" (no salta a
  // "imagen"): la sección Galería se queda a la vista, con sus propios
  // controles de umbral/dithering para reajustar la selección ahí mismo.
  // ===================================================
  // Un catálogo de la Galería no se pudo leer (sin conexión, sin permiso).
  // No es lo mismo que estar vacío: en vez de "Todavía no hay…", se avisa.
  // Si la lista ya mostraba algo de antes, se conserva.
  function avisarCatalogoIlegible(grids, mensaje) {
    grids.filter(Boolean).forEach((grid) => {
      if (grid.querySelector('.item-galeria')) return;
      grid.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'galeria-vacio';
      p.textContent = `${mensaje}: sin conexión o sin permiso.`;
      grid.appendChild(p);
    });
    marcarEstado(`${mensaje}.`, 'error', E());
  }

  // Los catálogos de la Galería se ESCUCHAN (onValue) en vez de bajarse
  // completos cada vez que se entra: la primera vez baja todo y después solo
  // llegan los cambios (lo que se guarda o borra desde este panel u otro
  // dispositivo). Las funciones poblarCatalogo* mantienen su nombre y su uso:
  // la primera vez empiezan a escuchar y esperan los datos; las siguientes
  // solo vuelven a dibujar lo que ya está en memoria. listarImagenes() y
  // listarAnimaciones() se conservan (las usa carga-masiva.html).
  const ESPERA_PRIMERA_LECTURA_MS = 10000;
  const esperarPrimeraLectura = (promesa) => Promise.race([promesa, new Promise((r) => setTimeout(r, ESPERA_PRIMERA_LECTURA_MS))]);
  let escuchaImagenes = null;      // promesa de la primera lectura (null = no se está escuchando)
  let escuchaAnimaciones = null;

  async function poblarCatalogoImagenes() {
    try {
      if (escuchaImagenes) {
        await esperarPrimeraLectura(escuchaImagenes);
        renderizarGaleria();
        return;
      }
      escuchaImagenes = new Promise((resolver) => {
        suscribirImagenes((lista) => {
          imagenesCatalogo = lista;
          renderizarGaleria();
          resolver();
        }, () => {
          escuchaImagenes = null; // la escucha terminó: la próxima vez se vuelve a intentar
          avisarCatalogoIlegible([E().gridGaleria], 'No se pudo leer la galería de imágenes');
          resolver();
        });
      });
      await esperarPrimeraLectura(escuchaImagenes);
    } catch (err) {
      console.error('Error cargando catálogo de imágenes:', err);
    }
  }

  function renderizarGaleria() {
    const grid = E().gridGaleria;
    if (!grid) return;
    grid.innerHTML = '';

    const claves = Object.keys(imagenesCatalogo);

    if (claves.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'galeria-vacio';
      vacio.textContent = 'Todavía no hay imágenes guardadas.';
      grid.appendChild(vacio);
      actualizarBotonBorrarGaleria();
      return;
    }

    claves.forEach((key) => {
      const entry = imagenesCatalogo[key];
      if (!entry || !entry.datos) return;

      const item = document.createElement('div');
      item.className = 'item-galeria';
      item.dataset.clave = key;
      if (estado().tipo === 'galeria' && galeriaSeleccionActual === key) {
        item.classList.add('activo');
      }

      const canvas = document.createElement('canvas');
      canvas.width = entry.ancho || 128;
      canvas.height = entry.alto || 64;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        dibujarPreviewImagen(canvas, entry.datos, entry.ancho || 128, entry.alto || 64, '#4dd2ff');
      } catch (e) {
        console.error('Error dibujando miniatura de galería:', e);
      }

      const nombre = document.createElement('span');
      nombre.className = 'item-galeria-nombre';
      nombre.textContent = key;

      item.addEventListener('click', () => {
        estado().tipo = 'galeria';
        estado().imagenData = entry.datos;
        estado().imagenAncho = entry.ancho || 128;
        estado().imagenAlto = entry.alto || 64;
        galeriaSeleccionActual = key;
        avanzarTurnoReprocesoImagen(); // un reproceso de la imagen anterior ya no corresponde
        // La imagen activa pasa a ser esta: lo subido en la pestaña Imagen
        // (original o GIF) deja de ser la fuente de los reajustes.
        fijarImagenOriginal(null);
        fijarGifActual(null);

        // Limpiar el input de "añadir nueva": si quedaba un archivo de una
        // subida anterior, no queremos que se confunda con la fuente que
        // se está por activar acá.
        if (E().cargadorImagenGaleria) E().cargadorImagenGaleria.value = '';

        if (entry.preprocesada || entry.editable) {
          // Esta imagen tiene copia editable: se puede seguir reajustando
          // el umbral y el dithering como si se acabara de subir. Restauramos
          // los controles de Galería a los valores con los que se guardó,
          // para que el preview y los sliders arranquen sincronizados.
          // (H-12: con la lista liviana la copia editable no viene en la lista: se pide ahora, solo de esta imagen.)
          fijarImagenFuente(entry.preprocesada || null);
          if (entry.meta && typeof entry.meta.umbral === 'number') {
            E().umbralGaleria.value = entry.meta.umbral;
            E().valorUmbralGaleria.textContent = String(entry.meta.umbral);
          }
          if (entry.meta && typeof entry.meta.dithering === 'boolean') {
            E().ditheringGaleria.checked = entry.meta.dithering;
          }
          if (!entry.preprocesada) {
            const turnoCopia = obtenerTurnoReprocesoImagen();
            leerPreprocesada(key, { predeterminada: !!entry.predeterminada }).then((copia) => {
              // Solo si sigue elegida esta imagen y no se hizo otra cosa mientras tanto.
              if (!copia || galeriaSeleccionActual !== key || turnoCopia !== obtenerTurnoReprocesoImagen()) return;
              entry.preprocesada = copia;
              fijarImagenFuente(copia);
              actualizarControlesEdicionImagen();
            });
          }
        } else {
          // Guardada con una versión anterior de la galería: no hay fuente
          // editable, queda como bitmap fijo.
          fijarImagenFuente(null);
        }

        // Precargar el nombre: un simple click en "Guardar en la galería"
        // sobrescribe esta misma entrada con los cambios; para guardar
        // aparte alcanza con cambiar el nombre antes de guardar.
        if (E().nombreGaleriaNueva) E().nombreGaleriaNueva.value = key;

        actualizarResaltadoGaleria(); // solo mueve el resaltado "activo" (no reconstruye el grid)
        renderizar();
        actualizarControlesEdicionImagen();
        marcarEstado(`Imagen "${key}" cargada desde la galería`, 'ok', E());
      });

      item.appendChild(canvas);
      item.appendChild(nombre);
      grid.appendChild(item);
    });

    actualizarBotonBorrarGaleria();
  }

  // Mueve la marca "activo" de la grilla de imágenes sin reconstruirla:
  // renderizarGaleria() vuelve a crear y pintar todas las miniaturas, y para
  // cambiar de elemento marcado basta con cambiar una clase. La condición es
  // la misma que usa renderizarGaleria() al crear cada elemento.
  function actualizarResaltadoGaleria() {
    const grid = E().gridGaleria;
    if (grid) {
      grid.querySelectorAll('.item-galeria').forEach((item) => {
        item.classList.toggle('activo', estado().tipo === 'galeria' && galeriaSeleccionActual === item.dataset.clave);
      });
    }
    actualizarBotonBorrarGaleria();
  }

  // V1.14: habilita el ícono de basura de la cabecera solo si hay una
  // imagen seleccionada Y esa imagen todavía existe en el catálogo en
  // memoria (por si se borró desde otra pestaña/dispositivo mientras
  // tanto).
  function actualizarBotonBorrarGaleria() {
    if (!E().botonBorrarGaleria) return;
    const entrada = galeriaSeleccionActual ? imagenesCatalogo[galeriaSeleccionActual] : null;
    // Las predeterminadas (de la biblioteca común) las puede borrar solo un administrador.
    E().botonBorrarGaleria.disabled = !entrada || (!!entrada.predeterminada && !obtenerEsAdmin());
  }

  // Borra la imagen actualmente seleccionada en la Galería (ver
  // galeriaSeleccionActual, se fija al tocar una miniatura).
  async function manejarBorrarGaleriaSeleccionada() {
    if (!galeriaSeleccionActual) return;

    const key = galeriaSeleccionActual;
    const predeterminada = !!(imagenesCatalogo[key] && imagenesCatalogo[key].predeterminada);
    if (predeterminada && !obtenerEsAdmin()) {
      marcarEstado('Esa imagen es predeterminada: se puede usar, pero no se puede borrar.', null, E());
      return;
    }
    // Borrar es permanente (igual que con las canciones, se pregunta antes).
    const pregunta = predeterminada
      ? `¿Borrar "${key}" de las predeterminadas? Dejará de verse en TODAS las cuentas. No se puede deshacer.`
      : `¿Borrar "${key}" de la galería? No se puede deshacer.`;
    if (!confirm(pregunta)) return;
    let resultado = await borrarImagenCatalogo(key, { predeterminada });
    resultado = await esperarFinal(resultado, () => marcarEstado(TEXTO_BORRADO_LENTO, null, E()));

    if (resultado.exito) {
      galeriaSeleccionActual = null;
      await poblarCatalogoImagenes();
      marcarEstado(`Imagen "${key}" borrada de la galería.`, 'ok', E());
    } else {
      marcarEstado('No se pudo borrar la imagen: ' + describirError(resultado.error), 'error', E());
    }
  }

  // ===================================================
  // Galería: recuadro de Animaciones (moods de ojos, etc.)
  // Mismo patrón que las imágenes de arriba, pero más simple: no hay
  // umbral/dithering que reajustar -- una animación es un conjunto de
  // cuadros ya armado, se elige tal cual está o no se elige. Se agregan
  // desde carga-masiva.html, no desde acá.
  // ===================================================
  // Firebase Realtime Database guarda los arrays como objetos con claves
  // "0","1","2",... y SOLO los devuelve como array de JS si esas claves
  // son consecutivas empezando en 0. Si algún cuadro se perdió al guardar
  // (índice con hueco), o si el objeto llega de cualquier otra forma no
  // estrictamente secuencial, "cuadros" vuelve como un objeto plano en
  // vez de array -- y entry.cuadros.length da "undefined" en vez de un
  // número, lo que rompía el chequeo de "vacío" y la animación
  // directamente desaparecía de la grilla sin ningún error visible.
  // Esto reconstruye el array ordenando por índice numérico, sea cual
  // sea la forma en la que haya llegado.
  function normalizarCuadros(cuadros) {
    if (!cuadros) return [];
    if (Array.isArray(cuadros)) return cuadros;
    if (typeof cuadros === 'object') {
      return Object.keys(cuadros)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => cuadros[k])
        .filter(Boolean);
    }
    return [];
  }

  // Ver poblarCatalogoImagenes(): mismo criterio (se escucha una sola vez).
  async function poblarCatalogoAnimaciones() {
    try {
      if (escuchaAnimaciones) {
        await esperarPrimeraLectura(escuchaAnimaciones);
        renderizarAnimaciones();
        return;
      }
      escuchaAnimaciones = new Promise((resolver) => {
        suscribirAnimaciones((crudo) => {
          aplicarCatalogoAnimaciones(crudo);
          resolver();
        }, () => {
          escuchaAnimaciones = null; // la escucha terminó: la próxima vez se vuelve a intentar
          avisarCatalogoIlegible([E().gridAnimaciones, E().gridGifs], 'No se pudieron leer las animaciones');
          resolver();
        });
      });
      await esperarPrimeraLectura(escuchaAnimaciones);
    } catch (err) {
      console.error('Error cargando catálogo de animaciones:', err);
    }
  }

  // Convierte lo que llegó de Firebase en animacionesCatalogo y lo dibuja.
  function aplicarCatalogoAnimaciones(crudo) {
    try {
      const claves = Object.keys(crudo);
      console.log(`[animaciones] Firebase devolvió ${claves.length} clave(s):`, claves);

      animacionesCatalogo = {};
      claves.forEach((key) => {
        const entry = crudo[key];
        if (!entry) {
          console.warn(`[animaciones] "${key}" vino vacía/null, se omite.`);
          return;
        }
        const cuadros = normalizarCuadros(entry.cuadros);
        if (cuadros.length === 0) {
          console.warn(`[animaciones] "${key}" no tiene cuadros utilizables (forma recibida:`, entry.cuadros, ')');
        }
        animacionesCatalogo[key] = Object.assign({}, entry, { cuadros });
      });

      renderizarAnimaciones();
    } catch (err) {
      console.error('Error cargando catálogo de animaciones:', err);
    }
  }

  // true si la animación del catálogo vino de un GIF (se muestra en la
  // lista GIF de la Galería en vez de en Animaciones).
  function esAnimacionDeGif(entry) {
    return !!(entry && entry.meta && entry.meta.origen === 'gif');
  }

  function renderizarAnimaciones() {
    const gridAnim = E().gridAnimaciones;
    const gridGif = E().gridGifs;
    if (!gridAnim) return;
    gridAnim.innerHTML = '';
    if (gridGif) gridGif.innerHTML = '';

    const claves = Object.keys(animacionesCatalogo);

    // Mensaje de "vacío" en la lista que no tenga nada.
    const ponerVacio = (grid, texto) => {
      if (!grid || grid.children.length > 0) return;
      const vacio = document.createElement('p');
      vacio.className = 'galeria-vacio';
      vacio.textContent = texto;
      grid.appendChild(vacio);
    };

    claves.forEach((key) => {
      const entry = animacionesCatalogo[key];
      if (!entry || !entry.cuadros || entry.cuadros.length === 0) return;
      const grid = (gridGif && esAnimacionDeGif(entry)) ? gridGif : gridAnim;

      const item = document.createElement('div');
      item.className = 'item-galeria';
      item.dataset.clave = key;
      if (estado().tipo === 'animacion' && animacionSeleccionActual === key) {
        item.classList.add('activo');
      }

      // Miniatura: primer cuadro nada más (mismo formato que una imagen
      // normal, así que se reutiliza dibujarPreviewImagen tal cual).
      const canvas = document.createElement('canvas');
      canvas.width = entry.ancho || 128;
      canvas.height = entry.alto || 64;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        dibujarPreviewImagen(canvas, entry.cuadros[0].datos, entry.ancho || 128, entry.alto || 64, '#4dd2ff');
      } catch (e) {
        console.error('Error dibujando miniatura de animación:', e);
      }

      const nombre = document.createElement('span');
      nombre.className = 'item-galeria-nombre';
      nombre.textContent = key;

      item.addEventListener('click', async () => {
        // H-12: con la lista liviana el catálogo trae solo el primer cuadro; los cuadros completos se piden al elegir.
        const turno = ++turnoAnimacion;
        if (entry.parcial) {
          marcarEstado('Cargando…', null, E());
          const crudo = await leerCuadrosAnimacion(key, { predeterminada: !!entry.predeterminada });
          if (turno !== turnoAnimacion) return; // se eligió otra mientras tanto
          const completos = normalizarCuadros(crudo);
          if (completos.length === 0) {
            marcarEstado('No se pudo cargar esa animación. Revisa tu internet y vuelve a intentarlo.', 'error', E());
            return;
          }
          entry.cuadros = completos;
          entry.parcial = false;
        }
        estado().tipo = 'animacion';
        estado().animacion = key;
        estado().animacionAncho = entry.ancho || 128;
        estado().animacionAlto = entry.alto || 64;
        estado().animacionCuadros = entry.cuadros;
        animacionSeleccionActual = key;
        // Lo elegido acá reemplaza a un GIF subido en la pestaña Imagen
        // (comparten animacionCuadros).
        fijarGifActual(null);

        actualizarResaltadoAnimaciones(); // solo mueve el resaltado "activo" (no reconstruye los grids)
        renderizar(); // arranca el preview en bucle en la pantalla de arriba
        actualizarBotonBorrarAnimacion();
        const queEs = esAnimacionDeGif(entry) ? 'GIF' : 'Animación';
        marcarEstado(`${queEs} "${key}" cargado desde la galería`, 'ok', E());
      });

      item.appendChild(canvas);
      item.appendChild(nombre);
      grid.appendChild(item);
    });

    ponerVacio(gridAnim, 'Todavía no hay animaciones guardadas.');
    ponerVacio(gridGif, 'Todavía no hay GIF guardados.');
    actualizarBotonBorrarAnimacion();
  }

  // Igual que actualizarResaltadoGaleria(), para las dos listas (Animaciones y GIF).
  function actualizarResaltadoAnimaciones() {
    [E().gridAnimaciones, E().gridGifs].forEach((grid) => {
      if (!grid) return;
      grid.querySelectorAll('.item-galeria').forEach((item) => {
        item.classList.toggle('activo', estado().tipo === 'animacion' && animacionSeleccionActual === item.dataset.clave);
      });
    });
    actualizarBotonBorrarAnimacion();
  }

  function actualizarBotonBorrarAnimacion() {
    if (!E().botonBorrarAnimacion) return;
    const entrada = animacionSeleccionActual ? animacionesCatalogo[animacionSeleccionActual] : null;
    // Las predeterminadas (de la biblioteca común) las puede borrar solo un administrador.
    E().botonBorrarAnimacion.disabled = !entrada || (!!entrada.predeterminada && !obtenerEsAdmin());
  }

  async function manejarBorrarAnimacionSeleccionada() {
    if (!animacionSeleccionActual) return;

    const key = animacionSeleccionActual;
    const predeterminada = !!(animacionesCatalogo[key] && animacionesCatalogo[key].predeterminada);
    if (predeterminada && !obtenerEsAdmin()) {
      marcarEstado('Esa animación es predeterminada: se puede usar, pero no se puede borrar.', null, E());
      return;
    }
    const pregunta = predeterminada
      ? `¿Borrar "${key}" de las predeterminadas? Dejará de verse en TODAS las cuentas. No se puede deshacer.`
      : `¿Borrar "${key}" de la galería? No se puede deshacer.`;
    if (!confirm(pregunta)) return;
    let resultado = await borrarAnimacionCatalogo(key, { predeterminada });
    resultado = await esperarFinal(resultado, () => marcarEstado(TEXTO_BORRADO_LENTO, null, E()));

    if (resultado.exito) {
      animacionSeleccionActual = null;
      await poblarCatalogoAnimaciones();
      marcarEstado(`Animación "${key}" borrada de la galería.`, 'ok', E());
    } else {
      marcarEstado('No se pudo borrar la animación: ' + describirError(resultado.error), 'error', E());
    }
  }

  // Procesa un archivo nuevo subido desde la sección Galería (usa el par
  // umbral/dithering propio de esta sección) y lo deja listo en el
  // preview para ponerle nombre y guardarlo.
  async function procesarYMostrarImagenGaleria() {
    const file = E().cargadorImagenGaleria.files[0];
    if (!file) return;
    const turno = nuevoTurnoSubida();

    try {
      marcarEstado('Procesando imagen…', null, E());

      comprobarTamanoArchivo(file);

      // GIF animado: queda como animación (se guarda en la lista GIF).
      // Sin encuadre en la Galería: se usa el encuadre por defecto.
      const buffer = await file.arrayBuffer();
      if (subidaObsoleta(turno, enPestanaGaleria)) return;
      let leido = null;
      if (esGif(buffer)) {
        marcarEstado('Leyendo GIF…', null, E());
        leido = leerGif(buffer, OPCIONES_GEOMETRIA_DEFECTO);
      }
      if (leido && leido.grises.length > 1) {
        estado().tipo = 'galeria';
        galeriaSeleccionActual = null;
        fijarImagenOriginal(null);
        fijarImagenFuente(null);
        fijarGifActual({ buffer, leido, nombre: file.name.replace(/\.[^.]+$/, ''), origen: 'galeria' });
        aplicarGif();
        actualizarResaltadoGaleria(); // por si había una entrada seleccionada, sacarle el resaltado
        if (E().nombreGaleriaNueva && !E().nombreGaleriaNueva.value) {
          E().nombreGaleriaNueva.value = obtenerGifActual().nombre;
        }
        return;
      }

      const umbral = parseInt(E().umbralGaleria.value);
      const dithering = E().ditheringGaleria.checked;
      const resultado = await procesarImagen(file, 128, 64, umbral, dithering);
      if (subidaObsoleta(turno, enPestanaGaleria)) return;

      estado().tipo = 'galeria';
      fijarImagenOriginal(null);
      fijarGifActual(null);
      mostrarAvisoPesoGif(E().avisoGaleriaNueva, { nivel: 'ok' });
      aplicarResultadoImagen(resultado);
      actualizarResaltadoGaleria(); // por si había una entrada seleccionada, sacarle el resaltado

      if (E().nombreGaleriaNueva && !E().nombreGaleriaNueva.value) {
        E().nombreGaleriaNueva.value = file.name.replace(/\.[^.]+$/, '');
      }
    } catch (error) {
      console.error('Error procesando imagen:', error);
      marcarEstado(mensajeDeArchivo(error), 'error', E());
    }
  }

  function setAvisoGaleriaNueva(text, tipo = null) {
    mostrarAviso(E().avisoGaleriaNueva, text, tipo);
  }

  // Guarda en el catálogo lo que esté actualmente activo en la sección
  // Galería -- ya sea una imagen recién subida con "Añadir una imagen
  // nueva", o una imagen del catálogo que se acaba de reajustar. Si el
  // nombre coincide con una entrada existente, la reemplaza (mismo
  // comportamiento que guardarImagenCatalogo en firebase.js: la clave es
  // el nombre).
  async function manejarGuardarNuevaEnGaleria() {
    // GIF subido con el +: se guarda en /animaciones con meta.origen "gif".
    if (estado().tipo === 'galeria' && hayGifDe('galeria')) {
      const nombreGif = (E().nombreGaleriaNueva && E().nombreGaleriaNueva.value.trim()) || '';
      if (!nombreGif) {
        setAvisoGaleriaNueva('Pon un nombre para guardar el GIF en la galería.', 'error');
        return;
      }
      setAvisoGaleriaNueva('Guardando…');
      let resultadoGif = await guardarAnimacionCatalogo(
        nombreGif,
        estado().animacionAncho,
        estado().animacionAlto,
        estado().animacionCuadros,
        Object.assign({
          origen: 'gif',
          umbral: parseInt(E().umbralGaleria.value),
          dithering: E().ditheringGaleria.checked,
          fecha: Date.now()
        }, OPCIONES_GEOMETRIA_DEFECTO)
      );
      resultadoGif = await esperarFinal(resultadoGif, () => setAvisoGaleriaNueva(TEXTO_GUARDADO_LENTO));
      if (resultadoGif.exito) {
        await poblarCatalogoAnimaciones();
        setAvisoGaleriaNueva(`GIF guardado en la lista GIF como "${resultadoGif.key}"`);
      } else {
        setAvisoGaleriaNueva('No se pudo guardar: ' + describirError(resultadoGif.error), 'error');
      }
      return;
    }

    if (estado().tipo !== 'galeria' || !estado().imagenData) {
      setAvisoGaleriaNueva('Primero sube una imagen nueva o selecciona una de la galería.', 'error');
      return;
    }

    const nombre = (E().nombreGaleriaNueva && E().nombreGaleriaNueva.value.trim()) || '';
    if (!nombre) {
      setAvisoGaleriaNueva('Pon un nombre para guardar la imagen en la galería.', 'error');
      return;
    }

    setAvisoGaleriaNueva('Guardando…');
    let resultado = await guardarImagenCatalogo(
      nombre,
      estado().imagenData,
      estado().imagenAncho,
      estado().imagenAlto,
      obtenerImagenFuente(),
      {
        origen: 'upload',
        umbral: parseInt(E().umbralGaleria.value),
        dithering: E().ditheringGaleria.checked,
        fecha: Date.now()
      }
    );
    resultado = await esperarFinal(resultado, () => setAvisoGaleriaNueva(TEXTO_GUARDADO_LENTO));

    if (resultado.exito) {
      await poblarCatalogoImagenes();
      setAvisoGaleriaNueva(`Guardada en la galería como "${resultado.key}"`);
    } else {
      setAvisoGaleriaNueva('No se pudo guardar: ' + describirError(resultado.error), 'error');
    }
  }

  // ---- Lo que main.js usa de acá ----
  // Para saber si la animación activa vino de un GIF (lista GIF) y para marcarla al abrir el panel.
  const animacionEsGif = (clave) => esAnimacionDeGif(animacionesCatalogo[clave]);
  function fijarAnimacionSeleccionada(clave) {
    animacionSeleccionActual = clave;
  }

  return {
    poblarCatalogoImagenes, poblarCatalogoAnimaciones, animacionEsGif, fijarAnimacionSeleccionada,
    procesarYMostrarImagenGaleria, manejarGuardarNuevaEnGaleria, manejarBorrarGaleriaSeleccionada, manejarBorrarAnimacionSeleccionada
  };
}
