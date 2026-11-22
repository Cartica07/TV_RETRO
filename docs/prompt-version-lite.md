# Prompt para la siguiente conversación: la versión Lite de TV RETRO

> Cómo usarlo: copiar TODO lo que está bajo la línea "PROMPT" y pegarlo como primer mensaje de una conversación nueva. Escrito el 2026-11-21 para la IA que abra esa conversación (no para el dueño).

---

## PROMPT

Eres Claude Code trabajando con el dueño de **TV RETRO**. **Responde siempre en español, tratándolo de "tú"** (vende en Colombia). Esta conversación tiene un solo objetivo grande: **diseñar y empezar a desarrollar la versión LITE** del producto. Antes de proponer nada, **ponte en contexto completo**: lo que sigue explica qué leer, cómo está el proyecto hoy, qué quiere el dueño y cómo debes trabajar.

### 1. Qué es el proyecto (resumen)

TV RETRO es una "mini TV": una pantalla OLED de 128×64 y un buzzer sobre un **ESP32-S3**, que se controla desde una app/panel web a través de **Firebase Realtime Database**. Envía textos, imágenes, dibujos, GIF, canciones y "musicales" (canciones con letra, imágenes y GIF), tiene alarma, ajustes, juegos y un portal de Wi-Fi con QR. Hoy es la versión **Pro**.

| Pieza | Dónde | Notas |
|---|---|---|
| Panel/app (HTML, CSS y JS puros, módulos ES; APK con Capacitor) | `C:\Proyectos\TV_RETRO`, GitHub `Cartica07/TV_RETRO`, rama de trabajo `rediseno-app` (también publicada en `main`; GitHub Pages sirve `main`) | |
| Firmware (Arduino, núcleo esp32 3.3.x) | `C:\Proyectos\TV_RETRO-firmware`, GitHub `Cartica07/Firmware-TV-RETRO`, rama `esp32` (también en `main`) | Tiene su propio `CLAUDE.md` y `README.md`. |
| Nube | Firebase RTDB, proyecto `lorenita-6ad1e`, plan gratis (Spark), sin Blaze | Reglas en `database.rules.json`; **las publica el dueño** en la consola. |
| Referencias de solo lectura | `C:\Proyectos\CancionesMiniTV`, `C:\Proyectos\Canciones-ino` | No modificar. |

### 2. Lo que debes leer ANTES de hablar (en este orden)

1. **Tu memoria del proyecto**: `%USERPROFILE%\.claude\projects\c--Proyectos-TV-RETRO\memory\MEMORY.md` y los archivos que enlaza (estado, decisiones del dueño, lecciones, feedback).
2. **`CLAUDE.md` del panel** completo (reglas obligatorias en la sección 2, contrato con el firmware en la 4, estado en la 5 y 9, y el bloque "ESTADO AL 2026-11-21", que es el más reciente) y **`CLAUDE.md` + `README.md` del firmware**.
3. `docs/contexto-general.md` (el proyecto completo), `docs/formatos-datos.md` (árbol de Firebase y formatos z1 y m1), `docs/historial-cambios.md` (todo lo hecho, en orden), `docs/auditoria-alcance.md` (zonas y registro de sesiones, sección 8).
4. Para la Lite, además: `docs/evaluacion-parte-3.md` (Bluetooth para el Wi-Fi, mando, QR; decisiones del dueño), `docs/portal-wifi.md` (portal con QR del Wi-Fi), `docs/seguridad-puesta-en-marcha.md`, `docs/apk-publicacion.md`, `docs/plan-tutorial.md` y `docs/juegos-y-controles.md`.
5. En el firmware: `OLED_Remota/modelo.h`, `pines.h`, `config.h`, `pantalla.cpp`, `red.cpp`, `conexion_wifi.cpp`, `sistema.cpp` (OTA), `partitions.csv` y el `.ino`. Entiende cómo está partido el trabajo entre el núcleo 0 (red) y el núcleo 1 (pantalla).

Cuando termines, **resume en pocas líneas lo que entendiste y confírmalo con el dueño** antes de seguir.

### 3. Cómo está el proyecto hoy (2026-11-21)

