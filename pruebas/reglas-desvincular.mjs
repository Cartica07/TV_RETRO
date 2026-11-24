import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, update, get } = require('firebase/database');
const REGLAS = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-desv', database: { rules: REGLAS, host, port: Number(puerto) } });
const sem = () => env.withSecurityRulesDisabled(async (c) => { await set(ref(c.database(), '/'), {
  dispositivos: { T1: { dueno: 'D', codigoUsado: 'ABCDEF', miembros: { M: 'ABCDEF' }, alarma: { tono: '', alarmas: { 0: { activa: true, hora: 7, minuto: 0, dias: 62 } } }, ajustes: { brillo: 1, volumen: 1, zona: -300 }, reloj: { clave: 'agujas', datos: 'UjEBAAIBB0AK' },
    oled_remota: { version: 7, contadorVersion: 7, lastSeen: 1, pantalla: { tipo: 'imagen', texto: 'hola', imagen: { ancho: 1, alto: 1, datos: 'AA' } }, archivo: { version: 7, datos: 'QUJD' } } } },
  usuarios: { D: { dispositivos: { T1: true } } } }); });
let mal = 0;
const dueno = env.authenticatedContext('D', { email_verified: true }).database();
const miembro = env.authenticatedContext('M', { email_verified: true }).database();
const payload = { 'dispositivos/T1/dueno': null, 'dispositivos/T1/codigoUsado': null, 'dispositivos/T1/miembros': null, 'dispositivos/T1/oled_remota/version': -2,
  'dispositivos/T1/oled_remota/pantalla': null, 'dispositivos/T1/oled_remota/archivo': null, 'dispositivos/T1/alarma': null, 'dispositivos/T1/ajustes': null, 'dispositivos/T1/reloj': null, 'usuarios/D/dispositivos/T1': null };
await sem();
try { await update(ref(dueno), payload); console.log('OK    dueño desvincula y limpia en un solo update'); } catch (e) { mal++; console.log('MAL   ', e.message); }
let ver; await env.withSecurityRulesDisabled(async (c) => { ver = (await get(ref(c.database(), 'dispositivos/T1'))).val(); });
const bien = ver && ver.oled_remota.version === -2 && ver.oled_remota.lastSeen === 1 && !ver.oled_remota.pantalla && !ver.oled_remota.archivo && !ver.alarma && !ver.ajustes && !ver.reloj && !ver.dueno && !ver.miembros;
console.log(bien ? 'OK    quedó limpio y conservó lastSeen' : 'MAL    estado: ' + JSON.stringify(ver)); if (!bien) mal++;
await sem();
try { await update(ref(miembro), payload); mal++; console.log('MAL    un miembro pudo desvincular y limpiar'); } catch (e) { console.log('OK    un miembro NO puede'); }
console.log(mal === 0 ? 'todo bien' : mal + ' mal'); await env.cleanup(); process.exit(0);
