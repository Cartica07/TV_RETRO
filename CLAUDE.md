# OLED Control — Guía para Claude

## Qué es
Panel web (HTML/CSS/JS puro, módulos ES, sin frameworks) con Firebase Realtime Database que controla a distancia una OLED SSD1306 128×64 conectada a un ESP8266/ESP32. Envía textos, imágenes, dibujos, canciones (buzzer) y animaciones; el microcontrolador lee Firebase y los muestra. `carga-masiva.html` es una página aparte (no enlazada) para subir contenido en lote.

## Archivos
- `index.html` + `js/main.js` (orquestador) + `js/ui.js` (IDs del DOM y helpers visuales)
- `js/firebase.js`: ÚNICO acceso a Firebase
- `js/renderer.js` + `js/fonts.js`: réplica pixel-perfect de la OLED (fuente clásica 5×7)
- `js/fuentesTexto.js` + `js/fuentesGfx.js`: fuentes FreeSans/FreeSerif (GFXfont, generadas desde CancionesMiniTV/fuentes.js)
- `js/imageProcessor.js` (difuminado Atkinson, encuadre: escala/fondo/rotar/voltear), `js/gif.js` (GIF animado → animación `{ancho, alto, cuadros:[{datos, dur}]}`), `js/dibujo.js`, `js/lienzoZoom.js` (zoom y desplazamiento del lienzo de Dibujo; modo expandido = clase `body.dibujo-expandido`)
- Referencia externa (solo lectura, no modificar ni commitear): `C:\Proyectos\CancionesMiniTV` (repo Cartica07/CancionesMiniTV). De ahí se portaron el decodificador de GIF, Atkinson y el encuadre.
- `css/tokens.css`: tokens de diseño (colores, fuentes, medidas) compartidos por las dos páginas
- `css/style.css`: estilos del panel (estructura de app: cabecera fija, barra de Enviar, navegación inferior; en escritorio, dos columnas)
- `carga-masiva.html`: usa `css/tokens.css` + estilos propios inline; su `<script>` inline no se toca en pasos visuales

