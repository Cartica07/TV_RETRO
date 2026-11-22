# Portal de configuración del Wi-Fi de la TV (QR, páginas propias y pantallas guía)

> Hecho el 2026-11-20 y **probado en la TV real** (firmware versión 7, publicada por Wi-Fi). Es solo firmware y páginas de la TV: **no cambia ningún dato de Firebase, ninguna regla ni el panel/la APK.**
> Archivos: `C:\Proyectos\TV_RETRO-firmware\portal\` (la página), `OLED_Remota\conexion_wifi.cpp` (la lógica de la TV), `OLED_Remota\portal_pagina.h` (página generada) y `OLED_Remota\qrcodegen.c/.h` (generador de QR).
> Evaluación de alternativas (Bluetooth, mando, anuncios…): [evaluacion-parte-3.md](evaluacion-parte-3.md).

## 1. Qué problema resuelve

La primera vez, la TV no tiene Wi-Fi y no puede hablar con Firebase. Para dárselo, abre una red propia ("TV RETRO") con una página de configuración. El flujo original era largo y tenía partes en inglés:

1. Mirar en la OLED el nombre de la red y una clave de 8 caracteres.
2. Ir a los ajustes de Wi-Fi del celular, buscar "TV RETRO" y escribir esa clave.
3. Esperar a que el celular abra el portal (casi nunca lo abre solo).
4. Pulsar "Configure WiFi", elegir la red de casa y escribir su clave, todo en la plantilla en inglés de la librería WiFiManager.
5. Volver a la app y escribir el código de 6 letras de la TV.

El objetivo del dueño es que la primera configuración sea **lo más fácil posible para el cliente**. Se evaluaron varias alternativas (sección 8 y `evaluacion-parte-3.md`) y se hizo lo siguiente.

## 2. Cómo es ahora (flujo del cliente y qué ve en la OLED)

| Paso | El cliente | La OLED de la TV |
|---|---|---|
| 1 | Enciende la TV (primera vez, o mantiene 5 s el botón de la rueda sin Wi-Fi) | Un QR a la izquierda y, a la derecha, "Escanea el QR o une: TV RETRO, Clave: xxxxxxxx" |
| 2 | Apunta la cámara del celular al QR: el celular se une a "TV RETRO" con un toque (sin ir a Ajustes ni escribir la clave) | Cada 4 s el QR cambia de polaridad (ver 3.2) |
| 3 | Android avisa con una notificación de inicio de sesión en la red; la toca y se abre la página | **Guía:** "Conectado! Toca el aviso que salió en tu celular para abrir TV RETRO" (tras 30 s se añade "O abre 192.168.4.1") |
| 4 | En la página elige su red de la lista (candado y barras de señal) y escribe la clave (con ojo para verla) | — |
| 5 | Pulsa Conectar | "Conectando a tu WiFi: nombre de la red" |
| 6a | Clave bien: la TV se conecta, la página dice que mire la TV | "WiFi OK" y, más tarde, el código de 6 letras para vincular |
| 6b | Clave mal: la página dice "No se pudo conectar" y por qué | "Error: la clave parece incorrecta…" (10 s) y vuelve al QR |
| 7 | Vuelve a la app y escribe el código de 6 letras | — |

**Android no abre la página solo** en el celular del dueño (Moto Edge 50 Neo): solo muestra la notificación, y al tocarla se abre. Es una regla de Android y del fabricante (depende de cómo se unió a la red) y la TV no puede forzarla. Por eso existe la pantalla guía.

## 3. Cómo está hecho

### 3.1 La página (`portal/`)
- `index.html` + `estilo.css`: el aspecto, con los colores y el estilo de la app (`css/tokens.css`), copiados porque **la red de la TV no tiene internet**: fuentes del sistema, íconos en SVG, nada se pide fuera.
- `portal.js`: la lógica (lista de redes, hoja de la clave, enviar, esperar el resultado). ES5/`fetch`, sin dependencias.
- `demo.js`: SOLO para ver la maqueta en el navegador con datos de ejemplo (`index.html?vista=lista|clave|otra|conectando|ok|error`). No va a la TV.
- `herramientas/generar-portal.cjs` (en el repo del firmware) junta los tres en un solo archivo y lo guarda como texto en `OLED_Remota/portal_pagina.h` (~22 KB). **Ese archivo es generado: no se edita a mano; se cambia `portal/` y se vuelve a generar.**
- Respaldo sin JavaScript: un `<noscript>` con un formulario simple que envía a `/wifisave`.
- Detalles que importan para que funcione: el campo de la clave lleva `autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"` (si no, el teclado pone mayúscula y la clave falla); la clave exige 8 caracteres como mínimo; los nombres de red (ajenos) se muestran **solo con `textContent`**, nunca como HTML.

