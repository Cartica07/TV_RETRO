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

### Código
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
- **Cada pestaña (salvo las grillas de Galería) entra SIN scroll** en celulares de 390×844 y 360×740. Se mide comparando el final de `main.controles` con el borde superior de `.barra-accion`.
- La vista previa de la OLED en el panel debe ser **pixel-perfect** con lo que dibuja el firmware (mismas fuentes, mismos cortes de línea, mismos tiempos de scroll).

## 3. Archivos del panel

- `index.html` + `js/main.js` (orquestador: estado, eventos, vista previa, envío) + `js/ui.js` (IDs del DOM y ayudas visuales).
- `js/firebase.js`: único acceso a Firebase.
- `js/renderer.js` + `js/fonts.js`: réplica de la OLED con la fuente clásica 5×7 (glcdfont, orden CP437; tabla `LATIN1_A_CP437` para tildes/ñ/¿/¡).
- `js/fuentesTexto.js` + `js/fuentesGfx.js`: fuentes FreeSans/FreeSerif (GFXfont, generadas desde CancionesMiniTV/fuentes.js).
- `js/imageProcessor.js` (difuminado Atkinson, encuadre: escala/fondo/rotar/voltear), `js/gif.js` (GIF → animación; avisos de peso), `js/dibujo.js`, `js/lienzoZoom.js` (zoom/expandido del lienzo de Dibujo; clase `body.dibujo-expandido`).
- `js/compresion.js`: formatos `z1` (animaciones) y `m1` (musicales).
- `js/inoMusical.js`: intérprete de los `.ino` de canciones (C reducido + SSD1306/buzzer virtuales, tiempo virtual) que graba notas y pantallas.
- `css/tokens.css` (colores, fuentes, medidas; compartido) y `css/style.css` (estilos del panel).
- `carga-masiva.html`: página aparte (no enlazada) para subir contenido en lote; usa `css/tokens.css` + estilos inline; su `<script>` inline no se toca en pasos visuales.
- `database.rules.json`: copia de las reglas de Firebase.
- `docs/`: documentación (ver sección 8).

### Estructura de index.html
- `.cabecera-fija` (barra superior + tarjeta `.dispositivo` con `#oled`, `#filaInvertido` y `#estadoLinea`), `main.controles` con una sección por pestaña, `.barra-accion` (Enviar) y `nav.nav-inferior`.
- La navegación inferior ES `#grupoTipo`: botones `data-valor` = `texto`, `imagen`, `dibujo`, `cancion`, `galeria`; los usa `cambiarTipo()` en main.js.
- Cada pantalla son `.campo` con un `.rotulo` corto; filas con interruptor: `.fila-ajuste-simple`; nombre + Guardar: `.fila-guardar-inline`.
- Galería: `#seccionGaleriaFinal` (herramientas) antes de `#seccionGaleria` (grillas); `data-subvista` lo maneja `actualizarVistaGaleria()`.
- Canciones: `.fila-cancion` con `#seleccionCancion`, `#cargadorMusical` (input de `.ino`, múltiple) y `#botonBorrarMusical`; control `#grupoLetra` (`data-valor` `con` | `sin`); `#inputRepeticiones`; `#avisoCancion`.
- Colores: `--acento` `#4DD2FF` (el de la OLED) para textos e íconos; `--acento-relleno` `#50C5EC` para rellenos grandes.

## 4. Contrato con el firmware (NO CAMBIAR sin aprobación)

Detalle byte a byte en [docs/formatos-datos.md](docs/formatos-datos.md).

> **Desde el 2026-11-11 (cuentas):** lo que sigue describe el FORMATO, que no cambió. Las RUTAS ahora son por cuenta: `oled_remota` vive en `dispositivos/{id}/oled_remota` (cada TV tiene su id) y `imagenes` / `animaciones` en `usuarios/{uid}/imagenes|animaciones`. `musicales` no cambió de ruta. Ver "Reglas de Firebase" más abajo y `docs/formatos-datos.md` sección 6.

