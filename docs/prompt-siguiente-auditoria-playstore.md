# Prompt para la siguiente conversación: auditoría completa, Play Store y lo que queda

> Cómo usarlo: copiar TODO lo que está bajo la línea "PROMPT" y pegarlo como primer mensaje de una conversación nueva.
> Escrito el 2026-11-25 (noche), al cerrar la conversación de "apagado 1/2 min, sin clima, legal, aceptación, ícono y Pro 13 / Lite 6".

---

## PROMPT

Eres Claude Code trabajando con el dueño de **Pepito** (antes "TV RETRO"; persona natural en Armenia, Quindío, Colombia; **no es
programador**). **Responde siempre en español, tratándolo de "tú"**, en palabras simples y sin datos técnicos innecesarios.
Antes de proponer o tocar nada, **ponte en contexto completo** con lo que sigue. Cuando termines de leer, **resume en pocas
líneas lo que entendiste (dónde quedó cada cosa y qué falta) y pregúntale por dónde quiere empezar** (auditoría, Play Store
u otra cosa de la lista del punto 4). No cambies ni propongas textos visibles antes de que él lo pida.

### 1. Qué es el proyecto hoy

- **Pepito Pro** (antes TV RETRO): pantalla OLED 128×64 + buzzer en un ESP32-S3, por Wi-Fi y Firebase. Firmware `OLED_Remota/`.
  Incluye los **dúos** (dos Pro pegadas hacen una animación juntas; ESP-NOW).
- **Pepito Lite**: ESP32-C3 sin nube, todo por Bluetooth LE con el celular (solo Android). Firmware `OLED_Lite/`. Sin dúos.
  El dueño todavía **no tiene la C3**: la ha probado en una S3. Cuando llegue hay que probar los pines provisorios.
- **App unificada "Pepito"** (`app-unificada/`, paquete `com.pepito.app`): una sola app que maneja las dos. Se arma desde una
  **COPIA** de la app vieja con `construir.mjs` (parches con `cambiar(...)`, tablas de textos, CSS solo en `src/unificada.css`).
  **La app vieja TV RETRO (raíz `js/`, `css/`, `index.html`, `pruebas/`, `app-android/`) NO se toca** salvo arreglos que el
  dueño apruebe; la web de GitHub Pages es el canal de iPhone y tampoco se toca.
- Repos: panel `C:\Proyectos\TV_RETRO` y firmware `C:\Proyectos\TV_RETRO-firmware`, **los dos en la rama `lite`**. Todo lo de
  `lite` está subido a GitHub (a pedido del dueño). **`main` NO se ha tocado y no se toca sin que él diga expresamente "haz el
  merge a main"** (explicación que ya se le dio: GitHub Pages publica lo que hay en `main`; un merge lleva ~350 archivos
  nuevos; si `Cartica07/TV_RETRO` es un repositorio PÚBLICO, el código quedaría visible y él NO quiere publicarlo: preguntarle
  si es público o privado y, si es público, proponer una rama `gh-pages` solo con las páginas legales).

### 2. Qué leer ANTES de hablar (en este orden)

1. Tu memoria: `%USERPROFILE%\.claude\projects\c--Proyectos-TV-RETRO\memory\MEMORY.md` y lo que enlaza, sobre todo
   `ota-lite-plan` (estado vigente), `publicacion-pro12-lite5-2026-11-25`, `pendientes-legales-2026-11-25`,
   `codigo-privado-y-pantalla-sh1106`, `feedback-textos-exactos`, `feedback-no-grabar-placa-sin-pedido`,
   `feedback-cambios-en-pro-y-lite`, `app-unificada-decisiones`, `entorno-portatil-ram`, `cuentas-del-dueno`,
   `web-es-para-iphone`, `auditoria-final-alcance`.
2. `CLAUDE.md` del panel completo: reglas (sección 2), contrato con el firmware (sección 4, con los campos nuevos del
   2026-11-25: `apagado` 0/1/2/5/10/20, clima QUITADO y `usuarios/{uid}/aceptacion`), el bloque **"VERSIONES PUBLICADAS
   (2026-11-25, noche)"** y las secciones 10 y 11. Luego `CLAUDE.md` y `README.md` del firmware (compilar, grabar, publicar).
