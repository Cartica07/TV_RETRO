// Simula, con los emuladores de Auth y de la base, EXACTAMENTE las peticiones HTTP que hace el
// firmware de la TV (cuenta.cpp, emparejar.cpp, github.cpp, red.cpp): inicio de sesión, renovación
// del token, lectura con ?auth=, latido, código de emparejamiento y el streaming (SSE).
// Se corre con:  firebase emulators:exec --only auth,database "node simular-tv.cjs"
'use strict';
process.env.NODE_PATH = __dirname + '/node_modules'; require('module').Module._initPaths();
const fs = require('fs');
const http = require('http');
const path = require('path');
const admin = require('firebase-admin');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const [DBHOST, DBPORT] = DB.split(':');
const NS = 'demo-tvretro';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || require('path').resolve(__dirname, '../database.rules.json'), 'utf8');
const FIRMWARE = process.env.RUTA_FIRMWARE || path.resolve(__dirname, '../../TV_RETRO-firmware');
if (!fs.existsSync(FIRMWARE + '/herramientas/fabricar-tv.cjs')) {
  console.log('Resultado: 0 bien, 0 mal (omitida: no está el repo del firmware; define RUTA_FIRMWARE)');
  process.exit(0);
}
let ok = 0, mal = 0;
const verifica = (nombre, cond, detalle = '') => { cond ? ok++ : mal++; console.log(`${cond ? 'OK  ' : 'MAL '} ${nombre}${detalle ? ' — ' + detalle : ''}`); };

const urlDb = (ruta, token) => `http://${DB}${ruta}.json?ns=${NS}` + (token ? `&auth=${token}` : '');
async function db(metodo, ruta, token, cuerpo) {
  const r = await fetch(urlDb(ruta, token), { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  return { codigo: r.status, texto };
}
async function iniciarSesion(email, clave) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: clave, returnSecureToken: true }) });
  return { codigo: r.status, json: await r.json() };
}
async function renovar(refresco) {
  const r = await fetch(`http://${AUTH}/securetoken.googleapis.com/v1/token?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${refresco}` });
  return { codigo: r.status, json: await r.json() };
}

