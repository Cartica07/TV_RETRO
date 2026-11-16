/**main
 * Main Application
 * Orquesta los módulos de renderizado, UI y Firebase.
 */

import { dibujarOLED, medirBloqueTexto, limitarPosicion } from './renderer.js';
import {
  cargarEstado,
  enviarEstado,
  listarCanciones,
  listarImagenes,
  guardarImagenCatalogo,
  listarAnimaciones,
  guardarAnimacionCatalogo,
  describirError,
  usarCuenta,
  reclamarDispositivo
} from './firebase.js';
import {
  procesarImagenDesdeDataURL,
  cargarImagenOriginal,
  procesarImagenConOpciones
} from './imageProcessor.js';
import { esGif, leerGif, construirCuadrosGif, evaluarPesoAnimacion, evaluarPesoComprimido, comprobarTamanoArchivo, ArchivoDemasiadoGrande } from './gif.js';
import { puedeComprimir, comprimirCuadros, notasParaCancion } from './compresion.js';
import { pluginNativo, accionesEnCurso, sinRepetir, esperarFinal, TEXTO_GUARDADO_LENTO, mostrarAviso } from './utilidades.js';
import { crearConexion } from './conexion.js';
import { crearMas, TITULOS_CONFIG } from './mas.js';
import { crearCuentas } from './cuentas.js';
import { crearGaleria } from './galeria.js';
import { crearCanciones } from './canciones.js';
// inoMusical.js (el intérprete de .ino, ~50 KB) solo lo necesita quien importa canciones: se carga en
// importarCanciones() con import() (auditoría 2026-11-15, H-23).
import {
  inicializarDibujo,
  establecerGrosor,
  deshacerTrazo,
  rehacerTrazo,
  limpiarLienzo,
  ponerGoma,
  hayHistorial,
  hayRehistorial,
  obtenerResultadoImagen,
  cancelarTrazoActual
} from './dibujo.js';
import { crearZoomLienzo } from './lienzoZoom.js';
import {
  obtenerElementos,
  poblarControles,
  marcarSegmentoActivo,
  marcarPestanaActual,
  marcarModoPosicion,
  mostrarSubvistaGaleria,
  marcarEstado,
  marcarConexion,
  setBotonEnviarEstado,
  activarLedTransmision,
  desactivarLedTransmision
} from './ui.js';
import { calcularAnchoTexto } from './fonts.js';
import { esFuenteVariable, anchoScrollFuente } from './fuentesTexto.js';

// ===================================================
// Estado Global
// ===================================================
// Estilo de letra por defecto, igual que en la herramienta CancionesMiniTV
// (FreeSans 10 pt = Sans, tamaño 2). Se usa si Firebase no trae config.fuente.
const FUENTE_DEFECTO = 'sans';

let estadoActual = {
  tipo: 'texto',
  texto: 'Hola Mundo',
  tamano: 2,
  alineacion: 'centro',
  alineacionV: 'centro',
  invertido: false,
  modoTexto: 'ajustar',
  fuente: 'sans',      // estilo de letra (config.fuente); por defecto FUENTE_DEFECTO
  // Posición manual del texto (config.manual/x/y): esquina superior
  // izquierda del bloque. Con manual = false se usa la alineación.
  manual: false,
  x: 0,
  y: 0,
  // Dirección del scroll (config.direccion): "h" horizontal (de siempre) o
  // "v" vertical. Solo cuenta con modoTexto = "scroll".
  direccion: 'h',
  imagenData: '',
  imagenAncho: 0,
  imagenAlto: 0,
  // Canción
  cancion: '',
  cancionNotas: [], // [[freq,dur],...]
  cancionRepeticiones: 1,
  // Animación (ver animacion.h en el firmware)
  animacion: '',       // nombre de la animación seleccionada, solo informativo
  animacionAncho: 0,
  animacionAlto: 0,
  animacionCuadros: [] // [{datos: base64 1bpp, dur: ms}, ...]
};

let elementos = null;
let idAnimacionScroll = null;
let scrollX = 128;
let ultimoTs = null;
const VELOCIDAD_SCROLL = 40; // px/segundo
const ANCHO_OLED = 128;

// Catálogo de canciones cargado desde Firebase
let cancionesCatalogo = {};

// "con" = con letra (tipo musical: reemplaza la pantalla);
// "sin" = sin letra (tipo cancion: solo suena, de fondo).
let letraCanciones = 'con';

// dataURL (128×64, ya redimensionado, SIN binarizar) de la imagen que
// está actualmente activa -- puede venir de un archivo recién subido
// (sección Imagen o Galería) o de una imagen del catálogo que se
// guardó con esta info. Mientras exista, el umbral y el dithering se
// pueden reajustar libremente. Si es null (imagen de una versión
// vieja del catálogo, o el estado que trae Firebase al arrancar), los
// controles quedan inertes porque no hay nada que reprocesar.
let imagenFuenteActual = null;

// Galería: qué lista se ve ("imagenes", "animaciones" o "gif"). Es solo
// de presentación: no cambia estadoActual.tipo ni lo que se envía.
let subvistaGaleria = 'imagenes';

// Pestaña Imagen: archivo ORIGINAL subido (sin achicar), para poder
// reconvertirlo al cambiar escala/fondo/giro/volteo sin perder calidad.
// { el, w, h, dataUrl } de cargarImagenOriginal, o null.
let imagenOriginal = null;

// GIF animado subido. { buffer, leido, nombre, origen }:
// "leido" son los cuadros ya acomodados a 128×64 en grises (leerGif);
// se recalcula solo si cambia la geometría. "origen" es la pantalla desde
// la que se subió: "imagen" (pestaña Imagen, con encuadre) o "galeria"
// (botón + de la Galería, sin encuadre). Mientras exista, esa pantalla
// muestra y envía una animación (tipo "animacion").
let gifActual = null;

// true si hay un GIF subido desde esa pantalla ("imagen" o "galeria").
function hayGifDe(origen) {
  return !!gifActual && gifActual.origen === origen;
}

// Opciones de encuadre de la pestaña Imagen (ver acomodarEnDestino).
const geometriaImagen = { escala: 'ajustar', fondo: 'negro', rotar: 0, volteoH: false, volteoV: false };

// Estado de conexión de la TV y acuse de recibo: js/conexion.js (H-13).
const { iniciarMonitoreoConexion, esperarAcuse } = crearConexion({ leerElementos: () => elementos, turnoEnvio: () => turnoEnvio });

// Pestaña Más (menú, Mi cuenta, Ajustes de la TV, Alarma, Jugar): js/mas.js (H-13).
const { obtenerMasVista, obtenerConfigVista, fijarMasVista, volverEnMas, configurarEventosMas } = crearMas({
  leerElementos: () => elementos,
  estado: () => estadoActual,
  sesion: () => obtenerSesion(),
  musicales: () => obtenerMusicales(),
  fijarMusicales: (lista) => fijarMusicales(lista),
  nombreMusical: (clave) => nombreMusical(clave),
  avanzarTurnoEnvio: () => { turnoEnvio++; },
  mostrarResultadoEnvio: (resultado, textoOk) => mostrarResultadoEnvio(resultado, textoOk),
  mostrarSeccionSegunTipo: (tipo) => mostrarSeccionSegunTipo(tipo),
  renderizar: () => renderizar(),
  estaBloqueado: () => panelBloqueado
});

// Cuentas: inicio de sesión, Mi TV, Compartir y Eliminar cuenta: js/cuentas.js (H-13).
const {
  obtenerSesion, obtenerEsAdmin, cargarEsAdmin, entrar, resolverDispositivo, configurarLogin,
  tomarAvisoPostLogin, hayLoginVisible, marcarFalloMientrasLogin, configurarEventosCuentaEnConfig, cerrarCapaCuentas
} = crearCuentas({
  leerElementos: () => elementos,
  // H-27: ESPERA_ARRANQUE_MS después de entrar se libera el panel si un fallo lo dejó bloqueado.
  liberarPanelDespuesDeLogin: () => setTimeout(() => {
    if (panelBloqueado || document.querySelector('main.controles[inert]')) {
      arranqueVigente = false;
      bloquearPanel(false);
    }
  }, ESPERA_ARRANQUE_MS)
});

// Galería (catálogos de imágenes y animaciones): js/galeria.js (H-13). El estado de la pestaña Imagen que comparte
// (fuente editable, original, GIF, turnos) sigue acá y entra por funciones.
const {
  poblarCatalogoImagenes, poblarCatalogoAnimaciones, animacionEsGif, fijarAnimacionSeleccionada,
  procesarYMostrarImagenGaleria, manejarGuardarNuevaEnGaleria, manejarBorrarGaleriaSeleccionada, manejarBorrarAnimacionSeleccionada
} = crearGaleria({
  leerElementos: () => elementos,
  estado: () => estadoActual,
  obtenerEsAdmin: () => obtenerEsAdmin(),
  renderizar: () => renderizar(),
  actualizarControlesEdicionImagen: () => actualizarControlesEdicionImagen(),
  aplicarGif: () => aplicarGif(),
  aplicarResultadoImagen: (resultado) => aplicarResultadoImagen(resultado),
  mostrarAvisoPesoGif: (el, peso) => mostrarAvisoPesoGif(el, peso),
  mensajeDeArchivo: (error) => mensajeDeArchivo(error),
  subidaObsoleta: (turno, sigueEnLaPestana) => subidaObsoleta(turno, sigueEnLaPestana),
  enPestanaGaleria: () => enPestanaGaleria(),
  hayGifDe: (origen) => hayGifDe(origen),
  obtenerImagenFuente: () => imagenFuenteActual,
  fijarImagenFuente: (valor) => { imagenFuenteActual = valor; },
  fijarImagenOriginal: (valor) => { imagenOriginal = valor; },
  obtenerGifActual: () => gifActual,
  fijarGifActual: (valor) => { gifActual = valor; },
  obtenerTurnoReprocesoImagen: () => turnoReprocesoImagen,
  avanzarTurnoReprocesoImagen: () => { turnoReprocesoImagen++; },
  nuevoTurnoSubida: () => ++turnoSubida
});

// Canciones (catálogo musicales/, selector, importar .ino, borrar): js/canciones.js (H-13). letraCanciones (con/sin letra)
// y la vista previa del musical siguen acá.
const {
  poblarCatalogoCanciones, normalizarRepeticiones, setAvisoCancion, importarCanciones, borrarMusicalElegido,
  manejarSeleccionCancion, nombreMusical, obtenerMusicales, fijarMusicales, obtenerMusicalCargado, obtenerCargandoMusical
} = crearCanciones({
  leerElementos: () => elementos,
  estado: () => estadoActual,
  renderizar: () => renderizar(),
  detenerPreviewMusical: () => detenerPreviewMusical()
});


// ===================================================
// Animación del Scroll
// ===================================================
function detenerScroll() {
  if (idAnimacionScroll !== null) {
    cancelAnimationFrame(idAnimacionScroll);
    idAnimacionScroll = null;
  }
}

// Scroll vertical (como el bloque de texto de CancionesMiniTV, pero en
// bucle): 1 s quieto arriba, sube a VELOCIDAD_SCROLL_V px/s hasta que se
// ve la última línea, 1 s quieto al final y vuelve a empezar. Si el texto
// entra entero en la pantalla, no se mueve.
const VELOCIDAD_SCROLL_V = 12;   // px/segundo (vel por defecto de la herramienta)
const PAUSA_INICIO_V_MS = 1000;
const PAUSA_FIN_V_MS = 1000;

