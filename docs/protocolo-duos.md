# Dúos: cómo se hablan dos Pepito Pro (protocolo "dúo v1", 2026-11-24)

> Solo Pepito Pro (decisión del dueño, 2026-11-24). Radio: **ESP-NOW** sobre el Wi-Fi que la Pro ya tiene encendido.
> Base: la prueba aislada `Duos_Prueba` (fase 0, ver `docs/plan-duos.md`), que funcionó 14 de 14 con 36-42 ms del contacto al
> arranque. Este documento manda sobre el firmware (`OLED_Remota/duos.cpp`) y sobre la placa de pruebas ESP8266
> (`Duos_Prueba/`): si algo cambia, se cambia aquí primero.
> Lo marcado **(propuesta)** no lo ha decidido el dueño todavía; va con un valor por defecto.

## 1. Papeles

- Cada Pepito Pro lleva un **imán en el lateral izquierdo** y un **sensor Hall en el lateral derecho**.
- **TV de la izquierda** = la que siente el imán. Busca a la otra, elige el dúo, mide la demora y da la salida. Reproduce la
  mitad `izq` del dúo.
- **TV de la derecha** = la que contesta (no siente nada). Reproduce la mitad `der`.
- Una misma TV puede ser izquierda en un dúo y derecha en otro; el firmware hace los dos papeles.

## 2. Radio

- ESP-NOW en el **canal actual** del Wi-Fi (par con canal 0). Dos Pro en la misma casa están en el canal de su router.
  Con dos routers distintos (otra casa) no se encuentran todavía: queda para más adelante (soltar el Wi-Fi unos segundos y
  buscar por los canales).
- **El canal va dentro del HOLA (2026-11-24, tras la primera prueba en la placa):** pegadas, una TV oye a la otra aunque esté
  sintonizada 2 o 3 canales más allá (los canales de 2,4 GHz se pisan). La ESP8266 de pruebas se quedaba en un canal vecino
  (6 o 9) y su respuesta llegaba débil a la S3, que la descartaba por la regla de cercanía. Por eso la izquierda dice su canal
  y una TV que puede cambiar de canal (la ESP8266, que no está en ningún router) se pone en ese. Una Pro conectada a su router
  no cambia de canal: si los canales no coinciden, no contesta (dos routers distintos: más adelante).
- Sin cifrado ESP-NOW (la seguridad está en la sesión, la cercanía y la ventana de tiempo: sección 6).
- ESP-NOW se enciende solo cuando el Wi-Fi ya está en marcha (modo estación). Con el portal del Wi-Fi abierto no hay dúos
  (el portal corre antes del `loop()`).
- Lo que llega por la radio (tarea del Wi-Fi) pasa al `loop()` por una **cola** de FreeRTOS de 8 mensajes; si se llena, se
  descarta lo nuevo.

## 3. Mensajes

Todos empiezan con la misma cabecera de 8 bytes, en little-endian:

| Byte | Campo | Valor |
|---|---|---|
| 0-1 | marca | `'D'`, `'U'` |
| 2 | versión del protocolo | `2` (la 1 llevaba el AQUI sin favorito; la prueba de la fase 0 no tenía este byte: sus mensajes se ignoran) |
| 3 | tipo | ver tabla |
| 4-7 | sesión | número al azar que elige la izquierda en cada contacto; todos los mensajes de ese dúo lo llevan |

Después va el contenido de cada tipo. Largo máximo: 250 bytes (límite de ESP-NOW). Un mensaje más corto que lo que pide su
tipo, o con otra marca o versión, se ignora.

