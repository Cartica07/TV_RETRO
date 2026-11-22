// TV RETRO Lite: prueba de la app (paso 1 del plan de la app real).
// Mismo protocolo que lite/prueba-ble.js (OLED_Lite en el firmware), pero con el plugin
// @capacitor-community/bluetooth-le en vez de Web Bluetooth. Sirve para comprobar dos cosas:
// que el plugin alcanza la velocidad de Edge y que vincular con el PIN funciona dentro de la app.

import { BleClient, ConnectionPriority } from '@capacitor-community/bluetooth-le';

const SERVICIO = '7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const CTRL = '7a1c0002-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const DATOS = '7a1c0003-5e7d-4f0e-9a3b-0c1d2e3f4a5b';

const $ = (id) => document.getElementById(id);
const el = {
  conectar: $('conectar'), desconectar: $('desconectar'), estado: $('estado'),
  enviarHora: $('enviarHora'), pedirEstado: $('pedirEstado'),
  enviarPrueba: $('enviarPrueba'), repetir: $('repetir'), barrido: $('barrido'),
  progreso: $('progreso'), resultado: $('resultado'), registro: $('registro'),
};

let deviceId = null;
let ocupado = false;
let conectado = false;

// ---------- Utilidades ----------
function registrar(texto) {
  const t = new Date().toLocaleTimeString();
  el.registro.textContent += `[${t}] ${texto}\n`;
  el.registro.scrollTop = el.registro.scrollHeight;
}

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

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function datosDePrueba(n) {
  const b = new Uint8Array(n);
  let x = 0x12345678;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    b[i] = x & 255;
  }
  return b;
}

// ---------- Avisos de la TV ----------
const avisos = [];
let despertar = null;

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

// ---------- Conexión ----------
function marcar() {
  el.conectar.disabled = conectado;
  el.desconectar.disabled = !conectado;
  for (const b of [el.enviarHora, el.pedirEstado, el.enviarPrueba, el.repetir, el.barrido]) b.disabled = !conectado || ocupado;
  el.estado.textContent = conectado ? 'conectado' : 'sin conexión';
}

async function conectar() {
  try {
    await BleClient.initialize({ androidNeverForLocation: true });
    const dispositivo = await BleClient.requestDevice({ services: [SERVICIO] });
    deviceId = dispositivo.deviceId;
    registrar(`Conectando a ${dispositivo.name || 'la TV'}...`);
    await BleClient.connect(deviceId, () => { registrar('Se desconectó.'); conectado = false; marcar(); });
    conectado = true;
    marcar();
    try { await BleClient.requestConnectionPriority(deviceId, ConnectionPriority.CONNECTION_PRIORITY_HIGH); } catch (e) { registrar(`Prioridad alta: ${e.message || e}`); }

    // Vincular (con el PIN que muestra la TV) si todavía no hay vínculo.
    let vinculado = false;
    try { vinculado = await BleClient.isBonded(deviceId); } catch (e) { /* no disponible */ }
    if (!vinculado) {
      registrar('Vinculando: escribe en el celular el PIN que muestra la TV.');
      await BleClient.createBond(deviceId);
      registrar('Vínculo creado.');
    } else {
      registrar('Ya estaba vinculado.');
    }

    await BleClient.startNotifications(deviceId, SERVICIO, CTRL, alRecibirAviso);
    avisos.length = 0;
    try { registrar(`MTU: ${await BleClient.getMtu(deviceId)}`); } catch (e) { registrar(`MTU: ${e.message || e}`); }
    await pedirEstadoTV();
  } catch (e) {
    registrar(`No se pudo conectar: ${e.message || e}`);
    conectado = false;
    marcar();
  }
}

async function desconectar() {
  if (deviceId) { try { await BleClient.disconnect(deviceId); } catch (e) { /* ya estaba */ } }
  conectado = false; marcar();
}

async function enviarHora() {
  const ahora = Math.floor(Date.now() / 1000);
  const zona = -new Date().getTimezoneOffset();
  await escribirCtrl([0x01, ...u32(ahora), zona & 255, (zona >> 8) & 255]);
  registrar((await esperarAvisoTipo(0x81, 3000)) ? 'Hora enviada.' : 'La TV no confirmó la hora.');
}

async function pedirEstadoTV() {
  avisos.length = 0;
  await escribirCtrl([0x04]);
  const a = await esperarAvisoTipo(0x84, 3000);
  if (!a) { registrar('La TV no respondió al estado.'); return; }
  const vinculos = a.byteLength >= 10 ? a.getUint8(8) : '?';
  registrar(`Estado de la TV: MTU ${a.getUint16(2, true)}, memoria libre ${leer32(a, 4)} bytes, celulares vinculados ${vinculos}.`);
}

