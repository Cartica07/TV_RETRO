# Auditoría: qué se revisó, qué cambió desde entonces y qué falta revisar

> Este documento existe para que la **auditoría final** (cuando la app esté terminada) no empiece de cero.
> Dice con precisión qué ya se examinó a fondo, qué se arregló desde entonces (y por tanto hay que volver a mirar, porque es código nuevo) y qué está pendiente.
> Se actualiza al cerrar cada etapa de trabajo. Si algo cambia, se anota aquí además de en [historial-cambios.md](historial-cambios.md).

## 1. La auditoría base (2026-11-12)

- Auditoría técnica y de seguridad completa de panel web, APK, firmware y Firebase (solo lectura; no se tocó nada). 27 hallazgos, `H-01` a `H-27`, con gravedad, solución y esfuerzo.
- **Informe completo:** `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-12.md` (fuera del repo, a propósito: describe puntos débiles). Junto a él: `sondas-reglas.mjs` y `capturas.mjs`. Haz una copia de respaldo de esa carpeta.
- **Versiones auditadas (línea base):**
  - Panel: rama `rediseno-app`, commit `b7fc571`.
  - Firmware: rama `esp32`, commit `ad5b6ad`.
- **Pruebas que se ejecutaron entonces:** 81 pruebas del banco (todas bien), capturas de las 5 pestañas a 390×844 y 360×740 (ninguna con scroll), `npm audit`. El emulador de reglas no arrancó ese día (JVM portátil caída); las sondas se corrieron después, con el JDK de Android Studio, y confirmaron los huecos de las reglas (ver historial, Etapa 1).

### 1.1 Qué se leyó a fondo (no hace falta releer salvo que haya cambiado, ver la sección 3)

| Componente | Cobertura en la auditoría base |
|---|---|
| `database.rules.json` (lo publicado) | Completa, regla por regla |
| `js/firebase.js` | Completo |
| `js/main.js` | Arranque, envío, cuentas, Mi TV, compartir, galería, canciones y red de seguridad a fondo; vistas previas, scroll y encuadre solo en parte |
| `js/gif.js` | Decodificador y LZW completos |
| `index.html` | Cabecera, controles e IDs; todas las pestañas con capturas |
| `app-android/` | Completo: Manifest, Gradle, `MainActivity`, plugin propio `PortapapelesImagen`, `copiar-web.mjs`, `capacitor.config.json` |
| Firmware `cuenta.cpp`, `github.cpp`, `red.cpp`, `emparejar.cpp` | Completos |
| Firmware `conexion_wifi.cpp`, `buzzer.cpp` | En parte |

### 1.2 Qué se miró solo por encima (la auditoría final debe leerlo de verdad)

- Panel: `js/imageProcessor.js`, `js/dibujo.js`, `js/inoMusical.js`, `js/renderer.js`, `js/compresion.js`, `js/ui.js`, `js/lienzoZoom.js`, `carga-masiva.html`, `css/*`, y las partes de `main.js` de vistas previas, scroll y encuadre. Solo hubo búsquedas dirigidas (límites, `innerHTML`, temporizadores, colores), no lectura línea por línea.
- Firmware: `pantalla.cpp`, `texto.cpp`, `animacion.cpp`, `musical.cpp`, los juegos y los `.ino` (solo concurrencia, `tone()` y copia de archivos).
- No aplican: Firestore, Storage ni Cloud Functions (el proyecto no los usa).

## 2. Estado de los 27 hallazgos (al 2026-11-14)

Leyenda: **Hecho** = arreglado y probado con las pruebas del banco; **Hecho, falta publicar** = el arreglo vive en `database.rules.propuesta.json` y NO protege hasta que el dueño lo publique en la consola; **Hecho, falta probar en la TV real**; **Pendiente**.

