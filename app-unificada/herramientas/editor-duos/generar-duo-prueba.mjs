// Genera el dúo de prueba que va dentro del firmware (clave "prueba"): el corazón de la fase 0 (entra por la derecha de la TV
// derecha, cruza las dos pantallas y late en el centro de la izquierda con el sonido "Corazón"), ahora como un dúo de verdad
// (dos mitades m1 armadas con duo.js, igual que el editor).
//
// Uso (desde la raíz del panel): node app-unificada/herramientas/editor-duos/generar-duo-prueba.mjs <ruta de salida .h>
//   Pro:     ...\TV_RETRO-firmware\OLED_Remota\duo_prueba.h
//   ESP8266: ...\TV_RETRO-firmware\Duos_Prueba\duo_prueba.h   (el mismo archivo sirve para las dos placas)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const D = await import(pathToFileURL(path.join(aqui, 'duo.js')).href);
const { codificarMusical } = await import(pathToFileURL(path.join(aqui, '..', '..', '..', 'js', 'compresion.js')).href);

const salida = process.argv[2];
if (!salida) {
  console.error('Falta la ruta de salida (.h)');
  process.exit(1);
}

// Corazón de 16×14 (el mismo de Duos_Prueba).
const CORAZON = [0x1C, 0x38, 0x3E, 0x7C, 0x7F, 0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  0x7F, 0xFE, 0x3F, 0xFC, 0x1F, 0xF8, 0x0F, 0xF0, 0x07, 0xE0, 0x03, 0xC0, 0x01, 0x80];
const ANCHO_ESCENA = 256;

function escenaCon(dibujar) {
  const e = new Uint8Array(2 * D.BYTES_PANTALLA); // 256×64, 32 bytes por fila
  const punto = (x, y) => {
    if (x < 0 || x >= ANCHO_ESCENA || y < 0 || y >= D.ALTO) return;
    e[y * 32 + (x >> 3)] |= 0x80 >> (x & 7);
  };
  dibujar(punto);
  return e;
}

function corazon(punto, x0, y0, escala) {
  for (let yy = 0; yy < 14; yy++) {
    for (let xx = 0; xx < 16; xx++) {
      if (!(CORAZON[yy * 2 + (xx >> 3)] & (0x80 >> (xx & 7)))) continue;
      for (let a = 0; a < escala; a++) for (let b = 0; b < escala; b++) punto(x0 + xx * escala + a, y0 + yy * escala + b);
    }
  }
}

const CUADRO = 40;
const CRUCE = 1800;
const LATIDO = 1500;
const izq = [];
const der = [];
// Cruce: de x = 264 (fuera de la derecha) a x = 56 (centro de la izquierda), frenando al final.
for (let t = 0; t < CRUCE; t += CUADRO) {
  const f = t / CRUCE;
  const suave = 1 - (1 - f) * (1 - f);
  const x = 264 - Math.round(208 * suave);
  const { izq: a, der: b } = D.partirEscena(escenaCon((p) => corazon(p, x, 25, 1)));
  izq.push({ dur: CUADRO, bitmap: a });
  der.push({ dur: CUADRO, bitmap: b });
}
// Latido en el centro de la izquierda (más grande cada 250 ms); la derecha queda en negro.
for (let t = 0; t < LATIDO; t += 250) {
  const escala = (t / 250) % 2 ? 2 : 1;
  const w = 16 * escala;
  const h = 14 * escala;
  const { izq: a, der: b } = D.partirEscena(escenaCon((p) => corazon(p, 64 - w / 2, 32 - h / 2, escala)));
  izq.push({ dur: 250, bitmap: a });
  der.push({ dur: 250, bitmap: b });
}

const duo = D.armarDuo({
  pistas: [
    { tv: 'izq', inicio: 0, cuadros: D.prepararCuadros(izq) },
    { tv: 'der', inicio: 0, cuadros: D.prepararCuadros(der) },
  ],
  sonido: { tv: 'izq', inicio: CRUCE, notas: D.SONIDOS.corazon.notas },
});
const paquete = await D.empaquetarDuo(duo, { nombre: 'Prueba', clave: 'prueba', codificarMusical });
fs.writeFileSync(salida, D.cabeceraC(duo, paquete).split('\n').join('\r\n'));
console.log(`${salida}: ${duo.duracion} ms; m1 izquierda ${paquete.izq.bytes} bytes, derecha ${paquete.der.bytes} bytes`);
