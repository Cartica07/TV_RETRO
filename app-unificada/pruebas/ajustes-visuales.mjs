// Ajustes visuales del dueño (2026-11-25): "Mis Pepitos" a la izquierda y simétrico con "Cerrar sesión"; Invertir con más aire arriba; más espacio
// en Alineación; el :hover no se queda pegado en pantallas táctiles; la fila de pestañas y la caneca de la Galería quedan pegadas al bajar;
// nota de la alarma (Pro y Lite) y que las pestañas sigan entrando SIN scroll a 390x844 y 360x740.
// Uso: node pruebas/ajustes-visuales.mjs
import { abrir, cerrar, informe, pant, esperarPanel, erroresPagina } from './banco-unificado.mjs';

const muchas = {};
const indice = {};
for (let i = 0; i < 30; i++) { muchas['img' + i] = { datos: '00', ancho: 128, alto: 64, meta: {} }; indice['img' + i] = { datos: '00', ancho: 128, alto: 64 }; }
const semilla = () => ({
  dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: pant('Hola'), lastSeen: Date.now() }, firmware: { build: 11, estado: 'ok', fecha: 1000 } } },
  usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  biblioteca: { imagenes: muchas, imagenes_indice: indice },
});

const sobra = (p) => p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight); // px que la página se puede deslizar (<= 0: sin scroll)

for (const [ancho, alto] of [[390, 844], [360, 740]]) {
  const { navegador, pagina, errores } = await abrir(semilla());
  await pagina.setViewportSize({ width: ancho, height: alto });
  await esperarPanel(pagina);
  const t = `${ancho}x${alto}: `;

  // ---- barra de arriba ----
  const barra = await pagina.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { izq: b.left, der: b.right, top: b.top }; };
    return { tv: r('#botonMiTV'), salir: r('#botonCerrarSesion'), marca: r('.barra-superior .marca'), ancho: innerWidth };
  });
  informe(t + 'Mis Pepitos está a la izquierda del título y Cerrar sesión a la derecha', barra.tv.der < barra.marca.izq && barra.salir.izq > barra.marca.der, JSON.stringify(barra));
  informe(t + 'los dos botones están a la misma distancia de su borde (simétricos)', Math.abs(barra.tv.izq - (barra.ancho - barra.salir.der)) <= 1 && Math.abs(barra.tv.top - barra.salir.top) <= 1);

  // ---- Invertir: más aire arriba (antes 6) y menos abajo que antes (23) ----
  const inv = await pagina.evaluate(() => {
    const marco = document.querySelector('.marco-pantalla').getBoundingClientRect();
    const f = document.querySelector('#filaInvertido').getBoundingClientRect();
    const tarjeta = document.querySelector('.dispositivo').getBoundingClientRect();
    return { arriba: Math.round(f.top - marco.bottom), abajo: Math.round(tarjeta.bottom - f.bottom) };
  });
  informe(t + 'Invertir quedó más centrado entre la pantalla y el borde (más aire arriba que antes)', inv.arriba >= 10 && inv.abajo - inv.arriba <= 12, JSON.stringify(inv));

  // ---- Texto: más espacio entre Auto/Manual y los botones de abajo ----
  await pagina.click('#grupoTipo button[data-valor="texto"]');
  await pagina.waitForTimeout(300);
  const ali = await pagina.evaluate(() => {
    const a = document.querySelector('.rotulo-fila-modo').getBoundingClientRect();
    const b = document.querySelector('#grupoAlineacion').getBoundingClientRect(); // el primer botón (la fila lleva 6 de relleno arriba)
    return { hueco: Math.round(b.top - a.bottom) };
  });
  informe(t + 'Auto/Manual y los botones de alineación ya no están pegados', ali.hueco >= 6, JSON.stringify(ali));
  informe(t + 'Texto entra sin scroll', (await sobra(pagina)) <= 0, 'sobran ' + (await sobra(pagina)) + ' px');

  await pagina.click('#grupoTipo button[data-valor="dibujo"]');
  await pagina.waitForTimeout(300);
  informe(t + 'Dibujo entra sin scroll', (await sobra(pagina)) <= 0, 'sobran ' + (await sobra(pagina)) + ' px');

  // ---- alarma: nota (Pro) y sin scroll ----
  await pagina.click('#grupoTipo button[data-valor="galeria"]');
  await pagina.click('#grupoMas button[data-mas="alarma"]');
  await pagina.waitForTimeout(400);
  const nota = await pagina.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
    return { pro: vis('.nota-alarma-pro'), lite: vis('.nota-alarma-lite'), texto: (document.querySelector('.nota-alarma-pro') || {}).textContent };
  });
  informe(t + 'Alarma con Pepito Pro: se ve la nota de Pro y no la de Lite', nota.pro && !nota.lite && /- El botón de la antena la silencia/.test(nota.texto) && /- El botón de la Perilla la pospone 5 minutos/.test(nota.texto) && /- Se calla sola luego de un minuto/.test(nota.texto), JSON.stringify(nota));
  informe(t + 'Alarma entra sin scroll', (await sobra(pagina)) <= 0, 'sobran ' + (await sobra(pagina)) + ' px');

  // ---- Galería: la fila de pestañas y la caneca quedan pegadas al bajar ----
  await pagina.click('#botonMasVolver');
  await pagina.click('[data-mas="galeria"]');
  await pagina.waitForTimeout(1500);
  const g = await pagina.evaluate(async () => {
    const fila = document.querySelector('.fila-galeria-cabecera');
    const cab = document.querySelector('.cabecera-fija').getBoundingClientRect().height;
    window.scrollTo(0, 1500);
    await new Promise((x) => setTimeout(x, 400));
    const b = fila.getBoundingClientRect();
    const tacho = document.querySelector('#botonBorrarGaleria').getBoundingClientRect();
    return { scrollY: Math.round(window.scrollY), cab: Math.round(cab), filaTop: Math.round(b.top), tachoVisible: tacho.top >= 0 && tacho.bottom <= innerHeight && tacho.width > 0 };
  });
  informe(t + 'Galería: al bajar mucho, la fila de pestañas y la caneca siguen a la vista, justo debajo de la cabecera', g.scrollY > 500 && Math.abs(g.filaTop - g.cab) <= 2 && g.tachoVisible, JSON.stringify(g));

  informe(t + 'sin errores en la página', erroresPagina(errores).length === 0, errores.join(' | ').slice(0, 250));
  await navegador.close();
}

