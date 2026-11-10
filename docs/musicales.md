# Musicales: canciones con letra, imágenes y GIF

**Estado (2026-11-10): terminado y probado en la TV.** Ver la sección 8.

## 1. Qué pidió el dueño

El dueño tiene 57 canciones hechas con su simulador **CancionesMiniTV**. Cada una es un `.ino` para el ESP8266 del primer modelo de TV, con:

- la melodía en el buzzer;
- la letra con distintas fuentes, tildes y textos que cambian de tamaño;
- imágenes y GIF.

Las subió a github.com/Cartica07/Canciones-ino (carpeta `Canciones en ino`). Pidió:

1. **Importarlas todas en la app** y que queden guardadas, para que después solo haya que elegir y enviar.
2. Que en la TV **se reproduzcan tal cual**, como si se grabara el `.ino` en la placa.
3. Que la pestaña **Canciones** tenga dos opciones:
   - **Con letra:** tono, texto, imágenes y GIF. Reemplaza lo que esté en pantalla.
   - **Sin letra:** solo el sonido, de fondo, sin tocar lo que se muestra. Es el envío de canciones de siempre.
4. Adaptar los pines del buzzer y de la pantalla a la placa nueva (ESP32-S3).
5. Más tarde, borrar el catálogo viejo `canciones/` (8 canciones de solo ritmo), porque ya no hace falta: el ESP8266 seguirá recibiendo el `.ino` completo.

Aprobado por el dueño:
- el catálogo nuevo `musicales/`;
- el tipo `"musical"`: `pantalla.musical = {nombre, repeticiones, formato:"m1"}`, con la grabación comprimida en `oled_remota/archivo`, igual que los GIF.

Además: "no quiero un simulador completo en la app", y la canción `tv_lanavedelolvido` "la puede ignorar, no es importante".

## 2. La idea técnica: grabar en vez de portar

Los `.ino` son programas en C++: `struct`, arreglos `PROGMEM`, punteros, `millis()`, `tone()`, Adafruit_GFX, y los hay de distintas versiones del simulador. Portar cada uno al ESP32, o interpretarlo en la placa, sería frágil.

En cambio, **el panel ejecuta el `.ino` en el navegador**, en una máquina virtual con tiempo virtual, y **graba**:

- cada nota: cuándo empieza y qué frecuencia tiene;
- cada `display.display()`: cuándo pasa y la imagen exacta de 128×64.

La TV solo reproduce esa grabación. El resultado es idéntico al `.ino`, sea cual sea la versión del simulador.

## 3. El intérprete (`js/inoMusical.js`)

- **Lenguaje:** un subconjunto de C:
  - `#define`, `struct`, arreglos (también `PROGMEM`) y punteros;
  - cadenas, funciones, `if`/`for`/`while`/`switch`;
  - operadores de C con enteros.
- **Hardware virtual:**
  - `Adafruit_SSD1306` / `Adafruit_GFX`: texto con la fuente clásica (tabla `TABLA_FUENTE` de `fonts.js`, igual a `glcdfont.c`, con el corrimiento CP437 de `c >= 176`) o con `GFXfont`, `drawBitmap`, `fillRect`, líneas, `invertDisplay`, etc.;
  - `tone()`/`noTone()`.
- **Tiempo virtual:** `delay()` y `millis()` no esperan de verdad, así que una canción de 4 minutos se graba en segundos.
- **Fin y repetición:**
  - la grabación empieza al terminar `setup()`;
  - se ejecuta una vuelta de `loop()`; si en una segunda vuelta vuelve a sonar o dibujar, la canción **se repite** (`repetir = true`);
  - si se queda quieta 15 s virtuales (`while(true) delay(...)`) o no hace nada (`if (reproducido) return;`), **toca una vez** y se queda en la última imagen.
