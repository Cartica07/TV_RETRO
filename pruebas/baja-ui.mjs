// Etapa 5: pantalla "Eliminar mi cuenta" de punta a punta (Auth y base falsos).
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const IMG = { datos: '00', ancho: 128, alto: 64, meta: {} };
const USUARIOS = {
  'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true },
  'gus@gmail.com': { password: null, uid: 'uid-gus', verificado: true },
  'nueva@correo.com': { password: 'nueva123', uid: 'uid-nueva', verificado: true }
};
const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 5, pantalla: pant } }, tv3: { dueno: 'uid-gus', oled_remota: { version: 1, pantalla: pant } } },
  usuarios: {
    'uid-ana': { dispositivos: { tv1: true }, imagenes: { foto1: IMG }, cuotas: { usados: 1, ultimo: 'i:foto1' } },
    'uid-gus': { dispositivos: { tv3: true } },
    'uid-nueva': {}
  }
});
async function abrirCon(correo, { app = false, google = null } = {}) {
  const r = await abrir(semilla(), { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true; globalThis.__googleInicial = s.google;
      if (s.app) globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { FirebaseAuthentication: { signInWithGoogle: async () => ({ credential: { idToken: 'tok' } }) }, App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio = (globalThis.__salio || 0) + 1; } } } };
    }, { auth: { usuarios: USUARIOS, actual: correo }, google, app });
    await p.addInitScript(() => { const t = setInterval(() => { if (globalThis.__fakeAuth) { globalThis.__fakeAuth.google = globalThis.__googleInicial; clearInterval(t); } }, 1); });
  } });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForTimeout(900);
  return r;
}
const listo = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const abrirPanelBaja = async (p) => { await p.click('#botonMiTV'); await p.waitForTimeout(300); await p.click('#botonEliminarCuenta'); await p.waitForTimeout(200); };

