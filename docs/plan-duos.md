# Dúos: dos Pepitos juntos hacen una animación entre los dos (plan, 2026-11-24)

> Nombre provisional: "Dúos" (el dueño elegirá el definitivo). Estado: **PLAN, nada hecho**. Revisado con el asesor el 2026-11-24.
> Regla de trabajo para toda la función: **no romper lo que ya funciona**. Primero una prueba aislada, después la integración
> detrás de una bandera de compilación apagada por defecto.

## 1. La idea (en palabras del dueño)

Cada TV lleva un **imán en el lateral izquierdo** y un **sensor de efecto Hall en el lateral derecho**. Al juntar dos Pepitos lado a
lado, el sensor de la TV de la **izquierda** siente el imán de la de la derecha: "hay otra TV pegada". Entonces las dos hacen una
animación en conjunto: empieza en la TV de la **derecha** (por ejemplo, un gatito camina y sale por el borde) y sigue en la de la
**izquierda** (el gatito entra, llega junto al otro y bailan), con sonido de tonos como las canciones.

### Decisiones del dueño (2026-11-24)

| Tema | Decisión |
|---|---|
| Sensores | Un imán y un sensor por TV (imán a la izquierda, sensor a la derecha): siempre hay una que detecta |
| Qué dispara la animación | Automático al juntarse |
| Quién decide cuál dúo | La TV de la izquierda (la que detecta), con su favorita configurada; si la otra no la tiene, una que tengan las dos |
| Sonido | Por ahora solo en la TV de la izquierda; más adelante, primero en la derecha y luego en la izquierda (nunca a la vez) |
| Cuántos | Unos 5 al principio; que quepan al menos 10 |
| Dónde viven | Guardados en cada TV; catálogo en la nube; la Pro lo baja sola, la Lite lo recibe del celular |
| Herramienta | Una herramienta para diseñar dúos con GIF (partir, recortar, filtros, tono) |
| Orden | Primero una prueba aislada solo de dúos; después integrar. Empezar por la Pro |

## 2. Lo medido (2026-11-24)

| Medida | Resultado |
|---|---|
| Programa de la Lite (C3) hoy | 999 463 bytes = **76 %** de su espacio de programa (1 310 720) |
| Lite + ESP-NOW (Wi-Fi encendido) | 1 524 373 bytes = **116 %: NO CABE** (+525 KB de código de Wi-Fi) |
| Lite + escuchar Bluetooth (solo el escáner) | 1 000 153 bytes (+690 bytes). **Preliminar**: no incluye conectarse como central, un servicio nuevo ni el reproductor de dúos; el presupuesto real sale de la prueba |
| Espacio de archivos | Lite: 1,375 MB (compartido con canciones y lo último mostrado); Pro: ~7,9 MB |
| Pro: memoria interna | Justa: una sola conexión segura de más (la del clima, abierta todo el tiempo) hizo fallar el aviso de versión (`HTTP -1`, arreglado en la v11). **La Pro nunca ha corrido Bluetooth**: es el riesgo mayor (sección 5, fase 0b) |
| Librería | La Lite usa el Bluetooth **del núcleo** (`BLEDevice.h`). Mezclarlo con NimBLE-Arduino da error de símbolos duplicados: **todo lo de dúos usa la librería del núcleo, nunca NimBLE-Arduino** |

## 3. Cómo se hablan las TV: Bluetooth, no ESP-NOW

- **ESP-NOW descartado:** no cabe en la Lite; la Pro conectada al router queda atada a su canal Wi-Fi (la otra TV tendría que
  buscarlo); y la radio Wi-Fi escuchando gasta mucha batería. Su única ventaja (1-3 ms por mensaje) no hace falta.
- **Bluetooth (BLE):** ya está en la Lite y en el chip de la Pro, no depende del router, permite escuchar poco y gastar poco.

### Papeles (encajan con un solo sensor)
- **TV de la derecha (no siente nada): anunciante pasiva.** Emite todo el tiempo una baliza corta "Pepito" (barato en batería).
  La baliza **no lleva un identificador fijo** (para que nadie pueda rastrear la TV).