- **Topes de seguridad:** 30 minutos virtuales y 400 millones de pasos.
- **API:**
  - `grabarIno(texto)` → `{notas:[{t,f}], cuadros:[{t,bitmap}], duracion, repetir}`;
  - `nombreDelIno(texto)` lee el nombre de la primera línea (`// "nombre" -- generado con ...`);
  - `notasParaCancion(grab)` → `[[Hz, ms], ...]`, para enviar sin letra.
- **Saltos de línea de Windows (CRLF):** se normalizan al principio, porque si no, `#define` fallaba.
- **`tone()` como en Arduino** (commit `2f6c37b`): un `tone()` nuevo o `noTone()` anula el corte programado de un `tone(pin, f, dur)` anterior, así un legato `tone(f, d)` + `delay(d)` suena entero. `delay()` y la duración de `tone()` truncan los decimales, como en C. Las canciones importadas antes de este cambio que usen legato con `tone(pin, f, dur)` o `delay()` con decimales hay que **importarlas de nuevo** para que se graben bien. Comprobado el 2026-11-10: las 57 canciones de `Canciones-ino` se graban igual con el intérprete viejo y el nuevo (tocan con `tone(pin, f)` sin duración, y la única con `tone(pin, f, dur)`, `tv_lanavedelolvido`, hace `noTone()` justo al terminar cada nota), así que no hace falta reimportar ninguna.

### Verificado
- **Las 57 canciones se graban sin errores.** Las duraciones coinciden con lo esperado:
  - la melodía más 1,9 s de cola;
  - *La_quemona*, +1,2 s de intro;
  - *TuFaltaDeQuerer*, +1 s;
  - *vuelvepetro*, +3 s y "una vez";
  - *culpable_ono* y *en_otra_vida*, "una vez".
- **Se revisaron hojas de contacto** (todas las pantallas de cada canción en un PNG): fuentes, tildes, texto escalado, imágenes y GIF salen bien.
- **Codificar y decodificar m1 da exactamente lo mismo** en las 57.

## 4. El formato m1

Está descrito byte a byte en [formatos-datos.md §4](formatos-datos.md).

- Las notas y la línea de tiempo de imágenes van sin comprimir.
- Cada imagen distinta va en deflate-raw. Al deduplicar las imágenes, las 57 canciones pasaron de 1965 KB a **777 KB en total**; la más pesada ocupa 89 KB.
- `codificarMusical(grab)` → `{datos (Base64), bytes, imagenes}`; `decodificarMusical(base64)` → `{notas, cuadros:[{t, bitmap}], duracion, repetir}`.

## 5. El panel: pestaña Canciones

**Diseño** (commit `ce77fa2`, solo visual):
- una fila con:
  - el selector `#seleccionCancion`;
  - **+** (`#cargadorMusical`, un `<input type=file accept=".ino" multiple>`);
  - el tacho (`#botonBorrarMusical`);
- el control **Con letra / Sin letra** (`#grupoLetra`, `data-valor` `con` | `sin`);
- las repeticiones;
- el aviso `#avisoCancion`.

**Lógica** (`main.js`, `firebase.js`, `ui.js`; commit `22910fa`):
- **Importar:**
  - se eligen uno o varios `.ino`;
  - cada uno pasa por `grabarIno`, luego por `codificarMusical`, y se guarda con `guardarMusicalCatalogo`, en un solo `update()` sobre `musicales` con `indice/<clave>` y `datos/<clave>`;
  - la clave es el nombre del archivo sin `.ino`; si ya existe, se reemplaza;
  - el aviso muestra el progreso y cuántas canciones fallaron, con el motivo.
- **Listar:** `listarMusicales()` lee solo `musicales/indice`, que es liviano, ordenado por nombre.
- **Elegir:** `leerMusical(clave)` baja los datos y `decodificarMusical` los convierte. El aviso muestra "Nombre · m:ss" y "(una vez)" si no se repite.
- **Vista previa:**
  - con letra, la OLED del panel reproduce las imágenes a su tiempo (`iniciarPreviewMusical`);
  - sin letra, la pantalla no cambia: si antes se estaba viendo la vista previa con letra, se vuelve a mostrar lo que había.