// Huella de lo que cambia el dibujo del scroll además de la posición. Si ni
// la posición (en píxeles enteros) ni esto cambiaron, el cuadro nuevo sería
// idéntico al que ya está en pantalla y no hace falta volver a dibujarlo.
function firmaDibujoScroll() {
  const e = estadoActual;
  return [e.texto, e.tamano, e.fuente, e.invertido, e.alineacionV, e.manual, e.y].join('|');
}

function iniciarScrollVertical() {
  detenerScroll();
  const bloque = medirBloqueTexto(estadoActual);
  const distancia = Math.max(0, bloque.alto - 64);
  if (distancia === 0) {
    dibujarOLED(elementos.canvas, estadoActual, 0);
    return;
  }
  const recorridoMs = distancia / VELOCIDAD_SCROLL_V * 1000;
  const cicloMs = PAUSA_INICIO_V_MS + recorridoMs + PAUSA_FIN_V_MS;
  let inicio = null;
  let ultimoDibujado = null; // lo último que se dibujó (posición + firma)

  function frame(ts) {
    if (inicio === null) inicio = ts;
    const t = (ts - inicio) % cicloMs;
    let desplazamiento = 0;
    if (t > PAUSA_INICIO_V_MS) {
      desplazamiento = Math.min(distancia, Math.floor(distancia * (t - PAUSA_INICIO_V_MS) / recorridoMs));
    }
    // Durante las pausas (y entre dos píxeles) el cuadro no cambia: no se redibuja.
    const clave = desplazamiento + '#' + firmaDibujoScroll();
    if (clave !== ultimoDibujado) {
      dibujarOLED(elementos.canvas, estadoActual, desplazamiento);
      ultimoDibujado = clave;
    }
    idAnimacionScroll = requestAnimationFrame(frame);
  }

  idAnimacionScroll = requestAnimationFrame(frame);
}

function iniciarScroll() {
  detenerScroll();
  scrollX = ANCHO_OLED;
  ultimoTs = null;
  let ultimoDibujado = null;   // lo último que se dibujó (posición entera + firma)
  let anchoCalculado = null;   // { clave, valor }: el ancho solo se vuelve a medir si cambia el texto, la letra o el tamaño

  function frame(ts) {
    if (ultimoTs === null) ultimoTs = ts;
    const dt = (ts - ultimoTs) / 1000;
    ultimoTs = ts;

    // Con fuente de ancho variable se mide con sus propios glifos. Medir
    // recorre todo el texto: se hace una vez y se repite solo si cambia.
    const claveAncho = estadoActual.fuente + '|' + estadoActual.tamano + '|' + estadoActual.texto;
    if (!anchoCalculado || anchoCalculado.clave !== claveAncho) {
      anchoCalculado = {
        clave: claveAncho,
        valor: esFuenteVariable(estadoActual.fuente)
          ? anchoScrollFuente(estadoActual)
          : calcularAnchoTexto(estadoActual.texto, estadoActual.tamano)
      };
    }
    const anchoTexto = anchoCalculado.valor;

    scrollX -= VELOCIDAD_SCROLL * dt;
    if (scrollX < -anchoTexto) scrollX = ANCHO_OLED;

    // El renderer redondea la posición a un píxel entero: si sigue siendo el
    // mismo píxel (y nada más cambió), el cuadro sería idéntico. No se redibuja.
    const clave = Math.round(scrollX) + '#' + firmaDibujoScroll();
    if (clave !== ultimoDibujado) {
      dibujarOLED(elementos.canvas, estadoActual, scrollX);
      ultimoDibujado = clave;
    }
    idAnimacionScroll = requestAnimationFrame(frame);
  }

  idAnimacionScroll = requestAnimationFrame(frame);
}

// ===================================================
// Preview de Animaciones (moods de ojos, etc.)
// ===================================================
// A diferencia del scroll (velocidad constante, un solo requestAnimationFrame
// en marcha), acá cada cuadro dura un tiempo distinto (ver animacionCuadros),
// así que se encadena con setTimeout: dibuja el cuadro actual, programa el
// siguiente para dentro de "dur" ms, y así en bucle.
let idAnimacionPreview = null;
let tokenAnimacionPreview = 0;

function detenerAnimacionPreview() {
  if (idAnimacionPreview !== null) {
    clearTimeout(idAnimacionPreview);
    idAnimacionPreview = null;
  }
  // Invalida cualquier setTimeout que ya esté "en vuelo" -- si se
  // cambia de animación o de sección justo antes de que dispare, el
  // callback viejo se da cuenta de que ya no es el token vigente y no
  // hace nada, en vez de seguir animando algo que ya no corresponde.
  tokenAnimacionPreview++;
}

function iniciarAnimacionPreview() {
  detenerAnimacionPreview();

  const cuadros = estadoActual.animacionCuadros;
  if (!cuadros || cuadros.length === 0) return;

  const miToken = tokenAnimacionPreview;
  let i = 0;

  function paso() {
    if (miToken !== tokenAnimacionPreview) return;

    const cuadro = cuadros[i];
    dibujarOLED(elementos.canvas, Object.assign({}, estadoActual, {
      tipo: 'imagen',
      imagenData: cuadro.datos,
      imagenAncho: estadoActual.animacionAncho,
      imagenAlto: estadoActual.animacionAlto
    }));

    i = (i + 1) % cuadros.length;
    idAnimacionPreview = setTimeout(paso, cuadro.dur);
  }

  paso();
}

// ===================================================
// Vista previa de una canción con letra (grabación de un .ino): cada
// cuadro aparece en su milisegundo, igual que en la TV. Si el .ino se
// repetía, vuelve a empezar; si no, se queda en la última imagen.
// ===================================================
let idPreviewMusical = null;
let tokenPreviewMusical = 0;
// Lo que mostraba la OLED antes de la vista previa con letra: al pasar a
// "Sin letra" se vuelve a mostrar, porque sin letra la pantalla no cambia.
let pantallaAntesDelMusical = null;
const base64DeBitmap = new WeakMap();

function bitmapABase64(bitmap) {
  let b64 = base64DeBitmap.get(bitmap);
  if (!b64) {
    let s = '';
    for (let i = 0; i < bitmap.length; i++) s += String.fromCharCode(bitmap[i]);
    b64 = btoa(s);
    base64DeBitmap.set(bitmap, b64);
  }
  return b64;
}

function detenerPreviewMusical() {
  if (idPreviewMusical !== null) {
    clearTimeout(idPreviewMusical);
    idPreviewMusical = null;
  }
  tokenPreviewMusical++;
}

function guardarPantallaAntesDelMusical() {
  if (pantallaAntesDelMusical) return;
  const c = elementos.canvas;
  try { pantallaAntesDelMusical = c.getContext('2d').getImageData(0, 0, c.width, c.height); } catch (_) { pantallaAntesDelMusical = null; }
}

function restaurarPantallaAntesDelMusical() {
  if (!pantallaAntesDelMusical) return;
  const c = elementos.canvas;
  if (c.width === pantallaAntesDelMusical.width && c.height === pantallaAntesDelMusical.height) {
    c.getContext('2d').putImageData(pantallaAntesDelMusical, 0, 0);
  }
  pantallaAntesDelMusical = null;
}

function iniciarPreviewMusical(grab) {
  detenerPreviewMusical();
  if (!grab || !grab.cuadros || grab.cuadros.length === 0) return;
  guardarPantallaAntesDelMusical();

  const miToken = tokenPreviewMusical;
  const inicio = performance.now();
  const duracion = Math.max(1, grab.duracion);
  let dibujado = -1;

  function paso() {
    if (miToken !== tokenPreviewMusical) return;
    let t = performance.now() - inicio;
    if (grab.repetir) t %= duracion;
    else t = Math.min(t, duracion);

    // Último cuadro con t <= ahora.
    let k = 0;
    while (k + 1 < grab.cuadros.length && grab.cuadros[k + 1].t <= t) k++;

    if (k !== dibujado) {
      dibujado = k;
      dibujarOLED(elementos.canvas, Object.assign({}, estadoActual, {
        tipo: 'imagen',
        invertido: false,
        imagenData: bitmapABase64(grab.cuadros[k].bitmap),
        imagenAncho: 128,
        imagenAlto: 64
      }));
    }

    if (!grab.repetir && t >= duracion) return; // terminó: queda la última imagen
    const siguiente = k + 1 < grab.cuadros.length ? grab.cuadros[k + 1].t : duracion;
    idPreviewMusical = setTimeout(paso, Math.max(10, Math.min(250, siguiente - t)));
  }

  paso();
}

// ===================================================
// Posición del texto: automática (alineación) o manual (sliders X/Y)
// ===================================================

// Ajusta los sliders X/Y al bloque de texto actual: el máximo es lo que
// entra en la pantalla (128 - ancho, 64 - alto) y la posición guardada se
// recorta si quedó afuera (por ejemplo, al agrandar la letra).
function sincronizarPosicionManual() {
  if (!elementos.posicionX || !elementos.posicionY) return;
  const b = medirBloqueTexto(estadoActual);
  const maxX = Math.max(0, ANCHO_OLED - b.ancho);
  const maxY = Math.max(0, 64 - b.alto);
  if (estadoActual.manual) {
    estadoActual.x = limitarPosicion(estadoActual.x, b.ancho, ANCHO_OLED);
    estadoActual.y = limitarPosicion(estadoActual.y, b.alto, 64);
  }
  elementos.posicionX.max = String(maxX);
  elementos.posicionY.max = String(maxY);
  elementos.posicionX.value = String(estadoActual.x);
  elementos.posicionY.value = String(estadoActual.y);
  if (elementos.valorPosicionX) elementos.valorPosicionX.textContent = String(estadoActual.x);
  if (elementos.valorPosicionY) elementos.valorPosicionY.textContent = String(estadoActual.y);
  // En scroll la X la maneja el desplazamiento: solo se elige la Y.
  elementos.posicionX.disabled = estadoActual.modoTexto === 'scroll';
}

// Pasa a modo automático o manual. Al entrar a manual, arranca desde
// donde estaba el texto con la alineación automática (no salta).
function cambiarModoPosicion(manual) {
  if (manual && !estadoActual.manual) {
    const b = medirBloqueTexto(estadoActual);
    estadoActual.x = b.xAuto;
    estadoActual.y = b.yAuto;
  }
  estadoActual.manual = manual;
  marcarModoPosicion(estadoActual.manual, elementos);
  renderizar();
}

