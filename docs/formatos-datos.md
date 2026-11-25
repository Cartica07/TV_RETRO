# Formatos de datos: Firebase, z1 y m1

Es la referencia exacta de lo que el panel escribe y el firmware lee. **No se cambia nada de esto sin aprobación del dueño** (ver [CLAUDE.md](../CLAUDE.md)). Todo campo nuevo necesita un valor por defecto, para que un firmware que no lo conoce siga funcionando.

Proyecto Firebase: `lorenita-6ad1e`, Realtime Database: `https://lorenita-6ad1e-default-rtdb.firebaseio.com`.

---

## 1. Árbol de la base

```
/
├── oled_remota/              lo que la TV muestra ahora (el ESP lo lee)
│   ├── version               entero; un número nuevo en cada envío (el ESP escucha este campo)
│   ├── contadorVersion       entero; reserva el número del próximo envío (transacción del panel; el ESP no lo lee)
│   ├── mostrada              entero; la versión que la TV ya aplicó (la escribe el firmware; el panel la lee: acuse de recibo, 2026-11-15)
│   ├── lastSeen              heartbeat: hora del servidor (ms, {".sv":"timestamp"}) que escribe el ESP cada 10 s; la web solo lo lee
│   ├── pantalla/             el contenido (ver §2)
│   └── archivo/              solo con contenido pesado (z1 o m1); si no, no existe
│       ├── version           = oled_remota/version del mismo envío
│       └── datos             Base64 del binario
├── imagenes/<clave>          catálogo de la Galería (el ESP no lo lee)
├── animaciones/<clave>       catálogo de animaciones y GIF (el ESP no lo lee)
├── canciones/<clave>         catálogo viejo de canciones de solo ritmo (borrado el 2026-11-10; solo lo usa carga-masiva.html)
└── musicales/                catálogo de canciones con letra (nuevo)
    ├── indice/<clave>        metadatos livianos (para listar rápido)
    └── datos/<clave>         grabación m1 en Base64
```

Los catálogos son **hermanos** de `oled_remota`, no hijos, por dos motivos:
- el ESP8266 original pedía `oled_remota.json` completo cada 10 s, y si los catálogos estuvieran adentro los bajaría siempre;
- un `set()` sobre `oled_remota` los borraría.

## 2. `oled_remota/pantalla`

El panel escribe con **un solo `update()`** sobre `oled_remota`: `{version, pantalla, archivo}`. Así se reemplaza `pantalla` completo y no se toca `lastSeen`.

```json
{
  "tipo": "texto | imagen | cancion | animacion | musical | juego | alarma | ajustes",
  "texto": "último texto (se guarda siempre, sea cual sea el tipo)",
  "config": {
    "tamano": 1,              // 1..5
    "alineacion": "izquierda",// izquierda | centro | derecha
    "alineacionV": "centro",  // centro | arriba
    "invertido": false,
    "modoTexto": "ajustar",   // ajustar | scroll   (el firmware también acepta reducir | recortar)
    "fuente": "sans",         // clasica | sans | sansb | serif | serifi   (si falta: clasica)
    "manual": false,          // true: usar x, y en vez de la alineación
    "x": 0, "y": 0,
    "direccion": "h"          // h | v (solo con modoTexto = scroll; si falta: h)
  },
  "imagen":    { "ancho": 128, "alto": 64, "datos": "<Base64 1bpp>" },
  "cancion":   { "nombre": "...", "repeticiones": 1, "notas": [[Hz, ms], ...] },
  "animacion": { "nombre": "...", "ancho": 128, "alto": 64, "cuadros": [{ "datos": "<Base64>", "dur": 100 }] },
  "animacion (z1)": { "nombre": "...", "ancho": 128, "alto": 64, "formato": "z1", "cantidad": 8 },
  "musical":   { "nombre": "<clave del catálogo>", "repeticiones": 1, "formato": "m1" },
  "juego":     { "id": "snake" }   // orden "abre este juego" (Más > Juegos); id = 1 a 12 letras minúsculas
}
```

Solo va el sub-objeto del `tipo` actual (`imagen`, `cancion`, `animacion` o `musical`). Un texto no lleva ninguno: hasta el 2026-11-10 llevaba también la última imagen en `imagen`, que el firmware no lee con tipo `texto`.

