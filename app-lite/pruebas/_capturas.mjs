// Capturas de la app Lite en el navegador (solo para mirar el diseño; no es una prueba). Uso: node pruebas/_capturas.mjs <carpeta>
import { abrir, cerrar } from './banco-lite.mjs';
import path from 'node:path';

const carpeta = process.argv[2];
const { pagina } = await abrir({ ancho: 360, alto: 740 });
const foto = (n) => pagina.screenshot({ path: path.join(carpeta, n + '.png') });
await foto('1-texto');
await pagina.click('#grupoTipo button[data-valor="cancion"]');
await pagina.waitForTimeout(800);
await foto('2-canciones');
await pagina.click('#grupoTipo button[data-valor="galeria"]');
await pagina.waitForTimeout(400);
await foto('3-mas');
await pagina.click('#grupoMas button[data-mas="config"]');
await pagina.click('#grupoConfig button[data-config="legal"]');
await pagina.waitForTimeout(400);
await foto('4-legal');
// Sin scroll vertical en cada pestaña (regla de la Pro): se mide el final de los controles contra la barra de Enviar.
cerrar();
