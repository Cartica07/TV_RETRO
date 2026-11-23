// Con el teclado del celular abierto, la app se encoge, pero la barra de "Enviar a la TV" y la navegación quedan FIJAS abajo, justo
// encima del teclado, y pueden tapar el campo en el que se escribe (por ejemplo "Nombre" en la pestaña Imagen): el sistema lo da por
// visible y no lo sube. Aquí, cuando un campo tiene el foco y cambia el tamaño de la pantalla (se abre el teclado), la página se
// desplaza lo justo para dejar el campo encima de esas barras. Prueba real del 2026-11-23 en el celular del dueño.
// (La Pro tiene el mismo diseño; esto vive solo en la app unificada para no tocar la Pro.)
const MARGEN = 12;

function campoEnFoco() {
  const el = document.activeElement;
  return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|submit|checkbox|radio|range|file|color)$/i.test(el.type))) ? el : null;
}

function asegurarVisible() {
  const el = campoEnFoco();
  if (!el) return;
  const vv = window.visualViewport;
  let limite = vv ? vv.offsetTop + vv.height : window.innerHeight;
  // Lo que queda fijo abajo (y visible) tapa desde su borde de arriba.
  for (const sel of ['.barra-accion', 'nav.nav-inferior']) {
    const tapa = document.querySelector(sel);
    if (!tapa || getComputedStyle(tapa).display === 'none') continue;
    const arriba = tapa.getBoundingClientRect().top;
    if (arriba > 0 && arriba < limite) limite = arriba;
  }
  const r = el.getBoundingClientRect();
  if (r.bottom > limite - MARGEN) window.scrollBy({ top: r.bottom - (limite - MARGEN), behavior: 'smooth' });
  else if (r.top < MARGEN) window.scrollBy({ top: r.top - MARGEN, behavior: 'smooth' });
}

// El teclado tarda un momento en abrirse: se revisa al tomar el foco y cada vez que la pantalla cambia de tamaño.
let pendiente = null;
const revisarPronto = (ms) => { clearTimeout(pendiente); pendiente = setTimeout(asegurarVisible, ms); };
document.addEventListener('focusin', () => revisarPronto(350));
window.addEventListener('resize', () => revisarPronto(80));
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => revisarPronto(80));
