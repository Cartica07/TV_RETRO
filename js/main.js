/**main
 * Main Application
 * Orquesta los módulos de renderizado, UI y Firebase.
 */

import { dibujarOLED, medirBloqueTexto, limitarPosicion } from './renderer.js';
import {
  cargarEstado,
  enviarEstado,
  listarCanciones,
  listarMusicales,
  leerMusical,
  guardarMusicalCatalogo,
  borrarMusicalCatalogo,
  suscribirLastSeen,
  listarImagenes,
  guardarImagenCatalogo,
  borrarImagenCatalogo,
  listarAnimaciones,
  borrarAnimacionCatalogo,
  guardarAnimacionCatalogo
} from './firebase.js';
import {
  procesarImagen,
  procesarImagenDesdeDataURL,
  dibujarPreviewImagen,
  cargarImagenOriginal,
  procesarImagenConOpciones
} from './imageProcessor.js';
import { esGif, leerGif, construirCuadrosGif, evaluarPesoAnimacion, evaluarPesoComprimido } from './gif.js';
import { puedeComprimir, comprimirCuadros, codificarMusical, decodificarMusical } from './compresion.js';
import { grabarIno, nombreDelIno, notasParaCancion } from './inoMusical.js';
import { OPCIONES_GEOMETRIA_DEFECTO } from './imageProcessor.js';
import {
  inicializarDibujo,
  establecerGrosor,
  deshacerTrazo,
  rehacerTrazo,
  limpiarLienzo,
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
  marcarUltimaVista,
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

// Canciones importadas de .ino (catálogo musicales/): clave -> meta.
let musicalesCatalogo = {};
// La canción elegida: { clave, datos (Base64 m1), grabacion (decodificada) }.
let musicalCargado = null;
// "con" = con letra (tipo musical: reemplaza la pantalla);
// "sin" = sin letra (tipo cancion: solo suena, de fondo).
let letraCanciones = 'con';

// Catálogo de imágenes guardadas cargado desde Firebase (/imagenes)
let imagenesCatalogo = {};

// Catálogo de animaciones guardadas cargado desde Firebase (/animaciones)
let animacionesCatalogo = {};

// Clave (nombre) de la animación actualmente seleccionada en la
// Galería -- mismo criterio que galeriaSeleccionActual pero para el
// segundo recuadro (Animaciones).
let animacionSeleccionActual = null;

// V1.14: clave (nombre) de la imagen actualmente seleccionada en la
// Galería -- separado de estadoActual.imagenData porque necesitamos
// saber el NOMBRE para poder borrarla, no solo sus datos. Se limpia
// cuando se borra, se sube una nueva, o se cambia de tipo.
let galeriaSeleccionActual = null;

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

// ===================================================
// Estado de conexión del DISPOSITIVO (heartbeat)
// ===================================================
// El ESP8266 escribe oled_remota/lastSeen en cada chequeo exitoso
// (cada TIEMPO_ACTUALIZACION = 10s, ver github.cpp V1.11). Si pasó
// mucho más que eso desde el último valor visto, asumimos que el
// dispositivo está apagado o sin WiFi -- aunque Firebase en sí responda
// perfecto. El umbral es más alto que el intervalo real para dar
// margen (jitter de red, chequeo que se salteó una vez, etc.).
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
    marcarConexion('sin señal del dispositivo', 'error', elementos);
    marcarUltimaVista('', elementos);
    return;
  }

  const antiguedad = Date.now() - ultimoLastSeen;

  if (antiguedad <= UMBRAL_DESCONEXION_MS) {
    marcarConexion('en línea', 'ok', elementos);
  } else {
    marcarConexion('desconectado', 'error', elementos);
  }
  marcarUltimaVista(formatearHaceCuanto(ultimoLastSeen), elementos);
}

function iniciarMonitoreoConexion() {
  suscribirLastSeen((valor) => {
    ultimoLastSeen = valor;
    evaluarConexionDispositivo();
  });

  // lastSeen solo cambia cuando el ESP8266 escribe -- si se apaga,
  // Firebase no dispara ningún evento nuevo (no hay nada que cambiar).
  // Este timer aparte es el que nota que "ya pasó demasiado tiempo"
  // aunque no haya llegado ningún dato nuevo.
  setInterval(evaluarConexionDispositivo, INTERVALO_CHEQUEO_CONEXION_MS);
}

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

  function frame(ts) {
    if (inicio === null) inicio = ts;
    const t = (ts - inicio) % cicloMs;
    let desplazamiento = 0;
    if (t > PAUSA_INICIO_V_MS) {
      desplazamiento = Math.min(distancia, Math.floor(distancia * (t - PAUSA_INICIO_V_MS) / recorridoMs));
    }
    dibujarOLED(elementos.canvas, estadoActual, desplazamiento);
    idAnimacionScroll = requestAnimationFrame(frame);
  }

  idAnimacionScroll = requestAnimationFrame(frame);
}

