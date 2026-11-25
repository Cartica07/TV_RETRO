// Una cuenta con una TV Pro y una TV Lite: elegir cuál usar, canciones de la NUBE que se mandan a la TV Lite, alarma y ajustes
// por Bluetooth, y que lo elegido se recuerde al recargar. Firebase y Bluetooth falsos (banco-unificado.mjs).
import fs from 'node:fs';
import { abrir, cerrar, informe, pant, visible, esperarPanel, escrituras, lecturas, estadoTV, erroresPagina } from './banco-unificado.mjs';

// Dos canciones REALES (el mismo formato m1 que guarda la Pro en musicales/datos), para que la TV simulada las acepte.
const CARPETA = new URL('../../app-lite/canciones/', import.meta.url);
const indiceReal = JSON.parse(fs.readFileSync(new URL('indice.json', CARPETA), 'utf8')).slice(0, 2);
const musicales = { indice: {}, datos: {} };
for (const c of indiceReal) {
  musicales.indice[c.clave] = { nombre: c.nombre, archivo: c.archivo, duracion: c.duracion, repetir: false, imagenes: 0, bytes: c.bytes, origen: 'ino', fecha: 1 };
  musicales.datos[c.clave] = fs.readFileSync(new URL(c.archivo, CARPETA)).toString('base64');
}
const [cancionA, cancionB] = indiceReal.map((c) => c.clave);

const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola desde TV 1') } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  musicales,
});

// La cuenta ya tiene añadida una TV Lite y la tiene elegida (como si hubiera cerrado la app usándola).
const conTVLiteElegida = (p) => p.addInitScript(() => {
  if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
  }
});

const { navegador, pagina, errores } = await abrir(semilla(), { antes: conTVLiteElegida });
await esperarPanel(pagina);
await pagina.waitForTimeout(500);

// ---------- 1. Arranca en la TV Lite que quedó elegida ----------
informe('arranca en la TV Lite elegida (modo TV Lite)', await pagina.evaluate(() => document.body.classList.contains('tv-lite')));
// Desde el 2026-11-23 la Lite SÍ actualiza por Bluetooth: Más > Configuración > Sistema se ve (sin Restablecer); los juegos no.
informe('en modo TV Lite no se ven los juegos ni Restablecer, pero sí Sistema (actualizar)', await pagina.evaluate(() => {
  const oculto = (s) => { const e = document.querySelector(s); return !e || getComputedStyle(e).display === 'none'; };
  return oculto('[data-mas="juegos"]') && !oculto('[data-config="sistema"]') && oculto('#campoSistemaRestablecer');
}));
let lec = await lecturas(pagina);
informe('y no lee el estado de la TV Pro ni nada de dispositivos/lite:… (solo el rol de la TV Pro de la lista)', !lec.some((r) => /dispositivos\/(tv1\/oled|lite)/.test(r)), lec.filter((r) => /dispositivos\//.test(r)).join(', '));

// ---------- 2. Una canción de la NUBE se manda a la TV Lite ----------
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForFunction(() => document.querySelectorAll('#seleccionCancion option').length > 1, null, { timeout: 15000 });
const total = await pagina.$$eval('#seleccionCancion option', (o) => o.length);
informe('el selector de canciones sale de la nube (Firebase), no de la app', total >= 3, String(total));

const elegir = async (clave) => { await pagina.selectOption('#seleccionCancion', clave); await pagina.waitForTimeout(700); };
const enviar = async () => {
  await pagina.click('#enviar');
  await pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });
};
await elegir(cancionA);
await enviar();
let e = await estadoTV(pagina);
informe('la TV Lite guardó la canción y la está tocando', e.biblioteca.length === 1 && e.sonando && e.sonando.id === e.biblioteca[0], JSON.stringify({ bib: e.biblioteca, sonando: e.sonando }));
const idA = e.biblioteca[0];
informe('el id de la canción sale de su contenido (16 bits, no 0)', idA > 0 && idA <= 0xFFFF, String(idA));

// ---------- 3. La misma otra vez: no se reenvía; otra canción: sí ----------
const antes = e.escrituras;
await enviar();
e = await estadoTV(pagina);
informe('si la TV ya la tiene (y este celular lo recuerda) solo se le pide tocar', e.biblioteca.length === 1 && e.escrituras - antes <= 3, `escrituras ${antes} -> ${e.escrituras}`);
await elegir(cancionB);
await enviar();
e = await estadoTV(pagina);
informe('otra canción distinta sí se manda y la TV guarda las dos', e.biblioteca.length === 2, JSON.stringify(e.biblioteca));

