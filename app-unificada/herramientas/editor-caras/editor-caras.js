// Editor de caras de reloj (herramienta del dueño; docs/plan-caras-de-reloj.md, sección 8). Crea recetas R1
// (docs/receta-r1.md) con la misma vista previa que la app y las TV (js/cara.js) y las guarda en el catálogo de la nube
// (relojes/indice y relojes/datos: solo un administrador puede escribir). construir.mjs lo copia a www/ junto a la app.
import { dibujarCara, armarReceta, leerReceta, TIPO, MAX_BYTES } from './cara.js';
import {
  escucharSesion, iniciarSesion, esAdministrador, listarMisDispositivos, usarCuenta,
  unificadaListarCaras, unificadaLeerCara, unificadaElegirCara, unificadaGuardarCaraCatalogo, unificadaBorrarCaraCatalogo,
} from './firebase.js';
import { procesarImagenDesdeDataURL } from './imageProcessor.js';

const $ = (id) => document.getElementById(id);
const FUENTES = ['Clásica', 'Sans', 'Sans negrita', 'Serif', 'Serif cursiva'];
const ALIN = ['Empieza en x', 'Centrada en x', 'Termina en x'];
const COLOR = ['Blanco', 'Negro'];
const ESTILOS = {
  wifi: ['Barras (el de hoy)', 'Abanico', 'Ondas'],
  mensaje: ['Sobre (el de hoy)', 'Sobre lleno', 'Burbuja de chat'],
  conexion: ['Círculo (el de hoy)', 'Nube'],
  campana: ['Campana', 'Campana hueca', 'Despertador'],
  bateria: ['Segmentos', 'Barra'],
};
const NOMBRES = {
  [TIPO.HORA]: 'Hora', [TIPO.AMPM]: 'AM/PM', [TIPO.FECHA]: 'Fecha', [TIPO.DIA]: 'Día de la semana', [TIPO.AGUJAS]: 'Reloj de agujas',
  [TIPO.ESTADO]: 'Íconos de estado', [TIPO.CAMPANA]: 'Campana (alarma activa)', [TIPO.TEXTO]: 'Texto fijo', [TIPO.RECTANGULO]: 'Rectángulo',
  [TIPO.LINEA]: 'Línea', [TIPO.PROXIMA_ALARMA]: 'Próxima alarma', [TIPO.CLIMA]: 'Clima (ya no se usa)', [TIPO.CUENTA]: 'Cuenta regresiva',
  [TIPO.BATERIA]: 'Batería',
};
const utf8 = (s) => [...new TextEncoder().encode(s)];
function hoyMas(dias) { const d = new Date(Date.now() + dias * 86400000); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; }

// Datos de cada elemento nuevo (los íconos con los estilos elegidos por el dueño: abanico, burbuja, nube).
function nuevoElemento(tipo) {
  const [a, m, d] = hoyMas(30);
  const datos = {
    [TIPO.HORA]: [64, 18, 0, 0, 3, 1, 0], [TIPO.AMPM]: [2, 1, 0, 0, 1, 0], [TIPO.FECHA]: [64, 54, 0, 0, 1, 1, 0],
    [TIPO.DIA]: [64, 44, 0, 0, 1, 1, 0], [TIPO.AGUJAS]: [64, 32, 0, 28, 2], [TIPO.ESTADO]: [125, 0, 0, 1, 2, 1, 1],
    [TIPO.CAMPANA]: [2, 52, 0, 0], [TIPO.TEXTO]: [64, 30, 0, 0, 1, 1, ...[6, ...utf8('Pepito')]], [TIPO.RECTANGULO]: [0, 0, 0, 128, 64, 0, 4],
    [TIPO.LINEA]: [0, 12, 0, 127, 12], [TIPO.PROXIMA_ALARMA]: [2, 54, 0, 0, 1, 0, 1], [TIPO.CLIMA]: [126, 54, 0, 0, 1, 2, 1],
    [TIPO.CUENTA]: [64, 30, 0, 0, 1, 1, a & 255, a >> 8, m, d, 0], [TIPO.BATERIA]: [2, 0, 0, 0, 0],
  }[tipo];
  return { tipo, datos: datos.slice() };
}

