# Rediseño de TV RETRO: qué cambió

Todo el trabajo está en la rama `rediseno-app`. Este documento resume, por área, qué hace ahora el panel, qué campos nuevos escribe en Firebase y qué queda pendiente.

## 1. Estructura de app

- **Antes:** una sola página larga con todo apilado. **Ahora:** una app con pestañas, pensada primero para el celular.
- **Cabecera fija:** "TV RETRO" centrado y la **tarjeta del dispositivo**:
  - la vista previa exacta de la OLED;
  - el estado de conexión (en línea o desconectado) con la hora de la última señal ("hace 4 s", o fecha y hora si pasó más de un día);
  - el interruptor **Invertir**, siempre a la vista;
  - el resultado del último envío.
- **Navegación inferior** con ícono y texto: Texto, Imagen, Dibujo, Música (desde el 2026-11-10, "Canciones") y Galería. Al cambiar de pestaña, la página vuelve arriba.
- **Botón "Enviar a la OLED"** fijo abajo, en la zona del pulgar.
- **Escritorio** (desde 900 px de ancho): dos columnas. La OLED queda fija a la izquierda, con Enviar abajo; las pestañas y el contenido van a la derecha.
- **Celular en horizontal:** la cabecera deja de quedar fija para que se pueda llegar a todos los controles.
- **Objetivo cumplido:** cada pestaña, salvo las grillas de la Galería, entra sin scroll en celulares de 390×844 y 360×740.
- **Se quitaron** los textos explicativos (más adelante habrá un tutorial guiado), "Firmware V1.6" y el pie "Firebase Realtime Database".
- **El contador de versión** ("v356") ya no aparece en la pantalla. Se ve en la consola del navegador (F12) como `[TV RETRO] …`.

## 2. Estilo visual

Las decisiones se tomaron a partir de estudios y guías publicadas (Nielsen Norman Group, Material Design, Apple, estudios de *eye tracking*). Los detalles están en el historial de la conversación de diseño.

- **Modo oscuro:** gris azulado muy oscuro (`#0B0F14`), no negro puro, y texto blanco suavizado.
- **Acento cian** `#4DD2FF`, el mismo color de la OLED. Para los rellenos grandes se usa una versión un poco menos saturada (`#50C5EC`), para que no encandile.
- **Formas:** esquinas redondeadas moderadas y botones de al menos 44 px.
- **Tipografía:** Space Grotesk para la interfaz y JetBrains Mono para los datos.
- **Dónde está:** los colores, fuentes y medidas viven en `css/tokens.css`, que comparten el panel y `carga-masiva.html`.

## 3. Pestaña Texto

- **Letra:** Sans (por defecto, como la herramienta CancionesMiniTV), Sans negrita, Serif, Serif cursiva y la Clásica 5×7. Las fuentes nuevas tienen ñ, tildes, ¿ y ¡.
- **Tamaño de 1 a 5**, con la misma escala para todos los estilos. En las fuentes nuevas equivale a 6, 10, 12, 16 y 18 pt.
- **Alineación Auto o Manual:**
  - **Auto:** íconos de alineación horizontal y vertical.
  - **Manual:** sliders X e Y. Al pasar a Manual, el texto no salta de lugar, y los sliders se limitan para que nunca se salga de la pantalla.
- **Modo:**
  - **Ajustar.**
  - **Scroll ↔:** una línea que entra por la derecha.
  - **Scroll ↕:** el texto sube línea por línea. Espera 1 s, sube a 12 px/s, espera 1 s al final y se repite.

## 4. Pestaña Imagen

- **Subir una imagen o un GIF animado.** Un GIF se reproduce en bucle en la vista previa y se envía como animación.
- **Pegar del portapapeles:** con el botón **Pegar** (el navegador pide permiso la primera vez) o con Ctrl+V en la computadora.
- **Encuadre:**
  - escala: Ajustar, Llenar, Estirar u Original;
  - rotar 90° por toque;
  - voltear horizontal o vertical;
  - fondo negro o blanco.
