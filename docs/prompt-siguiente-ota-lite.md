# Prompt para la siguiente conversación: Pro v9, actualización por Bluetooth de Pepito Lite y caras de reloj

> Cómo usarlo: copiar TODO lo que está bajo la línea "PROMPT" y pegarlo como primer mensaje de una conversación nueva.
> Escrito el 2026-11-23, al cerrar la conversación de la app unificada "Pepito", para la IA que abra la siguiente
> (no para el dueño).

---

## PROMPT

Eres Claude Code trabajando con el dueño de **Pepito** (antes "TV RETRO"). **Responde siempre en español, tratándolo de
"tú"** (vende en Colombia; no es programador: explica en palabras simples, sin datos técnicos innecesarios). Antes de
proponer nada, **ponte en contexto completo** con lo que sigue. Cuando termines de leer, resume en pocas líneas lo que
entendiste y el plan del punto 4, y espera su visto bueno antes del primer paso grande.

### 1. Qué es el proyecto hoy

- **Pepito Pro** (antes TV RETRO): OLED 128×64 + buzzer en un ESP32-S3, por Wi-Fi y Firebase. Firmware `OLED_Remota/`.
- **Pepito Lite**: ESP32-C3 sin nube y sin cuentas, todo por Bluetooth LE con el celular (solo Android). Firmware
  `OLED_Lite/`. El dueño la prueba en su única placa S3 (todavía no tiene la C3).
- **App unificada "Pepito"** (`app-unificada/`, paquete `com.pepito.app`): una sola app con cuenta que maneja los dos;
  se arma desde una COPIA de la app vieja con `construir.mjs`. **La app vieja TV RETRO (raíz `js/`, `css/`,
  `index.html`, `pruebas/`, `app-android/`) NO se toca.**
- Repos: panel `C:\Proyectos\TV_RETRO` y firmware `C:\Proyectos\TV_RETRO-firmware`, **los dos en la rama `lite`**
  (subidas a GitHub el 2026-11-23; sin merge a `main`).

### 2. Qué leer ANTES de hablar (en este orden)

1. Tu memoria: `%USERPROFILE%\.claude\projects\c--Proyectos-TV-RETRO\memory\MEMORY.md` y lo que enlaza (sobre todo
   `app-unificada-decisiones`, `feedback-cambios-en-pro-y-lite`, `feedback-textos-exactos`,
   `feedback-no-grabar-placa-sin-pedido`, `caras-de-reloj-pendiente` y `ota-lite-plan`).
2. `CLAUDE.md` del panel completo: reglas (sección 2), contrato (sección 4), el bloque **"ESTADO AL 2026-11-23"** de la
   sección 9 (el más reciente) y las secciones 10 (Lite) y 11 (app unificada). Luego `CLAUDE.md` y `README.md` del
   firmware (cómo publicar firmware y probar una actualización).
3. `docs/app-unificada.md`, `docs/evaluacion-version-lite.md` (sobre todo la sección 8: **protocolo Bluetooth**),
   `docs/lite-lista-de-prueba-en-placa.md` (5b y 5c), `docs/plan-caras-de-reloj.md`, `docs/nombre-pepito.md`,
   `docs/lite-textos-propuestos.md`, las últimas entradas de `docs/historial-cambios.md` y la sección 8 de
   `docs/auditoria-alcance.md`.
4. Código clave: en el firmware `OLED_Remota/sistema.cpp` + `sistema.h` (la OTA de la Pro: firma RSA, rollback),
   `herramientas/publicar-firmware.cjs`, `OLED_Lite/ble_lite.cpp` (comandos y envíos grandes), `OLED_Lite/OLED_Lite.ino`;
   en el panel `app-lite/src/ble.js` (lo comparten la Lite y la unificada), `app-unificada/src/lite-tv.js`,
   `app-unificada/src/backend-unificado.js`, `app-unificada/construir.mjs`, `app-lite/pruebas/tv-simulada.js`,
   `js/mas.js` (Config > Sistema de la Pro) y `database.rules.json`.

### 3. Dónde quedó todo (2026-11-23)

- **Apagado automático de la pantalla** (Más > Config > Ajustes > "Apagar pantalla": 5, 10, 20 min o Nunca; viene en 5):
  hecho en app, Lite y Pro; reglas publicadas por el dueño. **Probado en la placa con la Lite: todo bien**, incluido el
  arreglo de la canción con letra (al terminar vuelve el contenido de antes y sigue el apagado; firmware `22c9de8`
  Lite y `60b74c1` Pro). **Faltaban solo dos pruebas: que se apague a los 10 min y que con "Nunca" no se apague.
  Pregúntale al dueño cómo salieron.**
- **Pepito Pro v9** (apagado automático, nombre Pepito en la TV y en el portal, red Wi-Fi "Pepito", arreglo del
  musical): **compilada y commiteada, sin grabar ni publicar.** La TV Pro del dueño corre la v8.
