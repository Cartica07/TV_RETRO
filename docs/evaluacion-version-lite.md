# Versión Lite de TV RETRO: evaluación, decisiones y pruebas (2026-11-21/22)

> Rama de trabajo: `lite` (panel y firmware). **No se tocó nada de la versión Pro**: todo lo de la Lite está en carpetas nuevas (`lite/` en el panel, `OLED_Lite/` en el firmware). El informe de la investigación de mercado está en [lite-investigacion-transporte.md](lite-investigacion-transporte.md).

## 1. Qué es

Una TV más barata y simple que la Pro, pensada para quien quiere sobre todo las canciones: ESP32-C3 (placa "C3 Pro Mini", chip C3FH4: 4 MB de flash, sin memoria extra), OLED 0,96", buzzer, batería y un botón. **No usa Firebase ni internet**: la app habla con la TV por Bluetooth LE. La razón de existir es el costo de la nube de la Pro cuando se venda mucho (ver `CLAUDE.md` y la conversación del 2026-11-21; antes de comprometerse conviene comparar con arreglar el modelo de la Pro).

## 2. Decisiones del dueño

| Tema | Decisión |
|---|---|
| Cuentas | **Ninguna** en la Lite |
| Plataformas | **Solo Android**; **no pagar la cuenta de Apple** (99 USD/año) por ahora. Web Bluetooth en Chrome/Edge de Android sirve para probar; la app real usará el plugin de Capacitor (Android) |
| Transporte | **Bluetooth LE** como único canal (red propia y Wi-Fi local descartadas: ver la investigación) |
| Hora y alarma | Sí importan. La hora la da el celular al conectar. Idea del dueño, sin decidir: que la TV baje la hora de internet. Recomendación: v1 sin Wi-Fi, medir la deriva del reloj de la C3 real y entonces elegir entre Wi-Fi opcional para la hora, chip DS3231 o solo el celular |
| Canciones | Se guardan en la TV como **caché** (las más usadas); el catálogo completo vive en la app |
| Actualizaciones (OTA) | Sin decidir. Recomendación: dejar la puerta abierta (por Bluetooth, no por Wi-Fi) |
| Placa de pruebas | La **ESP32-S3** (misma pila Bluetooth NimBLE que la C3) mientras llega la C3 |

## 3. Presupuesto de memoria (C3, 4 MB de flash) — ESTIMADO, falta medir el programa final

| Parte | Tamaño |
|---|---|
| Arranque, tabla de particiones, ajustes (NVS), vínculos | ~100 KB |
| Programa A | 1,25 MB (hoy 740 KB) |
| Programa B (para actualizar; no consume almacenamiento) | 1,25 MB |
| Almacenamiento (LittleFS) | 1,4 MB |

Dentro del almacenamiento: lo último enviado (imagen, texto o GIF) ~256 KB reservados; alarmas (pocos bytes; su canción queda protegida en la biblioteca: 42 KB típico, 273 KB peor caso); cara del reloj (se dibuja con código, 0 KB); canciones: lo que quede (~860 a 1090 KB). Las 57 canciones del catálogo suman **795 KB**, así que caben todas, con poco margen en el peor caso. Riesgo: si el programa final (fuentes de texto, alarma, reloj, GIF, actualización) pasa de 1,25 MB habría que agrandar los espacios de programa y se reduciría el almacenamiento.

## 4. Lo medido (ESP32-S3 sin memoria extra + Moto Edge 50 Neo + Edge/Web Bluetooth)

- **Velocidad** (100 KB, 3 envíos por combinación, 48 envíos, 0 fallos, 0 reenvíos): solo recibir, trozo de 500 bytes y ventana de 8 a 16 → **54 a 63 KB/s**; trozo de 244 → 32 a 47 KB/s. Guardando en la flash y dibujando la pantalla a la vez: 26 a 37 KB/s; 100 KB quedan guardados y verificados en 2,8 a 3,9 s. Con el canal cifrado (vinculado): 36 KB/s con trozo de 244.
- **Emparejamiento:** ventana de 2 min con PIN de 6 dígitos solo en la OLED; se abre sola sin celulares vinculados y al mantener el botón 3 s; abrirla borra el vínculo anterior. Las características exigen cifrado y autenticación. Probado: vinculado funciona, el vínculo sobrevive a un reinicio sin pedir PIN, y un celular sin vínculo con la ventana cerrada **no puede escribir** (la TV corta). Desde Web Bluetooth no sale el diálogo del PIN al escribir sin vínculo: hay que vincular desde Ajustes > Bluetooth; la app real usará `createBond()` del plugin (solo Android), **sin probar**.
- **Biblioteca de canciones:** 114 archivos (las 57 canciones y una copia de cada una) = 1,59 MB enviados a una TV con 1,4 MB: todos los envíos OK, la TV borró las menos usadas y quedó con **56 canciones**; cada canción queda guardada en 0,2 a 2,5 s; reproducir con letra y sin letra, y parar, funcionan; **la biblioteca sobrevive a un reinicio**.
- Compilado para la C3 real (sin la placa): **740 KB (56 % del espacio de 1,25 MB)** y 65 KB de memoria estática.