- **Difuminado Atkinson**, el mismo de CancionesMiniTV. Con el anterior (Floyd-Steinberg) el umbral casi no cambiaba el resultado; con Atkinson sí aclara u oscurece la imagen.
- **Aviso de GIF pesado:** cada cuadro ocupa unos 1,4 KB. Hasta 28 KB (unos 20 cuadros) no hay aviso. Entre 28 y 56 KB aparece un aviso amarillo, y por encima de 56 KB uno rojo, "GIF muy pesado/largo". Son límites pensados para un ESP32 común sin PSRAM; solo avisan, no bloquean el envío.
- **Actualización:** desde el commit `73c2868` los GIF se envían **comprimidos** (formato z1, sin pérdida) y el aviso usa el tamaño comprimido: seguro hasta 64 KB, rojo por encima de 110 KB. Los límites de 28/56 KB quedan solo para navegadores sin compresión. **Actualización 2026-11-10:** con el ESP32-S3, sin aviso hasta 256 KB y rojo por encima de 1 MB (commit `999a64c`). Ver [formatos-datos.md](formatos-datos.md).

## 5. Pestaña Dibujo

- Deshacer, Rehacer y Limpiar son botones de ícono. Deshacer y Rehacer se apagan cuando no hay nada que deshacer o rehacer.
- **Expandir (⤢):** el lienzo pasa a pantalla completa en horizontal, con una barra angosta a la derecha (grosor, deshacer, rehacer, limpiar, zoom y contraer).
  - En Chrome para Android pide pantalla completa y bloquea la rotación.
  - Se contrae con el botón, con el "Atrás" de Android o con Escape.
  - Es el mismo lienzo: el dibujo se conserva.
- **Zoom, como en WhatsApp:** pellizcar con dos dedos para acercar y alejar (hasta ×8) y arrastrar para moverse. La rueda del mouse también hace zoom. El indicador "×N" vuelve a ×1 al tocarlo. Si al pellizcar el primer dedo ya había empezado un trazo, ese trazo se descarta.

## 6. Pestaña Música (ahora Canciones)

Selector de canción y número de repeticiones, en el estilo de la app. Invertir se oculta en esta pestaña, porque la pantalla no cambia mientras suena el buzzer.

**Actualización (9 nov 2026):** la pestaña pasó a llamarse Canciones y usa el catálogo nuevo de **musicales** (`.ino` importados), con la opción Con letra / Sin letra. Ver [musicales.md](musicales.md).

## 7. Pestaña Galería

- **Tres listas:** Imágenes, Animaciones y **GIF**. Los GIF se guardan en `animaciones/` con `meta.origen: "gif"`.
- **Arriba:** el selector de lista, el tacho de borrar y una fila con **+** (añadir una imagen o un GIF), el nombre y Guardar.
- **Ajustes de umbral y difuminado:** aparecen solo cuando hay una imagen que se puede reajustar.

## 8. Firebase

- **Los campos existentes no cambiaron.**
- **`enviarEstado` ahora usa `update()` en lugar de `set()`:** escribe `version` y `pantalla` sin borrar `lastSeen`. Antes, justo después de cada envío, el indicador marcaba "sin señal".
- **Campos nuevos en `oled_remota/pantalla/config`.** Todos tienen un valor por defecto pensado para que un firmware que todavía no los conozca siga funcionando como antes:

| Campo | Valores | Si falta |
|---|---|---|
| `fuente` | `clasica`, `sans`, `sansb`, `serif`, `serifi` | clásica |
| `tamano` | ahora de 1 a 5 (antes de 1 a 4) | — |
| `manual`, `x`, `y` | posición manual del bloque de texto | se usa la alineación |
| `direccion` | `h` o `v` (scroll horizontal o vertical) | horizontal |

- **Animaciones:** un GIF se envía como `tipo: "animacion"`, el formato que ya existía.
- **Firmware:** lo que tiene que hacer con estos campos está en [firmware-fuentes.md](firmware-fuentes.md).

## 9. carga-masiva.html

Tiene el mismo estilo que el panel: tarjetas con ícono y un botón para volver al panel. Su lógica no cambió.

## 10. Pendiente

> Actualizado el 9 nov 2026. La lista viva de pendientes está en [contexto-general.md §8](contexto-general.md).

- ~~**Firmware:** dibujar las fuentes nuevas, el tamaño 5, la posición manual y el scroll vertical.~~ Hecho en el firmware ESP32 / ESP32-S3.
- ~~**Envío de GIF y archivos pesados:** optimizarlo.~~ Hecho: formato z1 comprimido, descarga directa a LittleFS.
- **Login y reglas de seguridad de Firebase:** la pantalla de inicio de sesión ya está diseñada pero oculta. Falta conectarla y publicar las reglas.
- **Tutorial guiado** la primera vez que se abre la app.
- **APK con Capacitor:**
  - pegar del portapapeles necesita un plugin nativo, porque el WebView de Android no permite leerlo;
  - bloquear la rotación del lienzo expandido necesita el plugin de orientación.
