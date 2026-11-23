// Nombre "Pepito" (docs/nombre-pepito.md): en la app unificada no se ve "TV" en ningún lado y los textos principales dicen Pepito.
// Firebase y Bluetooth falsos (banco-unificado.mjs).
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const semilla = { dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') } } }, usuarios: { 'uid-ana': { dispositivos: { tv1: true } } } };

// Todo el texto de la página, también lo oculto (otras pestañas, Mis TV, Config…), más los textos de ayuda de los botones.
const textoTotal = (p) => p.evaluate(() => {
  const partes = [document.title, document.body.textContent];
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    partes.push(el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.getAttribute('placeholder') || '');
  }
  return partes.join('\n');
});
const conTV = (texto) => texto.split('\n').filter((l) => /\bTV\b/.test(l)).map((l) => l.trim()).filter(Boolean);

// ---------- 1. Primera pantalla ----------
{
  const { navegador, pagina, errores } = await abrir({}, { logueado: false, esperar: false });
  await pagina.waitForSelector('#pantallaInicioTipo:not([hidden])', { timeout: 15000 });
  const t = await pagina.innerText('#pantallaInicioTipo');
  informe('primera pantalla: Pepito · ¿Qué Pepito tienes? · Pepito Pro / Pepito Lite', /Pepito/.test(t) && /¿Qué Pepito tienes\?/.test(t) && /Pepito Pro/.test(t) && /Pepito Lite/.test(t), t.replace(/\s+/g, ' '));
  const quedan = conTV(await textoTotal(pagina));
  informe('en toda la página no queda ningún "TV" (también en lo oculto)', quedan.length === 0, quedan.slice(0, 5).join(' | '));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

// ---------- 2. Panel con cuenta: Enviar, Mis Pepitos y el mensaje del envío ----------
{
  const { navegador, pagina, errores } = await abrir(semilla);
  await esperarPanel(pagina);
  informe('el botón dice "Enviar a Pepito"', (await pagina.innerText('#enviar')).trim() === 'Enviar a Pepito');
  informe('arriba dice "Pepito"', (await pagina.innerText('h1.marca')).trim() === 'Pepito');
  await pagina.fill('#texto', 'Hola Pepito');
  await pagina.click('#enviar');
  await pagina.waitForFunction(() => /Pepito/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 15000 }).catch(() => {});
  const estado = await pagina.innerText('#estadoTexto');
  informe('al enviar dice "…camino a Pepito" o "En Pepito ✅"', /camino a Pepito|En Pepito/.test(estado), estado);
  await pagina.evaluate(() => document.getElementById('botonMiTV').click());
  await pagina.waitForSelector('#pantallaTV:not([hidden])');
  const mis = await pagina.innerText('#pantallaTV');
  informe('Mis Pepitos, con "Pepito 1"', /Mis Pepitos/.test(mis) && /Pepito 1/.test(mis), mis.replace(/\s+/g, ' ').slice(0, 160));
  const quedan = conTV(await textoTotal(pagina));
  informe('en toda la página no queda ningún "TV"', quedan.length === 0, quedan.slice(0, 5).join(' | '));
  informe('sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 200));
  await navegador.close();
}

cerrar();
