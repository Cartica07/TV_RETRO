# TV RETRO — Guía para Claude (y para cualquier persona o IA que trabaje en el proyecto)

> Leer esto completo antes de tocar nada. Las **reglas** (sección 2) las fijó el dueño y son obligatorias.
> El detalle extendido está en `docs/`. Empezar por [docs/contexto-general.md](docs/contexto-general.md).

## 1. Qué es

**TV RETRO** es una "mini TV": una pantalla OLED SSD1306 de 128×64 y un buzzer, montados en un microcontrolador **ESP32-S3**. Se controla a distancia desde un **panel web** (este repo) a través de **Firebase Realtime Database**. El panel envía textos, imágenes, dibujos, GIF/animaciones, canciones (solo sonido) y **musicales** (canciones con letra, imágenes y GIF). El firmware escucha Firebase y los muestra o reproduce.

| Pieza | Dónde | Notas |
|---|---|---|
| Panel web (este repo) | `C:\Proyectos\TV_RETRO`, GitHub `Cartica07/TV_RETRO`, rama de trabajo `rediseno-app` (también publicada en `main`) | HTML/CSS/JS puro, módulos ES, sin frameworks. Más adelante: APK con Capacitor. |
| Firmware | `C:\Proyectos\TV_RETRO-firmware`, GitHub `Cartica07/Firmware-TV-RETRO`, rama `esp32` (también publicada en `main`) | Arduino (núcleo esp32 3.3.x), ESP32-S3 N16R8. Tiene su propio `CLAUDE.md`. |
| Base de datos | Firebase RTDB, proyecto `lorenita-6ad1e` | Reglas en `database.rules.json` (se publican a mano en la consola). |
| Referencia (SOLO LECTURA) | `C:\Proyectos\CancionesMiniTV` (`Cartica07/CancionesMiniTV`) | Simulador/generador de canciones del dueño. De ahí se portaron el decodificador de GIF, Atkinson, el encuadre y las fuentes. |
| Referencia (SOLO LECTURA) | `C:\Proyectos\Canciones-ino` (`Cartica07/Canciones-ino`), carpeta `Canciones en ino` | Los 57 `.ino` de canciones con letra del dueño, que se importan como musicales. |

Primer modelo de TV: ESP8266 (firmware V1.x). Ese modelo sigue funcionando aparte y el dueño le graba los `.ino` completos; **todo el desarrollo actual es para el ESP32-S3**.

## 2. Reglas obligatorias (fijadas por el dueño)

### Forma de trabajar
- **Responder siempre en español.**
- **Antes de cada paso grande: explicar el plan y esperar aprobación.** Ante dudas de diseño o de datos, preguntar.
- **Pasos pequeños, un commit por paso**, mensaje claro en español, terminado con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (o el modelo que corresponda).
- **Separar cambios visuales de cambios de lógica**: nunca en el mismo paso ni en el mismo commit. Visual = HTML/CSS; lógica = JS. Documentación en commits propios.
- **No hacer push ni merge a `main` sin pedido explícito** del dueño (en cada ocasión; un permiso anterior no vale para la siguiente).
- Verificar antes de commitear: `node --check js/<archivo>.js` y probar en el navegador (ver sección 7).
- Mantener los finales de línea CRLF de los archivos que ya los tienen.
- **Pruebas largas (bobos, panel, emulador de reglas…): NO correrlas durante la edición de un cambio**; solo cuando el dueño confirme que esa versión es la final (acordado 2026-11-14). Para medir "sin scroll" o comprobar algo puntual sí se puede probar una cosa.
- **Al cerrar una sesión que cambió código: añadir su fila en `docs/auditoria-alcance.md` sección 8** (fecha, commits de cada repo, qué cambió, qué mirar). Así la auditoría final sabe qué es nuevo.

### Código
- **Política de seguridad (CSP, H-21):** `index.html` lleva un `<meta http-equiv="Content-Security-Policy">` que solo permite lo que la app usa (scripts propios + SDK de Firebase en `www.gstatic.com` + `apis.google.com`; conexiones a `*.firebaseio.com`/`*.firebasedatabase.app` (HTTPS y WebSocket) y a `identitytoolkit`/`securetoken`/`www.googleapis.com`; marcos de `lorenita-6ad1e.firebaseapp.com` y `accounts.google.com`; imágenes `data:`/`blob:`). **Si se añade un servicio externo, un CDN o un recurso de otro dominio, hay que añadirlo a esa política o el navegador lo bloqueará** (no usar `eval`, `new Function` ni scripts en línea). La copia de la APK (`copiar-web.mjs`) NO lleva la política. Las pruebas corren con la política activa (`banco.mjs`; solo `sinCSP` para las que usan `new Function` dentro de la página).
- **No migrar a React/Vue/otro framework.** HTML/CSS/JS puro, módulos ES.
- **No borrar ninguna función existente** (se puede dejar de usar, no eliminar).
- **Mantener los IDs del DOM** que usa `js/ui.js` (`obtenerElementos`) y los `data-valor` de los botones. Un ID faltante rompe todo (`null.addEventListener`).
- `js/firebase.js` es el **único** módulo que habla con Firebase.
- **A prueba de usuarios impacientes** (el cliente pulsa varias veces, cambia de pestaña, corta la señal). Reglas del código:
  - Lo asíncrono que escribe estado compartido se descarta si el usuario ya se fue de la pestaña o hizo otra cosa (turnos: `turnoSubida`, `turnoCancion`, `turnoReprocesoImagen`; `subidaObsoleta`).
  - Guardar, borrar e importar van por `sinRepetir()` (una por vez) y esperan con `esperarFinal()`; las escrituras de `firebase.js` pasan por `conTope()` (15 s, luego "la conexión está lenta").
  - El panel nace `inert` en `index.html` y `inicializar()` lo libera al terminar `cargarEstadoInicial` (máx. 8 s, o ante un fallo inesperado). No quitar ese atributo del HTML.
  - Los campos de archivo se limpian al tomar el archivo.
  - Un error sin atrapar muestra "Algo salió mal. Vuelve a intentarlo." (nada técnico en pantalla; el detalle va a la consola).
  - Mensajes de error para el cliente claros y con "tú"; los textos de Firebase pasan por `describirError`.

