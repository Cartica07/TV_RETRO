// Tutorial guiado (plan en docs/plan-tutorial.md).
//
// Una capa fija sobre la app (index.html, #tutorial, hijo directo de <body>) que resalta una parte a la vez y muestra
// una frase corta. Sale la PRIMERA vez que el cliente entra con su TV ya vinculada y después se repite desde
// Más > Config > Ayuda y contacto > Ver tutorial.
//
// Reglas que respeta (docs/plan-tutorial.md, sección 5):
//  - No añade campos a Firebase: lo "ya visto" se recuerda en el celular (localStorage, una clave por cuenta).
//    Si el almacenamiento falla, se recuerda solo mientras la página siga abierta.
//  - No cambia de pestaña mientras explica (cambiarTipo() cambia lo que envía Enviar): se resalta desde donde esté el
//    cliente. Un paso cuyo objetivo no se ve (por ejemplo Enviar en el menú Más) se salta.
//  - A prueba de impacientes: Siguiente ignora toques repetidos muy seguidos, Saltar/Atrás/Escape cierran una sola vez.
//  - La capa tapa lo de abajo (nadie puede tocar Enviar a mitad), atrapa el foco del teclado y se cierra con Escape.

// Textos aprobados por el dueño (docs/plan-tutorial.md, sección 3), tal cual.
// objetivo = selector de lo que se resalta; null = último paso, sin nada resaltado.
export const PASOS = [
  { objetivo: '.dispositivo', texto: 'Aquí ves si tu TV está conectada.' },
  { objetivo: '#grupoTipo button[data-valor="texto"]', texto: 'Escribe un mensaje y elige cómo se ve.' },
  { objetivo: '#enviar', texto: 'Toca Enviar y aparece en tu TV.' },
  { objetivo: '#grupoTipo button[data-valor="imagen"]', texto: 'Sube una imagen o un GIF.' },
  { objetivo: '#grupoTipo button[data-valor="dibujo"]', texto: 'Dibuja con el dedo.' },
  { objetivo: '#grupoTipo button[data-valor="cancion"]', texto: 'Elige una canción para tu TV.' },
  { objetivo: '#grupoTipo button[data-valor="galeria"]', texto: 'Aquí están tu galería, los juegos, la alarma y los ajustes.' },
  { objetivo: null, texto: '¡Listo! Puedes volver a verlo en Más > Config > Ayuda y contacto.' }
];

// Texto del botón del último paso: PROPUESTA (el dueño no lo dictó; "Siguiente" y "Saltar" sí van en el plan).
const TEXTO_BOTON_ULTIMO = 'Cerrar';
const TEXTO_BOTON_SIGUIENTE = 'Siguiente';

const ESPERA_ENTRE_TOQUES_MS = 250; // dos "Siguiente" más seguidos que esto cuentan como uno
const HOLGURA_FOCO_PX = 6;          // aire entre lo resaltado y su borde
const MARGEN_FOCO_PX = 3;           // el aro nunca se acerca más que esto al borde de la pantalla (si no, se vería cortado)
const SEPARACION_TARJETA_PX = 12;   // aire entre lo resaltado y la tarjeta
const MARGEN_PANTALLA_PX = 8;

/**
 * @param {Object} deps
 * @param {() => Object} deps.leerElementos  los IDs de ui.js (obtenerElementos)
 * @param {(tipo: string) => void} deps.cambiarTipo  solo para "Ver tutorial" desde Más: va a Texto para que Enviar se vea
 * @param {() => boolean} [deps.puedeAbrir]  false mientras haya algo que lo impida (login, Mi TV, panel bloqueado)
 */
