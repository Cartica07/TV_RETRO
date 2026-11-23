# Historial de cambios

Todos los cambios del proyecto, en orden, en los dos repositorios. Se agrupan por etapa. Los hashes son de `git log`.

- **Panel:** github.com/Cartica07/TV_RETRO; se trabaja en la rama `rediseno-app`.
- **Firmware:** github.com/Cartica07/Firmware-TV-RETRO; se trabaja en la rama `esp32`.

**Mantener este archivo al día con cada cambio.**

---

## Etapa 1: origen del panel (jul–ago 2026)

Panel de una sola página, subido a GitHub a mano con commits de un solo archivo ("Update main.js", etc.). El firmware de entonces era para **ESP8266**, versiones V1.6 a V1.16, y no está en estos repos.

| Fecha | Qué se hizo |
|---|---|
| 2026-07-03 / 07 | Primer commit; panel modular: `main.js`, `firebase.js`, `ui.js`, `renderer.js`, `fonts.js`, `imageProcessor.js`. Vista previa pixel-perfect de la OLED, con muchos ajustes a `renderer.js` y `fonts.js` para igualar las métricas de Adafruit GFX. |
| 2026-07-08 / 09 | Ajustes de alineación vertical, estilos, imágenes 1bpp (umbral / Floyd-Steinberg). |
| 2026-07-15 | Catálogo de canciones, `carga-masiva.html` (carga en lote), mejoras de Firebase e imagen. |
| 2026-08-05 / 06 | Módulo **Dibujo** (`dibujo.js`): lienzo, deshacer/rehacer, guardar en la galería. **Galería** de imágenes. Invertido como fila global. El texto y su configuración se guardan siempre, para no perderlos al enviar otra cosa. Funciones para borrar canciones. |
| 2026-08-08 | **Animaciones:** subir, catálogo `animaciones/`, grilla en la galería, reproducción en bucle en la vista previa. |

## Etapa 2: rediseño tipo app del panel (7 nov 2026)

Todos los commits llevan mensaje en español y separan diseño de lógica.

### Base, reglas y mejoras de lógica
| Commit | Cambio |
|---|---|
| `34db7ed` | `CLAUDE.md`: contexto, contrato de datos y reglas. |
| `4d36d1a` | **Lógica:** `enviarEstado` usa `update()` en vez de `set()`; ya no borra `lastSeen`. |
| `3f12a61` | **Lógica:** Deshacer/Rehacer se apagan sin historial; se quitó un comentario duplicado. |
| `b6ea4d7` | Documentar el nombre visible **TV RETRO**. |
| `06a329d` | `CLAUDE.md`: probar con `npx serve` y `node --check`. |

### Diseño de la app
| Commit | Cambio |
|---|---|
| `fbb5ab4` | `css/tokens.css` con la paleta, las fuentes y las medidas; nombre TV RETRO. |
| `7f1184e` | Móviles: zonas seguras, `theme-color`, inputs sin zoom. |
| `6f712ef` | Estructura de app: cabecera fija, barra de Enviar, navegación inferior (`#grupoTipo`). |
| `16bfe36` | Íconos SVG en la navegación y en Dibujo. |
| `713468c`, `d7a9edd`, `bee8145`, `0ae3f58`, `c131608` | Rediseño de Texto, Imagen, Dibujo, Música y Galería. |
| `f2e1785` | Escritorio en dos columnas, desde 900 px. |
| `94fb570`, `b7c7d44` | Última señal del dispositivo ("hace 4 s"), primero el diseño y después la lógica. |
| `876cb50` | **Lógica:** al cambiar de pestaña se vuelve arriba; `aria-current`. |
| `43c301e` | `carga-masiva.html` con el estilo TV RETRO. |
| `8de9366`, `7a06844` | `CLAUDE.md`: estructura nueva y objetivo "sin scroll". |
| `270aad2` | Pantalla de inicio de sesión (solo diseño, oculta; falta la lógica). |
| `f4857c1` | Se quitaron los textos explicativos. |
| `a3d8b34`, `f283725` | Invertir y el estado del envío, dentro de la tarjeta del dispositivo. |
| `78d8c4f`, `5914054`, `e3dac08`, `9a993c1`, `0940556`, `1c4972c` | Pestañas compactas: todas entran sin scroll en 390×844 y 360×740; acento desaturado en los rellenos. |
| `b29e3a3`, `7ffe3f9`, `f042ad1` | Se ocultaron los datos internos (contador vN, "Firmware V1.6"); TV RETRO centrado. |

### Funciones nuevas
| Commit | Cambio |
|---|---|
| `2d3a54a` | Difuminado **Atkinson** y geometría (escala, rotar, voltear, fondo), portados de CancionesMiniTV. |
| `333f6d3`, `0755168`, `ecfce49` | **GIF animado → animación** (`js/gif.js`); encuadre en Imagen; lista GIF en la Galería (`meta.origen: "gif"`). |
| `8e04ed2`, `a75adb4`, `4b17cf1` | Aviso de GIF pesado; GIF también desde el + de la Galería. |
| `9f1c472`, `1ca06c4`, `cdc65dd`, `36b1d43`, `a190860` | Fuentes **FreeSans / FreeSerif** (`fuentesGfx.js`, `fuentesTexto.js`), tamaño 5 y `config.fuente`, con Sans por defecto. |
| `cce4b84`, `ff3333d`, `14665c8` | **Posición manual** del texto (`config.manual/x/y`) con sliders X/Y. |
| `346d87f`, `9c1c61c`, `d03d084` | **Pegar** una imagen del portapapeles. |
| `5f45ea2`, `5bda090`, `3f357dc` | **Scroll vertical** (`config.direccion`). |
| `be6221b`, `420845b`, `e758a3a`, `04642ea`, `82816a5` | Dibujo: **expandir** a pantalla completa y **zoom** con dos dedos; cabecera no fija en horizontal. |
| `9677b60` | README y `docs/rediseno-cambios.md`. |
| `e2fd07e` | Fuente clásica con tildes, ñ, ¿ y ¡ (tabla `LATIN1_A_CP437`). |
| `73c2868`, `791b554` | **GIF comprimidos, formato z1** (`js/compresion.js`, `oled_remota/archivo`). |

## Etapa 3: firmware ESP32 (7 nov 2026, repo del firmware)

| Commit | Cambio |
|---|---|
| `e18b65b` … `ef45350` | Repo creado; se subió el firmware ESP8266 existente (`OLED_Remota`). |
| `92bd58c` | Adaptado al **ESP32 clásico**: `pines.h` (OLED 21/22, buzzer 25, botón 27), librerías WiFi/HTTPClient del ESP32, `wifi.*` renombrado a `conexion_wifi.*`, LittleFS que se formatea la primera vez, portal Wi-Fi "TV RETRO". |
| `4e02589` | Tabla de particiones propia con **OTA** (dos copias del programa). |
| `b78f622` | **Dos núcleos:** red en el núcleo 0 (streaming de `oled_remota/version`), pantalla y buzzer en el 1. |
| `7923afe` | Texto igual que la vista previa: fuentes nuevas (`fuentes.cpp`, generado por `herramientas/generar_fuentes.js`), posición manual, scroll vertical. |
| `2856853` | Botón en GPIO 16 en vez de 27, a pedido del dueño. |
| `2180e58` | Wi-Fi más confiable: `WiFi.begin` directo por red guardada, con 3 intentos, NVS y luego el portal; `setSleep(false)`; timeout HTTP de 8 s; logs `[wifi]` sin contraseñas. WiFiMulti no conectaba con señal débil. |
| `4795abd` | Tildes en la fuente clásica (la misma tabla CP437 que el panel). |
| `52ce011` | **Animaciones z1** bajadas directo a LittleFS, descomprimidas con `tinfl` de la ROM. |

## Etapa 4: ESP32-S3 N16R8 (9 nov 2026)

| Repo | Commit | Cambio |
|---|---|---|
| firmware | `6d54440` | Pines del S3 (OLED 8/9, buzzer 4, botón 5, encoder 6/7 reservado), `partitions.csv` de 16 MB (2 × 4 MB de app + ~7,9 MB de LittleFS) y README con las opciones del IDE. Probado en la placa: texto, imagen, sonido, dibujo y GIF. Push hecho. |
| panel | `d1132f0` | Docs: las fuentes, la posición manual y el scroll vertical ya están en el firmware. |

## Etapa 5: musicales (9–10 nov 2026)

| Repo | Commit | Cambio |
|---|---|---|
| panel | `0a44f6f` | **Lógica:** `js/inoMusical.js` (intérprete de `.ino`, graba notas y pantallas) y formato **m1** en `js/compresion.js`. |
| panel | `ce77fa2` | **Diseño:** pestaña Canciones con importar `.ino`, borrar y Con letra / Sin letra. |
| firmware | `54dce85` | Reproductor de musicales (`musical.cpp/.h`), descarga en `github.cpp`, integración en `.ino` y `pantalla.cpp`. **Sin push.** |
| panel | `23711fe` | Documentación completa: `CLAUDE.md` (reglas del dueño), `docs/contexto-general.md`, `docs/formatos-datos.md`, `docs/musicales.md`, este historial y `database.rules.json`. |
| firmware | `7bf71e7` | `CLAUDE.md` del firmware (reglas y arquitectura) y README con musicales. |
| — | (2026-11-10, en Firebase) | El dueño publicó las reglas con `musicales`. |
| panel | `22910fa` | **Lógica:** catálogo `musicales/` en `firebase.js`, IDs en `ui.js`, importar/elegir/vista previa/borrar/enviar en `main.js`. Con "Sin letra" la vista previa vuelve a lo que había en pantalla. Probado con Playwright: sin scroll y sin errores propios. |
| — | (2026-11-10, en Firebase) | **Las 57 canciones importadas** a `musicales/` desde el panel (777 KB en total). Catálogo viejo `canciones/` respaldado en `C:\Proyectos\TV_RETRO-respaldos\canciones-2026-11-10.json` y **borrado** de Firebase, a pedido del dueño. |
| panel | `d7f9790` | Documentación actualizada con lo anterior. |
| — | (2026-11-10, en la placa) | Firmware `54dce85` grabado y **probado en la TV**: con letra, sin letra y el botón funcionan; 9 envíos seguidos sin fuga de memoria. |
| panel | `4d72efd` | Documentación: musicales terminados y probados. |

## Etapa 6: auditoría y arreglo de bugs del panel (10 nov 2026)

Revisión completa del código. Cada arreglo se probó en Chrome con un Firebase simulado en memoria (sin tocar la base real): la prueba fallaba con el código anterior y pasa con el nuevo.

| Commit | Cambio |
|---|---|
| `2f6c37b` | **Lógica, `inoMusical.js`:** un `tone()` nuevo (o `noTone`) anula el corte programado de un `tone(pin, f, dur)` anterior, como en Arduino. Antes, en un legato `tone(f, d)` + `delay(d)` solo sonaba la primera nota. `delay()` y la duración de `tone()` truncan los decimales. Las canciones con pausa entre notas se graban igual que antes. |
| `06605df` | **Lógica, `dibujo.js`:** el trazo se pinta en píxeles enteros, sin suavizado. Con grosor 1, una diagonal de 102 puntos llegaba a la OLED con 64. Solo el botón principal dibuja. |
| `119743f` | **Lógica, `renderer.js`:** el scroll horizontal con la fuente clásica avanza de a píxel entero (antes había píxeles a medio encender en la vista previa). |
| `b7b2091` | **Lógica, `main.js`:** si lo último enviado fue una animación o un GIF, la Galería abre con su lista cargada y la animación marcada. |
| `ed52cf7` | **Lógica, `main.js`:** una canción que termina de cargar tarde ya no reemplaza a la elegida (antes se podía enviar otra canción que la del selector, o la anterior si la nueva fallaba). Un reajuste viejo del umbral ya no pisa la imagen recién elegida en la Galería. |
| `f3aaebe` | **Lógica, `firebase.js` y `main.js`:** `listarMusicales/Imagenes/Animaciones/Canciones` devuelven `null` si no se pudieron leer (antes `{}`, y un error se veía como catálogo vacío). Los errores dicen el motivo (`describirError`). Sin señal, el envío avisa a los 15 s y libera el botón (antes quedaba bloqueado). |
| `040e65a` | **Lógica, `main.js` y `ui.js`:** borrar de la Galería pide confirmación; repeticiones entre 1 y 99; al abrir se muestra la guardada. |
| `2b168de` | Documentación: los arreglos de esta etapa y datos desactualizados. |

Además se comprobó que las 57 canciones de `Canciones-ino` se graban igual con el intérprete viejo y el nuevo: no hace falta reimportar ninguna (`6f940be`).

Después, ya con el firmware a la vista:

| Commit | Cambio |
|---|---|
| `714dc23` | **Lógica, `firebase.js`:** el número de cada envío se reserva con una transacción sobre el campo nuevo `oled_remota/contadorVersion` (aprobado por el dueño). Antes dos envíos casi simultáneos podían salir con la misma `version` y la TV ignoraba el segundo. `version` se sigue escribiendo solo en el `update()` junto con `pantalla` y `archivo`, así la TV nunca la ve antes que el contenido. El firmware no cambia. |
| `999a64c` | **Lógica, `gif.js`:** avisos de peso del GIF comprimido calculados para el ESP32-S3: sin aviso hasta 256 KB, amarillo hasta 1 MB, rojo por encima. El S3 baja directo a la flash (~7,9 MB): el límite es el tiempo de descarga, no el espacio. |
| `378c25d` | **Lógica, `main.js`:** `setAvisoGaleria`, `setAvisoGaleriaDibujo`, `setAvisoGaleriaNueva` y `setAvisoCancion` usan por dentro `mostrarAviso()`. |
| `a00f912` | **Lógica, `firebase.js`:** una sola limpieza de claves (`limpiarClave`), que quita también los espacios de los bordes. Un nombre vacío se rechaza (antes la clave vacía apuntaba al catálogo entero). |
| `6dfced9` | **Visual, `style.css`:** 26 selectores definidos dos veces, unificados. Estilo calculado de todos los elementos idéntico antes y después. |
| firmware `be2c5b6` | **Log, `github.cpp`:** `[github] animación comprimida` y `[github] musical` dicen cuántos ms tardó la descarga. |

