// Más > Juegos: pantalla.tipo = "juego" con juego.id. Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-juego', database: { rules: REGLAS, host, port: Number(puerto) } });
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
const config = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
// Igual a lo que manda el panel (enviarEstado): version, pantalla y archivo null en un solo update().
const envio = (pantalla, version = 6) => ({ version, pantalla: { texto: 'Hola', config, ...pantalla }, archivo: null });

await semilla();
await v('dueño: orden de juego como la manda el panel', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'snake' } })));
await semilla();
await v('miembro: también puede mandar la orden', true, update(ref(M(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'invaders' } })));
await v('una cuenta ajena no puede', false, update(ref(X(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'snake' } }, 7)));
await v('sin sesión no puede', false, update(ref(env.unauthenticatedContext().database(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'snake' } }, 8)));
await v('id con mayúsculas', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'Snake' } }, 9)));
await v('id con números o símbolos', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'sn4ke/..' } }, 9)));
await v('id vacío', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: '' } }, 9)));
await v('id de 13 letras', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'abcdefghijklm' } }, 9)));
await v('id de 12 letras (límite)', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'abcdefghijkl' } }, 9)));
await v('id que no es texto', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 5 } }, 10)));
await v('campo extra dentro de juego', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'snake', extra: 'x' } }, 10)));
await v('tipo desconocido sigue prohibido', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'hack', juego: { id: 'snake' } }, 10)));
await v('hijo desconocido en pantalla sigue prohibido', false, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'juego', juego: { id: 'snake' }, otro: 1 }, 10)));
await v('los tipos de siempre siguen funcionando (texto)', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'texto' }, 11)));
await v('los tipos de siempre siguen funcionando (imagen)', true, update(ref(U(), 'dispositivos/T/oled_remota'), envio({ tipo: 'imagen', imagen: { ancho: 128, alto: 64, datos: 'AA' } }, 12)));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
