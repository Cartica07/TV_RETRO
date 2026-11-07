# Fuentes de letra en el firmware (pendiente)

El panel ya envía el estilo de letra, pero el ESP32 todavía no lo dibuja: hasta que se actualice el firmware, la OLED muestra la fuente clásica 5×7 con el tamaño elegido.

## Qué llega por Firebase

`oled_remota/pantalla/config`:

| Campo | Valores | Notas |
|---|---|---|
| `fuente` (nuevo) | `clasica`, `sans`, `sansb`, `serif`, `serifi` | Si falta, es `clasica`. |
| `tamano` | `1` a `5` | Antes era de 1 a 4. |

Los demás campos no cambian.

## Qué fuente y qué tamaño usar

| `tamano` | `clasica` | `sans` / `sansb` / `serif` / `serifi` |
|---|---|---|
| 1 | `setTextSize(1)` | 6 pt |
| 2 | `setTextSize(2)` | 10 pt |
| 3 | `setTextSize(3)` | 12 pt |
| 4 | `setTextSize(4)` | 16 pt |
| 5 | `setTextSize(5)` | 18 pt |

Estilos: `sans` = FreeSans, `sansb` = FreeSans negrita (Bold), `serif` = FreeSerif, `serifi` = FreeSerif cursiva (Italic).

Son 4 estilos × 5 tamaños = 20 fuentes `GFXfont`. Tienen que generarse **a 141 dpi**, como `fontconvert` de Adafruit_GFX, e incluir los mismos 164 caracteres (ASCII + ñ, ¿, ¡ y tildes de Latin-1). Los datos exactos están en `js/fuentesGfx.js`. El simulador de CancionesMiniTV ya sabe exportarlos como `GFXfont` en PROGMEM. Ocupan del orden de 100 KB de flash.

## Cómo dibujar para que coincida con la vista previa

Esto es lo que hace `js/fuentesTexto.js`:

1. `display.setFont(&fuente); display.setTextSize(1); display.setTextWrap(false);`. Con una fuente propia, el cursor `(x, y)` es la **línea base**.
2. **Ancho de un texto**: desde la primera hasta la última columna con tinta, sumando `xAdvance` de cada glifo y usando `xOffset`/`width`. Es el ancho que da `getTextBounds`.
3. **Ascenso y descenso** de la fuente: el máximo de `-yOffset` y de `yOffset + height` entre todos sus glifos.
4. **Ajustar**: se cortan las líneas con las mismas reglas que hoy (párrafos por `\n`, palabras por espacio, palabras largas letra por letra) usando ese ancho. Alto del bloque = ascenso + (líneas − 1) × `yAdvance` + descenso.
5. **Alineación vertical**: con `arriba`, el bloque empieza en y = 0; si no, se centra en los 64 px. La base de la línea *i* = inicio + ascenso + *i* × `yAdvance`.
6. **Alineación horizontal**, según el ancho de tinta de cada línea: izquierda 0, centro (128 − ancho) / 2, derecha 128 − ancho. Se dibuja con `cursor x = posición − (lado izquierdo de la tinta)`.
7. **Scroll**: una sola línea (los `\n` pasan a espacios) que entra por la derecha, con la misma regla vertical.
8. Un carácter que la fuente no tiene se dibuja como `?`.