Detalles menores (decisiones del dueño del 2026-11-10):

| Commit | Cambio |
|---|---|
| `576d07a` | **Visual, `index.html`:** la pestaña Música se llama Canciones. |
| `61f009a`, `4d44193` | **Lógica, `main.js`:** primero (`61f009a`) las canciones que no se repiten sonaban una vez y ocultaban Repeticiones; el dueño lo corrigió (`4d44193`): **todas** las canciones respetan Repeticiones, con letra y sin letra. Las 3 cuyo `.ino` no repite eran casos especiales de la ESP8266. Firmware `66c49c2` (`musical.cpp`): da siempre las vueltas pedidas. |
| `c367411` | **Lógica, `main.js`:** al enviar dice "Enviado ✅ Ya va camino a la TV." (antes "La OLED lo toma en el próximo chequeo"). |
| `7d75bac` | **Lógica, `firebase.js`:** un texto ya no manda la imagen anterior en `pantalla.imagen` (~1,4 KB por envío). |
| `d75c579` | **Visual, `carga-masiva.html`:** la sección de canciones (subía a `canciones/`, ya borrado) queda oculta; sus funciones siguen. |
| `f6e1a23`, `30d8b61` | **Visual y lógica:** todos los textos con "tú" en vez de voseo (unas 33 frases en `index.html`, `main.js` y `carga-masiva.html`). |

| Commit | Cambio |
|---|---|
| `18ac19d` | **Lógica (solo comentarios), varios archivos de `js/`:** comentarios de la época del ESP8266 puestos al día (latido cada 10 s desde `red.cpp`, `update()` en vez de `set()`, importar y borrar canciones desde el panel, el firmware sí maneja `animacion`, BT.601 en `imageProcessor.js`). La constante `AMBAR` de `renderer.js` (que es cian) pasa a `ACENTO_OLED`. |

Optimizaciones (2026-11-10), cada una medida o verificada con el banco de pruebas (Edge, Firebase simulado):

| Commit | Cambio | Medido |
|---|---|---|
| `7e587dc` | **Dibujo:** el trazo ya no genera un PNG en cada cuadro (`obtenerResultadoImagen(canvas, conPng)`; solo guardar en la galería lo pide). | 3,5 ms -> 0,46 ms por cuadro |
| `5161c28` | **Galería:** tocar una miniatura solo mueve la marca "activo" (`actualizarResaltadoGaleria` / `actualizarResaltadoAnimaciones`), sin reconstruir el grid. | Los mismos elementos sobreviven al clic |
| `5b4ccf4` | **Scroll:** el ancho del texto se mide una vez y solo se redibuja si cambia el cuadro (posición entera o firma del dibujo). | Horizontal ~57 -> ~38 dibujos/s; vertical ~58 -> ~8. 160 fotogramas idénticos antes y después (5 casos) |
| `041d873` | **GIF:** el peso comprimido se calcula tras 150 ms de calma al mover el slider de umbral. | 10 movimientos: 10 cálculos -> 1 |
| `0f392f0` | **Canciones:** las últimas 4 se guardan en memoria; la copia vale mientras no cambie la `fecha` de su entrada en el índice (reimportar o borrar la descarta). Corrige que reimportar la canción cargada devolvía la vieja. | A, B, A, B, A: 5 lecturas -> 2 |
| `ba7f2ce` | **Bitmaps:** `dibujarPreviewImagen` usa un `ImageData` en vez de un `fillRect` por punto. | 3,0 ms -> 0,17 ms; 0 diferencias en 1792 combinaciones |
| `c831dff` | **Galería:** `suscribirImagenes` y `suscribirAnimaciones` (`onValue`) en `firebase.js`; `poblarCatalogoImagenes` y `poblarCatalogoAnimaciones` escuchan la primera vez y después solo redibujan. Los cambios hechos desde otro dispositivo aparecen solos. No cambia ningún formato ni ruta. | Arrancar y entrar 3 veces a la Galería: de 5 lecturas completas de imágenes y 4 de animaciones a 1 de cada una |
| `62be6db` | **Arranque:** `cargarEstado` lee `oled_remota/pantalla` y `oled_remota/version` por separado (el archivo pesado solo si lo último fue un GIF z1, y si es de la misma versión); las cargas van en paralelo y los catálogos de la Galería solo si el panel abre ahí. | Con un musical enviado: 0 lecturas de `oled_remota` entero y del archivo, la canción 1 vez, 0 catálogos |

A prueba de usuarios impacientes (2026-11-10). Se armó un banco de pruebas que se porta como un cliente impaciente (fuera del repo, `C:Proyectospruebas-tv-retro`: `bobos.mjs` y `mono.mjs`); cada problema se reprodujo primero (la prueba fallaba con el código anterior) y se arregló:

| Commit | Problema del cliente | Arreglo |
|---|---|---|
| `b4e672c` | Si otro dispositivo enviaba un GIF mientras el panel arrancaba, se quedaba sin vista previa | `leerPantallaYArchivo`: comprueba la versión y vuelve a leer, hasta 3 veces |
| `94810c7` | Pulsar Enviar mientras arrancaba mandaba "Hola Mundo" sobre el contenido real de la TV; lo escrito durante el arranque se perdía | El panel queda `inert` hasta leer el estado (máx. 8 s; lo tardío ya no se aplica) |
| `7c7005a` | Subir una foto y cambiar de pestaña: Enviar mandaba la imagen aunque se viera Texto | `turnoSubida` / `subidaObsoleta`: el resultado tardío se descarta |
| `3a77781` | Sin señal, guardar o borrar se quedaba en "Guardando…" para siempre; doble clic guardaba dos veces; importar dos veces las mezclaba; elegir el mismo archivo no hacía nada | `conTope` (15 s), `sinRepetir`, `esperarFinal`, campos de archivo limpios |
| `49e4154` | Mensajes técnicos ("PERMISSION_DENIED", "Error: Error al cargar la imagen") y "Elige una canción" mientras cargaba | Mensajes claros; `cargandoMusical` |
| `9e3456e` | Un error inesperado dejaba la pantalla sin explicación | `window` `error` / `unhandledrejection`: "Algo salió mal. Vuelve a intentarlo." |
| `6ca421a` | Doble toque rápido en botones hacía zoom en el celular | **Visual:** `touch-action: manipulation` |
| `8f36a99` | Si el arranque era lento en la segunda fase (canción o catálogo de GIF), el panel liberado mostraba los controles por defecto con el estado interno de Firebase | El estado, los controles y la pestaña se aplican juntos antes de esperar los catálogos |

Ya estaban bien: dibujar con dos dedos (el pellizco descarta el trazo), doble clic en Borrar (una sola pregunta), guardar canciones (un solo `update`) y un GIF de 600 cuadros (1 s). Notas: (1) `carga-masiva.html` (herramienta del dueño) recibe ahora `pendiente` de las escrituras lentas y lo muestra como "no se pudo" aunque después se complete. (2) Entre que el HTML aparece y se carga el JS (1-2 s en datos móviles) el panel no estaba `inert`: lo que se escribiera ahí lo pisaba el primer `poblarControles`.

Cerrado después, con OK del dueño (2026-11-10):

| Commit | Qué | Cómo |
|---|---|---|
| `eeeeb54` | Un `.ino` con bucle infinito congelaba la página 19-93 s | Límite de pasos de 400 M a 20 M: se rinde en 1,5 s (`while(1){}`) a 7 s (`for` gigante). Las 57 canciones graban idéntico (la más pesada usa 647 mil pasos) |
| `ebc30ee` | (lógica) La red de seguridad libera el panel aunque el fallo ocurra antes de que `inicializar()` lo bloquee | Prepara el `inert` fijo: nunca queda inerte para siempre |
| `defdcab` | (visual) `index.html` trae `inert` en `main.controles`, `.barra-accion`, `nav.nav-inferior` y `#filaInvertido` | Cierra la ventana anterior al JS. Si el JS no carga, el panel queda inútil (la app no serviría de todos modos) |

No se tocó el pintado del texto (`fonts.js`, `fuentesTexto.js`): mide 0,5 ms por cuadro y no lo justifica. Tampoco se carga `fuentesGfx.js` por fuente (riesgo mayor que el beneficio) ni se cambió el formato m1. Las Google Fonts ya tienen `preconnect` y `display=swap`.

Decidido por el dueño (2026-11-10): **el umbral se deja como está**. El umbral simple usa `>` y Atkinson `>=`; es igual en el simulador `CancionesMiniTV`, del que se copió, y la diferencia solo afecta a los puntos con el gris exacto del umbral (127 por defecto). No unificarlo: el panel y el simulador darían un punto distinto con la misma foto.

### Scroll de la página a 360×740 (2026-11-10)

| Commit | Problema | Arreglo |
|---|---|---|
| `91593e8` | La regla "sin scroll" se cumplía (hueco de 13 px en Texto y 25 px en Dibujo sobre la barra de Enviar), pero la página entera se movía 19 px en Texto y 7 px en Dibujo a 360×740: el `padding-bottom` del `body` (+16 px) y el margen de `.controles` (16 px) sumaban aire de más | `body` reserva solo Enviar + navegación; `.controles` baja a 12 px de margen. Sin scroll en las 4 pestañas a 390×844 y 360×740; los huecos no cambian. A 375×667 no entra (fuera de la regla) |

## Etapa 7: APK Android con Capacitor (10 nov 2026)

La APK es el MISMO panel (HTML/CSS/JS) empaquetado en un WebView de Android; vive en `app-android/` y no toca `index.html`, `css/` ni `js/` salvo lo indicado abajo. Probada en un Motorola Edge 50 Neo.

| Commit | Qué |
|---|---|
| `63617e2`, `860e0f9`, `2dcdbc3` | Carpeta `app-android/` (Capacitor 8, nombre "TV RETRO", paquete `com.tvretro.app`, **provisionales**: confirmar antes de publicar en Play Store), script `copiar-web.mjs` (copia el panel a `www/`) y proyecto Android generado |
| `415ffa6`, `3b04769` | Pegar: `@capacitor/clipboard` solo lee texto en Android, así que hay un plugin propio `PortapapelesImagenPlugin.java`. Lógica: dentro de la APK, Pegar lo usa; Expandir ya no pide pantalla completa web y bloquea la rotación con `@capacitor/screen-orientation` |
| `dbd5f39` | Expandir/Contraer dejaba el panel debajo de los botones de Inicio/Recientes y la página arrastrable. Causa: con `viewport-fit=cover` Capacitor pasa los márgenes del sistema a la página y el WebView los pierde al girar. Arreglo: `copiar-web.mjs` quita `viewport-fit=cover` solo de la copia de la APK (el `index.html` del repo lo conserva) y Capacitor aplica márgenes nativos; fondo de las barras `#0B0F14` e íconos claros |
| `590dc3d` (visual), `85b9516` (lógica) | Botón de enviar (solo ícono) en la barra del lienzo expandido: envía igual que "Enviar a la OLED", muestra una palomita 1,5 s y, si falla o la conexión está lenta, contrae el lienzo para que se lea el aviso |
| `89a1aa7` (visual) | En la APK el modo expandido del Dibujo se sentía lento. Medido con el dedo real (Event Timing + Long Animation Frames por la depuración remota del WebView): el JavaScript no pesaba (0-1 ms por toque); lo lento era el pintado, 69 ms (p90) en expandido contra 39 en normal. Causa: el lienzo ocupa ~6 veces más píxeles con tres `drop-shadow` que se recalculaban en cada trazo, y la vista previa de la TV tapada seguía pintándose | En expandido: `#lienzoDibujo { filter: none }` y `.cabecera-fija { visibility: hidden }`. Pintado por toque: 27 ms (p90), más rápido que el normal. Se pierde solo el brillo del lienzo en modo expandido |
| `ef4c43b` (visual) | Pedido del dueño: vista previa de la OLED más grande | Celulares altos: de 120 a 144 px de alto (+20%, 288×144), con `clamp(120px, calc(100vh - 685px), 144px)` para que en pantallas medianas crezca menos y no aparezca scroll. Los celulares bajos (≤780 px de alto) quedan igual. Medido en 12 tamaños: ningún scroll nuevo (el que hay en 390×740, 426×740 y 426×800 en Dibujo ya existía) |

Cómo compilar (Windows): `cd app-android`, `npm run copiar-web`, `npx cap sync android`, y en `app-android/android` `gradlew assembleDebug` con **JDK 21** (Gradle 8.14 no funciona con el Java 25 de este Android Studio; en Android Studio elegir Gradle JDK 21). La APK queda en `app/build/outputs/apk/debug/app-debug.apk`; instalar con `adb install -r`.

## Etapa 8: seguridad y cuentas de Firebase (10-11 nov 2026, en curso)

Plan aprobado por el dueño (sin Blaze: todo con el plan gratis). Estructura, reglas y flujo en `docs/formatos-datos.md` sección 6. **Nada de esto está publicado ni migrado:** `database.rules.json` sigue siendo lo publicado y el panel funciona SIN login hasta el paso 7.

| Paso | Commit | Qué |
|---|---|---|
| 1 | `09ee1c5`, `6b24425` | `database.rules.propuesta.json`, probado con el emulador de Firebase (74 casos en `C:Proyectospruebas-tv-retroeglas.mjs`). Tras una revisión de seguridad: el código de emparejamiento usa `creado` = hora del servidor y su `id` debe ser siempre el de la TV que lo escribe |
| 2 | `1faa297` (visual), `c726c2a` (lógica) | Login: entrar, crear cuenta (con correo de verificación), olvidé mi contraseña, cerrar sesión. Solo con `?cuentas=1` en la dirección (constante `USAR_CUENTAS` en `main.js`; al migrar pasa a true) |
| 3 y 4 | (visual), (lógica) | Pantalla Mi TV: "Añade tu TV" con el código, lista de TV, usar otra, desvincular. `firebase.js` usa `dispositivos/{id}/oled_remota` y `usuarios/{uid}/imagenes|animaciones` en modo cuentas (`usarCuenta`) |

