// Pruebas del panel en Chrome con Firebase falso. Uso: node pruebas-panel.mjs [nombre...]
import { abrir, leerOled, informe, cerrarServidor } from './banco.mjs';
import { codificarMusical } from '../js/compresion.js';

// Canciones de prueba (formato m1): una sola imagen cada una, distinta.
const imagen = (f) => { const u = new Uint8Array(1024); for (let i = 0; i < 1024; i++) u[i] = f(i); return u; };
const M1 = {
  a: (await codificarMusical({ notas: [{ t: 0, f: 440 }], cuadros: [{ t: 0, bitmap: imagen(() => 0xFF) }], duracion: 2000, repetir: true })).datos,
  b: (await codificarMusical({ notas: [{ t: 0, f: 494 }], cuadros: [{ t: 0, bitmap: imagen((i) => (i < 64 ? 0xFF : 0)) }], duracion: 3000, repetir: true })).datos,
  unaVez: (await codificarMusical({ notas: [{ t: 0, f: 440 }, { t: 500, f: 0 }], cuadros: [{ t: 0, bitmap: imagen(() => 0x0F) }], duracion: 1000, repetir: false })).datos,
  c: (await codificarMusical({ notas: [{ t: 0, f: 523 }], cuadros: [{ t: 0, bitmap: imagen(() => 0x81) }], duracion: 4000, repetir: true })).datos
};
const SEMILLA_CANCIONES = {
  musicales: {
    indice: { unaVez: { nombre: 'Una vez' }, a: { nombre: 'Canción A' }, b: { nombre: 'Canción B' }, c: { nombre: 'Canción C' } },
    datos: M1
  }
};
// PNG de 1×1 blanco (la "copia editable" de una imagen de la galería).
const PNG_BLANCO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAWB4/xwAAAABJRU5ErkJggg==';

const bitmap = (f) => { const b = Buffer.alloc(1024); for (let i = 0; i < 1024; i++) b[i] = f(i); return b.toString('base64'); };
const B1 = bitmap((i) => (i % 16 < 8 ? 0xF0 : 0x0F));
const B2 = bitmap((i) => (i % 3 === 0 ? 0xAA : 0x00));
const CIAN = '77,210,255', NEGRO = '0,0,0';