| Tipo | Nombre | De → a | Contenido (después de la cabecera) |
|---|---|---|---|
| 1 | HOLA | izquierda → todas (difusión) | `favorita` uint32, `n` uint8 (≤ 16), `claves` n × uint32: los dúos que tiene; `canal` uint8: su canal Wi-Fi |
| 2 | AQUI | derecha → izquierda | `favorita` uint32 (la de la derecha), `n` uint8 (≤ 16), `claves` n × uint32; `canal` uint8: su canal Wi-Fi |
| 3 | PING | izquierda → derecha | `numero` uint8 |
| 4 | PONG | derecha → izquierda | `numero` uint8 (el mismo del PING) |
| 5 | PREPARA | izquierda → derecha | `clave` uint32: el dúo elegido |
| 6 | LISTO | derecha → izquierda | `clave` uint32, `ok` uint8 (1 = cargó su mitad; 0 = no pudo) |
| 7 | EMPIEZA | izquierda → derecha | `clave` uint32, `en` uint16: empezar `en` ms después de recibirlo |
| 8 | VIVO | izquierda → derecha | nada (la izquierda sigue pegada y reproduciendo) |
| 9 | FIN | cualquiera → la otra | `motivo` uint8: 1 separadas, 2 terminó, 3 alarma, 4 botón, 5 error, 6 no hay dúo común |

**Claves de los dúos:** número de 32 bits = FNV-1a de la clave de texto del catálogo (la que da el editor, por ejemplo
`prueba`). El **dúo de prueba** (`prueba`, FNV-1a = `0x95B30930`; FNV-1a de 32 bits: base `0x811C9DC5`, primo `0x01000193`, sobre los bytes UTF-8) viene
dentro de todo firmware con dúos: siempre hay al menos un dúo en común. El catálogo de la nube (fase 2, por aprobar) solo
agrega claves a las listas: no cambia los mensajes.

## 4. Secuencia

```
IZQUIERDA (siente el imán)                         DERECHA
  sensor 80 ms estable → sesión nueva
  HOLA (difusión, cada 50 ms, hasta 2 s) ───────▶  ¿puede? (sección 5) y señal ≥ -58 dBm
                                         ◀───────  AQUI (sus claves); queda atada a esa izquierda y esa sesión 3 s
  espera 100 ms más por si contestan varias;
  se queda con la de señal más fuerte (≥ -58 dBm)
  elige el dúo (ver "Qué dúo suena"): el favorito de la izquierda si la derecha lo tiene; si no, el de la derecha si la
  izquierda lo tiene; si no, el primero en común (el de prueba siempre está)
  PING ×3 ──────────────────────────────────────▶
                                         ◀───────  PONG ×3
  demora = mediana de las 3 idas y vueltas
  PREPARA(clave) ───────────────────────────────▶  toma la pantalla (sección 5) y carga su mitad
  (carga su propia mitad mientras tanto)  ◀───────  LISTO(clave, ok)
  EMPIEZA(clave, en = 40) ──────────────────────▶  empieza a los 40 ms de recibirlo
  empieza a los 40 ms + demora/2 de enviarlo
  VIVO cada 200 ms ─────────────────────────────▶  si pasa 1 s sin VIVO, para (por si se perdió el FIN)
  ... las dos reproducen su mitad ...
  al terminar (misma duración) o al separarse: FIN
```

Tiempos de espera: sin AQUI en 2 s → no pasa nada (contacto falso: un imán que no es una TV); un PONG que no llega en 200 ms
se repite (hasta 3 veces en total por cada uno); sin LISTO en 1 s, o LISTO con `ok = 0` → FIN(error) y vuelve todo como estaba.

Después de un dúo (terminado o cortado), la izquierda **no vuelve a buscar hasta que se separen** y se junten otra vez
(propuesta, igual que la fase 0).

## 5. Prioridades (las dos TV aplican la misma tabla)

| Situación en la TV | Qué pasa |
|---|---|
| Alarma sonando | No empieza (no contesta / no busca). Si empieza a sonar a mitad, gana la alarma: FIN(alarma) a la otra |
| Actualización por Wi-Fi en curso | No empieza |
| Código para vincular a la vista, o pantalla de vincular | No empieza |
| Partida de un juego | Gana el dúo: la partida se pausa y sigue al terminar |
| Suena una canción (con o sin letra) | Gana el dúo: la canción se corta; al terminar vuelve lo de antes (igual que tras una alarma) |
| GIF o texto con scroll | Se detiene; al terminar se vuelve a dibujar |
| Pantalla dormida | Se prende para el dúo; al terminar queda prendida 10 s y se vuelve a apagar si no se toca nada |
| Llega contenido del celular a mitad | Espera; se aplica al terminar el dúo |
| Botón A a mitad del dúo | **(propuesta)** Corta el dúo en las dos: FIN(botón) |
| Se separan a mitad | Las dos paran y vuelve lo que mostraba cada una |