Pruebas (fuera del repo, con Auth y base falsos): `login.mjs` (12), `tv.mjs` (12), `reglas.mjs` (74, con el emulador). **Para correrlas usar Node 22 portátil**: Node 26 se cae (segmentation fault) con Playwright y firebase-tools en este equipo.

Pasos 5 a 7 (preparación), hechos y probados con los emuladores de Firebase, SIN publicar ni grabar nada:

| Paso | Dónde | Qué |
|---|---|---|
| 5 | firmware `29d7afd`, `28e20e3` | `herramientas/fabricar-tv.cjs`: crea la cuenta de la TV (claim `dispositivo`) y le manda las credenciales por el puerto serie. La clave nunca se imprime |
| 6 | firmware `d4af76a` | Modo cuentas del firmware: `cuenta.cpp` (credenciales en la NVS, inicio de sesión y renovación del token por REST), rutas y token dinámicos en `red.cpp`/`github.cpp`, el streaming se reabre antes de que venza el token, y `emparejar.cpp`: pulsado largo de 2 s = código de 6 caracteres en la OLED. Sin credenciales funciona como siempre. Compilado (1,4 MB, sin grabar). El protocolo exacto de la TV se probó con `simular-tv.cjs` contra los emuladores (19 casos) |
| 7 (prep.) | panel `4859bf1` | `herramientas/migrar-datos.cjs` (respaldo y copia de los datos a las rutas por cuenta, sin borrar nada; 12 casos) y `docs/seguridad-puesta-en-marcha.md` (el orden, lo que hace el dueño en la consola y cómo volver atrás) |

**Puesta en marcha hecha el 2026-11-11:** habilitado el ingreso con correo y contraseña, cuenta del dueño creada, TV fabricada (`rt3gkm4u6j`), datos migrados con respaldo (29 imágenes, 9 animaciones y el contenido de la TV), reglas publicadas por el dueño, firmware con modo cuentas grabado (`9f37ef6`) y credenciales enviadas por el puerto serie. Comprobado: la TV inicia sesión, su streaming y su latido usan la ruta nueva, y el dueño entra al panel, ve su TV y le envía contenido. Commits del panel: `cdedb44` (`USAR_CUENTAS` por defecto; el modo viejo solo con `?sincuentas=1`) y `30063de` (`database.rules.json` = lo publicado; las abiertas, en `database.rules.antiguas.json`). El archivo de credenciales de la TV se borró tras enviarlo; la clave de servicio del proyecto está en `C:\Proyectos\claves` (fuera de los repositorios) y debe borrarse o revocarse al terminar.

`carga-masiva.html` adaptado a cuentas (visual `f3a7484`, lógica en el commit siguiente): inicio de sesión, contenido bloqueado sin sesión y guardado en el catálogo de la cuenta.

**Paso 8, límites por cuenta (2026-11-11, hecho y probado, SIN publicar):** reglas propuestas `76b995a` (166 casos en el emulador, incluidas las 38 piezas reales del dueño) y lógica del panel `e871659`: tope de 25 elementos (imágenes y GIF juntos) y máximo 10 GIF por cuenta con dos contadores atómicos en las reglas (reglas ajustadas en `db4b978`, 190 casos), el administrador sin límite y con permiso para borrar las predeterminadas, biblioteca predeterminada común que no cuenta, y tamaño y forma de lo guardado acotados. `herramientas/mover-a-biblioteca.cjs` pasa las piezas del dueño a la biblioteca. Decisiones del dueño: 25 entre imágenes y GIF con un máximo de 10 GIF (cambió de opinión para ocupar menos espacio), lo que ya existe es la biblioteca por defecto y no cuenta, administrador sin límite, anuncios para después. Puesta en marcha: `docs/seguridad-puesta-en-marcha.md`, sección "Paso 8".

**Puesta en marcha del paso 8 (2026-11-12):** el dueño publicó las reglas con límites (verificadas contra la consola con el Admin SDK: idénticas a `database.rules.json`); 29 imágenes y 9 animaciones copiadas a `biblioteca/` con respaldo. Un problema del equipo: la hora de Windows estaba 5 horas adelantada (servicio de hora detenido) y Google rechazaba la firma de la clave de servicio ("Token must be a short-lived token"); se resolvió sincronizando la hora.

Copias personales quitadas del catálogo del dueño (con respaldo; contador de usados en 0).

Pendiente: push del panel a `main`, instalar la APK nueva (compilada, sin teléfono conectado), y desbloqueos con anuncios (servidor de verificación, después).

**Compartir una TV y vinculación automática (2026-11-12, hecho y probado, SIN publicar las reglas):**

- Idea del dueño: regalar una TV y mandarle mensajes desde otra casa. Con un solo dueño por TV no servía; ahora una TV tiene un dueño y hasta 5 miembros que entran con un código de invitación (10 min, un solo uso). Un miembro envía contenido; solo el dueño desvincula, invita y quita. Contrato en `docs/formatos-datos.md`, sección 6 ("Compartir una TV").
- Reglas propuestas: `6650119` y `a582e73` (244 casos en el emulador con `REGLAS_ARCHIVO=…database.rules.propuesta.json`; también pasan `simular-tv.cjs`, `probar-migracion.cjs` y `probar-biblioteca.cjs`). La señal de desvinculación es `oled_remota/version = -2`: no se agregó ningún campo para eso.
- Panel: visual `dfefc28` (espacio para el código y las personas) y lógica `8d283bf` (Compartir, Salir, Quitar, código de TV nueva o de invitación en el mismo campo, limpieza de TV que ya no dejan entrar). Pruebas nuevas: `compartir.mjs` (8) y `tv.mjs` (12) al día.
- Firmware: `20a25f4` (entrada unificada: botón A, botón de la rueda y rueda en `entrada.cpp`) y `bfba58b` (vinculación automática: la TV muestra sola el código si no tiene dueño, 2 códigos de 10 min y luego un aviso de reiniciar que rebota; sin el gesto de pulsado largo; entiende `version = -2`).
- Pendiente: que el dueño publique `database.rules.propuesta.json` (renombrar al publicar: lo publicado pasa a `database.rules.json`), grabar el firmware y probar de punta a punta (desvincular desde la app y ver el código nuevo en la TV), cambiar el texto "Mantén pulsado el botón de tu TV" del panel, push a `main` y APK nueva.

**Compartir y vinculación automática, puesta en marcha (2026-11-12):** el dueño publicó las reglas; firmware grabado (la rueda, el botón de la rueda y el A se leen bien por el serial). Probado con la TV real: al desvincular, la TV leyó `version = -2`, publicó sola su código y mostró "LISTO" al vincularla; con una segunda cuenta invitada, ambas cuentas envían a la misma TV. `database.rules.propuesta.json` pasó a `database.rules.json` y las anteriores a `database.rules.sin-miembros.json`. Aviso de Mi TV sin el gesto de pulsado largo (`261bc6c`).

**Juegos y cierre de la sesión (2026-11-12, TODO subido a `main`):**

- Decisiones del dueño: la pestaña "Galería" pasará a llamarse **"Más"** (Galería | Juegos | Alarma | Config; Alarma y Config después); el botón A cicla las pantallas (Contenido → Reloj → **Juegos** → Reposo); mantener A abre la lista de juegos y sale en dos etapas; la rueda elige y su botón inicia/pausa/reinicia. Los 4 juegos de `chifunt/phone-project` (sin licencia) sirven de base y se reescribirán; Jump (atomic14) es Unlicense.
- Firmware: `20a25f4` (entrada unificada), `bfba58b` (vinculación automática), `915e013` (modo Juegos con Snake y servicios compartidos), `07f4582` (Breakout, Flappy, Invaders y Jump), más ajuste de sonido al iniciar un juego y las dependencias de `herramientas/`. Probado en la TV real: los controles por el serial, la vinculación (desvincular → código solo → vincular) y los 5 juegos ("parecen ir bien").
- Panel: compartir una TV y vinculación automática (ver la entrada anterior), reglas publicadas y renombradas (`database.rules.json` = lo publicado; `database.rules.sin-miembros.json` = anteriores), mensaje de Mi TV sin el gesto de pulsado largo (`261bc6c`).
- APK de depuración reconstruida e instalada en el teléfono del dueño (con Compartir).
- Documentación nueva: `docs/juegos-y-controles.md`; sección 9 de `CLAUDE.md` con el panorama pendiente.

**Auditoría integral y Etapa 1 de arreglos (2026-11-12):** se hizo una auditoría completa (informe fuera del repo: `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-12.md`, hallazgos H-01…H-27) y se empezó a arreglar lo detectado, un paso por commit:

| Commit | Qué |
|---|---|
| `8e86d47` | **Lógica (H-05):** importar y borrar canciones solo se muestran a un administrador (con `?sincuentas=1` siguen visibles, para las pruebas locales). |
| `7becc39` | **Lógica (H-14):** la línea de estado ya no dice "Conectado a Firebase. Todavía no hay datos." ni nombra a Firebase en los errores. |
| `9e4ec19` | **Lógica (H-11):** topes de archivo con mensaje claro: 25 MB, GIF de hasta 2048 px por lado y 1000 cuadros (`comprobarTamanoArchivo`, `ArchivoDemasiadoGrande` en `gif.js`). |
| `a7eb729` | **Reglas (propuesta, H-09):** `database.rules.propuesta.json` = `database.rules.json` con una sola línea cambiada: `usuarios/{uid}/dispositivos/{id}` valida contra el estado posterior (`newData`), para poder vincular en una sola `update()`. **El dueño debe publicarla** (al publicar, renombrar: lo publicado pasa a `database.rules.json` y las anteriores a `database.rules.sin-vinculo-atomico.json`). Emulador: `reglas.mjs` 244/244, `simular-tv` 19, `probar-migracion` 12, `probar-biblioteca` 5 y `reglas-atomico.mjs` 10. |
| `2254624` | **Lógica (H-09):** vincular y unirse a una TV en una sola escritura (dueño + código + lista, o miembro + invitación + lista). Si las reglas nuevas aún no están publicadas (o el código venció) responde "sin permiso" y sigue el camino de dos pasos de siempre. |

- Las sondas de la auditoría contra el emulador confirmaron los huecos de reglas: `meta` sin tope de claves, `pantalla` sin forma, `version`/`contadorVersion` sin rango (H-04, H-07, H-08); el aislamiento entre cuentas se confirmó.
- Entorno: la JVM portátil de `…\Temp\jdk21-descarga` se cae en este equipo; los emuladores funcionan con el JDK 25 de Android Studio (`C:\Program Files\Android\Android Studio\jbr`), y las suites `.cjs` necesitan `--only auth,database`.
- Pendiente de la etapa: que el dueño publique la propuesta de reglas. Siguen las etapas 2 (reglas: `version`, `pantalla`, `meta`, correo verificado), 3 (APK), 4 (firmware: TLS), 5 (borrar cuenta, política de privacidad, App Check) y 6 (juegos y funciones nuevas).

**Etapa 2 de arreglos: reglas y cuentas (2026-11-12):**

| Commit | Qué |
|---|---|
| `34ecd29` | **Reglas (propuesta, H-04/H-07/H-08):** `database.rules.propuesta.json` (acumula la propuesta de la Etapa 1) cierra `version`/`contadorVersion` (enteros), la forma de `pantalla` y `archivo`, el `meta` del catálogo y pide correo verificado para crear o reemplazar en el catálogo. Detalle en `docs/formatos-datos.md`. |
| `2a39c24` | **Lógica:** antes de guardar en el catálogo se comprueba el correo verificado (`comprobarCorreoVerificado`): reenvía el enlace una vez por sesión, avisa con un mensaje claro y, si la persona ya lo pulsó en otra pestaña, sigue sin recargar. Borrar y los administradores no se ven afectados. |
| `fd80f15` | **Visual:** botón "Continuar con Google" y separador "o" en el login (nace oculto). |
| `2238dc8` | **Lógica:** `iniciarSesionConGoogle()` (ventana emergente de Firebase Auth) y su manejo de errores; en la APK el botón no se muestra todavía (hará falta el plugin nativo en la Etapa 3). |

- Pruebas en el emulador con las reglas propuestas: `reglas.mjs` 244/244, `simular-tv` 19, `probar-migracion` 12, `probar-biblioteca` 5, `reglas-atomico.mjs` 10, `reglas-etapa2.mjs` 30 y `reglas-envios-reales.mjs` (los 6 envíos reales del panel —texto, GIF, dibujo, canción con y sin letra, musical— pasan como dueño y como miembro). Panel: `verificacion.mjs` 6, `login-google.mjs` 7 y todas las anteriores sin cambios.
- **Para el dueño (en este orden):** 1) publicar `database.rules.propuesta.json` en la consola (renombrar al publicar: lo publicado pasa a `database.rules.json` y las anteriores a `database.rules.sin-etapa2.json`); 2) Firebase > Authentication > Método de acceso > activar **Google** (correo de asistencia del proyecto) y comprobar que el dominio donde está el panel figura en "Dominios autorizados"; 3) probar con una cuenta nueva: crear cuenta con correo, intentar guardar en la Galería (debe pedir confirmar el correo) y entrar con Google.
- Al publicar las reglas, las cuentas existentes **sin correo verificado** dejarán de poder guardar en la Galería hasta confirmarlo (envían y borran igual).

**Etapa 3 de arreglos: APK (2026-11-12):**

| Commit | Qué |
|---|---|
| `126182f` | **APK (H-10):** el SDK de Firebase y las fuentes van dentro de la app (`copiar-web.mjs` empaqueta con esbuild; fuentes de `@fontsource`): abre sin internet. Dependencias nuevas de `app-android`: `@capacitor/app`, `firebase` 12.15.0, `esbuild`, `@fontsource/*`. |
| `5a4ea2b` | **APK (H-17):** botón Atrás: cierra el lienzo expandido, Compartir y Mi TV antes de salir (`cerrarCapaSuperior`, `configurarBotonAtras` en `main.js`). |
| `87f7fcf` | **APK (H-17):** versión desde `package.json` (0.2.0 → código 200), firma leída de `android/keystore.properties` (ignorado por git), `allowBackup="false"`. |

