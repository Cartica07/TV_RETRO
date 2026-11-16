import { fileURLToPath } from 'node:url';
// Pruebas de database.rules.json con el emulador de Firebase (no toca la base real).
// Uso: npx firebase emulators:exec --only database --project demo-tvretro "node reglas.mjs"
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO || new URL('../database.rules.json', import.meta.url), 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const entorno = await initializeTestEnvironment({ projectId: 'demo-tvretro', database: { rules: REGLAS, host, port: Number(puerto) } });
let ok = 0, mal = 0;
const verifica = async (nombre, hacer, esperaOk) => {
  let resultado;
  try { await (esperaOk ? assertSucceeds(hacer()) : assertFails(hacer())); resultado = true; } catch (e) { resultado = false; console.log('    detalle:', String(e.message || e).split('\n')[0].slice(0, 160)); }
  if (resultado) ok++; else mal++;
  console.log(`${resultado ? 'OK  ' : 'MAL '} ${esperaOk ? 'permite ' : 'bloquea '}${nombre}`);
};
const permite = (n, f) => verifica(n, f, true);
const bloquea = (n, f) => verifica(n, f, false);

const ahora = Date.now();
const CODIGO = 'K7M2QX';
const SV = { '.sv': 'timestamp' };
const base = async () => {
  await entorno.clearDatabase();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('administradores/ADM').set(true);
    await db.ref('dispositivos/tv1/dueno').set('A');
    await db.ref('dispositivos/tv1/oled_remota').set({ version: 1, contadorVersion: 1, pantalla: { tipo: 'texto', texto: 'hola' } });
    await db.ref('dispositivos/tv2/dueno').set('B');
    await db.ref('dispositivos/tv3/oled_remota/version').set(1); // sin dueño
    await db.ref('emparejamiento/' + CODIGO).set({ id: 'tv3', creado: SV });
    await db.ref('emparejamiento/VENCID').set({ id: 'tv3', creado: ahora - 700000 });
    await db.ref('emparejamiento/OTRA22').set({ id: 'tv2', creado: SV });
    await db.ref('usuarios/A/imagenes/foto').set({ datos: 'ab', ancho: 128, alto: 64 });
    await db.ref('musicales/indice/cancion1').set({ nombre: 'x' });
    await db.ref('musicales/datos/cancion1').set('AAAA');
  });
};
const como = (uid, claims = {}) => entorno.authenticatedContext(uid, Object.assign({ email_verified: true }, claims)).database(); // Etapa 2: las cuentas de prueba tienen el correo verificado (lo sin verificar se prueba en reglas-etapa2.mjs)
const anonimo = () => entorno.unauthenticatedContext().database();
const tv = (id) => como('uid-' + id, { dispositivo: id });

console.log('== Sin sesión ==');
await base();
await bloquea('leer un dispositivo', () => anonimo().ref('dispositivos/tv1').get());
await bloquea('leer musicales', () => anonimo().ref('musicales/indice').get());
await bloquea('escribir en la raíz', () => anonimo().ref('cualquier').set(1));
await bloquea('leer la raíz', () => anonimo().ref('/').get());

console.log('== Dueño y otros usuarios ==');
await permite('dueño lee su dispositivo', () => como('A').ref('dispositivos/tv1').get());
await permite('dueño lee la version', () => como('A').ref('dispositivos/tv1/oled_remota/version').get());
await bloquea('otro usuario lee un dispositivo ajeno', () => como('B').ref('dispositivos/tv1').get());
await bloquea('usuario cualquiera lee dispositivo sin dueño', () => como('B').ref('dispositivos/tv3').get());
const envio = { 'oled_remota/version': 5, 'oled_remota/contadorVersion': 5, 'oled_remota/pantalla': { tipo: 'imagen', imagen: { ancho: 128, alto: 64, datos: 'ff00' } }, 'oled_remota/archivo': null };
await permite('dueño envía (update con version, pantalla y archivo=null)', () => como('A').ref('dispositivos/tv1').update(envio));
await permite('dueño envía texto', () => como('A').ref('dispositivos/tv1/oled_remota/pantalla').set({ tipo: 'texto', texto: 'hola', config: { tamano: 2 } }));
await permite('dueño reserva versión (transacción)', () => como('A').ref('dispositivos/tv1/oled_remota/contadorVersion').transaction((v) => (v || 0) + 1));
await permite('dueño envía animación z1 con archivo', () => como('A').ref('dispositivos/tv1').update({ 'oled_remota/version': 6, 'oled_remota/pantalla': { tipo: 'animacion', animacion: { nombre: 'x', formato: 'z1', cantidad: 3 } }, 'oled_remota/archivo': { version: 6, datos: 'QUJD' } }));
await bloquea('otro usuario envía a un dispositivo ajeno', () => como('B').ref('dispositivos/tv1').update(envio));
await bloquea('dueño escribe tipo inválido', () => como('A').ref('dispositivos/tv1/oled_remota/pantalla').set({ tipo: 'virus' }));
await bloquea('dueño escribe texto de más de 5000 caracteres', () => como('A').ref('dispositivos/tv1/oled_remota/pantalla').set({ tipo: 'texto', texto: 'x'.repeat(5001) }));
await bloquea('dueño escribe un campo desconocido en oled_remota', () => como('A').ref('dispositivos/tv1/oled_remota/basura').set(1));
await bloquea('dueño escribe lastSeen (es solo de la TV)', () => como('A').ref('dispositivos/tv1/oled_remota/lastSeen').set(5));
await bloquea('archivo.datos de más de 10.000.000 caracteres', () => como('A').ref('dispositivos/tv1/oled_remota/archivo/datos').set('x'.repeat(10100000)));