function iniciarScroll() {
  detenerScroll();
  scrollX = ANCHO_OLED;
  ultimoTs = null;

  function frame(ts) {
    if (ultimoTs === null) ultimoTs = ts;
    const dt = (ts - ultimoTs) / 1000;
    ultimoTs = ts;

    // Con fuente de ancho variable se mide con sus propios glifos.
    const anchoTexto = esFuenteVariable(estadoActual.fuente)
      ? anchoScrollFuente(estadoActual)
      : calcularAnchoTexto(estadoActual.texto, estadoActual.tamano);

    scrollX -= VELOCIDAD_SCROLL * dt;
    if (scrollX < -anchoTexto) scrollX = ANCHO_OLED;

    dibujarOLED(elementos.canvas, estadoActual, scrollX);
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
    if (letraCanciones === 'con' && musicalCargado) iniciarPreviewMusical(musicalCargado.grabacion);
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

  // V1.16: animaciones de la Galería (moods de ojos, etc.) -- se
  // reproduce el bucle completo en la pantalla virtual principal,
  // igual que se va a ver en la OLED real una vez reproducida ahí.
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

    const resultado = obtenerResultadoImagen(elementos.lienzoDibujo);
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

  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      pantallaCompletaPropia = true;
    }
  } catch (e) {
    pantallaCompletaPropia = false; // no permitido (iPhone, permisos): se sigue sin pantalla completa
  }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (e) {
    // Bloquear la rotación solo anda en pantalla completa y en algunos
    // navegadores; si no, el CSS se acomoda al girar el teléfono.
  }
}

function contraerDibujo({ desdeHistorial = false } = {}) {
  if (!dibujoExpandido) return;
  dibujoExpandido = false;
  document.body.classList.remove('dibujo-expandido');

  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nada */ }
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
    subvistaGaleria = esAnimacionDeGif(animacionesCatalogo[estadoActual.animacion]) ? 'gif' : 'animaciones';
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

  Object.keys(secciones).forEach((clave) => {
    const el = secciones[clave];
    if (el) el.style.display = (clave === tipoSeccion) ? 'block' : 'none';
  });

  // "Añadir nueva" y "Guardar en la galería" viven en un contenedor
  // aparte (después del switch global Invertido), pero solo deben
  // verse cuando la sección Galería está activa -- se sincronizan acá.
  if (elementos.seccionGaleriaFinal) {
    elementos.seccionGaleriaFinal.style.display = (tipoSeccion === 'galeria') ? 'block' : 'none';
  }

  // "Invertido" no tiene ningún efecto visual mientras suena una
  // canción (la pantalla no cambia con la música), así que no
  // corresponde mostrarlo ahí -- para el resto de los tipos sí aplica.
  if (elementos.filaInvertido) {
    elementos.filaInvertido.style.display = (tipoSeccion === 'cancion') ? 'none' : 'flex';
  }
}

function cambiarTipo(nuevoTipo) {
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
  const turno = ++turnoPesoGif;
  comprimirCuadros(anim.cuadros)
    .then(z => {
      if (turno !== turnoPesoGif) return;
      mostrarPeso(evaluarPesoComprimido(z.bytes, z.cantidad), ' comprimido');
    })
    .catch(() => {
      if (turno !== turnoPesoGif) return;
      mostrarPeso(evaluarPesoAnimacion(anim.cuadros), '');
    });
}

// Ver aplicarGif(): descarta cálculos de peso que ya quedaron viejos.
let turnoPesoGif = 0;

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
    marcarEstado(`Error: ${error.message}`, 'error', elementos);
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
    marcarEstado(`Error: ${error.message}`, 'error', elementos);
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
    elementos.botonFondoImagen.title = blanco ? 'Fondo: blanco (tocá para negro)' : 'Fondo: negro (tocá para blanco)';
  }
}

// Dispara al elegir un archivo nuevo del disco (o al pegar una imagen del
// portapapeles, que llega como Blob sin nombre). Si es un GIF animado
// (más de un cuadro) queda como animación; si no, como imagen fija.
async function procesarYMostrarImagen(archivo = elementos.cargadorImagen.files[0], nombreSugerido = '') {
  const file = archivo;
  if (!file) return;

  try {
    marcarEstado('Procesando imagen…', null, elementos);

    const nombreBase = (file.name || nombreSugerido || 'imagen').replace(/\.[^.]+$/, '');
    const buffer = await file.arrayBuffer();
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
      imagenOriginal = await cargarImagenOriginal(file);
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
    marcarEstado(`Error: ${error.message}`, 'error', elementos);
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
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    marcarEstado('Este navegador no deja leer imágenes del portapapeles. Probá Ctrl+V o elegí el archivo.', 'error', elementos);
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
    marcarEstado('El portapapeles no tiene una imagen. Copiá una imagen y volvé a tocar Pegar.', 'error', elementos);
  } catch (error) {
    console.error('No se pudo leer el portapapeles:', error);
    const denegado = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    marcarEstado(
      denegado
        ? 'Sin permiso para leer el portapapeles. Permitilo en el navegador, o usá Ctrl+V o elegí el archivo.'
        : 'No se pudo leer el portapapeles. Probá Ctrl+V o elegí el archivo.',
      'error',
      elementos
    );
  }
}

