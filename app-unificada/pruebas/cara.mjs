// Dibujante de caras de reloj (src/cara.js, receta R1: docs/receta-r1.md). Sin navegador.
//   node pruebas/cara.mjs             comprueba el dibujante (recetas dañadas, tipos desconocidos, cada elemento…)
//   node pruebas/cara.mjs --ver N     dibuja la receta de prueba N en texto
//   node pruebas/cara.mjs --firmware  además escribe pruebas_cara.h (copia exacta en OLED_Remota/ y OLED_Lite/): las recetas
//                                     de prueba, los datos fijos y el CRC32 que la app calcula; la TV las dibuja con su prueba
//                                     por el monitor serie (TVRETRO_PROBAR_CARAS) y dice si coinciden punto por punto.
// Primero: node construir.mjs (la prueba usa www/js/cara.js, junto a fonts.js y fuentesTexto.js de la Pro).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const m = await import(pathToFileURL(path.join(aqui, '..', 'www', 'js', 'cara.js')).href);
const { dibujarCara, crcPantalla, armarReceta, leerReceta, RECETA_CARA_1, TIPO } = m;

let fallas = 0;
function informe(nombre, ok, detalle = '') {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) fallas++;
}

// Datos fijos (los mismos que usa la TV en su prueba): martes 24/11/2026, 9:05.
const DATOS_PRO = { hora: 9, minuto: 5, dia: 24, mes: 11, anio: 2026, diaSemana: 2, esPro: true, wifiConectado: true, wifiBarras: 3,
  conexionOk: true, mensaje: true, alarmaActiva: true, proxAlarma: { hora: 7, minuto: 30 }, clima: { temp: 24, icono: 1 }, bateria: 3, bateriaPct: 75 };
const DATOS_LITE = { ...DATOS_PRO, esPro: false, clima: null, hora: 21, minuto: 47 };
const DATOS_SIN_WIFI = { ...DATOS_PRO, wifiConectado: false, conexionOk: false, mensaje: false, alarmaActiva: false, proxAlarma: null, bateria: 0 };

const utf8 = (s) => [...new TextEncoder().encode(s)];
const txt = (x, y, color, fuente, tamano, alin, s) => ({ tipo: TIPO.TEXTO, datos: [x, y, color, fuente, tamano, alin, utf8(s).length, ...utf8(s)] });
const cuenta = (x, y, fuente, tamano, alin, anio, mes, dia, formato) => ({ tipo: TIPO.CUENTA, datos: [x, y, 0, fuente, tamano, alin, anio & 255, anio >> 8, mes, dia, formato] });

const fondo = new Uint8Array(1024);
for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) if ((x + y) % 7 === 0) fondo[y * 16 + (x >> 3)] |= 0x80 >> (x & 7);

