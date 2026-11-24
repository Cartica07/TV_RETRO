# Actualización por Bluetooth de Pepito Lite: plan (APROBADO el 2026-11-23, ver sección 12)

> Escrito el 2026-11-23. Nada de esto está hecho. Los cambios del protocolo Bluetooth y las rutas de Firebase
> necesitan la aprobación del dueño antes de escribir código. Al aprobarse, el protocolo pasa a la sección 8 de
> [evaluacion-version-lite.md](evaluacion-version-lite.md) (la especificación) y las rutas a
> [formatos-datos.md](formatos-datos.md) y a la sección 4 de `CLAUDE.md`. Los textos son PROPUESTAS.

## 1. Qué pidió el dueño

Que un Pepito Lite ya vendido se pueda actualizar. **La app baja el programa nuevo de Firebase** (no va dentro de la
app) y se lo pasa a la TV por Bluetooth. Tiene que estar hecho **antes de vender el primer Lite**: un Lite vendido
sin esto queda con su programa para siempre (solo se arregla por cable).

## 2. Lo comprobado (2026-11-23)

- **Espacio (C3, 4 MB):** la tabla de particiones por defecto ya tiene dos espacios de programa de 1,25 MB
  (`app0`/`app1`) y `otadata`: no hay que cambiarla. Medido en la C3: el programa de hoy ocupa **912 675 bytes** y con
  lo necesario para actualizarse (verificar la firma, escribir el otro espacio, volver atrás) **978 663 bytes (74 %)**:
  +66 KB. Quedan ~330 KB para las caras de reloj y lo que venga.
- **Volver a la versión anterior:** el núcleo de Arduino para la C3 trae activada la reversión
  (`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`). **Pero la Lite de hoy no define `verifyRollbackLater()`**: sin ese gancho
  el núcleo da por buena cualquier versión apenas arranca y la reversión nunca ocurre. La Lite lo añade igual que la
  Pro (`sistema.cpp`).
- **Firma:** se reutiliza la de la Pro (RSA-2048, dos claves públicas en el firmware, las privadas en
  `C:\Proyectos\TV_RETRO-claves`). Lo que se firma cambia (ver 4.4) para que un programa de la Pro nunca sirva en una
  Lite ni al revés.
- **Escritura:** se usa la clase `Update` de Arduino, como la Pro: borra la flash de a 4 KB a medida que escribe (no
  todo de golpe) y deja el primer bloque para el final, así un programa a medias nunca arranca.

## 3. Cómo funciona (en palabras simples)

1. En la app, **Más > Config > Sistema** (hoy oculto con una TV Lite) muestra "Hay una versión nueva…" cuando la
   versión publicada es mayor que la de la TV. Igual que en la Pro, sin números a la vista.
2. Al tocar **Actualizar**, la app baja el programa de Firebase (~1,3 MB), comprueba su huella y se lo manda a la TV
   por Bluetooth con el mismo sistema de trozos de siempre (unos 45-60 s a ~22 KB/s). La app muestra el avance.
3. La TV lo escribe en el otro espacio de programa. Al terminar comprueba que llegó entero, que la **firma** es buena
   y que la versión es **más nueva** que la suya; solo entonces lo deja listo y se reinicia.
4. La app se vuelve a conectar sola, pregunta la versión y, si subió, dice que se actualizó.
5. **Si algo sale mal, la TV sigue con su versión de siempre:** un corte a mitad, una firma mala o una versión vieja
   no tocan lo instalado. Si la versión nueva se cae, vuelve sola a la anterior (sección 5).

## 4. Cambios del protocolo Bluetooth (propuesta)

### 4.1 INICIO con el bit 5 = programa

Las banderas del INICIO ya usan los bits 0 a 3; el **bit 4 está reservado para las caras de reloj**. El programa usa
el **bit 5 (32)**. Con él, el INICIO lleva además la versión, para que la TV pueda decir que no ANTES de recibir nada:

`[0x02][tamaño u32][crc32 u32][ventana u8][banderas u8][id u16 = 0][build u32]`

Aviso `[0x82][ok]`, con valores nuevos solo para el programa: `1` = adelante, `0` = no se puede, `2` = la TV ya tiene
esa versión o una más nueva, `3` = no cabe, `4` = ocupada (alarma sonando). Una app vieja nunca manda el bit 5, así
que nada de lo de hoy cambia.

### 4.2 Lo que viaja

`[firma 256 bytes][sha256 32 bytes][el programa .bin]` (tamaño del envío = 288 + tamaño del programa). La TV guarda en
la memoria la firma y la huella, y el programa lo escribe directo en el otro espacio, calculando su SHA-256 mientras
llega. El CRC32 del envío protege contra trozos dañados; la firma, contra programas que no son nuestros.

### 4.3 FIN y reinicio