- **TV de la izquierda (su sensor se activa): escanea solo después del contacto**, elige la baliza más fuerte **por encima de un
  umbral muy alto** (pegadas a 1 cm la señal es enorme) y se conecta a ella como central, a un **servicio "Dúos" propio**, distinto
  del servicio del celular y sin PIN.
- Por esa conexión viajan: el saludo (versión del protocolo y qué dúos tiene cada una), la elección, la señal de arranque, cancelar,
  y la separación (si se corta la conexión o el sensor deja de sentir el imán, las dos paran). Más adelante, pasar un dúo que falta.
- **Sincronía:** al conectarse miden la ida y vuelta de un mensaje; la izquierda manda "empieza en N ms" compensando la demora.
  Meta: la entrega de una pantalla a la otra con un desfase menor que un cuadro de animación.
- **Tiempo estimado del contacto al arranque:** 0,5 a 1 s (se mide en la prueba). Para que se sienta inmediato, la TV que detecta
  puede dar una señal al instante (un clic o un destello) mientras se ponen de acuerdo.

## 4. El dúo por dentro

- **Formato:** cada dúo son **dos grabaciones m1** (el formato de las canciones con letra: imágenes en el tiempo + notas; ver
  `docs/formatos-datos.md` sección 4), una por TV, **con la misma duración**. El sonido va en la mitad de la izquierda (por ahora).
  Se reutiliza el codificador (`js/compresion.js`) y el decodificador del firmware.
- **Modo propio "dúo"** en el firmware: NO pasa por `pantallaActual`, `musical_iniciar`, `terminoMusical`, `/ultimo.json`, el acuse
  ni el sobre (son justamente los caminos que más fallos dieron). Al terminar o al separarse, vuelve a dibujarse lo que había.
- **Peso:** unas pocas decenas de KB por dúo (1 bit por punto, comprimido). 10 dúos ≈ 0,5 MB como máximo.

### Estados y prioridades (decidido por el dueño el 2026-11-24: "la prioridad siempre es el dúo", salvo la alarma y una actualización)

| Situación | Propuesta |
|---|---|
| Alarma sonando, o empieza a sonar a mitad del dúo | **Gana la alarma:** el dúo no empieza / se cancela en las dos TV |
| Actualización en curso (Pro o Lite) | No empieza (interrumpirla dañaría la TV) |
| Código para vincular a la vista (Pro) o ventana de emparejar abierta (Lite) | No empieza |
| Partida de un juego en curso (Pro) | **Gana el dúo:** la partida se pausa y sigue al terminar (como con la canción con letra) |
| Suena una canción | **Gana el dúo:** la canción se corta |
| Pantalla dormida | Se prende para el dúo y después sigue la lógica de apagado de siempre |
| Se separan a mitad de la animación | Las dos paran y vuelve lo que mostraba cada una |
| Contacto falso (un iPhone con MagSafe, una nevera) | Si no aparece otra TV en ~2 s, no pasa nada |

## 5. Fases, con criterios para pasar a la siguiente

### Hardware disponible (2026-11-24)

- Sensor: módulo "MH-Sensor-Series" con chip 3144 + comparador LM393 (salidas D0 y A0). **Alimentarlo a 3,3 V** (a 5 V su D0 saca 5 V y daña la placa; si a 3,3 V no detecta, 5 V con un divisor en D0). Solo reacciona a un polo del imán; gasta ~10 mA (solo para la prueba).
- Imanes de neodimio de 8×2 mm (con el 3144 detectan a pocos mm; medir a través de la carcasa).
- Placas: la S3 del dueño (su Pro de todos los días) y un **ESP32 normal** (Bluetooth 4.2: sirve para la prueba de enlace aunque no tenga pantalla). La segunda S3 llega en ~1 semana.

### Fase 0: prueba aislada (sin tocar `OLED_Remota`, `OLED_Lite` ni la app)
- Un sketch aparte en el repo del firmware (`Duos_Prueba/`), que compila para S3 y C3, con su propia carpeta de compilación
  (`--build-path`, para no recompilar el núcleo al ir y venir).
