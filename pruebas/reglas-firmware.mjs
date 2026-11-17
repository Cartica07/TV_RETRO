// Actualización de la TV (OTA) y restablecimiento: firmware/estable, firmware/datos/{build},
// dispositivos/{id}/firmware y las órdenes pantalla.tipo = "actualizar" | "restablecer" (solo el dueño).
// Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-firmware', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
const semilla = async (extra = {}) => env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    administradores: { A: true },
    dispositivos: { T: { dueno: 'U', miembros: { M: 'ABC234' }, oled_remota: { version: 5, contadorVersion: 5, pantalla: { tipo: 'texto', texto: 'Hola' } } } },
    usuarios: { U: { dispositivos: { T: true } } },
    ...extra
  });
});
const U = () => env.authenticatedContext('U', { email_verified: true }).database();
const M = () => env.authenticatedContext('M', { email_verified: true }).database();
const X = () => env.authenticatedContext('X', { email_verified: true }).database();
const A = () => env.authenticatedContext('A', { email_verified: true }).database();
const TV = () => env.authenticatedContext('tv-T', { dispositivo: 'T' }).database();
const TVotra = () => env.authenticatedContext('tv-Z', { dispositivo: 'Z' }).database();
const anonimo = () => env.unauthenticatedContext().database();
const config = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
// Igual a lo que manda el panel (enviarEstado): version, pantalla y archivo null en un solo update().
const envio = (tipo, version = 6, extra = {}) => ({ version, pantalla: { tipo, texto: 'Hola', config, ...extra }, archivo: null });

// ---------- Órdenes: solo el dueño ----------
await semilla();
await v('dueño: orden "actualizar" como la manda el panel', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio('actualizar', 6)));
await v('dueño: orden "restablecer"', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio('restablecer', 7)));
await v('miembro: NO puede mandar "actualizar"', false, update(ref(M(), 'dispositivos/T/oled_remota'), envio('actualizar', 8)));
await v('miembro: NO puede mandar "restablecer"', false, update(ref(M(), 'dispositivos/T/oled_remota'), envio('restablecer', 8)));
await v('miembro: NO puede escribir pantalla entera con "restablecer"', false, set(ref(M(), 'dispositivos/T/oled_remota/pantalla'), { tipo: 'restablecer', texto: 'Hola' }));
await v('miembro: NO puede cambiar solo pantalla/tipo a "restablecer"', false, set(ref(M(), 'dispositivos/T/oled_remota/pantalla/tipo'), 'restablecer'));
await v('miembro: NO puede cambiar solo pantalla/tipo a "actualizar"', false, set(ref(M(), 'dispositivos/T/oled_remota/pantalla/tipo'), 'actualizar'));
await v('una cuenta ajena NO puede mandar "restablecer"', false, update(ref(X(), 'dispositivos/T/oled_remota'), envio('restablecer', 8)));
await v('la TV NO puede mandarse órdenes', false, update(ref(TV(), 'dispositivos/T/oled_remota'), envio('actualizar', 8)));
await v('sin sesión NO puede', false, update(ref(anonimo(), 'dispositivos/T/oled_remota'), envio('restablecer', 8)));
await v('la orden no admite datos propios (hijo extra)', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio('restablecer', 8, { restablecer: { ahora: true } })));
await v('un tipo inventado sigue prohibido', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio('hackear', 8)));
// Compatibilidad: lo de siempre sigue igual para los miembros.
await v('miembro: sigue pudiendo mandar texto', true, update(ref(M(), 'dispositivos/T/oled_remota'), envio('texto', 9)));
await v('miembro: sigue pudiendo mandar la orden de alarma', true, update(ref(M(), 'dispositivos/T/oled_remota'), envio('alarma', 10)));
await v('miembro: sigue pudiendo mandar la orden de ajustes', true, update(ref(M(), 'dispositivos/T/oled_remota'), envio('ajustes', 11)));
await v('miembro: sigue pudiendo mandar la orden de juego', true, update(ref(M(), 'dispositivos/T/oled_remota'), envio('juego', 12, { juego: { id: 'snake' } })));
await v('dueño: texto de siempre', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio('texto', 13)));

// ---------- dispositivos/{id}/firmware: solo lo escribe la TV ----------
await semilla();
const estadoOk = (o = {}) => ({ build: 12, estado: 'ok', fecha: Date.now(), ...o });
await v('la TV informa su versión y estado', true, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk()));
await v('estado "actualizando" (letras y guion bajo)', true, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ estado: 'firma_invalida' })));
await v('la TV puede informar sin fecha', true, set(ref(TV(), 'dispositivos/T/firmware'), { build: 12, estado: 'ok' }));
await v('otra TV NO puede escribirlo', false, set(ref(TVotra(), 'dispositivos/T/firmware'), estadoOk()));
await v('el dueño NO puede escribirlo', false, set(ref(U(), 'dispositivos/T/firmware'), estadoOk()));
await v('un miembro NO puede escribirlo', false, set(ref(M(), 'dispositivos/T/firmware'), estadoOk()));
await v('una cuenta ajena NO puede escribirlo', false, set(ref(X(), 'dispositivos/T/firmware'), estadoOk()));
await v('estado con mayúsculas o signos', false, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ estado: 'Error!' })));
await v('estado de 31 caracteres', false, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ estado: 'a'.repeat(31) })));
await v('build negativo', false, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ build: -1 })));
await v('build con decimales', false, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ build: 1.5 })));
await v('falta el estado', false, set(ref(TV(), 'dispositivos/T/firmware'), { build: 12 }));
await v('campo extra', false, set(ref(TV(), 'dispositivos/T/firmware'), estadoOk({ otro: 1 })));
await v('el dueño puede leerlo', true, get(ref(U(), 'dispositivos/T/firmware')));
await v('un miembro puede leerlo', true, get(ref(M(), 'dispositivos/T/firmware')));
await v('una cuenta ajena NO puede leerlo', false, get(ref(X(), 'dispositivos/T/firmware')));