Al `0x03` la TV comprueba: tamaño y CRC32, SHA-256 igual al recibido, firma válida y que el chip de la imagen es el
suyo (lo hace `Update.end`). El aviso `0x83` se alarga con un byte al final (15 bytes): `motivo u8` = `0` bien,
`1` llegó incompleto o dañado, `2` firma o huella no válidas, `3` programa que no es para esta TV. Si está bien, la TV
contesta, espera ~1 s (para que el aviso salga) y se reinicia. La app espera ese corte y NO lo trata como "se perdió
la conexión" ni muestra el aviso de vínculo roto.

### 4.4 Qué se firma

Pro (sin cambios): `build|tamano|sha256`. **Lite:** `lite|<modelo>|build|tamano|sha256` (por ejemplo
`lite|c3|2|978663|ab12…`). Con el prefijo, la firma de un programa de la Pro no vale en una Lite (ni al revés), y uno
de la placa de pruebas S3 no vale en una C3.

### 4.5 ESTADO más largo

`0x84` añade al final `[build u32][modelo u8][pendiente u8]` (16 bytes): `modelo` 1 = C3, 2 = S3; `pendiente` 1 =
versión recién instalada aún no dada por buena. Un aviso de 10 bytes (la Lite de hoy) quiere decir "esta TV no se puede
actualizar por Bluetooth": la app no ofrece actualizar. La app ya tolera un aviso más largo.

### 4.6 Durante la actualización

La TV corta la canción que suene y muestra una pantalla de avance (texto propuesto: "Actualizando"). Las alarmas
siguen sonando si llega su hora (el envío sigue). Un INICIO nuevo o una desconexión abandonan la actualización sin
tocar lo instalado (`Update.abort`). La primera Lite con actualización por Bluetooth (`FIRMWARE_BUILD 1`) se graba por
cable.

## 5. Cuándo se da por buena la versión nueva (propuesta)

La versión nueva arranca "pendiente". **Se da por buena cuando el celular vuelve a conectarse y escribe algo** (la app
siempre manda la hora al conectar): eso prueba que el Bluetooth, el vínculo con PIN y la app funcionan con ella.

- Si se cae o se reinicia antes, **vuelve sola a la versión anterior** (lo hace el arranque del chip).
- Si en **10 minutos** ningún celular se conecta, también vuelve a la anterior (una versión con el Bluetooth roto no
  dejaría arreglarla nunca). La app reconecta sola en segundos, así que en el uso normal no pasa.
- Regla para cada versión nueva (como en la Pro): lo guardado en la NVS y en LittleFS debe seguir siendo legible por la
  versión anterior, porque al volver atrás el programa viejo lee datos nuevos.

## 6. Firebase (propuesta, necesita aprobación y que el dueño publique las reglas)

| Ruta | Qué es | Quién lee | Quién escribe |
|---|---|---|---|
| `firmware/lite/<modelo>/estable` | `{ build, tamano, sha256, firma }` (manifiesto) | cualquier sesión (también la anónima de la Lite sin cuenta) | administrador |
| `firmware/lite/<modelo>/datos/<build>` | el .bin en Base64 (máx. ~1,8 MB de texto) | cualquier sesión | administrador |

- `<modelo>` = `c3` (el producto) o `s3` (la placa de pruebas del dueño). Separarlos permite probar en la S3 sin que
  esa versión les llegue a los Lite vendidos (y sirve si un día la Lite cambia de chip).
- A diferencia de la Pro, aquí el programa lo baja **la app**, no la TV: por eso lo lee cualquier sesión. No es un
  secreto: lo que protege es la firma.
- `tamano` ≤ 1 310 720 (el espacio de 1,25 MB). Sin campos nuevos en `dispositivos/`: la versión de una Lite la sabe la
  app por Bluetooth.
- Consumo: cada actualización baja ~1,3 MB de Firebase. El plan gratis permite 10 GB al mes (~7 500 actualizaciones).
- Copia de vuelta atrás antes de cambiar las reglas: `database.rules.sin-firmware-lite.json`.
- `herramientas/publicar-firmware.cjs` del firmware recibe `--lite c3|s3`: usa esas rutas, comprueba que el .bin quepa
  en 1,25 MB y que lleve la marca de versión de la Lite (`PEPITO_LITE_BUILD=`), y firma con el prefijo de 4.4.

## 7. La app (solo la app Pepito; la app vieja TV RETRO no se toca)

- Se reutiliza la pantalla Sistema de la Pro tal cual (en la copia): `src/lite-tv.js` responde `cargarSistema`
  (versión de la TV por `0x84`, versión publicada de `firmware/lite/<modelo>/estable`) y, a la orden "actualizar",
  baja, comprueba y manda el programa, informando los mismos estados que la TV Pro escribe en Firebase
  (`actualizando`, `reiniciando`, `ok`, `al_dia`, `ocupada`, `firma_invalida`…). Así `mas.js` no cambia.