- `oled_remota` = `{ version, lastSeen, archivo?, pantalla: { tipo, texto, config{tamano,alineacion,alineacionV,invertido,modoTexto,fuente,manual,x,y,direccion}, imagen{ancho,alto,datos} | cancion{nombre,repeticiones,notas} | animacion{nombre,ancho,alto,cuadros[{datos,dur}] | formato:"z1",cantidad} | musical{nombre,repeticiones,formato:"m1"} } }`
- `tipo`: `texto` | `imagen` | `cancion` | `animacion` | `musical`. Solo va el sub-objeto del tipo actual: desde el 2026-11-10 un texto ya no lleva la imagen anterior (`pantalla.imagen`). Dibujo y Galería se envían como `imagen`; un GIF como `animacion`.
- `enviarEstado` usa **`update()`** sobre `oled_remota` (escribe `version`, `pantalla` y `archivo` sin borrar `lastSeen`). `version` es un número nuevo en cada envío; el firmware solo descarga cuando cambia.
- `oled_remota/contadorVersion` (aprobado 2026-11-10): entero que reserva el número de cada envío con una transacción (`max(contador, version) + 1`), justo antes del `update()`. Así dos envíos nunca salen con la misma `version`. `version` se sigue escribiendo solo en el `update()`, junto con `pantalla` y `archivo`. La TV no lo lee; si falta, arranca desde `version`.
- `oled_remota/version = -2` (aprobado 2026-11-12, `VERSION_DESVINCULADA`): señal de "esta TV fue desvinculada". La deja el panel en el mismo `update()` que quita al dueño; la TV ya escucha esa ruta con su streaming y muestra un código nuevo. Una versión real nunca es negativa; un firmware viejo la toma como una versión más.
- `oled_remota/lastSeen`: heartbeat que escribe el ESP cada 10 s; la web solo lo lee (en línea si tiene menos de 25 s).
- `config.fuente` (aprobado): `clasica` | `sans` | `sansb` | `serif` | `serifi`. Si falta = `clasica`. El panel usa `sans` por defecto.
- `config.manual`, `config.x`, `config.y` (aprobados): posición manual del bloque de texto. `config.tamano` 1..5 (en las fuentes nuevas 6/10/12/16/18 pt).
- `config.direccion` (aprobado): `h` | `v`; con `modoTexto = "scroll"`, `v` es scroll vertical. Si falta = `h`.
- **Animaciones comprimidas `z1`** (aprobado): `pantalla.animacion = {nombre, ancho, alto, formato:"z1", cantidad}` sin `cuadros`; los cuadros van en `oled_remota/archivo = {version, datos}` (misma `version`, mismo `update()`). `datos` = Base64 de, por cuadro, `[uint32 dur][uint16 bytes][deflate-raw del bitmap 1bpp]`, little-endian, sin pérdida. Sin CompressionStream se envía el formato viejo (`cuadros`), que el firmware sigue aceptando.
- **Musicales `m1`** (aprobado): `pantalla.musical = {nombre, repeticiones, formato:"m1"}`; la grabación va en `oled_remota/archivo = {version, datos}`. Ver `docs/musicales.md`.
- Con otro tipo de contenido, `archivo` se borra (`null`).
- Fuente clásica: glcdfont en orden CP437; tildes/ñ/¿/¡ con la tabla `LATIN1_A_CP437` (igual en `fonts.js` y en `texto.cpp` del firmware).
- Peso: el firmware ESP32-S3 baja animaciones y musicales directo a LittleFS (~7,9 MB). Aviso de GIF por tamaño comprimido (`evaluarPesoComprimido`): sin aviso ≤ 256 KB, amarillo hasta 1 MB, rojo > 1 MB. El límite es el tiempo de descarga (estimado 50-150 KB/s), no el espacio. Solo avisa, no bloquea. El firmware anota el tiempo real en el log `[github] … en N ms`.

### Catálogos (hermanos de `oled_remota`; el ESP no los lee)
- `imagenes/<clave>` = `{datos, ancho, alto, meta, preprocesada?}`
- `animaciones/<clave>` = `{ancho, alto, cuadros, meta}`; los GIF llevan `meta.origen: "gif"` (lista GIF de la Galería).
- `canciones/<clave>` = `{notas, meta}`: catálogo viejo de canciones de solo ritmo. **Borrado el 2026-11-10** a pedido del dueño; el respaldo está en `C:\Proyectos\TV_RETRO-respaldos\canciones-2026-11-10.json`. Las funciones de `firebase.js` que lo usan se conservan (regla: no borrar funciones). La sección de canciones de `carga-masiva.html` está oculta (sus funciones siguen).
- `musicales/indice/<clave>` = `{nombre, archivo, duracion, repetir, imagenes, bytes, origen:"ino", fecha}` y `musicales/datos/<clave>` = Base64 m1 (aprobado). La clave es el nombre del archivo sin `.ino`.

