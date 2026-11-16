// Etapa 2: entrar con Google (lado del panel, con Auth falso).
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const semilla = { dispositivos: { tv1: { dueno: 'uid-gus', oled_remota: { version: 3, pantalla: pant } } }, usuarios: { 'uid-gus': { dispositivos: { tv1: true } } } };
async function abrirLogin({ app = false, plugin = null, google = { email: 'gus@gmail.com', uid: 'uid-gus' }, fallar = null } = {}) {
  const r = await abrir(semilla, { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => { globalThis.__semillaAuth = s.auth; globalThis.__persistirDb = true; globalThis.__googleInicial = s.google; globalThis.__llamadasNativo = 0; if (s.app) { const P = {}; if (s.plugin) P.FirebaseAuthentication = { signInWithGoogle: async () => { globalThis.__llamadasNativo++; if (s.plugin === 'cancela') throw new Error('The user canceled the sign-in flow.'); if (s.plugin === 'falla') throw new Error('something else'); return { credential: { idToken: s.plugin === 'sinToken' ? undefined : 'id-token-de-google' } }; } }; globalThis.Capacitor = { isNativePlatform: () => true, Plugins: P }; } }, { auth: { usuarios: {}, actual: null }, google, app, plugin });
    await p.addInitScript(() => { const t = setInterval(() => { if (globalThis.__fakeAuth) { globalThis.__fakeAuth.google = globalThis.__googleInicial; clearInterval(t); } }, 1); });
  } });
  await r.pagina.waitForTimeout(600);
  if (fallar) await r.pagina.evaluate((c) => { globalThis.__fakeAuth.fallar = c; }, fallar);
  return r;
}
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && !e.closest('[hidden]'); }, sel);
const escenarios = {
  async 'botón visible en la web'() {
    const { navegador, pagina } = await abrirLogin();
    const v = await visible(pagina, '#botonLoginGoogle'); const tit = await pagina.textContent('#botonLoginGoogle');
    await navegador.close();
    return informe('login en la web: se ve "Continuar con Google"', v && /Continuar con Google/.test(tit), tit.trim());
  },
  async 'oculto en la APK sin plugin'() {
    const { navegador, pagina } = await abrirLogin({ app: true });
    const v = await visible(pagina, '#botonLoginGoogle');
    await navegador.close();
    return informe('APK sin el plugin de Google: el botón no se muestra', !v);
  },
  async 'nativo entra'() {
    const { navegador, pagina } = await abrirLogin({ app: true, plugin: 'ok' });
    const v = await visible(pagina, '#botonLoginGoogle');
    await pagina.click('#botonLoginGoogle');
    await pagina.waitForFunction(() => document.getElementById('pantallaLogin').hidden, null, { timeout: 8000 });
    const r = await pagina.evaluate(() => ({ nativo: globalThis.__llamadasNativo, popup: globalThis.__fakeAuth.llamadas.map((l) => l.nombre) }));
    await navegador.close();
    return informe('APK con el plugin: se ve el botón, usa el selector nativo (no la ventana emergente) y entra', v && r.nativo === 1 && r.popup.includes('credencial') && !r.popup.includes('google'), JSON.stringify(r));
  },
  async 'nativo cancela'() {
    const { navegador, pagina } = await abrirLogin({ app: true, plugin: 'cancela' });
    await pagina.click('#botonLoginGoogle'); await pagina.waitForTimeout(600);
    const error = await visible(pagina, '#loginError'); const sigue = await visible(pagina, '#pantallaLogin');
    await navegador.close();
    return informe('APK: cerrar el selector de cuentas no muestra error', !error && sigue, JSON.stringify({ error, sigue }));
  },
  async 'nativo falla'() {
    const { navegador, pagina } = await abrirLogin({ app: true, plugin: 'falla' });
    await pagina.click('#botonLoginGoogle'); await pagina.waitForTimeout(600);
    const msg = (await pagina.textContent('#loginError')).trim();
    await navegador.close();
    return informe('APK: un fallo del selector muestra un mensaje sin términos técnicos', /No se pudo completar/.test(msg) && !/something|token/i.test(msg), msg);
  },
  async 'entra con Google'() {
    const { navegador, pagina, errores } = await abrirLogin();
    await pagina.click('#botonLoginGoogle');
    await pagina.waitForFunction(() => document.getElementById('pantallaLogin').hidden, null, { timeout: 8000 });
    await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
    const txt = await pagina.evaluate(() => document.getElementById('estadoTexto').textContent);
    const llamadas = await pagina.evaluate(() => globalThis.__fakeAuth.llamadas.map((l) => l.nombre));
    const verificado = await pagina.evaluate(async () => (await import('/js/firebase.js')).usuarioActual().emailVerified);
    await navegador.close();
    return informe('con Google entra, ve su TV y la cuenta ya está verificada', llamadas.includes('google') && verificado === true && errores.filter((e) => e.startsWith('página:')).length === 0, JSON.stringify({ llamadas, verificado, txt: txt.trim() }));
  },
  async 'cierra la ventana'() {
    const { navegador, pagina } = await abrirLogin({ google: null });
    await pagina.click('#botonLoginGoogle'); await pagina.waitForTimeout(600);
    const error = await visible(pagina, '#loginError'); const sigue = await visible(pagina, '#pantallaLogin'); const habilitado = await pagina.evaluate(() => !document.getElementById('botonLoginGoogle').disabled);
    await navegador.close();
    return informe('si cierra la ventana de Google: sin error, sigue el login y el botón vuelve a servir', !error && sigue && habilitado, JSON.stringify({ error, sigue, habilitado }));
  },
  async 'no disponible'() {
    const { navegador, pagina } = await abrirLogin({ fallar: 'auth/operation-not-allowed' });
    await pagina.click('#botonLoginGoogle'); await pagina.waitForTimeout(600);
    const msg = (await pagina.textContent('#loginError')).trim(); const sigue = await visible(pagina, '#pantallaLogin');
    await navegador.close();
    return informe('Google sin habilitar en Firebase: mensaje claro', /todavía no está disponible/.test(msg) && sigue, msg);
  },
  async 'ventana bloqueada'() {
    const { navegador, pagina } = await abrirLogin({ fallar: 'auth/popup-blocked' });
    await pagina.click('#botonLoginGoogle'); await pagina.waitForTimeout(600);
    const msg = (await pagina.textContent('#loginError')).trim();
    await navegador.close();
    return informe('ventana emergente bloqueada: mensaje claro', /bloqueó la ventana/.test(msg), msg);
  },
  async 'doble toque'() {
    const { navegador, pagina } = await abrirLogin();
    await pagina.evaluate(() => { globalThis.__fakeAuth.retraso = 400; });
    await pagina.dblclick('#botonLoginGoogle');
    await pagina.waitForTimeout(1200);
    const n = await pagina.evaluate(() => globalThis.__fakeAuth.llamadas.filter((l) => l.nombre === 'google').length);
    await navegador.close();
    return informe('doble toque en Google: una sola ventana', n === 1, 'llamadas=' + n);
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) { if (pedidos.length && !pedidos.includes(n)) continue; total++; try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message); } }
cerrarServidor(); console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
