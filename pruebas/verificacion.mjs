// Etapa 2: guardar en la Galería exige correo verificado (lado del panel, con base falsa).
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const semilla = (extra = {}) => Object.assign({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }
}, extra);
async function abrirCon(verificado, db) {
  const r = await abrir(db, {
    ruta: '/index.html', esperar: false,
    antes: async (p) => {
      await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado } }, actual: 'ana@correo.com' });
    }
  });
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
  await r.pagina.waitForTimeout(300);
  return r;
}
const modulo = (p, cuerpo) => p.evaluate(async (c) => { const m = await import('/js/firebase.js'); return await (new Function('m', 'return (async () => {' + c + '})()'))(m); }, cuerpo);
const guardar = (p, nombre) => modulo(p, `return await m.guardarImagenCatalogo(${JSON.stringify(nombre)}, '00', 128, 64, null, {});`);
const correos = (p) => p.evaluate(() => globalThis.__fakeAuth.correos.filter((c) => c.tipo === 'verificacion').length);
const catalogo = (p) => p.evaluate(() => Object.keys((globalThis.__fakeDb.raiz.usuarios['uid-ana'] || {}).imagenes || {}));

const escenarios = {
  async 'sin verificar'() {
    const { navegador, pagina } = await abrirCon(false, semilla());
    const antes = await correos(pagina);
    const r1 = await guardar(pagina, 'foto1');
    const c1 = await correos(pagina);
    const r2 = await guardar(pagina, 'foto2');
    const c2 = await correos(pagina);
    const cat = await catalogo(pagina);
    await navegador.close();
    return informe('cuenta sin verificar: no guarda, avisa, reenvía el enlace UNA vez por sesión',
      !r1.exito && /confirma tu correo/.test(r1.error) && /te enviamos el enlace ahora/.test(r1.error)
      && !r2.exito && /ya te enviamos el enlace/.test(r2.error) && c1 - antes === 1 && c2 === c1 && cat.length === 0,
      JSON.stringify({ r1: r1.error, r2: r2.error, correos: [antes, c1, c2], cat }));
  },

  async 'verifica a mitad de sesión'() {
    const { navegador, pagina } = await abrirCon(false, semilla());
    const r1 = await guardar(pagina, 'foto1');
    await pagina.evaluate(() => { globalThis.__fakeAuth.usuarios['ana@correo.com'].verificado = true; }); // la persona pulsó el enlace
    const r2 = await guardar(pagina, 'foto2');
    const cat = await catalogo(pagina);
    await navegador.close();
    return informe('al pulsar el enlace en otra pestaña, el siguiente guardado funciona sin recargar', !r1.exito && r2.exito && cat.join() === 'foto2', JSON.stringify({ r1: r1.error, r2, cat }));
  },

  async 'cuenta verificada'() {
    const { navegador, pagina } = await abrirCon(true, semilla());
    const antes = await correos(pagina);
    const r = await guardar(pagina, 'foto1');
    const despues = await correos(pagina);
    await navegador.close();
    return informe('cuenta verificada: guarda y no manda ningún correo', r.exito && despues === antes, JSON.stringify({ r, antes, despues }));
  },

  async 'administrador sin verificar'() {
    const { navegador, pagina } = await abrirCon(false, semilla({ administradores: { 'uid-ana': true } }));
    const r = await guardar(pagina, 'foto1');
    await navegador.close();
    return informe('administrador sin verificar: guarda (exento)', r.exito, JSON.stringify(r));
  },

  async 'borrar sin verificar'() {
    const IMG = { datos: '00', ancho: 128, alto: 64, meta: {} };
    const { navegador, pagina } = await abrirCon(false, semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 1, ultimo: 'i:foto1' }, imagenes: { foto1: IMG } } } }));
    const r = await modulo(pagina, "return await m.borrarImagenCatalogo('foto1');");
    const cat = await catalogo(pagina);
    await navegador.close();
    return informe('cuenta sin verificar: puede borrar (libera su cuota)', r.exito && cat.length === 0, JSON.stringify({ r, cat }));
  },

  async 'mensaje al cliente'() {
    const { navegador, pagina } = await abrirCon(false, semilla());
    await pagina.click('#grupoTipo button[data-valor="dibujo"]'); await pagina.waitForTimeout(200);
    await pagina.fill('#nombreGaleriaDibujo', 'dibujo1');
    await pagina.click('#botonGuardarGaleriaDibujo'); await pagina.waitForTimeout(900);
    const aviso = (await pagina.textContent('#avisoGaleriaDibujo')).trim();
    await navegador.close();
    return informe('el aviso en pantalla es claro y sin términos técnicos', /^No se pudo guardar: primero confirma tu correo/.test(aviso) && !/firebase|permis/i.test(aviso), aviso);
  }
};

const pedidos = process.argv.slice(2);
let bien = 0, total = 0;
for (const [nombre, fn] of Object.entries(escenarios)) {
  if (pedidos.length && !pedidos.includes(nombre)) continue;
  total++;
  try { if (await fn()) bien++; } catch (e) { console.log('FALLA', nombre, '—', e.message); }
}
cerrarServidor();
console.log(`${total} escenarios: ${bien} bien, ${total - bien} con problemas`);