- **Clave de servicio de Firebase:** el dueño generó una el 2026-11-23 en
  `C:\Proyectos\TV_RETRO-claves\<el .json de la cuenta de servicio>`. Úsala SOLO para publicar la v9
  (y, si el dueño lo autoriza, la OTA de la Lite). Nunca imprimas su contenido. Al terminar, el dueño la borra de
  Firebase y del disco.
- **Páginas `pepito/`** (ayuda, privacidad, términos, licencias): están en `main`, pero los cambios del 2026-11-23 en
  la rama `lite` (ayuda: red "Pepito", textos del botón y "¿Por qué se apaga la pantalla?") **todavía no**. Súbelos a
  `main` solo cuando la v9 esté publicada (hasta entonces la TV del dueño crea la red "TV RETRO") y el dueño lo pida.
- APK de depuración con todo instalada en el celular del dueño.

### 4. Qué sigue, en este orden (aprobado por el dueño)

**Paso 0. Cerrar el apagado y la Pro v9.**
1. Confirma con el dueño las pruebas de 10 min y "Nunca" de la Lite.
2. Con su permiso, graba la **Pro v9 por cable en la misma placa S3** (esa placa se queda como Pro). El dueño
   configura el Wi-Fi en la red "Pepito" y la vincula a su cuenta. Prueba con él: apagado (5/10/Nunca), musical que
   termina, alarma, sobre en el reloj.
3. Publica la v9 por Wi-Fi (`firmware/estable` = 9) con `publicar-firmware.cjs` y la clave. **La siguiente
   publicación debe ser la 10.**
4. El dueño borra la clave. Después, si lo pide, sube `pepito/` a `main`.
   (Ojo: al grabar la Pro se borra la Lite de la placa. Para trabajar en la OTA de la Lite habrá que volver a grabarle
   la Lite: pregúntale al dueño cuándo.)

**Paso 1. Actualización por Bluetooth de Pepito Lite (OTA).** Decidido por el dueño el 2026-11-23: **la app baja el
programa nuevo de Firebase** (no va dentro de la app) y se lo pasa a la TV por Bluetooth. **Tiene que estar hecha
antes de vender el primer Lite**: es lo único que no se puede añadir después. Lo que ya se analizó:
- **Espacio:** la Lite usa la tabla de particiones por defecto (dos espacios de programa de 1,25 MB + LittleFS); el
  programa ocupa ~917 KB en la C3. Comprobar la tabla real de la S3 y de la C3 antes de empezar.
- **Firmware:** copiar de la Pro la verificación (`sistema.cpp`: RSA-2048 sobre `build|tamano|sha256`, dos claves
  públicas, mbedtls) y la escritura con `esp_ota_*`; exigir `build` mayor que el propio; rollback con
  `esp_ota_mark_app_valid_cancel_rollback` / `esp_ota_mark_app_invalid_rollback_and_reboot` como la Pro. Falta decidir
  cuándo se da por buena una versión en la Lite (la Pro lo hace al conectarse a Firebase; en la Lite, por ejemplo,
  cuando el celular se reconecta y escribe la HORA, o tras un tiempo sin caerse): proponlo. Añadir `FIRMWARE_BUILD`
  a la Lite (hoy no tiene número de versión; empezar en 1).
- **Bluetooth (borrador, se aprueba antes):** el bit 4 de las banderas del INICIO ya está reservado para las caras de
  reloj; para el programa usar el **bit 5**, que escribe directo en el otro espacio de programa (no en LittleFS). Antes
  del INICIO, un comando nuevo con `build`, `tamano`, `sha256` y `firma` (256 bytes; partirlo si no cabe en una
  escritura). La respuesta de ESTADO (`0x04`) debe decir el `build` (alargarla al final: la app tolera el largo viejo).
  Al FIN la TV verifica, responde y reinicia; la app se reconecta y comprueba la versión. **Regla: primero se cambia
  la especificación (sección 8 de `evaluacion-version-lite.md`), después la app, la TV simulada y el firmware.**
- **Firebase (propuesta, necesita aprobación y que el dueño publique las reglas):** `firmware/lite/estable` =
  `{ build, tamano, sha256, firma }` y `firmware/lite/datos/{build}` = el .bin en Base64. Los lee **cualquier cuenta
  con sesión** (a diferencia de la Pro, aquí lo baja la app, no la TV); los escribe un administrador. Las mismas
  claves de firma de la Pro (`C:\Proyectos\TV_RETRO-claves\ota-principal.pem` y `ota-respaldo.pem`); adaptar
  `publicar-firmware.cjs` con una opción para la Lite. Copia de vuelta atrás de las reglas antes de cambiarlas.
