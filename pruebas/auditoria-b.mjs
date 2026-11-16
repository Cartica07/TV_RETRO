// Pruebas de los arreglos de la auditoría 2026-11-15 (zona B) en el panel, con Firebase simulado.
// H-29 (Guardar bloqueado hasta cargar), H-34 (desvincular limpia el nodo de la TV), H-35 (volver con un GIF),
// H-37 (aviso de conexión lenta) y H-39 (tope de píxeles).
// Uso: node auditoria-b.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'ajustar', fuente: 'sans', invertido: false } };
const bmp = 'A'.repeat(1364) + '==';
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const alarmaGuardada = { tono: '', alarmas: { 0: { activa: true, hora: 6, minuto: 30, dias: 62 }, 1: { activa: true, hora: 9, minuto: 0, dias: 65 }, 2: { activa: false, hora: 7, minuto: 0, dias: 62 } } };

function semilla(pantalla = pant) {
  return {
    dispositivos: { tv1: { dueno: 'uid-ana', codigoUsado: 'K7M2QX', alarma: alarmaGuardada, ajustes: { brillo: 1, volumen: 1, zona: -300 },
      oled_remota: { version: 5, contadorVersion: 5, lastSeen: 1, pantalla, archivo: { version: 5, datos: 'QUJD' } } } },
    usuarios: { 'uid-ana': { dispositivos: { tv1: true }, animaciones: { gato: { ancho: 128, alto: 64, cuadros: [{ datos: bmp, dur: 100 }, { datos: bmp, dur: 100 }], meta: { origen: 'gif' } } } } }
  };
}
async function abrirApp(sem, { retrasos = null, app = false, alIniciar = null, ancho = 390, alto = 844 } = {}) {
  const r = await abrir(sem, { ruta: '/index.html', esperar: false, retrasos, ancho, alto, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true;
      if (s.app) globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio = (globalThis.__salio || 0) + 1; } } } };
    }, { auth: { usuarios: USUARIOS, actual: 'ana@correo.com' }, app });
    if (alIniciar) await alIniciar(p);
  } });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
  await r.pagina.waitForTimeout(600);
  return r;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const dbTv = (p) => p.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1);
const entrarMas = async (p, op) => { await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(250); await p.click(`#grupoMas button[data-mas="${op}"]`); await p.waitForTimeout(300); };

