# Evaluación de la Parte 3 de la hoja de ruta (2026-11-20) y decisiones del dueño

> Solo evaluación: no se implementó nada de esto salvo el QR del portal (ver [portal-wifi.md](portal-wifi.md)). Las estimaciones de esfuerzo son aproximadas; lo marcado "no verificado" no se probó.
> Revisado con el advisor (Opus) antes de presentar las tablas; sus correcciones están incorporadas.

## 1. Decisiones del dueño (2026-11-20)

| Ítem | Decisión |
|---|---|
| **Mando por el celular** (WebSocket o BLE para los juegos) | **DESCARTADO.** "Ya no lo quiero." No se hace. |
| **Configuración del Wi-Fi por Bluetooth** | **Pospuesta.** Se hizo antes la alternativa del QR + páginas propias (portal-wifi.md). Se retoma solo si el QR no basta. |
| **QR de vinculación** | Resuelto de otra forma: QR **para unirse a la red del portal** (no para el código de 6 letras). Probado en el Moto Edge 50 Neo. |
| **Tutorial guiado** | **Lo último.** Antes, una ronda de ajustes pequeños de la app: textos visibles, textos de confirmación, espaciados y detalles de diseño, para no rehacerlos después. Esa ronda se propone primero como lista (qué se toca) y el dueño aprueba. |
| **Anuncios con recompensa** | Sin decidir; queda para el final (depende de abogado, Google Play y un servidor). |
| **H-20 (cifrado de flash y NVS) y fabricación a escala** | Se deja para cuando se fabrique en serie (ver sección 4). El dueño había olvidado de qué trataba; la explicación corta está en la sección 4. |
| **Pantalla de 1,3"** | El dueño cambiará la OLED de 0,96" por una de 1,3" (misma resolución 128×64). Revisar si es SH1106 (ver sección 5). |

## 2. Tabla de la evaluación

| Ítem | Viabilidad | Esfuerzo | Riesgo principal | Estado / orden |
|---|---|---|---|---|
| Tutorial guiado | Alta | Pequeño–medio (solo panel) | Sin scroll, panel `inert`, CSP, IDs; no rehacerlo | **Último**, tras los ajustes de textos y diseño |
| Wi-Fi por Bluetooth (BLE) | Alta, con prototipo | Grande | RAM interna (~100 KB libres con TLS), seguridad del canal, permisos | **Pospuesto** |
| Mando por el celular | Media-alta | Medio | Dependía de la reescritura de juegos (H-01) y de BLE | **Descartado** |
| QR de vinculación | Baja utilidad como "QR del código" | Pequeño–medio | Módulos diminutos en la OLED | **Hecho como QR del portal** (prueba física exitosa) |
| Anuncios con recompensa | Media | Grande | Clave en un servidor, política de Play, privacidad | Para el final |
| H-20 y fabricación a escala | Media | Grande (cambia la forma de compilar) | Irreversible; sin recuperación por cable | Junto con la fabricación en serie |

## 3. Notas por ítem

### 3.1 Wi-Fi por Bluetooth (pospuesto)
- Solo la ESP32-S3 tiene **BLE** (no Bluetooth clásico). El núcleo de Arduino instalado (esp32 3.3.10) ya trae **NimBLE compilado** (`CONFIG_BT_NIMBLE_ENABLED=y`, memoria interna, tarea fijada al **núcleo 0**, el mismo de la tarea `red`: ojo con el watchdog) y hay una copia de NimBLE-Arduino en el equipo. Lo que no se midió es el heap real que deja.
- Alcance: la APK (plugin `@capacitor-community/bluetooth-le`, rama 8.x activa) y Chrome en Android (Web Bluetooth). **iPhone y la web de iOS no**, así que el portal se tendría que conservar de todas formas.
- **Un conteo honesto de pasos en un Android real** es de unos 6–7 toques (añadir TV, permiso "Dispositivos cercanos"; en Android 11 o menos, Ubicación y además activarla; encender Bluetooth si está apagado; tocar la TV; diálogo de emparejamiento del sistema; confirmar en la TV; elegir la red y escribir la clave). Es casi lo mismo que el portal. Su ventaja real: no salir de la app, no depender del portal cautivo y no escribir dos códigos (el código de 6 letras viajaría por el canal cifrado, sin campos nuevos en Firebase).
- Requisitos de seguridad si se hiciera: no retroceder en H-02 (nada de escrituras GATT sin cifrar; emparejamiento seguro con confirmación física en la TV o código visible en la OLED), porque BLE añade alcance de radio (un vecino con la app podría reclamar una TV nueva durante la configuración).
- Quitar **del todo** el último toque ("tocar el aviso de Android") solo es posible si la app configura el Wi-Fi, y eso es BLE (o un plugin nativo de SoftAP). Es el argumento para retomarlo.

### 3.2 Mando por el celular (descartado)
- Se había concluido que BLE era la única vía razonable: Firebase tiene cientos de ms de latencia, y un WebSocket local choca con el contenido mixto del panel HTTPS, con el cleartext de la APK y con el aislamiento de clientes de los routers. Al descartar el mando **desaparece la sinergia** de un solo servicio BLE para todo y baja el riesgo de RAM (BLE podría vivir solo durante la configuración).