- **Borrar:** el tacho, con confirmación, borra `indice` y `datos` de esa clave.
- **Enviar:**
  - con letra: `tipo: "musical"`, `musicalNombre`, `musicalRepeticiones` y `musicalDatos` (m1), que van a `archivo`;
  - sin letra: `tipo: "cancion"` con `cancionNotas = notasParaCancion(grab)`;
  - si no se eligió nada: "Elegí una canción.".
- **Al abrir el panel:** si lo último enviado fue un musical, se abre Canciones con "Con letra" y esa canción elegida.

## 6. El firmware (`musical.cpp`, commit `54dce85`)

- **Descarga** (`github.cpp`): con `tipo == "musical"`, baja `archivo/datos` en streaming, decodificando Base64, a `/nuevo_musical.bin`, y marca `musicalListo`.
- **Aplicar** (`OLED_Remota.ino`, `aplicarArchivosNuevos`): detiene el buzzer, la animación y el musical anterior (`musical_liberar`), mueve el archivo a `/current_musical.bin` y llama a `musical_iniciar(ruta, repeticiones)`.
- **Reproducir:**
  - `musical_actualizar(dibujar)` en cada `loop()` avanza las notas (`tone()`/`noTone()`) y las imágenes según `millis()`;
  - las notas y la línea de tiempo están en vectores en memoria;
  - cada imagen se lee y descomprime del archivo (`tinfl`) solo cuando toca dibujarla.
- **Repeticiones:** si el `.ino` original se repetía, da `repeticiones` vueltas; si no, una. Al terminar se queda en la última imagen.
- **Modos:** en reloj o pantalla apagada la música sigue sonando, pero no se dibuja. Al volver al modo contenido, `musical_redibujar()` pone la imagen que corresponde.
- **Corte:** el botón corta el musical, igual que con las canciones. Llegar a otro contenido también lo corta (`musical_stop`).
- **Sin pitido de "mensaje nuevo"** al llegar un musical, porque sería lo primero que suena.
- **`pantalla.cpp`:** con `tipo == "musical"` se quita `invertDisplay` y se redibuja; `actualizarPantalla` no interviene.
- **Compilado para el S3:** 1.399.982 bytes. Grabado en la placa y probado (ver la sección 8).

## 7. Pines (ESP32-S3)

| Componente | Pin |
|---|---|
| Buzzer | GPIO 4 |
| OLED SDA / SCL | GPIO 8 / GPIO 9 |

En el ESP8266 eran otros, pero da igual: los `.ino` se ejecutan en el navegador y la grabación no depende de los pines.

## 8. Estado y qué falta

Hecho (2026-11-10):
- Reglas de Firebase con `musicales`, publicadas por el dueño.
- Panel probado: importar, elegir, vista previa con y sin letra, la pestaña entra sin scroll (390×844) y la consola no muestra errores propios (solo un 404 de un recurso externo).
- **Las 57 canciones importadas** desde el panel, en 34 s y sin errores (777 KB en total).
- Catálogo viejo `canciones/` (8 canciones) **respaldado** en `C:\Proyectos\TV_RETRO-respaldos\canciones-2026-11-10.json` (fuera de los repos) y **borrado** de Firebase, como pidió el dueño.

- **Firmware `54dce85` grabado en la placa** (arduino-cli, COM6) y probado en la TV:
  - con letra: la letra y las imágenes van a tiempo con la música (confirmado por el dueño);
  - sin letra: suena de fondo y la pantalla no cambia (confirmado);
  - el botón corta la música (confirmado);
  - monitor serie: el musical baja en ~1 s (`[musical] 271 notas, 23 imágenes, 295 cuadros, 52.7 s, repite`);
  - 9 envíos seguidos (con y sin letra, alternados): heap libre estable entre 96 y 102 KB, sin fuga y sin reinicios.

Falta:
1. **Push** de los dos repos cuando el dueño lo pida.
2. **Opcional:** que la vista previa del panel también suene.
