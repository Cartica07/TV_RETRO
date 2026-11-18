// Prueba herramientas/liberar-tv.cjs del repo del firmware (soporte: suelta una TV de una cuenta perdida) con el emulador:
//   firebase emulators:exec --only database --project demo-tvretro "node liberar-tv.cjs"
'use strict';
process.env.NODE_PATH = __dirname + '/node_modules'; require('module').Module._initPaths();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, get } = require('firebase/database');

const FIRMWARE = process.env.RUTA_FIRMWARE || path.resolve(__dirname, '../../TV_RETRO-firmware');
const HERRAMIENTA = path.join(FIRMWARE, 'herramientas', 'liberar-tv.cjs');
if (!fs.existsSync(HERRAMIENTA) || !fs.existsSync(path.join(FIRMWARE, 'herramientas', 'node_modules'))) {
  console.log('Resultado: 0 bien, 0 mal (omitida: falta el repo del firmware o "npm ci" en su carpeta herramientas/; define RUTA_FIRMWARE)');
  process.exit(0);
}

const [H, P] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
let ok = 0, mal = 0;
const verifica = (n, c, d = '') => { c ? ok++ : mal++; console.log(`${c ? 'OK  ' : 'MAL '} ${n}${d ? ' — ' + d : ''}`); };

function correr(args) {
  try {
    const salida = execFileSync('node', [HERRAMIENTA, ...args], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { codigo: 0, salida };
  } catch (e) {
    return { codigo: e.status, salida: String(e.stdout || '') + String(e.stderr || '') };
  }
}

(async () => {
  const entorno = await initializeTestEnvironment({ projectId: 'demo-tvretro', database: { rules: '{"rules":{".read":false,".write":false}}', host: H, port: Number(P) } });
  await entorno.clearDatabase();
  // withSecurityRulesDisabled no devuelve lo que devuelve su callback: se guarda en una variable.
  const leer = async (ruta) => { let v; await entorno.withSecurityRulesDisabled(async (ctx) => { v = (await get(ref(ctx.database(), ruta))).val(); }); return v === undefined ? null : v; };
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), '/'), {
      dispositivos: {
        tvnueve901: {
          dueno: 'U', codigoUsado: 'ABC234', miembros: { M1: 'DEF567', M2: 'GHJ789' }, apodos: { M1: 'Mamá' },
          alarma: { tono: '', alarmas: { 0: { activa: true, hora: 6, minuto: 30, dias: 62 } } }, ajustes: { brillo: 2, volumen: 1, zona: -300 },
          oled_remota: { version: 7, contadorVersion: 7, lastSeen: 123456, pantalla: { tipo: 'texto', texto: 'Secreto del dueño anterior' }, archivo: { version: 7, datos: 'QQ==' } }
        },
        tvocho8001: { dueno: 'OTRO', oled_remota: { version: 3, pantalla: { tipo: 'texto', texto: 'No se toca' } } }
      },
      usuarios: { U: { dispositivos: { tvnueve901: true, tvX: true } }, M1: { dispositivos: { tvnueve901: true } }, M2: { dispositivos: { tvnueve901: true } }, OTRO: { dispositivos: { tvocho8001: true } } }
    });
  });

  // 1) Sin --si: solo muestra
  let r = correr(['--id', 'tvnueve901', '--emulador']);
  verifica('sin --si solo muestra lo que haría y no cambia nada', r.codigo === 0 && /Solo se mostr/.test(r.salida) && (await leer('dispositivos/tvnueve901/dueno')) === 'U' && (await leer('dispositivos/tvnueve901/alarma')) !== null, r.salida.split('\n').slice(0, 2).join(' | '));

  // 2) Con --si: suelta la TV
  r = correr(['--id', 'tvnueve901', '--emulador', '--si']);
  const tv = await leer('dispositivos/tvnueve901');
  verifica('con --si: sin dueño, código, miembros ni apodos', r.codigo === 0 && !tv.dueno && !tv.codigoUsado && !tv.miembros && !tv.apodos, JSON.stringify({ codigo: r.codigo, dueno: tv.dueno }));
  verifica('con --si: sin contenido, archivo, alarma ni ajustes (nada que heredar)', !tv.oled_remota.pantalla && !tv.oled_remota.archivo && !tv.alarma && !tv.ajustes);
  verifica('con --si: version = -2 (la señal para mostrar un código nuevo) y se conservan contadorVersion y lastSeen', tv.oled_remota.version === -2 && tv.oled_remota.contadorVersion === 7 && tv.oled_remota.lastSeen === 123456, JSON.stringify(tv.oled_remota));
  verifica('con --si: sale de la lista del dueño (conserva sus otras TV) y de la de cada miembro',
    (await leer('usuarios/U/dispositivos/tvnueve901')) === null && (await leer('usuarios/U/dispositivos/tvX')) === true && (await leer('usuarios/M1/dispositivos/tvnueve901')) === null && (await leer('usuarios/M2/dispositivos/tvnueve901')) === null);
  verifica('otra TV y otros usuarios quedan intactos', (await leer('dispositivos/tvocho8001/dueno')) === 'OTRO' && (await leer('dispositivos/tvocho8001/oled_remota/pantalla/texto')) === 'No se toca' && (await leer('usuarios/OTRO/dispositivos/tvocho8001')) === true);

  // 3) Repetir sobre una TV ya libre
  r = correr(['--id', 'tvnueve901', '--emulador', '--si']);
  verifica('una TV que ya no tiene dueño: avisa y no hace nada', r.codigo === 0 && /ya no tiene due/.test(r.salida) && (await leer('dispositivos/tvnueve901/oled_remota/version')) === -2);

  // 4) Errores
  r = correr(['--id', 'noexiste1', '--emulador', '--si']);
  verifica('una TV que no existe: error claro', r.codigo === 1 && /No existe la TV/.test(r.salida), r.salida.trim());
  r = correr(['--emulador', '--si']);
  verifica('sin --id: error', r.codigo === 1 && /Falta --id/.test(r.salida));
  const sinEmulador = { ...process.env }; delete sinEmulador.GOOGLE_APPLICATION_CREDENTIALS;
  try { execFileSync('node', [HERRAMIENTA, '--id', 'tvnueve901'], { env: sinEmulador, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); verifica('sin clave de servicio ni --emulador: error', false); }
  catch (e) { verifica('sin clave de servicio ni --emulador: error y no toca nada', e.status === 1 && /clave de servicio/.test(String(e.stderr)), String(e.stderr).trim()); }

  await entorno.cleanup();
  console.log(`Resultado: ${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
