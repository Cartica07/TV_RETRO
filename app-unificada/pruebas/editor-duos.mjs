// Editor de dúos (herramienta del dueño: www/editor-duos.html; docs/plan-duos.md). Sin Firebase: carga un GIF hecho aquí,
// arma el dúo en los dos modos y comprueba las descargas (el paquete .json y la cabecera .h). node pruebas/editor-duos.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrir, cerrar, informe, erroresPagina } from './banco-unificado.mjs';

const { codificarMusical } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'compresion.js')).href);
// Una canción de prueba en el catálogo: 440 Hz de 0 a 1 s, silencio hasta 1,5 s y 880 Hz hasta 3 s.
const negro1024 = new Uint8Array(1024);
const cancionM1 = await codificarMusical({ notas: [{ t: 0, f: 440 }, { t: 1000, f: 0 }, { t: 1500, f: 880 }], cuadros: [{ t: 0, bitmap: negro1024 }], duracion: 3000, repetir: false });
const semilla = { usuarios: { 'uid-ana': { dispositivos: { tv1: true } } }, dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: { tipo: 'texto', texto: 'Hola', config: {} } } } }, musicales: { indice: { cumple: { nombre: 'Cumpleaños feliz', duracion: 3000 } }, datos: { cumple: cancionM1.datos } } };

// GIF de 2 colores, ancho×alto, con un cuadrado blanco que avanza (LZW sin compresión real: CLEAR cada 2 puntos, así el
// ancho del código queda en 3 bits).
function gifDePrueba(ancho, alto, cuadros, demoraCs = 10) {
  const b = [];
  const u16 = (v) => b.push(v & 255, v >> 8);
  b.push(...Buffer.from('GIF89a'));
  u16(ancho); u16(alto);
  b.push(0x80, 0, 0); // tabla global de 2 colores
  b.push(0, 0, 0, 255, 255, 255);
  b.push(0x21, 0xFF, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // repetir
  for (let k = 0; k < cuadros; k++) {
    b.push(0x21, 0xF9, 4, 0, demoraCs & 255, demoraCs >> 8, 0, 0); // demora
    b.push(0x2C); u16(0); u16(0); u16(ancho); u16(alto); b.push(0);
    b.push(2); // tamaño mínimo del código
    const codigos = [];
    const lado = Math.floor(alto / 2);
    for (let i = 0; i < ancho * alto; i++) {
      if (i % 2 === 0) codigos.push(4); // CLEAR
      const x = i % ancho, y = Math.floor(i / ancho);
      const x0 = Math.floor((k * (ancho - lado)) / Math.max(1, cuadros - 1));
      codigos.push(x >= x0 && x < x0 + lado && y >= alto / 4 && y < alto / 4 + lado ? 1 : 0);
    }
    codigos.push(5); // EOI
    const bytes = [];
    let acc = 0, n = 0;
    for (const c of codigos) {
      acc |= c << n; n += 3;
      while (n >= 8) { bytes.push(acc & 255); acc >>= 8; n -= 8; }
    }
    if (n > 0) bytes.push(acc & 255);
    for (let i = 0; i < bytes.length; i += 255) { const t = bytes.slice(i, i + 255); b.push(t.length, ...t); }
    b.push(0);
  }
  b.push(0x3B);
  return Buffer.from(b);
}

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'duos-'));
const gifAncho = path.join(carpeta, 'escena.gif');
const gifChico = path.join(carpeta, 'corazon.gif');
fs.writeFileSync(gifAncho, gifDePrueba(64, 16, 3));
fs.writeFileSync(gifChico, gifDePrueba(32, 16, 3));

const { navegador, pagina, errores } = await abrir(semilla, { ruta: '/editor-duos.html', esperar: false });
await pagina.waitForSelector('#modo');
await pagina.selectOption('#sonido', ''); // sin sonido: así la duración es la de la animación
const datos = () => pagina.textContent('#datos');