// Ctrl+V / Cmd+V (o "Pegar" del menú del navegador) con la pestaña
// Imagen abierta: no necesita permiso. No interfiere si se está
// escribiendo en un campo de texto.
function manejarEventoPegar(e) {
  if (estadoActual.tipo !== 'imagen') return;
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
    marcarEstado(`Error: ${error.message}`, 'error', elementos);
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
      setAvisoGaleria('Poné un nombre para guardar el GIF en la galería.', 'error');
      return;
    }
    setAvisoGaleria('Guardando…');
    const resultadoGif = await guardarAnimacionCatalogo(
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
    if (resultadoGif.exito) {
      await poblarCatalogoAnimaciones();
      setAvisoGaleria(`GIF guardado en la galería como "${resultadoGif.key}"`);
    } else {
      setAvisoGaleria('No se pudo guardar: ' + (resultadoGif.error || ''), 'error');
    }
    return;
  }

  if (estadoActual.tipo !== 'imagen' || !estadoActual.imagenData) {
    setAvisoGaleria('Primero subí y procesá una imagen para poder guardarla.', 'error');
    return;
  }

  if (!nombre) {
    setAvisoGaleria('Poné un nombre para guardar la imagen en la galería.', 'error');
    return;
  }

  setAvisoGaleria('Guardando…');
  const resultado = await guardarImagenCatalogo(
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

  if (resultado.exito) {
    await poblarCatalogoImagenes();
    setAvisoGaleria(`Guardada en la galería como "${resultado.key}"`);
  } else {
    setAvisoGaleria('No se pudo guardar: ' + (resultado.error || ''), 'error');
  }
}

function setAvisoGaleria(text, tipo = null) {
  if (!elementos.avisoGaleria) return;
  elementos.avisoGaleria.style.display = text ? 'block' : 'none';
  elementos.avisoGaleria.textContent = text || '';
  elementos.avisoGaleria.classList.remove('advertencia');
  if (tipo === 'error') elementos.avisoGaleria.classList.add('error');
  else elementos.avisoGaleria.classList.remove('error');
}

// ===================================================
// V1.12: Dibujo -- guardar en el mismo catálogo de imágenes
// ===================================================
function setAvisoGaleriaDibujo(text, tipo = null) {
  if (!elementos.avisoGaleriaDibujo) return;
  elementos.avisoGaleriaDibujo.style.display = text ? 'block' : 'none';
  elementos.avisoGaleriaDibujo.textContent = text || '';
  if (tipo === 'error') elementos.avisoGaleriaDibujo.classList.add('error');
  else elementos.avisoGaleriaDibujo.classList.remove('error');
}

// Guarda el dibujo actual en el catálogo /imagenes -- el mismo que usa
// la sección Imagen. Convierte el lienzo a bitmap en el momento (no
// depende de que el usuario haya tocado "Enviar" antes).
async function manejarGuardarDibujoEnGaleria() {
  const nombre = (elementos.nombreGaleriaDibujo && elementos.nombreGaleriaDibujo.value.trim()) || '';
  if (!nombre) {
    setAvisoGaleriaDibujo('Poné un nombre para guardar el dibujo en la galería.', 'error');
    return;
  }

  setAvisoGaleriaDibujo('Guardando…');

  const resultado_imagen = obtenerResultadoImagen(elementos.lienzoDibujo);

  const resultado = await guardarImagenCatalogo(
    nombre,
    resultado_imagen.imagenData,
    resultado_imagen.imagenAncho,
    resultado_imagen.imagenAlto,
    resultado_imagen.preprocesada,
    { origen: 'dibujo', fecha: Date.now() }
  );

  if (resultado.exito) {
    await poblarCatalogoImagenes();
    setAvisoGaleriaDibujo(`Guardado en la galería como "${resultado.key}"`);
  } else {
    setAvisoGaleriaDibujo('No se pudo guardar: ' + (resultado.error || ''), 'error');
  }
}

// ===================================================
// V1.13: Galería -- sección propia con el catálogo completo.
// Seleccionar un item deja estadoActual.tipo="galeria" (no salta a
// "imagen"): la sección Galería se queda a la vista, con sus propios
// controles de umbral/dithering para reajustar la selección ahí mismo.
// ===================================================
async function poblarCatalogoImagenes() {
  try {
    imagenesCatalogo = await listarImagenes() || {};
    renderizarGaleria();
  } catch (err) {
    console.error('Error cargando catálogo de imágenes:', err);
  }
}

