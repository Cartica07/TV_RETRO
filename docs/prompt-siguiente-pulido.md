# Prompt para la siguiente conversación: pulido (textos, interfaz, optimizaciones), auditoría completa y cierre legal

> Cómo usarlo: copiar TODO lo que está bajo la línea "PROMPT" y pegarlo como primer mensaje de una conversación nueva.
> Escrito el 2026-11-25, al cerrar la conversación de los dúos.

---

## PROMPT

Eres Claude Code trabajando con el dueño de **Pepito** (antes "TV RETRO"). **Responde siempre en español, tratándolo de
"tú"** (vende en Colombia; no es programador: explica en palabras simples, sin datos técnicos innecesarios). Antes de
proponer nada, **ponte en contexto completo** con lo que sigue. Cuando termines de leer, resume en pocas líneas lo que
entendiste (dónde quedó cada cosa y el plan del punto 4) y **pregúntale cómo quiere proceder con los textos: él te lo va
a explicar. No cambies ni propongas ningún texto antes de que lo haga.**

### 1. Qué es el proyecto hoy

- **Pepito Pro** (antes TV RETRO): OLED 128×64 + buzzer en un ESP32-S3, por Wi-Fi y Firebase. Firmware `OLED_Remota/`.
  **Los dúos son parte de la Pro desde el 2026-11-25** (ver punto 3): dos Pepito Pro pegadas hacen una animación entre
  las dos.
- **Pepito Lite**: ESP32-C3 sin nube, todo por Bluetooth LE con el celular (solo Android). Firmware `OLED_Lite/`. **No
  tiene dúos** (decisión del dueño). El dueño la prueba en su única placa S3 (todavía no tiene la C3).
- **App unificada "Pepito"** (`app-unificada/`, paquete `com.pepito.app`): una sola app con cuenta que maneja los dos; se
  arma desde una COPIA de la app vieja con `construir.mjs`. **La app vieja TV RETRO (raíz `js/`, `css/`, `index.html`,
  `pruebas/`, `app-android/`) solo se toca con arreglos que el dueño aprueba** (la web de GitHub Pages es el canal de
  iPhone de Pepito Pro: no se retira ni se toca).
- Repos: panel `C:\Proyectos\TV_RETRO` y firmware `C:\Proyectos\TV_RETRO-firmware`, **los dos en la rama `lite`**. El
  2026-11-25, a pedido del dueño, se subió `lite` de los dos repos a GitHub. **`main` no se tocó** (sin merge hasta que
  el dueño lo pida; lo único que está en `main` de lo nuevo es `pepito/privacidad.html`).

### 2. Qué leer ANTES de hablar (en este orden)

1. Tu memoria: `%USERPROFILE%\.claude\projects\c--Proyectos-TV-RETRO\memory\MEMORY.md` y lo que enlaza (sobre todo
   `duos-plan`, `ota-lite-plan`, `app-unificada-decisiones`, `feedback-textos-exactos`,
   `feedback-no-grabar-placa-sin-pedido`, `feedback-cambios-en-pro-y-lite`, `entorno-portatil-ram`,
   `web-es-para-iphone` y `auditoria-final-alcance`).
2. `CLAUDE.md` del panel completo: reglas (sección 2), contrato con el firmware (sección 4), el bloque **"ESTADO AL
   2026-11-25"** de la sección 9 (el más reciente) y las secciones 10 (Lite) y 11 (app unificada). Luego `CLAUDE.md` y
   `README.md` del firmware (cómo compilar, grabar, publicar una versión y probar una actualización).
3. `docs/plan-duos.md` (entero: decisiones, mediciones, pruebas en la placa y la sección 9 "Qué falta"),
   `docs/protocolo-duos.md`, `docs/lite-textos-propuestos.md` (**el inventario de textos, filas 1 a 67**),
   `docs/app-unificada.md`, `docs/formatos-datos.md` (secciones de `duos/`, `relojes/` y ajustes),
   `docs/analisis-fallos-2026-11-24.md`, `docs/nombre-pepito.md`, las últimas entradas de `docs/historial-cambios.md` y
   **`docs/auditoria-alcance.md` entero** (la sección 8 es el registro de lo que hay que auditar).
4. Código que vas a tocar con más probabilidad: `app-unificada/construir.mjs` (todos los parches sobre la copia),
   `app-unificada/src/textos-pepito.mjs` (la tabla que cambia los textos "TV" por "Pepito"), `src/duos.js`, `src/caras.js`,
   `src/backend-unificado.js`, `src/unificada.css`; en el firmware `OLED_Remota/duos.cpp`, `OLED_Remota.ino`,
   `Duos_Prueba/Duos_Prueba.ino`.

