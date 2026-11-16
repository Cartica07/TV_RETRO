// Pruebas de Mi TV y de las rutas nuevas (modo cuentas, ?cuentas=1). Uso: node tv.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = (texto) => ({ tipo: 'texto', texto, config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } });
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };

function semilla(extra = {}) {
  return Object.assign({
    dispositivos: {
      tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') } },
      tv2: { dueno: 'uid-ana', oled_remota: { version: 7, pantalla: pant('Soy la TV 2') } },
      tv9: { oled_remota: { version: 1, pantalla: pant('TV nueva sin dueño') } }
    },
    usuarios: { 'uid-ana': { dispositivos: { tv1: true }, imagenes: { foto1: { datos: '00', ancho: 128, alto: 64, meta: {} } } } },
    emparejamiento: { K7M2QX: { id: 'tv9', creado: Date.now() } },
    oled_remota: { version: 1, pantalla: pant('RUTA VIEJA: no se debe leer') },
    imagenes: { vieja: { datos: '00', ancho: 128, alto: 64, meta: {} } }
  }, extra);
}

async function abrirCuentas({ db = semilla(), logueado = true, antes = null } = {}) {
  const r = await abrir(db, {
    ruta: '/index.html?cuentas=1', esperar: false,
    antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: logueado ? 'ana@correo.com' : null });
      if (antes) await antes(p);
    }
  });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForTimeout(500);
  return r;
}
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const texto = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const panelInerte = (p) => p.evaluate(() => document.querySelector('main.controles').inert);
const esperarPanel = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
const escrituras = (p) => p.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
const lecturas = (p) => p.evaluate(() => globalThis.__fakeDb.lecturas);
const erroresPagina = (e) => e.filter((x) => x.startsWith('página:'));