- Pruebas: `apk-sin-internet.mjs` (la copia de la APK abre sin internet, con el SDK real, sin pedir nada afuera y con las fuentes locales), `atras.mjs` (5 escenarios con Capacitor simulado) y todas las anteriores sin cambios. Compilados `assembleDebug` y `assembleRelease` (firmado, `apksigner verify` OK); el contenido del APK se revisó (sin referencias a gstatic ni a Google Fonts, `allowBackup=0`).
- **No se probó en un teléfono** (no había ninguno conectado por adb): falta instalar la APK nueva y comprobar el botón Atrás y el arranque sin red en el dispositivo real.
- `npm audit` de `app-android`: 4 avisos altos, todos en dependencias de Firestore/gRPC del paquete `firebase`, que no se usan ni se empaquetan (solo app, database y auth).
- Clave de subida creada en `C:\Proyectos\TV_RETRO-claves\` (la copia de seguridad queda a cargo del dueño). Guía completa, entorno de compilación (JDK 25 de Android Studio + Gradle 9.5 de la caché; el JDK 21 portátil se cae) y pendientes para Play en `docs/apk-publicacion.md`.
- Pendiente de la etapa: **entrar con Google en la APK** (necesita que el dueño registre la app Android en Firebase con las huellas SHA-1 y entregue `google-services.json`).

- **Google en la APK (2026-11-14, `4f5f839`):** plugin `@capacitor-firebase/authentication` 8.6.0 sin sesión nativa + `signInWithCredential` en el SDK web; botón visible en la APK solo con el plugin; `google-services.json` (público) en el repo. Pruebas: `login-google.mjs` 10 escenarios (3 nuevos del selector nativo). APK de depuración compilada e instalada en un teléfono real (arranca, lee la TV, fuentes locales); falta que el dueño pruebe el botón de Google.

**Etapa 4 de arreglos: firmware (2026-11-14, repo del firmware, rama `esp32`, sin push):**

| Commit | Qué |
|---|---|
| `d49dc55` | **TLS verificado (H-02):** las 5 conexiones HTTPS comprueban el certificado (paquete de raíces del núcleo + nombre); el streaming solo sigue redirecciones a Firebase; comando `TVRETRO_PROBAR_TLS`. |
| `74a8017` | **Reintentos (H-08):** espera creciente de 3 a 60 s cuando una descarga falla. |
| `c248d70` | **Portal Wi-Fi:** la red "TV RETRO" lleva una clave de 8 caracteres que cambia cada vez y solo se ve en la pantalla de la TV. |

- Grabado en la placa por COM6 (Java no hace falta; `arduino-cli` con `--jobs 1`: con `--jobs 2` falló una vez con "CreateProcess"). `TVRETRO_PROBAR_TLS`: 6 de 6. Envíos reales: texto, imagen, musical y 3 GIF recibidos sin errores.
- Decisiones del dueño (2026-11-14): clave del portal **en la pantalla** (no fija); la configuración por **Bluetooth desde la app** (Wi-Fi + vinculación automática con la TV, "primera vez fácil": Google en un toque y confirmar con el botón A) queda como proyecto de la Etapa 6; el portal con clave queda como respaldo para la web y el iPhone.
- Pendiente de la etapa: comprobar la clave del portal en la TV real (hay que apagar el router o llevar la TV a donde no haya Wi-Fi conocido) y repetir un mismo envío varias veces para confirmar que la memoria libre no cae.

**Etapa 5 de arreglos: baja de cuenta y privacidad (2026-11-14):**

| Commit | Qué |
|---|---|
| `0357fe4` | **Reglas (propuesta):** `usuarios/{uid}` se puede borrar entero (solo "no existe", solo la propia cuenta). Emulador: `reglas-borrar-cuenta.mjs` 15 casos y las 7 suites anteriores sin cambios (244, 30, 10, 12, 19, 12, 5). Se suma a `database.rules.propuesta.json`, que sigue sin publicar. |
| `b645dd8` | **Lógica:** `eliminarMiCuenta()` y `proveedorDeLaCuenta()` en `firebase.js` (contraseña, Google con ventana o selector nativo; suelta las TV; borra los datos; borra la cuenta; se puede repetir si se corta a la mitad). |
| `22dafe0` | **Visual:** panel "Eliminar mi cuenta" en Mi TV, enlace en el pie y enlace a la política de privacidad en el login y en Mi TV (apuntan a `https://cartica07.github.io/TV_RETRO/privacidad.html`). |
| `a66f052` | **Lógica:** conexión del panel (también para quien aún no vinculó TV), botón Atrás de la APK, aviso "Tu cuenta y tus datos se eliminaron." al volver al login. |

- Pruebas: `baja-cuenta.mjs` (6, la función) y `baja-ui.mjs` (8, la pantalla de punta a punta) con Auth y base falsos; el resto del panel sin cambios.
- **App Check: NO se activa (decisión de la auditoría, revisada).** Con App Check exigido en Realtime Database, toda petición sin token se rechaza, también las REST: la TV (ESP32, sin forma de atestiguar) dejaría de funcionar, y no hay excepción por cliente. Solo serviría con un proveedor propio (una Cloud Function que firme tokens para las TV), que necesita facturación y un backend. Hasta que haya abuso real, la defensa es la que ya está: correo verificado para guardar, límite de 25 elementos / 10 GIF, topes de tamaño y forma cerrada en las reglas. Pendiente del dueño: mirar en Firebase qué plan tiene (Spark: al pasar la cuota se bloquea la base; Blaze: cuesta dinero) y, si es Blaze, poner una alerta de presupuesto.
- **Política de privacidad hecha** (`privacidad.html`, en español, estilo Ley 1581 de 2012): responsable y contacto del dueño, datos que se guardan, encargado (Google Firebase, posible transferencia a otro país), conservación, cómo eliminar la cuenta (Mi TV > Eliminar mi cuenta, o por correo) y derechos. También sirve como "URL para eliminar la cuenta" de Play. Se ve en `https://cartica07.github.io/TV_RETRO/privacidad.html` solo después del push a `main`. A revisar por el dueño (idealmente con un abogado antes de vender): plazo de respuesta (15 días hábiles) y edad mínima (14 años).

- **Alcance de la auditoría final:** [auditoria-alcance.md](auditoria-alcance.md) deja anotado qué se revisó a fondo en la auditoría base, el estado de H-01…H-27, el código cambiado desde entonces (sección 3) y lo pendiente (Etapa 6), para que la auditoría final no repita lo ya visto.
- **Reglas de las Etapas 1 a 5 PUBLICADAS por el dueño (2026-11-14):** `database.rules.json` = lo publicado; las anteriores quedan en `database.rules.sin-etapa2.json` (para volver atrás). Lo que antes se llamaba "propuesta" ya está activo. Falta que el dueño repita las pruebas en el proyecto real (cuenta nueva con verificación de correo, baja de cuenta, envío a la TV).

**Puesta en marcha y pruebas en el teléfono (2026-11-14):**

- Push a `main` de los dos repos (panel `2562dc7`, firmware `300b197`) con las reglas de las Etapas 1 a 5 ya publicadas por el dueño. APK 0.2.0 (depuración) reconstruida e instalada en el Motorola del dueño.
- GitHub avisó de una "Google API Key" en `google-services.json`: es la clave pública de Firebase para Android (viaja dentro de cualquier APK), no un secreto. No se rota; la alerta se cierra como "Used in tests" y, opcional, se restringe la clave de Android a `com.tvretro.app` + huellas SHA-1 en Google Cloud (no restringir la clave del navegador por dominio: puede romper la APK).
- **Arreglo hallado en la prueba en el teléfono (`84dbd71`, lógica):** con la sesión guardada y sin internet, el arranque esperaba hasta 15 s a Firebase con el panel bloqueado (`inert`) y sin mensaje. Ahora, si `navigator.onLine` es falso, `resolverDispositivo` muestra en seguida "Sin conexión a internet. Conéctate y pulsa Reintentar." y entra solo al volver la conexión (evento `online`); `esAdministrador()` también tiene tope. Prueba nueva `sin-red-arranque.mjs` (3); el resto del banco sin cambios.
- Pruebas del dueño en el teléfono: Google, correo, enviar a la TV, Atrás, sin internet (con el arreglo) y cuenta nueva con invitación: **todo bien**.

**Etapa 6 (inicio): pestaña Más y juegos desde la app (2026-11-14):**

| Commit | Qué |
|---|---|
| `bb3bf28` | **Visual:** la pestaña "Galería" pasa a llamarse **Más** (ícono de tres puntos; internamente sigue `data-valor="galeria"`), con selector **Galería | Juegos** y la lista de 5 juegos con "Jugar". |
| `e140ca9` | **Lógica:** el selector se recuerda (`localStorage` `tvretro.masVista`); en Juegos se oculta el botón Enviar general; "Jugar" manda `pantalla.tipo = "juego"` + `juego.id` (`enviarEstado`); al recargar un envío así el panel abre como Texto. |
| `5602dcb` | **Reglas (propuesta, sin publicar):** `database.rules.propuesta.json` = lo publicado + `tipo = "juego"` y `juego.id` (`^[a-z]{1,12}$`). Emulador: `reglas-juego.mjs` 15 casos y las otras suites iguales (244, 30, 10, 12, 15, 19, 12, 5). |
| firmware `c243cda` | **Firmware:** `tipo "juego"` entra al modo Juegos e inicia el juego (`juegos_iniciarPorId`); es una orden: no cambia lo mostrado, no se obedece al encender y se descarta durante una partida. Compila (1 506 834 bytes). **Sin grabar en la placa ni probar.** |

- Campo nuevo aprobado por el dueño el 2026-11-14 (ver `formatos-datos.md`).
- Pruebas: `mas.mjs` (6) con Firebase falso; el resto del banco sin cambios. Alarma y Config quedan fuera por ahora (decisión del dueño).
- Pendiente: publicar las reglas propuestas, grabar el firmware y probar un "Jugar" real; push.
- **Reglas con `juego` PUBLICADAS por el dueño (2026-11-14)** y firmware `c243cda` grabado en la placa: `database.rules.json` = lo publicado; las anteriores quedan en `database.rules.sin-juegos.json`.

**Más como menú (2026-11-14, pedido del dueño tras verlo en la web: "quiero que la pestaña muestre solo las opciones"):**

| Commit | Qué |
|---|---|
| `f70c9c3` | **Visual:** "Más" pasa a ser un menú (filas Galería y Juegos con flecha); cada opción abre su pantalla con botón volver y título (`#cabeceraMas`, `#botonMasVolver`, `#tituloMas`). En el menú y en Juegos no se ve Enviar ni Invertir (`body.sin-barra-accion` quita también su espacio). Los tres campos "Nombre" llevan `autocomplete="off"` (el navegador ponía ahí el correo de la cuenta). |
| `9b0b620` | **Lógica:** `masVista` = `menu` / `galeria` / `juegos`; tocar "Más" abre siempre el menú; volver y el Atrás de la APK regresan al menú; si lo último enviado es una animación, el panel abre directo en Galería. Ya no se recuerda la última opción (reemplaza a `e140ca9`). |

- Pruebas: `mas.mjs` (10). Las pruebas que entraban a la Galería tocan ahora "Más > Galería"; `etapa1-sin-firebase` mide el "sin scroll" contra la navegación cuando no hay botón Enviar. Todo el banco sin fallas. Sin scroll a 360×740 y 390×844 en las tres pantallas.

**Alarma (2026-11-14, Etapa 6):**

| Commit | Qué |
|---|---|
| `29e902b` | **Visual:** fila "Alarma" en el menú de Más y su pantalla (selector Alarma 1/2/3 con punto en las activas, hora, interruptor, días, tono y Guardar alarma). |
| `1893906` | **Lógica:** `cargarAlarma()` / `guardarAlarma()` (`firebase.js`) y la pantalla en `main.js`; guardar escribe `dispositivos/{id}/alarma` y manda la orden `tipo "alarma"`. |
| `9b42c3e` | **Reglas (propuesta, sin publicar):** nodo `alarma` (hasta 3, rangos de hora/minuto/días, solo dueño y miembros escriben) y `tipo = "alarma"`. |
| firmware `cdb4f9d` | **Firmware:** `alarma.cpp/.h` (hora por NTP, hasta 3 alarmas, NVS, A silencia, rueda pospone 5 min, se calla al minuto; tono = canción de `musicales/` o aviso simple), `sincronizarAlarma()` en `github.cpp` (lee la alarma y baja el tono), lectura al conectarse en `red.cpp` y gancho en el `.ino` (sale del juego o enciende la pantalla al sonar). Compila (1 512 982 bytes); **sin grabar ni probar en la placa**. |

- Campo nuevo aprobado por el dueño el 2026-11-14: una canción del catálogo como tono y hasta 3 alarmas.
- Pruebas escritas pero **aún sin correr** por pedido del dueño (se corren cuando confirme la versión final): `alarma.mjs` (11, panel con Firebase falso) y `reglas-alarma.mjs` (emulador).

- **Reglas con `alarma` PUBLICADAS por el dueño y firmware de la alarma grabado en la placa (2026-11-14);** la alarma se calla sola **al minuto** (pedido del dueño). `database.rules.json` = lo publicado; las anteriores quedan en `database.rules.sin-alarma.json`.
- **Hora de la alarma (2026-11-14):** el dueño pidió que la TV muestre la hora como el reloj normal (12 horas, "8:18 PM"), no en 24 horas. Se hizo y se grabó (firmware). Por un malentendido se había cambiado también la hora del panel a listas de 24 horas (`c994349`, `5c8429d`); se revirtió (`406e930`, `f0411c1`): el panel sigue con el campo de hora del navegador. Además, una alarma que llega a su hora mientras otra suena queda atendida y no vuelve a sonar al terminar (antes dos alarmas seguidas sonaban más de un minuto sin parar).

