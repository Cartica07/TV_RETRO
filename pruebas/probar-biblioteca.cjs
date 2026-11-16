// Prueba herramientas/mover-a-biblioteca.cjs con los emuladores:
//   firebase emulators:exec --only auth,database "node probar-biblioteca.cjs"
'use strict';
process.env.NODE_PATH = __dirname + '/node_modules'; require('module').Module._initPaths();
const fs = require('fs');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const [H, P] = DB.split(':');
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || require('path').resolve(__dirname, '../database.rules.json'), 'utf8');
if (!fs.existsSync(require('path').resolve(__dirname, '../herramientas/node_modules'))) {
  console.log('Resultado: 0 bien, 0 mal (omitida: falta "npm ci" en herramientas/)');
  process.exit(0);
}
let ok = 0, mal = 0;
const verifica = (n, c, d = '') => { c ? ok++ : mal++; console.log(`${c ? 'OK  ' : 'MAL '} ${n}${d ? ' — ' + d : ''}`); };
const IMG = { datos: 'ab', ancho: 128, alto: 64, meta: { origen: 'upload' } };
const ANIM = { ancho: 128, alto: 64, cuadros: [{ datos: 'ab', dur: 100 }], meta: { origen: 'gif' } };

(async () => {
  const entorno = await initializeTestEnvironment({ projectId: 'demo-tvretro', database: { rules: REGLAS, host: H, port: Number(P) } });
  await entorno.clearDatabase();
  const auth = getAuth(initializeApp({ projectId: 'demo-tvretro' }, 'prueba-bib'));
  const dueno = await auth.createUser({ email: 'dueno@correo.com', password: 'secreta1' });
  const otro = await auth.createUser({ email: 'otro@correo.com', password: 'secreta1' });
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('administradores/' + dueno.uid).set(true);
    await db.ref('usuarios/' + dueno.uid + '/imagenes').set({ gato: IMG, perro: IMG });
    await db.ref('usuarios/' + dueno.uid + '/animaciones').set({ gif1: ANIM });
    await db.ref('usuarios/' + dueno.uid + '/cuotas').set({ usados: 3, ultimo: 'i:gato' });
  });

  const { principal } = require('../herramientas/mover-a-biblioteca.cjs');
  const r1 = await principal(['--emulador', '--correo', 'dueno@correo.com']);
  let d; await entorno.withSecurityRulesDisabled(async (ctx) => { d = (await ctx.database().ref('/').get()).val(); });
  verifica('copia las imágenes y animaciones a la biblioteca', r1.imagenes === 2 && r1.animaciones === 1 && d.biblioteca.imagenes.gato && d.biblioteca.animaciones.gif1);
  verifica('sin --borrar-personales deja el catálogo personal como estaba', Object.keys(d.usuarios[dueno.uid].imagenes).length === 2 && d.usuarios[dueno.uid].cuotas.usados === 3);
  fs.rmSync(r1.respaldo);

  const r2 = await principal(['--emulador', '--correo', 'dueno@correo.com', '--borrar-personales']);
  await entorno.withSecurityRulesDisabled(async (ctx) => { d = (await ctx.database().ref('/').get()).val(); });
  verifica('con --borrar-personales quita lo personal y deja el contador en 0', !d.usuarios[dueno.uid].imagenes && !d.usuarios[dueno.uid].animaciones && d.usuarios[dueno.uid].cuotas.usados === 0 && Object.keys(d.biblioteca.imagenes).length === 2);
  fs.rmSync(r2.respaldo);

  // Con las reglas: cualquier cuenta con sesión ve la biblioteca y nadie normal la cambia.
  const comoOtro = entorno.authenticatedContext(otro.uid, {}).database();
  const lee = (await comoOtro.ref('biblioteca/imagenes').get()).val();
  verifica('otra cuenta ve las predeterminadas', lee && lee.gato && lee.perro);
  let bloqueado = false; try { await comoOtro.ref('biblioteca/imagenes/gato').remove(); } catch (e) { bloqueado = true; }
  verifica('otra cuenta no las puede borrar', bloqueado);
  // Y la cuenta del dueño queda con sus 25 libres: puede crear una nueva como cuenta normal... (es admin: sin límite)
  console.log(`\nResultado: ${ok} bien, ${mal} mal`);
  await entorno.cleanup();
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('FALLÓ:', e); process.exit(2); });
