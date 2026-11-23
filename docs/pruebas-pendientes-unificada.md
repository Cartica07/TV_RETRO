# Pruebas pendientes con el celular y la TV real (app unificada + TV Lite)

> **Resultado del 2026-11-23:** todo pasó salvo dos errores de la unificada con la misma causa (el tutorial de la Pro abierto oculto en modo sin cuenta: Galería sin scroll y teclado tapando), ya arreglados y comprobados en el celular. El teclado que tapaba "Nombre" en la pestaña Imagen también quedó arreglado (`4df215a`): el campo sube solo sobre la barra de Enviar; comprobado en el celular.

> Al 2026-11-22. Todo esto ya pasó las pruebas simuladas (57 comprobaciones de la unificada y las 20 suites originales de la Pro iguales que contra la Pro). Falta verlo en el celular y en la TV de verdad. Se hace en orden; si algo falla, se anota el paso y qué se vio.

## 0. Preparación
1. **Firebase:** Authentication > Método de acceso > Agregar proveedor nuevo > **Anónimo** > Habilitar > Guardar. Sin esto, "TV Lite" dice "Por ahora no se puede usar la TV Lite".
2. **Firmware nuevo en la TV (S3):** cable en la TV; se graba con permiso del dueño (trae "Abre la app" en el reloj sin hora).
3. **App:** cable en el celular, desbloqueado. Se instala la APK unificada (ícono **"Pepito"** (desde el 2026-11-23; antes "TV RETRO (unificada)"), NO la Pro ni la Lite) y se borran sus datos para empezar como un cliente nuevo.

## 1. Primera pantalla y TV Pro
1. Abrir la app: debe salir **"¿Qué TV tienes?"** con TV Pro y TV Lite.
2. Tocar **TV Pro**: sale el inicio de sesión de siempre. Entrar con la cuenta del dueño: aparece su TV Pro y un envío llega como siempre.
3. Más > Config > Mi cuenta > **Cerrar sesión**: vuelve la pregunta "¿Qué TV tienes?".

## 2. TV Lite sin cuenta
1. Tocar **TV Lite**: NO pide cuenta y se abre sola **"Conecta tu TV"**.
2. En la TV, mantener el botón **8 s** hasta ver el PIN. En la app, **Abrir Bluetooth**, elegir "Pepito Lite" ("TV RETRO Lite" con el firmware anterior), escribir el PIN y volver a la app con recientes (no con Atrás).
3. Debe quedar el panel "En línea", sin juegos ni "Actualizar la TV" en Más.
4. Si sale **"La TV no reconoce este celular…"**, hacer lo que dice (olvidar la TV en Ajustes > Bluetooth, 8 s en la TV, emparejar de nuevo).

## 3. Enviar a la TV Lite
Texto, una imagen **predeterminada** de la galería, una foto propia, un dibujo, un GIF corto, una canción **con letra** y una **sin letra** (las canciones vienen de la nube). Cada una llega y la app dice "En la TV".

## 4. Galería en el celular
Guardar una imagen con un nombre: aparece en la galería junto a las predeterminadas. Borrarla: desaparece.

## 5. Alarma y ajustes
1. Más > Alarma: una alarma a **2 minutos** con una canción; guardar. Cerrar la app: la alarma **suena sola**; un toque la calla.
2. Más > Config > Ajustes de la TV: brillo bajo y volumen bajo; se nota en la TV.

## 6. La TV sin el celular
1. Con la TV en el **reloj**, enviar un texto: pita, se queda en el reloj y aparece el **sobre**; un toque lleva al contenido y el sobre se va.
2. Con la **pantalla apagada**, enviar algo: pita y sigue apagada.
3. **Quitar la corriente** a la TV y volver a enchufarla SIN abrir la app: el reloj dice **"--:--" y "Abre la app"** y la alarma no suena. Abrir la app: vuelve la hora.

## 7. Vínculo roto
Mantener 8 s el botón de la TV SIN olvidarla en el celular; cerrar y abrir la app: sale el aviso "La TV no reconoce este celular…". Seguirlo y volver a emparejar.

## 8. Volver a la TV Pro
1. Ícono de TV (Mis TV) > **"Tengo una TV Pro"**: vuelve la pregunta; TV Pro > iniciar sesión > la TV Pro funciona.
2. Abrir la app **Pro original** (ícono "TV RETRO"): funciona como siempre (no cambió nada).

## Después de las pruebas (decide el dueño)
Aprobar o cambiar los textos propuestos ([lite-textos-propuestos.md](lite-textos-propuestos.md), filas 22 a 41); nombre y paquete definitivos de la app y registrar Google; probar el firmware en una **C3 real**; batería y modo de bajo consumo; revisión del abogado.