function renderizar() {
  if (estadoActual.tipo === 'texto') sincronizarPosicionManual();

  // "Cancion" no dibuja nada propio: en el dispositivo real, mandar una
  // canción NO toca la pantalla (ver pantalla.cpp -- mostrarPantalla()
  // es un no-op para tipo="cancion"). Sigue mostrando lo que ya había:
  // texto (con scroll incluido), imagen, apagada, o el reloj. Acá en el
  // preview hacemos lo mismo: no tocamos el canvas, para que se vea
  // consistente con lo que realmente pasa en la OLED física.
  if (estadoActual.tipo === 'cancion') {
    detenerScroll();
    detenerAnimacionPreview();
    // Con letra, la canción sí cambia la pantalla: se reproduce su
    // grabación (letra, imágenes, GIF) en la vista previa.
    if (letraCanciones === 'con' && obtenerMusicalCargado()) iniciarPreviewMusical(obtenerMusicalCargado().grabacion);
    else {
      detenerPreviewMusical();
      restaurarPantallaAntesDelMusical();
    }
    return;
  }
  detenerPreviewMusical();
  // Las demás pestañas dibujan su propio contenido.
  pantallaAntesDelMusical = null;

  // V1.13: "Dibujo" también refleja en vivo la pantalla virtual
  // principal de arriba, igual que Texto/Imagen -- antes se apoyaba
  // solo en el propio lienzo (#lienzoDibujo) como preview. Se convierte
  // el trazo actual a bitmap y se dibuja arriba con el mismo pipeline
  // que una imagen, sin pisar estadoActual.tipo (sigue siendo "dibujo").
  if (estadoActual.tipo === 'dibujo') {
    detenerScroll();
    detenerAnimacionPreview();
    actualizarPreviewDesdeLienzo();
    return;
  }

  // Imagen: dibuja directo. Galería: mismo bitmap, pero estadoActual.tipo
  // se queda en "galeria" (no salta a "imagen") para que la sección
  // correcta se mantenga visible -- se fuerza tipo:"imagen" solo para
  // este dibujado puntual, igual que se hace al enviar (enviarAFirebase).
  if (estadoActual.tipo === 'imagen') {
    detenerScroll();
    // GIF animado subido en la pestaña Imagen: se reproduce en bucle,
    // igual que una animación de la Galería (mismos animacionCuadros).
    if (hayGifDe('imagen')) {
      iniciarAnimacionPreview();
      return;
    }
    detenerAnimacionPreview();
    dibujarOLED(elementos.canvas, estadoActual);
    return;
  }

  if (estadoActual.tipo === 'galeria') {
    detenerScroll();
    // GIF subido con el + de la Galería: se reproduce en bucle.
    if (hayGifDe('galeria')) {
      iniciarAnimacionPreview();
      return;
    }
    detenerAnimacionPreview();
    dibujarOLED(elementos.canvas, Object.assign({}, estadoActual, { tipo: 'imagen' }));
    return;
  }

  // Animaciones y GIF de la Galería -- se reproduce el bucle completo
  // en la pantalla virtual principal, igual que se ve en la OLED real.
  if (estadoActual.tipo === 'animacion') {
    detenerScroll();
    iniciarAnimacionPreview();
    return;
  }

  // Si es texto y modo scroll, animar
  if (estadoActual.modoTexto === 'scroll') {
    detenerAnimacionPreview();
    if (estadoActual.direccion === 'v') iniciarScrollVertical();
    else iniciarScroll();
  } else {
    detenerScroll();
    detenerAnimacionPreview();
    dibujarOLED(elementos.canvas, estadoActual);
  }
}

// V1.13: convierte el lienzo de dibujo a bitmap y lo pinta en la
// pantalla virtual principal (#oled), igual que hace enviarAFirebase()
// al mandar un dibujo -- pero acá es solo para el preview, no toca
// Firebase. Se throttlea a como mucho una vez por frame: los eventos
// pointermove pueden disparar muchas notificaciones seguidas mientras
// se arrastra, y no tiene sentido reconvertir el canvas más rápido de
// lo que la pantalla puede mostrar.
let previewDibujoPendiente = false;
function actualizarPreviewDesdeLienzo() {
  if (!elementos.lienzoDibujo || previewDibujoPendiente) return;
  previewDibujoPendiente = true;

  requestAnimationFrame(() => {
    previewDibujoPendiente = false;
    // Pudo cambiar de pestaña mientras se esperaba el frame.
    if (estadoActual.tipo !== 'dibujo') return;

    // Sin PNG: la vista previa no lo usa y se repite en cada cuadro del trazo.
    const resultado = obtenerResultadoImagen(elementos.lienzoDibujo, false);
    dibujarOLED(elementos.canvas, Object.assign({}, estadoActual, {
      tipo: 'imagen',
      imagenData: resultado.imagenData,
      imagenAncho: resultado.imagenAncho,
      imagenAlto: resultado.imagenAlto
    }));
  });
}

// ===================================================
// Dibujo: lienzo expandido (pantalla completa, horizontal)
// ===================================================
// El modo expandido es solo la clase body.dibujo-expandido: el MISMO
// canvas y la MISMA barra de herramientas pasan a pantalla completa por
// CSS (mismos IDs y listeners). Además, si el navegador lo permite, se
// pide pantalla completa y se bloquea la rotación en horizontal (Chrome
// en Android); si no (iPhone, escritorio), queda igual de grande y en
// vertical se muestra "Girá el teléfono".

let dibujoExpandido = false;
let zoomDibujo = null;              // control de zoom del lienzo (lienzoZoom.js)
let pantallaCompletaPropia = false; // true si la pantalla completa la pidió el panel

