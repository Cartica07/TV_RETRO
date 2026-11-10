# Fuentes de letra en el firmware

Implementado en el firmware ESP32-S3 (repo Firmware-TV-RETRO, `texto.cpp` y `fuentes.cpp`). Este documento es la especificación: lo que el firmware tiene que hacer para que la OLED coincida con la vista previa.

## Qué llega por Firebase

`oled_remota/pantalla/config`:

| Campo | Valores | Notas |
|---|---|---|
| `fuente` (nuevo) | `clasica`, `sans`, `sansb`, `serif`, `serifi` | Si falta, es `clasica`. |
| `tamano` | `1` a `5` | Antes era de 1 a 4. |
| `manual` (nuevo) | `true` / `false` | Si es `true`, se ignoran `alineacion` y `alineacionV` y se usan `x` e `y`. |
| `x`, `y` (nuevos) | enteros | Esquina superior izquierda del bloque de texto. |
| `direccion` (nuevo) | `h` / `v` | Solo cuenta con `modoTexto = "scroll"`. Si falta, es `h` (el scroll horizontal de siempre). |

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

## Scroll vertical (`modoTexto = "scroll"`, `direccion = "v"`)

Vale para la fuente clásica y para las nuevas. Esto es lo que hace `iniciarScrollVertical` en `js/main.js`:

1. Las líneas se arman como en **Ajustar** (mismo corte de líneas, misma alineación horizontal o `x` manual).
2. Si el alto del bloque es **64 px o menos**, el texto no se mueve: se muestra como en Ajustar.
3. Si es más alto, el bloque arranca con su borde superior en y = 0 y **sube**, en un ciclo que se repite:
   1. **1 s quieto** arriba;
   2. **sube a 12 px/s** hasta que el borde inferior del bloque llega a y = 64. Recorre `alto − 64` píxeles; el desplazamiento es `floor(recorrido × tiempo / duración)`;
   3. **1 s quieto** al final, y vuelve al paso 1.
4. Con `manual = true` se respeta la `x`; la `y` la maneja el desplazamiento.

## Posición manual (`manual = true`)

Vale para la fuente clásica y para las nuevas. Esto es lo que hacen `medirBloqueTexto` en `js/renderer.js` y `medirBloqueFuente` en `js/fuentesTexto.js`:

1. Se mide el bloque como en Ajustar.
   - **Ancho:** el de la línea más ancha.
   - **Alto en la clásica:** líneas × 8 × tamaño.
   - **Alto en las nuevas:** ascenso + (líneas − 1) × `yAdvance` + descenso.
2. Se limita la posición para que el bloque no se salga: `x = clamp(x, 0, 128 − ancho)` e `y = clamp(y, 0, 64 − alto)`.
3. Todas las líneas se alinean a la izquierda en `x`.
   - **En la clásica:** la línea *i* va en `setCursor(x, y + i × 8 × tamaño)`.
   - **En las nuevas:** la base de la línea *i* = `y + ascenso + i × yAdvance`, con la tinta empezando en `x`.
4. En **Scroll** solo se usa la `y` como borde superior de la línea. La `x` la maneja el desplazamiento.
