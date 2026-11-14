# APK: compilar, firmar y publicar

Estado: **2026-11-12** (Etapa 3 de la auditoría). La APK de depuración que el dueño tiene instalada es anterior; esta guía es para la siguiente.

## Qué lleva la APK ahora

- El panel (`index.html`, `css/`, `js/`) copiado a `app-android/www/` por `copiar-web.mjs`; el repo del panel no cambia.
- **Funciona sin internet al abrir:** el SDK de Firebase (app + database + auth, ~250 KB, versión fija igual a la del navegador) y las fuentes (Space Grotesk y JetBrains Mono, subconjunto latino) van dentro (`www/js/vendor/firebase.js`, `www/fonts/`). Antes se bajaban de gstatic y Google Fonts y, sin red, el panel quedaba congelado sin mensaje. Sin conexión se ve el login (o el panel, si había sesión) y los envíos quedan pendientes como siempre.
- **Botón Atrás** (plugin `@capacitor/app`): cierra el lienzo expandido, vuelve de Compartir a Mi TV, cierra Mi TV y, si no hay nada abierto (o está "Añade tu TV" o el login), sale.
- `allowBackup="false"` (la sesión no entra en las copias de seguridad), permiso solo `INTERNET`, `targetSdk` 36, `minSdk` 24.
- **Versión:** sale de `app-android/package.json` (`"1.2.3"` → `versionName 1.2.3`, `versionCode 10203`). Para publicar una versión nueva hay que subirla ahí (hoy `0.2.0` → código 200; la de depuración vieja era 1).

## Compilar

Desde `C:\Proyectos\TV_RETRO\app-android`:

```
node copiar-web.mjs            # copia el panel a www/ (+ SDK y fuentes locales)
npx cap sync android           # solo si cambian plugins o capacitor.config.json
cd android
gradlew assembleDebug          # APK de depuración  -> app/build/outputs/apk/debug/
gradlew assembleRelease        # APK de publicación -> app/build/outputs/apk/release/
gradlew bundleRelease          # AAB para Google Play -> app/build/outputs/bundle/release/
```

Entorno de este equipo (2026-11-12):

- `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`.
- El JDK 21 portátil (`…\Temp\jdk21-descarga`) **se cae** (`EXCEPTION_ACCESS_VIOLATION`; solo anda con `-Xint`). Se compiló bien con el **JDK 25 de Android Studio** (`JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`) y el **Gradle 9.5** que ya estaba en caché (`%USERPROFILE%\.gradle\wrapper\dists\gradle-9.5.0-bin\…\bin\gradle`, con `--offline`). El wrapper del proyecto pide Gradle 8.14.3, que no admite Java 25: por eso se llama al `gradle` de la caché directamente (sin tocar el wrapper).
- `adb install -r app\build\outputs\apk\debug\app-debug.apk` (con el teléfono en modo depuración).

## Firma de publicación

- **Clave de subida** creada el 2026-11-12: `C:\Proyectos\TV_RETRO-claves\tvretro-subida.jks` (alias `tvretro`, RSA 2048, 30 años). Sus contraseñas están en `app-android/android/keystore.properties` (ignorado por git, igual que `*.jks` y `*.keystore`; **nunca** se sube).
- **El dueño debe hacer copia de la clave y de `keystore.properties`** en un lugar seguro (fuera de este equipo). Con "Play App Signing" (recomendado) esta es solo la clave de *subida* y Google puede restablecerla si se pierde; la de firma final la guarda Google.
- Sin `keystore.properties`, `assembleRelease` deja `app-release-unsigned.apk` (sin firmar).
- Se verificó con `apksigner verify` ("Verifies").
- Huellas públicas (para registrar la app en Firebase y en Google Cloud):
  - **Subida (release):** SHA-1 `62:9A:94:A7:B9:6E:CC:84:CF:AD:AD:79:F1:2E:0C:63:6D:29:2B:F1`; SHA-256 `84:7C:C6:73:41:DE:30:84:33:A2:9C:88:CB:12:C9:78:8B:DD:77:F1:F0:CD:79:F3:61:EC:FE:09:B6:EA:D6:CB`.
  - **Depuración (este equipo):** SHA-1 `A2:35:0A:DF:CA:6B:CC:F2:CA:56:05:B6:4D:8A:58:2A:37:53:D8:E3`.
  - Si se activa Play App Signing, la consola de Play muestra además la huella de la clave de firma final: también hay que registrarla.

## Antes de subir a Google Play (pendiente)

1. **Nombre y paquete:** hoy `com.tvretro.app` (provisional; ver la memoria `capacitor-nombre-paquete`). **No se puede cambiar después de publicar.**
2. **Eliminar la cuenta desde la app** y **política de privacidad** (Play los exige si se pueden crear cuentas): Etapa 5.
3. Ficha de "seguridad de los datos" y capturas.
4. **Entrar con Google en la APK** (hecho el 2026-11-14, falta probarlo con el botón en el teléfono):
   - Firebase: app Android `com.tvretro.app` registrada con las huellas SHA-1 de arriba y Google activado en Authentication; `google-services.json` está en `app-android/android/app/` y **va en el repo** (solo trae identificadores públicos: proyecto, claves de cliente y huellas; no es secreto).
   - Plugin `@capacitor-firebase/authentication` 8.6.0 con `skipNativeAuth: true` (en `capacitor.config.json`): el selector de cuentas de Android devuelve el `idToken` y `iniciarSesionConGoogleNativo` (`firebase.js`) hace `signInWithCredential` en el SDK web. El botón se muestra en la APK solo si el plugin está (`configurarLogin`).
   - **Si se activa Play App Signing,** hay que añadir en Firebase también la huella SHA-1 de la clave de firma que muestra la consola de Play (la de subida de arriba solo sirve para los APK firmados localmente); luego volver a descargar `google-services.json`.
   - Probar con el AAB instalado desde la pista interna de Play antes de publicar.