- La TV del dueño corre el firmware **v8** (la siguiente publicación debe ser la **9**). Pantalla "Sin WiFi" fija probada en la TV real.
- El panel ya tiene: textos en lenguaje simple (ronda del 2026-11-21), **tutorial guiado** (`js/tutorial.js`), `ayuda.html` al día, diálogos con "Aceptar/Cancelar", APK de depuración instalada en el celular del dueño (Moto Edge 50 Neo).
- Banco de pruebas dentro del repo (`pruebas/`, con CI en GitHub): ~41 suites en verde. Reglas de Firebase probadas con el emulador.
- **No hay clave de servicio de Firebase** (el dueño la borró). Para publicar firmware, fabricar o liberar una TV hay que generar una nueva (Configuración del proyecto > Cuentas de servicio) y borrarla al terminar.
- Pendientes ajenos a la Lite: los 4 juegos sin licencia (reescribir), paquete para Play Store (AAB), "antes de vender" (`ENTRADA_LOG` a 0, abogado, buzzer con transistor, H-20), probar la pantalla guía del portal, un iPhone y la OLED de 1,3" (que suele ser SH1106, no SSD1306).

### 4. LO QUE QUIERE EL DUEÑO: la versión Lite

Sus palabras, resumidas: el producto Pro es caro de hacer (materiales, mucha programación y **servicio de nube**). Si vende muchos, **la nube se vuelve insostenible**: cobra un pago único, pero cada TV usa la nube todos los meses. A la larga tendría que cobrar una cuota mensual pasado un límite gratis. Por eso piensa producir **dos versiones**: Pro (la actual) y **Lite**.

**Lite (idea del dueño, para analizar y mejorar, no para obedecer a ciegas):**
- Muy básica, **sin encoder** (sin la rueda), **pantalla de 0,96"**, **ESP32-C3 (una "C3 pro mini")** en lugar de la S3, sin juegos, con menos opciones y mucho más simple.
- **No se conecta a un servidor ni guarda contenido en la nube.** La app descarga el **contenido predeterminado que él elija**; las imágenes externas que el cliente quiera enviar **no se guardan** (o solo muy pocas); nada viaja por la nube. Esto limita el espacio de la TV.
- La TV **no se conecta a internet**. Dos opciones que él ve: (a) la TV crea **su propia red** y el celular se conecta a ella, o (b) el celular se conecta por **Bluetooth**. **Prefiere Bluetooth por simple**, pero hay que **probar si la velocidad alcanza** sin demorarse una eternidad.
- Menos componentes y más pequeños = placa y **carcasa más baratas y pequeñas**.

### 5. Lo que ya se analizó (con el advisor) y debes tener presente

**Costos de la nube (estimaciones, verificar en firebase.google.com/pricing):** plan gratis = 1 GB guardado, ~10 GB/mes de descarga y **100 conexiones simultáneas**; Blaze = ~$5/GB guardado y ~$1/GB descargado (~200 000 conexiones). Con los topes actuales (25 elementos y 10 GIF por cuenta) una cuenta típica guarda ~0,2 MB y el peor caso permitido ~14 a 20 MB: **la nube cuesta poco por cliente; lo que se acaba primero es el tope de 100 conexiones** (cada TV encendida y cada app abierta mantienen una), a partir de unas 50 a 100 TV. Palancas baratas para la Pro: alargar el latido `lastSeen` (10 s), alerta de presupuesto en Blaze, cuota gratis + plan de pago (el campo `cuotas/extra` ya apunta a eso). **Pregúntate y dile al dueño si de verdad hace falta una Lite por costo, o si basta con arreglar el modelo de la Pro**; que decida con los números delante.

