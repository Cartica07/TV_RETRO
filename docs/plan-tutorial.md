# Tutorial guiado (plan y cómo quedó)

> **HECHO el 2026-11-21.** Lo de abajo (secciones 1 a 8) es el plan original, que se conserva como historia; esta sección dice cómo quedó construido.

## 0. Cómo quedó construido

**Decisiones del dueño (2026-11-21, todas las recomendadas):** (1) sale **la primera vez que la cuenta entra con una TV ya vinculada**; (2) lo "ya visto" se recuerda **en el celular** (`localStorage`, sin campo nuevo en Firebase); (3) lleva los **8 pasos del borrador tal cual**; (4) **Saltar cuenta como visto** y una fila **"Ver tutorial"** en Más > Config > Ayuda y contacto lo repite.

**Archivos:**

| Archivo | Qué hace |
|---|---|
| `js/tutorial.js` | `crearTutorial({ leerElementos, cambiarTipo, puedeAbrir })`. Los pasos y sus frases están en `PASOS` (arriba del archivo): **para cambiar una frase se edita ahí**. Recuerda lo visto con la clave `tvretro.tutorial.<uid>` (si el almacenamiento falla, solo durante la sesión). |
| `index.html` | `#tutorial` (hijo directo de `<body>`, nace `hidden`) y la fila `#botonVerTutorial` al principio de `#configAyuda`. |
| `css/style.css` | Bloque "Tutorial guiado" al final: capa fija, foco (sombra gigante), tarjeta, puntos y botones, con los tokens de `tokens.css`. |
| `js/ui.js` | Los IDs `tutorial*` y `botonVerTutorial`. |
| `js/main.js` | `crearTutorial` junto a los demás módulos; `tutorial.configurarEventos()` en `inicializar()`; `tutorial.iniciarSiCorresponde(uid)` al final de `inicializar()` (solo con cuentas, tras liberar el panel y el aviso post-login); y el botón Atrás de Android lo cierra primero. |
| `pruebas/tutorial.mjs` | 11 escenarios. Está en `todo-el-banco.sh`. |
| `pruebas/banco.mjs` | Por defecto el arnés da el tutorial por visto (`globalThis.__conTutorial` lo activa), para que no tape a las demás suites. La app no tiene ningún gancho de pruebas. |

**Cómo se comporta:**
- **No cambia de pestaña** mientras explica (`cambiarTipo()` cambia lo que envía Enviar): resalta desde donde esté el cliente. Un paso cuyo objetivo no se ve (por ejemplo Enviar en el menú Más) se **salta**. Solo "Ver tutorial" (desde Config, donde Enviar no se ve) pasa antes a Texto y no restaura la pestaña anterior.
- Vuelve a medir con `ResizeObserver` y `resize` (la línea de estado puede pasar a dos líneas y mover lo resaltado).
- La capa tapa la app (no se puede tocar Enviar), atrapa Tab, cierra con Escape y con el Atrás de Android (todo equivale a Saltar). Un doble toque en Siguiente cuenta como uno (250 ms).
- No se abre con el login a la vista, con Mi TV abierto ni con el panel bloqueado.
- **Para verlo de nuevo en un celular sin pasar por Config:** borrar los datos del sitio / de la app, o la clave `tvretro.tutorial.<uid>` de `localStorage`.

**Propuestas mías que el dueño puede cambiar** (no las dictó): el botón del último paso dice **"Cerrar"**; el último paso no muestra "Saltar"; los puntos de avance (●●○○…) son decoración.

**Lo que NO se hizo a propósito:** un campo en Firebase para recordar lo visto entre celulares (si reinstala la app lo ve una vez más); pasos de Compartir y Alarma (el dueño pidió los 8 del borrador).

---

# Plan original (propuesta del 2026-11-21)

> Estado de este plan original: **ya construido** (ver la sección 0). Se conserva como historia. Antes de escribir código hay que explicar el plan y esperar su aprobación (regla del proyecto), y los **textos los dicta el dueño**: se ponen exactamente como los dicte, corrigiendo solo la ortografía (ver `CLAUDE.md`, sección 2).

## 1. Por qué existe

Las pestañas de la app no llevan textos explicativos a propósito (regla de la sección 2 de `CLAUDE.md`): el cliente promedio no quiere leer, y los textos técnicos lo aburren o no los entiende. El tutorial guiado es lo que sustituye esas explicaciones: una vez, al principio, muestra para qué sirve cada parte, y después no estorba.

El dueño decidió el 2026-11-20 que el tutorial es **lo último** que se hace, y que antes iba una ronda de ajustes de textos y diseño (hecha el 2026-11-21, ver `docs/historial-cambios.md`). Esa ronda ya dejó la app en lenguaje simple, así que el tutorial se escribe con el mismo tono.

