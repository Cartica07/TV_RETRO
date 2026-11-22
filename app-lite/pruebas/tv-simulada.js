// TV RETRO Lite SIMULADA: un Bluetooth falso (navigator.bluetooth) que responde como el firmware OLED_Lite.
// Solo para las pruebas de la app (banco-lite.mjs la inyecta antes de cargar la página). Refleja el protocolo de
// docs/evaluacion-version-lite.md sección 5 y 8; si el firmware cambia, hay que cambiar también esto.
// Expone window.__tv para que las pruebas miren lo que "recibió la TV".
(() => {
  const SERVICIO = '7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
  const CTRL = '7a1c0002-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
  const DATOS = '7a1c0003-5e7d-4f0e-9a3b-0c1d2e3f4a5b';
  const MARGEN_LIBRE = 16384;

  const TABLA = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const leer32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

  const tv = {
    capacidad: 1441792,            // bytes de almacenamiento (LittleFS de la C3)
    biblioteca: new Map(),         // id -> { bytes, uso }
    contadorUso: 0,
    hora: null, zona: 0,           // la que puso el celular
    contenido: null,               // último contenido recibido: { pantalla, archivo: Uint8Array|null }
    contenidos: 0,                 // cuántos contenidos se recibieron
    alarmas: null,                 // { tonoId, alarmas: [{activa,hora,minuto,dias}] }
    ajustes: null,                 // { brillo, volumen, zona }
    sonando: null,                 // { id, repeticiones, conLetra }
    vinculado: true,
    conectado: false,
    escrituras: [],                // bitácora de comandos (para las pruebas)
    perderDatos: 0,                // descartar N trozos (simula pérdidas)
    sinResponder: false,           // no responder a CTRL (simula una TV colgada)
    rechazarBusqueda: false,       // el usuario cierra la lista de TV sin elegir ninguna
    noConectar: false,             // la conexión falla (TV apagada o lejos)
    dispositivo: null,
  };
  let rx = null;                   // recepción en curso
  let caracCtrl = null;

  const usado = () => { let s = 0; for (const v of tv.biblioteca.values()) s += v.bytes.length; return s; };
  const libre = () => Math.max(0, tv.capacidad - usado());
  const protegidos = () => new Set(tv.alarmas && tv.alarmas.tonoId ? [tv.alarmas.tonoId] : []);

  function hacerEspacio(tam) {
    if (tam + MARGEN_LIBRE > tv.capacidad) return false;
    while (libre() < tam + MARGEN_LIBRE && tv.biblioteca.size) {
      // La menos usada que NO sea el tono de una alarma.
      let menor = null;
      for (const [id, v] of tv.biblioteca) if (!protegidos().has(id) && (menor === null || v.uso < tv.biblioteca.get(menor).uso)) menor = id;
      if (menor === null) return false;
      tv.biblioteca.delete(menor);
    }
    return libre() >= tam + MARGEN_LIBRE;
  }

  function avisar(bytes) {
    if (!caracCtrl || !tv.conectado) return;
    const dv = new DataView(Uint8Array.from(bytes).buffer);
    setTimeout(() => {
      const ev = new Event('characteristicvaluechanged');
      Object.defineProperty(ev, 'target', { value: { value: dv, service: { device: tv.dispositivo, uuid: SERVICIO }, uuid: CTRL } });
      caracCtrl.dispatchEvent(ev);
    }, 0);
  }

  function cmdCtrl(d) {
    if (tv.sinResponder) return;
    tv.escrituras.push(d[0]);
    switch (d[0]) {
      case 0x01: tv.hora = leer32(d, 1); tv.zona = (d[5] | (d[6] << 8)) << 16 >> 16; avisar([0x81, 1]); break;
      case 0x02: {
        const tam = leer32(d, 1), crc = leer32(d, 5), ventana = d[9] || 1, banderas = d[10] || 0;
        const esCancion = !!(banderas & 4), contenido = !!(banderas & 8);
        const id = esCancion ? (d[11] | (d[12] << 8)) : 0;
        let ok = true;
        if (esCancion) { tv.sonando = null; ok = hacerEspacio(tam); }
        rx = ok ? { tam, crc, ventana, esCancion, contenido, id, seq: 0, partes: [], bytes: 0, aceptados: 0 } : null;
        avisar([0x82, ok ? 1 : 0]);
        break;
      }
      case 0x03: {
        if (!rx) { avisar([0x83, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); break; }
        const todo = new Uint8Array(rx.bytes);
        let p = 0; for (const x of rx.partes) { todo.set(x, p); p += x.length; }
        const ok = todo.length === rx.tam && crc32(todo) === rx.crc;
        if (ok && rx.esCancion) tv.biblioteca.set(rx.id, { bytes: todo, uso: ++tv.contadorUso });
        if (ok && rx.contenido) {
          const lj = todo[0] | (todo[1] << 8);
          const pantalla = JSON.parse(new TextDecoder().decode(todo.subarray(2, 2 + lj)));
          const resto = todo.subarray(2 + lj);
          tv.contenido = { pantalla, archivo: resto.length ? new Uint8Array(resto) : null };
          tv.contenidos++;
          tv.sonando = null;
        }
        const n = todo.length;
        rx = null;
        avisar([0x83, ok ? 1 : 0, ...u32(n), ...u32(1), ...u32(2)]);
        break;
      }
      case 0x04: avisar([0x84, 1, 0xFF & 517, 517 >> 8, ...u32(200000), tv.vinculado ? 1 : 0, 0]); break;
      case 0x10: { const ids = [...tv.biblioteca.keys()].slice(0, 100); avisar([0x90, ids.length, ...ids.flatMap((i) => [i & 255, i >> 8])]); break; }
      case 0x12: {
        const id = d[1] | (d[2] << 8);
        const ok = tv.biblioteca.has(id) && !rx;
        if (ok) { tv.sonando = { id, repeticiones: d[3], conLetra: d[4] !== 0 }; tv.biblioteca.get(id).uso = ++tv.contadorUso; }
        avisar([0x92, ok ? 1 : 0, id & 255, id >> 8]);
        break;
      }
      case 0x13: tv.sonando = null; avisar([0x93, 1]); break;
      case 0x14: tv.sonando = null; tv.biblioteca.clear(); avisar([0x94, 1]); break;
      case 0x15: avisar([0x95, tv.biblioteca.size, ...u32(libre()), ...u32(tv.capacidad)]); break;
      case 0x20: {
        const alarmas = [];
        for (let i = 0; i < 3; i++) alarmas.push({ activa: d[3 + i * 4] === 1, hora: d[4 + i * 4], minuto: d[5 + i * 4], dias: d[6 + i * 4] });
        tv.alarmas = { tonoId: d[1] | (d[2] << 8), alarmas };
        avisar([0xA0, 1]);
        break;
      }
      case 0x22: tv.ajustes = { brillo: d[1], volumen: d[2], zona: (d[3] | (d[4] << 8)) << 16 >> 16 }; avisar([0xA2, 1]); break;
      default: break;
    }
  }

  function datos(d) {
    if (!rx) return;
    if (tv.perderDatos > 0) { tv.perderDatos--; return; }
    const seq = d[0] | (d[1] << 8);
    if (seq !== rx.seq) { avisar([0x86, rx.seq & 255, rx.seq >> 8]); return; }
    const carga = d.subarray(2);
    rx.partes.push(new Uint8Array(carga));
    rx.bytes += carga.length;
    rx.seq++;
    if (++rx.aceptados >= rx.ventana || rx.bytes >= rx.tam) { rx.aceptados = 0; avisar([0x85, rx.seq & 255, rx.seq >> 8]); }
  }

  const crearCaracteristica = (uuid) => {
    const c = new EventTarget();
    c.uuid = uuid;
    c.startNotifications = async () => c;
    c.writeValueWithResponse = async (buf) => { if (!tv.conectado) throw new Error('GATT Server is disconnected.'); const d = new Uint8Array(buf.buffer || buf); if (uuid === CTRL) cmdCtrl(d); };
    c.writeValueWithoutResponse = async (buf) => { if (!tv.conectado) throw new Error('GATT Server is disconnected.'); const d = new Uint8Array(buf.buffer || buf); if (uuid === DATOS) datos(d); };
    c.writeValue = c.writeValueWithResponse;
    return c;
  };
  caracCtrl = crearCaracteristica(CTRL);
  const caracDatos = crearCaracteristica(DATOS);

  const servicio = { uuid: SERVICIO, getCharacteristic: async (u) => (u === CTRL ? caracCtrl : caracDatos), getCharacteristics: async () => [caracCtrl, caracDatos] };
  const dispositivo = new EventTarget();
  dispositivo.id = 'tv-simulada';
  dispositivo.name = 'TV RETRO Lite';
  dispositivo.gatt = {
    connected: false,
    connect: async () => { if (tv.noConectar) throw new Error('GATT Error Unknown.'); tv.conectado = true; dispositivo.gatt.connected = true; return dispositivo.gatt; },
    disconnect: () => { tv.conectado = false; dispositivo.gatt.connected = false; dispositivo.dispatchEvent(Object.assign(new Event('gattserverdisconnected'), {})); },
    getPrimaryService: async () => servicio,
    getPrimaryServices: async () => [servicio],
  };
  Object.defineProperty(caracCtrl, 'service', { value: { device: dispositivo, uuid: SERVICIO } });
  tv.dispositivo = dispositivo;

  tv.desconectar = () => dispositivo.gatt.disconnect();
  tv.estado = () => ({
    hora: tv.hora, zona: tv.zona, contenidos: tv.contenidos, sonando: tv.sonando, alarmas: tv.alarmas, ajustes: tv.ajustes,
    biblioteca: [...tv.biblioteca.keys()], libre: libre(), conectado: tv.conectado, escrituras: tv.escrituras.length,
  });
  window.__tv = tv;

  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: {
      getAvailability: async () => true,
      requestDevice: async () => { if (tv.rechazarBusqueda) throw Object.assign(new Error('User cancelled the requestDevice() chooser.'), { name: 'NotFoundError' }); return dispositivo; },
      getDevices: async () => [dispositivo],
      addEventListener() {}, removeEventListener() {},
    },
  });
})();
