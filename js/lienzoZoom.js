/**lienzoZoom
 * Zoom y desplazamiento del lienzo de Dibujo, como al editar una foto en
 * WhatsApp:
 *  - Dos dedos: pellizcar para acercar/alejar y arrastrar para moverse.
 *  - Un dedo: dibuja (lo maneja dibujo.js, sin cambios).
 *  - Rueda del mouse / pellizco del trackpad: zoom en el punto del cursor.
 *  - Botones acercar / alejar e indicador "×N" (tocarlo vuelve a ×1).
 *
 * Cómo funciona: el canvas está dentro de un "visor" que lo recorta y se
 * le aplica transform: translate() scale(). dibujo.js calcula la posición
 * del dedo con getBoundingClientRect(), que ya incluye ese transform, así
 * que dibujar con zoom sigue cayendo en el punto correcto sin tocarlo.
 *
 * Los gestos de dos dedos se interceptan en el visor en fase de captura
 * (antes que el canvas) y no llegan a dibujo.js.
 */

const ESCALA_MIN = 1;
const ESCALA_MAX = 8;
const PASO_BOTON = 1.5;
const PASO_RUEDA = 1.15;

/**
 * @param {object} op
 * @param {HTMLElement} op.visor - contenedor que recorta (overflow: hidden)
 * @param {HTMLCanvasElement} op.canvas - el lienzo (se le aplica transform)
 * @param {HTMLElement} [op.indicador] - muestra "×N"; tocarlo vuelve a ×1
 * @param {() => void} [op.alEmpezarGesto] - se llama al apoyar el 2.º dedo
 *   (para descartar el trazo que había empezado el primero)
 */
export function crearZoomLienzo({ visor, canvas, indicador = null, alEmpezarGesto = null }) {
  let escala = 1, tx = 0, ty = 0;
  const punteros = new Map();   // pointerId -> {x, y} (coordenadas del visor)
  let gesto = null;             // datos del pellizco en curso

  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  function aplicar() {
    const w = visor.clientWidth, h = visor.clientHeight;
    escala = limitar(escala, ESCALA_MIN, ESCALA_MAX);
    // El canvas siempre cubre todo el visor (no se ve "afuera" del dibujo).
    tx = limitar(tx, w - w * escala, 0);
    ty = limitar(ty, h - h * escala, 0);
    canvas.style.transform = escala === 1 ? '' : `translate(${tx}px, ${ty}px) scale(${escala})`;
    if (indicador) {
      indicador.hidden = escala <= 1.001;
      indicador.textContent = '×' + (Math.round(escala * 10) / 10).toString().replace('.', ',');
    }
  }

  /** Zoom manteniendo fijo el punto (px, py) del visor. */
  function zoomEn(nuevaEscala, px, py) {
    const n = limitar(nuevaEscala, ESCALA_MIN, ESCALA_MAX);
    const cx = (px - tx) / escala, cy = (py - ty) / escala;   // punto del dibujo bajo (px, py)
    escala = n;
    tx = px - cx * n;
    ty = py - cy * n;
    aplicar();
  }

  const centro = () => ({ x: visor.clientWidth / 2, y: visor.clientHeight / 2 });

  function relativo(e) {
    const r = visor.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function datosPellizco() {
    const [a, b] = [...punteros.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  // --- Gestos táctiles (fase de captura: antes que dibujo.js) ---
  visor.addEventListener('pointerdown', (e) => {
    if (indicador && indicador.contains(e.target)) return;
    if (e.pointerType === 'mouse') return;   // el mouse dibuja; el zoom va con la rueda
    punteros.set(e.pointerId, relativo(e));
    if (punteros.size === 2) {
      if (alEmpezarGesto) alEmpezarGesto();
      const p = datosPellizco();
      gesto = { d0: p.d, escala0: escala, cx: (p.mx - tx) / escala, cy: (p.my - ty) / escala };
    }
    if (punteros.size >= 2) e.stopPropagation();   // el 2.º dedo no dibuja
  }, true);

  visor.addEventListener('pointermove', (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.set(e.pointerId, relativo(e));
    if (gesto && punteros.size >= 2) {
      const p = datosPellizco();
      escala = limitar(gesto.escala0 * p.d / gesto.d0, ESCALA_MIN, ESCALA_MAX);
      // El punto del dibujo que estaba entre los dedos sigue entre los dedos
      // (eso también hace el desplazamiento al arrastrar con dos dedos).
      tx = p.mx - gesto.cx * escala;
      ty = p.my - gesto.cy * escala;
      aplicar();
      e.stopPropagation();
    } else if (gesto) {
      e.stopPropagation();   // queda un dedo después del pellizco: no dibuja
    }
  }, true);

  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2 && gesto && punteros.size === 0) gesto = null;
  };
  visor.addEventListener('pointerup', soltar, true);
  visor.addEventListener('pointercancel', soltar, true);

  // --- Rueda del mouse / pellizco del trackpad ---
  visor.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = relativo(e);
    zoomEn(escala * (e.deltaY < 0 ? PASO_RUEDA : 1 / PASO_RUEDA), p.x, p.y);
  }, { passive: false });

  if (indicador) indicador.addEventListener('click', () => restablecer());

  // Si el visor cambia de tamaño (expandir, girar el teléfono), se vuelve a ×1.
  if (typeof ResizeObserver === 'function') {
    let anterior = visor.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(visor.clientWidth - anterior) > 1) { anterior = visor.clientWidth; restablecer(); }
    }).observe(visor);
  }

  function restablecer() { escala = 1; tx = 0; ty = 0; aplicar(); }

  aplicar();

  return {
    acercar() { const c = centro(); zoomEn(escala * PASO_BOTON, c.x, c.y); },
    alejar() { const c = centro(); zoomEn(escala / PASO_BOTON, c.x, c.y); },
    restablecer,
    get escala() { return escala; }
  };
}