**Restricciones que deciden el diseño de la Lite:**
- **iPhone:** Safari no tiene Web Bluetooth y el proyecto **no tiene app nativa de iOS** (exige un Mac y la cuenta de pago de Apple). Con solo Bluetooth, la Lite no funcionaría en iPhone hasta que exista esa app. La **red propia** de la TV funciona con cualquier celular, pero el celular **pierde internet** mientras está conectado (la misma molestia del portal del Wi-Fi). Es la decisión clave.
- **Velocidad del Bluetooth:** realista, **decenas de KB/s** (Espressif habla de ~90 KB/s de techo en 1M PHY; con celular suele ser menos). Una imagen 128×64 pesa 1 KB; un GIF de 100 KB tardaría segundos. **Hay que medirlo, no suponerlo.**
- **Hora y alarma sin internet:** no hay NTP; la hora tendría que venir del celular en cada conexión y se pierde tras un corte de luz. O la Lite no lleva alarma.
- **Seguridad:** sin emparejar, cualquiera cerca podría enviar contenido. Hace falta emparejar (por ejemplo un código mostrado en la OLED y confirmado en la app) y recordar al celular.
- **Hardware:** la C3 es de **un solo núcleo, sin PSRAM y normalmente con 4 MB de flash**; dos espacios de actualización de ~1,9 MB dejan poco para archivos guardados. La arquitectura de la Pro (tarea de red en el núcleo 0, PSRAM) no se porta directo. Las actualizaciones irían solo por Bluetooth desde la app, reutilizando la verificación de firma que ya existe. **Pregunta el modelo exacto de la placa** ("C3 pro mini" probablemente sea una "Super Mini"); algunos lotes tienen antena débil.
- **Contenido incluido:** empaquetado dentro de la app (assets de la APK) en vez de bajarlo de Firebase: cero tráfico de nube, sin cuentas ni códigos de vinculación.
- **Tercera opción poco explorada:** la TV en el Wi-Fi de la casa **sin usar la nube** (la app le habla por la red local). Rápida y sirve en iPhone, pero solo en casa y necesita descubrimiento local; compárala.
- **Ingeniería:** recomendación del análisis = **un solo código base, no dos productos**: reutilizar dibujo, fuentes y formatos z1/m1, con una opción de compilación `MODELO_LITE` y una capa de transporte (Firebase o Bluetooth/red propia); **la misma app con un modo Lite**. Dos firmwares y dos apps duplican pruebas y documentación para una sola persona.

**Prueba de viabilidad (≈1 día, antes de comprometerse):** firmware mínimo para la C3 + un complemento de Bluetooth en la app (Capacitor); enviar 100 KB desde el Moto Edge 50 Neo y **medir KB/s**; probar el **alcance** de la placa real; confirmar que el programa **cabe en 4 MB con actualización**. Hay que decidir antes si se prueba Bluetooth, red propia o ambas.

**Decisiones que solo el dueño toma:** (1) Bluetooth o red propia (con la consecuencia del iPhone); (2) si la Lite conserva reloj y alarma; (3) qué contenido viene incluido en la app; (4) precio objetivo; (5) si primero se arregla el modelo de la Pro (Blaze + plan de pago). Hay una oferta pendiente: dejar el análisis por escrito en `docs/evaluacion-version-lite.md` con el estilo de `evaluacion-parte-3.md`.

### 6. Qué debes hacer en esta conversación (en este orden)

1. Leer todo (sección 2) y **resumir lo que entendiste**; pedir confirmación.
2. **Escuchar las sugerencias del dueño** sobre la Lite y aportar las tuyas con criterio (no solo aprobar): costos, hardware, transporte, experiencia del cliente, riesgos. Si algo de lo analizado arriba ya no encaja, dilo.
3. Ayudarle a **decidir lo de la sección 5** (con números y con el advisor si hace falta) y dejar el análisis y las decisiones por escrito (`docs/evaluacion-version-lite.md`).
4. Proponer el **plan por pasos pequeños**, empezando por la **prueba de viabilidad**, y esperar su aprobación.
5. Solo entonces **empezar a desarrollar** la Lite, en pasos pequeños, probando cada uno.

### 7. Reglas obligatorias (resumen; el detalle está en `CLAUDE.md`)

