// Reglas del acuse de recibo (H-06): solo la TV escribe oled_remota/mostrada, y es un entero acotado.
// Uso: npx firebase emulators:exec --only database --project demo-acuse "node reglas-acuse.mjs"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, get, update } = require('firebase/database');

const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-acuse', database: { rules: REGLAS, host, port: Number(puerto) } });
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), { dispositivos: { T1: { dueno: 'D', miembros: { M: 'ABCDEF' }, oled_remota: { version: 5, contadorVersion: 5 } }, T2: { dueno: 'X', oled_remota: { version: 1 } } } });
});

let mal = 0;
async function probar(nombre, p, debe) {
  let ok; let detalle = '';
  try { await p; ok = true; } catch (e) { ok = false; detalle = String(e.message).slice(0, 50); }
  const bien = ok === debe; if (!bien) mal++;
  console.log(`${bien ? 'OK   ' : 'MAL  '} ${ok ? 'PERMITIDO' : 'DENEGADO '} (esperado ${debe ? 'permitido' : 'denegado'}) ${nombre} ${detalle}`);
}
const tv = env.authenticatedContext('tv-T1', { dispositivo: 'T1' }).database();
const tvOtra = env.authenticatedContext('tv-T2', { dispositivo: 'T2' }).database();
const dueno = env.authenticatedContext('D', { email_verified: true }).database();
const miembro = env.authenticatedContext('M', { email_verified: true }).database();
const ajeno = env.authenticatedContext('X', { email_verified: true }).database();
const anonimo = env.unauthenticatedContext().database();
const ruta = 'dispositivos/T1/oled_remota/mostrada';

await probar('la TV escribe su versión mostrada', set(ref(tv, ruta), 7), true);
await probar('la TV escribe 0', set(ref(tv, ruta), 0), true);
await probar('la TV escribe un decimal', set(ref(tv, ruta), 1.5), false);
await probar('la TV escribe un negativo', set(ref(tv, ruta), -2), false);
await probar('la TV escribe más de 2.000.000.000', set(ref(tv, ruta), 2000000001), false);
await probar('la TV escribe un texto', set(ref(tv, ruta), 'siete'), false);
await probar('la TV escribe un objeto', set(ref(tv, ruta), { v: 7 }), false);
await probar('otra TV escribe la mostrada de T1', set(ref(tvOtra, ruta), 7), false);
await probar('el dueño NO puede escribir mostrada', set(ref(dueno, ruta), 7), false);
await probar('un miembro NO puede escribir mostrada', set(ref(miembro, ruta), 7), false);
await probar('un ajeno NO puede escribir mostrada', set(ref(ajeno, ruta), 7), false);
await probar('sin sesión NO puede escribir mostrada', set(ref(anonimo, ruta), 7), false);
await probar('el dueño lee mostrada', get(ref(dueno, ruta)), true);
await probar('un miembro lee mostrada', get(ref(miembro, ruta)), true);
await probar('un ajeno NO lee mostrada', get(ref(ajeno, ruta)), false);
await probar('la TV sigue pudiendo escribir lastSeen', set(ref(tv, 'dispositivos/T1/oled_remota/lastSeen'), 123), true);
await probar('la TV no puede escribir version', set(ref(tv, 'dispositivos/T1/oled_remota/version'), 9), false);
await probar('el dueño sigue enviando contenido (update con version y pantalla)', update(ref(dueno, 'dispositivos/T1/oled_remota'), { version: 6, pantalla: { tipo: 'texto', texto: 'hola' }, archivo: null }), true);
// Desvincular (el dueño) deja la señal -2 y no toca mostrada.
await probar('el dueño desvincula en un solo update (mostrada no estorba)', update(ref(dueno), { 'dispositivos/T1/dueno': null, 'dispositivos/T1/oled_remota/version': -2, 'dispositivos/T1/oled_remota/pantalla': null }), true);

console.log(`\nResultado: ${mal === 0 ? 'todo bien' : mal + ' mal'}`);
await env.cleanup();
process.exit(0);