console.log('== La TV ==');
await base();
await permite('TV lee la version de su nodo', () => tv('tv1').ref('dispositivos/tv1/oled_remota/version').get());
await permite('TV lee su pantalla', () => tv('tv1').ref('dispositivos/tv1/oled_remota/pantalla').get());
await permite('TV escribe lastSeen (server timestamp)', () => tv('tv1').ref('dispositivos/tv1/oled_remota/lastSeen').set({ '.sv': 'timestamp' }));
await bloquea('TV lee el nodo de otra TV', () => tv('tv1').ref('dispositivos/tv2').get());
await bloquea('TV escribe lastSeen de otra TV', () => tv('tv1').ref('dispositivos/tv2/oled_remota/lastSeen').set({ '.sv': 'timestamp' }));
await bloquea('TV escribe la pantalla (solo el dueño)', () => tv('tv1').ref('dispositivos/tv1/oled_remota/pantalla').set({ tipo: 'texto' }));
await bloquea('TV se pone un dueño', () => tv('tv1').ref('dispositivos/tv1/dueno').set('uid-tv1'));
await bloquea('TV lee el catálogo de un usuario', () => tv('tv1').ref('usuarios/A').get());

console.log('== Código de emparejamiento ==');
await base();
await permite('TV publica su código (6 caracteres, vence en 10 min)', () => tv('tv1').ref('emparejamiento/ABCD23').set({ id: 'tv1', creado: SV }));
await bloquea('TV publica un código a nombre de otra TV', () => tv('tv1').ref('emparejamiento/ABCD24').set({ id: 'tv2', creado: SV }));
await bloquea('código con caracteres confusos (0, O, 1, I)', () => tv('tv1').ref('emparejamiento/ABCD01').set({ id: 'tv1', creado: SV }));
await bloquea('código de 8 caracteres', () => tv('tv1').ref('emparejamiento/ABCD2345').set({ id: 'tv1', creado: SV }));
await bloquea('TV pone una hora inventada en vez de la del servidor', () => tv('tv1').ref('emparejamiento/ABCD25').set({ id: 'tv1', creado: ahora - 1000 }));
await permite('TV crea otro código y luego lo reescribe a nombre de otra TV (debe bloquearse): primero crea', () => tv('tv1').ref('emparejamiento/ABCD28').set({ id: 'tv1', creado: SV }));
await bloquea('TV reescribe su código a nombre de otra TV', () => tv('tv1').ref('emparejamiento/ABCD28').set({ id: 'tv2', creado: SV }));
await bloquea('código con campos de más', () => tv('tv1').ref('emparejamiento/ABCD26').set({ id: 'tv1', creado: SV, extra: 1 }));
await bloquea('un usuario crea un código', () => como('A').ref('emparejamiento/ABCD27').set({ id: 'tv1', creado: SV }));
await permite('un usuario con sesión lee un código que conoce', () => como('B').ref('emparejamiento/' + CODIGO).get());
await bloquea('un usuario lista todos los códigos', () => como('B').ref('emparejamiento').get());
await bloquea('sin sesión lee un código', () => anonimo().ref('emparejamiento/' + CODIGO).get());
await bloquea('otra TV borra el código de tv3', () => tv('tv1').ref('emparejamiento/' + CODIGO).remove());
await permite('la TV borra su propio código', () => tv('tv3').ref('emparejamiento/' + CODIGO).remove());

console.log('== Reclamar una TV ==');
await base();
await permite('reclamar con código válido', () => como('C').ref('dispositivos/tv3').update({ dueno: 'C', codigoUsado: CODIGO }));
await permite('después el dueño nuevo lee su TV', () => como('C').ref('dispositivos/tv3').get());
await permite('y la agrega a su lista', () => como('C').ref('usuarios/C/dispositivos/tv3').set(true));
await bloquea('otro usuario reclama la misma TV ya reclamada', () => como('D').ref('dispositivos/tv3').update({ dueno: 'D', codigoUsado: CODIGO }));
await base();
await bloquea('reclamar con código vencido', () => como('C').ref('dispositivos/tv3').update({ dueno: 'C', codigoUsado: 'VENCID' }));
await bloquea('reclamar con el código de otra TV', () => como('C').ref('dispositivos/tv3').update({ dueno: 'C', codigoUsado: 'OTRA22' }));
await bloquea('reclamar sin código', () => como('C').ref('dispositivos/tv3/dueno').set('C'));
await bloquea('reclamar con un código inventado', () => como('C').ref('dispositivos/tv3').update({ dueno: 'C', codigoUsado: 'ZZZZZZ' }));
await bloquea('reclamar a nombre de otro usuario', () => como('C').ref('dispositivos/tv3').update({ dueno: 'D', codigoUsado: CODIGO }));
await bloquea('reclamar sin sesión', () => anonimo().ref('dispositivos/tv3').update({ dueno: 'C', codigoUsado: CODIGO }));
await bloquea('reclamar una TV que ya tiene dueño (tv2)', () => como('C').ref('dispositivos/tv2').update({ dueno: 'C', codigoUsado: 'OTRA22' }));
await bloquea('agregar a su lista una TV que no es suya', () => como('C').ref('usuarios/C/dispositivos/tv1').set(true));
await bloquea('agregar a la lista de otro usuario', () => como('C').ref('usuarios/A/dispositivos/tv1').set(true));

