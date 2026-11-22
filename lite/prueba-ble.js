// TV RETRO Lite: prueba de velocidad del Bluetooth (rama "lite").
// Habla con OLED_Lite.ino (repo del firmware, carpeta OLED_Lite). Solo para medir.
// Abrir en Chrome de Android desde http://localhost (con "adb reverse") o desde HTTPS.

const UUID_SERVICIO = '7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const UUID_CTRL = '7a1c0002-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
const UUID_DATOS = '7a1c0003-5e7d-4f0e-9a3b-0c1d2e3f4a5b';

const $ = (id) => document.getElementById(id);
const el = {
  conectar: $('conectar'), desconectar: $('desconectar'), estado: $('estado'),
  enviarHora: $('enviarHora'), pedirEstado: $('pedirEstado'),
  tamano: $('tamano'), trozo: $('trozo'), ventana: $('ventana'),
  enviarPrueba: $('enviarPrueba'), repetir: $('repetir'),
  guardar: $('guardar'), pantalla: $('pantalla'), barrido: $('barrido'),
  progreso: $('progreso'), resultado: $('resultado'), registro: $('registro'),
};

let dispositivo = null;
let caracCtrl = null;
let caracDatos = null;
let ocupado = false;

// ---------- Utilidades ----------
function registrar(texto) {
  const t = new Date().toLocaleTimeString();
  el.registro.textContent += `[${t}] ${texto}\n`;
  el.registro.scrollTop = el.registro.scrollHeight;
}

function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
function leer32(dv, o) { return dv.getUint32(o, true); }

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
  // Bytes pseudoaleatorios (para que ningún trozo se parezca a otro).
  const b = new Uint8Array(n);
  let x = 0x12345678;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    b[i] = x & 255;
  }
  return b;
}

function pausa(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- Avisos de la TV (notificaciones de CTRL) ----------
const avisos = [];
let despertar = null;

function alRecibirAviso(ev) {
  const dv = ev.target.value;
  avisos.push(new DataView(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength)));
  if (despertar) { despertar(); despertar = null; }
}

// Espera el próximo aviso (o null si pasan "ms").
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

async function escribirCtrl(arreglo) {
  await caracCtrl.writeValueWithResponse(new Uint8Array(arreglo));
}

// ---------- Conexión ----------
function marcarConectado(si) {
  el.conectar.disabled = si;
  el.desconectar.disabled = !si;
  for (const b of [el.enviarHora, el.pedirEstado, el.enviarPrueba, el.repetir, el.barrido]) b.disabled = !si || ocupado;
  el.estado.textContent = si ? 'conectado' : 'sin conexión';
}

async function conectar() {
  if (!navigator.bluetooth) {
    registrar('Este navegador no tiene Web Bluetooth. Usa Chrome en Android.');
    return;
  }
  try {
    dispositivo = await navigator.bluetooth.requestDevice({ filters: [{ services: [UUID_SERVICIO] }] });
    dispositivo.addEventListener('gattserverdisconnected', () => { registrar('Se desconectó.'); marcarConectado(false); });
    registrar(`Conectando a ${dispositivo.name}...`);
    const servidor = await dispositivo.gatt.connect();
    const servicio = await servidor.getPrimaryService(UUID_SERVICIO);
    caracCtrl = await servicio.getCharacteristic(UUID_CTRL);
    caracDatos = await servicio.getCharacteristic(UUID_DATOS);
    await caracCtrl.startNotifications();
    caracCtrl.addEventListener('characteristicvaluechanged', alRecibirAviso);
    avisos.length = 0;
    marcarConectado(true);
    registrar('Conectado. Si el celular pide un PIN, escríbelo: está en la pantalla de la TV.');
    try {
      await pedirEstadoTV();
    } catch (e) {
      registrar(`La TV no dejó escribir (¿falta emparejar?): ${e.message}`);
    }
  } catch (e) {
    registrar(`No se pudo conectar: ${e.message}`);
    marcarConectado(false);
  }
}

function desconectar() {
  if (dispositivo && dispositivo.gatt.connected) dispositivo.gatt.disconnect();
}

