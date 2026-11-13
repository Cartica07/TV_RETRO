# TV RETRO: contexto general del proyecto

Este documento explica el proyecto completo para quien llega de nuevo, sea una persona o una IA. Cuenta qué es, cómo funciona de punta a punta, cómo se llegó al estado actual, qué decisiones se tomaron y por qué, y qué falta.

Las reglas de trabajo están en [CLAUDE.md](../CLAUDE.md), sección 2, y son obligatorias.

---

## 1. La idea

TV RETRO es una **mini TV retro** que el dueño fabrica y piensa vender. Tiene:

- una pantalla **OLED SSD1306** monocromática de 128×64 puntos (I2C);
- un **buzzer pasivo** para música;
- un **botón A** (más adelante el botón capacitivo del ESP32-S3), una **rueda** (encoder rotativo) y el **botón de la rueda**, para cambiar de pantalla (contenido, reloj, juegos, reposo) y para jugar (ver `docs/juegos-y-controles.md`);
- un **ESP32-S3** con Wi-Fi.

Desde el celular o la computadora, con el **panel web**, se le manda lo que debe mostrar:

| Contenido | Qué hace la TV |
|---|---|
| Texto | Lo dibuja con 5 estilos de letra, tamaños 1–5, alineación automática o manual, y modos Ajustar, Scroll horizontal o Scroll vertical. |
| Imagen | Muestra un bitmap de 128×64. |
| Dibujo | Lo hecho a mano en el lienzo del panel; se envía como imagen. |
| GIF / animación | La reproduce en bucle. |
| Canción (sin letra) | Suena en el buzzer, de fondo, sin tocar la pantalla. |
| Musical (con letra) | Suena la canción y, sincronizados con la música, se muestran la letra, las imágenes y los GIF. Reemplaza lo que había en pantalla. |

El nombre visible es **TV RETRO**. Internamente los datos siguen bajo `oled_remota`, el nombre histórico, y no se renombran.

## 2. Las piezas

```
 ┌──────────────────────┐      update()       ┌───────────────────────────┐
 │ Panel web (este repo)│ ──────────────────▶ │ Firebase Realtime Database│
 │ HTML/CSS/JS puro     │ ◀── lastSeen ────── │ proyecto lorenita-6ad1e   │
 └──────────────────────┘                     └─────────────┬─────────────┘
                                                            │ streaming (SSE) de
                                                            │ oled_remota/version
                                                            ▼
                                              ┌───────────────────────────┐
                                              │ Firmware ESP32-S3         │
                                              │ OLED + buzzer + botón     │
                                              │ LittleFS para lo pesado   │
                                              └───────────────────────────┘
```

| Pieza | Ubicación | Rama |
|---|---|---|
| Panel web | `C:\Proyectos\TV_RETRO` → github.com/Cartica07/TV_RETRO | `rediseno-app` (trabajo), `main` |
| Firmware | `C:\Proyectos\TV_RETRO-firmware` → github.com/Cartica07/Firmware-TV-RETRO | `esp32` (trabajo), `main` |
| Simulador de canciones (referencia, **solo lectura**) | `C:\Proyectos\CancionesMiniTV` → github.com/Cartica07/CancionesMiniTV | — |
| Canciones `.ino` del dueño (referencia, **solo lectura**) | `C:\Proyectos\Canciones-ino` → github.com/Cartica07/Canciones-ino | — |

### Por qué Firebase y no un servidor propio
El proyecto nació así, con un ESP8266 que consultaba Firebase. Firebase da una base en tiempo real gratuita, accesible por HTTPS desde el ESP y desde el navegador, sin mantener un servidor. Se mantiene.

## 3. Flujo de un envío, de punta a punta

1. **El usuario arma el contenido** en una pestaña del panel. La tarjeta de arriba muestra una **vista previa pixel-perfect** de la OLED, con la misma fuente, los mismos cortes de línea y los mismos tiempos de scroll que el firmware.
2. **Pulsa "Enviar a la OLED".** `main.js` arma el estado y llama a `enviarEstado()` en `firebase.js`, que:
   - reserva un número de `version` nuevo con una transacción sobre `oled_remota/contadorVersion` (así dos envíos casi simultáneos no salen con el mismo número);
   - arma `pantalla` según el tipo;
   - si el contenido es pesado (GIF comprimido o musical), lo pone en `archivo = {version, datos}`; si no, borra `archivo` (`null`);
   - escribe todo con **un solo `update()`** sobre `oled_remota`. Usa `update` y no `set` para no borrar `lastSeen`.
