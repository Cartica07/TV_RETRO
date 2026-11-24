# Caras de reloj: plan (APROBADO por el dueño, 2026-11-23/24; hardware de la batería por decidir)

> Escrito el 2026-11-23 para retomarlo en otra conversación. Nada de esto está hecho. Los textos visibles son PROPUESTAS
> salvo los que dictó el dueño ("Cara 1", "Cara 2", "crear una cara"). Los campos de Firebase y el comando Bluetooth
> nuevos necesitan su aprobación antes de escribir código.

## 1. Qué pidió el dueño

Poder cambiar la cara del reloj desde la app, en los dos Pepitos: **Más > Caras de reloj > Cara 1, Cara 2…**, y poder
**crear una cara** nueva cuando quiera para que les llegue a todos los clientes sin actualizar nada.

## 2. Pepito Lite y las actualizaciones

**Corrección (2026-11-23):** la actualización por Bluetooth de la Lite (OTA) está en la lista de pendientes
([evaluacion-version-lite.md](evaluacion-version-lite.md), sección 6, punto 4: "dejar la puerta abierta, por
Bluetooth") pero **todavía no está hecha**: hoy una Lite solo se actualiza por cable. El dueño pidió revisar la OTA
antes de cerrar la lista de elementos (pregunta 8). Con OTA, la lista de elementos puede crecer después; aun así las
caras siguen siendo recetas (datos) para que el dueño cree caras sin publicar firmware, y la receta se protege así:

- Una cara **no es código**, es una **receta** (datos): un fondo de 128×64 y una lista de elementos con su posición.
  La TV trae, una sola vez, un "dibujante" que sabe leer recetas.
- La receta lleva **número de formato**. El dibujante **salta los elementos que no conoce** (cada elemento dice cuánto
  mide) y, si la receta está dañada o es de un formato que no entiende, **dibuja la Cara 1**. Así una cara creada en
  2027 con un elemento nuevo no rompe ningún Pepito Lite vendido: solo le falta ese elemento.
- Sin OTA en la Lite, lo que no entre en la primera versión de elementos no lo tendrían nunca los Lite vendidos.

## 3. Cómo llega la cara a la TV (recomendado: la app la "copia" a la TV)

| | **A. La app copia la cara (recomendado)** | B. La TV la busca en el catálogo |
|---|---|---|
| Lite | La app la manda por Bluetooth (no hay otra forma) | — (imposible) |
| Pro | La app copia la receta en `dispositivos/{id}/reloj` | La TV lee `relojes/datos/<clave>` |
| Caminos | Uno solo para los dos Pepitos | Dos caminos distintos |
| Si el dueño cambia o borra una cara del catálogo | Las TV que ya la usan siguen igual | La TV puede quedarse sin cara |
| Reglas de Firebase | La TV solo lee lo suyo | Hay que dejar a la TV leer el catálogo |

## 4. La receta (formato `R1`)

Un archivo binario pequeño, igual para Pro y Lite (en Firebase va en Base64):

- Cabecera: `R1`, número de formato, banderas (¿trae fondo?).
- Fondo opcional: 1 024 bytes (128×64, 1 bit por punto), hecho con el mismo pixelado de la Galería.
- Elementos: `[tipo][largo][datos…]` (máximo unos 16 por cara).

Elementos de la primera versión:

| Elemento | Qué muestra | Opciones |
|---|---|---|
| Hora | `9:05` | fuente (clásica o Sans, Sans negrita, Serif, Serif cursiva), tamaño, posición, centrado, 12 h |
| AM/PM | `AM` / `PM` | fuente, tamaño, posición |
| Fecha | `23/11/2026`, `23 Nov`, `Dom 23` | formato, fuente, tamaño, posición |
| Día de la semana | `Domingo` / `Dom` | fuente, tamaño, posición |
| Reloj de agujas | círculo con horas y minutos (sin segundero) | centro, radio, marcas |
| Zona de estado | los íconos de cada Pepito | solo la posición (ver abajo) |
| Campana | una campanita si hay una alarma activa | posición |
| Texto fijo | por ejemplo "Pepito" | texto corto, fuente, tamaño, posición |
| Rectángulo / línea | marcos y separadores | posición, tamaño, relleno o no |
| Fondo | una imagen de 128×64 | se pixela como en la Galería (va en la cabecera de la receta) |
| **Próxima alarma** (2026-11-24) | `⏰ 7:00` (nada si no hay alarma activa) | fuente, tamaño, posición, con o sin ícono |
| **Clima** (2026-11-24, solo Pro) | `☀ 24°` | posición, tamaño; la Lite (sin internet) no lo dibuja |
| **Cuenta regresiva** (2026-11-24) | `Faltan 12 días` | la fecha (se elige al crear la cara), fuente, tamaño, posición |
| **Batería** (2026-11-24, por definir el hardware) | ícono con 4 niveles (y quizá %) | posición, estilo; una TV sin medidor no lo dibuja |

**Estilos de íconos (pedido del dueño, 2026-11-24):** la zona de estado y la campana llevan un **estilo** a elegir: Wi-Fi
como barras que suben o como ondas `)))`; mensaje como sobre o como burbuja; campana con dos dibujos. Se empieza con 2 o 3
estilos por ícono y el dueño los ve dibujados en píxeles antes de hacerlos.
**Elegidos por el dueño (2026-11-24)** en la página de estilos (generador: `app-unificada/herramientas/iconos-reloj/`): Wi-Fi
**Abanico** (la onda que falta no se dibuja; sin Wi-Fi, cruzado por una raya), mensaje **Burbuja de chat**, conexión
**Nube**, alarma **Campana**, batería **Segmentos**, clima **Dibujos simples** (sol, parcial, nublado, lluvia, tormenta). Los
estilos de hoy siguen disponibles (estilo 0) para la Cara 1 y para otras caras.

**Batería (pendiente de decidir el hardware, las dos TV llevarán batería):** recomendado un divisor de voltaje (2
resistencias de ~470 kΩ y un condensador a un pin analógico: ~4 µA, centavos, 4-5 niveles); alternativas: chip medidor
MAX17048 (I2C, % exacto, ~23 µA) o leer los LEDs del módulo de carga (4 pines, se confunde al cargar). Si el módulo de 4
LEDs del dueño trae un IP5306 en versión I2C, la TV podría leer sus 4 niveles por el mismo bus de la pantalla. El elemento
va en la receta desde la primera versión; la lectura se agrega por actualización cuando esté el hardware.

- **Zona de estado:** la cara solo dice DÓNDE van los íconos; cada TV pone los suyos (Pro: señal, conexión y sobre de
  mensaje nuevo; Lite: el sobre). Así una misma cara sirve para los dos.
- **Sin hora todavía:** la TV sigue mostrando su pantalla fija de siempre ("Sincronizando" en la Pro, "Abre la app" en
  la Lite) hasta tener hora. La cara no la cambia.
- **Agujas idénticas en la app y en la TV:** las 60 posiciones de las agujas salen de una tabla fija de números
  enteros que comparten las dos (no de senos y cosenos calculados en cada lado), y la línea se traza igual que la
  librería de la pantalla.

## 5. La TV

**Común (Pro y Lite):** un archivo nuevo del firmware, `cara.cpp`, el dibujante. Se escribe una vez y la Lite lo
copia exacto de la Pro (como `texto`, `fuentes` y `animacion`, comprobado con `comprobar-copias-lite.cjs`). Usa las
fuentes que ya están en la TV. Ocupa poco: la Lite en el C3 usa ~917 KB de 1,25 MB.

- **Cara 1 = el reloj de hoy**, tal cual, escrito en el código: es la que sale si no hay otra, si la receta falla o
  si el dueño elige "Cara 1". Nunca se puede perder.
- La cara elegida se guarda en la memoria de la TV (`/reloj.r1`, ~1 KB). Elegir Cara 1 borra el archivo.
- **Sin segundos (decidido):** ninguna cara lleva segundos ni segundero, así la Lite sigue redibujando una vez por
  minuto y no gasta más batería.

**Pro (versión 10, por Wi-Fi):** lee `dispositivos/{id}/reloj` al encender y cuando la app le manda la orden de
siempre de "vuelve a leer los ajustes" (no hace falta un tipo de orden nuevo). Una Pro con firmware 9 o anterior
ignora el campo y sigue con la Cara 1.

**Lite (Bluetooth):** la cara viaja como cualquier envío grande (INICIO / trozos / FIN, sección 8 de
[evaluacion-version-lite.md](evaluacion-version-lite.md)) con un bit nuevo en las banderas del INICIO: **bit 4 =
cara de reloj**. Y un comando corto nuevo, **`0x24` CARA**, `[0]` = volver a la Cara 1 (respuesta `[0xA4][ok]`).
Regla del proyecto: primero se escribe la especificación, después la app, la TV simulada y el firmware.

## 6. Firebase (propuesta, necesita aprobación)

| Ruta | Qué es | Quién lee | Quién escribe |
|---|---|---|---|
| `relojes/indice/<clave>` | `{ nombre, orden, fecha }` (lista liviana) | cualquier cuenta con sesión | administrador |
| `relojes/datos/<clave>` | la receta en Base64 (máx. ~2 KB) | cualquier cuenta con sesión | administrador |
| `dispositivos/{id}/reloj` | `{ clave, datos }`: la cara elegida para esa TV | dueño, miembros y la TV | dueño y miembros (como `ajustes`) |

- Si `reloj` falta → Cara 1 (un firmware que no lo conoce sigue funcionando).
- La Cara 1 no está en el catálogo: la trae la app escrita.
- Restablecer/desvincular la TV borra también `reloj` (como los ajustes, H-34).
- Copia de vuelta atrás de las reglas: `database.rules.sin-relojes.json`.

## 7. La app (Pepito Pro y Lite, la misma pantalla)

- **Más > Caras de reloj** (botón nuevo en el menú Más). La app vieja TV RETRO no se toca: todo se inyecta en la copia
  con `construir.mjs`. Hay que parchear, en la copia: la lista de pantallas permitidas de `mas.js` (`cambiarMasVista`),
  el mostrar/ocultar y el título (`tituloMas`) de `mostrarSeccionSegunTipo` en `main.js`, y si se ve o no la barra de
  Enviar.
- **Pantalla (recomendada, sin scroll):** una vista previa grande de la cara (como la de la TV, arriba) + la lista de
  caras con la ventana bonita de las canciones (Cara 1, Cara 2…) + **Enviar a la TV**. Alternativa: una cuadrícula de
  miniaturas, que necesitaría scroll (hoy solo la Galería puede tenerlo).
- **Vista previa pixel-perfect:** un dibujante en JS (`js/cara.js` en la copia) con `renderer.js` y `fuentesGfx.js`, a
  la hora real. Se comprueba mandando la misma cara a la TV y comparando la foto con la vista previa; además una prueba
  automática dibuja la receta de la Cara 1 en JS y la compara con el reloj de hoy punto por punto.
- **Pro con firmware viejo:** si `dispositivos/{id}/firmware.build` es menor que 10, en vez de la lista sale un aviso
  (propuesta: "Actualiza tu Pepito para cambiar la cara del reloj.") con el botón que lleva a Config > Sistema.
- **Sin internet:** las caras del catálogo no cargan; la Cara 1 siempre está.

## 8. "Crear una cara" (herramienta del dueño)

Página aparte solo para administradores, como `carga-masiva.html`, en `app-unificada/herramientas/editor-caras.html`:

- Fondo: subir una imagen (se pixela como en la Galería) o dejarlo negro.
- Añadir, mover (con el dedo o el ratón) y ajustar los elementos de la sección 4.
- Vista previa idéntica a la TV con la hora que corre, y botón "probar en mi TV" antes de publicar.
- Guardar en el catálogo con un nombre; renombrar, ordenar y borrar.
- Lo que el dueño publique lo ven al instante todos los clientes de los dos Pepitos.

## 9. Orden de trabajo

0. **Antes (ya en marcha):** terminar las pruebas del apagado automático, commitear el arreglo de la canción con letra
   en los dos firmwares, grabar y probar la Pro v9 en la placa, publicarla por Wi-Fi y borrar la clave de servicio.
1. Especificación (documentos): formato `R1`, Firebase y Bluetooth. El dueño aprueba.
2. Dibujante en JS + pruebas (Cara 1 idéntica al reloj de hoy, recetas dañadas, elementos desconocidos).
3. Firmware Lite: dibujante, archivo, bit 4 y `0x24`; TV simulada; prueba en la placa S3.
4. Firmware Pro v10: el mismo dibujante y la lectura de `reloj`. **También** la pantalla "Actualizando" con barra de
   avance mientras se descarga una actualización (pedido del dueño el 2026-11-23, igual que la Lite; texto 48).
5. App: pantalla Caras de reloj (paso visual y paso de lógica, en commits separados).
6. Editor del dueño y las primeras caras (puedo proponer 3 o 4 diseños para empezar).
7. El dueño publica las reglas; pruebas en la TV real; la v10 sale por Wi-Fi.

Estimado: 3 o 4 sesiones de trabajo. Todo antes de vender la Lite.

## 10. Preguntas para el dueño (respuestas del 2026-11-23)

1. **Sí**: la app copia la cara a cada TV (opción A).
2. **c)** No hay caras con segundos.
3. **a)** Vista previa grande + lista, sin scroll.
4. **Sí**: al enviar una cara, la TV se pone en el reloj para que se vea y después sigue normal.
5. **Sí**: por ahora crear caras es solo para el dueño.
6. **Sí**: aprobadas `relojes/indice`, `relojes/datos` y `dispositivos/{id}/reloj`.
7. **Sí**: aprobados el bit 4 del envío y el comando `0x24`.
8. **Sí (2026-11-24)**, la lista de la sección 4 tal cual, más **próxima alarma**, **clima (solo Pro)**, **cuenta
   regresiva**, **batería** (hardware por decidir) y **estilos de íconos**. La OTA de la Lite ya está hecha, así que la
   lista puede crecer después (una TV sin actualizar salta lo que no conoce).