async function enviarHora() {
  const ahora = Math.floor(Date.now() / 1000);
  const zona = -new Date().getTimezoneOffset();
  await escribirCtrl([0x01, ...u32(ahora), zona & 255, (zona >> 8) & 255]);
  const a = await esperarAvisoTipo(0x81, 3000);
  registrar(a ? 'Hora enviada.' : 'La TV no confirmó la hora.');
}

async function pedirEstadoTV() {
  await escribirCtrl([0x04]);
  const a = await esperarAvisoTipo(0x84, 3000);
  if (!a) { registrar('La TV no respondió al estado.'); return; }
  const vinculos = a.byteLength >= 10 ? a.getUint8(8) : '?';
  const ventana = a.byteLength >= 10 ? (a.getUint8(9) ? 'abierta' : 'cerrada') : '?';
  registrar(`Estado de la TV: MTU ${a.getUint16(2, true)}, memoria libre ${leer32(a, 4)} bytes, celulares vinculados ${vinculos}, ventana de emparejamiento ${ventana}.`);
}

// ---------- Envío del archivo de prueba ----------
// banderas: bit 0 = guardar en la memoria de la TV, bit 1 = dibujar la pantalla al recibir.
// Devuelve { ok, ms, kbs, kbsTV, reenvios, msTotalTV }.
async function enviarArchivo(tamano, trozo, ventana, banderas = 0) {
  const datos = datosDePrueba(tamano);
  const crc = crc32(datos);
  const total = Math.ceil(tamano / trozo);
  avisos.length = 0;

  await escribirCtrl([0x02, ...u32(tamano), ...u32(crc), ventana, banderas]);
  const inicio = await esperarAvisoTipo(0x82, 5000);
  if (!inicio) throw new Error('La TV no confirmó el inicio.');
  if (inicio.getUint8(1) !== 1) throw new Error('La TV no pudo preparar el archivo.');

  let sig = 0;          // próximo trozo a enviar
  let confirmado = 0;   // trozos que la TV ya aceptó
  let reenvios = 0;
  const t0 = performance.now();

  while (confirmado < total) {
    // Enviar mientras haya espacio en la ventana.
    while (sig < total && sig - confirmado < ventana * 2) {
      const ini = sig * trozo;
      const fin = Math.min(ini + trozo, tamano);
      const paquete = new Uint8Array(2 + (fin - ini));
      paquete[0] = sig & 255; paquete[1] = (sig >> 8) & 255;
      paquete.set(datos.subarray(ini, fin), 2);
      await caracDatos.writeValueWithoutResponse(paquete);
      sig++;
    }
    el.progreso.value = Math.round((confirmado / total) * 100);
    // Esperar una confirmación (o un aviso de que falta un trozo).
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
  const ok = fin.getUint8(1) === 1;
  const msTV = leer32(fin, 6);
  const msTotalTV = fin.byteLength >= 14 ? leer32(fin, 10) : msTV;
  return {
    ok, ms, reenvios, msTotalTV,
    kbs: (tamano / 1024) / (ms / 1000),
    kbsTV: msTV ? (leer32(fin, 2) / 1024) / (msTV / 1000) : 0,
    bytesTV: leer32(fin, 2),
  };
}

function banderasElegidas() {
  return (el.guardar.checked ? 1 : 0) | (el.pantalla.checked ? 2 : 0);
}

async function correrPrueba(veces) {
  if (ocupado) return;
  ocupado = true; marcarConectado(true);
  el.resultado.className = ''; el.resultado.textContent = 'Enviando...';
  const tamano = Number(el.tamano.value), trozo = Number(el.trozo.value), ventana = Number(el.ventana.value);
  const velocidades = [];
  try {
    for (let i = 1; i <= veces; i++) {
      const r = await enviarArchivo(tamano, trozo, ventana, banderasElegidas());
      registrar(`#${i}: ${r.ok ? 'OK' : 'ERROR'} · ${tamano} bytes en ${Math.round(r.ms)} ms · ${r.kbs.toFixed(1)} KB/s (celular) · ${r.kbsTV.toFixed(1)} KB/s (TV) · todo guardado a los ${r.msTotalTV} ms · reenvíos ${r.reenvios} · la TV recibió ${r.bytesTV} bytes`);
      if (!r.ok) { el.resultado.className = 'mal'; el.resultado.textContent = `ERROR en el envío #${i}`; break; }
      velocidades.push(r.kbs);
      el.resultado.className = 'ok';
      el.resultado.textContent = `${tamano / 1024} KB en ${(r.ms / 1000).toFixed(1)} s (${r.kbs.toFixed(1)} KB/s)`;
      await pausa(300);
    }
    if (velocidades.length > 1) {
      const media = velocidades.reduce((a, b) => a + b, 0) / velocidades.length;
      const minima = Math.min(...velocidades);
      registrar(`Promedio ${media.toFixed(1)} KB/s, la más lenta ${minima.toFixed(1)} KB/s.`);
    }
  } catch (e) {
    el.resultado.className = 'mal'; el.resultado.textContent = e.message;
    registrar(`Falló: ${e.message}`);
  } finally {
    ocupado = false; marcarConectado(!!(dispositivo && dispositivo.gatt.connected));
  }
}

// Barrido: prueba varias combinaciones con 100 KB, 3 envíos cada una, y deja una tabla en el registro.
async function barrido() {
  if (ocupado) return;
  ocupado = true; marcarConectado(true);
  el.resultado.className = ''; el.resultado.textContent = 'Barrido en curso...';
  const tamano = 102400;
  const trozos = [244, 500];
  const ventanas = [4, 8, 16, 32];
  const modos = [
    { nombre: 'solo recibir', banderas: 0 },
    { nombre: 'guardar + dibujar', banderas: 3 },
  ];
  const filas = [];
  try {
    for (const modo of modos) {
      for (const trozo of trozos) {
        for (const ventana of ventanas) {
          const kbs = [];
          let fallos = 0, reenvios = 0, msTotal = 0;
          for (let i = 0; i < 3; i++) {
            try {
              const r = await enviarArchivo(tamano, trozo, ventana, modo.banderas);
              if (r.ok) { kbs.push(r.kbs); msTotal += r.msTotalTV; } else fallos++;
              reenvios += r.reenvios;
            } catch (e) { fallos++; registrar(`  fallo: ${e.message}`); await pausa(500); }
            await pausa(250);
          }
          const media = kbs.length ? kbs.reduce((a, b) => a + b, 0) / kbs.length : 0;
          const minima = kbs.length ? Math.min(...kbs) : 0;
          const linea = `${modo.nombre} · trozo ${trozo} · ventana ${ventana}: ${media.toFixed(1)} KB/s (mín ${minima.toFixed(1)}), fallos ${fallos}, reenvíos ${reenvios}` +
            (modo.banderas & 1 && kbs.length ? `, guardado completo en ${Math.round(msTotal / kbs.length)} ms` : '');
          registrar(linea);
          filas.push(linea);
        }
      }
    }
    el.resultado.className = 'ok'; el.resultado.textContent = 'Barrido terminado';
    registrar('=== BARRIDO TERMINADO ===');
  } catch (e) {
    el.resultado.className = 'mal'; el.resultado.textContent = e.message;
    registrar(`Barrido interrumpido: ${e.message}`);
  } finally {
    ocupado = false; marcarConectado(!!(dispositivo && dispositivo.gatt.connected));
  }
}

el.barrido.addEventListener('click', barrido);
el.conectar.addEventListener('click', conectar);
el.desconectar.addEventListener('click', desconectar);
el.enviarHora.addEventListener('click', () => enviarHora().catch((e) => registrar(e.message)));
el.pedirEstado.addEventListener('click', () => pedirEstadoTV().catch((e) => registrar(e.message)));
el.enviarPrueba.addEventListener('click', () => correrPrueba(1));
el.repetir.addEventListener('click', () => correrPrueba(5));
registrar(navigator.bluetooth ? 'Listo. Pulsa "Conectar a la TV".' : 'Este navegador no tiene Web Bluetooth. Usa Chrome en Android.');
