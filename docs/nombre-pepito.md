# Nombre "Pepito": propuesta para la app unificada (por aprobar)

> 2026-11-23. El dueño decidió que la TV se llama **Pepito** ("Pepito el televisorcito") y pidió cambiar TODO lo visible que dice "TV": "Pepito Lite", "Pepito Pro", "Ya va camino a Pepito", etc. Aquí está la lista completa de lo que cambiaría y cómo, para aprobarla ANTES de tocar nada (regla: paso grande = plan y aprobación).

## 1. Alcance

- **Solo la app unificada** (que será la única app cuando esté pulida). La Pro, su APK y su firmware **no se tocan** (decisión del dueño).
- **Solo textos que ve la persona.** NUNCA se cambian IDs del DOM, clases (`.tv-lite`, `sin-tv`), claves del celular (`tvretro.…`), rutas ni campos de Firebase, nombres de funciones ni comentarios: todos dicen "tv" y cambiarlos rompería la app y el contrato con el firmware.
- **Cómo se hace sin tocar la Pro:** una tabla de cambios (texto viejo → texto nuevo) que `app-unificada/construir.mjs` aplica sobre la COPIA de la Pro, como ya hace con otras cosas. Si un texto de la Pro cambia o no aparece, la compilación FALLA (no queda nada a medias en silencio).
- **La prueba de que la Pro no cambió** (`correr-pruebas-pro.mjs`) arma la unificada SIN el cambio de nombre: así sus pruebas, que buscan los textos de la Pro, siguen probando la lógica igual. Una prueba nueva revisa que en la unificada ya no quede ningún "TV" a la vista.

## 2. Regla para adaptar los textos

"Pepito" es un nombre propio y masculino, sin artículo:
- "la TV" / "tu TV" → **Pepito** ("Enviar a la TV" → "Enviar a Pepito"; "La TV no respondió." → "Pepito no respondió.").
- Donde hay varias TV o hace falta: "tu Pepito", "ese Pepito", "Mis Pepitos", "Pepito 1".
- Concordancia en masculino: "Olvídala" → "Olvídalo", "encendida" → "encendido", "tuya" → "tuyo", "compartida" → "compartido".
- "TV Pro" / "TV Lite" → **Pepito Pro** / **Pepito Lite** ("una TV Lite" → "un Pepito Lite").

## 3. Preguntas para el dueño (antes de empezar)

1. **"TV RETRO", el nombre de la marca** (arriba en la app, en el inicio de sesión, en la primera pantalla y en el nombre de la app bajo el ícono del celular): ¿pasa a ser **"Pepito"** o se queda "TV RETRO" como marca y Pepito es el nombre del televisor? (propuesta: todo "Pepito", porque el pedido fue cambiar todo lo que diga TV).
2. **Paquete de la app** (no se puede cambiar después de publicar; de él depende el registro en Firebase para entrar con Google): hoy `com.tvretro.unificada`, provisional. Propuesta: `com.pepito.app` (tiene que ser único en Google Play; si el dueño tiene dominio web, se usa al revés: `com.sudominio.pepito`).
3. **Nombre Bluetooth de la TV Lite:** hoy "TV RETRO Lite" (es lo que se ve al emparejar y lo que la app busca). Pasarlo a **"Pepito Lite"** exige cambiar el firmware Lite y la app A LA VEZ y volver a grabar la TV (con permiso del dueño). Propuesta: sí, junto con este cambio.
4. **Páginas de ayuda, términos, privacidad y licencias:** dicen "TV RETRO" muchas veces y la parte legal la revisa un abogado. Propuesta: cambiarlas aparte, cuando se revisen con el abogado.

## 4. Lista completa de textos