// ---------- Envío de un archivo de prueba ----------
async function enviarArchivo(tamano, trozo, ventana, banderas = 0) {
  const datos = datosDePrueba(tamano);
  const crc = crc32(datos);
  const total = Math.ceil(tamano / trozo);
  avisos.length = 0;

  await escribirCtrl([0x02, ...u32(tamano), ...u32(crc), ventana, banderas]);
  const inicio = await esperarAvisoTipo(0x82, 5000);
  if (!inicio) throw new Error('La TV no confirmó el inicio.');
  if (inicio.getUint8(1) !== 1) throw new Error('La TV no pudo preparar el archivo.');

  let sig = 0;
  let confirmado = 0;
  let reenvios = 0;
  const t0 = performance.now();

  while (confirmado < total) {
    while (sig < total && sig - confirmado < ventana * 2) {
      const ini = sig * trozo;
      const fin = Math.min(ini + trozo, tamano);
      const paquete = new Uint8Array(2 + (fin - ini));
      paquete[0] = sig & 255; paquete[1] = (sig >> 8) & 255;
      paquete.set(datos.subarray(ini, fin), 2);
      await BleClient.writeWithoutResponse(deviceId, SERVICIO, DATOS, new DataView(paquete.buffer));
      sig++;
    }
    el.progreso.value = Math.round((confirmado / total) * 100);
    const a = await siguienteAviso(4000);
    if (!a) throw new Error(`Sin respuesta de la TV (confirmados ${confirmado} de ${total}).`);
    const tipo = a.getUint8(0);
    if (tipo === 0x85) {
      confirmado = Math.max(confirmado, a.getUint16(1, true));
    } else if (tipo === 0x86) {
      const falta = a.getUint16(1, true);
      reenvios++;
      sig = falta; confirmado = falta;
    }
  }
  const ms = performance.now() - t0;
  el.progreso.value = 100;

  await escribirCtrl([0x03]);
  const fin = await esperarAvisoTipo(0x83, 10000);
  if (!fin) throw new Error('La TV no dio el resultado final.');
  const msTV = leer32(fin, 6);
  return {
    ok: fin.getUint8(1) === 1, ms, reenvios,
    kbs: (tamano / 1024) / (ms / 1000),
    kbsTV: msTV ? (leer32(fin, 2) / 1024) / (msTV / 1000) : 0,
    bytesTV: leer32(fin, 2),
  };
}

async function conOcupado(accion) {
  if (ocupado) return;
  ocupado = true; marcar();
  try { await accion(); } catch (e) {
    el.resultado.className = 'mal'; el.resultado.textContent = e.message || String(e);
    registrar(`Falló: ${e.message || e}`);
  } finally { ocupado = false; marcar(); }
}

async function correrPrueba(veces) {
  el.resultado.className = ''; el.resultado.textContent = 'Enviando...';
  const velocidades = [];
  for (let i = 1; i <= veces; i++) {
    const r = await enviarArchivo(102400, 500, 16, 0);
    registrar(`#${i}: ${r.ok ? 'OK' : 'ERROR'} · 102400 bytes en ${Math.round(r.ms)} ms · ${r.kbs.toFixed(1)} KB/s (app) · ${r.kbsTV.toFixed(1)} KB/s (TV) · reenvíos ${r.reenvios}`);
    if (!r.ok) { el.resultado.className = 'mal'; el.resultado.textContent = `ERROR en el envío #${i}`; return; }
    velocidades.push(r.kbs);
    el.resultado.className = 'ok';
    el.resultado.textContent = `100 KB en ${(r.ms / 1000).toFixed(1)} s (${r.kbs.toFixed(1)} KB/s)`;
    await pausa(300);
  }
  if (velocidades.length > 1) {
    const media = velocidades.reduce((a, b) => a + b, 0) / velocidades.length;
    registrar(`Promedio ${media.toFixed(1)} KB/s, la más lenta ${Math.min(...velocidades).toFixed(1)} KB/s.`);
  }
}

async function barrido() {
  el.resultado.className = ''; el.resultado.textContent = 'Barrido en curso...';
  for (const trozo of [244, 500]) {
    for (const ventana of [8, 16]) {
      const kbs = []; let fallos = 0, reenvios = 0;
      for (let i = 0; i < 3; i++) {
        try {
          const r = await enviarArchivo(102400, trozo, ventana, 0);
          if (r.ok) kbs.push(r.kbs); else fallos++;
          reenvios += r.reenvios;
        } catch (e) { fallos++; registrar(`  fallo: ${e.message || e}`); await pausa(500); }
        await pausa(250);
      }
      const media = kbs.length ? kbs.reduce((a, b) => a + b, 0) / kbs.length : 0;
      registrar(`trozo ${trozo} · ventana ${ventana}: ${media.toFixed(1)} KB/s (mín ${kbs.length ? Math.min(...kbs).toFixed(1) : '0'}), fallos ${fallos}, reenvíos ${reenvios}`);
    }
  }
  el.resultado.className = 'ok'; el.resultado.textContent = 'Barrido terminado';
  registrar('=== BARRIDO TERMINADO ===');
}

el.conectar.addEventListener('click', conectar);
el.desconectar.addEventListener('click', desconectar);
el.enviarHora.addEventListener('click', () => conOcupado(enviarHora));
el.pedirEstado.addEventListener('click', () => conOcupado(pedirEstadoTV));
el.enviarPrueba.addEventListener('click', () => conOcupado(() => correrPrueba(1)));
el.repetir.addEventListener('click', () => conOcupado(() => correrPrueba(5)));
el.barrido.addEventListener('click', () => conOcupado(barrido));
registrar('Listo. Pulsa "Conectar a la TV".');
