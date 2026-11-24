// Nombre "Pepito" (decisión del dueño, 2026-11-23; propuesta completa en docs/nombre-pepito.md, aprobada el mismo día).
// construir.mjs aplica esta tabla sobre la COPIA de la Pro que arma la unificada (la Pro no se toca) y sobre js/lite-tv.js ya
// empaquetado (los textos de app-lite/src/ble.js, que comparte con la app Lite de respaldo). Solo textos que se VEN: nunca IDs,
// clases, claves del celular, rutas de Firebase ni nombres de funciones.
//
// Cada fila: [archivo de www, texto de hoy, texto con Pepito, veces que tiene que aparecer]. Si un texto de la Pro cambia o no
// aparece las veces esperadas, la compilación FALLA (no queda nada a medias). Al final construir.mjs revisa que no quede ningún
// "TV" a la vista (lo que quede, lo dice).
//
// Regla (docs/nombre-pepito.md): "la TV" -> "Pepito", sin artículo; en masculino ("Olvídalo", "encendido", "tuyo"); "Mis
// Pepitos", "Pepito 1"; "un Pepito Lite" / "un Pepito Pro".
// Con un Pepito Lite en uso, otro texto (el de la Pro queda como está para un Pepito Pro). "pro" va ya con sus comillas.
function conLite(lite, pro) {
  return `(document.body.classList.contains('tv-lite') ? '${lite}' : ${pro})`;
}