### Datos y Firebase
- **No cambiar rutas, nombres de campos ni formato de datos en Firebase sin aprobación del dueño.** Todo campo o nodo nuevo se propone primero, se aprueba y se documenta en la sección 4 y en `docs/formatos-datos.md`.
- Los campos nuevos deben tener un valor por defecto que mantenga funcionando a un firmware que no los conoce.
- Las reglas de Firebase las publica **el dueño** en la consola; aquí solo se mantiene `database.rules.json` como copia/propuesta.

### Privacidad y seguridad
- **Datos internos NO se muestran en la interfaz**: versión del firmware ("Firmware V1.6"), contador de versión ("v356"), textos técnicos, etc. "Son datos privados solo para el dueño". Pueden ir a la consola del navegador (`[TV RETRO] …`) o al monitor serie.
- **Contraseñas de Wi-Fi: nunca imprimirlas ni escribirlas en el código.** En los logs del firmware solo se muestra su largo.
- **Repos de referencia (`CancionesMiniTV`, `Canciones-ino`): solo lectura.** No modificar nada, no commitear, no hacer push. Solo `git fetch`/`git pull` para actualizar la copia local y leer.
- No subir secretos. La `apiKey` de Firebase del panel es pública por diseño (la seguridad real son las reglas).

### Interfaz
- Nombre visible: **TV RETRO**. Es solo el nombre visible: la ruta `oled_remota` y demás nombres de datos **no se renombran**.
- **Sin textos explicativos** en las pestañas (habrá un tutorial guiado más adelante).
- **Textos con "tú"** ("Elige", "Pon", "Prueba"), nunca voseo ("Elegí", "Poné"): el dueño vende en Colombia (decidido el 2026-11-10). La pestaña de música se llama **Canciones**.
- **Cada pestaña (salvo las grillas de Galería) entra SIN scroll** en celulares de 390×844 y 360×740. Se mide comparando el final de `main.controles` con el borde superior de `.barra-accion` (o de `.nav-inferior` en las pantallas sin Enviar: menú Más y Juegos).
- La vista previa de la OLED en el panel debe ser **pixel-perfect** con lo que dibuja el firmware (mismas fuentes, mismos cortes de línea, mismos tiempos de scroll).

## 3. Archivos del panel

- `index.html` + `js/main.js` (orquestador: estado, eventos, vista previa, envío) + `js/ui.js` (IDs del DOM y ayudas visuales).
- `js/firebase.js`: único acceso a Firebase.
- `js/utilidades.js` (detectar la APK, `sinRepetir`, `esperarFinal`, avisos) y `js/conexion.js` (estado de conexión de la TV y acuse de recibo): salieron de `main.js` en la etapa 1 de H-13 (2026-11-15).
- `js/mas.js` (pestaña Más: menú, Mi cuenta, Ajustes de la TV, Alarma y Jugar; `crearMas({ ... })`, 2026-11-16, H-13 paso 2): recibe lo compartido de `main.js` por funciones (`estado()`, `sesion()`, `musicales()`, `avanzarTurnoEnvio()`…) y exporta `TITULOS_CONFIG`; `main.js` solo asigna la vista con `fijarMasVista` (sin efectos) y la lee con `obtenerMasVista`/`obtenerConfigVista`.
- `js/cuentas.js` (inicio de sesión, Mi TV, Compartir y Eliminar mi cuenta; `crearCuentas({ leerElementos, liberarPanelDespuesDeLogin })`, 2026-11-16, H-13 paso 3): `sesionActual` vive ahí y se asigna una sola vez en `entrar()`; `main.js` la lee con `obtenerSesion()`/`obtenerEsAdmin()`. Los botones de Config que abren Mi TV y la baja y el tramo del Atrás de Android (`cerrarCapaCuentas`) también están en ese módulo.
- `js/galeria.js` (catálogos de imágenes y de animaciones/GIF: escucha, miniaturas, elegir, borrar y "Añadir nueva"; `crearGaleria({ ... })`, 2026-11-16, H-13 paso 4): el estado que comparte con la pestaña Imagen (fuente editable, original, GIF, turnos de reproceso y subida) sigue en `main.js` y entra por funciones.
- `js/canciones.js` (catálogo `musicales/`, selector, elegir y bajar, importar `.ino`, borrar y Repeticiones; `crearCanciones({ leerElementos, estado, renderizar, detenerPreviewMusical })`, 2026-11-16, H-13 paso 5): `main.js` lee la canción elegida con `obtenerMusicalCargado()` y el catálogo (también lo usa `mas.js` para los tonos de la alarma) con `obtenerMusicales()`/`fijarMusicales()`. `letraCanciones` y la vista previa del musical siguen en `main.js`.
- `js/renderer.js` + `js/fonts.js`: réplica de la OLED con la fuente clásica 5×7 (glcdfont, orden CP437; tabla `LATIN1_A_CP437` para tildes/ñ/¿/¡).
- `js/fuentesTexto.js` + `js/fuentesGfx.js`: fuentes FreeSans/FreeSerif (GFXfont, generadas desde CancionesMiniTV/fuentes.js).
- `js/imageProcessor.js` (difuminado Atkinson, encuadre: escala/fondo/rotar/voltear), `js/gif.js` (GIF → animación; avisos de peso), `js/dibujo.js`, `js/lienzoZoom.js` (zoom/expandido del lienzo de Dibujo; clase `body.dibujo-expandido`).
- `js/compresion.js`: formatos `z1` (animaciones) y `m1` (musicales).
- `js/inoMusical.js`: intérprete de los `.ino` de canciones (C reducido + SSD1306/buzzer virtuales, tiempo virtual) que graba notas y pantallas.
- `css/tokens.css` (colores, fuentes, medidas; compartido) y `css/style.css` (estilos del panel).
- `css/fuentes.css` + `fonts/` (2026-11-16, H-21): Space Grotesk y JetBrains Mono locales (subconjunto latino, licencias SIL OFL en `fonts/LICENCIA-*.txt`). **La web ya no pide nada a Google Fonts.** La APK genera su propia copia (`copiar-web.mjs`).
- `carga-masiva.html`: página aparte (no enlazada) para subir contenido en lote; usa `css/tokens.css` + estilos inline; su `<script>` inline no se toca en pasos visuales.
- `database.rules.json`: copia de las reglas de Firebase.
- `docs/`: documentación (ver sección 8).

