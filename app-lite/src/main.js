// TV RETRO Lite: lógica de la app. El diseño es el de la app Pro (CSS copiado al armar); lo que cambia es
// la forma de enviar: en vez de Firebase, Bluetooth LE hacia la TV (ver ble.js). Las canciones vienen
// dentro de la app (canciones/) y la TV guarda en su memoria las que se usan (caché).
//
// Los textos de esta pantalla son una PROPUESTA (el dueño los revisa): sin datos técnicos, con "tú".

import { marcarEstado, marcarConexion } from '../../js/ui.js';
import { decodificarMusical } from '../../js/compresion.js';
import { dibujarPreviewImagen } from '../../js/imageProcessor.js';
import * as tv from './ble.js';

const $ = (id) => document.getElementById(id);
const elementos = {
  estadoLinea: $('estadoLinea'), estadoTexto: $('estadoTexto'), ledEstado: $('ledEstado'),
  textoConexion: $('textoConexion'), ledConexion: $('ledConexion'),
};
const el = {
  canvas: $('oled'), select: $('seleccionCancion'), grupoLetra: $('grupoLetra'), repeticiones: $('inputRepeticiones'),
  aviso: $('avisoCancion'), enviar: $('enviar'), grupoTipo: $('grupoTipo'),
  seccionCancion: $('seccionCancion'), seccionMas: $('seccionMas'),
  botonConectar: $('botonConectar'), botonDesconectar: $('botonDesconectar'), botonHora: $('botonHora'),
  botonEstado: $('botonEstado'), botonVelocidad: $('botonVelocidad'), botonVelocidad5: $('botonVelocidad5'),
  progreso: $('progresoDiagnostico'), registro: $('registro'),
};

let catalogo = [];          // [{ id, clave, nombre, archivo, bytes, duracion }]
let conLetra = true;
let ocupado = false;        // hay un envío en curso (a prueba de dobles toques)
let turnoVistaPrevia = 0;   // descarta vistas previas que llegan tarde

const nombreBonito = (c) => c.nombre.replace(/_+/g, ' ').trim();
const estado = (texto, tipo) => marcarEstado(texto, tipo, elementos);

// ---------- Vista previa de la pantalla ----------
function bytesABase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function pantallaNegra() {
  const ctx = el.canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 64);
}

async function cargarCancion(c) {
  const r = await fetch(`canciones/${c.archivo}`);
  if (!r.ok) throw new Error('No se pudo leer la canción.');
  return new Uint8Array(await r.arrayBuffer());
}

async function mostrarVistaPrevia(c) {
  const turno = ++turnoVistaPrevia;
  pantallaNegra();
  if (!c) return;
  try {
    const bytes = await cargarCancion(c);
    const grab = await decodificarMusical(bytesABase64(bytes));
    if (turno !== turnoVistaPrevia || !grab.cuadros.length) return;
    dibujarPreviewImagen(el.canvas, bytesABase64(grab.cuadros[0].bitmap), 128, 64, '#4dd2ff');
  } catch (e) {
    console.warn('[TV RETRO Lite] vista previa:', e);
  }
}

// ---------- Canciones ----------
function cancionElegida() {
  return catalogo.find((c) => String(c.id) === el.select.value) || null;
}

async function cargarCatalogo() {
  const r = await fetch('canciones/indice.json');
  catalogo = await r.json();
  el.select.textContent = '';
  for (const c of catalogo) {
    const o = document.createElement('option');
    o.value = String(c.id);
    o.textContent = nombreBonito(c);
    el.select.append(o);
  }
  mostrarVistaPrevia(cancionElegida());
}

function mensajeDeError(e) {
  if (e instanceof tv.ErrorTV) return e.message;
  console.error('[TV RETRO Lite]', e);
  return 'Algo salió mal. Vuelve a intentarlo.';
}

// Asegura que haya TV conectada: la última usada, o la lista de TV cercanas si no hay ninguna.
async function asegurarConexion() {
  if (tv.estaConectado()) return;
  estado('Conectando con la TV…');
  if (await tv.reconectar()) return;
  await tv.buscar();
}