### 3.2 El QR (`conexion_wifi.cpp`, `qrcodegen.c`)
- Contenido: `WIFI:T:WPA;S:TV RETRO;P:<clave>;;` (formato estándar que reconocen las cámaras de Android e iPhone). La clave es la misma de siempre: aleatoria (8 caracteres, 31 símbolos sin los que se confunden), solo se ve en la OLED y **nunca se imprime por el puerto serie** (solo su largo).
- Generador: **qrcodegen de Nayuki, versión C 1.8.0, MIT, sin modificar** (sin memoria dinámica). Su licencia está en la cabecera de los archivos y en `licencias.html` del panel.
- Tamaño: el texto se parte en segmentos (alfanumérico donde se puede, bytes para la clave con minúsculas) para que quepa justo en la **versión 2 (25×25 módulos, 2 px por módulo = 50 px)** en vez de la 3 (29×29). Se comprobó en software con 500 claves al azar: todas dan versión 2 y se decodifican bien. Si algún día no cupiera, se prueba como texto simple (versión 3) y, si tampoco, se muestra la pantalla de siempre con la clave escrita.
- **Polaridad alterna cada 4 s** (módulos encendidos sobre fondo oscuro ↔ módulos oscuros sobre fondo encendido): algunas cámaras (en especial la del iPhone, que **no se pudo probar**) solo leen una de las dos. En el Moto se leyeron las dos; la de fondo oscuro, más rápido.

### 3.3 Las rutas del portal
WiFiManager sigue haciendo lo delicado (recibir `/wifisave`, probar la conexión y guardar). Las páginas propias se registran **desde el callback del servidor, antes de que la librería registre las suyas** (gana la primera ruta registrada).

| Ruta | Qué hace |
|---|---|
| `/` | La página. Si piden otro nombre de dominio (las pruebas de portal cautivo de Android, iOS y Windows) redirige (302) a `http://192.168.4.1/` |
| `/redes` | La lista de redes ya buscada, en JSON (`listo`, y por red `s` nombre, `r` señal, `a` abierta). Con `?nueva=1` busca otra vez **sin bloquear** el servidor |
| `/estado` | Cómo va el intento: `libre`, `ok` o `error` con `motivo` (`clave`, `red`, `otro`) |
| `/wifisave` | La atiende WiFiManager (recibe `s` = nombre y `p` = clave, prueba la conexión y guarda) |
| `/update`, `/u`, `/erase`, `/info`, `/restart`, `/exit`, `/close`, `/status` | **Cerradas** (404) |
| `/wifi`, `/0wifi`, `/param`, `/paramsave` | Llevan al inicio (páginas de la librería que ya no se usan) |

Todas las respuestas JSON llevan `Cache-Control: no-store`.

### 3.4 Por qué el resultado "seguro" lo da la OLED y no la página
Se leyó el código de WiFiManager (`processConfigPortal`, `connectWifi`): mientras la TV **intenta conectarse (hasta ~2 s de espera + 20 s) su servidor web no atiende nada**, y al conectarse como cliente la radio cambia al canal del router, así que el celular puede perder la red "TV RETRO". Por eso:
- La **pantalla de la TV** muestra "Conectando…" y el resultado (clave incorrecta / no encontré la red / no se pudo conectar). Si pasan 26 s sin que `/estado` lo marque, se da por fallido.
- La **página** lo pregunta a `/estado` con calma; si pierde la red (cuando salió bien, la TV apaga su red y el celular se va), **no inventa un resultado**: dice "Mira la pantalla de tu TV: si dice «WiFi OK», ya quedó conectada".
- `/estado` solo se atiende cuando la librería **ya terminó** de intentar (su servidor está bloqueado mientras conecta): con conexión = `ok`, sin ella = `error`.

Motivos de desconexión que se distinguen (códigos del Wi-Fi): `15`, `204`, `202`, `2` = la clave no sirvió; `201` = no encontró la red; cualquier otro = genérico.