| Campo | Desde | Notas |
|---|---|---|
| `config.fuente` | rediseño (aprobado) | Tamaño en las fuentes nuevas: 1..5 = 6/10/12/16/18 pt. |
| `config.manual`, `x`, `y` | rediseño (aprobado) | Esquina superior izquierda del bloque, limitada para no salirse. |
| `config.direccion` | rediseño (aprobado) | Scroll vertical: 1 s quieto, sube a 12 px/s, 1 s quieto, repite. |
| `animacion.formato/cantidad` | z1 (aprobado) | Sin `cuadros`; los cuadros van en `archivo`. |
| `musical` | musicales (aprobado) | Forma anterior: la grabación va en `archivo`. Desde H-22, con `clave`, no hay `archivo` (ver la fila siguiente). |
| `musical.clave` | H-22, musical por referencia (aprobado 2026-11-16) | Clave del musical en `musicales/datos/<clave>` (texto de 1 a 150 caracteres sin `/ . $ # [ ]`). Opcional: **con** `clave` el panel NO sube la grabación (`archivo` = null) y la TV la baja del catálogo; **sin** `clave` todo funciona como antes (la grabación va en `archivo`). Orden de puesta en marcha: reglas → firmware → panel (un panel con `clave` y un firmware sin ella no reproduce el musical). |
| `tipo = "alarma"` + nodo `dispositivos/{id}/alarma` | Más > Alarma (aprobado 2026-11-14) | La alarma NO va en `pantalla`: vive en `dispositivos/{id}/alarma` = `{ tono, alarmas: { "0": {activa, hora, minuto, dias}, "1": …, "2": … } }` (hasta 3; `tono` = clave de `musicales/` o vacío = aviso simple de la TV; `hora` 0..23, `minuto` 0..59, `dias` = máscara de bits 0..127 con bit 0 = domingo … bit 6 = sábado; por defecto 07:00 de lunes a viernes). Lo escribe el dueño o un miembro (la TV solo lo lee). La orden `pantalla.tipo = "alarma"` (mismo `update()` de siempre, sin datos propios) le dice a la TV que vuelva a leerlo; la TV también lo lee al conectarse y lo guarda en su memoria (NVS), así suena sin celular ni Wi-Fi siempre que sepa la hora (NTP; sin batería de reloj, tras un corte sin Wi-Fi no suena hasta sincronizar). Si el tono es una canción, la TV baja `musicales/datos/{clave}` (m1) a su memoria. Es una orden como `juego`: no cambia lo mostrado, no se obedece al encender y el panel la lee como Texto. Reglas publicadas (ver `database.rules.json`). |
| `tipo = "ajustes"` + nodo `dispositivos/{id}/ajustes` | Más > Config > Ajustes de la TV (aprobado 2026-11-14) | `dispositivos/{id}/ajustes` = `{ brillo: 1..3, volumen: 0..3, zona }` (brillo 1 Bajo / 2 Medio / 3 Alto; volumen 0 Silencio … 3 Alto; `zona` = minutos respecto de la hora universal, -720..840, ej. -300 = Colombia). Por defecto `{3, 3, -300}` (como era antes). Lo escribe el dueño o un miembro; la TV solo lo lee. Igual que la alarma: la orden `pantalla.tipo = "ajustes"` hace que la TV lo vuelva a leer; también lo lee al conectarse y lo guarda en la NVS. En la TV: brillo = contraste de la OLED, volumen = ancho del pulso del buzzer (todos los sonidos pasan por `sonido.cpp`), zona = `TZ` del reloj y de la alarma. La alarma suena aunque el volumen esté en Silencio (a volumen Medio). **Campo `apagado` (aprobado 2026-11-23, reglas por publicar):** minutos sin usar el botón tras los que la pantalla se apaga sola: 0 (nunca), 5, 10 o 20; es opcional y si falta vale 5 (un firmware que no lo conoce lo ignora). Si las reglas publicadas aún no lo incluyen, la app guarda los ajustes sin él. Apagado automático de la pantalla (aprobado por el dueño el 2026-11-23, Pepito Pro y Pepito Lite): la pantalla se apaga sola tras `apagado` minutos sin usar el botón (0 = nunca; si falta, 5). Un toque con la pantalla apagada solo la prende, en la última pantalla. No se apaga mientras suena la alarma o una canción con letra está en pantalla (ni, en la Lite, con la ventana de emparejamiento abierta). Si llega algo del celular con la pantalla apagada: se prende 10 s en la pantalla en que se apagó (reloj: con el sobre y el pitido; contenido: lo nuevo y el pitido; otra pantalla, como Juegos en la Pro: el reloj con el sobre y el pitido) y vuelve a apagarse si no se toca el botón. La pantalla "apagada" sale del ciclo del botón. |
| `tipo = "juego"` + `juego.id` | Más > Juegos (aprobado 2026-11-14) | Es una **orden**, no contenido: la TV entra al modo Juegos y arranca ese juego (`snake`, `breakout`, `flappy`, `invaders`, `jump`); lo que mostraba se queda como estaba. Va en el mismo `update()` de siempre (`version` nueva, `texto` y `config` como siempre, `archivo` = null). Un firmware viejo la toma como contenido sin imagen y no hace nada especial. La TV no obedece una orden vieja al encender (la muestra como texto) y descarta la que llega mientras hay una partida. El panel, al recargar, la lee como Texto. Las reglas piden `juego.id` = `^[a-z]{1,12}$` y ningún otro hijo. |

