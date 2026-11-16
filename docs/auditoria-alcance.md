# Auditoría: qué auditar, qué NO auditar y qué falta

> **Este documento manda para la auditoría final.** Una IA (o persona) que lo lea debe saber, sin adivinar, qué revisar y qué dar por revisado.
> Se actualiza al cerrar cada sesión de trabajo (ver sección 8). Los cambios también se anotan en [historial-cambios.md](historial-cambios.md).

## 0. LEER PRIMERO: las tres zonas

La historia del proyecto, para efectos de auditoría, se divide en tres zonas. **Todo lo que no esté en la Zona A es código que ningún auditor independiente ha visto.**

| Zona | Qué es | ¿Se audita en la auditoría final? |
|---|---|---|
| **A. YA AUDITADO** | Lo que existía el 2026-11-12 y que Claude revisó a fondo en la auditoría base (27 hallazgos `H-01`…`H-27`). Líneas base: panel `b7fc571`, firmware `ad5b6ad`. Detalle de lo leído a fondo: secciones 1 y 4. | **NO.** Darlo por revisado, salvo que `git diff` muestre que cambió después (en ese caso ese cambio es de la zona B o C). |
| **B. SESIÓN 2026-11-12 → 2026-11-15** | **Todo lo que se hizo en la conversación larga posterior a la auditoría base**: los arreglos de los hallazgos (Etapas 1 a 5), la APK lista para publicar, y todas las funciones nuevas (Más, juegos desde la app, Alarma, Config, sonido y volumen, buzzer con transistor). Rango de commits: panel `b7fc571..38e8a3c`, firmware `ad5b6ad..9f2c529` (los commits de cierre `ddb4ea0` en el panel y `199350f` en el firmware, "Docs: cierre de la sesión 2026-11-15", solo añaden documentación). Inventario completo en la sección 3. | **SÍ, completa.** La escribió y probó la misma IA que la arregló: necesita ojos independientes. |
| **C. SESIONES POSTERIORES** | Cualquier cambio hecho en conversaciones nuevas: lo posterior a `ddb4ea0` (panel) y a `199350f` (firmware), o sea, después del commit "Docs: cierre de la sesión 2026-11-15" y de los commits de documentación que lo siguen el mismo día. Se va registrando en la sección 8 (cada sesión añade su fila). | **SÍ, completa** (todo lo que figure en la sección 8). |

**Regla práctica para saber en cuál zona cae un cambio:** `git log b7fc571..HEAD` (panel) y `git log ad5b6ad..HEAD` (firmware) lista todo lo que NO es zona A. Con eso, la auditoría final revisa la zona B y la zona C, y ninguna otra cosa.

**Cómo debe actuar la IA que haga la auditoría final:**
1. Leer este documento entero y [CLAUDE.md](../CLAUDE.md).
2. Anotar los commits actuales de ambos repos (línea base nueva).
3. Auditar a fondo la **sección 3** (zona B) y la **sección 8** (zona C). No releer la sección 4.
4. Para cada hallazgo `H-01`…`H-27`, marcar cerrado / parcial / abierto con evidencia (prueba ejecutada, no solo lectura); la tabla de la sección 2 trae el estado de partida.
5. Correr las pruebas de la sección 5, más las que se hayan añadido después.
6. Entregar un informe nuevo con el mismo formato (A–O, tabla de hallazgos con IDs desde `H-28`) y, al final, actualizar este documento con la nueva línea base.

## 1. La auditoría base (2026-11-12): zona A

- Auditoría técnica y de seguridad completa de panel web, APK, firmware y Firebase (solo lectura; no se tocó nada). 27 hallazgos, `H-01` a `H-27`, con gravedad, solución y esfuerzo.
- **Informe completo:** `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-12.md` (fuera del repo, a propósito: describe puntos débiles). Junto a él: `sondas-reglas.mjs` y `capturas.mjs`. Hay que hacer una copia de respaldo de esa carpeta.
- **Versiones auditadas (línea base):** panel, rama `rediseno-app`, commit `b7fc571`; firmware, rama `esp32`, commit `ad5b6ad`.
- **Pruebas de entonces:** 81 pruebas del banco (todas bien), capturas de las 5 pestañas a 390×844 y 360×740 (ninguna con scroll), `npm audit`. Las sondas contra el emulador de reglas se corrieron después con el JDK de Android Studio y confirmaron los huecos de las reglas.