const escenarios = {
  async 'H-35: con un GIF elegido, volver y Atrás salen de la Galería'() {
    const pa = { tipo: 'animacion', texto: 'Hola', config: pant.config, animacion: { nombre: 'gato', ancho: 128, alto: 64, formato: 'z1', cantidad: 2 } };
    const { navegador, pagina } = await abrirApp(semilla(pa), { app: true });
    const enGaleria = await vis(pagina, '#seccionGaleria');
    await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(300);
    const menu = await vis(pagina, '#seccionMasSelector') && !(await vis(pagina, '#seccionGaleria'));
    await pagina.evaluate(() => globalThis.__atras && globalThis.__atras()); await pagina.waitForTimeout(300);
    const salio = await pagina.evaluate(() => globalThis.__salio || 0);
    await navegador.close();
    return informe('H-35: abre en la Galería, "volver" lleva al menú y Atrás desde el menú sale de la app', enGaleria && menu && salio === 1, JSON.stringify({ enGaleria, menu, salio }));
  },
  async 'H-29: Alarma no deja guardar hasta leerla y no pisa lo guardado'() {
    const { navegador, pagina } = await abrirApp(semilla(), { retrasos: { 'dispositivos/tv1/alarma': 3000 } });
    await entrarMas(pagina, 'alarma');
    const bloqueado = await pagina.$eval('#botonGuardarAlarma', (b) => b.disabled);
    await pagina.waitForFunction(() => !document.getElementById('botonGuardarAlarma').disabled, null, { timeout: 8000 });
    const horaCargada = await pagina.inputValue('#alarmaHora');
    const tv = await dbTv(pagina);
    await pagina.click('#botonGuardarAlarma'); await pagina.waitForTimeout(1500);
    const tras = (await dbTv(pagina)).alarma.alarmas;
    await navegador.close();
    return informe('H-29: Guardar alarma bloqueado mientras carga; ya cargada, conserva 06:30 y las alarmas activas', bloqueado && horaCargada === '06:30' && tv.alarma.alarmas[0].activa === true && tras[0].hora === 6 && tras[1].activa === true, JSON.stringify({ bloqueado, horaCargada, tras }));
  },
  async 'H-29: Alarma sin red no deja guardar'() {
    const { navegador, pagina } = await abrirApp(semilla(), { retrasos: { 'dispositivos/tv1/alarma': 20000 } });
    await entrarMas(pagina, 'alarma');
    await pagina.waitForTimeout(500);
    const bloqueado = await pagina.$eval('#botonGuardarAlarma', (b) => b.disabled);
    const version = (await dbTv(pagina)).oled_remota.version;
    await pagina.evaluate(() => document.getElementById('botonGuardarAlarma').click());
    await pagina.waitForTimeout(500);
    const igual = (await dbTv(pagina)).oled_remota.version === version && (await dbTv(pagina)).alarma.alarmas[0].hora === 6;
    await navegador.close();
    return informe('H-29: mientras no se haya leído la alarma, ni un clic forzado escribe nada', bloqueado && igual, JSON.stringify({ bloqueado, igual }));
  },
  async 'H-29: Ajustes no deja guardar hasta leerlos y no pisa lo guardado'() {
    const { navegador, pagina } = await abrirApp(semilla(), { retrasos: { 'dispositivos/tv1/ajustes': 3000 } });
    await entrarMas(pagina, 'config');
    await pagina.click('#grupoConfig button[data-config="tv"]'); await pagina.waitForTimeout(300);
    const bloqueado = await pagina.$eval('#botonGuardarAjustes', (b) => b.disabled);
    await pagina.waitForFunction(() => !document.getElementById('botonGuardarAjustes').disabled, null, { timeout: 8000 });
    await pagina.click('#botonGuardarAjustes'); await pagina.waitForTimeout(1500);
    const a = (await dbTv(pagina)).ajustes;
    await navegador.close();
    return informe('H-29: Guardar ajustes bloqueado mientras carga; ya cargados, conserva brillo 1 y volumen 1', bloqueado && a.brillo === 1 && a.volumen === 1, JSON.stringify({ bloqueado, a }));
  },
  async 'H-37: con la conexión lenta, Guardar alarma avisa y termina al volver la señal'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await entrarMas(pagina, 'alarma');
    await pagina.waitForFunction(() => !document.getElementById('botonGuardarAlarma').disabled, null, { timeout: 8000 });
    await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
    await pagina.click('#botonGuardarAlarma');
    await pagina.waitForFunction(() => /lenta/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 25000 });
    const ocupado = await pagina.$eval('#botonGuardarAlarma', (b) => b.disabled);
    await pagina.evaluate(() => globalThis.__fakeDb.soltar());
    await pagina.waitForFunction(() => /Alarma guardada/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
    const listo = await pagina.$eval('#botonGuardarAlarma', (b) => !b.disabled);
    const tipo = (await dbTv(pagina)).oled_remota.pantalla.tipo;
    await navegador.close();
    return informe('H-37: avisa que la conexión está lenta, deja el botón ocupado y al volver la señal guarda y manda la orden', ocupado && listo && tipo === 'alarma', JSON.stringify({ ocupado, listo, tipo }));
  },
  async 'H-34: desvincular deja limpio el nodo de la TV'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await pagina.evaluate(() => { [...document.querySelectorAll('#listaTV button')].find((b) => /Desvincular/.test(b.textContent)).click(); });
    await pagina.waitForTimeout(1200);
    const tv = await dbTv(pagina);
    await navegador.close();
    const ok = !tv.dueno && tv.oled_remota.version === -2 && tv.oled_remota.lastSeen === 1 && !tv.oled_remota.pantalla && !tv.oled_remota.archivo && !tv.alarma && !tv.ajustes;
    return informe('H-34: sin dueño, con la señal -2, y sin contenido, archivo, alarma ni ajustes del dueño anterior (conserva lastSeen)', ok, JSON.stringify(tv));
  },
  async 'H-39: una imagen de más de 8000 px por lado se rechaza con un mensaje claro'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#grupoTipo button[data-valor="imagen"]'); await pagina.waitForTimeout(300);
    // PNG de 9000×10 (cabecera válida; el navegador la decodifica barata).
    const png = await pagina.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 9000; c.height = 10;
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await pagina.setInputFiles('#cargadorImagen', { name: 'ancha.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    await pagina.waitForFunction(() => /demasiado grande/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    const msg = await pagina.evaluate(() => document.getElementById('estadoTexto').textContent);
    await navegador.close();
    return informe('H-39: mensaje "demasiado grande en píxeles"', /píxeles/.test(msg), msg);
  },
  async 'H-23: el intérprete de .ino no se descarga al abrir el panel ni en Canciones'() {
    const pedidas = [];
    const { navegador, pagina } = await abrirApp(semilla(), { alIniciar: (p) => p.on('request', (r) => pedidas.push(r.url())) });
    await pagina.click('#grupoTipo button[data-valor="cancion"]'); await pagina.waitForTimeout(800);
    const ino = pedidas.filter((u) => /inoMusical\.js/.test(u)).length;
    await navegador.close();
    return informe('H-23: ninguna petición a inoMusical.js al abrir el panel y entrar a Canciones', ino === 0, 'peticiones: ' + ino);
  },
  async 'H-24: al abrir Compartir se borra la invitación vencida que anotó este equipo'() {
    const sem = semilla();
    sem.invitaciones = { K7M2QX: { id: 'tv1', creado: 1 } };
    const { navegador, pagina } = await abrirApp(sem, { alIniciar: (p) => p.addInitScript(() => { try { localStorage.setItem('tvretro.ultimaInvitacion', JSON.stringify({ codigo: 'K7M2QX', venceEn: Date.now() - 1000 })); } catch (e) {} }) });
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await pagina.evaluate(() => { [...document.querySelectorAll('#listaTV button')].find((b) => /Compartir/.test(b.textContent)).click(); });
    await pagina.waitForTimeout(1500);
    const inv = await pagina.evaluate(() => globalThis.__fakeDb.raiz.invitaciones || {});
    const anotada = await pagina.evaluate(() => JSON.parse(localStorage.getItem('tvretro.ultimaInvitacion') || 'null'));
    await navegador.close();
    return informe('H-24: la vencida desaparece; queda anotada la nueva (distinta)', !inv.K7M2QX && anotada && anotada.codigo !== 'K7M2QX', JSON.stringify({ inv: Object.keys(inv), anotada }));
  },
  async 'H-27: un error inesperado con el login a la vista no libera el panel'() {
    const r = await abrir({}, { ruta: '/index.html', esperar: false, antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: null });
    } });
    const { navegador, pagina } = r;
    await pagina.waitForTimeout(1200);
    const login = await vis(pagina, '#pantallaLogin');
    await pagina.evaluate(() => { setTimeout(() => { throw new Error('error de prueba'); }, 0); });
    await pagina.waitForTimeout(600);
    const inerte = await pagina.evaluate(() => document.querySelector('main.controles').inert);
    await navegador.close();
    return informe('H-27: login visible y el panel de abajo sigue inerte tras un error inesperado', login && inerte, JSON.stringify({ login, inerte }));
  },
  // H-13 (paso 3, js/cuentas.js): tras un fallo con el login a la vista, entrar libera el panel y el aviso programado
  // (liberarPanelDespuesDeLogin, 8 s después) corre sin errores nuevos.
  async 'H-13: error con el login a la vista y luego entrar: el panel queda libre y sin errores nuevos'() {
    const { navegador, pagina } = await abrir(semilla(), { ruta: '/index.html', esperar: false, antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: null });
    } });
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(e.message));
    await pagina.waitForTimeout(1200);
    const login = await vis(pagina, '#pantallaLogin');
    await pagina.evaluate(() => { setTimeout(() => { throw new Error('error de prueba'); }, 0); });
    await pagina.waitForTimeout(500);
    await pagina.fill('#loginEmail', 'ana@correo.com'); await pagina.fill('#loginPassword', 'secreta1'); await pagina.click('#botonLogin');
    await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 12000 });
    await pagina.waitForTimeout(9500); // pasa ESPERA_ARRANQUE_MS (8 s): corre el aviso programado al entrar
    const libre = await pagina.evaluate(() => !document.querySelector('main.controles').inert && document.getElementById('pantallaLogin').hidden);
    await navegador.close();
    return informe('H-13: tras el fallo con login a la vista, entrar libera el panel y no aparece ningún error nuevo', login && libre && errores.length === 1 && /error de prueba/.test(errores[0]), JSON.stringify({ login, libre, errores }));
  },
  async 'H-46: a 360x740 en modo cuentas ninguna pestaña tiene scroll de página'() {
    const { navegador, pagina } = await abrirApp(semilla(), { ancho: 360, alto: 740 });
    const medidas = {};
    for (const tab of ['texto', 'imagen', 'dibujo', 'cancion', 'galeria']) {
      await pagina.click(`#grupoTipo button[data-valor="${tab}"]`); await pagina.waitForTimeout(300);
      medidas[tab] = await pagina.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
    }
    await navegador.close();
    return informe('H-46: scrollHeight - innerHeight <= 0 en las 5 pestañas', Object.values(medidas).every((d) => d <= 0), JSON.stringify(medidas));
  },
  async 'H-51: datos raros escritos por un miembro no rompen ni congelan la vista previa'() {
    const casos = {
      'tamaño 100': { tipo: 'texto', texto: 'Hola', config: { ...pant.config, tamano: 100, fuente: 'clasica' } },
      'imagen 4096x4096': { tipo: 'imagen', texto: 'x', config: pant.config, imagen: { ancho: 4096, alto: 4096, datos: 'AAAA' } },
      'imagen con Base64 inválido': { tipo: 'imagen', texto: 'x', config: pant.config, imagen: { ancho: 128, alto: 64, datos: '@@@@ no es base64 !!!' } }
    };
    const resultados = {};
    for (const [nombre, p] of Object.entries(casos)) {
      const t0 = Date.now();
      const r = await abrirApp(semilla(p));
      const errores = r.errores.filter((e) => e.startsWith('página:'));
      const estado = await r.pagina.evaluate(() => document.getElementById('estadoTexto').textContent);
      resultados[nombre] = { ms: Date.now() - t0, errores: errores.length, estado };
      await r.navegador.close();
    }
    const bien = Object.values(resultados).every((x) => x.errores === 0 && !/salió mal/.test(x.estado) && x.ms < 15000);
    return informe('H-51: sin errores de página ni "Algo salió mal" con tamaño 100, imagen 4096x4096 y Base64 inválido', bien, JSON.stringify(resultados));
  },
  async 'H-16: la goma borra lo dibujado y el lápiz vuelve a pintar'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#grupoTipo button[data-valor="dibujo"]'); await pagina.waitForTimeout(400);
    const caja = await pagina.evaluate(() => { const r = document.getElementById('lienzoDibujo').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const pixel = () => pagina.evaluate(() => { const c = document.getElementById('lienzoDibujo'); const d = c.getContext('2d').getImageData(64, 32, 1, 1).data; return d[0] + d[1] + d[2]; });
    const trazo = async () => {
      await pagina.mouse.move(caja.x + caja.w * 0.2, caja.y + caja.h * 0.5);
      await pagina.mouse.down();
      await pagina.mouse.move(caja.x + caja.w * 0.8, caja.y + caja.h * 0.5, { steps: 8 });
      await pagina.mouse.up();
      await pagina.waitForTimeout(150);
    };
    const vacio = await pixel();
    await trazo();
    const conTrazo = await pixel();
    await pagina.click('#botonGomaDibujo');
    const marcado = await pagina.getAttribute('#botonGomaDibujo', 'aria-pressed');
    await trazo();
    const tras = await pixel();
    await pagina.click('#botonGomaDibujo');
    const desmarcado = await pagina.getAttribute('#botonGomaDibujo', 'aria-pressed');
    await trazo();
    const otraVez = await pixel();
    await navegador.close();
    return informe('H-16: trazo pinta, la goma lo borra (botón marcado), y sin goma vuelve a pintar', conTrazo > vacio + 100 && marcado === 'true' && tras === vacio && desmarcado === 'false' && otraVez > vacio + 100, JSON.stringify({ vacio, conTrazo, marcado, tras, desmarcado, otraVez }));
  },
  async 'H-15: los grupos de botones marcan cuál está elegido con aria-pressed'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#grupoTamano button[data-valor="3"]'); await pagina.waitForTimeout(200);
    const tamanos = await pagina.$$eval('#grupoTamano button', (bs) => bs.map((b) => b.getAttribute('aria-pressed')));
    await entrarMas(pagina, 'alarma');
    const pestanas = await pagina.$$eval('#grupoAlarmaNumero button', (bs) => bs.map((b) => b.hasAttribute('aria-pressed')));
    await navegador.close();
    const ok = tamanos.join() === 'false,false,true,false,false' && pestanas.every((x) => x === false);
    return informe('H-15: tamaño 3 con aria-pressed=true y los demás false; las pestañas de Alarma sin aria-pressed', ok, JSON.stringify({ tamanos, pestanas }));
  },
  async 'H-06: al llegar el acuse de la TV el aviso pasa a "En la TV"'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    const antes = await pagina.textContent('#estadoTexto');
    await pagina.evaluate(() => { const o = globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota; o.mostrada = o.version; globalThis.__fakeDb.notificar(); });
    await pagina.waitForFunction(() => /En la TV/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 5000 });
    const despues = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('H-06: "Enviado…" y, con el acuse, "En la TV ✅"', /Enviado/.test(antes) && /En la TV/.test(despues), JSON.stringify({ antes, despues }));
  },
  async 'H-06: el acuse de una versión vieja no cuenta para el envío nuevo'() {
    const { navegador, pagina } = await abrirApp(semilla());
    const version = () => pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version);
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    const v1 = await version();
    await pagina.click('#enviar');
    await pagina.waitForFunction((v) => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version > v, v1, { timeout: 8000 });
    await pagina.waitForTimeout(300);
    const v2 = await version();
    await pagina.evaluate((v) => { globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.mostrada = v; globalThis.__fakeDb.notificar(); }, v1);
    await pagina.waitForTimeout(500);
    const conViejo = await pagina.textContent('#estadoTexto');
    await pagina.evaluate((v) => { globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.mostrada = v; globalThis.__fakeDb.notificar(); }, v2);
    await pagina.waitForFunction(() => /En la TV/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 5000 });
    await navegador.close();
    return informe('H-06: con mostrada = versión anterior sigue "Enviado"; con la nueva pasa a "En la TV"', v2 > v1 && /Enviado/.test(conViejo) && !/En la TV/.test(conViejo), JSON.stringify({ v1, v2, conViejo }));
  },
  async 'H-06: sin acuse y con la TV sin conexión avisa que lo mostrará al conectarse'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    await pagina.waitForFunction(() => /sin conexión/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 30000 });
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('H-06: tras 20 s sin acuse y sin señal de la TV, "La TV está sin conexión…"', /lo mostrará cuando se conecte/.test(msg), msg);
  },
  async 'H-06: sin acuse pero con la TV en línea el aviso de siempre se queda'() {
    const sem = semilla();
    const { navegador, pagina } = await abrirApp(sem);
    await pagina.evaluate(() => { globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.lastSeen = Date.now(); globalThis.__fakeDb.notificar(); });
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    await pagina.evaluate(() => { const iv = setInterval(() => { globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.lastSeen = Date.now(); globalThis.__fakeDb.notificar(); }, 2000); globalThis.__iv = iv; });
    await pagina.waitForTimeout(23000);
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('H-06: con la TV en línea y firmware sin acuse queda "Enviado ✅ Ya va camino a la TV."', /Ya va camino/.test(msg), msg);
  },
  async 'H-12: guardar y borrar escriben/quitan la lista liviana junto al elemento'() {
    const { navegador, pagina } = await abrirApp(semilla());
    const modulo = (cuerpo) => pagina.evaluate(async (c) => { const m = await import('/js/firebase.js'); return await (new Function('m', 'return (async () => {' + c + '})()'))(m); }, cuerpo);
    const u = () => pagina.evaluate(() => globalThis.__fakeDb.raiz.usuarios['uid-ana']);
    await modulo("return await m.guardarImagenCatalogo('foto', 'AAAA', 128, 64, 'data:image/png;base64,PRE', { origen: 'subida', umbral: 128 });");
    await modulo("return await m.guardarAnimacionCatalogo('baile', 128, 64, [{ datos: 'FRAME0', dur: 100 }, { datos: 'FRAME1', dur: 100 }], { origen: 'gif' });");
    const a = await u();
    const imagenOk = a.imagenes.foto.preprocesada === 'data:image/png;base64,PRE' && a.imagenes_indice.foto.datos === 'AAAA' && a.imagenes_indice.foto.editable === true && !('preprocesada' in a.imagenes_indice.foto) && a.imagenes_indice.foto.meta.umbral === 128;
    const animOk = a.animaciones.baile.cuadros.length === 2 && a.animaciones_indice.baile.cantidad === 2 && a.animaciones_indice.baile.miniatura === 'FRAME0' && !('cuadros' in a.animaciones_indice.baile);
    await modulo("await m.borrarImagenCatalogo('foto'); return await m.borrarAnimacionCatalogo('baile');");
    const d = await u();
    const borrado = !(d.imagenes && d.imagenes.foto) && !(d.imagenes_indice && d.imagenes_indice.foto) && !(d.animaciones && d.animaciones.baile) && !(d.animaciones_indice && d.animaciones_indice.baile);
    await navegador.close();
    return informe('H-12: imagen y animación guardadas con su lista liviana (sin lo pesado); al borrar desaparecen las dos', imagenOk && animOk && borrado, JSON.stringify({ imagenOk, animOk, borrado, cuotas: d.cuotas }));
  },
  async 'H-12: con la lista liviana la Galería no baja cuadros ni copias editables, y los pide al elegir'() {
    const gif = { ancho: 128, alto: 64, cuadros: [{ datos: bmp, dur: 100 }, { datos: bmp, dur: 100 }], meta: { origen: 'gif' } };
    const sem = semilla();
    sem.usuarios['uid-ana'].animaciones = { gato: gif };
    sem.usuarios['uid-ana'].animaciones_indice = { gato: { ancho: 128, alto: 64, cantidad: 2, miniatura: bmp, meta: { origen: 'gif' } } };
    sem.usuarios['uid-ana'].imagenes = { foto: { datos: bmp, ancho: 128, alto: 64, preprocesada: 'data:image/png;base64,PRE' } };
    sem.usuarios['uid-ana'].imagenes_indice = { foto: { datos: bmp, ancho: 128, alto: 64, editable: true } };
    sem.biblioteca = { animaciones: { baile: gif }, animaciones_indice: { baile: { ancho: 128, alto: 64, cantidad: 2, miniatura: bmp, meta: { origen: 'gif' } } }, imagenes: {}, imagenes_indice: {} };
    const { navegador, pagina } = await abrirApp(sem);
    await entrarMas(pagina, 'galeria');
    await pagina.waitForTimeout(800);
    const lecturas = () => pagina.evaluate(() => globalThis.__fakeDb.lecturas);
    const l1 = await lecturas();
    const pesadas = l1.filter((r) => /^(usuarios\/uid-ana|biblioteca)\/(animaciones|imagenes)$/.test(r));
    const escuchaIndice = l1.some((r) => r === 'onValue:usuarios/uid-ana/animaciones_indice') && l1.some((r) => r === 'onValue:biblioteca/animaciones_indice');
    // Imagen: al elegirla se pide solo su copia editable.
    await pagina.click('#gridGaleria .item-galeria'); await pagina.waitForTimeout(800);
    const copia = (await lecturas()).some((r) => r === 'usuarios/uid-ana/imagenes/foto/preprocesada');
    // Animación: al elegirla se piden sus cuadros.
    await pagina.click('#grupoSubvistaGaleria button[data-subvista="gif"]'); await pagina.waitForTimeout(300);
    const items = await pagina.$$eval('#gridGifs .item-galeria', (els) => els.map((e) => e.dataset.clave));
    await pagina.click('#gridGifs .item-galeria'); await pagina.waitForTimeout(1000);
    const cuadros = (await lecturas()).some((r) => /\/animaciones\/(gato|baile)\/cuadros$/.test(r));
    const cargada = await pagina.evaluate(() => /cargado desde la galería/.test(document.getElementById('estadoTexto').textContent));
    await navegador.close();
    return informe('H-12: sin lecturas del catálogo completo; escucha las listas; al elegir pide la copia editable y los cuadros', pesadas.length === 0 && escuchaIndice && copia && cuadros && cargada && items.length === 2, JSON.stringify({ pesadas, escuchaIndice, copia, cuadros, cargada, items }));
  },
  async 'H-12: lo anterior a la lista se sigue viendo y se rellena la lista'() {
    // semilla() trae la animación "gato" SIN lista (como una cuenta anterior a este cambio).
    const { navegador, pagina } = await abrirApp(semilla());
    await entrarMas(pagina, 'galeria');
    await pagina.click('#grupoSubvistaGaleria button[data-subvista="gif"]'); await pagina.waitForTimeout(1200);
    const items = await pagina.$$eval('#gridGifs .item-galeria', (els) => els.map((e) => e.dataset.clave));
    const lista = await pagina.evaluate(() => (globalThis.__fakeDb.raiz.usuarios['uid-ana'].animaciones_indice || {}));
    await navegador.close();
    return informe('H-12: la animación anterior se ve y queda su entrada en animaciones_indice', items.includes('gato') && lista.gato && lista.gato.cantidad === 2 && lista.gato.miniatura === bmp, JSON.stringify({ items, lista: Object.keys(lista) }));
  },
  async 'H-06: TV apagada justo después de enviar: avisa sin conexión y al volver pasa a "En la TV"'() {
    const { navegador, pagina } = await abrirApp(semilla());
    // La TV estaba en línea al enviar (latido reciente) y se apaga: deja de latir.
    await pagina.evaluate(() => { globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.lastSeen = Date.now(); globalThis.__fakeDb.notificar(); });
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    await pagina.waitForFunction(() => /sin conexión/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 45000 });
    const sinConexion = await pagina.textContent('#estadoTexto');
    // Vuelve: late y confirma la versión.
    await pagina.evaluate(() => { const o = globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota; o.lastSeen = Date.now(); o.mostrada = o.version; globalThis.__fakeDb.notificar(); });
    await pagina.waitForFunction(() => /En la TV/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    const alVolver = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('H-06: con la TV recién apagada sale "sin conexión" y al volver "En la TV ✅"', /lo mostrará cuando se conecte/.test(sinConexion) && /En la TV/.test(alVolver), JSON.stringify({ sinConexion, alVolver }));
  },
  async 'H-06: si la escucha de "mostrada" no entrega, la lectura directa confirma igual'() {
    const { navegador, pagina } = await abrirApp(semilla());
    await pagina.click('#enviar');
    await pagina.waitForFunction(() => /Enviado/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 8000 });
    // La TV confirma, pero el aviso a la escucha del panel se pierde (no se llama a notificar()).
    await pagina.evaluate(() => { const o = globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota; o.mostrada = o.version; });
    await pagina.waitForFunction(() => /En la TV/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 40000 });
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('H-06: sin evento de la escucha, la consulta cada 5 s encuentra el acuse y dice "En la TV ✅"', /En la TV/.test(msg), msg);
  },
  // H-13 (paso 2, js/mas.js): el botón Jugar sigue sin hacer nada mientras el panel arranca (estaBloqueado()).
  async 'H-13: Jugar no manda nada mientras el panel arranca, y después sí'() {
    const { navegador, pagina } = await abrir(semilla(), { ruta: '/index.html', esperar: false, retrasos: { 'dispositivos/tv1/oled_remota': 2500 }, antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: 'ana@correo.com' });
    } });
    pagina.on('dialog', (d) => d.accept());
    await pagina.waitForSelector('[data-juego="snake"]', { state: 'attached' });
    await pagina.waitForTimeout(400);
    const bloqueado = await pagina.evaluate(() => document.querySelector('main.controles').inert);
    const v0 = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version);
    await pagina.evaluate(() => document.querySelector('[data-juego="snake"]').click()); // clic programático: el panel está inert pero el clic llega
    await pagina.waitForTimeout(600);
    const durante = await pagina.evaluate(() => ({ v: globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version, estado: document.getElementById('estadoTexto').textContent }));
    await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
    await pagina.waitForTimeout(600);
    await entrarMas(pagina, 'juegos');
    await pagina.click('[data-juego="snake"]');
    await pagina.waitForFunction((v) => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version > v, v0, { timeout: 10000 }).catch(() => {}); // las lecturas de esa ruta siguen demoradas
    const despues = await dbTv(pagina);
    await navegador.close();
    const ok = bloqueado && durante.v === v0 && !/Enviando|Enviado/.test(durante.estado) && despues.oled_remota.version === v0 + 1 && despues.oled_remota.pantalla.tipo === 'juego';
    return informe('H-13: Jugar no hace nada con el panel bloqueado y, ya libre, manda la orden', ok, JSON.stringify({ bloqueado, v0, durante, despuesVersion: despues.oled_remota.version, tipo: despues.oled_remota.pantalla.tipo }));
  }
};

const pedidos = process.argv.slice(2);
let bien = 0, mal = 0;
for (const [nombre, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.some((p) => nombre.includes(p))) continue;
  try { (await fn()) ? bien++ : mal++; } catch (e) { mal++; console.log('FALLÓ  ' + nombre + ' — ' + e.message.split('\n')[0]); }
}
console.log(`\n${bien + mal} escenarios: ${bien} bien, ${mal} con problemas`);
cerrarServidor();
process.exit(mal ? 1 : 0);