Especificación de cómo dibujar el texto: [firmware-fuentes.md](firmware-fuentes.md).

### Bitmaps 1bpp
128×64 = **1024 bytes**: filas de 16 bytes, el bit más significativo es el punto de la izquierda, 1 = encendido. Es el mismo formato que `Adafruit_GFX::drawBitmap`. Se envía en Base64.

### Notas de canción (`cancion.notas`)
Es un arreglo de `[frecuencia Hz, duración ms]`, donde 0 Hz es silencio. El firmware lo guarda en `/current_song.bin` y lo toca de fondo con `tone()`, `repeticiones` veces.

## 3. Formato z1: animaciones comprimidas

`oled_remota/archivo/datos` = Base64 de la concatenación, por cada cuadro, de:

```
[uint32 dur ms][uint16 bytes][deflate-raw del bitmap 1bpp]   (little-endian)
```

- Cada cuadro se comprime **por separado**, sin pérdida, con `CompressionStream('deflate-raw')`.
- El firmware lo escribe tal cual en `/current_anim.bin` y descomprime cada cuadro al dibujarlo con `tinfl_decompress` (ROM del ESP32, `#include <miniz.h>`).
- Si el navegador no tiene `CompressionStream`, el panel envía el formato viejo (`cuadros` dentro de `pantalla.animacion`), que el firmware sigue aceptando.
- Avisos de peso: sin aviso ≤ 256 KB comprimido, amarillo hasta 1 MB, rojo > 1 MB. El ESP32-S3 baja directo a LittleFS (~7,9 MB), así que el límite es el tiempo de descarga, no el espacio. Solo avisan.

## 4. Formato m1: musicales

`musicales/datos/<clave>` (en el catálogo; también `oled_remota/archivo/datos` en la forma anterior de envío) = Base64 de:

```
"M1"                         2 bytes: 0x4D 0x31
[uint8  versión = 1]
[uint8  banderas]            bit0 = repetir (el .ino original vuelve a empezar solo)
[uint32 duración ms]         una vuelta completa (incluye la pausa final)
[uint32 nNotas]
  nNotas × [uint32 t ms][uint16 Hz]          desde t suena Hz (0 = silencio)
[uint32 nImágenes]
  nImágenes × [uint16 bytes][deflate-raw del bitmap 1024 bytes]   imágenes DISTINTAS
[uint32 nCuadros]
  nCuadros × [uint32 t ms][uint16 número de imagen]             desde t se ve esa imagen
```

- Todo es little-endian.
- `t` se cuenta desde el final de `setup()` del `.ino`.
- Notas y cuadros siguen el mismo reloj, así que la letra va a tiempo con la música.
- Las imágenes están **deduplicadas**: un GIF que se repite toda la canción ocupa lo mismo que una vuelta.
- Lo codifica `codificarMusical()` y lo decodifica `decodificarMusical()` en `js/compresion.js`; lo reproduce `musical.cpp` en el firmware.

### `musicales/indice/<clave>`
```json
{ "nombre": "Cumpleaños feliz", "archivo": "cumpleanos_feliz.ino", "duracion": 23900,
  "repetir": true, "imagenes": 12, "bytes": 15340, "origen": "ino", "fecha": 1762700000000 }
```
- La **clave** es el nombre del archivo sin `.ino`, con `. $ # [ ] /` cambiados por `_`.
- `nombre` sale del comentario de la primera línea del `.ino` (`// "nombre" -- generado con ...`); si no está, se usa la clave.
- Si se importa de nuevo un archivo con la misma clave, se reemplaza.

### Con letra y sin letra
- **Con letra:** se envía `tipo: "musical"` con `pantalla.musical.clave` (por referencia; H-22). La TV baja la grabación m1 de `musicales/datos/<clave>` y reemplaza la pantalla. (Forma anterior, sin `clave`: la grabación m1 va en `oled_remota/archivo`; el firmware la sigue aceptando.)
- **Sin letra:** se envía `tipo: "cancion"` con `notas` sacadas de la grabación (`notasParaCancion`), sin `archivo`. Suena de fondo y no toca la pantalla.

## 5. Archivos en el ESP32 (LittleFS, ~7,9 MB)