console.log('== Desvincular ==');
await base();
await bloquea('otro usuario desvincula una TV ajena', () => como('B').ref('dispositivos/tv1/dueno').remove());
await permite('el dueño desvincula su TV', () => como('A').ref('dispositivos/tv1/dueno').remove());
await permite('y la TV puede ver que ya no tiene dueño', () => tv('tv1').ref('dispositivos/tv1/dueno').get());
await base();
await entorno.withSecurityRulesDisabled(async (ctx) => { const db = ctx.database(); await db.ref('dispositivos/tv1/codigoUsado').set('K7M2QX'); await db.ref('usuarios/A/dispositivos/tv1').set(true); });
const desvincular = { 'dispositivos/tv1/dueno': null, 'dispositivos/tv1/codigoUsado': null, 'usuarios/A/dispositivos/tv1': null };
await bloquea('otro usuario desvincula con el update de tres rutas del panel', () => como('B').ref().update(desvincular));
await permite('el dueño desvincula con el update de tres rutas del panel', () => como('A').ref().update(desvincular));
await permite('después otro usuario reclama esa TV con un código nuevo', async () => {
  await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('emparejamiento/PQRST2').set({ id: 'tv1', creado: Date.now() }); });
  await como('E').ref('dispositivos/tv1').update({ dueno: 'E', codigoUsado: 'PQRST2' });
});