// ---------- firmware/estable: el manifiesto ----------
await semilla();
const manifiesto = (o = {}) => ({ build: 5, tamano: 1520000, sha256: 'a'.repeat(64), firma: 'A'.repeat(344), ...o });
await v('administrador publica el manifiesto', true, set(ref(A(), 'firmware/estable'), manifiesto()));
await v('manifiesto con la url reservada (https)', true, set(ref(A(), 'firmware/estable'), manifiesto({ url: 'https://ejemplo.com/tv.bin' })));
await v('la url debe ser https', false, set(ref(A(), 'firmware/estable'), manifiesto({ url: 'http://ejemplo.com/tv.bin' })));
await v('url de más de 300 caracteres', false, set(ref(A(), 'firmware/estable'), manifiesto({ url: 'https://' + 'a'.repeat(300) })));
await v('el dueño de una TV NO publica firmware', false, set(ref(U(), 'firmware/estable'), manifiesto()));
await v('un miembro NO publica firmware', false, set(ref(M(), 'firmware/estable'), manifiesto()));
await v('la TV NO publica firmware', false, set(ref(TV(), 'firmware/estable'), manifiesto()));
await v('sin sesión NO publica firmware', false, set(ref(anonimo(), 'firmware/estable'), manifiesto()));
await v('tamaño de 3 900 000 (el máximo)', true, set(ref(A(), 'firmware/estable'), manifiesto({ tamano: 3900000 })));
await v('tamaño mayor que el slot', false, set(ref(A(), 'firmware/estable'), manifiesto({ tamano: 3900001 })));
await v('tamaño 0', false, set(ref(A(), 'firmware/estable'), manifiesto({ tamano: 0 })));
await v('build 0', false, set(ref(A(), 'firmware/estable'), manifiesto({ build: 0 })));
await v('build con decimales', false, set(ref(A(), 'firmware/estable'), manifiesto({ build: 2.5 })));
await v('sha256 en mayúsculas', false, set(ref(A(), 'firmware/estable'), manifiesto({ sha256: 'A'.repeat(64) })));
await v('sha256 demasiado corto', false, set(ref(A(), 'firmware/estable'), manifiesto({ sha256: 'a'.repeat(63) })));
await v('firma demasiado corta', false, set(ref(A(), 'firmware/estable'), manifiesto({ firma: 'A'.repeat(50) })));
await v('firma demasiado larga', false, set(ref(A(), 'firmware/estable'), manifiesto({ firma: 'A'.repeat(701) })));
await v('falta la firma', false, set(ref(A(), 'firmware/estable'), { build: 5, tamano: 1520000, sha256: 'a'.repeat(64) }));
await v('campo extra en el manifiesto', false, set(ref(A(), 'firmware/estable'), manifiesto({ otro: 1 })));
await semilla({ firmware: { estable: manifiesto() } });
await v('cualquier cuenta con sesión puede leer el manifiesto', true, get(ref(X(), 'firmware/estable')));
await v('la TV puede leer el manifiesto', true, get(ref(TV(), 'firmware/estable')));
await v('sin sesión NO lee el manifiesto', false, get(ref(anonimo(), 'firmware/estable')));

// ---------- firmware/datos/{build}: el binario ----------
await semilla();
await v('administrador sube el binario (Base64)', true, set(ref(A(), 'firmware/datos/5'), 'QUJD'.repeat(1000)));
await v('la clave debe ser un número', false, set(ref(A(), 'firmware/datos/abc'), 'QUJD'));
await v('la clave no puede tener puntos ni barras', false, set(ref(A(), 'firmware/datos/5x'), 'QUJD'));
await v('el binario debe ser texto', false, set(ref(A(), 'firmware/datos/6'), 123));
await v('más de 10 000 000 de caracteres', false, set(ref(A(), 'firmware/datos/7'), 'A'.repeat(10000001)));
await v('el dueño de una TV NO sube binarios', false, set(ref(U(), 'firmware/datos/5'), 'QUJD'));
await v('la TV NO sube binarios', false, set(ref(TV(), 'firmware/datos/5'), 'QUJD'));
await v('sin sesión NO sube binarios', false, set(ref(anonimo(), 'firmware/datos/5'), 'QUJD'));
await semilla({ firmware: { datos: { 5: 'QUJD' } } });
await v('la TV puede bajar el binario', true, get(ref(TV(), 'firmware/datos/5')));
await v('el administrador puede leerlo', true, get(ref(A(), 'firmware/datos/5')));
await v('una cuenta normal NO baja el binario', false, get(ref(U(), 'firmware/datos/5')));
await v('una cuenta ajena NO baja el binario', false, get(ref(X(), 'firmware/datos/5')));
await v('sin sesión NO baja el binario', false, get(ref(anonimo(), 'firmware/datos/5')));
await v('nadie lista todos los binarios (ni la TV)', false, get(ref(TV(), 'firmware/datos')));

await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
