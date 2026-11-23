// Buscar canción (pedido del dueño, 2026-11-23): la lupa junto a la lista de canciones y al tono de la alarma abre una ventana que
// filtra por el comienzo del nombre o de cualquiera de sus palabras, sin importar mayúsculas ni tildes. Firebase falso.
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina, visible } from './banco-unificado.mjs';

const NOMBRES = { mundo: 'Un mundo ideal', fin: 'El fin del mundo', noche: 'La noche sin ti', noviembre: 'Noviembre sin ti', alabare: 'Alabaré', sumergeme: 'Sumérgeme', isnt: "Isn't She Lovely" };
const indice = {};
for (const [k, nombre] of Object.entries(NOMBRES)) indice[k] = { nombre, archivo: k + '.ino', duracion: 10, repetir: false, imagenes: 0, bytes: 10, origen: 'ino', fecha: 1 };
const semilla = {
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  musicales: { indice, datos: {} },
};

const nombres = (p) => p.$$eval('#buscadorLista button', (bs) => bs.map((b) => b.textContent));
const escribir = async (p, t) => { await p.fill('#buscadorTexto', t); await p.waitForTimeout(100); return nombres(p); };
const iguales = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const { navegador, pagina, errores } = await abrir(semilla);
await esperarPanel(pagina);
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForFunction(() => document.querySelectorAll('#seleccionCancion option').length > 5, null, { timeout: 10000 });
informe('Canciones: la lupa está junto a la lista', await visible(pagina, '#botonBuscarCancion'));

await pagina.click('#botonBuscarCancion');
informe('la lupa abre la ventana con el campo listo para escribir', (await visible(pagina, '#buscadorCanciones')) && (await pagina.evaluate(() => document.activeElement.id)) === 'buscadorTexto');
informe('sin escribir nada salen todas las canciones', (await nombres(pagina)).length === Object.keys(NOMBRES).length);

let r = await escribir(pagina, 'N');
informe('"N": las que empiezan por N primero, luego las que tienen una palabra con N', r[0] === 'Noviembre sin ti' && iguales(r, ['Noviembre sin ti', 'La noche sin ti']), r.join(', '));
r = await escribir(pagina, 'mundo');
informe('"mundo": encuentra "Un mundo ideal" y "El fin del mundo"', iguales(r, ['Un mundo ideal', 'El fin del mundo']), r.join(', '));
r = await escribir(pagina, 'ALABARE');
informe('sin importar mayúsculas ni tildes ("ALABARE" -> "Alabaré")', iguales(r, ['Alabaré']), r.join(', '));
r = await escribir(pagina, 'sumer');
informe('"sumer" -> "Sumérgeme"', iguales(r, ['Sumérgeme']), r.join(', '));
r = await escribir(pagina, 'isnt');
informe('"isnt" -> "Isn\'t She Lovely" (el apóstrofo no estorba)', iguales(r, ["Isn't She Lovely"]), r.join(', '));
r = await escribir(pagina, 'zzz');
informe('sin resultados: lo dice', r.length === 0 && (await visible(pagina, '#buscadorVacio')));
r = await escribir(pagina, 'mundo i');
informe('varias palabras ("mundo i") -> "Un mundo ideal"', iguales(r, ['Un mundo ideal']), r.join(', '));
const marca = await pagina.$eval('#buscadorLista mark', (m) => m.textContent);
informe('lo encontrado se resalta', marca === 'mundo i', marca);

await pagina.click('#buscadorLista button');
await pagina.waitForTimeout(300);
const elegida = await pagina.evaluate(() => ({ valor: document.getElementById('seleccionCancion').value, abierta: !document.getElementById('buscadorCanciones').hidden }));
informe('al tocar una queda elegida en la lista y la ventana se cierra', elegida.valor === 'mundo' && !elegida.abierta, JSON.stringify(elegida));

// Al volver a abrir, la elegida se marca.
await pagina.click('#botonBuscarCancion');
const actual = await pagina.$eval('#buscadorLista button[aria-current="true"]', (b) => b.textContent).catch(() => '');
informe('al volver a abrir, la canción elegida está marcada', actual === 'Un mundo ideal', actual);
await pagina.keyboard.press('Escape');
informe('Escape (o la X) cierra sin cambiar nada', !(await visible(pagina, '#buscadorCanciones')) && (await pagina.evaluate(() => document.getElementById('seleccionCancion').value)) === 'mundo');

// ---------- Tono de la alarma ----------
await pagina.click('#grupoTipo button[data-valor="galeria"]');
await pagina.click('#grupoMas button[data-mas="alarma"]');
await pagina.waitForSelector('#seccionAlarma', { state: 'visible' });
await pagina.waitForTimeout(500);
informe('Alarma: la lupa está junto al tono', await visible(pagina, '#botonBuscarTono'));
await pagina.click('#botonBuscarTono');
r = await nombres(pagina);
informe('en la alarma también sale el sonido simple (es una elección)', r.length === Object.keys(NOMBRES).length + 1 && /Sonido simple/.test(r[0]), r.slice(0, 2).join(', '));
r = await escribir(pagina, 'noche');
await pagina.click('#buscadorLista button');
informe('elegir un tono desde la búsqueda lo deja en la lista del tono', (await pagina.evaluate(() => document.getElementById('alarmaTono').value)) === 'noche');
informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
await navegador.close();

// ---------- Sin scroll (regla del dueño) en Canciones y Alarma, en 390x844 y 360x740 ----------
for (const [ancho, alto] of [[390, 844], [360, 740]]) {
  const { navegador: n2, pagina: p2 } = await abrir(semilla);
  await p2.setViewportSize({ width: ancho, height: alto });
  await esperarPanel(p2);
  await p2.click('#grupoTipo button[data-valor="cancion"]');
  await p2.waitForTimeout(600);
  const c = await p2.evaluate(() => Math.round(document.querySelector('main.controles').getBoundingClientRect().bottom - document.querySelector('.barra-accion').getBoundingClientRect().top));
  informe(`${ancho}x${alto}: Canciones entra sin scroll`, c <= 0, `sobra ${c} px`);
  await p2.click('#grupoTipo button[data-valor="galeria"]');
  await p2.click('#grupoMas button[data-mas="alarma"]');
  await p2.waitForTimeout(600);
  const a = await p2.evaluate(() => {
    const barra = document.querySelector('.barra-accion');
    const tope = barra && getComputedStyle(barra).display !== 'none' && barra.getBoundingClientRect().height > 0 ? barra : document.querySelector('.nav-inferior');
    return Math.round(document.querySelector('main.controles').getBoundingClientRect().bottom - tope.getBoundingClientRect().top);
  });
  informe(`${ancho}x${alto}: Alarma entra sin scroll`, a <= 0, `sobra ${a} px`);
  await n2.close();
}
cerrar();
