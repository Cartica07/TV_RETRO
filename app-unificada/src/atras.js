// Botón Atrás de Android en la app unificada. La Pro (js/main.js, sin tocar) escucha "backButton" con el plugin App de Capacitor
// y, si no tiene nada suyo que cerrar, SALE de la app. Las ventanas propias de la unificada (por ahora, buscar canción) tienen que
// cerrarse antes: este archivo se carga ANTES que main.js y envuelve App.addListener, así el oyente de la Pro primero pregunta
// aquí. Si ninguna ventana de la unificada está abierta, todo sigue exactamente como en la Pro.
// En el navegador (sin Capacitor) no hace nada.
const capas = [];

/** Registra una ventana de la unificada: f() la cierra y devuelve true si estaba abierta. */
export function alAtras(f) {
  if (typeof f === 'function') capas.push(f);
}

function cerrarCapaUnificada() {
  for (let i = capas.length - 1; i >= 0; i--) {
    try { if (capas[i]()) return true; } catch (e) { console.error('[Pepito] Atrás:', e); }
  }
  return false;
}

try {
  const C = window.Capacitor;
  const real = C && C.Plugins && C.Plugins.App;
  if (real && typeof real.addListener === 'function') {
    C.Plugins.App = new Proxy({}, {
      get(_, prop) {
        if (prop === 'addListener') {
          return (nombre, oyente, ...resto) => real.addListener(
            nombre,
            nombre === 'backButton' && typeof oyente === 'function'
              ? (evento) => { if (!cerrarCapaUnificada()) oyente(evento); }
              : oyente,
            ...resto,
          );
        }
        const valor = real[prop];
        return typeof valor === 'function' ? valor.bind(real) : valor;
      },
    });
  }
} catch (e) {
  console.warn('[Pepito] No se pudo preparar el botón Atrás de la unificada:', e);
}