3. **El firmware** (núcleo 0, `red.cpp`) mantiene abierta una conexión de *streaming* (Server-Sent Events) a `oled_remota/version`. Firebase le avisa apenas cambia.
4. **Descarga en partes** (`github.cpp`; el nombre es histórico, de cuando el contenido venía de GitHub):
   - `pantalla.json`;
   - si hace falta, `archivo/datos`, en streaming directo a un archivo temporal de LittleFS, decodificando Base64 al vuelo sin pasar por la RAM;
   - al final relee la versión para asegurarse de que no cambió en el medio.
5. **Entrega al núcleo 1** con un mutex (`red_hayNuevo` / `red_nuevoAplicado`). El `loop()` mueve los archivos temporales a su ruta "actual", y así nunca se lee un archivo a medio escribir. Después:
   - texto/imagen: dibuja;
   - canción: arranca el buzzer de fondo;
   - animación: reproduce cuadro por cuadro, descomprimiendo con `tinfl` de la ROM;
   - musical: arranca `musical.cpp`.
6. Cada 10 s el firmware escribe **`lastSeen`**. El panel lo escucha y muestra "En línea · hace 4 s" (en línea si tiene menos de 25 s).

## 4. Historia resumida

El detalle commit por commit está en [historial-cambios.md](historial-cambios.md).

1. **Jul–ago 2026: origen.** Panel de una sola página larga, subido a GitHub a mano; firmware para **ESP8266** (versiones V1.6 a V1.16: imágenes, alineación vertical, botón de modos, reloj y clima, heartbeat, canciones, animaciones). Se agregaron dibujo, galería, catálogo de canciones y animaciones, y `carga-masiva.html`.
2. **7 nov 2026: rediseño tipo app.**
   - Se agregó `CLAUDE.md` con el contrato y las reglas.
   - Mejoras de lógica: `update()` en vez de `set()`; Deshacer/Rehacer se apagan si no hay historial.
   - Rediseño completo: tokens de diseño, estructura de app con cabecera fija y navegación inferior, cada pestaña compacta y sin scroll, vista de escritorio, sin textos explicativos ni datos internos.
   - Funciones nuevas: GIF animados; encuadre y difuminado Atkinson (portados de CancionesMiniTV); fuentes FreeSans/FreeSerif y tamaño 5; posición manual X/Y; scroll vertical; pegar del portapapeles; zoom y modo expandido en Dibujo; tildes en la fuente clásica; **GIF comprimidos (z1)**.
3. **7 nov 2026: firmware ESP32.** El firmware se adaptó al ESP32 clásico:
   - tabla de particiones con OTA;
   - dos núcleos (red y pantalla);
   - texto idéntico a la vista previa;
   - Wi-Fi más confiable (WiFiMulti no conectaba con señal débil: se cambió a `WiFi.begin` directo con reintentos);
   - tildes;
   - z1.
4. **9 nov 2026: cambio a ESP32-S3 N16R8** (16 MB de flash, 8 MB de PSRAM). Cambiaron los pines y la tabla de particiones. Probado en la placa: texto, imagen, sonido, dibujo y GIF funcionan.
5. **9–10 nov 2026: musicales** (terminado y probado en la TV). Se importan los `.ino` de canciones con letra del dueño, se graban en el navegador y la TV los reproduce igual que si se les grabara el `.ino`. Ver [musicales.md](musicales.md).

## 5. El panel por dentro