3. `docs/historial-cambios.md`: las secciones del 2026-11-25, sobre todo **"Lote del 2026-11-25 (tarde)"** y
   **"Cierre del 2026-11-25 (noche)"** (trae la lista numerada de lo que falta).
4. **`docs/auditoria-alcance.md` ENTERO** (zonas A, B y C; la sección 8 es el registro de lo que no está auditado: todo lo
   hecho desde el 2026-11-15) y `docs/revision-legal-2026-11-25.md`.
5. `docs/guia-play-store.txt` (los pasos de Play, quién hace qué), `docs/guia-c3-pines-bateria-y-grabar.txt` (pines de la C3,
   divisor de batería, cómo grabarla), `docs/bateria-divisor.md`, `docs/apk-publicacion.md` y
   `PANTALLA-1.3-SH1106.md` (raíz del repo del firmware).
6. Código que más se va a tocar: `app-unificada/construir.mjs`, `src/backend-unificado.js` (enrutador; ahora también
   `escucharSesion` con la aceptación de términos), `src/aceptacion.js`, `src/caras.js`, `src/lite-tv.js`,
   `src/unificada.css`, `database.rules.json`; en el firmware `OLED_Remota/OLED_Remota.ino`, `ajustes.cpp`, `github.cpp`,
   `OLED_Lite/ajustes_lite.cpp`, `ble_lite.cpp`, `pines_lite.h`.

### 3. Dónde quedó todo (2026-11-25, noche)

- **Publicado por OTA:** Pepito Pro **13** (`firmware/estable` = 13; quedan la 12 y la 13) y Pepito Lite **6** para la C3
  (`firmware/lite/c3/estable` = 6). La siguiente publicación debe ser **Pro 14 / Lite 7**. Las **reglas de Firebase** del
  2026-11-25 las publicó el dueño (copia de vuelta atrás: `database.rules.sin-apagado-1-2.json`). Orden obligatorio al
  cambiar contrato: **reglas → firmware → app**.
- **Hecho hoy:** apagado de pantalla con 1 y 2 minutos (app, Lite, Pro y reglas); **clima/Open-Meteo quitado por completo**
  (uso solo no comercial): app, reglas, Pro, editor de caras; el elemento Clima de una receta vieja se lee pero no dibuja;
  tildes en las pantallas de la TV; datos legales completos en `pepito/*.html` (dirección, teléfono +57 310 646 3781,
  vigente desde el 25 de noviembre de 2026) y **el código de Pepito NO se publica** (decisión del dueño); página
  `pepito/eliminar-cuenta.html`; **pantalla de aceptación de términos** (campo `usuarios/{uid}/aceptacion`; textos 68-71 por
  aprobar); nota de la alarma de la Pro en tres renglones con guion; **ícono propio** y **pantalla de carga propia**; el bucle
  de la Pro cede 1 ms por vuelta (`delay(1)`, ahorro de batería, SIN probar en la placa); nota muy visible sobre la
  pantalla de 1,3" (posible SH1106); guías `guia-c3-...txt` y `guia-play-store.txt`.
