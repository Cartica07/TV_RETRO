// Pruebas "a prueba de bobos": usuario impaciente que pulsa de más o hace cosas raras.
// Cada escenario dice qué debería pasar. Los que fallan son problemas reales.
// Uso: node bobos.mjs [nombre...]
import fs from 'node:fs';
import { abrir, cerrarServidor } from './banco.mjs';

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAWB4/xwAAAABJRU5ErkJggg==', 'base64');
const bm = Buffer.alloc(1024, 0xF0).toString('base64');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
const informe = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok }); console.log(`${ok ? 'OK       ' : 'PROBLEMA '} ${nombre}${detalle ? ' — ' + detalle : ''}`); return ok; };
const db = (pagina, f) => pagina.evaluate(f);
const SIN_ERRORES = (e) => e.filter((x) => x.startsWith('página:')); // solo errores de la página sin atrapar (los console.error del panel son avisos a propósito)

// Gif mínimo (LZW sin compresión) para pruebas.
function gif(ancho, alto, nCuadros) {
  const b = []; const w16 = (n) => b.push(n & 255, n >> 8);
  b.push(...Buffer.from('GIF89a')); w16(ancho); w16(alto); b.push(0x80, 0, 0, 0, 0, 0, 255, 255, 255);
  for (let f = 0; f < nCuadros; f++) {
    b.push(0x21, 0xF9, 4, 0, 5, 0, 0, 0, 0x2C); w16(0); w16(0); w16(ancho); w16(alto); b.push(0, 2);
    const bits = []; const emit = (v, n) => { for (let i = 0; i < n; i++) bits.push((v >> i) & 1); };
    emit(4, 3);
    for (let i = 0; i < ancho * alto; i++) { emit(((i * 7 + f * 13) % 5 < 2) ? 1 : 0, 3); if ((i + 1) % 3 === 0) emit(4, 3); }
    emit(5, 3);
    const bytes = []; for (let i = 0; i < bits.length; i += 8) { let x = 0; for (let k = 0; k < 8 && i + k < bits.length; k++) x |= bits[i + k] << k; bytes.push(x); }
    for (let i = 0; i < bytes.length; i += 255) { const t = bytes.slice(i, i + 255); b.push(t.length, ...t); }
    b.push(0);
  }
  b.push(0x3B); return Buffer.from(b);
}

