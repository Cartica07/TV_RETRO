import { abrir, cerrarServidor, informe } from './banco.mjs';
for (const [w, h] of [[390, 844], [360, 740]]) {
  const { navegador, pagina, errores } = await abrir({}, { ancho: w, alto: h });
  const raros = [];
  let sinScroll = true;
  for (const t of ['texto', 'imagen', 'dibujo', 'cancion', 'galeria']) {
    await pagina.click(`#grupoTipo button[data-valor="${t}"]`);
    await pagina.waitForTimeout(200);
    const r = await pagina.evaluate(() => ({ txt: document.body.innerText, fin: document.querySelector('main.controles').getBoundingClientRect().bottom, barra: (getComputedStyle(document.querySelector('.barra-accion')).display === 'none' ? document.querySelector('.nav-inferior') : document.querySelector('.barra-accion')).getBoundingClientRect().top }));
    if (/firebase/i.test(r.txt)) raros.push(t);
    if (r.fin > r.barra) sinScroll = false;
  }
  const estado = await pagina.evaluate(() => document.getElementById('estadoTexto').textContent.trim());
  informe(`${w}x${h}: ningún texto visible dice "Firebase", sin scroll, sin errores`, raros.length === 0 && sinScroll && errores.length === 0, `estado="${estado}" raros=${raros} errores=${errores.length}`);
  await navegador.close();
}
cerrarServidor();
