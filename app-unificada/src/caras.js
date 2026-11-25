// Más > Caras de reloj (2026-11-24; plan en docs/plan-caras-de-reloj.md). Pepito Pro y Pepito Lite, la misma pantalla.
// La vista previa la dibuja js/cara.js, igual punto por punto que la TV. La lista: la Cara 1 (la de siempre, escrita en la app y
// en las TV) + el catálogo de la nube (relojes/, lo crea el dueño). "Enviar a Pepito" copia la cara a la TV: en una Pro, en
// dispositivos/{id}/reloj con la orden "ajustes"; en una Lite, por Bluetooth (bit 4; la Cara 1 con 0x24). Ver el enrutador.
import { dibujarCara, leerReceta, RECETA_CARA_1, TIPO } from './cara.js';
import {
  unificadaListarCaras, unificadaLeerCara, unificadaCaraActual, unificadaPuedeCaras, unificadaElegirCara,
  unificadaCiudad, unificadaGuardarCiudad, unificadaBuscarCiudad,
} from './firebase.js';
import { alAtras } from './atras.js';

// Textos: "Actualiza tu Pepito para cambiar la cara del reloj." lo dictó el dueño; los demás son PROPUESTAS
// (docs/lite-textos-propuestos.md, filas 51 a 53).
const TEXTO_ACTUALIZA = 'Actualiza tu Pepito para cambiar la cara del reloj.';
const TEXTO_LISTO = 'Listo ✅'; // ronda de textos del 2026-11-25 (antes "Pepito ya tiene esta cara ✅")
const TEXTO_ERROR = 'No se pudo enviar. Vuelve a intentarlo.';
const TEXTO_ENVIANDO = 'Enviando…';
// El de siempre del panel con la señal lenta (main.js de la Pro).
const TEXTO_LENTO = 'Conexión lenta: se enviará cuando vuelva la señal.';
// Ciudad para el clima (opción A del dueño, 2026-11-24; textos 54 a 57 aprobados).
const TEXTO_SIN_CLIMA = 'Sin clima';
const TEXTO_NO_ENCONTRADA = 'No encontramos esa ciudad.';
const TEXTO_SIN_INTERNET = 'Sin conexión a internet. Conéctate y vuelve a buscar.'; // aprobado por el dueño el 2026-11-24

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
    alarmaActiva: true, proxAlarma: { hora: 7, minuto: 0 }, clima: lite ? null : { temp: 24, icono: 0 }, bateria: 0, bateriaPct: 0,
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
    mostrarCiudad(receta);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Ciudad para el clima: la fila sale solo con un Pepito Pro y si la cara elegida muestra el clima.
// ---------------------------------------------------------------------------------------------------------------------
let ciudad = null; // { nombre, lat, lon } o null
const tieneClima = (receta) => { const r = leerReceta(receta); return !!r && r.elementos.some((e) => e.tipo === TIPO.CLIMA); };

function pintarCiudad() {
  const sel = $('ciudadSelect');
  if (!sel) return;
  sel.textContent = '';
  const o = document.createElement('option');
  o.value = '';
  o.textContent = ciudad ? ciudad.nombre : TEXTO_SIN_CLIMA;
  sel.append(o);
}

function mostrarCiudad(receta) {
  const campo = $('campoCiudad');
  if (!campo) return;
  campo.hidden = document.body.classList.contains('tv-lite') || !tieneClima(receta);
  pintarCiudad();
}

let turnoBusqueda = 0;
let resultados = [];
let esperaBusqueda = null;

function pintarResultados(lista, aviso) { // aviso: texto debajo de la lista ('' = ninguno)
  const ul = $('ciudadLista');
  ul.textContent = '';
  const opciones = [{ nombre: TEXTO_SIN_CLIMA, sin: true }, ...lista];
  opciones.forEach((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = String(i - 1); // -1 = sin clima
    b.textContent = c.nombre;
    if ((c.sin && !ciudad) || (!c.sin && ciudad && ciudad.nombre === c.nombre)) b.setAttribute('aria-current', 'true');
    li.append(b);
    ul.append(li);
  });
  $('ciudadVacio').textContent = aviso || '';
  $('ciudadVacio').hidden = !aviso;
}

function abrirCiudad() {
  const v = $('buscadorCiudad');
  if (!v) return;
  resultados = [];
  $('ciudadTexto').value = '';
  pintarResultados([], '');
  v.hidden = false;
  try { $('ciudadTexto').focus(); } catch (e) { /* nada */ }
}

function cerrarCiudad() {
  const v = $('buscadorCiudad');
  if (!v || v.hidden) return false;
  v.hidden = true;
  turnoBusqueda++;
  return true;
}

async function buscar() {
  const t = ++turnoBusqueda;
  const texto = $('ciudadTexto').value.trim();
  if (texto.length < 2) { resultados = []; pintarResultados([], ''); return; }
  const r = await unificadaBuscarCiudad(texto);
  if (t !== turnoBusqueda) return; // ya escribió otra cosa
  resultados = r || [];
  // null = no hubo respuesta (sin internet); [] = el buscador no encontró nada.
  pintarResultados(resultados, r === null ? TEXTO_SIN_INTERNET : (resultados.length === 0 ? TEXTO_NO_ENCONTRADA : ''));
}

async function elegirCiudad(i) {
  cerrarCiudad();
  const nueva = i >= 0 ? resultados[i] : null;
  if (!nueva && !ciudad) return;
  if (nueva && ciudad && nueva.nombre === ciudad.nombre) return;
  aviso(TEXTO_ENVIANDO);
  const r = await unificadaGuardarCiudad(nueva);
  if (r && r.exito) { ciudad = nueva; aviso(''); } else aviso(TEXTO_ERROR);
  pintarCiudad();
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  const caja = t.closest('.selector');
  if (caja && caja.querySelector('#ciudadSelect')) { abrirCiudad(); return; }
  if (t.closest('#ciudadCerrar') || t.id === 'buscadorCiudad') { cerrarCiudad(); return; }
  const b = t.closest('#ciudadLista button[data-i]');
  if (b) elegirCiudad(Number(b.dataset.i));
});
document.addEventListener('input', (e) => {
  if (!e.target || e.target.id !== 'ciudadTexto') return;
  clearTimeout(esperaBusqueda);
  esperaBusqueda = setTimeout(buscar, 400);
});
alAtras(cerrarCiudad); // botón Atrás de Android: cierra la búsqueda en vez de salir de la app

async function abrir() {
  const t = ++turno;
  aviso('');
  const boton = $('botonEnviarCara');
  if (boton) boton.disabled = false;
  llenarLista([], '');
  pintar(RECETA_CARA_1);
  const [lista, actual, puede, laCiudad] = await Promise.all([
    unificadaListarCaras().catch(() => null),
    unificadaCaraActual().catch(() => ''),
    unificadaPuedeCaras().catch(() => null),
    unificadaCiudad().catch(() => null),
  ]);
  if (t !== turno) return;
  ciudad = laCiudad || null;
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
