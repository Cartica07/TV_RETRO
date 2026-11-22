// Pantalla "Conecta tu TV": sale cuando no hay una TV emparejada (en el navegador se fuerza con ?inicio=1), no estorba si
// la persona la cierra, y al volver de los ajustes de Bluetooth encuentra sola la TV emparejada y se conecta.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const visible = (pagina) => pagina.evaluate(() => { const p = document.getElementById('pantallaConexion'); return !!p && !p.hidden && getComputedStyle(p).display !== 'none'; });
const volverALaApp = (pagina) => pagina.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });

// 1. Sin TV emparejada: la pantalla sale con los pasos y los botones.
{
  const { navegador, pagina, errores } = await abrir({
    ruta: '/index.html?sincuentas=1&inicio=1',
    antes: (p) => p.addInitScript(() => { window.__vinculadosPrueba = () => []; }),
    esperar: false,
  });
  await pagina.waitForSelector('#pantallaConexion:not([hidden])', { timeout: 15000 });
  informe('sin TV emparejada sale la pantalla "Conecta tu TV"', await visible(pagina));
  const texto = await pagina.evaluate(() => document.getElementById('pantallaConexion').innerText);
  informe('muestra los tres pasos y el botón "Abrir Bluetooth"', /Conecta tu TV/.test(texto) && /PIN/.test(texto) && /Abrir Bluetooth/.test(texto), texto.replace(/\s+/g, ' ').slice(0, 120));

  // 2. "Ahora no" la cierra y no vuelve a salir al volver a la app mientras no haya TV.
  await pagina.click('#botonAhoraNo');
  informe('"Ahora no" la cierra', !(await visible(pagina)));
  await volverALaApp(pagina);
  await pagina.waitForTimeout(500);
  informe('después de "Ahora no" no vuelve a salir', !(await visible(pagina)));
  informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
  await navegador.close();
}

// 3. La persona empareja en los ajustes y vuelve: la app encuentra la TV y se conecta sola; la pantalla se cierra.
{
  const { navegador, pagina, errores } = await abrir({
    ruta: '/index.html?sincuentas=1&inicio=1',
    antes: (p) => p.addInitScript(() => { window.__vinculadosPrueba = () => (window.__yaEmparejada ? [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }] : []); }),
    esperar: false,
  });
  await pagina.waitForSelector('#pantallaConexion:not([hidden])', { timeout: 15000 });
  informe('(sin emparejar) la pantalla está a la vista', await visible(pagina));
  await pagina.evaluate(() => { window.__yaEmparejada = true; });
  await volverALaApp(pagina);
  await pagina.waitForFunction(() => document.getElementById('pantallaConexion').hidden, null, { timeout: 15000 });
  informe('al volver con la TV emparejada la pantalla se cierra sola', !(await visible(pagina)));
  // (En la web el plugin solo conecta con TV que eligió en su lista, así que aquí se comprueba que la app recordó la TV
  // emparejada para reconectar; la conexión real con una TV emparejada se prueba en el celular.)
  const guardada = await pagina.evaluate(() => localStorage.getItem('tvretro.lite.tv'));
  informe('la app recordó la TV emparejada para conectarse con ella', guardada === 'tv-simulada', String(guardada));
  informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
  await navegador.close();
}

// 4. Ya emparejada desde antes: no sale la pantalla.
{
  const { navegador, pagina, errores } = await abrir({
    ruta: '/index.html?sincuentas=1&inicio=1',
    antes: (p) => p.addInitScript(() => { window.__vinculadosPrueba = () => [{ deviceId: 'tv-simulada', name: 'TV RETRO Lite' }]; }),
    esperar: false,
  });
  await pagina.waitForTimeout(2500);
  informe('con una TV ya emparejada la pantalla no sale', !(await visible(pagina)));
  informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
  await navegador.close();
}

// 5. Sin la bandera (navegador normal) la pantalla nunca sale.
{
  const { navegador, pagina } = await abrir({ esperar: false });
  await pagina.waitForTimeout(1500);
  informe('en el navegador (sin ?inicio=1) la pantalla no sale', !(await visible(pagina)));
  await navegador.close();
}
cerrar();