### 1.1 Qué se leyó a fondo (no se vuelve a leer)

| Componente | Cobertura en la auditoría base |
|---|---|
| `database.rules.json` (lo publicado entonces) | Completa, regla por regla |
| `js/firebase.js` | Completo (lo posterior es zona B) |
| `js/main.js` | Arranque, envío, cuentas, Mi TV, compartir, galería, canciones y red de seguridad a fondo; vistas previas, scroll y encuadre solo en parte |
| `js/gif.js` | Decodificador y LZW completos |
| `index.html` | Cabecera, controles e IDs; todas las pestañas con capturas |
| `app-android/` | Completo: Manifest, Gradle, `MainActivity`, plugin propio `PortapapelesImagen`, `copiar-web.mjs`, `capacitor.config.json` |
| Firmware `cuenta.cpp`, `github.cpp`, `red.cpp`, `emparejar.cpp` | Completos |
| Firmware `conexion_wifi.cpp`, `buzzer.cpp` | En parte |

### 1.2 Qué se miró solo por encima (la auditoría final SÍ debe leerlo de verdad)

- Panel: `js/imageProcessor.js`, `js/dibujo.js`, `js/inoMusical.js`, `js/renderer.js`, `js/compresion.js`, `js/ui.js`, `js/lienzoZoom.js`, `carga-masiva.html`, `css/*`, y las partes de `main.js` de vistas previas, scroll y encuadre. Solo hubo búsquedas dirigidas (límites, `innerHTML`, temporizadores, colores), no lectura línea por línea.
- Firmware: `pantalla.cpp`, `texto.cpp`, `animacion.cpp`, `musical.cpp`, los juegos y los `.ino` (solo concurrencia, `tone()` y copia de archivos).
- No aplican: Firestore, Storage ni Cloud Functions (el proyecto no los usa).

## 2. Estado de los 27 hallazgos (al 2026-11-15)

Leyenda: **Hecho** = arreglado y probado (pruebas del banco y, donde se indica, en el teléfono o la TV reales). **Pendiente** = sin hacer.

