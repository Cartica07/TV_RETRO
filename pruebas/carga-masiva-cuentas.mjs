import os from 'node:os';
// carga-masiva.html con cuentas: bloqueada sin sesión, sube a usuarios/{uid}/imagenes, lista animaciones de la cuenta.
import fs from 'node:fs';
import { abrir, cerrarServidor, informe } from './banco.mjs';

// Comprueba la sintaxis del script de la página.
const html = fs.readFileSync(new URL('../carga-masiva.html', import.meta.url), 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
fs.writeFileSync(os.tmpdir() + '/cm-script.mjs', m[1]);

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const semilla = { usuarios: { 'uid-ana': { animaciones: { gifviejo: { ancho: 128, alto: 64, cuadros: [{ datos: '00', dur: 100 }], meta: { origen: 'gif' } } } } }, imagenes: { vieja: { datos: '00', ancho: 128, alto: 64 } } };
const { navegador, pagina, errores } = await abrir(semilla, {
  ruta: '/carga-masiva.html', esperar: false,
  antes: async (p) => { await p.addInitScript(() => { globalThis.__semillaAuth = { usuarios: { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } }, actual: null }; }); }
});
await pagina.waitForTimeout(700);
const inerteSin = await pagina.evaluate(() => document.getElementById('contenidoProtegido').inert);
informe('sin sesión: el contenido queda bloqueado y se ve el formulario', inerteSin && await pagina.isVisible('#formSesion'));

await pagina.click('#botonSesion'); await pagina.waitForTimeout(150);
const e1 = (await pagina.textContent('#sesionError')).trim();
await pagina.fill('#sesionCorreo', 'ana@correo.com'); await pagina.fill('#sesionClave', 'mala'); await pagina.click('#botonSesion'); await pagina.waitForTimeout(300);
const e2 = (await pagina.textContent('#sesionError')).trim();
informe('datos vacíos o incorrectos: mensajes claros', e1 === 'Escribe tu correo.' && e2 === 'Correo o contraseña incorrectos.', `${e1} | ${e2}`);

await pagina.fill('#sesionClave', 'secreta1'); await pagina.click('#botonSesion');
await pagina.waitForFunction(() => !document.getElementById('contenidoProtegido').inert, null, { timeout: 5000 });
await pagina.waitForTimeout(600);
const titulo = (await pagina.textContent('#sesionTitulo')).trim();
const animaciones = await pagina.evaluate(() => [...document.querySelectorAll('#listaAnimacionesGuardadas input')].some((i) => i.value === 'gifviejo'));
informe('con sesión: se desbloquea y lista las animaciones de la cuenta (no las de la raíz)', titulo === 'Sesión iniciada' && animaciones, `titulo=${titulo} animaciones=${animaciones}`);

await pagina.setInputFiles('#archivos', { name: 'foto.png', mimeType: 'image/png', buffer: PNG });
await pagina.waitForTimeout(500);
await pagina.click('#botonSubir'); await pagina.waitForTimeout(1200);
const esc = await pagina.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
informe('subir una imagen la guarda en usuarios/{uid}/imagenes (nunca en la raíz)', esc.some((r) => r.startsWith('usuarios/uid-ana/imagenes/')) && !esc.some((r) => /^imagenes\//.test(r)), JSON.stringify(esc));

await pagina.click('#botonSalirSesion');
await pagina.waitForTimeout(2000); // recarga la página
await pagina.waitForFunction(() => document.getElementById('contenidoProtegido').inert, null, { timeout: 8000 });
informe('cerrar sesión vuelve a bloquear la página', await pagina.evaluate(() => globalThis.__fakeAuth.actual === null && document.getElementById('contenidoProtegido').inert));
informe('sin errores de la página', errores.filter((e) => e.startsWith('página:')).length === 0, errores.join(' | ').slice(0, 200));
await navegador.close(); cerrarServidor();