9. **Sí**: "Caras de reloj" y "Actualiza tu Pepito para cambiar la cara del reloj."

Preguntas tal como se hicieron:

1. ¿La app copia la cara a cada TV (opción A, recomendada)?
2. Segundos y segundero en la Lite: a) se permiten aunque gasten más batería, b) en la Lite esas caras se dibujan sin
   segundos, c) no hay caras con segundos.
3. Pantalla de la app: a) vista previa grande + lista (sin scroll, recomendada), b) cuadrícula de miniaturas (con scroll).
4. Al enviar una cara, ¿la TV se pone en el reloj para que se vea (y luego sigue normal)?
5. ¿Crear caras es solo para ti (administrador) por ahora?
6. ¿Apruebas las rutas `relojes/indice`, `relojes/datos` y `dispositivos/{id}/reloj`?
7. ¿Apruebas para la Lite el bit 4 del envío y el comando `0x24`?
8. ¿La lista de elementos de la sección 4 está bien o falta algo (piensa que la Lite no podrá recibir más)?
9. Nombre del botón del menú: ¿"Caras de reloj"? Y el aviso para la Pro vieja de la sección 7.

## 11. Clima: dónde guardar la ciudad (PROPUESTA, 2026-11-24)

Hoy `clima.cpp` de la Pro no se usa y trae fija la ciudad de Armenia (Quindío). Para que cada cliente vea su clima:

