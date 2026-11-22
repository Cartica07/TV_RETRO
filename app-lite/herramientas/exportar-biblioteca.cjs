// Exporta (SOLO LECTURA) la biblioteca predeterminada de la app Pro (Firebase: biblioteca/imagenes y biblioteca/animaciones)
// a app-lite/predeterminadas/, para que la app Lite la lleve DENTRO y funcione sin internet.
// No escribe nada en Firebase. La clave de servicio NO está en el repo: se pasa la ruta por la variable CLAVE_SERVICIO
// (se genera en la consola de Firebase y se borra al terminar).
//
//   CLAVE_SERVICIO=<ruta a la clave .json> node app-lite/herramientas/exportar-biblioteca.cjs
//
// Salida:
//   predeterminadas/imagenes_indice.json     { clave: { datos, ancho, alto, editable, meta, archivo } }
//   predeterminadas/imagenes/<n>.json        { datos, ancho, alto, meta, preprocesada }   (la imagen completa)
//   predeterminadas/animaciones_indice.json  { clave: { ancho, alto, cantidad, miniatura, meta, archivo } }
//   predeterminadas/animaciones/<n>.json     { ancho, alto, cuadros: [{datos, dur}], meta }
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const salida = path.join(raiz, 'predeterminadas');
const ruta = process.env.CLAVE_SERVICIO;
if (!ruta || !fs.existsSync(ruta)) {
  console.error('Falta CLAVE_SERVICIO (ruta a la clave de servicio de Firebase).');
  process.exit(1);
}

const requerir = require('module').createRequire(path.join(raiz, '..', 'herramientas', 'package.json'));
const { initializeApp, cert } = requerir('firebase-admin/app');
const { getDatabase } = requerir('firebase-admin/database');

const app = initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(ruta, 'utf8'))),
  databaseURL: 'https://lorenita-6ad1e-default-rtdb.firebaseio.com',
});
const db = getDatabase(app);

const arreglo = (cuadros) => (Array.isArray(cuadros) ? cuadros : Object.keys(cuadros || {}).sort((a, b) => Number(a) - Number(b)).map((k) => cuadros[k]));

(async () => {
  fs.mkdirSync(path.join(salida, 'imagenes'), { recursive: true });
  fs.mkdirSync(path.join(salida, 'animaciones'), { recursive: true });

  // ---- Imágenes ----
  const imagenes = (await db.ref('biblioteca/imagenes').get()).val() || {};
  const indiceImg = {};
  let n = 0;
  for (const [clave, v] of Object.entries(imagenes).sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    n++;
    const archivo = `imagenes/${n}.json`;
    fs.writeFileSync(path.join(salida, archivo), JSON.stringify({ datos: v.datos, ancho: v.ancho, alto: v.alto, meta: v.meta || {}, preprocesada: v.preprocesada || null }));
    const i = { datos: String(v.datos || ''), ancho: Number(v.ancho) || 0, alto: Number(v.alto) || 0, editable: !!v.preprocesada, archivo };
    if (v.meta && Object.keys(v.meta).length) i.meta = v.meta;
    indiceImg[clave] = i;
  }
  fs.writeFileSync(path.join(salida, 'imagenes_indice.json'), JSON.stringify(indiceImg));

  // ---- Animaciones ----
  const animaciones = (await db.ref('biblioteca/animaciones').get()).val() || {};
  const indiceAni = {};
  n = 0;
  for (const [clave, v] of Object.entries(animaciones).sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    n++;
    const cuadros = arreglo(v.cuadros);
    const archivo = `animaciones/${n}.json`;
    fs.writeFileSync(path.join(salida, archivo), JSON.stringify({ ancho: v.ancho, alto: v.alto, cuadros, meta: v.meta || {} }));
    const i = { ancho: Number(v.ancho) || 0, alto: Number(v.alto) || 0, cantidad: cuadros.length, miniatura: String((cuadros[0] && cuadros[0].datos) || ''), archivo };
    if (v.meta && Object.keys(v.meta).length) i.meta = v.meta;
    indiceAni[clave] = i;
  }
  fs.writeFileSync(path.join(salida, 'animaciones_indice.json'), JSON.stringify(indiceAni));

  console.log(`${Object.keys(indiceImg).length} imágenes y ${Object.keys(indiceAni).length} animaciones exportadas a app-lite/predeterminadas/`);
  await app.delete();
})().catch((e) => { console.error('No se pudo exportar:', e.message); process.exit(1); });
