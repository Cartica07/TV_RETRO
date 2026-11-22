// js/gif.js de la Pro con los avisos de peso del GIF cambiados para la Lite. Todo lo demás (leer y convertir el GIF)
// es el de la Pro, sin tocar: construir.mjs cambia `./gif.js` por este archivo y `pro-gif-original` por el de la Pro.
//
// Por qué otros números: los de la Pro (sin aviso hasta 256 KB, rojo desde 1 MB) estaban pensados para la TV por Wi-Fi.
// Por Bluetooth, con la app midiendo ~22 KB/s (S3 + Moto Edge 50 Neo, plugin de Capacitor), el tiempo de llegada es:
//   100 KB ≈ 5 s · 250 KB ≈ 11 s · 600 KB ≈ 27 s.
// Un GIF de más de LIMITE_GIF_TV_BYTES no se envía (la TV guarda ~1,4 MB y se lo pelearía con las canciones).
export * from 'pro-gif-original';

export const PESO_COMPRIMIDO_RECOMENDADO_BYTES = 100 * 1024;
export const PESO_COMPRIMIDO_MAXIMO_BYTES = 250 * 1024;
export const LIMITE_GIF_TV_BYTES = 600 * 1024;

/** Igual que la de la Pro (mismos textos), con los umbrales de la Lite. */
export function evaluarPesoComprimido(bytesComprimidos, cantidadCuadros) {
  const bytes = Number(bytesComprimidos) || 0;
  const kb = Math.round(bytes / 1024);
  const n = cantidadCuadros || 0;
  if (bytes > PESO_COMPRIMIDO_MAXIMO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'muy-pesado', mensaje: 'GIF muy pesado, puede tardar en llegar' };
  }
  if (bytes > PESO_COMPRIMIDO_RECOMENDADO_BYTES) {
    return { bytes, kb, cuadros: n, nivel: 'pesado', mensaje: 'GIF pesado: tardará un poco más de lo normal en llegar' };
  }
  return { bytes, kb, cuadros: n, nivel: 'ok', mensaje: '' };
}