console.log('== Miembros e invitaciones (solo con reglas propuestas) ==');
if (process.env.REGLAS_ARCHIVO) {
  const INV = 'KMEMB2';
  const sembrar = async () => {
    await base();
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database();
      await db.ref('dispositivos/tv1/codigoUsado').set(CODIGO);
      await db.ref('usuarios/A/dispositivos/tv1').set(true);
    });
  };
  const crearInv = (uid, id, codigo) => como(uid).ref('invitaciones/' + codigo).set({ id, creado: SV });
  await sembrar();
  await permite('el dueño crea una invitación para su TV', () => crearInv('A', 'tv1', INV));
  await bloquea('otro usuario crea una invitación para una TV ajena', () => crearInv('B', 'tv1', 'KMEMB3'));
  await bloquea('un usuario sin TV crea una invitación', () => crearInv('B', 'tv9', 'KMEMB4'));
  await bloquea('invitación con hora inventada', () => como('A').ref('invitaciones/KMEMB5').set({ id: 'tv1', creado: ahora - 1000 }));
  await bloquea('invitación con código de 8 caracteres', () => como('A').ref('invitaciones/KMEMB234').set({ id: 'tv1', creado: SV }));
  await bloquea('invitación con campos de más', () => como('A').ref('invitaciones/KMEMB6').set({ id: 'tv1', creado: SV, extra: 1 }));
  await bloquea('una TV crea una invitación', () => tv('tv1').ref('invitaciones/KMEMB7').set({ id: 'tv1', creado: SV }));
  await bloquea('sin sesión crea una invitación', () => anonimo().ref('invitaciones/KMEMB8').set({ id: 'tv1', creado: SV }));
  await bloquea('el dueño no puede reescribir una invitación vigente', () => crearInv('A', 'tv1', INV));
  await bloquea('listar todas las invitaciones', () => como('B').ref('invitaciones').get());
  await permite('un usuario con sesión lee la invitación que conoce', () => como('B').ref('invitaciones/' + INV).get());
  await bloquea('sin sesión lee una invitación', () => anonimo().ref('invitaciones/' + INV).get());
  await bloquea('otro usuario borra una invitación que no es suya', () => como('B').ref('invitaciones/' + INV).remove());

  console.log('-- Unirse como miembro --');
  const sembrarInv = (codigo, id, creado) => entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('invitaciones/' + codigo).set({ id, creado }); });
  await bloquea('unirse sin invitación', () => como('B').ref('dispositivos/tv1/miembros/B').set('ZZZZZZ'));
  await bloquea('unirse a nombre de otro usuario', () => como('B').ref('dispositivos/tv1/miembros/C').set(INV));
  await bloquea('unirse con la invitación de otra TV', async () => { await sembrarInv('XTRTV2', 'tv2', Date.now()); await como('B').ref('dispositivos/tv1/miembros/B').set('XTRTV2'); });
  await bloquea('unirse con una invitación vencida', async () => { await sembrarInv('VENCE2', 'tv1', ahora - 700000); await como('B').ref('dispositivos/tv1/miembros/B').set('VENCE2'); });
  await bloquea('unirse con un valor que no es un código', () => como('B').ref('dispositivos/tv1/miembros/B').set(true));
  await bloquea('unirse a una TV sin dueño', async () => { await sembrarInv('SNDUE2', 'tv3', Date.now()); await como('B').ref('dispositivos/tv3/miembros/B').set('SNDUE2'); });
  await bloquea('el dueño se agrega como miembro de su propia TV', () => como('A').ref('dispositivos/tv1/miembros/A').set(INV));
  const unir = (uid, id, codigo) => como(uid).ref().update({ ['dispositivos/' + id + '/miembros/' + uid]: codigo, ['invitaciones/' + codigo]: null });
  await bloquea('unirse sin borrar la invitación usada (se podría reutilizar)', () => como('B').ref('dispositivos/tv1/miembros/B').set(INV));
  await permite('B se une con la invitación vigente (y la borra en el mismo paso)', () => unir('B', 'tv1', INV));
  await bloquea('otro usuario borra una invitación ajena (ya usada o no)', () => como('C').ref('invitaciones/' + INV).remove());
  await bloquea('la invitación usada ya no sirve para otro', () => unir('C', 'tv1', INV));
  await permite('B agrega la TV a su lista', () => como('B').ref('usuarios/B/dispositivos/tv1').set(true));
  await bloquea('C agrega a su lista una TV que no es suya ni compartida', () => como('C').ref('usuarios/C/dispositivos/tv1').set(true));

  console.log('-- Lo que puede hacer un miembro --');
  await permite('el miembro lee la TV', () => como('B').ref('dispositivos/tv1').get());
  await permite('el miembro lee la lista de miembros', () => como('B').ref('dispositivos/tv1/miembros').get());
  await permite('el miembro envía (update con version, pantalla y archivo=null)', () => como('B').ref('dispositivos/tv1').update(envio));
  await permite('el miembro reserva versión', () => como('B').ref('dispositivos/tv1/oled_remota/contadorVersion').transaction((v) => (v || 0) + 1));
  await bloquea('el miembro desvincula la TV', () => como('B').ref('dispositivos/tv1/dueno').remove());
  await bloquea('el miembro se hace dueño', () => como('B').ref('dispositivos/tv1/dueno').set('B'));
  await bloquea('el miembro agrega a otro miembro', () => como('B').ref('dispositivos/tv1/miembros/C').set(INV));
  await bloquea('el miembro quita a otro miembro', async () => { await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('dispositivos/tv1/miembros/D').set('QQQQQ2'); }); await como('B').ref('dispositivos/tv1/miembros/D').remove(); });
  await bloquea('el miembro crea una invitación', () => crearInv('B', 'tv1', 'KMEMB9'));
  await bloquea('un usuario ajeno lee la TV', () => como('C').ref('dispositivos/tv1').get());
  await bloquea('un usuario ajeno envía a la TV', () => como('C').ref('dispositivos/tv1').update(envio));
  await permite('la TV lee sus miembros', () => tv('tv1').ref('dispositivos/tv1/miembros').get());
  await bloquea('la TV agrega un miembro', () => tv('tv1').ref('dispositivos/tv1/miembros/C').set(INV));

  console.log('-- Salir y quitar --');
  await permite('B se sale de la TV', () => como('B').ref('dispositivos/tv1/miembros/B').remove());
  await bloquea('después de salir, B ya no envía', () => como('B').ref('dispositivos/tv1').update(envio));
  await permite('B quita la TV de su lista', () => como('B').ref('usuarios/B/dispositivos/tv1').remove());
  await sembrar();
  await entorno.withSecurityRulesDisabled(async (ctx) => { const db = ctx.database(); await db.ref('dispositivos/tv1/miembros').set({ M1: 'AAAAA2', M2: 'AAAAA3', M3: 'AAAAA4', M4: 'AAAAA5' }); await db.ref('invitaciones/QUENT2').set({ id: 'tv1', creado: Date.now() }); await db.ref('invitaciones/SEXT22').set({ id: 'tv1', creado: Date.now() }); });
  await permite('un quinto miembro se une', () => unir('M5', 'tv1', 'QUENT2'));
  await permite('el dueño quita a un miembro', () => como('A').ref('dispositivos/tv1/miembros/M1').remove());
  await bloquea('otro usuario quita a un miembro', () => como('M6').ref('dispositivos/tv1/miembros/M2').remove());

  console.log('-- Desvincular con miembros y la señal --');
  const desvincularTodo = { 'dispositivos/tv1/dueno': null, 'dispositivos/tv1/codigoUsado': null, 'dispositivos/tv1/miembros': null, 'dispositivos/tv1/oled_remota/version': -2, 'usuarios/A/dispositivos/tv1': null };
  await bloquea('un miembro desvincula con el update del panel', () => como('M5').ref().update(desvincularTodo));
  await bloquea('un usuario ajeno desvincula con el update del panel', () => como('M6').ref().update(desvincularTodo));
  await permite('el dueño desvincula: quita dueño, miembros y deja la señal', () => como('A').ref().update(desvincularTodo));
  await bloquea('el dueño ya no puede enviar a la TV', () => como('A').ref('dispositivos/tv1').update(envio));
  await bloquea('el antiguo miembro ya no envía', () => como('M5').ref('dispositivos/tv1').update(envio));
  await bloquea('el antiguo miembro ya no lee la TV', () => como('M5').ref('dispositivos/tv1').get());
  await permite('la TV lee la señal de desvinculación (version = -2) en su ruta', async () => { const v = (await tv('tv1').ref('dispositivos/tv1/oled_remota/version').get()).val(); if (v !== -2) throw new Error('version ' + v); });
  await permite('el antiguo miembro quita la TV de su lista', () => como('M5').ref('usuarios/M5/dispositivos/tv1').remove());
  await permite('después un usuario nuevo reclama la TV con un código nuevo', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('emparejamiento/NUEVA2').set({ id: 'tv1', creado: Date.now() }); });
    await como('E').ref('dispositivos/tv1').update({ dueno: 'E', codigoUsado: 'NUEVA2' });
  });
  await sembrar();
} else console.log('(solo con REGLAS_ARCHIVO: se omite)');

