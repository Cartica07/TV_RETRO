// Prueba herramientas/migrar-datos.cjs con los emuladores:
//   firebase emulators:exec --only auth,database "node probar-migracion.cjs"
'use strict';
process.env.NODE_PATH = __dirname + '/node_modules'; require('module').Module._initPaths();
const fs = require('fs');
const path = require('path');
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

(async () => {
  const entorno = await initializeTestEnvironment({ projectId: 'demo-tvretro', database: { rules: REGLAS, host: H, port: Number(P) } });
  await entorno.clearDatabase();
  const auth = getAuth(initializeApp({ projectId: 'demo-tvretro' }, 'prueba-mig'));
  const dueno = await auth.createUser({ email: 'dueno@correo.com', password: 'secreta1' });
  const otro = await auth.createUser({ email: 'otro@correo.com', password: 'secreta1' });

  // Base "vieja" con datos reales de formato.
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('oled_remota').set({ version: 41, contadorVersion: 41, lastSeen: 1234, pantalla: { tipo: 'texto', texto: 'Hola', config: { tamano: 2 } }, archivo: { version: 41, datos: 'QUJD' } });
    await db.ref('imagenes').set({ gato: { datos: 'ff', ancho: 128, alto: 64, meta: {} }, perro: { datos: '00', ancho: 128, alto: 64, meta: {} } });
    await db.ref('animaciones').set({ gif1: { ancho: 128, alto: 64, cuadros: [{ datos: 'ab', dur: 100 }], meta: { origen: 'gif' } } });
    await db.ref('musicales/indice/c1').set({ nombre: 'c1' });
    await db.ref('dispositivos/tv7/oled_remota/lastSeen').set(999); // la TV ya escribió su latido
  });

  const { principal } = require('../herramientas/migrar-datos.cjs');
  const r = await principal(['--emulador', '--correo', 'dueno@correo.com', '--tv', 'tv7']);
  verifica('la herramienta termina y guarda un respaldo', r.uid === dueno.uid && fs.existsSync(r.respaldo));
  const respaldo = JSON.parse(fs.readFileSync(r.respaldo, 'utf8'));
  fs.rmSync(r.respaldo);
  verifica('el respaldo trae toda la base vieja', respaldo.oled_remota.version === 41 && Object.keys(respaldo.imagenes).length === 2);

  let datos;
  await entorno.withSecurityRulesDisabled(async (ctx) => { datos = (await ctx.database().ref('/').get()).val(); });
  verifica('oled_remota copiado a dispositivos/tv7 (version, contadorVersion, pantalla, archivo)', datos.dispositivos.tv7.oled_remota.version === 41 && datos.dispositivos.tv7.oled_remota.contadorVersion === 41 && datos.dispositivos.tv7.oled_remota.pantalla.texto === 'Hola' && datos.dispositivos.tv7.oled_remota.archivo.datos === 'QUJD');
  verifica('el latido de la TV (lastSeen) no se pisa con el viejo', datos.dispositivos.tv7.oled_remota.lastSeen === 999);
  verifica('la cuenta es dueña de la TV y la tiene en su lista', datos.dispositivos.tv7.dueno === dueno.uid && datos.usuarios[dueno.uid].dispositivos.tv7 === true);
  verifica('imágenes y animaciones copiadas a la cuenta', Object.keys(datos.usuarios[dueno.uid].imagenes).length === 2 && datos.usuarios[dueno.uid].animaciones.gif1.meta.origen === 'gif');
  verifica('la cuenta quedó como administradora', datos.administradores[dueno.uid] === true);
  verifica('lo viejo quedó intacto', datos.oled_remota.version === 41 && Object.keys(datos.imagenes).length === 2 && datos.musicales.indice.c1.nombre === 'c1');

  // Con las reglas nuevas: el dueño lee y escribe lo suyo, el otro usuario no ve nada.
  const comoDueno = entorno.authenticatedContext(dueno.uid, {}).database();
  const comoOtro = entorno.authenticatedContext(otro.uid, {}).database();
  const lee = (await comoDueno.ref('dispositivos/tv7/oled_remota/version').get()).val();
  verifica('con las reglas nuevas el dueño lee su TV migrada', lee === 41);
  let bloqueado = false; try { await comoOtro.ref('dispositivos/tv7/oled_remota/version').get(); } catch (e) { bloqueado = true; }
  verifica('con las reglas nuevas otro usuario no puede leerla', bloqueado);
  await comoDueno.ref('musicales').update({ 'indice/nueva': { nombre: 'n' }, 'datos/nueva': 'QUJD' });
  verifica('el dueño (administrador) puede importar canciones', true);

  // Segunda corrida con otro dueño: se niega.
  await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('dispositivos/tv8/dueno').set('alguien'); });
  let rechazada = false; try { await principal(['--emulador', '--correo', 'dueno@correo.com', '--tv', 'tv8']); } catch (e) { rechazada = /otro dueño/.test(e.message); }
  verifica('se niega a migrar sobre una TV que ya tiene otro dueño', rechazada);

  console.log(`\nResultado: ${ok} bien, ${mal} mal`);
  await entorno.cleanup();
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('FALLÓ:', e); process.exit(2); });
