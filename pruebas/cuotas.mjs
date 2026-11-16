// Límite de 25 por cuenta, contadores y biblioteca predeterminada (lado del panel, con base falsa). Uso: node cuotas.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = (texto) => ({ tipo: 'texto', texto, config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } });
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };
const IMG = { datos: '00', ancho: 128, alto: 64, meta: {} };
const ANIM = { ancho: 128, alto: 64, cuadros: [{ datos: '00', dur: 100 }], meta: { origen: 'gif' } };

function semilla(extra = {}) {
  const s = {
    dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } },
    usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 1, ultimo: 'i:foto1' }, imagenes: { foto1: IMG } } },
    biblioteca: { imagenes: { base1: IMG }, animaciones: { gifbase: ANIM } }
  };
  for (const [k, v] of Object.entries(extra)) s[k] = typeof v === 'object' && !Array.isArray(v) && s[k] ? Object.assign({}, s[k], v) : v;
  return s;
}
async function abrirCuentas(db) {
  const r = await abrir(db, {
    sinCSP: true, // usa new Function dentro de la página (ayudante modulo)
    ruta: '/index.html', esperar: false,
    antes: async (p) => { await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: 'ana@correo.com' }); }
  });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 8000 });
  await r.pagina.waitForTimeout(300);
  return r;
}
const raiz = (p) => p.evaluate(() => globalThis.__fakeDb.raiz);
const escrituras = (p) => p.evaluate(() => globalThis.__fakeDb.escrituras);
const erroresPagina = (e) => e.filter((x) => x.startsWith('página:'));
const guardarDibujo = async (p, nombre) => {
  await p.click('#grupoTipo button[data-valor="dibujo"]'); await p.waitForTimeout(200);
  await p.fill('#nombreGaleriaDibujo', nombre);
  await p.click('#botonGuardarGaleriaDibujo'); await p.waitForTimeout(900);
  return (await p.textContent('#avisoGaleriaDibujo')).trim();
};
const modulo = (p, cuerpo) => p.evaluate(async (c) => { const m = await import('/js/firebase.js'); return await (new Function('m', 'return (async () => {' + c + '})()'))(m); }, cuerpo);

