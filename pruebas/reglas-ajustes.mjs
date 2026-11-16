// Más > Config > Ajustes de la TV: dispositivos/{id}/ajustes y pantalla.tipo = "ajustes". Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-ajustes', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    dispositivos: { T: { dueno: 'U', miembros: { M: 'ABC234' }, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } } }
  });
});
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();
const aj = (o = {}) => ({ brillo: 2, volumen: 1, zona: -300, ...o });
const config = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
const ruta = 'dispositivos/T/ajustes';

await v('dueño guarda los ajustes', true, set(ref(U(), ruta), aj()));
await v('miembro también', true, set(ref(M(), ruta), aj({ brillo: 3 })));
await v('cuenta ajena no', false, set(ref(X(), ruta), aj()));
await v('sin sesión no', false, set(ref(env.unauthenticatedContext().database(), ruta), aj()));
await v('la TV no puede escribirlos', false, set(ref(TV(), ruta), aj()));
await v('la TV puede leerlos', true, get(ref(TV(), ruta)));
await v('cuenta ajena no puede leerlos', false, get(ref(X(), ruta)));
await v('brillo 0', false, set(ref(U(), ruta), aj({ brillo: 0 })));
await v('brillo 4', false, set(ref(U(), ruta), aj({ brillo: 4 })));
await v('brillo decimal', false, set(ref(U(), ruta), aj({ brillo: 1.5 })));
await v('volumen 0 (silencio)', true, set(ref(U(), ruta), aj({ volumen: 0 })));
await v('volumen 4', false, set(ref(U(), ruta), aj({ volumen: 4 })));
await v('volumen negativo', false, set(ref(U(), ruta), aj({ volumen: -1 })));
await v('zona -720 (límite)', true, set(ref(U(), ruta), aj({ zona: -720 })));
await v('zona 840 (límite)', true, set(ref(U(), ruta), aj({ zona: 840 })));
await v('zona 841', false, set(ref(U(), ruta), aj({ zona: 841 })));
await v('zona texto', false, set(ref(U(), ruta), aj({ zona: '-300' })));
await v('falta un campo', false, set(ref(U(), ruta), { brillo: 2, volumen: 1 }));
await v('campo extra', false, set(ref(U(), ruta), aj({ extra: 1 })));
await v('orden tipo "ajustes" (dueño)', true, update(ref(U(), 'dispositivos/T/oled_remota'), { version: 6, pantalla: { tipo: 'ajustes', texto: 'Hola', config }, archivo: null }));
await v('orden tipo "ajustes" (cuenta ajena)', false, update(ref(X(), 'dispositivos/T/oled_remota'), { version: 7, pantalla: { tipo: 'ajustes', texto: 'Hola', config }, archivo: null }));
await v('las órdenes de alarma siguen funcionando', true, update(ref(U(), 'dispositivos/T/oled_remota'), { version: 8, pantalla: { tipo: 'alarma', texto: 'Hola', config }, archivo: null }));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