| Ruta | Qué es |
|---|---|
| `/current_song.bin`, `/nueva_song.bin` | Canción actual y la que se está bajando. |
| `/current_anim.bin`, `/nueva_anim.bin` | Animación actual y la que se está bajando (la bandera `0x80000000` en la cantidad de cuadros marca z1). |
| `/current_musical.bin`, `/nuevo_musical.bin` | Musical actual y el que se está bajando (m1 tal cual). |

La tarea de red escribe en la ruta "nueva" y el `loop()` la mueve a la "actual" cuando está completa.

## 6. Reglas de seguridad

`database.rules.json` es la copia de las reglas **publicadas** (estructura con cuentas, más abajo). Las reglas abiertas de antes de las cuentas están en `database.rules.antiguas.json` y las de cada etapa posterior en los `database.rules.sin-*.json`, para volver atrás.

- `musicales` se publicó el 2026-11-10; sin esa regla, importar o leer musicales da `PERMISSION_DENIED` (el panel lo muestra como "sin permiso").
- La `apiKey` del panel es pública: la seguridad real son estas reglas (`auth != null` no alcanza; cada cuenta solo ve lo suyo).

### Estructura con cuentas (PUBLICADA y migrada el 2026-11-11)

Archivo: `database.rules.json` (lo publicado). Las reglas abiertas anteriores están en `database.rules.antiguas.json`. Probadas con el emulador de Firebase (74 casos en `reglas.mjs`). Las rutas viejas (`oled_remota`, `imagenes`, `animaciones` en la raíz) quedaron cerradas; sus datos siguen en la base como respaldo hasta que el dueño decida borrarlos.

```
dispositivos/{id}/
   dueno: <uid>                  quién es el dueño; ausente = TV sin dueño
   codigoUsado: "K7M2QX"         el código con el que se reclamó (se escribe junto con dueno)
   oled_remota/{version, contadorVersion, lastSeen, archivo, pantalla}   MISMO formato que hoy
usuarios/{uid}/
   dispositivos/{id}: true       lista de TV del usuario
   imagenes/{clave}, animaciones/{clave}   catálogos privados (mismo formato que hoy)
emparejamiento/{codigo}: { id, creado }   código de 6 caracteres que muestra la TV
musicales/indice/{clave}, musicales/datos/{clave}   biblioteca común (lee quien tenga sesión; escribe un administrador)
administradores/{uid}: true      solo se edita desde la consola o el Admin SDK
```

- **Cuentas:** Firebase Auth con correo y contraseña. Correo de verificación y de restablecer contraseña: los manda Firebase (gratis). Sin "Entrar con Google" por ahora.
- **La TV tiene su propia cuenta** de Firebase Auth con el claim `dispositivo: "<id>"` (lo pone un script de fabricación con el Admin SDK). Solo lee su nodo, escribe `lastSeen` y sus códigos de emparejamiento.
- **Código de emparejamiento:** 6 caracteres de `A-HJ-NP-Z2-9` (sin 0, O, 1, I). La TV lo genera sola mientras no tenga dueño (antes: al mantener pulsado el botón; ver "Compartir una TV") y lo escribe en `emparejamiento/{codigo}` con `creado` = hora del servidor (`{".sv":"timestamp"}`; no depende del reloj de la TV). Se puede reclamar durante 10 minutos. El usuario lo escribe en la app: la app lee `emparejamiento/{codigo}` (solo se puede leer conociendo el código, no listar) para saber el `id`, y escribe `dueno` y `codigoUsado` en un solo `update`; después, en una segunda escritura, agrega la TV a su lista. La TV borra su código en cuanto ve que `dueno` apareció. Desvincular = borrar `dueno`.
- **Límite por cuenta (paso 8; reglas publicadas el 2026-11-12):** una cuenta guarda como máximo **25 elementos entre imágenes y animaciones (GIF) juntas, y de ellos como máximo 10 GIF** (24 imágenes + 1 GIF, o 15 + 10, nunca 25 GIF). Los límites base son `config/limites/total` (25) y `config/limites/animaciones` (10), los cambia un administrador; `usuarios/{uid}/cuotas/extra` y `extraAnimaciones` suman más y solo las escribe un administrador: ahí irán los desbloqueos con anuncios. El administrador no tiene límite. Nodos nuevos:
  - `usuarios/{uid}/cuotas/{usados, gifs, ultimo, extra, extraAnimaciones}`: `usados` es el contador del total y `gifs` el de animaciones; reemplazar un elemento existente no cambia nada; crear una imagen suma 1 a `usados`, crear una animación suma 1 a `usados` y a `gifs`; borrar resta lo mismo. SIEMPRE en la misma escritura (`update` desde la raíz) y con `ultimo` = `"i:<clave>"` (imagen) o `"a:<clave>"` (animación): así una escritura no puede crear dos elementos con un solo +1. Si dos dispositivos escriben a la vez, las reglas rechazan la segunda y el panel relee y reintenta una vez. Las claves de elementos tienen como máximo 80 caracteres.
  - `biblioteca/imagenes/{clave}` y `biblioteca/animaciones/{clave}`: la **biblioteca predeterminada**, mismo formato que el catálogo personal; la lee cualquier cuenta con sesión, **no cuenta en el límite** y solo un administrador la escribe. El panel la mezcla con el catálogo de la cuenta (marcadas `predeterminada: true`, solo un administrador las puede borrar, con aviso de que se pierden para todas las cuentas; si la cuenta tiene una con el mismo nombre, gana la de la cuenta). Se llena con `herramientas/mover-a-biblioteca.cjs`.
  - `config/limites/{total, animaciones}`: números (por defecto 25 y 10).
