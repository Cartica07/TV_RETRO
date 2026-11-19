// Más > Config > Sistema (H-19): Actualizar y Restablecer la TV. Firebase falso. Uso: node sistema.mjs [nombre…]
import { abrir, cerrarServidor, informe } from './banco.mjs';

const pant = { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', modoTexto: 'fijo', fuente: 'sans', invertido: false } };
const USUARIOS = { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } };

// firmware: lo que informa la TV (null = firmware anterior, no informa); publicada: build del manifiesto (null = no hay).
function semilla({ dueno = 'uid-ana', miembros = null, firmware = { build: 2, estado: 'ok', fecha: 1000 }, publicada = 3 } = {}) {
  const tv = { dueno, oled_remota: { version: 5, contadorVersion: 5, pantalla: pant } };
  if (miembros) tv.miembros = miembros;
  if (firmware) tv.firmware = firmware;
  const raiz = { dispositivos: { tv1: tv }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } };
  if (publicada !== null) raiz.firmware = { estable: { build: publicada, tamano: 1500000, sha256: 'a'.repeat(64), firma: 'A'.repeat(344) } };
  return raiz;
}

async function abrirApp(datos = {}, { ancho = 390, alto = 844 } = {}) {
  const r = await abrir(semilla(datos), { ancho, alto, ruta: '/index.html', esperar: false, antes: async (p) => {
    await p.addInitScript((s) => { globalThis.__semillaAuth = s; globalThis.__persistirDb = true; }, { usuarios: USUARIOS, actual: 'ana@correo.com' });
  } });
  r.pagina.on('dialog', (d) => d.accept());
  await r.pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 10000 });
  return r;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; }, sel);
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const abrirSistema = async (p) => {
  await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200);
  await p.click('#grupoMas button[data-mas="config"]'); await p.waitForTimeout(200);
  await p.click('#grupoConfig button[data-config="sistema"]'); await p.waitForTimeout(500);
};
const raiz = (p) => p.evaluate(() => globalThis.__fakeDb.raiz);
// Simula lo que haría la TV: cambia un nodo y avisa a los que escuchan.
const tvEscribe = (p, ruta, valor) => p.evaluate(([r, v]) => {
  const ks = r.split('/'); let n = globalThis.__fakeDb.raiz;
  for (let i = 0; i < ks.length - 1; i++) { if (typeof n[ks[i]] !== 'object' || n[ks[i]] === null) n[ks[i]] = {}; n = n[ks[i]]; }
  n[ks[ks.length - 1]] = v; globalThis.__fakeDb.notificar();
}, [ruta, valor]);
const errores = (e) => e.filter((x) => x.startsWith('página:'));