export function crearTutorial({ leerElementos, cambiarTipo, puedeAbrir = () => true }) {
  const E = () => leerElementos();

  let abierto = false;
  let paso = 0;
  let uidActual = null;
  let ultimoToque = 0;
  let objetivoActual = null;
  let observador = null;
  let focoPrevio = null;
  const vistoEnEstaSesion = new Set();

  const clave = (uid) => 'tvretro.tutorial.' + (uid || 'local');

  function yaVisto(uid) {
    if (vistoEnEstaSesion.has(clave(uid))) return true;
    try { return localStorage.getItem(clave(uid)) === '1'; } catch (e) { return false; }
  }

  function marcarVisto(uid) {
    vistoEnEstaSesion.add(clave(uid));
    try { localStorage.setItem(clave(uid), '1'); } catch (e) { /* sin almacenamiento: queda solo en esta sesión */ }
  }

  // Un elemento "se ve" si ocupa lugar y no está dentro de algo oculto.
  function seVe(el) {
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function buscarObjetivo(p) {
    return p.objetivo ? document.querySelector(p.objetivo) : null;
  }

  // Del paso `desde` en adelante, el primero que se pueda mostrar (el último, sin objetivo, siempre se puede).
  function siguienteMostrable(desde) {
    for (let i = desde; i < PASOS.length; i++) {
      if (!PASOS[i].objetivo || seVe(buscarObjetivo(PASOS[i]))) return i;
    }
    return PASOS.length - 1;
  }

  function pintarPuntos() {
    const cont = E().tutorialPuntos;
    if (cont.children.length !== PASOS.length) {
      cont.textContent = '';
      for (let i = 0; i < PASOS.length; i++) cont.appendChild(document.createElement('span'));
    }
    [...cont.children].forEach((s, i) => s.classList.toggle('activo', i === paso));
  }

  // Pone el foco sobre el objetivo y la tarjeta arriba o abajo de él, según dónde haya lugar.
  function colocar() {
    if (!abierto) return;
    const el = E();
    const tarjeta = el.tutorialTarjeta;
    const alto = window.innerHeight;

    if (!objetivoActual || !seVe(objetivoActual)) {
      el.tutorial.classList.add('sin-foco');
      tarjeta.style.top = Math.max(MARGEN_PANTALLA_PX, Math.round((alto - tarjeta.offsetHeight) / 2)) + 'px';
      return;
    }

    el.tutorial.classList.remove('sin-foco');
    const r = objetivoActual.getBoundingClientRect();
    const foco = el.tutorialFoco;
    // Un botón pegado al borde (Texto a la izquierda, Más a la derecha, la barra de abajo) dejaría el aro cortado: se recorta
    // para que se vea entero.
    const izq = Math.max(MARGEN_FOCO_PX, r.left - HOLGURA_FOCO_PX);
    const arr = Math.max(MARGEN_FOCO_PX, r.top - HOLGURA_FOCO_PX);
    const der = Math.min(window.innerWidth - MARGEN_FOCO_PX, r.right + HOLGURA_FOCO_PX);
    const aba = Math.min(alto - MARGEN_FOCO_PX, r.bottom + HOLGURA_FOCO_PX);
    foco.style.top = Math.round(arr) + 'px';
    foco.style.left = Math.round(izq) + 'px';
    foco.style.width = Math.round(der - izq) + 'px';
    foco.style.height = Math.round(aba - arr) + 'px';

    const th = tarjeta.offsetHeight;
    const debajo = r.bottom + HOLGURA_FOCO_PX + SEPARACION_TARJETA_PX;
    let top = (debajo + th <= alto - MARGEN_PANTALLA_PX)
      ? debajo
      : r.top - HOLGURA_FOCO_PX - SEPARACION_TARJETA_PX - th;
    top = Math.min(Math.max(top, MARGEN_PANTALLA_PX), Math.max(MARGEN_PANTALLA_PX, alto - th - MARGEN_PANTALLA_PX));
    tarjeta.style.top = Math.round(top) + 'px';
  }

  function vigilarObjetivo() {
    if (observador) { observador.disconnect(); observador = null; }
    if (objetivoActual && typeof ResizeObserver === 'function') {
      // Un aviso tardío ("En la TV ✅", un mensaje de dos líneas) puede cambiar el alto de lo resaltado.
      observador = new ResizeObserver(() => colocar());
      observador.observe(objetivoActual);
    }
  }

  function mostrarPaso(deseado) {
    paso = siguienteMostrable(deseado);
    const p = PASOS[paso];
    const el = E();
    objetivoActual = buscarObjetivo(p);
    el.tutorialTexto.textContent = p.texto;
    const ultimo = paso === PASOS.length - 1;
    el.tutorialSiguiente.textContent = ultimo ? TEXTO_BOTON_ULTIMO : TEXTO_BOTON_SIGUIENTE;
    el.tutorialSaltar.hidden = ultimo;
    pintarPuntos();
    vigilarObjetivo();
    colocar();
    // El foco va a la tarjeta (tabindex -1, sin aro): un lector de pantalla lee la frase y, con teclado, Tab llega a los botones.
    // Enfocar el botón dejaba un aro doble alrededor de "Siguiente".
    try { el.tutorialTarjeta.focus({ preventScroll: true }); } catch (e) { /* nada */ }
  }

  function alTeclear(e) {
    if (!abierto) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      saltar();
      return;
    }
    if (e.key === 'Tab') {
      const el = E();
      const botones = [el.tutorialSaltar, el.tutorialSiguiente].filter((b) => b && !b.hidden);
      if (!botones.length) return;
      const i = botones.indexOf(document.activeElement);
      e.preventDefault();
      const sig = e.shiftKey ? (i <= 0 ? botones.length - 1 : i - 1) : (i === botones.length - 1 ? 0 : i + 1);
      botones[sig].focus({ preventScroll: true });
    }
  }

  function abrir() {
    if (abierto) return;
    const el = E();
    abierto = true;
    paso = 0;
    ultimoToque = 0;
    focoPrevio = document.activeElement;
    el.tutorial.hidden = false;
    document.body.classList.add('tutorial-abierto');
    if (window.scrollY > 0) window.scrollTo(0, 0);
    document.addEventListener('keydown', alTeclear, true);
    window.addEventListener('resize', colocar);
    mostrarPaso(0);
  }

  // Cierra la capa y lo da por visto (terminarlo y saltarlo cuentan igual: no se insiste).
  function cerrar() {
    if (!abierto) return;
    abierto = false;
    const el = E();
    el.tutorial.hidden = true;
    el.tutorial.classList.remove('sin-foco');
    document.body.classList.remove('tutorial-abierto');
    document.removeEventListener('keydown', alTeclear, true);
    window.removeEventListener('resize', colocar);
    if (observador) { observador.disconnect(); observador = null; }
    objetivoActual = null;
    marcarVisto(uidActual);
    if (focoPrevio && document.contains(focoPrevio) && typeof focoPrevio.focus === 'function') {
      try { focoPrevio.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    }
    focoPrevio = null;
  }

  function siguiente() {
    if (!abierto) return;
    const ahora = Date.now();
    if (ahora - ultimoToque < ESPERA_ENTRE_TOQUES_MS) return; // doble toque: cuenta como uno
    ultimoToque = ahora;
    if (paso >= PASOS.length - 1) {
      cerrar();
      return;
    }
    mostrarPaso(paso + 1);
  }

  function saltar() {
    cerrar();
  }

  const api = {
    /** Los clics de la capa y de la fila "Ver tutorial". Se llama una vez, al armar la pantalla. */
    configurarEventos() {
      const el = E();
      el.tutorialSiguiente.addEventListener('click', siguiente);
      el.tutorialSaltar.addEventListener('click', saltar);
      if (el.botonVerTutorial) el.botonVerTutorial.addEventListener('click', () => api.verDeNuevo());
    },

    /** La primera vez que la cuenta entra con una TV vinculada. No hace nada si ya lo vio o si algo lo impide. */
    iniciarSiCorresponde(uid) {
      uidActual = uid || null;
      if (abierto || yaVisto(uidActual) || !puedeAbrir()) return false;
      abrir();
      return true;
    },

    /** Desde Más > Config > Ayuda y contacto. Ahí no se ve Enviar, así que primero se pasa a Texto. */
    verDeNuevo() {
      if (abierto) return;
      if (typeof cambiarTipo === 'function') cambiarTipo('texto');
      abrir();
    },

    estaAbierto() { return abierto; },

    /** Botón Atrás de Android, Escape y Saltar: cierran una sola vez. */
    saltar
  };
  return api;
}