| ID | Tema | Estado | Dónde / commits | Qué debe comprobar la auditoría final |
|---|---|---|---|---|
| H-01 | 4 juegos sin licencia | **Pendiente** (próxima conversación) | — | Que Snake, Breakout, Flappy e Invaders estén reescritos desde cero y no quede código del repo sin licencia |
| H-02 | TLS sin verificar y portal Wi-Fi abierto | **Hecho, probado en la TV real** (el portal pide la clave que se muestra en la OLED y abre el portal, 2026-11-15) | Firmware `d49dc55`, `c248d70`; `tls.cpp` | Ningún `setInsecure()` (solo quedan en comentarios); certificados falsos rechazados (`TVRETRO_PROBAR_TLS` da 6/6); clave del portal aleatoria y solo en la OLED |
| H-03 | Eliminar cuenta y política de privacidad | **Hecho, publicado y en `main`** (falta que un abogado revise los textos) | `0357fe4`, `b645dd8`, `22dafe0`, `a66f052`, `18389c0` | La baja deja la base limpia; la política dice lo que de verdad se guarda |
| H-04 | Anti abuso: `meta`, correo verificado, App Check, presupuesto | **Parcial.** `meta` cerrado, topes y correo verificado: hecho y publicado. **App Check: decidido NO activar** (la TV no puede obtener el pase). Alerta de presupuesto: pendiente del dueño (hoy plan Spark, sin cobro) | `34ecd29`, `2a39c24`, `c4a4f07` | Revisar si hay abuso real y si hace falta un servidor |
| H-05 | Controles de administrador visibles | **Hecho** | `8e86d47` | Con una cuenta normal no aparecen importar ni borrar canciones |
| H-06 | Acuse de recibo de la TV | **Pendiente** (necesita aprobar un campo) | — | — |
| H-07 | `version` fuera de rango | **Hecho, publicado** | `34ecd29` | Sondas de `reglas-etapa2.mjs` |
| H-08 | `pantalla` sin forma y reintento infinito | **Hecho** (reglas publicadas; reintentos con espera en el firmware) | `34ecd29`; firmware `74a8017` | Contenido inválido rechazado; la TV no martilla la red |
| H-09 | Vinculación en dos escrituras | **Hecho, publicado** (conserva un respaldo al camino viejo) | `a7eb729`, `2254624` | Una sola `update()` y sin TV huérfanas |
| H-10 | APK congelada sin internet | **Hecho, probado en el teléfono** (pantalla "Sin conexión" con Reintentar) | `126182f`, `84dbd71` | SDK y fuentes locales en el bundle; sin llamadas a CDN en la copia de la APK |
| H-11 | Topes de tamaño de archivo | **Hecho** | `9e4ec19` | 25 MB, 2048 px, 1000 cuadros con mensaje claro |
| H-12 | Galería baja catálogos enteros | **Pendiente** (optimización; necesita aprobación) | — | Coste de descarga con muchos usuarios |
| H-13 | `main.js` monolítico (ahora ~3 800 líneas) | **Pendiente** (gradual; creció con Más, Alarma y Config) | — | Tamaño y estado global |
| H-14 | Línea de estado y la palabra "Firebase" | **Hecho en lo del texto** | `7becc39` | Ningún texto técnico en la interfaz |
| H-15 | Accesibilidad: objetivos táctiles y ARIA | **Pendiente** (los botones nuevos de volumen usan `aria-pressed`) | — | — |
| H-16 | Dibujo sin goma | **Pendiente** | — | — |
| H-17 | APK lista para publicar: firma, versión, copia de seguridad, botón Atrás | **Hecho, probado en el teléfono** (Google, Atrás, cuenta nueva). Falta respaldar el keystore y confirmar nombre y paquete | `5a4ea2b`, `87f7fcf`, `4f5f839` | Firma de release real; `versionCode` automático; `allowBackup=false` |
| H-18 | Pruebas dentro del repo y CI | **Pendiente.** Las pruebas siguen FUERA del repo (`C:\Proyectos\pruebas-tv-retro`), ahora 31 suites (sección 5) | — | Moverlas a `pruebas/` con rutas relativas y automatizarlas |
| H-19 | OTA y restablecimiento de fábrica | **Pendiente** | — | — |
| H-20 | Cifrado de flash (NVS) | **Pendiente** (al fabricar en serie; ahora la NVS guarda también alarmas y ajustes, sin datos sensibles) | — | — |
| H-21 | CSP, SRI, fuentes de terceros | **Parcial:** la APK ya usa fuentes locales; la web publicada sigue con Google Fonts y sin CSP | `126182f` | — |
| H-22 | Musical se re-sube en cada envío | **Pendiente** (necesita aprobación y firmware) | — | — |
| H-23 | `inoMusical.js` cargado para todos | **Pendiente** | — | — |
| H-24 | Invitaciones vencidas sin limpiar | **Pendiente** | — | — |
| H-25 | `ENTRADA_LOG 1` | **Pendiente a propósito** (a 0 al terminar, antes de vender; hoy está en 1 en `entrada.h`) | — | Verificar que quede en 0 en el firmware de producción |
| H-26 | `herramientas/` con 8 vulnerabilidades moderadas | **Pendiente** (solo si se vuelve a usar) | — | — |
| H-27 | El panel se libera con el login visible ante un error inesperado | **Pendiente** | — | — |

## 2b. Resultado de la auditoría del 2026-11-15 (zona B) y estado de sus hallazgos

