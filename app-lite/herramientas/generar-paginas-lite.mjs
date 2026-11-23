// Genera las páginas legales y de ayuda de la TV RETRO Lite (lite/terminos.html, lite/privacidad.html, lite/ayuda.html, lite/licencias.html)
// con el mismo estilo que las de la app Pro (copia el <head> de terminos.html) y los textos de la Lite: sin cuentas,
// sin nube, todo en el celular. SON BORRADORES: el dueño los revisa y la parte legal la revisa un abogado antes de vender.
// Uso: node app-lite/herramientas/generar-paginas-lite.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pro = readFileSync(join(raiz, 'terminos.html'), 'utf8').replace(/\r\n/g, '\n');
const cabeza = pro.slice(0, pro.indexOf('<body>') + '<body>'.length)
  .replace('href="css/tokens.css"', 'href="../css/tokens.css"');
if (!cabeza.includes('../css/tokens.css')) throw new Error('terminos.html de la Pro cambió: revisa generar-paginas-lite.mjs');

const CONTACTO = '<a href="mailto:jhoncarta0706@gmail.com">jhoncarta0706@gmail.com</a>';
const pagina = (titulo, fecha, cuerpo) => cabeza.replace(/<title>[^<]*<\/title>/, `<title>TV RETRO Lite · ${titulo}</title>`) + `
<main>
  <h1>${titulo}</h1>
  <p class="fecha">TV RETRO Lite · Última actualización: ${fecha}</p>
${cuerpo}
</main>
</body>
</html>
`;

const FECHA = '22 de noviembre de 2026';

const terminos = pagina('Términos y condiciones', FECHA, `
  <h2>1. Quiénes somos</h2>
  <p>TV RETRO Lite es ofrecida por Jhon Alexander Cartagena Vélez, Armenia, Quindío, Colombia. Contacto: ${CONTACTO}.</p>
  <p>Al usar la app o la TV RETRO Lite aceptas estos términos. Si no estás de acuerdo, no la uses.</p>

  <h2>2. Cómo funciona</h2>
  <p>La TV RETRO Lite se controla desde la app del celular por Bluetooth. No usa internet, no tiene cuentas y no guarda nada en servidores nuestros: lo que envías va del celular a la TV.</p>

  <h2>3. Lo que guardas en tu celular</h2>
  <div class="caja">
    <p><strong>Tus imágenes, dibujos y GIF se guardan en tu celular, no en internet.</strong> Si desinstalas la app, borras sus datos o cambias de celular, <strong>se pierden</strong> y no podemos recuperarlos. Las alarmas y los ajustes se guardan además en la TV.</p>
  </div>
  <p>Eres responsable de lo que envías y guardas y debes tener derecho a usarlo. No está permitido usar la TV para contenido ilegal, ofensivo, que acose a otras personas o que infrinja derechos de terceros.</p>

  <h2>4. Un celular a la vez</h2>
  <p>Cada TV se empareja con un solo celular, con un PIN que aparece en su pantalla. Quien tenga la TV en la mano puede emparejarla con otro celular (mantén apretado el botón 8 segundos); al hacerlo se olvida el celular anterior.</p>

  <h2>5. La TV</h2>
  <p>La TV RETRO es un dispositivo electrónico: úsala según sus instrucciones, en un lugar seco y con un cargador adecuado. La garantía del dispositivo es la que se informa al comprarlo y la que exige la ley colombiana.</p>

  <h2>6. Responsabilidad</h2>
  <p>En la medida que lo permita la ley, no respondemos por daños indirectos derivados del uso del producto. Por ejemplo, la TV no sabe la hora si se queda sin corriente hasta que la app se conecte de nuevo, y una alarma no suena sin hora: revisa que la TV tenga la hora puesta. Nada de esto limita derechos que la ley te reconozca como consumidor.</p>

  <h2>7. Privacidad</h2>
  <p>Cómo tratamos tus datos se explica en la <a href="privacidad.html">política de privacidad</a>.</p>

  <h2>8. Cambios y ley aplicable</h2>
  <p>Si cambiamos estos términos, publicaremos la nueva versión en esta misma dirección con su fecha. Estos términos se rigen por las leyes de Colombia.</p>`);

const privacidad = pagina('Política de privacidad', FECHA, `
  <h2>1. Quién es el responsable</h2>
  <div class="caja">
    <p><strong>Jhon Alexander Cartagena Vélez</strong><br />
    Armenia, Quindío, Colombia<br />
    Correo de contacto: ${CONTACTO}</p>
  </div>

  <h2>2. Qué datos tratamos</h2>
  <p>TV RETRO Lite <strong>no recoge ni envía tus datos a ningún servidor</strong>: no tiene cuentas, no pide tu correo ni tu nombre, no usa publicidad ni herramientas de análisis y no vende información.</p>
  <ul>
    <li><strong>En tu celular:</strong> tus imágenes, dibujos y GIF guardados, la última pantalla que enviaste y tus ajustes. Quedan solo en tu celular y se borran si desinstalas la app o borras sus datos.</li>
    <li><strong>En la TV:</strong> las canciones que usas, tu alarma y los ajustes. Se borran con la TV.</li>
  </ul>

  <h2>3. Permiso de Bluetooth</h2>
  <p>Android te pide permiso de "dispositivos cercanos" para que la app pueda encontrar y hablar con tu TV por Bluetooth. La app no usa ese permiso para saber dónde estás.</p>

  <h2>4. Tus derechos</h2>
  <p>Como no tenemos tus datos, no hay nada que pedirnos que corregir o borrar: lo borras tú desinstalando la app. Si tienes dudas, escríbenos a ${CONTACTO}. También puedes acudir a la Superintendencia de Industria y Comercio (Ley 1581 de 2012).</p>

  <h2>5. Menores de edad</h2>
  <p>TV RETRO Lite no está dirigida a menores de 14 años. Si eres menor, úsala con permiso de tu madre, padre o tutor.</p>

  <h2>6. Cambios a esta política</h2>
  <p>Si cambiamos esta política, publicaremos la nueva versión en esta misma dirección con su fecha de actualización.</p>`);

