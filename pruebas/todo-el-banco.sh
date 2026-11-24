#!/bin/bash
# Corre todo el banco de pruebas una vez y resume el resultado de cada suite.
# Uso: bash pruebas/todo-el-banco.sh        (desde cualquier carpeta; tarda ~40 min)
# Variables opcionales:
#   SALIDA          carpeta donde se deja el detalle de cada suite (por defecto /tmp)
#   REGLAS_ARCHIVO  reglas contra las que corren las suites de reglas (por defecto database.rules.json del repo;
#                   para comprobar lo PUBLICADO en la consola, pega las reglas en un archivo y apunta aquí)
#   RUTA_FIRMWARE   repo del firmware (solo lo usa simular-tv; sin él esa suite se omite)
AQUI="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
cd "$AQUI" || exit 1
SALIDA="${SALIDA:-/tmp}"
# En el equipo del dueño el emulador usa el JDK de Android Studio (el JDK portátil se cae).
if [ -z "$JAVA_HOME" ] && [ -d "C:/Program Files/Android/Android Studio/jbr" ]; then
  export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
  export PATH="$PATH:C:/Program Files/Android/Android Studio/jbr/bin"
fi
export REGLAS_ARCHIVO="${REGLAS_ARCHIVO:-$AQUI/../database.rules.json}"
FALLOS=0
TOPE="${TOPE:-900}"   # segundos máximos por suite: una que no termina ya no deja colgado todo el banco
resumen() { # nombre, salida, código de salida de la suite
  local f="$2"; local cod="${3:-0}"; local ok=$(grep -c "^OK" "$f"); local mal=$(grep -c "^FALLA\|^MAL\|^FALLÓ\|^PROBLEMA" "$f")
  local ult=$(grep -E "escenarios:|todo bien|FALLAS|Resultado" "$f" | tail -1 | cut -c1-120)
  local aviso=""
  # Una suite que se corta por tiempo, o que no deja ni un solo OK (por ejemplo, el emulador se cayó), NO es "0 fallas".
  if [ "$cod" -eq 124 ]; then aviso=" | TIEMPO AGOTADO (${TOPE} s)"; mal=$((mal+1))
  elif [ "$ok" -eq 0 ] && [ "$cod" -eq 0 ] && grep -q "omitida" "$f"; then aviso=" | omitida a propósito (no es una falla)"
  elif [ "$ok" -eq 0 ]; then aviso=" | SIN NINGÚN OK (código $cod): la suite no corrió bien"; mal=$((mal+1)); fi
  echo "== $1: OK=$ok FALLAS=$mal | $ult$aviso"
  [ "$mal" -gt 0 ] && FALLOS=$((FALLOS+1))
}
echo "### PANEL (Playwright, Firebase falso)"
for t in pruebas-panel bobos login tv compartir cuotas verificacion login-google atras tutorial baja-cuenta baja-ui sin-red-arranque apk-sin-internet etapa1-sin-firebase etapa1-topes etapa1-admin-canciones mas alarma config sistema auditoria-b carga-masiva-cuentas; do
  [ -f "$t.mjs" ] || continue
  timeout "$TOPE" node "$t.mjs" > "$SALIDA/b-$t.txt" 2>&1; resumen "$t" "$SALIDA/b-$t.txt" $?
done
echo "### INTÉRPRETE DE .ino"
timeout "$TOPE" node ino-infinito.mjs > "$SALIDA/b-ino-infinito.txt" 2>&1; echo "== ino-infinito: $(grep -c 'error:' "$SALIDA/b-ino-infinito.txt") casos cortados a tiempo (esperado: 4)"
echo "### REGLAS (emulador, con $REGLAS_ARCHIVO)"
for t in reglas reglas-etapa2 reglas-atomico reglas-envios-reales reglas-borrar-cuenta reglas-desvincular reglas-acuse reglas-indice reglas-juego reglas-alarma reglas-ajustes reglas-apodos reglas-firmware reglas-caras; do
  timeout "$TOPE" npx firebase emulators:exec --only database --project "demo-$t" "node $t.mjs" > "$SALIDA/b-$t.txt" 2>&1; resumen "$t" "$SALIDA/b-$t.txt" $?; sleep 4
done
timeout "$TOPE" npx firebase emulators:exec --only auth,database --project demo-tvretro "node simular-tv.cjs" > "$SALIDA/b-sim.txt" 2>&1; resumen simular-tv "$SALIDA/b-sim.txt" $?; sleep 4
for t in probar-migracion probar-biblioteca liberar-tv; do
  timeout "$TOPE" npx firebase emulators:exec --only auth,database --project "demo-$t" "node $t.cjs" > "$SALIDA/b-$t.txt" 2>&1; resumen "$t" "$SALIDA/b-$t.txt" $?; sleep 4
done
echo "### FIN (suites con fallas: $FALLOS)"
[ "$FALLOS" -eq 0 ]