### Estructura de index.html
- `.cabecera-fija` (barra superior + tarjeta `.dispositivo` con `#oled`, `#filaInvertido` y `#estadoLinea`), `main.controles` con una sección por pestaña, `.barra-accion` (Enviar) y `nav.nav-inferior`.
- La navegación inferior ES `#grupoTipo`: botones `data-valor` = `texto`, `imagen`, `dibujo`, `cancion`, `galeria`; los usa `cambiarTipo()` en main.js. El último se llama **Más** (2026-11-14): abre un menú (`#seccionMasSelector` / `#grupoMas`, botones `data-mas` = `galeria` | `juegos` | `alarma` | `config`) y cada opción es una pantalla con `#cabeceraMas` (volver + título); Juegos es `#seccionJuegos` (botones `data-juego`), Alarma `#seccionAlarma` y Config una lista (`#seccionConfig` / `#grupoConfig`, `data-config` = `cuenta` | `tv` | `ayuda` | `legal`) cuyos apartados (`#configCuenta`, `#configTV`, `#configAyuda`, `#configLegal`) vuelven a la lista. Las páginas `ayuda.html`, `terminos.html` y `licencias.html` (como `privacidad.html`) se abren desde Config.
- Cada pantalla son `.campo` con un `.rotulo` corto; filas con interruptor: `.fila-ajuste-simple`; nombre + Guardar: `.fila-guardar-inline`.
- Galería: `#seccionGaleriaFinal` (herramientas) antes de `#seccionGaleria` (grillas); `data-subvista` lo maneja `actualizarVistaGaleria()`.
- Canciones: `.fila-cancion` con `#seleccionCancion`, `#cargadorMusical` (input de `.ino`, múltiple) y `#botonBorrarMusical`; control `#grupoLetra` (`data-valor` `con` | `sin`); `#inputRepeticiones`; `#avisoCancion`.
- Colores: `--acento` `#4DD2FF` (el de la OLED) para textos e íconos; `--acento-relleno` `#50C5EC` para rellenos grandes.

## 4. Contrato con el firmware (NO CAMBIAR sin aprobación)

Detalle byte a byte en [docs/formatos-datos.md](docs/formatos-datos.md).

> **Desde el 2026-11-11 (cuentas):** lo que sigue describe el FORMATO, que no cambió. Las RUTAS ahora son por cuenta: `oled_remota` vive en `dispositivos/{id}/oled_remota` (cada TV tiene su id) y `imagenes` / `animaciones` en `usuarios/{uid}/imagenes|animaciones`. `musicales` no cambió de ruta. Ver "Reglas de Firebase" más abajo y `docs/formatos-datos.md` sección 6.

- `oled_remota` = `{ version, lastSeen, archivo?, pantalla: { tipo, texto, config{tamano,alineacion,alineacionV,invertido,modoTexto,fuente,manual,x,y,direccion}, imagen{ancho,alto,datos} | cancion{nombre,repeticiones,notas} | animacion{nombre,ancho,alto,cuadros[{datos,dur}] | formato:"z1",cantidad} | musical{nombre,repeticiones,formato:"m1"} } }`
- `tipo`: `texto` | `imagen` | `cancion` | `animacion` | `musical` | `juego` | `alarma` | `ajustes` (`juego` = orden "abre este juego" con `pantalla.juego.id`; `alarma` y `ajustes` = órdenes "vuelve a leer `dispositivos/{id}/alarma`" / "`…/ajustes`"; aprobados 2026-11-14, detalle en `docs/formatos-datos.md`). Solo va el sub-objeto del tipo actual: desde el 2026-11-10 un texto ya no lleva la imagen anterior (`pantalla.imagen`). Dibujo y Galería se envían como `imagen`; un GIF como `animacion`.
- `enviarEstado` usa **`update()`** sobre `oled_remota` (escribe `version`, `pantalla` y `archivo` sin borrar `lastSeen`). `version` es un número nuevo en cada envío; el firmware solo descarga cuando cambia.
- `oled_remota/contadorVersion` (aprobado 2026-11-10): entero que reserva el número de cada envío con una transacción (`max(contador, version) + 1`), justo antes del `update()`. Así dos envíos nunca salen con la misma `version`. `version` se sigue escribiendo solo en el `update()`, junto con `pantalla` y `archivo`. La TV no lo lee; si falta, arranca desde `version`.
- `oled_remota/version = -2` (aprobado 2026-11-12, `VERSION_DESVINCULADA`): señal de "esta TV fue desvinculada". La deja el panel en el mismo `update()` que quita al dueño; la TV ya escucha esa ruta con su streaming y muestra un código nuevo. Una versión real nunca es negativa; un firmware viejo la toma como una versión más.
- `oled_remota/mostrada` (aprobado 2026-11-15, **reglas SIN publicar**): entero = la `version` que la TV ya aplicó; la escribe solo la TV (acuse de recibo). Ver `docs/formatos-datos.md`.
- `dispositivos/{id}/apodos/{uid}` (aprobado 2026-11-17, **reglas SIN publicar**): texto de 1 a 20 caracteres = el nombre que el DUEÑO le pone a cada persona con acceso (miembro). Solo el dueño lo escribe; dueño, miembros y la TV lo leen (la TV no lo usa: sin cambio de firmware). Se borra al quitar, salir o desvincular. Si falta se muestra "Persona N". Si las reglas aún no lo incluyen, el panel repite las escrituras de quitar, salir y desvincular sin él (`actualizarConRespaldoDeApodos`). Ver `docs/formatos-datos.md` sección 6.
- `oled_remota/lastSeen`: heartbeat que escribe el ESP cada 10 s; la web solo lo lee (en línea si tiene menos de 25 s).
- `config.fuente` (aprobado): `clasica` | `sans` | `sansb` | `serif` | `serifi`. Si falta = `clasica`. El panel usa `sans` por defecto.
- `config.manual`, `config.x`, `config.y` (aprobados): posición manual del bloque de texto. `config.tamano` 1..5 (en las fuentes nuevas 6/10/12/16/18 pt).
- `config.direccion` (aprobado): `h` | `v`; con `modoTexto = "scroll"`, `v` es scroll vertical. Si falta = `h`.
- **Animaciones comprimidas `z1`** (aprobado): `pantalla.animacion = {nombre, ancho, alto, formato:"z1", cantidad}` sin `cuadros`; los cuadros van en `oled_remota/archivo = {version, datos}` (misma `version`, mismo `update()`). `datos` = Base64 de, por cuadro, `[uint32 dur][uint16 bytes][deflate-raw del bitmap 1bpp]`, little-endian, sin pérdida. Sin CompressionStream se envía el formato viejo (`cuadros`), que el firmware sigue aceptando.
- **Musicales `m1`** (aprobado): `pantalla.musical = {nombre, repeticiones, formato:"m1"}`; la grabación va en `oled_remota/archivo = {version, datos}` (forma anterior). **Por referencia, H-22 (aprobado 2026-11-16; reglas publicadas y firmware grabado, probado en la TV real):** `pantalla.musical.clave` = clave de `musicales/datos/<clave>`; con ella el panel no manda `archivo` (null) y la TV baja la grabación del catálogo. Sin `clave` todo sigue como antes. Orden de puesta en marcha: **reglas → firmware → panel/APK** (panel nuevo + firmware viejo = el musical no suena). Ver `docs/musicales.md`.
- Con otro tipo de contenido, `archivo` se borra (`null`).
- Fuente clásica: glcdfont en orden CP437; tildes/ñ/¿/¡ con la tabla `LATIN1_A_CP437` (igual en `fonts.js` y en `texto.cpp` del firmware).
- Peso: el firmware ESP32-S3 baja animaciones y musicales directo a LittleFS (~7,9 MB). Aviso de GIF por tamaño comprimido (`evaluarPesoComprimido`): sin aviso ≤ 256 KB, amarillo hasta 1 MB, rojo > 1 MB. El límite es el tiempo de descarga (estimado 50-150 KB/s), no el espacio. Solo avisa, no bloquea. El firmware anota el tiempo real en el log `[github] … en N ms`.

