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
