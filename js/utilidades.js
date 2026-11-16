/**utilidades
 * Ayudas compartidas del panel (salieron de main.js; auditoría 2026-11-15, H-13): detectar la APK, evitar que una
 * acción se repita, esperar una escritura lenta y mostrar avisos. No dependen de ningún estado de la aplicación.
 */

// Dentro de la APK (Capacitor) el panel corre en un WebView de Android. Ahí la
// pantalla completa del navegador y el bloqueo de rotación web no sirven (al
// contraer, el WebView queda con el tamaño roto y tapa los botones del
// sistema), así que se usan los plugins nativos. En el navegador todo sigue
// igual. Los plugins se leen de window.Capacitor.Plugins: el panel no usa
// bundler, no puede importarlos.
export const enApp = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
export const pluginNativo = (nombre) => (enApp() && window.Capacitor.Plugins && window.Capacitor.Plugins[nombre]) || null;

// Guardar, borrar e importar se ejecutan de a una por vez: un segundo toque
// (o un doble clic) mientras la acción sigue en curso se ignora. Si hay un
// botón, queda apagado mientras trabaja (así se nota que está ocupado). Los
// botones de borrar NO se pasan: su estado lo maneja la selección.
export const accionesEnCurso = new Set();
export async function sinRepetir(clave, boton, accion) {
  if (accionesEnCurso.has(clave)) return;
  accionesEnCurso.add(clave);
  if (boton) boton.disabled = true;
  try {
    return await accion();
  } finally {
    accionesEnCurso.delete(clave);
    if (boton) boton.disabled = false;
  }
}

// Si el guardado o borrado quedó esperando por falta de señal (ver conTope
// en firebase.js), avisa y espera a que termine de verdad; devuelve el
// resultado final para seguir como siempre. El botón sigue ocupado hasta
// entonces, así nadie repite la acción creyendo que no funcionó.
export async function esperarFinal(resultado, avisarLento) {
  if (!resultado || !resultado.pendiente || !resultado.escritura) return resultado;
  avisarLento();
  return await resultado.escritura;
}
export const TEXTO_GUARDADO_LENTO = 'La conexión está lenta: se guardará solo cuando vuelva la señal.';
export const TEXTO_BORRADO_LENTO = 'La conexión está lenta: se borrará solo cuando vuelva la señal.';

// Muestra (o con texto vacío, oculta) un recuadro de aviso. tipo
// 'error' lo pinta en rojo. Quita el amarillo del aviso de peso del GIF
// (clase "advertencia"), que solo se pone en los avisos de la Galería.
// La usan setAvisoGaleria, setAvisoGaleriaDibujo, setAvisoGaleriaNueva y
// setAvisoCancion (antes cada una repetía este código).
export function mostrarAviso(el, text, tipo = null) {
  if (!el) return;
  el.style.display = text ? 'block' : 'none';
  el.textContent = text || '';
  el.classList.remove('advertencia');
  el.classList.toggle('error', tipo === 'error');
}
