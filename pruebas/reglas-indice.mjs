// Reglas de las listas livianas de la Galería (H-12): imagenes_indice y animaciones_indice.
// Uso: npx firebase emulators:exec --only database --project demo-indice "node reglas-indice.mjs"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, get, update, remove } = require('firebase/database');

const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-indice', database: { rules: REGLAS, host, port: Number(puerto) } });
const sembrar = () => env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    administradores: { ADM: true },
    usuarios: {
      U: { imagenes: { vieja: { datos: 'AA', ancho: 128, alto: 64 } }, cuotas: { usados: 1, ultimo: 'i:vieja' } },
      V: {}
    }
  });
});
await sembrar();

let mal = 0;
async function probar(nombre, p, debe) {
  let ok; let detalle = '';
  try { await p; ok = true; } catch (e) { ok = false; detalle = String(e.message).slice(0, 45); }
  const bien = ok === debe; if (!bien) mal++;
  console.log(`${bien ? 'OK   ' : 'MAL  '} ${ok ? 'PERMITIDO' : 'DENEGADO '} (esperado ${debe ? 'permitido' : 'denegado'}) ${nombre} ${detalle}`);
}
const ctx = (uid, extra = {}) => env.authenticatedContext(uid, extra).database();
const u = ctx('U', { email_verified: true });
const uSinVerificar = ctx('U', { email_verified: false });
const v = ctx('V', { email_verified: true });
const adm = ctx('ADM', { email_verified: true });
const anonimo = env.unauthenticatedContext().database();

const imagen = { datos: 'AAAA', ancho: 128, alto: 64, preprocesada: 'data:image/png;base64,AAAA', meta: { origen: 'subida', umbral: 128 } };
const indiceImagen = { datos: 'AAAA', ancho: 128, alto: 64, editable: true, meta: { origen: 'subida', umbral: 128 } };
const animacion = { ancho: 128, alto: 64, cuadros: [{ datos: 'AAAA', dur: 100 }, { datos: 'BBBB', dur: 100 }], meta: { origen: 'gif' } };
const indiceAnim = { ancho: 128, alto: 64, cantidad: 2, miniatura: 'AAAA', meta: { origen: 'gif' } };

