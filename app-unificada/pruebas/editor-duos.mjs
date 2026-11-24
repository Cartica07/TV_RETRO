// Editor de dúos (herramienta del dueño: www/editor-duos.html; docs/plan-duos.md). Sin Firebase: carga un GIF hecho aquí,
// arma el dúo en los dos modos y comprueba las descargas (el paquete .json y la cabecera .h). node pruebas/editor-duos.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrir, cerrar, informe, erroresPagina } from './banco-unificado.mjs';

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

const { navegador, pagina, errores } = await abrir({}, { ruta: '/editor-duos.html', esperar: false });
await pagina.waitForSelector('#modo');
await pagina.selectOption('#sonido', ''); // sin sonido: así la duración es la de la animación
const datos = () => pagina.textContent('#datos');

// ---- Modo escena: un GIF para los dos ----
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

informe('sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
await navegador.close();
cerrar();
fs.rmSync(carpeta, { recursive: true, force: true });
