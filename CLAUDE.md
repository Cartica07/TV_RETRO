# OLED Control — Guía para Claude

## Qué es
Panel web (HTML/CSS/JS puro, módulos ES, sin frameworks) con Firebase Realtime Database que controla a distancia una OLED SSD1306 128×64 conectada a un ESP8266/ESP32. Envía textos, imágenes, dibujos, canciones (buzzer) y animaciones; el microcontrolador lee Firebase y los muestra. `carga-masiva.html` es una página aparte (no enlazada) para subir contenido en lote.

## Archivos
- `index.html` + `js/main.js` (orquestador) + `js/ui.js` (IDs del DOM y helpers visuales)
- `js/firebase.js`: ÚNICO acceso a Firebase
- `js/renderer.js` + `js/fonts.js`: réplica pixel-perfect de la OLED
- `js/imageProcessor.js` (difuminado Atkinson, encuadre: escala/fondo/rotar/voltear), `js/gif.js` (GIF animado → animación `{ancho, alto, cuadros:[{datos, dur}]}`), `js/dibujo.js`
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
- `oled_remota` = `{ version, pantalla: { tipo, texto, config{tamano,alineacion,alineacionV,invertido,modoTexto}, imagen{ancho,alto,datos} | cancion{nombre,repeticiones,notas} | animacion{nombre,ancho,alto,cuadros[{datos,dur}]} } }`
- `oled_remota/lastSeen` (heartbeat, solo lectura desde la web)
- Catálogos: `canciones/`, `imagenes/`, `animaciones/` (hermanos de `oled_remota`)
- Dibujo y Galería se envían como `tipo:"imagen"`. Un GIF subido en la pestaña Imagen se envía como `tipo:"animacion"`.
- GIF guardados: en `animaciones/` con `meta.origen: "gif"` (así se separan en la lista GIF de la Galería; el ESP no lee los catálogos). Se pueden subir desde la pestaña Imagen (con encuadre) o desde el + de la Galería.
- Peso de animaciones (ESP32-WROOM-32 sin PSRAM): ~1,4 KB por cuadro en `oled_remota.json`. Seguro ≤ 28 KB (~20 cuadros); aviso amarillo hasta 56 KB (~40); aviso rojo por encima (`evaluarPesoAnimacion` en gif.js). Solo avisa, no bloquea. Pendiente: optimizar el envío de archivos pesados.
- `enviarEstado` usa `update()` sobre `oled_remota` (escribe `version` y `pantalla` sin borrar `lastSeen`).
- Seguridad: login con Firebase Auth (email/contraseña) en index.html y carga-masiva.html; reglas en `database.rules.json` (lectura pública de `oled_remota` para el ESP, `lastSeen` escribible por el ESP, todo lo demás restringido al UID del dueño).

## Nombre de la app
- El nombre visible pasa a ser **TV RETRO** (antes "OLED Remota" / "OLED Control"). Aplicarlo en los pasos visuales: `<title>`, encabezados, barra superior, footer, carga-masiva.html y, más adelante, el nombre de la APK.
- Es SOLO el nombre visible: la ruta de Firebase `oled_remota` y demás nombres de datos NO se renombran.

## Fases
1. ACTUAL: rediseño visual tipo app IoT (tarjeta de dispositivo arriba con preview OLED, estado y última actualización; navegación inferior por pestañas; mobile-first, zonas seguras, modo oscuro; bien en escritorio).
2. POSTERIOR (no hacer todavía): APK Android con Capacitor, manteniendo el mismo código como web.

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
