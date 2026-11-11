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