- Lee el sensor, emite la baliza, escanea y se conecta, y toca dos mitades fijas hechas a mano (un corazón que cruza).
- **Para pasar:** detecta 100 de 100 contactos y ninguno con las TV separadas; arranca en menos de 1 s; el desfase de la entrega
  se ve continuo; hay margen claro de señal entre "pegadas" y "a 30 cm"; consumo medido; funciona Pro↔Pro, Pro↔Lite y Lite↔Lite.

### Fase 0b: los riesgos dentro del firmware real (detrás de una bandera de compilación)
- **Pro con Bluetooth (el riesgo mayor):** una variante del firmware real que solo enciende el Bluetooth y anuncia. Medir la memoria
  libre y el mayor bloque interno libre, y probar el streaming, un GIF, una canción con letra, la cara Clima y una actualización por
  Wi-Fi (sin `HTTP -1`, sin reinicios del watchdog, y cuánto tarda bajar 1,6 MB). **Si falla, se repiensa el diseño antes de seguir.**
- **Lite con el celular conectado:** que siga anunciando con el celular conectado, que acepte una segunda conexión (la de otra TV) y
  la memoria que queda.

#### Resultado de la fase 0b en la Pro (2026-11-24): NO PASA. Rediseño pendiente

Copia de la Pro v11 que encendía el Bluetooth (librería del núcleo) y emitía una baliza, con registro de memoria cada 10 s (no entra al repositorio):

| Momento | Interna libre | Mayor bloque | Mínimo histórico |
|---|---|---|---|
| Pro v11 sin Bluetooth (estable) | ~80 KB | 31,7 KB | 16-17 KB (durante las conexiones seguras del arranque) |
| Con el Bluetooth encendido | **8 KB** | **7,6 KB** | **108 bytes** |

- El Bluetooth se lleva **~72 KB de memoria interna**; la PSRAM (8,3 MB libres) casi no se usa. Primer intento: la TV se colgó al encenderlo ("Guru Meditation", con el mayor bloque en 31 KB). Segundo: arrancó, pero la TV quedó sin memoria (pantalla trabada). Se volvió a grabar la v11 oficial.
- La configuración del núcleo (`qio_opi/include/sdkconfig.h`) fija el Bluetooth (NimBLE) y la seguridad (mbedTLS) en **memoria interna** (`CONFIG_BT_NIMBLE_MEM_ALLOC_MODE_INTERNAL`, `CONFIG_MBEDTLS_INTERNAL_MEM_ALLOC`); el resto usa la PSRAM a partir de 4 KB (`CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL 4096`). Moverlos a la PSRAM exige **compilar un núcleo propio** (cambio grande para toda la Pro).
- Hallazgo aparte: la Pro **ya iba justa sin Bluetooth** (mínimo de 16 KB en el arranque): por eso el clima con la conexión abierta hacía fallar el aviso de versión.
- **Opciones (decide el dueño):** (a) núcleo propio con el Bluetooth y la seguridad en la PSRAM (detrás de una bandera y con todas las pruebas, también la OTA); (b) **un sensor en cada lateral**: cada TV sabría cuándo la tocan y encendería el Bluetooth solo durante el contacto, pausando unos segundos su trabajo de red; (c) último recurso: ESP-NOW entre las Pro y Bluetooth con la Lite (dos protocolos).
- **Regla para las próximas pruebas:** lo riesgoso se enciende con una orden por el monitor serie, nunca con un temporizador (la TV quedó reiniciándose cada minuto).

#### Investigación (2026-11-24): cómo lo resolvieron otros

