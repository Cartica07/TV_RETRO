// Más > Caras de reloj (src/caras.js; plan en docs/plan-caras-de-reloj.md): elegir una cara del catálogo y enviarla a una TV Pro
// (dispositivos/{id}/reloj + orden "ajustes") y a una TV Lite (Bluetooth, bit 4; la Cara 1 con 0x24). Firebase y Bluetooth falsos.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrir, cerrar, informe, pant, visible, esperarPanel, estadoTV, erroresPagina } from './banco-unificado.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { armarReceta, TIPO } = await import(pathToFileURL(path.join(aqui, '..', 'www', 'js', 'cara.js')).href);

const CARA2 = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [64, 10, 0, 1, 5, 1, 0] }, { tipo: TIPO.FECHA, datos: [64, 50, 0, 0, 1, 1, 2] }] });
const CARA3 = armarReceta({ elementos: [{ tipo: TIPO.AGUJAS, datos: [64, 32, 0, 30, 2] }] });
const CARA4 = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [64, 20, 0, 0, 3, 1, 0] }, { tipo: TIPO.CLIMA, datos: [126, 54, 0, 0, 1, 2, 1] }] });
const b64 = (u) => Buffer.from(u).toString('base64');

const semilla = (build = 11) => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') }, firmware: { build, estado: 'ok', fecha: 1000 } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  relojes: {
    indice: { cara3: { nombre: 'Agujas', orden: 2, fecha: 1 }, cara2: { nombre: 'Cara 2', orden: 1, fecha: 1 }, cara4: { nombre: 'Con clima', orden: 3, fecha: 1 } },
    datos: { cara2: b64(CARA2), cara3: b64(CARA3), cara4: b64(CARA4) },
  },
});

const conTVLite = (tv = {}) => (p) => p.addInitScript((op) => {
  if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
  }
  Object.assign(window.__tv, op);
}, tv);

const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const vistaPrevia = (p) => p.evaluate(() => document.getElementById('caraVista').toDataURL());
async function abrirCaras(p, conectarLite = false) {
  if (conectarLite) { // el Bluetooth falso del navegador conoce la TV después del primer Enviar
    await p.click('#enviar');
    await p.waitForFunction(() => /camino|En la TV|Pepito|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
  }
  await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200);
  await p.click('#grupoMas button[data-mas="caras"]');
  await p.waitForFunction(() => document.querySelectorAll('#caraLista option').length > 1 || !document.getElementById('caraAviso').hidden, null, { timeout: 15000 });
  await p.waitForTimeout(400);
}
const enviarYEsperar = async (p) => {
  await p.click('#botonEnviarCara');
  await p.waitForFunction(() => { const a = document.getElementById('caraAviso'); return !a.hidden && !/Enviando/.test(a.textContent); }, null, { timeout: 20000 });
  return txt(p, '#caraAviso');
};

