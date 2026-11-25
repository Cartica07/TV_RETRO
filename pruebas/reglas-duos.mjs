// Dúos (2026-11-24): duos/indice|datos (catálogo: lee cualquier sesión, escribe un administrador) y
// dispositivos/{id}/ajustes.duos y .duoFavorito (dueño y miembros; la TV los lee). Ver docs/protocolo-duos.md.
// Uso: npx firebase emulators:exec --only database --project demo-reglas-duos "node reglas-duos.mjs"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, get, update } = require('firebase/database');
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-duos', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
const M1 = 'TTEBAAAAAAAAAAAAAAAAAAA=';
const PORTADA = 'A'.repeat(2732);
const indice = (o = {}) => ({ nombre: 'Corazón', orden: 1, fecha: 1, duracion: 3300, portada: PORTADA, ...o });
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    administradores: { A: true },
    dispositivos: { T: { dueno: 'U', miembros: { M: 'ABC234' }, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } } },
    duos: { indice: { prueba: indice() }, datos: { prueba: { izq: M1, der: M1 } } },
  });
});
const A = () => env.authenticatedContext('A', { email_verified: true }).database();
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();
const ANON = () => env.unauthenticatedContext().database();

// ---- Catálogo duos/ ----
await v('cualquier sesión lee el índice', true, get(ref(X(), 'duos/indice')));
await v('cualquier sesión lee un dúo', true, get(ref(X(), 'duos/datos/prueba')));
await v('la TV lee el índice y un dúo (los baja sola)', true, Promise.all([get(ref(TV(), 'duos/indice')), get(ref(TV(), 'duos/datos/prueba'))]));
await v('sin sesión NO lee el catálogo', false, get(ref(ANON(), 'duos/indice')));
await v('administrador sube un dúo (datos + índice)', true, update(ref(A()), { 'duos/datos/nuevo': { izq: M1, der: M1 }, 'duos/indice/nuevo': indice({ nombre: 'Nuevo', orden: 2 }) }));
await v('dueño de una TV (no administrador) NO sube', false, set(ref(U(), 'duos/datos/otro'), { izq: M1, der: M1 }));
await v('ni en el índice', false, set(ref(U(), 'duos/indice/otro'), indice()));
await v('ni borra un dúo', false, set(ref(U(), 'duos/datos/prueba'), null));
await v('la TV NO escribe en el catálogo', false, set(ref(TV(), 'duos/indice/prueba'), indice()));
await v('administrador: clave con espacio NO', false, set(ref(A(), 'duos/datos/con espacio'), { izq: M1, der: M1 }));
await v('administrador: dúo sin la mitad derecha NO', false, set(ref(A(), 'duos/datos/medio'), { izq: M1 }));
await v('administrador: campo de más en los datos NO', false, set(ref(A(), 'duos/datos/extra'), { izq: M1, der: M1, centro: M1 }));
await v('administrador: mitad de 100 KB (136 536 letras) sí', true, set(ref(A(), 'duos/datos/grande'), { izq: 'A'.repeat(136536), der: M1 }));
await v('administrador: mitad de más de 136 536 letras NO', false, set(ref(A(), 'duos/datos/enorme'), { izq: 'A'.repeat(136537), der: M1 }));
await v('administrador: índice sin portada NO', false, set(ref(A(), 'duos/indice/sinp'), { nombre: 'X', orden: 1, fecha: 1, duracion: 3300 }));
await v('administrador: portada de más de 2732 letras NO', false, set(ref(A(), 'duos/indice/p'), indice({ portada: 'A'.repeat(2733) })));
await v('administrador: duración de 61 s NO', false, set(ref(A(), 'duos/indice/d'), indice({ duracion: 61000 })));
await v('administrador: nombre de más de 30 letras NO', false, set(ref(A(), 'duos/indice/n'), indice({ nombre: 'x'.repeat(31) })));
await v('administrador: campo de más en el índice NO', false, set(ref(A(), 'duos/indice/e'), indice({ color: 'rojo' })));
await v('administrador borra un dúo', true, update(ref(A()), { 'duos/datos/nuevo': null, 'duos/indice/nuevo': null, 'duos/datos/grande': null }));

// ---- Ajustes de la TV: duos y duoFavorito ----
const aj = (o = {}) => ({ brillo: 2, volumen: 1, zona: -300, ...o });
const ajustes = 'dispositivos/T/ajustes';
await v('dueño apaga los dúos y elige favorito', true, set(ref(U(), ajustes), aj({ duos: false, duoFavorito: 'prueba' })));
await v('miembro también', true, set(ref(M(), ajustes), aj({ duos: true, duoFavorito: 'prueba' })));
await v('cuenta ajena NO', false, set(ref(X(), ajustes), aj({ duos: true })));
await v('duos como texto NO', false, set(ref(U(), ajustes), aj({ duos: 'si' })));
await v('favorito con clave rara NO', false, set(ref(U(), ajustes), aj({ duoFavorito: '../x' })));
await v('favorito vacío NO', false, set(ref(U(), ajustes), aj({ duoFavorito: '' })));
await v('sin los campos nuevos sigue valiendo (firmware y app viejos)', true, set(ref(U(), ajustes), aj({ apagado: 5 })));
await v('la TV lee los ajustes con los dúos', true, get(ref(TV(), ajustes)));
await v('la TV NO escribe los ajustes', false, set(ref(TV(), ajustes), aj({ duos: true })));

console.log(fallas === 0 ? 'todo bien' : `${fallas} con problemas`);
await env.cleanup();
process.exit(0);
