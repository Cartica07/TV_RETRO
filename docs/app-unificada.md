# App unificada: TV Pro y TV Lite en una sola app

> Estado al 2026-11-22: etapas 1 y 2 hechas y probadas con Firebase y Bluetooth **simulados**; APK de depuración compilada (paquete provisional). **Falta probarla en el celular y con la TV real.** La Pro no se tocó (ni una línea).

## Qué es y por qué

El dueño quiere **una sola app**: la misma entrada (cuenta), y que la app sepa si la TV es Pro (Wi-Fi, nube) o Lite (Bluetooth). Además quiere poder **actualizar el contenido predeterminado** sin sacar una versión nueva de la app. Con cuentas, la galería y las canciones salen de la nube (Firebase) para las dos TV, así que lo que el dueño suba con su herramienta de administrador lo ven las dos.

Decisiones (2026-11-22, el dueño delegó la 2 en Claude con consulta al asesor):
1. Una sola app; la Lite deja de ser "sin cuentas" dentro de ella (la app `app-lite/` sigue existiendo, sin cambios, como producto aparte).
2. **Lo predeterminado viene solo de la nube**; la app unificada NO lleva copia de las 57 canciones ni de la biblioteca (dos fuentes = claves repetidas e ids distintos, justo lo que se quería evitar). Costo: ver el catálogo exige internet, como en la Pro hoy; enviar a una TV Lite ya emparejada funciona igual.

## Cómo está hecha (sin tocar la Pro)

`app-unificada/construir.mjs` arma `www/` a partir de una **copia** de la Pro (`index.html`, `js/`, `css/`, `fonts/`) y cambia solo la copia:

| En la copia | Qué es |
|---|---|
| `js/firebase.js` | el **enrutador** (`src/backend-unificado.js`) |
| `js/firebase-pro.js` | el `firebase.js` de la Pro, sin cambios |
| `js/gif.js` / `js/gif-pro.js` | envoltorio con avisos de peso por tipo de TV / el original |
| `js/lite-tv.js` | la parte Bluetooth (`src/lite-tv.js` + `ble.js` de `app-lite/`), empaquetada con esbuild |
| `js/anadir-lite.js`, `css/unificada.css` | botón "Tengo una TV Lite", pantalla "Conecta tu TV" |

**El enrutador decide a mano cada una de las 66 funciones de `firebase.js`:** *nube* (siguen yendo a Firebase: cuentas, galería, canciones, administrador…), *por TV* (estado, enviar, alarma, ajustes, sistema, "en línea": TV Pro → Firebase, TV Lite → Bluetooth) y *por id* (reciben el id de una TV: si es `lite:…` se resuelve en el celular y **nunca** llega a Firebase). El build **falla** si la Pro agrega una función que el enrutador no conoce (el mismo seguro de la Lite).

- **Id de una TV Lite:** `lite:<dirección Bluetooth>`. Se guarda en el celular por cuenta (`localStorage`, `tvretro.tvlite.<uid>`); no hay campos nuevos en Firebase. Mi TV las lista junto a las TV Pro; la Lite no se comparte (sin botón "Compartir"); "Desvincular" la quita del celular.
- **Con una TV Lite en uso** `<body>` lleva la clase `tv-lite`: se ocultan Juegos y Sistema (actualizar/restablecer) y los avisos de peso del GIF usan los umbrales de la Lite (100 KB / 250 KB; no se envía sobre 600 KB).
- **Añadir una TV Lite** (en "Añade tu TV" y en Mis TV): botón "Tengo una TV Lite" → pantalla "Conecta tu TV" (pasos) → "Abrir Bluetooth" (ajustes del celular, donde Android pide el PIN directo) → al volver la app busca sola la TV emparejada por su nombre, la añade a la cuenta y vincula con el mismo formulario de siempre (marca `LITE`). Si algo falla, el emparejamiento al tocar Enviar (respaldo de la Lite) sigue funcionando.
- **Canciones a una TV Lite:** salen del catálogo de la nube (`leerMusical`, el mismo m1 de la Pro). El id de 16 bits sale del **contenido** (CRC); solo se da por buena una canción que la TV lista **y** que el celular recuerda haberle mandado con ese mismo CRC completo: si no, se manda otra vez. (Tocar la canción equivocada es peor que reenviar.)