**Config (2026-11-14, Etapa 6):** Más > Config con Mi cuenta, Ajustes de la TV, Ayuda y contacto y Legal (decidido por el dueño, campo nuevo `dispositivos/{id}/ajustes` aprobado).

| Commit | Qué |
|---|---|
| `424e4a8` | **Visual:** fila Config en Más, lista de apartados y sus pantallas (correo, Mis TV, cerrar sesión, eliminar cuenta; brillo, volumen, zona horaria y Guardar ajustes; preguntas frecuentes y correo; privacidad, términos y licencias). Sin scroll en 360×740 y 390×844. |
| `5d477f2` | **Lógica:** apartados con volver (también el Atrás de la APK: apartado → lista → menú), Mi cuenta, `cargarAjustes()` / `guardarAjustes()` y la orden `tipo "ajustes"`. |
| `049287c` | **Reglas (propuesta, sin publicar):** nodo `ajustes` (brillo 1-3, volumen 0-3, zona -720..840; dueño y miembros escriben, la TV lee) y `tipo = "ajustes"`. |
| `499a2ab` | **Páginas:** `ayuda.html` (preguntas frecuentes), `terminos.html` (borrador para revisar con un abogado) y `licencias.html` (componentes de terceros con su licencia, revisadas en los paquetes instalados). |
| firmware `de26b5a` | **Firmware:** `ajustes.cpp/.h` (NVS, contraste, zona `TZ`), `sonido.cpp/.h` (todos los `tone()`/`noTone()` pasan a PWM propio con volumen; la alarma suena aunque esté en Silencio), `sincronizarAjustes()` en `github.cpp`, lectura al conectarse en `red.cpp` y `ajustes` como orden en el `.ino`. Compila (1 515 510 bytes); **sin grabar ni probar**. |

- Pruebas escritas: `config.mjs` (11, corrida: 11 bien) y `reglas-ajustes.mjs` (sin correr, va con el banco completo cuando el dueño confirme).
- Los 4 juegos sin licencia NO se listan en `licencias.html` (hay que reescribirlos antes de vender).

**Ajustes de la TV: cierre (2026-11-15):** el dueño publicó las reglas con `ajustes` (`database.rules.json` = publicado; las anteriores en `database.rules.sin-ajustes.json`) y probó Config en la TV real: brillo, volumen y zona funcionan.

- **Volumen:** el nivel Medio se ajustó a oído (80 → 30 → 60 → **50**; Bajo 12, Alto 512 = máximo posible). Firmware `27b1138`, `54dba6e` y `788eaf5`.
- **Buzzer con transistor:** el buzzer (pasivo magnético, ~16 Ω) pasó a ir detrás de un transistor NPN con resistencia de 1 kΩ y diodo, alimentado de 3,3 V: el pin del ESP32 no daba la corriente que pide la bobina y el sonido era flojo. Sin cambios de firmware. Esquema en el `README.md` del firmware; las TV nuevas deben fabricarse así.
- Banco completo de pruebas corrido con Config y las reglas de ajustes incluidos.

**Cierre de la sesión 2026-11-12 → 2026-11-15 (2026-11-15):** pruebas finales del dueño y push de todo.

- **Pruebas en la TV real:** el portal Wi-Fi con clave funciona (la TV muestra la clave, al escribirla abre el portal); **9 envíos seguidos del mismo GIF** (23 233 B) sin errores: memoria libre estable entre 104 y 105 KB, descarga de 0,85 a 1,03 s cada una, sin reinicios. Con el volumen y el buzzer con transistor, Medio quedó en 50.
- **Banco completo de pruebas en verde** (31 suites; en la primera vuelta `mas` falló por una expectativa vieja —esperaba tres opciones de menú y ahora son cuatro— y se corrigió la prueba).
- **Push** de `rediseno-app` y `main` (panel) y de `esp32` y `main` (firmware); **APK de depuración** nueva instalada en el teléfono del dueño.
- **Documentación de cierre:** `docs/auditoria-alcance.md` reescrito con las tres zonas (A ya auditado, B esta sesión, C sesiones posteriores) para la auditoría final; recordatorio de la subida a Google Play en `CLAUDE.md` sección 9; reglas nuevas de trabajo (pruebas largas solo con la versión final confirmada; cada sesión añade su fila a la sección 8 de la auditoría).
- **Siguiente conversación:** Juegos (reescribir los 4 sin licencia).

**Auditoría independiente del 2026-11-15 y sus arreglos (2026-11-15):** informe en `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-15.md` (zona B: hallazgos H-28 a H-50; las sondas, capturas y la evidencia están en esa carpeta). Todo el banco en verde (31 suites) antes de tocar nada.

| Repo | Commit | Qué |
|---|---|---|
| Firmware | `3d2e198` | **H-28 (ALTO):** `AudioOutService::begin()` hacía `pinMode()` sobre el buzzer; en el núcleo esp32 3.3.x eso suelta el PWM de `sonido.cpp` y la TV quedaba muda hasta reiniciar (alarma incluida). Ahora solo llama a `sonido_silencio()`, y `sonido_tono()` se reconecta si el PWM se perdió. |
| Firmware | `cfa6b89` | **H-30:** `musical_iniciar()` comprueba que los conteos del m1 quepan en el archivo y tengan tope (antes, un m1 malformado escrito por un miembro dejaba la TV reiniciándose en bucle). **H-33:** `musical_reabrirUltimaImagen()`. |
| Firmware | `b193e51` | **H-32:** alarma y ajustes se releen en cada reconexión del streaming. **H-33:** al terminar la alarma se recupera la imagen del musical; `aplicarPendiente()` ya no lo corta; la NVS solo se escribe si algo cambió. **H-38:** no se baja otro tono con una configuración pendiente. **H-34:** al desvincular, la TV olvida el contenido en memoria y relee alarma y ajustes. |
| Panel | `ea3deaa` | **H-35:** con un GIF elegido, "volver" y Atrás salen de la Galería (la Galería solo se fuerza al abrir). |
| Panel | `5b733cf` | **H-29:** Guardar alarma y Guardar ajustes quedan bloqueados hasta leerlos bien (antes pisaban lo guardado con los valores por defecto). **H-37:** avisan cuando la conexión está lenta. |
| Panel | `96c8c6e` | **H-34:** desvincular borra también `pantalla`, `archivo`, `alarma` y `ajustes` de la TV (nodos existentes; sin campos nuevos). |
| Panel | `3b7a12a` | **H-39:** tope de 8000 px por lado y 40 MP para una imagen fija. |

- Pruebas nuevas (fuera del repo, ya en `todo-el-banco.sh`): `auditoria-b.mjs` (7 escenarios de panel) y `reglas-desvincular.mjs` (emulador). Corridas sueltas en verde: las nuevas y `mas`, `atras`, `alarma`, `config`, `compartir`, `baja-cuenta`, `baja-ui` y `etapa1-topes`; el banco completo se corre cuando el dueño confirme la versión final.
- Firmware compilado (1 516 446 bytes, sin avisos); **sin grabar en la placa**.
- Siguen abiertos H-31 y H-36 (decisión del dueño), H-40 a H-50 (bajos) y la lectura línea por línea de lo que la auditoría base solo miró por encima.

**Auditoría 2026-11-15, decisiones del dueño (H-31 y H-36), firmware grabado en la TV:**
- **H-36** (firmware `3ec3784`, panel `c5f9762`): sin Wi-Fi al encender, con redes guardadas, la TV ya no abre el portal ni se reinicia en bucle: sigue funcionando (juegos) y `wifi_reintentarSiHaceFalta()` prueba las redes cada 30 s desde la tarea de red. El portal se abre solo la primera vez o al mantener 5 s el botón de la rueda sin Wi-Fi (`wifi_pedirPortal()`: marca en la NVS y reinicia). Al encender sin red se ve "Sin WiFi" 6 s. `ayuda.html` actualizada.
- **H-31, opción (b)** (firmware `7410d43`): `ultimo.cpp` guarda en `/ultimo.json` el último texto, imagen, GIF o musical; al encender, si Firebase solo trae una orden (alarma, ajustes o juego), lo repone (un musical, sin sonido); se borra al desvincular. Sin campos nuevos. El panel sigue reabriendo en Texto tras una orden (aceptado).
- Firmware compilado (1 523 894 bytes) y **grabado en la placa por COM6** (hash verificado). Pendiente: probarlo en la TV.

**Auditoría 2026-11-15, segunda tanda (panel y APK; sin cambios de firmware):**

| Commit | Qué |
|---|---|
| `b3f85cd` | **H-23:** `notasParaCancion` pasa a `compresion.js` y `inoMusical.js` (~50 KB) se carga con `import()` solo al importar canciones. |
| `c746290` | **H-27:** un error inesperado con el login a la vista ya no libera el panel de abajo (se libera 8 s después de entrar). |
| `5f6cdff` | **H-24:** el panel anota la última invitación creada y borra la anterior si ya venció (nunca una vigente). |
| `c48a0c5` | **H-46 (visual):** la barra superior en celulares pequeños llevaba botones de 44 px sobre un alto pensado para 36: sobraban 7 px de scroll a 360×740 en modo cuentas. Botón de 36 px con área de toque de 44. |
| `a111acb` | **H-50:** topes de recursión (200) y de notas o cuadros (200 000) en `inoMusical.js`. |
| `ed03393` | **H-41 y H-40:** `dataExtractionRules` (nada sale del teléfono por copia o transferencia) y lockfile sincronizado; `npm audit` sin arreglo posible (`@grpc/grpc-js` lo fija `firebase`, y no entra en la APK). |
| `f3fa2bc` | **H-51 (nuevo):** la lectura de `renderer.js` e `imageProcessor.js` mostró que un miembro podía romper la vista previa del dueño (`tamano` 100 → "Algo salió mal") o congelarla (imagen de 4096×4096). Ahora se acota al cargar y se ignoran imágenes imposibles. |
| `d0367e3` + `6a2ff91` | **H-16:** botón Goma en Dibujo (aria-pressed; se puede deshacer) y Limpiar con ícono de papelera; la fila se junta a 360 px para que quepan 5 botones. |
| `b2e72ee` + `fd44969` | **H-15:** Jugar de 44 px, interruptores con área de toque de 44 px y `aria-pressed` en los grupos de botones. |

- Pruebas nuevas en `auditoria-b.mjs` (fuera del repo): H-15, H-16, H-23, H-24, H-27, H-46 y H-51 (ya son 14 escenarios). Suites sueltas en verde: `login`, `bobos`, `compartir`, `tv`, `alarma`, `mas`, `config`, `verificacion`, `pruebas-panel`, `etapa1-admin-canciones`, `cache-canciones`, `pintar-igual` (1 792 combinaciones iguales); las 57 canciones se graban igual (`comparar-ino`). Capturas: las 12 pantallas sin scroll a 390×844 y 360×740.
- APK de depuración recompilada e instalada en el teléfono del dueño (con `--no-daemon`: el daemon de Gradle se cayó una vez con `EXCEPTION_ACCESS_VIOLATION`).
- Quedan abiertos: H-06, H-12, H-13, H-18, H-19, H-20, H-21, H-22, H-25, H-26 y los de legal y juegos.

**H-18: el banco de pruebas pasa al repo (2026-11-15):** `pruebas/` con las 31 suites (panel con Firebase falso, reglas con el emulador, herramientas), el intérprete de .ino (`ino-infinito.mjs`), `todo-el-banco.sh` portable, `README.md` y `.github/workflows/pruebas.yml` (corre todo el banco en cada push a `main`). Rutas relativas; Chromium de Playwright en CI y Edge en el equipo del dueño; `simular-tv`, `probar-migracion` y `probar-biblioteca` se omiten si faltan el repo del firmware o `npm ci` en `herramientas/`; `bobos` usa un `.ino` de ejemplo (`fixtures/`) en vez de una canción del catálogo. Verificado desde el repo: `login`, `auditoria-b`, `bobos`, `apk-sin-internet`, `carga-masiva-cuentas`, `reglas-desvincular`, `reglas-juego`, `simular-tv` (19) y `probar-migracion` (12). **La CI no se pudo ejecutar aquí.**

**Tercera tanda del 2026-11-15: H-18, H-06, H-12 y H-13 (etapa 1). Sin publicar ni subir.**
- **H-18** (`362ea60`, `5cfe4c2`, `fc6e575`): el banco pasa a `pruebas/` con CI (ver su entrada anterior).
- **H-06, acuse de recibo** (reglas `bdc80dc`, panel `8970a83`, firmware `643e481`): campo nuevo `oled_remota/mostrada` (solo la escribe la TV; entero 0 a 2.000.000.000). El panel pasa de "Enviado ✅" a "En la TV ✅" cuando llega; sin acuse tras 20 s avisa si la TV está sin conexión. El firmware reintenta cada 15 s y no invalida el token ante un 401 de ese PUT (las reglas se publican a mano). Pruebas: `reglas-acuse` (19) y 4 escenarios en `auditoria-b`.
- **H-12, Galería liviana** (reglas `6a6eb09`, panel `b0bc6e6`, herramienta `76d5fb8`): nodos nuevos `imagenes_indice` y `animaciones_indice` (en cada cuenta y en la biblioteca), escritos junto al elemento. Medición real con el respaldo: la biblioteca pesaba 422 KB, de los cuales 269 KB eran el PNG editable de las imágenes y 109 KB las animaciones; con las listas baja a unos 60 KB. La copia editable y los cuadros se piden al elegir. Lo anterior a las listas se lee completo una vez y las rellena (la cuenta sola, la biblioteca un administrador). Pruebas: `reglas-indice` (29) y 3 escenarios en `auditoria-b`; `cuotas` ajustada (el borrado de una predeterminada ahora es una escritura de varias rutas).
- **H-13, etapa 1:** `js/utilidades.js` (APK, `sinRepetir`, `esperarFinal`, avisos) y `js/conexion.js` (conexión de la TV y acuse) salieron de `main.js` (3 935 → 3 782 líneas). Las 20 suites de panel siguen en verde.
- **Orden de puesta en marcha** (ver `CLAUDE.md` sección 9): publicar reglas → push → APK → firmware. Con el panel nuevo y las reglas viejas, guardar y borrar en la Galería falla.