### 3.3 Anuncios con recompensa (pendiente, sin diseñar)
- Camino técnico: AdMob con verificación en servidor (la devolución de llamada la firma Google con ECDSA y sus claves públicas rotan, se pueden guardar como máximo 24 h) y un Worker de Cloudflare (plan gratis: 100 000 solicitudes por día y 10 ms de CPU por llamada).
- **Evitar una clave de servicio permanente en un servidor.** Idea: el Worker tendría su **propia cuenta de Auth con un claim**, y una regla nueva dejaría escribir solo `usuarios/{uid}/cuotas/extra` (y `extraAnimaciones`) con un tope. Esos campos ya existen para esto. Sería un cambio de reglas: necesita aprobación y que el dueño publique.
- Solo en la APK. Hay que actualizar la sección Data safety de Play y declarar el permiso `AD_ID`; si el público incluye niños hay riesgo con la política de Familias: va al abogado.

### 3.4 QR
- Un QR de 6 caracteres cabe (versión 1, 21×21 a 3 px = 63 px) pero queda de ~10 mm en una OLED de 0,96" y deja de tener sentido si la vinculación ya fuera automática. Se resolvió con el QR de Wi-Fi (versión 2, 25×25 a 2 px) y **se probó físicamente** antes de implementar (el dueño escaneó seis variantes con su Moto Edge 50 Neo; todas se leyeron, mejor las de fondo oscuro). Quedó **sin probar un iPhone**.

## 4. H-20 explicado de nuevo (por pedido del dueño)
Es **cifrar la memoria de la TV**. Hoy, quien tenga una TV y la conecte a un PC puede leer las claves de Wi-Fi guardadas y la cuenta de la propia TV. Corrección al alcance (ya anotada en `auditoria-alcance.md`): las claves de Wi-Fi están en `/redes.json` dentro de **LittleFS** (el cifrado de NVS no las cubre) y la cuenta de la TV (`email` y `clave`) está en la NVS en claro. Además el núcleo precompilado de Arduino **no trae** cifrado de flash, de NVS ni arranque seguro (`SECURE_FLASH_ENC`, `NVS_ENCRYPTION` y `SECURE_BOOT` apagados): hacerlo exige salir de Arduino precompilado (ESP-IDF o lib-builder) y recompilar el bootloader. El modo "release" es **irreversible** y **sin recuperación por cable** (con el descargador defectuoso de la versión 3 una TV así se habría quedado atascada); `partitions.csv` no viaja por OTA. Hacerlo antes de fabricar en serie, probando primero en una placa sacrificable.

## 5. Pantalla de 1,3"
Los módulos de 1,3" casi siempre usan el controlador **SH1106** (RAM de 132 columnas, desplazada 2 px), no SSD1306. El firmware usa `Adafruit_SSD1306`: con un SH1106 la imagen sale corrida 2 px y con basura en los bordes. Habría que usar una librería SH1106 (por ejemplo `Adafruit_SH110X`) y mantener la salida idéntica a la vista previa del panel. Si el módulo es SSD1306 de verdad, no cambia nada. Los píxeles quedan ~30 % más grandes, lo que ayuda a escanear el QR. **Revisar el controlador en la ficha del vendedor antes de comprar.**

## 6. Opciones para la primera configuración del Wi-Fi (la comparación completa)

| Opción | Pasos reales | Cubre | Costo / riesgo | Resultado |
|---|---|---|---|---|
| Portal original (SoftAP + clave en la OLED) | ~7 | Todos | Ya estaba | Fiable pero tedioso y en inglés |
| **Portal + QR + páginas propias** | ~5, y sin ir a Ajustes ni escribir la clave del portal | **Android, iPhone y web** | Pequeño–medio; sin RAM ni permisos nuevos | **HECHO** |
| BLE desde la app | ~6–7 | Android (APK y Chrome) | Grande: permisos, RAM, emparejamiento | Pospuesto |
| SoftAP guiado por la app (`WifiNetworkSpecifier`) | ~3–4 + diálogo del sistema | Android 10+ (APK) | Plugin nativo propio, "sin internet" y diálogos del sistema | No |
| ESP-TOUCH (SmartConfig) | ~3 | APK Android | Reputación de poco fiable (5 GHz, aislamiento; fallos reportados en la S3); plugin propio | Descartado |
| WPS (botón del router) | 2 y sin teléfono | Solo routers con WPS | Muchos lo traen apagado y WPA3 lo quita | Posible extra, no base |
| DPP / Easy Connect | 1–2 | Android 10+ | Su QR (~100+ caracteres) no se escanea en una OLED de 128×64 | **Descartado** |

Ninguna opción evita escribir la clave del Wi-Fi: Android no deja leer las claves guardadas (solo DPP, descartado). Un dato de por qué **escribir `192.168.4.1` a mano no sirve como solución**: con los datos móviles encendidos, Android manda el tráfico de un Wi-Fi "sin internet" por los datos y el navegador no llega a la TV; el aviso de inicio de sesión funciona porque esa app usa justo ese Wi-Fi.

## 7. Fuentes consultadas
- Plugin BLE de Capacitor: https://github.com/capacitor-community/bluetooth-le
- Permisos Bluetooth de Android: https://developer.android.com/develop/connectivity/bluetooth/bt-permissions
- AdMob, verificación en el servidor: https://developers.google.com/admob/android/ssv
- Límites de Cloudflare Workers: https://developers.cloudflare.com/workers/platform/limits
- Cifrado de flash en la ESP32-S3: https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/security/flash-encryption.html
- BLE en la ESP32-S3 (ESP-IDF): https://docs.espressif.com/projects/esp-idf/en/v5.4.3/esp32s3/api-guides/ble/overview.html
- Improv Wi-Fi (estándar de configuración por BLE): https://esphome.io/components/improv_ble/
- `WifiNetworkSpecifier` / red entre pares: https://developer.android.com/develop/connectivity/wifi/wifi-bootstrap
- Generador de QR (Nayuki, MIT): https://github.com/nayuki/QR-Code-generator