// ---- Modo escena: un GIF para los dos ----
await pagina.selectOption('#modo', 'escena');
await pagina.setInputFiles('#gifEscena', gifAncho);
await pagina.waitForFunction(() => /Duración/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
const d1 = await datos();
informe('escena: arma el dúo y dice la duración y el peso de cada mitad', /Duración: 0\.30 s/.test(d1) && /Izquierda: .* KB/.test(d1) && /Derecha: .* KB/.test(d1), d1.split('\n').slice(0, 3).join(' | '));
informe('escena: el nombre se toma del archivo', (await pagina.inputValue('#nombre')) === 'escena');
informe('escena: los botones de reproducir y descargar quedan activos', !(await pagina.$eval('#botonReproducir', (b) => b.disabled)) && !(await pagina.$eval('#botonPaquete', (b) => b.disabled)));

// Las dos pantallas muestran algo distinto (el cuadrado está en la mitad izquierda al principio).
const puntos = (id) => pagina.evaluate((i) => { const c = document.getElementById(i); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 2] > 128) n++; return n; }, id);
const pi = await puntos('vistaIzq'), pd = await puntos('vistaDer');
informe('escena: al principio el cuadrado está en la pantalla izquierda y la derecha está vacía', pi > 0 && pd === 0, `${pi} / ${pd}`);
await pagina.click('#botonReproducir');
await pagina.waitForTimeout(700);
informe('escena: al terminar, el cuadrado llegó a la pantalla derecha', (await puntos('vistaDer')) > 0);

// Descargas.
const [bajada1] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#botonPaquete')]);
const paquete = JSON.parse(fs.readFileSync(await bajada1.path(), 'utf8'));
informe('descarga del dúo (.json): formato duo1, las dos mitades y sin sonido', bajada1.suggestedFilename() === 'escena.duo.json' && paquete.formato === 'duo1' && paquete.izq.datos && paquete.der.datos && paquete.sonido === null, `${bajada1.suggestedFilename()} ${paquete.sonido}`);
const [bajada2] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#botonCabecera')]);
const h = fs.readFileSync(await bajada2.path(), 'utf8');
informe('descarga para el firmware (.h): las dos mitades en m1 y las imágenes para el ESP8266', bajada2.suggestedFilename() === 'duo_prueba.h' && /DUO_PRUEBA_IZQ_M1/.test(h) && /DUO_PRUEBA_DER_M1/.test(h) && /DUO_PRUEBA_IMAGENES/.test(h));

// ---- Modo dos GIF: el primero en la derecha y el segundo en la izquierda cuando termina ----
// ---- Mitades movibles: correr la mitad izquierda 20 puntos la corre 20 puntos en su pantalla ----
const primeraColumna = (id) => pagina.evaluate((i) => {
  const c = document.getElementById(i); const esc = c.width / 128; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let x = 0; x < 128; x++) for (let y = 0; y < 64; y++) { const k = ((y * esc + 1) * c.width + x * esc + 1) * 4; if (d[k + 2] > 128) return x; }
  return -1;
}, id);
await pagina.fill('#movIzqY', '0'); // vuelve a armar: la vista queda en el primer cuadro
await pagina.waitForTimeout(800);
const antesX = await primeraColumna('vistaIzq');
await pagina.fill('#movIzqX', '20');
await pagina.waitForTimeout(800);
const despuesX = await primeraColumna('vistaIzq');
informe('mitades: correr la mitad izquierda 20 puntos la mueve 20 puntos en su pantalla', antesX >= 0 && despuesX === antesX + 20, `${antesX} -> ${despuesX}`);
await pagina.click('#botonJuntar');
await pagina.waitForTimeout(800);
informe('mitades: "Volver a juntarlas en el borde" la devuelve', (await primeraColumna('vistaIzq')) === antesX);
// Mover y cortar no vuelve a leer el GIF ni guarda copias nuevas (antes se llenaba la memoria).
const guardadasAntes = await pagina.evaluate(() => window.__editorDuos.lecturasGuardadas());
for (const v of ['5', '10', '-7', '3']) { await pagina.fill('#movDerX', v); await pagina.waitForTimeout(250); }
await pagina.fill('#corteMitades', '40');
await pagina.waitForTimeout(600);
const guardadasDespues = await pagina.evaluate(() => window.__editorDuos.lecturasGuardadas());
informe('mitades: mover y cortar no acumula lecturas del GIF', guardadasDespues === guardadasAntes, `${guardadasAntes} -> ${guardadasDespues}`);
await pagina.fill('#movDerX', '0');
await pagina.fill('#corteMitades', '50');
await pagina.waitForTimeout(400);