const escenarios = {
  async 'guardar una imagen nueva suma 1'() {
    const { navegador, pagina, errores } = await abrirCuentas(semilla());
    const aviso = await guardarDibujo(pagina, 'mi dibujo');
    const r = await raiz(pagina);
    const esc = await escrituras(pagina);
    await navegador.close();
    const ok = r.usuarios['uid-ana'].imagenes['mi dibujo'] && r.usuarios['uid-ana'].cuotas.usados === 2 && r.usuarios['uid-ana'].cuotas.ultimo === 'i:mi dibujo' && esc.length === 1 && esc[0].ruta === '';
    return informe('imagen nueva: el elemento, el contador (+1) y "ultimo" van en UNA sola escritura', ok && /Guardado en la galería/.test(aviso), `usados=${r.usuarios['uid-ana'].cuotas.usados} ultimo=${r.usuarios['uid-ana'].cuotas.ultimo} escrituras=${JSON.stringify(esc.map((e) => e.ruta))} aviso="${aviso}"`);
  },

  async 'reemplazar una existente no cambia el contador'() {
    const { navegador, pagina } = await abrirCuentas(semilla());
    await guardarDibujo(pagina, 'foto1');
    const r = await raiz(pagina);
    await navegador.close();
    return informe('guardar con el nombre de una existente la reemplaza y deja el contador igual', r.usuarios['uid-ana'].cuotas.usados === 1 && r.usuarios['uid-ana'].cuotas.ultimo === 'i:foto1', `usados=${r.usuarios['uid-ana'].cuotas.usados}`);
  },

  async 'imágenes y animaciones suman en el mismo contador'() {
    const { navegador, pagina } = await abrirCuentas(semilla());
    const res = await modulo(pagina, "return await m.guardarAnimacionCatalogo('mi gif', 128, 64, [{ datos: '00', dur: 100 }], { origen: 'gif' });");
    const r = await raiz(pagina);
    await navegador.close();
    return informe('una animación nueva suma al total Y al contador de GIF ("a:" en ultimo)', res.exito && r.usuarios['uid-ana'].cuotas.usados === 2 && r.usuarios['uid-ana'].cuotas.gifs === 1 && r.usuarios['uid-ana'].cuotas.ultimo === 'a:mi gif' && !!r.usuarios['uid-ana'].animaciones['mi gif'], JSON.stringify({ res, cuotas: r.usuarios['uid-ana'].cuotas }));
  },

  async 'borrar resta 1'() {
    const { navegador, pagina } = await abrirCuentas(semilla());
    const res = await modulo(pagina, "return await m.borrarImagenCatalogo('foto1');");
    const r = await raiz(pagina);
    await navegador.close();
    return informe('borrar una imagen quita el elemento y resta 1 (en una sola escritura)', res.exito && !(r.usuarios["uid-ana"].imagenes && r.usuarios["uid-ana"].imagenes.foto1) && r.usuarios['uid-ana'].cuotas.usados === 0 && r.usuarios['uid-ana'].cuotas.ultimo === 'i:foto1', JSON.stringify(r.usuarios['uid-ana'].cuotas));
  },

  async 'con el límite lleno no guarda y lo explica'() {
    const { navegador, pagina } = await abrirCuentas(semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 25 }, imagenes: { foto1: IMG } } } }));
    const antes = (await escrituras(pagina)).length;
    const aviso = await guardarDibujo(pagina, 'una mas');
    const despues = (await escrituras(pagina)).length;
    await navegador.close();
    return informe('límite lleno (25): no escribe nada y avisa con claridad', /llegaste al límite de 25 elementos guardados \(imágenes y GIF juntos\); borra alguno/.test(aviso) && despues === antes, `aviso="${aviso}" escrituras nuevas=${despues - antes}`);
  },

  async 'extras y límite base configurable'() {
    let { navegador, pagina } = await abrirCuentas(semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 25, extra: 5 }, imagenes: { foto1: IMG } } } }));
    const conExtra = await modulo(pagina, "return await m.guardarImagenCatalogo('la26', '00', 128, 64, null, {});");
    await navegador.close();
    ({ navegador, pagina } = await abrirCuentas(semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 3 }, imagenes: { foto1: IMG } } }, config: { limites: { total: 3 } } })));
    const conBase3 = await modulo(pagina, "return await m.guardarImagenCatalogo('la4', '00', 128, 64, null, {});");
    await navegador.close();
    return informe('con 5 extras caben 30; si el administrador baja el límite base a 3, con 3 ya no cabe', conExtra.exito && !conBase3.exito && /límite de 3 elementos/.test(conBase3.error), JSON.stringify({ conExtra, conBase3 }));
  },

  async 'el administrador no tiene límite'() {
    const { navegador, pagina } = await abrirCuentas(semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 25 }, imagenes: { foto1: IMG } } }, administradores: { 'uid-ana': true } }));
    const res = await modulo(pagina, "return await m.guardarImagenCatalogo('admin26', '00', 128, 64, null, {});");
    await navegador.close();
    return informe('administrador con 25 usadas guarda una más', res.exito, JSON.stringify(res));
  },

  async 'máximo de 10 GIF'() {
    const cuotas = (usados, gifs, extra = {}) => semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: Object.assign({ usados, gifs }, extra), imagenes: { foto1: IMG } } } });
    let { navegador, pagina } = await abrirCuentas(cuotas(12, 10));
    const gifLleno = await modulo(pagina, "return await m.guardarAnimacionCatalogo('g11', 128, 64, [{ datos: '00', dur: 100 }], {});");
    const imagenSi = await modulo(pagina, "return await m.guardarImagenCatalogo('img13', '00', 128, 64, null, {});");
    await navegador.close();
    ({ navegador, pagina } = await abrirCuentas(cuotas(24, 1)));
    const veinticinco = await modulo(pagina, "return await m.guardarAnimacionCatalogo('g2', 128, 64, [{ datos: '00', dur: 100 }], {});");
    let r = await raiz(pagina);
    const c = r.usuarios['uid-ana'].cuotas;
    await navegador.close();
    ({ navegador, pagina } = await abrirCuentas(cuotas(25, 2)));
    const totalLleno = await modulo(pagina, "return await m.guardarAnimacionCatalogo('g3', 128, 64, [{ datos: '00', dur: 100 }], {});");
    await navegador.close();
    ({ navegador, pagina } = await abrirCuentas(cuotas(12, 10, { extraAnimaciones: 2 })));
    const conExtra = await modulo(pagina, "return await m.guardarAnimacionCatalogo('g11', 128, 64, [{ datos: '00', dur: 100 }], {});");
    await navegador.close();
    const ok = !gifLleno.exito && /límite de 10 GIF/.test(gifLleno.error) && imagenSi.exito
      && veinticinco.exito && c.usados === 25 && c.gifs === 2
      && !totalLleno.exito && /límite de 25 elementos/.test(totalLleno.error)
      && conExtra.exito;
    return informe('máximo 10 GIF: el 11º no cabe pero sí imágenes; 24 imágenes + 1 GIF permite el GIF 25; con 25 en total nada cabe; los extras de GIF suman', ok, JSON.stringify({ gifLleno: gifLleno.error, imagenSi: imagenSi.exito, veinticinco: veinticinco.exito, c, totalLleno: totalLleno.error, conExtra: conExtra.exito }));
  },

  async 'borrar un GIF resta a los dos contadores'() {
    const { navegador, pagina } = await abrirCuentas(semilla({ usuarios: { 'uid-ana': { dispositivos: { tv1: true }, cuotas: { usados: 3, gifs: 2 }, imagenes: { foto1: IMG }, animaciones: { gifA: ANIM, gifB: ANIM } } } }));
    const res = await modulo(pagina, "return await m.borrarAnimacionCatalogo('gifA');");
    const r = await raiz(pagina);
    await navegador.close();
    const c = r.usuarios['uid-ana'].cuotas;
    return informe('borrar un GIF: total 3→2, GIF 2→1 y "ultimo" = a:gifA', res.exito && c.usados === 2 && c.gifs === 1 && c.ultimo === 'a:gifA' && !r.usuarios['uid-ana'].animaciones.gifA, JSON.stringify(c));
  },

  async 'el administrador borra las predeterminadas'() {
    const { navegador, pagina, errores } = await abrirCuentas(semilla({ administradores: { 'uid-ana': true } }));
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await pagina.waitForTimeout(900);
    await pagina.evaluate(() => { const it = [...document.querySelectorAll('#seccionGaleria .item-galeria')].find((e) => e.textContent.includes('base1')); it.click(); });
    await pagina.waitForTimeout(300);
    const habilitado = !(await pagina.isDisabled('#botonBorrarGaleria'));
    let pregunta = '';
    pagina.removeAllListeners('dialog');
    pagina.on('dialog', (d) => { pregunta = d.message(); d.accept(); });
    await pagina.click('#botonBorrarGaleria'); await pagina.waitForTimeout(900);
    const r = await raiz(pagina);
    const esc = await pagina.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
    const copiaDelUsuario = r.usuarios['uid-ana'].cuotas.usados;
    await navegador.close();
    return informe('administrador: puede borrar una predeterminada (con aviso de que se pierde para todas) y no toca sus contadores', habilitado && /predeterminadas/.test(pregunta) && !(r.biblioteca.imagenes && r.biblioteca.imagenes.base1) && esc.includes('biblioteca/imagenes/base1') && esc.includes('biblioteca/imagenes_indice/base1') && copiaDelUsuario === 1 && !erroresPagina(errores).length, JSON.stringify({ habilitado, pregunta, esc }));
  },

  async 'el administrador borra una animación predeterminada'() {
    const { navegador, pagina } = await abrirCuentas(semilla({ administradores: { 'uid-ana': true } }));
    const res = await modulo(pagina, "return await m.borrarAnimacionCatalogo('gifbase', { predeterminada: true });");
    const r = await raiz(pagina);
    await navegador.close();
    return informe('borrar una animación predeterminada quita biblioteca/animaciones/gifbase', res.exito && !(r.biblioteca.animaciones && r.biblioteca.animaciones.gifbase));
  },

  async 'nombre demasiado largo'() {
    const { navegador, pagina } = await abrirCuentas(semilla());
    const res = await modulo(pagina, "return await m.guardarImagenCatalogo('x'.repeat(81), '00', 128, 64, null, {});");
    await navegador.close();
    return informe('un nombre de más de 80 caracteres se rechaza con un mensaje claro', !res.exito && /demasiado largo/.test(res.error), JSON.stringify(res));
  },

  async 'las predeterminadas se ven, se usan y no se borran'() {
    const { navegador, pagina, errores } = await abrirCuentas(semilla());
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await pagina.waitForTimeout(900);
    const nombres = await pagina.evaluate(() => [...document.querySelectorAll('#seccionGaleria .item-galeria-nombre')].map((e) => e.textContent.trim()));
    // Elige una predeterminada y otra propia
    const elegir = async (nombre) => { await pagina.evaluate((n) => { const it = [...document.querySelectorAll('#seccionGaleria .item-galeria')].find((e) => e.textContent.includes(n)); it.click(); }, nombre); await pagina.waitForTimeout(300); };
    await elegir('base1');
    const borrarDefecto = await pagina.isDisabled('#botonBorrarGaleria');
    await elegir('foto1');
    const borrarPropia = await pagina.isDisabled('#botonBorrarGaleria');
    await navegador.close();
    return informe('la Galería muestra las predeterminadas y las propias; Borrar queda apagado solo para las predeterminadas', nombres.includes('base1') && nombres.includes('foto1') && borrarDefecto && !borrarPropia && !erroresPagina(errores).length, JSON.stringify({ nombres, borrarDefecto, borrarPropia }));
  },

  async 'las predeterminadas de animaciones'() {
    const { navegador, pagina } = await abrirCuentas(semilla());
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await pagina.waitForTimeout(300);
    // Subvista de animaciones (no GIF): el botón del selector
    const hay = await pagina.evaluate(async () => { const m = await import('/js/firebase.js'); return await new Promise((res) => { const un = m.suscribirAnimaciones((l) => { un(); res(l); }, () => res(null)); }); });
    await navegador.close();
    return informe('suscribirAnimaciones mezcla las de la biblioteca marcadas como predeterminadas', hay && hay.gifbase && hay.gifbase.predeterminada === true, JSON.stringify(Object.keys(hay || {})));
  },

  async 'si la biblioteca no se puede leer, sigue con lo propio'() {
    const { navegador, pagina, errores } = await abrirCuentas(semilla());
    await pagina.evaluate(() => { globalThis.__fakeDb.fallar['biblioteca/imagenes'] = true; });
    await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.click('#grupoMas button[data-mas="galeria"]'); await pagina.waitForTimeout(900);
    const nombres = await pagina.evaluate(() => [...document.querySelectorAll('#seccionGaleria .item-galeria-nombre')].map((e) => e.textContent.trim()));
    await navegador.close();
    return informe('sin permiso a la biblioteca: se ven solo las imágenes de la cuenta y no se rompe nada', nombres.includes('foto1') && !nombres.includes('base1') && !erroresPagina(errores).length, JSON.stringify(nombres));
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
