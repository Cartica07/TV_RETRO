// Pruebas de compartir una TV (miembros e invitaciones) en el panel, con Firebase simulado.
// Uso: node compartir.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = (texto) => ({ tipo: 'texto', texto, config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } });
const USUARIOS = {
  'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true },
  'beto@correo.com': { password: 'secreta1', uid: 'uid-beto', verificado: true }
};

function semilla(extra = {}) {
  return Object.assign({
    dispositivos: {
      tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') } },
      tv2: { dueno: 'uid-otro', oled_remota: { version: 7, pantalla: pant('Soy la TV 2') } }
    },
    usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }
  }, extra);
}

async function abrirCuentas({ db = semilla(), actual = 'ana@correo.com', antes = null } = {}) {
  const r = await abrir(db, {
    ruta: '/index.html?cuentas=1', esperar: false,
    antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual });
      if (antes) await antes(p);
    }
  });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForTimeout(500);
  return r;
}
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const texto = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const esperarPanel = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
const raizDb = (p) => p.evaluate(() => globalThis.__fakeDb.raiz);
const escrituras = (p) => p.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
const erroresPagina = (e) => e.filter((x) => x.startsWith('página:'));
const filasTV = (p) => p.evaluate(() => [...document.querySelectorAll('#listaTV .fila-tv')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()));
const clicBoton = (p, contenedor, etiqueta, n = 0) => p.evaluate(([c, e, i]) => {
  const b = [...document.querySelectorAll(c + ' button')].filter((x) => x.textContent.trim() === e)[i];
  if (!b) throw new Error('no hay botón ' + e);
  b.click();
}, [contenedor, etiqueta, n]);

