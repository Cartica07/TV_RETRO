// Más > Dúos (src/duos.js; docs/plan-duos.md): solo Pepito Pro. "Activar dúos" (ajustes.duos) y "Tu favorito"
// (ajustes.duoFavorito) con la lista del catálogo duos/indice y la portada de cada dúo. Firebase falso.
import { abrir, cerrar, informe, pant, visible, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const portada = (v) => Buffer.alloc(2048, v).toString('base64'); // 256×64 a 1 bit por punto
const semilla = (build = 11, { catalogo = true, ajustes = null } = {}) => ({
  dispositivos: { tv1: {
    dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola') }, firmware: { build, estado: 'ok', fecha: 1000 },
    ...(ajustes ? { ajustes } : {}),
  } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  ...(catalogo ? { duos: {
    indice: {
      gatos: { nombre: 'Gatos', orden: 2, fecha: 1, duracion: 4000, portada: portada(0xF0) },
      corazon: { nombre: 'Corazón', orden: 1, fecha: 1, duracion: 3300, portada: portada(0x0F) },
    },
    datos: { gatos: { izq: 'TTEBAAAA', der: 'TTEBAAAA' }, corazon: { izq: 'TTEBAAAA', der: 'TTEBAAAA' } },
  } } : {}),
});

const conTVLite = () => (p) => p.addInitScript(() => {
  if (!localStorage.getItem('tvretro.tvlite.uid-ana')) {
    localStorage.setItem('tvretro.tvlite.uid-ana', JSON.stringify(['tv-simulada']));
    localStorage.setItem('tvretro.dispositivo.uid-ana', 'lite:tv-simulada');
  }
});

const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s).textContent || '').trim(), sel);
const marcados = (p) => p.$$eval('#duosLista button', (bs) => bs.map((b) => `${b.querySelector('.duo-nombre').textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join(', '));
async function abrirDuos(p) {
  await p.click('#grupoTipo button[data-valor="galeria"]'); await p.waitForTimeout(200);
  await p.click('#grupoMas button[data-mas="duos"]');
  await p.waitForFunction(() => document.querySelectorAll('#duosLista button').length > 0 || !document.getElementById('duosVacio').hidden || !document.getElementById('duosAviso').hidden, null, { timeout: 15000 });
  await p.waitForTimeout(400);
}
const esperarAviso = (p) => p.waitForFunction(() => { const a = document.getElementById('duosAviso'); return !a.hidden && /Listo|Sin conexión/.test(a.textContent); }, null, { timeout: 15000 });

// ---------- 1. Pepito Pro con la versión 11 (sin dúos todavía) ----------
{
  const { navegador, pagina, errores } = await abrir(semilla(11, { ajustes: { brillo: 3, volumen: 2, zona: -300, apagado: 10 } }));
  await esperarPanel(pagina);
  informe('Pro: el botón Dúos está en el menú Más', await pagina.$eval('#grupoMas button[data-mas="duos"] .nombre-mas', (s) => s.textContent) === 'Dúos');
  await abrirDuos(pagina);
  informe('Pro: la pantalla Dúos se ve con su título', await visible(pagina, '#seccionDuos') && (await txt(pagina, '#tituloMas')) === 'Dúos');
  informe('Pro: sin ajustes de dúos, "Activar dúos" viene activado', await pagina.$eval('#duosActivos', (c) => c.checked));
  informe('Pro: la lista sigue el orden del catálogo y marca el primero como favorito', (await marcados(pagina)) === 'Corazón*, Gatos', await marcados(pagina));
  informe('Pro: cada dúo trae su portada como dos pantallas con marco (276×68)', await pagina.$$eval('#duosLista canvas', (cs) => cs.length === 2 && cs.every((c) => c.width === 276 && c.height === 68)));
  informe('Pro: la estrella se ve solo en el favorito', await pagina.$$eval('#duosLista .duo-estrella', (es) => es.map((e) => getComputedStyle(e).display !== 'none').join()) === 'true,false');
  informe('Pro v11: avisa que hay que actualizar', (await txt(pagina, '#duosAviso')) === 'Actualiza tu Pepito para usar los dúos.');

  await pagina.click('#duosLista button[data-clave="gatos"]');
  await esperarAviso(pagina);
  let raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  let aj = raiz.dispositivos.tv1.ajustes;
  informe('Pro: tocar un dúo lo guarda como favorito (y conserva lo demás de los ajustes)', aj.duoFavorito === 'gatos' && aj.brillo === 3 && aj.apagado === 10, JSON.stringify(aj));
  informe('Pro: le manda a la TV la orden "ajustes" y dice Listo', raiz.dispositivos.tv1.oled_remota.pantalla.tipo === 'ajustes' && (await txt(pagina, '#duosAviso')) === 'Listo');
  informe('Pro: el favorito queda marcado', (await marcados(pagina)) === 'Corazón, Gatos*');

  await pagina.click('#seccionDuos .switch');
  await esperarAviso(pagina);
  raiz = await pagina.evaluate(() => globalThis.__fakeDb.raiz);
  aj = raiz.dispositivos.tv1.ajustes;
  informe('Pro: apagar "Activar dúos" guarda duos = false sin tocar el favorito', aj.duos === false && aj.duoFavorito === 'gatos' && aj.brillo === 3, JSON.stringify(aj));

  await pagina.click('#botonMasVolver'); await pagina.waitForTimeout(300);
  await pagina.click('#grupoMas button[data-mas="duos"]'); await pagina.waitForTimeout(1500);
  informe('Pro: al volver, el interruptor y el favorito son los guardados', !(await pagina.$eval('#duosActivos', (c) => c.checked)) && (await marcados(pagina)) === 'Corazón, Gatos*');

  // Sin señal: no se guarda, avisa y el favorito vuelve a ser el de antes.
  await pagina.evaluate(() => { globalThis.__fakeDb.colgar = true; });
  await pagina.click('#duosLista button[data-clave="corazon"]');
  await pagina.waitForFunction(() => /Sin conexión|lenta/.test(document.getElementById('duosAviso').textContent), null, { timeout: 25000 });
  const avisoSinSenal = await txt(pagina, '#duosAviso');
  await pagina.evaluate(() => globalThis.__fakeDb.soltar());
  await pagina.waitForTimeout(800);
  informe('Pro: sin señal avisa (y no deja la lista bloqueada)', /Sin conexión|lenta/.test(avisoSinSenal) && !(await pagina.$eval('#duosLista button', (b) => b.disabled)), avisoSinSenal);
  informe('Pro: sin errores en la página', erroresPagina(errores).length === 0, erroresPagina(errores).join(' | '));
  await navegador.close();
}

// ---------- 2. Pepito Pro con dúos (12) y catálogo vacío ----------
{
  const { navegador, pagina } = await abrir(semilla(12));
  await esperarPanel(pagina);
  await abrirDuos(pagina);
  informe('Pro v12: no pide actualizar', !(await visible(pagina, '#duosAviso')));
  await navegador.close();
}
{
  const { navegador, pagina } = await abrir(semilla(12, { catalogo: false }));
  await esperarPanel(pagina);
  await abrirDuos(pagina);
  informe('Catálogo vacío: "Aún no hay dúos."', await visible(pagina, '#duosVacio') && (await txt(pagina, '#duosVacio')) === 'Aún no hay dúos.');
  await navegador.close();
}

// ---------- 3. Pepito Lite: no hay dúos ----------
{
  const { navegador, pagina } = await abrir(semilla(11), { antes: conTVLite() });
  await esperarPanel(pagina);
  await pagina.click('#grupoTipo button[data-valor="galeria"]'); await pagina.waitForTimeout(300);
  informe('Lite: el botón Dúos no aparece en Más', !(await visible(pagina, '#grupoMas button[data-mas="duos"]')));
  await navegador.close();
}

cerrar();
