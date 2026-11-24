// Actualizar un Pepito Lite por Bluetooth (docs/plan-ota-lite.md; protocolo en la sección 8.5 de docs/evaluacion-version-lite.md)
// y la barra de avance de Más > Config > Sistema (Pepito Lite: avance real; Pepito Pro: solo visual). Firebase y Bluetooth falsos
// (banco-unificado.mjs). La firma se hace con una clave de PRUEBA generada aquí (nunca con las claves de verdad).
import crypto from 'node:crypto';
import { abrir, cerrar, informe, pant, visible, esperarPanel, estadoTV, erroresPagina } from './banco-unificado.mjs';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey; // una clave que la TV no conoce
const CLAVE_PUBLICA = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

// Un "programa" de prueba: empieza con el byte mágico de las imágenes del ESP32 (0xE9) y el resto al azar.
function programa(tamano) {
  const b = crypto.randomBytes(tamano);
  b[0] = 0xE9;
  return b;
}
function publicar(build, bin, { modelo = 'c3', clave = privateKey } = {}) {
  const sha = crypto.createHash('sha256').update(bin).digest('hex');
  const firma = crypto.sign('sha256', Buffer.from(`lite|${modelo}|${build}|${bin.length}|${sha}`), clave).toString('base64');
  return { estable: { build, tamano: bin.length, sha256: sha, firma }, datos: { [build]: bin.toString('base64') } };
}

const semilla = (lite) => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') }, firmware: { build: 8, estado: 'ok', fecha: 1000 } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  firmware: { estable: { build: 9, tamano: 1500000, sha256: 'a'.repeat(64), firma: 'A'.repeat(344) }, lite: { c3: lite } },
});

// La cuenta ya tiene añadida la TV Lite y la tiene elegida; la TV simulada conoce la clave pública de prueba.
const conTVLite = (opciones = {}) => (p) => p.addInitScript(([clave, op]) => {
  if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', op.pro ? 'tv1' : 'lite:tv-simulada');
  }
  window.__tv.clavesPublicas = [clave];
  Object.assign(window.__tv, op.tv || {});
}, [CLAVE_PUBLICA, opciones]);

const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const ancho = (p) => p.evaluate(() => parseFloat(document.getElementById('barraActualizarRelleno').style.width) || 0);
const abrirSistema = async (p) => {
  // En el navegador de pruebas el Bluetooth falso solo conoce la TV después de elegirla una vez (el primer Enviar); en el celular
  // la app se reconecta sola con la TV emparejada. Con un Pepito Pro no hace falta.
  if (await p.evaluate(() => document.body.classList.contains('tv-lite'))) {
    await p.click('#enviar');
    await p.waitForFunction(() => /camino|En la TV|Pepito|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
  }
  await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200);
  await p.click('#grupoMas button[data-mas="config"]'); await p.waitForTimeout(200);
  await p.click('#grupoConfig button[data-config="sistema"]');
  await p.waitForFunction(() => document.getElementById('sistemaEstadoActualizar').textContent.trim() || document.getElementById('estadoTexto').textContent.trim(), null, { timeout: 15000 });
  await p.waitForTimeout(300);
};
// Espera a que la actualización termine (bien o mal): el texto deja de decir Actualizando/Reiniciando/Enviando/Comprobando.
const esperarFin = (p, ms = 60000) => p.waitForFunction(() => {
  const t = document.getElementById('sistemaEstadoActualizar').textContent;
  return !/^(Actualizando|Reiniciando|Enviando|Comprobando)/.test(t);
}, null, { timeout: ms });