- **Éxito solo si, tras reconectar, la TV dice una versión MAYOR que la de antes** e igual a la publicada (un `0x83`
  bien no basta: si la versión nueva se cae, vuelve a la vieja sin avisar). Si vuelve con la vieja: "La TV se reinició
  sin terminar la actualización…" (texto de la Pro, con Pepito).
- El tiempo máximo de espera de la Pro (4 min) alcanza: bajar ~5 s + enviar ~60 s + reiniciar y reconectar ~10 s.
- Con una TV Lite se ve Sistema pero **sin Restablecer** (sigue oculto).
- Sin internet: no se puede saber si hay versión nueva; Sistema dice el error de lectura de siempre.
- La app Lite aparte (`app-lite/`) no recibe esto (la reemplaza la app Pepito).

## 8. Textos (PROPUESTAS)

Los de la pantalla Sistema de la Pro valen (ya dicen Pepito en la app Pepito). Solo cambian los que no tienen sentido
con una Lite:

| # | Cuándo | Texto de la Pro | Propuesta para la Lite |
|---|---|---|---|
| 46 | Mientras se manda | Actualizando… no desconectes la TV. | Actualizando… 45 %. No cierres la app y deja el celular cerca de tu Pepito. |
| 47 | La TV no responde | La TV no respondió. Tiene que estar encendida y con internet. | Pepito no respondió. Tiene que estar encendido y cerca del celular. |
| 48 | En la pantalla de la TV | — | Actualizando (y una barra de avance) |

## 9. Pruebas

- **Simuladas:** la TV simulada (`app-lite/pruebas/tv-simulada.js`) aprende el bit 5, el ESTADO largo y la firma (con
  claves de prueba); suite nueva en `app-unificada/pruebas/` (actualizar bien, ya al día, firma mala, corte a mitad,
  vuelve con la versión vieja, sin internet) y las de siempre (`correr-pruebas-pro.mjs`, `app-lite/pruebas/todo.sh`).
- **En la placa S3** (hay que volver a grabarle la Lite por cable: reemplaza a la Pro v9): actualizar 1 → 2; cortar a
  mitad (alejar el celular o cerrar la app); firma mala; versión vieja; una versión de prueba que se cae (debe volver
  sola); apagar antes de reconectar (debe volver a la anterior). Después, en la C3 real cuando llegue.

## 10. Orden de trabajo

1. El dueño aprueba este plan. Se escribe la especificación (sección 8 de `evaluacion-version-lite.md`,
   `formatos-datos.md`, `CLAUDE.md`) y la propuesta de reglas con su copia de vuelta atrás. El dueño publica las reglas.
2. TV simulada + app (lógica y, aparte, lo visual) + suite nueva.
3. Firmware Lite: `FIRMWARE_BUILD 1`, `verifyRollbackLater`, recepción del bit 5, ESTADO largo, pantalla de avance.
   Compilar para C3 y S3. Comprobar que las copias exactas de la Pro sigan iguales (`comprobar-copias-lite.cjs`).
4. `publicar-firmware.cjs --lite`.
5. Con la placa: grabar la Lite por cable (con permiso del dueño) y las pruebas de la sección 9.

## 11. Preguntas para el dueño

1. ¿Te parece bien cuándo se da por buena una versión nueva (sección 5: al reconectarse el celular; si se cae o nadie
   se conecta en 10 minutos, vuelve sola a la anterior)?
2. ¿Apruebas las rutas `firmware/lite/c3/…` y `firmware/lite/s3/…` (sección 6)?
3. ¿Apruebas los cambios del protocolo Bluetooth de la sección 4 (todos juntos)?
4. Textos 46, 47 y 48 (sección 8).
5. La clave de servicio de Firebase: ¿la borras ya o la guardas hasta probar la actualización de la Lite (para
   publicar las versiones de prueba)?

## 12. Respuestas del dueño (2026-11-23)

1. Lo decide Claude: queda la propuesta de la sección 5 (se da por buena con la primera escritura del celular después
   del arranque; si se cae, o nadie escribe en 10 minutos, vuelve sola a la anterior).
2. **Sí**: rutas `firmware/lite/c3/…` y `firmware/lite/s3/…`.
3. **Sí**: todos los cambios del protocolo de la sección 4. Ya están en la especificación (sección 8.5 de
   `evaluacion-version-lite.md`).
4. El dueño pide **barra de avance en la pantalla de la TV en las dos (Lite y Pro)**: "más entretenido y
   visualmente mejor". En la Pro va con la v10. Textos 46 y 47: por confirmar.
5. La clave de servicio se **guarda** para publicar las versiones de prueba de la Lite.
