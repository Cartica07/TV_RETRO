// Comunicación con la TV Lite por Bluetooth LE (plugin @capacitor-community/bluetooth-le).
// Protocolo: ver OLED_Lite/ del repo del firmware y docs/evaluacion-version-lite.md.
// Solo se habla con UNA TV a la vez; el id de la última TV se recuerda para reconectar sin buscar.

import { BleClient, ConnectionPriority } from '@capacitor-community/bluetooth-le';

const SERVICIO = '7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const CTRL = '7a1c0002-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const DATOS = '7a1c0003-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const CLAVE_TV = 'tvretro.lite.tv';

// Lo que mejor midió el barrido de la prueba: trozos de 500 bytes y ventana de 16.
const TROZO = 500;
const VENTANA = 16;
// Si la TV no confirma en este tiempo se reenvía desde lo último confirmado; tras MAX_SILENCIOS intentos seguidos sin
// ningún avance se da por perdida la conexión.
const ESPERA_AVISO_MS = 1500;
const MAX_SILENCIOS = 5;

const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const leer32 = (dv, o) => dv.getUint32(o, true);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const aDataView = (bytes) => { const u = Uint8Array.from(bytes); return new DataView(u.buffer, u.byteOffset, u.byteLength); };

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Errores pensados para mostrarse tal cual al cliente.
export class ErrorTV extends Error {}

let iniciado = false;
let deviceId = null;
let conectado = false;
let alCambiar = () => {};
const avisos = [];
let despertar = null;

export function alCambiarConexion(f) { alCambiar = f; }
export function estaConectado() { return conectado; }
export function hayTVGuardada() { try { return !!localStorage.getItem(CLAVE_TV); } catch (e) { return false; } }
/** Id (dirección Bluetooth) de la última TV con la que se conectó la app, o null. La usa la app unificada. */
export function idTVGuardada() { try { return localStorage.getItem(CLAVE_TV) || null; } catch (e) { return null; } }
export function olvidarTV() { try { localStorage.removeItem(CLAVE_TV); } catch (e) { /* sin almacenamiento */ } }

function marcarConectado(si) {
  if (conectado === si) return;
  conectado = si;
  alCambiar(si);
}

function alRecibirAviso(valor) {
  avisos.push(new DataView(valor.buffer.slice(valor.byteOffset, valor.byteOffset + valor.byteLength)));
  if (despertar) { despertar(); despertar = null; }
}

function siguienteAviso(ms) {
  if (avisos.length) return Promise.resolve(avisos.shift());
  return new Promise((resolver) => {
    const reloj = setTimeout(() => { despertar = null; resolver(null); }, ms);
    despertar = () => { clearTimeout(reloj); resolver(avisos.shift() || null); };
  });
}

async function esperarAvisoTipo(tipo, ms) {
  const limite = performance.now() + ms;
  while (performance.now() < limite) {
    const a = await siguienteAviso(limite - performance.now());
    if (!a) break;
    if (a.getUint8(0) === tipo) return a;
  }
  return null;
}

const escribirCtrl = (bytes) => BleClient.write(deviceId, SERVICIO, CTRL, aDataView(bytes));

// Una sola acción a la vez, EN ORDEN (a prueba de dobles toques): las que llegan mientras otra está en
// curso esperan su turno en vez de fallar o pisarse en el canal.
let cola = Promise.resolve();
export function exclusivo(accion) {
  const turno = cola.then(() => accion());
  cola = turno.then(() => {}, () => {});
  return turno;
}

// ---------- Conexión ----------
// Tiempo que se espera a que la persona escriba el PIN (la ventana de la TV dura 5 minutos). El plugin espera
// solo 5 s si no se le dice otra cosa, y eso no alcanza para leer el PIN en la TV y escribirlo.
const ESPERA_VINCULO_MS = 280000;

// El celular aún no está vinculado con la TV y la conexión no es de un toque de la persona (reintento de fondo):
// no se debe iniciar el emparejamiento por sorpresa.
class ErrorSinVinculo extends Error {}
// El celular figura como vinculado pero la TV no lo reconoce (se muestra tal cual al cliente).
class ErrorVinculoRoto extends ErrorTV {}

// Avisa a la pantalla en qué paso va la conexión (lo conecta backend-lite.js).
let alEstado = () => {};
export function alCambiarEstado(f) { alEstado = f; }

// Avisa (con el texto para la persona) cuando la reconexión de fondo descubre que la TV ya no reconoce a este celular:
// sin esto la app solo mostraría "Desconectado". Lo usa la app unificada; la app Lite no lo conecta.
let alVinculoRotoAviso = () => {};
export function alVinculoRoto(f) { alVinculoRotoAviso = f; }

