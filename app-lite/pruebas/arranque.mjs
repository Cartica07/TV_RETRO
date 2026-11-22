// La app Lite arranca igual que la Pro: sin errores, con sus pestañas y con lo que la Lite no usa oculto.
import { abrir, cerrar, informe } from './banco-lite.mjs';

const { pagina, errores } = await abrir();

const pestanas = await pagina.$$eval('#grupoTipo button', (b) => b.map((x) => x.dataset.valor));
informe('tiene las 5 pestañas de la Pro', pestanas.join(',') === 'texto,imagen,dibujo,cancion,galeria', pestanas.join(','));

const textoAbierto = await pagina.evaluate(() => getComputedStyle(document.getElementById('seccionTexto')).display !== 'none');
informe('abre en Texto', textoAbierto);

const modo = await pagina.evaluate(() => location.search);
informe('trabaja en modo sin cuentas', /sincuentas/.test(modo), modo);

const visible = (sel) => pagina.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden && e.getBoundingClientRect().width > 0; }, sel);
informe('no muestra Mi TV ni cerrar sesión', !(await visible('#botonMiTV')) && !(await visible('#botonCerrarSesion')));
informe('no muestra login', !(await visible('#pantallaLogin')) && !(await visible('#pantallaTV')));

// Más: Galería, Alarma y Config sí; Juegos no.
await pagina.click('#grupoTipo button[data-valor="galeria"]');
await pagina.waitForTimeout(300);
informe('Más muestra Galería', await visible('[data-mas="galeria"]'));
informe('Más muestra Alarma', await visible('[data-mas="alarma"]'));
informe('Más muestra Config', await visible('[data-mas="config"]'));
informe('Más NO muestra Juegos', !(await visible('[data-mas="juegos"]')));

const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
informe('sin scroll horizontal', ancho <= 390, String(ancho));

informe('sin errores en la consola', errores.length === 0, errores.join(' | '));
cerrar();
