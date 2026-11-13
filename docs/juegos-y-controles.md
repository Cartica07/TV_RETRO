# Juegos y controles de la TV

> Estado al 2026-11-12: los **5 juegos** corren en la TV real (los probó el dueño: "parecen ir bien"). Falta pulir tiempos y detalles estéticos, mejorar cada juego y reescribir los que tienen licencia dudosa. Código en el repo del firmware, carpeta `OLED_Remota/`.

## 1. Controles (hardware)

| Control | Pin | Notas |
|---|---|---|
| Botón A | GPIO 5 (`PIN_BOTON`) | Pulsador a GND con pull-up. Más adelante será el botón **capacitivo** del ESP32-S3 (el GPIO 5 admite táctil): solo cambia `leerA()` en `entrada.cpp`. |
| Rueda (encoder KY-040) | CLK 6 / DT 7 | 4 pasos por clic (`ENCODER_PASOS_POR_CLIC`), sentido en `ENCODER_INVERTIR`. Decodificador por interrupción con tabla de transiciones (tolera rebotes). |
| Botón de la rueda (SW) | GPIO 10 (`PIN_BOTON_RUEDA`) | Difícil de apretar: se usa solo para iniciar, pausar, reiniciar. |
| Buzzer | GPIO 4 | `tone()`/`noTone()`. |
| OLED | SDA 8 / SCL 9 | SSD1306 128×64, 0x3C. |

Todo se lee en **`entrada.cpp`** (único lugar que toca esos pines). Eventos no bloqueantes, válidos hasta la siguiente llamada a `actualizarEntrada()` (una por vuelta de `loop()`): `entrada_aApretado/aSoltado/aAbajo/aMs/aDuracion/aMantenido(ms)`, lo mismo con `entrada_sw…`, y `entrada_giro()` (clics, + derecha). `ENTRADA_LOG` (en `entrada.h`, hoy 1) escribe `[entrada] …` por el serial para probar los controles; ponerlo en 0 para producción.

## 2. Pantallas físicas (ciclo del botón A)

```
Contenido → Reloj → Juegos → Reposo (OLED apagada) → Contenido …
```

Un toque corto de A pasa a la siguiente (en Contenido, Reloj y Reposo cuenta al **apretar**; en Juegos cuenta al **soltar**, porque mantener A significa otra cosa). Si la TV no tiene dueño, la pantalla de Contenido muestra el código de vinculación en lugar del contenido (ver `formatos-datos.md`, "Compartir una TV").

## 3. Modo Juegos (`juegos.cpp`)

Tres estados:

| Estado | Qué se ve | Controles |
|---|---|---|
| **Portada** | Icono de control y "JUEGOS" | A corto: siguiente pantalla. **Mantener A** (1,5 s; una barra se llena abajo): abre la lista. |
| **Lista** | Juegos con el elegido resaltado (3 filas) | Rueda: elegir. Botón de la rueda: iniciar. Mantener A (1,5 s): vuelve a la portada. |
| **Jugando** | El juego | Rueda y A: del juego. Botón de la rueda: **pausa** (toque corto) o **reiniciar** (mantenido 1 s). **Mantener A**: a 1,5 s sale a la lista; si se sigue manteniendo, a 3 s llega a la portada (barra de progreso con una marca a la mitad). |

Reglas de detalle:
- Tras un cambio de estado hecho manteniendo A, el firmware ignora A hasta que se suelte (`aBloqueada`): un solo apretón no hace dos saltos.
- Al entrar al modo y al iniciar un juego se corta cualquier canción o musical (`buzzer_stop`, `musical_stop`).
- Mientras hay una **partida** no se aplica contenido nuevo del panel (no pisar el sonido): queda pendiente y se aplica al salir.
- Las pantallas fijas (portada y lista) se corren unos píxeles cada 20 s para no marcar la OLED.
- Constantes (ajustables) en `juegos.cpp`: `MS_SALIR_LISTA` 1500, `MS_SALIR_PORTADA` 3000, `MS_BARRA_VISIBLE` 400, `MS_REINICIAR` 1000, `MS_FOTOGRAMA` 33 (~30 cuadros/s).