### Catálogos (hermanos de `oled_remota`; el ESP no los lee)
- `imagenes/<clave>` = `{datos, ancho, alto, meta, preprocesada?}`
- `animaciones/<clave>` = `{ancho, alto, cuadros, meta}`; los GIF llevan `meta.origen: "gif"` (lista GIF de la Galería).
- `imagenes_indice/<clave>` y `animaciones_indice/<clave>` (en `usuarios/{uid}/` y en `biblioteca/`; aprobados 2026-11-15, **reglas SIN publicar**): lista liviana de la Galería, escrita junto al elemento. Ver `docs/formatos-datos.md`.
- `canciones/<clave>` = `{notas, meta}`: catálogo viejo de canciones de solo ritmo. **Borrado el 2026-11-10** a pedido del dueño; el respaldo está en `C:\Proyectos\TV_RETRO-respaldos\canciones-2026-11-10.json`. Las funciones de `firebase.js` que lo usan se conservan (regla: no borrar funciones). La sección de canciones de `carga-masiva.html` está oculta (sus funciones siguen).
- `musicales/indice/<clave>` = `{nombre, archivo, duracion, repetir, imagenes, bytes, origen:"ino", fecha}` y `musicales/datos/<clave>` = Base64 m1 (aprobado). La clave es el nombre del archivo sin `.ino`.

### Reglas de Firebase
- **Publicadas el 2026-11-11 (con cuentas):** `database.rules.json` es la copia de lo publicado. Estructura: `dispositivos/{id}` (`dueno`, `codigoUsado`, `oled_remota`), `usuarios/{uid}` (`dispositivos`, `imagenes`, `animaciones`), `emparejamiento/{codigo}`, `administradores/{uid}` y `musicales` (lee quien tenga sesión, escribe un administrador). Cada cuenta solo ve lo suyo; la TV tiene su propia cuenta con el claim `dispositivo`. Las reglas abiertas anteriores están en `database.rules.antiguas.json` y las de cuentas SIN límites (versión del 2026-11-11) en `database.rules.sin-limites.json`, para volver atrás. Desde el 2026-11-12 `database.rules.json` incluye el límite de 25 elementos y 10 GIF, la biblioteca predeterminada y la forma/tamaño de lo guardado. Desde el 2026-11-12 (tarde) incluye también miembros e invitaciones (publicadas por el dueño); las anteriores a eso están en `database.rules.sin-miembros.json`. Desde el 2026-11-14/15 incluye también `juego`, `alarma` y `ajustes` (publicadas por el dueño; las anteriores en `database.rules.sin-juegos.json`, `…sin-alarma.json` y `…sin-ajustes.json`).
- **Cómo se vincula una TV (2026-11-12, hecho y probado de punta a punta con la TV real: desvincular, código automático, vincular, compartir con una segunda cuenta):** la TV muestra SOLA su código de 6 caracteres (`A-HJ-NP-Z2-9`) mientras no tenga dueño (vence a los 10 min; si no se usa genera otro; luego pide reiniciar con un aviso que rebota); el cliente lo escribe en Mi TV. Ya no hay gesto de pulsado largo. **Compartir:** una TV tiene un dueño y hasta 5 miembros que entran con un código de invitación (10 min, un solo uso); un miembro envía, solo el dueño desvincula, invita y quita (`dispositivos/{id}/miembros`, `invitaciones/{codigo}`; la desvinculación avisa a la TV con `oled_remota/version = -2`). Detalle en `docs/formatos-datos.md` sección 6. Las TV nuevas se fabrican con `herramientas/fabricar-tv.cjs` del repo del firmware; los datos viejos se migraron con `herramientas/migrar-datos.cjs`. Guía y plan de vuelta atrás: `docs/seguridad-puesta-en-marcha.md`.
- El panel usa cuentas por defecto (`USAR_CUENTAS` en `main.js`); el modo viejo solo existe para las pruebas locales (`?sincuentas=1`). Pruebas de reglas con el emulador de Firebase en `pruebas/` (`reglas*.mjs`, `simular-tv.cjs`, `probar-migracion.cjs`); necesitan **Node 22** y JDK 21 (Node 26 se cae en este equipo).
- `carga-masiva.html` (herramienta del dueño) pide iniciar sesión y guarda en el catálogo de esa cuenta (`usuarios/{uid}/imagenes|animaciones`); sin sesión el contenido queda bloqueado. Prueba: `carga-masiva-cuentas.mjs`.