**2026-11-16, prueba del dueño en la TV real:** acuse de recibo, Galería liviana, guardar y borrar bien. Falló el caso "TV apagada justo después de enviar" (no salía el aviso de sin conexión ni, al encenderla, "En la TV ✅"): el panel revisaba una sola vez a los 20 s. Arreglado (df9f487): revisa cada 5 s hasta el acuse; escenario nuevo en `auditoria-b` que reproduce la falla.

**2026-11-16, H-13 paso 2 (`663943c`):** `js/mas.js` (`crearMas`) recibe la pestaña Más: navegación de Más y Config, Mi cuenta, Ajustes de la TV, Alarma, Jugar y sus eventos (~305 líneas; `main.js` 3 779 → 3 474). Sin cambios de comportamiento, de IDs ni de datos. Lo compartido entra por funciones leídas al usarse (`estado()`, `sesion()`, `musicales()`/`fijarMusicales`, `avanzarTurnoEnvio()`, `estaBloqueado()`…); `main.js` asigna la vista con `fijarMasVista` y la lee con getters. Los tres botones de Config que abren Mi TV se quedan en `main.js` hasta el paso de cuentas. Prueba nueva en `auditoria-b`: Jugar no hace nada con el panel bloqueado. Suites sueltas en verde: `mas`, `alarma`, `config`, `atras`, `auditoria-b` (23), `compartir`, `login`, `bobos`, `pruebas-panel`.

**2026-11-16, H-13 paso 3 (`8fe1844`):** `js/cuentas.js` (`crearCuentas`) recibe el inicio de sesión (correo, Google, olvidé mi contraseña), Mi TV (vincular, elegir, desvincular, salir), Compartir y las personas con acceso, Eliminar mi cuenta, `resolverDispositivo`, `requerirSesion`, los tres botones de Config que abren Mi TV y el tramo del Atrás de Android que cierra esas pantallas (~595 líneas; `main.js` 3 474 → 2 877). Sin cambios de comportamiento, de IDs ni de datos. Solo recibe `leerElementos` y `liberarPanelDespuesDeLogin` (el bloqueo del panel sigue en `main.js`); `main.js` usa `entrar()`, `obtenerSesion()`, `obtenerEsAdmin()`, `tomarAvisoPostLogin()`, `hayLoginVisible()` y `marcarFalloMientrasLogin()`. Prueba nueva en `auditoria-b` (error con el login a la vista y luego entrar). Suites sueltas en verde: `login`, `login-google`, `verificacion`, `baja-cuenta`, `baja-ui`, `tv`, `cuotas`, `sin-red-arranque`, `apk-sin-internet`, `atras`, `config`, `mas`, `alarma`, `auditoria-b` (24), `etapa1-admin-canciones`, `bobos`, `pruebas-panel`. **Prueba intermitente (anterior a este cambio):** `compartir` falla a veces (un escenario distinto cada vez, "Execution context was destroyed") porque la prueba consulta la página mientras `location.reload()` la recarga; ocurre igual con el código de antes (3 de 4 corridas). Pendiente: esperar la recarga en esos escenarios antes del banco final.

**2026-11-16, H-13 pasos 4 y 5 (`9864647`, `0ec2181`) y cierre de H-13:** `js/galeria.js` recibe los catálogos de la Galería (imágenes y animaciones/GIF: escucha en vivo, miniaturas, elegir, borrar y "Añadir nueva"; `main.js` 2 876 → 2 307) y `js/canciones.js` el catálogo y la selección de canciones (importar `.ino`, borrar, Repeticiones; 2 307 → 2 033). Sin cambios de comportamiento, de IDs ni de datos. Con esto `main.js` pasa de ~3 780 a ~2 030 líneas en 5 etapas y H-13 queda **hecho**. **Banco completo corrido sobre este código (2026-11-16): todo en verde** salvo un escenario de `baja-cuenta` (APK) que falla a veces por la misma carrera de la prueba con `location.reload()` (dio 6 de 6 en tres corridas sueltas); `reglas-envios-reales` (12) y `reglas-indice` (29) se cayeron por un error de red del emulador dentro de la corrida y pasaron al repetirlas por separado. **Fallos del propio banco (pendientes, no del panel):** `todo-el-banco.sh` no pone tiempo límite a cada suite (una `baja-cuenta` que no terminó de salir lo dejó colgado casi 4 horas) y no cuenta como falla una suite de reglas cuyo emulador se cae (muestra OK=0 FALLAS=0); además varias pruebas que provocan un `location.reload()` (`compartir`, `baja-cuenta`, H-34 de `auditoria-b`) consultan la página mientras se recarga y fallan a veces.

**Fallos del propio banco: ARREGLADOS (2026-11-16, solo `pruebas/`, sin tocar el panel):** `banco.mjs` cierra los navegadores que un escenario deja abiertos y termina el proceso a los 15 s (así se colgó el banco ~4 h) y repite `page.evaluate` cuando una recarga destruye la página justo durante la consulta (causa de los fallos intermitentes de `compartir`, `baja-cuenta` y H-34); `todo-el-banco.sh` pone tiempo límite por suite (`TOPE`, 900 s) y cuenta como falla una suite cortada o sin ningún OK. Comprobado: `compartir` 5/5, `baja-cuenta` 3/3 y H-34 4/4 en verde.

**2026-11-16, H-21 y avisos de la consola (subido a `main` el mismo día):**
- `cb1ecaf` — la copia del lienzo de Dibujo se crea con `willReadFrequently` (la consola mostraba decenas de avisos "Canvas2D: Multiple readback operations"; con 6 trazos y un envío pasaba de 62 avisos a 0).
- `9679fb5` + `53481ab` — **H-21, fuentes:** Space Grotesk y JetBrains Mono salen de `fonts/` (+ `css/fuentes.css`, licencias OFL); `index.html` y `carga-masiva.html` ya no enlazan a Google Fonts (cada visita le contaba la IP del cliente a Google). La APK sigue generando su copia.
- `dcecc53` — al usar las fuentes reales en las pruebas apareció que **Texto se pasaba 3 px de scroll a 360x740** (ya pasaba en producción con las fuentes reales de Google: el banco las servía vacías y medía con las del sistema). `.rotulo` pasa a `line-height: 1.1`; las 12 pantallas quedan sin scroll en 390x844 y 360x740 medidas con las fuentes reales.
- `26567b6` + `c95f0a7` — **H-21, CSP:** meta `Content-Security-Policy` en `index.html`, probada contra Google y Firebase reales (login falso, base por WebSocket, ventana de Google: 0 violaciones) y activa (bloquea fetch, imagen y script ajenos). La copia de la APK se queda sin ella. Las pruebas corren con la política activa (`sinCSP` solo donde se usa `new Function` en la página). **Si se añade un servicio externo, hay que añadirlo a la política.**
- `4d83f14` — banco: cierra los navegadores abiertos y termina solo (se había colgado ~4 h), repite `evaluate` tras un `location.reload()` y pone tiempo límite por suite.

**2026-11-16, H-22: musical por referencia (reglas publicadas, firmware grabado y probado en la TV):**
- **Contrato (aprobado por el dueño):** `pantalla.musical.clave` opcional = clave de `musicales/datos/<clave>`. Con ella el panel no manda `archivo` (null) y la TV baja la grabación del catálogo; sin ella, todo como antes. Ahorra ~100 KB de subida desde el celular por envío.
- **Reglas** (`ae0d3f7`, copia de vuelta atrás `database.rules.sin-musical-referencia.json`): `clave` de 1 a 150 caracteres sin `/ . $ # [ ]` (11 casos nuevos en `reglas-etapa2`; con las reglas anteriores 3 fallan, con las nuevas todo bien).
- **Panel** (`cee292f`): `claveMusicalValida()` y envío por referencia; prueba nueva en `pruebas-panel`.
- **Firmware** (repo del firmware): `descargarMusicalPorClave()` en `github.cpp` (streaming a LittleFS, valida la clave y que empiece con "M1", reintenta como cualquier descarga fallida). Compilado y grabado (1 525 754 bytes). **Probado en la TV real** (el dueño y el monitor serie): `musical por clave: 53709 y 91365 bytes en ~3,7 s (ok)`. Aviso: la primera prueba falló porque la placa seguía con el firmware anterior (el registro mostraba `archivo de la versión -1 (se esperaba N)`, la ruta vieja); tras regrabarlo funcionó.
- **Orden de puesta en marcha:** reglas publicadas → firmware grabado → panel/APK. Un panel nuevo con un firmware viejo no reproduce el musical.

**2026-11-16, CI de GitHub:** el primer push a `main` con el banco nuevo falló solo porque `simular-tv` se omite a propósito en la CI (no está el repo del firmware) y el `resumen` de `todo-el-banco.sh` (que desde esa sesión cuenta como falla toda suite con 0 OK) la tomó por caída. Las otras 40 suites daban 0 fallas. Arreglado: una suite que dice "omitida" y sale con código 0 no cuenta como falla; una que se cae de verdad sigue contando.

**2026-11-17, detalles menores de la Parte 1:**
- **CI de GitHub en verde (H-18 cerrado):** el push de `5fbb46b` a `main` corrió el banco completo en 13 min 17 s sin fallas (el arreglo de la suite `simular-tv` omitida a propósito funcionó).
- **Correos de Firebase en español** (`32d8647`): `auth.languageCode = 'es'` en `firebase.js`. La plantilla (remitente "TV RETRO", asunto y texto) la configura el dueño en la consola; el dominio propio con SPF/DKIM queda para cuando venda.
- **Zonas horarias (H-48, parte pequeña):** Paraguay junto a Argentina y Uruguay (`b6cc326`) y una zona guardada fuera de la lista se ve como `UTC+5:30` y no `UTC+5.5` (`aa3831a`). Chile se deja fuera a propósito: cambia de hora y haría falta un campo nuevo.
- **H-15 aceptado:** los botones de tamaño 1-5 y los días de la alarma miden 31-41 px de ancho (el alto ya es 44). No se puede ampliar sin quitar el espacio entre botones (días) o sumar una fila a Texto (tamaños, que a 360×740 ya está justa). Cumplen el mínimo de WCAG 2.5.8 (24 px). Decidido por el dueño.
- **Miembros con nombre (apodos del dueño):** campo nuevo aprobado `dispositivos/{id}/apodos/{uid}` (ver `formatos-datos.md` sección 6). Reglas `8b07fb0` (copia de vuelta atrás `database.rules.sin-apodos.json`; suite nueva `reglas-apodos`, 27 casos; `reglas`, `reglas-atomico` y `reglas-desvincular` siguen en verde), panel `8112a9e` (lógica) y `0c4595f` (visual: campo, Guardar y Cancelar en una fila a 360 px, sin scroll ni cambio de alto en 390×844 y 360×740). `compartir` pasa de 8 a 11 escenarios. **Reglas SIN publicar.** Sin cambio de firmware.
- **`carga-masiva.html` para administrador:** interruptor "Biblioteca predeterminada" (solo visible si `administradores/{uid}` es verdadero; las reglas lo exigen igual). Con él, imágenes y animaciones se guardan en `biblioteca/<tipo>/<clave>` y su lista `biblioteca/<tipo>_indice/<clave>` en una sola escritura, sin contadores ni límites (`firebase.js`: `guardarImagenCatalogo`/`guardarAnimacionCatalogo` aceptan `{ predeterminada: true }`, `listarAnimaciones({ predeterminada })`; `957678a`), con la tarjeta del interruptor (visual `1e95a47`) y el script de la página (lógica). Pide confirmación al subir y al borrar ("la verán TODAS las cuentas"). Prueba: `carga-masiva-cuentas` pasa de 6 a 13 comprobaciones (cuenta normal sin interruptor; administrador: lista, sube y borra en la biblioteca sin tocar la cuenta ni los contadores). Las reglas ya lo permiten (`reglas-indice`). Sin campos nuevos.

**2026-11-17, H-19: actualización por Wi-Fi (OTA) y restablecimiento (firmware y reglas; panel pendiente):**
- **Reglas** (`7521982`, publicadas por el dueño): `firmware/estable`, `firmware/datos/{build}`, `dispositivos/{id}/firmware` y las órdenes `actualizar` y `restablecer` solo del dueño. Suite `reglas-firmware` (69 casos) comprobada con mutaciones.
- **Firmware** (repo del firmware, `afd2494` … `9fd8fbb`): `sistema.cpp` (descarga con SHA-256, firma RSA-2048 sobre `build|tamano|sha256` con dos claves públicas, `build` mayor que el propio, reversión con `verifyRollbackLater`), `restablecer` (acuse y luego borrado local), `TVRETRO_PROBAR_FIRMA`. Herramientas `generar-claves-ota.cjs` y `publicar-firmware.cjs` (comprueba imagen de aplicación, versión y tamaño: cierra H-47). Las claves privadas están fuera de los repos (`C:\Proyectos\TV_RETRO-claves`).
- **Probado en la TV real:** autoprueba de firma 6 de 6; 1 → 2 por Wi-Fi (~44 s), validada a los 30 s; firma y hash alterados rechazados; reversión automática; corte a mitad de la descarga sin daño. **Un error propio encontrado en la primera prueba:** `millis() | 1` dejaba el tiempo guardado 1 ms por delante de `millis()` y la resta sin signo disparaba el rollback inmediato (corregido en `63a7d76`).
- **Pendiente:** probar `restablecer` en la TV, la pantalla Config > Sistema del panel, el alta de la fila en la auditoría, y que el dueño borre la clave de servicio.

