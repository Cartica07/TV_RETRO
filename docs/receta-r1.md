# Receta de una cara de reloj, formato R1 (PROPUESTA, falta que el dueño la apruebe)

> Escrito el 2026-11-24. Plan general: [plan-caras-de-reloj.md](plan-caras-de-reloj.md) (aprobado). Esto define los bytes
> exactos de una cara, iguales para la app (vista previa), Pepito Pro y Pepito Lite. Al aprobarse pasa a
> [formatos-datos.md](formatos-datos.md). Todo en little-endian.

## 1. Idea

Una cara es una **receta**: un fondo opcional y una lista de **elementos** (hora, fecha, íconos…), cada uno con su posición y
sus opciones. La TV la "dibuja" una vez por minuto. Reglas para que nunca se rompa una TV:

- Cada elemento dice **cuánto mide**. Una TV que no conoce un tipo de elemento **lo salta** (no lo dibuja) y sigue con el
  siguiente. Así se pueden agregar elementos nuevos más adelante sin romper las TV sin actualizar.
- Si a un elemento conocido le **faltan** bytes al final, se usan los valores por defecto; si **sobran**, se ignoran.
- Si la receta está dañada (no empieza con `R1`, se corta antes de tiempo o pasa de 2 048 bytes), la TV dibuja la **Cara 1**
  (el reloj de siempre, escrito en el código: nunca se pierde).
- Los elementos se dibujan **en el orden** de la lista (uno de abajo puede tapar a uno de arriba).

## 2. Cabecera

| Bytes | Qué |
|---|---|
| 2 | `R1` (0x52 0x31) |
| 1 | versión menor del formato = 1 (una versión mayor que la que conoce la TV no la rechaza: solo puede traer tipos nuevos, que se saltan) |
| 1 | banderas: bit 0 = trae fondo; los demás en 0 (reservados) |
| 1 024 | **solo si bit 0**: el fondo, 128×64 a 1 bit por punto, por filas, 16 bytes por fila, el bit alto es el punto de la izquierda (el mismo formato que las imágenes de la Galería) |
| 1 | cantidad de elementos (máximo 24) |
| … | los elementos |

Tamaño máximo de la receta: **2 048 bytes** (en Firebase, en Base64, ~2 732 caracteres).

## 3. Elemento

`[tipo u8][largo u8][datos: "largo" bytes]`. Los datos de **todos** los tipos empiezan igual:

| Byte | Qué | Por defecto |
|---|---|---|
| 0 | x (0 a 127) | 0 |
| 1 | y (0 a 63) | 0 |
| 2 | color: 0 = blanco (enciende puntos), 1 = negro (los apaga; sirve sobre un fondo) | 0 |

Para los que llevan **letra** siguen estos 3 bytes:

| Byte | Qué | Por defecto |
|---|---|---|
| 3 | fuente: 0 clásica, 1 Sans, 2 Sans negrita, 3 Serif, 4 Serif cursiva (las mismas del Texto) | 0 |
| 4 | tamaño 1 a 5 (el mismo de la pestaña Texto: en la clásica 1×…5×; en las otras 6, 10, 12, 16 y 18 pt) | 1 |
| 5 | alineación respecto de x: 0 = empieza en x, 1 = centrado en x, 2 = termina en x | 0 |

Y después, lo propio de cada tipo:

| Tipo | Elemento | Datos propios (después de los comunes) | Notas |
|---|---|---|---|
| 1 | Hora | `formato u8`: bit 0 = 24 h (si no, 12 h), bit 1 = cero delante (`09:05`) | sin segundos |
| 2 | AM/PM | — | nada en 24 h |
| 3 | Fecha | `formato u8`: 0 `24/11/2026`, 1 `24/11`, 2 `24 Nov`, 3 `Lun 24` | meses y días en español, sin tildes en la fuente clásica |
| 4 | Día de la semana | `formato u8`: 0 `Lunes`, 1 `Lun` | |
| 5 | Reloj de agujas | `radio u8` (4 a 31), `marcas u8` (0 ninguna, 1 cada 3 h, 2 cada hora) | sin letra (no lleva los bytes 3-5); x, y = centro; sin segundero |
| 6 | Íconos de estado | `estilo Wi-Fi u8`, `estilo mensaje u8`, `estilo conexión u8`, `sentido u8` (0 = de x hacia la derecha, 1 = hacia la izquierda) | sin letra. Cada TV pone los suyos: Pro = Wi-Fi, conexión y mensaje; Lite = mensaje |
| 7 | Campana (hay alarma activa) | `estilo u8` | sin letra; nada si no hay alarmas activas |
| 8 | Texto fijo | `largo u8` + el texto en UTF-8 (máx. 32 bytes) | tildes y ñ como en el Texto (tabla `LATIN1_A_CP437`) |
| 9 | Rectángulo | `ancho u8`, `alto u8`, `relleno u8` (0 borde, 1 lleno), `redondeo u8` (0 a 8) | sin letra |
| 10 | Línea | `x2 u8`, `y2 u8` | sin letra |
| 11 | Próxima alarma | `ícono u8` (0 sin ícono, 1… estilo de campana) | `7:00` en el formato de la hora; nada si no hay alarma activa |
| 12 | Clima (solo Pro) | `ícono u8` (0 sin ícono, 1… estilo) | `24°`; la Lite y una Pro sin dato no lo dibujan |
| 13 | Cuenta regresiva | `año u16`, `mes u8`, `día u8`, `formato u8` (0 `Faltan 12 días`, 1 `12 días`, 2 `12`) | el día mismo: `¡Hoy!`; después de la fecha: nada. Textos por aprobar |
| 14 | Batería | `estilo u8`, `porcentaje u8` (0 no, 1 sí) | sin letra; nada en una TV sin medidor |

Los **estilos** de los íconos (Wi-Fi, mensaje, conexión, campana, batería, clima) son dibujos de píxeles fijos, iguales en
la app y en las TV (una tabla compartida). El 0 es siempre el de hoy. Los dibujos se eligen con el dueño.

## 4. Qué pasa en cada TV

- **Sin hora todavía:** la TV sigue con su pantalla de siempre ("Sincronizando" en la Pro, "Abre la app" en la Lite).
- **Cara elegida:** se guarda en la memoria de la TV (`/reloj.r1`); elegir la Cara 1 borra el archivo.
- **Pro:** la lee de `dispositivos/{id}/reloj` (`{ clave, datos }`, datos = Base64 de la receta). **Lite:** llega por
  Bluetooth como un envío con el **bit 4** del INICIO (la receta tal cual, sin Base64); el comando **`0x24 [0]`** vuelve a la
  Cara 1 (`[0xA4][ok]`). Ya aprobados (plan, sección 10).
- **Catálogo** (aprobado): `relojes/indice/<clave>` = `{ nombre, orden, fecha }` y `relojes/datos/<clave>` = Base64 de la
  receta; lo lee cualquier sesión y lo escribe un administrador.

## 5. Ejemplo: la Cara 1 escrita como receta (para la prueba "pixel por pixel")

La Cara 1 vive en el código, pero escrita como receta sería: íconos de estado (tipo 6) arriba a la derecha; AM/PM (tipo 2)
en (2, 1), clásica tamaño 1; hora (tipo 1) centrada en (64, 24), clásica tamaño 3, 12 h; fecha (tipo 3) centrada en
(64, 54), clásica tamaño 1, formato 0. La prueba automática dibuja esta receta en la app y la compara con el reloj de hoy.
