// Tres caras propuestas por Claude para empezar el catálogo (2026-11-24). node herramientas/editor-caras/caras-sugeridas.mjs [--ver]
// Usa el dibujante de la app (www/js/cara.js: primero node construir.mjs). Con --json escribe caras-sugeridas.json (receta en Base64)
// para subirlas al catálogo con subir-caras.cjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { armarReceta, dibujarCara, TIPO } = await import(pathToFileURL(path.join(aqui, '..', '..', 'www', 'js', 'cara.js')).href);

// Fuentes: 0 clásica, 1 Sans, 2 Sans negrita, 3 Serif, 4 Serif cursiva. Alineación: 0 desde x, 1 centrada, 2 hasta x.
// Íconos con los estilos elegidos por el dueño: Wi-Fi abanico (1), mensaje burbuja (2), conexión nube (1).
export const CARAS = [
  {
    clave: 'grande', nombre: 'Grande', orden: 1,
    elementos: [
      { tipo: TIPO.ESTADO, datos: [125, 0, 0, 1, 2, 1, 1] },
      { tipo: TIPO.CAMPANA, datos: [2, 0, 0, 0] },
      { tipo: TIPO.HORA, datos: [64, 13, 0, 2, 5, 1, 0] },
      { tipo: TIPO.AMPM, datos: [124, 30, 0, 0, 1, 2] },
      { tipo: TIPO.FECHA, datos: [64, 50, 0, 1, 1, 1, 3] }, // y=50: en 54 la fecha se cortaba abajo (2026-11-24)
    ],
  },
  {
    clave: 'agujas', nombre: 'Agujas', orden: 2,
    elementos: [
      { tipo: TIPO.AGUJAS, datos: [31, 31, 0, 30, 2] },
      { tipo: TIPO.DIA, datos: [96, 3, 0, 2, 1, 1, 0] }, // tamaño 1: en 2 "Miércoles" y "Sábado" no cabían (2026-11-24)
      { tipo: TIPO.FECHA, datos: [96, 22, 0, 0, 1, 1, 2] },
      { tipo: TIPO.LINEA, datos: [72, 38, 0, 120, 38] },
      { tipo: TIPO.PROXIMA_ALARMA, datos: [96, 45, 0, 0, 1, 1, 1] },
      { tipo: TIPO.ESTADO, datos: [125, 54, 0, 1, 2, 1, 1] },
    ],
  },
  {
    clave: 'clima', nombre: 'Clima', orden: 3,
    elementos: [
      { tipo: TIPO.RECTANGULO, datos: [0, 0, 0, 128, 64, 0, 6] },
      { tipo: TIPO.HORA, datos: [64, 0, 0, 3, 4, 1, 0] },
      { tipo: TIPO.AMPM, datos: [119, 5, 0, 0, 1, 2] },
      { tipo: TIPO.LINEA, datos: [8, 35, 0, 119, 35] },
      { tipo: TIPO.CLIMA, datos: [8, 44, 0, 0, 1, 0, 1] },
      { tipo: TIPO.FECHA, datos: [119, 45, 0, 0, 1, 2, 3] },
    ],
  },
];

const datos = { hora: 9, minuto: 5, dia: 24, mes: 11, anio: 2026, diaSemana: 2, esPro: true, wifiConectado: true, wifiBarras: 3,
  conexionOk: true, mensaje: true, alarmaActiva: true, proxAlarma: { hora: 6, minuto: 30 }, clima: { temp: 24, icono: 1 }, bateria: 0, bateriaPct: 0 };

for (const c of CARAS) {
  c.receta = armarReceta({ elementos: c.elementos });
  c.pantalla = dibujarCara(c.receta, datos);
}

if (process.argv.includes('--ver')) {
  for (const c of CARAS) {
    console.log(`== ${c.nombre} (${c.receta.length} bytes)`);
    for (let y = 0; y < 64; y++) { let f = ''; for (let x = 0; x < 128; x++) f += c.pantalla[y * 128 + x] ? '#' : ' '; console.log('|' + f + '|'); }
  }
}
if (process.argv.includes('--json')) {
  const salida = CARAS.map((c) => ({ clave: c.clave, nombre: c.nombre, orden: c.orden, datos: Buffer.from(c.receta).toString('base64'),
    pantalla: Buffer.from(Array.from({ length: 1024 }, (_, i) => { let b = 0; for (let k = 0; k < 8; k++) if (c.pantalla[Math.floor(i / 16) * 128 + (i % 16) * 8 + k]) b |= 0x80 >> k; return b; })).toString('base64') }));
  fs.writeFileSync(path.join(aqui, 'caras-sugeridas.json'), JSON.stringify(salida, null, 1));
  console.log('escrito caras-sugeridas.json');
}
