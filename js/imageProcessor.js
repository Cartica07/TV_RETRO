/**
 * Image Processor para V1.6
 * Maneja carga, redimensionamiento y conversión de imágenes a bitmap monocromático 1bpp
 */

/**
 * Carga y redimensiona una imagen (desde cualquier src válido para
 * HTMLImageElement: dataURL, blob URL, etc.) manteniendo la relación de
 * aspecto sin distorsión. Agrega marcos negros si es necesario.
 * Es el helper común detrás de cargarYRedimensionarImagen (que parte de
 * un File) y cargarYRedimensionarDesdeDataURL (que parte de un dataURL
 * ya en memoria, por ejemplo el guardado en el catálogo).
 */
function cargarYRedimensionarDesdeSrc(src, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Calcular escala manteniendo aspecto
      const ratioImagen = img.width / img.height;
      const ratioDestino = targetWidth / targetHeight;

      let newWidth, newHeight;

      if (ratioImagen > ratioDestino) {
        // Imagen más ancha: ajustar por ancho
        newWidth = targetWidth;
        newHeight = Math.round(targetWidth / ratioImagen);
      } else {
        // Imagen más alta: ajustar por alto
        newHeight = targetHeight;
        newWidth = Math.round(targetHeight * ratioImagen);
      }

      // Calcular posición para centrar
      const offsetX = Math.round((targetWidth - newWidth) / 2);
      const offsetY = Math.round((targetHeight - newHeight) / 2);

      // Crear canvas con fondo negro
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Suavizado de alta calidad al achicar la imagen: reduce el
      // aliasing/ruido que deja un downscale sin suavizar, lo que
      // ayuda tanto al umbral simple como al dithering posteriores.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fondo negro
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Dibujar imagen redimensionada y centrada
      ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);

      resolve({
        canvas: canvas,
        width: targetWidth,
        height: targetHeight,
        offsetX: offsetX,
        offsetY: offsetY,
        scaleWidth: newWidth,
        scaleHeight: newHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = src;
  });
}

/**
 * Lee un File como dataURL (Promise wrapper de FileReader).
 */
function leerArchivoComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Carga y redimensiona una imagen manteniendo la relación de aspecto
 * sin distorsión. Agrega marcos negros si es necesario.
 * 
 * @param {File} file - Archivo de imagen
 * @param {number} targetWidth - Ancho destino (128 para OLED)
 * @param {number} targetHeight - Alto destino (64 para OLED)
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number}>}
 */
export async function cargarYRedimensionarImagen(file, targetWidth, targetHeight) {
  const dataUrl = await leerArchivoComoDataURL(file);
  return cargarYRedimensionarDesdeSrc(dataUrl, targetWidth, targetHeight);
}

/**
 * Igual que cargarYRedimensionarImagen, pero partiendo de un dataURL que
 * ya está en memoria (por ejemplo, la versión "preprocesada" guardada en
 * el catálogo de Firebase) en vez de un File del disco.
 *
 * @param {string} dataUrl
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number}>}
 */
export async function cargarYRedimensionarDesdeDataURL(dataUrl, targetWidth, targetHeight) {
  return cargarYRedimensionarDesdeSrc(dataUrl, targetWidth, targetHeight);
}

/**
 * Convierte una imagen (canvas) a escala de grises
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement} Canvas con la imagen en escala de grises
 */