// Qué se puede ajustar de cada elemento: [rótulo, índice en los datos, clase, opciones].
const COMUNES = [['x', 0, 'num', [0, 127]], ['y', 1, 'num', [0, 63]], ['Color', 2, 'sel', COLOR]];
const LETRA = [['Letra', 3, 'sel', FUENTES], ['Tamaño', 4, 'num', [1, 5]], ['Alineación', 5, 'sel', ALIN]];
const CAMPOS = {
  [TIPO.HORA]: [...COMUNES, ...LETRA, ['Formato', 6, 'selv', [[0, '12 h (9:05)'], [2, '12 h (09:05)'], [1, '24 h (9:05)'], [3, '24 h (09:05)']]]],
  [TIPO.AMPM]: [...COMUNES, ...LETRA],
  [TIPO.FECHA]: [...COMUNES, ...LETRA, ['Formato', 6, 'sel', ['24/11/2026', '24/11', '24 Nov', 'Lun 24']]],
  [TIPO.DIA]: [...COMUNES, ...LETRA, ['Formato', 6, 'sel', ['Lunes', 'Lun']]],
  [TIPO.AGUJAS]: [...COMUNES, ['Radio', 3, 'num', [4, 31]], ['Marcas', 4, 'sel', ['Sin marcas', 'Cada 3 horas', 'Cada hora']]],
  [TIPO.ESTADO]: [...COMUNES, ['Wi-Fi', 3, 'sel', ESTILOS.wifi], ['Mensaje', 4, 'sel', ESTILOS.mensaje], ['Conexión', 5, 'sel', ESTILOS.conexion], ['Sentido', 6, 'sel', ['x = borde izquierdo, hacia la derecha', 'x = borde derecho, hacia la izquierda']]],
  [TIPO.CAMPANA]: [...COMUNES, ['Estilo', 3, 'sel', ESTILOS.campana]],
  [TIPO.TEXTO]: [...COMUNES, ...LETRA, ['Texto', 6, 'texto']],
  [TIPO.RECTANGULO]: [...COMUNES, ['Ancho', 3, 'num', [1, 128]], ['Alto', 4, 'num', [1, 64]], ['Relleno', 5, 'sel', ['Solo el borde', 'Lleno']], ['Redondeo', 6, 'num', [0, 8]]],
  [TIPO.LINEA]: [...COMUNES, ['x final', 3, 'num', [0, 127]], ['y final', 4, 'num', [0, 63]]],
  [TIPO.PROXIMA_ALARMA]: [...COMUNES, ...LETRA, ['Ícono', 6, 'sel', ['Sin ícono', ...ESTILOS.campana]]],
  [TIPO.CLIMA]: [...COMUNES, ...LETRA, ['Ícono', 6, 'sel', ['Sin ícono', 'Dibujos simples']]],
  [TIPO.CUENTA]: [...COMUNES, ...LETRA, ['Fecha', 6, 'fecha'], ['Formato', 10, 'sel', ['Faltan 12 días', '12 días', '12']]],
  [TIPO.BATERIA]: [...COMUNES, ['Estilo', 3, 'sel', ESTILOS.bateria], ['Porcentaje', 4, 'sel', ['No', 'Sí']]],
};

// ---- Estado del editor ----
let elementos = [];
let fondo = null;      // Uint8Array(1024) o null
let elegido = -1;
let clave = '';        // la cara del catálogo que se está editando ('' = nueva)
let catalogo = [];
let sesionUid = null;

const muestra = { tv: 'pro', mensaje: true, alarma: true };
function datosVista() {
  const t = new Date();
  return {
    hora: t.getHours(), minuto: t.getMinutes(), dia: t.getDate(), mes: t.getMonth() + 1, anio: t.getFullYear(), diaSemana: t.getDay(),
    esPro: muestra.tv === 'pro', wifiConectado: true, wifiBarras: 3, conexionOk: true, mensaje: muestra.mensaje,
    alarmaActiva: muestra.alarma, proxAlarma: muestra.alarma ? { hora: 7, minuto: 0 } : null,
    clima: null, bateria: 3, bateriaPct: 75,
  };
}
const receta = () => armarReceta({ fondo, elementos });