### Reglas de Firebase
- **Publicadas el 2026-11-11 (con cuentas):** `database.rules.json` es la copia de lo publicado. Estructura: `dispositivos/{id}` (`dueno`, `codigoUsado`, `oled_remota`), `usuarios/{uid}` (`dispositivos`, `imagenes`, `animaciones`), `emparejamiento/{codigo}`, `administradores/{uid}` y `musicales` (lee quien tenga sesión, escribe un administrador). Cada cuenta solo ve lo suyo; la TV tiene su propia cuenta con el claim `dispositivo`. Las reglas abiertas anteriores están en `database.rules.antiguas.json` y las de cuentas SIN límites (versión del 2026-11-11) en `database.rules.sin-limites.json`, para volver atrás. Desde el 2026-11-12 `database.rules.json` incluye el límite de 25 elementos y 10 GIF, la biblioteca predeterminada y la forma/tamaño de lo guardado. Desde el 2026-11-12 (tarde) incluye también miembros e invitaciones (publicadas por el dueño); las anteriores a eso están en `database.rules.sin-miembros.json`.
- **Cómo se vincula una TV (2026-11-12, hecho y probado de punta a punta con la TV real: desvincular, código automático, vincular, compartir con una segunda cuenta):** la TV muestra SOLA su código de 6 caracteres (`A-HJ-NP-Z2-9`) mientras no tenga dueño (vence a los 10 min; si no se usa genera otro; luego pide reiniciar con un aviso que rebota); el cliente lo escribe en Mi TV. Ya no hay gesto de pulsado largo. **Compartir:** una TV tiene un dueño y hasta 5 miembros que entran con un código de invitación (10 min, un solo uso); un miembro envía, solo el dueño desvincula, invita y quita (`dispositivos/{id}/miembros`, `invitaciones/{codigo}`; la desvinculación avisa a la TV con `oled_remota/version = -2`). Detalle en `docs/formatos-datos.md` sección 6. Las TV nuevas se fabrican con `herramientas/fabricar-tv.cjs` del repo del firmware; los datos viejos se migraron con `herramientas/migrar-datos.cjs`. Guía y plan de vuelta atrás: `docs/seguridad-puesta-en-marcha.md`.
- El panel usa cuentas por defecto (`USAR_CUENTAS` en `main.js`); el modo viejo solo existe para las pruebas locales (`?sincuentas=1`). Pruebas de reglas con el emulador de Firebase en `C:\Proyectos\pruebas-tv-retro` (`reglas.mjs`, `simular-tv.cjs`, `probar-migracion.cjs`); necesitan **Node 22** y JDK 21 (Node 26 se cae en este equipo).
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
- Banco de pruebas (FUERA del repo, `C:Proyectospruebas-tv-retro`; Firebase simulado en memoria, no toca la base real): `pruebas-panel.mjs` (escenarios de funcionamiento), `bobos.mjs` (usuario impaciente: pulsar de más, cambiar de pestaña, sin señal, archivos malos) y `mono.mjs` (usuario al azar con semilla). Uso: `node <archivo>.mjs [nombre…]`.
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
- **Al hacer un cambio, actualizar la documentación que corresponda** (este archivo si cambia una regla, el contrato o el estado; `historial-cambios.md` siempre).

## 9. Panorama pendiente (al 2026-11-12, para retomar en otra conversación)

Lo hecho está en la sección 5 y en `docs/historial-cambios.md`. Lo que FALTA, por área (el dueño decide el orden; antes de cualquier campo nuevo de Firebase hay que proponerlo y aprobarlo):

