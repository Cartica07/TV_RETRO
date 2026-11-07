# TV RETRO

Panel web para controlar a distancia una pantalla OLED de 128×64 (SSD1306) conectada a un ESP32. Desde el panel se envían textos, imágenes, GIF, dibujos y canciones para el buzzer. El microcontrolador las lee de **Firebase Realtime Database** y las muestra.

Está hecho con HTML, CSS y JavaScript puro (módulos ES), sin frameworks. Se usa como página web y más adelante se empaquetará como app de Android con Capacitor.

## Qué se puede hacer

| Pestaña | Funciones |
|---|---|
| **Texto** | Mensaje de hasta 200 caracteres. Letra: Sans (por defecto), Sans negrita, Serif, Serif cursiva o la Clásica 5×7. Tamaño de 1 a 5. Alineación automática (horizontal y vertical) o manual con sliders X/Y. Modo Ajustar, Scroll ↔ o Scroll ↕. |
| **Imagen** | Subir una imagen o un GIF animado, o pegarla del portapapeles. Encuadre: escala, rotar, voltear y fondo. Difuminado Atkinson y umbral. Guardar en la galería. |
| **Dibujo** | Lienzo de 128×64 con grosor de 1 a 6, deshacer, rehacer y limpiar. Se puede expandir a pantalla completa en horizontal y hacer zoom con dos dedos, como en WhatsApp. Guardar en la galería. |
| **Música** | Elegir una canción del catálogo y cuántas veces se repite. |
| **Galería** | Tres listas: Imágenes, Animaciones y GIF. Elegir, reajustar, añadir, guardar y borrar. |

Siempre a la vista, en la tarjeta del dispositivo: la vista previa exacta de la OLED, el estado de conexión con la hora de la última señal, el interruptor **Invertir** y el resultado del último envío.

`carga-masiva.html` es una página aparte, no enlazada desde el panel. Sirve para subir imágenes, canciones y animaciones en lote.

## Cómo probarlo

Los módulos ES no cargan abriendo el archivo con doble clic: hay que servirlo por HTTP.

```bash
npx serve .
```

Después se abre la dirección que muestra. Para probarlo en el celular, con el teléfono en la misma red Wi-Fi, se usa la IP de la computadora (por ejemplo `http://192.168.1.2:3000`). En ese caso el botón **Pegar** no funciona, porque el navegador solo permite leer el portapapeles en páginas `https` o `localhost`.

El panel usa la base de datos real: **Enviar** y **Guardar** escriben en Firebase.

## Estructura

```
index.html            Panel (estructura de app: cabecera, pestañas, barra de Enviar)
carga-masiva.html     Carga en lote (página aparte)
css/tokens.css        Colores, fuentes y medidas (compartidos)
css/style.css         Estilos del panel
js/main.js            Orquestador: estado, eventos, vista previa, envío
js/ui.js              Elementos del DOM y ayudas visuales
js/firebase.js        Único acceso a Firebase
js/renderer.js        Vista previa de la OLED (fuente clásica 5×7)
js/fonts.js           Fuente clásica 5×7 de Adafruit
js/fuentesTexto.js    Texto con FreeSans / FreeSerif
js/fuentesGfx.js      Datos de las fuentes FreeSans / FreeSerif
js/imageProcessor.js  Conversión de imágenes (Atkinson, encuadre)
js/gif.js             GIF animado → animación
js/dibujo.js          Lienzo de dibujo
js/lienzoZoom.js      Zoom y desplazamiento del lienzo
docs/                 Documentación (cambios del rediseño, guía para el firmware)
```

## Documentación

- [docs/rediseno-cambios.md](docs/rediseno-cambios.md): todo lo que cambió en el rediseño y lo que queda pendiente.
- [docs/firmware-fuentes.md](docs/firmware-fuentes.md): qué tiene que hacer el firmware con los campos nuevos (letras, tamaño 5, posición manual y scroll vertical).
- [CLAUDE.md](CLAUDE.md): contrato de datos con el firmware y reglas de trabajo del proyecto.