// --- Crear: el índice solo existe junto al elemento ---
await probar('crear imagen + su índice en una sola escritura', update(ref(u), { 'usuarios/U/imagenes/nueva': imagen, 'usuarios/U/imagenes_indice/nueva': indiceImagen, 'usuarios/U/cuotas/usados': 2, 'usuarios/U/cuotas/ultimo': 'i:nueva' }), true);
await probar('índice de imagen SIN el elemento', set(ref(u, 'usuarios/U/imagenes_indice/huerfana'), indiceImagen), false);
await probar('crear animación + su índice en una sola escritura', update(ref(u), { 'usuarios/U/animaciones/gato': animacion, 'usuarios/U/animaciones_indice/gato': indiceAnim, 'usuarios/U/cuotas/usados': 3, 'usuarios/U/cuotas/gifs': 1, 'usuarios/U/cuotas/ultimo': 'a:gato' }), true);
await probar('índice de animación SIN el elemento', set(ref(u, 'usuarios/U/animaciones_indice/fantasma'), indiceAnim), false);
await probar('reemplazar imagen existente y su índice', update(ref(u), { 'usuarios/U/imagenes/nueva': imagen, 'usuarios/U/imagenes_indice/nueva': indiceImagen }), true);
await probar('relleno de un elemento anterior al índice (la imagen "vieja")', update(ref(u), { 'usuarios/U/imagenes_indice/vieja': { datos: 'AA', ancho: 128, alto: 64 } }), true);
// --- Forma ---
await probar('índice de imagen con campo de más', update(ref(u), { 'usuarios/U/imagenes_indice/nueva': Object.assign({ x: 1 }, indiceImagen) }), false);
await probar('índice de imagen sin datos', update(ref(u), { 'usuarios/U/imagenes_indice/nueva': { ancho: 128, alto: 64 } }), false);
await probar('índice de imagen con preprocesada (no cabe: es lo pesado)', update(ref(u), { 'usuarios/U/imagenes_indice/nueva': Object.assign({ preprocesada: 'x' }, indiceImagen) }), false);
await probar('índice de imagen con editable que no es booleano', update(ref(u), { 'usuarios/U/imagenes_indice/nueva': Object.assign({}, indiceImagen, { editable: 'si' }) }), false);
await probar('meta con una clave no permitida', update(ref(u), { 'usuarios/U/imagenes_indice/nueva': Object.assign({}, indiceImagen, { meta: { rara: 1 } }) }), false);
await probar('índice de animación con 1001 cuadros', update(ref(u), { 'usuarios/U/animaciones_indice/gato': Object.assign({}, indiceAnim, { cantidad: 1001 }) }), false);
await probar('índice de animación con miniatura de más de 2048', update(ref(u), { 'usuarios/U/animaciones_indice/gato': Object.assign({}, indiceAnim, { miniatura: 'A'.repeat(2049) }) }), false);
await probar('índice de animación con campo de más', update(ref(u), { 'usuarios/U/animaciones_indice/gato': Object.assign({ cuadros: [{ datos: 'A', dur: 1 }] }, indiceAnim) }), false);
// --- Quién ---
await probar('otra cuenta escribe mi índice', update(ref(v), { 'usuarios/U/imagenes_indice/nueva': indiceImagen }), false);
await probar('otra cuenta lee mi índice', get(ref(v, 'usuarios/U/imagenes_indice')), false);
await probar('sin sesión lee mi índice', get(ref(anonimo, 'usuarios/U/imagenes_indice')), false);
await probar('yo leo mi índice', get(ref(u, 'usuarios/U/imagenes_indice')), true);
await probar('sin correo verificado NO crea índices', update(ref(uSinVerificar), { 'usuarios/U/imagenes_indice/nueva': indiceImagen }), false);
await probar('sin correo verificado SÍ puede borrar un índice', remove(ref(uSinVerificar, 'usuarios/U/imagenes_indice/nueva')), true);
// --- Borrar ---
await probar('borrar imagen + su índice + contador en una escritura', update(ref(u), { 'usuarios/U/imagenes/nueva': null, 'usuarios/U/imagenes_indice/nueva': null, 'usuarios/U/cuotas/usados': 2, 'usuarios/U/cuotas/ultimo': 'i:nueva' }), true);
// --- Biblioteca ---
await probar('administrador escribe la biblioteca: imagen + índice', update(ref(adm), { 'biblioteca/imagenes/logo': { datos: 'AAAA', ancho: 128, alto: 64, preprocesada: 'x' }, 'biblioteca/imagenes_indice/logo': { datos: 'AAAA', ancho: 128, alto: 64, meta: { origen: 'biblioteca', cualquiera: 'cosa' } } }), true);
await probar('administrador escribe la biblioteca: animación + índice', update(ref(adm), { 'biblioteca/animaciones/baile': animacion, 'biblioteca/animaciones_indice/baile': indiceAnim }), true);
await probar('una cuenta normal NO escribe la biblioteca (índice)', set(ref(u, 'biblioteca/imagenes_indice/mio'), { datos: 'AAAA', ancho: 128, alto: 64 }), false);
await probar('una cuenta normal lee el índice de la biblioteca', get(ref(u, 'biblioteca/imagenes_indice')), true);
await probar('una cuenta normal lee el índice de animaciones de la biblioteca', get(ref(v, 'biblioteca/animaciones_indice')), true);
await probar('sin sesión NO lee la biblioteca', get(ref(anonimo, 'biblioteca/animaciones_indice')), false);
await probar('índice de la biblioteca con campo de más', set(ref(adm, 'biblioteca/animaciones_indice/malo'), Object.assign({ extra: 1 }, indiceAnim)), false);
// --- Baja de cuenta ---
await probar('la baja de cuenta borra todo el nodo (con índices)', remove(ref(u, 'usuarios/U')), true);

console.log(`\nResultado: ${mal === 0 ? 'todo bien' : mal + ' mal'}`);
await env.cleanup();
process.exit(0);