(async () => {
  // Reglas nuevas en el emulador de la base.
  const entorno = await initializeTestEnvironment({ projectId: NS, database: { rules: REGLAS, host: DBHOST, port: Number(DBPORT) } });
  await entorno.clearDatabase();

  // 1) Fabricar una TV con la herramienta real.
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB;
  const fabricar = require(FIRMWARE + '/herramientas/fabricar-tv.cjs');
  const idsAntes = new Set(fs.existsSync(path.join(FIRMWARE + '/herramientas/salida')) ? fs.readdirSync(FIRMWARE + '/herramientas/salida') : []);
  process.argv = ['node', 'fabricar-tv.cjs', '--emulador', '--archivo'];
  const id = await fabricar.principal();
  const archivo = `${FIRMWARE}/herramientas/salida/credenciales-${id}.txt`;
  const linea = fs.readFileSync(archivo, 'utf8').trim();
  fs.rmSync(archivo);
  verifica('la herramienta deja el comando TVRETRO_CREDENCIALES con id, correo y clave', linea.startsWith('TVRETRO_CREDENCIALES {') );
  const cred = JSON.parse(linea.slice('TVRETRO_CREDENCIALES '.length));
  verifica('el correo usa el dominio reservado y la clave es larga', cred.email === `tv-${id}@tvretro.example.com` && cred.clave.length >= 30);

  // 2) La TV inicia sesión (cuenta.cpp: signInWithPassword).
  const s = await iniciarSesion(cred.email, cred.clave);
  verifica('la TV inicia sesión (idToken, refreshToken, expiresIn)', s.codigo === 200 && s.json.idToken && s.json.refreshToken && s.json.expiresIn, `HTTP ${s.codigo}`);
  const token = s.json.idToken;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  verifica('el token lleva el claim dispositivo = id', payload.dispositivo === id, JSON.stringify({ dispositivo: payload.dispositivo }));

  // 3) Renovar el token (cuenta.cpp: renovarToken).
  const rr = await renovar(s.json.refreshToken);
  verifica('renovar el token (id_token, refresh_token, expires_in)', rr.codigo === 200 && rr.json.id_token && rr.json.expires_in, `HTTP ${rr.codigo}`);

  // 4) Latido y lecturas con ?auth= (github.cpp, red.cpp).
  const latido = await db('PUT', `/dispositivos/${id}/oled_remota/lastSeen`, token, { '.sv': 'timestamp' });
  verifica('latido (lastSeen con server timestamp) con auth', latido.codigo === 200, `HTTP ${latido.codigo} ${latido.texto.slice(0, 60)}`);
  const sinToken = await db('PUT', `/dispositivos/${id}/oled_remota/lastSeen`, null, { '.sv': 'timestamp' });
  verifica('el mismo latido sin token es rechazado', sinToken.codigo === 401 || sinToken.codigo === 403, `HTTP ${sinToken.codigo}`);
  const lecVersion = await db('GET', `/dispositivos/${id}/oled_remota/version`, token);
  verifica('leer la versión de su nodo (sin datos todavía: null)', lecVersion.codigo === 200 && lecVersion.texto.trim() === 'null', `HTTP ${lecVersion.codigo} ${lecVersion.texto}`);
  const otra = await db('GET', `/dispositivos/otraTV/oled_remota/version`, token);
  verifica('leer el nodo de otra TV es rechazado', otra.codigo === 401 || otra.codigo === 403, `HTTP ${otra.codigo}`);
  const escrVersion = await db('PUT', `/dispositivos/${id}/oled_remota/version`, token, 99);
  verifica('la TV no puede escribir la versión (solo el dueño)', escrVersion.codigo === 401 || escrVersion.codigo === 403, `HTTP ${escrVersion.codigo}`);

  // 5) Emparejamiento (emparejar.cpp): sin dueño -> código -> el cliente reclama -> la TV lo borra.
  const dueno0 = await db('GET', `/dispositivos/${id}/dueno`, token);
  verifica('la TV pregunta si tiene dueño: null', dueno0.codigo === 200 && dueno0.texto.trim() === 'null', dueno0.texto);
  const codigo = 'K7M2QX';
  const pub = await db('PUT', `/emparejamiento/${codigo}`, token, { id, creado: { '.sv': 'timestamp' } });
  verifica('la TV publica su código con la hora del servidor', pub.codigo === 200, `HTTP ${pub.codigo} ${pub.texto.slice(0, 80)}`);
  const pubAjeno = await db('PUT', `/emparejamiento/ABCD23`, token, { id: 'otraTV', creado: { '.sv': 'timestamp' } });
  verifica('no puede publicar un código a nombre de otra TV', pubAjeno.codigo === 401 || pubAjeno.codigo === 403, `HTTP ${pubAjeno.codigo}`);

  // El cliente (una cuenta con sesión) reclama la TV como lo hace el panel.
  const cliente = entorno.authenticatedContext('cliente1', {}).database();
  const lee = await cliente.ref(`emparejamiento/${codigo}`).get();
  verifica('el cliente lee el código y ve el id de la TV', lee.val() && lee.val().id === id);
  await cliente.ref(`dispositivos/${id}`).update({ dueno: 'cliente1', codigoUsado: codigo });
  const dueno1 = await db('GET', `/dispositivos/${id}/dueno`, token);
  verifica('la TV ve su nuevo dueño', dueno1.codigo === 200 && dueno1.texto.trim() === '"cliente1"', dueno1.texto);
  const borra = await db('DELETE', `/emparejamiento/${codigo}`, token);
  verifica('la TV borra su código', borra.codigo === 200, `HTTP ${borra.codigo}`);

  // 6) El dueño envía contenido y la TV lo recibe por el streaming (red.cpp: SSE con ?auth=).
  const stream = await new Promise((resolver) => {
    const eventos = [];
    const req = http.get(`http://${DB}/dispositivos/${id}/oled_remota/version.json?ns=${NS}&auth=${token}`, { headers: { Accept: 'text/event-stream' } }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (d) => eventos.push(d));
      setTimeout(async () => {
        await cliente.ref(`dispositivos/${id}/oled_remota`).update({ version: 7, pantalla: { tipo: 'texto', texto: 'Hola' } });
      }, 400);
      setTimeout(() => { req.destroy(); resolver({ codigo: res.statusCode, datos: eventos.join('') }); }, 1500);
    });
    req.on('error', () => resolver({ codigo: 0, datos: '' }));
  });
  verifica('el streaming con ?auth= conecta y avisa la versión nueva', stream.codigo === 200 && /event: put/.test(stream.datos) && /"data":7/.test(stream.datos), `HTTP ${stream.codigo} ${stream.datos.replace(/\n/g, ' ').slice(0, 160)}`);
  const pant = await db('GET', `/dispositivos/${id}/oled_remota/pantalla`, token);
  verifica('la TV baja la pantalla del dueño', pant.codigo === 200 && /Hola/.test(pant.texto), pant.texto.slice(0, 80));

  // 7) Desvincular y que la TV lo note.
  await cliente.ref().update({ [`dispositivos/${id}/dueno`]: null, [`dispositivos/${id}/codigoUsado`]: null });
  const dueno2 = await db('GET', `/dispositivos/${id}/dueno`, token);
  verifica('tras desvincular, la TV ve que no tiene dueño', dueno2.codigo === 200 && dueno2.texto.trim() === 'null', dueno2.texto);

  console.log(`\nResultado: ${ok} bien, ${mal} mal`);
  await entorno.cleanup();
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('FALLÓ:', e); process.exit(2); });
