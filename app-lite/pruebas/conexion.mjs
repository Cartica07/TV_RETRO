// La conexión con la TV falla de las formas de siempre (usuarios impacientes, señal débil, TV apagada): la app avisa
// con palabras simples, no se queda trabada y se recupera sola al volver a intentarlo.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores, tv } = await abrir();
const estado = () => pagina.evaluate(() => document.getElementById('estadoTexto').textContent.trim());
const esperarEstado = (re, ms = 30000) => pagina.waitForFunction((r) => new RegExp(r).test(document.getElementById('estadoTexto').textContent), re.source, { timeout: ms });
const enviarTexto = async (t) => { await pagina.fill('#texto', t); await pagina.click('#enviar'); };
const botonLibre = () => pagina.evaluate(() => !document.getElementById('enviar').disabled);

// 1. El usuario cierra la lista de TV sin elegir ninguna.
await pagina.evaluate(() => { window.__tv.rechazarBusqueda = true; });
await enviarTexto('uno');
await esperarEstado(/No elegiste ninguna TV/);
informe('si cierra la lista sin elegir TV, se lo dice claro', true, await estado());
informe('el botón Enviar queda libre para intentar otra vez', await botonLibre());
await pagina.evaluate(() => { window.__tv.rechazarBusqueda = false; });

// 2. La TV está apagada o lejos: no se puede conectar.
await pagina.evaluate(() => { window.__tv.noConectar = true; });
await enviarTexto('dos');
await esperarEstado(/No se pudo conectar con la TV/);
informe('TV apagada o lejos: "No se pudo conectar…" y sin términos técnicos', !/GATT|Error|undefined/i.test(await estado()), await estado());
informe('Enviar queda libre', await botonLibre());
await pagina.evaluate(() => { window.__tv.noConectar = false; });

// 3. Vuelve la TV: el siguiente envío funciona solo.
await enviarTexto('tres');
await esperarEstado(/camino|En la TV|✅/);
let e = await tv();
informe('al volver la TV, el envío funciona sin hacer nada más', e.contenidos === 1, JSON.stringify(e.contenidos));

// 4. Se pierden paquetes a mitad de una canción grande: la app reenvía lo que faltó y llega completa.
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForFunction(() => document.querySelectorAll('#seleccionCancion option').length > 1, null, { timeout: 15000 });
const grande = await pagina.evaluate(async () => { const l = await (await fetch('canciones/indice.json')).json(); l.sort((a, b) => b.bytes - a.bytes); return l[0]; });
await pagina.selectOption('#seleccionCancion', grande.clave);
await pagina.waitForTimeout(700);
await pagina.evaluate(() => {
  window.__tv.perderDatos = 4;
  window.__textos = [];
  new MutationObserver(() => window.__textos.push(document.getElementById('estadoTexto').textContent)).observe(document.getElementById('estadoTexto'), { childList: true, characterData: true, subtree: true });
});
await pagina.click('#enviar');
await esperarEstado(/camino|En la TV|✅/, 60000);
e = await tv();
informe(`la canción más grande (${grande.bytes} bytes) llega completa aunque se pierdan paquetes`, e.biblioteca.includes(grande.id) && e.sonando && e.sonando.id === grande.id, JSON.stringify({ bib: e.biblioteca, sonando: e.sonando }));

const textos = await pagina.evaluate(() => window.__textos);
informe('mientras envía la canción grande muestra el avance ("Enviando… 40 %")', textos.some((x) => /Enviando… [0-9]+ %/.test(x)), textos.slice(0, 6).join(' | '));

// 5. La TV se cuelga y no responde: la app no se queda esperando para siempre.
await pagina.evaluate(() => { window.__tv.sinResponder = true; });
await pagina.click('#grupoTipo button[data-valor="texto"]');
await enviarTexto('cuatro');
await esperarEstado(/no respondi|Algo salió mal|perdi|TV/i, 60000);
informe('con la TV colgada la app avisa y no se traba', await botonLibre(), await estado());
await pagina.evaluate(() => { window.__tv.sinResponder = false; });

// 6. Se corta la conexión: el indicador lo muestra y el siguiente envío reconecta.
await pagina.evaluate(() => window.__tv.desconectar());
await pagina.waitForFunction(() => /desconectado/i.test(document.getElementById('textoConexion').textContent), null, { timeout: 10000 });
informe('al cortarse la conexión el indicador dice "desconectado"', true);
await enviarTexto('cinco');
await esperarEstado(/camino|En la TV|✅/);
await pagina.waitForFunction(() => /en línea/i.test(document.getElementById('textoConexion').textContent), null, { timeout: 10000 });
informe('el siguiente envío reconecta solo y vuelve a decir "en línea"', true);

// 7. Dos toques rápidos en Enviar con la conexión cortada: una sola conexión, un solo envío.
const antes = (await tv()).contenidos;
await pagina.evaluate(() => window.__tv.desconectar());
await pagina.waitForTimeout(300);
await pagina.fill('#texto', 'seis');
await pagina.dblclick('#enviar');
await esperarEstado(/camino|En la TV|✅/);
await pagina.waitForTimeout(500);
e = await tv();
informe('doble toque con la conexión cortada: se envía una sola vez', e.contenidos === antes + 1, `${antes} -> ${e.contenidos}`);

informe('sin errores inesperados en la consola', errores.filter((x) => !/GATT|Failed to load resource/.test(x)).length === 0, errores.join(' | '));
cerrar();