- **App:** Más > Config > Ajustes de Pepito > **"Ciudad para el clima"**: se escribe el nombre y la app muestra las ciudades
  que encuentra (buscador gratuito de Open-Meteo, sin clave: `geocoding-api.open-meteo.com`, en español); se elige una y se
  guarda. Texto del campo y de los resultados: propuestas al dueño.
- **Firebase (campo nuevo, necesita aprobación):** `dispositivos/{id}/ajustes.ciudad` = `{ nombre (1-60), lat (-90 a 90), lon
  (-180 a 180) }`. Si falta, no hay clima (el elemento Clima no se dibuja). Un firmware que no lo conoce lo ignora. Lo
  escriben el dueño y los miembros, como el resto de los ajustes. Se borra al desvincular o restablecer.
- **Pepito Pro:** `clima.cpp` usa esa ciudad en vez de Armenia y consulta el clima cada 30 minutos **solo si la cara elegida
  tiene el elemento Clima** (no gasta datos ni memoria si no).
- **Pepito Lite:** no tiene internet, así que no hay clima (más adelante la app podría mandárselo al conectarse).
- **Privacidad:** la ciudad (no la dirección) queda guardada en la cuenta: hay que mencionarlo en la política de privacidad.
- **Seguridad:** la política de seguridad de la página (CSP) de la app debe permitir `geocoding-api.open-meteo.com`.
