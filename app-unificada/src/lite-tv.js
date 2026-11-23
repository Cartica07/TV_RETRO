// Parte "TV Lite" de la app unificada: lo que antes hacía js/firebase.js con la TV, pero por Bluetooth (ble.js, el mismo de
// la app Lite). Se empaqueta con esbuild en www/js/lite-tv.js y lo usa el enrutador (src/backend-unificado.js).
//
// Qué NO hace: cuentas, galería ni canciones del catálogo. Eso viene de la nube (js/firebase-pro.js), igual que en la Pro:
// aquí solo se manda a la TV Lite lo que la persona elige. Lo único que guarda en el celular son las TV Lite que añadió
// (localStorage, por cuenta) y, por cada TV, lo último que mandó, su alarma, sus ajustes y qué canciones tiene la TV.
//
// Ids de TV: una TV Lite se identifica con "lite:<dirección Bluetooth>" (las TV Pro, con el id de Firebase de siempre).

import * as ble from '../../app-lite/src/ble.js';
import * as almacen from '../../app-lite/src/almacen.js';
import { bleDe } from './registro-lite.js';
import { comprimirCuadros, descomprimirCuadros, puedeComprimir, FORMATO_COMPRIMIDO, FORMATO_MUSICAL } from '../../js/compresion.js';

export const ErrorTV = ble.ErrorTV;
export { ble };
// La galería en el celular (para quien usa la app con una TV Lite y sin cuenta).
export * as galeria from './galeria-local.js';

// Un GIF de más de esto no se envía (la TV guarda ~1,4 MB y por Bluetooth tardaría minutos). Lo usa también gif-unificado.js.
export const LIMITE_GIF_TV_BYTES = 600 * 1024;

const NO_DISPONIBLE = { exito: false, error: 'Esto no está disponible en un Pepito Lite.' };

// ===================================================
// Utilidades
// ===================================================
function base64ABytes(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function bytesABase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Los textos de ErrorTV son frases completas; la Pro les agrega su propio punto final: se quita el nuestro. */
export function describirErrorTV(error) {
  const texto = String((error && error.message) || error || '');
  return texto.replace(/[.\s]+$/, '');
}

// Lo que el enrutador le da a este módulo (las funciones de la nube que necesita).
let leerMusicalNube = null;
export function configurar({ leerMusical }) { leerMusicalNube = leerMusical; }

// ===================================================
// La TV activa (la que eligió la persona en Mi TV)
// ===================================================
let bleActiva = null; // dirección Bluetooth de la TV Lite activa
let ultimaVersionMostrada = null;
const escuchasLastSeen = new Set();
const escuchasMostrada = new Set();
let temporizadorLatido = null;
let temporizadorReconexion = null;

const claveTV = (tabla) => `${tabla}:${bleActiva}`;

function emitirLastSeen(valor) {
  for (const f of escuchasLastSeen) { try { f(valor); } catch (e) { console.error(e); } }
}

function marcarMostrada(version) {
  ultimaVersionMostrada = version;
  for (const f of escuchasMostrada) { try { f(version); } catch (e) { console.error(e); } }
}

/** Pasa a usar esta TV Lite: la recuerda para reconectar y se conecta con ella (sin emparejar por sorpresa). */
export function usarTV(idLite) {
  bleActiva = bleDe(idLite);
  ultimaVersionMostrada = null;
  if (ble.idTVGuardada() !== bleActiva && ble.estaConectado()) ble.desconectar().catch(() => {});
  ble.usarTVVinculada(bleActiva).catch(() => {});
}

export function suscribirLastSeen(callback) {
  escuchasLastSeen.add(callback);
  iniciarLatido();
  callback(ble.estaConectado() ? Date.now() : null);
  return () => escuchasLastSeen.delete(callback);
}

// La Pro mostraba "en línea" mientras llegaba el latido de la TV por Firebase. Aquí es el Bluetooth: "ahora" mientras haya
// conexión y null (desconectado) al perderla; se sigue intentando reconectar con calma mientras la app esté a la vista.
function iniciarLatido() {
  if (temporizadorLatido) return;
  ble.alCambiarConexion((conectado) => { emitirLastSeen(conectado ? Date.now() : null); });
  temporizadorLatido = setInterval(() => { if (ble.estaConectado()) emitirLastSeen(Date.now()); }, 10000);
  const intentar = () => {
    if (ble.estaConectado() || !ble.hayTVGuardada() || document.visibilityState === 'hidden') return;
    ble.reconectar().catch(() => {});
  };
  temporizadorReconexion = setInterval(intentar, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    ble.reanudarReconexion();
    intentar();
  });
}