| ID | Tema | Estado | Dónde / commits | Qué debe comprobar la auditoría final |
|---|---|---|---|---|
| H-01 | 4 juegos sin licencia | **Pendiente** (Etapa 6) | — | Que Snake, Breakout, Flappy e Invaders estén reescritos desde cero y no quede código del repo sin licencia |
| H-02 | TLS sin verificar y portal Wi-Fi abierto | **Hecho, falta probar en la TV real** (portal con clave) | Firmware `d49dc55`, `c248d70`; `tls.cpp` | Ningún `setInsecure()`; certificados de verdad rechazados (`TVRETRO_PROBAR_TLS` da 6/6); clave del portal aleatoria y solo en la OLED |
| H-03 | Eliminar cuenta y política de privacidad | **Hecho, falta publicar** (reglas) y push a `main` (la página) | `0357fe4`, `b645dd8`, `22dafe0`, `a66f052`, `18389c0` | La baja deja la base limpia; la política dice lo que de verdad se guarda; textos revisados por un abogado |
| H-04 | Anti abuso: `meta`, correo verificado, App Check, presupuesto | **Parcial.** `meta` cerrado, topes y correo verificado: **hecho, falta publicar**. **App Check: decidido NO activar** (la TV no puede obtener el pase). Alerta de presupuesto: pendiente del dueño (hoy es plan Spark, sin cobro) | `34ecd29`, `2a39c24`, `c4a4f07` | Que las reglas publicadas sean las propuestas; revisar si hay abuso real y si hace falta un servidor |
| H-05 | Controles de administrador visibles | **Hecho** | `8e86d47` | Con una cuenta normal no aparecen importar ni borrar canciones |
| H-06 | Acuse de recibo de la TV | **Pendiente** (necesita aprobar un campo) | — | — |
| H-07 | `version` fuera de rango | **Hecho, falta publicar** | `34ecd29` | Sondas de `reglas-etapa2.mjs` |
| H-08 | `pantalla` sin forma y reintento infinito | **Hecho, falta publicar** (reglas); reintentos con espera: **hecho en el firmware** | `34ecd29`; firmware `74a8017` | Contenido inválido rechazado; la TV no martilla la red |
| H-09 | Vinculación en dos escrituras | **Hecho, falta publicar** (con respaldo al camino viejo mientras tanto) | `a7eb729`, `2254624` | Una sola `update()` y sin TV huérfanas |
| H-10 | APK congelada sin internet | **Hecho** (probado en el banco; falta ver en el teléfono con red apagada) | `126182f` | SDK y fuentes locales en el bundle; sin llamadas a CDN en la copia de la APK |
| H-11 | Topes de tamaño de archivo | **Hecho** | `9e4ec19` | 25 MB, 2048 px, 1000 cuadros con mensaje claro |
| H-12 | Galería baja catálogos enteros | **Pendiente** (optimización; necesita aprobación) | — | Coste de descarga con muchos usuarios |
| H-13 | `main.js` monolítico (ahora ~3 400 líneas) | **Pendiente** (gradual) | — | Tamaño y estado global |
| H-14 | Línea de estado y la palabra "Firebase" | **Hecho en lo del texto** (ya no se nombra "Firebase" en pantalla) | `7becc39` | Ningún texto técnico en la interfaz |
| H-15 | Accesibilidad: objetivos táctiles y ARIA | **Pendiente** | — | — |
| H-16 | Dibujo sin goma | **Pendiente** | — | — |
| H-17 | APK lista para publicar: firma, versión, copia de seguridad, botón Atrás | **Hecho** (falta probar Atrás en el teléfono; respaldar el keystore) | `5a4ea2b`, `87f7fcf`, `4f5f839` | Firma de release real; `versionCode` automático; `allowBackup=false` |
| H-18 | Pruebas dentro del repo y CI | **Pendiente.** Las pruebas siguen FUERA del repo (`C:\Proyectos\pruebas-tv-retro`), ahora más numerosas (sección 5) | — | Moverlas a `pruebas/` con rutas relativas y automatizarlas |
| H-19 | OTA y restablecimiento de fábrica | **Pendiente** | — | — |
| H-20 | Cifrado de flash (NVS) | **Pendiente** (al fabricar en serie) | — | — |
| H-21 | CSP, SRI, fuentes de terceros | **Parcial:** la APK ya usa fuentes locales; la web publicada sigue con Google Fonts y sin CSP | `126182f` | — |
| H-22 | Musical se re-sube en cada envío | **Pendiente** (necesita aprobación y firmware) | — | — |
| H-23 | `inoMusical.js` cargado para todos | **Pendiente** | — | — |
| H-24 | Invitaciones vencidas sin limpiar | **Pendiente** | — | — |
| H-25 | `ENTRADA_LOG 1` | **Pendiente a propósito** (a 0 al terminar, antes de vender) | — | Verificar que quede en 0 en el firmware de producción |
| H-26 | `herramientas/` con 8 vulnerabilidades moderadas | **Pendiente** (solo si se vuelve a usar) | — | — |
| H-27 | El panel se libera con el login visible ante un error inesperado | **Pendiente** | — | — |

