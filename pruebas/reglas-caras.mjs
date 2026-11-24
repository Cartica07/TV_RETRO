// Caras de reloj y ciudad para el clima (2026-11-24): relojes/indice|datos (catálogo: lee cualquier sesión, escribe un
// administrador), dispositivos/{id}/reloj (dueño y miembros) y dispositivos/{id}/ajustes.ciudad y .apagado.
// Uso: npx firebase emulators:exec --only database --project demo-reglas-caras "node reglas-caras.mjs"
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { ref, set, get, update } = require('firebase/database');
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-caras', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    administradores: { A: true },
    dispositivos: { T: { dueno: 'U', miembros: { M: 'ABC234' }, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } } },
    relojes: { indice: { base: { nombre: 'Base', orden: 1, fecha: 1 } }, datos: { base: 'UjEBAAEBB0AKAAEFAQA=' } },
  });
});
const A = () => env.authenticatedContext('A', { email_verified: true }).database();
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();
const ANON = () => env.unauthenticatedContext().database();
const B64 = 'UjEBAAIBB0AKAAEFAQADB0AyAAABAQI=';

// ---- Catálogo relojes/ ----
await v('cualquier sesión lee el índice del catálogo', true, get(ref(X(), 'relojes/indice')));
await v('cualquier sesión lee una cara del catálogo', true, get(ref(X(), 'relojes/datos/base')));
await v('sin sesión NO lee el catálogo', false, get(ref(ANON(), 'relojes/indice')));
await v('administrador guarda una cara (datos + índice)', true, update(ref(A()), { 'relojes/datos/nueva': B64, 'relojes/indice/nueva': { nombre: 'Nueva', orden: 2, fecha: 2 } }));
await v('dueño de una TV (no administrador) NO guarda en el catálogo', false, set(ref(U(), 'relojes/datos/otra'), B64));
await v('ni en el índice', false, set(ref(U(), 'relojes/indice/otra'), { nombre: 'Otra', orden: 3, fecha: 3 }));
await v('ni borra una cara del catálogo', false, set(ref(U(), 'relojes/datos/base'), null));
await v('administrador: clave con espacio NO', false, set(ref(A(), 'relojes/datos/con espacio'), B64));
await v('administrador: receta de más de 2732 letras NO', false, set(ref(A(), 'relojes/datos/grande'), 'A'.repeat(2733)));
await v('administrador: nombre de más de 30 letras NO', false, set(ref(A(), 'relojes/indice/larga'), { nombre: 'x'.repeat(31), orden: 1, fecha: 1 }));
await v('administrador: campo de más en el índice NO', false, set(ref(A(), 'relojes/indice/extra'), { nombre: 'X', orden: 1, fecha: 1, color: 'rojo' }));
await v('administrador borra una cara', true, update(ref(A()), { 'relojes/datos/nueva': null, 'relojes/indice/nueva': null }));

// ---- Cara elegida de la TV: dispositivos/T/reloj ----
const reloj = 'dispositivos/T/reloj';
await v('dueño elige una cara', true, set(ref(U(), reloj), { clave: 'base', datos: B64 }));
await v('miembro también', true, set(ref(M(), reloj), { clave: 'base', datos: B64 }));
await v('cuenta ajena NO', false, set(ref(X(), reloj), { clave: 'base', datos: B64 }));
await v('cuenta ajena NO la lee', false, get(ref(X(), reloj)));
await v('la TV la lee', true, get(ref(TV(), reloj + '/datos')));
await v('la TV NO la escribe', false, set(ref(TV(), reloj), { clave: 'base', datos: B64 }));
await v('sin clave NO', false, set(ref(U(), reloj), { datos: B64 }));
await v('clave rara NO', false, set(ref(U(), reloj), { clave: '../x', datos: B64 }));
await v('receta de más de 2732 letras NO', false, set(ref(U(), reloj), { clave: 'base', datos: 'A'.repeat(2733) }));
await v('campo de más NO', false, set(ref(U(), reloj), { clave: 'base', datos: B64, extra: 1 }));
await v('dueño vuelve a la Cara 1 (borra)', true, set(ref(U(), reloj), null));

// ---- Ajustes: ciudad y apagado ----
const aj = (o = {}) => ({ brillo: 2, volumen: 1, zona: -300, ...o });
const ciudad = { nombre: 'Armenia, Quindío, Colombia', lat: 4.5339, lon: -75.6811 };
const ajustes = 'dispositivos/T/ajustes';
await v('dueño guarda la ciudad', true, set(ref(U(), ajustes), aj({ ciudad })));
await v('miembro también', true, set(ref(M(), ajustes), aj({ ciudad, apagado: 10 })));
await v('cuenta ajena NO', false, set(ref(X(), ajustes), aj({ ciudad })));
await v('latitud 91 NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, lat: 91 } })));
await v('longitud -181 NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, lon: -181 } })));
await v('latitud como texto NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, lat: '4.5' } })));
await v('nombre de 61 letras NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, nombre: 'x'.repeat(61) } })));
await v('nombre vacío NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, nombre: '' } })));
await v('ciudad sin longitud NO', false, set(ref(U(), ajustes), aj({ ciudad: { nombre: 'X', lat: 1 } })));
await v('campo de más en la ciudad NO', false, set(ref(U(), ajustes), aj({ ciudad: { ...ciudad, pais: 'CO' } })));
await v('apagado 7 NO (solo 0, 5, 10 o 20)', false, set(ref(U(), ajustes), aj({ apagado: 7 })));
await v('apagado 0 (nunca)', true, set(ref(U(), ajustes), aj({ apagado: 0 })));
await v('la TV lee los ajustes con la ciudad', true, get(ref(TV(), ajustes)));

console.log(fallas === 0 ? 'todo bien' : `${fallas} con problemas`);
await env.cleanup();
process.exit(0);
