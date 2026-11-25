// Ronda de textos de Pepito Pro (2026-11-25): lo que el dueño corrigió en las listas (revision-textos-pro*.xlsx, fuera del repo),
// puesto EXACTO (solo se corrigió la ortografía). construir.mjs aplica esta tabla sobre la COPIA de la Pro, DESPUÉS de la de
// textos-pepito.mjs (parte de los textos ya con "Pepito"). La app vieja TV RETRO no se toca.
//
// Mismo formato que textos-pepito.mjs: [archivo de www, texto de hoy, texto nuevo, veces que tiene que aparecer]. Si un texto no
// aparece las veces esperadas, la compilación FALLA.
//
// Decisiones del dueño en esta ronda:
//   - Todo texto empieza con mayúscula. Los motivos que van después de dos puntos ("No se pudo guardar: sin permiso") van en
//     minúscula, como pide la ortografía.
//   - "La conexión está lenta: se X solo cuando vuelva la señal." pasa a "Conexión lenta: se X cuando vuelva la señal." en todas.
//   - Un espacio antes de cada emoji.
//   - Si la Pro y la Lite dicen algo distinto (internet / Bluetooth), la corrección cambia SOLO el de la Pro: el de la Lite se
//     queda y va a la lista de la Lite (conLite).
function conLite(lite, pro) {
  return `(document.body.classList.contains('tv-lite') ? '${lite}' : ${pro})`;
}