- **Forma y tamaño de lo guardado en el catálogo:** imagen = `{datos ≤100000, ancho, alto ≤4096, meta, preprocesada ≤60000}`; animación = `{ancho, alto, cuadros (máx. 1000, cada uno {datos ≤4096, dur}), meta}`; `meta` solo texto (≤200), número o booleano; sin campos de más.
- **Reglas propuestas, Etapa 2 (2026-11-12, publicadas el 2026-11-14):** NO cambian rutas ni campos, solo cierran lo que ya existía:
  - `oled_remota/version` y `contadorVersion`: enteros entre 0 y 2.000.000.000; `-2` (desvinculada) solo lo escribe el dueño.
  - `oled_remota/pantalla`: cada tipo con sus campos y topes y sin campos de más (`config`: tamano 0-100, x/y ±4096, textos cortos; `imagen`: ancho/alto ≤4096; `cancion`: hasta 9999 notas `[frecuencia, ms]`; `animacion`: hasta 1000 cuadros, `cantidad` ≤1000; `musical`: nombre, repeticiones, formato); `oled_remota/archivo` solo `version` y `datos`.
  - `meta` del catálogo de la cuenta: solo `origen`, `umbral`, `dithering`, `fecha`, `escala`, `fondo`, `rotar`, `volteoH`, `volteoV`; cuadros de animación ≤2048 caracteres.
  - **Crear o reemplazar** en `usuarios/{uid}/imagenes|animaciones` exige `auth.token.email_verified === true` (borrar sigue libre; un administrador queda exento; una cuenta de Google ya viene verificada).
  - `usuarios/{uid}/dispositivos/{id}` se valida contra el estado posterior, para vincular o unirse a una TV en una sola `update()` (Etapa 1).
- **Baja de cuenta (Etapa 5, publicada el 2026-11-14):** `usuarios/{uid}` tiene un `.write` que solo permite el resultado "no existe" (`!newData.exists()`) a su propia cuenta: sirve para borrar TODO el nodo de una vez (imágenes, GIF, contadores y lista de TV); no permite escribir ni borrar por partes. La app lo usa en `eliminarMiCuenta()` (`firebase.js`): confirma la identidad, suelta las TV (`dueno`/`codigoUsado`/`miembros` en null y `oled_remota/version = -2`; de las compartidas sale), borra `usuarios/{uid}` y borra la cuenta de Authentication. `administradores/{uid}` no se toca desde la app.
- **Límites de tamaño** en las reglas: `pantalla.texto` ≤ 5000 caracteres, `pantalla.imagen.datos` ≤ 100.000, `archivo.datos` ≤ 10.000.000 (Firebase no admite textos de más de 10 MB), imágenes del catálogo ≤ 100.000.
- **Firmware:** al migrar, la TV usa `auth=<idToken>` en sus peticiones REST y en el stream, renueva el token cada hora (el stream avisa con `auth_revoked`) y cambia las rutas a `dispositivos/{id}/oled_remota/…`.
- **Migración (paso 7):** mover `oled_remota` a `dispositivos/{id}/oled_remota` y `imagenes`/`animaciones` a `usuarios/{uid del dueño}/`; `musicales` queda donde está.

### Compartir una TV: miembros e invitaciones (aprobado el 2026-11-12; reglas publicadas el 2026-11-12)

Caso de uso: regalar una TV y poder mandarle mensajes desde otra casa. La TV tiene **un dueño** y hasta **5 miembros**; cada persona la ve en su lista de Mi TV.

```
dispositivos/{id}/miembros/{uid}: "<código de la invitación usada>"   (6 caracteres A-HJ-NP-Z2-9)
invitaciones/{codigo}: { id: "<id de la TV>", creado: <hora del servidor> }   vigente 10 minutos, de un solo uso
```