### Pantalla principal y envío
| # | Hoy | Con Pepito |
|---|---|---|
| P1 | Enviar a la TV (botón y el del dibujo ampliado) | Enviar a Pepito |
| P2 | Enviado ✅ Ya va camino a la TV. | Enviado ✅ Ya va camino a Pepito. |
| P3 | En la TV ✅ | En Pepito ✅ |
| P4 | La TV está sin conexión: lo mostrará cuando se conecte. | Pepito está sin conexión: lo mostrará cuando se conecte. |
| P5 | No se pudo leer lo que muestra la TV. Revisa tu internet. | No se pudo leer lo que muestra Pepito. Revisa tu internet. |
| P6 | La conexión está lenta: todavía no se pudo leer lo que muestra la TV. | La conexión está lenta: todavía no se pudo leer lo que muestra Pepito. |
| P7 | No se pudo leer el estado de la TV: (motivo). | No se pudo leer el estado de Pepito: (motivo). |
| P8 | Ese GIF es demasiado pesado para la TV. Prueba con uno más corto. | Ese GIF es demasiado pesado para Pepito. Prueba con uno más corto. |

### Mis TV, vincular y compartir
| # | Hoy | Con Pepito |
|---|---|---|
| P9 | Mi TV (botón de arriba) | Mi Pepito |
| P10 | Mis TV | Mis Pepitos |
| P11 | TV 1, TV 2… | Pepito 1, Pepito 2… |
| P12 | Añade tu TV | Añade tu Pepito |
| P13 | Escribe el código que muestra la pantalla de tu TV. | Escribe el código que muestra la pantalla de Pepito. |
| P14 | Código de la TV | Código de Pepito |
| P15 | No se pudo cargar tus TV | No se pudo cargar tus Pepitos |
| P16 | No se pudo leer tu lista de TV: (motivo). | No se pudo leer tu lista de Pepitos: (motivo). |
| P17 | Escribe los 6 caracteres del código que muestra tu TV. | Escribe los 6 caracteres del código que muestra Pepito. |
| P18 | Ese código no existe o ya venció. Revisa el código que muestra tu TV (se renueva solo). | Ese código no existe o ya venció. Revisa el código que muestra Pepito (se renueva solo). |
| P19 | No se pudo vincular: el código venció o esa TV ya tiene dueño. Pide uno nuevo en la TV. | No se pudo vincular: el código venció o ese Pepito ya tiene dueño. Pide uno nuevo en Pepito. |
| P20 | La TV quedó vinculada, pero la conexión está lenta. Vuelve a abrir la app. | Pepito quedó vinculado, pero la conexión está lenta. Vuelve a abrir la app. |
| P21 | No se pudo leer tu TV: (motivo). | No se pudo leer tu Pepito: (motivo). |
| P22 | No se pudo quitar la TV: (motivo). | No se pudo quitar a Pepito: (motivo). |
| P23 | ¿Desvincular la TV 1? Dejará de ser tuya y perderán el acceso quienes la comparten. | ¿Desvincular a Pepito 1? Dejará de ser tuyo y perderán el acceso quienes lo comparten. |
| P24 | ¿Salir de la TV 1? Ya no podrás enviarle contenido. | ¿Salir de Pepito 1? Ya no podrás enviarle contenido. |
| P25 | No se pudo salir de la TV: (motivo). | No se pudo salir de Pepito: (motivo). |
| P26 | Compartir TV 1 | Compartir Pepito 1 |
| P27 | La otra persona escribe este código en Mi TV. | La otra persona escribe este código en Mi Pepito. |
| P28 | Esta TV ya tiene 5 personas con acceso. Quita a alguien para invitar a otra. | Este Pepito ya tiene 5 personas con acceso. Quita a alguien para invitar a otra. |
| P29 | ¿Quitar a esta persona? Ya no podrá enviar contenido a tu TV. | ¿Quitar a esta persona? Ya no podrá enviar contenido a tu Pepito. |
| P30 | Esa TV ya es tuya. | Ese Pepito ya es tuyo. |
| P31 | Ya tienes acceso a esa TV. | Ya tienes acceso a ese Pepito. |
| P32 | No se pudo entrar: el código venció, ya se usó o esa TV ya no está compartida. | No se pudo entrar: el código venció, ya se usó o ese Pepito ya no está compartido. |
| P33 | Ya tienes acceso a la TV, pero la conexión está lenta. Vuelve a abrir la app. | Ya tienes acceso a Pepito, pero la conexión está lenta. Vuelve a abrir la app. |
| P34 | Se borrará tu cuenta y todo lo que guardaste. Tu TV quedará sin dueño. Esto no se puede deshacer. | Se borrará tu cuenta y todo lo que guardaste. Tu Pepito quedará sin dueño. Esto no se puede deshacer. |

