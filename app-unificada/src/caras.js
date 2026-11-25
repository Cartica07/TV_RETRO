// Más > Caras de reloj (2026-11-24; plan en docs/plan-caras-de-reloj.md). Pepito Pro y Pepito Lite, la misma pantalla.
// La vista previa la dibuja js/cara.js, igual punto por punto que la TV. La lista: la Cara 1 (la de siempre, escrita en la app y
// en las TV) + el catálogo de la nube (relojes/, lo crea el dueño). "Enviar a Pepito" copia la cara a la TV: en una Pro, en
// dispositivos/{id}/reloj con la orden "ajustes"; en una Lite, por Bluetooth (bit 4; la Cara 1 con 0x24). Ver el enrutador.
import { dibujarCara, RECETA_CARA_1 } from './cara.js';
import {
  unificadaListarCaras, unificadaLeerCara, unificadaCaraActual, unificadaPuedeCaras, unificadaElegirCara,
} from './firebase.js';

// Textos: "Actualiza tu Pepito para cambiar la cara del reloj." lo dictó el dueño; los demás son PROPUESTAS
// (docs/lite-textos-propuestos.md, filas 51 a 53).
const TEXTO_ACTUALIZA = 'Actualiza tu Pepito para cambiar la cara del reloj.';
const TEXTO_LISTO = 'Listo ✅'; // ronda de textos del 2026-11-25 (antes "Pepito ya tiene esta cara ✅")
const TEXTO_ERROR = 'No se pudo enviar. Vuelve a intentarlo.';
const TEXTO_ENVIANDO = 'Enviando…';
// El de siempre del panel con la señal lenta (main.js de la Pro).
const TEXTO_LENTO = 'Conexión lenta: se enviará cuando vuelva la señal.';
const $ = (id) => document.getElementById(id);
const recetas = new Map([['', RECETA_CARA_1]]);
let turno = 0;
let enviando = false;

function aviso(texto) {
  const a = $('caraAviso');
  if (!a) return;
  a.textContent = texto || '';
  a.hidden = !texto;
}

// Datos de muestra para la vista previa: la hora de ahora y la TV conectada.
function datosVista() {
  const ahora = new Date();
  const lite = document.body.classList.contains('tv-lite');
  return {
    hora: ahora.getHours(), minuto: ahora.getMinutes(), dia: ahora.getDate(), mes: ahora.getMonth() + 1, anio: ahora.getFullYear(),
    diaSemana: ahora.getDay(), esPro: !lite, wifiConectado: true, wifiBarras: 4, conexionOk: true, mensaje: false,
    alarmaActiva: true, proxAlarma: { hora: 7, minuto: 0 }, clima: null, bateria: 0, bateriaPct: 0,
  };
}

function pintar(receta) {
  const canvas = $('caraVista');
  if (!canvas) return;
  const datos = datosVista();
  const pantalla = dibujarCara(receta, datos) || dibujarCara(RECETA_CARA_1, datos);
  const ctx = canvas.getContext('2d');
  const esc = canvas.width / 128;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4DD2FF';
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) if (pantalla[y * 128 + x]) ctx.fillRect(x * esc, y * esc, esc, esc);
}

function llenarLista(caras, elegida) {
  const sel = $('caraLista');
  if (!sel) return;
  sel.textContent = '';
  for (const c of [{ clave: '', nombre: 'Cara 1' }, ...caras]) {
    const o = document.createElement('option');
    o.value = c.clave;
    o.textContent = c.nombre;
    sel.append(o);
  }
  sel.value = caras.some((c) => c.clave === elegida) ? elegida : '';
}

async function recetaDe(clave) {
  if (recetas.has(clave)) return recetas.get(clave);
  const r = await unificadaLeerCara(clave);
  if (r) recetas.set(clave, r);
  return r;
}

async function mostrarElegida() {
  const t = turno;
  const clave = $('caraLista').value;
  let receta = RECETA_CARA_1;
  try { receta = (await recetaDe(clave)) || RECETA_CARA_1; } catch (e) { console.warn('[Pepito] No se pudo leer la cara:', e); }
  if (t === turno && $('caraLista').value === clave) {
    pintar(receta);
  }
}

async function abrir() {
  const t = ++turno;
  aviso('');
  const boton = $('botonEnviarCara');
  if (boton) boton.disabled = false;
  llenarLista([], '');
  pintar(RECETA_CARA_1);
  const [lista, actual, puede] = await Promise.all([
    unificadaListarCaras().catch(() => null),
    unificadaCaraActual().catch(() => ''),
    unificadaPuedeCaras().catch(() => null),
  ]);
  if (t !== turno) return;
  llenarLista(lista || [], actual || '');
  if (puede === false) {
    // (El aviso TEXTO_ACTUALIZA ya no se muestra: ningún Pepito que se entregue tiene una versión sin caras; dueño, 2026-11-25.)
    if (boton) boton.disabled = true;
  }
  await mostrarElegida();
}

// El resultado de un envío solo se muestra si se sigue en la misma pantalla (no se volvió a entrar) y con la misma cara elegida
// en la lista: si no, el ✅ hablaría de otra cara (2026-11-24).
const siguePantalla = (clave, t) => t === turno && !!$('caraLista') && $('caraLista').value === clave;
function mostrarResultado(r, clave, t) {
  if (!siguePantalla(clave, t)) return;
  aviso(r && r.exito ? TEXTO_LISTO : ((r && r.error) ? `${r.error}.`.replace(/\.\.$/, '.') : TEXTO_ERROR));
}

async function enviar() {
  if (enviando) return;
  enviando = true;
  const t = turno;
  const boton = $('botonEnviarCara');
  if (boton) boton.disabled = true;
  try {
    const clave = $('caraLista').value;
    aviso(TEXTO_ENVIANDO);
    const receta = clave ? await recetaDe(clave) : null;
    if (clave && !receta) { aviso(TEXTO_ERROR); return; }
    const r = await unificadaElegirCara(clave, receta);
    if (r && r.pendiente && r.escritura) {
      // Sin señal (2026-11-24): se avisa y se suelta el botón; el resultado llega cuando vuelva la señal.
      if (siguePantalla(clave, t)) aviso(TEXTO_LENTO);
      r.escritura.then((final) => mostrarResultado(final, clave, t), () => mostrarResultado(null, clave, t));
      return;
    }
    mostrarResultado(r, clave, t);
  } catch (e) {
    console.error('[Pepito] Error al enviar la cara:', e);
    aviso(TEXTO_ERROR);
  } finally {
    enviando = false;
    if (boton) boton.disabled = false;
  }
}

window.addEventListener('pepito-abrir-caras', () => { abrir(); });
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'caraLista') { aviso(''); mostrarElegida(); } });
document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#botonEnviarCara')) enviar(); });