- **Qué puede hacer un miembro:** leer la TV y enviar contenido (`version`, `contadorVersion`, `pantalla`, `archivo`). **No** puede desvincular la TV, invitar ni quitar a otros. Puede salirse (borra su entrada).
- **Qué puede hacer el dueño:** todo lo anterior, crear invitaciones, quitar miembros y desvincular (el mismo `update()` quita `dueno`, `codigoUsado` y `miembros`).
- **Invitar:** el dueño crea `invitaciones/{codigo}` (con `id` de su TV y `creado: {".sv":"timestamp"}`) y le pasa el código a la otra persona, que lo escribe en Mi TV (el mismo campo de la TV nueva: el panel prueba primero `emparejamiento/{codigo}` y si no existe, `invitaciones/{codigo}`).
- **Un solo uso (lo exigen las reglas):** para entrar, el invitado escribe en UN solo `update()` `dispositivos/{id}/miembros/{uid} = codigo` y `invitaciones/{codigo} = null`; las reglas rechazan entrar sin gastar la invitación. Además la invitación debe tener menos de 10 minutos, ser de esa TV y la TV debe tener dueño distinto de quien entra.
- **Límite de 5 miembros:** lo aplica el panel (RuleDataSnapshot no tiene `numChildren()`); las reglas no lo cuentan. Solo el dueño puede crear invitaciones, así que no hay forma de pasarse sin él.
- **Apodos de las personas (aprobado 2026-11-17; reglas publicadas):** `dispositivos/{id}/apodos/{uid}` = texto de 1 a 20 caracteres que el **dueño** le pone a cada miembro (hoy "Persona N"). Las reglas lo dejan escribir solo al dueño y solo si ese `uid` está en `miembros` (se valida contra el estado posterior); lo leen el dueño, los miembros y la TV (como todo el nodo del dispositivo). Se borra con el miembro: el dueño al quitarlo (mismo `update()` que borra `miembros/{uid}`), el propio miembro al salirse, y al desvincular (`apodos: null` junto con `miembros: null`). **Sin nombre = "Persona N"**, y un panel o firmware que no conocen el campo siguen funcionando igual (el firmware no lo lee). Copia de vuelta atrás: `database.rules.sin-apodos.json`. Orden de puesta en marcha: reglas (las publica el dueño) → panel/APK; si el panel nuevo corre con las reglas anteriores, repite sin los apodos las escrituras de quitar, salir y desvincular para no fallar.
- **Actualización de la TV (OTA) y restablecimiento (aprobados 2026-11-17, H-19; reglas publicadas, firmware y panel hechos y probados en la TV real):**
  - `firmware/estable` = `{ build, tamano, sha256, firma, url? }`: `build` entero ≥ 1 (el firmware lleva el suyo compilado); `tamano` en bytes (1 a 3 900 000, menos que el slot de 4 MB); `sha256` = 64 caracteres hexadecimales en minúscula del .bin; `firma` = RSA-2048 en Base64 sobre el texto `build|tamano|sha256`; `url` = campo RESERVADO (https, máx. 300 caracteres): la TV lo ignora hoy. Para mudar el alojamiento (otro servidor, plan Blaze) se publica antes UNA versión por la base que enseña a la TV a bajar por `url`, y luego se cambia de servidor sin tocar el contrato. Lo escribe un administrador; lo lee cualquier cuenta con sesión.
  - `firmware/datos/{build}` = el .bin en Base64 (la clave es solo dígitos; máx. 10 000 000 caracteres). Solo lo lee la TV (token con `dispositivo`) o un administrador; nadie lo lista. Se conservan 2 versiones.