## 5. Estado actual (2026-11-10)

- Rediseño tipo app: terminado.
- Firmware ESP32-S3: texto con todas las fuentes, imágenes, dibujos, canciones, GIF z1, tildes, streaming de Firebase, dos núcleos. Probado en la placa.
- **Musicales: terminado y probado en la TV (2026-11-10).**
  - Panel: `0a44f6f`, `ce77fa2`, `22910fa`; las 57 canciones están importadas en `musicales/`.
  - Firmware: `54dce85` grabado en la placa. Con letra, sin letra y el botón funcionan (confirmado por el dueño); 9 envíos seguidos sin fuga de memoria (heap libre estable, 96–102 KB).
  - Sin push en ninguno de los dos repos desde estos commits.
- La canción `tv_lanavedelolvido` no es importante para el dueño (puede ignorarse si da problemas).
- **Auditoría y arreglo de bugs del panel (2026-11-10):** 7 arreglos de lógica (`2f6c37b` … `040e65a`, detalle en `docs/historial-cambios.md`, etapa 6). Push de `rediseno-app` hecho (todo hasta `cbd83a0`). Después: contador de versión, avisos de GIF para el S3 y código y CSS repetidos unificados (`714dc23` … `6dfced9`). Firmware `be2c5b6`: log con el tiempo de descarga (grabado en la placa junto con `66c49c2`). Detalles menores (2026-11-10): pestaña Canciones, "tú" en vez de voseo, mensaje "Ya va camino a la TV", todas las canciones respetan Repeticiones (firmware `66c49c2`, grabado en la placa y probado por el dueño), `carga-masiva.html` sin canciones, texto sin la imagen anterior. Umbral `>` (simple) / `>=` (Atkinson): se deja como está, igual que el simulador (decidido por el dueño). Comentarios viejos del código puestos al día (`18ac19d`). La seguridad de Firebase se deja para más adelante (aún no está en producción); primero se afirma el funcionamiento. Optimizaciones hechas (`7e587dc` … `ba7f2ce`, detalle y mediciones en `docs/historial-cambios.md`): trazo del Dibujo, Galería, scroll, slider de GIF, caché de canciones y pintado de bitmaps. Galería (escucha con `onValue`, `c831dff`) y arranque (`62be6db`) también hechos, sin cambiar formatos. A prueba de usuarios impacientes (`b4e672c` … `6ca421a`, detalle en `docs/historial-cambios.md`): arranque bloqueado, subidas tardías, guardar/borrar/importar sin repetirse ni colgarse, mensajes claros, red de seguridad y doble toque. Límite de pasos del intérprete de `.ino` bajado de 400 M a 20 M (`eeeeb54`), `inert` fijo en `index.html` (`ebc30ee`, `defdcab`) y página sin scroll a 360×740 (`91593e8`). El Web Worker y lo de `carga-masiva.html` se descartaron (no hacen falta). Pendiente: probar un GIF grande en la placa (leer el log `[github] … en N ms`). Próximo: seguridad y cuentas de Firebase, juegos en el firmware, mando por el celular, anuncios y límites, y probar la APK con Capacitor.
- **Seguridad y cuentas (2026-11-11): HECHO y funcionando.** Reglas publicadas, TV con su cuenta (firmware con modo cuentas grabado, `9f37ef6`), datos migrados (29 imágenes y 9 animaciones a la cuenta del dueño), panel con login, Mi TV y rutas por cuenta. Probado por el dueño: entra, ve su TV y envía contenido. **Paso 8 (límite de 25 elementos por cuenta entre imágenes y GIF, y máximo 10 GIF; biblioteca predeterminada en `biblioteca/`, que solo un administrador puede borrar): reglas PUBLICADAS por el dueño el 2026-11-12 (`database.rules.json`, verificadas contra la consola) y las 29 imágenes y 9 animaciones del dueño COPIADAS a `biblioteca/`; las copias personales ya se quitaron (2026-11-12, con respaldo en `herramientas/salida/`); falta el push del panel a `main` (hasta entonces el panel publicado no aplica el límite y una cuenta normal no podría guardar) y reconstruir la APK.** Falta además: anuncios, juegos, mando por el celular, borrar o revocar la clave de servicio al terminar, y migrar la APK/GitHub Pages (el panel publicado en GitHub Pages y la APK aún usan el código viejo hasta el próximo push y build).
- **Sesión del 2026-11-12 (cierre, TODO subido a `main` de los dos repos):**
  - Paso 8 puesto en marcha (límites 25 + 10 GIF, biblioteca predeterminada, copias personales quitadas, clave de servicio borrada por el dueño).
  - **Compartir una TV:** una TV tiene un dueño y hasta 5 miembros (invitación de 10 min y un solo uso). Reglas publicadas por el dueño (`database.rules.json` = lo publicado; las anteriores en `database.rules.sin-miembros.json`), panel con Compartir/Salir/Quitar. Probado con una segunda cuenta real: ambas envían a la misma TV.
  - **Vinculación automática:** la TV muestra sola su código si no tiene dueño (sin gesto de pulsado largo); la desvinculación llega con `oled_remota/version = -2`. Probado de punta a punta con la TV real (`rt3gkm4u6j`).
  - **Entrada unificada** (botón A, botón de la rueda y rueda) y **modo Juegos** con 5 juegos (Snake, Breakout, Flappy, Invaders, Jump) probados por el dueño. Ver `docs/juegos-y-controles.md`. **4 de los 5 derivan de un repo sin licencia: reescribirlos antes de vender.**
  - **APK nueva** (con Compartir) compilada e instalada en el teléfono del dueño (build debug; `ANDROID_HOME` y JDK 21 portable hacen falta para compilarla).