### 3. Dónde quedó todo (2026-11-25)

- **Decisión del dueño (2026-11-25): ya no habrá funciones nuevas.** Lo que queda es pulir, auditar y cerrar lo legal
  (punto 4).
- **Dúos (solo Pepito Pro), HECHOS y probados** con la S3 del dueño y la ESP8266 de la primera TV (que solo sirve de
  banco de pruebas; su botón D1 hace de imán):
  - Radio ESP-NOW entre las dos TV (`docs/protocolo-duos.md`; sensor Hall en GPIO 11 de la S3; regla de cercanía de
    -58 dBm; la TV de la izquierda, la del sensor, decide). Medido: del contacto al arranque ~165 ms.
  - **Prioridades probadas** (canción, GIF, reloj, partida, pantalla dormida, alarma, botón A, contenido que llega a
    mitad): 31 dúos seguidos sin fallos. Dos TV pegadas al encender NO hacen el dúo hasta separarlas y juntarlas.
  - **Qué dúo suena (decidido el 2026-11-25):** el favorito de la izquierda si la derecha lo tiene; si no, el favorito
    de la derecha si la izquierda lo tiene; si no, el primero en común. Para eso el AQUI lleva el favorito de la
    derecha: **protocolo versión 2** (compilado y commiteado, **SIN grabar ni probar en la placa**).
  - **Estado de las placas:** la S3 (COM6) y la ESP8266 (COM3) corren el **protocolo 1**. Para probar el 2 hay que
    grabar **las dos a la vez** (una con 1 y otra con 2 no se entienden), con permiso del dueño. La S3 lleva una
    versión de prueba que dice ser la 11; no está publicada.
  - **`TVRETRO_DUOS` viene en 1 por defecto** (`OLED_Remota/duos_config.h`): todas las versiones nuevas de la Pro llevan
    los dúos.
  - **Catálogo de la nube y ajustes (aprobados; reglas PUBLICADAS por el dueño):** `duos/indice|datos/<clave>` y
    `dispositivos/{id}/ajustes.duos` / `.duoFavorito` (`docs/formatos-datos.md`). La Pro baja sola el catálogo (hasta
    10 dúos, sin estorbar el contenido, con 1,5 MB libres de margen).
  - **Editor de dúos** (`app-unificada/herramientas/editor-duos/`, se abre en `/editor-duos.html`; solo administrador):
    arma dúos con GIF y sonido, "Probar en mi Pepito", y **sube y borra del catálogo**.
  - **App Más > Dúos** (solo Pro; con una Lite el botón no aparece): "Activar dúos" y "Tu favorito" (el favorito arriba
    en un marco azul, una estrella que se rellena; solo la estrella elige). Textos 61 a 67 aprobados. APK de
    depuración con todo **instalada en el celular del dueño**.
  - La app vieja TV RETRO ya no borra `duos` ni `duoFavorito` al guardar el brillo (arreglo aprobado, `3714510`).
- **Pepito Pro v11 PUBLICADA** (`firmware/estable` = 11). **La siguiente publicación debe ser la 12** (llevará los
  dúos). **Pepito Lite versión 4** (con caras de reloj): compilada, probada en la placa S3, **sin publicar** (en la nube
  está la 3, sin caras) y sin probar en la C3 real.
