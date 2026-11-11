/**ui
 * UI Controller
 * Maneja los eventos de la interfaz de usuario y actualización de controles
 */

/**
 * Actualiza los controles con los valores del estado actual
 */
export function poblarControles(estado, elementos) {
  // Para Texto
  if (elementos.texto) {
    elementos.texto.value = estado.texto || '';
    elementos.contador.textContent = String((estado.texto || '').length);
  }
  
  if (elementos.invertido) {
    elementos.invertido.checked = !!estado.invertido;
  }
  
  if (elementos.grupoTamano) {
    marcarSegmentoActivo(elementos.grupoTamano, estado.tamano);
  }

  if (elementos.fuenteTexto) {
    elementos.fuenteTexto.value = estado.fuente || 'clasica';
    // Valor desconocido (ej. una fuente que este panel no tiene): clásica.
    if (!elementos.fuenteTexto.value) elementos.fuenteTexto.value = 'clasica';
  }
  
  if (elementos.grupoAlineacion) {
    marcarSegmentoActivo(elementos.grupoAlineacion, estado.alineacion);
  }

  if (elementos.grupoAlineacionV) {
    marcarSegmentoActivo(elementos.grupoAlineacionV, estado.alineacionV || 'centro');
  }

  marcarModoPosicion(!!estado.manual, elementos);
  
  if (elementos.grupoModo) {
    // Scroll vertical se muestra como el radio "scrollv" (en los datos es
    // modoTexto "scroll" + direccion "v").
    const valorUi = (estado.modoTexto === 'scroll' && estado.direccion === 'v') ? 'scrollv' : estado.modoTexto;
    elementos.grupoModo.querySelectorAll('input[name="modoTexto"]').forEach(r => {
      r.checked = (r.value === valorUi);
    });
  }
  
  // Repeticiones de la canción (antes siempre mostraba 1 al abrir el panel).
  if (elementos.inputRepeticiones) {
    elementos.inputRepeticiones.value = String(estado.cancionRepeticiones || 1);
  }

  // Marcar tipo de contenido
  if (elementos.grupoTipo) {
    marcarSegmentoActivo(elementos.grupoTipo, estado.tipo || 'texto');
  }
}

/**
 * Posición del texto: marca Auto/Manual y muestra los íconos de
 * alineación (auto) o los sliders X/Y (manual), en el mismo lugar.
 */
export function marcarModoPosicion(manual, elementos) {
  if (elementos.grupoPosicion) marcarSegmentoActivo(elementos.grupoPosicion, manual ? 'manual' : 'auto');
  if (elementos.filaAlineacionAuto) elementos.filaAlineacionAuto.hidden = !!manual;
  if (elementos.filaAlineacionManual) elementos.filaAlineacionManual.hidden = !manual;
}

/**
 * Marca el botón activo en un grupo de segmentos
 */
export function marcarSegmentoActivo(grupo, valor) {
  grupo.querySelectorAll('button').forEach(b => {
    b.classList.toggle('activo', b.dataset.valor === String(valor));
  });
}

/**
 * Marca la pestaña activa de la navegación para lectores de pantalla
 * (aria-current="page"); el resto queda sin el atributo.
 */