**2026-11-17/18, H-19 terminado: Config > Sistema, pruebas en la TV real y cierre:**
- **Panel** (`5720ee0` visual, `16b0985` y `0ecaf2f` lógica): fila "Sistema" en la lista de Config con "Actualizar la TV" (solo si la versión publicada es más nueva que la de la TV, sin mostrar números; sigue el informe de la TV) y "Restablecer la TV" (confirmación, acuse EXACTO de la versión y recién entonces el `desvincular` de siempre). Solo el dueño; un miembro o un firmware anterior no ven las opciones. Suite `sistema` (11 escenarios, con mutación del acuse); `config` pasa a 5 entradas.
- **Probado en la TV real:** autoprueba de firma 6 de 6; 1 → 2 por Wi-Fi (~44 s); firma y hash alterados rechazados; reversión automática (versión de prueba con `-DTVRETRO_PRUEBA_ROLLBACK`); corte a mitad de la descarga (reinicio duro por RTS); la orden no se repite al reiniciar. **Restablecer de punta a punta con el panel (2026-11-18):** la orden llegó, la TV acusó y a los 0,4 s borró y reinició; sin redes guardadas abrió el portal con clave en la OLED; con el Wi-Fi de casa mostró el código y se vinculó de nuevo.
- **Se pierden a propósito** las alarmas, los ajustes, los miembros y el contenido: el `desvincular` los borra también de la nube (H-34). Comprobado en la nube tras el restablecimiento (sin alarma, sin ajustes, 0 miembros). Mi resumen previo al dueño decía que alarmas y ajustes volverían de la nube: era un error mío; la confirmación del botón sí lo advertía. El dueño decidió que es lo esperado.
- **Tiempos observados al vincular tras restablecer:** el código tardó ~50 s en salir después de poner el Wi-Fi en el portal (sesión +2 s, streaming +7 s, lectura de la alarma ~10 s, primer intento de publicar el código con tiempo agotado ~10 s y reintento a los 15 s; señal de -71 a -72 dBm). Mejora pendiente en el firmware: publicar el código antes de leer alarma y ajustes y reintentar a los 3 s. La demora del panel al confirmar la vinculación no se midió.
- **Herramientas de soporte** (repo del firmware): `liberar-tv.cjs` suelta una TV de una cuenta perdida (la misma limpieza que el `desvincular`); `publicar-firmware.cjs` y `generar-claves-ota.cjs`.
- **Errores propios de la sesión:** `millis() | 1` (rollback inmediato, arreglado en `63a7d76`); comillas invertidas y barras invertidas perdidas en comandos de shell al escribir documentación (arreglado en `8e2b458`).

**2026-11-18, primera actualización real por Wi-Fi (versiones 3 y 4):**
- La versión 3 trae la vinculación más rápida (`f688081`: `emparejar_paso()` antes de las lecturas de alarma y ajustes y reintento a los 3 s con Wi-Fi; se mantiene la comprobación de si ya tiene dueño, que evita mostrar un código en una TV vinculada que reinicia con `version = -2` guardada). Al instalarla desde la app la TV se **cayó a los ~10 s**: `task_wdt` (IDLE0 sin correr; la tarea `red` acaparaba el núcleo 0 porque con el Wi-Fi rápido el bucle de decodificación no esperaba datos). La TV quedó intacta en la versión 2 (el slot activo no se toca hasta verificar). Arreglo `188c24c` (`vTaskDelay(1)` por bloque).
- La TV con el descargador defectuoso no podía recibir su corrección por Wi-Fi: la versión 3 corregida se grabó **por cable** (autorizado por el dueño) y la 4 se instaló **por Wi-Fi** desde la app (166 s con el Wi-Fi congestionado: hasta 20 s en pedidos pequeños, `HTTP -11`), arranque en `app1`, validada a los 30 s. La TV del dueño corre la **versión 4** (`f970f2c`).
- **Panel, dos defectos encontrados con esa prueba:** (1) la app seguía en "Actualizando…" si la TV reiniciaba sin actualizarse (`0ff86b7`: tras ver "Actualizando" o "Reiniciando", un `ok` con la versión vieja es un fallo y el botón queda activo); (2) una pantalla abierta mucho rato daba por buena una actualización que no era, por usar la versión publicada de cuando se abrió (`dcb9bc7`: se relee todo al pulsar y el éxito exige que la versión de la TV suba y llegue a la publicada). Suite `sistema`: 15 escenarios.
- **Sin medir todavía:** cuánto tarda ahora el código de vinculación tras un restablecimiento (antes ~40 s desde que la TV supo que no tenía dueño).

**2026-11-20, firmware v5 a v7: portal del Wi-Fi (QR, páginas propias y guía), arreglo del watchdog y evaluación de la Parte 3. Solo firmware y documentación; nada subido a GitHub.**
- **Evaluación de la Parte 3** (sin implementar, revisada con el advisor): Bluetooth, mando, QR, tutorial, anuncios y H-20 en [evaluacion-parte-3.md](evaluacion-parte-3.md). Decisiones del dueño: mando descartado, Bluetooth pospuesto, tutorial al final (antes, una ronda de ajustes de textos y diseño), OLED de 1,3" en camino.
- **Firmware v5** (publicada y probada en la TV real): `19d6a97` (`EscritorBase64` de `github.cpp` cede la CPU un tick por bloque, igual que `EscritorOta`: con el Wi-Fi rápido el bucle no esperaba datos y el watchdog de tareas podía reiniciar la TV a mitad de una descarga grande; las 4 descargas usan esa clase; revisados y sin cambios: el SSE de `red.cpp`, los `deserializeJson` del stream y `clima.cpp`), `272f8e1` (se agrega `qrcodegen` de Nayuki, MIT, sin modificar), `698cc7c` (QR del portal: `WIFI:T:WPA;S:TV RETRO;P:<clave>;;`, versión 2 de 25×25 módulos con el texto partido en segmentos, y polaridad que alterna cada 4 s), `545a7e9` (`FIRMWARE_BUILD 5`). La actualización 4 → 5 por Wi-Fi tardó 45 s y quedó validada a los ~35 s.
- **Firmware v6:** `d86b3bc` (hallazgo propio: WiFiManager 2.0.17 registra de fábrica `/update` y `/u`, que instalan un `.bin` **sin firma**, saltándose la verificación de H-19, además de `/erase` e `/info`; el menú queda solo con Wi-Fi y las rutas se cierran con 404 desde el callback del servidor, que corre antes de que la librería registre las suyas), `fe8dfd9` (pantalla guía: al unirse un celular la TV muestra "Conectado! Toca el aviso que salió en tu celular para abrir TV RETRO", y tras 30 s "O abre 192.168.4.1"), `20e0b70` (`FIRMWARE_BUILD 6`). Motivo: en el Moto del dueño Android **no abre la página solo** al unirse por QR, solo avisa con una notificación; el firmware responde bien (Android lo detectó) y abrir solo o avisar es regla de Android y del fabricante.
- **Portal con páginas propias (v7).** Camino elegido con el advisor: páginas propias y WiFiManager solo para recibir `/wifisave`, probar la conexión y guardar. Visual: `e09159f` (maqueta HTML y CSS con el estilo de la app, probada a 390×844 y 360×740 sin desborde), `001a8d1` (dos id). Lógica: `b311503` (`portal.js`: lista de redes, hoja de la clave con mínimo de 8 caracteres y ojo, campo sin mayúscula automática ni corrector, resultado; nombres de red solo con `textContent`; 27 comprobaciones en el navegador contra un servidor falso, incluido un nombre de red con HTML), `5d98a3b` (`herramientas/generar-portal.cjs` → `OLED_Remota/portal_pagina.h`, 22 KB; la página generada pasa las mismas 27 pruebas). Firmware: `0c7f63d` (rutas `/`, `/redes`, `/estado`; las redes se buscan antes de abrir el portal y "Buscar de nuevo" busca sin bloquear; el portal ya no vence con un celular conectado y dura 300 s en vez de 180), `42d0fd7` (la OLED muestra "Conectando…" y el resultado: clave incorrecta, red no encontrada o no se pudo conectar), `f9c04e7` (pila de 6144 bytes para la tarea de la pantalla), `f0b1755` (`FIRMWARE_BUILD 7`).
- **Hallazgo de diseño verificado en el código de WiFiManager:** `connectWifi` es una llamada bloqueante dentro del bucle del portal (hasta ~2 s de espera más 20 s de conexión): el servidor web no responde mientras la TV intenta unirse, y la radio cambia al canal del router, así que el celular puede perder la red "TV RETRO". Por eso el resultado seguro lo da la OLED y la página, si pierde la red, manda a mirar la TV en lugar de inventar un resultado.
- **Herramientas:** `58ca24f` (`portal/probar-portal.mjs` y `herramientas/escuchar-serie-seguro.ps1`).
- **Documentación y legal:** `b57180f` (firmware: salto de línea que faltaba), panel `10fe7e8` (alcance real de H-20: las claves de Wi-Fi están en LittleFS y la cuenta de la TV en la NVS en claro, y el núcleo precompilado no trae cifrado), `8a9b42f` (`licencias.html` lista la librería de QR), `5ef14b8` ([portal-wifi.md](portal-wifi.md) y [evaluacion-parte-3.md](evaluacion-parte-3.md)).
- **Pruebas reales con la TV (2026-11-20):** QR leído con un Moto Edge 50 Neo en todas las variantes (mejor el de fondo oscuro); portal v7: clave incorrecta (error correcto en el celular y en la TV, motivo 15) y clave correcta (conectó en ~4 s, `guardada` actualizó la entrada existente sin duplicarla, sesión iniciada y alarma y ajustes aplicados); el portal no venció en ~3 min; Android no abrió la página solo (notificación). Aún sin probar: GIF grande para el watchdog, la pantalla guía, un iPhone y la OLED de 1,3".
- **Errores y lecciones de la sesión (honestos):** la primera compilación de la v5 salió con `FIRMWARE_BUILD 4` porque mi edición falló (no había leído el archivo); mi comprobación de CRLF con `grep -c $'\r'` era inválida en este shell (cuenta todas las líneas) y lo descubrí por un parche que no encontraba su ancla; el monitor serie original llenó cientos de MB de errores cuando COM6 no existía; `arduino-cli` falló varias veces de forma intermitente (`CreateProcess`/`Access is denied`) y pasó al reintentar; la pantalla "dejó de mostrar" por un cable flojo, no por el firmware. Detalle de las lecciones en la sección 9 de `CLAUDE.md`.