async function expandirDibujo() {
  if (dibujoExpandido) return;
  dibujoExpandido = true;
  document.body.classList.add('dibujo-expandido');
  // Para que el botón Atrás de Android contraiga en vez de salir.
  try { history.pushState({ dibujoExpandido: true }, ''); } catch (e) { /* sin historial: no pasa nada */ }

  const orientacionNativa = pluginNativo('ScreenOrientation');
  try {
    if (!orientacionNativa && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      pantallaCompletaPropia = true;
    }
  } catch (e) {
    pantallaCompletaPropia = false; // no permitido (iPhone, permisos): se sigue sin pantalla completa
  }
  try {
    if (orientacionNativa) await orientacionNativa.lock({ orientation: 'landscape' });
    else if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (e) {
    // Bloquear la rotación solo anda en pantalla completa y en algunos
    // navegadores; si no, el CSS se acomoda al girar el teléfono.
  }
}

function contraerDibujo({ desdeHistorial = false } = {}) {
  if (!dibujoExpandido) return;
  dibujoExpandido = false;
  document.body.classList.remove('dibujo-expandido');

  try {
    const orientacionNativa = pluginNativo('ScreenOrientation');
    if (orientacionNativa) orientacionNativa.unlock().catch(() => {});
    else if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) { /* nada */ }
  if (pantallaCompletaPropia && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  pantallaCompletaPropia = false;

  // Si se contrajo con el botón (no con Atrás), se saca el estado que se
  // había apilado al expandir, para que Atrás vuelva a funcionar normal.
  if (!desdeHistorial && history.state && history.state.dibujoExpandido) {
    try { history.back(); } catch (e) { /* nada */ }
  }
}

// Deshabilita Deshacer/Rehacer cuando no hay nada en la pila
// correspondiente (ver hayHistorial/hayRehistorial en dibujo.js).
function actualizarBotonesHistorialDibujo() {
  if (elementos.botonDeshacerDibujo) elementos.botonDeshacerDibujo.disabled = !hayHistorial();
  if (elementos.botonRehacerDibujo) elementos.botonRehacerDibujo.disabled = !hayRehistorial();
}

// ===================================================
// Gestión de Tipo de Contenido
// ===================================================
function mostrarSeccionSegunTipo(tipo) {
  // "animacion" no es una pestaña propia: vive visualmente adentro de
  // la sección Galería (recuadro "Animaciones"), igual que las
  // imágenes seleccionadas se quedan en tipo "galeria" en vez de
  // saltar a "imagen". Para elegir qué sección mostrar, se trata igual
  // que "galeria".
  const tipoSeccion = (tipo === 'animacion') ? 'galeria' : (tipo === 'musical' ? 'cancion' : tipo);

  // Si lo activo es una animación, la Galería abre en esa lista.
  if (tipo === 'animacion') {
    subvistaGaleria = animacionEsGif(estadoActual.animacion) ? 'gif' : 'animaciones';
    // OJO (auditoría 2026-11-15, H-35): acá se forzaba masVista = 'galeria' en CADA llamada, y por eso
    // "volver" y el Atrás de la APK no salían de la Galería con una animación elegida. Ahora solo se
    // fuerza al abrir el panel (cargarEstadoInicial).
  }
  actualizarVistaGaleria();

  marcarSegmentoActivo(elementos.grupoTipo, tipoSeccion);
  marcarPestanaActual(elementos.grupoTipo, tipoSeccion);

  const secciones = {
    texto: elementos.seccionTexto,
    imagen: elementos.seccionImagen,
    cancion: elementos.seccionCancion,
    dibujo: elementos.seccionDibujo,
    galeria: elementos.seccionGaleria
  };

  // La pestaña "Más" (tipo "galeria") abre un menú; cada opción (Galería, Juegos) es su
  // propia pantalla con título y "volver".
  const enMas = tipoSeccion === 'galeria';
  const enMenu = enMas && obtenerMasVista() === 'menu';
  const enJuegos = enMas && obtenerMasVista() === 'juegos';
  const enAlarma = enMas && obtenerMasVista() === 'alarma';
  const enConfig = enMas && obtenerMasVista() === 'config';
  const enGaleria = enMas && obtenerMasVista() === 'galeria';

  Object.keys(secciones).forEach((clave) => {
    const el = secciones[clave];
    if (!el) return;
    const visible = clave === 'galeria' ? enGaleria : clave === tipoSeccion;
    el.style.display = visible ? 'block' : 'none';
  });

  // "Añadir nueva" y "Guardar en la galería" viven en un contenedor
  // aparte (después del switch global Invertido), pero solo deben
  // verse cuando la sección Galería está activa -- se sincronizan acá.
  if (elementos.seccionGaleriaFinal) {
    elementos.seccionGaleriaFinal.style.display = enGaleria ? 'block' : 'none';
  }
  if (elementos.seccionMasSelector) elementos.seccionMasSelector.style.display = enMenu ? 'block' : 'none';
  if (elementos.seccionJuegos) elementos.seccionJuegos.style.display = enJuegos ? 'block' : 'none';
  if (elementos.seccionAlarma) elementos.seccionAlarma.style.display = enAlarma ? 'block' : 'none';
  // Config: la lista de apartados o uno de ellos.
  const apartados = { lista: elementos.seccionConfig, cuenta: elementos.configCuenta, tv: elementos.configTV, ayuda: elementos.configAyuda, legal: elementos.configLegal };
  Object.entries(apartados).forEach(([clave, el]) => {
    if (el) el.style.display = (enConfig && obtenerConfigVista() === clave) ? 'block' : 'none';
  });
  if (elementos.cabeceraMas) {
    elementos.cabeceraMas.style.display = (enMas && !enMenu) ? '' : 'none';
    if (elementos.tituloMas) {
      elementos.tituloMas.textContent = enJuegos ? 'Juegos' : enAlarma ? 'Alarma' : enConfig ? TITULOS_CONFIG[obtenerConfigVista()] : 'Galería';
    }
  }
  // En el menú y en Juegos (cada fila tiene su "Jugar") no se usa el botón general de enviar.
  document.body.classList.toggle('sin-barra-accion', enMas && !enGaleria);

  // "Invertido" no tiene ningún efecto visual mientras suena una
  // canción (la pantalla no cambia con la música), así que no
  // corresponde mostrarlo ahí -- para el resto de los tipos sí aplica.
  // Tampoco en el menú de Más ni en Juegos (no hay nada que invertir).
  if (elementos.filaInvertido) {
    elementos.filaInvertido.style.display = (tipoSeccion === 'cancion' || (enMas && !enGaleria)) ? 'none' : 'flex';
  }
}

function cambiarTipo(nuevoTipo) {
  // "Más" (tipo galeria) siempre abre en su menú de opciones.
  if (nuevoTipo === 'galeria') fijarMasVista('menu');
  estadoActual.tipo = nuevoTipo;
  mostrarSeccionSegunTipo(nuevoTipo);

  // Como en una app: cada pestaña nueva arranca desde arriba, en vez de
  // quedar a mitad de página donde había quedado la anterior.
  if (window.scrollY > 0) window.scrollTo(0, 0);

  // Al entrar a Galería, refrescar ambos catálogos por si se guardó
  // algo desde otra pestaña/dispositivo (o desde carga-masiva.html)
  // mientras tanto.
  if (nuevoTipo === 'galeria') {
    poblarCatalogoImagenes();
    poblarCatalogoAnimaciones();
  }

  renderizar();
}

// ===================================================
// Gestión de Imágenes
// ===================================================

// El umbral y el dithering se pueden reajustar en vivo mientras exista
// una "fuente" editable (imagenFuenteActual): un dataURL 128×64 ya
// redimensionado pero SIN binarizar. Esa fuente puede venir de un
// archivo recién subido (Imagen o Galería), o de una imagen del
// catálogo que se guardó CON esa copia (ver guardarImagenCatalogo). Si
// no hay fuente (subida vieja del catálogo sin "preprocesada"), los
// dos pares de controles (Imagen y Galería) quedan deshabilitados
// porque no hay nada que reprocesar -- sin texto de aviso, la imagen
// sigue siendo perfectamente utilizable tal cual está guardada, solo
// que fija.
function actualizarControlesEdicionImagen() {
  const hayFuente = !!imagenFuenteActual;
  // En la pestaña Imagen también se puede reajustar un GIF subido.
  const hayFuenteImagen = hayFuente || hayGifDe('imagen');

  if (elementos.umbral) elementos.umbral.disabled = !hayFuenteImagen;
  if (elementos.dithering) elementos.dithering.disabled = !hayFuenteImagen;
  // En la Galería, lo mismo con un GIF subido con el botón +.
  const hayFuenteGaleria = hayFuente || hayGifDe('galeria');
  if (elementos.umbralGaleria) elementos.umbralGaleria.disabled = !hayFuenteGaleria;
  if (elementos.ditheringGaleria) elementos.ditheringGaleria.disabled = !hayFuenteGaleria;

  actualizarVistaGaleria();
}

// Galería: muestra solo la lista elegida (Imágenes/Animaciones/GIF) y,
// en Imágenes, los ajustes de umbral/difuminado solo si hay algo editable
// (imagen con copia editable o GIF subido con +).
function actualizarVistaGaleria() {
  mostrarSubvistaGaleria(subvistaGaleria, elementos);
  if (elementos.grupoAjustesGaleria && subvistaGaleria === 'imagenes') {
    elementos.grupoAjustesGaleria.hidden = !(imagenFuenteActual || hayGifDe('galeria'));
  }
}

// Aplica el resultado de procesarImagen/procesarImagenDesdeDataURL al
// estado y al preview, y guarda la copia editable para poder seguir
// reajustando umbral/dithering después.
function aplicarResultadoImagen(resultado) {
  estadoActual.imagenData = resultado.imagenData;
  estadoActual.imagenAncho = resultado.imagenAncho;
  estadoActual.imagenAlto = resultado.imagenAlto;

  if (resultado.preprocesada) {
    imagenFuenteActual = resultado.preprocesada;
  }

  renderizar();
  actualizarControlesEdicionImagen();
  marcarEstado(`Imagen procesada: ${resultado.imagenAncho}×${resultado.imagenAlto}px`, 'ok', elementos);
}

// Pestaña Imagen: convierte la imagen original con el encuadre actual
// (escala/fondo/giro/volteo) + umbral + difuminado.
function aplicarImagenOriginal() {
  if (!imagenOriginal) return;
  const resultado = procesarImagenConOpciones(imagenOriginal, Object.assign({}, geometriaImagen, {
    umbral: parseInt(elementos.umbral.value),
    dithering: elementos.dithering.checked
  }));
  aplicarResultadoImagen(resultado);
}

// Binariza los cuadros del GIF con el umbral/difuminado de la pantalla
// desde la que se subió (Imagen o Galería) y los deja como animación
// lista para mostrar y enviar. Avisa si es pesado para el ESP32.
function aplicarGif() {
  if (!gifActual) return;
  const deGaleria = gifActual.origen === 'galeria';
  const umbralEl = deGaleria ? elementos.umbralGaleria : elementos.umbral;
  const ditheringEl = deGaleria ? elementos.ditheringGaleria : elementos.dithering;
  const anim = construirCuadrosGif(gifActual.leido, parseInt(umbralEl.value), ditheringEl.checked);
  estadoActual.animacion = gifActual.nombre;
  estadoActual.animacionAncho = anim.ancho;
  estadoActual.animacionAlto = anim.alto;
  estadoActual.animacionCuadros = anim.cuadros;
  renderizar();
  actualizarControlesEdicionImagen();

  const totalMs = anim.cuadros.reduce((s, c) => s + c.dur, 0);
  const avisoEl = deGaleria ? elementos.avisoGaleriaNueva : elementos.avisoGaleria;
  const mostrarPeso = (peso, sufijo) => {
    marcarEstado(
      `GIF: ${anim.cuadros.length} cuadros · ${(totalMs / 1000).toFixed(1)} s · ${peso.kb} KB${sufijo}`,
      peso.nivel === 'ok' ? 'ok' : 'error',
      elementos
    );
    mostrarAvisoPesoGif(avisoEl, peso);
  };

  if (!puedeComprimir()) {
    mostrarPeso(evaluarPesoAnimacion(anim.cuadros), '');
    return;
  }

  // Se envía comprimido (js/compresion.js): el peso que importa es el
  // comprimido. Se calcula aparte; si mientras tanto se volvió a procesar
  // el GIF (umbral, encuadre), este resultado ya no corresponde.
  //
  // Mientras se arrastra el slider de umbral llegan muchos cambios seguidos
  // y comprimir todos los cuadros es lo más caro: se espera a que haya
  // ESPERA_PESO_GIF_MS de calma y se calcula una sola vez. La vista previa
  // (arriba) sí se actualiza en cada cambio.
  const turno = ++turnoPesoGif;
  clearTimeout(temporizadorPesoGif);
  temporizadorPesoGif = setTimeout(() => {
    if (turno !== turnoPesoGif) return;
    comprimirCuadros(anim.cuadros)
      .then(z => {
        if (turno !== turnoPesoGif) return;
        mostrarPeso(evaluarPesoComprimido(z.bytes, z.cantidad), ' comprimido');
      })
      .catch(() => {
        if (turno !== turnoPesoGif) return;
        mostrarPeso(evaluarPesoAnimacion(anim.cuadros), '');
      });
  }, ESPERA_PESO_GIF_MS);
}

// Ver aplicarGif(): descarta cálculos de peso que ya quedaron viejos.
let turnoPesoGif = 0;
let temporizadorPesoGif = null;
const ESPERA_PESO_GIF_MS = 150;

// Muestra (o limpia) el aviso de peso del GIF en el recuadro de aviso de
// la pantalla correspondiente: amarillo si es pesado, rojo si es muy pesado.
function mostrarAvisoPesoGif(el, peso) {
  if (!el) return;
  el.classList.remove('error', 'advertencia');
  if (peso.nivel === 'ok') {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.classList.add(peso.nivel === 'muy-pesado' ? 'error' : 'advertencia');
  el.textContent = peso.mensaje;
  el.style.display = 'block';
}

// Pestaña Imagen: reprocesa lo que haya (GIF, imagen original o, si no,
// la copia 128×64 guardada) al mover umbral/difuminado o el encuadre.
function reprocesarPestanaImagen() {
  try {
    if (hayGifDe('imagen')) aplicarGif();
    else if (imagenOriginal) aplicarImagenOriginal();
    else reprocesarImagenFuenteActual(elementos.umbral, elementos.dithering);
  } catch (error) {
    console.error('Error reprocesando:', error);
    marcarEstado(mensajeDeArchivo(error), 'error', elementos);
  }
}

// Pestaña Imagen: cambia el encuadre. Para un GIF hay que volver a leer
// los cuadros (la geometría se aplica antes de pasarlos a grises).
function cambiarGeometriaImagen(cambios) {
  Object.assign(geometriaImagen, cambios);
  marcarControlesEncuadre();
  try {
    if (hayGifDe('imagen')) gifActual.leido = leerGif(gifActual.buffer, geometriaImagen);
  } catch (error) {
    console.error('Error releyendo el GIF:', error);
    marcarEstado(mensajeDeArchivo(error), 'error', elementos);
    return;
  }
  if (hayGifDe('imagen') || imagenOriginal) reprocesarPestanaImagen();
}

// Refleja geometriaImagen en los botones del encuadre.
function marcarControlesEncuadre() {
  if (elementos.escalaImagen) elementos.escalaImagen.value = geometriaImagen.escala;
  if (elementos.botonRotarImagen) {
    elementos.botonRotarImagen.dataset.grados = String(geometriaImagen.rotar);
    elementos.botonRotarImagen.classList.toggle('activo', geometriaImagen.rotar !== 0);
  }
  if (elementos.botonVoltearHImagen) elementos.botonVoltearHImagen.setAttribute('aria-pressed', String(geometriaImagen.volteoH));
  if (elementos.botonVoltearVImagen) elementos.botonVoltearVImagen.setAttribute('aria-pressed', String(geometriaImagen.volteoV));
  if (elementos.botonFondoImagen) {
    const blanco = geometriaImagen.fondo === 'blanco';
    elementos.botonFondoImagen.setAttribute('aria-pressed', String(blanco));
    elementos.botonFondoImagen.title = blanco ? 'Fondo: blanco (toca para negro)' : 'Fondo: negro (toca para blanco)';
  }
}

// Dispara al elegir un archivo nuevo del disco (o al pegar una imagen del
// portapapeles, que llega como Blob sin nombre). Si es un GIF animado
// (más de un cuadro) queda como animación; si no, como imagen fija.
// Las subidas procesan en segundo plano (a veces varios segundos con una
// foto grande). Si mientras tanto el usuario se fue de la pestaña, o subió
// otra cosa, el resultado que llega tarde NO se aplica: el estado de la
// imagen se comparte entre pestañas y pisaría lo que está viendo o va a
// enviar. turnoSubida identifica la subida vigente.
let turnoSubida = 0;
const enPestanaImagen = () => estadoActual.tipo === 'imagen';
const enPestanaGaleria = () => estadoActual.tipo === 'galeria' || estadoActual.tipo === 'animacion';

// Devuelve true si el resultado de la subida `turno` ya no corresponde y hay
// que descartarlo. Si el usuario solo se fue de la pestaña (no hay otra
// subida más nueva) se limpia el "Procesando…" que quedó en el estado.
function subidaObsoleta(turno, sigueEnLaPestana) {
  if (turno !== turnoSubida) return true; // hay una subida más nueva: ella maneja el estado
  if (!sigueEnLaPestana()) {
    marcarEstado('', null, elementos);
    return true;
  }
  return false;
}

async function procesarYMostrarImagen(archivo = elementos.cargadorImagen.files[0], nombreSugerido = '') {
  const file = archivo;
  if (!file) return;
  const turno = ++turnoSubida;

  try {
    marcarEstado('Procesando imagen…', null, elementos);

    comprobarTamanoArchivo(file);
    const nombreBase = (file.name || nombreSugerido || 'imagen').replace(/\.[^.]+$/, '');
    const buffer = await file.arrayBuffer();
    if (subidaObsoleta(turno, enPestanaImagen)) return;
    let leido = null;
    if (esGif(buffer)) {
      marcarEstado('Leyendo GIF…', null, elementos);
      leido = leerGif(buffer, geometriaImagen);
    }

    if (leido && leido.grises.length > 1) {
      imagenOriginal = null;
      imagenFuenteActual = null;
      gifActual = { buffer, leido, nombre: nombreBase, origen: 'imagen' };
      aplicarGif();
    } else {
      gifActual = null;
      mostrarAvisoPesoGif(elementos.avisoGaleria, { nivel: 'ok' });
      const original = await cargarImagenOriginal(file);
      if (subidaObsoleta(turno, enPestanaImagen)) return;
      imagenOriginal = original;
      aplicarImagenOriginal();
    }

    // Sugerir un nombre para el catálogo basado en el archivo, pero SIN
    // guardar nada todavía -- eso solo pasa si el usuario toca el botón
    // "Añadir imagen al catálogo" a propósito.
    if (elementos.nombreGaleria && !elementos.nombreGaleria.value) {
      elementos.nombreGaleria.value = nombreBase;
    }
  } catch (error) {
    console.error('Error procesando imagen:', error);
    marcarEstado(mensajeDeArchivo(error), 'error', elementos);
  }
}

// ---------------------------------------------------
// Pegar una imagen del portapapeles (pestaña Imagen)
// ---------------------------------------------------
// Nombre para una imagen pegada: "pegada-HHMMSS".
function nombreImagenPegada() {
  const f = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `pegada-${dos(f.getHours())}${dos(f.getMinutes())}${dos(f.getSeconds())}`;
}

// Botón Pegar: lee el portapapeles con la Async Clipboard API. El
// navegador pide permiso la primera vez (Chrome/Edge, también en
// Android). Si no está disponible (Firefox, WebView de Android sin
// soporte) o se niega el permiso, avisa y sugiere las otras opciones.
async function pegarImagenDelPortapapeles() {
  // En la APK el WebView no deja leer el portapapeles: se usa el plugin propio
  // PortapapelesImagen (android/.../PortapapelesImagenPlugin.java).
  const portapapelesNativo = pluginNativo('PortapapelesImagen');
  if (portapapelesNativo) {
    try {
      const r = await portapapelesNativo.leer();
      if (!r || !r.hayImagen) {
        marcarEstado('El portapapeles no tiene una imagen. Copia una imagen y vuelve a tocar Pegar.', 'error', elementos);
        return;
      }
      const bytes = Uint8Array.from(atob(r.datos), (c) => c.charCodeAt(0));
      await procesarYMostrarImagen(new Blob([bytes], { type: r.tipo }), nombreImagenPegada());
    } catch (error) {
      console.error('No se pudo leer el portapapeles (app):', error);
      marcarEstado('No se pudo leer el portapapeles. Elige el archivo.', 'error', elementos);
    }
    return;
  }
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    marcarEstado('Este navegador no deja leer imágenes del portapapeles. Prueba Ctrl+V o elige el archivo.', 'error', elementos);
    return;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const tipo = item.types.find((t) => t.startsWith('image/'));
      if (tipo) {
        const blob = await item.getType(tipo);
        await procesarYMostrarImagen(blob, nombreImagenPegada());
        return;
      }
    }
    marcarEstado('El portapapeles no tiene una imagen. Copia una imagen y vuelve a tocar Pegar.', 'error', elementos);
  } catch (error) {
    console.error('No se pudo leer el portapapeles:', error);
    const denegado = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    marcarEstado(
      denegado
        ? 'Sin permiso para leer el portapapeles. Permítelo en el navegador, o usa Ctrl+V o elige el archivo.'
        : 'No se pudo leer el portapapeles. Prueba Ctrl+V o elige el archivo.',
      'error',
      elementos
    );
  }
}

// Ctrl+V / Cmd+V (o "Pegar" del menú del navegador) con la pestaña
// Imagen abierta: no necesita permiso. No interfiere si se está
// escribiendo en un campo de texto.
function manejarEventoPegar(e) {
  if (panelBloqueado || estadoActual.tipo !== 'imagen') return;
  const destino = e.target;
  if (destino && (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA' || destino.isContentEditable)) return;
  const datos = e.clipboardData;
  if (!datos) return;
  const archivo = Array.from(datos.files || []).find((f) => f.type.startsWith('image/'))
    || Array.from(datos.items || []).filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).find(Boolean);
  if (!archivo) return;
  e.preventDefault();
  procesarYMostrarImagen(archivo, archivo.name ? '' : nombreImagenPegada());
}

// Dispara al mover cualquiera de los dos sliders de umbral, o
// tildar/destildar cualquiera de los dos switches de dithering (el
// par de la sección Imagen, o el de la sección Galería) -- se le pasa
// explícitamente de cuál par leer, para no mezclar los valores de una
// sección con el resultado de la otra.
// Sube en 1 con cada reproceso: si al terminar ya hay uno más nuevo, o la
// imagen activa cambió (se eligió otra de la galería, se subió otra), el
// resultado viejo se descarta en vez de pisar lo que se está viendo.
let turnoReprocesoImagen = 0;

async function reprocesarImagenFuenteActual(umbralEl, ditheringEl) {
  if (!imagenFuenteActual) return;
  const turno = ++turnoReprocesoImagen;
  const fuente = imagenFuenteActual;

  try {
    marcarEstado('Procesando imagen…', null, elementos);

    const umbral = parseInt(umbralEl.value);
    const dithering = ditheringEl.checked;
    const resultado = await procesarImagenDesdeDataURL(fuente, 128, 64, umbral, dithering);
    if (turno !== turnoReprocesoImagen || fuente !== imagenFuenteActual) return;

    aplicarResultadoImagen(resultado);
  } catch (error) {
    console.error('Error reprocesando imagen:', error);
    marcarEstado(mensajeDeArchivo(error), 'error', elementos);
  }
}

// Guarda en el catálogo (/imagenes) la imagen que está actualmente
// procesada y visible en el preview. Acción explícita del usuario,
// separada de "subir imagen para el dispositivo": no todo lo que se
// sube queda guardado, solo lo que se decide agregar acá. Guarda
// también la copia editable (imagenFuenteActual) y los valores de
// umbral/dithering usados, para poder reajustarla más adelante.
async function manejarGuardarEnGaleria() {
  const nombre = (elementos.nombreGaleria && elementos.nombreGaleria.value.trim()) || '';

  // GIF animado: se guarda en /animaciones (mismo formato que las
  // animaciones de carga-masiva) marcado con meta.origen = "gif", que es
  // lo que lo hace aparecer en la lista GIF de la Galería.
  if (estadoActual.tipo === 'imagen' && hayGifDe('imagen')) {
    if (!nombre) {
      setAvisoGaleria('Pon un nombre para guardar el GIF en la galería.', 'error');
      return;
    }
    setAvisoGaleria('Guardando…');
    let resultadoGif = await guardarAnimacionCatalogo(
      nombre,
      estadoActual.animacionAncho,
      estadoActual.animacionAlto,
      estadoActual.animacionCuadros,
      Object.assign({
        origen: 'gif',
        umbral: parseInt(elementos.umbral.value),
        dithering: elementos.dithering.checked,
        fecha: Date.now()
      }, geometriaImagen)
    );
    resultadoGif = await esperarFinal(resultadoGif, () => setAvisoGaleria(TEXTO_GUARDADO_LENTO));
    if (resultadoGif.exito) {
      await poblarCatalogoAnimaciones();
      setAvisoGaleria(`GIF guardado en la galería como "${resultadoGif.key}"`);
    } else {
      setAvisoGaleria('No se pudo guardar: ' + describirError(resultadoGif.error), 'error');
    }
    return;
  }

  if (estadoActual.tipo !== 'imagen' || !estadoActual.imagenData) {
    setAvisoGaleria('Primero sube y procesa una imagen para poder guardarla.', 'error');
    return;
  }

  if (!nombre) {
    setAvisoGaleria('Pon un nombre para guardar la imagen en la galería.', 'error');
    return;
  }

  setAvisoGaleria('Guardando…');
  let resultado = await guardarImagenCatalogo(
    nombre,
    estadoActual.imagenData,
    estadoActual.imagenAncho,
    estadoActual.imagenAlto,
    imagenFuenteActual,
    Object.assign({
      origen: 'upload',
      umbral: parseInt(elementos.umbral.value),
      dithering: elementos.dithering.checked,
      fecha: Date.now()
    }, imagenOriginal ? geometriaImagen : {})
  );
  resultado = await esperarFinal(resultado, () => setAvisoGaleria(TEXTO_GUARDADO_LENTO));

  if (resultado.exito) {
    await poblarCatalogoImagenes();
    setAvisoGaleria(`Guardada en la galería como "${resultado.key}"`);
  } else {
    setAvisoGaleria('No se pudo guardar: ' + describirError(resultado.error), 'error');
  }
}

// Mensaje para el cliente cuando un archivo subido no se puede procesar.
// El detalle técnico queda en la consola (console.error en quien llama).
function mensajeDeArchivo(error) {
  if (error instanceof ArchivoDemasiadoGrande || (error && error.name === 'ImagenDemasiadoGrande')) return error.message;
  if (/GIF/i.test(String((error && error.message) || ''))) return 'No se pudo leer ese GIF. Prueba con otro.';
  return 'No se pudo leer ese archivo como imagen. Prueba con un PNG, JPG o GIF.';
}


function setAvisoGaleria(text, tipo = null) {
  mostrarAviso(elementos.avisoGaleria, text, tipo);
}

// ===================================================
// V1.12: Dibujo -- guardar en el mismo catálogo de imágenes
// ===================================================
function setAvisoGaleriaDibujo(text, tipo = null) {
  mostrarAviso(elementos.avisoGaleriaDibujo, text, tipo);
}

// Guarda el dibujo actual en el catálogo /imagenes -- el mismo que usa
// la sección Imagen. Convierte el lienzo a bitmap en el momento (no
// depende de que el usuario haya tocado "Enviar" antes).
async function manejarGuardarDibujoEnGaleria() {
  const nombre = (elementos.nombreGaleriaDibujo && elementos.nombreGaleriaDibujo.value.trim()) || '';
  if (!nombre) {
    setAvisoGaleriaDibujo('Pon un nombre para guardar el dibujo en la galería.', 'error');
    return;
  }

  setAvisoGaleriaDibujo('Guardando…');

  const resultado_imagen = obtenerResultadoImagen(elementos.lienzoDibujo);

  let resultado = await guardarImagenCatalogo(
    nombre,
    resultado_imagen.imagenData,
    resultado_imagen.imagenAncho,
    resultado_imagen.imagenAlto,
    resultado_imagen.preprocesada,
    { origen: 'dibujo', fecha: Date.now() }
  );
  resultado = await esperarFinal(resultado, () => setAvisoGaleriaDibujo(TEXTO_GUARDADO_LENTO));

  if (resultado.exito) {
    await poblarCatalogoImagenes();
    setAvisoGaleriaDibujo(`Guardado en la galería como "${resultado.key}"`);
  } else {
    setAvisoGaleriaDibujo('No se pudo guardar: ' + describirError(resultado.error), 'error');
  }
}

// ===================================================
// Event Listeners de Controles
// ===================================================
function configurarEventos() {
  // Selector de tipo
  elementos.grupoTipo.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    cambiarTipo(btn.dataset.valor);
  });

  // Texto
  elementos.texto.addEventListener('input', () => {
    estadoActual.texto = elementos.texto.value;
    elementos.contador.textContent = String(elementos.texto.value.length);
    renderizar();
  });

  // Invertido
  elementos.invertido.addEventListener('change', () => {
    estadoActual.invertido = elementos.invertido.checked;
    renderizar();
  });

  // Tamaño
  elementos.grupoTamano.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    estadoActual.tamano = Number(btn.dataset.valor);
    marcarSegmentoActivo(elementos.grupoTamano, estadoActual.tamano);
    renderizar();
  });

  // Alineación
  elementos.grupoAlineacion.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    estadoActual.alineacion = btn.dataset.valor;
    marcarSegmentoActivo(elementos.grupoAlineacion, estadoActual.alineacion);
    renderizar();
  });

  // Alineación vertical
  elementos.grupoAlineacionV.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    estadoActual.alineacionV = btn.dataset.valor;
    marcarSegmentoActivo(elementos.grupoAlineacionV, estadoActual.alineacionV);
    renderizar();
  });

  // Modo de texto
  // Posición: Auto / Manual y sliders X / Y
  if (elementos.grupoPosicion) {
    elementos.grupoPosicion.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-valor]');
      if (!btn) return;
      cambiarModoPosicion(btn.dataset.valor === 'manual');
    });
  }
  if (elementos.posicionX) {
    elementos.posicionX.addEventListener('input', () => {
      estadoActual.x = Number(elementos.posicionX.value) || 0;
      renderizar();
    });
  }
  if (elementos.posicionY) {
    elementos.posicionY.addEventListener('input', () => {
      estadoActual.y = Number(elementos.posicionY.value) || 0;
      renderizar();
    });
  }

  // Estilo de letra (config.fuente)
  if (elementos.fuenteTexto) {
    elementos.fuenteTexto.addEventListener('change', () => {
      estadoActual.fuente = elementos.fuenteTexto.value || 'clasica';
      renderizar();
    });
  }

  elementos.grupoModo.addEventListener('change', (e) => {
    if (e.target.name !== 'modoTexto') return;
    // "scrollv" es solo de la interfaz: en los datos es modoTexto "scroll"
    // con direccion "v" (así un firmware viejo hace el scroll de siempre).
    if (e.target.value === 'scrollv') {
      estadoActual.modoTexto = 'scroll';
      estadoActual.direccion = 'v';
    } else {
      estadoActual.modoTexto = e.target.value;
      estadoActual.direccion = 'h';
    }
    renderizar();
  });

  // Cargador de imagen: solo procesa y muestra el preview. Guardar en
  // el catálogo es una acción aparte (botón "Añadir imagen al catálogo").
  // Después de tomar el archivo se limpia el campo: si el cliente elige el
  // MISMO archivo otra vez (para reintentar), el navegador no avisa de cambios
  // cuando el valor no cambió y parecería que no pasa nada.
  elementos.cargadorImagen.addEventListener('change', () => {
    procesarYMostrarImagen(); // toma files[0] al empezar, antes de limpiar
    elementos.cargadorImagen.value = '';
  });

  // Pegar imagen del portapapeles: botón Pegar y Ctrl+V en la pestaña Imagen.
  if (elementos.botonPegarImagen) {
    elementos.botonPegarImagen.addEventListener('click', pegarImagenDelPortapapeles);
  }
  document.addEventListener('paste', manejarEventoPegar);

  // Umbral de binarización (sección Imagen)
  elementos.umbral.addEventListener('input', (e) => {
    elementos.valorUmbral.textContent = e.target.value;
    reprocesarPestanaImagen();
  });

  // Difuminado (Atkinson) vs umbral simple (sección Imagen)
  elementos.dithering.addEventListener('change', () => {
    reprocesarPestanaImagen();
  });

  // Encuadre (sección Imagen): escala, rotar, voltear, fondo.
  if (elementos.escalaImagen) {
    elementos.escalaImagen.addEventListener('change', () => {
      cambiarGeometriaImagen({ escala: elementos.escalaImagen.value });
    });
  }
  if (elementos.botonRotarImagen) {
    elementos.botonRotarImagen.addEventListener('click', () => {
      cambiarGeometriaImagen({ rotar: (geometriaImagen.rotar + 90) % 360 });
    });
  }
  if (elementos.botonVoltearHImagen) {
    elementos.botonVoltearHImagen.addEventListener('click', () => {
      cambiarGeometriaImagen({ volteoH: !geometriaImagen.volteoH });
    });
  }
  if (elementos.botonVoltearVImagen) {
    elementos.botonVoltearVImagen.addEventListener('click', () => {
      cambiarGeometriaImagen({ volteoV: !geometriaImagen.volteoV });
    });
  }
  if (elementos.botonFondoImagen) {
    elementos.botonFondoImagen.addEventListener('click', () => {
      cambiarGeometriaImagen({ fondo: geometriaImagen.fondo === 'blanco' ? 'negro' : 'blanco' });
    });
  }

  // Guardar la imagen actualmente procesada en el catálogo
  if (elementos.botonGuardarGaleria) {
    elementos.botonGuardarGaleria.addEventListener('click', () => sinRepetir('guardar-imagen', elementos.botonGuardarGaleria, manejarGuardarEnGaleria));
  }

  // V1.13: sección Galería -- añadir imagen nueva, reajustar la
  // seleccionada (mismo par umbral/dithering, pero el de esta sección).
  if (elementos.cargadorImagenGaleria) {
    elementos.cargadorImagenGaleria.addEventListener('change', () => {
      procesarYMostrarImagenGaleria(); // toma files[0] al empezar, antes de limpiar
      elementos.cargadorImagenGaleria.value = '';
    });
  }
  if (elementos.umbralGaleria) {
    elementos.umbralGaleria.addEventListener('input', (e) => {
      elementos.valorUmbralGaleria.textContent = e.target.value;
      if (hayGifDe('galeria')) aplicarGif();
      else reprocesarImagenFuenteActual(elementos.umbralGaleria, elementos.ditheringGaleria);
    });
  }
  if (elementos.ditheringGaleria) {
    elementos.ditheringGaleria.addEventListener('change', () => {
      if (hayGifDe('galeria')) aplicarGif();
      else reprocesarImagenFuenteActual(elementos.umbralGaleria, elementos.ditheringGaleria);
    });
  }
  if (elementos.botonGuardarGaleriaNueva) {
    elementos.botonGuardarGaleriaNueva.addEventListener('click', () => sinRepetir('guardar-galeria', elementos.botonGuardarGaleriaNueva, manejarGuardarNuevaEnGaleria));
  }
  if (elementos.botonBorrarGaleria) {
    elementos.botonBorrarGaleria.addEventListener('click', () => sinRepetir('borrar-galeria', null, manejarBorrarGaleriaSeleccionada));
  }
  if (elementos.botonBorrarAnimacion) {
    elementos.botonBorrarAnimacion.addEventListener('click', () => sinRepetir('borrar-animacion', null, manejarBorrarAnimacionSeleccionada));
  }

  // Galería: selector Imágenes / Animaciones (solo presentación).
  if (elementos.grupoSubvistaGaleria) {
    elementos.grupoSubvistaGaleria.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-subvista]');
      if (!btn) return;
      subvistaGaleria = btn.dataset.subvista;
      actualizarVistaGaleria();
    });
  }

  configurarEventosMas();
  configurarEventosCuentaEnConfig();

  // V1.12: Dibujo -- grosor, deshacer, limpiar, guardar en catálogo
  if (elementos.grupoGrosor) {
    elementos.grupoGrosor.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const px = Number(btn.dataset.valor);
      establecerGrosor(px);
      marcarSegmentoActivo(elementos.grupoGrosor, btn.dataset.valor);
    });
  }
  if (elementos.botonDeshacerDibujo) {
    elementos.botonDeshacerDibujo.addEventListener('click', () => {
      if (!deshacerTrazo()) {
        marcarEstado('No hay nada más para deshacer.', null, elementos);
      } else {
        actualizarPreviewDesdeLienzo();
      }
      actualizarBotonesHistorialDibujo();
    });
  }
  if (elementos.botonRehacerDibujo) {
    elementos.botonRehacerDibujo.addEventListener('click', () => {
      if (!rehacerTrazo()) {
        marcarEstado('No hay nada más para rehacer.', null, elementos);
      } else {
        actualizarPreviewDesdeLienzo();
      }
      actualizarBotonesHistorialDibujo();
    });
  }
  // Goma (H-16): alterna entre lápiz y goma; el botón queda marcado mientras la goma está activa.
  if (elementos.botonGomaDibujo) {
    elementos.botonGomaDibujo.addEventListener('click', () => {
      const activa = elementos.botonGomaDibujo.getAttribute('aria-pressed') !== 'true';
      elementos.botonGomaDibujo.setAttribute('aria-pressed', activa ? 'true' : 'false');
      ponerGoma(activa);
    });
  }
  if (elementos.botonLimpiarDibujo) {
    elementos.botonLimpiarDibujo.addEventListener('click', () => {
      limpiarLienzo(elementos.lienzoDibujo);
      actualizarPreviewDesdeLienzo();
      actualizarBotonesHistorialDibujo();
    });
  }
  if (elementos.botonGuardarGaleriaDibujo) {
    elementos.botonGuardarGaleriaDibujo.addEventListener('click', () => sinRepetir('guardar-dibujo', elementos.botonGuardarGaleriaDibujo, manejarGuardarDibujoEnGaleria));
  }

  // Dibujo: expandir / contraer el lienzo.
  if (elementos.botonExpandirDibujo) {
    elementos.botonExpandirDibujo.addEventListener('click', expandirDibujo);
  }
  if (elementos.botonContraerDibujo) {
    elementos.botonContraerDibujo.addEventListener('click', () => contraerDibujo());
  }
  if (elementos.botonEnviarDibujoExpandido) {
    elementos.botonEnviarDibujoExpandido.addEventListener('click', enviarDesdeDibujoExpandido);
  }
  if (elementos.botonZoomMasDibujo) {
    elementos.botonZoomMasDibujo.addEventListener('click', () => { if (zoomDibujo) zoomDibujo.acercar(); });
  }
  if (elementos.botonZoomMenosDibujo) {
    elementos.botonZoomMenosDibujo.addEventListener('click', () => { if (zoomDibujo) zoomDibujo.alejar(); });
  }
  // "Atrás" de Android (o del navegador) con el lienzo expandido: contrae
  // en vez de salir de la página (se apiló un estado al expandir).
  window.addEventListener('popstate', () => {
    if (dibujoExpandido) contraerDibujo({ desdeHistorial: true });
  });
  // Si el usuario sale de la pantalla completa por su cuenta, se contrae.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && dibujoExpandido && pantallaCompletaPropia) contraerDibujo();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dibujoExpandido) contraerDibujo();
  });

  // Enviar
  elementos.botonEnviar.addEventListener('click', enviarAFirebase);

  // Canción: selección
  if (elementos.seleccionCancion) {
    elementos.seleccionCancion.addEventListener('change', manejarSeleccionCancion);
  }
  if (elementos.inputRepeticiones) {
    elementos.inputRepeticiones.addEventListener('input', (e) => {
      estadoActual.cancionRepeticiones = normalizarRepeticiones(e.target.value);
    });
    // Al salir del campo se corrige lo escrito (ej. "0", "-3", "2.5", "500").
    elementos.inputRepeticiones.addEventListener('change', (e) => {
      e.target.value = String(normalizarRepeticiones(e.target.value));
    });
  }

  // Canciones: importar .ino, borrar, Con letra / Sin letra
  if (elementos.cargadorMusical) {
    elementos.cargadorMusical.addEventListener('change', async (e) => {
      // Se copian los archivos y se limpia el campo enseguida: así elegir
      // otra vez el MISMO archivo vuelve a funcionar. Una importación a la
      // vez: si ya hay una en curso, se avisa en vez de mezclarlas.
      const archivos = [...e.target.files];
      e.target.value = '';
      if (accionesEnCurso.has('importar')) {
        setAvisoCancion('Espera: todavía se están importando canciones.');
        return;
      }
      await sinRepetir('importar', null, () => importarCanciones(archivos));
    });
  }
  if (elementos.botonBorrarMusical) {
    elementos.botonBorrarMusical.addEventListener('click', () => sinRepetir('borrar-cancion', null, borrarMusicalElegido));
  }
  if (elementos.grupoLetra) {
    elementos.grupoLetra.addEventListener('click', (e) => {
      const boton = e.target.closest('button[data-valor]');
      if (!boton) return;
      letraCanciones = boton.dataset.valor === 'sin' ? 'sin' : 'con';
      marcarSegmentoActivo(elementos.grupoLetra, letraCanciones);
      renderizar();
    });
  }
}

