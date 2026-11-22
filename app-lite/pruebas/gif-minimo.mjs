// Crea un GIF animado de 2 colores para las pruebas (sin librerías). La compresión LZW es la más simple posible:
// se manda un "clear" antes de cada píxel, así la tabla nunca crece y el decodificador no necesita nada especial.
// Pesa unos 6 KB por cuadro de 128x64, de sobra para probar.
export function crearGif(cuadros, { ancho = 128, alto = 64, retardoCs = 10 } = {}) {
  const bytes = [];
  const w16 = (n) => bytes.push(n & 255, (n >> 8) & 255);
  for (const c of 'GIF89a') bytes.push(c.charCodeAt(0));
  w16(ancho); w16(alto);
  bytes.push(0x80, 0, 0);                 // tabla global de 2 colores
  bytes.push(0, 0, 0, 255, 255, 255);     // negro y blanco
  bytes.push(0x21, 0xFF, 11, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0); // repetir siempre

  for (const px of cuadros) {
    bytes.push(0x21, 0xF9, 4, 0x00); w16(retardoCs); bytes.push(0, 0);       // retardo del cuadro
    bytes.push(0x2C); w16(0); w16(0); w16(ancho); w16(alto); bytes.push(0);  // cuadro completo
    bytes.push(2);                                                            // tamaño mínimo de código
    // LZW: clear(4) + píxel por cada píxel, y fin(5). Códigos de 3 bits, de menor a mayor peso.
    const salida = [];
    let acumulado = 0, nbits = 0;
    const emitir = (codigo) => { acumulado |= codigo << nbits; nbits += 3; while (nbits >= 8) { salida.push(acumulado & 255); acumulado >>= 8; nbits -= 8; } };
    for (let i = 0; i < px.length; i++) { emitir(4); emitir(px[i] ? 1 : 0); }
    emitir(5);
    if (nbits > 0) salida.push(acumulado & 255);
    for (let i = 0; i < salida.length; i += 255) {
      const trozo = salida.slice(i, i + 255);
      bytes.push(trozo.length, ...trozo);
    }
    bytes.push(0);
  }
  bytes.push(0x3B);
  return Buffer.from(bytes);
}

/** Un cuadro con un cuadrado blanco que cambia de lugar según "k" (para que cada cuadro sea distinto). */
export function cuadroDePrueba(k, ancho = 128, alto = 64) {
  const px = new Uint8Array(ancho * alto);
  const x0 = (k * 20) % (ancho - 20);
  for (let y = 10; y < 30; y++) for (let x = x0; x < x0 + 20; x++) px[y * ancho + x] = 1;
  return px;
}
