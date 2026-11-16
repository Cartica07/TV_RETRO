// "Cancion corta de prueba" -- ejemplo mínimo para las pruebas (no es una canción del catálogo).
#define BUZZER 4

void setup() {
}

void loop() {
  tone(BUZZER, 440);
  delay(200);
  tone(BUZZER, 494);
  delay(200);
  noTone(BUZZER);
  delay(300);
}