export function convertirAEscalaGrises(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Luminancia (ITU-R BT.601: 0.299 R + 0.587 G + 0.114 B)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Convierte una imagen en escala de grises a bitmap monocromático (1 bpp)
 * Usa umbralización simple: pixeles > umbral = blanco (1), <= umbral = negro (0)
 * 
 * @param {HTMLCanvasElement} canvas - Canvas con imagen en escala de grises
 * @param {number} umbral - Valor de umbral (0-255, default 127)
 * @returns {{bitmap: Uint8Array, width: number, height: number}}
 */
export function convertirAMonocromatico(canvas, umbral = 127) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Calcular bytes necesarios: (ancho + 7) / 8 * alto
  const bytesPorFila = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPorFila * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const grayValue = data[pixelIndex]; // Ya está en escala de grises (R=G=B)
      
      // Determinar si el pixel es blanco o negro
      const bit = grayValue > umbral ? 1 : 0;
      
      // Calcular posición en el bitmap
      const byteIndex = y * bytesPorFila + Math.floor(x / 8);
      const bitPosition = 7 - (x % 8); // MSB primero (como Adafruit_GFX)
      
      if (bit) {
        bitmap[byteIndex] |= (1 << bitPosition);
      }
    }
  }
  
  return { bitmap, width, height };
}

/**
 * Codifica un array de bytes en Base64
 * @param {Uint8Array} data
 * @returns {string} Cadena Base64
 */
export function codificarBase64(data) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i];
    const b = i + 1 < data.length ? data[i + 1] : 0;
    const c = i + 2 < data.length ? data[i + 2] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars[(bitmap >> 18) & 63];
    result += chars[(bitmap >> 12) & 63];
    result += chars[(bitmap >> 6) & 63];
    result += chars[bitmap & 63];
  }
  
  // Ajustar padding
  if (data.length % 3 === 1) {
    result = result.slice(0, -2) + '==';
  } else if (data.length % 3 === 2) {
    result = result.slice(0, -1) + '=';
  }
  
  return result;
}

/**
 * Convierte una imagen en escala de grises a bitmap monocromático (1 bpp)
 * usando dithering de Floyd-Steinberg: en vez de cortar en seco como el
 * umbral simple, difunde el error de cada píxel hacia sus vecinos, así
 * los tonos medios (sombras, degradados, fotos) se representan con una
 * trama de puntos en vez de perderse en un solo bloque blanco o negro.
 * Es más fiel al original en fotos; en imágenes ya binarias (logos,
 * texto) el error es ~0 y el resultado es prácticamente el mismo que
 * el umbral simple.
 *
 * @param {HTMLCanvasElement} canvas - Canvas con imagen en escala de grises
 * @param {number} umbral - Punto de corte medio (0-255, default 127)
 * @returns {{bitmap: Uint8Array, width: number, height: number}}
 */
function convertirAMonocromaticoDither(canvas, umbral = 127) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const width = canvas.width;
  const height = canvas.height;

  // Copia de trabajo en punto flotante: el error difundido puede
  // sacar los valores fuera del rango 0-255 durante el proceso.
  const gris = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) gris[p] = data[p * 4];

  const bytesPorFila = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPorFila * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const viejo = gris[idx];
      const nuevo = viejo >= umbral ? 255 : 0;
      const error = viejo - nuevo;

      if (nuevo === 255) {
        const byteIndex = y * bytesPorFila + (x >> 3);
        const bitPosition = 7 - (x & 7);
        bitmap[byteIndex] |= (1 << bitPosition);
      }

      // Distribución de error de Floyd-Steinberg (7/16, 3/16, 5/16, 1/16)
      if (x + 1 < width) gris[idx + 1] += error * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) gris[idx - 1 + width] += error * 3 / 16;
        gris[idx + width] += error * 5 / 16;
        if (x + 1 < width) gris[idx + 1 + width] += error * 1 / 16;
      }
    }
  }

  return { bitmap, width, height };
}

/**
 * Difuminado de Atkinson (el mismo de CancionesMiniTV / Mac clásico):
 * reparte solo 6/8 del error (1/8 a cada uno de 6 vecinos) y descarta el
 * resto. A diferencia de Floyd-Steinberg (que conserva el 100 % del error
 * y por eso el brillo promedio casi no cambia aunque se mueva el umbral),
 * acá el umbral sí aclara u oscurece la imagen de forma notoria, y el
 * resultado tiene más contraste: se ve mejor en una OLED de 1 bit.
 *
 * @param {Uint8Array|Float32Array} gris - 0..255, ancho*alto valores
 * @param {number} width
 * @param {number} height
 * @param {number} umbral - 0..255 (más alto = más oscuro)
 * @returns {Uint8Array} bitmap 1bpp, MSB primero, 1 = encendido
 */