Informe completo: `C:\Proyectos\TV_RETRO-auditoria\auditoria-2026-11-15.md` (con sondas, capturas y evidencia). **Líneas base auditadas:** panel `3f880dc`, firmware `c2c9a0d`. Cambió el estado de varios H-01…H-27 (en el informe, con evidencia): **cerrados** H-02, H-05, H-07, H-08, H-09, H-10, H-14 y H-17 (en código); **parciales** H-03 (falta la revisión legal; H-34 ya está hecho), H-04, H-11 (H-39, hecho), H-15 y H-21; el resto sigue abierto (H-13 empeoró: `main.js` ~3 800 líneas).

| ID | Gravedad | Tema | Estado |
|---|---|---|---|
| H-28 | ALTO | La TV queda muda tras entrar a Juegos (`pinMode` suelta el PWM) | **Arreglado** (firmware `3d2e198`); falta probar en la TV |
| H-29 | ALTO | Guardar Alarma/Ajustes antes de cargar pisa lo guardado | **Arreglado** (panel `5b733cf`, prueba `auditoria-b`) |
| H-30 | MEDIO | m1 malformado deja la TV reiniciándose | **Arreglado** (firmware `cfa6b89`); falta probar en la TV |
| H-31 | MEDIO | Las órdenes (alarma, ajustes, juego) reemplazan `pantalla` | **Abierto: decide el dueño** (opciones b o c, ver `CLAUDE.md` sección 9) |
| H-32 | MEDIO | La orden de alarma/ajustes se puede perder | **Arreglado** (firmware `b193e51`) |
| H-33 | MEDIO | Tras la alarma la OLED queda en "ALARMA" con un musical | **Arreglado** (firmware `cfa6b89`, `b193e51`); falta probar en la TV |
| H-34 | MEDIO | Desvincular deja contenido y alarmas al siguiente dueño | **Arreglado** (panel `96c8c6e`, firmware `b193e51`; reglas comprobadas en el emulador) |
| H-35 | MEDIO | "Volver" atrapado en la Galería con un GIF elegido | **Arreglado** (panel `ea3deaa`) |
| H-36 | MEDIO | Sin Wi-Fi al encender, la TV no llega al `loop()` | **Abierto: decide el dueño** |
| H-37 | BAJO | Guardar alarma/ajustes sin aviso de conexión lenta | **Arreglado** (panel `5b733cf`) |
| H-38 | BAJO | Carrera sobre el archivo del tono | **Arreglado** (firmware `b193e51`) |
| H-39 | BAJO | Sin tope de píxeles para una imagen fija | **Arreglado** (panel `3b7a12a`) |
| H-40 … H-50 | BAJO | `npm audit` de la APK, copia entre dispositivos, textos legales, licencias, id de los juegos, documentación (H-45, puesta al día en esta sesión), 7 px de scroll en Texto a 360×740, tamaño del slot OTA, zonas horarias, fechas de TLS, topes de `inoMusical` | Abiertos (ver informe) |

**Pendiente de la lectura línea por línea (sección 1.2):** `renderer.js`, `imageProcessor.js` (solo se miró el tamaño del lienzo), `ui.js` fuera de los IDs, `carga-masiva.html`, el CSS y la lógica interna de los 5 juegos. La auditoría no sacó conclusiones de esos archivos.

## 3. ZONA B: todo lo hecho en la sesión 2026-11-12 → 2026-11-15 (hay que auditarlo)

Rango: panel `b7fc571..38e8a3c` (56 commits, `git diff --stat b7fc571..38e8a3c`) y firmware `ad5b6ad..9f2c529` (13 commits). Todo fue escrito y probado por la misma IA que lo arregló y ningún tercero lo ha leído. Cada fila dice qué cambió y qué mirar.

### 3.1 Arreglos de los hallazgos de la auditoría (Etapas 1 a 5)