// ---------- 4. Si el celular olvida lo que mandó, se manda de nuevo (nunca se toca una canción "de memoria") ----------
const antes2 = (await estadoTV(pagina)).escrituras;
await pagina.evaluate(() => new Promise((ok, mal) => {
  const q = indexedDB.open('tvretro-lite');
  q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({}, 'cancionesTV:tv-simulada'); tx.oncomplete = ok; tx.onerror = mal; };
  q.onerror = mal;
}));
await elegir(cancionA);
await enviar();
e = await estadoTV(pagina);
informe('sin el registro del celular se vuelve a mandar la canción aunque la TV la liste', e.escrituras - antes2 > 3, `escrituras ${antes2} -> ${e.escrituras}`);

// ---------- 5. Alarma y ajustes por Bluetooth (no escriben en Firebase) ----------
const r = await pagina.evaluate(async (clave) => {
  const m = await import('/js/firebase.js');
  const ajustes = await m.guardarAjustes({ brillo: 2, volumen: 1, zona: -300 });
  const alarma = await m.guardarAlarma({ tono: clave, alarmas: [{ activa: true, hora: 7, minuto: 30, dias: 62 }, {}, {}] });
  return { ajustes, alarma };
}, cancionA);
e = await estadoTV(pagina);
informe('los ajustes llegan a la TV Lite por Bluetooth', r.ajustes.exito && e.ajustes && e.ajustes.brillo === 2 && e.ajustes.volumen === 1, JSON.stringify(e.ajustes));
informe('la alarma llega a la TV Lite con la canción de la nube como tono', r.alarma.exito && e.alarmas && e.alarmas.tonoId === idA && e.alarmas.alarmas[0].activa === true, JSON.stringify(e.alarmas));
const esc = await escrituras(pagina);
informe('nada de esto escribe en dispositivos/ de Firebase', !esc.some((x) => /^dispositivos\//.test(x)), esc.join(', ').slice(0, 160));

// ---------- 6. Mis TV: las dos TV en la lista; la Lite no se comparte; cambiar a la Pro y volver ----------
await pagina.evaluate(() => document.getElementById('botonMiTV').click());
await pagina.waitForSelector('#pantallaTV:not([hidden])');
const filas = await pagina.$$eval('#listaTV .fila-tv', (f) => f.map((x) => ({ texto: x.innerText.replace(/\s+/g, ' '), compartir: [...x.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Compartir' && !b.hidden) })));
informe('Mis TV muestra la TV Pro y la TV Lite', filas.length === 2, JSON.stringify(filas));
informe('con TV ya añadidas no sale "¿Qué TV tienes?" y sí el botón "Tengo una TV Lite"', !(await visible(pagina, '#elegirTipoTV')) && (await visible(pagina, '#botonTVLite')));
informe('la TV Pro se puede compartir y la TV Lite no', filas.length === 2 && filas[0].compartir === true && filas[1].compartir === false, JSON.stringify(filas.map((f) => f.compartir)));
informe('la TV Lite aparece "En uso"', filas.length === 2 && /En uso/.test(filas[1].texto), filas[1] && filas[1].texto);

await pagina.click('#listaTV .fila-tv:nth-child(1) button:has-text("Usar")');
await pagina.waitForLoadState('load');
await esperarPanel(pagina);
await pagina.waitForTimeout(500);
informe('al elegir la TV Pro vuelve a ser como la Pro (lee de Firebase, sin modo TV Lite)', !(await pagina.evaluate(() => document.body.classList.contains('tv-lite'))) && (await pagina.inputValue('#texto')) === 'Hola desde TV 1');

// ---------- 7. Quitar la TV Lite ----------
await pagina.evaluate(() => document.getElementById('botonMiTV').click());
await pagina.waitForSelector('#pantallaTV:not([hidden])');
await pagina.click('#listaTV .fila-tv:nth-child(2) button:has-text("Desvincular")');
await pagina.waitForLoadState('load');
await esperarPanel(pagina);
const queda = await pagina.evaluate(() => localStorage.getItem('tvretro.tvlite.uid-ana'));
informe('desvincular la TV Lite la quita de la cuenta y la TV Pro sigue', queda === '[]' && (await pagina.inputValue('#texto')) === 'Hola desde TV 1', String(queda));

informe('sin errores en la página en todo el recorrido', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 300));
await navegador.close();
cerrar();
