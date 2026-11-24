# Análisis de fallos del 2026-11-24

Pedido del dueño: buscar fallos "como el de la app que abría sin pestaña" (lo guardado que la app o la TV no esperan, dos cosas que
se cruzan), otras lógicas que puedan romper la app y huecos de seguridad. Dos rondas: la primera la arreglé con su aprobación; la
segunda (análisis propuestos por el asesor) está aquí para que el dueño apruebe los arreglos.

## 1. Primera ronda: ARREGLADA (aprobada por el dueño)

| # | Fallo | Arreglo |
|---|---|---|
| 1 | La Lite con caras era la versión 1 y en la nube está la 3 (sin caras): la app la "actualizaría" a una sin caras; una Lite 1-3 decía "ya tiene esta cara" sin mostrarla | Firmware `ebe6060` (`FIRMWARE_BUILD 4`), app `dd0cd77` (caras desde la 4) |
| 2 | Pro: al desvincular con una cara elegida, la TV saltaba al reloj y tapaba el código para vincular (también si estaba en el reloj) | Firmware `64afb84` |
| 3 | Pro v11: el clima (con un String) se compartía entre núcleos sin protección | Firmware `3de9d14` |
| 4 | Enviar mandaba una animación vacía si al abrir no se pudo leer su archivo | `28d075c` (texto 58) |
| 5 | App vieja TV RETRO: abría sin pestaña tras "actualizar"; al guardar Ajustes borraba la ciudad y el apagado; al desvincular no borraba la cara | `40e444b`, `e1706be`, `5667966` |
| 6 | Sin internet, el buscador de la ciudad decía "No encontramos esa ciudad." | `f458411` (texto 59) |

## 2. Segunda ronda: lo que salió bien (sin cambios)

- **Recetas de caras malformadas** (una cara la puede escribir cualquier miembro): `cara.cpp` lee cada byte con `B()` (no se sale del
  elemento), recorta estilo, variante, fuente, tamaño y alineación, y sus tablas tienen el tamaño correcto; `cara_valida` comprueba la
  estructura. Prueba de 200 000 recetas al azar y mutadas contra el dibujante de la app (igual punto por punto): 0 errores. Una cara
  dañada no puede colgar la TV al encender.
- **Reglas** de `relojes/`, `dispositivos/{id}/reloj` y `ajustes.ciudad`/`apagado`: prueba nueva `pruebas/reglas-caras.mjs` con el
  emulador, 36 casos, todos bien (`1ec16ac`).
- **HTML con datos de afuera** (`innerHTML` y parecidos) en `js/`, `app-unificada/src`, `app-lite/src` y el editor: no hay.
- **Cambiar de TV** recarga la página: el último estado, la ciudad y las caras de una TV no pasan a otra.
- **Bloqueo de la animación vacía**: al elegir una animación el tipo y los cuadros se fijan juntos, no bloquea un envío normal. Suite
  principal de la app vieja: 16 de 16; Config: 12 de 12.

## 3. Segunda ronda: ARREGLADO sin preguntar (eran mis diseños)

- **Caras del catálogo** (`c83170d`, vueltas a subir a `relojes/`): en Grande la fecha se cortaba abajo (y=54 llegaba a la fila 65);
  en Agujas "Miércoles" y "Sábado" en tamaño 2 no cabían y tapaban el reloj. Comprobado con los peores datos (12:58, 10:08,
  miércoles, sábado, -10° y 100°). Una TV que ya tenga una de esas dos caras conserva la copia vieja: hay que volver a enviarla.

## 4. Segunda ronda: POR APROBAR

| # | Gravedad | Fallo | Arreglo propuesto |
|---|---|---|---|
| A | Media-alta | Enviar una cara a una Pro sin internet: la cara se escribe con `set()` directo, sin el tope de 15 s (`conTope`) que exige la regla del proyecto. El SDK no termina esa escritura hasta que vuelve la señal: "Enviando…" y el botón bloqueados sin poder reintentar | Pasar la escritura de `dispositivos/{id}/reloj` (y las del editor) por el mismo tope: a los 15 s "La conexión está lenta…" como el resto del panel |
| B | Media | Dos celulares: A abre Ajustes, B (miembro) elige la ciudad, A guarda: la ciudad de B se pierde (A escribe lo que leyó al abrir). Lo mismo con el apagado desde la app vieja | Releer los ajustes justo antes de guardar y conservar lo que esa pantalla no maneja (la ciudad en Ajustes; el apagado y la ciudad en la app vieja) |
| C | Baja | Caras: si se cambia la lista justo después de tocar Enviar, sale "Pepito ya tiene esta cara ✅" con otra cara elegida en la lista | Mostrar el ✅ solo si la lista sigue en la cara enviada |
| D | Baja | Tres toques rápidos en Enviar de Caras pueden mandar la misma cara dos veces | Sin daño (es la misma cara); se puede dejar |
| E | Legal | La política de privacidad dice que fuera de Firebase no se comparten datos con terceros, pero ahora el celular manda a Open-Meteo lo que se escribe al buscar la ciudad y la TV le pide el clima con las coordenadas | Actualizar `privacidad.html` (y las de Pepito) antes de Play Store; lo revisa el abogado |

Menores de la primera ronda que siguen abiertos (anotados, sin arreglar): la lista de caras tarda unos segundos con una Lite apagada;
una cara que llega con la alarma sonando, el PIN o la actualización dibuja el reloj un instante; el clima no reintenta antes de 15
min si la primera consulta falla; "Pepito ya tiene esta cara ✅" con la Pro apagada (la recibe al conectarse).

## 5. Lo que falta probar en los aparatos

- **Pro v11** con `64afb84` y `3de9d14`: grabarla (con permiso del dueño), probar desvincular con una cara elegida (debe verse el
  código) y el clima un buen rato. **No publicar la v11 hasta probarlo.**
- **Lite 4**: grabarla en la S3 y en la C3, probar las caras, y publicarla en `firmware/lite/<modelo>` (mayor que la 3).
- **APK de la app vieja** y GitHub Pages: no tienen los arreglos del punto 5 hasta rehacer la APK y subir a `main` (cuando el dueño
  lo pida). El dueño puede decidir retirar la app vieja (Pepito la reemplaza).