## 4. Arquitectura del código

- `juegos_base.h/.cpp`: servicios compartidos con la **misma interfaz que traían los sketches originales** (`Screen`, `InputService`, `DisplayService`, `AudioOutService`, `SfxId`). Se apoyan en `entrada.cpp`, la `display` global de `pantalla.cpp` y el buzzer. Por eso cada juego se porta casi sin cambios. `pressed(BTN_START)` da siempre false: el botón de la rueda lo maneja el administrador.
- `juegos.h/.cpp`: administrador (estados, lista, pausa, salida, barra). La lista de juegos es el arreglo `juegos[]` (nombre sin tildes + puntero a su `Screen`).
- Un juego = clase que hereda de `Screen` con `onEnter` (reinicia), `onResume` (tras la pausa), `tick`, `handleInput`, `render`.
- Cambios en el ciclo: `modelo.h` (`MODO_JUEGOS = 5`), `OLED_Remota.ino` (`siguienteModo`, `entrarAModo`, llamada a `juegos_actualizar()`, contenido diferido).

**Agregar un juego:** crear `juego_xxx.h/.cpp` con su `Screen`, incluirlo en `juegos.cpp`, crear la instancia estática y añadir `{"NOMBRE", &instancia}` a `juegos[]` (nombre de hasta 8 letras en tamaño 2).

## 5. Los juegos y su licencia (¡importante antes de vender!)

| Juego | Archivos | Origen | Licencia |
|---|---|---|---|
| Snake | `juego_snake.*` | `chifunt/phone-project` | **Sin licencia declarada** (consultado con `gh api` el 2026-11-12) |
| Breakout | `juego_breakout.*` | `chifunt/phone-project` | **Sin licencia declarada** |
| Flappy | `juego_flappy.*` | `chifunt/phone-project` | **Sin licencia declarada** |
| Space Invaders | `juego_invaders.*` | `chifunt/phone-project` | **Sin licencia declarada** |
| Jump (tipo dinosaurio) | `juego_jump.*`, `jump_base.*`, `jump_juego.*`, `jump_u8g2.h` | `atomic14/esp32-c3-oled-single-button-games` | **Unlicense** (dominio público): libre |

Sin licencia, el autor se reserva todos los derechos: usar su código y sus sonidos en un producto que se vende es un riesgo real. **Decisión del dueño (2026-11-12): usar estos 4 como BASE de la estructura y luego reescribirlos y mejorarlos** (más mundos, detalles estéticos, mecánicas propias). Hay que reemplazar el código y los sonidos copiados antes de la venta (las mecánicas de esos juegos no tienen derechos de autor; el código y los efectos sí). Cada archivo trae el aviso en su cabecera.

Los sketches originales del dueño (con su `.zip`) están en `Juegos/` del repo del firmware, **sin versionar** (carpeta sin seguimiento de git a propósito).

## 6. Pendiente de juegos

- Pulir tiempos (1,5 s / 3 s / 1 s) y detalles estéticos de portada y lista (el dueño lo hará "luego").
- Reescribir y mejorar los 4 juegos con licencia dudosa (más mundos, mecánicas, sonidos propios).
- **Récords** de cada juego en la NVS de la TV (no hecho).
- Abrir un juego desde la app ("Más > Juegos"): necesita un campo nuevo en Firebase (idea: `pantalla.tipo = "juego"` con el nombre del juego) que se propone y se aprueba antes; un firmware viejo debe ignorarlo.
- Mando por el celular (WebSocket local o BLE): idea aparte, más grande.
- Cambiar el botón A por el capacitivo del ESP32-S3.
- Menú de "Otros/Más" del panel y alarma: ver la sección de pendientes de `CLAUDE.md`.
