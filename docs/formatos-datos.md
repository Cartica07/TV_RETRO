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
  "tipo": "texto | imagen | cancion | animacion | musical",
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
  "musical":   { "nombre": "<clave del catálogo>", "repeticiones": 1, "formato": "m1" }
}
```

Solo va el sub-objeto del `tipo` actual (`imagen`, `cancion`, `animacion` o `musical`). Un texto no lleva ninguno: hasta el 2026-11-10 llevaba también la última imagen en `imagen`, que el firmware no lee con tipo `texto`.

| Campo | Desde | Notas |
|---|---|---|
| `config.fuente` | rediseño (aprobado) | Tamaño en las fuentes nuevas: 1..5 = 6/10/12/16/18 pt. |
| `config.manual`, `x`, `y` | rediseño (aprobado) | Esquina superior izquierda del bloque, limitada para no salirse. |
| `config.direccion` | rediseño (aprobado) | Scroll vertical: 1 s quieto, sube a 12 px/s, 1 s quieto, repite. |
| `animacion.formato/cantidad` | z1 (aprobado) | Sin `cuadros`; los cuadros van en `archivo`. |
| `musical` | musicales (aprobado) | La grabación va en `archivo`. |

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

`oled_remota/archivo/datos` (al enviar) y `musicales/datos/<clave>` (en el catálogo) = Base64 de:

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
- **Con letra:** se envía `tipo: "musical"` + `archivo` m1. Reemplaza la pantalla.
- **Sin letra:** se envía `tipo: "cancion"` con `notas` sacadas de la grabación (`notasParaCancion`), sin `archivo`. Suena de fondo y no toca la pantalla.

## 5. Archivos en el ESP32 (LittleFS, ~7,9 MB)

| Ruta | Qué es |
|---|---|
| `/current_song.bin`, `/nueva_song.bin` | Canción actual y la que se está bajando. |
| `/current_anim.bin`, `/nueva_anim.bin` | Animación actual y la que se está bajando (la bandera `0x80000000` en la cantidad de cuadros marca z1). |
| `/current_musical.bin`, `/nuevo_musical.bin` | Musical actual y el que se está bajando (m1 tal cual). |

La tarea de red escribe en la ruta "nueva" y el `loop()` la mueve a la "actual" cuando está completa.

## 6. Reglas de seguridad

`database.rules.json` es la copia de las reglas. Hoy todo está abierto:

```json
{
  "rules": {
    "oled_remota": { ".read": true, ".write": true },
    "canciones":   { ".read": true, ".write": true },
    "imagenes":    { ".read": true, ".write": true },
    "animaciones": { ".read": true, ".write": true },
    "musicales":   { ".read": true, ".write": true }
  }
}
```

- `musicales` lo publicó el dueño el 2026-11-10. Sin esa regla, importar o leer musicales da `PERMISSION_DENIED` (el panel lo muestra como "sin permiso").
- Plan futuro, pendiente:
  - login con email y contraseña;
  - `oled_remota` con lectura pública para el ESP;
  - `lastSeen` escribible por el ESP;
  - todo lo demás, lectura y escritura, solo con el UID del dueño. Con la `apiKey` pública cualquiera podría crearse una cuenta, así que `auth != null` no alcanza.

### Estructura con cuentas (PROPUESTA, aprobada el 2026-11-10; sin publicar ni migrar)

Archivo: `database.rules.propuesta.json` (la copia publicada sigue siendo `database.rules.json`). Probada con el emulador de Firebase (71 casos). Las reglas viejas y esta estructura NO conviven: al publicarlas se cierran las rutas viejas, por eso primero se migra (paso 7 del plan).

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
- **Código de emparejamiento:** 6 caracteres de `A-HJ-NP-Z2-9` (sin 0, O, 1, I). La TV lo genera al mantener pulsado el botón y lo escribe en `emparejamiento/{codigo}` con `creado` = hora del servidor (`{".sv":"timestamp"}`; no depende del reloj de la TV). Se puede reclamar durante 10 minutos. El usuario lo escribe en la app: la app lee `emparejamiento/{codigo}` (solo se puede leer conociendo el código, no listar) para saber el `id`, y escribe `dueno` y `codigoUsado` en un solo `update`; después, en una segunda escritura, agrega la TV a su lista. La TV borra su código en cuanto ve que `dueno` apareció. Desvincular = borrar `dueno`.
- **Límites de tamaño** en las reglas: `pantalla.texto` ≤ 5000 caracteres, `pantalla.imagen.datos` ≤ 100.000, `archivo.datos` ≤ 10.000.000 (Firebase no admite textos de más de 10 MB), imágenes del catálogo ≤ 100.000.
- **Firmware:** al migrar, la TV usa `auth=<idToken>` en sus peticiones REST y en el stream, renueva el token cada hora (el stream avisa con `auth_revoked`) y cambia las rutas a `dispositivos/{id}/oled_remota/…`.
- **Migración (paso 7):** mover `oled_remota` a `dispositivos/{id}/oled_remota` y `imagenes`/`animaciones` a `usuarios/{uid del dueño}/`; `musicales` queda donde está.
