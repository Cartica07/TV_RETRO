// Primera pantalla "¿Qué TV tienes?" y la TV Lite SIN cuenta: con "TV Pro" sale el inicio de sesión de la Pro; con "TV Lite" la app
// entra con una sesión anónima e invisible, abre sola "Conecta tu TV", usa la galería predeterminada de la nube y guarda lo propio
// en el celular. Firebase y Bluetooth falsos (banco-unificado.mjs).
import { abrir, cerrar, informe, visible, esperarPanel, escrituras, erroresPagina } from './banco-unificado.mjs';

const semilla = () => ({
  biblioteca: {
    imagenes: { fotoBib: { datos: '00', ancho: 128, alto: 64, meta: {} } },
    imagenes_indice: { fotoBib: { datos: '00', ancho: 128, alto: 64 } },
  },
});
const oculto = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !e || e.hidden || getComputedStyle(e).display === 'none'; }, sel);
const nuevaVez = { logueado: false, esperar: false };

// ---------- 1. Celular nuevo: la primera pantalla pregunta; "TV Pro" lleva al inicio de sesión de siempre ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(), nuevaVez);
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  informe('celular nuevo: la primera pantalla es "¿Qué Pepito tienes?" con Pepito Pro y Pepito Lite',
    /¿Qué Pepito tienes\?/.test(await pagina.innerText('#pantallaInicioTipo')) && (await visible(pagina, '#botonInicioPro')) && (await visible(pagina, '#botonInicioLite')));
  await pagina.click('#botonInicioPro');
  await pagina.waitForTimeout(400);
  informe('"TV Pro" lleva al inicio de sesión de la Pro (sin cambios)', (await oculto(pagina, '#pantallaInicioTipo')) && (await visible(pagina, '#pantallaLogin')));
  informe('la respuesta queda guardada en el celular', (await pagina.evaluate(() => localStorage.getItem('tvretro.tipoApp'))) === 'pro');
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 2. "TV Lite" con el acceso sin cuenta apagado en Firebase: aviso claro y se puede volver a elegir ----------
{
  const { navegador, pagina } = await abrir(semilla(), nuevaVez);
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.evaluate(() => { globalThis.__fakeAuth.fallar = 'auth/operation-not-allowed'; });
  await pagina.click('#botonInicioLite');
  await pagina.waitForSelector('#inicioTipoError:not([hidden])', { timeout: 5000 });
  const aviso = await pagina.innerText('#inicioTipoError');
  informe('sin el acceso sin cuenta activado: aviso claro, sin términos técnicos', /no se puede usar Pepito Lite/i.test(aviso) && !/auth\/|operation/i.test(aviso), aviso);
  informe('y la pregunta sigue ahí con los dos botones usables (no queda una pantalla en blanco)',
    (await visible(pagina, '#pantallaInicioTipo')) && !(await pagina.evaluate(() => document.getElementById('botonInicioLite').disabled)));
  informe('no queda guardada la elección "TV Lite"', !(await pagina.evaluate(() => localStorage.getItem('tvretro.tipoApp'))));
  await navegador.close();
}

// ---------- 3. "TV Lite": sin cuenta, "Conecta tu TV" se abre sola y la TV se añade al volver de los ajustes ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(), nuevaVez);
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.click('#botonInicioLite');
  await pagina.waitForSelector('#pantallaConexion:not([hidden])', { timeout: 15000 });
  informe('"TV Lite": no pide cuenta y abre sola "Conecta tu TV"', (await oculto(pagina, '#pantallaLogin')) && (await oculto(pagina, '#pantallaInicioTipo')));

  await pagina.evaluate(() => { window.__vinculados = [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }]; });
  await pagina.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await esperarPanel(pagina);
  await pagina.waitForTimeout(500);
  informe('al volver con la TV emparejada queda el panel en modo TV Lite', await pagina.evaluate(() => document.body.classList.contains('tv-lite') && document.body.classList.contains('sin-cuenta')));
  informe('la TV Lite queda recordada en el celular (no en una cuenta)', /tv-simulada/.test(String(await pagina.evaluate(() => localStorage.getItem('tvretro.tvlite.local')))));
  informe('no se ve nada de la cuenta (Mi cuenta, cerrar sesión, tutorial)',
    (await oculto(pagina, '[data-config="cuenta"]')) && (await oculto(pagina, '#botonCerrarSesion')) && (await oculto(pagina, '#tutorial')));
  informe('en Mis Pepitos, "Cerrar sesión" pasa a ser "Tengo un Pepito Pro"', (await pagina.evaluate(() => document.getElementById('botonTVSalir').textContent.trim())) === 'Tengo un Pepito Pro');

  // ---------- 4. Galería: lo predeterminado viene de la nube y lo propio se guarda en el celular ----------
  const g = await pagina.evaluate(async () => {
    const m = await import('/js/firebase.js');
    const guardado = await m.guardarImagenCatalogo('mia', 'AA', 128, 64, null, {});
    const lista = await new Promise((r) => { const baja = m.suscribirImagenes((v) => { if (v && v.mia && v.fotoBib) { baja(); r(Object.keys(v)); } }); });
    const borrado = await m.borrarImagenCatalogo('mia');
    return { guardado, lista, borrado };
  });
  informe('la galería muestra lo predeterminado de la nube y lo guardado en el celular', g.lista.includes('fotoBib') && g.lista.includes('mia'), JSON.stringify(g.lista));
  informe('guardar y borrar lo propio funciona sin cuenta', g.guardado.exito && g.borrado.exito, JSON.stringify({ g: g.guardado, b: g.borrado }));
  const esc = await escrituras(pagina);
  informe('y no escribe nada en la nube (usuarios/ ni biblioteca/)', !esc.some((x) => /^(usuarios|biblioteca)\//.test(x)), esc.join(', ').slice(0, 160));

  // ---------- 5. Al volver a abrir la app no pregunta de nuevo ----------
  await pagina.reload();
  await esperarPanel(pagina);
  await pagina.waitForTimeout(500);
  informe('al reabrir la app entra directo en la TV Lite, sin preguntar ni pedir cuenta',
    (await oculto(pagina, '#pantallaInicioTipo')) && (await oculto(pagina, '#pantallaLogin')) && (await pagina.evaluate(() => document.body.classList.contains('tv-lite'))));

  // ---------- 6. "Tengo una TV Pro" vuelve a la primera pantalla ----------
  await pagina.evaluate(() => document.getElementById('botonMiTV').click());
  await pagina.waitForSelector('#pantallaTV:not([hidden])');
  await pagina.click('#botonTVSalir');
  await pagina.waitForLoadState('load');
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  informe('"Tengo una TV Pro" vuelve a la pregunta "¿Qué TV tienes?"', await visible(pagina, '#pantallaInicioTipo'));
  informe('sin errores en la página en todo el recorrido', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 250));
  await navegador.close();
}