function renderizarGaleria() {
  const grid = elementos.gridGaleria;
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
    if (estadoActual.tipo === 'galeria' && galeriaSeleccionActual === key) {
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
      estadoActual.tipo = 'galeria';
      estadoActual.imagenData = entry.datos;
      estadoActual.imagenAncho = entry.ancho || 128;
      estadoActual.imagenAlto = entry.alto || 64;
      galeriaSeleccionActual = key;
      turnoReprocesoImagen++; // un reproceso de la imagen anterior ya no corresponde
      // La imagen activa pasa a ser esta: lo subido en la pestaña Imagen
      // (original o GIF) deja de ser la fuente de los reajustes.
      imagenOriginal = null;
      gifActual = null;

      // Limpiar el input de "añadir nueva": si quedaba un archivo de una
      // subida anterior, no queremos que se confunda con la fuente que
      // se está por activar acá.
      if (elementos.cargadorImagenGaleria) elementos.cargadorImagenGaleria.value = '';

      if (entry.preprocesada) {
        // Esta imagen tiene copia editable: se puede seguir reajustando
        // el umbral y el dithering como si se acabara de subir. Restauramos
        // los controles de Galería a los valores con los que se guardó,
        // para que el preview y los sliders arranquen sincronizados.
        imagenFuenteActual = entry.preprocesada;
        if (entry.meta && typeof entry.meta.umbral === 'number') {
          elementos.umbralGaleria.value = entry.meta.umbral;
          elementos.valorUmbralGaleria.textContent = String(entry.meta.umbral);
        }
        if (entry.meta && typeof entry.meta.dithering === 'boolean') {
          elementos.ditheringGaleria.checked = entry.meta.dithering;
        }
      } else {
        // Guardada con una versión anterior de la galería: no hay fuente
        // editable, queda como bitmap fijo.
        imagenFuenteActual = null;
      }

      // Precargar el nombre: un simple click en "Guardar en la galería"
      // sobrescribe esta misma entrada con los cambios; para guardar
      // aparte alcanza con cambiar el nombre antes de guardar.
      if (elementos.nombreGaleriaNueva) elementos.nombreGaleriaNueva.value = key;

      renderizarGaleria(); // re-dibuja el grid para mover el resaltado "activo"
      renderizar();
      actualizarControlesEdicionImagen();
      marcarEstado(`Imagen "${key}" cargada desde la galería`, 'ok', elementos);
    });

    item.appendChild(canvas);
    item.appendChild(nombre);
    grid.appendChild(item);
  });

  actualizarBotonBorrarGaleria();
}

// V1.14: habilita el ícono de basura de la cabecera solo si hay una
// imagen seleccionada Y esa imagen todavía existe en el catálogo en
// memoria (por si se borró desde otra pestaña/dispositivo mientras
// tanto).
function actualizarBotonBorrarGaleria() {
  if (!elementos.botonBorrarGaleria) return;
  const haySeleccion = !!galeriaSeleccionActual && !!imagenesCatalogo[galeriaSeleccionActual];
  elementos.botonBorrarGaleria.disabled = !haySeleccion;
}