- **Ciudad para el clima (aprobada por el dueño el 2026-11-24; reglas por publicar, copia de vuelta atrás `database.rules.sin-ciudad.json`):** `dispositivos/{id}/ajustes.ciudad` = `{ nombre (1-60), lat (-90 a 90), lon (-180 a 180) }`. La elige la app en Más > Caras de reloj (solo con un Pepito Pro y una cara que muestra el clima) con el buscador gratuito de Open-Meteo; la Pro v11 consulta el clima de esa ciudad cada 15 minutos solo si su cara lo usa. Si falta, no hay clima. Un firmware anterior la ignora.
- **Caras de reloj (aprobadas por el dueño el 2026-11-23/24; reglas por publicar, copia de vuelta atrás `database.rules.sin-relojes.json`):** formato de la receta en [receta-r1.md](receta-r1.md). `relojes/indice/<clave>` = `{ nombre (1-30), orden, fecha }` y `relojes/datos/<clave>` = la receta en Base64 (8 a 2 732 caracteres); los lee cualquier sesión y los escribe un administrador; la clave son letras, números, `_` o `-` (hasta 40). `dispositivos/{id}/reloj` = `{ clave, datos }` (la cara elegida, copiada del catálogo: si el dueño la cambia o la borra del catálogo, la TV sigue igual); lo escriben el dueño y los miembros, lo leen ellos y la TV; si falta = Cara 1 (un firmware que no lo conoce sigue con su reloj). Desvincular y restablecer lo borran (como `ajustes`, H-34).
- **Dúos (solo Pepito Pro; aprobados por el dueño el 2026-11-24; reglas por publicar, copia de vuelta atrás `database.rules.sin-duos.json`; protocolo entre las TV en [protocolo-duos.md](protocolo-duos.md)):** `duos/indice/<clave>` = `{ nombre (1-30), orden, fecha, duracion (ms, 40 a 60 000), portada }` (la portada es la imagen de las dos pantallas juntas, 256×64 a 1 bit por punto en Base64: hasta 2 732 caracteres) y `duos/datos/<clave>` = `{ izq, der }` (cada mitad es una grabación m1 en Base64, hasta 136 536 caracteres = 100 KB); los lee cualquier sesión (también la TV, que los baja sola) y los escribe un administrador (desde el editor de dúos); la clave son letras, números, `_` o `-` (hasta 40). `dispositivos/{id}/ajustes.duos` (booleano: dúos activados; si falta = activados) y `ajustes.duoFavorito` (la clave del dúo favorito; si falta = el primero del catálogo): los escriben el dueño y los miembros con el resto de los ajustes y viajan con la orden `ajustes` de siempre; un firmware o una app que no los conocen siguen igual. La TV Lite no tiene dúos.
  - **Pepito Lite (aprobado por el dueño el 2026-11-23, actualización por Bluetooth; reglas por publicar, copia de vuelta atrás `database.rules.sin-firmware-lite.json`):** `firmware/lite/<modelo>/estable` = `{ build, tamano, sha256, firma }` y `firmware/lite/<modelo>/datos/<build>` = el .bin en Base64 (máx. 1 800 000 caracteres). `<modelo>` = `c3` (el producto) o `s3` (la placa de pruebas del dueño). `tamano` de 1 a 1 310 720 (el espacio de programa de 1,25 MB de la tabla por defecto); `firma` = RSA-2048 en Base64 sobre `lite|<modelo>|build|tamano|sha256`. Lo escribe un administrador y lo lee **cualquier sesión** (también la anónima de la Lite sin cuenta), porque aquí el programa lo baja la app y se lo pasa a la TV por Bluetooth (protocolo: sección 8.5 de `evaluacion-version-lite.md`); no es secreto, lo protege la firma. No hay campos nuevos en `dispositivos/`: la versión de una Lite la sabe la app por Bluetooth.
  - `dispositivos/{id}/firmware` = `{ build, estado, fecha? }`: lo escribe SOLO la TV (`estado` = letras minúsculas y guion bajo, 1 a 30, p. ej. `ok`, `actualizando`, `firma_invalida`); lo leen dueño y miembros.
  - `pantalla.tipo = "actualizar"` / `"restablecer"`: órdenes sin datos propios (las reglas rechazan cualquier hijo extra). **Solo el dueño** las puede escribir: un miembro, una cuenta ajena y la TV quedan denegados. La TV no las obedece al encender (como `juego`, `alarma` y `ajustes`).
  - **Restablecer solo desde la app** (sin gesto físico): el panel manda la orden, espera el acuse `mostrada` y luego hace el `desvincular` de siempre como dueño; la TV (que tiene que estar encendida) borra su Wi-Fi, alarmas, ajustes, último contenido y archivos, conserva su identidad y vuelve a pedir Wi-Fi y a mostrar un código nuevo. La TV no necesita permisos de borrado nuevos. Copia de vuelta atrás de las reglas: `database.rules.sin-firmware.json`. Orden de puesta en marcha: reglas (las publica el dueño) → firmware (la primera versión con OTA se graba por cable) → panel/APK.
  - **Qué se pierde al restablecer (decidido por el dueño, 2026-11-18):** el `desvincular` que hace el panel borra también de la nube `alarma`, `ajustes`, `miembros`, `apodos`, `pantalla` y `archivo` (H-34), y la TV borra su Wi-Fi, alarmas, ajustes y archivos. Las alarmas no se pueden recuperar. Quedan intactos la cuenta del dueño, su Galería y la biblioteca. La TV conserva su identidad (su cuenta), así que al vincularla de nuevo sigue siendo la misma TV (mismo `id`).