| Etapa | Commits (panel salvo que diga firmware) | Archivos principales | Puntos a mirar |
|---|---|---|---|
| **1: arreglos rápidos** (2026-11-12) | `8e86d47`, `7becc39`, `9e4ec19`, `a7eb729`, `2254624` | `js/firebase.js`, `js/main.js`, `js/gif.js`, `index.html` | Importar/borrar canciones solo para administradores; topes de imagen y GIF; vincular y unirse a una TV en una sola escritura con respaldo (`a7eb729` valida la lista de TV contra el estado posterior) |
| **2: reglas cerradas, correo verificado, Google web** | `34ecd29`, `2a39c24`, `fd80f15`, `2238dc8` | `database.rules.json`, `js/firebase.js`, `js/main.js`, `index.html` | `version` entera y acotada, `pantalla` con forma cerrada, `meta` cerrado, correo verificado para guardar (excepciones: administradores); `iniciarSesionConGoogle`, `comprobarCorreoVerificado` |
| **3: APK lista para publicar** (2026-11-12) | `126182f`, `5a4ea2b`, `87f7fcf` | `app-android/copiar-web.mjs` (empaqueta Firebase con esbuild), `package.json`, `AndroidManifest.xml`, `build.gradle`, `.gitignore`, `docs/apk-publicacion.md` | El bundle exporta lo que el panel importa; ningún secreto en el repo (el keystore está fuera); `versionCode` desde `package.json`; botón Atrás (`cerrarCapaSuperior`, `configurarBotonAtras`); dependencias nuevas y `npm audit` |
| **Google nativo en la APK** | `4f5f839` | `js/firebase.js`, `google-services.json`, `capacitor.config.json` | `iniciarSesionConGoogleNativo`; `google-services.json` solo trae identificadores públicos; huella SHA-1 de la clave de subida registrada en Firebase |
| **4: firmware, red** | firmware `d49dc55`, `74a8017`, `c248d70` | `tls.cpp`/`tls.h` (nuevos), `cuenta.cpp`, `github.cpp`, `red.cpp`, `emparejar.cpp`, `clima.cpp`, `conexion_wifi.cpp` | Ninguna conexión sin verificar (paquete de certificados raíz del núcleo; sin comprobación de fechas: limitación conocida); redirecciones solo a `*.firebaseio.com` y `*.firebasedatabase.app`; espera creciente de 3 a 60 s; clave de 8 caracteres del portal, solo en la OLED, no en el serie ni en flash |
| **5: baja de cuenta y privacidad** | `0357fe4`, `b645dd8`, `22dafe0`, `a66f052`, `c4a4f07`, `18389c0` | `database.rules.json`, `js/firebase.js` (`eliminarMiCuenta`: reautenticación, orden de borrado, reintento si se corta), `js/main.js` (`abrirEliminarCuenta`, `manejarEliminarCuenta`), `privacidad.html` | La baja deja la base limpia; la política describe lo que se guarda; plazo (15 días hábiles) y edad mínima (14 años) a revisar con un abogado |
| **Arranque sin internet** (2026-11-14) | `84dbd71` | `js/main.js` (`resolverDispositivo`), `js/firebase.js` (`esAdministrador`, `listarMisDispositivos` con tope de tiempo) | Pantalla "Sin conexión" inmediata, Reintentar y continuar solo al volver la red |
| **Reglas publicadas** | `e7c8efc`, `2562dc7`, `bca06dc`, `e677776`, `bd26633` | `database.rules.json` y copias de vuelta atrás `database.rules.sin-*.json` | Confirmar en la consola de Firebase que lo publicado es **idéntico** a `database.rules.json` |

### 3.2 Funciones nuevas (Etapa 6, parte hecha)

