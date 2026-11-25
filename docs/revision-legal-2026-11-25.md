# Revisión legal de Pepito (2026-11-25)

Revisión de los documentos públicos (`pepito/ayuda.html`, `privacidad.html`, `terminos.html`, `licencias.html`) y de los riesgos legales del producto, hecha a pedido del dueño con la normativa colombiana. Los borradores nuevos están en los commits `729fa4e`, `ed5b4c3`, `acb2f05`, `221c693` y `4c7222f` (rama `lite`, sin publicar).

**Alcance y límites.** Es un análisis jurídico de apoyo, redactado por una IA con búsquedas en fuentes oficiales y doctrinales. No es una opinión de un abogado inscrito ni reemplaza el visto bueno final de uno, que sí conviene para los puntos 1 a 5 del resumen antes de vender. Cada afirmación dice si se **verificó con fuente** o viene del **conocimiento general** (por verificar).

---

## 1. Resumen: lo que hay que decidir o hacer

| # | Riesgo | Gravedad | Qué hacer |
|---|---|---|---|
| 1 | **Canciones con letra de obras comerciales** en el catálogo que la app entrega a todos los usuarios (Soda Stereo, Mecano, Piero, Stevie Wonder, Wiz Khalifa, Disney, Mägo de Oz, Paquita la del Barrio, entre otras). | **Alta** | Dejar en el catálogo solo obras propias, de dominio público o con licencia; revisar título por título (sección 5.1). |
| 2 | **Open-Meteo gratuito es solo para uso no comercial**; Pepito lo llama desde cada dispositivo vendido. | **Alta** | Contratar el plan comercial de Open-Meteo, o cambiar de proveedor, antes de vender (sección 5.2). |
| 3 | **Tipografías FreeSans/FreeSerif (GPL con excepción de fuentes)** dentro del firmware y de la app; la excepción está pensada para documentos, no para programas. | Media-alta | Opinión de un abogado de software o cambiar a tipografías con licencia OFL (sección 5.3). |
| 4 | **4 juegos derivados de código sin licencia** (H-01). | Alta | Reescribirlos (ya previsto) o no venderlos con ellos. |
| 5 | **Procedencia de las imágenes y animaciones de la biblioteca** predeterminada (29 imágenes y 9 animaciones): no consta quién tiene los derechos. | Media | Confirmar autoría o licencia de cada una (sección 5.4). |
| 6 | **Consentimiento pasivo** al crear la cuenta (sin casilla ni registro). | Media | Casilla sin marcar + guardar versión y fecha (cambio en la app que requiere su aprobación; sección 5.8). |
| 7 | **Homologación del dispositivo** (Wi-Fi y Bluetooth) ante la CRC y condiciones de venta (retracto, garantía). | Media | Verificar con la CRC y redactar las condiciones de venta (sección 5.5 y 5.6). |
| 8 | **Datos que faltan** para poder publicar los documentos: dirección, teléfono y fecha de vigencia. | Bloquea la publicación | Completar los campos resaltados (sección 7). |

---

## 2. Qué se hizo con los cuatro documentos

Tono formal, sin emojis, tratamiento de "usted". Los datos que faltan salen resaltados en color con `class="pendiente"`; **no se deben publicar con esos campos sin llenar**.

| Documento | Estado |
|---|---|
| `privacidad.html` | Reescrito como **Política de Tratamiento de Datos Personales** con aviso de privacidad. |
| `terminos.html` | Reescrito como **Términos y Condiciones de Uso**, con el Estatuto del Consumidor en cuenta. |
| `licencias.html` | Se agregan Open-Meteo (CC BY 4.0), certificados de Mozilla, oferta escrita de código fuente y servicios de terceros. |
| `ayuda.html` | Se mantiene el tono de la ayuda. Cambios: rutas con "Configuración", dónde ver los documentos legales y el correo como canal de PQR. |

El texto de las páginas antiguas en `lite/` (borradores) quedó **desactualizado**: conviene borrarlo o dejar solo la copia de `pepito/`, para que no existan dos versiones públicas distintas.

---

## 3. Normas que aplican