- **"¿Qué TV tienes?"** (pedido del dueño): la primera vez que una cuenta entra sin ninguna TV, "Añade tu TV" pregunta el tipo con dos opciones dentro de la misma tarjeta (no una pantalla aparte, para no tapar el formulario del código que usan las pruebas de la Pro): **TV Pro** marcada por defecto (el código de siempre) y **TV Lite** (abre "Conecta tu TV"). La muestra la clase `sin-tv` que el enrutador pone en `<body>` cuando la lista de TV llega vacía; en Mis TV (con TV ya añadidas) no sale y queda el botón "Tengo una TV Lite".
- **Aviso del vínculo roto:** si al reconectar sola la app descubre que la TV Lite ya no reconoce al celular, muestra un cuadro con qué hacer (máximo una vez por minuto). Antes solo decía "Desconectado" (lo encontró la prueba real del 2026-11-22).
- **Primera pantalla "¿Qué TV tienes?" y TV Lite SIN cuenta (2026-11-22, decisión del dueño: "la Lite, lo más sencillo posible"):** al abrir la app por primera vez se pregunta el tipo de TV (la respuesta queda en el celular; quien ya tenía sesión no la ve). **TV Pro** lleva al inicio de sesión de la Pro, sin cambios. **TV Lite** no pide cuenta: la app entra con una **sesión anónima** invisible (el dueño debe activar Firebase > Authentication > Método de acceso > Anónimo), que basta para leer lo predeterminado de la nube (`biblioteca/` y `musicales/` piden solo "con sesión"); lo que la persona guarda va a la **galería del celular** (`src/galeria-local.js`), porque las reglas solo dejan guardar en la nube a cuentas con correo verificado; las TV Lite sin cuenta se recuerdan en el celular (`tvretro.tvlite.local`). Sin cuenta se oculta lo de la cuenta y el tutorial de la Pro, "Conecta tu TV" se abre sola la primera vez, y en Mis TV "Cerrar sesión" pasa a "Tengo una TV Pro" (vuelve a la pregunta). Si la entrada sin cuenta falla, la pregunta muestra el motivo (sin internet, o el acceso anónimo sin activar). La pregunta que estaba dentro de "Añade tu TV" se quitó (la reemplaza esta). **Las pruebas originales de la Pro corren marcando "TV Pro" en cada carga** (`correr-pruebas-pro.mjs`): la prueba es que quien elige TV Pro recibe exactamente la Pro.
## Cómo se arma y se prueba

```
cd app-unificada
npm install                      # una vez
node construir.mjs               # web (pruebas) -> www/
node construir.mjs --apk         # APK -> www-apk/ (SDK de Firebase dentro, sin la política de seguridad de la web)
node pruebas/unificada.mjs       # TV Pro igual que la Pro + añadir y usar una TV Lite
node pruebas/unificada-lite.mjs  # cuenta con TV Pro y TV Lite: canciones de la nube, alarma, ajustes, Mis TV
node pruebas/correr-pruebas-pro.mjs   # las pruebas ORIGINALES de la Pro contra la app unificada
npx cap sync android && (Gradle assembleDebug, ver docs/historial-cambios.md)   # APK en android/
```

- **`correr-pruebas-pro.mjs` es la prueba de que la Pro no cambió:** copia `pruebas/` y `js/` de la Pro a una carpeta temporal (`.pruebas-pro/`, ignorada por git), cambia UNA línea del banco (dónde está la app) y las corre. Resultado al cierre de esta sesión: ver `docs/historial-cambios.md`.
- `android/` sale de `herramientas/copiar-android-base.mjs` (copia el proyecto de la Lite, cambia el paquete a `com.pepito.app`, pone el nombre "Pepito" y añade los permisos de internet). **Paquete y nombre DEFINITIVOS** (decisión del dueño, 2026-11-23): el paquete no se puede cambiar después de publicar en Play Store. Con otro paquete **no reemplaza** a la Pro ni a la Lite instaladas en el celular.
- **Nombre "Pepito"** (2026-11-23, [nombre-pepito.md](nombre-pepito.md)): `src/textos-pepito.mjs` cambia en la COPIA todos los textos visibles que decían "TV" y `construir.mjs` falla si queda alguno. `node construir.mjs --sin-pepito` arma `www-sin-pepito/` con los textos de la Pro, que es lo que usa `correr-pruebas-pro.mjs`.

## Pendiente (y decisiones del dueño)

