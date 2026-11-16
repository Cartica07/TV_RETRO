// Etapa 5: eliminarMiCuenta() contra Auth y base falsos.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const IMG = { datos: '00', ancho: 128, alto: 64, meta: {} };
const USUARIOS = {
  'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true },
  'bob@correo.com': { password: 'otra123', uid: 'uid-bob', verificado: true },
  'carla@correo.com': { password: 'carla123', uid: 'uid-carla', verificado: true },
  'gus@gmail.com': { password: null, uid: 'uid-gus', verificado: true }
};
const semilla = () => ({
  dispositivos: {
    tv1: { dueno: 'uid-ana', codigoUsado: 'AAAAAA', miembros: { 'uid-bob': 'BBBBBB' }, oled_remota: { version: 5, pantalla: pant } },
    tv2: { dueno: 'uid-carla', miembros: { 'uid-ana': 'CCCCCC' }, oled_remota: { version: 2, pantalla: pant } },
    tv3: { dueno: 'uid-gus', oled_remota: { version: 1, pantalla: pant } }
  },
  usuarios: {
    'uid-ana': { dispositivos: { tv1: true, tv2: true }, imagenes: { foto1: IMG }, cuotas: { usados: 1, ultimo: 'i:foto1' } },
    'uid-bob': { dispositivos: { tv1: true } },
    'uid-carla': { dispositivos: { tv2: true }, imagenes: { suya: IMG }, cuotas: { usados: 1, ultimo: 'i:suya' } },
    'uid-gus': { dispositivos: { tv3: true }, imagenes: { g1: IMG }, cuotas: { usados: 1, ultimo: 'i:g1' } }
  }
});
// Define qué cuenta de Google "elige" la persona (o null: cierra la ventana).
const googleInicial = (g) => ({ fn: (arg) => {
  globalThis.__googleInicial = arg;
  const t = setInterval(() => { if (globalThis.__fakeAuth) { globalThis.__fakeAuth.google = globalThis.__googleInicial; clearInterval(t); } }, 1);
}, arg: g });
async function abrirCon(correo, extraConArg = null) {
  const r = await abrir(semilla(), { ruta: '/index.html', esperar: false, sinCSP: true /* usa new Function (ayudante modulo) */, antes: async (p) => {
    await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: correo });
    if (extraConArg) await p.addInitScript(extraConArg.fn, extraConArg.arg);
  } });
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 12000 });
  await r.pagina.waitForTimeout(300);
  return r;
}
const modulo = (p, cuerpo) => p.evaluate(async (c) => { const m = await import('/js/firebase.js'); return await (new Function('m', 'return (async () => {' + c + '})()'))(m); }, cuerpo);
const quieta = async (p) => { await p.waitForTimeout(1500); await p.waitForLoadState('load'); await p.waitForTimeout(300); };
const raiz = async (p) => { await quieta(p); return p.evaluate(() => globalThis.__fakeDb.raiz); };
const usuariosAuth = async (p) => { await quieta(p); return p.evaluate(() => Object.keys(globalThis.__fakeAuth.usuarios)); };
// Al recargar la página el Auth falso vuelve a su semilla: los usuarios borrados se guardan aparte.

const GUS = { email: 'gus@gmail.com', uid: 'uid-gus' };

