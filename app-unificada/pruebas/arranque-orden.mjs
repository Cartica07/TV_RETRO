// Si lo último guardado en la TV es una ORDEN (actualizar, restablecer, juego, alarma, ajustes) y no contenido, la app abre en
// Texto. Antes, con "actualizar" o "restablecer", abría sin ninguna pestaña a la vista (visto por el dueño el 2026-11-24).
import { abrir, cerrar, informe, pant, esperarPanel } from './banco-unificado.mjs';

for (const tipo of ['actualizar', 'restablecer', 'ajustes', 'juego']) {
  const { navegador, pagina } = await abrir({
    dispositivos: { tv1: { dueno: 'uid-ana', oled_remota: { version: 3, pantalla: { ...pant('Hola Mundo'), tipo } }, firmware: { build: 11, estado: 'ok', fecha: 1 } } },
    usuarios: { 'uid-ana': { dispositivos: { tv1: true } } },
  });
  await esperarPanel(pagina);
  await pagina.waitForTimeout(800);
  const r = await pagina.evaluate(() => ({
    texto: getComputedStyle(document.getElementById('seccionTexto')).display !== 'none',
    pestana: (document.querySelector('#grupoTipo button[aria-current="page"], #grupoTipo button.activo') || {}).dataset?.valor || '',
    mensaje: document.getElementById('texto').value,
  }));
  informe(`Con la orden "${tipo}" guardada abre en Texto`, r.texto && r.mensaje === 'Hola Mundo', JSON.stringify(r));
  await navegador.close();
}
cerrar();