**Panel y app**
- **Pestaña "Más"** (decidida): reemplaza a "Galería" en la barra inferior; adentro un selector de subvistas **Galería | Juegos | Alarma | Config**, con Galería por defecto y recordando la última usada. Cada subvista sin scroll en 390×844 y 360×740. Respetar la regla de no cambiar IDs ni `data-valor` existentes (se añade, no se renombra). Alarma y Config las pospuso el dueño: primero se hace "Más" con Galería y Juegos.
- **Juegos desde la app:** tarjetas con "Jugar" que abren el juego en la TV. Necesita campo nuevo (idea: `pantalla.tipo = "juego"`, nombre del juego); un firmware viejo debe ignorarlo. Proponer y aprobar antes.
- **Alarma:** vive en la TV (suena sin celular ni Wi-Fi): la app la configura (hora, días, tono), la TV la guarda en NVS y usa NTP. El tono es una canción de los musicales (se baja y guarda en LittleFS); el botón la silencia o pospone. Falta decidir: una o varias, días de la semana, posponer. Necesita zona horaria (va en Config).
- **Config:** zona horaria, volumen, nombre de la TV, brillo (a definir por el dueño).
- **Miembros con nombre:** hoy se ven como "Persona 1…5"; mejora posible: que el invitado ponga un nombre. El límite de 5 lo aplica solo el panel (las reglas no pueden contar hijos).
- **QR** en vez de escribir el código (dibujo difícil en la OLED 128×64; pendiente a futuro).
- **Tutorial guiado** (por eso las pestañas no llevan textos explicativos).
- **Anuncios con recompensa:** necesitan un servidor que verifique el anuncio (idea: Cloudflare Worker gratis que escribe `extra`/`extraAnimaciones` en `cuotas`); sin diseñar.
- **Anti abuso:** exigir correo verificado para guardar (no hecho).
- **Correos de Firebase caen en spam:** plantilla en español con remitente "TV RETRO" y, a futuro, dominio propio con SPF/DKIM antes de vender (el dueño revisa el costo).
- **`carga-masiva.html`:** opción de administrador para gestionar la biblioteca predeterminada ("luego las administro bien").
- **APK:** confirmar nombre y paquete antes de Play Store (ver memoria `capacitor-nombre-paquete`); falta una APK de release firmada. La instalada es de depuración.

**Firmware**
- **Juegos:** pulir tiempos y estética; reescribir Snake, Breakout, Flappy e Invaders (sin licencia; Jump es Unlicense); récords en NVS; botón A capacitivo; `ENTRADA_LOG` a 0 en producción. Detalle en `docs/juegos-y-controles.md`.
- **Mando por el celular** (WebSocket local o BLE).
- **OTA** (la tabla de particiones ya la deja preparada).
- **Restablecimiento de fábrica / reventa:** si el dueño pierde su cuenta, hoy no hay forma de soltar la TV sin tocar la base; hace falta un gesto físico o un comando por cable.
- **Fabricación a escala:** hoy cada TV se fabrica por cable con `herramientas/fabricar-tv.cjs` (clave de servicio temporal, que se borra al terminar). Si se venden muchas hay que automatizarlo.
- Pendiente menor: probar un GIF grande en la placa y leer el log `[github] … en N ms`.

**Operación y entorno**
- Pruebas FUERA del repo en `C:\Proyectos\pruebas-tv-retro` (hay un `.zip` de respaldo al lado): `pruebas-panel.mjs`, `bobos.mjs`, `mono.mjs`, `login.mjs` (12), `tv.mjs` (12), `compartir.mjs` (8), `cuotas.mjs` (15), `carga-masiva-cuentas.mjs` (6), `por-defecto.mjs`, y con el emulador: `reglas.mjs` (244 con `REGLAS_ARCHIVO=…database.rules.json`), `simular-tv.cjs` (19), `probar-migracion.cjs` (12), `probar-biblioteca.cjs` (5). Necesitan **Node 22** (Node 26 se cae) y **JDK 21 portable** (`…\Temp\jdk21-descarga`; si ya no está, volver a bajarlo) para los emuladores.
- Compilar la APK: `node copiar-web.mjs`, `npx cap sync android` y `./gradlew assembleDebug` en `app-android/android` con `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` y JDK 21; `adb install -r`.
- Compilar el firmware con `arduino-cli` a veces falla por "Access is denied", "CreateProcess" o un segfault del compilador (antivirus o poca memoria): reintentar, con `--jobs 2`.
- La hora de Windows se desfasó 5 h una vez (servicio de hora detenido): rompe la firma de la clave de servicio.
- Las herramientas que usan el Admin SDK necesitan una clave de servicio nueva (la anterior se borró); generarla y borrarla al terminar.