// Espera (sin pasarse de ESPERA_VINCULO_MS) a que el celular quede vinculado con la TV. Devuelve true si lo logró.
async function esperarVinculo() {
  const limite = performance.now() + ESPERA_VINCULO_MS;
  while (performance.now() < limite) {
    try { if (await BleClient.isBonded(deviceId)) return true; } catch (e) { return false; }
    await pausa(1000);
  }
  return false;
}

// Con `vincular` falso (reconexión de fondo) un celular sin vínculo no empareja: avisa con ErrorSinVinculo.
async function prepararCanal(vincular) {
  try { await BleClient.requestConnectionPriority(deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH); } catch (e) { /* no es crítico */ }

  // Si todavía no hay vínculo, se crea (el celular pide el PIN que muestra la TV).
  // (En la web el plugin no lo ofrece y el navegador se ocupa solo: ahí no hay nada que vincular.)
  let vinculado = true;
  try { vinculado = await BleClient.isBonded(deviceId); } catch (e) { /* no disponible */ }
  if (!vinculado) {
    if (!vincular) throw new ErrorSinVinculo('sin vínculo');
    alEstado('vincular');
    try {
      await BleClient.createBond(deviceId, { timeout: ESPERA_VINCULO_MS });
    } catch (e) {
      const texto = String((e && e.message) || e);
      // En la web (pruebas) el plugin no lo ofrece: no hay nada que vincular.
      if (!/not (implemented|available|supported)|unimplemented|unavailable/i.test(texto)) {
        // Android rechaza createBond si el emparejamiento ya empezó (lo inicia la propia TV al conectarse): en ese
        // caso se espera a que la persona lo termine en vez de darlo por fallido.
        if (!(/Creating bond failed/i.test(texto) && await esperarVinculo())) {
          throw new ErrorTV('No se pudo emparejar. Mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo.');
        }
      }
    }
  }

  avisos.length = 0;
  await BleClient.startNotifications(deviceId, SERVICIO, CTRL, alRecibirAviso);
}

async function conectarA(id, vincular) {
  deviceId = id;
  try {
    await BleClient.connect(id, () => { marcarConectado(false); });
    await prepararCanal(vincular);
  } catch (e) {
    // Una conexión a medias deja a la TV ocupada: mientras siga conectada no se anuncia y el celular no la encuentra.
    try { await BleClient.disconnect(id); } catch (e2) { /* ya estaba desconectada */ }
    marcarConectado(false);
    throw e;
  }
  try { localStorage.setItem(CLAVE_TV, id); } catch (e) { /* sin almacenamiento */ }
  marcarConectado(true);
  // La hora de la TV la da el celular en cada conexión (la TV no tiene internet).
  try {
    await exclusivo(() => ponerHora());
  } catch (e) {
    if (e instanceof ErrorTV) return; // la TV no contestó a tiempo: se vuelve a mandar en la próxima conexión
    // La escritura misma falló: el celular cree que está vinculado pero la TV ya no lo reconoce (la TV abrió el
    // emparejamiento otra vez o se olvidó el vínculo de un solo lado). Con esa conexión no se puede hacer nada.
    try { await BleClient.disconnect(id); } catch (e2) { /* ya estaba desconectada */ }
    marcarConectado(false);
    throw new ErrorVinculoRoto('La TV no reconoce este celular. Olvídala en Ajustes > Bluetooth del celular, mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo.');
  }
}

async function iniciar() {
  if (iniciado) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  iniciado = true;
}

// Una sola conexión a la vez: el reintento en segundo plano y un toque en "Enviar" no deben conectar dos veces
// (el canal de avisos tiene un solo receptor).
let enCurso = null;

async function esperarEnCurso() {
  try { await enCurso; } catch (e) { /* el que lo inició se ocupa del error */ }
}

// Si la última TV ya no reconoce a este celular (se olvidó el vínculo en el celular o la TV abrió el emparejamiento
// otra vez), la reconexión de fondo se detiene: cada intento ocuparía la conexión de la TV y no la dejaría anunciarse.
// Se reanuda cuando la persona vuelve a emparejar desde "Enviar".
let reconexionPausada = false;

// Al volver a la app (por ejemplo, tras emparejar desde los ajustes de Bluetooth del celular) se permite un intento más.
export function reanudarReconexion() { reconexionPausada = false; }