| Norma | Qué exige | Cómo se refleja |
|---|---|---|
| **Constitución, art. 15** y **Ley Estatutaria 1581 de 2012** (habeas data) | Autorización previa, expresa e informada; finalidad; derechos del titular; deberes del responsable. | Política completa, numerales 4 a 11. |
| **Decreto 1074 de 2015** (compila el **Decreto 1377 de 2013**) | Contenido de la política y del aviso de privacidad; autorización; menores (art. 2.2.2.25.2.9); transmisión (contrato con el encargado). | Aviso en la parte superior; menores en el numeral 8. *Verificado con fuente.* |
| **Circular Única de la SIC**, Título V | Registro Nacional de Bases de Datos, transferencias internacionales, incidentes. | Secciones 5.7 y 5.9. |
| **Ley 1480 de 2011** (Estatuto del Consumidor) | Garantía legal; información; retracto (art. 47, 5 días hábiles); reversión del pago (art. 51); cláusulas abusivas (art. 42) e ineficaces (art. 43); no modificar unilateralmente los contratos de adhesión (art. 38). | Términos numerales 11, 13, 15 y 17. *Verificado con fuente.* |
| **Ley 527 de 1999** | Validez de los mensajes de datos y de la aceptación electrónica. | Términos numeral 1. |
| **Ley 23 de 1982, Ley 1915 de 2018 y Decisión Andina 351 de 1993** | Derechos de autor y conexos (la protección dura la vida del autor más 80 años según la Ley 1915; *por verificar*). | Términos numerales 6 y 7; sección 5.1. |
| **Ley 1581, arts. 14 a 16** | Consultas: 10 días hábiles (+5). Reclamos: 15 días hábiles (+8). La queja ante la SIC exige agotar antes el trámite con el responsable. | Política, numeral 10. La prórroga de 8 días se verificó con fuente; los demás plazos son del conocimiento general. |

**Reforma en trámite.** Hay proyectos de ley estatutaria para reformar la Ley 1581 (el del Gobierno se radicó en agosto de 2025 y hay una radicación posterior en 2026; las fuentes no coinciden en el número ni en el estado). Todavía no son ley; hay que volver a revisar la política si se aprueba (entre otras cosas, se habla de evaluaciones de impacto en protección de datos).

---

## 4. Hallazgos por documento

### 4.1 Política de privacidad (antes)

| # | Hallazgo | Fundamento | Cómo quedó |
|---|---|---|---|
| P-1 | No decía teléfono ni dirección del responsable. | Decreto 1377, art. 13 (identificación del responsable). | Campos pendientes. |
| P-2 | Plazo único de 15 días para todo. | Ley 1581, arts. 14 y 15. | Consultas 10+5, reclamos 15+8, con contenido mínimo del reclamo y desistimiento a los 2 meses. |
| P-3 | Edad: "no dirigido a menores de 14 años". | La Ley 1581 protege a **todos** los menores de 18. El umbral de 14 viene del Código Civil (capacidad), no de la ley de datos. | No dirigido a menores de 18 como titulares; solo con representante legal que crea la cuenta y autoriza. |
| P-4 | Omitía alarmas, ajustes, ciudad del clima, preferencias de dúos, estado del dispositivo y que los miembros ven identificadores internos. | Principio de transparencia. | Inventario completo (numeral 5). |
| P-5 | Decía "no compartimos con terceros" pero se usan Google, Open-Meteo y GitHub Pages. | Decreto 1377: informar encargados y transferencias. | Numeral 12, con la IP que reciben Open-Meteo y GitHub. |
| P-6 | No distinguía finalidades ni listaba las que no se usan. | Principio de finalidad. | Numerales 6 y 7 (sin publicidad, perfilamiento ni analítica). |
| P-7 | No trataba las imágenes que pueden contener datos de terceros o sensibles. | Ley 1581, art. 5 (sensibles). | Numeral 5: no se analizan, no se extraen datos biométricos. |
| P-8 | Seguridad genérica. | Principio de seguridad. | Medidas reales (cifrado con verificación de certificados, reglas por cuenta, correo verificado, actualizaciones firmadas). |
| P-9 | Sin procedimiento de revocatoria y supresión detallado. | Ley 1581, art. 8. | Numerales 7, 9 y 11. |

### 4.2 Términos y condiciones (antes)