- **El mismo problema está muy reportado en la S3** (Bluetooth + conexiones seguras sin memoria interna). La solución habitual es mover NimBLE y mbedTLS a la PSRAM con una configuración propia (`CONFIG_BT_NIMBLE_MEM_ALLOC_MODE_EXTERNAL`, `CONFIG_MBEDTLS_EXTERNAL_MEM_ALLOC`), pero el núcleo de Arduino viene precompilado: hay que reconstruirlo (esp32-arduino-lib-builder o la "compilación híbrida" de pioarduino, con fallos reportados de reconstrucciones en bucle y librerías que se pisan). Fuentes: arduino-esp32 #5751, pioarduino #564/#565, esp32-macropad #51, MeshCrossway #137.
- **Nuestra versión del núcleo (3.3.10) tiene un fallo reportado:** las conexiones seguras fallan después de usar Bluetooth, y en la 3.3.7 no (arduino-esp32 #12769).
- **Encender y apagar el Bluetooth pierde memoria en cada vuelta** (arduino-esp32 #3335, #7884): la opción "Bluetooth solo durante el contacto" no es segura para una TV que funciona días seguidos.
- **Productos parecidos no usan radio para el vecino:** los cubos Sifteo tienen "detección de vecinos de campo cercano" propia (sus prototipos usaban infrarrojo) y los AudioCubes, infrarrojo en las caras; las credenciales de conferencias usan infrarrojo de lado a lado (~2400 bps). littleBits usa **conectores magnéticos con contactos**, y hoy se venden conectores magnéticos de pines (pogo) de 5 a 9 contactos que se atraen solos y se repelen si se ponen al revés.
- **Conclusión:** dos caminos sin el problema de memoria y sin radio: (1) **conector magnético con contactos** en cada lateral (cable serie directo entre las TV: detección inmediata en las dos, rápido, sin gasto de batería esperando) y (2) **infrarrojo lateral** (sin contactos a la vista, lento pero suficiente para los mensajes). Pendiente: que el dueño elija.

#### DECISIÓN FINAL DEL DUEÑO (2026-11-24, más tarde): LOS DÚOS SON SOLO DE PEPITO PRO

"La Lite ya no tendrá dúos, por el momento": es una función que, si está en las dos, le quita peso a la Pro, y complicaría más la Lite, que es la versión básica y recortada. Como los juegos, es exclusiva de la Pro (la regla "Pro y Lite parejos" no aplica). Todo lo de la Lite en este plan (Bluetooth, fase 3, bit 64 del protocolo, reserva de espacio) queda **archivado**; vale lo de la Pro: ESP-NOW entre dos Pro, sensor Hall + imán.

#### Decisión anterior (reemplazada por la de arriba) (2026-11-24): una radio por línea, empezando por la Pro

- **Pepito Pro ↔ Pepito Pro: ESP-NOW** (usa el Wi-Fi que la Pro ya tiene encendido). **Pepito Lite ↔ Pepito Lite: Bluetooth** (lo que la Lite ya tiene). **Una Pro y una Lite no se juntan** (decirlo claro al cliente). Excepción consciente a "Pro y Lite parejos": las dos tienen Dúos, pero no entre ellas.
- Lo común se programa separado de la radio (formato, catálogo, herramienta, reproductor, prioridades); cada línea solo cambia la parte que lleva los mensajes.
- Detección: **sensor Hall + imán** (el conector magnético con contactos salía ~14 000 COP el par contra ~5 000 del sensor con imán). Para el producto: **AH180-PG** (los dos polos, ~8 µA, de patitas, ~0,3-0,5 USD); para la prueba, el módulo que ya compró.
- **ESP-NOW y el canal:** dos Pro en la misma casa usan el mismo router (mismo canal). Con la Pro de otra casa, la TV que detecta suelta su Wi-Fi unos segundos para buscar a la otra por los canales.
- Siguiente: medir la memoria de ESP-NOW en la Pro (encendido por orden serie, nunca por temporizador).

#### Medición de ESP-NOW en la Pro (2026-11-24): PASA (falta la parte con descargas)

Copia de la Pro v11 con ESP-NOW encendido por orden serie (`TVRETRO_ESPNOW_ON`, no entra al repositorio), sobre el Wi-Fi ya conectado (canal 5 del router):

| | Interna libre | Mayor bloque | Mínimo histórico |
|---|---|---|---|
| ESP-NOW apagado | 100 344 | 47 092 | 35 524 |
| ESP-NOW encendido, enviando un saludo cada 2 s | 100 120 | **47 092** | 35 524 |

- **ESP-NOW cuesta ~220 bytes de memoria interna** (el Bluetooth, ~72 KB) y **~8 KB de programa**. 34 saludos enviados sin errores; el streaming siguió bien.
- (Esta vez la TV no tenía la cara Clima: por eso hay más memoria libre que en la medición del Bluetooth.)
- Falta: con ESP-NOW encendido, un GIF grande, una canción con letra, la cara Clima y una actualización por Wi-Fi.

### Fase 1: integrar en la Pro
Con una bandera de compilación **apagada por defecto**, para que la Pro v12 pueda salir sin dúos si hace falta. Modo dúo y tabla de
estados; los dúos de prueba guardados a mano.

### Fase 2: catálogo y herramienta
- Catálogo en la nube (por aprobar) y la Pro lo baja sola **con la prioridad más baja** (nunca compite con el contenido que manda
  el celular).
- La **herramienta para diseñar dúos** (sección 6) y la favorita en la app.

### Fase 3: la Lite
El celular le pasa los dúos por Bluetooth (bit nuevo del protocolo) a una **reserva propia** que la biblioteca de canciones no borra.

### Fase 4: mejoras
Pasar en el momento un dúo que la otra TV no tiene (solo se reproduce, no se guarda); sonido primero en la derecha; filas de 3 o
más Pepitos; juegos que cruzan de una pantalla a la otra.

## 6. Herramienta para diseñar dúos (para el administrador, como el editor de caras)

- **Un GIF ancho** que se recorta y se parte en dos (mitad derecha / mitad izquierda), o **dos GIF** en una línea de tiempo (el
  primero en la TV derecha, el segundo en la izquierda) eligiendo qué muestra cada TV mientras espera.
- Los ajustes de los GIF de Pepito: Pixelar, Nivel de pixelado, invertir, encuadre (escala, fondo, rotar, voltear) y velocidad.
- El tono: una canción del catálogo o un sonido corto, en qué TV y en qué momento.
- Vista previa con **dos pantallas lado a lado**, punto por punto como las TV; el peso de cada mitad (para la Lite).
- Guardar en el catálogo. Se recicla: `js/gif.js`, `js/imageProcessor.js`, `js/compresion.js` (m1) y la forma del editor de caras.
- **Aviso:** para vender, las animaciones deben ser propias o con licencia (un video viral tiene dueño).

## 7. Seguridad

- Solo se aceptan TV **muy cerca** (señal muy alta) y **mientras el sensor siente el imán**.
- Tamaños máximos en todo lo que llega; el lector de m1 se prueba con datos al azar (como las recetas de caras).
- Un dúo recibido de otra TV **solo se reproduce**, nunca se guarda (solo se guarda lo del catálogo propio).
- La baliza no lleva un identificador fijo.

## 8. Aprobaciones y compras pendientes (antes de cada fase)

| Qué | Cuándo |
|---|---|
| **Comprar:** sensores Hall omnipolares de bajo consumo (tipo DRV5032; para la prueba sirve un módulo común), imanes de neodimio pequeños (~6×2 mm) y **una segunda placa S3** (para no sacar de servicio la Pro de todos los días en cada prueba) | Antes de la fase 0 |
| Dónde va físicamente el sensor y el imán (lejos del buzzer, que es magnético) y los pines (C3: GPIO 3 o 10, a confirmar con la placa) | Fase 0 |
| ~~Partidas y canciones en la tabla de estados~~ (decidido: gana el dúo; la alarma gana al dúo) | Hecho |
| Nodos nuevos en Firebase: catálogo `duos/` y dónde se guarda la favorita de una Pro (reglas + copia de vuelta atrás; las publica el dueño) | Fase 2 |
| Bit nuevo del protocolo de la Lite (64) y sus comandos: primero se escribe en `docs/evaluacion-version-lite.md` sección 8, luego app, TV simulada y firmware | Fase 3 |
| Especificación nueva del protocolo entre TV (servicio "Dúos") | Fase 0, al cerrar la prueba |
| Textos que se vean en la app (propuestas para el dueño) | Fases 2 y 3 |
| Nombre definitivo de la función | Cuando el dueño lo elija |