const ayuda = pagina('Preguntas frecuentes', FECHA, `
  <h2>¿Cómo conecto mi TV con el celular?</h2>
  <p>Enciende la TV: si no tiene ningún celular emparejado, muestra un PIN de 6 números. En la app toca <strong>Enviar a la TV</strong>, elige tu TV en la lista y escribe el PIN cuando el celular lo pida. Solo hace falta una vez.</p>

  <h2>¿Cómo cambio de celular?</h2>
  <p>Con la TV en la mano, mantén apretado su botón <strong>8 segundos</strong> (sin que esté sonando nada). La TV olvida el celular anterior y muestra un PIN nuevo. Tus imágenes guardadas no pasan solas al celular nuevo.</p>

  <h2>¿Dónde se guardan mis imágenes?</h2>
  <p>En tu celular, no en internet. Si desinstalas la app, borras sus datos o cambias de celular, se pierden.</p>

  <h2>La TV dice "Sin hora".</h2>
  <p>La TV recibe la hora del celular cada vez que la app se conecta. Abre la app y toca <strong>Enviar a la TV</strong> (o conéctala desde Más). Mientras no tenga hora, las alarmas no suenan.</p>

  <h2>¿Para qué sirve el botón de la TV?</h2>
  <ul>
    <li><strong>Un toque:</strong> si suena la alarma, la calla. Si suena una canción y la TV está en otra pantalla, te lleva a la pantalla de la canción (sigue sonando); si ya estás en la pantalla de la canción, cambia de pantalla y la calla. Si no suena nada, cambia de pantalla: lo que enviaste, el reloj y la pantalla apagada.</li>
    <li><strong>Mantener 8 segundos</strong> (con nada sonando): empareja otro celular.</li>
  </ul>

  <h2>¿Cómo funciona la alarma?</h2>
  <p>Se configura en <strong>Más → Alarma</strong> (hasta 3, con sus días y una canción). La TV la guarda y suena aunque no tengas el celular cerca. Un toque en el botón la calla y sola se calla al minuto.</p>

  <h2>Envío algo y la TV no lo muestra.</h2>
  <p>Acerca el celular a la TV y vuelve a intentarlo. Si sigue igual, apaga y enciende la TV.</p>

  <h2>¿No encontraste tu respuesta?</h2>
  <p>Escríbenos a ${CONTACTO}.</p>`);

const E = (nombre, licencia, url) => `      <li><strong>${nombre}</strong>: ${licencia} · <a href="${url}" target="_blank" rel="noopener">fuente</a></li>`;
const licencias = pagina('Licencias', FECHA, `
  <p>TV RETRO Lite usa componentes de software libre de terceros. Gracias a sus autores. Estas son sus licencias:</p>

  <h2>App del celular</h2>
    <ul>
${E('Capacitor', 'MIT', 'https://github.com/ionic-team/capacitor')}
${E('@capacitor/app y @capacitor/screen-orientation', 'MIT', 'https://github.com/ionic-team/capacitor-plugins')}
${E('@capacitor-community/bluetooth-le', 'MIT', 'https://github.com/capacitor-community/bluetooth-le')}
${E('Space Grotesk y JetBrains Mono (tipografías de la app)', 'SIL Open Font License 1.1', 'https://fonts.google.com')}
${E('GNU FreeFont (FreeSans, FreeSerif) (letras de la vista previa y de la TV)', 'GPL v3 con excepción de fuentes', 'https://www.gnu.org/software/freefont/')}
    </ul>

  <h2>Firmware de la TV</h2>
    <ul>
${E('Arduino core para ESP32 (base del programa de la TV)', 'LGPL 2.1', 'https://github.com/espressif/arduino-esp32')}
${E('ESP-IDF (incluye miniz, mbedTLS, LittleFS y Apache NimBLE para el Bluetooth)', 'Apache License 2.0 y licencias de cada componente (MIT, BSD)', 'https://github.com/espressif/esp-idf')}
${E('Adafruit GFX Library (dibujo en la pantalla)', 'BSD', 'https://github.com/adafruit/Adafruit-GFX-Library')}
${E('Adafruit SSD1306 (pantalla OLED)', 'BSD', 'https://github.com/adafruit/Adafruit_SSD1306')}
${E('Adafruit BusIO (comunicación con la pantalla)', 'MIT', 'https://github.com/adafruit/Adafruit_BusIO')}
${E('ArduinoJson (lectura de datos)', 'MIT', 'https://github.com/bblanchon/ArduinoJson')}
    </ul>

  <p>Si quieres el texto completo de alguna licencia o el código fuente que la licencia exige, escríbenos a ${CONTACTO}.</p>`);

for (const [nombre, html] of [['terminos', terminos], ['privacidad', privacidad], ['ayuda', ayuda], ['licencias', licencias]]) {
  writeFileSync(join(raiz, 'lite', `${nombre}.html`), html.replace(/\n/g, '\r\n'));
  console.log(`lite/${nombre}.html`);
}
