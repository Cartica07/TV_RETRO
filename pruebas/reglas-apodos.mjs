// Compartir: dispositivos/{id}/apodos/{uid} (el dueño le pone nombre a cada persona). Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-apodos', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
const semilla = async (extra = {}) => env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    dispositivos: {
      T: { dueno: 'U', codigoUsado: 'AAAAAA', miembros: { M: 'ABC234', N: 'DEF567' }, ...extra, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } }
    },
    usuarios: { U: { dispositivos: { T: true } }, M: { dispositivos: { T: true } }, N: { dispositivos: { T: true } } }
  });
});
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const N = () => env.authenticatedContext('N', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();

await semilla();
await v('el dueño le pone nombre a un miembro', true, set(ref(U(), 'dispositivos/T/apodos/M'), 'Mamá'));
await v('el dueño cambia el nombre', true, set(ref(U(), 'dispositivos/T/apodos/M'), 'Mamá Rosa'));
await v('20 caracteres es válido', true, set(ref(U(), 'dispositivos/T/apodos/N'), 'a'.repeat(20)));
await v('21 caracteres', false, set(ref(U(), 'dispositivos/T/apodos/N'), 'a'.repeat(21)));
await v('nombre vacío', false, set(ref(U(), 'dispositivos/T/apodos/N'), ''));
await v('nombre que no es texto', false, set(ref(U(), 'dispositivos/T/apodos/N'), 5));
await v('nombre con hijos (objeto)', false, set(ref(U(), 'dispositivos/T/apodos/N'), { a: 'b' }));
await v('nombre para alguien que no es miembro', false, set(ref(U(), 'dispositivos/T/apodos/Z'), 'Intruso'));
await v('el dueño no se pone nombre a sí mismo (no es miembro)', false, set(ref(U(), 'dispositivos/T/apodos/U'), 'Yo'));
await v('un miembro no puede ponerle nombre a otro', false, set(ref(M(), 'dispositivos/T/apodos/N'), 'Rival'));
await v('un miembro no puede ponerse nombre a sí mismo', false, set(ref(M(), 'dispositivos/T/apodos/M'), 'Yo'));
await v('una cuenta ajena no puede', false, set(ref(X(), 'dispositivos/T/apodos/M'), 'Hack'));
await v('sin sesión no puede', false, set(ref(env.unauthenticatedContext().database(), 'dispositivos/T/apodos/M'), 'Hack'));
await v('la TV no puede escribirlos', false, set(ref(TV(), 'dispositivos/T/apodos/M'), 'Hack'));
await v('el dueño puede leerlos', true, get(ref(U(), 'dispositivos/T/apodos')));
await v('un miembro puede leerlos', true, get(ref(M(), 'dispositivos/T/apodos')));
await v('la TV puede leerlos (hereda la lectura del dispositivo)', true, get(ref(TV(), 'dispositivos/T/apodos')));
await v('una cuenta ajena no puede leerlos', false, get(ref(X(), 'dispositivos/T/apodos')));

// Limpieza
await semilla({ apodos: { M: 'Mamá', N: 'Tío' } });
await v('un miembro puede borrar su propio nombre al salirse', true, update(ref(M()), { 'dispositivos/T/miembros/M': null, 'dispositivos/T/apodos/M': null, 'usuarios/M/dispositivos/T': null }));
await v('un miembro no puede borrar el nombre de otro', false, set(ref(M(), 'dispositivos/T/apodos/N'), null));
await v('el dueño quita a un miembro y su nombre en la misma escritura', true, update(ref(U()), { 'dispositivos/T/miembros/N': null, 'dispositivos/T/apodos/N': null }));
await semilla({ apodos: { M: 'Mamá', N: 'Tío' } });
await v('el dueño borra todos los nombres de una vez', true, set(ref(U(), 'dispositivos/T/apodos'), null));
await v('una cuenta ajena no puede borrar todos los nombres', false, set(ref(X(), 'dispositivos/T/apodos'), null));
await v('un miembro no puede borrar todos los nombres', false, set(ref(M(), 'dispositivos/T/apodos'), null));
await semilla({ apodos: { M: 'Mamá' } });
await v('desvincular (como lo hace el panel) borra también los nombres', true, update(ref(U()), {
  'dispositivos/T/dueno': null, 'dispositivos/T/codigoUsado': null, 'dispositivos/T/miembros': null, 'dispositivos/T/apodos': null,
  'dispositivos/T/oled_remota/version': -2, 'dispositivos/T/oled_remota/pantalla': null, 'dispositivos/T/oled_remota/archivo': null,
  'dispositivos/T/alarma': null, 'dispositivos/T/ajustes': null, 'usuarios/U/dispositivos/T': null
}));

// Compatibilidad: lo de siempre sigue igual
await semilla();
await v('un miembro sigue pudiendo enviar contenido', true, update(ref(M(), 'dispositivos/T/oled_remota'), { version: 6, pantalla: { tipo: 'texto', texto: 'Hola', config: { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' } }, archivo: null }));
await v('quitar a un miembro sin apodo sigue funcionando (panel viejo)', true, set(ref(U(), 'dispositivos/T/miembros/N'), null));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