- **Sesión del 2026-11-12 al 2026-11-15 (cierre, TODO subido a `main` de los dos repos el 2026-11-15; APK de depuración nueva en el teléfono del dueño):**
  - **Arreglos de la auditoría (Etapas 1 a 5):** reglas cerradas y publicadas, correo verificado, Google (web y nativo), APK lista para publicar y que abre sin internet, botón Atrás, TLS verificado y portal Wi-Fi con clave en el firmware, baja de cuenta y política de privacidad.
  - **Funciones nuevas:** pestaña **Más** (menú Galería | Juegos | Alarma | Config), **juegos desde la app** (`tipo "juego"`), **Alarma** (hasta 3, tono de canción, la TV la guarda y suena sin celular; 12 h; se calla al minuto), **Config** (Mi cuenta; Ajustes de la TV: brillo, volumen y zona horaria con el campo nuevo `dispositivos/{id}/ajustes`; Ayuda y contacto; Legal con `ayuda.html`, `terminos.html` y `licencias.html`).
  - **Firmware:** `sonido.cpp` (todos los sonidos con PWM propio y volumen), `alarma.cpp`, `ajustes.cpp`. **Hardware:** el buzzer ahora va detrás de un transistor NPN (esquema en el `README.md` del firmware; las TV nuevas deben llevarlo).
  - **Probado por el dueño en teléfono y TV reales:** todo lo anterior, el portal Wi-Fi con clave y 9 envíos seguidos del mismo GIF con la memoria estable (~105 KB libres). Banco completo de pruebas en verde (31 suites; detalle en `docs/auditoria-alcance.md` sección 5).
  - **Auditoría final:** lo hecho en esta sesión NO está auditado por un tercero; `docs/auditoria-alcance.md` dice exactamente qué auditar y qué no.
- **Auditoría independiente del 2026-11-15 (zona B) y sus arreglos (misma fecha):** informe en `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-15.md` (hallazgos H-28 a H-50; las sondas y capturas están junto a él). Banco completo en verde (31 suites). Arreglado y commiteado, **sin push y con el firmware compilado pero NO grabado ni probado en la TV**: panel `ea3deaa` (H-35), `96c8c6e` (H-34), `3b7a12a` (H-39), `5b733cf` (H-29 y H-37); firmware `3d2e198` (H-28, la TV quedaba muda tras Juegos), `cfa6b89` (H-30 y H-33), `b193e51` (H-32, H-33, H-34 y H-38). Pruebas nuevas FUERA del repo: `auditoria-b.mjs` y `reglas-desvincular.mjs` (ya en `todo-el-banco.sh`). Siguen abiertos H-31 y H-36 (decide el dueño) y el resto de la lista (ver `docs/auditoria-alcance.md` sección 2b).
- **Segunda tanda de la auditoría (2026-11-15, panel y APK):** H-15, H-16 (goma en Dibujo), H-23, H-24, H-27, H-40/H-41, H-46, H-50 y H-51 (nuevo: un miembro podía romper la vista previa del dueño), commits `b3f85cd` … `fd44969`; sin push todavía. La lectura línea por línea de `renderer.js`, `imageProcessor.js`, `ui.js` y `carga-masiva.html` quedó hecha. Detalle en `docs/auditoria-alcance.md` sección 2b.
- Las funciones `listar*` de `firebase.js` devuelven `null` si no se pudo leer y `{}` si el catálogo está vacío.

## 6. Fases
1. HECHO: rediseño visual tipo app IoT.
2. EN CURSO: firmware ESP32-S3 al día con el panel + musicales.
3. PENDIENTE: ~~login + reglas por UID~~ (hecho el 2026-11-11), límites por cuenta, tutorial guiado, actualización por Wi-Fi (OTA; la tabla de particiones ya la deja preparada), APK Android con Capacitor.
   - APK (en curso, `app-android/`): ver `docs/historial-cambios.md`, etapa 7. En la web el lienzo expandido usa pantalla completa y `screen.orientation.lock`; dentro de la APK (`enApp()` / `pluginNativo()` en `main.js`) se usan los plugins `ScreenOrientation` y el propio `PortapapelesImagen`. `copiar-web.mjs` quita `viewport-fit=cover` de la copia de la APK (no del `index.html`).