// Borra la imagen actualmente seleccionada en la Galería (ver
// galeriaSeleccionActual, se fija al tocar una miniatura).
async function manejarBorrarGaleriaSeleccionada() {
  if (!galeriaSeleccionActual) return;

  const key = galeriaSeleccionActual;
  const resultado = await borrarImagenCatalogo(key);

  if (resultado.exito) {
    galeriaSeleccionActual = null;
    await poblarCatalogoImagenes();
    marcarEstado(`Imagen "${key}" borrada de la galería.`, 'ok', elementos);
  } else {
    marcarEstado('No se pudo borrar la imagen: ' + (resultado.error || ''), 'error', elementos);
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

async function poblarCatalogoAnimaciones() {
  try {
    const crudo = await listarAnimaciones() || {};
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
  const gridAnim = elementos.gridAnimaciones;
  const gridGif = elementos.gridGifs;
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
    if (estadoActual.tipo === 'animacion' && animacionSeleccionActual === key) {
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

    item.addEventListener('click', () => {
      estadoActual.tipo = 'animacion';
      estadoActual.animacion = key;
      estadoActual.animacionAncho = entry.ancho || 128;
      estadoActual.animacionAlto = entry.alto || 64;
      estadoActual.animacionCuadros = entry.cuadros;
      animacionSeleccionActual = key;
      // Lo elegido acá reemplaza a un GIF subido en la pestaña Imagen
      // (comparten animacionCuadros).
      gifActual = null;

      renderizarAnimaciones(); // re-dibuja el grid para mover el resaltado "activo"
      renderizar(); // arranca el preview en bucle en la pantalla de arriba
      actualizarBotonBorrarAnimacion();
      const queEs = esAnimacionDeGif(entry) ? 'GIF' : 'Animación';
      marcarEstado(`${queEs} "${key}" cargado desde la galería`, 'ok', elementos);
    });

    item.appendChild(canvas);
    item.appendChild(nombre);
    grid.appendChild(item);
  });

  ponerVacio(gridAnim, 'Todavía no hay animaciones guardadas.');
  ponerVacio(gridGif, 'Todavía no hay GIF guardados.');
  actualizarBotonBorrarAnimacion();
}

function actualizarBotonBorrarAnimacion() {
  if (!elementos.botonBorrarAnimacion) return;
  const haySeleccion = !!animacionSeleccionActual && !!animacionesCatalogo[animacionSeleccionActual];
  elementos.botonBorrarAnimacion.disabled = !haySeleccion;
}

async function manejarBorrarAnimacionSeleccionada() {
  if (!animacionSeleccionActual) return;

  const key = animacionSeleccionActual;
  const resultado = await borrarAnimacionCatalogo(key);

  if (resultado.exito) {
    animacionSeleccionActual = null;
    await poblarCatalogoAnimaciones();
    marcarEstado(`Animación "${key}" borrada de la galería.`, 'ok', elementos);
  } else {
    marcarEstado('No se pudo borrar la animación: ' + (resultado.error || ''), 'error', elementos);
  }
}

// Procesa un archivo nuevo subido desde la sección Galería (usa el par
// umbral/dithering propio de esta sección) y lo deja listo en el
// preview para ponerle nombre y guardarlo.
async function procesarYMostrarImagenGaleria() {
  const file = elementos.cargadorImagenGaleria.files[0];
  if (!file) return;

  try {
    marcarEstado('Procesando imagen…', null, elementos);

    // GIF animado: queda como animación (se guarda en la lista GIF).
    // Sin encuadre en la Galería: se usa el encuadre por defecto.
    const buffer = await file.arrayBuffer();
    let leido = null;
    if (esGif(buffer)) {
      marcarEstado('Leyendo GIF…', null, elementos);
      leido = leerGif(buffer, OPCIONES_GEOMETRIA_DEFECTO);
    }
    if (leido && leido.grises.length > 1) {
      estadoActual.tipo = 'galeria';
      galeriaSeleccionActual = null;
      imagenOriginal = null;
      imagenFuenteActual = null;
      gifActual = { buffer, leido, nombre: file.name.replace(/\.[^.]+$/, ''), origen: 'galeria' };
      aplicarGif();
      renderizarGaleria(); // por si había una entrada seleccionada, sacarle el resaltado
      if (elementos.nombreGaleriaNueva && !elementos.nombreGaleriaNueva.value) {
        elementos.nombreGaleriaNueva.value = gifActual.nombre;
      }
      return;
    }

    const umbral = parseInt(elementos.umbralGaleria.value);
    const dithering = elementos.ditheringGaleria.checked;
    const resultado = await procesarImagen(file, 128, 64, umbral, dithering);

    estadoActual.tipo = 'galeria';
    imagenOriginal = null;
    gifActual = null;
    mostrarAvisoPesoGif(elementos.avisoGaleriaNueva, { nivel: 'ok' });
    aplicarResultadoImagen(resultado);
    renderizarGaleria(); // por si había una entrada seleccionada, sacarle el resaltado

    if (elementos.nombreGaleriaNueva && !elementos.nombreGaleriaNueva.value) {
      elementos.nombreGaleriaNueva.value = file.name.replace(/\.[^.]+$/, '');
    }
  } catch (error) {
    console.error('Error procesando imagen:', error);
    marcarEstado(`Error: ${error.message}`, 'error', elementos);
  }
}

function setAvisoGaleriaNueva(text, tipo = null) {
  if (!elementos.avisoGaleriaNueva) return;
  elementos.avisoGaleriaNueva.style.display = text ? 'block' : 'none';
  elementos.avisoGaleriaNueva.textContent = text || '';
  elementos.avisoGaleriaNueva.classList.remove('advertencia');
  if (tipo === 'error') elementos.avisoGaleriaNueva.classList.add('error');
  else elementos.avisoGaleriaNueva.classList.remove('error');
}

// Guarda en el catálogo lo que esté actualmente activo en la sección
// Galería -- ya sea una imagen recién subida con "Añadir una imagen
// nueva", o una imagen del catálogo que se acaba de reajustar. Si el
// nombre coincide con una entrada existente, la reemplaza (mismo
// comportamiento que guardarImagenCatalogo en firebase.js: la clave es
// el nombre).
async function manejarGuardarNuevaEnGaleria() {
  // GIF subido con el +: se guarda en /animaciones con meta.origen "gif".
  if (estadoActual.tipo === 'galeria' && hayGifDe('galeria')) {
    const nombreGif = (elementos.nombreGaleriaNueva && elementos.nombreGaleriaNueva.value.trim()) || '';
    if (!nombreGif) {
      setAvisoGaleriaNueva('Poné un nombre para guardar el GIF en la galería.', 'error');
      return;
    }
    setAvisoGaleriaNueva('Guardando…');
    const resultadoGif = await guardarAnimacionCatalogo(
      nombreGif,
      estadoActual.animacionAncho,
      estadoActual.animacionAlto,
      estadoActual.animacionCuadros,
      Object.assign({
        origen: 'gif',
        umbral: parseInt(elementos.umbralGaleria.value),
        dithering: elementos.ditheringGaleria.checked,
        fecha: Date.now()
      }, OPCIONES_GEOMETRIA_DEFECTO)
    );
    if (resultadoGif.exito) {
      await poblarCatalogoAnimaciones();
      setAvisoGaleriaNueva(`GIF guardado en la lista GIF como "${resultadoGif.key}"`);
    } else {
      setAvisoGaleriaNueva('No se pudo guardar: ' + (resultadoGif.error || ''), 'error');
    }
    return;
  }

  if (estadoActual.tipo !== 'galeria' || !estadoActual.imagenData) {
    setAvisoGaleriaNueva('Primero subí una imagen nueva o seleccioná una de la galería.', 'error');
    return;
  }

  const nombre = (elementos.nombreGaleriaNueva && elementos.nombreGaleriaNueva.value.trim()) || '';
  if (!nombre) {
    setAvisoGaleriaNueva('Poné un nombre para guardar la imagen en la galería.', 'error');
    return;
  }

  setAvisoGaleriaNueva('Guardando…');
  const resultado = await guardarImagenCatalogo(
    nombre,
    estadoActual.imagenData,
    estadoActual.imagenAncho,
    estadoActual.imagenAlto,
    imagenFuenteActual,
    {
      origen: 'upload',
      umbral: parseInt(elementos.umbralGaleria.value),
      dithering: elementos.ditheringGaleria.checked,
      fecha: Date.now()
    }
  );

  if (resultado.exito) {
    await poblarCatalogoImagenes();
    setAvisoGaleriaNueva(`Guardada en la galería como "${resultado.key}"`);
  } else {
    setAvisoGaleriaNueva('No se pudo guardar: ' + (resultado.error || ''), 'error');
  }
}

// ===================================================
// Canciones: catálogo, selección, upload, preview
// ===================================================
async function poblarCatalogoCanciones() {
  try {
    // Las canciones son las importadas de .ino (catálogo musicales/).
    musicalesCatalogo = (await listarMusicales()) || {};

    // Limpiar select
    elementos.seleccionCancion.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = Object.keys(musicalesCatalogo).length ? '-- Seleccioná --' : 'Importá canciones con +';
    elementos.seleccionCancion.appendChild(placeholder);

    Object.keys(musicalesCatalogo)
      .sort((a, b) => nombreMusical(a).localeCompare(nombreMusical(b), 'es', { sensitivity: 'base' }))
      .forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = nombreMusical(key);
        elementos.seleccionCancion.appendChild(opt);
      });

    // Si estadoActual.cancion ya tiene valor, seleccionarlo
    if (estadoActual.cancion && musicalesCatalogo[estadoActual.cancion]) {
      const clave = estadoActual.cancion;
      elementos.seleccionCancion.value = clave;
      const turno = ++turnoCancion;
      const m = await cargarMusical(clave);
      // Si mientras tanto se eligió otra canción, esta ya no corresponde.
      if (turno === turnoCancion) {
        musicalCargado = m;
        estadoActual.cancionNotas = notasParaCancion(m.grabacion);
        setAvisoCancion(describirMusical(clave, m.grabacion));
      }
    } else {
      elementos.seleccionCancion.value = '';
    }
    actualizarBotonBorrarMusical();
  } catch (err) {
    console.error('Error cargando catálogo de canciones:', err);
  }
}