| # | Hallazgo | Fundamento | Cómo quedó |
|---|---|---|---|
| T-1 | "Podemos cambiar o dejar de ofrecer funciones" sin condición. | Ley 1480, art. 38 (no modificar unilateralmente los contratos de adhesión). | Cambios con aviso, sin afectar derechos adquiridos ni funciones anunciadas al comprar. |
| T-2 | Limitación de responsabilidad por la alarma. | Ley 1480, arts. 42 y 43: son ineficaces las cláusulas que limitan la responsabilidad legal del proveedor. | Se convirtió en **advertencia de uso** (no depender de la alarma para lo crítico) y se dejó expresa la responsabilidad legal que no se excluye. |
| T-3 | No regulaba el contenido incluido en la app. | Ley 23 de 1982. | Numeral 7: uso personal, y un canal para que los titulares pidan el retiro. |
| T-4 | No decía capacidad para contratar ni cómo se acepta. | Código Civil (capacidad), Ley 527 de 1999. | Numerales 1 y 2. |
| T-5 | Sin contenido prohibido ni procedimiento de retiro. | Responsabilidad por contenido de terceros. | Numeral 6. |
| T-6 | Sin ley aplicable ni solución de controversias que respeten al consumidor. | Ley 1480 (competencia de la SIC). | Numeral 19, sin arbitraje obligatorio. |
| T-7 | La garantía del dispositivo solo se mencionaba. | Ley 1480 (garantía legal, retracto). | Remite a las condiciones de la venta (**falta ese documento**, sección 5.6). |

### 4.3 Licencias (antes)

- Faltaba la atribución de **Open-Meteo** (CC BY 4.0 exige atribución).
- Faltaba la **oferta escrita del código fuente** que exigen las licencias LGPL/GPL (tres años desde la distribución). Falta indicar la dirección del repositorio o decidir cómo entregarlo (campo pendiente).
- Se agregaron los certificados raíz de Mozilla (MPL 2.0) y los servicios de terceros.
- El juego Jump (Unlicense) sigue listado; los otros cuatro juegos **no pueden citarse** porque no tienen licencia (punto 4 del resumen).

### 4.4 Ayuda

No es un documento legal, pero crea expectativas (por ejemplo, "suena aunque el volumen esté en Silencio"): esas afirmaciones son ciertas hoy, y la información debe seguir siendo veraz y suficiente (Ley 1480, art. 23). Se actualizaron las rutas ("Configuración") y se agregó el canal de PQR.

---

## 5. Riesgos fuera de las páginas

### 5.1 Canciones con letra (gravedad alta)

El catálogo `musicales/` se entrega a todos los usuarios y solo el dueño puede importar canciones (decisión del 2026-11-25), de modo que **el dueño es quien reproduce y pone a disposición** las obras. Entre los 57 archivos .ino de la carpeta de origen hay, por sus títulos, obras comerciales evidentes (letras y arreglos de canciones protegidas; no se leyeron las letras). Una letra y una melodía arreglada son reproducción y adaptación que requieren autorización del titular (Ley 23 de 1982; Decisión Andina 351 de 1993). Las consecuencias posibles: reclamaciones de editoriales o de las entidades de gestión colectiva, y el retiro de la app de Google Play por su política de propiedad intelectual.

Recomendación:
1. Clasificar los 57 títulos en tres grupos: propios, de dominio público y de terceros protegidos.
2. Dejar en el catálogo solo los dos primeros grupos, más los que tengan licencia.
3. Mantener la importación solo para uso privado del dueño (no sincronizada con el catálogo de los usuarios).
4. Si se quieren obras comerciales, gestionar licencias con los titulares o con la entidad de gestión colectiva correspondiente (por verificar cuál y de qué tipo).

### 5.2 Open-Meteo (gravedad alta)

Según los términos oficiales de Open-Meteo, la API gratuita es **solo para uso no comercial** (hasta 10.000 llamadas al día) y el uso comercial requiere una suscripción de pago; los datos tienen licencia CC BY 4.0 con atribución. Cada Pepito Pro vendido llama a `api.open-meteo.com` y la app a su API de búsqueda de ciudades. Vender el dispositivo convierte ese uso en comercial. Falta confirmar con ellos los precios y si la licencia CC BY 4.0 de los datos cambia algo (las fuentes consultadas no lo aclaran). Opciones: plan comercial, otro proveedor de clima o retirar las caras con clima. La atribución ya está en `licencias.html`.

### 5.3 Tipografías GPL (media-alta)

Las tipografías FreeSans y FreeSerif (GNU FreeFont) están bajo GPL v3 o posterior con una excepción especial para fuentes. Según la propia licencia, la excepción cubre incrustar la fuente **sin modificar en un documento**; una lista de correo del proyecto cita una lectura más estricta que impediría incluirla en el binario de un producto no libre (no se pudo confirmar quién la escribió). Un programa que lleva los glifos dentro es un caso más cercano a ese último. Opciones: (a) opinión de un abogado de software; (b) reemplazar por tipografías con licencia SIL OFL (permite incluirlas en software), lo que cambia la vista previa de la app y el dibujo del dispositivo; (c) publicar el firmware bajo GPL (no recomendable si se quiere un producto cerrado). Es la auditoría H-43.