| Función | Commits | Archivos | Puntos a mirar |
|---|---|---|---|
| **Más** (menú Galería / Juegos / Alarma / Config, cada opción en su pantalla con volver) | `bb3bf28`, `e140ca9`, `f70c9c3`, `9b0b620`, `18ce639` | `index.html`, `css/style.css`, `js/main.js` (`cambiarMasVista`, `volverEnMas`, `abrirApartadoConfig`; el Atrás de la APK baja un nivel) | Ningún ID renombrado; cada pantalla sin scroll en 390×844 y 360×740; Atrás por niveles |
| **Juegos desde la app** (`pantalla.tipo = "juego"` con `juego.id`) | `e140ca9`, `5602dcb`, `ede0cdd`; firmware `c243cda` | `js/firebase.js` (rama `juego` de `enviarEstado`), reglas (1 a 12 letras minúsculas), `OLED_Remota.ino` (orden), `juegos.cpp` (`juegos_iniciarPorId`), `github.cpp`, `modelo.h` (`juegoId`) | Una orden vieja no arranca un juego al encender; no se puede mandar un id arbitrario (reglas y firmware ignoran lo desconocido); la orden no pisa el contenido mostrado |
| **Alarma** (hasta 3, hora, días, tono de canción) | `29e902b`, `1893906`, `9b42c3e`, `38b6fde`, `214f164`, `a765574`; firmware `cdb4f9d`, `acdafd0`, `7d35b7f` (los cuatro commits `c994349`, `5c8429d`, `406e930`, `f0411c1` son un cambio a 24 h y su reversión: efecto neto cero) | `js/firebase.js` (`cargarAlarma`, `guardarAlarma`, `normalizarAlarma`), `js/main.js`, reglas (nodo `alarma`); firmware `alarma.cpp/.h`, `sincronizarAlarma()` y `descargarTonoAlarma()` en `github.cpp`, gancho en el `.ino` | Descarga de un archivo desde una clave elegida por el cliente (codificación de la dirección y validación del archivo "M1"); una alarma mal formada no deja la TV sin sonar ni sonando sin parar (se calla al minuto); carreras entre núcleos (candado de `alarma.cpp`); espacio en LittleFS; alarmas solapadas se absorben |
| **Config** (Mi cuenta, Ajustes de la TV, Ayuda y contacto, Legal) | `424e4a8`, `5d477f2`, `049287c`, `499a2ab`, `2b7abab`; firmware `de26b5a` | `js/main.js` (`mostrarMiCuenta`, `abrirAjustesTV`, `guardarAjustesEnLaTV`), `js/firebase.js` (`cargarAjustes`, `guardarAjustes`, `normalizarAjustes`), reglas (nodo `ajustes`: brillo 1-3, volumen 0-3, zona -720..840), `ayuda.html`, `terminos.html` (borrador), `licencias.html`; firmware `ajustes.cpp/.h`, `sincronizarAjustes()` | `terminos.html` y las FAQ a revisar con un abogado; `licencias.html` no lista los 4 juegos sin licencia (a propósito); zona horaria (`TZ` con signo invertido) |
| **Sonido y volumen** | firmware `de26b5a`, `27b1138`, `54dba6e`, `788eaf5` | `sonido.cpp/.h` (PWM LEDC propio; pulso {0, 12, 50, 512}); reemplaza a `tone()`/`noTone()` en `buzzer.cpp`, `musical.cpp`, `juegos.cpp`, `juegos_base.cpp` | Ningún sonido queda pegado al cambiar de modo o al terminar; la alarma suena aunque el volumen esté en Silencio (a nivel Medio); `ledcAttach` solo la primera vez |
| **Buzzer con transistor** (cambio de HARDWARE, 2026-11-15) | firmware `9f2c529` (documentación) | `README.md` y `CLAUDE.md` del firmware | El buzzer ya no va directo al GPIO 4: NPN + 1 kΩ + diodo en paralelo; las TV que se fabriquen deben llevarlo; sigue a 3,3 V |
| **Documentos** | varios `Docs:` | `CLAUDE.md`, `docs/*.md` | Que coincidan con el código |

Nota: el firmware tiene una carpeta `Juegos/` sin seguimiento de git (de antes de la auditoría; sketches originales del dueño); decidir si se versiona o se borra.

## 4. ZONA A: lo que NO hace falta volver a auditar