// ===================================================
// Firebase: Cargar y Enviar
// ===================================================
// Mientras se lee lo que muestra la TV, el panel queda bloqueado (atributo
// "inert": no se puede pulsar, escribir ni enfocar nada). Así nadie puede
// enviar "Hola Mundo" por encima del contenido real ni escribir algo que la
// carga después pise. Dura normalmente menos de 1 s; si Firebase tarda más
// de ESPERA_ARRANQUE_MS se libera y lo que llegue tarde ya no se aplica.
const ESPERA_ARRANQUE_MS = 8000;
const PARTES_BLOQUEABLES = ['main.controles', '.barra-accion', 'nav.nav-inferior', '#filaInvertido'];
let arranqueVigente = true;
let panelBloqueado = false; // los atajos del documento (pegar) también esperan

function bloquearPanel(bloquear) {
  panelBloqueado = bloquear;
  PARTES_BLOQUEABLES.forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.inert = bloquear;
  });
}

async function cargarEstadoInicial() {
  try {
    const resultado = await cargarEstado();
    if (!arranqueVigente) return; // tardó demasiado: el panel ya se liberó

    if (resultado.exito) {
      if (!resultado.vacio) {
        // Hay datos en Firebase
        estadoActual = {
          tipo: resultado.tipo || 'texto',
          texto: resultado.texto,
          tamano: resultado.tamano,
          alineacion: resultado.alineacion,
          alineacionV: resultado.alineacionV || 'centro',
          invertido: resultado.invertido,
          modoTexto: resultado.modoTexto,
          fuente: resultado.fuente || FUENTE_DEFECTO,
          manual: !!resultado.manual,
          x: resultado.x || 0,
          y: resultado.y || 0,
          direccion: resultado.direccion === 'v' ? 'v' : 'h',
          imagenData: resultado.imagenData || '',
          imagenAncho: resultado.imagenAncho || 0,
          imagenAlto: resultado.imagenAlto || 0,
          cancion: resultado.cancionNombre || '',
          cancionRepeticiones: resultado.cancionRepeticiones || 1,
          cancionNotas: [],
          // Si lo último enviado fue una animación o un GIF (tipo
          // "animacion"; cargarEstado ya descomprimió los cuadros z1).
          animacion: resultado.animacionNombre || '',
          animacionAncho: resultado.animacionAncho || 0,
          animacionAlto: resultado.animacionAlto || 0,
          animacionCuadros: resultado.animacionCuadros || []
        };
        // Lo último enviado fue una canción con letra: se abre en Canciones.
        if (resultado.tipo === 'musical') {
          estadoActual.tipo = 'cancion';
          estadoActual.cancion = resultado.musicalNombre || '';
          estadoActual.cancionRepeticiones = resultado.musicalRepeticiones || 1;
          letraCanciones = 'con';
        } else if (resultado.tipo === 'cancion') {
          letraCanciones = 'sin';
        }
        if (elementos.grupoLetra) marcarSegmentoActivo(elementos.grupoLetra, letraCanciones);
      }

      // El estado, los controles y la pestaña se aplican JUNTOS y enseguida,
      // antes de esperar ningún catálogo: así, si el panel se libera por lentitud
      // (ESPERA_ARRANQUE_MS) mientras todavía bajan las canciones o la Galería,
      // lo que se ve y lo que Enviar manda siguen siendo lo mismo.
      poblarControles(estadoActual, elementos);
      if (estadoActual.tipo === 'animacion') {
        fijarAnimacionSeleccionada(estadoActual.animacion || null);
        fijarMasVista('galeria'); // al abrir, la animación activa se ve en la Galería (H-35: solo acá)
      }
      mostrarSeccionSegunTipo(estadoActual.tipo);
      renderizar();
      actualizarControlesEdicionImagen();
      // El LED de conexión ya no se marca acá: refleja el heartbeat del
      // dispositivo (ver iniciarMonitoreoConexion), no si el navegador
      // pudo leer Firebase, que es una cosa completamente distinta.
      // La versión (contador de envíos) no se muestra en la interfaz por
      // ahora: queda en la consola del navegador para depurar.
      if (resultado.vacio) {
        marcarEstado('', null, elementos);
      } else {
        console.info(`[TV RETRO] En la OLED ahora mismo: v${resultado.version}`);
        marcarEstado('', null, elementos);
      }

      // Catálogo de canciones. Las cargas van en paralelo (antes una esperaba
      // a la otra). Los catálogos de la Galería (imágenes y animaciones) solo
      // se cargan al arrancar si el panel abre ahí; si no, se cargan la
      // primera vez que se entra a la pestaña.
      const cargas = [poblarCatalogoCanciones()];
      // Lo último enviado fue una animación o un GIF: el panel abre en la
      // Galería, así que su lista tiene que estar cargada (antes se veía
      // "Todavía no hay animaciones" hasta tocar la pestaña) y la animación
      // enviada, marcada.
      if (estadoActual.tipo === 'animacion') {
        cargas.push(poblarCatalogoImagenes(), poblarCatalogoAnimaciones());
      }
      await Promise.all(cargas);
      // Con el catálogo ya cargado se sabe si la animación es un GIF (lista GIF)
      // o una animación; solo si el cliente sigue ahí (no se fue a otra pestaña).
      if (estadoActual.tipo === 'animacion') mostrarSeccionSegunTipo(estadoActual.tipo);
    } else {
      poblarControles(estadoActual, elementos);
      renderizar();
      marcarConexion('sin conexión', 'error', elementos);
      marcarEstado('No se pudo leer lo que muestra la TV. Revisa tu internet.', 'error', elementos);
    }
  } catch (err) {
    console.error('Error durante carga inicial:', err);
    poblarControles(estadoActual, elementos);
    renderizar();
    marcarConexion('sin conexión', 'error', elementos);
    marcarEstado('No hay conexión a internet.', 'error', elementos);
  }
}

