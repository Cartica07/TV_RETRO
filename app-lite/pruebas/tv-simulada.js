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
    rechazarEscrituras: false,     // la TV ya no reconoce a este celular (vínculo roto de un solo lado): toda escritura falla
    conexiones: 0,                 // cuántas veces se conectó (las pruebas de concurrencia lo miran)
    dispositivo: null,
    // Actualización por Bluetooth (bit 5, sección 8.5 de la especificación, 2026-11-23):
    build: 1,                      // versión del programa (null = Lite anterior, sin actualización: ESTADO de 10 bytes)
    modelo: 1,                     // 1 = C3, 2 = S3
    pendiente: false,              // versión recién instalada que todavía no se dio por buena
    clavesPublicas: [],            // claves públicas (SPKI en Base64) con las que se verifica la firma; las pone la prueba
    ocupada: false,                // simula una alarma sonando (el INICIO del programa responde 4)
    caerAlArrancar: false,         // la versión nueva se cae al arrancar: el arranque vuelve solo a la anterior
    tamanoEspacio: 1310720,        // el otro espacio de programa (1,25 MB)
    msReinicio: 300,               // lo que tarda en volver a aceptar conexiones tras reiniciarse
    programas: [],                 // bitácora de actualizaciones: { build, ok, motivo }
    reinicios: 0,
  };
  let reiniciandoHasta = 0;
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

  const MODELOS = { 1: 'c3', 2: 's3' };
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64aBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  // Lo que hace la TV al FIN de un programa: tamaño y CRC, huella, firma ("lite|modelo|build|tamaño|sha256") y que sea para su
  // chip (aquí: que empiece con el byte mágico 0xE9 de las imágenes del ESP32). Devuelve el motivo (0 = bien).
  async function verificarPrograma(todo, r) {
    if (todo.length !== r.tam || crc32(todo) !== r.crc) return 1;
    const firma = todo.subarray(0, 256);
    const sha = todo.subarray(256, 288);
    const bin = todo.subarray(288);
    const calculado = new Uint8Array(await crypto.subtle.digest('SHA-256', bin));
    if (hex(calculado) !== hex(sha)) return 2;
    const mensaje = new TextEncoder().encode(`lite|${MODELOS[tv.modelo]}|${r.build}|${bin.length}|${hex(calculado)}`);
    let buena = false;
    for (const spki of tv.clavesPublicas) {
      const clave = await crypto.subtle.importKey('spki', b64aBytes(spki), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, firma, mensaje)) { buena = true; break; }
    }
    if (!buena) return 2;
    if (bin[0] !== 0xE9) return 3;
    return 0;
  }

  // Reinicio tras instalar: corta la conexión, tarda un poco y arranca en la versión nueva (pendiente) o, si se cae, en la anterior.
  function reiniciar(nuevaBuild) {
    reiniciandoHasta = Date.now() + tv.msReinicio;
    tv.reinicios++;
    if (tv.conectado) tv.desconectar();
    if (tv.caerAlArrancar) { tv.pendiente = false; return; } // el arranque vuelve solo a la anterior
    tv.build = nuevaBuild;
    tv.pendiente = true;
  }

  function cmdCtrl(d) {
    if (tv.sinResponder) return;
    tv.escrituras.push(d[0]);
    // La versión recién instalada se da por buena con la primera escritura del celular vinculado.
    if (tv.pendiente) tv.pendiente = false;
    switch (d[0]) {
      case 0x01: { const epoch = leer32(d, 1); const ok = epoch >= 1700000000; if (ok) { tv.hora = epoch; tv.zona = (d[5] | (d[6] << 8)) << 16 >> 16; } avisar([0x81, ok ? 1 : 0]); break; }
      case 0x02: {
        const tam = leer32(d, 1), crc = leer32(d, 5), ventana = d[9] || 1, banderas = d[10] || 0;
        const esCancion = !!(banderas & 4), contenido = !!(banderas & 8), programa = !!(banderas & 32);
        const id = esCancion ? (d[11] | (d[12] << 8)) : 0;
        if (programa) {
          const build = d.length >= 17 ? leer32(d, 13) : 0;
          let codigo = 1;
          if (tv.build === null || build === 0 || tam <= 288) codigo = 0;
          else if (build <= tv.build) codigo = 2;
          else if (tam - 288 > tv.tamanoEspacio) codigo = 3;
          else if (tv.ocupada) codigo = 4;
          rx = codigo === 1 ? { tam, crc, ventana, programa: true, build, seq: 0, partes: [], bytes: 0, aceptados: 0, avisoHueco: -1 } : null;
          if (codigo === 1) tv.sonando = null;
          avisar([0x82, codigo]);
          break;
        }
        let ok = true; // un INICIO nuevo reemplaza al que estuviera en curso
        if (ok && esCancion) { tv.sonando = null; ok = hacerEspacio(tam); }
        if (ok && contenido) ok = tam > 2 && tam <= 1536 * 1024 && hacerEspacio(tam);
        rx = ok ? { tam, crc, ventana, esCancion, contenido, id, seq: 0, partes: [], bytes: 0, aceptados: 0, avisoHueco: -1 } : null;
        avisar([0x82, ok ? 1 : 0]);
        break;
      }
      case 0x03: {
        if (!rx) { avisar([0x83, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); break; }
        const todo = new Uint8Array(rx.bytes);
        let p = 0; for (const x of rx.partes) { todo.set(x, p); p += x.length; }
        if (rx.programa) {
          const r = rx;
          rx = null;
          verificarPrograma(todo, r).then((motivo) => {
            tv.programas.push({ build: r.build, ok: motivo === 0, motivo });
            avisar([0x83, motivo === 0 ? 1 : 0, ...u32(todo.length), ...u32(1), ...u32(2), motivo]);
            if (motivo === 0) setTimeout(() => reiniciar(r.build), 50);
          });
          break;
        }
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
      case 0x04: {
        const m = [0x84, 1, 0xFF & 517, 517 >> 8, ...u32(200000), tv.vinculado ? 1 : 0, 0];
        if (tv.build !== null) m.push(...u32(tv.build), tv.modelo, tv.pendiente ? 1 : 0);
        avisar(m);
        break;
      }
      case 0x10: { const ids = [...tv.biblioteca.keys()].slice(0, 100); avisar([0x90, ids.length, ...ids.flatMap((i) => [i & 255, i >> 8])]); break; }
      case 0x12: {
        const id = d[1] | (d[2] << 8);
        const ok = tv.biblioteca.has(id) && !rx;
        if (ok) { tv.sonando = { id, repeticiones: d[3], conLetra: d[4] !== 0 }; tv.biblioteca.get(id).uso = ++tv.contadorUso; }
        avisar([0x92, ok ? 1 : 0, id & 255, id >> 8]);
        break;
      }
      case 0x13: tv.sonando = null; avisar([0x93, 1]); break;
      case 0x14: { tv.sonando = null; const p = protegidos(); for (const id of [...tv.biblioteca.keys()]) if (!p.has(id)) tv.biblioteca.delete(id); avisar([0x94, 1]); break; }
      case 0x15: avisar([0x95, tv.biblioteca.size, ...u32(libre()), ...u32(tv.capacidad)]); break;
      case 0x20: {
        const alarmas = [];
        for (let i = 0; i < 3; i++) alarmas.push({ activa: d[3 + i * 4] === 1, hora: d[4 + i * 4], minuto: d[5 + i * 4], dias: d[6 + i * 4] });
        tv.alarmas = { tonoId: d[1] | (d[2] << 8), alarmas };
        avisar([0xA0, 1]);
        break;
      }
      case 0x22: // [brillo][volumen][zona i16][apagado u8, opcional desde el 2026-11-23; si falta, 5]
        tv.ajustes = { brillo: d[1], volumen: d[2], zona: (d[3] | (d[4] << 8)) << 16 >> 16, apagado: d.length >= 6 ? d[5] : 5 };
        avisar([0xA2, 1]);
        break;
      default: break;
    }
  }

  function datos(d) {
    if (!rx) return;
    if (tv.perderDatos > 0) { tv.perderDatos--; return; }
    const seq = d[0] | (d[1] << 8);
    if (seq !== rx.seq) {
      // Un trozo adelantado: la TV avisa UNA vez por hueco (si no, cada trozo en vuelo provocaría otro aviso y el
      // celular reenviaría sin parar). Un trozo repetido (seq < esperada) se ignora sin avisar.
      if (seq > rx.seq && rx.avisoHueco !== rx.seq) { rx.avisoHueco = rx.seq; avisar([0x86, rx.seq & 255, rx.seq >> 8]); }
      return;
    }
    rx.avisoHueco = -1;
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
    c.writeValueWithResponse = async (buf) => { if (!tv.conectado) throw new Error('GATT Server is disconnected.'); if (tv.rechazarEscrituras) throw new Error('Writing characteristic failed with status code 201.'); const d = new Uint8Array(buf.buffer || buf); if (uuid === CTRL) cmdCtrl(d); };
    c.writeValueWithoutResponse = async (buf) => { if (!tv.conectado) throw new Error('GATT Server is disconnected.'); if (tv.rechazarEscrituras) throw new Error('Writing characteristic failed with status code 201.'); const d = new Uint8Array(buf.buffer || buf); if (uuid === DATOS) datos(d); };
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
    connect: async () => { if (tv.noConectar || Date.now() < reiniciandoHasta) throw new Error('GATT Error Unknown.'); tv.conectado = true; tv.conexiones++; dispositivo.gatt.connected = true; return dispositivo.gatt; },
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
    build: tv.build, pendiente: tv.pendiente, programas: tv.programas, reinicios: tv.reinicios,
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