Aparte, el **núcleo Arduino para ESP32 (LGPL 2.1)** obliga a incluir el aviso y la licencia, y a que el usuario pueda reconstruir el programa con una versión modificada de ese componente (entregar el código o los objetos enlazables). La oferta escrita ya está en `licencias.html`; falta decidir dónde se publica el código (por verificar el alcance exacto con un abogado).

### 5.4 Biblioteca de imágenes y animaciones

No consta la procedencia de las 29 imágenes y las 9 animaciones de `biblioteca/`. Si son de personajes, marcas o de terceros, aplica lo de la sección 5.1. Hay que anotar de cada una: autor y licencia (propia, dominio público, licencia abierta con atribución).

### 5.5 Homologación del dispositivo

Los equipos con radio (Wi-Fi y Bluetooth en 2,4 GHz) pueden requerir homologación ante la CRC antes de venderse en Colombia. Las fuentes consultadas citan la Resolución CRC 5050 de 2016 (compilación), la Resolución 6129 de 2020 y la Circular CRC 155 de 2024, pero no se pudo confirmar el alcance exacto para este tipo de dispositivo (una fuente comercial dice que es obligatoria). **Por verificar directamente con la CRC** antes de importar o vender.

### 5.6 Condiciones de la venta (documento que falta)

Para vender el dispositivo en línea hacen falta unas **Condiciones de Venta** separadas de los Términos de uso, con: identificación del vendedor (nombre y documento o NIT, dirección), precio total con impuestos, tiempos y costos de entrega, garantía legal y de la marca, **derecho de retracto de 5 días hábiles** (art. 47 de la Ley 1480; la norma tiene excepciones que hay que revisar) y **reversión del pago** (art. 51), y canal de PQR. Además, vender de forma habitual implica registro mercantil, RUT y facturación electrónica (conocimiento general; por verificar con un contador). Se puede redactar cuando se tengan los datos comerciales.

### 5.7 Registro Nacional de Bases de Datos (RNBD)

Según las fuentes, deben registrarse las sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT (cerca de 4.900 millones de pesos en 2025; cambia cada año) y las personas jurídicas de naturaleza pública. Una persona natural no aparece obligada, pero las fuentes no lo dicen de forma expresa: **verificar con la SIC**. Si el negocio se opera por una sociedad, hay que revisar el umbral. Aun sin registro, la política y el procedimiento de consultas y reclamos son obligatorios.

### 5.8 Cambios en la app (requieren su aprobación)

- **Casilla de aceptación** sin marcar: "Acepto los Términos y Condiciones y la Política de Tratamiento de Datos Personales" con los enlaces, tanto al crear la cuenta como al entrar con Google. Hoy el texto dice "Al crear una cuenta aceptas la política de privacidad" y no enlaza los términos.
- **Registro de la aceptación** (versión y fecha) para poder demostrarla: requiere un campo nuevo en Firebase (`usuarios/{uid}`) y su regla; se propone aparte.
- **Google Play** exige, además de la política de privacidad, un **enlace web para solicitar la eliminación de la cuenta** y responder el formulario de seguridad de los datos (*verificado con fuente*). Hoy la política ofrece el correo y la eliminación desde la app; conviene una sección web propia (puede ser la misma página de privacidad con un ancla).

### 5.9 Transferencias, transmisión e incidentes

- Los datos de la base de Firebase están en Estados Unidos (instancia `…-default-rtdb.firebaseio.com`). La SIC incluye a Estados Unidos en su lista de países con nivel adecuado (Circular Externa 005 de 2017; *verificar que la lista vigente no cambió*) y la política obtiene además la autorización expresa del titular.
- Cuando se entregan datos a un encargado, el Decreto 1377 pide un **contrato de transmisión**. Los términos de tratamiento de datos de Firebase cumplen esa función: conviene aceptarlos y guardar la constancia (se aceptan desde la consola de Firebase).
- Ante un incidente de seguridad hay que informarlo a los titulares y, si se está en el RNBD, a la SIC dentro de los 15 días hábiles siguientes a que se detecte (*por verificar*).

### 5.10 Otros

- **Marca "Pepito":** hacer una búsqueda de antecedentes marcarios en la SIC y registrar la marca en las clases que correspondan (aplicaciones y dispositivos); "Pepito" es un nombre muy común y puede estar tomado (*no verificado*).
- **Correo de contacto:** hoy es una cuenta personal de Gmail. Conviene un correo exclusivo para PQR y datos personales.

