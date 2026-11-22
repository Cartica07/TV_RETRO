// Texto: se escribe, se toca "Enviar a la TV" y la TV (simulada) lo recibe por Bluetooth con el mismo formato que la Pro
// escribía en Firebase. Comprueba también el último contenido recordado y los dobles toques.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores, tv } = await abrir();

await pagina.fill('#texto', 'Hola Lite');
await pagina.click('#enviar');
await pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 10000 });

const e1 = await tv();
informe('la TV recibió 1 contenido', e1.contenidos === 1, JSON.stringify(e1));
const contenido = await pagina.evaluate(() => {
  const c = window.__tv.contenido;
  return c ? { tipo: c.pantalla.tipo, texto: c.pantalla.texto, fuente: c.pantalla.config.fuente, tamano: c.pantalla.config.tamano, archivo: !!c.archivo } : null;
});
informe('es un texto "Hola Lite" con su configuración', contenido && contenido.tipo === 'texto' && contenido.texto === 'Hola Lite' && !!contenido.fuente, JSON.stringify(contenido));
informe('no lleva archivo (solo los GIF lo llevan)', contenido && contenido.archivo === false);

// La app mandó la hora al conectar.
informe('la app puso la hora en la TV al conectar', e1.hora !== null && Math.abs(e1.hora - Date.now() / 1000) < 60, String(e1.hora));

// Estado de la conexión.
await pagina.waitForFunction(() => /en línea/i.test(document.getElementById('textoConexion').textContent), null, { timeout: 10000 });
informe('el indicador dice "en línea"', true);

// Recargar: se abre donde se quedó (lo último enviado).
await pagina.reload();
await pagina.waitForFunction(() => document.getElementById('estadoTexto') && !/Cargando/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 });
const textoRecordado = await pagina.inputValue('#texto');
informe('al reabrir recuerda el último texto', textoRecordado === 'Hola Lite', textoRecordado);

// Doble toque: dos envíos seguidos no se pisan.
await pagina.fill('#texto', 'Dos');
await pagina.dblclick('#enviar');
await pagina.waitForTimeout(1500);
const e2 = await tv();
// (Al recargar la página la TV simulada vuelve a empezar: tras el doble toque debe haber exactamente 1 contenido.)
informe('un doble toque manda UNA sola vez', e2.contenidos === 1, String(e2.contenidos));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
