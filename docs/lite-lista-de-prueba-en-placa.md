# Lista para probar la Lite en la placa y en el celular (una sola sesión)

> Todo lo de la app se probó con una TV **simulada** (`app-lite/pruebas/`, ver abajo). **El firmware nuevo (`OLED_Lite/`) solo se compiló: no se ha grabado ni probado en una placa.** Esta lista dice qué hacer, en orden, y qué debe pasar. Cada escenario copia uno de la TV simulada, así que si algo difiere, la simulada o el firmware tiene el fallo.

## 0. Antes de empezar

- **S3 libre** (no la de la TV Pro) con la OLED y el buzzer; el botón en el GPIO 5 (en la C3 serán los pines provisorios de `pines_lite.h`: confirmarlos con la placa real).
- Compilar y grabar: `arduino-cli compile --fqbn esp32:esp32:esp32s3:FlashSize=16M,PSRAM=disabled,FlashMode=qio --jobs 1 OLED_Lite` y `upload -p COM6` (sin `CDCOnBoot` para ver el registro por COM6). La carpeta `OLED_Lite_prueba/` es el prototipo de velocidad de antes (no hace falta).
- APK: `node construir.mjs`, `npx cap sync android` y Gradle (ver `docs/historial-cambios.md`) en `app-lite/`; `adb install -r`. Es una app **aparte** de la Pro (`com.tvretro.lite`).
- Un solo cable USB: S3 y celular se turnan. Con el celular por adb, **no usar la tecla Atrás**.

## 1. Emparejar (primera vez)

1. Encender la TV nueva: debe mostrar **"Emparejar" con un PIN de 6 dígitos** y la cuenta de 2 minutos (se abre sola sin celulares vinculados). Registro: `[ble] ventana de emparejamiento abierta`.
2. En la app: **Enviar a la TV** → permiso de "dispositivos cercanos" → elegir la TV → el celular pide el PIN → escribirlo. **Aquí se prueba por primera vez `createBond()` del plugin dentro de la app** (en la prueba anterior se vinculó desde Ajustes). Esperado: la TV muestra "Listo! Celular emparejado" y el envío sigue solo.
3. Cerrar la app y volver a abrirla: no debe pedir PIN; el indicador pasa a "En línea" solo (reconecta con la última TV).
4. Con la ventana cerrada, un celular que no esté vinculado **no debe poder enviar nada** (ya se probó con la S3; repetir con la app).

## 2. Hora, texto, imagen, dibujo y GIF

| Qué hacer | Qué debe pasar |
|---|---|
| Conectar la app | La TV muestra el **reloj con la hora** del celular (si no había contenido) |
| Texto "Hola Lite" (Sans, tamaño 3) | Se ve igual que la vista previa de la app (misma fuente, mismos cortes) |
| Texto con scroll horizontal y vertical, y con tildes y ñ | Igual que la vista previa; scroll suave |
| Una imagen subida, un dibujo, una imagen de la Galería | Se ve en la OLED sin deformar (centrada, 128×64) |
| Marcar "Invertir" | Colores invertidos en la OLED |
| Un GIF corto (≈50 KB) | Se reproduce en bucle; mide el tiempo de envío (~2–3 s) |
| Un GIF de ≈250 KB | Aviso rojo en la app; llega en ~11 s; mientras llega la pantalla no se redibuja |
| Un GIF de más de 600 KB | La app lo rechaza con un mensaje, sin enviar nada |
| Apagar la TV y volver a encender | Vuelve a mostrar **lo último** (texto, imagen o GIF) |

## 3. Canciones

| Qué hacer | Qué debe pasar |
|---|---|
| Elegir una canción con letra y **Enviar** | La primera vez se manda (barra "Enviando… %"), después suena con letra e imágenes a tiempo |
| La misma otra vez | No se reenvía; solo empieza a sonar |
| "Sin letra" | Suena sin tocar la pantalla (queda lo que había) |
| Repeticiones 3 | Da 3 vueltas |
| Mandar muchas canciones seguidas (por ejemplo las 57) | La TV borra las más viejas y sigue funcionando; **la de la alarma no se borra** |
| **Un toque corto** del botón mientras suena | Se calla; la pantalla vuelve a lo que había |

## 4. Alarma y ajustes

| Qué hacer | Qué debe pasar |
|---|---|
| Alarma a 2 minutos de la hora actual, con una canción | Suena **sola** (desconecta el celular antes), con la pantalla ALARMA parpadeando; un toque la calla; sola se calla al minuto |
| Alarma con volumen en Silencio | Suena igual (volumen Medio) |
| Quitar la corriente a la TV y encender sin abrir la app | Reloj con "Sin hora" y **la alarma no suena**; al abrir la app vuelve la hora |
| Ajustes: brillo Bajo, volumen Bajo, otra zona | Se nota el brillo y el volumen; la hora cambia de zona |

## 5. Botón y casos raros

- **Toque corto sin nada sonando:** contenido → reloj → pantalla apagada → contenido.
- **Mantener 3 s:** aviso "Sigue / 5 s mas: emparejar"; soltar antes de los 8 s lo quita. **Mantener 8 s:** se abre el emparejamiento (borra el celular anterior). Con algo sonando, mantener **no** debe abrirlo.
- **Cortar la conexión a mitad de un GIF** (alejar el celular o apagar su Bluetooth): la TV debe quedarse con lo anterior; el siguiente envío funciona.
- **Apretar "Enviar" varias veces seguidas** y **cambiar de pestaña** durante un envío: no debe trabarse nada.
- **Alcance:** repetir un envío a 3, 6 y 10 metros.

## 6. Qué medir mientras tanto

Velocidad de un envío de 100 KB (en la prueba anterior, **22 KB/s** con el plugin y 36–63 KB/s con el navegador), memoria libre (`[lite] listo. Memoria libre…` en el registro; con la S3 sin memoria extra), y que ningún comando deje la TV colgada.

## Las pruebas simuladas

Desde `app-lite/` (Node 22; el banco usa Edge o Chromium de Playwright, del banco de la Pro):
`node construir.mjs` y luego `node pruebas/<archivo>.mjs` para: `arranque`, `enviar-texto`, `canciones`, `imagenes`, `galeria`, `alarma-ajustes`, `conexion`, `gif-pesado` y `predeterminadas`. `pruebas/todo.sh` las corre una por una. Un servidor de pruebas huérfano puede dejar el puerto 8766 ocupado: cerrarlo antes de repetir.

## Lo que NO se pudo probar sin el equipo

- El firmware en la S3/C3 (todo lo de las secciones 1 a 5 en la placa).
- `createBond()` y el reconectar con la última TV en Android (el navegador de pruebas no tiene ninguno de los dos).
- Alcance, consumo de batería y la deriva del reloj de la C3 real.
- Que el respaldo automático de Android (apagado en la app) no devuelva la Galería tras reinstalar: no verificado.