function nombreMusical(clave) {
  const meta = musicalesCatalogo[clave] || {};
  return meta.nombre || clave;
}

function actualizarBotonBorrarMusical() {
  if (elementos.botonBorrarMusical) elementos.botonBorrarMusical.disabled = !elementos.seleccionCancion.value;
}

// Cada vez que se elige una canción sube en 1: una carga que termina
// cuando ya se eligió otra se descarta (si no, una canción lenta que
// llegaba tarde reemplazaba a la elegida después).
let turnoCancion = 0;

// Baja y decodifica la grabación de una canción del catálogo. No la deja
// elegida: eso lo hace quien llama, si la carga sigue correspondiendo.
async function cargarMusical(clave) {
  if (musicalCargado && musicalCargado.clave === clave) return musicalCargado;
  const datos = await leerMusical(clave);
  if (!datos) throw new Error('No se encontró la canción en Firebase.');
  const grabacion = await decodificarMusical(datos);
  return { clave, datos, grabacion };
}

function describirMusical(clave, grab) {
  const seg = Math.round(grab.duracion / 1000);
  const min = Math.floor(seg / 60), s = String(seg % 60).padStart(2, '0');
  const fin = grab.repetir ? '' : ' · se queda en la última imagen';
  return `${nombreMusical(clave)} · ${min}:${s}${fin}`;
}

// Importa uno o varios .ino: cada uno se ejecuta (inoMusical.js), se graba
// y se guarda en musicales/. Con el mismo nombre, reemplaza la anterior.
async function importarCanciones(archivos) {
  const lista = [...(archivos || [])].filter(f => /\.ino$/i.test(f.name));
  if (lista.length === 0) return;
  if (!puedeComprimir()) {
    setAvisoCancion('Este navegador no puede comprimir: usá Chrome, Edge o Safari actualizados.', 'error');
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
      const r = await guardarMusicalCatalogo(clave, m.datos, meta);
      if (!r.exito) throw new Error(r.error || 'no se pudo guardar');
      ultimaClave = r.clave;
    } catch (err) {
      console.error('Error importando', archivo.name, err);
      errores.push(`${archivo.name}: ${err.message}`);
    }
  }

  const bien = lista.length - errores.length;
  await poblarCatalogoCanciones();
  if (ultimaClave && lista.length === 1 && !errores.length) {
    elementos.seleccionCancion.value = ultimaClave;
    await manejarSeleccionCancion();
  }
  if (errores.length) setAvisoCancion(`${bien} importada(s), ${errores.length} con error: ${errores.join(' · ')}`, 'error');
  else if (lista.length > 1) setAvisoCancion(`${bien} canciones importadas.`);
}

async function borrarMusicalElegido() {
  const clave = elementos.seleccionCancion.value;
  if (!clave) return;
  if (!confirm(`¿Borrar "${nombreMusical(clave)}"?`)) return;
  const r = await borrarMusicalCatalogo(clave);
  if (!r.exito) {
    setAvisoCancion('No se pudo borrar: ' + (r.error || ''), 'error');
    return;
  }
  if (musicalCargado && musicalCargado.clave === clave) musicalCargado = null;
  estadoActual.cancion = '';
  estadoActual.cancionNotas = [];
  detenerPreviewMusical();
  await poblarCatalogoCanciones();
  setAvisoCancion('');
}

