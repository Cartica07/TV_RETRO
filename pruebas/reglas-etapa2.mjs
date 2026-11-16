// Etapa 2: version, forma de pantalla, meta cerrado y correo verificado. Con emulators:exec y REGLAS_ARCHIVO.
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, update } from 'firebase/database';
const REGLAS = fs.readFileSync(process.env.REGLAS_ARCHIVO, 'utf8');
const [host, puerto] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-etapa2', database: { rules: REGLAS, host, port: Number(puerto) } });
let fallas = 0;
const v = async (n, debe, p) => { let ok; try { await p; ok = true; } catch (e) { ok = false; } if (ok !== debe) fallas++; console.log(`${ok === debe ? 'OK   ' : 'FALLA'} ${n} (${ok ? 'permitido' : 'denegado'})`); };
await env.withSecurityRulesDisabled(async (c) => {
  await set(ref(c.database(), '/'), { dispositivos: { T: { dueno: 'D', miembros: { M: 'ABCDEF' }, oled_remota: { version: 5 } } },
    usuarios: { U: { imagenes: { x: { datos: 'AA', ancho: 1, alto: 1 } }, cuotas: { usados: 1, ultimo: 'i:x' } } }, administradores: { ADM: true } });
});
const D = env.authenticatedContext('D').database(), M = env.authenticatedContext('M').database();
const OLED = 'dispositivos/T/oled_remota';
const cfg = { tamano: 2, alineacion: 'centro', alineacionV: 'centro', invertido: false, modoTexto: 'ajustar', fuente: 'sans', manual: false, x: 0, y: 0, direccion: 'h' };
const b64 = 'A'.repeat(1368);
// version
await v('version entera normal', true, set(ref(M, OLED + '/version'), 6));
await v('version decimal', false, set(ref(M, OLED + '/version'), 1.5));
await v('version > int32', false, set(ref(M, OLED + '/version'), 2147483653));
await v('version -2 por un miembro', false, set(ref(M, OLED + '/version'), -2));
await v('version -2 por el dueño (desvincular)', true, set(ref(D, OLED + '/version'), -2));
await v('version -5', false, set(ref(D, OLED + '/version'), -5));
await v('contadorVersion normal', true, set(ref(M, OLED + '/contadorVersion'), 7));
await v('contadorVersion 1e15', false, set(ref(M, OLED + '/contadorVersion'), 1e15));
// pantalla legítima, tal como la manda el panel
const env1 = (pantalla, archivo = null) => update(ref(M, OLED), { version: 10, pantalla, archivo });
await v('pantalla texto', true, env1({ texto: 'Hola', tipo: 'texto', config: cfg }));
await v('pantalla imagen', true, env1({ texto: 'x', tipo: 'imagen', config: cfg, imagen: { ancho: 128, alto: 64, datos: b64 } }));
await v('pantalla cancion con 922 notas', true, env1({ texto: 'x', tipo: 'cancion', config: cfg, cancion: { nombre: 'a', repeticiones: 2, notas: Array.from({ length: 922 }, (_, i) => [440 + i, 120]) } }));
await v('pantalla animacion z1 + archivo', true, env1({ texto: 'x', tipo: 'animacion', config: cfg, animacion: { nombre: 'g', ancho: 128, alto: 64, formato: 'z1', cantidad: 40 } }, { version: 10, datos: 'QUJD' }));
await v('pantalla animacion con cuadros (formato viejo)', true, env1({ texto: 'x', tipo: 'animacion', config: cfg, animacion: { nombre: 'g', ancho: 128, alto: 64, cuadros: [{ datos: b64, dur: 100 }, { datos: b64, dur: 200 }] } }));
await v('pantalla musical + archivo', true, env1({ texto: 'x', tipo: 'musical', config: cfg, musical: { nombre: 'm', repeticiones: 1, formato: 'm1' } }, { version: 10, datos: 'QUJD' }));
// pantalla envenenada
await v('hijo extra de 1 MB en pantalla', false, env1({ texto: 'x', tipo: 'texto', config: cfg, basura: 'Z'.repeat(1000000) }));
await v('hijo extra dentro de config', false, env1({ texto: 'x', tipo: 'texto', config: Object.assign({ extra: 'x' }, cfg) }));
await v('tipo desconocido', false, env1({ texto: 'x', tipo: 'virus', config: cfg }));
await v('cancion con 20000 notas', false, env1({ texto: 'x', tipo: 'cancion', config: cfg, cancion: { nombre: 'a', repeticiones: 1, notas: Array.from({ length: 20000 }, () => [440, 1]) } }));
await v('animacion con 1001 cuadros', false, env1({ texto: 'x', tipo: 'animacion', config: cfg, animacion: { nombre: 'g', ancho: 1, alto: 1, cuadros: Array.from({ length: 1001 }, () => ({ datos: 'AA', dur: 1 })) } }));
await v('imagen con hijo extra', false, env1({ texto: 'x', tipo: 'imagen', config: cfg, imagen: { ancho: 1, alto: 1, datos: 'AA', extra: 'x' } }));
await v('archivo con hijo extra', false, env1({ texto: 'x', tipo: 'texto', config: cfg }, { version: 10, datos: 'QUJD', basura: 'x' }));
await v('archivo null (borrar) sigue permitido', true, env1({ texto: 'x', tipo: 'texto', config: cfg }, null));
// catálogo: meta cerrado y correo verificado
const ok = env.authenticatedContext('U', { email_verified: true }).database();
const noVer = env.authenticatedContext('U', { email_verified: false }).database();
const adm = env.authenticatedContext('ADM', { email_verified: false }).database();
const imgOk = { datos: 'AA', ancho: 128, alto: 64, meta: { origen: 'upload', umbral: 127, dithering: true, fecha: Date.now(), escala: 'ajustar', fondo: 'negro', rotar: 0, volteoH: false, volteoV: false } };
await v('verificado: reemplazar imagen con meta válido', true, set(ref(ok, 'usuarios/U/imagenes/x'), imgOk));
await v('verificado: meta con clave desconocida', false, set(ref(ok, 'usuarios/U/imagenes/x'), Object.assign({}, imgOk, { meta: { k1: 'x' } })));
await v('verificado: crear imagen nueva con cuota', true, update(ref(ok), { 'usuarios/U/imagenes/nueva': imgOk, 'usuarios/U/cuotas/usados': 2, 'usuarios/U/cuotas/ultimo': 'i:nueva' }));
await v('SIN verificar: reemplazar imagen', false, set(ref(noVer, 'usuarios/U/imagenes/x'), imgOk));
await v('SIN verificar: crear imagen nueva', false, update(ref(noVer), { 'usuarios/U/imagenes/otra': imgOk, 'usuarios/U/cuotas/usados': 3, 'usuarios/U/cuotas/ultimo': 'i:otra' }));
await v('SIN verificar: borrar una imagen (libera cuota)', true, update(ref(noVer), { 'usuarios/U/imagenes/nueva': null, 'usuarios/U/cuotas/usados': 1, 'usuarios/U/cuotas/ultimo': 'i:nueva' }));
await v('administrador sin verificar: puede guardar', true, set(ref(adm, 'usuarios/ADM/imagenes/a'), imgOk));
await v('animacion: cuadro de 3000 caracteres', false, set(ref(ok, 'usuarios/U/animaciones/g'), { ancho: 128, alto: 64, cuadros: [{ datos: 'A'.repeat(3000), dur: 100 }] }));
await env.cleanup();
console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
