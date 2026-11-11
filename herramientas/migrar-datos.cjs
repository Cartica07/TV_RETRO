#!/usr/bin/env node
/**
 * Migra los datos actuales (rutas sin cuentas) a la estructura con cuentas.
 * Ver docs/formatos-datos.md, sección 6.
 *
 * Qué hace:
 *  1. Guarda un respaldo completo de la base en herramientas/salida/respaldo-<fecha>.json
 *     (ignorado por git).
 *  2. COPIA (no mueve ni borra nada):
 *       oled_remota  (sin lastSeen)  ->  dispositivos/<tv>/oled_remota
 *       imagenes                     ->  usuarios/<uid>/imagenes
 *       animaciones                  ->  usuarios/<uid>/animaciones
 *     y deja a la cuenta como dueña de la TV (dispositivos/<tv>/dueno, usuarios/<uid>/dispositivos/<tv>)
 *     y como administradora (administradores/<uid>: puede importar canciones).
 *  3. Lo viejo queda intacto: si algo sale mal, se vuelven a publicar las reglas anteriores.
 *
 * Antes: el dueño ya creó su cuenta en el panel (?cuentas=1 > Crear cuenta) y la TV ya se fabricó
 * (herramientas/fabricar-tv.cjs del repo del firmware), de donde sale el <id> de la TV.
 *
 * Uso:
 *   node migrar-datos.cjs --clave-servicio C:\ruta\clave.json --correo tu@correo.com --tv <id-de-la-tv>
 *   node migrar-datos.cjs --emulador --correo ... --tv ...      (pruebas)
 *   Con --forzar se permite volver a copiar sobre una TV que ya tiene dueño (la misma cuenta).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const URL_BASE_DATOS = 'https://lorenita-6ad1e-default-rtdb.firebaseio.com';

function leerArgumentos(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--emulador' || x === '--forzar') a[x.slice(2)] = true;
    else if (x.startsWith('--')) a[x.slice(2)] = argv[++i];
  }
  return a;
}

function iniciar(args) {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getDatabase } = require('firebase-admin/database');
  let app;
  if (args.emulador) {
    app = initializeApp({ projectId: 'demo-tvretro', databaseURL: 'http://127.0.0.1:9000/?ns=demo-tvretro' }, 'migrar-' + Date.now());
  } else {
    const ruta = args['clave-servicio'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!ruta || !fs.existsSync(ruta)) throw new Error('Falta la clave de servicio: usa --clave-servicio <archivo.json>.');
    app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(ruta, 'utf8'))), databaseURL: URL_BASE_DATOS });
  }
  return { auth: getAuth(app), db: getDatabase(app) };
}

const contar = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0);

async function principal(argv) {
  const args = leerArgumentos(argv);
  if (!args.correo || !args.tv) throw new Error('Faltan datos: --correo <tu correo> y --tv <id de la TV>.');
  const { auth, db } = iniciar(args);

  const usuario = await auth.getUserByEmail(args.correo);
  const uid = usuario.uid;
  const tv = args.tv;

  // 1) Respaldo completo.
  const todo = (await db.ref('/').get()).val() || {};
  const dir = path.join(__dirname, 'salida');
  fs.mkdirSync(dir, { recursive: true });
  const respaldo = path.join(dir, `respaldo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(respaldo, JSON.stringify(todo), { mode: 0o600 });
  console.log(`Respaldo guardado: ${respaldo}`);

  // 2) La TV no debe tener otro dueño.
  const duenoActual = (await db.ref(`dispositivos/${tv}/dueno`).get()).val();
  if (duenoActual && duenoActual !== uid && !args.forzar) {
    throw new Error(`La TV ${tv} ya tiene otro dueño. No se migra nada.`);
  }

  // 3) Copia.
  const oled = todo.oled_remota ? { ...todo.oled_remota } : null;
  if (oled) delete oled.lastSeen; // el latido lo escribe la TV en su nodo
  const cambios = {};
  if (oled) cambios[`dispositivos/${tv}/oled_remota`] = oled;
  cambios[`dispositivos/${tv}/dueno`] = uid;
  cambios[`usuarios/${uid}/dispositivos/${tv}`] = true;
  if (todo.imagenes) cambios[`usuarios/${uid}/imagenes`] = todo.imagenes;
  if (todo.animaciones) cambios[`usuarios/${uid}/animaciones`] = todo.animaciones;
  cambios[`administradores/${uid}`] = true;

  // update() reemplaza cada ruta indicada: oled_remota se copia entera, pero sin tocar lastSeen
  // (que la TV escribe ella misma) porque la ruta es dispositivos/<tv>/oled_remota/<campo>.
  const hijos = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (k === `dispositivos/${tv}/oled_remota`) for (const [c, valor] of Object.entries(v)) hijos[`${k}/${c}`] = valor;
    else hijos[k] = v;
  }
  await db.ref('/').update(hijos);

  console.log(`Migrado a la cuenta ${args.correo} (uid ${uid}) y a la TV ${tv}:`);
  console.log(`  oled_remota: ${oled ? Object.keys(oled).join(', ') : '(no había)'}`);
  console.log(`  imágenes: ${contar(todo.imagenes)} | animaciones: ${contar(todo.animaciones)}`);
  console.log('  La cuenta quedó como dueña de la TV y como administradora.');
  console.log('  Lo viejo (oled_remota, imagenes, animaciones) quedó intacto.');
  return { uid, tv, respaldo };
}

if (require.main === module) {
  principal(process.argv.slice(2)).then(() => process.exit(0), (e) => { console.error('Error:', e.message); process.exit(1); });
}

module.exports = { principal };