- **Lista de cada persona:** `usuarios/{uid}/dispositivos/{id}: true` también vale para miembros. Si la TV ya no deja entrar a la cuenta (la desvincularon o la quitaron), el panel lo detecta (leer `dispositivos/{id}/dueno` da "sin permiso") y la saca de la lista.
- **Señal de desvinculación (sin campo nuevo):** al desvincular, el panel deja `oled_remota/version = -2` (`VERSION_DESVINCULADA`). La TV ya escucha esa ruta con su streaming y, al verlo, muestra un código nuevo sin hacer consultas periódicas; una versión real (≥ 0) la desarma. Desde el 2026-11-15 (auditoría H-34) el mismo `update()` también borra `oled_remota/pantalla`, `oled_remota/archivo`, `alarma` y `ajustes` de la TV, para que quien reciba la TV no vea el último contenido del dueño anterior ni herede sus alarmas; son nodos que ya existían (no hay campos nuevos) y la TV, al ver la señal, vuelve a leer alarma y ajustes y olvida el contenido que tenía en memoria. Un firmware que no la conoce la toma como una versión más: baja otra vez lo mismo y listo.
- **Vinculación automática de la TV (firmware):** al encender, la TV comprueba UNA vez si tiene dueño. Si no lo tiene, muestra su código en la pantalla de contenido: vence a los 10 min; si no se usa, genera un segundo de 10 min; si tampoco, la pantalla pide reiniciar (aviso que rebota por toda la pantalla, para no marcar la OLED) y no hace más tráfico. Ya no existe el gesto de mantener el botón. Sin conexión reintenta cada 15 s.
- **Orden de puesta en marcha:** primero el dueño publica las reglas nuevas; después se sube el panel (el nuevo "Desvincular" escribe `miembros`, que las reglas viejas no permiten).

### Acuse de recibo y listas livianas de la Galería (aprobados el 2026-11-15; reglas publicadas por el dueño el 2026-11-16)

Dos cambios de datos, los dos **aditivos** (un firmware o un panel que no los conocen siguen funcionando):

- **`dispositivos/{id}/oled_remota/mostrada`** (H-06): entero entre 0 y 2.000.000.000 = la `version` que la TV ya aplicó (contenido u orden). La escribe solo la TV (`auth.token.dispositivo === id`); el dueño y los miembros la leen. El panel, tras un envío, espera `mostrada >= version`: si llega, "En la TV ✅"; tras 20 s sin acuse y con la TV sin conexión, "La TV está sin conexión: lo mostrará cuando se conecte"; con un firmware que no la escribe queda el aviso de siempre. La TV la escribe con un PUT de un número (reintenta cada 15 s si falla; un 401 ahí no invalida el token).
- **`usuarios/{uid}/imagenes_indice/{clave}`, `usuarios/{uid}/animaciones_indice/{clave}`, `biblioteca/imagenes_indice/{clave}` y `biblioteca/animaciones_indice/{clave}`** (H-12): lista liviana de la Galería, con la misma clave que el elemento. Se escribe **en la misma escritura** que el elemento (guardar, reemplazar, borrar) y las reglas no dejan que exista sin él.
  - Imagen: `{ datos, ancho, alto, meta?, editable? }` (sin `preprocesada`; `editable: true` = el elemento tiene copia editable).
  - Animación: `{ ancho, alto, cantidad, miniatura, meta? }` (`miniatura` = el primer cuadro, base64 1bpp; sin el resto de los cuadros).
  - La Galería escucha solo estas listas (en la biblioteca real: de ~420 KB a ~60 KB). La copia editable (`.../imagenes/{clave}/preprocesada`) y los cuadros (`.../animaciones/{clave}/cuadros`) se piden al elegir.
  - **Elementos anteriores a las listas:** si una lista está vacía, el panel lee el catálogo completo una vez y la rellena (la cuenta, sola; la biblioteca, solo un administrador). `herramientas/mover-a-biblioteca.cjs` ya escribe la lista de lo que copia.
  - **Limitación:** si una cuenta ya tiene lista y se guarda un elemento con un panel/APK anterior a este cambio, ese elemento no tiene entrada en la lista y no se ve en la Galería nueva hasta que se vuelva a guardar o se vacíe la lista. Conviene actualizar la APK y la web juntas.
- **Orden de puesta en marcha (importante):** 1) el dueño **publica las reglas** (`database.rules.json`; las publicadas hasta hoy quedan en `database.rules.sin-acuse-indice.json` para volver atrás); 2) push del panel; 3) APK nueva; 4) grabar el firmware. Con el panel nuevo y las reglas viejas, guardar y borrar en la Galería fallaría (las listas no tienen regla); con el firmware nuevo y las reglas viejas, la TV reintenta su aviso cada 15 s sin consecuencias.