## 5. Protocolo de prueba (Bluetooth, little-endian)

Servicio `7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b`. `CTRL` (`…0002`, escritura + aviso) y `DATOS` (`…0003`, escritura sin respuesta). Comandos de `CTRL`: `0x01` hora (epoch u32 + zona en minutos i16), `0x02` inicio de envío (tamaño u32, CRC32 u32, ventana u8, banderas u8 [bit0 guardar, bit1 dibujar, bit2 canción], id u16 si es canción), `0x03` fin, `0x04` estado, `0x10` listar, `0x12` tocar (id u16, repeticiones, con letra), `0x13` parar, `0x14` borrar todo, `0x15` info de la biblioteca. Los trozos de `DATOS` llevan un número de secuencia u16; la TV confirma cada "ventana" de trozos y pide reenviar desde donde falta; al final compara el CRC32. Código: `OLED_Lite/` (firmware) y `lite/prueba-ble.html|js` (página de prueba).

## 6. Pendiente

1. **Hora y alarma** (paso 2.3), cara del reloj y la imagen/texto/GIF enviado "al momento" (con su espacio reservado).
2. Repetir todo en la **C3 real** (una sola CPU: guardar y dibujar mientras llega el Bluetooth puede costar más), con el **alcance**, el **consumo de batería** y la **deriva del reloj**. Elegir placa con cargador y, si se quiere meses de batería, cristal de 32 kHz (la "Pro Mini" probablemente no lo trae: sin verificar).
3. App real (Capacitor, Android): plugin BLE, `createBond()`, catálogo de canciones en la app o en archivos estáticos.
4. Actualización por Bluetooth (OTA) con la firma que ya usa la Pro.
5. La TV ya tenía 1 vínculo guardado al arrancar la primera vez (origen desconocido).

## 7. Cambio de alcance (2026-11-22): la app Lite = la app Pro con otro canal de envío

El dueño pidió que la app Lite tenga **la misma apariencia, las mismas pestañas y las mismas funciones que la Pro** (texto, imagen, dibujo, canciones, Más con Galería, Alarma y Config), y que cambie **solo la forma de enviar** (Bluetooth en vez de Firebase). Esto reemplaza el plan anterior de «copiar y adaptar»: ahora se **reutiliza el código de la Pro sin editarlo**.

- **Cómo:** `js/firebase.js` es el único módulo de la Pro que habla con Firebase. La Lite empaqueta `main.js`, `mas.js`, `galeria.js`, `canciones.js` y demás de la Pro y, con un alias de esbuild, cambia `./firebase.js` por un `backend-lite.js` que ofrece los mismos nombres. Los módulos de la Pro importan 54 nombres distintos de `firebase.js`; si la Pro cambia y el backend de la Lite se queda atrás, la compilación falla (no falla en silencio).
- **Clasificación de esos 54 nombres:** Bluetooth/TV (`enviarEstado`, `cargarAlarma`/`guardarAlarma`, `cargarAjustes`/`guardarAjustes`, `suscribirLastSeen`, `suscribirMostrada`/`leerMostrada`, `cargarEstado`…); almacenamiento del celular (`listarImagenes`, `guardarImagenCatalogo`, `suscribirImagenes`, `leerPreprocesada`, `leerCuadrosAnimacion`, `borrarImagenCatalogo`, animaciones); catálogo dentro de la app (`listarMusicales`, `leerMusical`); sin efecto (cuentas, Mi TV, compartir, apodos, restablecer, actualización: 22 o más nombres).
- **Sin cuentas:** la Pro ya tiene el modo `?sincuentas=1` (solo se usaba en pruebas); falta comprobar que funcione de punta a punta y cómo activarlo en la APK. Lo que la Lite no usa se oculta con `lite.css`, nunca se borra del HTML (un ID faltante rompe la app). **Si algo solo se pudiera cambiar editando código de la Pro, se pregunta al dueño.**
- **Galería en el celular** (no en la nube): IndexedDB. Se avisa al cliente de que **se guarda en el celular**. Se pierde si se desinstala la app, se borran sus datos o se cambia de celular (y al cambiar de celular hay que volver a emparejar la TV con el botón). Si el respaldo automático de Android podría restaurarla tras reinstalar: **no verificado** (la app declara `allowBackup="false"`).
- **Firmware:** copiar a `OLED_Lite/` el texto con sus 5 fuentes (`texto.cpp`, `fuentes.cpp`) y las animaciones z1 (`animacion.cpp`) cuesta **~137 KB**: medido en la C3, el programa pasa de 740 KB a **876 KB (66 % de 1,25 MB)**. Falta sumar recibir el `pantalla` de la Pro por Bluetooth (JSON), imagen, alarma y reloj, y medir otra vez.
- **Pendiente de decidir con el dueño:** de dónde sale la biblioteca predeterminada (hoy en Firebase `biblioteca/`, y la clave de servicio ya se borró); los límites de GIF para Bluetooth (a 22 KB/s con el plugin, un GIF de 400 KB tarda ~18 s; los umbrales de la Pro eran para Wi-Fi); y los límites de imágenes en el celular.