// ---------- 1. Pepito Lite: actualizar de la versión 1 a la 2 ----------
{
  const bin = programa(60000);
  const { navegador, pagina, errores } = await abrir(semilla(publicar(2, bin)), { antes: conTVLite() });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  informe('Lite: Sistema se ve, sin Restablecer', await visible(pagina, '#campoSistemaActualizar') && !(await visible(pagina, '#campoSistemaRestablecer')));
  const t0 = await txt(pagina, '#sistemaEstadoActualizar');
  informe('Lite: dice que hay una versión nueva y ofrece Actualizar (sin números)', /versión nueva/.test(t0) && !/\d/.test(t0) && await visible(pagina, '#botonSistemaActualizar'), t0);

  // Se anotan todos los textos y si la barra se vio (en la simulación el envío es muy rápido: un texto puede durar milisegundos).
  await pagina.evaluate(() => {
    window.__textos = []; window.__barraVista = false;
    const el = document.getElementById('sistemaEstadoActualizar');
    new MutationObserver(() => { window.__textos.push(el.textContent); if (!document.getElementById('barraActualizar').hidden) window.__barraVista = true; }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await pagina.click('#botonSistemaActualizar');
  await pagina.waitForFunction(() => /^Reiniciando/.test(document.getElementById('sistemaEstadoActualizar').textContent), null, { timeout: 30000 });
  const textos = await pagina.evaluate(() => window.__textos);
  informe('Lite: el texto de la Lite (texto 46) mientras se actualiza', textos.includes('Actualizando… No cierres la app y deja el celular cerca de tu Pepito.'), textos.join(' / '));
  informe('Lite: la barra aparece', await pagina.evaluate(() => window.__barraVista));
  const enReinicio = await ancho(pagina);
  informe('Lite: tras el envío la barra va por el 90 % o más, sin llegar a 100 mientras se reinicia', enReinicio >= 88 && enReinicio < 100, String(enReinicio));
  await esperarFin(pagina);
  const tFin = await txt(pagina, '#sistemaEstadoActualizar');
  const e = await estadoTV(pagina);
  informe('Lite: termina con "Pepito se actualizó" y la barra al 100 %', /se actualizó/.test(tFin) && (await ancho(pagina)) === 100, `${tFin} | ${await ancho(pagina)}`);
  informe('Lite: la TV quedó en la versión 2, dada por buena (no pendiente), tras un reinicio', e.build === 2 && e.pendiente === false && e.reinicios === 1 && e.programas.length === 1 && e.programas[0].ok, JSON.stringify(e.programas) + ` build ${e.build} pendiente ${e.pendiente}`);
  informe('Lite: el botón Actualizar ya no se ve', !(await visible(pagina, '#botonSistemaActualizar')));

  // Volver a abrir Sistema: al día.
  await pagina.click('#botonMasVolver').catch(() => {});
  await pagina.waitForTimeout(300);
  await pagina.click('#grupoConfig button[data-config="sistema"]').catch(() => {});
  await pagina.waitForTimeout(1500);
  const tAlDia = await txt(pagina, '#sistemaEstadoActualizar');
  informe('Lite: al volver a Sistema dice que está al día y la barra no se ve', /al día/.test(tAlDia) && !(await visible(pagina, '#barraActualizar')), tAlDia + ' | ' + JSON.stringify(await pagina.evaluate(() => ({ t: window.__textos.slice(-6), h: document.getElementById('barraActualizar').hidden }))));
  informe('Lite: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

// ---------- 2. Firma mala: la TV la rechaza y sigue igual ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(publicar(2, programa(20000), { clave: otra })), { antes: conTVLite() });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  await pagina.click('#botonSistemaActualizar');
  await esperarFin(pagina);
  const e = await estadoTV(pagina);
  const aviso = await txt(pagina, '#estadoTexto');
  informe('firma mala: la TV la rechaza (motivo 2), no se reinicia y sigue en la versión 1', e.build === 1 && e.reinicios === 0 && e.programas[0] && e.programas[0].motivo === 2, JSON.stringify(e.programas));
  informe('firma mala: aviso sin términos técnicos y la barra se esconde', /No se pudo actualizar/.test(aviso) && !/firma/i.test(aviso) && !(await visible(pagina, '#barraActualizar')), aviso);
  informe('firma mala: se puede volver a intentar (el botón sigue)', await visible(pagina, '#botonSistemaActualizar'));
  informe('firma mala: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

// ---------- 3. La versión nueva se cae al arrancar: la TV vuelve sola a la anterior y la app lo dice ----------
{
  const { navegador, pagina } = await abrir(semilla(publicar(2, programa(20000))), { antes: conTVLite({ tv: { caerAlArrancar: true } }) });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  await pagina.click('#botonSistemaActualizar');
  await esperarFin(pagina);
  const e = await estadoTV(pagina);
  const aviso = await txt(pagina, '#estadoTexto');
  informe('se cae al arrancar: la TV sigue en la versión 1 y la app dice que se reinició sin terminar', e.build === 1 && e.reinicios === 1 && /reinició sin terminar/.test(aviso), aviso);
  await navegador.close();
}

// ---------- 3b. La versión nueva arranca, la app se reconecta, pero se cae ANTES de confirmarse (como -DPEPITO_LITE_PRUEBA_ROLLBACK):
// la app no debe decir que se actualizó (antes lo decía apenas veía la versión nueva).
{
  const { navegador, pagina } = await abrir(semilla(publicar(2, programa(20000))), { antes: conTVLite({ tv: { caerTardeMs: 6000 } }) });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  await pagina.click('#botonSistemaActualizar');
  await esperarFin(pagina, 90000);
  const e = await estadoTV(pagina);
  const aviso = await txt(pagina, '#estadoTexto');
  const t = await txt(pagina, '#sistemaEstadoActualizar');
  informe('se cae tarde: la TV vuelve a la versión 1 y la app NO dice que se actualizó', e.build === 1 && e.reinicios === 2 && !/se actualizó/.test(t) && /reinició sin terminar/.test(aviso), `${t} | ${aviso} | reinicios ${e.reinicios}`);
  await navegador.close();
}

// ---------- 4. Ocupada (alarma sonando): no empieza y lo dice ----------
{
  const { navegador, pagina } = await abrir(semilla(publicar(2, programa(20000))), { antes: conTVLite({ tv: { ocupada: true } }) });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  await pagina.click('#botonSistemaActualizar');
  await esperarFin(pagina);
  const e = await estadoTV(pagina);
  const aviso = await txt(pagina, '#estadoTexto');
  informe('ocupada: no se manda nada y avisa que está ocupado (texto 50, sin juegos)', e.programas.length === 0 && e.build === 1 && aviso === 'Pepito está ocupado (una alarma). Inténtalo en un momento.', aviso);
  await navegador.close();
}

// ---------- 5. Lite sin actualización por Bluetooth (firmware anterior, ESTADO corto) ----------
{
  const { navegador, pagina } = await abrir(semilla(publicar(2, programa(20000))), { antes: conTVLite({ tv: { build: null } }) });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  const aviso = await txt(pagina, '#estadoTexto');
  informe('Lite anterior: no ofrece actualizar y dice que todavía no lo admite', !(await visible(pagina, '#campoSistemaActualizar')) && /todavía no admite/.test(aviso), aviso);
  await navegador.close();
}

// ---------- 6. Pepito Pro: barra solo visual, no llega a 100 hasta que la TV dice que terminó ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(publicar(2, programa(1000))), { antes: conTVLite({ pro: true }) });
  await esperarPanel(pagina);
  await abrirSistema(pagina);
  await pagina.click('#botonSistemaActualizar');
  await pagina.waitForTimeout(600);
  const tvEscribe = (v) => pagina.evaluate((x) => { globalThis.__fakeDb.raiz.dispositivos.tv1.firmware = x; globalThis.__fakeDb.notificar(); }, v);
  await tvEscribe({ build: 8, estado: 'actualizando', fecha: 2000 });
  await pagina.waitForTimeout(9000);
  const a1 = await ancho(pagina);
  const tPro = await txt(pagina, '#sistemaEstadoActualizar');
  informe('Pro: la barra aparece y avanza sola, lejos del 100 % a los 9 s', (await visible(pagina, '#barraActualizar')) && a1 > 0 && a1 < 40, String(a1));
  informe('Pro: el texto de la Pro (no el de la Lite)', /no desconectes a Pepito/.test(tPro), tPro);
  await tvEscribe({ build: 8, estado: 'reiniciando', fecha: 3000 });
  await pagina.waitForTimeout(300);
  await tvEscribe({ build: 9, estado: 'ok', fecha: 4000 });
  await pagina.waitForTimeout(200);
  const escondido = await pagina.evaluate(() => getComputedStyle(document.getElementById('sistemaEstadoActualizar')).visibility === 'hidden');
  await pagina.waitForTimeout(1200);
  const tFin = await txt(pagina, '#sistemaEstadoActualizar');
  const visibleFin = await pagina.evaluate(() => getComputedStyle(document.getElementById('sistemaEstadoActualizar')).visibility !== 'hidden');
  informe('Pro: al terminar la barra llega a 100 % y RECIÉN entonces se ve "se actualizó"', escondido && visibleFin && (await ancho(pagina)) === 100 && /se actualizó/.test(tFin), `${tFin} | escondido al principio ${escondido}`);
  informe('Pro: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

cerrar();