// Reconecta con la última TV usada (sin buscar y sin emparejar). Devuelve true si quedó conectada.
export async function reconectar() {
  if (conectado) return true;
  if (enCurso) { await esperarEnCurso(); return conectado; }
  if (reconexionPausada) return false;
  let id = null;
  try { id = localStorage.getItem(CLAVE_TV); } catch (e) { /* sin almacenamiento */ }
  if (!id) return false;
  enCurso = (async () => {
    await iniciar();
    // Sin vínculo no se conecta ni se intenta emparejar: conectarse a una TV que ofrece emparejar hace que el
    // celular muestre un aviso por su cuenta, y la conexión ocupa a la TV (deja de anunciarse).
    let vinculados = null;
    try { vinculados = await BleClient.getBondedDevices(); } catch (e) { /* no disponible (web): se intenta conectar */ }
    if (vinculados && !vinculados.some((d) => d.deviceId === id)) throw new ErrorSinVinculo('sin vínculo');
    await conectarA(id, false);
  })();
  try {
    await enCurso;
    return true;
  } catch (e) {
    marcarConectado(false);
    if (e instanceof ErrorSinVinculo || e instanceof ErrorVinculoRoto) reconexionPausada = true;
    if (e instanceof ErrorVinculoRoto) alVinculoRotoAviso(e.message);
    return false;
  } finally {
    enCurso = null;
  }
}

// ---------- TV ya emparejada desde los ajustes de Bluetooth del celular ----------
// Nombre Bluetooth de la TV: "Pepito Lite" desde el 2026-11-23 (decisión del dueño); "TV RETRO Lite" en el firmware anterior.
const NOMBRES_TV = ['Pepito Lite', 'TV RETRO Lite'];

// Dispositivos vinculados con el celular (solo Android). Devuelve null si no se pudo saber (web de pruebas, sin permiso).
async function vinculados() {
  if (typeof window !== 'undefined' && typeof window.__vinculadosPrueba === 'function') return window.__vinculadosPrueba();
  try {
    await iniciar();
    return await BleClient.getBondedDevices();
  } catch (e) {
    return null;
  }
}

/** La TV Lite que ya está emparejada con este celular ({ deviceId, name }) o null. */
export async function tvVinculada() {
  const lista = await vinculados();
  if (!lista) return null;
  return lista.find((d) => NOMBRES_TV.some((n) => String(d.name || '').startsWith(n))) || null;
}

/** Abre los ajustes de Bluetooth del celular (donde se empareja con el PIN que muestra la TV). */
export async function abrirAjustesBluetooth() {
  await iniciar();
  await BleClient.openBluetoothSettings();
}

/** Recuerda la TV que la persona emparejó en los ajustes del celular y se conecta con ella. true si quedó conectada. */
export async function usarTVVinculada(id) {
  try { localStorage.setItem(CLAVE_TV, id); } catch (e) { /* sin almacenamiento */ }
  reconexionPausada = false;
  return reconectar();
}

// Muestra la lista de TV cercanas del sistema, conecta con la elegida y, si hace falta, la empareja (PIN).
export async function buscar() {
  if (conectado) return;
  if (enCurso) { await esperarEnCurso(); if (conectado) return; }
  enCurso = (async () => {
    await iniciar();
    const d = await BleClient.requestDevice({ services: [SERVICIO] });
    await conectarA(d.deviceId, true);
  })();
  try {
    await enCurso;
    reconexionPausada = false;
  } catch (e) {
    marcarConectado(false);
    if (e instanceof ErrorTV) throw e;
    const texto = String((e && e.message) || e);
    if (/cancel/i.test(texto)) throw new ErrorTV('No elegiste ninguna TV.');
    throw new ErrorTV('No se pudo conectar con la TV. Acércate y vuelve a intentarlo.');
  } finally {
    enCurso = null;
  }
}

export async function desconectar() {
  if (deviceId) { try { await BleClient.disconnect(deviceId); } catch (e) { /* ya estaba */ } }
  marcarConectado(false);
}

// ---------- Comandos ----------
export async function ponerHora() {
  const ahora = Math.floor(Date.now() / 1000);
  const zona = -new Date().getTimezoneOffset();
  avisos.length = 0;
  await escribirCtrl([0x01, ...u32(ahora), zona & 255, (zona >> 8) & 255]);
  if (!(await esperarAvisoTipo(0x81, 3000))) throw new ErrorTV('La TV no respondió.');
}