console.log('== Catálogos y biblioteca ==');
await base();
await permite('usuario lee su catálogo', () => como('A').ref('usuarios/A').get());
await bloquea('usuario lee el catálogo de otro', () => como('B').ref('usuarios/A').get());
await permite('usuario guarda una imagen (con su contador)', () => como('A').ref().update({ 'usuarios/A/imagenes/nueva': { datos: 'abcd', ancho: 128, alto: 64, meta: { origen: 'dibujo' } }, 'usuarios/A/cuotas/usados': 1, 'usuarios/A/cuotas/ultimo': 'i:nueva' }));
await permite('usuario guarda una animación (con su contador)', () => como('A').ref().update({ 'usuarios/A/animaciones/gif1': { ancho: 128, alto: 64, cuadros: [{ datos: 'ab', dur: 100 }], meta: { origen: 'gif' } }, 'usuarios/A/cuotas/usados': 2, 'usuarios/A/cuotas/gifs': 1, 'usuarios/A/cuotas/ultimo': 'a:gif1' }));
await bloquea('imagen sin datos', () => como('A').ref('usuarios/A/imagenes/mala').set({ ancho: 128 }));
await bloquea('imagen con datos de más de 100000 caracteres', () => como('A').ref('usuarios/A/imagenes/grande').set({ datos: 'x'.repeat(100001), ancho: 128, alto: 64 }));
await bloquea('usuario escribe en el catálogo de otro', () => como('B').ref('usuarios/A/imagenes/x').set({ datos: 'a', ancho: 1, alto: 1 }));
await permite('usuario con sesión lee el índice de musicales', () => como('A').ref('musicales/indice').get());
await permite('usuario con sesión lee una canción', () => como('A').ref('musicales/datos/cancion1').get());
await bloquea('usuario descarga todo musicales de una vez', () => como('A').ref('musicales').get());
await bloquea('usuario normal escribe una canción', () => como('A').ref('musicales/indice/hack').set({ nombre: 'x' }));
await permite('administrador importa una canción (update en musicales)', () => como('ADM').ref('musicales').update({ 'indice/nueva': { nombre: 'n' }, 'datos/nueva': 'QUJD' }));
await permite('administrador borra una canción', () => como('ADM').ref('musicales').update({ 'indice/nueva': null, 'datos/nueva': null }));
await bloquea('nadie escribe en administradores', () => como('A').ref('administradores/A').set(true));
await bloquea('rutas viejas (oled_remota en la raíz) ya no existen', () => como('A').ref('oled_remota/version').set(1));

console.log('== Límite de 25 por cuenta (imágenes y GIF juntos) ==');
const IMG = (n) => ({ datos: 'ab', ancho: 128, alto: 64, meta: { fecha: n } });
const ANIM = { ancho: 128, alto: 64, cuadros: [{ datos: 'ab', dur: 100 }], meta: { origen: 'gif' } };
const sembrarCuotas = async (usados, extra, gifs = 1) => {
  await base();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('usuarios/L/cuotas/usados').set(usados);
    await db.ref('usuarios/L/cuotas/gifs').set(gifs);
    if (extra !== undefined) await db.ref('usuarios/L/cuotas/extra').set(extra);
    await db.ref('usuarios/L/imagenes/existente').set(IMG(0));
    await db.ref('usuarios/L/animaciones/gifviejo').set(ANIM);
  });
};
const crear = (c, tipo, clave, usados, valor, gifs) => como(c).ref().update(Object.assign({ ['usuarios/' + c + '/' + (tipo === 'i' ? 'imagenes' : 'animaciones') + '/' + clave]: valor, ['usuarios/' + c + '/cuotas/usados']: usados, ['usuarios/' + c + '/cuotas/ultimo']: tipo + ':' + clave }, tipo === 'a' ? { ['usuarios/' + c + '/cuotas/gifs']: gifs } : {}));