// ---------- 7. Celular nuevo de verdad (sin dar el tutorial por visto): con la TV Lite sale el tutorial, a la vista ----------
// Decisión del dueño (2026-11-23): la TV Lite también tiene tutorial, con el paso de "Más" sin los juegos. (Antes, el 2026-11-23, se
// abría OCULTO y dejaba la página sin scroll: aquí se comprueba que se ve y que al cerrarlo la página vuelve a bajar.)
{
  const { navegador, pagina, errores } = await abrir(semilla(), { ...nuevaVez, conTutorial: true, vinculados: [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }] });
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.click('#botonInicioLite');
  await esperarPanel(pagina);
  await pagina.waitForSelector('#tutorial:not([hidden])', { timeout: 10000 }).catch(() => {});
  informe('celular nuevo con TV Lite: el tutorial se abre y se VE (no oculto)', (await visible(pagina, '#tutorial')) && (await visible(pagina, '#tutorialTarjeta')));
  informe('no se abre encima de "Conecta tu TV"', await oculto(pagina, '#pantallaConexion'));
  // Se avanza hasta el paso de "Más".
  let textoMas = '';
  for (let i = 0; i < 10 && !textoMas; i++) {
    const t = await pagina.innerText('#tutorialTexto');
    if (/galería/i.test(t)) textoMas = t;
    else await pagina.click('#tutorialSiguiente');
    await pagina.waitForTimeout(250);
  }
  informe('con TV Lite, el paso de "Más" no nombra los juegos', /galería/i.test(textoMas) && !/juegos/i.test(textoMas), textoMas);
  await pagina.click('#tutorialSaltar');
  await pagina.waitForTimeout(400);
  const t = await pagina.evaluate(() => ({
    abierto: document.body.classList.contains('tutorial-abierto'),
    overflow: getComputedStyle(document.body).overflowY,
    visto: localStorage.getItem('tvretro.tutorial.uid-anonimo'),
  }));
  informe('al cerrarlo queda visto y la página vuelve a poder bajar', !t.abierto && t.visto === '1' && t.overflow !== 'hidden', JSON.stringify(t));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 8. Una sola vez por celular: si ya se vio con la TV Pro (otra cuenta), con la TV Lite no vuelve a salir ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(), {
    ...nuevaVez, conTutorial: true, vinculados: [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }],
    antes: (p) => p.addInitScript(() => { if (!sessionStorage.getItem('__ya')) { sessionStorage.setItem('__ya', '1'); localStorage.setItem('tvretro.tutorial.uid-ana', '1'); } }),
  });
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.click('#botonInicioLite');
  await esperarPanel(pagina);
  await pagina.waitForTimeout(3000);
  const t = await pagina.evaluate(() => ({ abierto: document.body.classList.contains('tutorial-abierto'), visto: localStorage.getItem('tvretro.tutorial.uid-anonimo') }));
  informe('visto antes con la TV Pro: con la TV Lite no vuelve a salir', !t.abierto && t.visto === '1', JSON.stringify(t));
  informe('y "Ver tutorial" sigue en Ayuda y contacto', await pagina.evaluate(() => { const b = document.getElementById('botonVerTutorial'); return !!b && getComputedStyle(b).display !== 'none'; }));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 9. Y al revés: visto con la TV Lite, al entrar con una cuenta (TV Pro) tampoco sale ----------
{
  const { navegador, pagina, errores } = await abrir({ dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: { tipo: 'texto', texto: 'Hola' } } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } }, {
    conTutorial: true,
    antes: (p) => p.addInitScript(() => { localStorage.setItem('tvretro.tipoApp', 'pro'); localStorage.setItem('tvretro.tutorial.uid-anonimo', '1'); }),
  });
  await esperarPanel(pagina);
  await pagina.waitForTimeout(3000);
  const abierto = await pagina.evaluate(() => document.body.classList.contains('tutorial-abierto'));
  informe('visto antes con la TV Lite: con la cuenta y la TV Pro no vuelve a salir', !abierto);
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

cerrar();