async function enviarCancion() {
  if (ocupado) return;
  const c = cancionElegida();
  if (!c) { estado('Elige una canción.', 'error'); return; }
  ocupado = true;
  el.enviar.disabled = true;
  try {
    await asegurarConexion();
    await tv.exclusivo(async () => {
      const guardadas = await tv.listar();
      if (!guardadas.has(c.id)) {
        const datos = await cargarCancion(c);
        const r = await tv.enviarArchivo(datos, {
          id: c.id,
          alProgreso: (p) => estado(`Enviando… ${Math.round(p * 100)} %`),
        });
        if (!r.ok) throw new tv.ErrorTV('La canción no llegó bien. Vuelve a intentarlo.');
      }
      await tv.tocar(c.id, Math.max(1, parseInt(el.repeticiones.value, 10) || 1), conLetra);
    });
    estado('Sonando en la TV', 'ok');
  } catch (e) {
    estado(mensajeDeError(e), 'error');
  } finally {
    ocupado = false;
    el.enviar.disabled = false;
  }
}

// ---------- Más ----------
function cambiarPestana(valor) {
  const mas = valor === 'mas';
  el.seccionCancion.style.display = mas ? 'none' : '';
  el.seccionMas.style.display = mas ? '' : 'none';
  for (const b of el.grupoTipo.querySelectorAll('button')) b.classList.toggle('activo', b.dataset.valor === valor);
  document.querySelector('.barra-accion').style.display = mas ? 'none' : '';
}

function actualizarConexion(si) {
  marcarConexion(si ? 'Conectada' : 'Sin conexión', si ? 'ok' : null, elementos);
  el.botonDesconectar.disabled = !si;
  for (const b of [el.botonHora, el.botonEstado, el.botonVelocidad, el.botonVelocidad5]) b.disabled = !si;
}

async function accionMas(accion, textoOk) {
  if (ocupado) return;
  ocupado = true;
  try {
    await tv.exclusivo(accion);
    if (textoOk) estado(textoOk, 'ok');
  } catch (e) {
    estado(mensajeDeError(e), 'error');
  } finally { ocupado = false; }
}

// ---------- Diagnóstico (herramienta del dueño: medir la velocidad) ----------
function registrar(texto) {
  el.registro.textContent += `[${new Date().toLocaleTimeString()}] ${texto}\n`;
  el.registro.scrollTop = el.registro.scrollHeight;
}

async function medirVelocidad(veces) {
  const velocidades = [];
  for (let i = 1; i <= veces; i++) {
    const r = await tv.enviarArchivo(tv.datosDePrueba(102400), { alProgreso: (p) => { el.progreso.value = Math.round(p * 100); } });
    registrar(`#${i}: ${r.ok ? 'OK' : 'ERROR'} · 102400 bytes en ${Math.round(r.ms)} ms · ${r.kbs.toFixed(1)} KB/s · reenvíos ${r.reenvios}`);
    if (!r.ok) throw new tv.ErrorTV('El envío de prueba salió mal.');
    velocidades.push(r.kbs);
    await tv.pausa(300);
  }
  if (velocidades.length > 1) {
    registrar(`Promedio ${(velocidades.reduce((a, b) => a + b, 0) / velocidades.length).toFixed(1)} KB/s, la más lenta ${Math.min(...velocidades).toFixed(1)} KB/s.`);
  }
}

// ---------- Arranque ----------
el.select.addEventListener('change', () => mostrarVistaPrevia(cancionElegida()));
el.grupoLetra.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-valor]');
  if (!b) return;
  conLetra = b.dataset.valor === 'con';
  for (const x of el.grupoLetra.querySelectorAll('button')) x.classList.toggle('activo', x === b);
});
el.enviar.addEventListener('click', enviarCancion);
el.grupoTipo.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-valor]');
  if (b) cambiarPestana(b.dataset.valor);
});

el.botonConectar.addEventListener('click', async () => {
  if (ocupado) return;
  ocupado = true;
  try { await tv.buscar(); estado('TV conectada', 'ok'); } catch (e) { estado(mensajeDeError(e), 'error'); } finally { ocupado = false; }
});
el.botonDesconectar.addEventListener('click', () => tv.desconectar());
el.botonHora.addEventListener('click', () => accionMas(tv.ponerHora, 'Hora puesta en la TV'));
el.botonEstado.addEventListener('click', () => accionMas(async () => {
  const e = await tv.pedirEstado();
  registrar(`Estado de la TV: MTU ${e.mtu}, memoria libre ${e.memoria} bytes, celulares vinculados ${e.vinculos}.`);
}));
el.botonVelocidad.addEventListener('click', () => accionMas(() => medirVelocidad(1)));
el.botonVelocidad5.addEventListener('click', () => accionMas(() => medirVelocidad(5)));

tv.alCambiarConexion(actualizarConexion);
actualizarConexion(false);
cargarCatalogo().catch((e) => { console.error('[TV RETRO Lite]', e); estado('Algo salió mal. Vuelve a intentarlo.', 'error'); });