### Módulos
| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de app: cabecera fija con la tarjeta del dispositivo, `main.controles` (una sección por pestaña), barra de Enviar y navegación inferior (`#grupoTipo`). |
| `js/main.js` | Orquestador: `estadoActual`, `cambiarTipo`, vistas previas (scroll, animación, musical), procesado de imágenes, galería, canciones/musicales, conexión, `enviarAFirebase`. |
| `js/ui.js` | `obtenerElementos()` (mapa de IDs), `marcarSegmentoActivo`, `marcarEstado`, `marcarConexion`, etc. |
| `js/firebase.js` | Único acceso a Firebase: `cargarEstado`, `enviarEstado`, catálogos (`imagenes`, `animaciones`, `canciones`, `musicales`), `suscribirLastSeen`. |
| `js/renderer.js` | Dibuja la OLED en un `<canvas>`, igual que `pantalla.cpp`/`texto.cpp`. |
| `js/fonts.js` | Fuente clásica 5×7 (glcdfont de Adafruit, orden CP437) y `LATIN1_A_CP437`. |
| `js/fuentesTexto.js`, `js/fuentesGfx.js` | Texto con FreeSans/FreeSerif (GFXfont a 141 dpi, 164 caracteres). |
| `js/imageProcessor.js` | Imagen → bitmap 1bpp: encuadre (Ajustar/Llenar/Estirar/Original, rotar, voltear, fondo), umbral, difuminado Atkinson. |
| `js/gif.js` | Decodificador de GIF (LZW), cuadros → animación, avisos de peso. |
| `js/compresion.js` | Formatos `z1` y `m1` con `CompressionStream('deflate-raw')`. |
| `js/inoMusical.js` | Intérprete de los `.ino` de canciones. |
| `js/dibujo.js`, `js/lienzoZoom.js` | Lienzo de dibujo con deshacer/rehacer; zoom con dos dedos y modo expandido. |
| `css/tokens.css`, `css/style.css` | Diseño: modo oscuro `#0B0F14`, acento cian `#4DD2FF`, Space Grotesk + JetBrains Mono. |
| `carga-masiva.html` | Carga en lote (página aparte, no enlazada). |

### Pestañas
- **Texto:** mensaje (máx. 200), letra (Sans por defecto, Sans negrita, Serif, Serif cursiva, Clásica), tamaño 1–5, alineación Auto (H/V) o Manual (X/Y), modo Ajustar / Scroll ↔ / Scroll ↕.
- **Imagen:** subir imagen o GIF, Pegar, encuadre, difuminado, umbral, guardar en la galería.
- **Dibujo:** lienzo 128×64, grosor, deshacer/rehacer/limpiar, expandir a pantalla completa, zoom.
- **Canciones** (`data-valor="cancion"`; antes "Música"):
  - elegir del catálogo de musicales;
  - **+** para importar `.ino`;
  - tacho para borrar;
  - **Con letra / Sin letra**;
  - repeticiones.
- **Galería:** listas Imágenes, Animaciones y GIF; elegir, reajustar, añadir, guardar, borrar.
- **Siempre visible:** vista previa, estado de conexión, **Invertir** y el resultado del último envío.

## 6. El firmware por dentro

Carpeta `OLED_Remota/` del repo del firmware. El detalle está en su `README.md` y `CLAUDE.md`.

| Archivo | Qué hace |
|---|---|
| `OLED_Remota.ino` | `setup()` y `loop()` (núcleo 1): aplica lo nuevo, maneja los modos (contenido → reloj → juegos → reposo) con el botón A, y actualiza buzzer, animación, musical y texto. |
| `pines.h` | Todos los pines (S3): OLED SDA 8 / SCL 9, buzzer 4, botón A 5, rueda CLK 6 / DT 7, botón de la rueda 10. |
| `partitions.csv` | 16 MB: nvs, otadata, dos app de 4 MB (OTA), LittleFS ~7,9 MB, coredump. |
| `red.cpp` | Tarea en el núcleo 0: streaming de `oled_remota/version`, heartbeat, descarga y entrega con mutex. |
| `github.cpp` | Descarga en partes (pantalla, archivo), escritor Base64 → LittleFS, `lastSeen`. |
| `conexion_wifi.cpp` | Wi-Fi: redes guardadas, reintentos, NVS, portal WiFiManager si nada conecta. Nunca imprime contraseñas. |
| `pantalla.cpp` | Dibujo general, imagen, reloj; delega texto, animación y musical. |
| `texto.cpp`, `fuentes.cpp` | Texto igual a la vista previa; `fuentes.cpp` lo genera `herramientas/generar_fuentes.js` desde `js/fuentesGfx.js`. |
| `buzzer.cpp` | Canciones (`/current_song.bin`), aviso de mensaje nuevo. |
| `animacion.cpp` | Animaciones en LittleFS (viejas y z1), descomprime con `tinfl` de la ROM. |
| `musical.cpp` | Reproductor de musicales m1: notas y línea de tiempo en memoria; imágenes descomprimidas al dibujarlas. |
| `reloj.cpp`, `clima.cpp` | Modo reloj (NTP) y clima de Open-Meteo (Armenia, Quindío). |
| `boton.cpp` | Pulsador con antirrebote (el de antes; lo reemplazó `entrada.cpp`, se conserva). |
| `entrada.cpp` | Entrada unificada: botón A, botón de la rueda y rueda, con eventos no bloqueantes (apretado, soltado, mantenido, giro). |
| `juegos.cpp`, `juegos_base.cpp`, `juego_*.cpp`, `jump_*` | Modo Juegos: portada, lista y partidas; servicios compartidos y los 5 juegos. Ver `docs/juegos-y-controles.md`. |
| `cuenta.cpp`, `emparejar.cpp` | Modo cuentas (sesión de la TV en Firebase Auth) y vinculación automática de la TV a la cuenta de un cliente. |
| `config.cpp` | URLs de Firebase. |