// ---------- 1. Pepito Pro (v11) ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(11));
  await esperarPanel(pagina);
  await abrirCaras(pagina);
  informe('Pro: la pantalla Caras de reloj se ve con su título', await visible(pagina, '#seccionCaras') && (await txt(pagina, '#tituloMas')) === 'Caras de reloj');
  const opciones = await pagina.$$eval('#caraLista option', (os) => os.map((o) => o.textContent));
  informe('Pro: la lista es Cara 1 + el catálogo en el orden del dueño', JSON.stringify(opciones) === JSON.stringify(['Cara 1', 'Cara 2', 'Agujas', 'Con clima']), opciones.join(', '));
  informe('Pro: sin aviso de actualizar (v11)', !(await visible(pagina, '#caraAviso')));
  const v1 = await vistaPrevia(pagina);
  await pagina.selectOption('#caraLista', 'cara2'); await pagina.waitForTimeout(500);
  informe('Pro: al elegir otra cara cambia la vista previa', (await vistaPrevia(pagina)) !== v1);
  const aviso = await enviarYEsperar(pagina);
  const raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  const reloj = raiz.dispositivos.tv1.reloj;
  informe('Pro: guarda la cara en dispositivos/tv1/reloj (clave y receta)', reloj && reloj.clave === 'cara2' && reloj.datos === b64(CARA2), JSON.stringify(reloj).slice(0, 80));
  informe('Pro: le manda a la TV la orden "ajustes" y dice que listo', raiz.dispositivos.tv1.oled_remota.pantalla.tipo === 'ajustes' && aviso === 'Listo ✅', aviso);
  await pagina.selectOption('#caraLista', ''); await pagina.waitForTimeout(300);
  await enviarYEsperar(pagina);
  const raiz2 = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  informe('Pro: elegir la Cara 1 borra la cara guardada', !raiz2.dispositivos.tv1.reloj);
  // Al volver a abrir, la lista marca la que tiene la TV.
  await pagina.selectOption('#caraLista', 'cara3'); await pagina.waitForTimeout(300);
  await enviarYEsperar(pagina);
  await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(300);
  await pagina.click('#grupoMas button[data-mas="caras"]'); await pagina.waitForTimeout(1500);
  informe('Pro: al volver a la pantalla, la lista marca la cara que tiene la TV', (await pagina.$eval('#caraLista', (s) => s.value)) === 'cara3');
  // Cambiar la lista justo después de tocar Enviar: el ✅ no sale con otra cara elegida (2026-11-24).
  await pagina.selectOption('#caraLista', 'cara2'); await pagina.waitForTimeout(300);
  await pagina.click('#botonEnviarCara');
  await pagina.selectOption('#caraLista', 'cara3');
  await pagina.waitForTimeout(1500);
  informe('Pro: cambiar la lista durante el envío no deja el ✅ de otra cara', !/✅/.test(await txt(pagina, '#caraAviso')), await txt(pagina, '#caraAviso'));
  // Sin señal: a los 15 s avisa que la conexión está lenta y suelta el botón; al volver la señal termina sola (2026-11-24).
  await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
  await pagina.click('#botonEnviarCara');
  await pagina.waitForTimeout(16000);
  const lento = { aviso: await txt(pagina, '#caraAviso'), libre: !(await pagina.$eval('#botonEnviarCara', (b) => b.disabled)) };
  await pagina.evaluate(() => globalThis.__fakeDb.soltar());
  await pagina.waitForTimeout(1500);
  const alFinal = await txt(pagina, '#caraAviso');
  informe('Pro: sin señal avisa "Conexión lenta…", suelta el botón y al volver la señal dice que listo',
    lento.aviso === 'Conexión lenta: se enviará cuando vuelva la señal.' && lento.libre && alFinal === 'Listo ✅',
    JSON.stringify({ lento, alFinal }));
  // ---- Ciudad para el clima (opción A): solo con una cara que muestra el clima ----
  const GEO = 'https://geocoding-api.open-meteo.com/**';
  const geoBien = (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [
    { name: 'Armenia', admin1: 'Quindío', country: 'Colombia', latitude: 4.53389, longitude: -75.68111 },
    { name: 'Armenia', admin1: 'Armenia', country: 'Armenia', latitude: 40.0, longitude: 45.0 },
  ] }) });
  await pagina.route(GEO, geoBien);
  informe('Ciudad: con una cara sin clima no se ve la fila', !(await visible(pagina, '#campoCiudad')));
  await pagina.selectOption('#caraLista', 'cara4'); await pagina.waitForTimeout(600);
  informe('Ciudad: con la cara "Con clima" se ve la fila y dice "Sin clima"', (await visible(pagina, '#campoCiudad')) && (await pagina.$eval('#ciudadSelect', (s) => s.options[0].textContent)) === 'Sin clima');
  // Sin internet el buscador lo dice (antes decía "No encontramos esa ciudad.").
  await pagina.unroute(GEO);
  await pagina.route(GEO, (r) => r.abort());
  await pagina.click('.selector:has(#ciudadSelect)');
  await pagina.fill('#ciudadTexto', 'Bogotá');
  await pagina.waitForFunction(() => !document.getElementById('ciudadVacio').hidden, null, { timeout: 10000 });
  informe('Ciudad: sin internet el buscador dice "Sin conexión a internet. Conéctate y vuelve a buscar."', (await txt(pagina, '#ciudadVacio')) === 'Sin conexión a internet. Conéctate y vuelve a buscar.', await txt(pagina, '#ciudadVacio'));
  await pagina.click('#ciudadCerrar');
  await pagina.unroute(GEO);
  await pagina.route(GEO, geoBien);
  await pagina.click('.selector:has(#ciudadSelect)');
  await pagina.fill('#ciudadTexto', 'Armenia');
  await pagina.waitForFunction(() => document.querySelectorAll('#ciudadLista button').length === 3, null, { timeout: 10000 });
  await pagina.click('#ciudadLista button[data-i="0"]');
  await pagina.waitForFunction(() => document.getElementById('ciudadSelect').options[0].textContent.startsWith('Armenia'), null, { timeout: 10000 });
  const rc = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  const c = rc.dispositivos.tv1.ajustes && rc.dispositivos.tv1.ajustes.ciudad;
  informe('Ciudad: se guarda en ajustes.ciudad (nombre, lat, lon) con la orden "ajustes"', c && c.nombre === 'Armenia, Quindío, Colombia' && c.lat === 4.5339 && c.lon === -75.6811 && rc.dispositivos.tv1.oled_remota.pantalla.tipo === 'ajustes', JSON.stringify(c));
  // Guardar los Ajustes de Pepito no borra la ciudad.
  await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(300);
  await pagina.click('#grupoMas button[data-mas="config"]'); await pagina.waitForTimeout(300);
  await pagina.click('#grupoConfig button[data-config="tv"]'); await pagina.waitForTimeout(1200);
  await pagina.click('#botonGuardarAjustes');
  await pagina.waitForTimeout(1500);
  const rc2 = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  informe('Ciudad: guardar los Ajustes de Pepito la conserva', rc2.dispositivos.tv1.ajustes.ciudad && rc2.dispositivos.tv1.ajustes.ciudad.nombre === 'Armenia, Quindío, Colombia', JSON.stringify(rc2.dispositivos.tv1.ajustes));
  // Otro celular cambia la ciudad con Ajustes abierto: guardar no la pisa con la vieja (2026-11-24).
  await pagina.evaluate(() => { globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes.ciudad = { nombre: 'Bogotá, Colombia', lat: 4.6097, lon: -74.0817 }; });
  await pagina.click('#botonGuardarAjustes');
  await pagina.waitForTimeout(1500);
  const rc3 = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('Ciudad: guardar Ajustes no pisa la ciudad que otro celular cambió mientras tanto', rc3.ciudad && rc3.ciudad.nombre === 'Bogotá, Colombia' && rc3.apagado === 5, JSON.stringify(rc3));
  informe('Pro: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

// ---------- 2. Pepito Pro con firmware viejo (v10) ----------
{
  const { navegador, pagina } = await abrir(semilla(10));
  await esperarPanel(pagina);
  await abrirCaras(pagina);
  informe('Pro v10: no muestra aviso (dueño, 2026-11-25) y no deja enviar',
    !/Actualiza/.test(await txt(pagina, '#caraAviso')) && (await pagina.$eval('#botonEnviarCara', (b) => b.disabled)));
  await navegador.close();
}

// ---------- 3. Pepito Lite ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(11), { antes: conTVLite({ build: 4 }) });
  await esperarPanel(pagina);
  await abrirCaras(pagina, true);
  informe('Lite: la lista es la misma (catálogo de la nube) y sin aviso', (await pagina.$$eval('#caraLista option', (os) => os.length)) === 4 && !(await visible(pagina, '#caraAviso')));
  await pagina.selectOption('#caraLista', 'cara4'); await pagina.waitForTimeout(500);
  informe('Lite: con una cara con clima NO sale la ciudad (la Lite no tiene internet)', !(await visible(pagina, '#campoCiudad')));
  await pagina.selectOption('#caraLista', 'cara2'); await pagina.waitForTimeout(400);
  const aviso = await enviarYEsperar(pagina);
  let e = await estadoTV(pagina);
  informe('Lite: la cara llega por Bluetooth tal cual (bit 4)', aviso === 'Listo ✅' && e.cara && Buffer.from(e.cara).equals(Buffer.from(CARA2)), aviso);
  await pagina.selectOption('#caraLista', ''); await pagina.waitForTimeout(300);
  await enviarYEsperar(pagina);
  e = await estadoTV(pagina);
  informe('Lite: la Cara 1 se pide con 0x24 (la TV borra la suya)', e.cara === null && e.caras === 2);
  informe('Lite: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

// ---------- 3b. Pepito Lite con actualización pero sin caras (versiones 1 a 3) ----------
{
  const { navegador, pagina } = await abrir(semilla(11), { antes: conTVLite({ build: 3 }) });
  await esperarPanel(pagina);
  await abrirCaras(pagina, true);
  informe('Lite v3 (sin caras): no muestra aviso y no deja enviar', !/Actualiza/.test(await txt(pagina, '#caraAviso')) && (await pagina.$eval('#botonEnviarCara', (b) => b.disabled)));
  await navegador.close();
}

// ---------- 4. Pepito Lite sin caras (firmware anterior, ESTADO corto) ----------
{
  const { navegador, pagina } = await abrir(semilla(11), { antes: conTVLite({ build: null }) });
  await esperarPanel(pagina);
  await abrirCaras(pagina, true);
  informe('Lite anterior: no muestra aviso', !/Actualiza/.test(await txt(pagina, '#caraAviso')));
  await navegador.close();
}

cerrar();
