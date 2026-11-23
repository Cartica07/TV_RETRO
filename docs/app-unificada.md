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
- `android/` sale de `herramientas/copiar-android-base.mjs` (copia el proyecto de la Lite, cambia el paquete a `com.tvretro.unificada`, pone el nombre "TV RETRO (unificada)" y añade los permisos de internet). **Paquete y nombre provisionales:** la decisión definitiva es del dueño (no se pueden cambiar después de publicar en Play Store). Con otro paquete **no reemplaza** a la Pro ni a la Lite instaladas en el celular.

## Pendiente (y decisiones del dueño)

- **Probar en el celular y con la TV Lite real** (la APK compilada y el firmware con el sobre y el aviso, grabado en la S3): añadir la TV desde "Añade tu TV", usarla, enviar texto, imagen, GIF y canción desde la nube, alarma y ajustes.
- **Google nativo:** la APK de depuración no lleva el plugin de Google (el botón no se muestra; el inicio con correo funciona). Para activarlo hay que registrar el paquete nuevo y su huella SHA-1 en Firebase (lo hace el dueño) y añadir `@capacitor-firebase/authentication` (como la APK de la Pro).
- **Sin internet al arrancar:** el arranque de la Pro (`cuentas.js`, sin tocar) avisa "Sin conexión" cuando `navigator.onLine` es falso; una TV Lite ya añadida se podría usar sin internet, pero eso exigiría cambiar `cuentas.js`. Se deja como está.
- **Textos nuevos por aprobar:** filas 25 a 33 de [lite-textos-propuestos.md](lite-textos-propuestos.md).
- **Textos legales:** la unificada tiene cuentas e internet (Términos y privacidad de la Pro, revisados para la Pro); revisar con el abogado lo que cambia por incluir la TV Lite (por ejemplo, dónde se guardan lo último enviado, la alarma y los ajustes de una TV Lite: en el celular).
- **Nombre y paquete definitivos** de la app, y qué pasa con la app Pro y la Lite ya instaladas (la unificada las reemplazaría en la tienda).
- **Tutorial guiado** (`js/tutorial.js` de la Pro): no distingue la TV Lite; sus frases hablan de la TV por Wi-Fi.
- **Firmware:** sin cambios para la unificada. Más adelante, que la TV Lite anuncie si tiene el emparejamiento abierto permitiría detectarla sola.