function setAvisoCancion(text, tipo = null) {
  if (!elementos.avisoCancion) return;
  elementos.avisoCancion.style.display = text ? 'block' : 'none';
  elementos.avisoCancion.textContent = text || '';
  if (tipo === 'error') elementos.avisoCancion.classList.add('error');
  else elementos.avisoCancion.classList.remove('error');
}

async function manejarSeleccionCancion() {
  const turno = ++turnoCancion;
  const key = elementos.seleccionCancion.value;
  actualizarBotonBorrarMusical();

  // Mientras la nueva carga (o si falla), no queda elegida la anterior:
  // así "Enviar" nunca manda otra canción que la que se ve en el selector.
  if (!musicalCargado || musicalCargado.clave !== key) {
    estadoActual.cancion = '';
    estadoActual.cancionNotas = [];
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
    const m = await cargarMusical(key);
    if (turno !== turnoCancion) return; // ya se eligió otra
    musicalCargado = m;
    estadoActual.cancion = key;
    // Para "sin letra": las notas en el formato de las canciones de siempre.
    estadoActual.cancionNotas = notasParaCancion(m.grabacion);
    setAvisoCancion(describirMusical(key, m.grabacion));
    renderizar();
  } catch (err) {
    if (turno !== turnoCancion) return;
    console.error('Error cargando la canción:', err);
    setAvisoCancion('No se pudo cargar la canción: ' + err.message, 'error');
  }
}

// V1.15: la carga de canciones nuevas se privatizó -- ya no vive en este
// panel público. El dueño del dispositivo la sube por otra vía (fuera
// de esta página), así un visitante con el link no puede subir música
// nueva, solo elegir entre las que ya están cargadas.

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
  elementos.cargadorImagen.addEventListener('change', () => procesarYMostrarImagen());

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
    elementos.botonGuardarGaleria.addEventListener('click', manejarGuardarEnGaleria);
  }

  // V1.13: sección Galería -- añadir imagen nueva, reajustar la
  // seleccionada (mismo par umbral/dithering, pero el de esta sección).
  if (elementos.cargadorImagenGaleria) {
    elementos.cargadorImagenGaleria.addEventListener('change', () => procesarYMostrarImagenGaleria());
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
    elementos.botonGuardarGaleriaNueva.addEventListener('click', manejarGuardarNuevaEnGaleria);
  }
  if (elementos.botonBorrarGaleria) {
    elementos.botonBorrarGaleria.addEventListener('click', manejarBorrarGaleriaSeleccionada);
  }
  if (elementos.botonBorrarAnimacion) {
    elementos.botonBorrarAnimacion.addEventListener('click', manejarBorrarAnimacionSeleccionada);
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
  if (elementos.botonLimpiarDibujo) {
    elementos.botonLimpiarDibujo.addEventListener('click', () => {
      limpiarLienzo(elementos.lienzoDibujo);
      actualizarPreviewDesdeLienzo();
      actualizarBotonesHistorialDibujo();
    });
  }
  if (elementos.botonGuardarGaleriaDibujo) {
    elementos.botonGuardarGaleriaDibujo.addEventListener('click', manejarGuardarDibujoEnGaleria);
  }

  // Dibujo: expandir / contraer el lienzo.
  if (elementos.botonExpandirDibujo) {
    elementos.botonExpandirDibujo.addEventListener('click', expandirDibujo);
  }
  if (elementos.botonContraerDibujo) {
    elementos.botonContraerDibujo.addEventListener('click', () => contraerDibujo());
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
      const v = Number(e.target.value) || 1;
      estadoActual.cancionRepeticiones = v;
    });
  }

  // Canciones: importar .ino, borrar, Con letra / Sin letra
  if (elementos.cargadorMusical) {
    elementos.cargadorMusical.addEventListener('change', async (e) => {
      const archivos = e.target.files;
      await importarCanciones(archivos);
      e.target.value = '';
    });
  }
  if (elementos.botonBorrarMusical) {
    elementos.botonBorrarMusical.addEventListener('click', borrarMusicalElegido);
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
async function cargarEstadoInicial() {
  try {
    const resultado = await cargarEstado();
    
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
          // V1.16: el firmware todavía no manda tipo="animacion" (falta
          // cablear github.cpp/pantalla.cpp), pero se dejan los campos
          // acá para cuando esté conectado -- así no hace falta tocar
          // esto de nuevo, ya está listo del lado web.
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

      // poblar catálogo de canciones, catálogo de imágenes, y controles
      await poblarCatalogoCanciones();
      await poblarCatalogoImagenes();
      // Lo último enviado fue una animación o un GIF: el panel abre en la
      // Galería, así que su lista tiene que estar cargada (antes se veía
      // "Todavía no hay animaciones" hasta tocar la pestaña) y la animación
      // enviada, marcada.
      if (estadoActual.tipo === 'animacion') {
        animacionSeleccionActual = estadoActual.animacion || null;
        await poblarCatalogoAnimaciones();
      }
      poblarControles(estadoActual, elementos);
      mostrarSeccionSegunTipo(estadoActual.tipo);
      renderizar();
      actualizarControlesEdicionImagen();
      // El LED de conexión ya no se marca acá: refleja el heartbeat del
      // dispositivo (ver iniciarMonitoreoConexion), no si el navegador
      // pudo leer Firebase, que es una cosa completamente distinta.
      // La versión (contador de envíos) no se muestra en la interfaz por
      // ahora: queda en la consola del navegador para depurar.
      if (resultado.vacio) {
        marcarEstado('Conectado a Firebase. Todavía no hay datos.', 'ok', elementos);
      } else {
        console.info(`[TV RETRO] En la OLED ahora mismo: v${resultado.version}`);
        marcarEstado('', null, elementos);
      }
    } else {
      poblarControles(estadoActual, elementos);
      renderizar();
      marcarConexion('sin Firebase', 'error', elementos);
      marcarEstado('No se pudo leer Firebase.', 'error', elementos);
    }
  } catch (err) {
    console.error('Error durante carga inicial:', err);
    poblarControles(estadoActual, elementos);
    renderizar();
    marcarConexion('sin Firebase', 'error', elementos);
    marcarEstado('Error de conexión a Firebase.', 'error', elementos);
  }
}