// ---- Recetas de prueba (las mismas que dibuja la TV) ----
const PRUEBAS = [
  { nombre: 'Cara 1 (Pro)', receta: RECETA_CARA_1, datos: 'pro' },
  { nombre: 'Cara 1 (Lite)', receta: RECETA_CARA_1, datos: 'lite' },
  { nombre: 'Cara 1 (sin Wi-Fi ni mensaje)', receta: RECETA_CARA_1, datos: 'sinwifi' },
  {
    nombre: 'clásica: hora, fecha, día, texto, campanas, rectángulos y línea', datos: 'pro',
    receta: armarReceta({ elementos: [
      { tipo: TIPO.HORA, datos: [0, 0, 0, 0, 2, 0, 3] },
      { tipo: TIPO.AMPM, datos: [127, 0, 0, 0, 1, 2] },
      { tipo: TIPO.FECHA, datos: [0, 18, 0, 0, 1, 0, 1] },
      { tipo: TIPO.FECHA, datos: [64, 18, 0, 0, 1, 1, 2] },
      { tipo: TIPO.FECHA, datos: [127, 18, 0, 0, 1, 2, 3] },
      { tipo: TIPO.DIA, datos: [0, 28, 0, 0, 1, 0, 0] },
      { tipo: TIPO.DIA, datos: [127, 28, 0, 0, 1, 2, 1] },
      txt(64, 38, 0, 0, 1, 1, '¡Hola ñandú! ¿Sí? 24°'),
      { tipo: TIPO.CAMPANA, datos: [0, 48, 0, 0] },
      { tipo: TIPO.CAMPANA, datos: [12, 48, 0, 1] },
      { tipo: TIPO.CAMPANA, datos: [24, 48, 0, 2] },
      { tipo: TIPO.RECTANGULO, datos: [40, 48, 0, 12, 10, 0, 0] },
      { tipo: TIPO.RECTANGULO, datos: [55, 48, 0, 12, 10, 1, 0] },
      { tipo: TIPO.RECTANGULO, datos: [70, 48, 0, 16, 14, 0, 4] },
      { tipo: TIPO.RECTANGULO, datos: [90, 48, 0, 16, 14, 1, 5] },
      { tipo: TIPO.LINEA, datos: [110, 63, 0, 127, 46] },
    ] }),
  },
  {
    nombre: 'Sans y Serif: hora grande, próxima alarma, clima, cuentas y batería', datos: 'pro',
    receta: armarReceta({ elementos: [
      { tipo: TIPO.HORA, datos: [64, 0, 0, 1, 5, 1, 0] },
      { tipo: TIPO.FECHA, datos: [127, 26, 0, 3, 2, 2, 0] },
      { tipo: TIPO.DIA, datos: [0, 26, 0, 2, 1, 0, 0] },
      { tipo: TIPO.PROXIMA_ALARMA, datos: [0, 40, 0, 1, 1, 0, 1] },
      { tipo: TIPO.CLIMA, datos: [127, 40, 0, 0, 1, 2, 1] },
      cuenta(0, 54, 4, 1, 0, 2026, 12, 24, 0),
      cuenta(70, 54, 0, 1, 0, 2026, 11, 25, 1),
      cuenta(100, 54, 0, 1, 0, 2026, 11, 24, 0),
      cuenta(127, 54, 0, 1, 2, 2026, 11, 23, 0),
      { tipo: TIPO.BATERIA, datos: [96, 26, 0, 0, 1] },
    ] }),
  },
  {
    nombre: 'agujas, íconos de izquierda a derecha y otros estilos', datos: 'pro',
    receta: armarReceta({ elementos: [
      { tipo: TIPO.AGUJAS, datos: [64, 32, 0, 30, 2] },
      { tipo: TIPO.AGUJAS, datos: [112, 48, 0, 12, 1] },
      { tipo: TIPO.ESTADO, datos: [2, 0, 0, 1, 2, 1, 0] },
      { tipo: TIPO.BATERIA, datos: [0, 50, 0, 1, 0] },
      { tipo: TIPO.PROXIMA_ALARMA, datos: [0, 30, 0, 0, 1, 0, 3] },
    ] }),
  },
  {
    nombre: 'fondo, color negro, tipo desconocido y elemento cortado', datos: 'pro',
    receta: armarReceta({ fondo, elementos: [
      { tipo: TIPO.RECTANGULO, datos: [10, 10, 0, 108, 44, 1, 6] },
      { tipo: TIPO.HORA, datos: [64, 18, 1, 0, 3, 1, 0] },
      { tipo: 99, datos: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { tipo: TIPO.FECHA, datos: [20, 44] },
      { tipo: TIPO.LINEA, datos: [0, 0, 1, 127, 63] },
    ] }),
  },
];
const DATOS = { pro: DATOS_PRO, lite: DATOS_LITE, sinwifi: DATOS_SIN_WIFI };

function aTexto(p) {
  let s = '';
  for (let y = 0; y < 64; y++) { let f = ''; for (let x = 0; x < 128; x++) f += p[y * 128 + x] ? '#' : '.'; s += f + '\n'; }
  return s;
}
const encendidos = (p) => p.reduce((a, v) => a + v, 0);
const dibujar = (prueba) => dibujarCara(prueba.receta, DATOS[prueba.datos]);

const iVer = process.argv.indexOf('--ver');
if (iVer > 0) {
  const pr = PRUEBAS[Number(process.argv[iVer + 1]) || 0];
  console.log(pr.nombre); console.log(aTexto(dibujar(pr)));
  process.exit(0);
}

// ---- Las recetas dañadas se rechazan (la TV dibuja la Cara 1) ----
const r1 = RECETA_CARA_1;
informe('una receta sana se lee', leerReceta(r1) !== null);
informe('sin "R1" al principio: dañada', dibujarCara(Uint8Array.from([0x52, 0x32, 1, 0, 0]), DATOS_PRO) === null);
informe('cortada a la mitad de un elemento: dañada', dibujarCara(r1.subarray(0, r1.length - 2), DATOS_PRO) === null);
informe('dice que trae fondo y no lo trae: dañada', dibujarCara(Uint8Array.from([0x52, 0x31, 1, 1, 0]), DATOS_PRO) === null);
informe('más de 24 elementos: dañada', dibujarCara(Uint8Array.from([0x52, 0x31, 1, 0, 25, ...Array(25).fill([7, 0]).flat()]), DATOS_PRO) === null);
informe('más de 2048 bytes: dañada', dibujarCara(new Uint8Array(2049).fill(0).map((v, i) => (i === 0 ? 0x52 : i === 1 ? 0x31 : 0)), DATOS_PRO) === null);
informe('vacía (0 elementos): se dibuja en negro', encendidos(dibujarCara(Uint8Array.from([0x52, 0x31, 1, 0, 0]), DATOS_PRO)) === 0);
informe('una versión menor más nueva (2) también se dibuja', dibujarCara(Uint8Array.from([0x52, 0x31, 2, 0, 0]), DATOS_PRO) !== null);

// ---- Tipos desconocidos y elementos cortos ----
const sinDesconocido = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [64, 24, 0, 0, 3, 1, 0] }] });
const conDesconocido = armarReceta({ elementos: [{ tipo: 200, datos: [9, 9, 9] }, { tipo: TIPO.HORA, datos: [64, 24, 0, 0, 3, 1, 0] }, { tipo: 77, datos: [] }] });
informe('un tipo desconocido se salta y el resto se dibuja igual', crcPantalla(dibujarCara(sinDesconocido, DATOS_PRO)) === crcPantalla(dibujarCara(conDesconocido, DATOS_PRO)));
const corto = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [10, 10] }] });
const completo = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [10, 10, 0, 0, 1, 0, 0] }] });
informe('a un elemento le faltan bytes: valores por defecto', crcPantalla(dibujarCara(corto, DATOS_PRO)) === crcPantalla(dibujarCara(completo, DATOS_PRO)));
const largo = armarReceta({ elementos: [{ tipo: TIPO.HORA, datos: [10, 10, 0, 0, 1, 0, 0, 55, 66, 77] }] });
informe('a un elemento le sobran bytes: se ignoran', crcPantalla(dibujarCara(largo, DATOS_PRO)) === crcPantalla(dibujarCara(completo, DATOS_PRO)));