const escenarios = {
  async 'abrir y cancelar'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com'); await listo(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const enlace = await vis(pagina, '#botonEliminarCuenta');
    await pagina.click('#botonEliminarCuenta'); await pagina.waitForTimeout(200);
    const panel = await vis(pagina, '#eliminarCuenta'), pass = await vis(pagina, '#eliminarPassword'), nota = await vis(pagina, '#eliminarGoogleNota');
    const titulo = await txt(pagina, '#tvTitulo'), cancelar = await txt(pagina, '#botonTVVolver');
    await pagina.click('#botonTVVolver'); await pagina.waitForTimeout(200);
    const vuelve = (await vis(pagina, '#listaTV')) && !(await vis(pagina, '#eliminarCuenta')) && (await txt(pagina, '#tvTitulo')) === 'Mis TV';
    await navegador.close();
    return informe('Mi TV: aparece "Eliminar mi cuenta", abre el panel con contraseña y Cancelar vuelve a Mis TV', enlace && panel && pass && !nota && titulo === 'Eliminar mi cuenta' && cancelar === 'Cancelar' && vuelve, JSON.stringify({ enlace, panel, pass, nota, titulo, cancelar, vuelve }));
  },
  async 'contraseña mala'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com'); await listo(pagina);
    await abrirPanelBaja(pagina);
    await pagina.click('#botonEliminarConfirmar'); await pagina.waitForTimeout(500);
    const vacia = await txt(pagina, '#eliminarError');
    await pagina.fill('#eliminarPassword', 'mala'); await pagina.click('#botonEliminarConfirmar'); await pagina.waitForTimeout(600);
    const mala = await txt(pagina, '#eliminarError');
    const sigue = await pagina.evaluate(() => globalThis.__fakeDb.raiz.usuarios['uid-ana'] !== undefined && globalThis.__fakeAuth.usuarios['ana@correo.com'] !== undefined);
    const habilitado = await pagina.evaluate(() => !document.getElementById('botonEliminarConfirmar').disabled);
    await navegador.close();
    return informe('contraseña vacía o mala: mensaje claro, no se borra nada y el botón vuelve a servir', /Escribe tu contraseña/.test(vacia) && /no es correcta/.test(mala) && sigue && habilitado, JSON.stringify({ vacia, mala, sigue, habilitado }));
  },
  async 'baja completa'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com'); await listo(pagina);
    await abrirPanelBaja(pagina);
    await pagina.fill('#eliminarPassword', 'secreta1'); await pagina.click('#botonEliminarConfirmar');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 10000 });
    await pagina.waitForTimeout(500);
    const aviso = await txt(pagina, '#loginAviso');
    const r = await pagina.evaluate(() => ({ db: globalThis.__fakeDb.raiz, us: Object.keys(globalThis.__fakeAuth.usuarios) }));
    await navegador.close();
    return informe('baja completa por la pantalla: vuelve al login con "Tu cuenta y tus datos se eliminaron.", TV suelta y datos borrados',
      /se eliminaron/.test(aviso) && !r.db.usuarios['uid-ana'] && !r.db.dispositivos.tv1.dueno && r.db.dispositivos.tv1.oled_remota.version === -2 && !r.us.includes('ana@correo.com'), JSON.stringify({ aviso, us: r.us }));
  },
  async 'google (web)'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', { google: { email: 'gus@gmail.com', uid: 'uid-gus' } }); await listo(pagina);
    await abrirPanelBaja(pagina);
    const pass = await vis(pagina, '#campoEliminarPassword'), nota = await vis(pagina, '#eliminarGoogleNota');
    await pagina.click('#botonEliminarConfirmar');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 10000 });
    const us = await pagina.evaluate(() => Object.keys(globalThis.__fakeAuth.usuarios));
    await navegador.close();
    return informe('cuenta de Google: sin campo de contraseña, avisa que se elegirá la cuenta otra vez y borra', !pass && nota && !us.includes('gus@gmail.com'), JSON.stringify({ pass, nota, us }));
  },
  async 'google cancela'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', { google: null }); await listo(pagina);
    await abrirPanelBaja(pagina);
    await pagina.click('#botonEliminarConfirmar'); await pagina.waitForTimeout(700);
    const error = await vis(pagina, '#eliminarError'); const sigue = await vis(pagina, '#eliminarCuenta');
    const intacto = await pagina.evaluate(() => globalThis.__fakeDb.raiz.usuarios['uid-gus'] !== undefined);
    await navegador.close();
    return informe('cerrar la ventana de Google: sin error, sigue en el panel y no se borra nada', !error && sigue && intacto, JSON.stringify({ error, sigue, intacto }));
  },
  async 'sin TV (primera vez)'() {
    const { navegador, pagina } = await abrirCon('nueva@correo.com'); await pagina.waitForTimeout(500);
    const primera = await vis(pagina, '#pantallaTV');
    const enlace = await vis(pagina, '#botonEliminarCuenta');
    await pagina.click('#botonEliminarCuenta'); await pagina.waitForTimeout(200);
    const panel = await vis(pagina, '#eliminarCuenta');
    await pagina.click('#botonTVVolver'); await pagina.waitForTimeout(200);
    const vuelve = (await txt(pagina, '#tvTitulo')) === 'Añade tu TV' && (await vis(pagina, '#formTV')) && !(await vis(pagina, '#botonTVVolver'));
    await navegador.close();
    return informe('quien aún no tiene TV también puede eliminar su cuenta y Cancelar vuelve a "Añade tu TV"', primera && enlace && panel && vuelve, JSON.stringify({ primera, enlace, panel, vuelve }));
  },
  async 'atrás en la APK'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com', { app: true }); await listo(pagina);
    await abrirPanelBaja(pagina);
    await pagina.evaluate(() => globalThis.__atras()); await pagina.waitForTimeout(200);
    const enLista = (await vis(pagina, '#listaTV')) && !(await vis(pagina, '#eliminarCuenta'));
    const salioAntes = await pagina.evaluate(() => globalThis.__salio || 0);
    await navegador.close();
    return informe('APK: Atrás dentro de "Eliminar mi cuenta" cancela la baja (no sale de la app)', enLista && salioAntes === 0, JSON.stringify({ enLista, salioAntes }));
  },
  async 'google en la APK'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', { app: true, google: { email: 'gus@gmail.com', uid: 'uid-gus' } }); await listo(pagina);
    await abrirPanelBaja(pagina);
    await pagina.click('#botonEliminarConfirmar');
    await pagina.waitForFunction(() => !document.getElementById('pantallaLogin').hidden, null, { timeout: 10000 });
    const us = await pagina.evaluate(() => Object.keys(globalThis.__fakeAuth.usuarios));
    await navegador.close();
    return informe('APK con cuenta de Google: la baja usa el selector nativo y borra la cuenta', !us.includes('gus@gmail.com'), JSON.stringify(us));
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.includes(n)) continue;
  total++;
  try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 240)); }
}
cerrarServidor();
console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