### Más > Config (Ajustes, Sistema, Alarma)
| # | Hoy | Con Pepito |
|---|---|---|
| P35 | Ajustes de la TV | Ajustes de Pepito |
| P36 | No se pudieron leer los ajustes de la TV. Revisa tu internet y vuelve a abrir esta pantalla. | No se pudieron leer los ajustes de Pepito. Revisa tu internet y vuelve a abrir esta pantalla. |
| P37 | Ajustes guardados ✅ Ya van camino a la TV. | Ajustes guardados ✅ Ya van camino a Pepito. |
| P38 | Sonido simple de la TV | Sonido simple de Pepito |
| P39 | No se pudo leer la alarma de la TV. Revisa tu internet y vuelve a abrir esta pantalla. | No se pudo leer la alarma de Pepito. Revisa tu internet y vuelve a abrir esta pantalla. |
| P40 | Alarma guardada ✅ Ya va camino a la TV. | Alarma guardada ✅ Ya va camino a Pepito. |
| P41 | Actualizar la TV / Restablecer la TV | Actualizar a Pepito / Restablecer a Pepito |
| P42 | Hay una versión nueva para tu TV. / Tu TV está al día ✅ | Hay una versión nueva para Pepito. / Pepito está al día ✅ |
| P43 | Actualizando… no desconectes la TV. / Reiniciando la TV… / La TV se actualizó ✅ | Actualizando… no desconectes a Pepito. / Reiniciando a Pepito… / Pepito se actualizó ✅ |
| P44 | La TV está ocupada (un juego o una alarma). Inténtalo en un momento. | Pepito está ocupado (un juego o una alarma). Inténtalo en un momento. |
| P45 | Pasó algo inesperado. Reinicia la TV e inténtalo de nuevo. | Pasó algo inesperado. Reinicia a Pepito e inténtalo de nuevo. |
| P46 | No se pudo actualizar la TV. Vuelve a intentarlo (más tarde). | No se pudo actualizar a Pepito. Vuelve a intentarlo (más tarde). |
| P47 | La TV se reinició sin terminar la actualización. Vuelve a intentarlo. | Pepito se reinició sin terminar la actualización. Vuelve a intentarlo. |
| P48 | Solo el dueño de la TV puede actualizarla o restablecerla. | Solo el dueño de Pepito puede actualizarlo o restablecerlo. |
| P49 | Esta TV todavía no admite estas opciones desde la app. | Este Pepito todavía no admite estas opciones desde la app. |
| P50 | La TV no respondió. Tiene que estar encendida y con internet. (y la versión con "Revisa su estado y vuelve a intentarlo.") | Pepito no respondió. Tiene que estar encendido y con internet. (igual) |
| P51 | ¿Restablecer la TV? Se borrarán todos los datos (Wi-Fi, alarmas, contenido) y quedará con la configuración de fábrica. / Restableciendo la TV… | ¿Restablecer a Pepito? Se borrarán todos los datos (Wi-Fi, alarmas, contenido) y quedará con la configuración de fábrica. / Restableciendo a Pepito… |
| P52 | La TV se restableció. Soltándola de tu cuenta… | Pepito se restableció. Soltándolo de tu cuenta… |
| P53 | La TV se restableció, pero no se pudo soltar de tu cuenta: (motivo) Pulsa Desvincular en Mi TV. | Pepito se restableció, pero no se pudo soltar de tu cuenta: (motivo) Pulsa Desvincular en Mi Pepito. |