### 3.5 Detalles de comportamiento
- **Las redes se buscan antes de abrir el portal** (tarda ~3–4 s, con el QR ya en pantalla): nadie está conectado todavía y la lista sale al instante. "Buscar de nuevo" busca sin bloquear (`WiFi.scanNetworks(true)`). Se quitan nombres vacíos, la propia red "TV RETRO" y los repetidos (queda la más fuerte), ordenadas de más a menos señal (máximo 30).
- **El portal no vence mientras haya un celular conectado** (`setAPClientCheck(true)`) y el límite subió de 180 a **300 s** (antes, un cliente lento podía ver reiniciarse la TV a mitad de la clave; con el reinicio cambian la clave y el QR).
- Si ya existía una red con ese nombre en `/redes.json`, **se actualiza su clave en vez de duplicarla**. Una red solo se guarda cuando la conexión funciona.
- La tarea que dibuja la pantalla (`tareaQr`, núcleo 1, pila de 6144 bytes) es la **única** que toca la OLED mientras el portal está abierto (la librería bloquea el hilo principal), así que no hay choques en el bus I2C.

## 4. Seguridad

- **Hallazgo propio (2026-11-20):** WiFiManager 2.0.17 registra de fábrica `/update` y `/u`, que instalan un `.bin` **sin firma**, saltándose la verificación RSA de las actualizaciones (H-19); y su menú por defecto muestra el botón "Update". Quien estuviera en la red "TV RETRO" (la clave se ve en la OLED o en el QR) podía instalar cualquier firmware. **Cerrado**: ver rutas en 3.3.
- El menú de la librería quedó solo con "Wi-Fi" (`setMenu`), por si alguna ruta suya se llegara a abrir.
- La clave de la red "TV RETRO" y la del Wi-Fi del cliente nunca se imprimen: solo su largo. El nombre de la red sí aparece en el registro serie (ya aparecía antes).
- Riesgo restante, aceptado: con acceso físico a la TV se puede leer la flash (H-20, cifrado de flash, para la fabricación en serie).
- **Fuera de este cambio:** no se activó la opción 114 de DHCP (RFC 8910, `WiFi.AP.enableDhcpCaptivePortal()`, disponible en el núcleo 3.3.10): exige una API HTTPS con JSON y probablemente no cambie nada; si la guía no bastara se prueba aparte, para no mezclar variables.

## 5. Resultados de las pruebas reales (2026-11-20)