await sembrarCuotas(3);
await permite('crear una imagen suma 1 al contador', () => crear('L', 'i', 'nueva1', 4, IMG(1)));
await sembrarCuotas(3);
await permite('crear una animación también suma al MISMO contador', () => crear('L', 'a', 'gifnuevo', 4, ANIM, 2));
await sembrarCuotas(24);
await permite('con 24 se puede crear la número 25', () => crear('L', 'i', 'la25', 25, IMG(25)));
await sembrarCuotas(25);
await bloquea('con 25 ya no se puede crear una imagen (pasaría de 25)', () => crear('L', 'i', 'la26', 26, IMG(26)));
await bloquea('con 25 tampoco una animación', () => crear('L', 'a', 'gif26', 26, ANIM, 2));
await sembrarCuotas(25, 5);
await permite('con 5 extras el límite es 30: se puede crear la 26', () => crear('L', 'i', 'la26', 26, IMG(26)));
await sembrarCuotas(30, 5);
await bloquea('con 5 extras y 30 usadas ya no se puede crear', () => crear('L', 'i', 'la31', 31, IMG(31)));
await sembrarCuotas(3);
await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('config/limites/total').set(3); });
await bloquea('el administrador puede bajar el límite base a 3: con 3 usadas ya no se crea', () => crear('L', 'i', 'x', 4, IMG(1)));

console.log('-- trampas --');
await sembrarCuotas(3);
await bloquea('crear una imagen SIN tocar el contador', () => como('L').ref('usuarios/L/imagenes/sinsumar').set(IMG(1)));
await bloquea('crear sumando 2 en vez de 1', () => crear('L', 'i', 'dos', 5, IMG(1)));
await bloquea('crear sin indicar "ultimo"', () => como('L').ref().update({ 'usuarios/L/imagenes/sinultimo': IMG(1), 'usuarios/L/cuotas/usados': 4 }));
await bloquea('crear con "ultimo" de otra clave', () => como('L').ref().update({ 'usuarios/L/imagenes/aa': IMG(1), 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'i:bb' }));
await bloquea('crear DOS elementos con un solo +1', () => como('L').ref().update({ 'usuarios/L/imagenes/uno': IMG(1), 'usuarios/L/imagenes/dos': IMG(2), 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'i:uno' }));
await bloquea('crear una imagen y una animación con un solo +1', () => como('L').ref().update({ 'usuarios/L/imagenes/uno': IMG(1), 'usuarios/L/animaciones/dos': ANIM, 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'i:uno' }));
await bloquea('subir el contador sin crear nada', () => como('L').ref().update({ 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'i:fantasma' }));
await bloquea('bajar el contador sin borrar nada (para "recuperar" espacio)', () => como('L').ref().update({ 'usuarios/L/cuotas/usados': 2, 'usuarios/L/cuotas/ultimo': 'i:existente' }));
await bloquea('borrar el contador para reiniciarlo', () => como('L').ref('usuarios/L/cuotas/usados').remove());
await bloquea('borrar toda la carpeta de cuotas', () => como('L').ref('usuarios/L/cuotas').remove());
await bloquea('escribirse extras a sí mismo', () => como('L').ref('usuarios/L/cuotas/extra').set(100));
await bloquea('cambiar el límite base', () => como('L').ref('config/limites/total').set(1000));
await bloquea('escribir el contador de otra cuenta', () => como('L').ref('usuarios/A/cuotas/usados').set(0));
await bloquea('borrar de golpe todo el catálogo de la cuenta', () => como('L').ref('usuarios/L/imagenes').remove());

console.log('-- borrar y reemplazar --');
await sembrarCuotas(3);
await permite('borrar una imagen resta 1 al contador', () => como('L').ref().update({ 'usuarios/L/imagenes/existente': null, 'usuarios/L/cuotas/usados': 2, 'usuarios/L/cuotas/ultimo': 'i:existente' }));
await sembrarCuotas(3);
await permite('borrar una animación resta 1', () => como('L').ref().update({ 'usuarios/L/animaciones/gifviejo': null, 'usuarios/L/cuotas/usados': 2, 'usuarios/L/cuotas/gifs': 0, 'usuarios/L/cuotas/ultimo': 'a:gifviejo' }));
await sembrarCuotas(3);
await bloquea('borrar SIN restar al contador', () => como('L').ref('usuarios/L/imagenes/existente').remove());
await bloquea('borrar restando 2', () => como('L').ref().update({ 'usuarios/L/imagenes/existente': null, 'usuarios/L/cuotas/usados': 1, 'usuarios/L/cuotas/ultimo': 'i:existente' }));
await bloquea('borrar dos elementos restando 1', () => como('L').ref().update({ 'usuarios/L/imagenes/existente': null, 'usuarios/L/animaciones/gifviejo': null, 'usuarios/L/cuotas/usados': 2, 'usuarios/L/cuotas/ultimo': 'i:existente' }));
await sembrarCuotas(25);
await permite('con 25 se puede reemplazar una existente (no suma)', () => como('L').ref('usuarios/L/imagenes/existente').set(IMG(99)));
await permite('con 25 se puede borrar y luego crear otra', async () => {
  await como('L').ref().update({ 'usuarios/L/imagenes/existente': null, 'usuarios/L/cuotas/usados': 24, 'usuarios/L/cuotas/ultimo': 'i:existente' });
  await como('L').ref().update({ 'usuarios/L/imagenes/otra': IMG(5), 'usuarios/L/cuotas/usados': 25, 'usuarios/L/cuotas/ultimo': 'i:otra' });
});