const escenarios = {
  async 'dueño: Compartir crea la invitación y la muestra'() {
    const { navegador, pagina, errores } = await abrirCuentas();
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const filas = await filasTV(pagina);
    await clicBoton(pagina, '#listaTV', 'Compartir'); await pagina.waitForTimeout(500);
    const codigo = await texto(pagina, '#compartirCodigo');
    const vence = await texto(pagina, '#compartirVence');
    const miembros = await texto(pagina, '#listaMiembros');
    const titulo = await texto(pagina, '#tvTitulo');
    const listaVisible = await visible(pagina, '#listaTV');
    const formVisible = await visible(pagina, '#formTV');
    const raiz = await raizDb(pagina);
    const inv = raiz.invitaciones && raiz.invitaciones[codigo];
    await clicBoton(pagina, '.login-enlaces', 'Listo'); await pagina.waitForTimeout(300);
    const vuelve = await visible(pagina, '#listaTV') && !(await visible(pagina, '#compartirTV'));
    await navegador.close();
    return informe('dueño: Mi TV ofrece Compartir y Desvincular; Compartir crea invitacion/{codigo} y muestra código, tiempo y personas; Listo vuelve',
      /Compartir/.test(filas[0]) && /Desvincular/.test(filas[0]) && /^[A-HJ-NP-Z2-9]{6}$/.test(codigo) && inv && inv.id === 'tv1' && /^Vence en [0-9]{1,2}:[0-9]{2}$/.test(vence)
      && /Nadie más/.test(miembros) && titulo === 'Compartir TV 1' && !listaVisible && !formVisible && vuelve && !erroresPagina(errores).length,
      JSON.stringify({ filas, codigo, vence, inv, miembros, titulo, vuelve, errores }));
  },

  async 'miembro: ve la TV compartida y solo puede salir'() {
    const db = semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true } }, 'uid-beto': { dispositivos: { tv1: true } } } });
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2' };
    const { navegador, pagina } = await abrirCuentas({ db, actual: 'beto@correo.com' });
    await esperarPanel(pagina);
    const txt = await pagina.inputValue('#texto');
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const filas = await filasTV(pagina);
    await clicBoton(pagina, '#listaTV', 'Salir');
    await pagina.waitForTimeout(1200);
    const raiz = await raizDb(pagina);
    const pideTV = await visible(pagina, '#pantallaTV');
    await navegador.close();
    return informe('miembro: arranca con la TV compartida; en Mi TV solo ve "Salir" (sin Compartir ni Desvincular); al salir se quita de miembros y de su lista',
      txt === 'Hola desde TV 1' && /Compartida contigo/.test(filas[0]) && /Salir/.test(filas[0]) && !/Compartir\b|Desvincular/.test(filas[0].replace('Compartida', ''))
      && !(raiz.dispositivos.tv1.miembros || {})['uid-beto'] && !((raiz.usuarios['uid-beto'] || {}).dispositivos || {}).tv1 && pideTV,
      JSON.stringify({ txt, filas, miembros: raiz.dispositivos.tv1.miembros, lista: raiz.usuarios['uid-beto'], pideTV }));
  },

  async 'unirse con un código de invitación'() {
    const db = semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true } }, 'uid-beto': {} }, invitaciones: { ABCD23: { id: 'tv1', creado: Date.now() } } });
    const { navegador, pagina } = await abrirCuentas({ db, actual: 'beto@correo.com', antes: async (p) => { await p.addInitScript(() => { globalThis.__fallarInicial = { 'dispositivos/tv1/dueno': true }; }); } }); // sin acceso todavía: las reglas niegan leer el dueño
    const titulo = await texto(pagina, '#tvTitulo');
    await pagina.fill('#codigoTV', 'abcd-23'); await pagina.click('#botonVincularTV');
    await esperarPanel(pagina); await pagina.waitForTimeout(500);
    const raiz = await raizDb(pagina);
    const txt = await pagina.inputValue('#texto');
    const esc = await escrituras(pagina);
    await navegador.close();
    return informe('unirse: el código de invitación hace miembro, gasta la invitación (mismo paso) y sigue con esa TV',
      titulo === 'Añade tu TV' && raiz.dispositivos.tv1.miembros['uid-beto'] === 'ABCD23' && !(raiz.invitaciones || {}).ABCD23
      && raiz.usuarios['uid-beto'].dispositivos.tv1 === true && raiz.dispositivos.tv1.dueno === 'uid-ana' && txt === 'Hola desde TV 1'
      && esc.indexOf('dispositivos/tv1/miembros/uid-beto') >= 0 && esc.indexOf('invitaciones/ABCD23') >= 0,
      JSON.stringify({ titulo, miembros: raiz.dispositivos.tv1.miembros, inv: raiz.invitaciones, lista: raiz.usuarios['uid-beto'], txt, esc }));
  },

  async 'unirse: código inexistente y TV que ya es tuya'() {
    const db = semilla({ invitaciones: { ABCD23: { id: 'tv1', creado: Date.now() } } });
    const { navegador, pagina } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await pagina.fill('#codigoTV', 'ZZZZZZ'); await pagina.click('#botonVincularTV'); await pagina.waitForTimeout(500);
    const inexistente = await texto(pagina, '#tvError');
    await pagina.fill('#codigoTV', 'ABCD23'); await pagina.click('#botonVincularTV'); await pagina.waitForTimeout(500);
    const suya = await texto(pagina, '#tvError');
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('unirse: un código que no existe y la invitación de tu propia TV dan mensajes claros y no cambian nada',
      /no existe, ya se usó o venció/.test(inexistente) && suya === 'Esa TV ya es tuya.' && !raiz.dispositivos.tv1.miembros && !!raiz.invitaciones.ABCD23,
      JSON.stringify({ inexistente, suya }));
  },

  async 'dueño: quitar a una persona'() {
    const db = semilla();
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2', 'uid-cris': 'YYYYY2' };
    const { navegador, pagina } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Compartir'); await pagina.waitForTimeout(500);
    const antes = await pagina.evaluate(() => [...document.querySelectorAll('#listaMiembros .fila-tv')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()));
    await clicBoton(pagina, '#listaMiembros', 'Quitar'); await pagina.waitForTimeout(500);
    const despues = await pagina.evaluate(() => [...document.querySelectorAll('#listaMiembros .fila-tv')].map((f) => f.textContent.replace(/\s+/g, ' ').trim()));
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('dueño: la lista muestra a las personas con acceso y Quitar le quita el acceso a esa persona',
      antes.length === 2 && /Persona 1/.test(antes[0]) && despues.length === 1 && Object.keys(raiz.dispositivos.tv1.miembros).length === 1 && !raiz.dispositivos.tv1.miembros['uid-beto'],
      JSON.stringify({ antes, despues, miembros: raiz.dispositivos.tv1.miembros }));
  },

  async 'dueño: no invita a más de 5 personas'() {
    const db = semilla();
    db.dispositivos.tv1.miembros = { a: 'AAAAA2', b: 'AAAAA3', c: 'AAAAA4', d: 'AAAAA5', e: 'AAAAA6' };
    const { navegador, pagina } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Compartir'); await pagina.waitForTimeout(500);
    const error = await texto(pagina, '#compartirError');
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('dueño: con 5 personas ya no crea invitaciones y avisa', /ya tiene 5 personas/.test(error) && !raiz.invitaciones, JSON.stringify({ error, inv: raiz.invitaciones }));
  },

  async 'desvincular quita miembros y deja la señal para la TV'() {
    const db = semilla();
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2' };
    db.dispositivos.tv1.codigoUsado = 'K7M2QX';
    const { navegador, pagina } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Desvincular'); await pagina.waitForTimeout(1200);
    const raiz = await raizDb(pagina);
    await navegador.close();
    const tv = raiz.dispositivos.tv1;
    return informe('desvincular: en un solo update quita dueño, código y miembros, y deja oled_remota/version = -2 (la señal que lee la TV)',
      !tv.dueno && !tv.codigoUsado && !tv.miembros && tv.oled_remota.version === -2 && !(raiz.usuarios['uid-ana'].dispositivos || {}).tv1,
      JSON.stringify(tv));
  },

  async 'una TV que ya no deja entrar se saca de la lista'() {
    const db = semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true, tv2: true } } } });
    const { navegador, pagina } = await abrirCuentas({ db, antes: async (p) => { await p.addInitScript(() => { globalThis.__fallarInicial = { 'dispositivos/tv2/dueno': true }; }); } });
    await esperarPanel(pagina); await pagina.waitForTimeout(400);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const filas = await filasTV(pagina);
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('si leer el dueño de una TV da "sin permiso" (ya no es tuya ni te comparten), se saca de Mi TV y de tu lista',
      filas.length === 1 && /TV 1/.test(filas[0]) && !raiz.usuarios['uid-ana'].dispositivos.tv2 && raiz.usuarios['uid-ana'].dispositivos.tv1 === true,
      JSON.stringify({ filas, lista: raiz.usuarios['uid-ana'].dispositivos }));
  },

  async 'dueño: ponerle nombre a una persona, cancelar, cambiarlo, dejarlo vacío y quitarla'() {
    const db = semilla();
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2', 'uid-cris': 'YYYYY2' };
    const { navegador, pagina, errores } = await abrirCuentas({ db });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Compartir'); await pagina.waitForTimeout(500);
    const nombres = () => pagina.evaluate(() => [...document.querySelectorAll('#listaMiembros .fila-tv .nombre-tv')].map((f) => f.textContent.trim()));
    const apodos = async () => ((await raizDb(pagina)).dispositivos.tv1.apodos) || {};
    const inicial = await nombres();
    // Cancelar no escribe nada.
    await clicBoton(pagina, '#listaMiembros', 'Nombre');
    await pagina.fill('#listaMiembros input', 'Descartado');
    await clicBoton(pagina, '#listaMiembros', 'Cancelar'); await pagina.waitForTimeout(400);
    const trasCancelar = { nombres: await nombres(), apodos: await apodos() };
    // Nombre con espacios de más: se limpia.
    await clicBoton(pagina, '#listaMiembros', 'Nombre');
    await pagina.fill('#listaMiembros input', '  Mamá   Rosa ');
    await clicBoton(pagina, '#listaMiembros', 'Guardar'); await pagina.waitForTimeout(500);
    const conNombre = { nombres: await nombres(), apodos: await apodos() };
    // A la segunda persona.
    await clicBoton(pagina, '#listaMiembros', 'Nombre', 1);
    await pagina.fill('#listaMiembros input', 'Tío');
    await pagina.press('#listaMiembros input', 'Enter'); await pagina.waitForTimeout(500);
    const conDos = { nombres: await nombres(), apodos: await apodos() };
    // Quitar a la primera: su nombre se va con ella y el otro se queda.
    await clicBoton(pagina, '#listaMiembros', 'Quitar'); await pagina.waitForTimeout(500);
    const trasQuitar = { nombres: await nombres(), apodos: await apodos(), miembros: Object.keys((await raizDb(pagina)).dispositivos.tv1.miembros) };
    // Vacío: vuelve a "Persona 1".
    await clicBoton(pagina, '#listaMiembros', 'Nombre');
    await pagina.fill('#listaMiembros input', '');
    await clicBoton(pagina, '#listaMiembros', 'Guardar'); await pagina.waitForTimeout(500);
    const vacio = { nombres: await nombres(), apodos: await apodos() };
    await navegador.close();
    return informe('dueño: nombra a las personas (se limpia el texto), Cancelar no escribe, Quitar borra su nombre y vacío vuelve a "Persona N"',
      inicial.join('|') === 'Persona 1|Persona 2'
      && trasCancelar.nombres.join('|') === 'Persona 1|Persona 2' && Object.keys(trasCancelar.apodos).length === 0
      && conNombre.nombres.join('|') === 'Mamá Rosa|Persona 2' && conNombre.apodos['uid-beto'] === 'Mamá Rosa'
      && conDos.nombres.join('|') === 'Mamá Rosa|Tío' && conDos.apodos['uid-cris'] === 'Tío'
      && trasQuitar.nombres.join('|') === 'Tío' && !trasQuitar.apodos['uid-beto'] && trasQuitar.apodos['uid-cris'] === 'Tío' && trasQuitar.miembros.join() === 'uid-cris'
      && vacio.nombres.join('|') === 'Persona 1' && !vacio.apodos['uid-cris'] && !erroresPagina(errores).length,
      JSON.stringify({ inicial, trasCancelar, conNombre, conDos, trasQuitar, vacio, errores }));
  },

  async 'dueño: con las reglas anteriores (sin apodos) quitar, desvincular y ver la lista siguen funcionando'() {
    const db = semilla();
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2' };
    const { navegador, pagina } = await abrirCuentas({ db, antes: async (p) => { await p.addInitScript(() => { globalThis.__fallarInicial = { 'dispositivos/tv1/apodos': true }; }); } });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Compartir'); await pagina.waitForTimeout(500);
    const lista = await pagina.evaluate(() => [...document.querySelectorAll('#listaMiembros .fila-tv .nombre-tv')].map((f) => f.textContent.trim()));
    await clicBoton(pagina, '#listaMiembros', 'Quitar'); await pagina.waitForTimeout(600);
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('sin reglas de apodos: la lista muestra "Persona N" y Quitar igual le quita el acceso (repite la escritura sin los apodos)',
      lista.join('|') === 'Persona 1' && !(raiz.dispositivos.tv1.miembros || {})['uid-beto'],
      JSON.stringify({ lista, miembros: raiz.dispositivos.tv1.miembros }));
  },

  async 'miembro: al salir también se borra su nombre'() {
    const db = semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true } }, 'uid-beto': { dispositivos: { tv1: true } } } });
    db.dispositivos.tv1.miembros = { 'uid-beto': 'ZZZZZ2' };
    db.dispositivos.tv1.apodos = { 'uid-beto': 'Mamá' };
    const { navegador, pagina } = await abrirCuentas({ db, actual: 'beto@correo.com' });
    await esperarPanel(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    await clicBoton(pagina, '#listaTV', 'Salir'); await pagina.waitForTimeout(1200);
    const raiz = await raizDb(pagina);
    await navegador.close();
    return informe('miembro: al salirse se quita de miembros y su nombre se borra',
      !(raiz.dispositivos.tv1.miembros || {})['uid-beto'] && !(raiz.dispositivos.tv1.apodos || {})['uid-beto'],
      JSON.stringify({ miembros: raiz.dispositivos.tv1.miembros, apodos: raiz.dispositivos.tv1.apodos }));
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