function pintar() {
  const r = receta();
  const tam = $('tamano');
  tam.textContent = `${r.length} de ${MAX_BYTES} bytes`;
  tam.classList.toggle('mal', r.length > MAX_BYTES);
  const p = dibujarCara(r, datosVista());
  const c = $('vista');
  const ctx = c.getContext('2d');
  const e = c.width / 128;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    ctx.fillStyle = p && p[y * 128 + x] ? '#4DD2FF' : '#071016';
    ctx.fillRect(x * e, y * e, e - 1, e - 1);
  }
  if (elegido >= 0 && elementos[elegido]) { // marca dónde está el punto (x, y) del elemento elegido
    const [x, y] = elementos[elegido].datos;
    ctx.strokeStyle = '#F2B84B'; ctx.lineWidth = 2;
    ctx.strokeRect(x * e - 4, y * e - 4, e + 8, e + 8);
  }
}

function listaElementos() {
  const ul = $('elementos');
  ul.textContent = '';
  elementos.forEach((el, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fila-elemento' + (i === elegido ? ' elegido' : '');
    b.textContent = `${i + 1}. ${NOMBRES[el.tipo]}`;
    b.addEventListener('click', () => { elegido = i; refrescar(); });
    li.append(b);
    ul.append(li);
  });
  $('sinElementos').hidden = elementos.length > 0;
}

function propiedades() {
  const caja = $('propiedades');
  caja.textContent = '';
  const el = elementos[elegido];
  $('accionesElemento').hidden = !el;
  if (!el) return;
  const h = document.createElement('h3');
  h.textContent = NOMBRES[el.tipo];
  caja.append(h);
  for (const [rotulo, i, clase, opciones] of CAMPOS[el.tipo]) {
    const fila = document.createElement('label');
    fila.className = 'campo-prop';
    const t = document.createElement('span');
    t.textContent = rotulo;
    fila.append(t);
    let control;
    if (clase === 'num') {
      control = document.createElement('input');
      control.type = 'number'; control.min = opciones[0]; control.max = opciones[1]; control.value = el.datos[i] ?? opciones[0];
      control.addEventListener('input', () => { const v = Math.max(opciones[0], Math.min(opciones[1], Number(control.value) || 0)); el.datos[i] = v; pintar(); });
    } else if (clase === 'sel' || clase === 'selv') {
      control = document.createElement('select');
      (clase === 'sel' ? opciones.map((o, k) => [k, o]) : opciones).forEach(([v, o]) => { const op = document.createElement('option'); op.value = v; op.textContent = o; control.append(op); });
      control.value = el.datos[i] ?? 0;
      control.addEventListener('change', () => { el.datos[i] = Number(control.value); pintar(); });
    } else if (clase === 'texto') {
      control = document.createElement('input');
      control.type = 'text'; control.maxLength = 32;
      control.value = new TextDecoder().decode(Uint8Array.from(el.datos.slice(7, 7 + el.datos[6])));
      control.addEventListener('input', () => {
        let b = utf8(control.value);
        while (b.length > 32) { control.value = control.value.slice(0, -1); b = utf8(control.value); }
        el.datos = [...el.datos.slice(0, 6), b.length, ...b];
        pintar();
      });
    } else if (clase === 'fecha') {
      control = document.createElement('input');
      control.type = 'date';
      const a = el.datos[6] | (el.datos[7] << 8);
      control.value = `${a}-${String(el.datos[8]).padStart(2, '0')}-${String(el.datos[9]).padStart(2, '0')}`;
      control.addEventListener('change', () => {
        const [y, m, d] = control.value.split('-').map(Number);
        if (!y) return;
        el.datos[6] = y & 255; el.datos[7] = y >> 8; el.datos[8] = m; el.datos[9] = d;
        pintar();
      });
    }
    control.id = `prop-${i}`;
    fila.append(control);
    caja.append(fila);
  }
}

function refrescar() { listaElementos(); propiedades(); pintar(); }

