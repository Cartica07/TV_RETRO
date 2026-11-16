// Más > Alarma: dispositivos/{id}/alarma y pantalla.tipo = "alarma". Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-alarma', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
const semilla = async () => env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    dispositivos: { T: { dueno: 'U', miembros: { M: 'ABC234' }, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } } },
    usuarios: { U: { dispositivos: { T: true } } }
  });
});
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();
const TVotra = () => env.authenticatedContext('tv-Z', { dispositivo: 'Z' }).database();
const una = (o = {}) => ({ activa: true, hora: 6, minuto: 30, dias: 62, ...o });
const alarma = (a0 = una(), extra = {}) => ({ tono: 'tv_nave', alarmas: { 0: a0, 1: una({ activa: false }), 2: una({ activa: false }) }, ...extra });
const config = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
const orden = (version = 6) => ({ version, pantalla: { tipo: 'alarma', texto: 'Hola', config }, archivo: null });

await semilla();
await v('dueño guarda la alarma como la manda el panel', true, set(ref(U(), 'dispositivos/T/alarma'), alarma()));
await v('miembro también puede guardarla', true, set(ref(M(), 'dispositivos/T/alarma'), alarma(una({ hora: 7 }))));
await v('una cuenta ajena no puede', false, set(ref(X(), 'dispositivos/T/alarma'), alarma()));
await v('sin sesión no puede', false, set(ref(env.unauthenticatedContext().database(), 'dispositivos/T/alarma'), alarma()));
await v('la TV no puede escribirla (solo leerla)', false, set(ref(TV(), 'dispositivos/T/alarma'), alarma()));
await v('la TV de este dispositivo puede leerla', true, get(ref(TV(), 'dispositivos/T/alarma')));
await v('otra TV no puede leerla', false, get(ref(TVotra(), 'dispositivos/T/alarma')));
await v('una cuenta ajena no puede leerla', false, get(ref(X(), 'dispositivos/T/alarma')));
await v('el dueño puede leerla', true, get(ref(U(), 'dispositivos/T/alarma')));
await v('hora 23:59 y todos los días (127) es válido', true, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ hora: 23, minuto: 59, dias: 127 }))));
await v('hora 24', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ hora: 24 }))));
await v('hora negativa', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ hora: -1 }))));
await v('minuto 60', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ minuto: 60 }))));
await v('hora con decimales', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ hora: 6.5 }))));
await v('días 128', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ dias: 128 }))));
await v('días 0 (ninguno) es válido en datos (la app no deja guardarlo activa)', true, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ dias: 0 }))));
await v('activa que no es booleano', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ activa: 'si' }))));
await v('falta un campo de la alarma', false, set(ref(U(), 'dispositivos/T/alarma'), alarma({ activa: true, hora: 6, minuto: 0 })));
await v('campo extra dentro de una alarma', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una({ extra: 1 }))));
await v('una cuarta alarma (índice 3)', false, set(ref(U(), 'dispositivos/T/alarma'), { tono: '', alarmas: { 0: una(), 3: una() } }));
await v('índice que no es 0 a 2', false, set(ref(U(), 'dispositivos/T/alarma'), { tono: '', alarmas: { x: una() } }));
await v('tono de 101 caracteres', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una(), { tono: 'a'.repeat(101) })));
await v('tono de 100 caracteres', true, set(ref(U(), 'dispositivos/T/alarma'), alarma(una(), { tono: 'a'.repeat(100) })));
await v('tono vacío (sonido simple)', true, set(ref(U(), 'dispositivos/T/alarma'), alarma(una(), { tono: '' })));
await v('tono que no es texto', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una(), { tono: 5 })));
await v('hijo desconocido en alarma', false, set(ref(U(), 'dispositivos/T/alarma'), alarma(una(), { otro: 1 })));
await v('alarma sin tono', false, set(ref(U(), 'dispositivos/T/alarma'), { alarmas: { 0: una() } }));
await semilla();
await v('orden tipo "alarma" como la manda el panel (dueño)', true, update(ref(U(), 'dispositivos/T/oled_remota'), orden(6)));
await v('orden tipo "alarma" (miembro)', true, update(ref(M(), 'dispositivos/T/oled_remota'), orden(7)));
await v('orden tipo "alarma" de una cuenta ajena', false, update(ref(X(), 'dispositivos/T/oled_remota'), orden(8)));
await v('tipo desconocido sigue prohibido', false, update(ref(U(), 'dispositivos/T/oled_remota'), { ...orden(8), pantalla: { tipo: 'hack', texto: 'Hola', config } }));
await v('los tipos de siempre siguen funcionando (texto)', true, update(ref(U(), 'dispositivos/T/oled_remota'), { version: 9, pantalla: { tipo: 'texto', texto: 'Hola', config }, archivo: null }));
await v('las órdenes de juego siguen funcionando', true, update(ref(U(), 'dispositivos/T/oled_remota'), { version: 10, pantalla: { tipo: 'juego', texto: 'Hola', config, juego: { id: 'snake' } }, archivo: null }));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