## 3. Código NUEVO o CAMBIADO desde la auditoría: es lo que hay que auditar

Cambios de la línea base al estado actual (`git diff --stat b7fc571..HEAD` en el panel y `ad5b6ad..HEAD` en el firmware). Todo esto **no se ha visto con ojos de auditor**; lo escribió y probó la misma persona que lo arregló, así que merece una revisión independiente.

### 3.1 Panel (21 archivos, ~2 900 líneas añadidas)

| Qué | Archivos | Puntos a mirar |
|---|---|---|
| **Reglas propuestas completas** (sin publicar) | `database.rules.propuesta.json` (archivo nuevo, ~460 líneas; es una copia ampliada de `database.rules.json`) | Auditarlas enteras, como se hizo con las publicadas: aislamiento entre cuentas, el `.write` que permite borrar `usuarios/{uid}`, correo verificado y sus excepciones (administradores), `meta` cerrado, forma de `pantalla` por tipo, rangos de `version`, topes de tamaño, vinculación atómica y `!newData.exists()`. Verificar que lo publicado sea igual a la propuesta |
| **Acceso a Firebase** | `js/firebase.js` (+200 líneas) | `comprobarCorreoVerificado`, `iniciarSesionConGoogle`/`Nativo`, `proveedorDeLaCuenta`, **`eliminarMiCuenta`** (reautenticación, orden de borrado, reintento si se corta), vinculación en una sola `update()` con respaldo |
| **Lógica del panel** | `js/main.js` (+150 líneas), `js/ui.js`, `js/gif.js` | Login con Google (web y nativo), botón Atrás (`cerrarCapaSuperior`, `configurarBotonAtras`), baja de cuenta (`abrirEliminarCuenta`, `manejarEliminarCuenta`, bandera en `sessionStorage`), topes de archivo, administradores |
| **Visual** | `index.html` (+26), `css/style.css` (+140) | Botón de Google, panel "Eliminar mi cuenta", enlaces de privacidad, medidas sin scroll |
| **Política de privacidad** | `privacidad.html` | Que describa exactamente lo que la app guarda; plazo (15 días hábiles) y edad mínima (14 años) a revisar con un abogado |
| **APK** | `app-android/copiar-web.mjs` (empaqueta Firebase con esbuild), `package.json`, `package-lock.json`, `capacitor.config.json`, `AndroidManifest.xml`, `build.gradle`, `google-services.json`, `.gitignore` | Que el bundle exporte lo que el panel importa; ningún secreto en el repo (`google-services.json` solo trae identificadores públicos; el keystore está fuera); dependencias nuevas (`@capacitor-firebase/authentication`, `firebase`, `esbuild`, fuentes) con `npm audit` |
| **Documentos** | `docs/apk-publicacion.md` (nuevo), `docs/formatos-datos.md`, `docs/historial-cambios.md` | Que coincidan con el código |

