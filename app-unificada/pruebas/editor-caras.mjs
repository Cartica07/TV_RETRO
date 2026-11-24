// Editor de caras de reloj (herramienta del dueño: www/editor-caras.html). Firebase falso (banco-unificado.mjs).
import { abrir, cerrar, informe, visible, erroresPagina } from './banco-unificado.mjs';

const semilla = (admin) => ({
  usuarios: { 'uid-ana': { dispositivos: {} } },
  ...(admin ? { administradores: { 'uid-ana': true } } : {}),
});
const raiz = (p) => p.evaluate(() => globalThis.__fakeDb.raiz);
const txt = (p, s) => p.evaluate((sel) => document.querySelector(sel).textContent.trim(), s);

// ---------- Sin ser administrador ----------
{
  const { navegador, pagina } = await abrir(semilla(false), { ruta: '/editor-caras.html', esperar: false });
  await pagina.waitForFunction(() => !document.getElementById('noAdmin').hidden || !document.getElementById('editor').hidden, null, { timeout: 15000 });
  informe('sin ser administrador: no se ve el editor', await visible(pagina, '#noAdmin') && !(await visible(pagina, '#editor')));
  await navegador.close();
}

// ---------- Administrador ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(true), { ruta: '/editor-caras.html', esperar: false });
  await pagina.waitForFunction(() => !document.getElementById('editor').hidden, null, { timeout: 15000 });
  informe('administrador: se ve el editor con una cara nueva de 4 elementos', (await pagina.$$eval('#elementos li', (l) => l.length)) === 4);

  // Añadir un texto fijo y cambiarle el texto.
  await pagina.selectOption('#nuevoTipo', '8');
  await pagina.click('#botonAnadir');
  await pagina.fill('#prop-6', 'Hola ñ');
  await pagina.waitForTimeout(200);
  informe('añadir un texto fijo y escribirlo', (await pagina.$$eval('#elementos li', (l) => l.length)) === 5);

  // Arrastrar sobre la vista previa mueve el elemento elegido.
  await pagina.locator('#vista').scrollIntoViewIfNeeded();
  const caja = await pagina.locator('#vista').boundingBox();
  const antes = await pagina.inputValue('#prop-0');
  await pagina.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.5);
  await pagina.mouse.down();
  await pagina.mouse.move(caja.x + caja.width * 0.25, caja.y + caja.height * 0.5, { steps: 5 });
  await pagina.mouse.up();
  const despues = await pagina.inputValue('#prop-0');
  informe('arrastrar mueve el elemento (cambia su x)', Number(despues) < Number(antes), `${antes} -> ${despues}`);

  // Guardar en el catálogo.
  await pagina.fill('#nombreCara', 'Mi cara');
  await pagina.click('#botonGuardar');
  await pagina.waitForFunction(() => /Guardada/.test(document.getElementById('aviso').textContent), null, { timeout: 10000 });
  let r = await raiz(pagina);
  const claves = Object.keys((r.relojes && r.relojes.indice) || {});
  informe('guardar escribe relojes/indice y relojes/datos', claves.length === 1 && r.relojes.indice[claves[0]].nombre === 'Mi cara' && typeof r.relojes.datos[claves[0]] === 'string', claves.join(','));
  informe('la cara guardada aparece en el catálogo', (await pagina.$$eval('#catalogo li', (l) => l.length)) === 1);

  // Cara nueva y luego editar la guardada: vuelven sus 5 elementos.
  await pagina.click('#botonNueva');
  await pagina.click('#catalogo li button:first-of-type');
  await pagina.waitForFunction(() => /Editando/.test(document.getElementById('aviso').textContent), null, { timeout: 10000 });
  informe('editar la guardada trae sus elementos', (await pagina.$$eval('#elementos li', (l) => l.length)) === 5 && (await pagina.inputValue('#nombreCara')) === 'Mi cara');

  // Borrar pide confirmación.
  await pagina.click('#catalogo li button.peligro');
  informe('borrar sin marcar la confirmación no borra', /marca primero/.test(await txt(pagina, '#aviso')));
  await pagina.check('#confirmarBorrar');
  await pagina.click('#catalogo li button.peligro');
  await pagina.waitForFunction(() => /Borrada/.test(document.getElementById('aviso').textContent), null, { timeout: 10000 });
  r = await raiz(pagina);
  informe('borrar quita la cara del catálogo', !r.relojes || !r.relojes.indice || Object.keys(r.relojes.indice).length === 0);
  informe('sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}
cerrar();
