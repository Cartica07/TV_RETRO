// Etapa 5: baja de cuenta = borrar usuarios/{uid} entero. Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get, remove } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-baja', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
const IMG = { datos: 'AA', ancho: 128, alto: 64, meta: { origen: 'upload' } };
const GIF = { ancho: 128, alto: 64, cuadros: [{ datos: 'AA', dur: 100 }], meta: { origen: 'gif' } };
const semilla = async () => env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    usuarios: {
      U: { dispositivos: { T: true }, imagenes: { x: IMG, y: IMG }, animaciones: { g: GIF }, cuotas: { usados: 3, gifs: 1, ultimo: 'a:g' } },
      V: { dispositivos: { T2: true }, imagenes: { z: IMG }, cuotas: { usados: 1, ultimo: 'i:z' } }
    },
    dispositivos: { T: { dueno: 'U' }, T2: { dueno: 'V' } },
    administradores: { ADM: true }
  });
});
const existe = async (ruta) => { let r; await env.withSecurityRulesDisabled(async (c) => { r = (await get(ref(c.database(), ruta))).exists(); }); return r; };
const U = (verificado = true) => env.authenticatedContext('U', { email_verified: verificado }).database();
const V = () => env.authenticatedContext('V', { email_verified: true }).database();

await semilla();
await v('otra cuenta no puede borrar usuarios/U', false, remove(ref(V(), 'usuarios/U')));
await v('sin sesión no puede borrar usuarios/U', false, remove(ref(env.unauthenticatedContext().database(), 'usuarios/U')));
await v('U no puede reemplazar su nodo por otro con datos', false, set(ref(U(), 'usuarios/U'), { imagenes: { n: IMG } }));
await v('U no puede borrar solo cuotas (se saltaría el límite)', false, remove(ref(U(), 'usuarios/U/cuotas')));
await v('U no puede borrar todas las imagenes de golpe sin ajustar el contador', false, remove(ref(U(), 'usuarios/U/imagenes')));
await v('U puede quitar una TV de su lista (como siempre)', true, remove(ref(U(), 'usuarios/U/dispositivos/T')));
await v('U no puede vaciar cuotas poniendo usados en 0', false, set(ref(U(), 'usuarios/U/cuotas/usados'), 0));
await semilla();
await v('U borra su cuenta entera (con correo verificado)', true, remove(ref(U(), 'usuarios/U')));
console.log('   usuarios/U existe después:', await existe('usuarios/U'), '| usuarios/V intacto:', await existe('usuarios/V/imagenes/z'));
if (await existe('usuarios/U') || !(await existe('usuarios/V/imagenes/z'))) { fallas++; console.log('FALLA el borrado no dejó el estado esperado'); }
await semilla();
await v('U sin verificar el correo también puede borrar su cuenta', true, remove(ref(U(false), 'usuarios/U')));
await semilla();
await v('update multi-ruta: borra usuarios/U y suelta su TV en la misma operación (como hace la app)', true, update(ref(U()), { 'usuarios/U': null, 'dispositivos/T/dueno': null, 'dispositivos/T/oled_remota/version': -2 }));
// Después de la baja, volver a crear contenido sigue exigiendo el contador
await semilla();
await remove(ref(U(), 'usuarios/U'));
await v('cuenta vuelta a empezar: crear una imagen con su contador (1) funciona', true, update(ref(U()), { 'usuarios/U/imagenes/n': IMG, 'usuarios/U/cuotas/usados': 1, 'usuarios/U/cuotas/ultimo': 'i:n' }));
await v('cuenta vuelta a empezar: crear una imagen SIN contador sigue prohibido', false, set(ref(U(), 'usuarios/U/imagenes/m'), IMG));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