console.log('-- administrador y biblioteca --');
await sembrarCuotas(25);
await permite('el administrador no tiene límite: crea con 25 usadas y sin contador', () => como('ADM').ref('usuarios/ADM/imagenes/muchas').set(IMG(1)));
await permite('el administrador cambia el límite base', () => como('ADM').ref('config/limites/total').set(30));
await permite('el administrador da extras a una cuenta', () => como('ADM').ref('usuarios/L/cuotas/extra').set(10));
await permite('cualquier cuenta con sesión lee el límite', () => como('L').ref('config/limites').get());
await bloquea('sin sesión no lee el límite', () => anonimo().ref('config/limites').get());
await permite('el administrador guarda una imagen predeterminada', () => como('ADM').ref('biblioteca/imagenes/hola').set(IMG(1)));
await permite('el administrador guarda una animación predeterminada', () => como('ADM').ref('biblioteca/animaciones/gifbase').set(ANIM));
await permite('cualquier cuenta con sesión lee las imágenes predeterminadas', () => como('L').ref('biblioteca/imagenes').get());
await permite('cualquier cuenta con sesión lee las animaciones predeterminadas', () => como('L').ref('biblioteca/animaciones').get());
await bloquea('sin sesión no lee la biblioteca', () => anonimo().ref('biblioteca/imagenes').get());
await bloquea('una cuenta normal no escribe en la biblioteca', () => como('L').ref('biblioteca/imagenes/mia').set(IMG(1)));
await bloquea('una cuenta normal no borra de la biblioteca', () => como('L').ref('biblioteca/imagenes/hola').remove());
await bloquea('la biblioteca valida el formato', () => como('ADM').ref('biblioteca/imagenes/mala').set({ ancho: 1 }));

