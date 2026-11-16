// Etapa 1, paso 4: vincular/unirse en UNA sola update(). Uso: dentro de emulators:exec, con REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update, get } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-atomico', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const veredicto = async (nombre, debe, p) => {
  let ok; try { await p; ok = true; } catch (e) { ok = false; }
  const bien = ok === debe; if (!bien) fallas++;
  console.log(`${bien ? 'OK   ' : 'FALLA'} ${nombre} (${ok ? 'permitido' : 'denegado'})`);
};
const ahora = Date.now();
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), {
    emparejamiento: { K7M2QX: { id: 'tvNueva', creado: ahora }, VENCID: { id: 'tvVieja', creado: ahora - 3600000 }, ABCD23: { id: 'tvAjena', creado: ahora } },
    dispositivos: { tvNueva: { oled_remota: { version: 1 } }, tvVieja: {}, tvAjena: { dueno: 'otro' }, tvDeOtro: { dueno: 'otro', miembros: {} } },
    invitaciones: { NVW234: { id: 'tvDeOtro', creado: ahora } }
  });
});
const db = (uid) => env.authenticatedContext(uid).database();
// Vincular en una sola operación
await veredicto('vincular: dueño + código + lista en una update()', true, update(ref(db('ana')), { 'dispositivos/tvNueva/dueno': 'ana', 'dispositivos/tvNueva/codigoUsado': 'K7M2QX', 'usuarios/ana/dispositivos/tvNueva': true }));
await veredicto('vincular: código vencido (todo se rechaza)', false, update(ref(db('beto')), { 'dispositivos/tvVieja/dueno': 'beto', 'dispositivos/tvVieja/codigoUsado': 'VENCID', 'usuarios/beto/dispositivos/tvVieja': true }));
await veredicto('vincular: TV que ya tiene dueño', false, update(ref(db('beto')), { 'dispositivos/tvAjena/dueno': 'beto', 'dispositivos/tvAjena/codigoUsado': 'ABCD23', 'usuarios/beto/dispositivos/tvAjena': true }));
await veredicto('lista: añadir una TV sin ser dueño ni miembro', false, set(ref(db('beto'), 'usuarios/beto/dispositivos/tvAjena'), true));
await veredicto('lista: añadir una TV ajena con dueño falso en la misma update', false, update(ref(db('beto')), { 'dispositivos/tvAjena/dueno': 'beto', 'usuarios/beto/dispositivos/tvAjena': true }));
await veredicto('lista de otra cuenta: no se puede escribir', false, set(ref(db('beto'), 'usuarios/ana/dispositivos/tvNueva'), true));
await veredicto('lista: quitar una TV propia sigue permitido', true, set(ref(db('ana'), 'usuarios/ana/dispositivos/tvNueva'), null));
await veredicto('lista: volver a añadir una TV de la que ya es dueña (dato previo)', true, set(ref(db('ana'), 'usuarios/ana/dispositivos/tvNueva'), true));
// Unirse como miembro en una sola operación
await veredicto('unirse: miembro + invitación gastada + lista en una update()', true, update(ref(db('carla')), { 'dispositivos/tvDeOtro/miembros/carla': 'NVW234', 'invitaciones/NVW234': null, 'usuarios/carla/dispositivos/tvDeOtro': true }));
await veredicto('unirse: invitación inexistente', false, update(ref(db('dani')), { 'dispositivos/tvDeOtro/miembros/dani': 'NOEXI1', 'usuarios/dani/dispositivos/tvDeOtro': true }));
await env.cleanup();
console.log(fallas ? `${fallas} FALLAS` : 'todo bien');
process.exit(fallas ? 1 : 0);