---

## 6. Respuestas a las preguntas para el abogado (auditoría 2026-11-15, H-42 y H-43)

1. **Edad mínima.** La Ley 1581 protege a todos los menores de 18; "no dirigida a menores de 14" no es un umbral legal. El tratamiento de datos de menores es excepcional y exige autorización del representante legal con atención al interés superior (Decreto 1074, art. 2.2.2.25.2.9; verificado). Solución aplicada: el titular de la cuenta es mayor de edad; un menor solo usa el servicio con su representante, que crea la cuenta.
2. **Consentimiento.** Debe ser previo, expreso e informado y demostrable. La ley admite conductas inequívocas, pero lo más seguro es una **casilla sin marcar** y guardar versión y fecha. Hay que enlazar los términos además de la política.
3. **Plazos.** Corregidos: consultas 10 días hábiles (+5) y reclamos 15 días hábiles (+8).
4. **Contenido de la política.** Ahora menciona alarmas, ajustes, ciudad, estado del dispositivo, contenido que queda en el televisor y que los miembros ven los identificadores internos.
5. **Terceros.** La IP llega a Google, GitHub (y a Open-Meteo con el clima): ahora se declara. Ya no se usa Google Fonts. La transferencia a Estados Unidos se apoya en la lista de la SIC y en la autorización expresa; falta aceptar los términos de tratamiento de datos de Firebase.
6. **Términos.** (a) La limitación de responsabilidad no vale frente al consumidor en lo que la ley impone al proveedor (arts. 42 y 43); se reemplazó por una advertencia. (b) Venta en línea: retracto de 5 días hábiles, reversión del pago, garantía legal e identificación del vendedor: ver sección 5.6.
7. **Licencias.** Ver sección 5.3 y el punto 4 del resumen.
8. **RNBD.** Ver sección 5.7.

---

## 7. Datos que faltan para publicar

- [ ] Dirección de notificación del responsable (campo pendiente de la política).
- [ ] Teléfono de contacto (campo pendiente).
- [ ] Fecha de vigencia (campo pendiente en los tres documentos).
- [ ] Dirección del repositorio público del código, o decisión de entregarlo por solicitud (campo pendiente de licencias).
- [ ] Decisión sobre el correo de contacto (¿uno exclusivo?).
- [ ] Decisión sobre el compromiso de **15 días hábiles** para PQR de los Términos (es una promesa de servicio, no un plazo de ley).
- [ ] Datos comerciales para las Condiciones de Venta (nombre y documento o NIT, dirección, garantía de la marca, costos de envío).

## 8. Orden recomendado

1. Decidir sobre canciones, Open-Meteo y tipografías (puntos 1 a 3): cambian el producto, no solo los textos.
2. Completar los datos de la sección 7 y publicar los documentos con la nueva versión de la app.
3. Aprobar los cambios de la sección 5.8 (casilla de aceptación y registro).
4. Redactar las Condiciones de Venta y verificar la homologación con la CRC.
5. Revisión final por un abogado colombiano inscrito, con este informe como guía.

## Fuentes consultadas

- [Open-Meteo: términos y privacidad](https://open-meteo.com/en/terms), [licencia](https://open-meteo.com/en/license)
- [Decreto 1377 de 2013 (Cancillería, normograma)](https://cancilleria.gov.co/normograma/compilacion/docs/decreto_1377_2013.htm)
- [Registro Nacional de Bases de Datos (Holland & Knight, 2025)](https://www.hklaw.com/es/insights/publications/2025/01/obligaciones-del-registro-nacional-de-bases-de-datos-personales)
- [Circular Externa 005 de 2017 de la SIC (transferencias internacionales)](https://cancilleria.gov.co/sites/default/files/Normograma/docs/circular_superindustria_0005_2017.htm)
- [Ley 1480 de 2011 (Cancillería, normograma)](https://cancilleria.gov.co/normograma/compilacion/docs/ley_1480_2011.htm)
- [Google Play: requisitos de eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111)
- [GNU FreeFont: licencia](https://www.gnu.org/s/freefont/license.html)
- [CRC: homologación de equipos](https://crcom.gov.co)
- [Reforma de la Ley 1581: Ministerio de Comercio](https://www.mincit.gov.co/prensa/noticias/general/actualizar-normas-proteccion-datos-personales), [SIC: modernización](https://sedeelectronica.sic.gov.co/transparencia/informacion-de-la-entidad/eventos/modernizacion-de-la-ley-1581-de-2012)
