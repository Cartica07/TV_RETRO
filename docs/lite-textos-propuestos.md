# Textos nuevos de la versión Lite: PROPUESTAS para que el dueño las apruebe

> Regla del proyecto: los textos que ve el cliente los dicta el dueño; aquí van como **propuesta mía** (lenguaje simple, con "tú", sin datos técnicos). Lo que no esté en esta lista es de la app Pro y no cambió. Cuando el dueño apruebe, corrija o dicte otro, se cambia en el archivo indicado.

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

## En la pantalla de la TV (OLED; la fuente no tiene tildes ni ñ)

| # | Cuándo sale | Texto propuesto |
|---|---|---|
| 17 | Emparejar (con el PIN en grande) | Emparejar: escribe el / PIN en tu celular · Vence en 1:59 |
| 18 | Al mantener el botón 3 s sin que suene nada | Sigue / 5 s mas: emparejar |
| 19 | Emparejado | Listo! / Celular emparejado |
| 20 | Reloj sin hora | --:-- y debajo "Sin hora" |
| 21 | Alarma sonando | ALARMA (con la hora) y debajo "Toca para parar" |

## Páginas (borradores; la parte legal la revisa un abogado antes de vender)

`lite/terminos.html`, `lite/privacidad.html` y `lite/ayuda.html` (se generan con `app-lite/herramientas/generar-paginas-lite.mjs`). Puntos que el dueño debe leer con cuidado: que las imágenes se guardan solo en el celular y se pierden al desinstalar o cambiar de celular (términos §3, ayuda), que la TV solo acepta a un celular a la vez (términos §4), y que sin hora no suena la alarma (términos §6).