**Firmware v5** (descarga de la actualización por Wi-Fi, 4 → 5): `bajados 1546512 de 1546512 bytes en 45169 ms`, arranque en `app0`, versión dada por buena a los ~35 s. El QR salió (`version 2, 25 x 25 modulos`) y **se leyó con el Moto Edge 50 Neo en todas las variantes** (mejor y más rápido el de fondo oscuro, incluso en la OLED de 0,96").

**Firmware v7** (portal completo con páginas propias; TV sin Wi-Fi a propósito apagando el router):
- Rueda mantenida 5 s → reinicio → `QR del portal listo` → `portal: 11 red(es) encontradas` → portal abierto.
- Clave **incorrecta** (otra red, `FLIA-MARIN`): `Connect to new AP Failed`, `no conecto (motivo 15)`. El celular y la TV mostraron el error correcto, con la sugerencia de revisar mayúsculas y minúsculas. A los 20 s.
- Clave **correcta** (`FLIA-VELEZ`, la que ya tenía guardada): conectó en ~4 s, IP asignada, `guardada` (actualizó la entrada existente), sesión iniciada, streaming y alarma/ajustes aplicados. Señal de -67 dBm (antes -77).
- Todo el flujo duró ~3 min sin que el portal venciera. Escribir con el teclado "se sintió bien".
- Tras conectar, la TV volvió a leer la orden pendiente (`tipo actualizar`) y **no la obedeció** (una orden nunca se obedece al encender).
- Android **no abrió la página solo**: salió la notificación y, al tocarla, se abrió (en las dos formas de unirse).

**Incidente sin relación con el firmware:** la pantalla dejó de mostrar nada tras varios cortes de energía manuales; el registro serie mostraba la placa sana. Era **un cable de la pantalla flojo** (se corrigió y volvió). Lección: una OLED que deja de mostrar con la placa viva casi siempre es cableado o alimentación, no el programa; revisar VCC (3V3), GND, SDA (GPIO 8) y SCL (GPIO 9).

**Sin probar todavía** (anotado para el cierre): la pantalla guía y el aviso "Conectado!" (el dueño no se fijó), el tiempo que dura el error en pantalla, un iPhone (QR de fondo oscuro), y **una descarga grande (GIF de más de ~256 KB comprimido, con Wi-Fi bueno)** que compruebe el arreglo del watchdog de `EscritorBase64`; los GIF enviados pesaban 11–45 KB. Para esa prueba hay dos GIF de ruido en `C:\Proyectos\pruebas-qr\gif-pesado` (150 y 400 cuadros, ~150 KB y ~400 KB comprimidos).

## 6. Cambios de firmware de esa sesión (resumen)
- Arreglo del watchdog en las descargas (`EscritorBase64` cede la CPU un tick por bloque, como `EscritorOta`): versión 5.
- QR del portal con polaridad alterna, pantalla guía y cierre de `/update` y compañía: versión 6.
- Páginas propias del portal, búsqueda previa de redes, `/estado`, mensajes de la OLED durante el intento, portal que no vence con un celular conectado y pila de 6144 bytes: versión 7.
- Commits en `docs/historial-cambios.md` y en `docs/auditoria-alcance.md` sección 8.

## 7. Cómo cambiar y probar el portal
1. Editar `portal/index.html`, `estilo.css` o `portal.js` (el aspecto y la lógica se cambian en commits separados).
2. Ver la maqueta: abrir `portal/index.html` en el navegador (`?vista=…`); no hace falta la TV.
3. Probar la lógica: desde el repo del panel, `node ../TV_RETRO-firmware/portal/probar-portal.mjs` (o con `GENERADA=1` para la página generada). Necesita Node 22. Son 27 comprobaciones.
4. Generar: `node herramientas/generar-portal.cjs` (en el repo del firmware) y **volver a probar con `GENERADA=1`**.
5. Compilar el firmware (ver `CLAUDE.md` del firmware): subir `FIRMWARE_BUILD`, compilar con `--export-binaries`, `--seco` y publicar.
6. Probar en la TV: apagar el router, mantener la rueda 5 s, escanear el QR y completar el portal (con una clave mala y una buena).

## 8. Alternativas que se evaluaron y por qué no se hicieron
Resumen (el detalle está en `evaluacion-parte-3.md`): Bluetooth desde la app, SoftAP guiado, ESP-TOUCH, WPS y DPP. Bluetooth sigue **pospuesto** (solo cubre Android, necesita permisos, pide ~6–7 toques reales en un Android y no elimina el problema de fondo hasta que la app configure el Wi-Fi); DPP se descartó porque su QR no se puede escanear en una OLED de 128×64. El QR de Wi-Fi + páginas propias cubre Android, iPhone y web, no usa RAM extra y no pide permisos. La opción de **textos en español de WiFiManager** (`wm_strings_es.h`, bandera de compilación) dejó de hacer falta: las páginas visibles son las propias.

## 9. Pendientes
- ~~Probar la descarga grande (GIF de ruido)~~ **Hecho el 2026-11-21:** 155 250 bytes en 5,6 s y 414 000 bytes en 14,2 s en la TV real, sin reinicio por watchdog. Falta, cuando haya un iPhone, el QR de fondo oscuro.
- **Pantalla "sin Wi-Fi" persistente:** hecha en la **v8** (2026-11-21, publicada por OTA, **instalada y probada en la TV real**). Antes, con redes guardadas pero sin señal, la TV mostraba "Sin WiFi" 6 s y quedaba negra. Ahora la indicación se mantiene mientras no haya Wi-Fi ni contenido mostrado desde el encendido ("Sin WiFi / Sigo buscando tu red / Para configurarla: boton rueda 5 s"), se quita sola al volver la red y no tapa un contenido ya mostrado. Probada en la TV real por el dueño el 2026-11-21: con el router apagado y la TV reiniciada, la indicación "Sin WiFi" se mantuvo fija casi un minuto; al encender el router la TV se reconectó sola, la pantalla quedó negra un instante y volvió el contenido.
- OLED de 1,3": revisar si el módulo es SH1106 (no SSD1306) antes de dar por buena la pantalla (el programa usa `Adafruit_SSD1306`).
- Si la pantalla guía no basta para que el cliente toque el aviso, probar la opción 114 de DHCP como experimento aparte.
- El tutorial guiado de la app deberá explicar este flujo (QR, aviso de Android, 2,4 GHz).