export function suscribirMostrada(callback) {
  escuchasMostrada.add(callback);
  callback(ultimaVersionMostrada);
  return () => escuchasMostrada.delete(callback);
}

export async function leerMostrada() { return ultimaVersionMostrada; }

/** Muestra el avance de un envío largo (un GIF o una canción) en la línea de estado: "Enviando… 45 %". p va de 0 a 1. */
function avanceEnvio(p) {
  try {
    const el = document.getElementById('estadoTexto');
    if (el && /^Enviando/.test(el.textContent)) el.textContent = `Enviando… ${Math.round(p * 100)} %`;
  } catch (e) { /* sin pantalla */ }
}

// Mientras el celular se empareja con la TV (la persona escribe el PIN) la línea de estado lo dice. Texto PROPUESTO.
ble.alCambiarEstado((paso) => {
  if (paso !== 'vincular') return;
  try {
    const el = document.getElementById('estadoTexto');
    if (el && /^Enviando/.test(el.textContent)) el.textContent = 'Escribe el PIN que sale en Pepito…';
  } catch (e) { /* sin pantalla */ }
});

// Si la TV ya no reconoce a este celular (el vínculo quedó roto de un solo lado), la reconexión de fondo se detiene en silencio y
// la app solo diría "Desconectado": se avisa con un cuadro, como máximo una vez por minuto, qué hacer.
// Texto PROPUESTO (docs/lite-textos-propuestos.md, fila 24): lo aprueba el dueño.
let ultimoAvisoVinculo = 0;
ble.alVinculoRoto((mensaje) => {
  if (Date.now() - ultimoAvisoVinculo < 60000) return;
  ultimoAvisoVinculo = Date.now();
  try { window.alert(mensaje); } catch (e) { console.warn('[TV RETRO] ' + mensaje); }
});

async function asegurarConexion() {
  if (ble.estaConectado()) return;
  if (await ble.reconectar()) return;
  try {
    await ble.buscar(); // muestra la lista de TV cercanas (se llega aquí desde un toque del usuario)
  } finally {
    try {
      const el = document.getElementById('estadoTexto');
      if (el && /^Escribe el PIN/.test(el.textContent)) el.textContent = 'Enviando…';
    } catch (e) { /* sin pantalla */ }
  }
}

// ===================================================
// Canciones: vienen de la nube; la TV guarda en su memoria las que se usan
// ===================================================
async function bytesDeCancion(clave) {
  const b64 = leerMusicalNube ? await leerMusicalNube(clave) : null;
  if (!b64) throw new ble.ErrorTV('Esa canción no existe.');
  return base64ABytes(b64);
}

/** Id de 16 bits que la TV usa para guardar la canción: sale de su CONTENIDO (0 = "sin canción", no se usa). */
export function idDeBytes(bytes) {
  const id = ble.crc32(bytes) & 0xFFFF;
  return id === 0 ? 1 : id;
}

/**
 * Se asegura de que la TV tenga la canción y devuelve su id. La TV solo dice QUÉ ids tiene: dos canciones pueden dar el
 * mismo id de 16 bits (o una borrada del catálogo seguir en la TV), y tocar la equivocada es peor que mandarla otra vez.
 * Por eso solo se da por buena una canción que la TV lista Y que este celular recuerda haberle mandado con ese mismo
 * contenido completo (CRC de 32 bits). Si no, se manda de nuevo.
 */