export function grisABitmapAtkinson(gris, width, height, umbral = 127) {
  const g = Float32Array.from(gris);
  const bytesPorFila = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPorFila * height);
  const suma = (x, y, e) => { if (x >= 0 && x < width && y < height) g[y * width + x] += e; };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const viejo = g[y * width + x];
      const nuevo = viejo >= umbral ? 255 : 0;
      const e = (viejo - nuevo) / 8;
      if (nuevo === 255) bitmap[y * bytesPorFila + (x >> 3)] |= (1 << (7 - (x & 7)));
      suma(x + 1, y, e); suma(x + 2, y, e);
      suma(x - 1, y + 1, e); suma(x, y + 1, e); suma(x + 1, y + 1, e);
      suma(x, y + 2, e);
    }
  }
  return bitmap;
}

/**
 * Umbral simple sobre un arreglo de grises (sin difuminado).
 * @returns {Uint8Array} bitmap 1bpp, MSB primero, 1 = encendido
 */
export function grisABitmapUmbral(gris, width, height, umbral = 127) {
  const bytesPorFila = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPorFila * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gris[y * width + x] > umbral) bitmap[y * bytesPorFila + (x >> 3)] |= (1 << (7 - (x & 7)));
    }
  }
  return bitmap;
}

/**
 * Grises (0..255) de un canvas, con la misma fórmula de luminancia que
 * convertirAEscalaGrises. No modifica el canvas.
 */
export function grisesDeCanvas(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const g = new Uint8Array(w * h);
  for (let k = 0; k < g.length; k++) g[k] = Math.round(0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]);
  return g;
}

/**
 * Opciones de geometría al convertir (mismas que CancionesMiniTV):
 *   escala: 'ajustar' (entra entera, con bordes) | 'llenar' (cubre todo,
 *           recorta) | 'estirar' (deforma) | 'original' (píxel a píxel)
 *   fondo:  'negro' | 'blanco' (lo que no cubre la imagen)
 *   rotar:  0 | 90 | 180 | 270 (sentido horario)
 *   volteoH, volteoV: espejo horizontal / vertical (sobre lo ya girado)
 */
export const OPCIONES_GEOMETRIA_DEFECTO = Object.freeze({
  escala: 'ajustar', fondo: 'negro', rotar: 0, volteoH: false, volteoV: false
});

/**
 * Dibuja "fuente" (img, canvas, ImageBitmap…) de tamaño sw×sh dentro de
 * un canvas destino ya creado, aplicando escala, fondo, giro y volteo.
 * Portado de acomodarEn128x64 (CancionesMiniTV).
 */
export function acomodarEnDestino(fuente, sw, sh, opciones, destino) {
  const o = Object.assign({}, OPCIONES_GEOMETRIA_DEFECTO, opciones || {});
  const ANCHO = destino.width, ALTO = destino.height;
  const dctx = destino.getContext('2d', { willReadFrequently: true });
  const giro = o.rotar === 90 || o.rotar === 270;
  const rw = giro ? sh : sw, rh = giro ? sw : sh;              // tamaño de la imagen ya girada
  const ratio = rw / rh, ratioDest = ANCHO / ALTO;
  let dw, dh;
  if (o.escala === 'estirar') { dw = ANCHO; dh = ALTO; }
  else if (o.escala === 'original') { dw = rw; dh = rh; }
  else if ((o.escala === 'llenar') === (ratio > ratioDest)) { dh = ALTO; dw = Math.max(1, Math.round(ALTO * ratio)); }
  else { dw = ANCHO; dh = Math.max(1, Math.round(ANCHO / ratio)); }
  const ox = Math.round((ANCHO - dw) / 2), oy = Math.round((ALTO - dh) / 2);

  dctx.save();
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.fillStyle = o.fondo === 'blanco' ? '#ffffff' : '#000000';
  dctx.fillRect(0, 0, ANCHO, ALTO);
  dctx.imageSmoothingEnabled = o.escala !== 'original';
  dctx.imageSmoothingQuality = 'high';
  if (o.rotar === 0 && !o.volteoH && !o.volteoV) {
    dctx.drawImage(fuente, ox, oy, dw, dh);
  } else {
    dctx.translate(ox + dw / 2, oy + dh / 2);
    dctx.scale(o.volteoH ? -1 : 1, o.volteoV ? -1 : 1);
    dctx.rotate(o.rotar * Math.PI / 180);
    const pw = giro ? dh : dw, ph = giro ? dw : dh;            // tamaño antes de girar
    dctx.drawImage(fuente, -pw / 2, -ph / 2, pw, ph);
  }
  dctx.restore();
}

