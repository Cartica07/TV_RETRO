#!/usr/bin/env node
/**
 * Convierte las imágenes y animaciones que hoy están en el catálogo PERSONAL de una cuenta
 * (usuarios/<uid>/imagenes y /animaciones) en la biblioteca PREDETERMINADA (biblioteca/imagenes y
 * /animaciones): las ven todas las cuentas y todas las TV, no cuentan en el límite de 25 de nadie y
 * solo un administrador las cambia. Ver docs/formatos-datos.md, sección 6.
 *
 * Qué hace:
 *  1. Guarda un respaldo en herramientas/salida/ (ignorado por git).
 *  2. COPIA a biblioteca/. Con --borrar-personales, después las quita del catálogo personal de la
 *     cuenta (y deja su contador de usados en 0); sin esa opción solo copia.
 *
 * Uso:
 *   node mover-a-biblioteca.cjs --clave-servicio C:\ruta\clave.json --correo tu@correo.com [--borrar-personales]
 *   node mover-a-biblioteca.cjs --emulador --correo ... [--borrar-personales]       (pruebas)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const URL_BASE_DATOS = 'https://lorenita-6ad1e-default-rtdb.firebaseio.com';

function leerArgumentos(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--emulador' || x === '--borrar-personales') a[x.slice(2)] = true;
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
    app = initializeApp({ projectId: 'demo-tvretro', databaseURL: 'http://127.0.0.1:9000/?ns=demo-tvretro' }, 'biblioteca-' + Date.now());
  } else {
    const ruta = args['clave-servicio'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!ruta || !fs.existsSync(ruta)) throw new Error('Falta la clave de servicio: usa --clave-servicio <archivo.json>.');
    app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(ruta, 'utf8'))), databaseURL: URL_BASE_DATOS });
  }
  return { auth: getAuth(app), db: getDatabase(app) };
}

async function principal(argv) {
  const args = leerArgumentos(argv);
  if (!args.correo) throw new Error('Falta --correo <correo de la cuenta>.');
  const { auth, db } = iniciar(args);
  const uid = (await auth.getUserByEmail(args.correo)).uid;

  const personal = (await db.ref(`usuarios/${uid}`).get()).val() || {};
  const imagenes = personal.imagenes || {};
  const animaciones = personal.animaciones || {};

  const dir = path.join(__dirname, 'salida');
  fs.mkdirSync(dir, { recursive: true });
  const respaldo = path.join(dir, `catalogo-personal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(respaldo, JSON.stringify({ imagenes, animaciones }), { mode: 0o600 });
  console.log(`Respaldo guardado: ${respaldo}`);

  const cambios = {};
  for (const [k, v] of Object.entries(imagenes)) cambios[`biblioteca/imagenes/${k}`] = v;
  for (const [k, v] of Object.entries(animaciones)) cambios[`biblioteca/animaciones/${k}`] = v;
  if (Object.keys(cambios).length === 0) {
    console.log('No hay nada en el catálogo personal: no se copia nada.');
    return { uid, respaldo, imagenes: 0, animaciones: 0 };
  }
  await db.ref('/').update(cambios);
  console.log(`Copiado a la biblioteca predeterminada: ${Object.keys(imagenes).length} imágenes y ${Object.keys(animaciones).length} animaciones.`);

  if (args['borrar-personales']) {
    await db.ref('/').update({
      [`usuarios/${uid}/imagenes`]: null,
      [`usuarios/${uid}/animaciones`]: null,
      [`usuarios/${uid}/cuotas/usados`]: 0
    });
    console.log('Quitadas del catálogo personal de la cuenta (contador de usados en 0).');
  } else {
    console.log('El catálogo personal quedó como estaba (usa --borrar-personales para quitarlas de ahí).');
  }
  return { uid, respaldo, imagenes: Object.keys(imagenes).length, animaciones: Object.keys(animaciones).length };
}

if (require.main === module) {
  principal(process.argv.slice(2)).then(() => process.exit(0), (e) => { console.error('Error:', e.message); process.exit(1); });
}

module.exports = { principal };