## 6. Seguridad y cercanía

- La derecha solo obedece PREPARA, EMPIEZA, VIVO y FIN de **la misma dirección y la misma sesión** a la que contestó, y solo
  durante 3 s después del AQUI (luego, mientras dura el dúo).
- **Regla de cercanía:** solo cuentan mensajes con señal de **-58 dBm o más** (medido en la fase 0: pegadas -46/-47, a 30 cm
  -65). La aplican las dos (la izquierda sobre el AQUI, la derecha sobre el HOLA). La ESP8266 de pruebas no da la señal en
  ESP-NOW: con ella de izquierda no se puede probar el umbral.
- La izquierda solo busca con el sensor sintiendo el imán: nadie puede hacer sonar una TV desde lejos sin tenerla pegada.
- Nada de esto va a Firebase ni toca el contenido, el acuse, `/ultimo.json` ni el sobre.

## 7. Reproducción

- Cada mitad es una grabación **m1** (la de las canciones con letra). La TV usa el **mismo reproductor** de las canciones con
  letra (`musical.cpp`), como ya hace la alarma: no gasta memoria nueva (un segundo reproductor costaría ~11 KB de memoria
  interna, y la Pro va justa). Por eso el dúo corta la canción que sonara y, al terminar, se repone igual que tras una alarma.
- Para que las dos empiecen juntas, la mitad se **carga antes** (PREPARA) y se arranca a una hora fijada (`EMPIEZA`), con una
  función nueva del reproductor que fija el inicio sin volver a leer el archivo.
- Los dúos se guardan en `/duos/<clave>_izq.m1` y `/duos/<clave>_der.m1`. El de prueba va dentro del firmware y se escribe ahí
  al encender si falta.

## 8. Compilación

- **Desde el 2026-11-25 los dúos son parte de la Pepito Pro** (decisión del dueño): `TVRETRO_DUOS` (en `OLED_Remota/duos_config.h`) viene **en 1** y todas las versiones nuevas los llevan. Con 0 (solo para comparar o descartar un fallo, nunca para publicar), el firmware queda como antes de los dúos:
  ni ESP-NOW ni cambios en el `loop()` ni en el reproductor.
- No cambia `FIRMWARE_BUILD` ni se publica nada: la siguiente Pro publicada sigue siendo la 12.

## 9. Pruebas en la placa (fase 1; grabar cada placa necesita el permiso del dueño)

La Pro se compila tal cual (`TVRETRO_DUOS` ya viene en 1 desde el 2026-11-25) y la ESP8266 con `Duos_Prueba/`.
El dúo de prueba (el corazón, 3,3 s) se genera con `app-unificada/herramientas/editor-duos/generar-duo-prueba.mjs`.

1. **S3 receptora:** la S3 (Pro con dúos) a la derecha, la ESP8266 a la izquierda: su botón (D1) hace de sensor (hundido = pegadas, soltarlo = separarlas; la carcasa ya no se abre). La ESP8266 busca el
   canal sola (o `canal N` por el monitor serie). Mirar: que la S3 conteste (`[duo] contesté…`), la mitad cargada y su tiempo
   de carga, el corazón cruzando, separar a mitad (la S3 para en ~1 s sin VIVO), y que vuelva lo que mostraba la S3.
2. **S3 transmisora:** la S3 a la izquierda (sensor en GPIO 11), la ESP8266 a la derecha. Mirar: del contacto al arranque,
   las idas y vueltas, el sonido en la S3, separar a mitad (las dos paran), y un imán solo (sin la otra TV: nada en 2 s).