export function marcarPestanaActual(grupo, valor) {
  if (!grupo) return;
  grupo.querySelectorAll('button').forEach(b => {
    if (b.dataset.valor === String(valor)) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

/**
 * Galería: muestra solo los elementos de la subvista elegida
 * ("imagenes" o "animaciones"), marcados con data-subvista, y marca el
 * botón activo del selector. Los botones del selector también llevan
 * data-subvista, pero esos no se ocultan.
 */
export function mostrarSubvistaGaleria(subvista, elementos) {
  const selector = elementos.grupoSubvistaGaleria;
  if (selector) {
    selector.querySelectorAll('button[data-subvista]').forEach(b => {
      const activo = b.dataset.subvista === subvista;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
  }
  [elementos.seccionGaleria, elementos.seccionGaleriaFinal].forEach(cont => {
    if (!cont) return;
    cont.querySelectorAll('[data-subvista]').forEach(el => {
      if (selector && selector.contains(el)) return;
      // data-subvista puede listar varias, separadas por espacio
      // (ej. el tacho de animaciones sirve también para los GIF).
      el.hidden = !el.dataset.subvista.split(/\s+/).includes(subvista);
    });
  });
}

/**
 * Muestra un mensaje de estado en la pantalla
 */
export function marcarEstado(texto, tipo, elementos) {
  elementos.estadoTexto.textContent = texto;
  elementos.estadoLinea.classList.remove('ok', 'error');
  elementos.ledEstado.classList.remove('ok', 'error', 'conectado');
  
  if (tipo === 'ok') {
    elementos.estadoLinea.classList.add('ok');
    elementos.ledEstado.classList.add('conectado');
  } else if (tipo === 'error') {
    elementos.estadoLinea.classList.add('error');
    elementos.ledEstado.classList.add('error');
  }
}

/**
 * Muestra el estado de la conexión
 */
export function marcarConexion(texto, tipo, elementos) {
  elementos.textoConexion.textContent = texto;
  elementos.ledConexion.classList.remove('conectado', 'error');
  
  if (tipo === 'ok') {
    elementos.ledConexion.classList.add('conectado');
  } else if (tipo === 'error') {
    elementos.ledConexion.classList.add('error');
  }
}

/**
 * Muestra la última señal del dispositivo (ej. "hace 4 s") junto al
 * estado de conexión. Con texto vacío o null, la oculta.
 */
export function marcarUltimaVista(texto, elementos) {
  const el = elementos.ultimaActualizacion;
  if (!el) return;
  el.textContent = texto || '';
  el.hidden = !texto;
}

/**
 * Habilita/deshabilita el botón de envío
 */
export function setBotonEnviarEstado(habilitado, elementos) {
  elementos.botonEnviar.disabled = !habilitado;
}

/**
 * Activa la animación LED de transmisión
 */
export function activarLedTransmision(elementos) {
  elementos.ledEstado.classList.add('tx-activo');
}

/**
 * Desactiva la animación LED de transmisión
 */
export function desactivarLedTransmision(elementos, delay = 250) {
  setTimeout(() => {
    elementos.ledEstado.classList.remove('tx-activo');
  }, delay);
}

/**
 * Retorna todos los elementos del DOM en un objeto
 */
export function obtenerElementos() {
  return {
    // Selector de tipo
    grupoTipo: document.getElementById('grupoTipo'),
    seccionTexto: document.getElementById('seccionTexto'),
    seccionImagen: document.getElementById('seccionImagen'),
    seccionCancion: document.getElementById('seccionCancion'),
    seccionDibujo: document.getElementById('seccionDibujo'),
    seccionGaleria: document.getElementById('seccionGaleria'),
    seccionGaleriaFinal: document.getElementById('seccionGaleriaFinal'),
    
    // Texto y contador
    texto: document.getElementById('texto'),
    contador: document.getElementById('contador'),
    
    // Controles de formato
    grupoTamano: document.getElementById('grupoTamano'),
    fuenteTexto: document.getElementById('fuenteTexto'),
    grupoAlineacion: document.getElementById('grupoAlineacion'),
    grupoAlineacionV: document.getElementById('grupoAlineacionV'),

    // Posición: Auto (alineación) / Manual (sliders X/Y)
    grupoPosicion: document.getElementById('grupoPosicion'),
    filaAlineacionAuto: document.getElementById('filaAlineacionAuto'),
    filaAlineacionManual: document.getElementById('filaAlineacionManual'),
    posicionX: document.getElementById('posicionX'),
    posicionY: document.getElementById('posicionY'),
    valorPosicionX: document.getElementById('valorPosicionX'),
    valorPosicionY: document.getElementById('valorPosicionY'),
    grupoModo: document.getElementById('grupoModo'),
    invertido: document.getElementById('invertido'),
    filaInvertido: document.getElementById('filaInvertido'),
    
    // Controles de imagen
    cargadorImagen: document.getElementById('cargadorImagen'),
    botonPegarImagen: document.getElementById('botonPegarImagen'),
    umbral: document.getElementById('umbral'),
    valorUmbral: document.getElementById('valorUmbral'),
    dithering: document.getElementById('dithering'),

    // Guardar imagen actual (sección Imagen) en el catálogo
    nombreGaleria: document.getElementById('nombreGaleria'),
    botonGuardarGaleria: document.getElementById('botonGuardarGaleria'),
    avisoGaleria: document.getElementById('avisoGaleria'),

    // Sección Galería: catálogo completo, añadir nueva, reeditar, borrar
    cargadorImagenGaleria: document.getElementById('cargadorImagenGaleria'),
    nombreGaleriaNueva: document.getElementById('nombreGaleriaNueva'),
    botonGuardarGaleriaNueva: document.getElementById('botonGuardarGaleriaNueva'),
    avisoGaleriaNueva: document.getElementById('avisoGaleriaNueva'),
    ditheringGaleria: document.getElementById('ditheringGaleria'),
    umbralGaleria: document.getElementById('umbralGaleria'),
    valorUmbralGaleria: document.getElementById('valorUmbralGaleria'),
    gridGaleria: document.getElementById('gridGaleria'),
    galeriaVacio: document.getElementById('galeriaVacio'),
    botonBorrarGaleria: document.getElementById('botonBorrarGaleria'),
    grupoSubvistaGaleria: document.getElementById('grupoSubvistaGaleria'),
    gridGifs: document.getElementById('gridGifs'),

    // Pestaña Imagen: encuadre
    escalaImagen: document.getElementById('escalaImagen'),
    botonRotarImagen: document.getElementById('botonRotarImagen'),
    botonVoltearHImagen: document.getElementById('botonVoltearHImagen'),
    botonVoltearVImagen: document.getElementById('botonVoltearVImagen'),
    botonFondoImagen: document.getElementById('botonFondoImagen'),
    grupoAjustesGaleria: document.getElementById('grupoAjustesGaleria'),

    // Galería: Animaciones
    gridAnimaciones: document.getElementById('gridAnimaciones'),
    animacionesVacio: document.getElementById('animacionesVacio'),
    botonBorrarAnimacion: document.getElementById('botonBorrarAnimacion'),
    
    // Controles de canción
    seleccionCancion: document.getElementById('seleccionCancion'),
    inputRepeticiones: document.getElementById('inputRepeticiones'),
    avisoCancion: document.getElementById('avisoCancion'),
    cargadorMusical: document.getElementById('cargadorMusical'),
    botonBorrarMusical: document.getElementById('botonBorrarMusical'),
    grupoLetra: document.getElementById('grupoLetra'),

    // Controles de dibujo
    lienzoDibujo: document.getElementById('lienzoDibujo'),
    grupoGrosor: document.getElementById('grupoGrosor'),
    botonDeshacerDibujo: document.getElementById('botonDeshacerDibujo'),
    botonRehacerDibujo: document.getElementById('botonRehacerDibujo'),
    botonLimpiarDibujo: document.getElementById('botonLimpiarDibujo'),
    nombreGaleriaDibujo: document.getElementById('nombreGaleriaDibujo'),
    botonGuardarGaleriaDibujo: document.getElementById('botonGuardarGaleriaDibujo'),

    // Dibujo: lienzo expandido y zoom
    marcoDibujo: document.getElementById('marcoDibujo'),
    visorLienzo: document.getElementById('visorLienzo'),
    indicadorZoomDibujo: document.getElementById('indicadorZoomDibujo'),
    botonExpandirDibujo: document.getElementById('botonExpandirDibujo'),
    botonContraerDibujo: document.getElementById('botonContraerDibujo'),
    botonEnviarDibujoExpandido: document.getElementById('botonEnviarDibujoExpandido'),
    botonZoomMasDibujo: document.getElementById('botonZoomMasDibujo'),
    botonZoomMenosDibujo: document.getElementById('botonZoomMenosDibujo'),
    avisoGaleriaDibujo: document.getElementById('avisoGaleriaDibujo'),
    
    // Cuentas: pantalla de inicio de sesión
    pantallaLogin: document.getElementById('pantallaLogin'),
    formLogin: document.getElementById('formLogin'),
    loginSubtitulo: document.getElementById('loginSubtitulo'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginPassword2: document.getElementById('loginPassword2'),
    campoLoginConfirmar: document.getElementById('campoLoginConfirmar'),
    loginError: document.getElementById('loginError'),
    loginAviso: document.getElementById('loginAviso'),
    botonLogin: document.getElementById('botonLogin'),
    botonLoginOlvide: document.getElementById('botonLoginOlvide'),
    botonLoginModo: document.getElementById('botonLoginModo'),
    botonCerrarSesion: document.getElementById('botonCerrarSesion'),

    // Cuentas: pantalla Mi TV (vincular, elegir, desvincular)
    botonMiTV: document.getElementById('botonMiTV'),
    pantallaTV: document.getElementById('pantallaTV'),
    tvTitulo: document.getElementById('tvTitulo'),
    tvSubtitulo: document.getElementById('tvSubtitulo'),
    listaTV: document.getElementById('listaTV'),
    formTV: document.getElementById('formTV'),
    codigoTV: document.getElementById('codigoTV'),
    tvError: document.getElementById('tvError'),
    tvAviso: document.getElementById('tvAviso'),
    botonVincularTV: document.getElementById('botonVincularTV'),
    botonTVVolver: document.getElementById('botonTVVolver'),
    botonTVSalir: document.getElementById('botonTVSalir'),

    // Botón enviar
    botonEnviar: document.getElementById('enviar'),
    
    // LEDs y estado
    ledConexion: document.getElementById('ledConexion'),
    textoConexion: document.getElementById('textoConexion'),
    ultimaActualizacion: document.getElementById('ultimaActualizacion'),
    ledEstado: document.getElementById('ledEstado'),
    estadoLinea: document.getElementById('estadoLinea'),
    estadoTexto: document.getElementById('estadoTexto'),
    
    // Canvas OLED
    canvas: document.getElementById('oled')
  };
}