- **Clave de servicio de Firebase:** existe en `C:\Proyectos\TV_RETRO-claves\` (el `.json` de la cuenta de servicio;
  autorizada para publicar firmware, fabricar o liberar una TV). Nunca imprimas su contenido ni su nombre en los repos.
  Nunca borres los `ota-*.pem`. El dueño la borra de Firebase y del disco cuando ya no haga falta.
- **El mensaje predeterminado** "Bienvenido / Soy Pepito" (Sans, tamaño 3, igual que la app) está en Pro y Lite pero
  **sin probar en una TV con el contenido vacío**.

### 4. El plan que dijo el dueño (en este orden)

1. **Textos** (primero). El dueño te explicará cómo procederán. Reglas fijas: lo que él dicta va EXACTO (solo se corrige
   la ortografía); lo nuevo es una propuesta que él aprueba; lenguaje simple, "tú" (nunca voseo), sin datos técnicos
   ni explicaciones largas en pantalla. El inventario está en `docs/lite-textos-propuestos.md`. Los textos de la app
   Pepito se cambian por la tabla `src/textos-pepito.mjs` y los parches de `construir.mjs` (no editando la app vieja);
   los de la TV están en `OLED_Remota/*.cpp` y `OLED_Lite/*.cpp` (la fuente no tiene tildes ni ñ en la OLED); las
   páginas `pepito/*.html` son otra superficie de texto.
2. **Interfaz, apariencia y tamaños** (por pantalla; las pestañas deben seguir entrando SIN scroll en 390×844 y 360×740).
3. **Optimizaciones.**
4. **Auditoría completa del sistema.** Lee `docs/auditoria-alcance.md` entero: lo hecho desde el 2026-11-15 (Lite, OTA de
   la Lite, app unificada, caras de reloj, clima, dúos, apagado automático...) **no está auditado** y su sección 8 dice
   exactamente qué mirar. Proponle al dueño cómo hacerla (por zonas, con el banco de pruebas) antes de empezar.
5. **Lo legal:** revisión de un abogado de los términos y la política de privacidad (borradores en `pepito/`), licencias,
   y los 4 juegos sin licencia (abajo).

### 5. Otros pendientes (no son funciones nuevas; el dueño decide cuándo)

- **Reescribir los 4 juegos sin licencia** (Snake, Breakout, Flappy e Invaders derivan de un repo sin licencia; Jump es
  Unlicense): es lo más grande de código que queda antes de vender (`docs/juegos-y-controles.md`).
- **Grabar el protocolo 2 de los dúos en las dos placas y probarlo** (con permiso para cada grabación).
- **Publicar la Pro 12** (con dúos): antes, dejar en el firmware solo los mensajes importantes del registro serie de los
  dúos (hoy escribe una línea por cada mensaje de radio que recibe: es de diagnóstico) y pedir/generar la clave si hace
  falta. Después instalarla en la TV del dueño por Wi-Fi.
- **Publicar la Lite 4** (probarla antes en la C3 real) en `firmware/lite/<modelo>`.
- **Publicar la web de Pepito para iPhone** (aprobado, diferido): rama `gh-pages` y cambiar la fuente de Pages, sin
  tocar la web vieja de `main`. Detalle en `docs/analisis-fallos-2026-11-24.md` y la memoria `web-es-para-iphone`.
- **La segunda S3** (llega en unos días): grabarle la misma versión, fabricarla (clave de servicio temporal) y vincularla.
  Comprobar entre dos Pro: los mensajes DIRECTOS (con la ESP8266 una S3 conectada a un router los descarta; ella manda
  todo por difusión), la señal dentro de las carcasas (el umbral de -58 dBm queda justo: -53 a -56 con la S3 a la
  derecha) y un dúo del catálogo de verdad.
- **Prueba de carga de los dúos** que quedó pendiente: ESP-NOW escuchando mientras baja un GIF muy grande, durante una
  actualización por Wi-Fi y con la cara Clima (memoria interna mínima vista: 78 KB).
- **Play Store:** registrar `com.pepito.app` en Firebase (con la huella SHA-1 para Google), respaldar el keystore y armar
  el AAB firmado (`docs/apk-publicacion.md`; el dueño pidió que no se deje pasar).
- **Antes de vender:** `ENTRADA_LOG` a 0, buzzer detrás del transistor, cifrado de la flash (H-20) al fabricar en
  serie, correos de Firebase (caen en spam), alerta de presupuesto si pasa a Blaze, OLED de 1,3" (revisar si es SH1106),
  decidir batería y anuncios (siguen "para el final").
- **Sin probar todavía:** un iPhone, la pantalla guía "Conectado!" del portal Wi-Fi y la OLED de 1,3".

### 6. Cosas a tener en cuenta (anotadas durante los dúos)

- El nombre "Dúos" es **provisional** (el dueño elegirá el definitivo; está en los textos 61 a 67 y en la app).
- Los dúos son solo de la Pro; con una Lite todo lo de dúos se oculta, no se borra.
- Un dúo son dos grabaciones m1 (una por TV) con la misma duración; hasta 100 KB por mitad (reglas), 10 en cada TV.
- El sonido del dúo suena solo en la TV de la izquierda; más adelante podría empezar en la derecha (decisión futura).
- Dos Pepito Pro con routers distintos (canales distintos) todavía no se encuentran (solo el mismo canal).
- El editor no tiene filas de 3 o más Pepito (el dueño las dejó para más adelante).
- El mensaje de error visible ("Algo salió mal. Vuelve a intentarlo.") y todo lo técnico va a la consola, no a pantalla.
- Cuando algo "no funciona en la placa", mira primero el monitor serie de AMBAS placas: con un solo cable se ve media
  historia (los tres fallos de los dúos se encontraron así).

### 7. Cómo trabajar (reglas del dueño, obligatorias)

- Antes de cada paso grande: explica el plan y espera aprobación. Pasos pequeños, **un commit por paso**, en español,
  terminado con el trailer de atribución que indique el sistema. Separa lo visual (HTML/CSS), la lógica (JS) y la
  documentación en commits distintos.
- **No hagas push ni merge a `main` sin que el dueño lo pida en ese momento** (un permiso anterior no vale). **No grabes
  una placa sin su permiso para ese caso** (compilar sí).
- **Pepito Pro y Pepito Lite van parejos** en todo lo común (app y firmware); solo lo exclusivo (juegos, dúos) va en uno.
- Campos nuevos de Firebase o del protocolo: proponer, esperar aprobación y documentar; las reglas las publica el dueño.
  (Como ya no habrá funciones nuevas, esto casi no debería pasar.)
- Respeta CRLF/LF de cada archivo (los archivos mezclan; comprueba con un script de Node, no con `grep -c`).
- Al cerrar una sesión con código: fila en `docs/auditoria-alcance.md` sección 8 y entrada en `docs/historial-cambios.md`.
- **Pruebas largas (el banco completo) solo cuando el dueño confirme que la versión es la final.**
- No muestres contraseñas de Wi-Fi ni el contenido de la clave de servicio. Nada técnico (versión del firmware, números,
  ids) a la vista del cliente.

### 8. Herramientas y lecciones de este equipo (rutas que funcionan)

- **Memoria del equipo:** tiene poca memoria y una RAM defectuosa: compila con `--jobs 1`, no corras cosas pesadas a la
  vez y commitea seguido. Si el portátil se reinicia, revisa `git status` y `git fsck` de los dos repos.
- **`arduino-cli`:** `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`.
  - Pro: `--fqbn esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom` con
    `--export-binaries`. **Grabar con `arduino-cli upload -p COM6 --fqbn … --input-dir <carpeta>`** donde la carpeta tiene
    SOLO `OLED_Remota.ino.bin`, `.bootloader.bin` y `.partitions.bin` copiados del `build/`. **NUNCA el `merged.bin` de
    16 MB**: borraría las redes Wi-Fi, la cuenta de la TV, las alarmas y la cara del reloj.
  - ESP8266 de pruebas: `esp8266:esp8266:nodemcuv2` con su propio `--build-path` (si no, pisa la compilación de la S3).
  - Antes de grabar cierra los monitores serie (procesos `escuchar-serie…`): el puerto queda ocupado. Monitor:
    `herramientas/escuchar-serie-seguro.ps1` del firmware (`-Puerto COM6 -Minutos N`).
- **APK de la unificada** (pasos en `docs/app-unificada.md`): `node construir.mjs --apk`, `npx cap sync android` y Gradle.
  **Gradle desde PowerShell**, no desde Bash, y con poca memoria (con el demonio normal Java se quedó sin memoria y se
  cayó): `JAVA_HOME` = el JDK de Android Studio (`jbr`), `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, y
  `gradle.bat assembleDebug --offline -q --no-daemon --max-workers=1 "-Dorg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=384m"`
  (Gradle 9.5 de la caché en `%USERPROFILE%\.gradle\wrapper\dists\gradle-9.5.0-bin\…`). Instalar con
  `adb install -r`. Con el celular por adb no uses la tecla Atrás.
- **Pruebas:** Node 22 (el 26 se cae). `app-unificada/pruebas/` (`duos.mjs` 18, `editor-duos.mjs` 37, `duo.mjs`,
  `caras.mjs` 25, …), `correr-pruebas-pro.mjs` (prueba que la Pro no cambió), `pruebas/reglas-duos.mjs` (29, en el banco),
  `pruebas/config.mjs` (14). El banco completo: `bash pruebas/todo-el-banco.sh` (proceso aparte; ~40 min).
- **Escribir archivos y scripts:** en Bash, `node -e` y los heredocs **pierden las barras invertidas** (un `\n` dentro de
  un texto se vuelve un salto de línea real y rompe el código). Escribe los scripts con la herramienta de archivos
  (`Write`, que exige haber leído antes un archivo que ya existe) o edita con `Edit`. Y `sed -i` convierte CRLF en LF.
  En `String.replace` de JavaScript, `$$` se vuelve `$`: usa una función como reemplazo.
- Los archivos `hs_err_pid*.log` y `replay_pid*.log` son caídas de Java: no se versionan.

### 9. Primer mensaje al dueño

Saluda, dile en 4 o 5 líneas lo que entendiste (dúos terminados, protocolo 2 sin grabar, el plan de textos →
interfaz → optimizaciones → auditoría → legal, y los pendientes del punto 5) y pregúntale **cómo quiere proceder con
los textos**. Mientras no te lo explique, solo lee y resume.
