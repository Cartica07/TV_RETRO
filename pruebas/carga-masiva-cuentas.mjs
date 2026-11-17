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

informe('una cuenta que no es administradora no ve el interruptor de la biblioteca predeterminada', !(await pagina.isVisible('#tarjetaDestino')));

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
await navegador.close();

// ---- Administrador: biblioteca predeterminada ----
const semillaAdmin = {
  administradores: { 'uid-ana': true },
  usuarios: { 'uid-ana': { animaciones: { gifviejo: { ancho: 128, alto: 64, cuadros: [{ datos: '00', dur: 100 }], meta: { origen: 'gif' } } } } },
  biblioteca: {
    animaciones: { pred1: { ancho: 128, alto: 64, cuadros: [{ datos: '00', dur: 100 }], meta: { origen: 'gif' } } },
    animaciones_indice: { pred1: { ancho: 128, alto: 64, cantidad: 1, miniatura: '00', meta: { origen: 'gif' } } }
  }
};
const adm = await abrir(semillaAdmin, {
  ruta: '/carga-masiva.html', esperar: false,
  antes: async (p) => { await p.addInitScript(() => { globalThis.__semillaAuth = { usuarios: { 'ana@correo.com': { password: 'secreta1', uid: 'uid-ana', verificado: true } }, actual: 'ana@correo.com' }; }); }
});
const pa = adm.pagina;
const confirmaciones = [];
pa.on('dialog', async (d) => { confirmaciones.push(d.message()); await d.accept(); });
await pa.waitForFunction(() => !document.getElementById('contenidoProtegido').inert, null, { timeout: 5000 });
await pa.waitForTimeout(700);
const escA = () => pa.evaluate(() => globalThis.__fakeDb.escrituras.flatMap((e) => (e.op === 'update' ? Object.keys(e.valor).map((k) => (e.ruta ? e.ruta + '/' : '') + k) : [e.ruta])));
const nombresLista = () => pa.evaluate(() => [...document.querySelectorAll('#listaAnimacionesGuardadas input')].map((i) => i.value));
informe('administrador: ve el interruptor y, apagado, la lista es la de su cuenta', await pa.isVisible('#tarjetaDestino') && (await nombresLista()).join() === 'gifviejo');

await pa.evaluate(() => document.getElementById('destinoBiblioteca').click());
await pa.waitForTimeout(500);
const titulo2 = (await pa.textContent('#tituloAnimacionesGuardadas')).trim();
informe('administrador: con el interruptor la lista pasa a ser la de la biblioteca y el título lo dice', (await nombresLista()).join() === 'pred1' && /biblioteca predeterminada/.test(titulo2), `${(await nombresLista()).join()} | ${titulo2}`);

await pa.setInputFiles('#archivos', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
await pa.waitForTimeout(500);
await pa.click('#botonSubir'); await pa.waitForTimeout(1200);
const e2s = await escA();
const raiz2 = await pa.evaluate(() => globalThis.__fakeDb.raiz);
informe('administrador: subir una imagen con el interruptor la guarda en biblioteca/imagenes y su lista, sin tocar la cuenta ni los contadores',
  e2s.some((r) => r === 'biblioteca/imagenes/logo') && e2s.some((r) => r === 'biblioteca/imagenes_indice/logo')
  && !e2s.some((r) => r.startsWith('usuarios/uid-ana/imagenes/') || r.includes('cuotas'))
  && confirmaciones.some((c) => /TODAS las cuentas/.test(c)) && !!(raiz2.biblioteca.imagenes && raiz2.biblioteca.imagenes.logo),
  JSON.stringify({ e2s, confirmaciones }));

await pa.evaluate(() => [...document.querySelectorAll('#listaAnimacionesGuardadas button')].find((b) => b.textContent.trim() === 'Borrar').click());
await pa.waitForTimeout(700);
const raiz3 = await pa.evaluate(() => globalThis.__fakeDb.raiz);
const bib = raiz3.biblioteca || {};
informe('administrador: Borrar en la lista de la biblioteca quita la animación y su lista liviana, y avisa que es para todas las cuentas',
  !(bib.animaciones || {}).pred1 && !(bib.animaciones_indice || {}).pred1 && !!(((raiz3.usuarios || {})['uid-ana'] || {}).animaciones || {}).gifviejo
  && confirmaciones.some((c) => /biblioteca predeterminada.*TODAS/.test(c)),
  JSON.stringify({ bib: Object.keys(bib.animaciones || {}), confirmaciones }));

await pa.evaluate(() => document.getElementById('destinoBiblioteca').click());
await pa.waitForTimeout(500);
informe('administrador: al apagar el interruptor vuelve a su galería', (await nombresLista()).join() === 'gifviejo');
informe('sin errores de la página (administrador)', adm.errores.filter((e) => e.startsWith('página:')).length === 0, adm.errores.join(' | ').slice(0, 200));
await adm.navegador.close(); cerrarServidor();