## 2. Cómo funcionaría

Una capa que se pone encima de la app (no una página aparte), con:

- Un **resalte**: todo oscurecido salvo la parte que se explica (un "foco").
- Una **tarjeta con una frase corta** al lado del resalte.
- Botones **Siguiente**, **Atrás** (opcional) y **Saltar**, siempre visibles.
- Puntos o un contador "2 de 8" para saber cuánto falta (opcional).

Se hace con **HTML, CSS y JS puros, módulos ES, sin librerías** (regla del proyecto: no migrar a un framework). Sin `eval`, sin scripts en línea y sin recursos externos, para no tocar la política de seguridad (`<meta http-equiv="Content-Security-Policy">` de `index.html`).

### Archivos que se tocarían (propuesta)

| Archivo | Qué |
|---|---|
| `js/tutorial.js` (nuevo) | Lógica: lista de pasos, mostrar/ocultar la capa, siguiente/atrás/saltar, recordar que ya se vio. `crearTutorial({ ... })` con lo compartido que reciba de `main.js` por funciones, como `mas.js` y `cuentas.js`. |
| `css/style.css` (o `css/tutorial.css`) | Aspecto de la capa, el foco y la tarjeta. Colores y medidas con los tokens de `css/tokens.css`. |
| `index.html` | El contenedor de la capa (nace oculto) y una fila **"Ver tutorial"** en `#configAyuda`. Mantener los IDs existentes. |
| `js/main.js` | Enganchar el arranque del tutorial (primera vez) y el botón Atrás de Android. |
| `js/ui.js` | Los IDs nuevos en `obtenerElementos`. |
| `docs/` | Esta guía, `historial-cambios.md`, fila nueva en `auditoria-alcance.md` sección 8 y `CLAUDE.md`. |

**Cambios visuales (HTML/CSS) y de lógica (JS) van en commits separados.** Un commit por paso, mensaje en español.

## 3. Pasos propuestos

Frases de **borrador** (tono simple, con "tú"); las finales las dicta el dueño.

| # | Qué resalta (selector actual) | Frase de borrador |
|---|---|---|
| 1 | El estado de la TV (`.dispositivo`, `#textoConexion`) | "Aquí ves si tu TV está conectada." |
| 2 | La pestaña Texto (`#grupoTipo` botón `texto`) | "Escribe un mensaje y elige cómo se ve." |
| 3 | El botón Enviar (`#enviar`) | "Toca Enviar y aparece en tu TV." |
| 4 | Imagen (`#grupoTipo` botón `imagen`) | "Sube una imagen o un GIF." |
| 5 | Dibujo (botón `dibujo`) | "Dibuja con el dedo." |
| 6 | Canciones (botón `cancion`) | "Elige una canción para tu TV." |
| 7 | Más (botón `galeria`, que es "Más") | "Aquí están tu galería, los juegos, la alarma y los ajustes." |
| 8 | Cierre | "¡Listo! Puedes volver a verlo en Más > Config > Ayuda y contacto." |

Ideas opcionales que el dueño puede querer: un paso para compartir la TV con otras personas (Mi TV > Compartir) y otro para la alarma. Mejor pocos pasos: cada uno extra aburre más.

## 4. Decisiones que tiene que tomar el dueño

1. **Cuándo aparece.** Propuesta: la **primera vez que entra con una TV ya vinculada** (antes no hay nada que mostrar: la pantalla "Añade tu TV" ya tiene su propia explicación). Alternativa: justo después de crear la cuenta.
2. **Dónde se recuerda que ya lo vio.**
   - **En el celular (propuesta):** `localStorage`, con una clave por cuenta, igual que ya se hace con la TV elegida (`claveTVGuardada(uid)` en `cuentas.js`). No requiere campo nuevo en Firebase. Contra: si el cliente reinstala la app o cambia de celular, lo vuelve a ver.
   - **En su cuenta de Firebase:** lo recordaría siempre, pero es un **campo nuevo** (por ejemplo `usuarios/{uid}/tutorialVisto`) y eso exige proponerlo, aprobarlo, publicar reglas nuevas (las publica el dueño) y documentarlo en `docs/formatos-datos.md`. No se recomienda para algo tan menor.
   - Siempre envolver el acceso a `localStorage` en `try/catch` (puede fallar en ventanas privadas o con datos bloqueados) y que sin él el tutorial siga funcionando.
3. **Cómo se repite.** Propuesta: una fila **"Ver tutorial"** en Más > Config > Ayuda y contacto (hoy esa pantalla tiene "Preguntas frecuentes" y "Escríbenos").
4. **Saltarlo.** "Saltar" siempre visible. Propuesta: saltarlo cuenta como visto (no insistir), pero la fila de Config lo deja repetir.
5. **Cantidad y texto de los pasos.** Los de la sección 3 son un borrador.