export const TEXTOS_REVISION = [
  // ---- Texto ----
  ['index.html', '<span class="modo-nombre">Ajustar</span>', '<span class="modo-nombre">Estático</span>', 1],

  // ---- Imagen (y lo mismo en Galería > Añadir) ----
  ['js/main.js', "marcarEstado('Procesando imagen…'", "marcarEstado('Cargando imagen…'", 2],
  ['js/galeria.js', "marcarEstado('Procesando imagen…'", "marcarEstado('Cargando imagen…'", 1],
  ['js/main.js', "marcarEstado('Leyendo GIF…'", "marcarEstado('Cargando GIF…'", 1],
  ['js/galeria.js', "marcarEstado('Leyendo GIF…'", "marcarEstado('Cargando GIF…'", 1],
  ['js/main.js', "marcarEstado('Imagen lista', 'ok', elementos);", "marcarEstado('Listo 👌', 'ok', elementos);", 1],
  ['js/main.js', "      'GIF listo',", "      'Listo 👌',", 1],
  ['js/gif-pro.js', "'Ese archivo es demasiado grande (máximo ' + Math.round(LIMITE_ARCHIVO_BYTES / (1024 * 1024)) + ' MB). Prueba con uno más pequeño.'", "'Archivo muy pesado, prueba con uno más liviano'", 1],
  ['js/imageProcessor.js', "'Esa imagen es demasiado grande en píxeles (máximo ' + LIMITE_LADO_IMAGEN + ' por lado). Prueba con una más pequeña.'", "'Esa imagen es demasiado grande. Prueba con una más pequeña.'", 1],
  ['js/gif-pro.js', "'Ese GIF es demasiado grande en píxeles (máximo ' + LIMITE_GIF_LADO + ' por lado). Prueba con uno más pequeño.'", "'Ese GIF es demasiado grande. Prueba con uno más pequeño.'", 1],
  ['js/gif-pro.js', "'Ese GIF tiene demasiados cuadros (máximo ' + LIMITE_GIF_CUADROS + '). Prueba con uno más corto.'", "'Ese GIF es demasiado largo. Prueba con uno más corto.'", 1],
  ['js/main.js', "'No se pudo leer ese archivo como imagen. Prueba con un PNG, JPG o GIF.'", "'Archivo no admitido'", 1],
  // Aviso del peso del GIF (gif-pro.js; el de la unificada, js/gif.js, se cambió en src/gif-unificado.js)
  ['js/gif-pro.js', "'GIF pesado: tardará un poco más de lo normal en llegar'", "'GIF pesado, tardará un poco en llegar'", 2],
  ['js/gif-pro.js', "'GIF muy pesado, puede tardar en llegar'", "'GIF muy pesado, tardará en llegar'", 2],
  // Pegar
  ['js/main.js', "'El portapapeles no tiene una imagen. Copia una imagen y vuelve a tocar Pegar.'", "'El portapapeles no tiene imagen. Copia una imagen y vuelve a intentarlo'", 2],
  ['js/main.js', "'No se pudo leer el portapapeles. Elige el archivo.'", "'No se pudo leer el portapapeles. Elige archivo.'", 1],
  ['js/main.js', "'Este navegador no deja leer imágenes del portapapeles. Prueba Ctrl+V o elige el archivo.'", "'Este navegador no deja leer imágenes del portapapeles.'", 1],
  ['js/main.js', "'Sin permiso para leer el portapapeles. Permítelo en el navegador, o usa Ctrl+V o elige el archivo.'", "'Sin permiso para leer el portapapeles. Permíteselo'", 1],
  ['js/main.js', "'No se pudo leer el portapapeles. Prueba Ctrl+V o elige el archivo.'", "'No se pudo leer el portapapeles'", 1],
  // Guardar (Imagen, Dibujo y Galería: el mismo texto en los tres)
  ['js/main.js', "'Pon un nombre para guardarlo.'", "'Ponle un nombre para guardarlo.'", 3],
  ['js/galeria.js', "'Pon un nombre para guardarlo.'", "'Ponle un nombre para guardarlo.'", 2],
  // "No se pudo guardar: (motivo)." con punto final (si el motivo ya trae uno, no se repite).
  ['js/main.js', "'No se pudo guardar: ' + describirError(resultadoGif.error),", "('No se pudo guardar: ' + describirError(resultadoGif.error)).replace(/([^.!?…])$/, '$1.'),", 1],
  ['js/main.js', "'No se pudo guardar: ' + describirError(resultado.error),", "('No se pudo guardar: ' + describirError(resultado.error)).replace(/([^.!?…])$/, '$1.'),", 2],
  ['js/galeria.js', "'No se pudo guardar: ' + describirError(resultadoGif.error),", "('No se pudo guardar: ' + describirError(resultadoGif.error)).replace(/([^.!?…])$/, '$1.'),", 1],
  ['js/galeria.js', "'No se pudo guardar: ' + describirError(resultado.error),", "('No se pudo guardar: ' + describirError(resultado.error)).replace(/([^.!?…])$/, '$1.'),", 1],
  // Conexión lenta (todas iguales)
  ['js/utilidades.js', "'La conexión está lenta: se guardará solo cuando vuelva la señal.'", "'Conexión lenta: se guardará cuando vuelva la señal.'", 1],
  ['js/utilidades.js', "'La conexión está lenta: se borrará solo cuando vuelva la señal.'", "'Conexión lenta: se borrará cuando vuelva la señal.'", 1],
  ['js/canciones.js', "'La conexión está lenta: se importará solo cuando vuelva la señal.'", "'Conexión lenta: se importará cuando vuelva la señal.'", 1],
  ['js/main.js', "'La conexión está lenta: se enviará solo cuando vuelva la señal.'", "'Conexión lenta: se enviará cuando vuelva la señal.'", 1],
  ['js/main.js', "'La conexión está lenta: todavía no se pudo leer lo que muestra Pepito.'", "'Conexión lenta: todavía no se pudo leer lo que muestra Pepito.'", 1],
  ['js/mas.js', "'La conexión está lenta: la orden saldrá cuando vuelva la señal.'", "'Conexión lenta: se realizará cuando vuelva la señal.'", 1],

  // ---- Dibujo ----
  ['index.html', '<p class="aviso-girar">Gira el teléfono para dibujar más grande</p>', '<p class="aviso-girar">Gira el teléfono para dibujar con más espacio</p>', 1],

  // ---- Canciones ----
  ['js/canciones.js', "? '-- Selecciona --' : 'Importa con +';", "? 'Selecciónala' : 'No hay canciones';", 1],
  ['js/canciones.js', "return `${nombreMusical(clave)} · ${min}:${s}${fin}`;", "return `${nombreMusical(clave)} · Duración: ${min}:${s}${fin}`;", 1],
  ['js/canciones.js', "'No se encontró la canción en la galería.'", "'No se encontró la canción en la lista'", 1],
  ['js/canciones.js', "'No se pudo leer la lista de canciones: sin conexión o sin permiso.'", "'No se pudo leer la lista de canciones: no tienes conexión posiblemente'", 1],

  // ---- Más ----
  ['index.html', '<span class="nombre-mas">Config</span>', '<span class="nombre-mas">Configuración</span>', 1],
  ['js/mas.js', "lista: 'Config',", "lista: 'Configuración',", 1],

  // ---- Galería ----
  ['index.html', 'aria-selected="false">Animaciones</button>', 'aria-selected="false">Caras</button>', 1],
  ['js/galeria.js', "marcarEstado('Imagen cargada', 'ok', E());", "marcarEstado('Lista para enviar 👌', 'ok', E());", 1],
  ['js/galeria.js', "marcarEstado(`${queEs} ${queEs === 'GIF' ? 'cargado' : 'cargada'}`, 'ok', E());", "marcarEstado(queEs === 'GIF' ? 'Listo para enviar 👌' : 'Lista para enviar 👌', 'ok', E());", 1],
  ['js/galeria.js', "p.textContent = `${mensaje}: sin conexión o sin permiso.`;", "p.textContent = `${mensaje}, no hay conexión`;", 1],
  ['js/galeria.js', "'No se pudo leer la galería de imágenes')", "'No se pudo cargar la galería de imágenes')", 1],
  ['js/galeria.js', "'No se pudieron leer las animaciones')", "'No se pudieron cargar las caras ni los GIF')", 1],
  // La pestaña "Animaciones" pasa a "Caras" (dueño, 2026-11-25): sus mensajes dicen "cara". Los GIF también son animaciones
  // guardadas (mismos mensajes): con un GIF dicen "GIF".
  ['index.html', '<p class="galeria-vacio" id="animacionesVacio">Todavía no hay animaciones guardadas.</p>', '<p class="galeria-vacio" id="animacionesVacio">Todavía no hay caras guardadas.</p>', 1],
  ['js/galeria.js', "ponerVacio(gridAnim, 'Todavía no hay animaciones guardadas.');", "ponerVacio(gridAnim, 'Todavía no hay caras guardadas.');", 1],
  ['index.html', 'aria-label="Borrar la animación seleccionada"', 'aria-label="Borrar la cara o el GIF seleccionado"', 1],
  ['js/galeria.js', "marcarEstado('No se pudo cargar esa animación. Revisa tu internet y vuelve a intentarlo.', 'error', E());", "marcarEstado(esAnimacionDeGif(entry) ? 'No se pudo cargar ese GIF. Revisa tu internet y vuelve a intentarlo.' : 'No se pudo cargar esa cara. Revisa tu internet y vuelve a intentarlo.', 'error', E());", 1],
  ['js/galeria.js', "const predeterminada = !!(animacionesCatalogo[key] && animacionesCatalogo[key].predeterminada);", "const predeterminada = !!(animacionesCatalogo[key] && animacionesCatalogo[key].predeterminada); const esGifBorrado = esAnimacionDeGif(animacionesCatalogo[key]);", 1],
  ['js/galeria.js', "marcarEstado('Animación borrada', 'ok', E());", "marcarEstado(esGifBorrado ? 'GIF borrado' : 'Cara borrada', 'ok', E());", 1],
  ['js/galeria.js', "marcarEstado('No se pudo borrar la animación: ' + describirError(resultado.error), 'error', E());", "marcarEstado((esGifBorrado ? 'No se pudo borrar el GIF: ' : 'No se pudo borrar la cara: ') + describirError(resultado.error), 'error', E());", 1],
  ['js/main.js', "marcarEstado('Esta animación no se pudo cargar. Elígela otra vez en la Galería.', 'error', elementos);", "marcarEstado(animacionEsGif(estadoActual.animacion) ? 'Este GIF no se pudo cargar. Elígelo otra vez en la Galería.' : 'Esta cara no se pudo cargar. Elígela otra vez en la Galería.', 'error', elementos);", 1],

  // ---- Alarma (con un Pepito Lite queda su texto de hoy: va a la lista de la Lite) ----
  ['js/mas.js', "'No se pudo leer la alarma de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", conLite('No se pudo cargar la alarma de Pepito. Revisa tu Bluetooth y vuelve a intentarlo.',"'No se pudo cargar la alarma de Pepito. Revisa tu internet y vuelve a intentarlo'"), 1],
  ['js/mas.js', "'Alarma guardada ✅ Ya va camino a Pepito.'", "'Alarma guardada ✅'", 1],

  // ---- Ajustes de Pepito (ídem con la Lite) ----
  ['js/mas.js', "opt.textContent = `UTC${ajustesDatos.zona >= 0 ? '+' : '−'}${horas}${minutos ? ':' + String(minutos).padStart(2, '0') : ''}`;", "opt.textContent = 'Otra zona horaria';", 1],
  ['js/mas.js', "'No se pudieron leer los ajustes de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", conLite('No se pudieron cargar los ajustes de Pepito. Revisa tu Bluetooth y vuelve a intentarlo.',"'No se pudieron cargar los ajustes de Pepito. Revisa tu internet y vuelve a intentarlo'"), 1],
  ['js/mas.js', "'Ajustes guardados ✅ Ya van camino a Pepito.'", "'Ajustes guardados ✅'", 1],

  // ---- Sistema (el texto de la Lite, en conLite, no se toca) ----
  ['js/mas.js', "'Pepito está al día ✅'", "'Pepito está al día 💅'", 1],
  ['js/mas.js', "'Hay una versión nueva para Pepito.'", "'Hay una versión nueva para Pepito ✨'", 1],
  ['js/mas.js', "'Actualizando… no desconectes a Pepito.'", "'Actualizando… no apagues a Pepito 🙏.'", 2],
  ['js/mas.js', "'No se pudo leer el estado de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", "'No se pudo leer el estado de Pepito. Revisa tu internet y vuelve a intentarlo.'", 1],
  ['js/mas.js', "'Pepito se restableció, pero no se pudo soltar de tu cuenta: '", "'Pepito se restableció, pero aún está ligado a tu cuenta: '", 1],

  // ---- Comunes ----
  ['index.html', '<h1 class="marca">Pepito</h1>', '<h1 class="marca">PEPITO</h1>', 1],
  ['js/main.js', "marcarConexion('conectando…'", "marcarConexion('Conectando…'", 1],
  ['js/main.js', "marcarConexion('sin conexión'", "marcarConexion('Sin conexión'", 2],
  ['js/conexion.js', "marcarConexion('en línea'", "marcarConexion('En línea'", 1],
  ['js/conexion.js', "marcarConexion('desconectado'", "marcarConexion('Desconectado'", 2],
  // Hasta 60 segundos no se cuentan los segundos: "Hace segundos" (pedido del dueño). Desde los 61, "Hace 1 min".
  ['js/conexion.js', "if (seg < 60) return `hace ${seg} s`;", "if (seg <= 60) return 'Hace segundos';", 1],
  ['js/conexion.js', "return `hace ${min} min`;", "return `Hace ${min} min`;", 1],
  ['js/conexion.js', "return `hace ${horas} h`;", "return `Hace ${horas} h`;", 1],
  ['js/conexion.js', "return `el ${dd}/${mm} ${hh}:${mi}`;", "return `El ${dd}/${mm} ${hh}:${mi}`;", 1],
  ['js/main.js', "return 'Enviado ✅ Ya va camino a Pepito.';", "return 'Llegando a Pepito…';", 1],
  ['js/conexion.js', "marcarEstado('En Pepito ✅'", "marcarEstado('Llegó ✅'", 1],
  // Motivos (van después de dos puntos: en minúscula)
  ['js/firebase-pro.js', "return 'sin permiso';", "return 'no tienes permitido eso';", 1],
  ['js/firebase-pro.js', "error: 'sin permiso' }", "error: 'no tienes permitido eso' }", 2],
  ['js/firebase-pro.js', "return texto || 'error desconocido';", "return texto || 'falla desconocida';", 1],
  ['js/firebase-pro.js', "throw new Error('no se pudo reservar el número de envío');", "throw new Error('vuelve a intentarlo');", 1],
  ['js/firebase-pro.js', "`llegaste al límite de ${limite} GIF (animaciones) guardados; borra alguno para guardar otro`", "`llegaste al límite de ${limite} GIF guardados; borra alguno para poder guardar otro`", 1],
  ['js/firebase-pro.js', "`llegaste al límite de ${limite} elementos guardados (imágenes y GIF juntos); borra alguno para guardar otro`", "`llegaste al límite de ${limite} elementos guardados (imágenes + GIF); borra alguno para poder guardar otro`", 1],

  // ---- Tutorial (el paso de Más de la Lite es otro texto: va a la lista de la Lite) ----
  ['js/tutorial.js', "texto: 'Dibuja con el dedo.'", "texto: 'Dibuja lo que quieras.'", 1],
  ['js/tutorial.js', "texto: 'Elige una canción para Pepito.'", "texto: 'Elige Canciones para Pepito.'", 1],
  ['js/tutorial.js', "texto: 'Aquí están tu galería, los juegos, la alarma y los ajustes.'", "texto: 'Aquí están tu galería, los juegos, la alarma y las demás funciones, también los ajustes.'", 1],
];

// ---- Pepito Lite (lista de la Lite, 2026-11-25; los de arriba con conLite ya llevan el texto nuevo de la Lite) ----
TEXTOS_REVISION.push(
  // Bluetooth (app-lite/src/ble.js, ya empaquetado y con "Pepito": esbuild deja comillas dobles)
  ['js/lite-tv.js', '"Pepito no reconoce este celular. Olvídalo en Ajustes > Bluetooth del celular, mantén pulsado el botón de Pepito 8 segundos y vuelve a intentarlo."', '"Pepito no reconoce tu celular. Bórralo de la lista de Bluetooth del celular y mantén pulsado el botón de Pepito 8 segundos."', 1],
  // Sistema: el mismo texto que al no poder conectar en un envío
  ['js/mas.js', "'No se pudo conectar con Pepito. Acércate y vuelve a abrir esta pantalla.'", "'No se pudo conectar con Pepito. Acércate y vuelve a intentarlo.'", 1],
);
