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
  informe('celular nuevo: la primera pantalla es "¿Qué TV tienes?" con TV Pro y TV Lite',
    /¿Qué TV tienes\?/.test(await pagina.innerText('#pantallaInicioTipo')) && (await visible(pagina, '#botonInicioPro')) && (await visible(pagina, '#botonInicioLite')));
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
  informe('sin el acceso sin cuenta activado: aviso claro, sin términos técnicos', /no se puede usar la TV Lite/i.test(aviso) && !/auth\/|operation/i.test(aviso), aviso);
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
  informe('en Mis TV, "Cerrar sesión" pasa a ser "Tengo una TV Pro"', (await pagina.evaluate(() => document.getElementById('botonTVSalir').textContent.trim())) === 'Tengo una TV Pro');

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

cerrar();