### Hardware actual
- **Placa:** ESP32-S3 DevKitC-1 con ESP32-S3-WROOM-1 **N16R8**.
- **Se graba** por el USB marcado **UART**.
- **Opciones de Arduino:** ESP32S3 Dev Module, Flash 16MB, PSRAM OPI, QIO 80MHz, Partition Scheme Custom.
- **FQBN:** `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom`.

## 7. Decisiones importantes y su porqué

| Decisión | Por qué |
|---|---|
| `update()` en vez de `set()` al enviar | `set()` borraba `lastSeen` y el panel marcaba "sin señal" después de cada envío. |
| Campos nuevos con valor por defecto | Un firmware viejo (ESP8266) sigue funcionando con lo que no conoce. |
| Lo pesado va en `oled_remota/archivo` y no dentro de `pantalla` | El ESP baja `pantalla` (liviano) y después el archivo **en streaming a LittleFS**, sin cargarlo entero en la RAM. |
| Compresión deflate **sin pérdida**, por cuadro (z1) | Se ve exactamente igual. Cada cuadro aparte permite descomprimir solo el que se dibuja. El ESP32 tiene el descompresor `tinfl` en la ROM. |
| Musicales **grabados** en el navegador (no interpretar el `.ino` en el ESP) | Los `.ino` son programas en C. En vez de portarlos, el panel los ejecuta en una máquina virtual con tiempo virtual y graba qué suena y qué se ve. La TV solo reproduce la grabación. Sale idéntico, sin importar qué versión del simulador generó el `.ino`. |
| Imágenes deduplicadas en m1 | Un GIF que se repite toda la canción se guarda una vez (las 57 canciones pasaron de 1965 KB a 777 KB en total; la más pesada ocupa 89 KB). |
| Dos núcleos en el ESP32 | La red (TLS, esperas) nunca congela la pantalla ni el buzzer. |
| Archivos temporales + mover | Nunca se reproduce un archivo a medio descargar. |
| OTA reservada (dos slots de 4 MB) | El dueño quiere poder actualizar por Wi-Fi las TV vendidas sin perder funciones. |
| Sin textos explicativos | Interfaz limpia; se explicará con un tutorial guiado. |
| Sin datos internos visibles | Pedido explícito del dueño: son privados. |
| Atkinson en vez de Floyd-Steinberg | Con Floyd-Steinberg el umbral casi no cambiaba el resultado; Atkinson es el del simulador del dueño. |
| Sans por defecto | Igual que el simulador CancionesMiniTV. |

## 8. Pendientes

1. **Push** de los dos repos cuando el dueño lo pida. Los musicales ya están terminados y probados en la TV; las reglas están publicadas, las 57 canciones importadas y el catálogo viejo `canciones/` respaldado y borrado.
2. **Más adelante:**
   - vista previa con sonido en el panel (opcional);
   - actualización OTA;
   - login y reglas por UID;
   - tutorial guiado;
   - APK con Capacitor (plugins de portapapeles y orientación);
   - (hecho el 2026-11-12) encoder rotativo y juegos; ver `CLAUDE.md`, sección 9, para el panorama pendiente.