async function asegurarCancionEnTV(clave) {
  const datos = await bytesDeCancion(clave);
  const crc = ble.crc32(datos);
  const id = idDeBytes(datos);
  const guardadas = await ble.listar();
  const registro = (await almacen.leer('meta', claveTV('cancionesTV'))) || {};
  if (!(guardadas.has(id) && registro[id] === crc)) {
    const r = await ble.enviarArchivo(datos, { id, alProgreso: avanceEnvio });
    if (!r.ok) throw new ble.ErrorTV('La canción no llegó bien. Vuelve a intentarlo.');
    registro[id] = crc;
    await almacen.guardar('meta', claveTV('cancionesTV'), registro);
  }
  return id;
}

// ===================================================
// Último contenido enviado (para que la app se abra donde se quedó)
// ===================================================
const ESTADO_VACIO = {
  tipo: 'texto', texto: 'Bienvenido', tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar',
  fuente: '', manual: false, x: 0, y: 0, direccion: 'h', imagenData: '', imagenAncho: 0, imagenAlto: 0,
  cancionNombre: '', cancionRepeticiones: 1, version: 0, exito: true, vacio: true,
};

export async function cargarEstado() {
  try {
    const guardado = await almacen.leer('meta', claveTV('ultimo'));
    if (!guardado || !guardado.pantalla) return Object.assign({}, ESTADO_VACIO);
    const pantalla = guardado.pantalla;
    const config = pantalla.config || {};
    const imagen = pantalla.imagen || {};
    const animacion = pantalla.animacion || {};
    const cancion = pantalla.cancion || {};
    let cuadrosAnimacion = [];
    if (animacion.formato === FORMATO_COMPRIMIDO && guardado.archivo && puedeComprimir()) {
      try {
        cuadrosAnimacion = await descomprimirCuadros(guardado.archivo);
      } catch (err) {
        console.error('No se pudo descomprimir la animación:', err);
      }
    }
    return {
      tipo: (['alarma', 'ajustes'].includes(pantalla.tipo) ? 'texto' : pantalla.tipo) || 'texto',
      texto: typeof pantalla.texto === 'string' ? pantalla.texto : 'Bienvenido',
      tamano: Math.min(5, Math.max(1, Math.round(Number(config.tamano)) || 2)),
      alineacion: config.alineacion || 'centro',
      alineacionV: config.alineacionV || 'centro',
      invertido: !!config.invertido,
      modoTexto: config.modoTexto || 'ajustar',
      fuente: typeof config.fuente === 'string' ? config.fuente : '',
      manual: !!config.manual,
      x: Number(config.x) || 0,
      y: Number(config.y) || 0,
      direccion: config.direccion === 'v' ? 'v' : 'h',
      imagenData: imagen.datos || '',
      imagenAncho: Number(imagen.ancho) || 0,
      imagenAlto: Number(imagen.alto) || 0,
      cancionNombre: typeof cancion.nombre === 'string' ? cancion.nombre : '',
      cancionRepeticiones: Number(cancion.repeticiones) || 1,
      animacionNombre: typeof animacion.nombre === 'string' ? animacion.nombre : '',
      animacionAncho: Number(animacion.ancho) || 0,
      animacionAlto: Number(animacion.alto) || 0,
      animacionCuadros: cuadrosAnimacion,
      musicalNombre: pantalla.musical && typeof pantalla.musical.nombre === 'string' ? pantalla.musical.nombre : '',
      musicalRepeticiones: (pantalla.musical && Number(pantalla.musical.repeticiones)) || 1,
      version: Number(guardado.version) || 0,
      exito: true,
    };
  } catch (err) {
    console.error('Error al leer lo último que se envió:', err);
    return { exito: false, error: describirErrorTV(err) };
  }
}

async function reservarVersion() {
  const clave = claveTV('version');
  const n = (Number(await almacen.leer('meta', clave)) || 0) + 1;
  await almacen.guardar('meta', clave, n);
  return n;
}