- ~~Probar en el celular y con la TV Lite real~~ **hecho el 2026-11-23** (resultado en [pruebas-pendientes-unificada.md](pruebas-pendientes-unificada.md)); falta probar el firmware en una **C3 real** (se probó en la S3).
- **Google nativo:** la APK de depuración no lleva el plugin de Google (el botón no se muestra; el inicio con correo funciona). Para activarlo hay que registrar el paquete nuevo y su huella SHA-1 en Firebase (lo hace el dueño) y añadir `@capacitor-firebase/authentication` (como la APK de la Pro).
- ~~Sin internet al arrancar~~ **hecho el 2026-11-23 (`a122c36`):** una TV Lite ya añadida se usa sin internet (solo faltan la galería predeterminada y las canciones, que vienen de la nube). El aviso "sin internet" de `resolverDispositivo` pasó al enrutador con el mismo texto (`construir.mjs` lo quita de la COPIA de `cuentas.js` y falla si esa línea de la Pro cambia); sin cuenta la lista de TV no pregunta a la nube y, con una TV Lite sin internet, `esAdministrador` y `listarMusicales` no esperan a Firebase. Prueba: `pruebas/sin-internet.mjs`; la prueba `sin-red-arranque` de la Pro da igual contra la unificada. La primera vez que se elige "TV Lite" sí hace falta internet (sesión anónima).
- **Textos nuevos por aprobar:** filas 25 a 33 de [lite-textos-propuestos.md](lite-textos-propuestos.md).
- **Textos legales:** la unificada tiene cuentas e internet (Términos y privacidad de la Pro, revisados para la Pro); revisar con el abogado lo que cambia por incluir la TV Lite (por ejemplo, dónde se guardan lo último enviado, la alarma y los ajustes de una TV Lite: en el celular).
- ~~Nombre y paquete definitivos~~ **hechos el 2026-11-23**: "Pepito", `com.pepito.app` y Bluetooth "Pepito Lite" (firmware y app). Falta: registrar `com.pepito.app` y su huella SHA-1 en Firebase para entrar con Google (lo hace el dueño) y cambiar las páginas de ayuda y legales cuando las revise el abogado.
- **Las apps Pro y Lite de antes:** cuando la unificada esté pulida será la ÚNICA; mientras tanto se mantienen las otras por si acaso (decisión del dueño, 2026-11-23).
- ~~Tutorial guiado~~ **hecho el 2026-11-23 (`088b89a`, `a22bf01`), decisión del dueño (opción B):** también sale con la TV Lite, UNA vez por celular (si ya se vio con otra cuenta o con el otro tipo de TV no vuelve a salir; sigue en Ayuda y contacto > Ver tutorial) y, con una TV Lite, el paso de "Más" dice "Aquí están tu galería, la alarma y los ajustes." (fila 42, por aprobar). `js/tutorial.js` de la Pro no se tocó (las frases de la Pro no hablan de Wi-Fi: solo ese paso nombraba los juegos).
- **Firmware:** sin cambios para la unificada. Más adelante, que la TV Lite anuncie si tiene el emparejamiento abierto permitiría detectarla sola.

## Cambios pendientes en la Pro (NO aplicados: el dueño decidió el 2026-11-23 no tocar la Pro por ahora)

Arreglos que se hicieron solo en la unificada y que la Pro probablemente también necesita. Se aplican a la Pro únicamente cuando el dueño lo pida (es un cambio de la Pro: plan, aprobación, sus pruebas y su APK).

| Qué | En la unificada | En la Pro haría falta |
|---|---|---|
| **Teclado que tapa el campo en el que se escribe** (por ejemplo "Nombre" en la pestaña Imagen): la barra fija "Enviar a la TV" y la navegación quedan encima del teclado y el sistema no sube el campo | `app-unificada/src/teclado.js` (`4df215a`), con la prueba `app-unificada/pruebas/teclado.mjs`; comprobado en el celular | Llevar `teclado.js` a `js/` de la Pro y cargarlo desde `index.html` (es un archivo nuevo: no cambia ninguna función ni ID). Comprobar antes en la APK Pro que el problema existe (mismo diseño, así que muy probablemente sí), correr su banco y rehacer su APK |

(El arreglo del tutorial `e90cdd8` NO es de la Pro: solo pasaba en la unificada, en el modo sin cuenta.)

## Buscar canción (2026-11-23)

Lupa junto a `#seleccionCancion` y `#alarmaTono` (HTML en `construir.mjs`) que abre `#buscadorCanciones`: `src/buscar-canciones.js` filtra por el comienzo del nombre o de cualquier palabra (sin mayúsculas, tildes ni apóstrofos) y elige en la lista de la Pro con un evento `change`. `src/atras.js` se carga ANTES que `main.js` y envuelve `Capacitor.Plugins.App.addListener`: si una ventana de la unificada está abierta, Atrás la cierra; si no, hace lo de la Pro. Pruebas: `pruebas/buscar-canciones.mjs` y `pruebas/atras.mjs`. Textos propuestos 43 a 45.