3. **Prioridades en la S3:** con una canción con letra sonando (se corta y vuelve lo de antes), con un GIF, en el reloj, en
   una partida (pausa y sigue), con la pantalla dormida (se prende y se apaga a los 10 s), con la alarma (gana la alarma y la
   otra TV para), botón A a mitad (corta en las dos) y contenido que llega a mitad (se aplica al terminar).
4. **Carga (pendiente de la fase 0):** ESP-NOW escuchando mientras baja un GIF grande, durante una actualización por Wi-Fi y
   con la cara Clima: memoria interna libre y mayor bloque (`[duo] ESP-NOW listo …`), sin reinicios ni `HTTP -1`.
5. **Con la bandera en 0:** el .bin debe medir lo mismo (o casi) que antes de los dúos.

## 10. El catálogo en la TV (2026-11-24; campos aprobados por el dueño, ver `formatos-datos.md`)

- **Ajustes:** con los demás ajustes (al conectarse y con cada orden `ajustes`) la TV lee `ajustes.duos` (si falta, activados)
  y `ajustes.duoFavorito`, y los guarda en su NVS (sin internet al encender, valen). Con los dúos desactivados la TV **ni busca
  ni contesta** (los dos papeles).
- **Revisión del catálogo:** al conectarse, con cada orden `ajustes` (tocar Más > Dúos en la app la manda: un dúo recién subido
  aparece sin esperar) y cada 6 horas. Lee `duos/indice` **sin las portadas** (filtro) y se queda con los 10 primeros por `orden`.
  Si un dúo no está o cambió su `fecha`, baja sus mitades (`duos/datos/<clave>/izq|der`) a `/duos/<clave>_<lado>.tmp`.
- **Nunca compite con lo demás:** media mitad por vuelta de la tarea de red y solo si no hay contenido por aplicar, ni
  actualización, ni código para vincular. Si algo falla, reintenta en 5 minutos. Si quedarían menos de 1,5 MB libres (para un
  GIF grande), ese dúo no se baja (queda en el registro serie).
- **Un dueño por archivo:** la tarea de red solo escribe `.tmp` (y comprueba que sean m1). El `loop()`, **fuera de un dúo**, los
  pasa a `.m1`, guarda la `fecha` (`/duos/<clave>.fecha`), borra los que ya no están en el catálogo (nunca `prueba`), escribe el
  orden (`/duos/orden.txt`) y vuelve a leer la lista.
- **Orden y favorito:** la lista de la TV sigue el orden del catálogo, con `prueba` (el que va dentro del firmware) al final.
  Favorito = el de la app si la TV lo tiene; si no, el primero del catálogo. Al juntar dos TV gana el favorito de la izquierda si
  la otra lo tiene; si no, el primero en común.
- **Qué se puede probar con la ESP8266:** solo tiene `prueba`, así que con ella el dúo siempre será `prueba`. Sí se prueba la
  lectura del índice, la descarga, la comprobación m1, el borrado de un dúo quitado, el interruptor (ni busca ni contesta) y el
  favorito en el registro (`[duo] elegido … (favorito …; la otra no lo tiene)`). Un dúo del catálogo solo se verá entre dos Pro
  (la segunda S3).

### Qué dúo suena (confirmado por el dueño, 2026-11-25)
1. El **favorito de la TV de la izquierda** (la del sensor), si la derecha también lo tiene. Siempre manda el de la izquierda cuando se puede.
2. Si la derecha no lo tiene (caso raro: todavía no terminó de bajar el catálogo), el **favorito de la derecha**, si la izquierda lo tiene.
3. Solo si ninguna tiene el favorito de la otra, el **primer dúo que tengan en común** (el de prueba siempre está).

Por eso el AQUI lleva el favorito de la derecha (protocolo versión 2). Es lo que hace `elegirDuo()` de `duos.cpp`; cambiar de lado las TV cambia cuál favorito suena.