await pagina.selectOption('#modo', 'dos');
await pagina.setInputFiles('#gif1', gifChico);
await pagina.setInputFiles('#gif2', gifChico);
await pagina.waitForFunction(() => /Duración: 0\.60 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('dos GIF: el segundo empieza cuando termina el primero (dura 0,60 s)', /Duración: 0\.60 s/.test(await datos()));
await pagina.selectOption('#inicio2', 'ms');
await pagina.fill('#inicioMs', '100');
await pagina.waitForFunction(() => /Duración: 0\.40 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('dos GIF: el segundo a los 100 ms (dura 0,40 s)', true);
await pagina.selectOption('#sonido', 'corazon');
await pagina.waitForFunction(() => /Duración: 0\.48 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
const d2 = await datos();
informe('con sonido: suena en el Pepito izquierdo desde que empieza su parte (100 ms + 0,38 s = 0,48 s)', /Izquierda: .*con sonido/.test(d2) && !/Derecha: .*con sonido/.test(d2), d2.split('\n').slice(0, 3).join(' | '));

// ---- En el tiempo: la primera mitad del GIF en el Pepito derecho y, apenas termina, el resto en el izquierdo ----
await pagina.selectOption('#sonido', '');
await pagina.selectOption('#modo', 'tiempo');
await pagina.setInputFiles('#gifTiempo', gifChico);
await pagina.waitForFunction(() => /después del cuadro 1 de 3 \(100 de 300 ms\)/.test(document.getElementById('corteTiempoTexto').textContent), null, { timeout: 15000 });
await pagina.waitForTimeout(400);
informe('en el tiempo: el corte va DESPUÉS DE UN CUADRO (en la mitad: tras el 1 de 3) y el dúo dura lo del GIF (0,30 s)', /Duración: 0\.30 s/.test(await datos()), (await pagina.textContent('#corteTiempoTexto')) + ' | ' + (await datos()).split('\n')[0]);
const pTiempoI = await puntos('vistaIzq'), pTiempoD = await puntos('vistaDer');
informe('en el tiempo: al principio solo se ve el Pepito derecho (el izquierdo espera en negro)', pTiempoD > 0 && pTiempoI === 0, `${pTiempoI} / ${pTiempoD}`);
await pagina.fill('#corteTiempo', '2');
await pagina.waitForFunction(() => /después del cuadro 2 de 3 \(200 de 300 ms\)/.test(document.getElementById('corteTiempoTexto').textContent), null, { timeout: 15000 });
informe('en el tiempo: mover el corte al cuadro 2', true);
await pagina.fill('#pausaTiempo', '100');
await pagina.waitForFunction(() => /Duración: 0\.40 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('en el tiempo: una pausa de 100 ms entre las partes alarga el dúo a 0,40 s', true);
await pagina.fill('#pausaTiempo', '0');
// Recortar el principio: usar desde el cuadro 2 deja 2 cuadros (0,20 s).
await pagina.fill('#desdeTiempo', '2');
await pagina.waitForFunction(() => /Duración: 0\.20 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('recortar: usar desde el cuadro 2 deja el GIF en 2 cuadros (0,20 s) y dice cuántos tiene', (await pagina.textContent('#totalTiempo')) === '(de 3)');
await pagina.fill('#desdeTiempo', '1');
await pagina.waitForTimeout(500);
// La barra de tiempo muestra un momento sin volver a armar el dúo.
await pagina.$eval('#barraTiempo', (b) => { b.value = '150'; b.dispatchEvent(new Event('input', { bubbles: true })); });
await pagina.waitForTimeout(300);
const textoBarra = await pagina.textContent('#barraTexto');
informe('barra de tiempo: a los 150 ms dice qué cuadro muestra cada Pepito', /^150 ms · izquierdo \d+\/\d+ · derecho \d+\/\d+$/.test(textoBarra), textoBarra);
// El hueco entre las pantallas (mitades): con 5 mm la mitad derecha pierde la parte que queda "detrás del plástico".
await pagina.selectOption('#modo', 'escena');
await pagina.fill('#huecoMm', '5');
await pagina.waitForFunction(() => /≈ 29 puntos/.test(document.getElementById('huecoTexto').textContent), null, { timeout: 15000 });
informe('hueco: 5 mm son unos 29 puntos de pantalla', true, await pagina.textContent('#huecoTexto'));
await pagina.fill('#huecoMm', '0');

// ---- Ajustes separados por GIF: invertir solo el segundo (que va en el izquierdo) ----
await pagina.selectOption('#modo', 'dos');
await pagina.waitForTimeout(1200); // que termine de armarse el modo recién elegido
const verEn = async (t) => { await pagina.$eval('#barraTiempo', (b, v) => { b.value = String(v); b.dispatchEvent(new Event('input', { bubbles: true })); }, t); await pagina.waitForTimeout(200); };
await verEn(400);
const sinInvertir = { izq: await puntos('vistaIzq'), der: await puntos('vistaDer') };
await pagina.check('#ajustesSeparados');
await pagina.selectOption('#ajustesDeQue', 'g2');
await pagina.check('#invertir');
await pagina.waitForTimeout(900);
await verEn(400);
const conInvertir = { izq: await puntos('vistaIzq'), der: await puntos('vistaDer') };
informe('ajustes separados: invertir solo el segundo GIF invierte solo el Pepito izquierdo', conInvertir.izq > sinInvertir.izq * 3 && conInvertir.der === sinInvertir.der, JSON.stringify({ sinInvertir, conInvertir }));
await pagina.selectOption('#ajustesDeQue', 'g1');
informe('ajustes separados: al pasar a editar el primer GIF, la casilla Invertir muestra la suya (sin marcar)', !(await pagina.isChecked('#invertir')));

// ---- Guardar el proyecto y abrirlo en una página nueva: el mismo dúo ----
const duracionAntes = (await datos()).split('\n')[0];
const [bajadaP] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#botonGuardarProyecto')]);
const rutaProyecto = path.join(carpeta, 'proyecto.json');
fs.copyFileSync(await bajadaP.path(), rutaProyecto);
const proyecto = JSON.parse(fs.readFileSync(rutaProyecto, 'utf8'));
informe('proyecto: guarda los GIF, los controles y los ajustes de cada GIF', proyecto.formato === 'duo-proyecto' && proyecto.gifs.g1 && proyecto.gifs.g2 && proyecto.ajustes.g2.invertir === true && proyecto.controles.modo === 'dos' && !('correo' in proyecto.controles) && !('clave' in proyecto.controles));
const rutaDuo = path.join(carpeta, 'duo.json');
const [bajadaD] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#botonPaquete')]);
fs.copyFileSync(await bajadaD.path(), rutaDuo);
await pagina.reload();
await pagina.waitForSelector('#modo');
await pagina.setInputFiles('#archivoAbrir', rutaProyecto);
await pagina.waitForFunction((d) => document.getElementById('datos').textContent.startsWith(d), duracionAntes, { timeout: 15000 });
informe('proyecto: al abrirlo vuelve el mismo dúo (modo, GIF y ajustes)', (await pagina.inputValue('#modo')) === 'dos' && (await pagina.isChecked('#ajustesSeparados')), duracionAntes);
await pagina.setInputFiles('#archivoAbrir', rutaDuo);
await pagina.waitForFunction(() => /Dúo abierto \(solo para ver\)/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('abrir un dúo ya hecho (.duo.json): se puede ver y volver a bajar', !(await pagina.$eval('#botonReproducir', (b) => b.disabled)));

// ---- Tus canciones: un tramo de una canción del catálogo como sonido ----
await pagina.waitForFunction(() => [...document.querySelectorAll('#sonido option')].some((o) => o.value === 'cancion:cumple'), null, { timeout: 15000 });
informe('con la sesión iniciada, tus canciones aparecen en la lista de sonidos', /Sesión iniciada/.test(await pagina.textContent('#estadoCuenta')));
await pagina.selectOption('#modo', 'tiempo');
await pagina.setInputFiles('#gifTiempo', gifChico);
await pagina.waitForTimeout(800);
await pagina.selectOption('#sonido', 'cancion:cumple');
await pagina.fill('#cancionDesde', '0.8');
await pagina.waitForFunction(() => /la canción dura 3.0 s/.test(document.getElementById('cancionLargo').textContent), null, { timeout: 15000 });
await pagina.waitForTimeout(800);
const [bajadaC] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#botonPaquete')]);
const paqC = JSON.parse(fs.readFileSync(await bajadaC.path(), 'utf8'));
informe('canción: el tramo suena en el Pepito izquierdo y el dúo dura lo de la animación', paqC.sonido === 'izq' && paqC.duracion === 300 && paqC.portada && paqC.portada.izq, `${paqC.sonido} ${paqC.duracion} ms`);
await pagina.selectOption('#cancionCuanto', 'segundos');
await pagina.fill('#cancionSegundos', '1.5');
await pagina.waitForFunction(() => /Duración: 1.60 s/.test(document.getElementById('datos').textContent), null, { timeout: 15000 });
informe('canción: 1,5 s de canción desde que empieza el izquierdo (a los 100 ms) alargan el dúo a 1,60 s', true);

// ---- Al revés y texto encima (en el tiempo: al principio solo se ve el derecho) ----
await pagina.selectOption('#sonido', '');
await pagina.waitForTimeout(700);
await verEn(0);
const normalX = await primeraColumna('vistaDer');
await pagina.selectOption('#ordenTiempo', 'reves');
await pagina.waitForTimeout(900);
await verEn(0);
const revesX = await primeraColumna('vistaDer');
informe('al revés: el primer cuadro del Pepito derecho es el último del GIF (el cuadrado empieza a la derecha)', normalX === 0 && revesX > 64, `${normalX} -> ${revesX}`);
await pagina.selectOption('#ordenTiempo', 'normal');
await pagina.waitForTimeout(700);
await verEn(0);
const sinTexto = await puntos('vistaIzq');
await pagina.fill('#textoEncima', 'Hola');
await pagina.waitForTimeout(900);
await verEn(0);
const conTexto = await puntos('vistaIzq');
informe('texto encima: "Hola" aparece en el Pepito izquierdo (que estaba en negro)', sinTexto === 0 && conTexto > 0, `${sinTexto} -> ${conTexto}`);
await pagina.fill('#textoEncima', '');

// ---- Probar en mi Pepito: la mitad elegida va a la Pepito Pro de la cuenta como canción con letra sin clave ----
await pagina.waitForTimeout(700);
const versionAntes = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version);
await pagina.selectOption('#probarMitad', 'der');
await pagina.click('#botonProbar');
await pagina.waitForTimeout(400);
const sinEnviar = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota.version);
informe("probar: el primer toque solo pide confirmar (no envía)", sinEnviar === versionAntes && /Toca otra vez/.test(await pagina.textContent("#aviso")), String(versionAntes) + " " + String(sinEnviar) + " " + await pagina.textContent("#aviso"));
await pagina.click('#botonProbar');
await pagina.waitForFunction(() => /Listo: mira tu Pepito/.test(document.getElementById('aviso').textContent), null, { timeout: 15000 });
const o = await pagina.evaluate(() => globalThis.__fakeDb.raiz.dispositivos.tv1.oled_remota);
informe('probar: la mitad derecha llega como canción con letra, sin clave y con su archivo m1', o.pantalla.tipo === 'musical' && !o.pantalla.musical.clave && /\(derecha\)$/.test(o.pantalla.musical.nombre) && o.archivo && o.archivo.datos.length > 0 && o.archivo.version === o.version, JSON.stringify(o.pantalla.musical) + ' v=' + o.version + ' archivo=' + JSON.stringify(o.archivo && { version: o.archivo.version, largo: (o.archivo.datos || '').length }));

informe('sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
await navegador.close();
cerrar();
fs.rmSync(carpeta, { recursive: true, force: true });