const escenarios = {
  async 'dueño con una versión nueva: ve Actualizar y Restablecer, sin números de versión'() {
    const { navegador, pagina, errores: e } = await abrirApp(); await abrirSistema(pagina);
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    const v = { actualizar: await vis(pagina, '#botonSistemaActualizar'), restablecer: await vis(pagina, '#botonSistemaRestablecer'), titulo: await txt(pagina, '#tituloMas') };
    await navegador.close();
    return informe('dueño con versión nueva: Actualizar y Restablecer visibles, el texto no muestra números',
      v.actualizar && v.restablecer && v.titulo === 'Sistema' && /versión nueva/.test(estado) && !/\d/.test(estado) && !errores(e).length, JSON.stringify({ estado, v }));
  },

  async 'dueño con la TV al día: sin botón Actualizar, con Restablecer'() {
    const { navegador, pagina } = await abrirApp({ publicada: 2 }); await abrirSistema(pagina);
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    const v = { actualizar: await vis(pagina, '#botonSistemaActualizar'), restablecer: await vis(pagina, '#botonSistemaRestablecer') };
    await navegador.close();
    return informe('TV al día: dice que está al día, sin Actualizar y con Restablecer', /al día/.test(estado) && !v.actualizar && v.restablecer, JSON.stringify({ estado, v }));
  },

  async 'firmware anterior (la TV no informa su versión): ninguna de las dos opciones'() {
    const { navegador, pagina } = await abrirApp({ firmware: null }); await abrirSistema(pagina);
    const v = { campoA: await vis(pagina, '#campoSistemaActualizar'), campoR: await vis(pagina, '#campoSistemaRestablecer') };
    const aviso = await txt(pagina, '#estadoLinea');
    await navegador.close();
    return informe('sin informe de la TV: se ocultan Actualizar y Restablecer y se avisa', !v.campoA && !v.campoR && /todavía no admite/.test(aviso), JSON.stringify({ v, aviso }));
  },

  async 'un miembro no ve ninguna de las dos opciones'() {
    const { navegador, pagina } = await abrirApp({ dueno: 'uid-otro', miembros: { 'uid-ana': 'ABC234' } }); await abrirSistema(pagina);
    const v = { campoA: await vis(pagina, '#campoSistemaActualizar'), campoR: await vis(pagina, '#campoSistemaRestablecer') };
    const aviso = await txt(pagina, '#estadoLinea');
    await navegador.close();
    return informe('miembro: Sistema no ofrece Actualizar ni Restablecer y dice que es del dueño', !v.campoA && !v.campoR && /Solo el dueño/.test(aviso), JSON.stringify({ v, aviso }));
  },

  async 'Actualizar: manda la orden y sigue el informe de la TV hasta "se actualizó"'() {
    const { navegador, pagina, errores: e } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(500);
    const orden = (await raiz(pagina)).dispositivos.tv1.oled_remota.pantalla.tipo;
    const t1 = await txt(pagina, '#sistemaEstadoActualizar');
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'actualizando', fecha: 2000 }); await pagina.waitForTimeout(200);
    const t2 = await txt(pagina, '#sistemaEstadoActualizar');
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'reiniciando', fecha: 3000 }); await pagina.waitForTimeout(200);
    const t3 = await txt(pagina, '#sistemaEstadoActualizar');
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 3, estado: 'ok', fecha: 4000 }); await pagina.waitForTimeout(300);
    const t4 = await txt(pagina, '#sistemaEstadoActualizar');
    const boton = await vis(pagina, '#botonSistemaActualizar');
    await navegador.close();
    return informe('Actualizar: orden "actualizar", luego Actualizando…, Reiniciando… y "La TV se actualizó"; el botón desaparece',
      orden === 'actualizar' && /Actualizando/.test(t1 + t2) && /Reiniciando/.test(t3) && /se actualizó/.test(t4) && !boton && !errores(e).length, JSON.stringify({ orden, t1, t2, t3, t4, boton }));
  },

  async 'Actualizar: un error de la TV (firma inválida) se explica sin términos técnicos y deja reintentar'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(400);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'firma_invalida', fecha: 2000 }); await pagina.waitForTimeout(300);
    const linea = await txt(pagina, '#estadoLinea');
    const boton = await vis(pagina, '#botonSistemaActualizar');
    await navegador.close();
    return informe('error de la TV: "No se pudo actualizar…", sin "firma" ni "hash", y el botón sigue para reintentar',
      /No se pudo actualizar la TV/.test(linea) && !/firma|hash|sha/i.test(linea) && boton, JSON.stringify({ linea, boton }));
  },

  async 'Actualizar: si la TV reinicia sin actualizarse (se cayó o se revirtió) lo dice y deja reintentar'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(400);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'actualizando', fecha: 2000 }); await pagina.waitForTimeout(200);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'ok', fecha: 3000 }); await pagina.waitForTimeout(400); // reinició y sigue en la versión 2
    const linea = await txt(pagina, '#estadoLinea');
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    const boton = await vis(pagina, '#botonSistemaActualizar');
    const habilitado = await pagina.evaluate(() => !document.getElementById('botonSistemaActualizar').disabled);
    await navegador.close();
    return informe('TV reiniciada sin actualizarse: avisa, ya no dice "Actualizando…" y el botón queda activo para reintentar',
      /se reinició sin terminar/.test(linea) && !/Actualizando/.test(estado) && boton && habilitado, JSON.stringify({ linea, estado, boton, habilitado }));
  },

  async 'Actualizar: un informe "ok" antes de que la TV empiece NO se toma por un fallo'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(400);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'ok', fecha: 2500 }); await pagina.waitForTimeout(400); // la TV se reinició por otro motivo justo antes de empezar
    const linea = await txt(pagina, '#estadoLinea');
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    await navegador.close();
    return informe('un "ok" con la versión vieja antes de ver "Actualizando…" no es un fallo: sigue esperando', !/se reinició/.test(linea) && /Actualizando/.test(estado), JSON.stringify({ linea, estado }));
  },

  async 'Actualizar con la pantalla vieja: vuelve a leer y NO da por buena una versión que no es'() {
    // La pantalla se abrió cuando la publicada era la 3 y la TV llevaba la 2; mientras tanto se publicó la 4 y la TV pasó a la 3.
    const { navegador, pagina } = await abrirApp({ publicada: 3 }); await abrirSistema(pagina);
    await tvEscribe(pagina, 'firmware/estable/build', 4);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 3, estado: 'ok', fecha: 5000 });
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(700);
    const orden = (await raiz(pagina)).dispositivos.tv1.oled_remota.pantalla.tipo;
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    await navegador.close();
    return informe('pantalla vieja: se sigue esperando (la TV con la 3 no cumple la 4) y NO dice "se actualizó"',
      orden === 'actualizar' && !/se actualizó/.test(estado) && /Actualizando/.test(estado), JSON.stringify({ orden, estado }));
  },

  async 'Actualizar con la pantalla vieja y la TV ya actualizada: no manda nada y dice que está al día'() {
    const { navegador, pagina } = await abrirApp({ publicada: 3 }); await abrirSistema(pagina);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 3, estado: 'ok', fecha: 5000 }); // la TV ya se actualizó por otro lado
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(700);
    const tipo = (await raiz(pagina)).dispositivos.tv1.oled_remota.pantalla.tipo;
    const estado = await txt(pagina, '#sistemaEstadoActualizar');
    const boton = await vis(pagina, '#botonSistemaActualizar');
    await navegador.close();
    return informe('ya actualizada: no se manda la orden, dice que está al día y el botón desaparece', tipo === 'texto' && /al día/.test(estado) && !boton, JSON.stringify({ tipo, estado, boton }));
  },

  async 'Actualizar con la TV ocupada: mensaje claro'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaActualizar'); await pagina.waitForTimeout(400);
    await tvEscribe(pagina, 'dispositivos/tv1/firmware', { build: 2, estado: 'ocupada', fecha: 2000 }); await pagina.waitForTimeout(300);
    const linea = await txt(pagina, '#estadoLinea');
    await navegador.close();
    return informe('TV ocupada: dice que está ocupada y que lo intentes en un momento', /ocupada/.test(linea), linea);
  },

  async 'Restablecer sin acuse de la TV: no desvincula nada y avisa'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.clock.install();
    await pagina.click('#botonSistemaRestablecer'); await pagina.waitForTimeout(300);
    await pagina.clock.fastForward(26000); await pagina.waitForTimeout(400);
    const r = await raiz(pagina);
    const linea = await txt(pagina, '#estadoLinea');
    await navegador.close();
    return informe('sin acuse: la orden salió, pero no se desvincula (sigue el dueño) y dice que la TV no respondió',
      r.dispositivos.tv1.oled_remota.pantalla.tipo === 'restablecer' && r.dispositivos.tv1.dueno === 'uid-ana' && /no respondió/.test(linea), JSON.stringify({ tipo: r.dispositivos.tv1.oled_remota.pantalla.tipo, dueno: r.dispositivos.tv1.dueno, linea }));
  },

  async 'Restablecer con un acuse de OTRA versión (mayor) no desvincula'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.clock.install();
    await pagina.click('#botonSistemaRestablecer'); await pagina.waitForTimeout(300);
    const version = (await raiz(pagina)).dispositivos.tv1.oled_remota.version;
    await tvEscribe(pagina, 'dispositivos/tv1/oled_remota/mostrada', version + 3); await pagina.waitForTimeout(200); // alguien mandó otra cosa después y la TV acusó esa
    await pagina.clock.fastForward(26000); await pagina.waitForTimeout(400);
    const r = await raiz(pagina);
    await navegador.close();
    return informe('acuse mayor (la TV solo bajó lo último): no se desvincula', r.dispositivos.tv1.dueno === 'uid-ana' && r.dispositivos.tv1.oled_remota.version === version, JSON.stringify({ dueno: r.dispositivos.tv1.dueno, version, ahora: r.dispositivos.tv1.oled_remota.version }));
  },

  async 'Restablecer con el acuse exacto: desvincula (version -2, sin dueño) y recarga'() {
    const { navegador, pagina } = await abrirApp(); await abrirSistema(pagina);
    await pagina.click('#botonSistemaRestablecer'); await pagina.waitForTimeout(300);
    const version = (await raiz(pagina)).dispositivos.tv1.oled_remota.version;
    await tvEscribe(pagina, 'dispositivos/tv1/oled_remota/mostrada', version); // la TV acusa EXACTAMENTE esa versión
    await pagina.waitForTimeout(2500); // desvincula y recarga
    let r;
    for (let i = 0; i < 6 && !r; i++) { try { r = await raiz(pagina); } catch (err) { await pagina.waitForTimeout(500); } }
    const tv = r.dispositivos.tv1;
    const lista = ((r.usuarios['uid-ana'] || {}).dispositivos || {}).tv1;
    await navegador.close();
    return informe('acuse exacto: la TV queda sin dueño, version -2, sin contenido y fuera de mi lista',
      !tv.dueno && tv.oled_remota.version === -2 && !tv.oled_remota.pantalla && !lista, JSON.stringify({ dueno: tv.dueno, version: tv.oled_remota.version, pantalla: !!tv.oled_remota.pantalla, lista }));
  },

  async 'Sistema entra sin scroll a 390x844 y a 360x740'() {
    const medidas = [];
    for (const [ancho, alto] of [[390, 844], [360, 740]]) {
      const { navegador, pagina } = await abrirApp({}, { ancho, alto }); await abrirSistema(pagina);
      medidas.push(await pagina.evaluate(() => {
        const fin = document.querySelector('main.controles').getBoundingClientRect().bottom;
        const nav = document.querySelector('.nav-inferior').getBoundingClientRect().top;
        return { fin: Math.round(fin), nav: Math.round(nav), doc: document.documentElement.scrollHeight, vp: innerHeight };
      }));
      await navegador.close();
    }
    return informe('Sistema sin scroll (el final de los controles queda sobre la navegación y el documento no excede la pantalla)',
      medidas.every((m) => m.fin <= m.nav && m.doc <= m.vp), JSON.stringify(medidas));
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
