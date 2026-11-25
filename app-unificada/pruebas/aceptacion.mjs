// Aceptación de los Términos y la Política de Privacidad (2026-11-25, src/aceptacion.js y el enrutador): después de iniciar sesión se
// pide aceptar UNA vez; la respuesta queda en usuarios/{uid}/aceptacion = { version, fecha }. Firebase falso (sin tocar la base real).
import { abrir, cerrar, informe, visible, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: { tipo: 'texto', texto: 'Hola', config: {} } } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
});
const nuevo = { conAceptacion: true, esperar: false };
const hayPantalla = (p) => p.evaluate(() => !!document.getElementById('pantallaAceptacion'));
const aceptacionNube = (p) => p.evaluate(() => (globalThis.__fakeDb.raiz.usuarios['uid-ana'] || {}).aceptacion || null);

// ---------- 1. Celular nuevo con cuenta: pide aceptar, y solo deja seguir con la casilla marcada ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(), nuevo);
  await pagina.waitForSelector('#pantallaAceptacion', { timeout: 15000 });
  informe('al entrar con una cuenta sale la pantalla de aceptación con su título', /Antes de entrar/.test(await pagina.innerText('#pantallaAceptacion')));
  informe('la frase lleva los dos enlaces (Términos y Condiciones, Política de Privacidad) y la casilla viene sin marcar',
    (await pagina.$$eval('#pantallaAceptacion a', (as) => as.map((a) => a.textContent + '|' + a.getAttribute('href'))))
      .join(' ') === 'Términos y Condiciones|https://cartica07.github.io/TV_RETRO/pepito/terminos.html Política de Privacidad|https://cartica07.github.io/TV_RETRO/pepito/privacidad.html'
    && !(await pagina.isChecked('#aceptacionCasilla')));
  informe('"Continuar" está apagado hasta marcar la casilla', await pagina.$eval('#botonAceptacionContinuar', (b) => b.disabled));
  informe('mientras tanto no se guardó nada', (await aceptacionNube(pagina)) === null);
  informe('y el panel sigue cerrado (no se entró a la app)', await pagina.evaluate(() => document.getElementById('estadoTexto') ? /Cargando|…/.test(document.getElementById('estadoTexto').textContent) || document.querySelector('main.controles')?.hasAttribute('inert') : true));
  await pagina.check('#aceptacionCasilla');
  informe('al marcar la casilla "Continuar" se enciende', !(await pagina.$eval('#botonAceptacionContinuar', (b) => b.disabled)));
  await pagina.click('#botonAceptacionContinuar');
  await esperarPanel(pagina);
  informe('al continuar, la pantalla se va y se entra a la app', !(await hayPantalla(pagina)));
  const a = await aceptacionNube(pagina);
  informe('en Firebase queda usuarios/{uid}/aceptacion con la versión "2" y la fecha del servidor', a && a.version === '2' && a.fecha && a.fecha['.sv'] === 'timestamp', JSON.stringify(a));
  informe('y se recuerda en el celular', (await pagina.evaluate(() => localStorage.getItem('pepito.aceptacion.uid-ana'))) === '2');
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 2. Ya aceptó en la nube (celular reinstalado): no la vuelve a pedir ----------
{
  const s = semilla();
  s.usuarios['uid-ana'].aceptacion = { version: '2', fecha: 1700000000000 };
  const { navegador, pagina } = await abrir(s, nuevo);
  await esperarPanel(pagina);
  informe('con la aceptación ya guardada en la nube no se pide otra vez', !(await hayPantalla(pagina)));
  informe('y queda recordada en el celular', (await pagina.evaluate(() => localStorage.getItem('pepito.aceptacion.uid-ana'))) === '2');
  await navegador.close();
}

// ---------- 3. Cambió la versión de los textos: se vuelve a pedir ----------
{
  const s = semilla();
  s.usuarios['uid-ana'].aceptacion = { version: '1', fecha: 1700000000000 };
  const { navegador, pagina } = await abrir(s, nuevo);
  await pagina.waitForSelector('#pantallaAceptacion', { timeout: 15000 });
  informe('con una versión anterior aceptada se vuelve a pedir', true);
  await navegador.close();
}

// ---------- 4. "Salir": cierra la sesión y vuelve al inicio de sesión ----------
{
  const { navegador, pagina } = await abrir(semilla(), nuevo);
  await pagina.waitForSelector('#pantallaAceptacion', { timeout: 15000 });
  await pagina.click('#botonAceptacionSalir');
  await pagina.waitForTimeout(800);
  informe('"Salir" cierra la pantalla sin guardar nada', !(await hayPantalla(pagina)) && (await aceptacionNube(pagina)) === null);
  informe('y vuelve el inicio de sesión (sin sesión)', await visible(pagina, '#pantallaLogin') || await visible(pagina, '#pantallaInicioTipo'));
  await navegador.close();
}

// ---------- 5. Sin cuenta (Pepito Lite): se acepta una vez y solo queda en el celular ----------
{
  const { navegador, pagina } = await abrir(semilla(), { conAceptacion: true, esperar: false, logueado: false });
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  await pagina.click('#botonInicioLite');
  await pagina.waitForSelector('#pantallaAceptacion', { timeout: 15000 });
  await pagina.check('#aceptacionCasilla');
  await pagina.click('#botonAceptacionContinuar');
  await pagina.waitForSelector('#pantallaConexion:not([hidden])', { timeout: 15000 });
  const claves = await pagina.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pepito.aceptacion.')));
  informe('sin cuenta: tras aceptar sigue su camino (Conecta tu TV) y se recuerda solo en el celular', claves.length === 1);
  const nube = await pagina.evaluate(() => JSON.stringify(Object.values(globalThis.__fakeDb.raiz.usuarios || {}).map((u) => u.aceptacion).filter(Boolean)));
  informe('y no se escribe nada en Firebase', nube === '[]', nube);
  await navegador.close();
}

cerrar();
