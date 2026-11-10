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

## Etapa 5: musicales (9 nov 2026, en curso)

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
| panel | *(este cambio)* | Documentación actualizada con lo anterior. |