Revisado a fondo en la auditoría base y sin cambios de fondo desde entonces. La auditoría final puede darlo por bueno y concentrarse en las secciones 3 y 8, salvo que `git diff b7fc571..HEAD` (panel) o `git diff ad5b6ad..HEAD` (firmware) muestre cambios en esas áreas:

- Todo `app-android/android/` salvo lo listado en 3.1: `MainActivity`, el plugin propio `PortapapelesImagen`, la configuración de Capacitor anterior.
- `js/gif.js`: el decodificador y el LZW (solo se añadieron topes al principio).
- Firmware: la lógica de `cuenta.cpp`, `github.cpp`, `emparejar.cpp` y `red.cpp` salvo lo de 3.1 y 3.2 (SSE con espera, renovación de token, `auth_revoked`, latido, tareas por núcleo con mutex, descarga en streaming a LittleFS).
- Los **puntos fuertes** del informe base (sección M): modelo de permisos, protocolo de envío por versiones, formatos `z1`/`m1`, privacidad en los logs, documentación.
- Lo que se confirmó **no aplica**: Firestore, Storage, Cloud Functions.

## 5. Pruebas disponibles (FUERA del repo, en `C:\Proyectos\pruebas-tv-retro`)

**Última corrida completa: 2026-11-15, todo en verde** (en la primera vuelta `mas` falló por una expectativa vieja de la prueba, que esperaba tres opciones de menú en vez de cuatro; corregida, 10 de 10).

- **Panel y pantallas (Playwright, Firebase falso):** `pruebas-panel` 14, `bobos` 20, `login` 12, `tv` 13, `compartir` 8, `cuotas` 15, `verificacion` 6, `login-google` 10, `atras` 5, `baja-cuenta` 6, `baja-ui` 8, `sin-red-arranque` 3, `apk-sin-internet` 1, `etapa1-sin-firebase` 2, `etapa1-topes` 5, `etapa1-admin-canciones` 3, `mas` 10, `alarma` 11, `config` 11, `carga-masiva-cuentas` 6.
- **Reglas (emulador con `REGLAS_ARCHIVO=…database.rules.json`):** `reglas` 244, `reglas-etapa2` 30, `reglas-atomico` 10, `reglas-envios-reales` 12, `reglas-borrar-cuenta` 12, `reglas-juego` 15, `reglas-alarma` 33, `reglas-ajustes` 22, `simular-tv` 19, `probar-migracion` 12, `probar-biblioteca` 5.
- **Probado a mano por el dueño en el teléfono y la TV reales:** Google, correo, envío a la TV, botón Atrás, cuenta nueva con invitación, aviso de verificar correo, baja de cuenta, arranque sin internet, portal Wi-Fi con clave (2026-11-15), alarma (suena, se calla al minuto, pospone, saca del juego, sobrevive a reiniciar), Config (brillo, volumen, zona horaria) y **memoria estable con 9 envíos seguidos del mismo GIF** (2026-11-15, por el monitor serie: memoria libre 104 a 105 KB sin bajar, descarga de 23 233 B en 0,85 a 1,03 s, sin reinicios ni errores).
- **Lo que no cubren (la auditoría final debe mirarlo):** la baja de cuenta contra el Firebase real, la clave del portal contra un ataque real, el contenido de `terminos.html` y `privacidad.html` (abogado), el rendimiento de `main.js` (~3 800 líneas) y todo lo de la sección 1.2.
- Cómo correrlas: **todo el banco** con `bash C:/Proyectos/pruebas-tv-retro/todo-el-banco.sh` (deja una línea por suite; el detalle de cada una en `/tmp/b-<suite>.txt`; tarda ~40 min: lanzarlo como proceso aparte para que no se corte). **Monitor serie de la TV:** `powershell -File C:/Proyectos/pruebas-tv-retro/escuchar-serie.ps1 > archivo.txt` (escribe a la salida estándar; correrlo en segundo plano y redirigir). Abrir el puerto reinicia la TV.
- Entorno: Node 22 (Node 26 se cae) y, para el emulador, el JDK de Android Studio (`C:\Program Files\Android\Android Studio\jbr`). Las suites `.cjs` se corren con `--only auth,database` y `simular-tv.cjs` con `--project demo-tvretro`. Las suites con Playwright usan el puerto 8765: una corrida cortada puede dejar un `tv.mjs` ocupándolo (hay que cerrarlo antes de repetir).