export async function pedirEstado() {
  avisos.length = 0;
  await escribirCtrl([0x04]);
  const a = await esperarAvisoTipo(0x84, 3000);
  if (!a) throw new ErrorTV('La TV no respondió.');
  // Desde la Lite con actualización por Bluetooth (2026-11-23, sección 8.5 de la especificación) el aviso trae además la versión
  // del programa, el modelo (1 = C3, 2 = S3) y si esa versión está pendiente de darse por buena. Sin eso (10 bytes): build null.
  const largo = a.byteLength >= 16;
  return {
    mtu: a.getUint16(2, true), memoria: leer32(a, 4), vinculos: a.byteLength >= 10 ? a.getUint8(8) : null,
    build: largo ? leer32(a, 10) : null, modelo: largo ? a.getUint8(14) : null, pendiente: largo ? a.getUint8(15) === 1 : null,
  };
}

// Ids de las canciones que la TV ya tiene guardadas.
export async function listar() {
  avisos.length = 0;
  await escribirCtrl([0x10]);
  const a = await esperarAvisoTipo(0x90, 3000);
  if (!a) throw new ErrorTV('La TV no respondió.');
  const n = a.getUint8(1);
  const ids = new Set();
  for (let i = 0; i < n; i++) ids.add(a.getUint16(2 + 2 * i, true));
  return ids;
}

export async function tocar(id, repeticiones, conLetra) {
  avisos.length = 0;
  await escribirCtrl([0x12, id & 255, (id >> 8) & 255, Math.max(1, Math.min(255, repeticiones)), conLetra ? 1 : 0]);
  const a = await esperarAvisoTipo(0x92, 4000);
  if (!a) throw new ErrorTV('La TV no respondió.');
  if (a.getUint8(1) !== 1) throw new ErrorTV('La TV no pudo tocar la canción.');
}

export async function parar() {
  avisos.length = 0;
  await escribirCtrl([0x13]);
  if (!(await esperarAvisoTipo(0x93, 3000))) throw new ErrorTV('La TV no respondió.');
}

// ---------- Envío de un archivo ----------
// "extra": { id } para guardarlo como canción en la biblioteca de la TV; "banderas" para las pruebas;
// "build": el envío es un PROGRAMA nuevo para la TV (bit 5, sección 8.5 de la especificación).
// Devuelve { ok, ms, reenvios, kbs, msTotalTV, motivo }.

// La TV no aceptó empezar a recibir un programa: "codigo" es el valor del aviso 0x82 (0 no válido, 2 ya tiene esa versión o una
// más nueva, 3 no cabe, 4 ocupada).
export class ErrorInicioPrograma extends ErrorTV {
  constructor(codigo) { super('La TV no pudo empezar la actualización.'); this.codigo = codigo; }
}

export async function enviarArchivo(datos, { id = null, banderas = 0, build = null, alProgreso = () => {} } = {}) {
  const tamano = datos.length;
  const crc = crc32(datos);
  const total = Math.ceil(tamano / TROZO);
  avisos.length = 0;

  const programa = build !== null;
  const cabecera = [0x02, ...u32(tamano), ...u32(crc), VENTANA, programa ? 32 : id !== null ? (banderas | 4) : banderas];
  if (id !== null) cabecera.push(id & 255, (id >> 8) & 255);
  if (programa) cabecera.push(0, 0, ...u32(build));
  await escribirCtrl(cabecera);
  const inicio = await esperarAvisoTipo(0x82, 5000);
  if (!inicio) throw new ErrorTV('La TV no respondió.');
  if (inicio.getUint8(1) !== 1) {
    if (programa) throw new ErrorInicioPrograma(inicio.getUint8(1));
    throw new ErrorTV('La TV no tiene espacio para esto.');
  }

  let sig = 0;
  let confirmado = 0;
  let reenvios = 0;
  let silencios = 0;
  const t0 = performance.now();

  while (confirmado < total) {
    while (sig < total && sig - confirmado < VENTANA * 2) {
      const ini = sig * TROZO;
      const fin = Math.min(ini + TROZO, tamano);
      const paquete = new Uint8Array(2 + (fin - ini));
      paquete[0] = sig & 255; paquete[1] = (sig >> 8) & 255;
      paquete.set(datos.subarray(ini, fin), 2);
      await BleClient.writeWithoutResponse(deviceId, SERVICIO, DATOS, new DataView(paquete.buffer));
      sig++;
    }
    alProgreso(confirmado / total);
    const a = await siguienteAviso(ESPERA_AVISO_MS);
    if (!a) {
      // La TV no dijo nada (se perdieron los últimos trozos, o su confirmación): se reenvía desde lo último
      // confirmado. Si pasa varias veces seguidas, la conexión se perdió de verdad.
      if (++silencios > MAX_SILENCIOS) throw new ErrorTV('Se perdió la conexión con la TV.');
      reenvios++;
      sig = confirmado;
      continue;
    }
    const tipo = a.getUint8(0);
    if (tipo === 0x85) {
      const c = a.getUint16(1, true);
      if (c > confirmado) { confirmado = c; silencios = 0; }
    } else if (tipo === 0x86) {
      // La TV avisa UNA vez por hueco: le faltó el trozo "falta". Todo lo anterior le llegó bien.
      const falta = a.getUint16(1, true);
      if (falta >= confirmado && falta <= sig) {
        reenvios++;
        sig = falta; confirmado = falta;
      }
    }
  }
  const ms = performance.now() - t0;
  alProgreso(1);

  await escribirCtrl([0x03]);
  const fin = await esperarAvisoTipo(0x83, 10000);
  if (!fin) throw new ErrorTV('La TV no respondió.');
  return {
    ok: fin.getUint8(1) === 1, ms, reenvios,
    kbs: (tamano / 1024) / (ms / 1000),
    msTotalTV: fin.byteLength >= 14 ? leer32(fin, 10) : leer32(fin, 6),
    // Solo con un programa (bit 5): 0 bien, 1 incompleto o dañado, 2 firma o huella no válidas, 3 no es para esta TV.
    motivo: fin.byteLength >= 15 ? fin.getUint8(14) : null,
  };
}

