import { abrir, cerrarServidor, informe } from './banco.mjs';
function gif(w, h, cuadros) {
  const b = [0x47,0x49,0x46,0x38,0x39,0x61, w & 255, w >> 8, h & 255, h >> 8, 0x80, 0, 0, 0,0,0, 255,255,255];
  for (let i = 0; i < cuadros; i++) {
    b.push(0x21,0xF9,4,0, 10,0, 0,0);                 // GCE 100 ms
    b.push(0x2C, 0,0,0,0, 1,0,1,0, 0, 2, 2, i % 2 ? 0x4C : 0x44, 1, 0); // 1x1, LZW mínimo
  }
  b.push(0x3B);
  return Buffer.from(b);
}
async function subir(pestana, nombre, buffer, mime) {
  const { navegador, pagina, errores } = await abrir({}, {});
  await pagina.click(`#grupoTipo button[data-valor="${pestana}"]`);
  await pagina.setInputFiles('#cargadorImagen', { name: nombre, mimeType: mime, buffer });
  await pagina.waitForTimeout(2500);
  const estado = await pagina.evaluate(() => document.getElementById('estadoTexto').textContent.trim());
  const aviso = await pagina.evaluate(() => document.getElementById('avisoGaleria').textContent.trim());
  await navegador.close();
  return { estado, aviso, errores: errores.filter((e) => !/Error procesando imagen/.test(e)).length };
}
let r = await subir('imagen', 'enorme.png', Buffer.alloc(26 * 1024 * 1024, 1), 'image/png');
informe('archivo de 26 MB: mensaje claro', /demasiado grande \(máximo 25 MB\)/.test(r.estado) && r.errores === 0, JSON.stringify(r));
r = await subir('imagen', 'ancho.gif', gif(3000, 10, 2), 'image/gif');
informe('GIF de 3000 px de ancho: mensaje claro', /demasiado grande en píxeles/.test(r.estado) && r.errores === 0, JSON.stringify(r));
r = await subir('imagen', 'largo.gif', gif(1, 1, 1001), 'image/gif');
informe('GIF de 1001 cuadros: mensaje claro', /demasiados cuadros \(máximo 1000\)/.test(r.estado) && r.errores === 0, JSON.stringify(r));
r = await subir('imagen', 'bien.gif', gif(1, 1, 3), 'image/gif');
informe('GIF de 3 cuadros: se acepta', /GIF: 3 cuadros|GIF/.test(r.estado) && !/demasiad|No se pudo/.test(r.estado) && r.errores === 0, JSON.stringify(r));
r = await subir('imagen', 'limite.gif', gif(1, 1, 1000), 'image/gif');
informe('GIF de 1000 cuadros: se acepta (justo en el tope)', !/demasiad|No se pudo/.test(r.estado) && r.errores === 0, JSON.stringify(r));
cerrarServidor();