// Mensaje tras un envío exitoso. La versión (contador de envíos) no se
// muestra en la interfaz por ahora: queda en la consola para depurar.
function textoEnviado(version) {
  console.info(`[TV RETRO] Enviado: v${version}`);
  return 'Enviado ✅ La OLED lo toma en el próximo chequeo.';
}

async function enviarAFirebase() {
  setBotonEnviarEstado(false, elementos);
  marcarEstado('Enviando…', null, elementos);
  activarLedTransmision(elementos);

  try {
    // V1.12: Dibujo -- se convierte el lienzo a bitmap recién acá, en
    // el momento de enviar (siempre el dibujo más reciente, no una
    // versión vieja cacheada). Importante: se arma un payload TEMPORAL
    // con tipo forzado a "imagen" -- NO se pisa estadoActual.tipo, así
    // el usuario se queda en la pestaña Dibujo después de enviar, en
    // vez de que la UI salte sola a la pestaña Imagen. Para Firebase y
    // el ESP8266 esto es indistinguible de una imagen subida normal.
    if (estadoActual.tipo === 'dibujo') {
      const resultado_imagen = obtenerResultadoImagen(elementos.lienzoDibujo);
      const payloadDibujo = Object.assign({}, estadoActual, {
        tipo: 'imagen',
        imagenData: resultado_imagen.imagenData,
        imagenAncho: resultado_imagen.imagenAncho,
        imagenAlto: resultado_imagen.imagenAlto
      });

      const resultado = await enviarEstado(payloadDibujo);

      if (resultado.exito) {
        marcarEstado(
          textoEnviado(resultado.version),
          'ok',
          elementos
        );
      } else {
        marcarEstado('Error al enviar. Revisar conexión.', 'error', elementos);
      }
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

      if (resultado.exito) {
        marcarEstado(
          textoEnviado(resultado.version),
          'ok',
          elementos
        );
      } else {
        marcarEstado('Error al enviar. Revisar conexión.', 'error', elementos);
      }
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

      if (resultado.exito) {
        marcarEstado(
          textoEnviado(resultado.version),
          'ok',
          elementos
        );
      } else {
        marcarEstado('Error al enviar. Revisar conexión.', 'error', elementos);
      }
      return;
    }

    // V1.16: Animación -- a diferencia de Dibujo/Galería, acá NO hace
    // falta un payload temporal con tipo forzado: estadoActual.tipo ya
    // es "animacion" de verdad (se fija así al seleccionar una del
    // catálogo, ver renderizarAnimaciones), así que cae directo en el
    // enviarEstado(estadoActual) genérico de más abajo.

    // asegurar que el estadoActual tiene campos de canción cuando corresponda
    let aEnviar = estadoActual;
    if (estadoActual.tipo === 'cancion') {
      if (!estadoActual.cancion || !musicalCargado || musicalCargado.clave !== estadoActual.cancion) {
        marcarEstado('Elegí una canción.', 'error', elementos);
        return;
      }
      estadoActual.cancionRepeticiones = Number(elementos.inputRepeticiones.value) || Number(estadoActual.cancionRepeticiones) || 1;

      if (letraCanciones === 'con') {
        // Con letra: la grabación entera (tipo "musical"), reemplaza la pantalla.
        aEnviar = Object.assign({}, estadoActual, {
          tipo: 'musical',
          musicalNombre: estadoActual.cancion,
          musicalRepeticiones: estadoActual.cancionRepeticiones,
          musicalDatos: musicalCargado.datos
        });
      } else {
        // Sin letra: solo las notas, de fondo (tipo "cancion" de siempre).
        estadoActual.cancionNotas = notasParaCancion(musicalCargado.grabacion);
      }
    }

    const resultado = await enviarEstado(aEnviar);

    if (resultado.exito) {
      marcarEstado(
        textoEnviado(resultado.version),
        'ok',
        elementos
      );
    } else {
      marcarEstado('Error al enviar. Revisar conexión.', 'error', elementos);
    }
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
  iniciarMonitoreoConexion();

  await cargarEstadoInicial();
}

// Ejecutar al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