## 7. Cómo probar
- Servir por HTTP (los módulos ES no cargan con file://): `npx serve .` y abrir la URL. En esta máquina `python` es el alias de la Microsoft Store y se cuelga: no usarlo.
- `node --check js/<archivo>.js` antes de cada commit.
- Probar cada pestaña; consola del navegador sin errores; medir el "sin scroll" en 390×844 y 360×740.
- Banco de pruebas (DENTRO del repo, `pruebas/` desde el 2026-11-15; ver su `README.md`; Firebase simulado en memoria, no toca la base real): `pruebas-panel.mjs` (escenarios de funcionamiento), `bobos.mjs` (usuario impaciente: pulsar de más, cambiar de pestaña, sin señal, archivos malos) (y `mono.mjs`, usuario al azar con semilla, que sigue solo en la carpeta externa `C:\Proyectos\pruebas-tv-retro`). Uso, desde `pruebas/`: `node <archivo>.mjs [nombre…]`.
- El panel usa la base de datos REAL: Enviar y Guardar escriben en Firebase. Verificar en la consola de Firebase que `oled_remota` no cambió de forma.
- Firmware: ver `CLAUDE.md` y `README.md` del repo del firmware (Arduino IDE o arduino-cli, puerto USB "UART", monitor serie a 115200 con logs `[wifi]`, `[red]`, `[github]`).

## 8. Documentación
- [docs/contexto-general.md](docs/contexto-general.md): el proyecto completo (historia, arquitectura, flujo, hardware, decisiones).
- [docs/formatos-datos.md](docs/formatos-datos.md): árbol de Firebase, formatos z1 y m1, reglas.
- [docs/musicales.md](docs/musicales.md): canciones con letra (importar `.ino`, grabar, enviar, reproducir).
- [docs/historial-cambios.md](docs/historial-cambios.md): todos los cambios de los dos repos, en orden.
- [docs/rediseno-cambios.md](docs/rediseno-cambios.md): el rediseño, pestaña por pestaña.
- [docs/firmware-fuentes.md](docs/firmware-fuentes.md): especificación de fuentes, posición manual y scroll.
- [docs/juegos-y-controles.md](docs/juegos-y-controles.md): controles (botón A, rueda, botón de la rueda), modo Juegos, arquitectura, licencias de los juegos y pendientes.
- [docs/seguridad-puesta-en-marcha.md](docs/seguridad-puesta-en-marcha.md): pasos 7, 8 y 9 de cuentas, límites y compartir; plan de vuelta atrás.
- [docs/auditoria-alcance.md](docs/auditoria-alcance.md): **LEERLO ENTERO antes de auditar.** Divide el proyecto en tres zonas: A (ya auditado en 2026-11-12: no repetir), B (todo lo hecho en la sesión 2026-11-12 → 11-15: auditar) y C (lo que se haga después, registrado en su sección 8: auditar). Trae además el estado de los 27 hallazgos, las pruebas y lo que falta.
- **Al hacer un cambio, actualizar la documentación que corresponda** (este archivo si cambia una regla, el contrato o el estado; `historial-cambios.md` siempre).

## 9. Panorama pendiente (al 2026-11-15, para retomar en otra conversación)

Lo hecho está en la sección 5, en `docs/historial-cambios.md` y en `docs/auditoria-alcance.md`. Lo que FALTA, por área (el dueño decide el orden; antes de cualquier campo nuevo de Firebase hay que proponerlo y aprobarlo):

**ESTADO AL 2026-11-16 (cierre de la sesión larga) Y QUÉ SIGUE**
- **Todo subido y en producción:** panel `9b4f914` (`rediseno-app` y `main`), firmware `7b0c2a2` (grabado en la TV con el acuse de recibo), reglas publicadas por el dueño (`mostrada`, `imagenes_indice`, `animaciones_indice`; la copia de vuelta atrás es `database.rules.sin-acuse-indice.json`), APK de depuración instalada. Banco completo en verde (31 suites + intérprete) y la CI de GitHub en verde. Probado por el dueño en teléfono y TV reales: acuse de recibo, Galería liviana, guardar y borrar.
- **Hecho el 2026-11-16 (sesión de H-13, H-21 y H-22), TODO subido a `main` de los dos repos (panel `f20f449`, firmware `10c53cf`):** H-13 (`main.js` partido en `mas.js`, `cuentas.js`, `galeria.js` y `canciones.js`; queda en ~2 030 líneas), H-21 (fuentes locales y CSP), H-22 (musical por referencia: reglas publicadas, firmware grabado y probado en la TV real con y sin letra, repeticiones, texto después de un musical y alarma con tono), fin de los avisos `willReadFrequently` de la consola y arreglo del propio banco (ya no se cuelga ni confunde un emulador caído con "0 fallas"). APK de depuración con todo instalada en el teléfono. **Siguiente conversación, en este orden: (1) detalles menores abiertos (H-47, H-48, H-49, lo que queda de H-15, H-24 y H-26, miembros con nombre, opción de administrador en `carga-masiva.html`, plantilla de correos de Firebase, y comprobar la CI de GitHub); (2) H-19 (OTA y restablecimiento de fábrica; H-47 se hace con él); (3) evaluar la viabilidad de hacer el resto (Wi-Fi por Bluetooth, mando por el celular, QR, tutorial guiado, anuncios, H-20) y proponérselo al dueño. Fuera de alcance de Claude: `ENTRADA_LOG` a 0, keystore/paquete/AAB, abogado, buzzer con transistor y los 4 juegos sin licencia (H-01, H-44).** **Lección:** antes de probar un cambio de firmware en la TV, comprobar con el monitor serie que la placa lleva el firmware nuevo (el 2026-11-16 la placa tenía el anterior y el musical con letra "no llegaba"; el registro mostraba `archivo de la versión -1 (se esperaba N)`, la ruta vieja).
- **Conversación aparte, antes de vender:** `ENTRADA_LOG` a 0 en el firmware de producción; respaldar el keystore y confirmar nombre y paquete de la APK (luego el AAB para Google Play); revisión de un abogado (preguntas en el informe de la auditoría); fabricar las TV con el buzzer detrás del transistor; H-20 (cifrado de flash, al fabricar en serie); H-44 (id fijo de los juegos, junto con su reescritura), H-47 (aviso del tamaño del slot OTA), H-48 (más zonas horarias) y H-49 (fechas de certificados en TLS).
- **Lo último:** reescribir los 4 juegos sin licencia (H-01).
- **Lecciones de trabajo para no repetir:** (1) compilar la APK exige `node copiar-web.mjs` Y `npx cap sync android`, y comprobar el APK con `unzip -p`; (2) los archivos del repo mezclan CRLF y LF: editar con herramientas que respeten el salto de línea de cada archivo; (3) nunca elegir bloques de un diff por número después de un commit (se desplazan): elegirlos por contenido o commitear por archivo; (4) los resúmenes del banco deben contar también las líneas `PROBLEMA`.

**Auditoría 2026-11-15: decisiones tomadas (el dueño, 2026-11-15)**
- **H-31 (opción b, sin campos nuevos):** la TV guarda en `/ultimo.json` lo último que mostró (texto, imagen, GIF o musical) y, si al encender Firebase solo trae una orden (alarma, ajustes, juego), lo repone (`ultimo.cpp`, firmware `7410d43`). Limitación aceptada: el panel, al recargar, sigue abriendo en Texto. Si más adelante se quiere arreglar también el panel, la opción (c) es un campo nuevo `oled_remota/orden` aparte de `pantalla` (necesita aprobación).
- **H-36:** sin Wi-Fi al encender, con redes guardadas, la TV sigue funcionando (juegos) y reintenta las redes cada 30 s; el portal se abre solo la primera vez o al mantener 5 s el botón de la rueda sin Wi-Fi (firmware `3ec3784`; texto en `ayuda.html`).

**Siguiente: JUEGOS (conversación aparte)**
- Reescribir desde cero Snake, Breakout, Flappy e Invaders (derivan de un repo sin licencia, `chifunt/phone-project`; Jump es Unlicense y se queda), pulir tiempos y estética, récords en NVS, botón A capacitivo. Detalle en `docs/juegos-y-controles.md`. La carpeta `Juegos/` del firmware (sketches originales del dueño) sigue sin versionar.

**RECORDATORIO — Subir la APK a Google Play (para el final):**
- Cuando el dueño avise, en una conversación nueva, que va a subir la app a Play Store, **Claude lo ayuda a empaquetarla en el formato que Google exige (AAB firmado)**. El dueño lo pidió expresamente (2026-11-15): no dejar pasar este paso.
- Guía y estado en `docs/apk-publicacion.md` (`gradlew bundleRelease`, clave de subida `C:\Proyectos\TV_RETRO-claves\tvretro-subida.jks`). Antes: **confirmar nombre y paquete** (`com.tvretro.app` es provisional y no se puede cambiar después de publicar), respaldar el keystore y `keystore.properties` fuera de este equipo, registrar en Firebase la huella SHA-1 de Play App Signing, probar el AAB en la pista interna y revisar la política de privacidad y los términos con un abogado.

**Otros detalles antes de vender**
- `ENTRADA_LOG` a 0 en el firmware de producción (`entrada.h`).
- Fabricar las TV con el buzzer detrás del transistor (ver `README.md` del firmware).
- Alerta de presupuesto en Firebase si se pasa a Blaze.
- Correos de Firebase caen en spam: plantilla en español con remitente "TV RETRO" y, a futuro, dominio propio con SPF/DKIM.

**Panel y app**
- **Configuración de Wi-Fi por Bluetooth** desde la app y vinculación automática (decidido el 2026-11-14; web e iOS conservan el portal).
- **Miembros con nombre:** HECHO el 2026-11-17 (apodos que pone el dueño en `dispositivos/{id}/apodos`; reglas pendientes de publicar). El límite de 5 lo sigue aplicando solo el panel.
- **QR** en vez de escribir el código (dibujo difícil en la OLED 128×64).
- **Tutorial guiado** (por eso las pestañas no llevan textos explicativos).
- **Anuncios con recompensa:** necesitan un servidor que verifique el anuncio (idea: Cloudflare Worker); sin diseñar.
- **`carga-masiva.html`:** HECHO el 2026-11-17: un administrador ve un interruptor "Biblioteca predeterminada" y, con él, sube imágenes y animaciones a `biblioteca/` (con su lista liviana, con aviso de que las verán todas las cuentas) y gestiona (renombrar, borrar) las animaciones de la biblioteca. Sin campos nuevos.
- Calidad y arquitectura (hallazgos abiertos de la auditoría): H-12 (hecho), H-15 (parcial), H-18 (pruebas dentro del repo y CI: comprobar que corra en verde en GitHub), H-24 (parcial) y H-26. H-13, H-16, H-21, H-22, H-23 y H-27 están hechos.

**Firmware**
- **Mando por el celular** (WebSocket local o BLE), **OTA** (la tabla de particiones ya la deja preparada), **restablecimiento de fábrica / reventa** (si el dueño pierde su cuenta no hay forma de soltar la TV sin tocar la base), acuse de recibo de la TV (H-06), **fabricación a escala** (hoy cada TV se fabrica por cable con `herramientas/fabricar-tv.cjs`, con clave de servicio temporal).

**Operación y entorno**
- Pruebas DENTRO del repo, en `pruebas/` (desde el 2026-11-15, con CI en `.github/workflows/pruebas.yml`; 31 suites; lista y resultados en `docs/auditoria-alcance.md` sección 5). Necesitan **Node 22** (Node 26 se cae) y el JDK de Android Studio (`C:\Program Files\Android\Android Studio\jbr`) para los emuladores. Una corrida cortada puede dejar un `tv.mjs` ocupando el puerto 8765: cerrarlo antes de repetir. Cómo correrlas: **todo el banco** con `bash pruebas/todo-el-banco.sh` (deja una línea por suite; el detalle de cada una en `/tmp/b-<suite>.txt`; tarda ~40 min: lanzarlo como proceso aparte para que no se corte). **Monitor serie de la TV:** `powershell -File C:/Proyectos/pruebas-tv-retro/escuchar-serie.ps1 > archivo.txt` (escribe a la salida estándar; correrlo en segundo plano y redirigir). Abrir el puerto reinicia la TV.
- Compilar la APK: **SIEMPRE los dos pasos** `node copiar-web.mjs` Y `npx cap sync android` en `app-android` (sin el `cap sync` la APK sigue llevando el panel anterior: pasó el 2026-11-16), y comprobar el resultado con `unzip -p app-debug.apk assets/public/js/<archivo>.js | grep <texto nuevo>`; luego Gradle 9.5 (`assembleDebug`, `--offline`) en `app-android/android` con `JAVA_HOME` del JDK de Android Studio y `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`; `adb install -r`.
- Compilar y grabar el firmware con `arduino-cli` (`esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom`, puerto COM6; a veces falla por "CreateProcess" o "Access is denied": reintentar con `--jobs 1`). **Abrir el puerto serie reinicia la TV.**
- La hora de Windows se desfasó 5 h una vez (servicio de hora detenido): rompe la firma de la clave de servicio.
- Las herramientas que usan el Admin SDK necesitan una clave de servicio nueva (la anterior se borró); generarla y borrarla al terminar.
