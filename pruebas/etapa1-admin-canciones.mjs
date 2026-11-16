// Etapa 1, paso 1: importar/borrar canciones solo visibles para administradores.
import { abrir, cerrarServidor, informe } from './banco.mjs';
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const semilla = (extra = {}) => Object.assign({ dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } }, extra);
async function medir(db, ruta, cuentas) {
  const r = await abrir(db, { ruta, esperar: false, antes: async (p) => {
    if (cuentas) await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: 'ana@correo.com' });
  } });
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 12000 });
  await r.pagina.click('#grupoTipo button[data-valor="cancion"]');
  const v = await r.pagina.evaluate(() => {
    const vis = (e) => !!e && getComputedStyle(e).display !== 'none';
    return { importar: vis(document.getElementById('cargadorMusical').closest('label')), borrar: vis(document.getElementById('botonBorrarMusical')), selector: vis(document.getElementById('seleccionCancion')) };
  });
  const errs = r.errores.length;
  await r.navegador.close();
  return { ...v, errs };
}
const a = await medir(semilla(), '/index.html?cuentas=1', true);
informe('cuenta normal: no ve importar ni borrar, sí el selector', !a.importar && !a.borrar && a.selector && a.errs === 0, JSON.stringify(a));
const b = await medir(semilla({ administradores: { 'uid-ana': true } }), '/index.html?cuentas=1', true);
informe('administrador: ve importar y borrar', b.importar && b.borrar && b.errs === 0, JSON.stringify(b));
const c = await medir({}, '/index.html?sincuentas=1', false);
informe('modo viejo (pruebas locales): siguen visibles', c.importar && c.borrar, JSON.stringify(c));
cerrarServidor();