// ---- La Cara 1 en receta = el reloj de hoy (posiciones de pantalla.cpp / reloj_lite.cpp) ----
const pPro = dibujar(PRUEBAS[0]);
const en = (p, x, y) => p[y * 128 + x] === 1;
const columnas = (p, y0, y1) => { const c = new Set(); for (let y = y0; y <= y1; y++) for (let x = 0; x < 128; x++) if (en(p, x, y)) c.add(x); return [...c].sort((a, b) => a - b); };
const arriba = columnas(pPro, 0, 9);
informe('Cara 1 Pro: barras de 110 a 124, círculo de 99 a 105 y sobre de 84 a 94', arriba.includes(110) && arriba.includes(124) && !arriba.includes(125) && arriba.includes(99) && arriba.includes(105) && arriba.includes(84) && arriba.includes(94) && !arriba.some((x) => x > 13 && x < 84), arriba.filter((x) => x > 13).join(','));
informe('Cara 1: la hora empieza en x = 28 y la fecha en x = 34', columnas(pPro, 24, 47)[0] === 28 && columnas(pPro, 54, 61)[0] === 34, `${columnas(pPro, 24, 47)[0]} / ${columnas(pPro, 54, 61)[0]}`);
const pLite = dibujar(PRUEBAS[1]);
const arribaLite = columnas(pLite, 0, 9).filter((x) => x > 20);
informe('Cara 1 Lite: solo el sobre, de 114 a 124', arribaLite[0] === 114 && arribaLite[arribaLite.length - 1] === 124, arribaLite.join(','));
const sinW = columnas(dibujar(PRUEBAS[2]), 0, 9).filter((x) => x > 20);
informe('sin Wi-Fi: la X ocupa 110 a 118 (como hoy) y el círculo hueco', sinW[0] === 99 && sinW.includes(110) && sinW.includes(118) && !sinW.includes(119));