// ===================================================
// Enviar a la TV
// ===================================================
/** Arma la misma "pantalla" que la Pro escribía en Firebase (formato en docs/formatos-datos.md sección 2). */
async function armarPantalla(estado) {
  const pantalla = {
    texto: estado.texto,
    config: {
      tamano: estado.tamano,
      alineacion: estado.alineacion,
      alineacionV: estado.alineacionV,
      invertido: estado.invertido,
      modoTexto: estado.modoTexto,
      fuente: estado.fuente || 'sans',
      manual: !!estado.manual,
      x: Math.round(Number(estado.x) || 0),
      y: Math.round(Number(estado.y) || 0),
      direccion: estado.direccion === 'v' ? 'v' : 'h',
    },
  };
  let archivo = null; // bytes del GIF comprimido (z1)

  if (estado.tipo === 'imagen') {
    pantalla.tipo = 'imagen';
    pantalla.imagen = { ancho: estado.imagenAncho, alto: estado.imagenAlto, datos: estado.imagenData };
  } else if (estado.tipo === 'animacion') {
    if (!puedeComprimir()) throw new ble.ErrorTV('Este celular no puede enviar GIF.');
    pantalla.tipo = 'animacion';
    const z = await comprimirCuadros(estado.animacionCuadros || []);
    if (z.bytes > LIMITE_GIF_TV_BYTES) throw new ble.ErrorTV('Ese GIF es demasiado pesado para Pepito. Prueba con uno más corto.');
    pantalla.animacion = {
      nombre: estado.animacion || '', ancho: estado.animacionAncho, alto: estado.animacionAlto,
      formato: FORMATO_COMPRIMIDO, cantidad: z.cantidad,
    };
    archivo = base64ABytes(z.datos);
  } else {
    pantalla.tipo = 'texto';
  }
  return { pantalla, archivo };
}

export async function enviarEstado(estado) {
  try {
    // Alarma y ajustes se guardan por su propio camino (guardarAlarma / guardarAjustes).
    if (estado.tipo === 'alarma' || estado.tipo === 'ajustes') return { exito: true, version: await reservarVersion() };
    if (['actualizar', 'restablecer', 'juego'].includes(estado.tipo)) return { exito: false, error: NO_DISPONIBLE.error };

    await asegurarConexion();
    const version = await reservarVersion();

    if (estado.tipo === 'musical' || estado.tipo === 'cancion') {
      const clave = estado.tipo === 'musical' ? estado.musicalClave : estado.cancion;
      const repeticiones = Number(estado.tipo === 'musical' ? estado.musicalRepeticiones : estado.cancionRepeticiones) || 1;
      await ble.exclusivo(async () => {
        const id = await asegurarCancionEnTV(clave);
        await ble.tocar(id, repeticiones, estado.tipo === 'musical');
      });
      // Se recuerda como "canción" para que la app se abra en Canciones (con letra o sin ella).
      const pantalla = estado.tipo === 'musical'
        ? { tipo: 'musical', texto: estado.texto, config: {}, musical: { nombre: estado.musicalNombre || clave, repeticiones, formato: FORMATO_MUSICAL, clave } }
        : { tipo: 'cancion', texto: estado.texto, config: {}, cancion: { nombre: estado.cancion || clave, repeticiones } };
      await almacen.guardar('meta', claveTV('ultimo'), { version, pantalla, archivo: null });
      marcarMostrada(version);
      return { exito: true, version };
    }

    const { pantalla, archivo } = await armarPantalla(estado);
    await ble.exclusivo(() => ble.enviarContenido(pantalla, archivo, avanceEnvio));
    await almacen.guardar('meta', claveTV('ultimo'), { version, pantalla, archivo: archivo ? bytesABase64(archivo) : null });
    marcarMostrada(version);
    return { exito: true, version };
  } catch (err) {
    if (!(err instanceof ble.ErrorTV)) console.error('Error al enviar a la TV:', err);
    return { exito: false, error: describirErrorTV(err) };
  }
}

// ===================================================
// Alarma y ajustes de la TV (los guarda la TV; el celular recuerda lo que mandó)
// ===================================================
const CANTIDAD_ALARMAS = 3;
const DIAS_ALARMA_DEFECTO = 62; // lunes a viernes
const AJUSTES_DEFECTO = { brillo: 3, volumen: 3, zona: -300 };

const entero = (v, min, max, defecto) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : defecto;
};