// ---- Elementos: añadir, mover, borrar ----
function llenarAnadir() {
  const s = $('nuevoTipo');
  // El clima se quitó (2026-11-25, fuente de datos solo para uso no comercial): no se ofrece para añadir. Una cara vieja que lo traiga se abre igual.
  for (const t of Object.values(TIPO)) { if (t === TIPO.CLIMA) continue; const o = document.createElement('option'); o.value = t; o.textContent = NOMBRES[t]; s.append(o); }
}
$('botonAnadir').addEventListener('click', () => {
  if (elementos.length >= 24) { aviso('Una cara tiene como máximo 24 elementos.', true); return; }
  elementos.push(nuevoElemento(Number($('nuevoTipo').value)));
  elegido = elementos.length - 1;
  refrescar();
});
$('botonSubir').addEventListener('click', () => { if (elegido > 0) { [elementos[elegido - 1], elementos[elegido]] = [elementos[elegido], elementos[elegido - 1]]; elegido--; refrescar(); } });
$('botonBajar').addEventListener('click', () => { if (elegido >= 0 && elegido < elementos.length - 1) { [elementos[elegido + 1], elementos[elegido]] = [elementos[elegido], elementos[elegido + 1]]; elegido++; refrescar(); } });
$('botonDuplicar').addEventListener('click', () => { if (elegido >= 0 && elementos.length < 24) { elementos.splice(elegido + 1, 0, { tipo: elementos[elegido].tipo, datos: elementos[elegido].datos.slice() }); elegido++; refrescar(); } });
$('botonQuitar').addEventListener('click', () => { if (elegido >= 0) { elementos.splice(elegido, 1); elegido = Math.min(elegido, elementos.length - 1); refrescar(); } });

// Arrastrar sobre la vista previa mueve el elemento elegido (su punto x, y).
(() => {
  const c = $('vista');
  let arrastrando = false, dx = 0, dy = 0;
  const punto = (ev) => { const r = c.getBoundingClientRect(); return [Math.floor(((ev.clientX - r.left) / r.width) * 128), Math.floor(((ev.clientY - r.top) / r.height) * 64)]; };
  c.addEventListener('pointerdown', (ev) => {
    const el = elementos[elegido];
    if (!el) return;
    const [px, py] = punto(ev);
    dx = el.datos[0] - px; dy = el.datos[1] - py;
    arrastrando = true;
    c.setPointerCapture(ev.pointerId);
  });
  c.addEventListener('pointermove', (ev) => {
    if (!arrastrando) return;
    const el = elementos[elegido];
    const [px, py] = punto(ev);
    el.datos[0] = Math.max(0, Math.min(127, px + dx));
    el.datos[1] = Math.max(0, Math.min(63, py + dy));
    pintar();
  });
  const soltar = () => { if (arrastrando) { arrastrando = false; propiedades(); } };
  c.addEventListener('pointerup', soltar);
  c.addEventListener('pointercancel', soltar);
})();

// ---- Fondo ----
$('archivoFondo').addEventListener('change', async () => {
  const f = $('archivoFondo').files[0];
  $('archivoFondo').value = '';
  if (!f) return;
  const url = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(f); });
  const res = await procesarImagenDesdeDataURL(url, 128, 64, Number($('umbralFondo').value) || 127, true);
  fondo = Uint8Array.from(atob(res.imagenData), (ch) => ch.charCodeAt(0));
  $('botonQuitarFondo').hidden = false;
  pintar();
});
$('botonQuitarFondo').addEventListener('click', () => { fondo = null; $('botonQuitarFondo').hidden = true; pintar(); });

// ---- Muestra (cómo se vería en cada TV) ----
for (const [id, k, v] of [['muestraPro', 'tv', 'pro'], ['muestraLite', 'tv', 'lite']]) {
  $(id).addEventListener('click', () => { muestra[k] = v; $('muestraPro').setAttribute('aria-pressed', String(v === 'pro')); $('muestraLite').setAttribute('aria-pressed', String(v === 'lite')); pintar(); });
}
for (const [id, k] of [['muestraMensaje', 'mensaje'], ['muestraAlarma', 'alarma']]) {
  $(id).addEventListener('click', () => { muestra[k] = !muestra[k]; $(id).setAttribute('aria-pressed', String(muestra[k])); pintar(); });
}

// ---- Catálogo ----
function aviso(texto, mal = false) { const a = $('aviso'); a.textContent = texto; a.classList.toggle('mal', mal); }

async function cargarCatalogo() {
  catalogo = (await unificadaListarCaras().catch(() => null)) || [];
  const ul = $('catalogo');
  ul.textContent = '';
  for (const c of catalogo) {
    const li = document.createElement('li');
    li.className = 'fila-cara' + (c.clave === clave ? ' elegido' : '');
    const n = document.createElement('span'); n.textContent = `${c.orden}. ${c.nombre}`;
    const abrir = document.createElement('button'); abrir.type = 'button'; abrir.textContent = 'Editar'; abrir.className = 'chico';
    abrir.addEventListener('click', () => editarCara(c));
    const borrar = document.createElement('button'); borrar.type = 'button'; borrar.textContent = 'Borrar'; borrar.className = 'chico peligro';
    borrar.addEventListener('click', () => borrarCara(c));
    li.append(n, abrir, borrar);
    ul.append(li);
  }
  $('sinCaras').hidden = catalogo.length > 0;
}