/**
 * Carga un archivo de imagen y devuelve la imagen ORIGINAL (sin achicar),
 * para poder reconvertirla cuantas veces haga falta al cambiar escala,
 * fondo, giro o volteo.
 * @returns {Promise<{el: HTMLImageElement, w: number, h: number, dataUrl: string}>}
 */
export async function cargarImagenOriginal(file) {
  const dataUrl = await leerArchivoComoDataURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ el: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, dataUrl });
    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    img.src = dataUrl;
  });
}

/**
 * Convierte una imagen original con opciones de geometría + umbral +
 * difuminado (Atkinson). Devuelve lo mismo que procesarImagenDesdeDataURL,
 * así el resto del panel la usa igual.
 *
 * @param {{el, w, h}} original - de cargarImagenOriginal
 * @param {object} opciones - { escala, fondo, rotar, volteoH, volteoV, umbral, dithering }
 */
export function procesarImagenConOpciones(original, opciones = {}, targetWidth = 128, targetHeight = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  acomodarEnDestino(original.el, original.w, original.h, opciones, canvas);
  const preprocesada = canvas.toDataURL('image/png');
  const gris = grisesDeCanvas(canvas);
  const umbral = Number.isFinite(opciones.umbral) ? opciones.umbral : 127;
  const bitmap = opciones.dithering
    ? grisABitmapAtkinson(gris, targetWidth, targetHeight, umbral)
    : grisABitmapUmbral(gris, targetWidth, targetHeight, umbral);
  return {
    imagenData: codificarBase64(bitmap),
    imagenAncho: targetWidth,
    imagenAlto: targetHeight,
    canvas,
    preprocesada
  };
}

/**
 * Procesa una imagen ya en memoria (dataURL): redimensiona, convierte a
 * monocromático y codifica en Base64. Es el núcleo que usan tanto
 * procesarImagen (arranca de un File) como la re-edición de imágenes
 * del catálogo (arranca del dataURL "preprocesada" ya guardado).
 *
 * @param {string} dataUrl - Imagen de origen como dataURL
 * @param {number} targetWidth - Ancho destino (128)
 * @param {number} targetHeight - Alto destino (64)
 * @param {number} umbral - Umbral de binarización (0-255)
 * @param {boolean} dithering - true = Atkinson, false = umbral simple
 * @returns {Promise<{imagenData: string, imagenAncho: number, imagenAlto: number, canvas: HTMLCanvasElement, preprocesada: string}>}
 */