function normalizarAlarmaUna(a) {
  const x = a && typeof a === 'object' ? a : {};
  return {
    activa: x.activa === true,
    hora: entero(x.hora, 0, 23, 7),
    minuto: entero(x.minuto, 0, 59, 0),
    dias: entero(x.dias, 0, 127, DIAS_ALARMA_DEFECTO),
  };
}

function normalizarAlarmaTV(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const lista = d.alarmas && typeof d.alarmas === 'object' ? d.alarmas : {};
  return {
    tono: typeof d.tono === 'string' ? d.tono.slice(0, 100) : '',
    alarmas: Array.from({ length: CANTIDAD_ALARMAS }, (_, i) => normalizarAlarmaUna(lista[i] ?? lista[String(i)])),
  };
}

function normalizarAjustesTV(datos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return {
    brillo: entero(d.brillo, 1, 3, AJUSTES_DEFECTO.brillo),
    volumen: entero(d.volumen, 0, 3, AJUSTES_DEFECTO.volumen),
    zona: entero(d.zona, -720, 840, AJUSTES_DEFECTO.zona),
    // Apagado automático de la pantalla (2026-11-23): minutos sin usar el botón; 0 = nunca. Si falta, 5.
    apagado: [0, 5, 10, 20].includes(Number(d.apagado)) ? Number(d.apagado) : 5,
  };
}

export async function cargarAlarma() {
  try {
    return { exito: true, alarma: normalizarAlarmaTV(await almacen.leer('meta', claveTV('alarma'))) };
  } catch (error) {
    return { exito: false, error: describirErrorTV(error) };
  }
}

export async function cargarAjustes() {
  try {
    return { exito: true, ajustes: normalizarAjustesTV(await almacen.leer('meta', claveTV('ajustes'))) };
  } catch (error) {
    return { exito: false, error: describirErrorTV(error) };
  }
}

/** Guarda la alarma en la TV (y, si la canción de la alarma no está en la TV, se la manda) y en el celular. */
export async function guardarAlarma(datos) {
  const alarma = normalizarAlarmaTV(datos);
  try {
    await asegurarConexion();
    await ble.exclusivo(async () => {
      let tonoId = 0;
      if (alarma.tono) tonoId = await asegurarCancionEnTV(alarma.tono);
      await ble.guardarAlarmasEnTV({ tonoId, alarmas: alarma.alarmas });
    });
    await almacen.guardar('meta', claveTV('alarma'), alarma);
    return { exito: true, version: await reservarVersion() };
  } catch (error) {
    if (!(error instanceof ble.ErrorTV)) console.error('Error al guardar la alarma:', error);
    return { exito: false, error: describirErrorTV(error) };
  }
}

export async function guardarAjustes(datos) {
  const ajustes = normalizarAjustesTV(datos);
  try {
    await asegurarConexion();
    await ble.exclusivo(() => ble.guardarAjustesEnTV(ajustes));
    await almacen.guardar('meta', claveTV('ajustes'), ajustes);
    return { exito: true, version: await reservarVersion() };
  } catch (error) {
    if (!(error instanceof ble.ErrorTV)) console.error('Error al guardar los ajustes de la TV:', error);
    return { exito: false, error: describirErrorTV(error) };
  }
}

// ===================================================
// Sistema de la TV (actualizar / restablecer): una TV Lite no lo tiene
// ===================================================
export async function cargarSistema() { return { exito: true, esDueno: false, firmware: null, manifiestoBuild: null }; }
export function suscribirFirmwareTV(callback) { callback(null); return () => {}; }

// ===================================================
// Añadir una TV Lite (lo usa la pantalla "Añade tu TV")
// ===================================================
/** La TV Lite que ya está emparejada con este celular ({ deviceId, name }) o null. */
export const tvVinculada = ble.tvVinculada;
export const abrirAjustesBluetooth = ble.abrirAjustesBluetooth;
/** Conecta con una TV Lite ya emparejada (por los ajustes de Bluetooth del celular). true si quedó conectada. */
export const conectarVinculada = ble.usarTVVinculada;
/** Muestra la lista de TV cercanas y se empareja desde la app (respaldo: lo normal es emparejar en los ajustes). Devuelve la dirección. */
export async function buscarYEmparejar() {
  await ble.buscar();
  return ble.idTVGuardada();
}