console.log('== Máximo de 10 GIF (además de los 25 en total) ==');
await sembrarCuotas(12, undefined, 10);
await bloquea('con 10 GIF no se puede crear el 11º', () => crear('L', 'a', 'g11', 13, ANIM, 11));
await permite('con 10 GIF sí se pueden seguir creando imágenes (el total no se llenó)', () => crear('L', 'i', 'img13', 13, IMG(13)));
await sembrarCuotas(12, undefined, 9);
await permite('con 9 GIF se puede crear el 10º', () => crear('L', 'a', 'g10', 13, ANIM, 10));
await sembrarCuotas(24, undefined, 1);
await permite('24 imágenes y 1 GIF: se puede crear la pieza 25 como GIF (24+1)', () => crear('L', 'a', 'g2', 25, ANIM, 2));
await sembrarCuotas(15, undefined, 9);
await permite('15 elementos con 9 GIF: el 10º GIF completa 16 (15 imágenes y 10 GIF caben)', () => crear('L', 'a', 'gf', 16, ANIM, 10));
await sembrarCuotas(25, undefined, 3);
await bloquea('con 25 en total no cabe una imagen aunque haya pocos GIF', () => crear('L', 'i', 'x26', 26, IMG(26)));
await bloquea('con 25 en total no cabe un GIF aunque haya pocos GIF', () => crear('L', 'a', 'g4', 26, ANIM, 4));
await sembrarCuotas(12, undefined, 10);
await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('usuarios/L/cuotas/extraAnimaciones').set(2); });
await permite('con 2 GIF extra el límite de GIF es 12: cabe el 11º', () => crear('L', 'a', 'g11', 13, ANIM, 11));
await sembrarCuotas(12, undefined, 2);
await entorno.withSecurityRulesDisabled(async (ctx) => { await ctx.database().ref('config/limites/animaciones').set(2); });
await bloquea('si el administrador baja el máximo de GIF a 2, con 2 ya no cabe otro', () => crear('L', 'a', 'g3', 13, ANIM, 3));
await sembrarCuotas(5, undefined, 1);
await permite('borrar un GIF resta 1 al total y 1 a los GIF', () => como('L').ref().update({ 'usuarios/L/animaciones/gifviejo': null, 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/gifs': 0, 'usuarios/L/cuotas/ultimo': 'a:gifviejo' }));
await sembrarCuotas(5, undefined, 1);
await bloquea('borrar un GIF sin restar a los GIF', () => como('L').ref().update({ 'usuarios/L/animaciones/gifviejo': null, 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'a:gifviejo' }));
await permite('borrar una imagen no toca los GIF', () => como('L').ref().update({ 'usuarios/L/imagenes/existente': null, 'usuarios/L/cuotas/usados': 4, 'usuarios/L/cuotas/ultimo': 'i:existente' }));
await sembrarCuotas(5, undefined, 1);
await bloquea('trampa: crear un GIF sin sumar al contador de GIF', () => como('L').ref().update({ 'usuarios/L/animaciones/nuevo': ANIM, 'usuarios/L/cuotas/usados': 6, 'usuarios/L/cuotas/ultimo': 'a:nuevo' }));
await bloquea('trampa: crear un GIF sumando 2 a los GIF', () => crear('L', 'a', 'nuevo', 6, ANIM, 3));
await bloquea('trampa: crear una imagen subiendo el contador de GIF', () => como('L').ref().update({ 'usuarios/L/imagenes/nueva': IMG(1), 'usuarios/L/cuotas/usados': 6, 'usuarios/L/cuotas/gifs': 2, 'usuarios/L/cuotas/ultimo': 'i:nueva' }));
await bloquea('trampa: crear una imagen bajando el contador de GIF', () => como('L').ref().update({ 'usuarios/L/imagenes/nueva': IMG(1), 'usuarios/L/cuotas/usados': 6, 'usuarios/L/cuotas/gifs': 0, 'usuarios/L/cuotas/ultimo': 'i:nueva' }));
await bloquea('trampa: bajar el contador de GIF sin borrar ninguno', () => como('L').ref('usuarios/L/cuotas/gifs').set(0));
await bloquea('trampa: borrar el contador de GIF', () => como('L').ref('usuarios/L/cuotas/gifs').remove());
await bloquea('trampa: escribir el contador de GIF de otra cuenta', () => como('L').ref('usuarios/A/cuotas/gifs').set(0));
await bloquea('escribirse extra de GIF a sí mismo', () => como('L').ref('usuarios/L/cuotas/extraAnimaciones').set(50));
await bloquea('cambiar el máximo de GIF base', () => como('L').ref('config/limites/animaciones').set(1000));
await permite('el administrador da GIF extra a una cuenta', () => como('ADM').ref('usuarios/L/cuotas/extraAnimaciones').set(3));
await permite('el administrador cambia el máximo de GIF base', () => como('ADM').ref('config/limites/animaciones').set(12));
await permite('el administrador crea GIF sin límite ni contadores', () => como('ADM').ref('usuarios/ADM/animaciones/muchos').set(ANIM));

console.log('== Tamaño y forma de lo que se guarda ==');
await sembrarCuotas(3);
await bloquea('imagen con un campo de más', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 128, alto: 64, relleno: 'x' }));
await bloquea('imagen con un texto enorme escondido en meta', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 128, alto: 64, meta: { nota: 'x'.repeat(5000) } }));
await bloquea('imagen con meta anidado', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 128, alto: 64, meta: { a: { b: 'c' } } }));
await bloquea('imagen con "preprocesada" de más de 60000 caracteres', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 128, alto: 64, preprocesada: 'x'.repeat(60001) }));
await bloquea('imagen con ancho absurdo', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 999999, alto: 64 }));
await permite('imagen normal con meta y preprocesada', () => como('L').ref('usuarios/L/imagenes/existente').set({ datos: 'ab', ancho: 128, alto: 64, preprocesada: 'data:image/png;base64,AAAA', meta: { origen: 'upload', fecha: 1700000000000, umbral: 127, dithering: false } }));
const cuadro = (n) => ({ datos: 'a'.repeat(1368), dur: n });
await bloquea('animación con un cuadro de más de 4096 caracteres', () => como('L').ref('usuarios/L/animaciones/gifviejo').set({ ancho: 128, alto: 64, cuadros: [{ datos: 'a'.repeat(5000), dur: 100 }] }));
await bloquea('animación con un campo de más en un cuadro', () => como('L').ref('usuarios/L/animaciones/gifviejo').set({ ancho: 128, alto: 64, cuadros: [{ datos: 'ab', dur: 100, extra: 'x' }] }));
await bloquea('animación con un campo de más', () => como('L').ref('usuarios/L/animaciones/gifviejo').set({ ancho: 128, alto: 64, cuadros: [cuadro(100)], relleno: 'x' }));
const muchos = {}; for (let i = 0; i < 1001; i++) muchos[i] = cuadro(100);
await bloquea('animación con 1001 cuadros', () => como('L').ref('usuarios/L/animaciones/gifviejo').set({ ancho: 128, alto: 64, cuadros: muchos }));
const justos = {}; for (let i = 0; i < 1000; i++) justos[i] = cuadro(100);
await permite('animación con 1000 cuadros (el máximo)', () => como('L').ref('usuarios/L/animaciones/gifviejo').set({ ancho: 128, alto: 64, cuadros: justos, meta: { origen: 'gif' } }));
await bloquea('la biblioteca también limita el tamaño', () => como('ADM').ref('biblioteca/animaciones/enorme').set({ ancho: 128, alto: 64, cuadros: [{ datos: 'a'.repeat(5000), dur: 1 }] }));

// Compatibilidad: lo que hay guardado de verdad (respaldo del 2026-11-11) tiene que seguir siendo válido.
const dirRespaldo = fileURLToPath(new URL('../herramientas/salida/', import.meta.url));
const archivoRespaldo = fs.existsSync(dirRespaldo) ? fs.readdirSync(dirRespaldo).find((n) => n.startsWith('respaldo-')) : null;
if (archivoRespaldo) {
  const real = JSON.parse(fs.readFileSync(dirRespaldo + archivoRespaldo, 'utf8'));
  const rev = (o) => JSON.parse(JSON.stringify(o).replace(/"([^"]+)":null/g, ''));
  for (const [clave, v] of Object.entries(real.imagenes || {})) await permite('imagen real "' + clave + '" cumple la forma', () => como('ADM').ref('biblioteca/imagenes/' + clave.replace(/[.#$[\]/]/g, '_')).set(v));
  for (const [clave, v] of Object.entries(real.animaciones || {})) await permite('animación real "' + clave + '" cumple la forma', () => como('ADM').ref('biblioteca/animaciones/' + clave.replace(/[.#$[\]/]/g, '_')).set(v));
} else console.log('(sin respaldo local: se omite la prueba con datos reales)');

console.log(`\nResultado: ${ok} bien, ${mal} mal`);
await entorno.cleanup();
process.exit(mal ? 1 : 0);