export async function procesarImagenDesdeDataURL(dataUrl, targetWidth = 128, targetHeight = 64, umbral = 127, dithering = true) {
  try {
    // 1. Cargar y redimensionar
    const { canvas: canvasRedim } = await cargarYRedimensionarDesdeDataURL(
      dataUrl,
      targetWidth,
      targetHeight
    );

    // Guardamos el dataURL de la imagen YA redimensionada/centrada pero
    // TODAVÍA a color y sin binarizar -- es el punto de partida liviano
    // (128×64, unos pocos KB) que permite volver a probar otro umbral u
    // otro modo de dithering más adelante sin tener que volver a subir
    // el archivo original. Hay que sacarlo ANTES de convertirAEscalaGrises,
    // que muta el canvas en el lugar.
    const preprocesada = canvasRedim.toDataURL('image/png');

    // 2. Convertir a escala de grises
    const canvasGris = convertirAEscalaGrises(canvasRedim);
    
    // 3. Convertir a monocromático: difuminado de Atkinson (el umbral sí
    //    cambia el resultado) o umbral simple. Floyd-Steinberg
    //    (convertirAMonocromaticoDither) queda disponible pero ya no se usa.
    const width = canvasGris.width;
    const height = canvasGris.height;
    const bitmap = dithering
      ? grisABitmapAtkinson(grisesDeCanvas(canvasGris), width, height, umbral)
      : convertirAMonocromatico(canvasGris, umbral).bitmap;
    
    // 4. Codificar en Base64
    const imagenData = codificarBase64(bitmap);
    
    return {
      imagenData,
      imagenAncho: width,
      imagenAlto: height,
      canvas: canvasRedim, // Devolver el canvas redimensionado para preview
      preprocesada
    };
  } catch (error) {
    console.error('Error al procesar imagen:', error);
    throw error;
  }
}

/**
 * Procesa una imagen: redimensiona, convierte a monocromático y codifica en Base64
 * 
 * @param {File} file - Archivo de imagen cargado
 * @param {number} targetWidth - Ancho destino (128)
 * @param {number} targetHeight - Alto destino (64)
 * @param {number} umbral - Umbral de binarización (0-255)
 * @param {boolean} dithering - true = Atkinson (mejor para fotos/degradados),
 *                              false = umbral simple (mejor para logos/texto)
 * @returns {Promise<{imagenData: string, imagenAncho: number, imagenAlto: number, canvas: HTMLCanvasElement, preprocesada: string}>}
 */
export async function procesarImagen(file, targetWidth = 128, targetHeight = 64, umbral = 127, dithering = true) {
  const dataUrl = await leerArchivoComoDataURL(file);
  return procesarImagenDesdeDataURL(dataUrl, targetWidth, targetHeight, umbral, dithering);
}

/**
 * Dibuja un preview de la imagen procesada en un canvas.
 *
 * Importante: NO toca canvas.width/height ni repinta el fondo. El
 * llamador (dibujarOLED en renderer.js) ya pintó el fondo con el
 * color correcto según "invertido" antes de llamar acá -- si acá
 * reseteábamos el canvas y usábamos blanco/negro fijos, el switch
 * "Invertido" quedaba sin efecto en el preview (aunque sí se
 * aplicaba en la OLED física, porque display.invertDisplay() no
 * depende de este código).
 *
 * @param {HTMLCanvasElement} canvas - Canvas destino (ya con el fondo pintado)
 * @param {string} base64Data - Datos de imagen en Base64
 * @param {number} width - Ancho de la imagen
 * @param {number} height - Alto de la imagen
 * @param {string} colorFrente - Color de los píxeles "encendidos" (bit=1),
 *                                ya resuelto según invertido por el llamador.
 */
export function dibujarPreviewImagen(canvas, base64Data, width, height, colorFrente = '#ffffff') {
  // Decodificar Base64 a bytes
  const binaryString = atob(base64Data);
  const bitmap = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bitmap[i] = binaryString.charCodeAt(i);
  }

  const ctx = canvas.getContext('2d');
  const bytesPorFila = Math.ceil(width / 8);

  ctx.fillStyle = colorFrente;

  // Solo se dibujan los píxeles "encendidos" (bit=1); los apagados
  // quedan con el color de fondo que el llamador ya pintó.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byteIndex = y * bytesPorFila + (x >> 3);
      const bitPosition = 7 - (x & 7);

      if ((bitmap[byteIndex] >> bitPosition) & 1) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