// Mensaje tras un envío exitoso. La versión (contador de envíos) no se
// muestra en la interfaz por ahora: queda en la consola para depurar.
function textoEnviado(version) {
  console.info(`[TV RETRO] Enviado: v${version}`);
  // La TV escucha los cambios por streaming: le llega al instante (antes
  // consultaba cada 10 s, de ahí el viejo "en el próximo chequeo").
  return 'Enviado ✅ Ya va camino a la TV.';
}

// Sube en 1 con cada envío: el aviso de un envío viejo que termina tarde
// (conexión lenta) no pisa el resultado de uno más nuevo.
let turnoEnvio = 0;

// Muestra el resultado de enviarEstado(): enviado, pendiente (la conexión
// está lenta y Firebase lo manda solo cuando vuelva la señal) o el motivo
// del error (sin conexión, sin permiso...).
// true si el último envío terminó bien al instante (lo lee el botón de enviar del
// lienzo expandido para mostrar la palomita).
let ultimoEnvioExitoso = false;

function mostrarResultadoEnvio(resultado, textoOk) {
  const turno = turnoEnvio; // lo sube enviarAFirebase al empezar cada envío
  ultimoEnvioExitoso = !!resultado.exito;
  // textoOk: mensaje propio para envíos que no son contenido (ej. guardar la alarma).
  const mensajeOk = (version) => {
    if (!textoOk) return textoEnviado(version);
    console.info(`[TV RETRO] Enviado: v${version}`);
    return textoOk;
  };
  if (resultado.exito) {
    marcarEstado(mensajeOk(resultado.version), 'ok', elementos);
    esperarAcuse(resultado.version);
    return;
  }
  if (resultado.pendiente && resultado.escritura) {
    marcarEstado('La conexión está lenta: se enviará solo cuando vuelva la señal.', null, elementos);
    resultado.escritura.then((final) => {
      if (turno !== turnoEnvio) return;
      if (final.exito) { marcarEstado(mensajeOk(final.version), 'ok', elementos); esperarAcuse(final.version); }
      else marcarEstado(`No se pudo enviar: ${describirError(final.error)}.`, 'error', elementos);
    });
    return;
  }
  marcarEstado(`No se pudo enviar: ${describirError(resultado.error)}.`, 'error', elementos);
}