## 8. Protocolo Bluetooth de la Lite (versión 1) — la especificación que siguen la app, la TV simulada y el firmware

Es la referencia de TODO lo que viaja por Bluetooth. La app (`app-lite/src/ble.js`), la TV simulada (`app-lite/pruebas/tv-simulada.js`) y el firmware (`OLED_Lite/`) deben cumplirla línea por línea; si se cambia algo, se cambia aquí primero. Todo en little-endian.

**Servicio** `7a1c0001-5e7d-4f0e-9a3b-0c1d2e3f4a5b`. **CTRL** `…0002` (el celular escribe comandos; la TV responde con avisos). **DATOS** `…0003` (el celular escribe trozos sin respuesta). Escribir en cualquiera exige un vínculo con PIN (ver "Emparejamiento").

### 8.1 Comandos (CTRL) y avisos de la TV

| Cmd | Nombre | Datos | Aviso de la TV |
|---|---|---|---|
| `0x01` | HORA | `epoch u32`, `zona i16` (minutos del celular) | `[0x81][1]` |
| `0x02` | INICIO de envío | `tamaño u32`, `crc32 u32`, `ventana u8`, `banderas u8`, (si bit 2) `id u16` | `[0x82][ok]` |
| `0x03` | FIN de envío | — | `[0x83][ok][bytes u32][ms recepción u32][ms total u32]` (14 bytes) |
| `0x04` | ESTADO | — | `[0x84][1][mtu u16][memoria libre u32][vínculos u8][ventana abierta u8]` (10 bytes) |
| `0x10` | LISTAR canciones | — | `[0x90][n][id u16 × n]` (n ≤ 100) |
| `0x12` | TOCAR | `id u16`, `repeticiones u8`, `con letra u8` | `[0x92][ok][id u16]` (ok = 0 si no la tiene o hay un envío en curso) |
| `0x13` | PARAR | — | `[0x93][1]` |
| `0x14` | BORRAR toda la biblioteca | — | `[0x94][1]` (las canciones de una alarma NO se borran) |
| `0x15` | INFO de la biblioteca | — | `[0x95][n u8][libre u32][total u32]` |
| `0x20` | ALARMAS | `tono u16` (id de canción, 0 = aviso simple) y 3 × (`activa`, `hora`, `minuto`, `días` máscara bit 0 = domingo) | `[0xA0][ok]` |
| `0x22` | AJUSTES | `brillo u8` (1–3), `volumen u8` (0–3), `zona i16` | `[0xA2][ok]` |

**Banderas del INICIO:** bit 0 = guardar en la memoria (solo diagnóstico), bit 1 = dibujar el avance (solo diagnóstico), **bit 2 = canción** (se guarda en la biblioteca con ese `id`), **bit 3 = contenido** (ver 8.3). Sin bits 2 ni 3 el envío solo se mide y se descarta (diagnóstico). `ok = 0` en el aviso `0x82` significa que la TV no puede recibirlo (sin espacio o contenido no válido). **Un INICIO nuevo reemplaza al envío que estuviera en curso** (por ejemplo, uno que quedó a medias porque la app falló): la TV lo abandona y empieza el nuevo. El aviso de HORA es `[0x81][ok]` (`ok = 0` si la hora no tiene sentido: antes de 2023).

### 8.2 Trozos y confirmaciones (DATOS)

Cada escritura es `[seq u16][bytes…]` (el celular usa trozos de 500 bytes y ventana de 16; la TV limita la ventana a 16). Reglas, iguales en app, simulador y firmware:

1. Si `seq == esperada` se acepta y `esperada++`. Cada `ventana` trozos aceptados (y el último) la TV avisa `[0x85][esperada u16]`.
2. Un trozo ADELANTADO (`seq > esperada`) provoca **un solo** `[0x86][esperada u16]` por hueco (no uno por trozo). El celular reenvía desde `esperada`.
3. Un trozo REPETIDO (`seq < esperada`) se ignora sin avisar.
4. Si la TV no puede guardar más rápido (la memoria intermedia está llena), **retiene el `0x85`** hasta tener sitio para toda la ventana en vuelo (2 × ventana × 512 bytes); la memoria intermedia nunca se desborda. Si un celular desobedece la ventana y el trozo no cabe, se descarta en silencio.
5. El celular espera 1,5 s un aviso; si no llega reenvía desde lo último confirmado (hasta 5 veces seguidas sin avance: conexión perdida).
6. Al final el celular manda `0x03`; la TV responde cuando terminó de escribir y de comprobar el CRC32 y el tamaño.

