// Barra de avance de "Actualizar" (Más > Config > Sistema), pedido del dueño el 2026-11-23, para Pepito Pro y Pepito Lite.
//
// La pantalla Sistema es la de la Pro (mas.js, sin cambios): escribe en #sistemaEstadoActualizar "Enviando…", "Actualizando…",
// "Reiniciando…" y al final el mensaje de éxito (con ✅) o borra el texto si falló. Esta barra solo OBSERVA ese texto:
//
// - Pepito Lite: avance REAL. La app manda el programa y lo avisa con el evento "pepito-avance-actualizar" (0 a 1); el envío ocupa
//   hasta el 90 %. Después, mientras Pepito se reinicia y la app se vuelve a conectar, sube despacio hasta un tope.
// - Pepito Pro: la app no sabe cuánto lleva la TV (la descarga la hace la TV por Wi-Fi). Avance SOLO VISUAL (decisión del dueño):
//   a saltos desiguales, calculado sobre unos 2 minutos (lo que tarda de verdad), y si tarda más se queda en un tope al azar
//   (entre 93 y 99 %).
// - En los dos: la barra llega al 100 % SOLO cuando la actualización terminó de verdad, y recién entonces se ve el mensaje de éxito.
//   Si algo falla, la barra se esconde (el error sale en la línea de estado, como en la Pro).

const DURACION_PRO_MS = 120000;
const PASO_MIN_MS = 900, PASO_MAX_MS = 3500;    // cada cuánto da un salto (al azar)
const ENVIO_LITE = 90;                           // hasta dónde llega la barra con el envío real de la Lite
const LLENADO_MS = 700;                          // lo que tarda en llenarse al terminar (la transición del CSS)

const azar = (min, max) => min + Math.random() * (max - min);

let activa = false;
let valor = 0;
let tope = 97;
let inicio = 0;
let reloj = null;
let realLite = 0;            // avance real del envío (0 a 1) de una TV Lite
let terminando = false;
let textoFinal = null;       // el mensaje de éxito que acompaña a la barra llena (con otro texto, la barra se esconde)

const el = (id) => document.getElementById(id);
const esLite = () => document.body.classList.contains('tv-lite');

function pintar(v) {
  valor = Math.max(valor, Math.min(100, v));
  const relleno = el('barraActualizarRelleno');
  const barra = el('barraActualizar');
  if (relleno) relleno.style.width = `${valor}%`;
  if (barra) barra.setAttribute('aria-valuenow', String(Math.round(valor)));
}

function mostrar(si) {
  const barra = el('barraActualizar');
  if (barra) barra.hidden = !si;
}

// Lo que "debería" llevar según el tiempo (Pro) o según el envío real (Lite), con saltos desiguales.
function paso() {
  if (!activa || terminando) return;
  const transcurrido = Date.now() - inicio;
  let ideal;
  if (esLite()) {
    // Antes del envío (bajando de internet) y después (reiniciando) sube despacio; durante el envío manda lo real.
    ideal = realLite < 1 ? Math.max(ENVIO_LITE * realLite, Math.min(4, transcurrido / 3000)) : ENVIO_LITE + (Date.now() - finEnvio) / 2500;
  } else {
    ideal = (100 * transcurrido) / DURACION_PRO_MS;
  }
  // Un salto al azar alrededor de lo ideal; a veces se queda quieta un rato (no lineal).
  let siguiente = ideal + azar(-5, 9);
  if (Math.random() < 0.2) siguiente = valor;
  pintar(Math.min(tope, Math.max(valor, siguiente)));
  reloj = setTimeout(paso, azar(PASO_MIN_MS, PASO_MAX_MS));
}

let finEnvio = 0;

function empezar() {
  activa = true;
  terminando = false;
  textoFinal = null;
  valor = 0;
  realLite = 0;
  finEnvio = 0;
  tope = Math.round(azar(93, 99));
  inicio = Date.now();
  const relleno = el('barraActualizarRelleno');
  if (relleno) { relleno.style.transition = 'none'; relleno.style.width = '0%'; void relleno.offsetWidth; relleno.style.transition = ''; }
  pintar(0);
  mostrar(true);
  clearTimeout(reloj);
  reloj = setTimeout(paso, azar(400, 1200));
}

function cancelar() {
  activa = false;
  terminando = false;
  clearTimeout(reloj);
  mostrar(false);
  const texto = el('sistemaEstadoActualizar');
  if (texto) texto.classList.remove('espera-barra');
}

// Terminó de verdad: la barra se llena y recién entonces se ve el mensaje de éxito.
function terminar() {
  if (terminando) return;
  terminando = true;
  activa = false;
  clearTimeout(reloj);
  const texto = el('sistemaEstadoActualizar');
  if (texto) texto.classList.add('espera-barra');
  pintar(100);
  setTimeout(() => {
    if (texto) { texto.classList.remove('espera-barra'); textoFinal = texto.textContent; }
    terminando = false;
  }, LLENADO_MS + 150);
}

function alCambiarTexto() {
  const texto = el('sistemaEstadoActualizar');
  if (!texto) return;
  const t = texto.textContent || '';
  if (/^(Actualizando|Reiniciando)/.test(t)) {
    if (!activa) empezar();
    return;
  }
  if (terminando) return; // el mensaje de éxito llega mientras la barra se llena
  if (activa && t.includes('✅')) return terminar();
  if (activa) cancelar(); // falló (el texto se borró) o se volvió a abrir la pantalla
  else if (t !== textoFinal) mostrar(false); // la barra llena solo acompaña a su mensaje de éxito
}

window.addEventListener('pepito-avance-actualizar', (e) => {
  if (!activa) return;
  const p = Math.max(0, Math.min(1, Number(e.detail) || 0));
  realLite = Math.max(realLite, p);
  if (realLite >= 1 && !finEnvio) finEnvio = Date.now();
  pintar(Math.min(tope, ENVIO_LITE * realLite));
});

// Al salir de la pantalla o volver a entrar, la barra de una actualización ya terminada se va (aunque se esté llenando todavía).
document.addEventListener('click', (e) => {
  if (activa || !e.target || !e.target.closest || !e.target.closest('#botonMasVolver, [data-config="sistema"], #grupoTipo button, #grupoMas button')) return;
  terminando = false;
  textoFinal = null;
  mostrar(false);
  const texto = el('sistemaEstadoActualizar');
  if (texto) texto.classList.remove('espera-barra');
}, true);

function vigilar() {
  const texto = el('sistemaEstadoActualizar');
  if (!texto) return;
  new MutationObserver(alCambiarTexto).observe(texto, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar);
else vigilar();