## 5. Reglas del proyecto que el tutorial no puede romper

- **Sin scroll:** cada pestaña entra sin scroll en 390×844 y 360×740. La tarjeta del tutorial va **encima** (posición fija) y no debe empujar nada ni crear scroll; medir igual que siempre (final de `main.controles` contra la barra de Enviar o la navegación).
- **A prueba de usuarios impacientes:** pulsar rápido "Siguiente", pulsar fuera de la tarjeta, rotar el celular, cambiar de pestaña a mitad, perder la señal. Nada de esto debe dejar la capa a medias ni bloquear la app. Usar turnos, como `turnoSubida`, si algo asíncrono escribe estado; y **no quitar el atributo `inert` del panel**, que `inicializar()` libera al terminar la carga inicial: el tutorial arranca **después** de eso.
- **Botón Atrás de Android:** hoy lo gestiona `main.js` (`app.addListener('backButton', …)` y `cerrarCapaCuentas`). El tutorial debe cerrarse (o retroceder un paso) con Atrás, no sacar al cliente de la app.
- **Mantener los IDs del DOM** que usa `js/ui.js` y los `data-valor` de los botones. El tutorial puede apoyarse en ellos para ubicar lo que resalta; si algo se ubica por selector, que falle sin romper (si no encuentra el elemento, saltar ese paso).
- **Sin textos técnicos** en la interfaz (regla de privacidad): nada de versiones, ids ni términos internos.
- **Textos con "tú"**, exactos a lo que dicte el dueño.
- **Accesibilidad básica:** foco en el botón "Siguiente" al abrir, `role="dialog"` con `aria-label`, cerrar con Escape en la web.
- **Seguridad (CSP):** nada en línea ni de otros dominios.
- **No tocar** `carga-masiva.html` (herramienta aparte).

## 6. Pruebas (cuando se construya)

- Un archivo nuevo en `pruebas/` (por ejemplo `tutorial.mjs`) con el estilo de las demás (Playwright + Firebase falso del banco): sale la primera vez, no sale la segunda, "Saltar" lo cierra y lo recuerda, "Ver tutorial" lo repite, Atrás lo cierra, no hay scroll ni errores de consola con el tutorial abierto en los dos tamaños, y la prueba de impacientes (`bobos.mjs`) sigue en verde.
- Añadirlo a `pruebas/todo-el-banco.sh` y a `pruebas/README.md`.
- **Revisión en un celular real** con adb (ver la lección de `CLAUDE.md` sección 9: no usar la tecla Atrás por adb, comprobar la ventana con `dumpsys window | grep mCurrentFocus`, capturar antes de tocar cosas peligrosas).
- Pruebas largas del banco solo cuando el dueño confirme que esa versión es la final.

## 7. Orden de trabajo sugerido (pasos pequeños)

1. Plan aprobado y textos dictados por el dueño.
2. HTML del contenedor y de la fila "Ver tutorial" (commit visual).
3. CSS de la capa, el foco y la tarjeta (commit visual).
4. `tutorial.js` con los pasos y la lógica (commit de lógica).
5. Enganche en `main.js` (primera vez y Atrás) (commit de lógica).
6. Pruebas nuevas.
7. Revisión en navegador y en celular, ajustes.
8. Documentación (esta guía pasa de "propuesta" a "hecho"), fila en `auditoria-alcance.md` y push solo si el dueño lo pide.

## 8. Cosas relacionadas que conviene hacer junto con el tutorial

- **`ayuda.html`: ya actualizada el 2026-11-21** con el texto que aprobó el dueño (la página de ayuda que se abre desde Config; antes decía que la TV mostraba la clave y que se reinicia). Ahora explica el QR, la página de inicio de sesión (aviso de Android, o Ajustes > Wi-Fi en iPhone) y la rueda 5 s al cambiar de router. Si el tutorial añade pasos sobre el Wi-Fi, que digan lo mismo. Flujo real en [portal-wifi.md](portal-wifi.md). Lo del iPhone sale de la documentación de Apple y de reportes de desarrolladores, **no se probó con un iPhone**.
- **Primera vez con el Wi-Fi de la TV:** la configuración del Wi-Fi ocurre en la TV y el celular antes de que el cliente abra la app, así que **no es parte de este tutorial** (la guía está en la pantalla de la TV y en `ayuda.html`). Si el dueño quiere acompañar también ese momento, es un tema aparte (Bluetooth quedó pospuesto: ver [evaluacion-parte-3.md](evaluacion-parte-3.md)).
- **"Sin textos explicativos en las pestañas"** (`CLAUDE.md`, sección 2) sigue valiendo: el tutorial no añade textos fijos a las pestañas.