export const TEXTOS_PEPITO = [
  // ---- index.html ----
  ['index.html', '<title>TV RETRO · Panel de control</title>', '<title>Pepito · Panel de control</title>', 1],
  ['index.html', '<h1 class="marca">TV RETRO</h1>', '<h1 class="marca">Pepito</h1>', 1],
  ['index.html', '<h1 class="login-titulo">TV RETRO</h1>', '<h1 class="login-titulo">Pepito</h1>', 1],
  ['index.html', 'aria-label="Mi TV" title="Mi TV"', 'aria-label="Mi Pepito" title="Mi Pepito"', 1],
  ['index.html', 'aria-label="Enviar a la TV" title="Enviar a la TV"', 'aria-label="Enviar a Pepito" title="Enviar a Pepito"', 1],
  ['index.html', '<button id="enviar" type="button">Enviar a la TV</button>', '<button id="enviar" type="button">Enviar a Pepito</button>', 1],
  ['index.html', '<span class="nombre-mas">Ajustes de la TV</span>', '<span class="nombre-mas">Ajustes de Pepito</span>', 1],
  ['index.html', '<span class="nombre-mas">Mis TV</span>', '<span class="nombre-mas">Mis Pepitos</span>', 1],
  ['index.html', 'class="boton-primario">Actualizar la TV</button>', 'class="boton-primario">Actualizar a Pepito</button>', 1],
  ['index.html', 'class="boton-peligro">Restablecer la TV</button>', 'class="boton-peligro">Restablecer a Pepito</button>', 1],
  ['index.html', '?subject=TV%20RETRO', '?subject=Pepito', 1],
  ['index.html', 'id="tvTitulo">Añade tu TV</h1>', 'id="tvTitulo">Añade tu Pepito</h1>', 1],
  ['index.html', 'id="tvSubtitulo">Escribe el código que muestra la pantalla de tu TV.</p>', 'id="tvSubtitulo">Escribe el código que muestra la pantalla de Pepito.</p>', 1],
  ['index.html', 'Tu TV quedará sin dueño.', 'Tu Pepito quedará sin dueño.', 1],
  ['index.html', 'for="codigoTV">Código de la TV</label>', 'for="codigoTV">Código de Pepito</label>', 1],

  // ---- js/conexion.js ----
  ['js/conexion.js', "'En la TV ✅'", "'En Pepito ✅'", 1],
  ['js/conexion.js', "'La TV está sin conexión: lo mostrará cuando se conecte.'", "'Pepito está sin conexión: lo mostrará cuando se conecte.'", 1],

  // ---- js/cuentas.js ----
  ['js/cuentas.js', "'TV ' + (i + 1)", "'Pepito ' + (i + 1)", 1],
  ['js/cuentas.js', "'No se pudo cargar tus TV'", "'No se pudo cargar tus Pepitos'", 1],
  ['js/cuentas.js', "'Añade tu TV'", "'Añade tu Pepito'", 1],
  ['js/cuentas.js', "'Escribe el código que muestra la pantalla de tu TV.'", "'Escribe el código que muestra la pantalla de Pepito.'", 1],
  ['js/cuentas.js', "'Mis TV'", "'Mis Pepitos'", 1],
  ['js/cuentas.js', "'¿Desvincular la TV ' + numero + '? Dejará de ser tuya y perderán el acceso quienes la comparten.'", "'¿Desvincular a Pepito ' + numero + '? Dejará de ser tuyo y perderán el acceso quienes lo comparten.'", 1],
  ['js/cuentas.js', "'¿Salir de la TV '", "'¿Salir de Pepito '", 1],
  ['js/cuentas.js', "'¿Quitar a esta persona? Ya no podrá enviar contenido a tu TV.'", "'¿Quitar a esta persona? Ya no podrá enviar contenido a tu Pepito.'", 1],
  ['js/cuentas.js', "'Compartir TV '", "'Compartir Pepito '", 1],
  ['js/cuentas.js', "'La otra persona escribe este código en Mi TV.'", "'La otra persona escribe este código en Mi Pepito.'", 1],

  // ---- js/firebase-pro.js (el firebase.js de la Pro) ----
  ['js/firebase-pro.js', "'No se pudo leer tu lista de TV: '", "'No se pudo leer tu lista de Pepitos: '", 1],
  ['js/firebase-pro.js', "'Escribe los 6 caracteres del código que muestra tu TV.'", "'Escribe los 6 caracteres del código que muestra Pepito.'", 1],
  ['js/firebase-pro.js', "'Ese código no existe o ya venció. Revisa el código que muestra tu TV (se renueva solo).'", "'Ese código no existe o ya venció. Revisa el código que muestra Pepito (se renueva solo).'", 1],
  ['js/firebase-pro.js', "'No se pudo vincular: el código venció o esa TV ya tiene dueño. Pide uno nuevo en la TV.'", "'No se pudo vincular: el código venció o ese Pepito ya tiene dueño. Pide uno nuevo en Pepito.'", 1],
  ['js/firebase-pro.js', "'La TV quedó vinculada, pero la conexión está lenta. Vuelve a abrir la app.'", "'Pepito quedó vinculado, pero la conexión está lenta. Vuelve a abrir la app.'", 1],
  ['js/firebase-pro.js', "'No se pudo leer tu TV: '", "'No se pudo leer tu Pepito: '", 1],
  ['js/firebase-pro.js', "'No se pudo quitar la TV: '", "'No se pudo quitar a Pepito: '", 1],
  ['js/firebase-pro.js', "'Esta TV ya tiene '", "'Este Pepito ya tiene '", 1],
  ['js/firebase-pro.js', "'No se pudo salir de la TV: '", "'No se pudo salir de Pepito: '", 1],
  ['js/firebase-pro.js', "'Esa TV ya es tuya.'", "'Ese Pepito ya es tuyo.'", 1],
  ['js/firebase-pro.js', "'Ya tienes acceso a esa TV.'", "'Ya tienes acceso a ese Pepito.'", 1],
  ['js/firebase-pro.js', "'No se pudo entrar: el código venció, ya se usó o esa TV ya no está compartida.'", "'No se pudo entrar: el código venció, ya se usó o ese Pepito ya no está compartido.'", 1],
  ['js/firebase-pro.js', "'Ya tienes acceso a la TV, pero la conexión está lenta. Vuelve a abrir la app.'", "'Ya tienes acceso a Pepito, pero la conexión está lenta. Vuelve a abrir la app.'", 1],
  ['js/firebase-pro.js', "'No se pudo leer el estado de la TV: '", "'No se pudo leer el estado de Pepito: '", 1],

  // ---- js/main.js ----
  ['js/main.js', "'No se pudo leer lo que muestra la TV. Revisa tu internet.'", "'No se pudo leer lo que muestra Pepito. Revisa tu internet.'", 1],
  ['js/main.js', "'Enviado ✅ Ya va camino a la TV.'", "'Enviado ✅ Ya va camino a Pepito.'", 1],
  ['js/main.js', "'La conexión está lenta: todavía no se pudo leer lo que muestra la TV.'", "'La conexión está lenta: todavía no se pudo leer lo que muestra Pepito.'", 1],

  // ---- js/mas.js ----
  ['js/mas.js', "tv: 'Ajustes de la TV'", "tv: 'Ajustes de Pepito'", 1],
  ['js/mas.js', "'No se pudieron leer los ajustes de la TV. Revisa tu internet y vuelve a abrir esta pantalla.'", "'No se pudieron leer los ajustes de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", 1],
  ['js/mas.js', "'Ajustes guardados ✅ Ya van camino a la TV.'", "'Ajustes guardados ✅ Ya van camino a Pepito.'", 1],
  ['js/mas.js', "'La TV está ocupada (un juego o una alarma). Inténtalo en un momento.'", "'Pepito está ocupado (un juego o una alarma). Inténtalo en un momento.'", 1],
  ['js/mas.js', "'Pasó algo inesperado. Reinicia la TV e inténtalo de nuevo.'", "'Pasó algo inesperado. Reinicia a Pepito e inténtalo de nuevo.'", 1],
  ['js/mas.js', "'No se pudo actualizar la TV. Vuelve a intentarlo", "'No se pudo actualizar a Pepito. Vuelve a intentarlo", 2],
  ['js/mas.js', "'La TV se reinició sin terminar la actualización. Vuelve a intentarlo.'", "'Pepito se reinició sin terminar la actualización. Vuelve a intentarlo.'", 1],
  ['js/mas.js', "'Solo el dueño de la TV puede actualizarla o restablecerla.'", "'Solo el dueño de Pepito puede actualizarlo o restablecerlo.'", 1],
  ['js/mas.js', "'Esta TV todavía no admite estas opciones desde la app.'", "'Este Pepito todavía no admite estas opciones desde la app.'", 1],
  ['js/mas.js', "'Hay una versión nueva para tu TV.'", "'Hay una versión nueva para Pepito.'", 1],
  ['js/mas.js', "'Tu TV está al día ✅'", "'Pepito está al día ✅'", 1],
  ['js/mas.js', "'No se pudo leer el estado de la TV. Revisa tu internet", "'No se pudo leer el estado de Pepito. Revisa tu internet", 2],
  ['js/mas.js', "'Actualizando… no desconectes la TV.'", "'Actualizando… no desconectes a Pepito.'", 2],
  ['js/mas.js', "'Reiniciando la TV…'", "'Reiniciando a Pepito…'", 1],
  ['js/mas.js', "'La TV se actualizó ✅'", "'Pepito se actualizó ✅'", 1],
  ['js/mas.js', "'La TV no respondió. Tiene que estar encendida y con internet.", "'Pepito no respondió. Tiene que estar encendido y con internet.", 2],
  ['js/mas.js', "'¿Restablecer la TV? Se borrarán", "'¿Restablecer a Pepito? Se borrarán", 1],
  ['js/mas.js', "'Restableciendo la TV…'", "'Restableciendo a Pepito…'", 1],
  ['js/mas.js', "'La TV se restableció. Soltándola de tu cuenta…'", "'Pepito se restableció. Soltándolo de tu cuenta…'", 1],
  ['js/mas.js', "'La TV se restableció, pero no se pudo soltar de tu cuenta: '", "'Pepito se restableció, pero no se pudo soltar de tu cuenta: '", 1],
  ['js/mas.js', "' Pulsa Desvincular en Mi TV.'", "' Pulsa Desvincular en Mi Pepito.'", 1],
  ['js/mas.js', "'Sonido simple de la TV'", "'Sonido simple de Pepito'", 1],
  ['js/mas.js', "'No se pudo leer la alarma de la TV. Revisa tu internet y vuelve a abrir esta pantalla.'", "'No se pudo leer la alarma de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", 1],
  ['js/mas.js', "'Alarma guardada ✅ Ya va camino a la TV.'", "'Alarma guardada ✅ Ya va camino a Pepito.'", 1],

  // ---- js/tutorial.js ----
  ['js/tutorial.js', "'Aquí ves si tu TV está conectada.'", "'Aquí ves si Pepito está conectado.'", 1],
  ['js/tutorial.js', "'Toca Enviar y aparece en tu TV.'", "'Toca Enviar y aparece en Pepito.'", 1],
  ['js/tutorial.js', "'Elige una canción para tu TV.'", "'Elige una canción para Pepito.'", 1],

  // ---- js/lite-tv.js ya empaquetado (textos de app-lite/src/ble.js; esbuild los deja con comillas dobles) ----
  ['js/lite-tv.js', '"No se pudo emparejar. Mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo."', '"No se pudo emparejar. Mantén pulsado el botón de Pepito 8 segundos y vuelve a intentarlo."', 1],
  ['js/lite-tv.js', '"La TV no reconoce este celular. Olvídala en Ajustes > Bluetooth del celular, mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo."', '"Pepito no reconoce este celular. Olvídalo en Ajustes > Bluetooth del celular, mantén pulsado el botón de Pepito 8 segundos y vuelve a intentarlo."', 1],
  ['js/lite-tv.js', '"No elegiste ninguna TV."', '"No elegiste a ningún Pepito."', 1],
  ['js/lite-tv.js', '"No se pudo conectar con la TV. Acércate y vuelve a intentarlo."', '"No se pudo conectar con Pepito. Acércate y vuelve a intentarlo."', 1],
  ['js/lite-tv.js', '"La TV no respondió."', '"Pepito no respondió."', null],
  ['js/lite-tv.js', '"La TV no pudo tocar la canción."', '"Pepito no pudo tocar la canción."', 1],
  ['js/lite-tv.js', '"La TV no tiene espacio para esto."', '"Pepito no tiene espacio para esto."', 1],
  ['js/lite-tv.js', '"Se perdió la conexión con la TV."', '"Se perdió la conexión con Pepito."', 1],
  ['js/lite-tv.js', '"Eso es demasiado grande para la TV."', '"Eso es demasiado grande para Pepito."', 1],
  ['js/lite-tv.js', '"La TV no pudo guardar la alarma."', '"Pepito no pudo guardar la alarma."', 1],
  ['js/lite-tv.js', '"La TV no pudo guardar los ajustes."', '"Pepito no pudo guardar los ajustes."', 1],
  ['js/lite-tv.js', '"La TV no pudo empezar la actualización."', '"Pepito no pudo empezar la actualización."', 1],

  // ---- Actualizar un Pepito Lite (2026-11-23, docs/plan-ota-lite.md): la pantalla Sistema es la de la Pro; estos textos no
  // tienen sentido con una TV por Bluetooth y cambian SOLO con un Pepito Lite (clase "tv-lite" en <body>). Van después de las
  // filas de arriba porque parten del texto ya con Pepito. Textos 46, 47, 49 y 50 aprobados por el dueño el 2026-11-23/24.
  ['js/mas.js', "'Actualizando… no desconectes a Pepito.'", conLite('Actualizando… No cierres la app y deja el celular cerca de tu Pepito.', "'Actualizando… no desconectes a Pepito.'"), 2],
  ['js/mas.js', "'Pepito no respondió. Tiene que estar encendido y con internet.'", conLite('Pepito no respondió. Tiene que estar encendido y cerca del celular.', "'Pepito no respondió. Tiene que estar encendido y con internet.'"), 1],
  ['js/mas.js', "'No se pudo leer el estado de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'", conLite('No se pudo conectar con Pepito. Acércate y vuelve a abrir esta pantalla.', "'No se pudo leer el estado de Pepito. Revisa tu internet y vuelve a abrir esta pantalla.'"), 1],
  // El 50 vive en un objeto que la Pro arma al abrir la app (antes de saber qué TV se usa): se elige al leerlo (getter).
  ['js/mas.js', "ocupada: 'Pepito está ocupado (un juego o una alarma). Inténtalo en un momento.'", "get ocupada() { return " + conLite('Pepito está ocupado (una alarma). Inténtalo en un momento.', "'Pepito está ocupado (un juego o una alarma). Inténtalo en un momento.'") + '; }', 1],
  // Mensaje predeterminado (dictado por el dueño el 2026-11-24): "Bienvenido" arriba y "Soy Pepito" abajo, en Sans tamaño 3 (el más
  // grande en que las dos líneas caben enteras; en 4 y 5 "Bienvenido" se parte). Se ve con una cuenta o un Pepito que aún no
  // tienen nada enviado. La Lite lo tiene en src/lite-tv.js.
  ['js/main.js', "  texto: 'Bienvenido',", "  texto: 'Bienvenido\\nSoy Pepito',", 1],
  ['js/main.js', "  tamano: 2,", "  tamano: 3,", 1],
  ['js/firebase-pro.js', "pantalla.texto : 'Bienvenido',", "pantalla.texto : 'Bienvenido\\nSoy Pepito',", 1],
  ['js/firebase-pro.js', "        texto: 'Bienvenido',", "        texto: 'Bienvenido\\nSoy Pepito',", 1],
  ['js/firebase-pro.js', "        tamano: 2,", "        tamano: 3,", 1],
  // Un Pepito recién vinculado existe en la nube (versión, latido) pero sin pantalla: también ahí va el mensaje en tamaño 3.
  ['js/firebase-pro.js', "Math.round(Number(config.tamano)) || 2)),", "Math.round(Number(config.tamano)) || (snapPantalla.exists() ? 2 : 3))),", 1],
];

// Lo que puede seguir diciendo "TV" porque NO se ve: el nombre Bluetooth del firmware anterior (ble.js lo sigue reconociendo).
export const TV_PERMITIDO = ['TV RETRO Lite'];