**2026-11-21, ronda de textos de la app (textos y detalles de diseño; sin campos nuevos de Firebase; subido a GitHub el 2026-11-21 por pedido del dueño):** el dueño pidió que la app no muestre datos técnicos ni explique de más al cliente. Se revisaron los ~340 textos visibles y el dueño aprobó 23 cambios uno por uno (los de GIF pesado y el de restablecer los dictó él). Commits: `fc2cc2f` y `93f9205` (avisos de GIF pesado: "GIF pesado: tardará un poco más de lo normal en llegar" y "GIF muy pesado, puede tardar en llegar"), `b456a0e` (JS: estados sin cuadros/KB/px ni nombres entre comillas, confirmaciones más cortas, los "Error desconocido…" pasan a "Algo salió mal. Vuelve a intentarlo.", "sin señal del dispositivo" pasa a "desconectado") y `26cff0a` (HTML: "Enviar a la TV" en lugar de "Enviar a la OLED", "Escribe tu mensaje…", "Clásica", "Importar canciones", "Cargando…" y el texto de eliminar cuenta más corto). Quedan igual a propósito los nombres de las fuentes (Sans, Serif) y los límites de 10 GIF y 25 elementos. Después el dueño pidió "Pixelar" (antes "Difuminado") y "Nivel de pixelado" (antes "Umbral"), en imagen y en Galería (`4e593f6`); "Scroll" se deja igual por ahora. Después, a pedido del dueño, "Bienvenido" como mensaje por defecto del panel (antes "Hola Mundo"; `2b8f35f`: `main.js` y dos respaldos de `firebase.js`; con una cuenta que ya tiene pantalla guardada se sigue viendo lo guardado). **Revisión de diseño (2026-11-21, con capturas en 390×844 y 360×740 comparadas con la versión anterior, y después en un Moto Edge 50 Neo por adb):** ningún elemento se movió con los textos; se corrigieron tres detalles: la línea de estado admite hasta dos líneas en vez de cortarse con "…" (`4eb73f7`, CSS), más aire (10 px, antes 6) entre los botones del lienzo y el selector de grosor en Dibujo (mismo commit) y el selector de canciones vacío dice "Importa con +" (`0af5254`). **APK:** los cuadros de confirmación (`confirm`/`alert`, por ejemplo "¿Restablecer la TV?") salían con los botones en inglés ("OK" y "Cancel", fijos en Capacitor); `ChromeEnEspanol.java` hereda de `BridgeWebChromeClient` y los muestra como "Aceptar" y "Cancelar" (`5c89410`, probado en el celular: Cancelar no ejecuta nada). **Banco completo de pruebas:** 41 suites; `bobos` y `auditoria-b` comprobaban los textos viejos y se actualizaron (`003c385`); `compartir` falló una vez por tiempos bajo carga y pasa sola y en la repetición. **Firmware v8 (repo del firmware, `ff256c5` y `71ed83b`; **PUBLICADA por OTA el 2026-11-21** con `publicar-firmware.cjs` (1 576 864 bytes, firma válida; `firmware/estable` = 8 y se borró la 6 vieja); el dueño la instaló desde Config > Sistema y la probó en la TV real: router apagado y TV reiniciada, la indicación "Sin WiFi" se mantuvo fija casi un minuto y al volver el router se reconectó sola (la pantalla quedó negra un instante y volvió el contenido):** pantalla "Sin WiFi" fija. **GIF grande probado en la TV real:** 155 250 bytes en 5,6 s y 414 000 bytes en 14,2 s, sin reinicio por watchdog (confirma el arreglo de la v5). **Mensaje de estado:** un error como "El portapapeles no tiene una imagen…" se quedaba visible en las otras pestañas; ahora `cambiarTipo()` lo limpia (`b31788e`; los "ok" y los neutros se conservan). Probado en el navegador. **Tutorial guiado (2026-11-21, a pedido del dueño: "dejar la app lista y pulida"):** hecho en pasos pequeños con las decisiones del dueño (primera vez con TV vinculada; recordado en el celular; los 8 pasos del borrador; Saltar cuenta como visto y fila "Ver tutorial" en Config): HTML (`5a4c371`), CSS (`affec19`), `js/tutorial.js` (`2f5e4a5`), enganche en `main.js` y `ui.js` (`20524eb`) y pruebas (`1a889e6`, suite `tutorial.mjs` de 11 escenarios; `banco.mjs` lo da por visto por defecto). Revisado en un Moto Edge 50 Neo: dos detalles pulidos en `ea0d469` (el aro cortado en los bordes y el doble aro de foco de "Siguiente"). `compartir.mjs` ganó reintentos (`09b09cd`) porque fallaba a veces al leer la base falsa durante una recarga. Se corrieron las 22 suites del panel que pasan por el arnés cambiado (no las de reglas): todas en verde. Detalle y cómo cambiarlo en [plan-tutorial.md](plan-tutorial.md). Pendiente de esta ronda: nada. Al cierre: APK de depuración reconstruida e instalada en el Moto Edge 50 Neo con todo (se comprobó allí que el error se limpia al cambiar de pestaña); **plan del tutorial guiado en [plan-tutorial.md](plan-tutorial.md)** (solo propuesta, para otra conversación); y se **actualizó `ayuda.html`** (sección del Wi-Fi: QR, página de inicio de sesión, Ajustes > Wi-Fi en iPhone, rueda 5 s al cambiar de router) con el texto aprobado por el dueño; lo de iPhone no se probó con un iPhone. Prueba puntual: `etapa1-topes.mjs` en verde. La copia de la APK (`app-android/.../assets/public`) se regenera con `copiar-web.mjs` al compilar.

## Versión Lite (rama `lite`, 2026-11-21/22)

Versión barata de la TV: ESP32-C3, sin nube ni cuentas, solo Android, todo por Bluetooth LE. **No cambia nada de la versión Pro**: vive en carpetas nuevas (`app-lite/`, `lite/` en el panel; `OLED_Lite/` y `OLED_Lite_prueba/` en el firmware) y en las ramas `lite` de los dos repos (sin push ni merge). Decisiones, mediciones y la especificación del protocolo: [evaluacion-version-lite.md](evaluacion-version-lite.md); investigación de mercado: [lite-investigacion-transporte.md](lite-investigacion-transporte.md); textos nuevos para aprobar: [lite-textos-propuestos.md](lite-textos-propuestos.md); qué probar en la placa: [lite-lista-de-prueba-en-placa.md](lite-lista-de-prueba-en-placa.md).

- **Prueba de viabilidad (S3 + Moto Edge 50 Neo):** 100 KB por Bluetooth en 2–3 s con el navegador (54–63 KB/s) y a ~22 KB/s con el plugin de Capacitor; 48 envíos sin un fallo; emparejamiento con PIN en la OLED (un celular, sobrevive al reinicio, un desconocido no puede escribir); biblioteca de canciones con caché que borra las menos usadas (114 canciones en una TV de 1,4 MB) y sobrevive a un reinicio.
- **App Lite = app Pro con otro "backend"**: `app-lite/construir.mjs` empaqueta `js/main.js` de la Pro con esbuild y cambia `./firebase.js` por `app-lite/src/backend-lite.js` (los 54 nombres que importan los módulos de la Pro: Bluetooth para enviar, IndexedDB del celular para la Galería, catálogo de canciones y biblioteca predeterminada dentro de la app, alarma y ajustes por Bluetooth). Toma el `index.html` de la Pro con cambios mínimos y copia su CSS y fuentes sin editarlos; `lite.css` oculta lo que la Lite no usa (juegos, cuentas, Mi TV, sistema, importar canciones, tutorial). `src/gif-lite.js` cambia solo los avisos de peso del GIF (100 KB / 250 KB; rechazo sobre 600 KB). Modo sin cuentas = el `?sincuentas=1` que la Pro ya traía.
- **Firmware real (`OLED_Lite/`)**: recibe el mismo JSON `pantalla` de la Pro (texto, imagen, dibujo, GIF z1) con `texto.cpp`, `fuentes.cpp` y `animacion.cpp` **copiados exactos** de la Pro (`herramientas/comprobar-copias-lite.cjs` lo vigila); hora que da el celular; 3 alarmas que suenan solas con la canción protegida; ajustes (brillo, volumen, zona); un botón (toque corto calla o cambia de pantalla, 8 s con nada sonando empareja); recuerda lo último. Compilado para C3: **909 KB (69 % de 1,25 MB)**, 76 KB de memoria estática; también compila para S3. **No probado en la placa.**
- **Protocolo**: aviso de hueco una sola vez, reenvío por silencio y confirmaciones retenidas hasta haber sitio (se encontró y arregló una cascada de reenvíos con la TV simulada); un INICIO nuevo reemplaza al envío en curso; el GIF se escribe directo a su archivo.
- **Pruebas**: `app-lite/pruebas/` (9 suites, 77 comprobaciones, todas en verde) con un Bluetooth falso que responde como la TV (`tv-simulada.js`): arranque, texto, canciones, dibujo/imagen/GIF, galería, alarma y ajustes, conexión (TV apagada, paquetes perdidos, TV colgada, conexión cortada, doble toque), GIF pesado y biblioteca predeterminada.
- **Pendiente**: grabar y probar el firmware en la placa y la app en el celular (lista aparte), los textos propuestos, los borradores legales (abogado), la C3 real (alcance, batería, reloj), y decidir si la biblioteca predeterminada se baja de internet (necesita reglas y acceso anónimo que publica el dueño).
- **Primera prueba en el celular y la S3 (2026-11-22):** el firmware real `OLED_Lite` se grabó en la S3 y arrancó bien (pantalla, biblioteca, ajustes, BLE; 178 KB de memoria libre). La app mostró un fallo de la APP, no del firmware: al abrir, la reconexión de fondo conectaba con la última TV y, sin vínculo, llamaba a `createBond()` del plugin, que espera solo **5 s** (llegaba como notificación de sincronización y vencía con "Bonding timeout"); la conexión quedaba abierta, la TV dejaba de anunciarse y el selector decía "No se encontró ninguna TV". Arreglo (`ble.js`): espera de 100 s al PIN, la reconexión de fondo nunca empareja (se pausa hasta volver a la app o tocar Enviar), toda conexión fallida se desconecta, mensaje propio si no se pudo emparejar. Emparejar desde los ajustes de Bluetooth del celular y enviar sí funcionaba. Sin probar todavía en el celular con la APK nueva: emparejar desde la app y el caso de mantener 8 s en la TV sin olvidarla en el celular (el celular cree que sigue vinculado).
- **Probado en la S3 y el celular real (2026-11-22, tarde):** emparejar desde la app con PIN **funciona** (conectó, la TV mostró el PIN, "cifrada 1, autenticada 1, vinculada 1") y llegaron texto, imágenes y GIF de la galería sin error (de 205 B a 1,6 KB; velocidades de 1,5 a 14 KB/s en envíos tan pequeños). Reabrir la app reconectó sola. Al mantener 8 s en la TV SIN olvidarla en el celular, Android repitió el emparejamiento por su cuenta (la TV vio "cifrada 0", se desconectó y pidió PIN de nuevo), sin quedarse colgado. Lo que molesta es la notificación de Android al emparejar desde la app (la primera pulsación no hace nada), así que se añadió la pantalla "Conecta tu TV" (`inicio-conexion.js`, solo en Android sin TV emparejada: abre los ajustes de Bluetooth del celular y, al volver, busca sola la TV emparejada por su nombre) y la ventana de emparejamiento de la TV pasó de 2 a **5 minutos** (firmware `9d18a86`, grabado en la S3). El emparejamiento al tocar Enviar queda de respaldo.
- **Lógica de la Pro que faltaba en la TV Lite (2026-11-22, a pedido del dueño: "si estoy en el reloj y llega un mensaje suena y sale la noti en el reloj, no se cambia al mensaje"):** se comparó `OLED_Remota` con `OLED_Lite`. Antes, todo envío del celular pasaba la TV a contenido y encendía la pantalla. Ahora (firmware `ea8aefc` y `bc27959`, grabado en la S3): el contenido se guarda y se dibuja solo si se está viendo el contenido (`contenido_aplicar` ya no dibuja); suena el aviso de dos pitidos de la Pro salvo con canción o alarma sonando; el reloj muestra un sobre (mensaje sin ver) hasta volver al contenido; la TV arranca en contenido; y el aviso simple de la alarma usa esos pitidos. Diferencias que se dejaron para decidir con el dueño: el toque que calla un sonido no cambia de pantalla, no hay posponer 5 min (un solo botón), no se repone la imagen de un musical tras la alarma (H-33), no se olvida el contenido al abrir el emparejamiento (H-34) y el reloj no lleva íconos de conexión.
- **App unificada (2026-11-22, `app-unificada/`):** una sola app con TV Pro y TV Lite. Se arma desde una copia de la Pro sin tocarla; `firebase.js` pasa a ser un enrutador (66 funciones decididas a mano) y la parte Bluetooth (`ble.js` de la Lite) se carga solo con una TV Lite. Las TV Lite viven en el celular (`lite:<dirección>`), se añaden desde "Añade tu TV" y la galería y las canciones salen de la nube. Probado con Firebase y Bluetooth simulados (33 comprobaciones propias en verde) y con las pruebas ORIGINALES de la Pro (`correr-pruebas-pro.mjs`): `login` y `login-google` mostraron que cargar el núcleo de Capacitor reescribía `window.Capacitor`, así que la parte Bluetooth pasó a cargarse bajo demanda. APK de depuración compilada con paquete provisional `com.tvretro.unificada` (no reemplaza la Pro ni la Lite instaladas). Detalle y pendientes: [app-unificada.md](app-unificada.md). Commits `41c557a` … `07d134b`.
- **Primera prueba real de la app unificada (2026-11-22, celular del dueño + TV Lite en la S3):** la APK `com.tvretro.unificada` entró con correo, mostró la TV Pro con su estado de siempre, y "Tengo una TV Lite" encontró la TV ya emparejada. Como la TV se había reiniciado al grabar el firmware, esa primera conexión falló (el celular creía estar vinculado y la TV no) y la app se desconectó sola; Android pidió el PIN otra vez, el dueño lo escribió desde los ajustes, la app reconectó SIN pedir PIN y dos envíos a la TV Lite fueron confirmados por la TV ("En la TV ✅"). Pendiente de esa prueba: la app no avisa en pantalla del vínculo roto; y el dueño encontró que con una canción sonando, un toque en el botón de la TV la calla en vez de llevarlo a la pantalla con la letra (en la Pro el toque calla Y cambia de pantalla). Respaldo de la Pro antes de seguir: etiquetas `respaldo-pro-antes-de-lite-2026-11-22` en los dos repos, paquetes verificados y la APK de la Pro instalada, en `C:ProyectosTV_RETRO-respaldos` (nada se subió a GitHub).
- **Botón de la TV Lite con una canción sonando (2026-11-22, firmware `a54333e`, grabado en la S3 y probado por el dueño):** la regla nueva (en otra pantalla, un toque lleva a la pantalla de la canción y la música sigue; en la pantalla de la canción, un toque cambia de pantalla y la calla; la alarma se calla con un toque) funcionó en los cinco casos de la lista (sobre en el reloj, un toque a la letra, segundo toque que calla, pantalla apagada, alarma). La Pro conserva su regla (el toque calla y cambia a la vez); no se tocó.
- **App unificada: "¿Qué TV tienes?" y aviso del vínculo roto (2026-11-22, `c6ada2d` … `0540930`):** la primera vez, "Añade tu TV" pregunta el tipo de TV dentro de la misma tarjeta (TV Pro marcada; TV Lite abre "Conecta tu TV"); y la reconexión de fondo avisa con un cuadro cuando la TV Lite ya no reconoce al celular (`ble.js` gana el gancho `alVinculoRoto`, que la app Lite no usa; la TV simulada gana `rechazarEscrituras`). Pruebas de la unificada: 40 comprobaciones en verde. Textos propuestos 34 a 36.
- **App unificada: primera pantalla "¿Qué TV tienes?" y TV Lite sin cuenta (2026-11-22, `ce2e2e7`, `497c287`):** la pregunta pasa a ser la primera pantalla; con TV Lite no se pide cuenta (sesión anónima invisible, a activar por el dueño en Firebase) y la galería propia queda en el celular, mientras lo predeterminado sigue llegando de la nube. Pruebas de la unificada: 57 comprobaciones en verde (`sin-cuenta.mjs` nueva). Firmware Lite: el reloj sin hora dice "Abre la app" (propuesta). Textos propuestos 37 a 41.
- **Pruebas reales de la app unificada con el dueño (2026-11-23, celular + TV Lite en la S3 con el firmware `fccb763`):** pasaron la primera pantalla, la entrada con cuenta (TV Pro), la TV Lite sin cuenta (sin pedir cuenta, conexión sola), los envíos (texto, imagen predeterminada, foto, dibujo, GIF, canciones con y sin letra desde la nube), la alarma sola con la app cerrada, brillo y volumen, el aviso de vínculo roto y volver a la TV Pro (la app Pro original sigue igual). Dos errores, los dos de la unificada y con la misma causa (`e90cdd8`): sin cuenta, el tutorial de la Pro se abría OCULTO (el CSS lo escondía) y la clase `tutorial-abierto` dejaba la página sin scroll, así que la Galería no bajaba y el teclado tapaba el nombre al guardar; se encontró con la depuración del WebView del celular y se comprobó el arreglo en el celular (la Galería baja). Aclaración: tras volver la corriente, la TV muestra lo último enviado; "Abre la app" se ve en el reloj (un toque).
- **Teclado sobre el campo "Nombre" (2026-11-23, `4df215a`, solo la unificada):** en la pestaña Imagen, al abrir el teclado la barra fija "Enviar a la TV" y la navegación quedaban encima del teclado y tapaban "Nombre" (el sistema no lo subía porque lo daba por visible). `app-unificada/src/teclado.js` desplaza la página lo justo al tomar el foco y al cambiar el tamaño de la pantalla. Prueba nueva `app-unificada/pruebas/teclado.mjs` (falla sin el arreglo) y comprobado en el celular del dueño. La Pro tiene el mismo diseño y probablemente lo mismo; no se tocó (decide el dueño).