const ESCENARIOS = {
  // 1) Cambia de pestaña mientras se procesa una imagen subida en la Galería.
  async cambioDePestanaMientrasProcesa() {
    const { navegador, pagina, errores } = await abrir({}, { antes: async (p) => { await p.addInitScript(() => {
      const f = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function (...a) { setTimeout(() => f.apply(this, a), 700); };
    }); } });
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.setInputFiles('#cargadorImagenGaleria', { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await pagina.click('#grupoTipo button[data-valor="texto"]');
    await pagina.fill('#texto', 'HOLA');
    await esperar(1500);
    const activa = await pagina.evaluate(() => document.querySelector('#grupoTipo .activo, #grupoTipo [aria-current="page"], #grupoTipo [aria-selected="true"]')?.dataset.valor);
    const visible = await pagina.evaluate(() => ['seccionTexto', 'seccionImagen', 'seccionGaleria'].filter((id) => document.getElementById(id) && document.getElementById(id).style.display !== 'none'));
    await pagina.click('#enviar'); await esperar(500);
    const p = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota.pantalla);
    await navegador.close();
    return informe('cambiar de pestaña mientras se procesa una imagen: Enviar manda lo que se ve (texto)', p.tipo === 'texto' && p.texto === 'HOLA' && SIN_ERRORES(errores).length === 0, `envió tipo=${p.tipo} texto="${p.texto}" · pestaña activa=${activa} · secciones=${visible}`);
  },

  // 1b) Sube una imagen en la pestaña Imagen, se va a la Galería y elige otra: lo tardío no la pisa.
  async subidaTardiaNoPisaLaGaleria() {
    const semilla = { imagenes: { foto: { datos: bm, ancho: 128, alto: 64, meta: {} } } };
    const { navegador, pagina, errores } = await abrir(semilla, { antes: async (p) => { await p.addInitScript(() => {
      const f = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function (...a) { setTimeout(() => f.apply(this, a), 700); };
      const o = HTMLImageElement.prototype.decode; // la carga de la imagen también tarda
    }); } });
    await pagina.click('#grupoTipo button[data-valor="imagen"]');
    await pagina.setInputFiles('#cargadorImagen', { name: 'nueva.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await esperar(500);
    await pagina.click('#gridGaleria .item-galeria');
    await esperar(1800);
    const estado = await pagina.textContent('#estadoTexto');
    await pagina.click('#enviar'); await esperar(500);
    const p = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota.pantalla);
    await navegador.close();
    const intacta = p.tipo === 'imagen' && p.imagen && p.imagen.datos === bm;
    return informe('una imagen que termina de procesarse tarde no pisa la imagen elegida en la Galería', intacta && !/Procesando/.test(estado) && SIN_ERRORES(errores).length === 0, `envió tipo=${p.tipo} igual a la elegida=${intacta} · estado="${estado.trim()}"`);
  },

  // 2) Pulsa Enviar mientras el panel todavía está arrancando.
  async enviarDuranteElArranque() {
    const semilla = { oled_remota: { version: 5, pantalla: { tipo: 'texto', texto: 'TEXTO REAL EN LA TV', config: { tamano: 2, alineacion: 'centro', alineacionV: 'centro', modoTexto: 'ajustar', fuente: 'sans' } } } };
    const { navegador, pagina, errores } = await abrir(semilla, { esperar: false, retrasos: { 'oled_remota/pantalla': 1500 } });
    await pagina.waitForSelector('#enviar', { state: 'attached' });
    await esperar(200);
    const estadoBoton = await pagina.evaluate(() => ({ deshabilitado: document.getElementById('enviar').disabled, estado: document.getElementById('estadoTexto').textContent }));
    await pagina.click('#enviar', { force: true, timeout: 3000 }).catch(() => {});
    await esperar(3000);
    const raiz = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota);
    const escrituras = await db(pagina, () => globalThis.__fakeDb.escrituras.filter((e) => e.op === 'update' && e.ruta === 'oled_remota').length);
    await navegador.close();
    return informe('Enviar durante el arranque no pisa el contenido de la TV con valores por defecto', raiz.pantalla.texto === 'TEXTO REAL EN LA TV', `Enviar deshabilitado=${estadoBoton.deshabilitado} · texto en la TV ahora="${raiz.pantalla.texto}" · envíos hechos=${escrituras}`);
  },

  // 2b) El panel queda bloqueado mientras carga: nada de lo que se haga se pierde ni se pisa.
  async tipearDuranteElArranque() {
    const semilla = { oled_remota: { version: 5, pantalla: { tipo: 'texto', texto: 'DE FIREBASE', config: { tamano: 2, alineacion: 'centro', alineacionV: 'centro', modoTexto: 'ajustar', fuente: 'sans' } } } };
    const { navegador, pagina } = await abrir(semilla, { esperar: false, retrasos: { 'oled_remota/pantalla': 1500 } });
    await pagina.waitForSelector('#texto', { state: 'attached' });
    await esperar(300);
    const durante = await pagina.evaluate(() => ({ controles: document.querySelector('main.controles').inert, nav: document.querySelector('nav.nav-inferior').inert, enviar: document.querySelector('.barra-accion').inert, invertir: document.getElementById('filaInvertido').inert }));
    await esperar(2500);
    const despues = await pagina.evaluate(() => ({ inert: !!document.querySelector('[inert]'), texto: document.getElementById('texto').value }));
    await navegador.close();
    const bloqueado = durante.controles && durante.nav && durante.enviar && durante.invertir;
    return informe('mientras el panel arranca queda bloqueado, y después queda libre con lo que dice Firebase', bloqueado && !despues.inert && despues.texto === 'DE FIREBASE', `bloqueado durante=${JSON.stringify(durante)} · después: bloqueado=${despues.inert} texto="${despues.texto}"`);
  },

  // 2c) Si Firebase tarda más de 8 s, el panel se libera y lo que llegue tarde no pisa lo que el usuario hizo.
  async arranqueMuyLento() {
    const semilla = { oled_remota: { version: 5, pantalla: { tipo: 'imagen', texto: 'DE FIREBASE', config: { tamano: 2, alineacion: 'centro', alineacionV: 'centro', modoTexto: 'ajustar', fuente: 'sans' }, imagen: { ancho: 128, alto: 64, datos: bm } } } };
    const { navegador, pagina } = await abrir(semilla, { esperar: false, retrasos: { 'oled_remota/pantalla': 11000 } });
    await pagina.waitForSelector('#texto', { state: 'attached' });
    await esperar(9000);
    const libre = await pagina.evaluate(() => !document.querySelector('[inert]'));
    const aviso = await pagina.textContent('#estadoTexto');
    await pagina.fill('#texto', 'LO MIO', { timeout: 2000 }).catch(() => {});
    await esperar(4000); // llega la respuesta tardía
    const r = await pagina.evaluate(() => ({ texto: document.getElementById('texto').value, textoVisible: document.getElementById('seccionTexto').style.display !== 'none' }));
    await navegador.close();
    return informe('si Firebase tarda más de 8 s se libera el panel y lo tardío no pisa lo que se escribió', libre && r.texto === 'LO MIO' && r.textoVisible && /lenta/i.test(aviso), `libre a los 9 s=${libre} · aviso="${aviso.trim()}" · texto final="${r.texto}" · sigue en Texto=${r.textoVisible}`);
  },

  // 2d) La lentitud llega en la SEGUNDA fase del arranque (canción o catálogos): el panel que se libera
  //     tiene que ser coherente (lo que se ve = lo que se envía) y lo tardío no puede pisar lo que se hizo.
  async arranqueLentoEnLaSegundaFase() {
    const { codificarMusical, comprimirCuadros } = await import('../js/compresion.js');
    const m1 = (await codificarMusical({ notas: [{ t: 0, f: 440 }], cuadros: [{ t: 0, bitmap: new Uint8Array(1024).fill(0xFF) }], duracion: 2000, repetir: true })).datos;
    const z = await comprimirCuadros([{ datos: bm, dur: 100 }, { datos: bm, dur: 100 }]);
    const cfg = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', modoTexto: 'ajustar', fuente: 'sans' };
    const casos = {
      musical: { semilla: { musicales: { indice: { x: { nombre: 'X', fecha: 1 } }, datos: { x: m1 } }, oled_remota: { version: 3, pantalla: { tipo: 'musical', texto: '', config: cfg, musical: { nombre: 'x', repeticiones: 1, formato: 'm1' } }, archivo: { version: 3, datos: m1 } } }, lento: { 'musicales/datos': 11000 }, visible: 'seccionCancion', permitidos: ['musical', 'cancion'] },
      gif: { semilla: { animaciones: { g: { ancho: 128, alto: 64, cuadros: [{ datos: bm, dur: 100 }], meta: { origen: 'gif' } } }, oled_remota: { version: 3, pantalla: { tipo: 'animacion', texto: '', config: cfg, animacion: { nombre: 'g', ancho: 128, alto: 64, formato: 'z1', cantidad: 2 } }, archivo: { version: 3, datos: z.datos } } }, lento: { animaciones: 11000 }, visible: 'seccionGaleria', permitidos: ['animacion'] }
    };
    let todoOk = true; const detalles = [];
    for (const [nombre, c] of Object.entries(casos)) {
      const { navegador, pagina } = await abrir(c.semilla, { esperar: false, retrasos: c.lento });
      await pagina.waitForSelector('#texto', { state: 'attached' });
      await esperar(9500); // pasó el límite de 8 s: el panel ya está libre
      const libre = await pagina.evaluate(() => !document.querySelector('[inert]'));
      const visible1 = await pagina.evaluate((id) => document.getElementById(id).style.display !== 'none', c.visible);
      // Primero pulsa Enviar sin tocar nada más: lo que se mande tiene que ser coherente con la pestaña que ve.
      const vAntes = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota.version);
      await pagina.click('#enviar', { timeout: 2000 }).catch(() => {});
      await esperar(500);
      const sinCambiar = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota);
      const coherente = sinCambiar.version === vAntes || c.permitidos.includes(sinCambiar.pantalla.tipo);
      // El cliente, ya libre, hace lo suyo: va a Texto, escribe y envía.
      await pagina.click('#grupoTipo button[data-valor="texto"]', { timeout: 2000 }).catch(() => {});
      await pagina.fill('#texto', 'LO MIO', { timeout: 2000 }).catch(() => {});
      await pagina.click('#enviar', { timeout: 2000 }).catch(() => {});
      await esperar(500);
      const p = await db(pagina, () => globalThis.__fakeDb.raiz.oled_remota.pantalla);
      await esperar(3500); // llega lo tardío
      const despues = await pagina.evaluate(() => ({ texto: document.getElementById('texto').value, enTexto: document.getElementById('seccionTexto').style.display !== 'none' }));
      await navegador.close();
      const ok = libre && visible1 && coherente && p.tipo === 'texto' && p.texto === 'LO MIO' && despues.texto === 'LO MIO' && despues.enTexto;
      todoOk = todoOk && ok;
      detalles.push(`${nombre}: libre=${libre} veía su pestaña=${visible1} Enviar sin tocar nada coherente=${coherente} envió tipo=${p.tipo} texto="${p.texto}" · después texto="${despues.texto}" sigue en Texto=${despues.enTexto}`);
    }
    return informe('si lo lento es la segunda fase del arranque, el panel liberado es coherente y lo tardío no lo pisa', todoOk, detalles.join(' || '));
  },

  // 3) Guardar sin señal: avisa a los 15 s y, al volver la señal, termina solo.
  async guardarSinSenal() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.setInputFiles('#cargadorImagenGaleria', { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await esperar(600);
    await pagina.fill('#nombreGaleriaNueva', 'sinsenal');
    await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
    await pagina.click('#botonGuardarGaleriaNueva');
    await esperar(16500);
    const aviso = await pagina.textContent('#avisoGaleriaNueva');
    const apagado = await pagina.evaluate(() => document.getElementById('botonGuardarGaleriaNueva').disabled);
    await pagina.evaluate(() => { globalThis.__fakeDb.colgar = false; globalThis.__fakeDb.soltar(); });
    await esperar(800);
    const fin = await pagina.textContent('#avisoGaleriaNueva');
    const libre = await pagina.evaluate(() => !document.getElementById('botonGuardarGaleriaNueva').disabled);
    await navegador.close();
    const ok = /lenta/i.test(aviso) && apagado && /Guardada/.test(fin) && libre;
    return informe('guardar sin señal: avisa que está lenta (botón ocupado) y al volver la señal termina solo', ok, `a los 16 s="${aviso.trim()}" botón ocupado=${apagado} · al volver="${fin.trim()}" botón libre=${libre}`);
  },

  // 3b) Borrar sin señal.
  async borrarSinSenal() {
    const semilla = { imagenes: { a: { datos: bm, ancho: 128, alto: 64, meta: {} } } };
    const { navegador, pagina } = await abrir(semilla);
    pagina.on('dialog', (d) => d.accept());
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await esperar(400);
    await pagina.click('#gridGaleria .item-galeria'); await esperar(200);
    await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
    await pagina.click('#botonBorrarGaleria');
    await esperar(16500);
    const estado = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('borrar sin señal avisa que la conexión está lenta', /lenta/i.test(estado), `a los 16 s="${estado.trim()}"`);
  },

  // 4c) Importar dos veces a la vez.
  async importarDosVeces() {
    const ino = fs.readFileSync(new URL('./fixtures/cancion-corta.ino', import.meta.url));
    const { navegador, pagina, errores } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="cancion"]');
    const f = { name: 'vuelvepetro.ino', mimeType: 'text/plain', buffer: ino };
    await pagina.setInputFiles('#cargadorMusical', f);
    await pagina.setInputFiles('#cargadorMusical', { ...f, name: 'otra.ino' });
    await esperar(5000);
    const n = await db(pagina, () => globalThis.__fakeDb.escrituras.filter((e) => e.ruta === 'musicales').length);
    const aviso = await pagina.textContent('#avisoCancion');
    await navegador.close();
    return informe('importar mientras otra importación sigue en curso no las mezcla', n === 1 && SIN_ERRORES(errores).length === 0, `importaciones hechas=${n} (la segunda debía esperar o avisar) · aviso="${aviso.trim().slice(0, 60)}"`);
  },

  // 4a) Doble clic en Guardar.
  async dobleClicGuardar() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.setInputFiles('#cargadorImagenGaleria', { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await esperar(600);
    await pagina.fill('#nombreGaleriaNueva', 'doble');
    await pagina.evaluate(() => { globalThis.__fakeDb.retrasoEscritura = 300; }); // el servidor real tarda en confirmar
    await pagina.dblclick('#botonGuardarGaleriaNueva');
    await esperar(1000);
    const n = await db(pagina, () => globalThis.__fakeDb.escrituras.filter((e) => e.ruta === 'imagenes/doble').length);
    await navegador.close();
    return informe('doble clic en Guardar guarda una sola vez', n === 1, `escrituras=${n}`);
  },

  // 4b) Doble clic en Borrar: una sola pregunta.
  async dobleClicBorrar() {
    const semilla = { imagenes: { a: { datos: bm, ancho: 128, alto: 64, meta: {} } } };
    const { navegador, pagina } = await abrir(semilla);
    let preguntas = 0; pagina.on('dialog', (d) => { preguntas++; d.accept(); });
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await esperar(400);
    await pagina.click('#gridGaleria .item-galeria'); await esperar(200);
    await pagina.dblclick('#botonBorrarGaleria');
    await esperar(1000);
    await navegador.close();
    return informe('doble clic en Borrar pregunta una sola vez', preguntas === 1, `preguntas=${preguntas}`);
  },

  // 4d) El mismo archivo dos veces: el campo se limpia, así elegirlo de nuevo vuelve a funcionar.
  async mismoArchivoDosVeces() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="imagen"]');
    await pagina.setInputFiles('#cargadorImagen', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await esperar(600);
    const imagen = await pagina.evaluate(() => document.getElementById('cargadorImagen').files.length);
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.setInputFiles('#cargadorImagenGaleria', { name: 'b.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await esperar(600);
    const galeria = await pagina.evaluate(() => document.getElementById('cargadorImagenGaleria').files.length);
    const estado = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('después de subir una imagen el campo queda libre (elegir el mismo archivo otra vez funciona)', imagen === 0 && galeria === 0 && /procesada/i.test(estado), `archivos que quedan: Imagen=${imagen} Galería=${galeria} · estado="${estado.trim()}"`);
  },

  // 4e) Guardar sin permiso: el mensaje no menciona cosas técnicas.
  async guardarSinPermiso() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.setInputFiles('#cargadorImagenGaleria', { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await esperar(600);
    await pagina.fill('#nombreGaleriaNueva', 'x');
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['imagenes'] = true; });
    await pagina.click('#botonGuardarGaleriaNueva'); await esperar(500);
    const aviso = (await pagina.textContent('#avisoGaleriaNueva')).trim();
    await navegador.close();
    return informe('guardar sin permiso: mensaje claro, sin datos técnicos', /^No se pudo guardar: sin permiso.?$/.test(aviso), `aviso="${aviso}"`);
  },

  // 8) Un error inesperado: mensaje simple, nada técnico en pantalla; avisos inofensivos del navegador se ignoran.
  async redDeSeguridad() {
    const { navegador, pagina } = await abrir({});
    const leer = () => pagina.evaluate(() => ({ estado: document.getElementById('estadoTexto').textContent.trim(), error: document.getElementById('estadoLinea').classList.contains('error') }));
    await pagina.evaluate(() => { document.getElementById('estadoTexto').textContent = 'Estado normal'; });
    await pagina.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' })));
    await esperar(150);
    const inofensivo = await leer();
    await pagina.evaluate(() => { setTimeout(() => { throw new Error('cosa interna X123'); }, 0); });
    await esperar(300);
    const error1 = await leer();
    await pagina.evaluate(() => { document.getElementById('estadoTexto').textContent = 'Estado normal'; Promise.reject(new TypeError('detalle Y456')); });
    await esperar(300);
    const error2 = await leer();
    await navegador.close();
    const ok = inofensivo.estado === 'Estado normal' && error1.estado === 'Algo salió mal. Vuelve a intentarlo.' && error1.error && error2.estado === 'Algo salió mal. Vuelve a intentarlo.' && !/X123|Y456|Error/.test(error1.estado + error2.estado);
    return informe('un error inesperado muestra un mensaje simple (sin detalles técnicos) y los avisos inofensivos se ignoran', ok, `inofensivo="${inofensivo.estado}" · error="${error1.estado}" · rechazo="${error2.estado}"`);
  },

  // 9) Expandir y contraer el lienzo (pantalla completa / rotación): ninguna promesa rechazada debe llegar a la red de seguridad.
  async expandirYContraerDibujo() {
    const { navegador, pagina, errores } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="dibujo"]');
    for (let i = 0; i < 3; i++) {
      await pagina.click('#botonExpandirDibujo'); await esperar(400);
      await pagina.click('#botonContraerDibujo'); await esperar(400);
    }
    const estado = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('expandir y contraer el lienzo varias veces no dispara la red de seguridad', !/Algo salió mal/.test(estado) && SIN_ERRORES(errores).length === 0, `estado="${estado.trim()}" errores sin atrapar=${SIN_ERRORES(errores).length}`);
  },

  // 5) Pulsa Enviar mientras la canción todavía carga.
  async enviarMientrasCargaCancion() {
    const { codificarMusical } = await import('../js/compresion.js');
    const m1 = (await codificarMusical({ notas: [{ t: 0, f: 440 }], cuadros: [{ t: 0, bitmap: new Uint8Array(1024).fill(0xFF) }], duracion: 2000, repetir: true })).datos;
    const semilla = { musicales: { indice: { a: { nombre: 'A', fecha: 1 } }, datos: { a: m1 } } };
    const { navegador, pagina } = await abrir(semilla);
    await pagina.click('#grupoTipo button[data-valor="cancion"]'); await esperar(300);
    await pagina.evaluate(() => { globalThis.__fakeDb.retrasos['musicales/datos/a'] = 2000; });
    await pagina.selectOption('#seleccionCancion', 'a');
    await pagina.click('#enviar'); await esperar(300);
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('Enviar mientras carga la canción dice que espere (no "Elige una canción")', /espera|cargando/i.test(msg), `mensaje="${msg.trim()}"`);
  },

  // 6) Dibujar con dos dedos.
  async dibujoDosDedos() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="dibujo"]');
    const r = await pagina.evaluate(async () => {
      const c = document.getElementById('lienzoDibujo'); const b = c.getBoundingClientRect();
      const ev = (tipo, id, x, y, extra = {}) => c.dispatchEvent(new PointerEvent(tipo, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: 1, clientX: b.left + x * b.width / 128, clientY: b.top + y * b.height / 64, bubbles: true, ...extra }));
      const seguro = (f) => { try { f(); } catch (e) { /* setPointerCapture con un id inventado */ } };
      seguro(() => ev('pointerdown', 1, 10, 10));
      seguro(() => ev('pointermove', 1, 14, 10));
      seguro(() => ev('pointerdown', 2, 118, 54));   // segundo dedo, lejos del primero
      seguro(() => ev('pointermove', 2, 114, 54));
      seguro(() => ev('pointermove', 1, 18, 10));
      seguro(() => ev('pointermove', 2, 110, 54));
      seguro(() => ev('pointerup', 2, 110, 54));
      seguro(() => ev('pointerup', 1, 18, 10));
      const d = c.getContext('2d').getImageData(0, 0, 128, 64).data;
      const enciende = (x, y) => d[(y * 128 + x) * 4 + 3] > 0 && (d[(y * 128 + x) * 4] > 100 || d[(y * 128 + x) * 4 + 1] > 100);
      // ¿Hay trazo en el medio, entre los dos dedos?
      let medio = 0; for (let y = 20; y <= 44; y++) for (let x = 30; x <= 98; x++) if (enciende(x, y)) medio++;
      return { medio };
    });
    await navegador.close();
    return informe('dibujar con dos dedos no une los dos puntos con una raya', r.medio === 0, `puntos encendidos entre los dedos=${r.medio}`);
  },

  // 7a) Un archivo que no es una imagen.
  async archivoQueNoEsImagen() {
    const { navegador, pagina, errores } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="imagen"]');
    await pagina.setInputFiles('#cargadorImagen', { name: 'documento.png', mimeType: 'image/png', buffer: Buffer.from('%PDF-1.4 esto no es una imagen') });
    await esperar(1200);
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('un archivo que no es imagen avisa claramente', /^No se pudo leer ese archivo como imagen. Prueba con un PNG, JPG o GIF.$/.test(msg.trim()) && SIN_ERRORES(errores).length === 0, `mensaje="${msg.trim()}" errores=${SIN_ERRORES(errores).length}`);
  },

  // 7b) GIF corrupto.
  async gifCorrupto() {
    const { navegador, pagina, errores } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="imagen"]');
    await pagina.setInputFiles('#cargadorImagen', { name: 'roto.gif', mimeType: 'image/gif', buffer: Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40, 7)]) });
    await esperar(1500);
    const msg = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('un GIF corrupto avisa claramente', /^No se pudo leer ese GIF. Prueba con otro.$/.test(msg.trim()) && SIN_ERRORES(errores).length === 0, `mensaje="${msg.trim()}" errores=${SIN_ERRORES(errores).join('|').slice(0, 80)}`);
  },

  // 7c) GIF enorme (muchos cuadros): no debe congelar la página sin aviso.
  async gifEnorme() {
    const { navegador, pagina } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="imagen"]');
    const archivo = gif(64, 32, 600);
    const t0 = Date.now();
    await pagina.setInputFiles('#cargadorImagen', { name: 'enorme.gif', mimeType: 'image/gif', buffer: archivo });
    let listo = false;
    try { await pagina.waitForFunction(() => /GIF:|No se pudo|demasiad/i.test(document.getElementById('estadoTexto').textContent), null, { timeout: 40000 }); listo = true; } catch (e) { /* se colgó */ }
    const ms = Date.now() - t0;
    const msg = await pagina.textContent('#estadoTexto').catch(() => '(página colgada)');
    await navegador.close();
    return informe('un GIF con 600 cuadros responde en pocos segundos o avisa que es demasiado', listo && ms < 8000, `${(archivo.length / 1024).toFixed(0)} KB · respondió en ${ms} ms · "${msg.trim().slice(0, 90)}"`);
  },
};

const elegidos = process.argv.slice(2);
for (const [nombre, fn] of Object.entries(ESCENARIOS)) {
  if (elegidos.length && !elegidos.includes(nombre)) continue;
  try { await fn(); } catch (e) { informe(nombre, false, 'EXCEPCIÓN: ' + e.message.split('\n')[0]); }
}
cerrarServidor();
const malos = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length} escenarios: ${resultados.length - malos} bien, ${malos} con problemas`);
