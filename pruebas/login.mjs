// Pruebas del login (modo cuentas, ?cuentas=1) con Firebase Auth falso. Uso: node login.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const PANT = (texto) => ({ tipo: 'texto', texto, config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } });
const SEMILLA_DB = {
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: PANT('Hola desde la TV') } }, tv9: { oled_remota: { version: 1, pantalla: PANT('TV nueva') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  emparejamiento: { K7M2QX: { id: 'tv9', creado: Date.now() } },
  oled_remota: { version: 3, pantalla: PANT('RUTA VIEJA') }
};
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };

async function abrirLogin({ actual = null, retrasoInicial = 0, ruta = '/index.html?cuentas=1' } = {}) {
  const r = await abrir(SEMILLA_DB, {
    ruta, esperar: false,
    antes: async (p) => { await p.addInitScript((s) => { globalThis.__semillaAuth = s; }, { usuarios: USUARIOS, actual, retrasoInicial }); }
  });
  await r.pagina.waitForTimeout(500);
  return r;
}
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const texto = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const panelInerte = (p) => p.evaluate(() => document.querySelector('main.controles').inert);
const esperarPanel = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
const erroresPagina = (e) => e.filter((x) => x.startsWith('página:'));
async function entrar(p, correo, clave) {
  await p.fill('#loginEmail', correo); await p.fill('#loginPassword', clave); await p.click('#botonLogin');
}