const escenarios = {
  async 'cuenta con una TV: arranca directo y usa las rutas nuevas'() {
    const { navegador, pagina, errores } = await abrirCuentas();
    await esperarPanel(pagina); await pagina.waitForTimeout(500);
    const txt = await pagina.inputValue('#texto');
    const lec = await lecturas(pagina);
    const viejas = lec.filter((r) => /^(onValue:)?(oled_remota|imagenes|animaciones)(\/|$)/.test(r));
    const nuevas = lec.filter((r) => /dispositivos\/tv1\/oled_remota/.test(r));
    const miTV = await visible(pagina, '#botonMiTV');
    const pantallaTV = await visible(pagina, '#pantallaTV');
    await navegador.close();
    return informe('una TV: carga lo de dispositivos/tv1, no lee las rutas viejas y aparece el botón Mi TV', txt === 'Hola desde TV 1' && viejas.length === 0 && nuevas.length > 0 && miTV && !pantallaTV && !erroresPagina(errores).length, `texto="${txt}" viejas=${JSON.stringify(viejas)} nuevas=${nuevas.length}`);
  },

  async 'enviar escribe en la TV de la cuenta'() {
    const { navegador, pagina } = await abrirCuentas();
    await esperarPanel(pagina);
    await pagina.fill('#texto', 'Mensaje nuevo'); await pagina.waitForTimeout(300);
    await pagina.click('#enviar'); await pagina.waitForTimeout(800);
    const esc = await escrituras(pagina);
    const raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
    await navegador.close();
    const enNueva = esc.some((r) => r.startsWith('dispositivos/tv1/oled_remota'));
    const enVieja = esc.some((r) => /^oled_remota/.test(r));
    const guardado = raiz.dispositivos.tv1.oled_remota.pantalla.texto;
    return informe('enviar: escribe en dispositivos/tv1/oled_remota y nunca en oled_remota', enNueva && !enVieja && guardado === 'Mensaje nuevo' && raiz.dispositivos.tv1.oled_remota.version === 4, `escrituras=${JSON.stringify(esc)} texto="${guardado}" version=${raiz.dispositivos.tv1.oled_remota.version}`);
  },

  async 'catálogos por cuenta'() {
    const { navegador, pagina } = await abrirCuentas();
    await esperarPanel(pagina);
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await pagina.waitForTimeout(800);
    const items = await pagina.evaluate(() => [...document.querySelectorAll('#seccionGaleria .item-galeria')].length);
    const nombres = await pagina.evaluate(() => [...document.querySelectorAll('#seccionGaleria .item-galeria-nombre')].map((e) => e.textContent.trim()));
    await pagina.click('#grupoTipo button[data-valor="dibujo"]'); await pagina.waitForTimeout(300);
    await pagina.fill('#nombreGaleriaDibujo', 'mi dibujo');
    await pagina.click('#botonGuardarGaleriaDibujo'); await pagina.waitForTimeout(900);
    const esc = await escrituras(pagina);
    await navegador.close();
    return informe('la Galería lee las imágenes de la cuenta (no las viejas) y guardar escribe en usuarios/{uid}/imagenes', nombres.includes('foto1') && !nombres.includes('vieja') && esc.includes('usuarios/uid-ana/imagenes/mi dibujo') && !esc.some((r) => /^imagenes\//.test(r)), `nombres=${JSON.stringify(nombres)} esc=${JSON.stringify(esc)}`);
  },

  async 'cuenta sin TV: pide el código, valida y vincula'() {
    const db = semilla({ usuarios: { 'uid-ana': {} } });
    const { navegador, pagina, errores } = await abrirCuentas({ db });
    await pagina.waitForTimeout(500);
    const titulo = await texto(pagina, '#tvTitulo');
    const visibleTV = await visible(pagina, '#pantallaTV');
    const inerte = await panelInerte(pagina);
    const volver = await visible(pagina, '#botonTVVolver');
    const enviar = async (c) => { await pagina.fill('#codigoTV', c); await pagina.click('#botonVincularTV'); await pagina.waitForTimeout(350); return texto(pagina, '#tvError'); };
    const corto = await enviar('K7M');
    const confuso = await enviar('K7M0QX'); // tiene un cero
    const inexistente = await enviar('ZZZZZZ');
    const lecturasAntes = (await escrituras(pagina)).length;
    await pagina.fill('#codigoTV', 'k7m-2qx'); await pagina.click('#botonVincularTV');
    await esperarPanel(pagina); await pagina.waitForTimeout(500);
    const raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
    const txt = await pagina.inputValue('#texto');
    const ocultaTV = !(await visible(pagina, '#pantallaTV'));
    await navegador.close();
    const ok = titulo === 'Añade tu TV' && visibleTV && inerte && !volver
      && corto === 'Escribe los 6 caracteres del código.'
      && /no es válido/.test(confuso) && /no existe, ya se usó o venció/.test(inexistente) && lecturasAntes === 0
      && raiz.dispositivos.tv9.dueno === 'uid-ana' && raiz.dispositivos.tv9.codigoUsado === 'K7M2QX' && raiz.usuarios['uid-ana'].dispositivos.tv9 === true
      && txt === 'TV nueva sin dueño' && ocultaTV && !erroresPagina(errores).length;
    return informe('sin TV: "Añade tu TV", valida el código, vincula (dueno, codigoUsado y lista) y sigue con esa TV', ok, JSON.stringify({ titulo, corto, confuso, inexistente, dueno: raiz.dispositivos.tv9.dueno, cod: raiz.dispositivos.tv9.codigoUsado, lista: raiz.usuarios['uid-ana'].dispositivos, txt }));
  },

  async 'vincular en una sola escritura'() {
    const db = semilla({ usuarios: { 'uid-ana': {} } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await pagina.fill('#codigoTV', 'K7M2QX'); await pagina.click('#botonVincularTV'); await pagina.waitForTimeout(600);
    const esc = await pagina.evaluate(() => globalThis.__fakeDb.escrituras.map((e) => ({ op: e.op, ruta: e.ruta, claves: e.op === 'update' ? Object.keys(e.valor) : [] })));
    const unica = esc.filter((e) => e.claves.includes('dispositivos/tv9/dueno'));
    await navegador.close();
    return informe('vincular: dueño, código y lista en UNA sola escritura', unica.length === 1 && unica[0].claves.includes('usuarios/uid-ana/dispositivos/tv9') && unica[0].claves.includes('dispositivos/tv9/codigoUsado') && esc.length === 1, JSON.stringify(esc));
  },

  async 'código rechazado por las reglas'() {
    const db = semilla({ usuarios: { 'uid-ana': {} } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['dispositivos/tv9'] = true; });
    await pagina.fill('#codigoTV', 'K7M2QX'); await pagina.click('#botonVincularTV'); await pagina.waitForTimeout(500);
    const msg = await texto(pagina, '#tvError');
    const sigueTV = await visible(pagina, '#pantallaTV');
    const inerte = await panelInerte(pagina);
    await navegador.close();
    return informe('reglas rechazan el reclamo (vencido o con dueño): mensaje claro y se queda en la pantalla', /el código venció o esa TV ya tiene dueño/.test(msg) && sigueTV && inerte, `msg="${msg}"`);
  },

  async 'doble toque en Vincular'() {
    const db = semilla({ usuarios: { 'uid-ana': {} } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await pagina.evaluate(() => { globalThis.__fakeDb.retrasoEscritura = 500; });
    await pagina.fill('#codigoTV', 'K7M2QX');
    await pagina.dblclick('#botonVincularTV');
    await esperarPanel(pagina);
    const reclamos = await pagina.evaluate(() => globalThis.__fakeDb.escrituras.filter((e) => e.op === 'update' && Object.keys(e.valor).some((k) => (e.ruta ? e.ruta + '/' : '') + k === 'dispositivos/tv9/dueno')).length);
    await navegador.close();
    return informe('doble toque en Vincular: un solo reclamo', reclamos === 1, `reclamos=${reclamos}`);
  },

  async 'no se pudo leer la lista de TV'() {
    const { navegador, pagina } = await abrirCuentas({ antes: async (p) => { await p.addInitScript(() => { globalThis.__fallarInicial = { 'usuarios/uid-ana/dispositivos': true }; }); } });
    await pagina.waitForTimeout(600);
    const titulo = await texto(pagina, '#tvTitulo');
    const sub = await texto(pagina, '#tvSubtitulo');
    const form = await visible(pagina, '#formTV');
    const boton = await texto(pagina, '#botonTVVolver');
    await pagina.evaluate(() => { delete globalThis.__fakeDb.fallar['usuarios/uid-ana/dispositivos']; });
    await pagina.click('#botonTVVolver');
    await esperarPanel(pagina); await pagina.waitForTimeout(400);
    const txt = await pagina.inputValue('#texto');
    await navegador.close();
    return informe('sin poder leer la lista de TV: avisa, permite Reintentar y sigue', titulo === 'No se pudo cargar tus TV' && /sin permiso/.test(sub) && !form && boton === 'Reintentar' && txt === 'Hola desde TV 1', `titulo="${titulo}" sub="${sub}" boton="${boton}" texto="${txt}"`);
  },

  async 'Mi TV: lista, usar otra TV'() {
    const db = semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true, tv2: true } } } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const filas = await pagina.evaluate(() => [...document.querySelectorAll('#listaTV .fila-tv')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()));
    const titulo = await texto(pagina, '#tvTitulo');
    await pagina.click('#listaTV .fila-tv:not(.en-uso) .boton-enlace:not(.peligro)');
    await esperarPanel(pagina); await pagina.waitForTimeout(700);
    const txt = await pagina.inputValue('#texto');
    const pantallaTV = await visible(pagina, '#pantallaTV');
    await navegador.close();
    return informe('Mi TV: lista las TV ("En uso") y al usar la otra recarga con sus datos', titulo === 'Mis TV' && filas.length === 2 && /TV 1.*En uso.*Desvincular/.test(filas[0]) && /TV 2.*Usar.*Desvincular/.test(filas[1]) && txt === 'Soy la TV 2' && !pantallaTV, JSON.stringify({ titulo, filas, txt }));
  },

  async 'Mi TV: volver cierra'() {
    const { navegador, pagina } = await abrirCuentas();
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(200);
    const abierta = await visible(pagina, '#pantallaTV');
    await pagina.click('#botonTVVolver'); await pagina.waitForTimeout(200);
    const cerrada = !(await visible(pagina, '#pantallaTV'));
    await navegador.close();
    return informe('Mi TV: abre y "Volver" la cierra sin recargar', abierta && cerrada);
  },

  async 'desvincular la única TV'() {
    const { navegador, pagina, errores } = await abrirCuentas();
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(200);
    await pagina.click('#listaTV .boton-enlace.peligro');
    await pagina.waitForFunction(() => document.getElementById('tvTitulo').textContent === 'Añade tu TV', null, { timeout: 8000 });
    await pagina.waitForTimeout(400);
    const raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
    const inerte = await panelInerte(pagina);
    await navegador.close();
    const ok = raiz.dispositivos.tv1.dueno === undefined && raiz.dispositivos.tv1.codigoUsado === undefined && !(raiz.usuarios['uid-ana'].dispositivos && raiz.usuarios['uid-ana'].dispositivos.tv1) && inerte && !erroresPagina(errores).length;
    return informe('desvincular la única TV: quita dueno, codigoUsado y la lista, y vuelve a pedir un código', ok, JSON.stringify({ dueno: raiz.dispositivos.tv1.dueno, lista: raiz.usuarios['uid-ana'].dispositivos }));
  },

  async 'desvincular pide confirmación'() {
    const { navegador, pagina } = await abrirCuentas();
    pagina.removeAllListeners('dialog');
    pagina.on('dialog', (d) => d.dismiss());
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(200);
    await pagina.click('#listaTV .boton-enlace.peligro'); await pagina.waitForTimeout(500);
    const raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
    await navegador.close();
    return informe('desvincular: si cancelas, no pasa nada', raiz.dispositivos.tv1.dueno === 'uid-ana' && raiz.usuarios['uid-ana'].dispositivos.tv1 === true);
  },

  async 'cerrar sesión desde Mi TV'() {
    const db = semilla({ usuarios: { 'uid-ana': {} } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await pagina.click('#botonTVSalir');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 8000 });
    const sesion = await pagina.evaluate(() => globalThis.__fakeAuth.actual);
    await navegador.close();
    return informe('"Cerrar sesión" desde la pantalla de añadir TV vuelve al login', sesion === null);
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
