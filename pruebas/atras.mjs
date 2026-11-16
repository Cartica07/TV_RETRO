// Botón Atrás de la APK (Capacitor simulado, cuentas con base falsa).
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const semilla = (conTV = true) => ({ dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant } } }, usuarios: { 'uid-ana': { dispositivos: conTV ? { tv1: true } : {} } } });
async function abrirApp(db) {
  const r = await abrir(db, { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; globalThis.__salio = 0; globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { if (ev === 'backButton') globalThis.__atras = cb; return Promise.resolve({ remove() {} }); }, exitApp: () => { globalThis.__salio++; } } } }; }, { usuarios: USUARIOS, actual: 'ana@correo.com' });
  } });
  await r.pagina.waitForTimeout(800);
  return r;
}
const listo = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
const atras = async (p) => { await p.evaluate(() => globalThis.__atras()); await p.waitForTimeout(150); };
const vis = (p, sel) => p.evaluate((s) => !document.querySelector(s).hidden, sel);
const salio = (p) => p.evaluate(() => globalThis.__salio);
const escenarios = {
  async 'pantalla principal'() {
    const { navegador, pagina } = await abrirApp(semilla()); await listo(pagina);
    await atras(pagina);
    const s = await salio(pagina); await navegador.close();
    return informe('Atrás en la pantalla principal sale de la app', s === 1, 'salidas=' + s);
  },
  async 'Mi TV y Compartir'() {
    const { navegador, pagina } = await abrirApp(semilla()); await listo(pagina);
    await pagina.click('#botonMiTV'); await pagina.waitForTimeout(300);
    const abierta = await vis(pagina, '#pantallaTV');
    await pagina.click('#listaTV .fila-tv button:has-text("Compartir")'); await pagina.waitForTimeout(600);
    const compartir = await vis(pagina, '#compartirTV');
    await atras(pagina);
    const enLista = !(await vis(pagina, '#pantallaTV').then((v) => !v)) && !(await vis(pagina, '#compartirTV')) && await vis(pagina, '#formTV');
    await atras(pagina);
    const cerrada = !(await vis(pagina, '#pantallaTV'));
    const s1 = await salio(pagina);
    await atras(pagina);
    const s2 = await salio(pagina);
    await navegador.close();
    return informe('Atrás: de Compartir vuelve a Mi TV, de Mi TV a la pantalla principal y recién entonces sale', abierta && compartir && enLista && cerrada && s1 === 0 && s2 === 1, JSON.stringify({ abierta, compartir, enLista, cerrada, s1, s2 }));
  },
  async 'añade tu TV'() {
    const { navegador, pagina } = await abrirApp(semilla(false)); await pagina.waitForTimeout(800);
    const pidiendo = await vis(pagina, '#pantallaTV');
    await atras(pagina);
    const s = await salio(pagina); const sigue = await vis(pagina, '#pantallaTV');
    await navegador.close();
    return informe('en "Añade tu TV" (primera vez) Atrás sale de la app (no hay nada que cerrar)', pidiendo && s === 1 && sigue, JSON.stringify({ pidiendo, s, sigue }));
  },
  async 'lienzo expandido'() {
    const { navegador, pagina } = await abrirApp(semilla()); await listo(pagina);
    await pagina.click('#grupoTipo button[data-valor="dibujo"]'); await pagina.click('#botonExpandirDibujo'); await pagina.waitForTimeout(400);
    const exp = await pagina.evaluate(() => document.body.classList.contains('dibujo-expandido'));
    await atras(pagina);
    const sigue = await pagina.evaluate(() => document.body.classList.contains('dibujo-expandido'));
    const s = await salio(pagina);
    await navegador.close();
    return informe('Atrás con el lienzo expandido lo contrae y no sale', exp && !sigue && s === 0, JSON.stringify({ exp, sigue, s }));
  },
  async 'login'() {
    const r = await abrir(semilla(), { ruta: '/index.html', esperar: false, antes: async (p) => {
      await p.addInitScript(() => { globalThis.__semillaAuth = { usuarios: {}, actual: null }; globalThis.__salio = 0; globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, cb) => { globalThis.__atras = cb; return Promise.resolve({}); }, exitApp: () => { globalThis.__salio++; } } } }; });
    } });
    await r.pagina.waitForTimeout(800);
    const login = await vis(r.pagina, '#pantallaLogin');
    await atras(r.pagina);
    const s = await salio(r.pagina);
    const google = await r.pagina.evaluate(() => document.getElementById('loginGoogle').hidden);
    await r.navegador.close();
    return informe('en el login Atrás sale; y en la APK el botón de Google sigue oculto', login && s === 1 && google, JSON.stringify({ login, s, googleOculto: google }));
  }
};
const pedidos = process.argv.slice(2); let bien = 0, total = 0;
for (const [n, fn] of Object.entries(escenarios)) { if (pedidos.length && !pedidos.includes(n)) continue; total++; try { if (await fn()) bien++; } catch (e) { console.log('FALLA', n, '—', e.message.slice(0, 200)); } }
cerrarServidor(); console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