async function editarCara(c) {
  const r = await unificadaLeerCara(c.clave);
  const l = r && leerReceta(r);
  if (!l) { aviso('No se pudo leer esa cara.', true); return; }
  fondo = l.fondo ? Uint8Array.from(l.fondo) : null;
  elementos = l.elementos.map((e) => ({ tipo: e.tipo, datos: Array.from(e.d) }));
  elegido = elementos.length ? 0 : -1;
  clave = c.clave;
  $('nombreCara').value = c.nombre;
  $('ordenCara').value = c.orden;
  $('botonQuitarFondo').hidden = !fondo;
  aviso(`Editando "${c.nombre}".`);
  refrescar();
  cargarCatalogo();
}

async function borrarCara(c) {
  if (!$('confirmarBorrar').checked) { aviso('Para borrar, marca primero "Sí, quiero borrar".', true); return; }
  const r = await unificadaBorrarCaraCatalogo(c.clave);
  $('confirmarBorrar').checked = false;
  aviso(r.exito ? `Borrada "${c.nombre}". Los Pepitos que ya la tienen la conservan.` : r.error, !r.exito);
  if (c.clave === clave) clave = '';
  cargarCatalogo();
}

$('botonNueva').addEventListener('click', () => {
  elementos = [nuevoElemento(TIPO.ESTADO), nuevoElemento(TIPO.AMPM), nuevoElemento(TIPO.HORA), nuevoElemento(TIPO.FECHA)];
  fondo = null; elegido = 2; clave = ''; $('nombreCara').value = ''; $('ordenCara').value = (catalogo.length + 1);
  $('botonQuitarFondo').hidden = true;
  aviso('Cara nueva.');
  refrescar();
  cargarCatalogo();
});

$('botonGuardar').addEventListener('click', async () => {
  const nombre = $('nombreCara').value.trim();
  const r = receta();
  if (!nombre || nombre.length > 30) { aviso('Ponle un nombre de 1 a 30 letras.', true); return; }
  if (r.length > MAX_BYTES) { aviso('La cara pasa de 2048 bytes: quita elementos o el fondo.', true); return; }
  if (!clave) clave = 'cara-' + Date.now().toString(36);
  const res = await unificadaGuardarCaraCatalogo(clave, nombre, Number($('ordenCara').value) || 1, r);
  aviso(res.exito ? `Guardada "${nombre}": ya la ven todos los Pepitos.` : res.error, !res.exito);
  cargarCatalogo();
});

$('botonProbar').addEventListener('click', async () => {
  const lista = sesionUid ? await listarMisDispositivos(sesionUid) : null;
  const id = lista && lista.exito ? lista.dispositivos.find((d) => !String(d).startsWith('lite:')) : null;
  if (!id) { aviso('No encontré un Pepito Pro en tu cuenta para probar.', true); return; }
  usarCuenta(sesionUid, id);
  aviso('Enviando a tu Pepito…');
  const r = await unificadaElegirCara('prueba', receta());
  aviso(r.exito ? 'Listo: mira tu Pepito (está en el reloj).' : (r.error || 'No se pudo enviar.'), !r.exito);
});

// ---- Sesión ----
$('formEntrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await iniciarSesion($('correo').value.trim(), $('clave').value);
  if (!r || !r.exito) $('errorEntrar').textContent = (r && r.error) || 'No se pudo entrar.';
});

escucharSesion(async (usuario) => {
  sesionUid = usuario ? usuario.uid : null;
  $('pantallaEntrar').hidden = !!usuario;
  $('editor').hidden = true;
  $('noAdmin').hidden = true;
  if (!usuario) return;
  usarCuenta(usuario.uid, ''); // esAdministrador mira la cuenta en uso
  if (!(await esAdministrador())) { $('noAdmin').hidden = false; return; }
  $('editor').hidden = false;
  await cargarCatalogo();
});

llenarAnadir();
$('botonNueva').click();
setInterval(pintar, 30000); // la hora de la vista previa avanza
