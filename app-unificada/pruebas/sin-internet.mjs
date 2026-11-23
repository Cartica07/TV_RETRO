// Una TV Lite va por Bluetooth: sin internet la app tiene que abrir y dejar usarla (solo falta lo que viene de la nube). Con una TV
// Pro y sin internet, el mismo aviso de la Pro. "Sin internet" = navigator.onLine falso y TODA lectura de Firebase colgada (así se
// comporta Firebase real sin red). Firebase y Bluetooth falsos (banco-unificado.mjs).
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  musicales: { indice: { cancion1: { nombre: 'Canción 1' } } },
});

// Lo que pasa en el celular sin red: el navegador lo sabe (onLine falso) y Firebase no contesta nunca.
const sinInternet = (p) => p.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
  const colgar = {};
  for (const r of ['usuarios', 'dispositivos', 'administradores', 'musicales', 'biblioteca', 'invitaciones', 'firmware']) colgar[r] = 600000;
  globalThis.__retrasosIniciales = colgar;
});

// Cuánto tarda el panel en quedar libre y qué dice la línea de estado.
const medirArranque = async (pagina, desde) => {
  await pagina.waitForFunction(() => !document.querySelector('main.controles').inert, null, { timeout: 20000 });
  return { ms: Date.now() - desde, estado: (await pagina.innerText('#estadoTexto').catch(() => '')).trim() };
};

// ---------- 1. TV Lite SIN cuenta: se añadió con internet; luego se abre la app sin internet ----------
{
  const { navegador, pagina, errores } = await abrir({}, { logueado: false, esperar: false, vinculados: [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }] });
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.click('#botonInicioLite');
  await esperarPanel(pagina);
  informe('preparación: TV Lite sin cuenta añadida con internet', await pagina.evaluate(() => document.body.classList.contains('tv-lite')));

  await sinInternet(pagina);
  const desde = Date.now();
  await pagina.reload();
  const a = await medirArranque(pagina, desde);
  informe('sin internet, la app abre enseguida en la TV Lite (sin esperar a la nube)', a.ms < 6000 && await pagina.evaluate(() => document.body.classList.contains('tv-lite')), JSON.stringify(a));
  informe('no dice "sin conexión" ni "la conexión está lenta" (la TV va por Bluetooth)', !/sin conexión|lenta/i.test(a.estado), a.estado);
  informe('no queda la pantalla de Mis TV ni el inicio de sesión encima',
    await pagina.evaluate(() => document.getElementById('pantallaTV').hidden && document.getElementById('pantallaLogin').hidden));

  // Se puede enviar un texto a la TV (por Bluetooth).
  await pagina.fill('#texto', 'Sin internet');
  await pagina.click('#enviar');
  const llego = await pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 }).then(() => true, () => false);
  informe('y un texto llega a la TV por Bluetooth', llego, await pagina.innerText('#estadoTexto'));

  // Canciones: vienen de la nube; sin internet lo dice (sin quedarse cargando).
  const aviso = await pagina.evaluate(() => document.getElementById('avisoCancion').textContent);
  informe('las canciones (de la nube) dicen que no se pudo leer la lista, sin quedarse cargando', /no se pudo leer/i.test(aviso), aviso);
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 2. Con cuenta y una TV Lite elegida, sin internet ----------
{
  const conTVLite = (p) => p.addInitScript(() => {
    localStorage.setItem('tvretro.tipoApp', 'pro');
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
  });
  const desde = Date.now();
  const { navegador, pagina, errores } = await abrir(semilla(), { esperar: false, antes: async (p) => { await conTVLite(p); await sinInternet(p); } });
  const a = await medirArranque(pagina, desde);
  informe('con cuenta y una TV Lite: sin internet abre enseguida en la TV Lite', a.ms < 8000 && await pagina.evaluate(() => document.body.classList.contains('tv-lite')), JSON.stringify(a));
  informe('sin el aviso "sin conexión" ni "lenta"', !/sin conexión|lenta/i.test(a.estado), a.estado);
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 3. Con cuenta y SOLO una TV Pro, sin internet: el mismo aviso que la Pro ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(), { esperar: false, antes: async (p) => {
    await p.addInitScript(() => localStorage.setItem('tvretro.tipoApp', 'pro'));
    await sinInternet(p);
  } });
  await pagina.waitForSelector('#pantallaTV:not([hidden])', { timeout: 15000 });
  const texto = await pagina.innerText('#pantallaTV');
  informe('solo TV Pro sin internet: el aviso de la Pro "Sin conexión a internet. Conéctate y pulsa Reintentar."', /Sin conexión a internet\. Conéctate y pulsa Reintentar\./.test(texto), texto.slice(0, 160));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

cerrar();
