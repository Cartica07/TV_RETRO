// Guarda en --alto-cabecera lo que mide la cabecera fija (barra de arriba + tarjeta de la pantalla). Lo usa css/unificada.css para que la
// fila de pestañas y la caneca de la Galería queden pegadas justo debajo de la cabecera cuando se baja por las miniaturas.
// La medida cambia con el ancho del celular y con las líneas de estado, por eso se vuelve a calcular cuando la cabecera cambia de tamaño.
const cabecera = document.querySelector('.cabecera-fija');
if (cabecera) {
  const poner = () => {
    const alto = Math.round(cabecera.getBoundingClientRect().height);
    if (alto > 0) document.documentElement.style.setProperty('--alto-cabecera', alto + 'px');
  };
  poner();
  if (typeof ResizeObserver === 'function') new ResizeObserver(poner).observe(cabecera);
  window.addEventListener('resize', poner);
}