const escenarios = {
  async 'sin ?cuentas el panel funciona como siempre (sin login)'() {
    const { navegador, pagina, errores } = await abrir(SEMILLA_DB, {});
    const login = await visible(pagina, '#pantallaLogin');
    const inerte = await panelInerte(pagina);
    const llamadas = await pagina.evaluate(() => (globalThis.__fakeAuth ? globalThis.__fakeAuth.oyentes.length : 0));
    await navegador.close();
    return informe('sin ?cuentas: sin login, panel activo y sin escuchar la sesión', !login && !inerte && llamadas === 0 && !erroresPagina(errores).length, `login=${login} inerte=${inerte} oyentes=${llamadas}`);
  },

  async 'con ?cuentas y sin sesión: muestra el login y el panel queda bloqueado'() {
    const { navegador, pagina, errores } = await abrirLogin();
    const login = await visible(pagina, '#pantallaLogin');
    const inerte = await panelInerte(pagina);
    const cerrar = await visible(pagina, '#botonCerrarSesion');
    const confirmar = await visible(pagina, '#campoLoginConfirmar');
    await navegador.close();
    return informe('con ?cuentas y sin sesión: login visible, panel bloqueado, sin "cerrar sesión"', login && inerte && !cerrar && !confirmar && !erroresPagina(errores).length, `login=${login} inerte=${inerte} cerrar=${cerrar}`);
  },

  async 'entrar con datos correctos'() {
    const { navegador, pagina, errores } = await abrirLogin();
    await entrar(pagina, 'ana@correo.com', 'secreta1');
    await esperarPanel(pagina);
    await pagina.waitForTimeout(500);
    const login = await visible(pagina, '#pantallaLogin');
    const cerrar = await visible(pagina, '#botonCerrarSesion');
    const txt = await pagina.inputValue('#texto');
    const clave = await pagina.inputValue('#loginPassword');
    await navegador.close();
    return informe('entrar: se oculta el login, el panel carga lo que muestra la TV, aparece cerrar sesión y se borra la clave', !login && cerrar && txt === 'Hola desde la TV' && clave === '' && !erroresPagina(errores).length, `login=${login} cerrar=${cerrar} texto="${txt}" clave="${clave}"`);
  },

  async 'datos incorrectos'() {
    const { navegador, pagina } = await abrirLogin();
    await entrar(pagina, 'ana@correo.com', 'mala');
    await pagina.waitForTimeout(300);
    const msg = await texto(pagina, '#loginError');
    const login = await visible(pagina, '#pantallaLogin');
    const inerte = await panelInerte(pagina);
    await navegador.close();
    return informe('contraseña incorrecta: mensaje claro y sigue en el login', msg === 'Correo o contraseña incorrectos.' && login && inerte, `msg="${msg}"`);
  },

  async 'campos vacíos y correo mal escrito'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.click('#botonLogin'); await pagina.waitForTimeout(150);
    const a = await texto(pagina, '#loginError');
    await pagina.fill('#loginEmail', 'ana@correo.com'); await pagina.click('#botonLogin'); await pagina.waitForTimeout(150);
    const b = await texto(pagina, '#loginError');
    await entrar(pagina, 'esto-no-es-un-correo', 'secreta1'); await pagina.waitForTimeout(300);
    const c = await texto(pagina, '#loginError');
    const llamadas = await pagina.evaluate(() => globalThis.__fakeAuth.llamadas.length);
    await navegador.close();
    return informe('vacíos y correo inválido: mensajes claros (los vacíos ni llaman a Firebase)', a === 'Escribe tu correo.' && b === 'Escribe tu contraseña.' && c === 'Ese correo no es válido.' && llamadas === 1, `a="${a}" b="${b}" c="${c}" llamadas=${llamadas}`);
  },

  async 'sin internet'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.evaluate(() => { globalThis.__fakeAuth.fallar = 'auth/network-request-failed'; });
    await entrar(pagina, 'ana@correo.com', 'secreta1'); await pagina.waitForTimeout(300);
    const msg = await texto(pagina, '#loginError');
    await navegador.close();
    return informe('sin internet al entrar: "No hay conexión a internet."', msg === 'No hay conexión a internet.', `msg="${msg}"`);
  },

  async 'crear cuenta'() {
    const { navegador, pagina, errores } = await abrirLogin();
    await pagina.click('#botonLoginModo'); await pagina.waitForTimeout(150);
    const modo = { sub: await texto(pagina, '#loginSubtitulo'), boton: await texto(pagina, '#botonLogin'), enlace: await texto(pagina, '#botonLoginModo'), confirmar: await visible(pagina, '#campoLoginConfirmar'), olvide: await visible(pagina, '#botonLoginOlvide') };
    await pagina.fill('#loginEmail', 'nuevo@correo.com'); await pagina.fill('#loginPassword', '123'); await pagina.fill('#loginPassword2', '123'); await pagina.click('#botonLogin'); await pagina.waitForTimeout(150);
    const corta = await texto(pagina, '#loginError');
    await pagina.fill('#loginPassword', 'secreta2'); await pagina.fill('#loginPassword2', 'otra'); await pagina.click('#botonLogin'); await pagina.waitForTimeout(150);
    const distinta = await texto(pagina, '#loginError');
    await pagina.fill('#loginPassword2', 'secreta2'); await pagina.click('#botonLogin');
    // Cuenta nueva: no tiene TV, así que pasa por "Añade tu TV" antes de entrar al panel.
    await pagina.waitForFunction(() => !document.getElementById('pantallaTV').hidden, null, { timeout: 8000 });
    const tituloTV = await texto(pagina, '#tvTitulo');
    await pagina.fill('#codigoTV', 'K7M2QX'); await pagina.click('#botonVincularTV');
    await esperarPanel(pagina); await pagina.waitForTimeout(500);
    const correos = await pagina.evaluate(() => globalThis.__fakeAuth.correos);
    const estado = await texto(pagina, '#estadoTexto');
    const cerrar = await visible(pagina, '#botonCerrarSesion');
    await navegador.close();
    const modoOk = modo.sub === 'Crea tu cuenta para controlar tu pantalla.' && modo.boton === 'Crear cuenta' && modo.enlace === 'Ya tengo una cuenta' && modo.confirmar && !modo.olvide;
    return informe('crear cuenta: cambia la pantalla, valida, crea, manda el correo de verificación y avisa', modoOk && tituloTV === 'Añade tu TV' && corta === 'La contraseña debe tener al menos 6 caracteres.' && distinta === 'Las contraseñas no coinciden.' && correos.length === 1 && correos[0].tipo === 'verificacion' && /Te enviamos un correo para confirmar tu cuenta/.test(estado) && cerrar && !erroresPagina(errores).length, JSON.stringify({ modo, corta, distinta, correos, estado }));
  },

  async 'correo ya registrado'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.click('#botonLoginModo');
    await pagina.fill('#loginEmail', 'ana@correo.com'); await pagina.fill('#loginPassword', 'secreta1'); await pagina.fill('#loginPassword2', 'secreta1'); await pagina.click('#botonLogin'); await pagina.waitForTimeout(300);
    const msg = await texto(pagina, '#loginError');
    await navegador.close();
    return informe('crear cuenta con un correo que ya existe: lo dice', msg === 'Ese correo ya tiene una cuenta. Inicia sesión.', `msg="${msg}"`);
  },

  async 'olvidé mi contraseña'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.click('#botonLoginOlvide'); await pagina.waitForTimeout(150);
    const sinCorreo = await texto(pagina, '#loginError');
    await pagina.fill('#loginEmail', 'ana@correo.com'); await pagina.click('#botonLoginOlvide'); await pagina.waitForTimeout(300);
    const aviso = await texto(pagina, '#loginAviso');
    const errorOculto = !(await visible(pagina, '#loginError'));
    const correos = await pagina.evaluate(() => globalThis.__fakeAuth.correos);
    await navegador.close();
    return informe('olvidé mi contraseña: pide el correo y manda el enlace sin revelar si existe', /Escribe tu correo arriba/.test(sinCorreo) && /Si ese correo tiene una cuenta/.test(aviso) && errorOculto && correos.length === 1 && correos[0].tipo === 'reset', JSON.stringify({ sinCorreo, aviso, correos }));
  },

  async 'doble toque en Entrar'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.evaluate(() => { globalThis.__fakeAuth.retraso = 600; });
    await pagina.fill('#loginEmail', 'ana@correo.com'); await pagina.fill('#loginPassword', 'secreta1');
    await pagina.dblclick('#botonLogin');
    await esperarPanel(pagina);
    const llamadas = await pagina.evaluate(() => globalThis.__fakeAuth.llamadas.filter((l) => l.nombre === 'signIn').length);
    await navegador.close();
    return informe('doble toque en Entrar: una sola petición', llamadas === 1, `peticiones=${llamadas}`);
  },

  async 'sesión guardada: arranca sin mostrar el login'() {
    const { navegador, pagina, errores } = await abrirLogin({ actual: 'ana@correo.com', retrasoInicial: 1200 });
    await pagina.waitForTimeout(300);
    const loginMientrasEspera = await visible(pagina, '#pantallaLogin');
    await esperarPanel(pagina); await pagina.waitForTimeout(400);
    const login = await visible(pagina, '#pantallaLogin');
    const txt = await pagina.inputValue('#texto');
    await navegador.close();
    return informe('sesión guardada (con la lectura de sesión lenta): nunca parpadea el login y carga el panel', !loginMientrasEspera && !login && txt === 'Hola desde la TV' && !erroresPagina(errores).length, `esperando=${loginMientrasEspera} login=${login} texto="${txt}"`);
  },

  async 'cerrar sesión'() {
    const { navegador, pagina, errores } = await abrirLogin({ actual: 'ana@correo.com' });
    await esperarPanel(pagina);
    await pagina.click('#botonCerrarSesion');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 8000 });
    await pagina.waitForTimeout(500);
    const inerte = await panelInerte(pagina);
    const txt = await pagina.inputValue('#texto');
    const sesion = await pagina.evaluate(() => globalThis.__fakeAuth.actual);
    await navegador.close();
    return informe('cerrar sesión: vuelve el login, el panel queda bloqueado y vacío (se recargó)', inerte && sesion === null && txt !== 'Hola desde la TV' && !erroresPagina(errores).length, `inerte=${inerte} sesion=${sesion} texto="${txt}"`);
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
