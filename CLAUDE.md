# OLED Control — Guía para Claude

## Qué es
Panel web (HTML/CSS/JS puro, módulos ES, sin frameworks) con Firebase Realtime Database que controla a distancia una OLED SSD1306 128×64 conectada a un ESP8266/ESP32. Envía textos, imágenes, dibujos, canciones (buzzer) y animaciones; el microcontrolador lee Firebase y los muestra. `carga-masiva.html` es una página aparte (no enlazada) para subir contenido en lote.

## Archivos
- `index.html` + `js/main.js` (orquestador) + `js/ui.js` (IDs del DOM y helpers visuales)
- `js/firebase.js`: ÚNICO acceso a Firebase
- `js/renderer.js` + `js/fonts.js`: réplica pixel-perfect de la OLED
- `js/imageProcessor.js`, `js/dibujo.js`
- `css/style.css`; `carga-masiva.html` (CSS/JS inline)

## Contrato con el firmware (NO CAMBIAR)
- `oled_remota` = `{ version, pantalla: { tipo, texto, config{tamano,alineacion,alineacionV,invertido,modoTexto}, imagen{ancho,alto,datos} | cancion{nombre,repeticiones,notas} | animacion{nombre,ancho,alto,cuadros[{datos,dur}]} } }`
- `oled_remota/lastSeen` (heartbeat, solo lectura desde la web)
- Catálogos: `canciones/`, `imagenes/`, `animaciones/` (hermanos de `oled_remota`)
- Dibujo y Galería se envían como `tipo:"imagen"`.
- `enviarEstado` usa `update()` sobre `oled_remota` (escribe `version` y `pantalla` sin borrar `lastSeen`).
- Seguridad: login con Firebase Auth (email/contraseña) en index.html y carga-masiva.html; reglas en `database.rules.json` (lectura pública de `oled_remota` para el ESP, `lastSeen` escribible por el ESP, todo lo demás restringido al UID del dueño).

## Nombre de la app
- El nombre visible pasa a ser **TV RETRO** (antes "OLED Remota" / "OLED Control"). Aplicarlo en los pasos visuales: `<title>`, encabezados, barra superior, footer, carga-masiva.html y, más adelante, el nombre de la APK.
- Es SOLO el nombre visible: la ruta de Firebase `oled_remota` y demás nombres de datos NO se renombran.

## Fases
1. ACTUAL: rediseño visual tipo app IoT (tarjeta de dispositivo arriba con preview OLED, estado y última actualización; navegación inferior por pestañas; mobile-first, zonas seguras, modo oscuro; bien en escritorio).
2. POSTERIOR (no hacer todavía): APK Android con Capacitor, manteniendo el mismo código como web.

## Reglas obligatorias
- No cambiar rutas, nombres de campos ni formato de datos en Firebase.
- No migrar a React/Vue/otro framework.
- No borrar ninguna función existente.
- Mantener los IDs del DOM que usa `js/ui.js` (obtenerElementos) y los `data-valor` de los botones.
- Separar cambios visuales de cambios de lógica: nunca en el mismo paso/commit.
- Pasos pequeños, un commit por paso, mensaje claro en español, rama `rediseno-app`.
- No hacer push ni merge a main sin pedido explícito.
- Antes de cada paso grande: explicar el plan y esperar aprobación.
- Responder siempre en español.

## Cómo probar
Servir por HTTP (los módulos ES no cargan con file://), p. ej. `python -m http.server 8000`, y abrir `http://localhost:8000`. Probar cada pestaña y verificar en la consola de Firebase que lo escrito en `oled_remota` no cambió de forma.