## 6. Lo que falta hacer (todo será zona C: auditar al terminar)

**Próxima conversación: JUEGOS (H-01).** Reescribir Snake, Breakout, Flappy e Invaders desde cero (sin licencia; Jump es Unlicense y se queda), pulir tiempos y estética, récords en NVS, botón A capacitivo.

**Detalles antes de vender (para el final):**
- **Subir la APK a Google Play: cuando el dueño lo avise en una conversación nueva, Claude lo ayuda a empaquetar la app en el formato que Google exige (el AAB firmado).** Pasos y estado en [apk-publicacion.md](apk-publicacion.md) (`gradlew bundleRelease`). Antes: confirmar nombre y paquete (`com.tvretro.app` es provisional), respaldar el keystore y `keystore.properties`, registrar la huella de Play App Signing en Firebase.
- `ENTRADA_LOG` a 0 en el firmware de producción (H-25).
- Revisión de `terminos.html`, `ayuda.html` y `privacidad.html` por un abogado.
- Alerta de presupuesto de Firebase si se pasa a Blaze.
- Fabricar las TV con el buzzer detrás del transistor.

**Resto de la Etapa 6 y mejoras:** configuración de Wi-Fi por Bluetooth desde la app y vinculación automática (decidido el 2026-11-14; web e iOS conservan el portal), OTA, restablecimiento de fábrica, tutorial guiado, anuncios (con servidor), acuse de recibo (H-06), nombres de miembros, QR, y los pendientes de arquitectura y calidad H-12, H-13, H-15, H-16, H-18 a H-24, H-26 y H-27.

## 7. Procedimiento sugerido para la auditoría final

1. Poner ambos repos limpios y anotar los commits auditados (como en la sección 1).
2. Leer el informe base y la sección 2; marcar cada hallazgo como cerrado, parcial o abierto con evidencia.
3. Auditar a fondo **solo** la zona B (sección 3) y la zona C (sección 8), más lo que la sección 1.2 dice que se miró por encima.
4. Correr todas las pruebas de la sección 5 y añadir las nuevas.
5. Repetir las sondas del emulador con las reglas **publicadas**, no solo las del repo: confirmar contra la consola que lo publicado es lo mismo que `database.rules.json`.
6. No repetir la zona A (sección 4), salvo que `git diff <línea base>..HEAD` muestre cambios.
7. Entregar un informe nuevo (A–O, IDs desde `H-28`) y actualizar este documento con la nueva línea base.

## 8. ZONA C: registro de sesiones posteriores (cada sesión nueva añade su fila)

Todo lo que figure aquí también se audita. **Cada conversación que cambie código debe añadir su fila** (fecha, commits de cada repo, qué cambió, qué mirar) antes de cerrar.

| Fecha | Commits (panel / firmware) | Qué cambió | Puntos a mirar |
|---|---|---|---|
| 2026-11-15 (auditoría y arreglos) | **Panel:** `ea3deaa`, `96c8c6e`, `3b7a12a`, `5b733cf` (más los de documentación). **Firmware:** `3d2e198`, `cfa6b89`, `b193e51` | Arreglos de la auditoría del 2026-11-15: H-28, H-29, H-30, H-32, H-33, H-34, H-35, H-37, H-38, H-39 (ver 2b) | Que `sonido_tono()` se reconecte sin perder el volumen; que un m1 válido siga sonando (topes: 200 000 notas o cuadros, 65 535 imágenes); que `olvidarContenido()` no borre contenido de una TV con dueño; que la limpieza de `desvincularDispositivo` no choque con las reglas (probado en el emulador); **todo el firmware está compilado pero NO grabado ni probado en la TV** |