- **APK** (con ícono, pantalla de carga, aceptación y nota de alarma) instalada en el celular del dueño (id adb
  `ZY22KKQ4N6`); copia en `C:\Proyectos\TV_RETRO-compilados\2026-11-25b\`.
- **Pruebas** al cierre: 21 suites de `app-unificada/pruebas` en verde; las originales de la Pro dan lo de siempre (solo
  `baja-cuenta` falla, igual contra la Pro sin tocar). **No se han corrido pruebas de firmware en placa** de lo de hoy.

### 4. Qué falta, en orden (el dueño decide el orden)

1. **AUDITORÍA COMPLETA del sistema** (la que él dejó pendiente "para después de todo lo demás"): leer `docs/auditoria-alcance.md`
   y auditar todo lo hecho desde el 2026-11-15 (zona C). Mirar con lupa lo de hoy: el parche a la copia de
   `normalizarAjustes`/`firebase-pro.js` en `construir.mjs` (apagado y ciudad), las reglas nuevas (`aceptacion` con
   `newData.val() === now`, `ajustes` sin `ciudad`, apagado 0/1/2/5/10/20) contra el emulador de Firebase, el envoltorio de
   `escucharSesion` (que la aceptación no bloquee el arranque sin internet ni se repita), el `delay(1)` del bucle de la Pro,
   que no queden referencias al clima, la pantalla de carga de Android 12+ y los tamaños del ícono.
2. **Play Store:** seguir `docs/guia-play-store.txt`. Lo primero técnico (tuyo): la app unificada NO tiene firma de
   publicación (versión 1 / "1.0"): conectar `tvretro-subida.jks` (alias `tvretro`), poner `versionCode`/`versionName`,
   generar el **AAB** (`gradlew bundleRelease`) y verificarlo; luego ícono 512, gráfico 1024×500 y capturas (con adb), textos de
   la ficha y respuestas de los formularios; después de la primera subida, **pasar las huellas SHA-1/SHA-256 de Play App
   Signing a Firebase** (si no, "Entrar con Google" falla en la app instalada desde Play). Las páginas legales solo estarán en
   línea cuando haya `main` o `gh-pages`: decidir con él (ver el punto 1 sobre público/privado).
3. **Probar en la placa la Pro 13** (botón A, perilla, juegos y reloj igual que antes) y, **cuando llegue la C3**, probar los
   pines provisorios (SDA 4, SCL 5, buzzer 6 con transistor, botón 7, batería 3) y el divisor (100 k/100 k en la C3).
4. **Que apruebe los textos de la aceptación** (`docs/lite-textos-propuestos.md`, filas 68 a 71).
5. **Lo que le toca a él y hay que recordarle:** borrar la clave de servicio de Firebase (`C:\Proyectos\TV_RETRO-claves\`,
   nunca imprimirla ni borrar `ota-*.pem`), borrar la cara "Clima" de la nube (`relojes/clima`; el sistema bloqueó mi borrado
   en producción), hacer copia de `tvretro-subida.jks`, `keystore.properties` y las `.pem` fuera de este PC.
6. **Página web de Pepito para iPhone** (gh-pages; aprobada, pendiente) y revisar si la OLED de 1,3" es SH1106.
7. **Lo legal con abogado:** canciones con letra de obras comerciales, tipografías GNU FreeFont (GPL con excepción),
   4 juegos sin licencia (H-01/H-44), imágenes de la biblioteca, homologación CRC, condiciones de venta; que confirme que la
   cláusula de licencias sin repositorio público basta (LGPL/GPL).
8. Menores: Wi-Fi con ahorro de energía en la Pro (`WiFi.setSleep(false)`; puede afectar los dúos; decidir con batería y
   medición), segunda S3 y prueba de carga de los dúos, `ENTRADA_LOG` a 0 antes de vender, buzzer con transistor en las TV
   que se fabriquen, la carpeta `Juegos/` del firmware sin versionar (preguntarle si la guarda).

### 5. Reglas del dueño (resumen; el detalle está en `CLAUDE.md`, sección 2)

- Responder en español, con "tú" (nunca voseo). Antes de un paso grande: explicar el plan y esperar aprobación, salvo que él
  delegue ("te delego", "te autorizo"); aun así, las decisiones nuevas se cuentan al final.
- **Textos dictados por el dueño: EXACTAMENTE como los dicta (solo se corrige la ortografía)**; los nuevos son propuestas.
  Nada técnico visible para el cliente (sin KB, "OLED", ids ni números de versión).
- **Un commit por paso**, mensaje claro en español, con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (o el modelo
  que corresponda). Visual (HTML/CSS) y lógica (JS) separados; documentación en commits propios. CRLF/LF: respetar el de cada
  archivo (los archivos mezclan formatos: editar con herramientas que no los cambien).
- **Push solo cuando él lo pide y nunca a `main` sin "haz el merge a main"**. **No grabar placas por cable** sin que lo pida
  para ese caso; nunca grabar un `merged.bin` en una placa con datos. Pepito Pro y Lite van parejos en lo común.
- Pruebas largas solo cuando él confirme que la versión es la final. Cada pestaña de la app debe entrar **sin scroll** a
  390×844 y 360×740 (su celular es pequeño). No tocar la app vieja ni la web de GitHub Pages. Campos nuevos de Firebase: se
  proponen, él aprueba y se documentan en `CLAUDE.md` (sección 4) y `docs/formatos-datos.md`. Las reglas las publica él.
- Nunca imprimir contraseñas de Wi-Fi ni el contenido de la clave de servicio; no subir secretos.
- **Al cerrar una sesión que cambió código:** fila nueva en `docs/auditoria-alcance.md` (sección 8) y entrada en
  `docs/historial-cambios.md`; actualizar `CLAUDE.md` y la memoria.

### 6. Cómo trabaja él (para entenderlo bien)

- Escribe rápido y con errores de tipeo; interpreta la intención. Decide con frases cortas ("dale", "hazlo", "lo haré yo",
  "ya publiqué las reglas"). Suele mandar varias cosas en un mensaje: contesta cada punto numerado.
- Prueba en un celular Android real conectado por cable (`adb`); la TV Pro la actualiza por OTA desde la app (Más >
  Configuración > Sistema) y la Lite por Bluetooth. Cuando dice "ya conecté el celular" se puede instalar la APK.
- Le gusta que cada respuesta final diga: qué se hizo, qué le toca a él, qué falta.

### 7. Entorno y trucos (lecciones de esta sesión)

- Windows, shell Git Bash y PowerShell. **Scripts con barras invertidas o comillas invertidas: escribirlos con la herramienta
  de archivos (Write/Edit), nunca dentro de `node -e` ni de comillas dobles del shell**. Para editar texto con exactitud, un
  pequeño auxiliar de Node que reemplaza un texto que aparezca exactamente una vez y conserva CRLF/LF.
- **Compilar firmware:** `arduino-cli` en `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`;
  `--jobs 1` (el portátil tiene RAM defectuosa). Pro: `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom`;
  Lite C3: `esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashSize=4M`. Desde cero la Pro tarda ~30 min; incremental ~10 min. Lanzarlo en segundo
  plano. **Antes de publicar, `node herramientas/publicar-firmware.cjs --bin <.bin> --build N [--lite c3] --seco`** (firma en seco);
  publicar con `--clave-servicio <json>` solo si el dueño lo pide. Comprobar copias Pro/Lite: `node herramientas/comprobar-copias-lite.cjs`.
- **APK:** `node construir.mjs --apk` en `app-unificada`, `npx cap sync android`, y Gradle 9.5 de la caché con el JDK de Android
  Studio (`--offline --no-daemon --max-workers=1 -Xmx1024m`, `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`); instalar con
  `adb -s ZY22KKQ4N6 install -r app-debug.apk`. Comprobar el contenido con `unzip -p app-debug.apk assets/public/...`.
- **Pruebas de la app:** `node construir.mjs` y luego, en `app-unificada/pruebas`, `node <suite>.mjs` (Node 22; 21 suites; las
  originales de la Pro con `node pruebas/correr-pruebas-pro.mjs`, ~10+ min: correrlas en segundo plano). El banco da por
  aceptados los términos y el tutorial salvo que la prueba lo pida (`conAceptacion`, `conTutorial`).
- **El clasificador de seguridad bloquea borrar datos de producción** (se bloqueó borrar la cara "Clima"): no intentar rodearlo;
  explicárselo al dueño y que él lo haga o lo autorice para ese caso concreto.
- La carpeta temporal de la sesión se pierde: lo que debe durar va al repo, a `C:\Proyectos\TV_RETRO-compilados\` o a la memoria.
