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
| 2 | versión del protocolo | `1` (la prueba de la fase 0 no tenía este byte: sus mensajes se ignoran) |
| 3 | tipo | ver tabla |
| 4-7 | sesión | número al azar que elige la izquierda en cada contacto; todos los mensajes de ese dúo lo llevan |

Después va el contenido de cada tipo. Largo máximo: 250 bytes (límite de ESP-NOW). Un mensaje más corto que lo que pide su
tipo, o con otra marca o versión, se ignora.

| Tipo | Nombre | De → a | Contenido (después de la cabecera) |
|---|---|---|---|
| 1 | HOLA | izquierda → todas (difusión) | `favorita` uint32, `n` uint8 (≤ 16), `claves` n × uint32: los dúos que tiene |
| 2 | AQUI | derecha → izquierda | `n` uint8 (≤ 16), `claves` n × uint32 |
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
  elige el dúo: la favorita si la otra la tiene;
  si no, la primera en común (el de prueba siempre está)
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

- Todo va detrás de `TVRETRO_DUOS` (en `OLED_Remota/duos_config.h`, **0 por defecto**). Con 0, el firmware es el de siempre:
  ni ESP-NOW ni cambios en el `loop()` ni en el reproductor.
- No cambia `FIRMWARE_BUILD` ni se publica nada: la siguiente Pro publicada sigue siendo la 12.
