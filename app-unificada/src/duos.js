// Más > Dúos (2026-11-24; docs/plan-duos.md). Solo Pepito Pro (con una Lite el botón no se ve: unificada.css).
// "Activar dúos" = dispositivos/{id}/ajustes.duos (si falta, activados) y el favorito = ajustes.duoFavorito (si falta, el
// primero del catálogo). Viajan con la orden "ajustes" de siempre. La lista es el catálogo de la nube (duos/indice), cada
// dúo con su portada (las dos pantallas juntas). Textos aprobados por el dueño el 2026-11-24.
import { unificadaListarDuos, unificadaDuosAjustes, unificadaGuardarDuosAjustes, unificadaPuedeDuos } from './firebase.js';

const TEXTO_SIN_CONEXION = 'Sin conexión. Vuelve a intentarlo.';
const TEXTO_ACTUALIZA = 'Actualiza tu Pepito para usar los dúos.';
const TEXTO_LISTO = 'Listo';

const $ = (id) => document.getElementById(id);
let turno = 0;          // la última apertura de la pantalla: lo que llega tarde de una anterior se descarta
let guardando = false;
let lista = [];
let favorito = '';
let avisoActualizar = false; // el Pepito todavía no tiene dúos: el aviso se queda debajo de lo demás

function aviso(texto) {
  const a = $('duosAviso');
  if (!a) return;
  const t = texto || (avisoActualizar ? TEXTO_ACTUALIZA : '');
  a.textContent = t;
  a.hidden = !t;
}

// La portada como DOS pantallas (dos Pepitos lado a lado, pedido del dueño 2026-11-25): cada mitad de 128×64 en su
// pantalla negra con marco, separadas por un espacio. Lienzo de 276×68: marco de 2 puntos y 12 de separación.
const MARCO = 2;
const SEPARACION = 12;
const X_DERECHA = 128 + 2 * MARCO + SEPARACION; // donde empieza el marco de la pantalla derecha
function dibujarPortada(canvas, b64) {
  canvas.width = 2 * (128 + 2 * MARCO) + SEPARACION;
  canvas.height = 64 + 2 * MARCO;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const x0 of [0, X_DERECHA]) {
    ctx.fillStyle = '#33415A'; // el marco (--borde-fuerte)
    ctx.fillRect(x0, 0, 128 + 2 * MARCO, 64 + 2 * MARCO);
    ctx.fillStyle = '#000';
    ctx.fillRect(x0 + MARCO, MARCO, 128, 64);
  }
  let bytes = null;
  try { bytes = Uint8Array.from(atob(b64 || ''), (c) => c.charCodeAt(0)); } catch (e) { bytes = null; }
  if (!bytes || bytes.length !== 2048) return;
  ctx.fillStyle = '#4DD2FF';
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 256; x++) {
      if (!(bytes[y * 32 + (x >> 3)] & (0x80 >> (x & 7)))) continue;
      const px = x < 128 ? MARCO + x : X_DERECHA + MARCO + (x - 128);
      ctx.fillRect(px, MARCO + y, 1, 1);
    }
  }
}

// El favorito que se marca: el guardado si sigue en el catálogo; si no, el primero (lo mismo que hace la TV).
const favoritoVisible = () => (lista.some((d) => d.clave === favorito) ? favorito : (lista[0] ? lista[0].clave : ''));

function pintarLista() {
  const ul = $('duosLista');
  if (!ul) return;
  ul.innerHTML = '';
  const marcado = favoritoVisible();
  for (const d of lista) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.clave = d.clave;
    b.setAttribute('aria-pressed', d.clave === marcado ? 'true' : 'false');
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    dibujarPortada(c, d.portada);
    const fila = document.createElement('span');
    const estrella = document.createElement('span');
    estrella.className = 'duo-estrella';
    estrella.setAttribute('aria-hidden', 'true');
    estrella.textContent = '★'; // solo se ve en el favorito (unificada.css)
    const nombre = document.createElement('span');
    nombre.className = 'duo-nombre';
    nombre.textContent = d.nombre;
    fila.append(estrella, nombre);
    b.append(c, fila);
    b.addEventListener('click', () => { elegir(d.clave).catch(fallo); });
    li.append(b);
    ul.append(li);
  }
  const vacio = $('duosVacio');
  if (vacio) vacio.hidden = lista.length > 0;
}

function bloquear(si) {
  guardando = si;
  const sw = $('duosActivos');
  if (sw) sw.disabled = si;
  for (const b of document.querySelectorAll('#duosLista button')) b.disabled = si;
}

function fallo(e) {
  console.error('[Pepito] dúos:', e);
  bloquear(false);
  aviso(TEXTO_SIN_CONEXION);
}

async function abrir() {
  const t = ++turno;
  aviso('');
  avisoActualizar = false;
  let r;
  try {
    r = await Promise.all([unificadaListarDuos(), unificadaDuosAjustes(), unificadaPuedeDuos().catch(() => null)]);
  } catch (e) {
    if (t === turno) { console.warn('[Pepito] dúos: no se pudo leer el catálogo:', e); aviso(TEXTO_SIN_CONEXION); }
    return;
  }
  if (t !== turno) return;
  const [catalogo, ajustes, puede] = r;
  if (!ajustes || !ajustes.exito) { aviso(TEXTO_SIN_CONEXION); return; }
  lista = Array.isArray(catalogo) ? catalogo : [];
  favorito = ajustes.favorito || '';
  const sw = $('duosActivos');
  if (sw) sw.checked = !!ajustes.activos;
  pintarLista();
  avisoActualizar = puede === false;
  aviso('');
}

async function guardar(cambios) {
  if (guardando) return false;
  const t = turno;
  bloquear(true);
  aviso('');
  const r = await unificadaGuardarDuosAjustes(cambios);
  bloquear(false);
  if (t !== turno) return false; // el usuario ya salió y volvió a entrar: lo de esta vez no se muestra
  aviso(r && r.exito ? TEXTO_LISTO : TEXTO_SIN_CONEXION);
  return !!(r && r.exito);
}

async function elegir(clave) {
  if (guardando || clave === favoritoVisible()) return;
  const antes = favorito;
  favorito = clave;
  pintarLista();
  if (!(await guardar({ duoFavorito: clave }))) {
    favorito = antes; // no se guardó: vuelve a marcarse el de antes
    pintarLista();
  }
}

async function cambiarActivos(e) {
  const sw = e.target;
  const quiere = sw.checked;
  if (!(await guardar({ duos: quiere }))) sw.checked = !quiere;
}

window.addEventListener('pepito-abrir-duos', () => { abrir().catch(fallo); });
// Un módulo corre con la página ya leída: el interruptor ya existe.
{
  const sw = $('duosActivos');
  if (sw) sw.addEventListener('change', (e) => { cambiarActivos(e).catch(fallo); });
}
