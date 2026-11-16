// Arranque con sesión guardada y SIN internet (navigator.onLine = false): el panel no se queda
// bloqueado sin decir nada; avisa, y al volver la conexión entra solo.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 5, pantalla: pant } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }
});
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const listo = (p) => p.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });

async function abrirSinRed() {
  return abrir(semilla(), { ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => {
      globalThis.__semillaAuth = s;
      globalThis.__enLinea = false;
      Object.defineProperty(navigator, 'onLine', { get: () => globalThis.__enLinea, configurable: true });
    }, { usuarios: USUARIOS, actual: 'ana@correo.com' });
  } });
}

const escenarios = {
  async 'sin internet: avisa en seguida y no deja el panel bloqueado en silencio'() {
    const { navegador, pagina } = await abrirSinRed();
    await pagina.waitForTimeout(1200); // mucho menos que los 15 s de espera de Firebase
    const pantalla = await vis(pagina, '#pantallaTV');
    const titulo = await txt(pagina, '#tvTitulo'), sub = await txt(pagina, '#tvSubtitulo'), boton = await txt(pagina, '#botonTVVolver');
    await navegador.close();
    return informe('sin internet al abrir: pantalla clara con "Reintentar"', pantalla && /Sin conexión/.test(sub) && boton === 'Reintentar', JSON.stringify({ pantalla, titulo, sub, boton }));
  },
  async 'vuelve la conexión: entra solo al panel'() {
    const { navegador, pagina } = await abrirSinRed();
    await pagina.waitForTimeout(800);
    await pagina.evaluate(() => { globalThis.__enLinea = true; window.dispatchEvent(new Event('online')); });
    await listo(pagina);
    const pantalla = await vis(pagina, '#pantallaTV');
    const miTV = await vis(pagina, '#botonMiTV');
    await navegador.close();
    return informe('al volver internet: se cierra el aviso y el panel queda libre', !pantalla && miTV, JSON.stringify({ pantalla, miTV }));
  },
  async 'Reintentar sin conexión sigue avisando y con conexión entra'() {
    const { navegador, pagina } = await abrirSinRed();
    await pagina.waitForTimeout(800);
    await pagina.click('#botonTVVolver'); await pagina.waitForTimeout(400);
    const sigue = (await vis(pagina, '#pantallaTV')) && /Sin conexión/.test(await txt(pagina, '#tvSubtitulo'));
    await pagina.evaluate(() => { globalThis.__enLinea = true; });
    await pagina.click('#botonTVVolver');
    await listo(pagina);
    const entro = !(await vis(pagina, '#pantallaTV'));
    await navegador.close();
    return informe('Reintentar sin red sigue avisando; con red entra', sigue && entro, JSON.stringify({ sigue, entro }));
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