// ---------- Contenido (texto, imagen, GIF…) ----------
// Lo que la app Pro escribía en Firebase (pantalla + archivo) viaja aquí en UN solo envío:
//   [u16 largo del JSON][JSON de "pantalla", UTF-8][archivo: bytes de un GIF comprimido z1, si lo hay]
// y se marca con la bandera 8 en el INICIO. La TV lo guarda, lo comprueba (CRC32) y lo muestra.
export function empaquetarContenido(pantalla, archivo = null) {
  const json = new TextEncoder().encode(JSON.stringify(pantalla));
  if (json.length > 0xFFFF) throw new ErrorTV('Eso es demasiado grande para la TV.');
  const extra = archivo || new Uint8Array(0);
  const todo = new Uint8Array(2 + json.length + extra.length);
  todo[0] = json.length & 255; todo[1] = json.length >> 8;
  todo.set(json, 2);
  todo.set(extra, 2 + json.length);
  return todo;
}

export async function enviarContenido(pantalla, archivo, alProgreso = () => {}) {
  const r = await enviarArchivo(empaquetarContenido(pantalla, archivo), { banderas: 8, alProgreso });
  if (!r.ok) throw new ErrorTV('Lo que enviaste no llegó bien. Vuelve a intentarlo.');
  return r;
}

// ---------- Alarmas y ajustes (la TV los guarda y funcionan sin el celular) ----------
// ALARMAS: [0x20][tono u16 (0 = aviso simple)] y 3 × [activa][hora][minuto][días]  ->  aviso [0xA0][1]
export async function guardarAlarmasEnTV({ tonoId, alarmas }) {
  const bytes = [0x20, (tonoId || 0) & 255, ((tonoId || 0) >> 8) & 255];
  for (let i = 0; i < 3; i++) {
    const a = alarmas[i] || {};
    bytes.push(a.activa ? 1 : 0, a.hora | 0, a.minuto | 0, a.dias | 0);
  }
  avisos.length = 0;
  await escribirCtrl(bytes);
  const r = await esperarAvisoTipo(0xA0, 4000);
  if (!r) throw new ErrorTV('La TV no respondió.');
  if (r.getUint8(1) !== 1) throw new ErrorTV('La TV no pudo guardar la alarma.');
}

// AJUSTES: [0x22][brillo][volumen][zona i16, minutos][apagado u8, opcional]  ->  aviso [0xA2][1]
// "apagado" (minutos sin usar el botón para que la pantalla se apague: 0 = nunca, 5, 10, 20) lo manda solo quien lo conoce
// (la app Pepito, desde el 2026-11-23); sin él la TV usa 5. Un firmware anterior ignora el byte de más.
export async function guardarAjustesEnTV({ brillo, volumen, zona, apagado }) {
  avisos.length = 0;
  const bytes = [0x22, brillo & 255, volumen & 255, zona & 255, (zona >> 8) & 255];
  if (typeof apagado === 'number') bytes.push(apagado & 255);
  await escribirCtrl(bytes);
  const r = await esperarAvisoTipo(0xA2, 4000);
  if (!r) throw new ErrorTV('La TV no respondió.');
  if (r.getUint8(1) !== 1) throw new ErrorTV('La TV no pudo guardar los ajustes.');
}

// Archivo pseudoaleatorio para medir la velocidad (Diagnóstico).
export function datosDePrueba(n) {
  const b = new Uint8Array(n);
  let x = 0x12345678;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    b[i] = x & 255;
  }
  return b;
}

export { pausa };
