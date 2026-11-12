# Seguridad y cuentas: puesta en marcha (paso 7)

> **HECHA el 2026-11-11.** Se siguió este orden y funcionó: cuenta del dueño, TV fabricada, datos migrados (con respaldo en `herramientas/salida/`, fuera de git), reglas publicadas, credenciales enviadas por COM6 y prueba del dueño. Esta guía queda para fabricar TV nuevas y como plan de vuelta atrás.

Guía para pasar la TV y el panel del dueño de las rutas abiertas de hoy a la estructura con cuentas. Todo el código ya está hecho y probado (ver `docs/historial-cambios.md`, etapa 8). Lo único que falta es esta puesta en marcha, que toca la consola de Firebase y la placa.

**Idea central:** primero se copian los datos a las rutas nuevas y se prepara la TV; las reglas nuevas se publican al final. Lo viejo nunca se borra, así que siempre se puede volver atrás.

## Antes de empezar: qué tiene que hacer el dueño en la consola de Firebase

Proyecto `lorenita-6ad1e`, https://console.firebase.google.com

1. **Authentication > Método de acceso > Correo electrónico/contraseña: Habilitar** (dejar "Vínculo del correo electrónico" apagado). Si Authentication pide "Comenzar", pulsarlo primero.
2. **Authentication > Configuración > Dominios autorizados:** debe estar `localhost` (viene) y, si se usa el panel publicado, `cartica07.github.io`.
3. **Configuración del proyecto (engranaje) > Cuentas de servicio > Generar nueva clave privada.** Guardar el archivo `.json` FUERA de los repositorios (por ejemplo `C:\Proyectos\claves\lorenita-servicio.json`). Es una llave maestra del proyecto: no se sube, no se pega en ningún chat y se borra al terminar. Se le avisa a Claude solo la ruta del archivo.

No hay que activar el plan Blaze ni nada con tarjeta.

## Orden de la puesta en marcha

Cada paso dice quién lo hace. Mientras no se publiquen las reglas nuevas (paso 7), todo lo de hoy sigue funcionando.

1. **Claude:** instala las herramientas (`herramientas/` del panel y del firmware: `firebase-admin` y `serialport`, con Node 22) y graba en la placa el firmware nuevo. El firmware nuevo, SIN credenciales, funciona igual que el de hoy.
2. **Dueño:** abre el panel en modo cuentas, `http://localhost:3000/?cuentas=1`, toca "Crear cuenta" y crea su cuenta (correo y contraseña). Quedará en "No se pudo cargar tus TV: sin permiso": es lo esperado, todavía no están las reglas ni los datos nuevos.
3. **Claude:** fabrica la cuenta de la TV (`fabricar-tv.cjs --archivo`) y obtiene su `id`. No se toca la placa todavía.
4. **Claude:** migra los datos (`migrar-datos.cjs --correo <correo del dueño> --tv <id>`): hace un respaldo completo y COPIA `oled_remota`, `imagenes` y `animaciones` a las rutas nuevas, y deja a la cuenta del dueño como dueña de la TV y administradora. Lo viejo queda intacto.
5. **Dueño:** en Realtime Database > Reglas, pega el contenido de `database.rules.json` y pulsa Publicar. **Desde este momento las rutas viejas se cierran** (la TV y el panel de hoy dejan de funcionar hasta los pasos 6 y 7).
6. **Claude:** manda las credenciales a la TV por el puerto serie (`fabricar-tv.cjs --enviar-archivo ... --puerto COM6`). La TV reinicia, inicia sesión y usa su ruta nueva. Se comprueba en el monitor serie: `[cuenta] modo cuentas`, `[cuenta] sesión iniciada`, `[red] streaming conectado`.
7. **Ambos:** en `http://localhost:3000/?cuentas=1` el dueño entra con su cuenta; debe aparecer su TV y todo lo de siempre (texto, imagen, dibujo, canciones, galería). Enviar algo y verlo en la TV.
8. **Claude:** cambia `USAR_CUENTAS` a `true` en `js/main.js` (commit aparte), prueba, reconstruye la APK y hace el push cuando el dueño lo pida.

## Cómo volver atrás

- **Reglas:** en la consola, publicar el contenido de `database.rules.antiguas.json` (las reglas abiertas de antes de la migración). `database.rules.json` es lo publicado con cuentas.
- **TV:** por el puerto serie, la línea `TVRETRO_BORRAR_CREDENCIALES` borra las credenciales y la TV vuelve a las rutas viejas.
- **Datos:** el respaldo completo queda en `herramientas/salida/respaldo-<fecha>.json` (se guarda fuera de git). Las rutas viejas nunca se borran.

## Después de la puesta en marcha

- Borrar la clave de servicio descargada (o guardarla muy bien).
- Más adelante, cuando todo esté estable, se pueden borrar de la base las rutas viejas (`oled_remota`, `imagenes`, `animaciones`).
- Pendiente del plan: paso 8, límites por cuenta (imágenes y GIF).

## Paso 8: límites por cuenta y biblioteca predeterminada (puesta en marcha)

> **Avance (2026-11-12):** hechos los pasos 1 a 3 (clave nueva, piezas copiadas a `biblioteca/` con respaldo, reglas publicadas y verificadas: idénticas al archivo). `database.rules.json` ya es lo publicado; las anteriores quedaron en `database.rules.sin-limites.json` (cuentas sin límites) y `database.rules.antiguas.json` (abiertas). Paso 4 hecho el mismo día (copias personales quitadas con el OK del dueño; catálogo personal en 0 y biblioteca con 29 imágenes y 9 animaciones). Faltan los pasos 5 (push a `main` y APK nueva) y 6 (borrar la clave de servicio).

Código y reglas listos y probados (`database.rules.propuesta.json`, 190 casos; `cuotas.mjs`, 15 escenarios). Tope: 25 elementos en total y máximo 10 GIF; el administrador sin límite y puede borrar las predeterminadas. Orden, para no dejar nada sin funcionar:

1. **Dueño:** genera una clave de servicio nueva (Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada), la guarda en `C:\Proyectos\claves\` y avisa la ruta.
2. **Claude:** `herramientas/mover-a-biblioteca.cjs --correo <correo del dueño>` COPIA las imágenes y animaciones del catálogo personal a `biblioteca/` (con respaldo). Aún no se quita nada.
3. **Dueño:** publica en la consola el contenido de `database.rules.propuesta.json`.
4. **Claude:** comprueba con el Admin SDK que todo quedó bien y, con OK del dueño, corre el mismo script con `--borrar-personales` para que las predeterminadas no estén duplicadas en el catálogo personal. Renombra los archivos de reglas (`database.rules.json` = publicado; las anteriores a `database.rules.antiguas.json`).
5. **Dueño:** push a `main` del panel y **Claude** reconstruye la APK. El panel nuevo es el que muestra las predeterminadas y respeta el límite.
6. **Dueño:** borra la clave de servicio.

Mientras el paso 5 no se haga, el panel publicado (versión anterior) funciona para el administrador (sin límite) pero una cuenta normal no podría guardar (las reglas nuevas exigen el contador).

**Volver atrás:** publicar las reglas anteriores (`database.rules.json` en ese momento). Los datos de `biblioteca/` y `cuotas/` no estorban a las reglas anteriores.
