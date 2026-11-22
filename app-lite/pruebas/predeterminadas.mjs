// La biblioteca predeterminada (imágenes y animaciones de la app Pro) viene DENTRO de la app Lite: se ve en la Galería sin
// internet, se puede enviar a la TV y no se puede borrar.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores, tv } = await abrir();
const esperarEnvio = () => pagina.waitForFunction(() => /camino|En la TV|✅/.test(document.getElementById('estadoTexto').textContent), null, { timeout: 20000 });

await pagina.click('#grupoTipo button[data-valor="galeria"]');
await pagina.click('[data-mas="galeria"]');
await pagina.waitForFunction(() => document.querySelectorAll('#gridGaleria .item-galeria').length > 0, null, { timeout: 10000 });

const imagenes = await pagina.$$eval('#gridGaleria .item-galeria', (x) => x.map((i) => i.dataset.clave));
informe('la Galería trae las imágenes predeterminadas sin tener nada guardado', imagenes.length >= 20 && imagenes.includes('Alerta'), `${imagenes.length} imágenes`);

// Enviar una imagen predeterminada.
await pagina.click('#gridGaleria .item-galeria[data-clave="Alerta"]');
await pagina.waitForTimeout(500);
await pagina.click('#enviar');
await esperarEnvio();
let c = await pagina.evaluate(() => { const x = window.__tv.contenido; return x ? { tipo: x.pantalla.tipo, n: x.pantalla.imagen.datos.length } : null; });
informe('la imagen predeterminada llega a la TV (1024 bytes)', c && c.tipo === 'imagen' && c.n === 1368, JSON.stringify(c));

// No se puede borrar una predeterminada.
pagina.on('dialog', (d) => d.accept());
const botonBorrar = await pagina.evaluate(() => { const b = document.getElementById('botonBorrarGaleria'); return { deshabilitado: b.disabled, oculto: getComputedStyle(b).display === 'none' }; });
informe('el botón de borrar no sirve con una predeterminada seleccionada', botonBorrar.deshabilitado || botonBorrar.oculto, JSON.stringify(botonBorrar));
const despues = await pagina.$$eval('#gridGaleria .item-galeria', (x) => x.length);
informe('la imagen predeterminada sigue ahí', despues === imagenes.length, String(despues));

// Animaciones predeterminadas.
await pagina.click('#grupoSubvistaGaleria button[data-subvista="animaciones"]');
await pagina.waitForTimeout(600);
const animaciones = await pagina.$$eval('#gridAnimaciones [data-clave]', (x) => x.map((i) => i.dataset.clave));
informe('la lista Animaciones trae las animaciones predeterminadas', animaciones.length >= 8 && animaciones.includes('anim_feliz'), animaciones.join(','));
await pagina.click('#gridAnimaciones [data-clave="anim_feliz"]');
await pagina.waitForTimeout(1200);
await pagina.click('#enviar');
await esperarEnvio();
c = await pagina.evaluate(() => { const x = window.__tv.contenido; return { tipo: x.pantalla.tipo, cantidad: x.pantalla.animacion && x.pantalla.animacion.cantidad, archivo: x.archivo ? x.archivo.length : 0 }; });
informe('la animación predeterminada llega a la TV (9 cuadros z1)', c.tipo === 'animacion' && c.cantidad === 9 && c.archivo > 0, JSON.stringify(c));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