const ESCENARIOS = {
  async humo() {
    const { navegador, pagina, errores } = await abrir({});
    for (const t of ['imagen', 'dibujo', 'cancion', 'galeria', 'texto']) {
      await pagina.click(`#grupoTipo button[data-valor="${t}"]`);
      await pagina.waitForTimeout(150);
    }
    await navegador.close();
    return informe('humo: todas las pestañas sin errores', errores.length === 0, errores.join(' | '));
  },

  async scrollClasica() {
    const { navegador, pagina, errores } = await abrir({});
    const raros = new Set();
    for (const fuente of ['clasica', 'sans', 'serifi']) {
      for (const modo of ['scroll', 'scrollv']) {
        await pagina.selectOption('#fuenteTexto', fuente);
        await pagina.fill('#texto', 'Hola mundo con scroll, una frase larga para que el texto suba y no entre entero en la pantalla');
        await pagina.check(`input[name="modoTexto"][value="${modo}"]`, { force: true });
        for (let i = 0; i < 8; i++) {
          await pagina.waitForTimeout(67);
          const { colores } = await leerOled(pagina);
          colores.filter((c) => c !== CIAN && c !== NEGRO).forEach((c) => raros.add(`${fuente}/${modo}: ${c}`));
        }
      }
    }
    await navegador.close();
    return informe('scroll ↔ y ↕ (clásica, sans, serif cursiva): solo píxeles encendidos o apagados', raros.size === 0 && errores.length === 0,
      raros.size ? `${raros.size} colores intermedios, ej. ${[...raros].slice(0, 3).join(' / ')}` : errores.join(' | '));
  },

  async dibujoGrosor1() {
    const { navegador, pagina, errores } = await abrir({});
    await pagina.click('#grupoTipo button[data-valor="dibujo"]');
    await pagina.click('#grupoGrosor button[data-valor="1"]');
    const caja = await pagina.locator('#lienzoDibujo').boundingBox();
    const x0 = caja.x + caja.width * 0.1, y0 = caja.y + caja.height * 0.2;
    const x1 = caja.x + caja.width * 0.9, y1 = caja.y + caja.height * 0.8;
    await pagina.mouse.move(x0, y0);
    await pagina.mouse.down();
    for (let k = 1; k <= 40; k++) await pagina.mouse.move(x0 + (x1 - x0) * k / 40, y0 + (y1 - y0) * k / 40);
    await pagina.mouse.up();
    await pagina.waitForTimeout(150);
    const { encendidos } = await leerOled(pagina);
    const lienzo = await leerOled(pagina, '#lienzoDibujo');
    const intermedios = lienzo.colores.filter((c) => c !== CIAN && c !== '6,5,3');
    // Una diagonal de ~102 px de ancho en la OLED debería prender ~102 puntos,
    // los mismos que se ven en el lienzo (sin grises a medio pintar).
    await navegador.close();
    return informe('dibujo grosor 1: la línea llega entera a la OLED', encendidos >= 95 && encendidos === lienzo.encendidos && intermedios.length === 0 && errores.length === 0,
      `${encendidos} puntos en la OLED, ${lienzo.encendidos} en el lienzo, ${intermedios.length} colores intermedios (esperado ≈ 102, iguales, 0)`);
  },

  async cancionLentaNoPisa() {
    const { navegador, pagina, errores } = await abrir(SEMILLA_CANCIONES);
    await pagina.evaluate(() => { globalThis.__fakeDb.retrasos['musicales/datos/a'] = 800; });
    await pagina.click('#grupoTipo button[data-valor="cancion"]');
    await pagina.selectOption('#seleccionCancion', 'a');
    await pagina.waitForTimeout(50);
    await pagina.selectOption('#seleccionCancion', 'b');
    await pagina.waitForTimeout(1200);
    const aviso = await pagina.textContent('#avisoCancion');
    const oled = await leerOled(pagina);
    await pagina.click('#enviar');
    await pagina.waitForTimeout(300);
    const enviada = await pagina.evaluate(() => globalThis.__fakeDb.raiz.oled_remota?.pantalla?.musical?.nombre);
    await navegador.close();
    // La imagen de B tiene 64 bytes llenos = 512 puntos.
    const ok = /Canción B/.test(aviso) && oled.encendidos === 512 && enviada === 'b' && errores.length === 0;
    return informe('canción lenta que llega tarde no reemplaza a la elegida', ok, `aviso="${aviso}", puntos=${oled.encendidos}, enviada=${enviada}`);
  },

  async cancionQueFallaNoEnviaLaAnterior() {
    const { navegador, pagina, errores } = await abrir(SEMILLA_CANCIONES);
    await pagina.click('#grupoTipo button[data-valor="cancion"]');
    await pagina.selectOption('#seleccionCancion', 'a');
    await pagina.waitForTimeout(300);
    await pagina.evaluate(() => { delete globalThis.__fakeDb.raiz.musicales.datos.c; });
    await pagina.selectOption('#seleccionCancion', 'c');
    await pagina.waitForTimeout(300);
    await pagina.click('#enviar');
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => ({ enviada: globalThis.__fakeDb.raiz.oled_remota?.pantalla?.musical?.nombre || null, estado: document.getElementById('estadoTexto').textContent }));
    await navegador.close();
    const errReales = errores.filter((e) => !/Error cargando la canción/.test(e));
    return informe('si una canción falla al cargar, no se envía la anterior', r.enviada === null && /Elige una canción/.test(r.estado) && errReales.length === 0, JSON.stringify(r));
  },

  async umbralViejoNoPisaOtraImagen() {
    const semilla = {
      imagenes: {
        x_editable: { datos: B1, ancho: 128, alto: 64, preprocesada: PNG_BLANCO, meta: { umbral: 127, dithering: false } },
        y_fija: { datos: B2, ancho: 128, alto: 64, meta: {} }
      }
    };
    const { navegador, pagina, errores } = await abrir(semilla);
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.waitForTimeout(300);
    await pagina.click('#gridGaleria .item-galeria:nth-child(1)');
    await pagina.waitForTimeout(300);
    // Mover el umbral y, en el mismo instante, elegir la otra imagen.
    await pagina.evaluate(() => {
      const u = document.getElementById('umbralGaleria');
      u.value = '50';
      u.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#gridGaleria .item-galeria:nth-child(2)').click();
    });
    await pagina.waitForTimeout(500);
    const oled = await leerOled(pagina);
    await navegador.close();
    // B2: un byte de cada 3 vale 0xAA (4 puntos) -> 342 × 4 = 1368 puntos.
    return informe('reajuste viejo del umbral no pisa la imagen recién elegida', oled.encendidos === 1368 && errores.length === 0, `${oled.encendidos} puntos (esperado 1368)`);
  },

  async catalogosIlegibles() {
    const { navegador, pagina, errores } = await abrir(SEMILLA_CANCIONES, {
      antes: (p) => p.addInitScript(() => { globalThis.__fallarInicial = { musicales: true, imagenes: true, animaciones: true }; })
    });
    await pagina.click('#grupoTipo button[data-valor="cancion"]');
    const r1 = await pagina.evaluate(() => ({
      opcion: document.querySelector('#seleccionCancion option')?.textContent,
      aviso: document.getElementById('avisoCancion').textContent
    }));
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.waitForTimeout(300);
    const r2 = await pagina.evaluate(() => ({
      imagenes: document.querySelector('#gridGaleria .galeria-vacio')?.textContent,
      gif: document.querySelector('#gridGifs .galeria-vacio')?.textContent
    }));
    await navegador.close();
    const errReales = errores.filter((e) => !/PERMISSION_DENIED|Error al listar/.test(e));
    const ok = /No se pudo leer/.test(r1.opcion) && /sin permiso/.test(r1.aviso) && /No se pudo leer/.test(r2.imagenes) && /No se pudieron leer/.test(r2.gif) && errReales.length === 0;
    return informe('catálogo que no se puede leer no se muestra como vacío', ok, JSON.stringify({ ...r1, ...r2 }));
  },

  async envioSinPermiso() {
    const { navegador, pagina, errores } = await abrir({});
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['oled_remota'] = true; });
    await pagina.click('#enviar');
    await pagina.waitForTimeout(300);
    const estado = await pagina.textContent('#estadoTexto');
    await navegador.close();
    return informe('envío rechazado muestra el motivo', /sin permiso/.test(estado), estado);
  },

  async enviosSimultaneos() {
    const { navegador, pagina, errores } = await abrir({ oled_remota: { version: 41 } });
    const r = await pagina.evaluate(async () => {
      const fb = await import("/js/firebase.js");
      // Los dos envíos leen "version" al mismo tiempo (41).
      globalThis.__fakeDb.retrasos["oled_remota/version"] = 200;
      const base = { tipo: "texto", texto: "x", tamano: 1, alineacion: "centro", alineacionV: "centro", invertido: false, modoTexto: "fijo" };
      const [a, b] = await Promise.all([fb.enviarEstado({ ...base, texto: "A" }), fb.enviarEstado({ ...base, texto: "B" })]);
      const w = globalThis.__fakeDb.escrituras.filter((e) => e.op === "update" && e.ruta === "oled_remota").map((e) => e.valor.version);
      return { a: a.version, b: b.version, escritas: w, final: globalThis.__fakeDb.raiz.oled_remota.version };
    });
    await navegador.close();
    const ok = r.a !== r.b && new Set(r.escritas).size === 2 && Math.min(r.a, r.b) === 42 && errores.length === 0;
    return informe("dos envíos simultáneos salen con versiones distintas", ok, JSON.stringify(r) + (errores.length ? " " + errores.join(" | ") : ""));
  },

  async envioConRedColgada() {
    const { navegador, pagina } = await abrir({});
    await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
    await pagina.click('#enviar');
    await pagina.waitForTimeout(16000);
    const r1 = await pagina.evaluate(() => ({ estado: document.getElementById('estadoTexto').textContent, boton: !document.getElementById('enviar').disabled }));
    await pagina.evaluate(() => globalThis.__fakeDb.soltar());
    await pagina.waitForTimeout(300);
    const r2 = await pagina.textContent('#estadoTexto');
    await navegador.close();
    const ok = /lenta/.test(r1.estado) && r1.boton && /Enviado/.test(r2);
    return informe('envío con la red colgada no bloquea el botón y avisa al terminar', ok, `${JSON.stringify(r1)} → "${r2}"`);
  },

  async borrarPideConfirmacion() {
    const semilla = { imagenes: { foto: { datos: B1, ancho: 128, alto: 64, meta: {} } } };
    const { navegador, pagina, errores } = await abrir(semilla);
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]');
    await pagina.waitForTimeout(300);
    await pagina.click('#gridGaleria .item-galeria');
    let respuesta = false;
    pagina.on('dialog', (d) => (respuesta ? d.accept() : d.dismiss()));
    await pagina.click('#botonBorrarGaleria');
    await pagina.waitForTimeout(200);
    const trasCancelar = await pagina.evaluate(() => !!globalThis.__fakeDb.raiz.imagenes?.foto);
    respuesta = true;
    await pagina.click('#botonBorrarGaleria');
    await pagina.waitForTimeout(300);
    const trasAceptar = await pagina.evaluate(() => !!globalThis.__fakeDb.raiz.imagenes?.foto);
    await navegador.close();
    return informe('borrar de la galería pide confirmación', trasCancelar && !trasAceptar && errores.length === 0, `cancelar: sigue=${trasCancelar}; aceptar: sigue=${trasAceptar}`);
  },

  async repeticionesValidas() {
    const semilla = {
      ...SEMILLA_CANCIONES,
      oled_remota: { version: 1, pantalla: { tipo: 'musical', texto: '', config: {}, musical: { nombre: 'a', repeticiones: 3, formato: 'm1' } } }
    };
    const { navegador, pagina, errores } = await abrir(semilla);
    await pagina.waitForTimeout(300);
    const alAbrir = await pagina.inputValue('#inputRepeticiones');
    const enviadas = [];
    for (const v of ['-3', '0', '2.7', '500']) {
      await pagina.fill('#inputRepeticiones', v);
      await pagina.click('#enviar');
      await pagina.waitForTimeout(250);
      enviadas.push(await pagina.evaluate(() => globalThis.__fakeDb.raiz.oled_remota.pantalla.musical.repeticiones));
    }
    await navegador.close();
    const ok = alAbrir === '3' && JSON.stringify(enviadas) === '[1,1,2,99]' && errores.length === 0;
    return informe('repeticiones: entero de 1 a 99 y se muestra la guardada', ok, `al abrir=${alAbrir}, enviadas=${JSON.stringify(enviadas)}`);
  },

  async musicalQueNoSeRepite() {
    const { navegador, pagina, errores } = await abrir(SEMILLA_CANCIONES);
    await pagina.click('#grupoTipo button[data-valor="cancion"]');
    const filaVisible = () => pagina.evaluate(() => !document.getElementById('inputRepeticiones').closest('.campo').hidden);
    const r = {};
    await pagina.selectOption('#seleccionCancion', 'a'); await pagina.waitForTimeout(300);
    r.filaConA = await filaVisible();
    await pagina.fill('#inputRepeticiones', '5');
    await pagina.selectOption('#seleccionCancion', 'unaVez'); await pagina.waitForTimeout(300);
    r.filaConUnaVez = await filaVisible();
    await pagina.click('#enviar'); await pagina.waitForTimeout(300);
    r.conLetra = await pagina.evaluate(() => globalThis.__fakeDb.raiz.oled_remota.pantalla.musical.repeticiones);
    await pagina.click('#grupoLetra button[data-valor="sin"]');
    await pagina.click('#enviar'); await pagina.waitForTimeout(300);
    r.sinLetra = await pagina.evaluate(() => globalThis.__fakeDb.raiz.oled_remota.pantalla.cancion.repeticiones);
    await pagina.selectOption('#seleccionCancion', 'a'); await pagina.waitForTimeout(300);
    r.filaOtraVez = await filaVisible();
    await pagina.click('#enviar'); await pagina.waitForTimeout(300);
    r.sinLetraA = await pagina.evaluate(() => globalThis.__fakeDb.raiz.oled_remota.pantalla.cancion.repeticiones);
    await navegador.close();
    const ok = r.filaConA && r.filaConUnaVez && r.conLetra === 5 && r.sinLetra === 5 && r.filaOtraVez && r.sinLetraA === 5 && errores.length === 0;
    return informe('todas las canciones (también las que su .ino no repite) respetan Repeticiones', ok, JSON.stringify(r) + (errores.length ? ' ' + errores.join(' | ') : ''));
  },

  async galeriaAlArrancar() {
    const semilla = {
      oled_remota: {
        version: 5, lastSeen: Date.now(),
        pantalla: {
          tipo: 'animacion', texto: 'hola', config: { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans' },
          animacion: { nombre: 'migif', ancho: 128, alto: 64, cuadros: [{ datos: B1, dur: 100 }, { datos: B2, dur: 100 }] }
        }
      },
      animaciones: {
        migif: { ancho: 128, alto: 64, cuadros: [{ datos: B1, dur: 100 }, { datos: B2, dur: 100 }], meta: { origen: 'gif' } },
        ojos: { ancho: 128, alto: 64, cuadros: [{ datos: B2, dur: 100 }], meta: {} }
      }
    };
    const { navegador, pagina, errores } = await abrir(semilla);
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => ({
      gif: document.querySelectorAll('#gridGifs .item-galeria').length,
      gifVisible: !document.getElementById('gridGifs').hidden,
      activo: !!document.querySelector('#gridGifs .item-galeria.activo'),
      borrarHabilitado: !document.getElementById('botonBorrarAnimacion').disabled
    }));
    await navegador.close();
    const ok = r.gif === 1 && r.gifVisible && r.activo && r.borrarHabilitado && errores.length === 0;
    return informe('galería al arrancar con un GIF enviado: lista GIF cargada y marcada', ok, JSON.stringify(r) + (errores.length ? ' ' + errores.join(' | ') : ''));
  }
};

const elegidos = process.argv.slice(2);
let fallas = 0;
for (const [nombre, fn] of Object.entries(ESCENARIOS)) {
  if (elegidos.length && !elegidos.includes(nombre)) continue;
  try { if (!(await fn())) fallas++; } catch (e) { fallas++; informe(nombre, false, e.message.split('\n')[0]); }
}
cerrarServidor();
process.exit(fallas ? 1 : 0);
