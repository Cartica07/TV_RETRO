// Buscar canción y listas con el estilo de la app (pedidos del dueño, 2026-11-23): con muchas canciones, buscarlas con scroll es lento. Una lupa junto a la lista de
// canciones (#seleccionCancion) y junto al tono de la alarma (#alarmaTono) abre una ventana con un campo de texto: al escribir quedan
// las canciones cuyo nombre, o alguna de sus palabras, empieza por lo escrito ("N" -> las que empiezan por N; "mundo" -> "Un mundo
// ideal" y "El fin del mundo"), sin importar mayúsculas ni tildes. Al tocar una, queda elegida en la lista de la Pro (como si se
// hubiera elegido ahí: se le avisa con un evento "change") y la ventana se cierra.
// La Pro no se toca: sus listas siguen siendo las mismas; esto solo elige en ellas. HTML y estilos: construir.mjs y unificada.css.
import { alAtras } from './atras.js';

const q = (id) => document.getElementById(id);

// Texto comparable: sin tildes, en minúsculas, y todo lo que no sea letra o número como UN espacio. Devuelve también, para cada
// letra del texto comparable, su posición en el original (para resaltar lo encontrado).
export function normalizar(texto) {
  let limpio = '';
  const posiciones = [];
  const original = String(texto || '');
  for (let i = 0; i < original.length; i++) {
    if (/['’´`]/.test(original[i])) continue; // el apóstrofo no separa palabras: "Isn't" se busca como "isnt"
    let c = original[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!/^[a-z0-9]$/.test(c)) c = ' ';
    if (c === ' ' && (limpio === '' || limpio.endsWith(' '))) continue;
    limpio += c;
    posiciones.push(i);
  }
  while (limpio.endsWith(' ')) { limpio = limpio.slice(0, -1); posiciones.pop(); }
  return { limpio, posiciones };
}

/**
 * ¿El nombre coincide con la búsqueda? Devuelve null si no; si sí, { orden, desde, hasta } (orden 0 = el nombre empieza así,
 * 1 = alguna palabra empieza así; desde/hasta = el tramo del nombre original que coincide).
 */
export function coincidencia(nombre, busqueda) {
  const b = normalizar(busqueda).limpio;
  const n = normalizar(nombre);
  if (!b) return { orden: 0, desde: 0, hasta: 0 };
  let pos = n.limpio.startsWith(b) ? 0 : -1;
  if (pos < 0) {
    const i = (' ' + n.limpio).indexOf(' ' + b);
    if (i >= 0) pos = i; // en " texto" la i apunta al espacio; en "texto" es el comienzo de la palabra
  }
  if (pos < 0) return null;
  return { orden: pos === 0 ? 0 : 1, desde: n.posiciones[pos], hasta: n.posiciones[pos + b.length - 1] + 1 };
}

function iniciar() {
  const ventana = q('buscadorCanciones');
  const campo = q('buscadorTexto');
  const lista = q('buscadorLista');
  const vacio = q('buscadorVacio');
  const cerrarBoton = q('buscadorCerrar');
  if (!ventana || !campo || !lista || !vacio) return;
  const titulo = q('buscadorTitulo');
  let destino = null; // el <select> de la Pro en el que se elige
  let botonOrigen = null;

  // Las listas que se abren en esta ventana. Las de canciones llevan buscador; las cortas (Letra, Encuadre, Zona horaria, pedido
  // del dueño 2026-11-23: que no se vea la lista gris de Android), no: arriba va el nombre que la lista ya tiene en pantalla.
  const LISTAS = { seleccionCancion: true, alarmaTono: true, fuenteTexto: false, escalaImagen: false, ajusteZona: false };
  const conBuscador = (select) => LISTAS[select.id] === true;
  const SELECTOR_LISTAS = Object.keys(LISTAS).map((id) => ':scope > #' + id).join(', ');
  const nombreDeLaLista = (select) => {
    const rotulo = document.querySelector('label[for="' + select.id + '"]') || (select.closest('.campo') && select.closest('.campo').querySelector('.rotulo'));
    return ((rotulo && rotulo.textContent) || select.getAttribute('aria-label') || '').trim();
  };

  // Las opciones del <select>: en Canciones, la vacía es "-- Selecciona --" y no se muestra; en las demás (por ejemplo, el sonido
  // simple de la alarma) sí es una elección.
  const opciones = () => Array.from(destino.options).filter((o) => !o.disabled && (o.value !== '' || destino.id !== 'seleccionCancion'));

  function pintar() {
    const texto = campo.value;
    const encontradas = [];
    for (const o of opciones()) {
      const c = coincidencia(o.textContent, texto);
      if (c) encontradas.push({ o, c });
    }
    encontradas.sort((a, b) => a.c.orden - b.c.orden); // primero las que empiezan así (sort estable: se mantiene el orden de la lista)
    lista.textContent = '';
    for (const { o, c } of encontradas) {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.dataset.valor = o.value;
      if (o.value === destino.value) boton.setAttribute('aria-current', 'true');
      const nombre = o.textContent;
      if (c.hasta > c.desde) {
        const marca = document.createElement('mark');
        marca.textContent = nombre.slice(c.desde, c.hasta);
        boton.append(nombre.slice(0, c.desde), marca, nombre.slice(c.hasta));
      } else {
        boton.textContent = nombre;
      }
      li.appendChild(boton);
      lista.appendChild(li);
    }
    vacio.hidden = encontradas.length > 0;
  }

  // Con la lupa se abre lista para escribir (con el teclado). Tocando la lista misma, solo se ve la lista (sin teclado; para buscar
  // se toca el campo) con la canción elegida a la vista.
  function abrir(select, boton, { teclado = true } = {}) {
    if (!select || select.disabled) return;
    destino = select;
    botonOrigen = boton || null;
    const buscar = conBuscador(select);
    if (!buscar) teclado = false;
    ventana.classList.toggle('sin-busqueda', !buscar);
    if (titulo) { titulo.hidden = buscar; titulo.textContent = buscar ? '' : nombreDeLaLista(select); }
    ventana.setAttribute('aria-label', buscar ? campo.getAttribute('aria-label') : nombreDeLaLista(select));
    campo.value = '';
    pintar();
    ventana.hidden = false;
    lista.scrollTop = 0;
    if (teclado) {
      campo.focus();
    } else {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const actual = lista.querySelector('button[aria-current="true"]');
      if (actual) actual.scrollIntoView({ block: 'center' });
    }
  }

  function cerrar() {
    if (ventana.hidden) return false;
    ventana.hidden = true;
    destino = null;
    if (botonOrigen) { try { botonOrigen.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    return true;
  }

  function elegir(valor) {
    const select = destino;
    cerrar();
    if (!select || select.value === valor) return;
    select.value = valor;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest) return;
    const lupa = e.target.closest('.boton-buscar-cancion');
    if (lupa) { abrir(q(lupa.dataset.buscarEn), lupa); return; }
    // La lista misma (unificada.css le quita los toques al <select>, así que llegan a su caja): en vez de la lista gris de
    // Android, esta, con el estilo de la app.
    const caja = e.target.closest('.selector');
    const select = caja && caja.querySelector(SELECTOR_LISTAS);
    if (select) abrir(select, select, { teclado: false });
  });
  // Con teclado físico (Enter, espacio o flecha abajo sobre la lista), lo mismo.
  document.addEventListener('keydown', (e) => {
    const select = e.target;
    if (!select || !(select.id in LISTAS) || select.tagName !== 'SELECT') return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      abrir(select, select, { teclado: false });
    }
  });
  campo.addEventListener('input', pintar);
  lista.addEventListener('click', (e) => {
    const boton = e.target.closest && e.target.closest('button[data-valor]');
    if (boton) elegir(boton.dataset.valor);
  });
  // "Buscar" en el teclado: si queda una sola canción, se elige.
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const botones = lista.querySelectorAll('button[data-valor]');
      if (botones.length === 1) elegir(botones[0].dataset.valor);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  });
  if (cerrarBoton) cerrarBoton.addEventListener('click', cerrar);
  // En las listas cortas (tarjeta centrada) tocar el fondo oscurecido la cierra, como en la lista de Android.
  ventana.addEventListener('click', (e) => { if (e.target === ventana && ventana.classList.contains('sin-busqueda')) cerrar(); });
  alAtras(cerrar); // botón Atrás de Android: cierra la búsqueda en vez de salir de la app
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
