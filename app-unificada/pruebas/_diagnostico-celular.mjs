// Diagnóstico (no es una prueba del banco): se conecta por depuración al WebView de la app en el celular (adb forward a 9222) y lee
// por qué la página no baja. Solo LEE el estado; no toca nada. Uso: node pruebas/_diagnostico-celular.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('../../pruebas/node_modules/playwright');

const navegador = await chromium.connectOverCDP('http://127.0.0.1:9222');
const pagina = navegador.contexts()[0].pages()[0];
const r = await pagina.evaluate(() => {
  const doc = document.scrollingElement;
  const cs = (el) => { const s = getComputedStyle(el); return { overflow: s.overflow, overflowY: s.overflowY, touchAction: s.touchAction, position: s.position, height: s.height, pointerEvents: s.pointerEvents }; };
  const centro = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6);
  return {
    url: location.href.slice(0, 80),
    clasesBody: document.body.className,
    scroll: { alto: doc.scrollHeight, ventana: innerHeight, top: doc.scrollTop },
    html: cs(document.documentElement), body: cs(document.body), main: cs(document.querySelector('main.controles')),
    inert: { main: document.querySelector('main.controles').inert, nav: document.querySelector('nav.nav-inferior').inert },
    enCentro: centro ? (centro.id || centro.className || centro.tagName) : null,
    estiloInlineHtml: document.documentElement.getAttribute('style'), estiloInlineBody: document.body.getAttribute('style'),
    capasVisibles: [...document.querySelectorAll('.pantalla-login, #tutorial, #pantallaConexion, #pantallaInicioTipo')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id),
  };
});
console.log(JSON.stringify(r, null, 1));
await navegador.close();
