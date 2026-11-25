# Batería de Pepito con divisor resistivo (2026-11-25)

Reemplaza al módulo indicador de batería: el voltaje de la batería se baja con dos resistencias para que entre al ESP32 entre 0 y 3,3 V, y Pepito lo muestra en las caras de reloj con **5 líneas de 20 % cada una**. Sirve igual para **Pepito Pro** y **Pepito Lite**.

Estado: **programa listo y compilado; falta soldar el divisor y probarlo en la placa.**

## 1. Qué hay que conseguir

| Pieza | Valor | Para qué |
|---|---|---|
| R1 | 100 kΩ | del positivo de la batería al pin |
| R2 | **220 kΩ en la Pro** y **100 kΩ en la Lite con ESP32-C3** (ver la sección 3) | del pin a GND |
| C | 100 nF (cerámico, **no más de 220 nF**) | del pin a GND, pegado al pin: calma la lectura |

```
positivo de la batería ──[ R1 100 k ]──┬──[ R2 220 k ]── GND
                                       │
                                       ├── pin del ESP32 (GPIO 3)
                                       └──[ C 100 nF ]── GND
```

- **GND común:** el GND del divisor tiene que ser el mismo GND de la placa.
- **Dónde tomar el positivo:** del mismo punto que alimenta la placa, **después del interruptor** si lo hay. Si se toma antes, el divisor gasta unos 13 microamperios aunque Pepito esté apagado (poco, pero evitable).
- Si la batería se carga con un módulo (por ejemplo, un TP4056), el divisor va en el positivo de la **batería**, no en la salida de USB.

## 2. En qué pin va

- **Pepito Pro (ESP32-S3):** **GPIO 3**, en la misma fila de la placa que los pines 4 a 11. La otra fila queda sin usar.
- **Pepito Lite (ESP32-C3 y la S3 de pruebas):** también **GPIO 3**.
- **Por qué ese:** tiene que ser un pin del ADC1 (el ADC2 no se puede leer con el Wi-Fi encendido, y la Pro lo usa siempre). El GPIO 3 es el único pin del ADC1 que queda libre en esa fila (el 4 al 10 ya están usados). En la S3 el GPIO 3 también "lee" algo al arrancar (elegir la fuente del JTAG), pero por defecto esa función no se usa (el JTAG es el del puerto USB), así que el divisor no estorba.
- El pin se cambia en un solo lugar: `PIN_BATERIA` en `pines.h` (Pro) y `pines_lite.h` (Lite).

## 3. Los números

Con 100 kΩ y 220 kΩ el pin recibe el 68,75 % del voltaje de la batería:

| Batería | En el pin |
|---|---|
| 4,20 V (llena) | 2,89 V |
| 4,00 V | 2,75 V |
| 3,70 V | 2,54 V |
| 3,30 V | 2,27 V |
| 3,00 V | 2,06 V |

Todo queda dentro del rango del ADC de la S3 (hasta unos 3,1 V), incluso con una carga de 4,25 V. Consumo del divisor: 4,2 V / 320 kΩ ≈ 13 µA.

### Pepito Lite con ESP32-C3: R2 = 100 kΩ

El ADC de la C3 llega solo hasta unos 2,5 V (según la documentación de Espressif de la versión anterior del compilador; la de la S3 llega a unos 3,1 V). Con 220 kΩ la batería llena daría 2,89 V y la lectura se aplastaría: marcaría 5 líneas casi hasta vaciarse. Por eso en la C3 R1 y R2 son **las dos de 100 kΩ** (el pin recibe la mitad):

| Batería | En el pin (C3) |
|---|---|
| 4,20 V (llena) | 2,10 V |
| 3,70 V | 1,85 V |
| 3,30 V | 1,65 V |
| 3,00 V | 1,50 V |

No hay que configurar nada: `pines_lite.h` ya trae `BATERIA_R_ABAJO 100000` para la C3. La S3 de pruebas con el programa de la Lite usa 100 kΩ / 220 kΩ, como la Pro. Consumo del divisor en la C3: 4,2 V / 200 kΩ ≈ 21 µA.

## 4. Cómo se reparten los 5 niveles

El programa mide cada 10 segundos (promedio de 16 lecturas, suavizado y con un margen de 3 puntos para que no parpadee en el borde), convierte el voltaje en porcentaje con la curva típica de una celda de litio y lo reparte así:

| Líneas | Porcentaje | Voltaje aproximado |
|---|---|---|
| 5 | más de 80 % | más de 4,02 V |
| 4 | 61 a 80 % | 3,89 a 4,02 V |
| 3 | 41 a 60 % | 3,77 a 3,89 V |
| 2 | 21 a 40 % | 3,64 a 3,77 V |
| 1 | hasta 20 % | menos de 3,64 V |

La curva es una aproximación: cada batería se comporta un poco distinto. Se puede afinar mirando el registro serie (`[bateria] … mV, … %, nivel …`) y comparando con un multímetro; si hace falta corregir, se cambia `BATERIA_AJUSTE_MV` (milivoltios que se suman) en `bateria.cpp`.

## 5. Qué se ve y cuándo

- La batería sale en las **caras de reloj que incluyan el elemento "Batería"** (editor de caras: estilos "Segmentos" y "Barra", con o sin el porcentaje). **La Cara 1 (el reloj normal) no lo lleva.**
- **Sin divisor soldado:** al primer uso el programa prueba el pin (lo descarga y lo carga y compara) y, además, descarta las lecturas muy ruidosas. **Normalmente** así detecta que no hay divisor y no muestra batería, pero es una prueba eléctrica y no una garantía: un pin al aire con fugas podría engañarla. Solo afecta a las caras que incluyen el elemento "Batería" (la Cara 1 no lo lleva). Después de soldar el divisor hay que **reiniciar** Pepito para que lo detecte.
- **Solo USB, sin batería:** menos de 2,8 V en la batería, no muestra nada.
- **Cargando por USB:** el voltaje sube y las líneas van subiendo.
- **Con un condensador más grande de 220 nF** la detección puede creer que no hay divisor: usar 100 nF.

## 6. Qué falta

- [ ] Soldar el divisor en una Pro (100 k / 220 k) y en una Lite C3 (100 k / 100 k).
- [ ] Grabar y mirar el registro serie: debe decir `hay divisor` y los milivoltios de la batería.
- [ ] Comparar con un multímetro y, si hace falta, ajustar `BATERIA_AJUSTE_MV`.
- [ ] Subir al catálogo una cara que incluya la batería para verla.
- [ ] Revisar la curva con la batería real (descargarla y mirar cuándo cambia cada línea).