### Tutorial
| # | Hoy | Con Pepito |
|---|---|---|
| P54 | Aquí ves si tu TV está conectada. | Aquí ves si Pepito está conectado. |
| P55 | Toca Enviar y aparece en tu TV. | Toca Enviar y aparece en Pepito. |
| P56 | Elige una canción para tu TV. | Elige una canción para Pepito. |

### Pepito Lite (textos ya aprobados el 2026-11-23, adaptados)
| # | Aprobado | Con Pepito |
|---|---|---|
| P57 (22) | Escribe el PIN que sale en la TV… | Escribe el PIN que sale en Pepito… |
| P58 (23) | No se pudo emparejar. Mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo. | No se pudo emparejar. Mantén pulsado el botón de Pepito 8 segundos y vuelve a intentarlo. |
| P59 (24, 36) | La TV no reconoce este celular. Olvídala en Ajustes > Bluetooth del celular, mantén pulsado el botón de la TV 8 segundos y vuelve a intentarlo. | Pepito no reconoce este celular. Olvídalo en Ajustes > Bluetooth del celular, mantén pulsado el botón de Pepito 8 segundos y vuelve a intentarlo. |
| P60 (25) | Conecta tu TV | Conecta a Pepito |
| P61 (26) | Enciende la TV. Verás un PIN en su pantalla. | Enciende a Pepito. Verás un PIN en su pantalla. |
| P62 (27) | Toca "Abrir Bluetooth", elige "TV RETRO Lite" y escribe el PIN. | Toca "Abrir Bluetooth", elige "Pepito Lite" y escribe el PIN. (si se aprueba la pregunta 3) |
| P63 (28) | (dictado por el dueño) | Regresa a la app y ya Pepito estará listo para ser usado. |
| P64 (30) | Tengo una TV Lite | Tengo un Pepito Lite |
| P65 (32) | Una TV Lite no se comparte. | Un Pepito Lite no se comparte. |
| P66 (33) | Esto no está disponible en una TV Lite. | Esto no está disponible en un Pepito Lite. |
| P67 (37) | TV RETRO · ¿Qué TV tienes? · TV Pro / TV Lite | (marca, pregunta 1) · ¿Qué Pepito tienes? · Pepito Pro / Pepito Lite |
| P68 (38) | Por ahora no se puede usar la TV Lite. Inténtalo más tarde. | Por ahora no se puede usar Pepito Lite. Inténtalo más tarde. |
| P69 (40) | Tengo una TV Pro | Tengo un Pepito Pro |
| P70 | No elegiste ninguna TV. | No elegiste a ningún Pepito. |
| P71 | No se pudo conectar con la TV. Acércate y vuelve a intentarlo. | No se pudo conectar con Pepito. Acércate y vuelve a intentarlo. |
| P72 | La TV no respondió. | Pepito no respondió. |
| P73 | La TV no pudo tocar la canción. | Pepito no pudo tocar la canción. |
| P74 | La TV no tiene espacio para esto. | Pepito no tiene espacio para esto. |
| P75 | Se perdió la conexión con la TV. | Se perdió la conexión con Pepito. |
| P76 | Eso es demasiado grande para la TV. | Eso es demasiado grande para Pepito. |
| P77 | La TV no pudo guardar la alarma. / La TV no pudo guardar los ajustes. | Pepito no pudo guardar la alarma. / Pepito no pudo guardar los ajustes. |
| P78 | (ventana de Bluetooth) Elige tu TV / No se encontró ninguna TV | Elige a Pepito / No se encontró ningún Pepito |

### Nombre de la app y Bluetooth (preguntas 1 a 3)
| # | Hoy | Con Pepito |
|---|---|---|
| P79 | Nombre bajo el ícono: TV RETRO (unificada) | Pepito (si se aprueba la pregunta 1) |
| P80 | Título de la app (arriba, inicio de sesión, primera pantalla): TV RETRO | Pepito (pregunta 1) |
| P81 | Nombre Bluetooth de la TV Lite: TV RETRO Lite | Pepito Lite (pregunta 3; firmware y app a la vez) |