const escenarios = {
  async 'contraseña mala o vacía'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com');
    const vacia = await modulo(pagina, "return await m.eliminarMiCuenta({ password: '' });");
    const mala = await modulo(pagina, "return await m.eliminarMiCuenta({ password: 'equivocada' });");
    const r = await raiz(pagina); const us = await usuariosAuth(pagina);
    await navegador.close();
    return informe('contraseña vacía o mala: avisa y NO borra nada',
      !vacia.exito && /Escribe tu contraseña/.test(vacia.error) && !mala.exito && /no es correcta/.test(mala.error)
      && r.dispositivos.tv1.dueno === 'uid-ana' && !!r.usuarios['uid-ana'] && us.includes('ana@correo.com'), JSON.stringify({ vacia, mala }));
  },

  async 'baja con contraseña'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com');
    const res = await modulo(pagina, "return await m.eliminarMiCuenta({ password: 'secreta1' });");
    const r = await raiz(pagina); const us = await usuariosAuth(pagina);
    await pagina.waitForTimeout(800);
    const loginVisible = await pagina.evaluate(() => !document.getElementById('pantallaLogin').hidden);
    await navegador.close();
    const tv1 = r.dispositivos.tv1, tv2 = r.dispositivos.tv2;
    const ok = res.exito && !tv1.dueno && !tv1.codigoUsado && !tv1.miembros && tv1.oled_remota.version === -2
      && tv2.dueno === 'uid-carla' && !(tv2.miembros && tv2.miembros['uid-ana'])
      && !r.usuarios['uid-ana'] && !us.includes('ana@correo.com')
      && !!r.usuarios['uid-carla'] && !!r.usuarios['uid-carla'].imagenes.suya && !!r.usuarios['uid-bob'] && !!r.dispositivos.tv3.dueno
      && loginVisible;
    return informe('baja con contraseña: suelta su TV (version -2, sin miembros), sale de la compartida, borra sus datos y la cuenta; lo de otros intacto; vuelve al login',
      ok, JSON.stringify({ res, tv1, tv2miembros: tv2.miembros, usuarios: Object.keys(r.usuarios), us, loginVisible }));
  },

  async 'baja con Google (ventana)'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', googleInicial(GUS));
    const prov = await modulo(pagina, 'return m.proveedorDeLaCuenta();');
    const res = await modulo(pagina, 'return await m.eliminarMiCuenta({});');
    const r = await raiz(pagina); const us = await usuariosAuth(pagina);
    await navegador.close();
    return informe('baja con Google (ventana emergente): reconoce el proveedor, borra datos y cuenta',
      prov === 'google.com' && res.exito && !r.usuarios['uid-gus'] && !r.dispositivos.tv3.dueno && !us.includes('gus@gmail.com'), JSON.stringify({ prov, res }));
  },

  async 'baja con Google (APK)'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', googleInicial(GUS));
    const res = await modulo(pagina, "return await m.eliminarMiCuenta({ plugin: { signInWithGoogle: async () => ({ credential: { idToken: 'tok' } }) } });");
    const us = await usuariosAuth(pagina);
    await navegador.close();
    return informe('baja con Google en la APK (selector nativo): borra la cuenta', res.exito && !us.includes('gus@gmail.com'), JSON.stringify(res));
  },

  async 'cancela Google'() {
    const { navegador, pagina } = await abrirCon('gus@gmail.com', googleInicial(null));
    const res = await modulo(pagina, 'return await m.eliminarMiCuenta({});');
    const r = await raiz(pagina);
    await navegador.close();
    return informe('cerrar la ventana de Google a mitad de la baja: cancelado y no se borra nada',
      res.cancelado === true && !!r.usuarios['uid-gus'] && r.dispositivos.tv3.dueno === 'uid-gus', JSON.stringify(res));
  },

  async 'corte antes de borrar la cuenta'() {
    const { navegador, pagina } = await abrirCon('ana@correo.com');
    await pagina.evaluate(() => { globalThis.__fakeAuth.fallarEn = { operacion: 'deleteUser', codigo: 'auth/network-request-failed' }; });
    const primero = await modulo(pagina, "return await m.eliminarMiCuenta({ password: 'secreta1' });");
    const r1 = await raiz(pagina); const us1 = await usuariosAuth(pagina);
    const segundo = await modulo(pagina, "return await m.eliminarMiCuenta({ password: 'secreta1' });");
    const us2 = await usuariosAuth(pagina);
    await navegador.close();
    return informe('si se corta justo antes de borrar la cuenta: avisa, los datos ya no están y reintentar termina la baja',
      !primero.exito && /conexión/.test(primero.error) && !r1.usuarios['uid-ana'] && us1.includes('ana@correo.com') && segundo.exito && !us2.includes('ana@correo.com'),
      JSON.stringify({ primero, segundo }));
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.includes(n)) continue;
  total++;
  try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 200)); }
}
cerrarServidor();
console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
