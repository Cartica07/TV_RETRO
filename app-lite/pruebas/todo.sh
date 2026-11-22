#!/bin/bash
# Corre todas las pruebas simuladas de la app Lite, una por una (cada una abre y cierra su propio navegador).
# Uso (desde app-lite/): bash pruebas/todo.sh   — sale con codigo distinto de cero si alguna falla.
cd "$(dirname "$0")/.." || exit 1
node construir.mjs > /dev/null || exit 1
FALLAS=0
for t in arranque enviar-texto canciones imagenes galeria alarma-ajustes conexion gif-pesado predeterminadas; do
  # Un servidor de una corrida cortada puede dejar el puerto 8766 ocupado.
  PID=$(netstat -ano 2>/dev/null | grep ":8766" | grep LISTENING | awk '{print $5}' | head -1)
  [ -n "$PID" ] && taskkill //PID "$PID" //F > /dev/null 2>&1
  timeout 280 node "pruebas/$t.mjs" > "/tmp/lite-$t.txt" 2>&1
  OK=$(grep -c '^OK' "/tmp/lite-$t.txt"); MAL=$(grep -c '^FALLA' "/tmp/lite-$t.txt")
  echo "== $t: $OK OK, $MAL FALLA"
  [ "$MAL" != "0" ] && grep '^FALLA' "/tmp/lite-$t.txt" | head -3 && FALLAS=1
  [ "$OK" = "0" ] && echo "   (sin resultados: mira /tmp/lite-$t.txt)" && FALLAS=1
done
exit $FALLAS