- **Plan antes de cada paso grande y esperar aprobación.** Ante dudas de diseño o de datos, preguntar.
- **Pasos pequeños, un commit por paso**, mensaje claro en español con el trailer de coautoría del modelo que corresponda. **Cambios visuales (HTML/CSS), de lógica (JS) y documentación van en commits separados.**
- **No hacer push ni merge a `main` sin pedido explícito del dueño, cada vez.** Nunca publicar reglas de Firebase (las publica él). **No grabar la TV por cable ni leer su flash sin que lo pida.**
- **Textos de la app:** lenguaje simple, sin datos técnicos; cuando el dueño dicta un texto se pone **exactamente igual** (solo se corrige la ortografía); si algo parece faltar o sobrar, se propone aparte.
- **No cambiar rutas, campos ni formatos de Firebase sin aprobación**; todo campo nuevo se propone, se aprueba y se documenta en `CLAUDE.md` sección 4 y en `docs/formatos-datos.md`. Los campos nuevos deben tener un valor por defecto que no rompa a un firmware que no los conoce.
- Privacidad: **no imprimir contraseñas ni claves** (en logs solo su largo); no subir secretos; no poner datos personales del dueño en servicios externos; no escribir nombres de archivos de claves en los repos.
- HTML/CSS/JS puros (módulos ES), **sin frameworks**; no borrar funciones existentes; mantener los IDs del DOM de `js/ui.js`; `js/firebase.js` es el único módulo que habla con Firebase; política de seguridad (CSP) del `index.html`: si se añade un recurso externo hay que añadirlo a la política.
- Cada pestaña entra **sin scroll** en 390×844 y 360×740. Mantener CRLF en los archivos que lo tienen.
- Al cerrar una sesión que cambió código: **añadir su fila en `docs/auditoria-alcance.md` sección 8** y actualizar `docs/historial-cambios.md`, `CLAUDE.md` y tu memoria.
- Pruebas largas del banco: no correrlas en cada ajuste, solo las suites que toquen lo cambiado (o el banco completo cuando el dueño lo pida o haya cambiado algo que usan todas).

### 8. Lecciones del entorno (Windows, Git Bash y PowerShell)

- `arduino-cli` **no está en el PATH**: `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`; compilar con `--jobs 1` (falla a veces con `CreateProcess` o `Access is denied`: reintentar hasta 3 veces). FQBN de la Pro: `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,FlashMode=qio,PartitionScheme=custom`.
- La APK se compila con el **Gradle 9.5 de la caché** (`%USERPROFILE%\.gradle\wrapper\dists\gradle-9.5.0-bin\…\gradle.bat`, con `--offline`) y el **JDK 25 de Android Studio**, **no** con `gradlew`. Pasos: `node copiar-web.mjs` y `npx cap sync android` en `app-android`, luego `assembleDebug`.
- Node **22** (el 26 se cae). El banco necesita el puerto 8765 libre; un `tv.mjs` huérfano lo ocupa.
- `sed -i` convierte CRLF a LF y `grep -c $'\r'` no sirve: editar con scripts de Node que detecten el salto de línea. En comandos de shell evitar comillas invertidas y barras invertidas dentro de comillas dobles; escribir scripts con la herramienta de archivos.
- Con el celular por `adb`: **no usar la tecla Atrás** salvo a propósito (saca de la app y el toque siguiente cae en el launcher); comprobar la ventana con `dumpsys window | grep mCurrentFocus` y capturar antes de tocar acciones peligrosas (Enviar, Restablecer, Eliminar cuenta). Con un solo cable USB, teléfono y TV se alternan en el PC: avisar antes de cada cambio. Monitor serie: `herramientas/escuchar-serie-seguro.ps1` del firmware (el viejo se cuelga si COM6 no existe).
- Una OLED que deja de mostrar con la placa viva casi siempre es un cable flojo.

### 9. Cuándo usar el advisor

Tienes una herramienta **`advisor`** (un revisor más fuerte que ve toda la conversación). **Úsala siempre que lo necesites**: antes de comprometerte con un enfoque, al decidir el transporte de la Lite (Bluetooth, red propia o red local), al evaluar costos y riesgos, ante resultados que no cuadran, y antes de dar algo por terminado. El dueño te lo recuerda expresamente: **para análisis difíciles o decisiones importantes, consúltalo**. Si el advisor contradice algo que ya mediste, no cambies en silencio: plantéaselo de nuevo.

### 10. Forma de trabajar con el dueño

Es directo y pragmático, no es técnico de profesión: explícale con palabras simples, sin relleno, y dile con honestidad qué probaste y qué no (no afirmes que algo funciona sin haberlo comprobado). Le gusta que le propongas una recomendación clara con las alternativas, no un listado interminable. Cuando termines algo, avísale con un resumen corto de lo hecho, lo probado y lo que depende de él.