// ---- el :hover pegado de los botones en pantallas táctiles ----
{
  const { navegador, pagina } = await abrir(semilla());
  await esperarPanel(pagina);
  const regla = await pagina.evaluate(() => {
    const hay = (lista) => [...lista].some((r) => (r.media && /hover:\s*none/.test(r.media.mediaText) && [...r.cssRules].some((x) => /boton-icono/.test(x.selectorText || ''))) || (r.cssRules && hay(r.cssRules)));
    return [...document.styleSheets].some((h) => { try { return hay(h.cssRules); } catch (e) { return false; } });
  });
  informe('en pantallas táctiles (hover: none) los botones de ícono no se quedan con el marco del hover', regla);
  await navegador.close();
}

// ---- con un toque de verdad (emulación táctil): el botón desactivado vuelve a verse igual que los demás, y sin el arreglo se reproduce el marco azul pegado ----
{
  const { navegador, pagina } = await abrir(semilla());
  await esperarPanel(pagina);
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await pagina.reload();
  await esperarPanel(pagina);
  await pagina.click('#grupoTipo button[data-valor="dibujo"]');
  await pagina.waitForTimeout(400);
  const tactil = await pagina.evaluate(() => matchMedia('(hover: none)').matches);
  const color = (id) => pagina.evaluate((i) => { const c = getComputedStyle(document.getElementById(i)); return c.borderTopColor + ' | ' + c.color; }, id);
  const toque = async (id) => {
    const b = await pagina.locator('#' + id).boundingBox();
    const punto = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pagina.waitForTimeout(450);
  };
  const normal = await color('botonRehacerDibujo');
  await toque('botonGomaDibujo');
  await toque('botonGomaDibujo');
  const desactivado = await color('botonGomaDibujo');
  informe('táctil: la pantalla se ve como táctil (hover: none)', tactil);
  informe('táctil: la goma desactivada queda igual que un botón normal (sin marco azul pegado)', desactivado === normal, normal + ' / ' + desactivado);
  await pagina.evaluate(() => document.querySelectorAll('link[href*="unificada.css"]').forEach((l) => { l.disabled = true; }));
  await toque('botonGomaDibujo');
  await toque('botonGomaDibujo');
  const sinArreglo = await color('botonGomaDibujo');
  informe('táctil: sin el arreglo se reproduce el marco azul pegado (la prueba sirve)', sinArreglo !== normal, sinArreglo);
  await navegador.close();
}

cerrar();
process.exit(0);