// Botón de enviar del lienzo expandido: hace lo mismo que "Enviar a la OLED".
// En modo expandido la línea de estado no se ve, así que si el envío sale bien
// el botón muestra una palomita un momento, y si no (error o conexión lenta) se
// contrae el lienzo para que se lea el aviso.
let temporizadorPalomita = null;
async function enviarDesdeDibujoExpandido() {
  const boton = elementos.botonEnviarDibujoExpandido;
  if (!boton || boton.disabled || elementos.botonEnviar.disabled || panelBloqueado) return;
  boton.disabled = true;
  ultimoEnvioExitoso = false;
  try {
    await enviarAFirebase();
  } finally {
    boton.disabled = false;
  }
  if (ultimoEnvioExitoso) {
    boton.classList.add('enviado');
    clearTimeout(temporizadorPalomita);
    temporizadorPalomita = setTimeout(() => boton.classList.remove('enviado'), 1500);
  } else if (dibujoExpandido) {
    contraerDibujo();
  }
}

async function enviarAFirebase() {
  turnoEnvio++;
  setBotonEnviarEstado(false, elementos);
  marcarEstado('Enviando…', null, elementos);
  activarLedTransmision(elementos);

  try {
    // Dibujo -- se convierte el lienzo a bitmap recién acá, en
    // el momento de enviar (siempre el dibujo más reciente, no una
    // versión vieja cacheada). Importante: se arma un payload TEMPORAL
    // con tipo forzado a "imagen" -- NO se pisa estadoActual.tipo, así
    // el usuario se queda en la pestaña Dibujo después de enviar, en
    // vez de que la UI salte sola a la pestaña Imagen. Para Firebase y
    // la TV esto es indistinguible de una imagen subida normal.
    if (estadoActual.tipo === 'dibujo') {
      const resultado_imagen = obtenerResultadoImagen(elementos.lienzoDibujo, false); // enviar no usa el PNG
      const payloadDibujo = Object.assign({}, estadoActual, {
        tipo: 'imagen',
        imagenData: resultado_imagen.imagenData,
        imagenAncho: resultado_imagen.imagenAncho,
        imagenAlto: resultado_imagen.imagenAlto
      });

      const resultado = await enviarEstado(payloadDibujo);

      mostrarResultadoEnvio(resultado);
      return;
    }

    // GIF subido en la pestaña Imagen: se envía como animación (payload
    // TEMPORAL con tipo "animacion", mismo formato que una animación de
    // la Galería), sin pisar estadoActual.tipo: el usuario se queda en
    // la pestaña Imagen después de enviar.
    if ((estadoActual.tipo === 'imagen' && hayGifDe('imagen')) ||
        (estadoActual.tipo === 'galeria' && hayGifDe('galeria'))) {
      const payloadGif = Object.assign({}, estadoActual, { tipo: 'animacion' });
      const resultado = await enviarEstado(payloadGif);

      mostrarResultadoEnvio(resultado);
      return;
    }

    // V1.13: Galería -- misma idea que Dibujo: payload TEMPORAL con
    // tipo forzado a "imagen", sin pisar estadoActual.tipo, así el
    // usuario se queda en la pestaña Galería después de enviar. La
    // imagen ya está procesada (estadoActual.imagenData), no hace
    // falta reconvertir nada acá.
    if (estadoActual.tipo === 'galeria') {
      const payloadGaleria = Object.assign({}, estadoActual, { tipo: 'imagen' });
      const resultado = await enviarEstado(payloadGaleria);

      mostrarResultadoEnvio(resultado);
      return;
    }

    // Animación -- a diferencia de Dibujo/Galería, acá NO hace
    // falta un payload temporal con tipo forzado: estadoActual.tipo ya
    // es "animacion" de verdad (se fija así al seleccionar una del
    // catálogo, ver renderizarAnimaciones), así que cae directo en el
    // enviarEstado(estadoActual) genérico de más abajo.

    // asegurar que el estadoActual tiene campos de canción cuando corresponda
    let aEnviar = estadoActual;
    if (estadoActual.tipo === 'cancion') {
      if (obtenerCargandoMusical()) {
        marcarEstado('Espera: la canción todavía se está cargando.', null, elementos);
        return;
      }
      if (!estadoActual.cancion || !obtenerMusicalCargado() || obtenerMusicalCargado().clave !== estadoActual.cancion) {
        marcarEstado('Elige una canción.', 'error', elementos);
        return;
      }
      estadoActual.cancionRepeticiones = normalizarRepeticiones(elementos.inputRepeticiones.value);
      elementos.inputRepeticiones.value = String(estadoActual.cancionRepeticiones);
      // Todas las canciones se mandan con las repeticiones que puso el
      // usuario, con letra y sin letra (el ESP32-S3 las respeta siempre).
      const repeticiones = estadoActual.cancionRepeticiones;

      if (letraCanciones === 'con') {
        // Con letra: la grabación entera (tipo "musical"), reemplaza la pantalla.
        aEnviar = Object.assign({}, estadoActual, {
          tipo: 'musical',
          musicalNombre: estadoActual.cancion,
          musicalRepeticiones: repeticiones,
          musicalDatos: obtenerMusicalCargado().datos
        });
      } else {
        // Sin letra: solo las notas, de fondo (tipo "cancion" de siempre).
        estadoActual.cancionNotas = notasParaCancion(obtenerMusicalCargado().grabacion);
        aEnviar = Object.assign({}, estadoActual, { cancionRepeticiones: repeticiones });
      }
    }

    const resultado = await enviarEstado(aEnviar);
    mostrarResultadoEnvio(resultado);
  } catch (err) {
    console.error('Error al enviar:', err);
    marcarEstado('Error desconocido al enviar.', 'error', elementos);
  } finally {
    setBotonEnviarEstado(true, elementos);
    desactivarLedTransmision(elementos);
  }
}