### 3.2 Firmware (9 archivos, ~180 líneas añadidas)

| Qué | Archivos | Puntos a mirar |
|---|---|---|
| **TLS verificado** | `tls.cpp`, `tls.h` (nuevos); `cuenta.cpp`, `github.cpp`, `red.cpp`, `emparejar.cpp`, `clima.cpp` | Ninguna conexión sin verificar; paquete de certificados raíz del núcleo; sin comprobación de fechas (limitación conocida: el núcleo no trae `MBEDTLS_HAVE_TIME_DATE`) |
| **Redirecciones y reintentos** | `red.cpp` | Solo sigue redirecciones a `*.firebaseio.com` y `*.firebasedatabase.app`; espera creciente de 3 a 60 s; contenido envenenado ya no martilla la red |
| **Portal Wi-Fi con clave** | `conexion_wifi.cpp` | Clave de 8 caracteres aleatoria, alfabeto sin ambiguos, se muestra en la OLED y no se imprime en el serie ni se escribe a flash |
| **Documento** | `CLAUDE.md` del firmware | Al día |

Nota: el firmware tiene una carpeta `Juegos/` sin seguimiento de git (de antes de la auditoría); decidir si se versiona o se borra.

## 4. Lo que NO hace falta volver a auditar (revisado a fondo y sin cambios desde entonces)

Salvo que cambie, la auditoría final puede darlo por bueno y concentrarse en la sección 3 y en lo nuevo de la sección 6:

- `database.rules.json` publicado (no se ha tocado; las reglas nuevas viven aparte en `database.rules.propuesta.json`, que sí hay que auditar).
- Todo `app-android/android/` salvo lo listado en 3.1: `MainActivity`, el plugin propio `PortapapelesImagen`, la configuración de Capacitor anterior.
- `js/gif.js`: el decodificador y el LZW (solo se añadieron topes al principio).
- Firmware: la lógica de `cuenta.cpp`, `github.cpp`, `emparejar.cpp` y `red.cpp` salvo las líneas de TLS, redirección y reintentos de 3.2 (SSE con espera, renovación de token, `auth_revoked`, latido, tareas por núcleo con mutex, descarga en streaming a LittleFS).
- Los **puntos fuertes** del informe (sección M): modelo de permisos, protocolo de envío por versiones, formatos `z1`/`m1`, privacidad en los logs, documentación.
- Lo que se confirmó **no aplica**: Firestore, Storage, Cloud Functions.

## 5. Pruebas disponibles (FUERA del repo, en `C:\Proyectos\pruebas-tv-retro`)

Resultado de la última corrida (2026-11-14, con todas las etapas hechas):

- **Panel y pantallas (Playwright, Firebase falso):** `pruebas-panel` 14, `bobos` 20, `login` 12, `tv` 13, `compartir` 8, `cuotas` 15, `verificacion` 6, `login-google` 10, `atras` 5, `baja-cuenta` 6, `baja-ui` 8, `apk-sin-internet`, `etapa1-*` (3, 2 y 5). Todas bien.
- **Reglas (emulador de Firebase con `REGLAS_ARCHIVO=…database.rules.propuesta.json`):** `reglas.mjs` 244, `reglas-etapa2` 30, `reglas-atomico` 10, `reglas-envios-reales` 12, `simular-tv` 19, `probar-migracion` 12, `probar-biblioteca` 5, `reglas-borrar-cuenta` 15. Todas bien con la propuesta.
- **Lo que no cubren (la auditoría final debe mirarlo):** la baja de cuenta contra el Firebase real, Google nativo en un teléfono, la clave del portal en la TV real, la estabilidad de memoria del firmware tras varios envíos y un envío real tras publicar las reglas nuevas.
- Entorno: Node 22 y, para el emulador, el JDK de Android Studio (`C:\Program Files\Android\Android Studio\jbr`; la JVM portátil se cae). Las suites `.cjs` se corren con `--only auth,database`.