- **App:** hoy la unificada oculta Config > Sistema con una TV Lite (`unificada.css`). Mostrar "Actualizar" cuando
  `build` de la TV < `firmware/lite/estable.build`, con avance, "no cierres la app y deja el celular cerca", y el
  resultado. Textos nuevos = propuestas al dueño (en `lite-textos-propuestos.md`).
- **Pruebas:** TV simulada (`app-lite/pruebas/tv-simulada.js`) y una suite nueva; en la placa: actualizar 1 → 2, cortar
  a mitad, firma mala, versión vieja, rollback.

**Paso 2. Cerrar la lista de elementos de las caras de reloj** (pregunta 8 de `docs/plan-caras-de-reloj.md`): con la
OTA de la Lite hecha, la lista ya puede crecer después; repásala con el dueño.

**Paso 3. Caras de reloj**, según `docs/plan-caras-de-reloj.md` (respuestas del dueño en su sección 10: la app copia
la cara a cada TV; sin segundos; vista previa grande + lista sin scroll; al enviar la TV muestra el reloj; crear caras
solo el dueño; aprobados `relojes/indice`, `relojes/datos`, `dispositivos/{id}/reloj`, el bit 4 y el comando `0x24`;
nombre "Caras de reloj" y aviso "Actualiza tu Pepito para cambiar la cara del reloj."). Las caras llegan a la Pro como
**v10**.

**Después (no ahora):** reescribir los 4 juegos sin licencia, Play Store (AAB), abogado, placa C3 real.

### 5. Cómo trabajar (reglas del dueño, obligatorias)

- Antes de cada paso grande: explica el plan y espera aprobación. Pasos pequeños, **un commit por paso**, en español,
  con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Separar visual (HTML/CSS), lógica (JS) y
  documentación en commits distintos.
- **No push ni merge a `main` sin que el dueño lo pida en ese momento.**
- **No grabar la placa sin su permiso para ese caso** (compilar sí).
- **Pepito Pro y Pepito Lite:** todo cambio en pantallas comunes de la app va en los dos sin preguntar.
- **La app vieja TV RETRO no se toca:** los cambios de la unificada van por la copia (`construir.mjs`). Después de
  tocarla: `git status js css index.html pruebas app-android` vacío, `node app-unificada/pruebas/correr-pruebas-pro.mjs`
  igual que la Pro y, si se toca `app-lite/src/ble.js`, `bash app-lite/pruebas/todo.sh` en verde.
- Textos: los que dicta el dueño van exactos (solo ortografía); los nuevos son propuestas. Nada técnico en pantalla.
- **Campos nuevos de Firebase o del protocolo Bluetooth:** proponer, esperar aprobación, documentar
  (`formatos-datos.md`, CLAUDE.md sección 4, spec de la Lite). Las reglas las publica el dueño.
- Respetar CRLF/LF de cada archivo (editar con scripts de Node, no `sed -i`). Al cerrar una sesión con código: fila en
  `docs/auditoria-alcance.md` sección 8 y entrada en `historial-cambios.md`.
- El equipo tiene poca memoria virtual: no correr compilaciones ni pruebas pesadas a la vez; Gradle con
  `-Dorg.gradle.jvmargs=-Xmx768m`. Si Bash falla con "fork", usar PowerShell.
- Pruebas largas solo cuando el dueño confirma que la versión es la final.

### 6. Herramientas (rutas que funcionan en este equipo)

- `arduino-cli`: `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`, con
  `--jobs 1`, `--output-dir` en una carpeta temporal y reintentos (falla a veces con `CreateProcess` o memoria).
  FQBN: Lite en S3 `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=disabled,FlashMode=qio`; Lite C3 `esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashSize=4M`;
  Pro `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom`. Puerto COM6 (abrirlo
  reinicia la TV). Monitor serie: `herramientas/escuchar-serie-seguro.ps1` del firmware.
- APK de la unificada: pasos exactos en `docs/app-unificada.md` (`node construir.mjs --apk`,
  `herramientas/copiar-android-base.mjs`, `npx cap sync android` y Gradle `assembleDebug`); Gradle 9.5 de la caché con
  el JDK de Android Studio y `-Dorg.gradle.jvmargs=-Xmx768m`; `adb` en
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
- Pruebas de la unificada: `app-unificada/pruebas/` (teclado, sin-internet, sin-cuenta, pepito, buscar-canciones,
  atras, apagado) y `correr-pruebas-pro.mjs`. Necesitan Node 22.

### 7. Primer mensaje al dueño

Saluda, dile en 4 o 5 líneas lo que entendiste (dónde quedó cada cosa y el orden de los pasos 0 a 3) y pregúntale:
(1) cómo salieron las pruebas de 10 min y "Nunca"; (2) si te autoriza a grabar la Pro v9 en la placa ya.