// ===================================================
// Inicialización
// ===================================================
async function inicializar() {
  elementos = obtenerElementos();
  
  poblarControles(estadoActual, elementos);
  renderizar();
  actualizarControlesEdicionImagen();
  marcarConexion('conectando…', null, elementos);

  if (elementos.lienzoDibujo) {
    // Cada cambio del trazo actualiza el preview y el estado de
    // Deshacer/Rehacer (un trazo nuevo vacía la pila de rehacer).
    inicializarDibujo(elementos.lienzoDibujo, () => {
      actualizarPreviewDesdeLienzo();
      actualizarBotonesHistorialDibujo();
    });
    actualizarBotonesHistorialDibujo();

    // Zoom y desplazamiento del lienzo (dos dedos, rueda, botones). Al
    // apoyar el segundo dedo se descarta el trazo que empezó el primero.
    if (elementos.visorLienzo) {
      zoomDibujo = crearZoomLienzo({
        visor: elementos.visorLienzo,
        canvas: elementos.lienzoDibujo,
        indicador: elementos.indicadorZoomDibujo,
        alEmpezarGesto: () => {
          if (cancelarTrazoActual()) actualizarBotonesHistorialDibujo();
        }
      });
    }
  }

  configurarEventos();
  marcarControlesEncuadre();
  configurarBotonAtras();
  if (USAR_CUENTAS) {
    configurarLogin();
    const sesion = await entrar();
    // Desde acá todo va a la TV y al catálogo de esta cuenta (firebase.js, usarCuenta).
    usarCuenta(sesion.uid, await resolverDispositivo(sesion));
    await cargarEsAdmin();
    elementos.botonMiTV.hidden = false;
    // Importar y borrar canciones del catálogo común solo le corresponde a un
    // administrador (las reglas ya lo exigen; así el cliente no los ve).
    if (!obtenerEsAdmin()) {
      const importar = elementos.cargadorMusical && elementos.cargadorMusical.closest('label');
      if (importar) importar.hidden = true;
      if (elementos.botonBorrarMusical) elementos.botonBorrarMusical.hidden = true;
    }
  }
  iniciarMonitoreoConexion();

  bloquearPanel(true);
  let temporizador = null;
  const limite = new Promise((resolver) => {
    temporizador = setTimeout(() => { arranqueVigente = false; resolver('lento'); }, ESPERA_ARRANQUE_MS);
  });
  try {
    const como = await Promise.race([cargarEstadoInicial().then(() => 'listo'), limite]);
    if (como === 'lento') {
      marcarEstado('La conexión está lenta: todavía no se pudo leer lo que muestra la TV.', 'error', elementos);
    }
  } finally {
    clearTimeout(temporizador);
    bloquearPanel(false);
  }
  const avisoPostLogin = tomarAvisoPostLogin();
  if (avisoPostLogin) {
    marcarEstado(avisoPostLogin, 'ok', elementos);
  }
}

// ===================================================
// Cuentas: pantalla de inicio de sesión
// ===================================================
// MODO CUENTAS (ver docs/formatos-datos.md sección 6). Desde la migración del
// 2026-11-11 es el modo normal: login, TV vinculada y rutas por cuenta. El modo
// viejo (sin login, rutas oled_remota/…) queda SOLO para las pruebas locales:
// se activa con ?sincuentas=1 en la dirección. En producción las reglas de
// Firebase ya no dejan usar las rutas viejas.
const USAR_CUENTAS = !new URLSearchParams(location.search).has('sincuentas');

// ---- Botón Atrás de Android (solo APK) ----
// Cierra la capa que esté arriba (lienzo expandido, Compartir, Mi TV) y, si no hay ninguna,
// sale de la app. Sin esto "Atrás" cerraba la app aunque hubiera Mi TV o Compartir abiertos.
// Devuelve true si cerró algo.
function cerrarCapaSuperior() {
  if (dibujoExpandido) {
    contraerDibujo();
    return true;
  }
  const el = elementos;
  // Dentro de una opción de Más (Galería, Juegos, Alarma, Config): Atrás vuelve un paso
  // (de un apartado de Config a su lista; si no, al menú de Más).
  if (el.pantallaLogin.hidden && el.pantallaTV.hidden && obtenerMasVista() !== 'menu' &&
      (estadoActual.tipo === 'galeria' || estadoActual.tipo === 'animacion')) {
    volverEnMas();
    return true;
  }
  return cerrarCapaCuentas();
}

function configurarBotonAtras() {
  const app = pluginNativo('App');
  if (!app || typeof app.addListener !== 'function') return;
  app.addListener('backButton', () => {
    if (!cerrarCapaSuperior() && typeof app.exitApp === 'function') app.exitApp();
  });
}

// ===================================================
// Red de seguridad: errores que nadie atrapó
// ===================================================
// Si algo falla de una forma que no se previó, el cliente no debe quedarse
// mirando una pantalla trabada sin explicación. Se muestra un mensaje simple
// (nada técnico en la interfaz, como pide el dueño) y el detalle va a la
// consola del navegador. Los avisos inofensivos del navegador se ignoran.
let fallosInesperadosAvisados = 0;
function avisarFalloInesperado(origen, detalle, mensaje = '') {
  // ResizeObserver avisa de bucles de tamaño que no afectan a nada; "Script
  // error." es un error de otro origen (extensiones) del que no hay datos.
  if (/ResizeObserver loop/i.test(mensaje) || /^Script error.?$/i.test(mensaje)) return;
  if (++fallosInesperadosAvisados <= 20) console.error(`[TV RETRO] Error inesperado (${origen}):`, detalle);
  try {
    if (elementos && elementos.estadoTexto) marcarEstado('Algo salió mal. Vuelve a intentarlo.', 'error', elementos);
  } catch (e) { /* si ni esto se puede, queda el detalle en la consola */ }
  // Un fallo durante el arranque nunca debe dejar el panel bloqueado para
  // siempre. index.html lo trae `inert` desde el principio, así que se libera
  // aunque el fallo ocurra antes de que inicializar() lo bloquee por código.
  if (panelBloqueado || document.querySelector('main.controles[inert]')) {
    // H-27: con la pantalla de inicio de sesión a la vista NO se libera el panel (quedaría alcanzable
    // con el teclado por debajo del login): se libera ESPERA_ARRANQUE_MS después de que la persona entre.
    if (hayLoginVisible()) {
      marcarFalloMientrasLogin();
    } else {
      arranqueVigente = false;
      bloquearPanel(false);
    }
  }
}
window.addEventListener('error', (e) => avisarFalloInesperado('error', e.error || e.message, String(e.message || '')));
window.addEventListener('unhandledrejection', (e) => avisarFalloInesperado('promesa', e.reason, String((e.reason && e.reason.message) || e.reason || '')));

// Ejecutar al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