## 6. Lo que falta hacer y que habrá que auditar al terminar

**Acciones pendientes del dueño (condicionan la auditoría final):**
1. Publicar `database.rules.propuesta.json` en la consola y renombrar archivos (la publicada pasa a `database.rules.sin-etapa2.json`; la propuesta pasa a `database.rules.json`). Hasta entonces las protecciones de la Etapa 2 y la baja de cuenta no están activas.
2. Probar en el proyecto real: cuenta nueva con el aviso de verificar correo, baja de cuenta, Google en el teléfono, el botón Atrás y arrancar sin internet.
3. Portal Wi-Fi con clave en la TV real (router apagado) y repetir 5 veces el mismo GIF para ver la memoria estable.
4. Push a `main` de los dos repos (la página y el APK usan aún el código viejo hasta entonces).
5. Respaldar el keystore y `keystore.properties`; confirmar nombre y paquete (`com.tvretro.app`) antes de Play; registrar la huella de Play App Signing en Firebase si se activa.
6. Plan de Firebase: hoy Spark. Al pasar a Blaze, poner alerta de presupuesto.

**Etapa 6 (aún sin empezar; todo será código nuevo, auditar completo):**
- Reescritura de los 4 juegos (H-01); `ENTRADA_LOG` a 0 (H-25).
- Pestaña "Más" (Galería, Juegos, Alarma, Config), juegos desde la app (campo nuevo `pantalla.tipo = "juego"`, a aprobar), alarma con NTP y zona horaria, Config.
- Configuración de Wi-Fi por Bluetooth desde la app y vinculación automática (decidido el 2026-11-14; web e iOS conservan el portal).
- OTA, restablecimiento de fábrica, tutorial, anuncios (con servidor), acuse de recibo (H-06), nombres de miembros, QR.
- Pendientes de arquitectura y calidad: H-12, H-13, H-15, H-16, H-18 a H-24, H-26, H-27.

## 7. Cómo hacer la auditoría final (procedimiento sugerido)

1. Poner ambos repos limpios y anotar los commits auditados (como en la sección 1).
2. Releer el informe base y la sección 2 de este documento; marcar cada hallazgo como cerrado, parcial o abierto con evidencia (prueba ejecutada, no solo lectura).
3. Auditar a fondo **solo** la sección 3 (código cambiado) y la sección 6 (código nuevo de la Etapa 6), más lo que la sección 1.2 dice que se miró por encima.
4. Correr todas las pruebas de la sección 5 y añadir las nuevas de la Etapa 6.
5. Repetir las sondas del emulador con las reglas **publicadas** (no solo las propuestas): hay que confirmar contra la consola que lo publicado es lo propuesto.
6. Sin repetir las áreas de la sección 4, salvo que `git diff <línea base>..HEAD` muestre cambios en ellas.
7. Entregar un informe nuevo con el mismo formato (A–O, tabla de hallazgos con IDs que sigan desde `H-28`) y actualizar este documento con la nueva línea base.

> **Actualización 2026-11-14:** el dueño publicó las reglas. `database.rules.propuesta.json` pasó a ser `database.rules.json` y las anteriores están en `database.rules.sin-etapa2.json`. Donde este documento dice "propuesta / falta publicar", léase "publicada; falta probar en el proyecto real". La auditoría final debe confirmar en la consola que lo publicado es idéntico a `database.rules.json`.

> **Actualización 2026-11-14 (tarde):** además, `84dbd71` (panel) cambia `js/main.js` (`resolverDispositivo`) y `js/firebase.js` (`esAdministrador`): código nuevo a revisar en la auditoría final. H-10 queda verificado en un teléfono real (arranque sin internet). Pruebas del dueño en el teléfono: Google, correo, envío a la TV, botón Atrás, cuenta nueva con invitación, aviso de correo y baja de cuenta, todas bien. Siguen pendientes de probar en la TV real: la clave del portal Wi-Fi y la estabilidad de memoria con envíos repetidos.