## Estructura de index.html (rediseño)
- `.cabecera-fija` (barra superior + tarjeta `.dispositivo` con `#oled`), `main.controles` con una sección por pestaña, `.barra-accion` (Enviar + estado) y `nav.nav-inferior`.
- La navegación inferior ES `#grupoTipo`: sus botones `data-valor` (texto, imagen, dibujo, cancion, galeria) los usa `cambiarTipo()` en main.js.
- Objetivo de diseño: cada pestaña (salvo las grillas de Galería) entra SIN scroll en celulares de 390×844 y 360×740. Sin textos explicativos (se explicarán con un tutorial guiado más adelante). Medirlo con un script que compare el final de `main.controles` con el borde superior de `.barra-accion`.
- Cada pantalla son `.campo` con un `.rotulo` corto (sin títulos de grupo); filas con interruptor: `.fila-ajuste-simple`; nombre + Guardar en una fila: `.fila-guardar-inline`.
- La tarjeta `.dispositivo` contiene también `#filaInvertido` (Invertir, siempre visible) y `#estadoLinea` (resultado del último envío).
- Galería: `#seccionGaleriaFinal` (herramientas: selector `#grupoSubvistaGaleria`, tachos, añadir/guardar, `#grupoAjustesGaleria`) va antes que `#seccionGaleria` (grillas). Los elementos con `data-subvista` los muestra/oculta `actualizarVistaGaleria()` en main.js.
- Colores: `--acento` (#4DD2FF, el de la OLED) para textos e íconos; `--acento-relleno` (#50C5EC, desaturado) para rellenos grandes.

## Contrato con el firmware (NO CAMBIAR)
- `oled_remota` = `{ version, pantalla: { tipo, texto, config{tamano,alineacion,alineacionV,invertido,modoTexto,fuente,manual,x,y,direccion}, imagen{ancho,alto,datos} | cancion{nombre,repeticiones,notas} | animacion{nombre,ancho,alto,cuadros[{datos,dur}]} } }`
- `config.fuente` (agregado con aprobación del dueño): `clasica` | `sans` | `sansb` | `serif` | `serifi`. Para el firmware, si falta es `clasica`; el panel usa `sans` por defecto (FUENTE_DEFECTO, como CancionesMiniTV).
- `config.manual`, `config.x`, `config.y` (agregados con aprobación): posición manual del bloque de texto; con `manual = false` se usan `alineacion`/`alineacionV` como siempre. `config.tamano` va de 1 a 5 (en las fuentes nuevas: 6/10/12/16/18 pt). Implementado en el firmware ESP32 (`texto.cpp`, rama `esp32` del repo Firmware-TV-RETRO); detalle en `docs/firmware-fuentes.md`.
- Fuente clásica: glcdfont está en orden CP437; las tildes/ñ/¿/¡ se dibujan con la tabla `LATIN1_A_CP437` (fonts.js), la misma que usa el firmware.
- `config.direccion` (agregado): `h` | `v`; con `modoTexto = "scroll"`, `v` es scroll vertical (en la interfaz, el radio `scrollv`). Si falta, `h`.
- `oled_remota/lastSeen` (heartbeat, solo lectura desde la web)
- Catálogos: `canciones/`, `imagenes/`, `animaciones/` (hermanos de `oled_remota`)
- Dibujo y Galería se envían como `tipo:"imagen"`. Un GIF subido en la pestaña Imagen se envía como `tipo:"animacion"`.
- GIF guardados: en `animaciones/` con `meta.origen: "gif"` (así se separan en la lista GIF de la Galería; el ESP no lee los catálogos). Se pueden subir desde la pestaña Imagen (con encuadre) o desde el + de la Galería.
- Animaciones comprimidas (formato `z1`, aprobado por el dueño, `js/compresion.js`): `pantalla.animacion = {nombre, ancho, alto, formato:"z1", cantidad}` (sin `cuadros`) y los cuadros en `oled_remota/archivo = {version, datos}` (misma `version` que el envío, en el mismo `update()`). `datos` = Base64 de, por cada cuadro, `[uint32 dur][uint16 bytes][deflate-raw del bitmap 1bpp]` (little-endian; cada cuadro comprimido por separado, sin pérdida). Con otro tipo de contenido, `archivo` se borra (null). Si el navegador no tiene CompressionStream, se envía el formato viejo (`cuadros`), que el firmware sigue aceptando.
- Peso de animaciones: el firmware ESP32 las baja directo a LittleFS (256 KB), no a la RAM. Aviso por tamaño comprimido: seguro ≤ 64 KB, rojo > 110 KB (`evaluarPesoComprimido` en gif.js). `evaluarPesoAnimacion` (formato viejo, 28/56 KB) queda para navegadores sin compresión. Solo avisa, no bloquea.
- `enviarEstado` usa `update()` sobre `oled_remota` (escribe `version` y `pantalla` sin borrar `lastSeen`).
- Seguridad: login con Firebase Auth (email/contraseña) en index.html y carga-masiva.html; reglas en `database.rules.json` (lectura pública de `oled_remota` para el ESP, `lastSeen` escribible por el ESP, todo lo demás restringido al UID del dueño).

## Nombre de la app
- El nombre visible pasa a ser **TV RETRO** (antes "OLED Remota" / "OLED Control"). Aplicarlo en los pasos visuales: `<title>`, encabezados, barra superior, footer, carga-masiva.html y, más adelante, el nombre de la APK.
- Es SOLO el nombre visible: la ruta de Firebase `oled_remota` y demás nombres de datos NO se renombran.

## Fases
1. ACTUAL: rediseño visual tipo app IoT (tarjeta de dispositivo arriba con preview OLED, estado y última actualización; navegación inferior por pestañas; mobile-first, zonas seguras, modo oscuro; bien en escritorio).
2. POSTERIOR (no hacer todavía): APK Android con Capacitor, manteniendo el mismo código como web.
   - Pendiente para la APK: el lienzo expandido de Dibujo bloquea la rotación con `screen.orientation.lock('landscape')` (solo anda en pantalla completa en el navegador); en la APK usar el plugin de orientación de Capacitor.
   - Pendiente para la APK: pegar imágenes del portapapeles (botón Pegar de la pestaña Imagen) usa `navigator.clipboard.read()`, que en Chrome/Edge (también Android) pide permiso, pero el WebView de Android no lo maneja: habrá que leer el portapapeles con un plugin nativo.

## Reglas obligatorias
- No cambiar rutas, nombres de campos ni formato de datos en Firebase.
- No migrar a React/Vue/otro framework.
- No borrar ninguna función existente.
- Mantener los IDs del DOM que usa `js/ui.js` (obtenerElementos) y los `data-valor` de los botones.
- Separar cambios visuales de cambios de lógica: nunca en el mismo paso/commit.
- Pasos pequeños, un commit por paso, mensaje claro en español, rama `rediseno-app`.
- No hacer push ni merge a main sin pedido explícito.
- Antes de cada paso grande: explicar el plan y esperar aprobación.
- Responder siempre en español.

## Cómo probar
Servir por HTTP (los módulos ES no cargan con file://): `npx serve .` y abrir la URL que muestra (Node está instalado; en esta máquina `python` es solo el alias de la Microsoft Store y se cuelga). Revisar sintaxis antes de cada commit con `node --check js/<archivo>.js`. Probar cada pestaña y verificar en la consola de Firebase que lo escrito en `oled_remota` no cambió de forma.
