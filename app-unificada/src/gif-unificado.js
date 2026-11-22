// js/gif.js de la app unificada: todo es el de la Pro (js/gif-pro.js, sin tocar) y solo cambian los avisos de peso del GIF cuando
// la TV en uso es una TV Lite. Por Bluetooth (~22 KB/s medidos con el plugin de Capacitor) un GIF tarda: 100 KB ≈ 5 s,
// 250 KB ≈ 11 s, 600 KB ≈ 27 s; por eso los umbrales son menores que los de la TV Pro por Wi-Fi (256 KB y 1 MB).
// Una TV Lite en uso se reconoce por la clase "tv-lite" del <body> (la pone el enrutador, src/backend-unificado.js).
import { evaluarPesoComprimido as evaluarPesoComprimidoPro } from './gif-pro.js';

export * from './gif-pro.js';

const PESO_COMPRIMIDO_RECOMENDADO_LITE_BYTES = 100 * 1024;
const PESO_COMPRIMIDO_MAXIMO_LITE_BYTES = 250 * 1024;

/** Igual que la de la Pro (mismos textos); con una TV Lite en uso, con los umbrales de la Lite. */
export function evaluarPesoComprimido(bytesComprimidos, cantidadCuadros) {
  let esLite = false;
  try { esLite = document.body.classList.contains('tv-lite'); } catch (e) { /* sin pantalla */ }
  if (!esLite) return evaluarPesoComprimidoPro(bytesComprimidos, cantidadCuadros);
  const bytes = Number(bytesComprimidos) || 0;
  const kb = Math.round(bytes / 1024);
  const n = cantidadCuadros || 0;
  if (bytes > PESO_COMPRIMIDO_MAXIMO_LITE_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'muy-pesado', mensaje: 'GIF muy pesado, puede tardar en llegar' };
  }
  if (bytes > PESO_COMPRIMIDO_RECOMENDADO_LITE_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'pesado', mensaje: 'GIF pesado: tardará un poco más de lo normal en llegar' };
  }
  return { bytes, kb, cuadros: n, nivel: 'ok', mensaje: '' };
}
