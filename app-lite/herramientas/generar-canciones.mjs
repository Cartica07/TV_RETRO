// Genera el catalogo de canciones que va DENTRO de la app Lite (app-lite/canciones/):
// un .m1 por cancion (el mismo formato de los musicales de la Pro) y indice.json.
// Lee los .ino del repo de referencia Canciones-ino (SOLO LECTURA) y usa, sin modificarlos,
// el interprete y la compresion del panel (js/inoMusical.js y js/compresion.js).
// Uso (Node 22):  node --experimental-default-type=module herramientas/generar-canciones.mjs [carpeta de .ino]
// Los ids (16 bits) se asignan una vez y se conservan: la TV guarda las canciones por id.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const panelJs = path.join(raiz, '..', 'js') + path.sep;
const entrada = process.argv[2] || 'C:/Proyectos/Canciones-ino/Canciones en ino';
const salida = path.join(raiz, 'canciones');

const { grabarIno, nombreDelIno } = await import(pathToFileURL(panelJs + 'inoMusical.js').href);
const { codificarMusical } = await import(pathToFileURL(panelJs + 'compresion.js').href);

fs.mkdirSync(salida, { recursive: true });
const rutaIndice = path.join(salida, 'indice.json');
const previo = fs.existsSync(rutaIndice) ? JSON.parse(fs.readFileSync(rutaIndice, 'utf8')) : [];
const idPorClave = new Map(previo.map((c) => [c.clave, c.id]));
let siguiente = previo.reduce((m, c) => Math.max(m, c.id), 0) + 1;

const limpiar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

const archivos = fs.readdirSync(entrada).filter((f) => f.toLowerCase().endsWith('.ino')).sort();
const indice = [];
for (const f of archivos) {
  const clave = limpiar(f.replace(/\.ino$/i, ''));
  try {
    const texto = fs.readFileSync(path.join(entrada, f), 'utf8');
    const grab = grabarIno(texto);
    const cod = await codificarMusical(grab);
    const bytes = Buffer.from(cod.datos, 'base64');
    let nombre = (nombreDelIno(texto) || '').trim();
    if (!nombre) nombre = f.replace(/\.ino$/i, '').replace(/[_]+/g, ' ');
    const id = idPorClave.get(clave) ?? siguiente++;
    fs.writeFileSync(path.join(salida, clave + '.m1'), bytes);
    indice.push({ id, clave, nombre, archivo: clave + '.m1', bytes: bytes.length, duracion: Math.round(grab.duracion / 1000) });
  } catch (e) {
    console.error(`FALLO ${f}: ${String(e.message || e).slice(0, 100)}`);
  }
}
indice.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
fs.writeFileSync(rutaIndice, JSON.stringify(indice, null, 1) + '\n');
const total = indice.reduce((s, c) => s + c.bytes, 0);
console.log(`${indice.length} canciones, ${(total / 1024).toFixed(0)} KB en total, ids hasta ${siguiente - 1}`);
