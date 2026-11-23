// La app unificada: una TV Pro sigue funcionando EXACTAMENTE como en la Pro (Firebase) y una TV Lite se añade y se usa por
// Bluetooth, en la misma app y la misma cuenta. Base de datos y Bluetooth son falsos (ver banco-unificado.mjs).
import { abrir, cerrar, informe, pant, visible, esperarPanel, escrituras, lecturas, estadoTV, erroresPagina } from './banco-unificado.mjs';

const semilla = (extra = {}) => Object.assign({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
}, extra);

// ---------- 1. Una TV Pro: todo igual que en la Pro ----------
{
  const { navegador, pagina, errores } = await abrir(semilla());
  await esperarPanel(pagina);
  await pagina.waitForTimeout(500);
  informe('TV Pro: arranca directo con lo que tenía la TV (dispositivos/tv1)', (await pagina.inputValue('#texto')) === 'Hola desde TV 1');
  informe('TV Pro: la app NO está en modo TV Lite (juegos y sistema a la vista)', await pagina.evaluate(() => !document.body.classList.contains('tv-lite')));
  await pagina.fill('#texto', 'Mensaje nuevo');
  await pagina.waitForTimeout(300);
  await pagina.click('#enviar');
  await pagina.waitForTimeout(900);
  const esc = await escrituras(pagina);
  informe('TV Pro: enviar escribe en dispositivos/tv1/oled_remota como siempre', esc.some((r) => /dispositivos\/tv1\/oled_remota/.test(r)), esc.join(', ').slice(0, 160));
  const e = await estadoTV(pagina);
  const cargados = await pagina.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name.split('/').pop()));
  informe('TV Pro: ni siquiera se carga la parte Bluetooth (con una TV Pro no corre nada nuevo)', !cargados.includes('lite-tv.js') && !(await pagina.evaluate(() => !!(window.Capacitor))), cargados.filter((n) => /lite|capacitor/i.test(n)).join(', '));
  informe('TV Pro: no se abre ninguna conexión Bluetooth',e.contenidos === 0 && !e.conectado, JSON.stringify({ contenidos: e.contenidos, conectado: e.conectado }));
  informe('TV Pro: sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | '));
  await navegador.close();
}

// ---------- 2. Una cuenta sin TV: "Añade tu TV" ofrece la TV Lite y la vincula por Bluetooth ----------
{
  const { navegador, pagina, errores } = await abrir({ usuarios: { 'uid-ana': {} } }, { esperar: false });
  await pagina.waitForSelector('#pantallaTV:not([hidden])', { timeout: 15000 });
  informe('sin TV: sale "Añade tu TV" con el código de siempre y la pregunta "¿Qué TV tienes?"', (await visible(pagina, '#codigoTV')) && (await visible(pagina, '#elegirTipoTV')));
  informe('la pregunta trae "TV Pro" marcada (el código de siempre) y "TV Lite"', await pagina.evaluate(() => {
    const b = [...document.querySelectorAll('#elegirTipoTV [data-tipo-tv]')];
    return b.length === 2 && b[0].classList.contains('activo') && !b[1].classList.contains('activo');
  }));
  informe('con la pregunta a la vista sobra el botón "Tengo una TV Lite"', !(await visible(pagina, '#botonTVLite')));

  await pagina.click('#elegirTipoTV [data-tipo-tv="lite"]');
  await pagina.waitForSelector('#pantallaConexion:not([hidden])', { timeout: 5000 });
  informe('elegir "TV Lite" abre la pantalla "Conecta tu TV" (la misma de la Lite)', /Conecta tu TV/.test(await pagina.innerText('#pantallaConexion')));

  // La persona empareja en los ajustes del celular y vuelve a la app.
  await pagina.evaluate(() => { window.__vinculados = [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }]; });
  await pagina.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await esperarPanel(pagina);
  informe('al volver con la TV emparejada la app la encuentra sola y sigue con el panel', !(await visible(pagina, '#pantallaTV')) && !(await visible(pagina, '#pantallaConexion')));
  informe('queda en modo TV Lite (sin juegos ni actualizar la TV)', await pagina.evaluate(() => document.body.classList.contains('tv-lite')));
  const guardada = await pagina.evaluate(() => localStorage.getItem('tvretro.tvlite.uid-ana'));
  informe('la TV Lite quedó recordada en esta cuenta', /tv-simulada/.test(String(guardada)), String(guardada));

  const lec = await lecturas(pagina);
  informe('con una TV Lite NUNCA se lee dispositivos/lite:… en Firebase', !lec.some((r) => /lite:/.test(r)), lec.filter((r) => /lite:/.test(r)).join(', '));

  await pagina.fill('#texto', 'Hola Lite');
  await pagina.waitForTimeout(300);
  await pagina.click('#enviar');
  await pagina.waitForFunction(() => window.__tv.contenidos >= 1, null, { timeout: 20000 }).catch(() => {});
  const e = await estadoTV(pagina);
  informe('enviar con una TV Lite llega a la TV por Bluetooth', e.contenidos >= 1, JSON.stringify({ contenidos: e.contenidos }));
  const esc = await escrituras(pagina);
  informe('y no escribe en dispositivos/ de Firebase', !esc.some((r) => /^dispositivos\//.test(r)), esc.join(', ').slice(0, 160));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | '));
  await navegador.close();
}

cerrar();
