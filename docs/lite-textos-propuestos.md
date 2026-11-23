# Textos nuevos de la versión Lite: PROPUESTAS para que el dueño las apruebe

> Regla del proyecto: los textos que ve el cliente los dicta el dueño; aquí van como **propuesta mía** (lenguaje simple, con "tú", sin datos técnicos). Lo que no esté en esta lista es de la app Pro y no cambió. Cuando el dueño apruebe, corrija o dicte otro, se cambia en el archivo indicado.

> **Revisión del dueño (2026-11-23), filas 22 a 42:** aprobadas 22, 23, 24/36, 25, 26, 27, 29, 30, 31, 32, 33, 37, 38, 39, 41 y 42. La **28** la dictó el dueño: "Regresa a la app y ya Pepito estará listo para ser usado." La **40** queda por explicarle (qué es "Tengo una TV Pro"). Para la 32 y la 33 el dueño prefiere que lo que no está disponible en la Lite ni siquiera aparezca: ya es así (Compartir, Juegos y Sistema están ocultos con una TV Lite; esos avisos son solo de respaldo). **Todas se adaptan al nombre "Pepito"** (decisión del dueño): la versión con Pepito de cada una está en [nombre-pepito.md](nombre-pepito.md), por aprobar.

## En la app (celular)

| # | Cuándo sale | Texto propuesto | Dónde está |
|---|---|---|---|
| 1 | Cerrar la lista de TV sin elegir ninguna | No elegiste ninguna TV. | `app-lite/src/ble.js` |
| 2 | No se puede conectar (TV apagada o lejos) | No se pudo conectar con la TV. Acércate y vuelve a intentarlo. | `ble.js` |
| 3 | La TV no responde | La TV no respondió. | `ble.js` |
| 4 | Se corta la conexión en un envío | Se perdió la conexión con la TV. | `ble.js` |
| 5 | La TV no tiene espacio | La TV no tiene espacio para esto. | `ble.js` |
| 6 | Un envío llega dañado | Lo que enviaste no llegó bien. Vuelve a intentarlo. | `ble.js` |
| 7 | Una canción llega dañada | La canción no llegó bien. Vuelve a intentarlo. | `ble.js` |
| 8 | La TV no puede tocar la canción | La TV no pudo tocar la canción. | `ble.js` |
| 9 | La TV no pudo guardar la alarma / los ajustes | La TV no pudo guardar la alarma. / La TV no pudo guardar los ajustes. | `ble.js` |
| 10 | Una canción que no existe en la app | Esa canción no existe. / No se pudo leer la canción. | `ble.js`, `backend-lite.js` |
| 11 | El celular no puede comprimir un GIF | Este celular no puede enviar GIF. | `backend-lite.js` |
| 12 | Un GIF de más de 600 KB | Ese GIF es demasiado pesado para la TV. Prueba con uno más corto. | `backend-lite.js` |
| 13 | Una función que la Lite no tiene (por si alguna pantalla la pide) | Esto no está disponible en TV RETRO Lite. | `backend-lite.js` |
| 14 | Durante un envío largo | Enviando… 45 % (el texto "Enviando…" ya era de la Pro) | `backend-lite.js` |
| 15 | Config > Legal (arriba) | Tus imágenes y GIF se guardan en este celular, no en internet. Si borras la app o cambias de celular, se pierden. | `app-lite/construir.mjs` |
| 16 | Aviso de GIF pesado y muy pesado | Los mismos textos de la Pro; solo cambian los pesos: pesado desde 100 KB y muy pesado desde 250 KB (en la Pro, 256 KB y 1 MB) | `app-lite/src/gif-lite.js` |
| 22 | Al emparejar desde la app, mientras se escribe el PIN (línea de estado) | Escribe el PIN que sale en la TV… | `backend-lite.js` |
| 23 | El emparejamiento falla (PIN mal, tiempo agotado o la TV no tenía abierto el emparejamiento) | No se pudo emparejar. Mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo. | `ble.js` |
| 24 | El celular figura como vinculado pero la TV no lo reconoce (la TV abrió el emparejamiento otra vez o se olvidó el vínculo de un solo lado) | La TV no reconoce este celular. Olvídala en Ajustes > Bluetooth del celular, mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo. | `ble.js` |
| 25 | Pantalla de inicio, título (solo en el celular Android, cuando no hay una TV emparejada) | Conecta tu TV | `app-lite/construir.mjs` |
| 26 | Pantalla de inicio, paso 1 | Enciende la TV. Verás un PIN en su pantalla. | `construir.mjs` |
| 27 | Pantalla de inicio, paso 2 | Toca "Abrir Bluetooth", elige "TV RETRO Lite" y escribe el PIN. | `construir.mjs` |
| 28 | Pantalla de inicio, paso 3 | Vuelve a esta app. Se conecta sola. | `construir.mjs` |
| 29 | Pantalla de inicio, botones | Abrir Bluetooth / Ahora no | `construir.mjs` |
| 30 | App unificada, "Añade tu TV" y "Mis TV": botón para una TV Lite | Tengo una TV Lite | `app-unificada/construir.mjs` |
| 31 | App unificada, pantalla "Conecta tu TV" abierta desde "Añade tu TV": botón para volver | Volver | `app-unificada/construir.mjs` |
| 32 | App unificada: compartir una TV Lite | Una TV Lite no se comparte. | `src/backend-unificado.js` |
| 33 | App unificada: una función que una TV Lite no tiene | Esto no está disponible en una TV Lite. | `src/lite-tv.js` |
| 34 | (REEMPLAZADA por la fila 37: la pregunta pasó a ser la primera pantalla) App unificada, "Añade tu TV" la primera vez: la pregunta | ¿Qué TV tienes? | `app-unificada/construir.mjs` |
| 35 | (REEMPLAZADA por la fila 37) App unificada, las dos opciones de esa pregunta | TV Pro / TV Lite | `app-unificada/construir.mjs` |
| 36 | App unificada: cuadro de aviso cuando la TV Lite ya no reconoce al celular al reconectar sola | (el mismo texto de la fila 24) | `app-unificada/src/lite-tv.js` |
| 37 | App unificada, PRIMERA pantalla (una sola vez): título, pregunta y botones | TV RETRO · ¿Qué TV tienes? · TV Pro / TV Lite | `app-unificada/construir.mjs` |
| 38 | Primera pantalla, "TV Lite" con el acceso sin cuenta apagado en Firebase | Por ahora no se puede usar la TV Lite. Inténtalo más tarde. | `src/backend-unificado.js` |
| 39 | Primera pantalla, "TV Lite" sin internet | Sin conexión a internet. Conéctate y vuelve a intentarlo. | `src/backend-unificado.js` |
| 40 | Mis TV sin cuenta (TV Lite): el botón que antes decía "Cerrar sesión" (vuelve a la primera pantalla) | Tengo una TV Pro | `src/anadir-lite.js` |
| 41 | Reloj de la TV Lite sin hora (se quedó sin corriente), en lugar de "Sin hora" (fila 20) | Abre la app | `OLED_Lite/reloj_lite.cpp` (firmware) |
| 42 | Tutorial guiado con una TV Lite, el paso que señala "Más" (la Pro dice "Aquí están tu galería, los juegos, la alarma y los ajustes."; la TV Lite no tiene juegos) | Aquí están tu galería, la alarma y los ajustes. | `app-unificada/src/anadir-lite.js` |
| 43 | Buscar canción: la lupa junto a la lista de canciones y al tono de la alarma, y el campo de la ventana (texto de ayuda) | Buscar canción | `app-unificada/construir.mjs` |
| 44 | Buscar canción: lo escrito no coincide con ninguna canción | No hay canciones con ese nombre. | `app-unificada/construir.mjs` |
| 45 | Buscar canción: botón para cerrar la ventana (texto de ayuda de la X) | Cerrar | `app-unificada/construir.mjs` |

## En la pantalla de la TV (OLED; la fuente no tiene tildes ni ñ)

| # | Cuándo sale | Texto propuesto |
|---|---|---|
| 17 | Emparejar (con el PIN en grande) | Emparejar: escribe el / PIN en tu celular · Vence en 4:59 |
| 18 | Al mantener el botón 3 s sin que suene nada | Sigue / 5 s mas: emparejar |
| 19 | Emparejado | Listo! / Celular emparejado |
| 20 | Reloj sin hora | --:-- y debajo "Sin hora" |
| 21 | Alarma sonando | ALARMA (con la hora) y debajo "Toca para parar" |

## Páginas (borradores; la parte legal la revisa un abogado antes de vender)

`lite/terminos.html`, `lite/privacidad.html` y `lite/ayuda.html` (se generan con `app-lite/herramientas/generar-paginas-lite.mjs`). Puntos que el dueño debe leer con cuidado: que las imágenes se guardan solo en el celular y se pierden al desinstalar o cambiar de celular (términos §3, ayuda), que la TV solo acepta a un celular a la vez (términos §4), y que sin hora no suena la alarma (términos §6).