### 8.3 Contenido (bandera 8)

Lo que la app Pro escribía en Firebase (`pantalla` y `archivo`) viaja en UN envío: `[u16 largo del JSON][JSON de pantalla (UTF-8)][archivo: bytes z1 de un GIF]`. El JSON es el mismo de `docs/formatos-datos.md` sección 2 (tipos `texto`, `imagen` y `animacion`; los valores que falten toman los mismos por defecto que en la Pro, p. ej. `fuente` = `clasica`). El archivo solo existe con `animacion` (formato `z1`, bytes crudos, no Base64). La TV procesa mientras llega: el JSON queda en RAM (máximo 4096 bytes) y el archivo se escribe directo a su archivo temporal, así un GIF nunca ocupa el doble en la memoria. Solo si el CRC32 y el tamaño coinciden se muestra y se recuerda como lo último; si no, la TV conserva lo que mostraba.

### 8.4 Reglas de la TV

- **Hora:** la da el celular al conectar (`0x01`). **Zona horaria:** manda la de `AJUSTES` una vez guardada; mientras no se haya guardado ninguna, la del celular. Sin hora válida desde el encendido la TV muestra "sin hora" y **no hace sonar alarmas** (nunca una hora inventada).
- **Alarmas:** hasta 3, a su hora y días, suenan solas; se callan solas al minuto; un toque corto del botón las calla. Suenan aunque el volumen esté en Silencio (volumen Medio). La canción de la alarma está protegida: la caché nunca la borra.
- **Botón (el único):** toque corto = calla lo que suene; si no suena nada, cambia contenido → reloj → pantalla apagada. Con algo sonando, ningún toque ni mantenido abre el emparejamiento (para no borrar el vínculo al querer callar una alarma). **Mantener 8 s con nada sonando** abre la ventana de emparejamiento (PIN en pantalla, 2 min) y borra el vínculo anterior.
- **Memoria permanente propia:** la Lite usa nombres propios en la NVS (`lite_alarma`, `lite_ajustes`, `lite_reloj`) y en LittleFS (`/lite_ultimo.json`, `/c/` con la marca `.formato1`) para no mezclarse con los datos de una TV Pro que estuvo en la misma placa; si falta la marca del formato, la biblioteca se vacía.
- **Espacio:** la caché de canciones borra las menos usadas (salvo la de la alarma); un envío (canción o contenido) que no cabe se rechaza con `0x82` `ok = 0` y la app avisa antes de empezar si ve que un GIF no cabe (`0x15`).

## 9. Batería: lo que se encontró y lo que falta decidir (2026-11-22)

El firmware de la Lite **no tiene ninguna gestión de energía**: el `loop()` nunca duerme, la pantalla solo se apaga con el botón (modo apagado) y el Bluetooth anuncia sin parar. Con la corriente de un USB no se nota; con batería sí, y el dueño pidió autonomía.

**Lo comprobado** (`esp32c3-libs/3.3.10/sdkconfig` del núcleo de Arduino instalado): `CONFIG_PM_ENABLE` **no está activado**, `CONFIG_BT_CTRL_MODEM_SLEEP` **no está activado** y el reloj de reposo es el interno (`CONFIG_RTC_CLK_SRC_INT_RC`, sin el cristal de 32 kHz). Es decir, **el sueño ligero automático con Bluetooth no está disponible en el núcleo precompilado**: tenerlo exige compilar el núcleo aparte (ESP-IDF o `lib-builder`, igual que el cifrado de flash H-20) y, por lo medido en la investigación, un cristal de 32 kHz en la placa. Cuánto gasta hoy la TV **no está medido**.

**Opciones** (decide el dueño; ninguna está hecha):
1. **Sueño manual con el núcleo actual:** la TV duerme (`esp_light_sleep_start`) y despierta por el botón o por un temporizador a la hora de la próxima alarma; el Bluetooth solo se enciende al pulsar el botón o al despertar por la alarma, durante unos minutos. Cabe en el firmware actual, pero cambia la experiencia: para mandar algo hay que pulsar antes el botón de la TV.
2. **Compilar el núcleo con gestión de energía** (más trabajo, y conviene un cristal de 32 kHz en la placa): el Bluetooth sigue disponible con poco gasto.
3. **Aceptar poca autonomía** (la TV conectada a la corriente o con una batería grande) para la primera versión.

Antes de elegir hay que **medir** el gasto real con la C3 (analizador de corriente, anunciando, conectada, con la pantalla encendida y apagada).
