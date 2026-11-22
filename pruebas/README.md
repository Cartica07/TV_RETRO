# Banco de pruebas de TV RETRO

Desde el 2026-11-15 el banco vive **dentro del repo** (antes estaba en `C:\Proyectos\pruebas-tv-retro`, fuera de él). Todas las rutas son relativas, así que funciona en cualquier carpeta y en CI.

## Qué hay

- **Panel (Playwright, Firebase falso en memoria):** `pruebas-panel`, `bobos` (usuario impaciente), `login`, `tv`, `compartir`, `cuotas`, `verificacion`, `login-google`, `atras`, `tutorial` (tutorial guiado, 2026-11-21: sale la primera vez, Saltar, Ver tutorial, Atrás, sin scroll; el resto del banco lo da por visto desde `banco.mjs`), `baja-cuenta`, `baja-ui`, `sin-red-arranque`, `apk-sin-internet`, `etapa1-*`, `mas`, `alarma`, `config`, `auditoria-b` y `carga-masiva-cuentas`. El panel se sirve desde esta misma copia del repo; `falso/` reemplaza el SDK de Firebase. **No tocan la base real.**
- **Reglas (emulador de Firebase):** `reglas*.mjs`, contra `database.rules.json` (o contra otro archivo con `REGLAS_ARCHIVO`, por ejemplo lo publicado en la consola).
- **Herramientas (emulador de Auth y base):** `simular-tv.cjs` (necesita el repo del firmware al lado, o `RUTA_FIRMWARE`), `probar-migracion.cjs` y `probar-biblioteca.cjs` (necesitan `npm ci` en `herramientas/`). Sin esos recursos se omiten.
- **Añadidas el 2026-11-17/18:** panel `sistema` (Config > Sistema), reglas `reglas-apodos` y `reglas-firmware`, y la herramienta `liberar-tv.cjs` (soporte: suelta una TV de una cuenta perdida; necesita el repo del firmware al lado). Total: 40 suites y el intérprete.
- **Intérprete de .ino:** `ino-infinito.mjs` (4 casos que deben cortarse a tiempo).

## Cómo correrlo

Requisitos: **Node 22** (Node 26 se cae en el emulador) y **Java 21** (en el equipo del dueño se usa el JDK de Android Studio, el script lo detecta).

```
cd pruebas
npm ci
npx playwright install chromium      # en el equipo del dueño se usa Edge y no hace falta
bash todo-el-banco.sh                # todo el banco (~40 min); deja el detalle de cada suite en $SALIDA (por defecto /tmp)
node login.mjs                       # una suite de panel suelta
npx firebase emulators:exec --only database --project demo-reglas "node reglas.mjs"   # una de reglas
```

`todo-el-banco.sh` termina con código distinto de cero si alguna suite falla. Con `REGLAS_ARCHIVO=ruta/a/publicadas.json` corre las suites de reglas contra lo que haya publicado en la consola.

## Reglas del proyecto sobre las pruebas

- Las pruebas largas **no se corren durante la edición** de un cambio: solo cuando el dueño confirma que esa versión es la final. Una suite suelta para comprobar algo puntual sí se puede correr.
- Un arreglo de un hallazgo lleva su escenario en `auditoria-b.mjs` (o en la suite que corresponda).
- La CI (`.github/workflows/pruebas.yml`) corre todo el banco en cada push a `main` y a mano.