// ---- Cada receta de prueba dibuja algo ----
for (const pr of PRUEBAS) informe(`dibuja: ${pr.nombre}`, encendidos(dibujar(pr)) > 50, `CRC ${crcPantalla(dibujar(pr)).toString(16).padStart(8, '0')}`);

// ---- Para las TV ----
if (process.argv.includes('--firmware')) {
  const datosC = (d) => `{ ${d.hora}, ${d.minuto}, ${d.dia}, ${d.mes}, ${d.anio}, ${d.diaSemana}, ${d.esPro}, ${d.wifiConectado}, ${d.wifiBarras}, ${d.conexionOk}, ${d.mensaje}, ${d.alarmaActiva}, ${d.proxAlarma ? d.proxAlarma.hora : -1}, ${d.proxAlarma ? d.proxAlarma.minuto : 0}, ${!!d.clima}, ${d.clima ? d.clima.temp : 0}, ${d.clima ? d.clima.icono : 0}, ${d.bateria}, ${d.bateriaPct} }`;
  let h = '// GENERADO por app-unificada/pruebas/cara.mjs --firmware: no editar a mano. Copia EXACTA en OLED_Remota/ y OLED_Lite/.\n';
  h += '// Recetas de prueba del dibujante de caras con el CRC32 de la pantalla que calcula la app (src/cara.js). La TV las dibuja con\n';
  h += '// TVRETRO_PROBAR_CARAS (monitor serie) y compara: si coincide, la TV y la vista previa de la app dibujan punto por punto igual.\n';
  h += '#ifndef PRUEBAS_CARA_H\n#define PRUEBAS_CARA_H\n\n#include "cara.h"\n\n';
  PRUEBAS.forEach((pr, i) => { h += `static const uint8_t PRUEBA_CARA_${i}[] = { ${Array.from(pr.receta).join(', ')} };\n`; });
  h += '\nstruct PruebaCara\n{\n    const char *nombre;\n    const uint8_t *receta;\n    uint16_t largo;\n    DatosCara datos;\n    uint32_t crc;\n};\n\n';
  h += `static const PruebaCara PRUEBAS_CARA[] = {\n${PRUEBAS.map((pr, i) => `    { ${JSON.stringify(pr.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}, PRUEBA_CARA_${i}, ${pr.receta.length}, ${datosC(DATOS[pr.datos])}, 0x${crcPantalla(dibujar(pr)).toString(16).padStart(8, '0')}UL },`).join('\n')}\n};\n\n#endif\n`;
  for (const carpeta of ['OLED_Remota', 'OLED_Lite']) fs.writeFileSync(path.join('C:/Proyectos/TV_RETRO-firmware', carpeta, 'pruebas_cara.h'), h.replace(/\n/g, '\r\n'));
  console.log('escrito pruebas_cara.h (Pro y Lite)');
}

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien');
process.exitCode = fallas ? 1 : 0;
