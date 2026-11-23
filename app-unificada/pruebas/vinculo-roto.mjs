// La TV ya no reconoce a este celular (el vínculo quedó roto de un solo lado, por ejemplo tras abrir el emparejamiento en la TV):
// la reconexión de fondo se detiene y la app AVISA con un cuadro qué hacer, una sola vez, en vez de quedarse en "Desconectado".
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const semilla = { dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } };
const conTVLiteElegida = (p) => p.addInitScript(() => {
  if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
  }
});

const { navegador, pagina, errores } = await abrir(semilla, { antes: conTVLiteElegida });
const dialogos = [];
pagina.on('dialog', (d) => dialogos.push(d.message()));
await esperarPanel(pagina);
await pagina.waitForTimeout(500);

// El navegador de pruebas solo conoce la TV después de haberla elegido una vez: se conecta, la TV deja de reconocernos y se
// repite la reconexión de fondo (lo que hace la app al abrirse o al volver a verse).
const r = await pagina.evaluate(async () => {
  const m = await import('/js/lite-tv.js');
  await m.ble.buscar();
  window.__tv.rechazarEscrituras = true;
  await m.ble.desconectar();
  m.ble.reanudarReconexion();
  const reconecto = await m.ble.reconectar();
  const segunda = await m.ble.reconectar(); // ya pausada: no vuelve a intentarlo ni a avisar
  return { reconecto, segunda, conectado: m.ble.estaConectado() };
});

informe('la reconexión de fondo no se queda conectada con una TV que no nos reconoce', r.reconecto === false && r.conectado === false, JSON.stringify(r));
informe('la app avisa con un cuadro qué hacer (olvidar la TV y emparejar de nuevo)', dialogos.length === 1 && /no reconoce este celular/.test(dialogos[0]) && /Olv[ií]dala/.test(dialogos[0]), dialogos.join(' | '));
informe('el aviso sale una sola vez (no se repite con cada intento)', dialogos.length === 1, String(dialogos.length));
informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 250));
await navegador.close();
cerrar();
