// Apagado automático de la pantalla (2026-11-23): "Apagar pantalla" en Más > Config > Ajustes de Pepito. Con Pepito Pro se guarda
// en dispositivos/{id}/ajustes.apagado; con Pepito Lite llega a la TV como 6.º byte de 0x22. Firebase y Bluetooth falsos.
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina, visible, estadoTV } from './banco-unificado.mjs';

const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
});

const abrirAjustes = async (p) => {
  await p.click('#grupoTipo button[data-valor="galeria"]');
  await p.click('#grupoMas button[data-mas="config"]');
  await p.click('#grupoConfig button[data-config="tv"]');
  await p.waitForSelector('#configTV', { state: 'visible' });
  await p.waitForFunction(() => !document.getElementById('botonGuardarAjustes').disabled, null, { timeout: 10000 });
};
const elegir = async (p, texto) => {
  await p.click('#ajusteApagado', { force: true }); // la lista se abre en la ventanita de la app
  await p.click(`#buscadorLista button >> text=${texto}`);
  await p.waitForTimeout(150);
};
const guardar = async (p) => {
  await p.click('#botonGuardarAjustes');
  await p.waitForFunction(() => /camino|✅|guardad/i.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 }).catch(() => {});
};

// ---------- 1. Pepito Pro: se guarda en Firebase ----------
{
  const { navegador, pagina, errores } = await abrir(semilla());
  await esperarPanel(pagina);
  await abrirAjustes(pagina);
  informe('Ajustes de Pepito: está "Apagar pantalla" y viene en "A los 5 min"', (await visible(pagina, '#ajusteApagado')) && (await pagina.inputValue('#ajusteApagado')) === '5');
  const AVISO = 'La pantalla quedará siempre encendida: gasta mucha más batería.';
  await pagina.click('#ajusteApagado', { force: true });
  await pagina.waitForTimeout(150);
  const nota = await pagina.evaluate(() => Array.from(document.querySelectorAll('#buscadorLista button')).map((b) => ({ t: b.firstChild.textContent, n: (b.querySelector('.buscador-nota') || {}).textContent || '' })));
  informe('en la ventanita, el aviso dictado por el dueño va debajo de "Nunca" (y solo ahí)',
    nota.length === 6 && nota.map((x) => x.t).join('|') === 'Al minuto|A los 2 min|A los 5 min|A los 10 min|A los 20 min|Nunca' && nota[5].n === AVISO && nota.slice(0, 5).every((x) => !x.n), JSON.stringify(nota));
  await pagina.click('#buscadorLista button >> text=Nunca');
  await pagina.waitForTimeout(150);
  const estado = await pagina.innerText('#estadoTexto');
  informe('al elegir "Nunca" el aviso sale también en la línea de estado', estado.trim() === AVISO, estado);
  await guardar(pagina);
  let guardado = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('con Pepito Pro se guarda apagado = 0 junto con brillo, volumen y zona', guardado && guardado.apagado === 0 && guardado.brillo !== undefined && guardado.zona !== undefined, JSON.stringify(guardado));

  await elegir(pagina, 'A los 20 min');
  await guardar(pagina);
  guardado = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('y se guarda 20', guardado && guardado.apagado === 20, JSON.stringify(guardado));

  // 1 y 2 minutos (2026-11-25): la copia de la Pro solo aceptaba 0, 5, 10 y 20 y los habría vuelto 5.
  await elegir(pagina, 'Al minuto');
  await guardar(pagina);
  guardado = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('"Al minuto" se guarda como 1', guardado && guardado.apagado === 1, JSON.stringify(guardado));
  await elegir(pagina, 'A los 2 min');
  await guardar(pagina);
  guardado = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('"A los 2 min" se guarda como 2', guardado && guardado.apagado === 2, JSON.stringify(guardado));

  // Sin clima (2026-11-25): una ciudad que haya quedado guardada de antes se borra al guardar (las reglas ya no la aceptan).
  await pagina.evaluate(() => { globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes.ciudad = { nombre: 'Armenia, Quindío, Colombia', lat: 4.5339, lon: -75.6811 }; });
  await guardar(pagina);
  guardado = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.ajustes);
  informe('sin clima: una ciudad vieja se borra al guardar y el apagado sigue en 2', guardado && guardado.ciudad === undefined && guardado.apagado === 2, JSON.stringify(guardado));
  await elegir(pagina, 'A los 20 min');
  await guardar(pagina);

  // Al volver a abrir Ajustes se lee lo guardado.
  await pagina.click('#grupoTipo button[data-valor="texto"]');
  await abrirAjustes(pagina);
  informe('al volver a abrir Ajustes muestra lo guardado (20)', (await pagina.inputValue('#ajusteApagado')) === '20');
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 2. Pepito Lite: llega a la TV por Bluetooth ----------
{
  const conTVLite = (p) => p.addInitScript(() => {
    if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
      localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
      localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
    }
  });
  const { navegador, pagina, errores } = await abrir(semilla(), { antes: conTVLite });
  await esperarPanel(pagina);
  await abrirAjustes(pagina);
  informe('Pepito Lite: también está "Apagar pantalla" (5 min)', (await pagina.inputValue('#ajusteApagado')) === '5');
  await elegir(pagina, 'A los 10 min');
  await guardar(pagina);
  await pagina.waitForFunction(() => window.__tv.estado().ajustes, null, { timeout: 10000 }).catch(() => {});
  const e = await estadoTV(pagina);
  informe('a Pepito Lite le llega apagado = 10 (6.º byte de los ajustes)', e.ajustes && e.ajustes.apagado === 10, JSON.stringify(e.ajustes));
  await elegir(pagina, 'Al minuto');
  await guardar(pagina);
  await pagina.waitForFunction(() => window.__tv.estado().ajustes && window.__tv.estado().ajustes.apagado === 1, null, { timeout: 10000 }).catch(() => {});
  informe('a Pepito Lite le llega apagado = 1', (await estadoTV(pagina)).ajustes.apagado === 1);
  await elegir(pagina, 'A los 2 min');
  await guardar(pagina);
  await pagina.waitForFunction(() => window.__tv.estado().ajustes && window.__tv.estado().ajustes.apagado === 2, null, { timeout: 10000 }).catch(() => {});
  informe('y apagado = 2', (await estadoTV(pagina)).ajustes.apagado === 2);
  const fb = await pagina.evaluate(() => (globalThis.__fakeDb.raiz.dispositivos.tv1 || {}).ajustes || null);
  informe('y no escribe nada en Firebase', fb === null, JSON.stringify(fb));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 3. Sin scroll en Ajustes (360x740 y 390x844), medido como todas las pantallas: en su estado normal ----------
// (Mientras la línea de estado muestra en dos renglones el aviso de "Nunca", la cabecera crece un poco: es un mensaje pasajero.)
for (const [ancho, alto] of [[390, 844], [360, 740]]) {
  const { navegador, pagina } = await abrir(semilla());
  await pagina.setViewportSize({ width: ancho, height: alto });
  await esperarPanel(pagina);
  await abrirAjustes(pagina);
  const sobra = await pagina.evaluate(() => {
    const barra = document.querySelector('.barra-accion');
    const tope = barra && getComputedStyle(barra).display !== 'none' && barra.getBoundingClientRect().height > 0 ? barra : document.querySelector('.nav-inferior');
    return Math.round(document.querySelector('main.controles').getBoundingClientRect().bottom - tope.getBoundingClientRect().top);
  });
  informe(`${ancho}x${alto}: Ajustes entra sin scroll (con "Apagar pantalla")`, sobra <= 0, `sobra ${sobra} px`);
  await navegador.close();
}
cerrar();
